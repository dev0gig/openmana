// The worker host with a simulated Java side (no Wasm): start order and every
// failure path end in exactly one loud engine.error or engine.abort, commands
// are validated, inputs come from the queue, one game per worker.
// The real engine runs in node-replay.ts, node-protocol.ts and in Chrome.
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { createInputQueue, PROTOCOL_VERSION, type EngineMessage, type InputQueueWriter, type WorkerCommand } from "../../protocol/src/index.ts";
import { engineMessages, matchRequest } from "../../protocol/test/examples.ts";
import { attachWorkerHost } from "../host/worker-host.ts";

interface JavaHost {
  emit(kind: string, json: string): void;
  registerEngine(handler: (request: string) => unknown): void;
  awaitInput(): string;
}
const g = globalThis as unknown as { __openmanaHost?: JavaHost; __openmanaEngineConfig?: { wasmUrl: string; args: string[]; running?: Promise<unknown> } };
const READY = engineMessages.find((m) => m.type === "engine.ready")!;
const { type: _t, t: _time, ...readyPayload } = READY as Extract<EngineMessage, { type: "engine.ready" }>;

type FakeEngine = (request: Record<string, unknown>, java: JavaHost) => Record<string, unknown>;

function setup(options: { launcher?: "ok" | "throws" | "no-running" | "fatal" | "wrong-protocol"; engine?: FakeEngine } = {}) {
  const posted: EngineMessage[] = [];
  const loaded: string[] = [];
  const onCommand = attachWorkerHost({
    post: (m) => posted.push(structuredClone(m)),
    now: () => 42,
    loadScript: (url) => {
      loaded.push(url);
      const launcher = options.launcher ?? "ok";
      if (launcher === "throws") throw new Error("importScripts failed: 404");
      if (launcher === "no-running") return;
      // Like the real launcher: loading only starts fetching and compiling the
      // module; Java's main runs later, when the promise settles.
      g.__openmanaEngineConfig!.running = Promise.resolve().then(() => {
        const java = g.__openmanaHost!;
        java.emit("boot", JSON.stringify({ phase: "java-main" }));
        if (launcher === "fatal") {
          java.emit("fatal", JSON.stringify({ ok: false, code: "engine-failure", error: "java.lang.IllegalStateException: no bundle", stack: "at WasmMain.main" }));
          return;
        }
        java.registerEngine((request) => JSON.stringify((options.engine ?? (() => ({ ok: true, result: {} })))(JSON.parse(request), java)));
        java.emit("ready", JSON.stringify(launcher === "wrong-protocol" ? { ...readyPayload, protocol: 0 } : readyPayload));
      });
    },
  });
  const queue = createInputQueue(256);
  const start = (overrides: Record<string, unknown> = {}) =>
    onCommand({ type: "engine.start", protocol: PROTOCOL_VERSION, engineScriptUrl: "engine/openmana-engine.js", wasmUrl: "engine/x.wasm", args: [], queue: queue.buffer, requireIsolation: false, ...overrides });
  const types = () => posted.map((m) => m.type);
  const last = <T extends EngineMessage["type"]>(type: T) => posted.filter((m) => m.type === type).pop() as Extract<EngineMessage, { type: T }> | undefined;
  return { posted, loaded, onCommand, queue, start, types, last };
}

const summary = engineMessages.find((m) => m.type === "match.finished")!;
const playTwoInputs: FakeEngine = (request, java) => {
  assert.equal(request["command"], "human-match");
  java.emit("protocol", JSON.stringify({ type: "game.started", protocol: PROTOCOL_VERSION, human: "Player", ai: "Forge AI", aiProfile: "Default", format: "constructed", cardNames: [] }));
  const inputs = [java.awaitInput(), java.awaitInput()].map((t) => JSON.parse(t));
  assert.deepEqual(inputs.map((i) => i.seq), [1, 2]);
  return { ok: true, result: (summary as { summary: object }).summary };
};

/** Lets the launcher's promise (Java main) run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function feed(queue: InputQueueWriter, count: number) {
  for (let seq = 1; seq <= count; seq++) queue.write(JSON.stringify({ type: "state.request", seq }));
}

beforeEach(() => {
  delete g.__openmanaHost;
  delete g.__openmanaEngineConfig;
});

describe("start", () => {
  test("in order: features, launcher, module, Java; then engine.ready with the worker's clock", async () => {
    const s = setup();
    s.start();
    await settle();
    assert.deepEqual(s.posted.map((m) => (m.type === "engine.boot" ? m.phase : m.type)), ["worker-features", "launcher-load", "wasm-fetch-compile", "java-main", "engine.ready"]);
    assert.equal(s.last("engine.ready")?.t, 42);
    assert.equal(s.last("engine.ready")?.protocol, PROTOCOL_VERSION);
    assert.deepEqual(g.__openmanaEngineConfig?.wasmUrl, "engine/x.wasm");
  });

  test("another protocol version from the page is refused before anything is loaded", () => {
    const s = setup();
    s.start({ protocol: 7 });
    assert.deepEqual(s.types(), ["engine.abort"]);
    assert.equal(s.last("engine.abort")?.reason, "protocol-mismatch");
    assert.deepEqual(s.loaded, []);
    s.start();
    assert.equal(s.posted.length, 1, "a failed worker stays silent");
  });

  test("an engine of another protocol version is refused at ready", async () => {
    const s = setup({ launcher: "wrong-protocol" });
    s.start();
    await settle();
    assert.equal(s.last("engine.abort")?.reason, "protocol-mismatch");
    assert.equal(s.last("engine.abort")?.stage, "ready");
    assert.equal(s.last("engine.ready"), undefined);
  });

  test("missing features, an unusable queue, a failing launcher and a failing Java start are aborts", async () => {
    const noIsolation = setup();
    noIsolation.start({ requireIsolation: true }); // Node has no crossOriginIsolated
    assert.equal(noIsolation.last("engine.abort")?.reason, "unsupported-browser");
    assert.deepEqual(noIsolation.last("engine.abort")?.missing, ["Cross-Origin-Isolation (COOP/COEP-Header)"]);
    assert.deepEqual(noIsolation.loaded, []);

    const badQueue = setup();
    badQueue.start({ queue: new SharedArrayBuffer(128) });
    assert.equal(badQueue.last("engine.abort")?.reason, "transport-error");
    assert.deepEqual(badQueue.loaded, []);

    const launcher = setup({ launcher: "throws" });
    launcher.start();
    assert.equal(launcher.last("engine.abort")?.reason, "boot-failed");
    assert.equal(launcher.last("engine.abort")?.stage, "launcher");

    const notProcessed = setup({ launcher: "no-running" });
    notProcessed.start();
    assert.match(notProcessed.last("engine.abort")?.message ?? "", /post-processed/);

    const fatal = setup({ launcher: "fatal" });
    fatal.start();
    await settle();
    assert.equal(fatal.last("engine.abort")?.reason, "boot-failed");
    assert.equal(fatal.last("engine.abort")?.detail, "at WasmMain.main");
  });

  test("a command that breaks the schema is a protocol violation; engine.start twice too", () => {
    const s = setup();
    s.onCommand({ type: "engine.start", protocol: PROTOCOL_VERSION });
    assert.equal(s.last("engine.abort")?.reason, "protocol-violation");
    const twice = setup();
    twice.start();
    twice.start();
    assert.equal(twice.last("engine.abort")?.reason, "protocol-violation");
  });
});

describe("match", () => {
  test("match.start before ready is refused as not-ready, and the engine still becomes ready", async () => {
    const idle = setup();
    idle.onCommand({ type: "match.start", match: matchRequest } satisfies WorkerCommand);
    assert.equal(idle.last("engine.error")?.code, "not-ready");

    let finishBoot: () => void = () => {};
    const posted: EngineMessage[] = [];
    const onCommand = attachWorkerHost({
      post: (m) => posted.push(m),
      now: () => 0,
      loadScript: () => {
        g.__openmanaEngineConfig!.running = new Promise<void>((resolve) => {
          finishBoot = () => {
            g.__openmanaHost!.registerEngine(() => JSON.stringify({ ok: true, result: {} }));
            g.__openmanaHost!.emit("ready", JSON.stringify(readyPayload));
            resolve();
          };
        });
      },
    });
    onCommand({ type: "engine.start", protocol: PROTOCOL_VERSION, engineScriptUrl: "e.js", wasmUrl: "e.wasm", args: [], queue: createInputQueue(256).buffer, requireIsolation: false });
    onCommand({ type: "match.start", match: matchRequest });
    assert.equal(posted.filter((m) => m.type === "engine.error").pop()?.type === "engine.error" && (posted.filter((m) => m.type === "engine.error").pop() as { code: string }).code, "not-ready");
    finishBoot();
    await settle();
    assert.equal(posted.at(-1)?.type, "engine.ready");
  });

  test("a whole match: inputs come from the queue, messages pass through, match.finished at the end; one game per worker", async () => {
    const s = setup({ engine: playTwoInputs });
    s.start();
    await settle();
    feed(s.queue, 2);
    s.onCommand({ type: "match.start", match: matchRequest });
    assert.deepEqual(s.types().slice(-2), ["game.started", "match.finished"]);
    assert.equal(s.types().includes("engine.waiting"), false, "inputs were queued: the engine never had to wait");
    assert.equal(s.queue.read, 2);
    s.onCommand({ type: "match.start", match: matchRequest });
    assert.equal(s.last("engine.error")?.code, "already-started");
  });

  test("a rejected deck is an engine.error with the report, and the worker takes the next match", async () => {
    let calls = 0;
    const s = setup({
      engine: (request, java) => {
        if (++calls === 1) return { ok: false, code: "deck-rejected", error: "Forge does not know 1 card(s) of deck 'Red'", report: { deck: "Red", unknownCards: ["Nope"] } };
        return playTwoInputs(request, java);
      },
    });
    s.start();
    await settle();
    s.onCommand({ type: "match.start", match: matchRequest });
    assert.deepEqual(s.last("engine.error"), { type: "engine.error", code: "deck-rejected", message: "Forge does not know 1 card(s) of deck 'Red'", report: { deck: "Red", unknownCards: ["Nope"] } });
    feed(s.queue, 2);
    s.onCommand({ type: "match.start", match: matchRequest });
    assert.equal(s.last("match.finished")?.type, "match.finished");
  });

  test("an invalid match request is refused as invalid-request, without calling Forge", async () => {
    let called = false;
    const s = setup({ engine: () => ((called = true), { ok: true, result: {} }) });
    s.start();
    await settle();
    s.onCommand({ type: "match.start", match: { ...matchRequest, format: "draft" } });
    assert.equal(s.last("engine.error")?.code, "invalid-request");
    assert.equal(called, false);
  });

  test("a failure after the game started is a technical abort, never an engine.error", async () => {
    const s = setup({
      engine: (_request, java) => {
        java.emit("protocol", JSON.stringify({ type: "game.started", protocol: PROTOCOL_VERSION, human: "P", ai: "A", aiProfile: "Default", format: "constructed", cardNames: [] }));
        return { ok: false, code: "deck-rejected", error: "late", stack: "trace" };
      },
    });
    s.start();
    await settle();
    s.onCommand({ type: "match.start", match: matchRequest });
    assert.equal(s.last("engine.abort")?.reason, "engine-failure");
    assert.equal(s.last("engine.abort")?.detail, "trace");
  });

  test("a broken queue while Forge waits is reported as transport-error", async () => {
    const s = setup({
      engine: (_request, java) => {
        try {
          java.awaitInput();
        } catch (e) {
          return { ok: false, code: "engine-failure", error: `java.lang.RuntimeException: ${String(e)}`, stack: "in awaitInput" };
        }
        return { ok: true, result: {} };
      },
    });
    s.start();
    await settle();
    new Int32Array(s.queue.buffer, 0, 8)[3] = 1000; // write position beyond the capacity
    s.onCommand({ type: "match.start", match: matchRequest });
    assert.equal(s.last("engine.abort")?.reason, "transport-error");
    assert.match(s.last("engine.abort")?.message ?? "", /corrupt/);
  });

  test("unreadable data from Java is an abort, not a silent drop", async () => {
    const s = setup({
      engine: (_request, java) => {
        java.emit("protocol", "{not json");
        return { ok: true, result: {} };
      },
    });
    s.start();
    await settle();
    s.onCommand({ type: "match.start", match: matchRequest });
    assert.equal(s.posted.filter((m) => m.type === "engine.abort").length, 1);
    assert.equal(s.last("engine.abort")?.reason, "engine-failure");
  });

  test("diagnostics.ai-match runs Forge's AI game and reports diagnostics.result", async () => {
    const result = (engineMessages.find((m) => m.type === "diagnostics.result") as { result: object }).result;
    const s = setup({ engine: (request) => (assert.equal(request["command"], "smoke-match"), { ok: true, result }) });
    s.start();
    await settle();
    s.onCommand({ type: "diagnostics.ai-match", seed: 42, includeLog: false });
    assert.deepEqual(s.last("diagnostics.result")?.result, result);
  });

  test("diagnostics.card-probe runs Forge's card probe once and reports diagnostics.cards", async () => {
    const result = (engineMessages.find((m) => m.type === "diagnostics.cards") as { result: object }).result;
    const s = setup({ engine: (request) => (assert.equal(request["command"], "card-probe"), { ok: true, result }) });
    s.onCommand({ type: "diagnostics.card-probe" });
    assert.equal(s.last("engine.error")?.code, "not-ready");
    s.start();
    await settle();
    s.onCommand({ type: "diagnostics.card-probe" });
    assert.deepEqual(s.last("diagnostics.cards")?.result, result);
    // Forge's state is static: a second probe needs a fresh worker.
    s.onCommand({ type: "diagnostics.card-probe" });
    assert.equal(s.last("engine.error")?.code, "already-started");
  });

  test("a failing card probe is a technical abort, not a result", async () => {
    const s = setup({ engine: () => ({ ok: false, code: "engine-failure", error: "java.lang.NullPointerException", stack: "at CardProbe.run" }) });
    s.start();
    await settle();
    s.onCommand({ type: "diagnostics.card-probe" });
    assert.equal(s.last("engine.abort")?.reason, "engine-failure");
    assert.equal(s.last("engine.abort")?.stage, "diagnostics");
    assert.equal(s.last("diagnostics.cards"), undefined);
  });
});
