/*
 * The worker host: the JavaScript around Forge inside the Dedicated Worker
 * (browser) or worker thread (Node tests). Shared by engine-worker.ts and
 * node-engine-worker.ts; the protocol is engine/protocol.
 *
 *   page ──WorkerCommand (postMessage, only while the worker is idle)──▶ host
 *   page ──EngineInput (input queue, read while Forge waits)──────────▶ host ──▶ Java
 *   page ◀──EngineMessage (postMessage)──────────────────────────────── host ◀── Java
 *
 * Start order, cheapest check first, so a mismatch never costs the ~70 MB
 * download: protocol version → runtime features → input queue → launcher →
 * Wasm module → Java main (Forge) → engine.ready.
 *
 * Java calls in through globalThis.__openmanaHost (see WasmMain and
 * WasmEngineHost): emit(kind, json), registerEngine(handler), awaitInput().
 * A match runs synchronously inside one engine call; the worker does not
 * return to its event loop until the game is over, so inputs arrive only
 * through the queue.
 *
 * Every failure becomes engine.error (the command failed, the worker stays
 * usable) or engine.abort (the worker is spent). Nothing is swallowed.
 */
import {
  checkWorkerCommand,
  describeMissingFeatures,
  detectEngineFeatures,
  inputQueueReader,
  InputQueueError,
  PROTOCOL_VERSION,
  ProtocolViolation,
  type AbortReason,
  type EngineMessage,
  type InputQueueReader,
  type WorkerCommand,
} from "../../protocol/src/index.ts";

export interface WorkerHostEnvironment {
  post(message: EngineMessage): void;
  /** Loads the post-processed GraalVM launcher (importScripts / require). */
  loadScript(url: string): void;
  now(): number;
}

/** What Java's WasmMain.handle answers. */
interface EngineResponse {
  ok: boolean;
  result?: unknown;
  code?: string;
  error?: string;
  stack?: string;
  report?: { deck?: string; unknownCards?: string[] };
}

type EngineHandler = (request: string) => unknown;

interface JavaHost {
  emit(kind: string, json: string): void;
  registerEngine(handler: EngineHandler): void;
  awaitInput(): string;
}

type HostState = "idle" | "booting" | "ready" | "busy" | "spent" | "failed";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Installs the host and returns the handler for the worker's incoming messages. */
export function attachWorkerHost(env: WorkerHostEnvironment): (data: unknown) => void {
  let state: HostState = "idle";
  let engine: EngineHandler | null = null;
  let queue: InputQueueReader | null = null;
  let gameStarted = false;
  let transportFailure: string | null = null;

  const g = globalThis as unknown as { __openmanaHost?: JavaHost; __openmanaEngineConfig?: { wasmUrl: string; args: string[]; running?: Promise<unknown> } };

  function abort(reason: AbortReason, stage: string, message: string, detail?: string): void {
    if (state === "failed") {
      return;
    }
    state = "failed";
    env.post({ type: "engine.abort", reason, origin: "engine", message, stage, ...(detail ? { detail } : {}) });
  }

  function parse(json: string): unknown {
    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  }

  g.__openmanaHost = {
    // Java -> page. Game messages pass through unchanged (the client validates them).
    emit(kind, json) {
      const payload = parse(json);
      if (!isObject(payload)) {
        abort("engine-failure", "emit", `the engine sent unreadable ${kind} data`, String(json).slice(0, 500));
        return;
      }
      if (kind === "protocol") {
        if (payload["type"] === "game.started") gameStarted = true;
        env.post(payload as unknown as EngineMessage);
      } else if (kind === "boot") {
        env.post({ type: "engine.boot", phase: payload["phase"] as "java-main", t: env.now() });
      } else if (kind === "ready") {
        if (payload["protocol"] !== PROTOCOL_VERSION) {
          abort("protocol-mismatch", "ready", `the engine speaks protocol ${JSON.stringify(payload["protocol"])}, this worker host speaks protocol ${PROTOCOL_VERSION}: engine and host are from different builds`);
          return;
        }
        state = "ready";
        env.post({ ...(payload as object), type: "engine.ready", t: env.now() } as EngineMessage);
      } else if (kind === "fatal") {
        abort("boot-failed", "main", String(payload["error"] ?? "Forge could not start"), typeof payload["stack"] === "string" ? payload["stack"] : undefined);
      } else {
        abort("engine-failure", "emit", `the engine sent an unknown message kind '${kind}'`);
      }
    },
    registerEngine(handler) {
      engine = handler;
    },
    // Java waits for the player: take the next input; if there is none, say
    // so and block this thread (Forge's Java stack stays where it is).
    awaitInput() {
      if (!queue) {
        throw new Error("the engine waits for player input, but there is no input queue");
      }
      try {
        let text = queue.tryRead();
        if (text === null) {
          env.post({ type: "engine.waiting", consumed: queue.consumed });
          text = queue.read() as string;
        }
        return text;
      } catch (e) {
        transportFailure = e instanceof InputQueueError ? `${e.code}: ${e.message}` : String(e);
        throw e;
      }
    },
  };

  /** Calls into Java synchronously; a match runs completely inside this call. */
  function callEngine(request: object): EngineResponse {
    if (!engine) {
      throw new Error("the engine is not registered");
    }
    const raw = engine(JSON.stringify(request));
    const response = parse(String(raw));
    if (!isObject(response) || typeof response["ok"] !== "boolean") {
      throw new Error(`unreadable engine response: ${String(raw).slice(0, 300)}`);
    }
    return response as unknown as EngineResponse;
  }

  function failure(stage: string, response: EngineResponse): void {
    if (transportFailure) {
      abort("transport-error", stage, `the input queue failed while Forge was waiting: ${transportFailure}`, response.stack);
    } else {
      abort("engine-failure", stage, response.error ?? "the engine failed", response.stack);
    }
  }

  function start(command: Extract<WorkerCommand, { type: "engine.start" }>): void {
    const features = detectEngineFeatures({ requireIsolation: command.requireIsolation });
    env.post({ type: "engine.boot", phase: "worker-features", t: env.now(), features });
    if (!features.supported) {
      state = "failed";
      env.post({ type: "engine.abort", reason: "unsupported-browser", origin: "engine", message: describeMissingFeatures(features), stage: "features", missing: [...features.missing] });
      return;
    }
    try {
      queue = inputQueueReader(command.queue);
    } catch (e) {
      abort("transport-error", "queue", `the input queue cannot be used: ${String(e)}`);
      return;
    }
    g.__openmanaEngineConfig = { wasmUrl: command.wasmUrl, args: [...command.args] };
    env.post({ type: "engine.boot", phase: "launcher-load", t: env.now() });
    try {
      env.loadScript(command.engineScriptUrl);
    } catch (e) {
      abort("boot-failed", "launcher", `the engine launcher could not be loaded: ${String(e)}`, e instanceof Error ? e.stack : undefined);
      return;
    }
    const running = g.__openmanaEngineConfig.running;
    if (!running || typeof running.then !== "function") {
      abort("boot-failed", "launcher", "the launcher did not expose __openmanaEngineConfig.running; is it post-processed?");
      return;
    }
    env.post({ type: "engine.boot", phase: "wasm-fetch-compile", t: env.now() });
    running.then(
      () => {
        // Java's main() has returned: it registered the engine and sent ready, or reported fatal.
        if (state === "booting" && !engine) {
          abort("boot-failed", "main", "the engine's main() returned without registering a handler");
        }
      },
      (e: unknown) => abort("boot-failed", "instantiate", `the Wasm module could not be instantiated: ${String(e)}`, e instanceof Error ? e.stack : undefined),
    );
  }

  function startMatch(command: Extract<WorkerCommand, { type: "match.start" }>): void {
    if (state !== "ready") {
      const early = state === "idle" || state === "booting";
      env.post({
        type: "engine.error",
        code: early ? "not-ready" : "already-started",
        message: early ? "the engine is not ready yet" : "this worker already ran a game; use a fresh worker",
      });
      return;
    }
    state = "busy";
    gameStarted = false;
    let response: EngineResponse;
    try {
      response = callEngine({ command: "human-match", ...command.match });
    } catch (e) {
      failure("match", { ok: false, error: String(e), ...(e instanceof Error && e.stack ? { stack: e.stack } : {}) });
      return;
    }
    if (response.ok) {
      state = "spent";
      env.post({ type: "match.finished", summary: response.result as never });
    } else if (!gameStarted && (response.code === "deck-rejected" || response.code === "invalid-request")) {
      // Forge never started the game: the worker can take another match.
      state = "ready";
      env.post({ type: "engine.error", code: response.code, message: response.error ?? response.code, ...(response.report ? { report: response.report } : {}) });
    } else {
      failure("match", response);
    }
  }

  /** Engine tests only: one diagnostics call into Java; the worker is spent afterwards (Forge's state is static). */
  function diagnostics(request: object, post: (result: never) => void): void {
    if (state !== "ready") {
      const early = state === "idle" || state === "booting";
      env.post({ type: "engine.error", code: early ? "not-ready" : "already-started", message: "the engine cannot run diagnostics now" });
      return;
    }
    state = "busy";
    let response: EngineResponse;
    try {
      response = callEngine(request);
    } catch (e) {
      failure("diagnostics", { ok: false, error: String(e), ...(e instanceof Error && e.stack ? { stack: e.stack } : {}) });
      return;
    }
    if (response.ok) {
      state = "spent";
      post(response.result as never);
    } else {
      failure("diagnostics", response);
    }
  }

  return function onCommand(data: unknown): void {
    if (state === "failed") {
      return;
    }
    // The version first: a page of another build may send commands this host cannot read.
    if (isObject(data) && data["type"] === "engine.start" && data["protocol"] !== PROTOCOL_VERSION) {
      abort("protocol-mismatch", "start", `the page speaks protocol ${JSON.stringify(data["protocol"])}, this worker host speaks protocol ${PROTOCOL_VERSION}: reload the app`);
      return;
    }
    let command: WorkerCommand;
    try {
      command = checkWorkerCommand(data);
    } catch (e) {
      if (isObject(data) && data["type"] === "match.start" && state === "ready") {
        env.post({ type: "engine.error", code: "invalid-request", message: e instanceof ProtocolViolation ? e.message : String(e) });
      } else {
        abort("protocol-violation", "command", e instanceof ProtocolViolation ? e.message : String(e));
      }
      return;
    }
    switch (command.type) {
      case "engine.start":
        if (state !== "idle") {
          abort("protocol-violation", "start", "engine.start was sent twice; use a fresh worker");
          return;
        }
        state = "booting";
        start(command);
        return;
      case "match.start":
        startMatch(command);
        return;
      case "diagnostics.ai-match":
        diagnostics({ command: "smoke-match", seed: command.seed, includeLog: command.includeLog, trace: command.trace === true }, (result) =>
          env.post({ type: "diagnostics.result", result }),
        );
        return;
      case "diagnostics.card-probe":
        diagnostics({ command: "card-probe" }, (result) => env.post({ type: "diagnostics.cards", result }));
        return;
    }
  };
}
