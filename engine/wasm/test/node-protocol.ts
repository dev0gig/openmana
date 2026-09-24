#!/usr/bin/env node
// Lifecycle and failure paths of the protocol against the real Wasm engine in
// Node (the happy path is the replays): each scenario must end loudly and in
// the documented state, never in a hang.
//
//   version-mismatch   the page announces another protocol: refused by the
//                      worker before the ~70 MB engine is even loaded
//   deck-rejected      a deck with a card Forge does not know: engine.error
//                      with the complete report; the SAME worker then plays a
//                      recorded game to the end (the worker stays usable)
//   abort-mid-game     the UI aborts during a match: worker terminated,
//                      technical abort "terminated", no further inputs
//   broken-sequence    an input with a wrong seq in the queue (transport
//                      corruption): the engine refuses to go on, technical
//                      abort "engine-failure" naming the broken sequence
//
//   node engine/wasm/test/node-protocol.ts --transcript <concede transcript> [--out report.json] [--dist <dir>]
import fs from "node:fs";
import path from "node:path";
import { EngineClientError, type EngineClient, type EngineClientEvent, type EngineWorkerPortFactory } from "../../client/src/index.ts";
import { nodeWorkerPort } from "../../client/src/node-worker-port.ts";
import { inputQueueWriter, type EngineMessage, type MatchRequest } from "../../protocol/src/index.ts";
import { replay, type Transcript } from "../spike/replay.ts";
import { ENGINE_DIR, nodeClient, option } from "./node-engine.ts";

const args = process.argv.slice(2);
const distDir = path.resolve(option(args, "--dist", path.join(ENGINE_DIR, "build", "dist")));
const transcriptFile = option(args, "--transcript", null);
const outFile = option(args, "--out", null);
if (!transcriptFile) {
  console.error("--transcript <file> (a short recorded game, e.g. the conceding one) is required");
  process.exit(2);
}
const transcript = JSON.parse(fs.readFileSync(transcriptFile, "utf8")) as Transcript;

interface Scenario {
  name: string;
  ok: boolean;
  ms: number;
  details: Record<string, unknown>;
  failures: string[];
}

/** Collects the messages of a client and resolves when `until` says so (or times out). */
function watch(client: EngineClient, until: (m: EngineMessage) => boolean, timeoutMs = 120_000) {
  const messages: EngineMessage[] = [];
  const done = new Promise<EngineMessage | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    client.subscribe((event: EngineClientEvent) => {
      if (event.kind !== "message") return;
      messages.push(event.message);
      if (until(event.message)) {
        clearTimeout(timer);
        resolve(event.message);
      }
    });
  });
  return { messages, done };
}

async function scenario(name: string, body: (fail: (m: string) => void, details: Record<string, unknown>) => Promise<void>): Promise<Scenario> {
  const failures: string[] = [];
  const details: Record<string, unknown> = {};
  const start = performance.now();
  try {
    await body((m) => failures.push(m), details);
  } catch (e) {
    failures.push(`unexpected exception: ${e instanceof Error ? e.stack : String(e)}`);
  }
  const result = { name, ok: failures.length === 0, ms: Math.round(performance.now() - start), details, failures };
  console.error(`[node-protocol] ${name}: ${result.ok ? "ok" : "FAILED"} (${result.ms} ms)${result.ok ? "" : "\n  " + failures.join("\n  ")}`);
  return result;
}

const results: Scenario[] = [];

results.push(
  await scenario("version-mismatch", async (fail, details) => {
    const client = nodeClient(distDir, "lazy", { announceProtocol: 999 });
    const w = watch(client, (m) => m.type === "engine.abort", 30_000);
    const t0 = performance.now();
    client.start();
    const abort = await w.done;
    details["ms"] = Math.round(performance.now() - t0);
    details["abort"] = abort;
    if (!abort || abort.type !== "engine.abort") return fail("no engine.abort");
    if (abort.reason !== "protocol-mismatch" || abort.origin !== "engine") fail(`expected protocol-mismatch from the engine, got ${abort.reason}/${abort.origin}`);
    if (!/page speaks protocol 999/.test(abort.message)) fail(`message does not name the versions: ${abort.message}`);
    const phases = w.messages.filter((m) => m.type === "engine.boot").map((m) => (m as { phase: string }).phase);
    details["bootPhases"] = phases;
    if (phases.length > 0) fail(`the worker started booting before refusing: ${phases.join(", ")}`);
    if (client.status !== "aborted") fail(`status ${client.status}`);
    client.dispose();
  }),
);

results.push(
  await scenario("deck-rejected", async (fail, details) => {
    const client = nodeClient(distDir, "lazy");
    const w = watch(client, (m) => m.type === "engine.error" || m.type === "engine.abort");
    const bogus = "Definitely Not A Magic Card";
    const request: MatchRequest = structuredClone(transcript.request);
    request.human.deck.main.push({ card: bogus, count: 2 });
    client.subscribe((e) => {
      if (e.kind === "message" && e.message.type === "engine.ready") client.startMatch(request);
    });
    client.start();
    const error = await w.done;
    details["error"] = error;
    if (!error || error.type !== "engine.error") return fail(`expected engine.error, got ${JSON.stringify(error)}`);
    if (error.code !== "deck-rejected") fail(`code ${error.code}`);
    if (!error.report?.unknownCards?.includes(bogus)) fail(`the report does not name the unknown card: ${JSON.stringify(error.report)}`);
    if (client.status !== "ready") fail(`after a rejected deck the engine must be ready again, status ${client.status}`);
    // The same worker plays the recorded game.
    const verdict = await replay(client, transcript, "lazy", () => performance.now());
    details["replayAfterRejection"] = { ok: verdict.ok, inputs: verdict.inputsSent, logSha256: verdict.summary?.logSha256 };
    for (const f of verdict.failures) fail(`replay after the rejection: ${f}`);
    // One game per worker: a second start is refused by the client.
    try {
      client.startMatch(transcript.request);
      fail("a second match in the same worker was accepted");
    } catch (e) {
      if (!(e instanceof EngineClientError) || e.code !== "already-started") fail(`expected already-started, got ${String(e)}`);
    }
    client.dispose();
  }),
);

results.push(
  await scenario("abort-mid-game", async (fail, details) => {
    const client = nodeClient(distDir, "lazy");
    const w = watch(client, (m) => m.type === "engine.abort" || m.type === "match.finished");
    let waited = 0;
    client.subscribe((e) => {
      if (e.kind !== "message") return;
      if (e.message.type === "engine.ready") client.startMatch(transcript.request);
      if (e.message.type === "engine.waiting" && ++waited === 1) {
        // The engine waits deep inside Forge's stack (Atomics.wait): terminate from outside.
        client.abort("test: abort while Forge waits for the player");
      }
    });
    client.start();
    const end = await w.done;
    details["end"] = end;
    if (!end || end.type !== "engine.abort") return fail(`expected engine.abort, got ${JSON.stringify(end)}`);
    if (end.reason !== "terminated" || end.origin !== "client") fail(`expected terminated/client, got ${end.reason}/${end.origin}`);
    if (client.status !== "aborted") fail(`status ${client.status}`);
    if (w.messages.some((m) => m.type === "game.end")) fail("a technical abort must not look like a game result");
    try {
      client.requestState();
      fail("an input was accepted after the abort");
    } catch (e) {
      details["inputAfterAbort"] = String(e);
    }
    client.dispose();
  }),
);

results.push(
  await scenario("broken-sequence", async (fail, details) => {
    let queue: SharedArrayBuffer | null = null;
    const capturing: EngineWorkerPortFactory = (handlers) => {
      const port = nodeWorkerPort()(handlers);
      return {
        post: (command) => {
          if (command.type === "engine.start") queue = command.queue;
          port.post(command);
        },
        terminate: () => port.terminate(),
      };
    };
    const client = nodeClient(distDir, "lazy", { createPort: capturing });
    const w = watch(client, (m) => m.type === "engine.abort" || m.type === "match.finished");
    let corrupted = false;
    client.subscribe((e) => {
      if (e.kind !== "message") return;
      if (e.message.type === "engine.ready") client.startMatch(transcript.request);
      if (e.message.type === "engine.waiting" && !corrupted && queue) {
        corrupted = true;
        // Behind the client's back: input number 1 claims to be number 99.
        inputQueueWriter(queue).write(JSON.stringify({ type: "state.request", seq: 99 }));
      }
    });
    client.start();
    const end = await w.done;
    details["end"] = end;
    if (!end || end.type !== "engine.abort") return fail(`expected engine.abort, got ${JSON.stringify(end)}`);
    if (end.reason !== "engine-failure" || end.origin !== "engine") fail(`expected engine-failure/engine, got ${end.reason}/${end.origin}`);
    if (!/input sequence broken: expected seq 1/.test(end.message + (end.detail ?? ""))) fail(`the abort does not name the broken sequence: ${end.message}`);
    client.dispose();
  }),
);

const report = { ok: results.every((r) => r.ok), scenarios: results };
const text = JSON.stringify(report, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);
process.exit(report.ok ? 0 : 1);
