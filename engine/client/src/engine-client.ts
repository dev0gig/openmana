/*
 * EngineClient: the page's side of the engine (main thread).
 *
 *   UI  ──calls──▶  EngineClient  ──postMessage (commands)──▶  Dedicated Worker
 *                        │        ──input queue (SAB)───────▶  (worker host + Forge)
 *   UI  ◀──events──  EngineClient ◀──postMessage (messages)──
 *
 * What it does, and nothing more:
 *  - checks the runtime before the ~70 MB engine is loaded (feature detection),
 *  - starts the worker and the input queue, checks the protocol version,
 *  - validates EVERY message from the worker against the protocol schema and
 *    the protocol's sequencing rules; a violation is a technical abort,
 *  - keeps the bookkeeping the UI needs to not send nonsense: the latest full
 *    snapshot, the open questions, the blocking question, visible card ids,
 *  - refuses inputs it can already tell are wrong, loudly and synchronously
 *    (EngineInputError); everything else the engine answers itself,
 *  - watches the engine: a ready timeout (abort) and a stall watchdog
 *    ("engine does not respond", not an abort: the UI offers a restart).
 *
 * It knows no Magic rule. Whether an action is legal is Forge's decision; the
 * client only checks what the protocol itself states (ids, kinds, blocking).
 */
import {
  checkEngineMessage,
  checkMatchRequest,
  createInputQueue,
  DEFAULT_INPUT_QUEUE_CAPACITY,
  describeMissingFeatures,
  detectEngineFeatures,
  formatProblems,
  inputProblems,
  InputQueueError,
  PROTOCOL_VERSION,
  ProtocolViolation,
  type AnswerBody,
  type EngineAbort,
  type EngineInput,
  type EngineMessage,
  type EngineReady,
  type FeatureReport,
  type FeatureScope,
  type GameEnd,
  type GameStarted,
  type GameState,
  type InputQueueWriter,
  type MatchRequest,
  type MatchSummary,
  type AiMatchResult,
  type CardProbeResult,
  type Question,
} from "../../protocol/src/index.ts";
import { EngineClientError, EngineInputError } from "./errors.ts";
import type { EngineWorkerPort, EngineWorkerPortFactory, WorkerProblem } from "./worker-port.ts";

/**
 * booting → ready → starting → playing → ended → finished; a refused start
 * (engine.error) goes back to ready. diagnostics: an engine test (AI-only
 * game or card probe), finished afterwards.
 * aborted and disposed are final.
 */
export type EngineStatus = "idle" | "booting" | "ready" | "starting" | "playing" | "ended" | "finished" | "diagnostics" | "aborted" | "disposed";

export type EngineClientEvent =
  /** A validated message of the engine (also a client-side engine.abort). */
  | { readonly kind: "message"; readonly message: EngineMessage }
  | { readonly kind: "status"; readonly status: EngineStatus; readonly previous: EngineStatus }
  /** The engine is working but has not said anything for stallTimeoutMs: show "engine does not respond". */
  | { readonly kind: "stalled"; readonly silentMs: number }
  /** After a stall: the engine spoke again. */
  | { readonly kind: "responsive"; readonly silentMs: number };

export type EngineClientListener = (event: EngineClientEvent) => void;

export interface EngineClientTimers {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface EngineClientOptions {
  readonly createPort: EngineWorkerPortFactory;
  readonly engineScriptUrl: string;
  readonly wasmUrl: string;
  readonly engineArgs?: readonly string[];
  /** Bytes of the input queue (power of two). Default 64 KiB. */
  readonly queueCapacity?: number;
  /** Require cross-origin isolation (browsers: true, the default; Node: false). */
  readonly requireIsolation?: boolean;
  /** Abort if the engine is not ready after this long. Default 180 s (slow phones). */
  readonly readyTimeoutMs?: number;
  /** Report "stalled" if the working engine is silent this long. Default 30 s. */
  readonly stallTimeoutMs?: number;
  readonly timers?: EngineClientTimers;
  /** Tests: the globals feature detection looks at. */
  readonly featureScope?: FeatureScope;
  /** Tests only: announce another protocol version to the worker (mismatch test). */
  readonly announceProtocol?: number;
}

/** What the client did so far (diagnostics; e.g. the cost of validating every message). */
export interface EngineClientStats {
  readonly messages: number;
  readonly validationMs: number;
  readonly maxValidationMs: number;
}

/** An input as the UI hands it over: everything except seq, which the client assigns. */
export type EngineInputDraft = EngineInput extends infer I ? (I extends EngineInput ? Omit<I, "seq"> : never) : never;

const DEFAULT_READY_TIMEOUT_MS = 180_000;
const DEFAULT_STALL_TIMEOUT_MS = 30_000;

const realTimers: EngineClientTimers = {
  now: () => (typeof performance === "object" ? performance.now() : Date.now()),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Statuses in which the engine may send which messages (anything else is a protocol violation). */
const ALLOWED: Readonly<Record<string, readonly EngineStatus[]>> = {
  "engine.boot": ["booting"],
  "engine.ready": ["booting"],
  "engine.error": ["starting"],
  "engine.waiting": ["playing"],
  "game.started": ["starting"],
  state: ["playing"],
  events: ["playing", "ended"],
  message: ["playing", "ended"],
  question: ["playing"],
  "question.withdrawn": ["playing"],
  "question.answered": ["playing"],
  "input.rejected": ["playing"],
  "game.end": ["playing"],
  "match.finished": ["ended"],
  "diagnostics.result": ["diagnostics"],
  "diagnostics.cards": ["diagnostics"],
  // Engine tests only, and only if asked for (MatchRequest.trace, runAiDiagnostics(…, trace)).
  "diagnostics.trace": ["playing", "ended", "diagnostics"],
};

export class EngineClient {
  readonly #options: EngineClientOptions;
  readonly #timers: EngineClientTimers;
  readonly #listeners = new Set<EngineClientListener>();
  #status: EngineStatus = "idle";
  #port: EngineWorkerPort | null = null;
  #queue: InputQueueWriter | null = null;
  #features: FeatureReport | null = null;

  #engine: EngineReady | null = null;
  #game: GameStarted | null = null;
  #state: GameState | null = null;
  #result: GameEnd | null = null;
  #summary: MatchSummary | null = null;
  #diagnostics: AiMatchResult | null = null;
  #cardProbe: CardProbeResult | null = null;
  #abort: EngineAbort | null = null;

  readonly #open = new Map<number, Question>();
  #blocking: Question | null = null;
  #highestQuestion = 0;
  #visibleCards = new Set<number>();
  #players = new Set<number>();
  #consumed = 0;
  #waiting = false;
  /** Engine tests: the match or AI diagnostics asked for the engine trace, and how many entries arrived. */
  #traceRequested = false;
  #traceEntries = 0;

  #messages = 0;
  #validationMs = 0;
  #maxValidationMs = 0;

  #readyTimer: unknown = null;
  #stallTimer: unknown = null;
  /** Last sign of life: a message from the engine, or work handed to it (a waiting engine is not silent). */
  #activityAt = 0;
  #stalled = false;

  constructor(options: EngineClientOptions) {
    this.#options = options;
    this.#timers = options.timers ?? realTimers;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Checks the runtime, creates the input queue and the worker and starts the
   * engine. Subscribe before calling it. An unsupported runtime or a failed
   * start ends in status "aborted" with an engine.abort event, never in a
   * silent hang.
   */
  start(): void {
    if (this.#status !== "idle") {
      throw new EngineClientError("already-started", "start() was already called; use a new EngineClient (one engine per game)");
    }
    this.#setStatus("booting");
    const features = detectEngineFeatures({
      requireIsolation: this.#options.requireIsolation !== false,
      ...(this.#options.featureScope ? { scope: this.#options.featureScope } : {}),
    });
    this.#features = features;
    if (!features.supported) {
      this.#fail({ reason: "unsupported-browser", message: describeMissingFeatures(features), stage: "features", missing: [...features.missing] });
      return;
    }
    try {
      this.#queue = createInputQueue(this.#options.queueCapacity ?? DEFAULT_INPUT_QUEUE_CAPACITY);
    } catch (e) {
      this.#fail({ reason: "transport-error", message: `the input queue could not be created: ${String(e)}`, stage: "queue" });
      return;
    }
    try {
      this.#port = this.#options.createPort({
        message: (data) => this.#onWorkerMessage(data),
        error: (problem) => this.#onWorkerProblem(problem),
      });
    } catch (e) {
      this.#fail({ reason: "worker-error", message: `the engine worker could not be created: ${String(e)}`, stage: "worker" });
      return;
    }
    this.#activityAt = this.#timers.now();
    this.#readyTimer = this.#timers.setTimeout(() => {
      this.#readyTimer = null;
      const ms = this.#options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
      this.#fail({ reason: "ready-timeout", message: `the engine was not ready after ${Math.round(ms / 1000)} s`, stage: "boot" });
    }, this.#options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS);
    this.#port.post({
      type: "engine.start",
      protocol: (this.#options.announceProtocol ?? PROTOCOL_VERSION) as typeof PROTOCOL_VERSION,
      engineScriptUrl: this.#options.engineScriptUrl,
      wasmUrl: this.#options.wasmUrl,
      args: [...(this.#options.engineArgs ?? [])],
      queue: this.#queue.buffer,
      requireIsolation: this.#options.requireIsolation !== false,
    });
  }

  /** Starts a game human vs. Forge AI. Only in status ready (a refused start returns to ready). */
  startMatch(request: MatchRequest): void {
    this.#requireStatus("ready", "startMatch");
    try {
      checkMatchRequest(request);
    } catch (e) {
      throw new EngineClientError("invalid-request", e instanceof ProtocolViolation ? e.message : String(e), { cause: e });
    }
    this.#setStatus("starting");
    this.#traceRequested = request.trace === true;
    this.#post({ type: "match.start", match: request });
  }

  /**
   * Engine tests only: Forge's AI plays itself (diagnostics.ai-match); with
   * trace the engine also sends its trace (diagnostics.trace).
   */
  runAiDiagnostics(seed: number, includeLog = false, trace = false): void {
    this.#requireStatus("ready", "runAiDiagnostics");
    this.#setStatus("diagnostics");
    this.#traceRequested = trace;
    this.#post({ type: "diagnostics.ai-match", seed, includeLog, ...(trace ? { trace: true } : {}) });
  }

  /** Engine tests only: Forge's card scripts checked inside the engine (diagnostics.card-probe). */
  runCardProbe(): void {
    this.#requireStatus("ready", "runCardProbe");
    this.#setStatus("diagnostics");
    this.#post({ type: "diagnostics.card-probe" });
  }

  /** Technical abort by the UI (e.g. "restart engine"): terminates the worker. */
  abort(message = "aborted by the user interface"): void {
    this.#fail({ reason: "terminated", message, stage: "client" });
  }

  /** Ends the client: terminates the worker, no further events. */
  dispose(): void {
    if (this.#status === "disposed") {
      return;
    }
    this.#clearTimers();
    this.#port?.terminate();
    this.#port = null;
    this.#setStatus("disposed");
    this.#listeners.clear();
  }

  subscribe(listener: EngineClientListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // ── What the UI reads ───────────────────────────────────────────────────────

  get status(): EngineStatus {
    return this.#status;
  }
  /** The runtime check done by start(). */
  get features(): FeatureReport | null {
    return this.#features;
  }
  /** engine.ready: protocol, Forge and engine build. */
  get engine(): EngineReady | null {
    return this.#engine;
  }
  get game(): GameStarted | null {
    return this.#game;
  }
  /** The latest full snapshot (replaced, never merged). */
  get state(): GameState | null {
    return this.#state;
  }
  get result(): GameEnd | null {
    return this.#result;
  }
  get summary(): MatchSummary | null {
    return this.#summary;
  }
  get diagnostics(): AiMatchResult | null {
    return this.#diagnostics;
  }
  get cardProbe(): CardProbeResult | null {
    return this.#cardProbe;
  }
  get abortInfo(): EngineAbort | null {
    return this.#abort;
  }
  /** Questions Forge is asking right now, by id. */
  get openQuestions(): ReadonlyMap<number, Question> {
    return this.#open;
  }
  /** The open blocking question, if any: nothing else can be done until it is answered. */
  get blockingQuestion(): Question | null {
    return this.#blocking;
  }
  /** Bytes of the input queue (0 before start). */
  get queueCapacity(): number {
    return this.#queue?.capacity ?? 0;
  }
  /** Inputs written into the queue (= seq of the last one). */
  get inputsSent(): number {
    return this.#queue?.written ?? 0;
  }
  /** Inputs the engine had processed when it last reported engine.waiting. */
  get inputsConsumed(): number {
    return this.#consumed;
  }
  /** The engine waits for the player (not computing). */
  get engineWaiting(): boolean {
    return this.#waiting;
  }
  get stats(): EngineClientStats {
    return { messages: this.#messages, validationMs: this.#validationMs, maxValidationMs: this.#maxValidationMs };
  }
  /** Engine tests: trace entries received so far (diagnostics.trace). */
  get traceEntries(): number {
    return this.#traceEntries;
  }

  // ── Inputs ──────────────────────────────────────────────────────────────────

  /**
   * What the client would say about this input right now, without sending
   * it: null = it would be sent. Only protocol facts are checked (running
   * game, schema, question ids, kinds, blocking question, visible ids).
   */
  checkInput(draft: EngineInputDraft): EngineInputError | null {
    if (this.#status !== "playing") {
      return new EngineInputError("no-match", `no game is running (status ${this.#status})`);
    }
    const problems = inputProblems({ ...draft, seq: this.inputsSent + 1 });
    if (problems) {
      return new EngineInputError("malformed", `the input does not conform to the protocol: ${formatProblems(problems)}`);
    }
    switch (draft.type) {
      case "answer": {
        const question = this.#open.get(draft.question);
        if (!question) {
          return draft.question > this.#highestQuestion
            ? new EngineInputError("unknown-question", `the engine never asked question ${draft.question}`)
            : new EngineInputError("stale", `question ${draft.question} is no longer open`);
        }
        if (this.#blocking && this.#blocking.id !== question.id) {
          return new EngineInputError("not-active", `question ${this.#blocking.id} must be answered first`);
        }
        if (draft.kind !== question.kind) {
          return new EngineInputError("wrong-kind", `question ${question.id} is a ${question.kind} question, not ${draft.kind}`);
        }
        return null;
      }
      case "card.tap":
        if (this.#blocking) {
          return new EngineInputError("not-active", `question ${this.#blocking.id} must be answered first`);
        }
        return this.#visibleCards.has(draft.card) ? null : new EngineInputError("unknown-card", `no card ${draft.card} is visible in the latest state`);
      case "player.tap":
        if (this.#blocking) {
          return new EngineInputError("not-active", `question ${this.#blocking.id} must be answered first`);
        }
        return this.#players.has(draft.player) ? null : new EngineInputError("unknown-player", `there is no player ${draft.player}`);
      case "state.request":
      case "concede":
        return null;
    }
  }

  /** Answers an open question. Returns the seq of the input. Throws EngineInputError. */
  answer(question: number | Question, body: AnswerBody): number {
    const id = typeof question === "number" ? question : question.id;
    return this.#send({ type: "answer", question: id, ...body } as EngineInputDraft);
  }

  /** Taps a card outside a question (play, pay, attack, block … Forge decides). */
  tapCard(card: number): number {
    return this.#send({ type: "card.tap", card });
  }

  tapPlayer(player: number): number {
    return this.#send({ type: "player.tap", player });
  }

  /** Asks for a fresh full state (served at once, also during a blocking question). */
  requestState(): number {
    return this.#send({ type: "state.request" });
  }

  /** Concedes. Confirm with the player BEFORE calling this: the engine does not ask again. */
  concede(): number {
    return this.#send({ type: "concede" });
  }

  /**
   * Diagnostics and recorded games only: writes the input without the
   * client's checks (the engine's own checks still apply), so tests can prove
   * that the engine refuses what the client would have refused. Only seq is
   * set (to the next number; an existing seq property keeps its position).
   */
  sendUnchecked(input: Readonly<Record<string, unknown>>): number {
    if (this.#status !== "playing") {
      throw new EngineInputError("no-match", `no game is running (status ${this.#status})`);
    }
    return this.#write({ ...input, seq: this.inputsSent + 1 });
  }

  #send(draft: EngineInputDraft): number {
    const problem = this.checkInput(draft);
    if (problem) {
      throw problem;
    }
    // Canonical order type, seq, rest: the same text the JVM test player writes.
    const { type, ...rest } = draft;
    return this.#write({ type, seq: this.inputsSent + 1, ...rest });
  }

  #write(input: Readonly<Record<string, unknown>>): number {
    const queue = this.#queue;
    if (!queue) {
      throw new EngineInputError("no-match", "the engine was never started");
    }
    let seq: number;
    try {
      seq = queue.write(JSON.stringify(input));
    } catch (e) {
      if (e instanceof InputQueueError && (e.code === "full" || e.code === "too-large")) {
        throw new EngineInputError(e.code === "full" ? "queue-full" : "too-large", e.message);
      }
      this.#fail({ reason: "transport-error", message: `the input queue failed: ${String(e)}`, stage: "queue" });
      throw new EngineInputError("no-match", "the engine was aborted: the input queue failed");
    }
    if (seq !== input["seq"]) {
      this.#fail({ reason: "transport-error", message: `input queue numbering broke (record ${seq}, seq ${String(input["seq"])})`, stage: "queue" });
    }
    if (!this.#engineBusy() || this.#waiting) {
      this.#activityAt = this.#timers.now();
    }
    this.#waiting = false;
    this.#armStallWatchdog();
    return seq;
  }

  // ── Messages from the worker ────────────────────────────────────────────────

  #onWorkerProblem(problem: WorkerProblem): void {
    this.#fail({ reason: "worker-error", message: problem.message, stage: "worker", ...(problem.detail ? { detail: problem.detail } : {}) });
  }

  #onWorkerMessage(data: unknown): void {
    if (this.#status === "aborted" || this.#status === "disposed") {
      return;
    }
    const silentMs = this.#timers.now() - this.#activityAt;
    this.#activityAt = this.#timers.now();
    if (this.#stalled) {
      this.#stalled = false;
      this.#emit({ kind: "responsive", silentMs });
    }
    // The version decides whether the rest can be understood at all: check it first.
    if (isObject(data) && (data["type"] === "engine.ready" || data["type"] === "game.started") && data["protocol"] !== PROTOCOL_VERSION) {
      this.#fail({
        reason: "protocol-mismatch",
        message: `the engine speaks protocol ${JSON.stringify(data["protocol"])}, this app speaks protocol ${PROTOCOL_VERSION}; reload the app`,
        stage: String(data["type"]),
      });
      return;
    }
    let message: EngineMessage;
    const validationStart = this.#timers.now();
    try {
      message = checkEngineMessage(data);
    } catch (e) {
      this.#violation(e instanceof ProtocolViolation ? e.message : `unreadable engine message: ${String(e)}`);
      return;
    } finally {
      const ms = this.#timers.now() - validationStart;
      this.#messages++;
      this.#validationMs += ms;
      this.#maxValidationMs = Math.max(this.#maxValidationMs, ms);
    }
    if (message.type === "engine.abort") {
      this.#fail({ ...message, origin: "engine" });
      return;
    }
    const allowed = ALLOWED[message.type];
    if (allowed && !allowed.includes(this.#status)) {
      this.#violation(`'${message.type}' is not allowed in status ${this.#status}`);
      return;
    }
    const problem = this.#apply(message);
    if (problem) {
      this.#violation(problem);
      return;
    }
    this.#armStallWatchdog();
    this.#emit({ kind: "message", message });
  }

  /** Updates the bookkeeping; returns a description of a protocol violation, or null. */
  #apply(message: EngineMessage): string | null {
    switch (message.type) {
      case "engine.boot":
        return null;
      case "engine.ready":
        this.#engine = message;
        this.#clearReadyTimer();
        this.#setStatus("ready");
        return null;
      case "engine.error":
        this.#setStatus("ready");
        return null;
      case "game.started":
        this.#game = message;
        this.#setStatus("playing");
        return null;
      case "engine.waiting":
        if (message.consumed > this.inputsSent || message.consumed < this.#consumed) {
          return `engine.waiting reports ${message.consumed} consumed inputs (sent ${this.inputsSent}, before ${this.#consumed})`;
        }
        this.#consumed = message.consumed;
        this.#waiting = message.consumed === this.inputsSent;
        return null;
      case "state": {
        if (this.#state && message.seq <= this.#state.seq) {
          return `state ${message.seq} after state ${this.#state.seq}: snapshots must arrive in order`;
        }
        this.#state = message;
        this.#players = new Set(message.players.map((p) => p.id));
        const visible = new Set<number>();
        for (const player of message.players) {
          for (const zone of Object.values(player.zones)) {
            for (const card of zone) {
              if ("id" in card) visible.add(card.id);
            }
          }
        }
        this.#visibleCards = visible;
        return null;
      }
      case "question": {
        if (message.id <= this.#highestQuestion) {
          return `question ${message.id} after question ${this.#highestQuestion}: ids must increase`;
        }
        this.#highestQuestion = message.id;
        for (const other of this.#open.values()) {
          if (message.blocking && other.blocking) {
            return `blocking question ${message.id} while blocking question ${other.id} is open`;
          }
          if (!message.blocking && other.kind === message.kind) {
            return `${message.kind} question ${message.id} while ${message.kind} question ${other.id} is still open`;
          }
        }
        this.#open.set(message.id, message);
        if (message.blocking) this.#blocking = message;
        return null;
      }
      case "question.withdrawn":
      case "question.answered": {
        if (!this.#open.has(message.id)) {
          return `${message.type} for question ${message.id}, which is not open`;
        }
        if (message.type === "question.answered" && message.seq > this.inputsSent) {
          return `question.answered by input ${message.seq}, but only ${this.inputsSent} were sent`;
        }
        this.#open.delete(message.id);
        if (this.#blocking?.id === message.id) this.#blocking = null;
        return null;
      }
      case "input.rejected":
        return message.seq > this.inputsSent ? `input.rejected for input ${message.seq}, but only ${this.inputsSent} were sent` : null;
      case "game.end":
        if (this.#open.size > 0) {
          return `game.end while questions ${[...this.#open.keys()].join(", ")} are still open`;
        }
        this.#result = message;
        this.#setStatus("ended");
        return null;
      case "match.finished": {
        const lost = this.#lostTraceEntries(message.summary.trace?.entries);
        if (lost) return lost;
        this.#summary = message.summary;
        this.#setStatus("finished");
        return null;
      }
      case "diagnostics.result": {
        const lost = this.#lostTraceEntries(message.result.trace?.entries);
        if (lost) return lost;
        this.#diagnostics = message.result;
        this.#setStatus("finished");
        return null;
      }
      case "diagnostics.trace":
        if (!this.#traceRequested) {
          return "diagnostics.trace, but no trace was requested (engine tests only: it contains hidden information)";
        }
        if (message.n !== this.#traceEntries + 1) {
          return `trace entry ${message.n} after entry ${this.#traceEntries}: entries must arrive numbered without gaps`;
        }
        this.#traceEntries = message.n;
        return null;
      case "diagnostics.cards":
        this.#cardProbe = message.result;
        this.#setStatus("finished");
        return null;
      case "events":
      case "message":
      case "engine.abort":
        return null;
    }
  }

  /** A trace summary must count exactly the entries that arrived; a summary without one must not follow a trace. */
  #lostTraceEntries(sent: number | undefined): string | null {
    if (!this.#traceRequested) {
      return sent === undefined ? null : "the engine reports a trace that was not requested";
    }
    if (sent !== this.#traceEntries) {
      return `the engine sent ${sent ?? "no"} trace entries, ${this.#traceEntries} arrived`;
    }
    return null;
  }

  // ── Watchdogs, failures, events ─────────────────────────────────────────────

  /** The engine is working (not waiting for the player) in these statuses. */
  #engineBusy(): boolean {
    return this.#status === "starting" || this.#status === "diagnostics" || this.#status === "ended" || (this.#status === "playing" && !this.#waiting);
  }

  #armStallWatchdog(): void {
    if (this.#stallTimer !== null) {
      this.#timers.clearTimeout(this.#stallTimer);
      this.#stallTimer = null;
    }
    if (!this.#engineBusy()) {
      return;
    }
    const ms = this.#options.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS;
    this.#stallTimer = this.#timers.setTimeout(() => {
      this.#stallTimer = null;
      if (this.#engineBusy() && !this.#stalled) {
        this.#stalled = true;
        this.#emit({ kind: "stalled", silentMs: this.#timers.now() - this.#activityAt });
      }
    }, ms);
  }

  #clearReadyTimer(): void {
    if (this.#readyTimer !== null) {
      this.#timers.clearTimeout(this.#readyTimer);
      this.#readyTimer = null;
    }
  }

  #clearTimers(): void {
    this.#clearReadyTimer();
    if (this.#stallTimer !== null) {
      this.#timers.clearTimeout(this.#stallTimer);
      this.#stallTimer = null;
    }
  }

  #violation(message: string): void {
    this.#fail({ reason: "protocol-violation", message, stage: this.#status });
  }

  /** Technical abort: terminate the worker, report once, stay aborted. */
  #fail(abort: Omit<EngineAbort, "type" | "origin"> & { origin?: EngineAbort["origin"] }): void {
    if (this.#status === "aborted" || this.#status === "disposed") {
      return;
    }
    const message: EngineAbort = { type: "engine.abort", origin: "client", ...abort } as EngineAbort;
    this.#abort = message;
    this.#clearTimers();
    this.#port?.terminate();
    this.#port = null;
    this.#open.clear();
    this.#blocking = null;
    this.#waiting = false;
    this.#setStatus("aborted");
    this.#emit({ kind: "message", message });
  }

  #requireStatus(status: EngineStatus, what: string): void {
    if (this.#status === "aborted" || this.#status === "disposed") {
      throw new EngineClientError("closed", `${what}: the engine is ${this.#status}`);
    }
    if (this.#status === "idle") {
      throw new EngineClientError("not-started", `${what}: call start() first`);
    }
    if (this.#status !== status) {
      throw new EngineClientError(
        this.#status === "finished" || this.#status === "playing" || this.#status === "ended" ? "already-started" : "not-ready",
        `${what} needs status ${status}, the engine is ${this.#status}`,
      );
    }
  }

  #post(command: Parameters<EngineWorkerPort["post"]>[0]): void {
    if (!this.#port) {
      throw new EngineClientError("closed", "the engine worker is gone");
    }
    this.#port.post(command);
    this.#activityAt = this.#timers.now();
    this.#armStallWatchdog();
  }

  #setStatus(status: EngineStatus): void {
    const previous = this.#status;
    if (previous === status) {
      return;
    }
    this.#status = status;
    this.#emit({ kind: "status", status, previous });
  }

  #emit(event: EngineClientEvent): void {
    for (const listener of [...this.#listeners]) {
      listener(event);
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
