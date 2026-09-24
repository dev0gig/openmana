// EngineClient against a scripted fake worker: lifecycle, protocol version,
// schema and sequencing checks, question bookkeeping (stale, withdrawn,
// answered, blocking), full snapshots, loud input errors, queue overflow and
// the watchdogs. The real engine runs in engine/wasm/test (Node and Chrome).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EngineClient, EngineClientError, EngineInputError, type EngineClientEvent, type EngineClientOptions, type EngineClientTimers } from "../src/index.ts";
import {
  inputQueueReader,
  type EngineMessage,
  type GameState,
  type InputQueueReader,
  type Question,
  type WorkerCommand,
} from "../../protocol/src/index.ts";
import { engineMessages, matchRequest } from "../../protocol/test/examples.ts";

const READY = engineMessages.find((m) => m.type === "engine.ready")!;
const STARTED = engineMessages.find((m) => m.type === "game.started")!;
const EXAMPLE_STATE = engineMessages.find((m) => m.type === "state") as GameState;

class FakeTimers implements EngineClientTimers {
  time = 0;
  #next = 1;
  readonly pending = new Map<number, { at: number; callback: () => void }>();
  now = () => this.time;
  setTimeout = (callback: () => void, ms: number) => {
    const id = this.#next++;
    this.pending.set(id, { at: this.time + ms, callback });
    return id;
  };
  clearTimeout = (handle: unknown) => {
    this.pending.delete(handle as number);
  };
  advance(ms: number): void {
    this.time += ms;
    for (const [id, timer] of [...this.pending].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at <= this.time && this.pending.has(id)) {
        this.pending.delete(id);
        timer.callback();
      }
    }
  }
}

/** A fake worker: records commands, lets the test speak for the engine and read the input queue. */
class FakeWorker {
  readonly commands: WorkerCommand[] = [];
  terminated = false;
  reader: InputQueueReader | null = null;
  handlers!: { message(data: unknown): void; error(p: { message: string; detail?: string }): void };
  readonly factory: EngineClientOptions["createPort"] = (handlers) => {
    this.handlers = handlers;
    return {
      post: (command) => {
        this.commands.push(command);
        if (command.type === "engine.start") this.reader = inputQueueReader(command.queue);
      },
      terminate: () => {
        this.terminated = true;
      },
    };
  };
  send(message: unknown): void {
    this.handlers.message(structuredClone(message));
  }
  /** Everything written into the input queue so far, parsed. */
  inputs(): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (let text = this.reader!.tryRead(); text !== null; text = this.reader!.tryRead()) out.push(JSON.parse(text));
    return out;
  }
}

function setup(options: Partial<EngineClientOptions> = {}) {
  const worker = new FakeWorker();
  const timers = new FakeTimers();
  const events: EngineClientEvent[] = [];
  const client = new EngineClient({
    createPort: worker.factory,
    engineScriptUrl: "engine/openmana-engine.js",
    wasmUrl: "engine/openmana-engine.js.wasm",
    requireIsolation: false,
    timers,
    queueCapacity: 256,
    ...options,
  });
  client.subscribe((e) => events.push(e));
  const messages = () => events.filter((e) => e.kind === "message").map((e) => (e as { message: EngineMessage }).message);
  const aborts = () => messages().filter((m) => m.type === "engine.abort");
  return { client, worker, timers, events, messages, aborts };
}

function playing(options: Partial<EngineClientOptions> = {}) {
  const s = setup(options);
  s.client.start();
  s.worker.send(READY);
  s.client.startMatch(matchRequest);
  s.worker.send(STARTED);
  s.worker.send(EXAMPLE_STATE);
  return s;
}

const buttons = (id: number, extra: Partial<Question> = {}): Question =>
  ({ type: "question", kind: "buttons", id, blocking: false, text: "", purpose: "priority", buttons: [{ nr: 1, label: "OK", enabled: true }, { nr: 2, label: "End Turn", enabled: true }], ...extra }) as Question;
const confirm = (id: number): Question => ({ type: "question", kind: "confirm", id, blocking: true, text: "Pay?", suggested: true });
const select = (id: number): Question => ({ type: "question", kind: "select", id, blocking: false, text: "", min: 1, max: 1, cards: [54], items: [{ nr: 1, text: "Giant" }] });

function inputError(reason: string) {
  return (e: unknown) => e instanceof EngineInputError && e.reason === reason;
}

describe("start and version", () => {
  test("start posts engine.start with the protocol version and the queue; ready makes the client ready", () => {
    const { client, worker, events } = setup();
    client.start();
    assert.equal(client.status, "booting");
    const start = worker.commands[0]!;
    assert.equal(start.type, "engine.start");
    assert.equal(start.type === "engine.start" && start.protocol, 1);
    assert.ok(start.type === "engine.start" && start.queue instanceof SharedArrayBuffer);
    worker.send({ type: "engine.boot", phase: "java-main", t: 700 });
    worker.send(READY);
    assert.equal(client.status, "ready");
    assert.equal(client.engine?.engine.forgeCommit, "ed0333fecb1fea0671b3e50cadc1da4f71db5798");
    assert.equal(client.stats.messages, 2, "every message is checked against the schema");
    assert.deepEqual(
      events.filter((e) => e.kind === "status").map((e) => (e as { status: string }).status),
      ["booting", "ready"],
    );
    assert.throws(() => client.start(), (e: unknown) => e instanceof EngineClientError && e.code === "already-started");
  });

  test("an engine with another protocol version is refused loudly before anything else is read", () => {
    const { client, worker, aborts } = setup();
    client.start();
    worker.send({ ...READY, protocol: 2, engine: "a future shape the schema would not accept" });
    assert.equal(client.status, "aborted");
    assert.equal(worker.terminated, true);
    const abort = aborts()[0]!;
    assert.equal(abort.type === "engine.abort" && abort.reason, "protocol-mismatch");
    assert.match(abort.type === "engine.abort" ? abort.message : "", /engine speaks protocol 2, this app speaks protocol 1/);
  });

  test("a runtime without the needed features never creates a worker", () => {
    let created = false;
    const { client, aborts } = setup({ requireIsolation: true, featureScope: { WebAssembly: { validate: () => true }, Atomics: { wait: () => 0 }, crossOriginIsolated: false, Worker: function () {} }, createPort: () => { created = true; throw new Error("unreachable"); } });
    client.start();
    assert.equal(created, false);
    assert.equal(client.status, "aborted");
    const abort = aborts()[0]!;
    assert.equal(abort.type === "engine.abort" && abort.reason, "unsupported-browser");
    assert.deepEqual(abort.type === "engine.abort" && abort.missing, ["Cross-Origin-Isolation (COOP/COEP-Header)", "SharedArrayBuffer"]);
    assert.equal(client.features?.supported, false);
  });

  test("the worker's own abort, a worker error and a message that breaks the schema all end in a technical abort", () => {
    const a = setup();
    a.client.start();
    a.worker.send({ type: "engine.abort", reason: "boot-failed", origin: "engine", message: "Java main failed", stage: "main", detail: "stack" });
    assert.equal(a.client.status, "aborted");
    assert.equal(a.client.abortInfo?.reason, "boot-failed");
    assert.equal(a.client.abortInfo?.origin, "engine");

    const b = setup();
    b.client.start();
    b.worker.handlers.error({ message: "Uncaught RangeError", detail: "engine-worker.js:10:5" });
    assert.equal(b.client.abortInfo?.reason, "worker-error");
    assert.equal(b.client.abortInfo?.detail, "engine-worker.js:10:5");

    const c = setup();
    c.client.start();
    c.worker.send(READY);
    c.worker.send({ type: "engine.waiting" });
    assert.equal(c.client.abortInfo?.reason, "protocol-violation");
    assert.match(c.client.abortInfo?.message ?? "", /engine message 'engine.waiting' does not conform/);
    assert.equal(c.worker.terminated, true);
    // After an abort nothing else is reported.
    const before = c.events.length;
    c.worker.send(READY);
    assert.equal(c.events.length, before);
  });

  test("no ready in time: abort with ready-timeout", () => {
    const { client, timers } = setup({ readyTimeoutMs: 1000 });
    client.start();
    timers.advance(999);
    assert.equal(client.status, "booting");
    timers.advance(1);
    assert.equal(client.abortInfo?.reason, "ready-timeout");
  });
});

describe("match start", () => {
  test("a rejected deck returns to ready and the same worker takes a new match", () => {
    const { client, worker } = setup();
    client.start();
    worker.send(READY);
    client.startMatch(matchRequest);
    assert.equal(client.status, "starting");
    worker.send({ type: "engine.error", code: "deck-rejected", message: "Forge does not know 1 card", report: { deck: "Red", unknownCards: ["Nope"] } });
    assert.equal(client.status, "ready");
    client.startMatch(matchRequest);
    worker.send(STARTED);
    assert.equal(client.status, "playing");
    assert.deepEqual(worker.commands.map((c) => c.type), ["engine.start", "match.start", "match.start"]);
  });

  test("an invalid match request is refused before it reaches the worker", () => {
    const { client, worker } = setup();
    client.start();
    worker.send(READY);
    assert.throws(
      () => client.startMatch({ ...matchRequest, format: "draft" } as never),
      (e: unknown) => e instanceof EngineClientError && e.code === "invalid-request" && /\/format/.test(e.message),
    );
    assert.equal(worker.commands.length, 1);
    assert.equal(client.status, "ready");
  });

  test("messages out of order are violations (a question before game.started)", () => {
    const { client, worker } = setup();
    client.start();
    worker.send(READY);
    client.startMatch(matchRequest);
    worker.send(buttons(1));
    assert.equal(client.abortInfo?.reason, "protocol-violation");
    assert.match(client.abortInfo?.message ?? "", /'question' is not allowed in status starting/);
  });
});

describe("questions", () => {
  test("answers go into the queue with seq and kind; answered and withdrawn questions are closed", () => {
    const { client, worker } = playing();
    worker.send(buttons(1));
    assert.equal(client.openQuestions.size, 1);
    assert.equal(client.answer(1, { kind: "buttons", button: 2 }), 1);
    const [written] = worker.inputs();
    assert.deepEqual(written, { type: "answer", seq: 1, question: 1, kind: "buttons", button: 2 });
    assert.deepEqual(Object.keys(written!), ["type", "seq", "question", "kind", "button"], "canonical key order");
    worker.send({ type: "question.answered", id: 1, seq: 1 });
    assert.equal(client.openQuestions.size, 0);
    worker.send(buttons(2));
    worker.send({ type: "question.withdrawn", id: 2 });
    assert.equal(client.openQuestions.size, 0);
  });

  test("stale and unknown questions are refused by the client without sending anything", () => {
    const { client, worker } = playing();
    worker.send(buttons(3));
    worker.send({ type: "question.withdrawn", id: 3 });
    assert.throws(() => client.answer(3, { kind: "buttons", button: 1 }), inputError("stale"));
    assert.throws(() => client.answer(9_999_999, { kind: "buttons", button: 1 }), inputError("unknown-question"));
    assert.equal(client.inputsSent, 0);
    assert.deepEqual(worker.inputs(), []);
    // The engine's own verdict for the same inputs, when sent unchecked, is a rejection with that seq.
    assert.equal(client.sendUnchecked({ type: "answer", question: 3, kind: "buttons", button: 1 }), 1);
    worker.send({ type: "input.rejected", seq: 1, reason: "stale", detail: "question 3 is not open", input: { type: "answer", question: 3, kind: "buttons", button: 1, seq: 1 } });
    assert.equal(client.status, "playing");
  });

  test("while a blocking question is open only it can be answered; state.request and concede still go", () => {
    const { client, worker } = playing();
    worker.send(buttons(1));
    worker.send(confirm(2));
    assert.equal(client.blockingQuestion?.id, 2);
    assert.throws(() => client.answer(1, { kind: "buttons", button: 1 }), inputError("not-active"));
    assert.throws(() => client.tapCard(54), inputError("not-active"));
    assert.throws(() => client.tapPlayer(1), inputError("not-active"));
    assert.throws(() => client.answer(2, { kind: "buttons", button: 1 }), inputError("wrong-kind"));
    client.requestState();
    client.answer(2, { kind: "confirm", yes: true });
    worker.send({ type: "question.answered", id: 2, seq: 2 });
    assert.equal(client.blockingQuestion, null);
    client.tapCard(54);
    client.concede();
    assert.deepEqual(worker.inputs().map((i) => [i["type"], i["seq"]]), [["state.request", 1], ["answer", 2], ["card.tap", 3], ["concede", 4]]);
  });

  test("taps are checked against the latest full snapshot", () => {
    const { client, worker } = playing();
    assert.throws(() => client.tapCard(-5), inputError("unknown-card"));
    assert.throws(() => client.tapPlayer(7), inputError("unknown-player"));
    client.tapCard(54);
    const next = structuredClone(EXAMPLE_STATE);
    next.seq = EXAMPLE_STATE.seq + 1;
    next.players[0]!.zones.hand = [];
    worker.send(next);
    assert.equal(client.state?.seq, next.seq, "the snapshot is replaced, not merged");
    assert.throws(() => client.tapCard(54), inputError("unknown-card"));
  });

  test("schema-invalid inputs are refused as malformed", () => {
    const { client, worker } = playing();
    worker.send(buttons(1));
    assert.throws(() => client.answer(1, { kind: "buttons", button: 3 } as never), inputError("malformed"));
    assert.throws(() => client.tapCard(1.5), inputError("malformed"));
  });

  test("sequencing violations of the engine abort: reused ids, double questions, unknown closings, old snapshots", () => {
    const cases: [string, (s: ReturnType<typeof playing>) => void, RegExp][] = [
      ["reused id", (s) => { s.worker.send(buttons(5)); s.worker.send({ type: "question.withdrawn", id: 5 }); s.worker.send(buttons(5)); }, /ids must increase/],
      ["two buttons questions", (s) => { s.worker.send(buttons(1)); s.worker.send(buttons(2)); }, /buttons question 2 while buttons question 1 is still open/],
      ["two blocking questions", (s) => { s.worker.send(confirm(1)); s.worker.send(confirm(2)); }, /blocking question 2 while blocking question 1/],
      ["withdrawal of a closed question", (s) => { s.worker.send({ type: "question.withdrawn", id: 9 }); }, /not open/],
      ["answered by an input never sent", (s) => { s.worker.send(select(1)); s.worker.send({ type: "question.answered", id: 1, seq: 4 }); }, /only 0 were sent/],
      ["old snapshot", (s) => { s.worker.send({ ...EXAMPLE_STATE, seq: 1 }); }, /snapshots must arrive in order/],
      ["game.end with an open question", (s) => { s.worker.send(buttons(1)); s.worker.send({ type: "game.end", winner: null, reason: null, turns: 3, result: "draw", players: [], conceded: false }); }, /still open/],
      ["waiting beyond what was sent", (s) => { s.worker.send({ type: "engine.waiting", consumed: 3 }); }, /reports 3 consumed/],
    ];
    for (const [name, script, pattern] of cases) {
      const s = playing();
      script(s);
      assert.equal(s.client.abortInfo?.reason, "protocol-violation", name);
      assert.match(s.client.abortInfo?.message ?? "", pattern, name);
    }
  });

  test("the whole match: game.end, match.finished, then no more inputs", () => {
    const { client, worker } = playing();
    worker.send(buttons(1));
    worker.send({ type: "question.withdrawn", id: 1 });
    worker.send({ type: "game.end", winner: "Forge AI", reason: "Concede", turns: 4, result: "loss", players: [], conceded: true });
    assert.equal(client.status, "ended");
    assert.throws(() => client.concede(), inputError("no-match"));
    worker.send(engineMessages.find((m) => m.type === "match.finished"));
    assert.equal(client.status, "finished");
    assert.equal(client.summary?.inputs, 44);
    assert.throws(() => client.startMatch(matchRequest), (e: unknown) => e instanceof EngineClientError && e.code === "already-started");
  });
});

describe("queue and watchdog", () => {
  test("a full queue is refused loudly (queue-full) and nothing is lost; after the engine read, sending works again", () => {
    const { client, worker } = playing({ queueCapacity: 64 });
    client.requestState(); // 34 bytes with prefix
    assert.throws(() => client.requestState(), inputError("queue-full"));
    assert.equal(client.inputsSent, 1);
    assert.equal(worker.inputs().length, 1);
    client.requestState();
    assert.deepEqual(worker.inputs().map((i) => i["seq"]), [2]);
  });

  test("a working engine that stays silent is reported as stalled, and as responsive when it speaks again", () => {
    const { client, worker, timers, events } = playing({ stallTimeoutMs: 5000 });
    worker.send({ type: "engine.waiting", consumed: 0 });
    timers.advance(60_000);
    assert.equal(events.filter((e) => e.kind === "stalled").length, 0, "waiting for the player is not a stall");
    client.requestState();
    timers.advance(4999);
    assert.equal(events.filter((e) => e.kind === "stalled").length, 0);
    timers.advance(1);
    assert.deepEqual(events.filter((e) => e.kind === "stalled"), [{ kind: "stalled", silentMs: 5000 }]);
    assert.equal(client.status, "playing", "a stall is not an abort");
    timers.advance(2000);
    worker.send({ type: "engine.waiting", consumed: 1 });
    assert.deepEqual(events.filter((e) => e.kind === "responsive"), [{ kind: "responsive", silentMs: 7000 }]);
  });

  test("abort() by the UI terminates the worker and reports terminated", () => {
    const { client, worker } = playing();
    client.abort();
    assert.equal(worker.terminated, true);
    assert.equal(client.abortInfo?.reason, "terminated");
    assert.equal(client.abortInfo?.origin, "client");
    assert.throws(() => client.requestState(), inputError("no-match"));
  });
});
