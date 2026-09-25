/*
 * Replays a human-vs-AI game recorded on the JVM (JvmHumanMatchMain) against
 * the Wasm engine, through the real EngineClient and input queue, and judges
 * the outcome. Shared by engine/wasm/test/node-replay.ts (Node) and the
 * diagnostics page (Chrome). It makes no game decision: every input comes
 * from the recording, Forge in the worker does all the playing.
 *
 * Feeding:
 *  - lazy: one input per engine.waiting. At that moment the client's view is
 *    exactly the engine's view, so every input first goes through the
 *    client's own checks (EngineClient.checkInput): what the client lets
 *    through must not be refused by the engine for a reason the client could
 *    have known (stale, not-active, unknown card/player, malformed), and what
 *    the client refuses must be refused by the engine for the same reason
 *    when it is sent anyway (sendUnchecked). The recorded faults (answer to a
 *    withdrawn or unknown question, invalid button, unknown card, tap during
 *    a blocking question) are exactly such cases.
 *  - eager: as many inputs as fit into a deliberately small queue, whenever
 *    possible. Inputs wrap around the end of the ring and the queue runs full
 *    (queue-full, loud, retried at the next engine.waiting); answers may be
 *    queued before their question was even asked, and the answer to a
 *    withdrawn question arrives while the page still believed it open (a
 *    real race: the engine must reject it as stale).
 *
 * Passed only if the Wasm game ends exactly like the JVM game: the same
 * engine trace (prompt 05: every checkpoint and event, structured and
 * language-independent, compared entry by entry as it arrives; the first
 * difference stops the replay and is reported with its place in the game),
 * same Forge game log (hash), same decision messages (fingerprint incl.
 * question ids, closings and rejections), same calls from Forge into the GUI,
 * same number of inputs, turns and result; no Forge errors, no work on other
 * threads, no protocol violation (the client aborts on any), every snapshot
 * self-contained, the opponent's hand never visible.
 */
import type { EngineClient, EngineClientEvent, EngineInputDraft, EngineInputError } from "../../client/src/index.ts";
import type { EngineInputErrorReason } from "../../client/src/errors.ts";
import type { AnswerBody, EngineMessage, MatchRequest, MatchSummary, RejectReason } from "../../protocol/src/index.ts";
import { opponentHand, snapshotProblems } from "./invariants.ts";
import { describeDivergence, TraceComparison, traceDigest, type TraceEntry } from "./trace.ts";

/** 3: with the engine settings and the engine trace of the JVM game (JvmHumanMatchMain). */
export const TRANSCRIPT_FORMAT = "openmana-input-transcript/3";

export interface Transcript {
  format: string;
  /** The differential test fixture this game comes from (engine/fixtures/differential). */
  name?: string;
  engine?: { language: string; cardLanguage?: string; cardLoading: string };
  request: MatchRequest;
  inputs: Record<string, unknown>[];
  expected: Record<string, unknown>;
  counters: Record<string, number>;
  /** The JVM game's engine trace, if the request asked for one. */
  trace?: TraceEntry[];
}

/** The engine trace of a replay compared with the JVM's. */
export interface TraceVerdict {
  /** Entries of the JVM trace. */
  reference: number;
  /** Entries the Wasm engine sent (and that were compared). */
  compared: number;
  /** SHA-256 over the Wasm engine's trace (engine/wasm/spike/trace.ts traceDigest). */
  sha256: string | null;
  /** The first difference, readable; null if the traces are equal. */
  divergence: string | null;
}

export type Feeding = "lazy" | "eager";

export interface ReplayVerdict {
  ok: boolean;
  failures: string[];
  feeding: Feeding;
  inputsSent: number;
  counters: Record<string, number>;
  summary: MatchSummary | null;
  /** Page time from writing an input to the engine's next engine.waiting (lazy: one input each). */
  engineStepMs: { count: number; p50: number | null; p95: number | null; max: number | null };
  queue: { capacity: number; bytesWritten: number; wraps: number; fullRefusals: number };
  /** Messages the client received and checked against the schema, and what that cost. */
  validation: { messages: number; totalMs: number; maxMs: number };
  /** null if the transcript carries no engine trace. */
  trace: TraceVerdict | null;
}

/** Which engine reasons fit a refusal of the client. */
const ENGINE_REASONS: Readonly<Record<EngineInputErrorReason, readonly RejectReason[]>> = {
  stale: ["stale"],
  "unknown-question": ["stale"],
  "not-active": ["not-active"],
  "wrong-kind": ["invalid"],
  "unknown-card": ["unknown-card"],
  "unknown-player": ["unknown-player"],
  malformed: ["invalid", "malformed"],
  "no-match": [],
  "queue-full": [],
  "too-large": [],
};
/** Reasons the client would have seen coming (lazy mode: then it must have refused itself). */
const CLIENT_KNOWABLE: ReadonlySet<RejectReason> = new Set(["stale", "not-active", "unknown-card", "unknown-player", "malformed"]);

const SAME_AS_JVM = ["logSha256", "logEntries", "protocolSha256", "protocolMessages", "forgeCallbacks", "inputs", "turns", "result", "winner", "reason", "conceded", "trace"];

function percentile(sorted: number[], p: number): number | null {
  return sorted.length === 0 ? null : Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!);
}

function withoutSeq(input: Record<string, unknown>): EngineInputDraft {
  const { seq: _seq, ...rest } = input;
  return rest as unknown as EngineInputDraft;
}

/**
 * Plays the recording once the client is ready (or right away if it already
 * is) and resolves with the verdict when the match is finished or aborted.
 */
export function replay(client: EngineClient, transcript: Transcript, feeding: Feeding, now: () => number): Promise<ReplayVerdict> {
  if (!transcript || transcript.format !== TRANSCRIPT_FORMAT) {
    throw new Error(`not an OpenMana input transcript of format ${TRANSCRIPT_FORMAT}`);
  }
  const inputs = transcript.inputs;
  const failures: string[] = [];
  const counters: Record<string, number> = {};
  const count = (key: string) => {
    counters[key] = (counters[key] ?? 0) + 1;
  };
  const fail = (message: string) => {
    if (failures.length < 60) failures.push(message);
  };
  let next = 0;
  let bytesWritten = 0;
  let fullRefusals = 0;
  let lastWriteAt: number | null = null;
  const steps: number[] = [];
  let stateRequestPending = false;
  /** lazy: what the client said about each input (null = passed its checks). */
  const clientVerdict = new Map<number, EngineInputErrorReason | null>();
  const engineVerdict = new Map<number, RejectReason>();
  let summary: MatchSummary | null = null;
  let snapshotIssues = 0;
  const traced = Array.isArray(transcript.trace);
  if (traced && transcript.request.trace !== true) {
    throw new Error("the transcript carries an engine trace, but its request does not ask for one");
  }
  const comparison = traced ? new TraceComparison(transcript.trace!) : null;
  const traceEntries: TraceEntry[] = [];
  let traceDiverged = false;

  const encoder = new TextEncoder();
  const recordBytes = (input: Record<string, unknown>) => 4 + encoder.encode(JSON.stringify(input)).length;

  /** Writes the recorded input number `next` (lazy: through the client's checks). Returns false if the queue is full. */
  function write(): boolean {
    const recorded = inputs[next]!;
    const draft = withoutSeq(recorded);
    let seq: number;
    try {
      if (feeding === "lazy") {
        const refusal: EngineInputError | null = client.checkInput(draft);
        clientVerdict.set(next + 1, refusal ? refusal.reason : null);
        if (refusal) {
          count(`client-refused:${refusal.reason}`);
          seq = client.sendUnchecked(recorded);
        } else {
          seq = sendChecked(draft);
        }
      } else {
        seq = client.sendUnchecked(recorded);
      }
    } catch (e) {
      if ((e as EngineInputError).reason === "queue-full") {
        fullRefusals++;
        return false;
      }
      throw e;
    }
    if (seq !== recorded["seq"]) fail(`input ${next + 1}: the client numbered it ${seq}, the recording says ${String(recorded["seq"])}`);
    if (draft.type === "state.request") stateRequestPending = true;
    bytesWritten += recordBytes(recorded);
    next++;
    lastWriteAt = now();
    return true;
  }

  function sendChecked(draft: EngineInputDraft): number {
    switch (draft.type) {
      case "answer": {
        const { type: _type, question, ...body } = draft;
        return client.answer(question, body as AnswerBody);
      }
      case "card.tap":
        return client.tapCard(draft.card);
      case "player.tap":
        return client.tapPlayer(draft.player);
      case "state.request":
        return client.requestState();
      case "concede":
        return client.concede();
    }
  }

  function feed(): void {
    if (feeding === "lazy") {
      if (next < inputs.length) write();
      return;
    }
    while (next < inputs.length && write()) {
      // fill the queue as far as it goes
    }
  }

  /** lazy: at engine.waiting every input up to `consumed` is processed; compare the verdicts. */
  function judgeProcessed(consumed: number): void {
    for (const [seq, reason] of clientVerdict) {
      if (seq > consumed) continue;
      const engine = engineVerdict.get(seq);
      if (reason === null) {
        if (engine !== undefined && CLIENT_KNOWABLE.has(engine)) fail(`input ${seq}: the client let it through, the engine rejected it as ${engine}`);
        if (engine !== undefined) count(`agree:client-passed-engine-${engine}`);
        else count("agree:accepted");
      } else if (engine === undefined || !ENGINE_REASONS[reason].includes(engine)) {
        fail(`input ${seq}: the client refused it as ${reason}, the engine said ${engine ?? "nothing (accepted)"}`);
      } else {
        count(`agree:${reason}`);
      }
      clientVerdict.delete(seq);
    }
  }

  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      unsubscribe();
      if (comparison && !traceDiverged && summary) {
        const d = comparison.finish();
        if (d) {
          traceDiverged = true;
          fail(describeDivergence(d));
        }
      }
      if (summary) {
        const expected = transcript.expected;
        for (const key of SAME_AS_JVM) {
          const got = (summary as unknown as Record<string, unknown>)[key];
          if (JSON.stringify(got) !== JSON.stringify(expected[key])) fail(`${key}: wasm ${JSON.stringify(got)} != jvm ${JSON.stringify(expected[key])}`);
        }
        if (summary.forgeErrors.length > 0) fail(`Forge errors: ${summary.forgeErrors.join(" | ")}`);
        if (summary.threadViolations.length > 0) fail(`work on other threads: ${summary.threadViolations.join(" | ")}`);
      } else if (failures.length === 0) {
        fail("the match did not finish");
      }
      if (next !== inputs.length) fail(`only ${next} of ${inputs.length} recorded inputs were sent`);
      const reasons = new Set([...Object.keys(counters), ...Object.keys(transcript.counters)].filter((k) => k.startsWith("rejected:")));
      for (const key of reasons) {
        if ((counters[key] ?? 0) !== (transcript.counters[key] ?? 0)) fail(`${key}: wasm ${counters[key] ?? 0} != jvm ${transcript.counters[key] ?? 0}`);
      }
      if (counters["state:opponent-hand-visible"]) fail("the opponent's hand was visible in a state");
      if (!counters["state:opponent-hand-hidden"]) fail("no state showed the opponent's hidden hand");
      if (snapshotIssues > 0) fail(`${snapshotIssues} snapshots were not self-contained`);
      if (feeding === "lazy" && clientVerdict.size > 0) fail(`${clientVerdict.size} inputs were never processed`);
      if (feeding === "eager" && fullRefusals === 0) fail("the eager replay never met a full queue; use a smaller queue");
      const sorted = steps.slice().sort((a, b) => a - b);
      const capacity = client.queueCapacity;
      const verdict = (trace: TraceVerdict | null): ReplayVerdict => ({
        ok: failures.length === 0,
        failures,
        feeding,
        inputsSent: next,
        counters,
        summary,
        engineStepMs: { count: sorted.length, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), max: percentile(sorted, 1) },
        queue: { capacity, bytesWritten, wraps: capacity > 0 ? Math.floor(bytesWritten / capacity) : 0, fullRefusals },
        validation: { messages: client.stats.messages, totalMs: Math.round(client.stats.validationMs * 10) / 10, maxMs: Math.round(client.stats.maxValidationMs * 100) / 100 },
        trace,
      });
      if (!comparison) {
        resolve(verdict(null));
        return;
      }
      const divergence = comparison.divergence;
      const traceVerdict = (sha256: string | null): TraceVerdict => ({
        reference: transcript.trace!.length,
        compared: comparison.compared,
        sha256,
        divergence: divergence ? describeDivergence(divergence) : null,
      });
      traceDigest(traceEntries).then(
        (sha256) => resolve(verdict(traceVerdict(sha256))),
        () => resolve(verdict(traceVerdict(null))),
      );
    };

    const onMessage = (message: EngineMessage) => {
      count(`emit:${message.type}`);
      switch (message.type) {
        case "engine.ready":
          client.startMatch(transcript.request);
          return;
        case "game.started":
          if (feeding === "eager") feed();
          return;
        case "engine.waiting":
          if (lastWriteAt !== null) steps.push(now() - lastWriteAt);
          if (stateRequestPending && feeding === "lazy") fail("a state.request was not answered with a state before the engine waited again");
          stateRequestPending = false;
          if (feeding === "lazy") judgeProcessed(message.consumed);
          if (message.consumed < next && feeding === "lazy") fail(`the engine waits after ${message.consumed} inputs, ${next} were written`);
          if (next >= inputs.length && message.consumed >= inputs.length) {
            // Nothing left to give and Forge still waits: the game went differently. Stop here.
            fail(`the engine waits for input ${inputs.length + 1}, but the JVM game ended after ${inputs.length}`);
            client.abort("replay: the recording ran out of inputs");
            return;
          }
          feed();
          return;
        case "state": {
          stateRequestPending = false;
          const hand = opponentHand(message);
          for (let i = 0; i < hand.hidden; i++) count("state:opponent-hand-hidden");
          for (let i = 0; i < hand.visible; i++) count("state:opponent-hand-visible");
          const problems = snapshotProblems(message);
          if (problems.length > 0) {
            snapshotIssues++;
            fail(`state ${message.seq}: ${problems.join("; ")}`);
          }
          return;
        }
        case "question":
          count(`question:${message.kind}`);
          return;
        case "input.rejected":
          count(`rejected:${message.reason}`);
          engineVerdict.set(message.seq, message.reason);
          return;
        case "engine.error":
          fail(`engine.error ${message.code}: ${message.message}`);
          finish();
          return;
        case "match.finished":
          summary = message.summary;
          // Forge returned: every input was processed (the last one, e.g. a
          // concession, is not followed by engine.waiting).
          if (feeding === "lazy") judgeProcessed(Number.MAX_SAFE_INTEGER);
          finish();
          return;
        case "diagnostics.trace": {
          traceEntries.push(message);
          const d = comparison?.add(message) ?? null;
          if (d && !traceDiverged) {
            // Any difference fails; after it the games have parted, so stop here.
            traceDiverged = true;
            fail(describeDivergence(d));
            client.abort("replay: the engine trace diverged from the JVM game");
          }
          return;
        }
        case "engine.abort":
          // Our own abort after a trace divergence is not a second finding.
          if (!(traceDiverged && message.origin === "client")) {
            fail(`technical abort (${message.origin}, ${message.reason}, ${message.stage ?? "-"}): ${message.message}${message.detail ? `\n${message.detail}` : ""}`);
          }
          finish();
          return;
        default:
          return;
      }
    };

    const unsubscribe = client.subscribe((event: EngineClientEvent) => {
      if (event.kind === "message") {
        onMessage(event.message);
      } else if (event.kind === "stalled") {
        fail(`the engine was silent for ${Math.round(event.silentMs)} ms while working`);
      }
    });
    if (client.status === "ready") {
      client.startMatch(transcript.request);
    }
  });
}
