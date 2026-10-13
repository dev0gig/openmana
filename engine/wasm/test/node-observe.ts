#!/usr/bin/env node
// Protocol 10 (prompt 48): what a player can do while the real Wasm engine in
// Node holds an observation - each must work at once and never hang:
//
//   long-look        the player looks at a held observation far longer than
//                    the client's stall timeout: no "engine does not respond"
//                    (the engine waits: engine.waiting), then the release goes
//                    through and the game goes on
//   concede-held     a concession while an observation is held: the hold ends
//                    (observation.released by concede), the game ends conceded
//   settings-off     switching the observation mode off releases the hold
//                    (observation.released by settings) and no hold follows
//   abort-held       the UI aborts while an observation is held: the worker is
//                    terminated at once (technical abort "terminated")
//
// The game is a JVM-recorded transcript of a match with observation holds
// (fixture priority-respond-observe); its inputs are fed one per wait until
// the scenario's moment.
//
//   node engine/wasm/test/node-observe.ts --transcript <observe transcript> [--out report.json] [--dist <dir>]
import fs from "node:fs";
import path from "node:path";
import type { EngineClient, EngineClientEvent } from "../../client/src/index.ts";
import type { EngineMessage } from "../../protocol/src/index.ts";
import type { Transcript } from "../spike/replay.ts";
import { ENGINE_BUILD_DIR, nodeClient, option } from "./node-engine.ts";

const args = process.argv.slice(2);
const distDir = path.resolve(option(args, "--dist", path.join(ENGINE_BUILD_DIR, "dist")));
const transcriptFile = option(args, "--transcript", null);
const outFile = option(args, "--out", null);
if (!transcriptFile) {
  console.error("--transcript <file> (a recorded game with observation holds) is required");
  process.exit(2);
}
const transcript = JSON.parse(fs.readFileSync(transcriptFile, "utf8")) as Transcript;
if (transcript.request.settings?.observation !== "hold") {
  console.error("the transcript's match must ask for observation holds (settings.observation hold)");
  process.exit(2);
}
const STALL_MS = 3000;
const LOOK_MS = 10_000;

interface Scenario {
  name: string;
  ok: boolean;
  ms: number;
  details: Record<string, unknown>;
  failures: string[];
}

/**
 * Plays the transcript's inputs one per engine.waiting until `atHold` takes
 * over at the n-th held observation; resolves with every message and event
 * once `until` says so (or after a timeout).
 */
function play(client: EngineClient, holdNr: number, atHold: (client: EngineClient) => void, until: (m: EngineMessage) => boolean, timeoutMs = 240_000) {
  const messages: EngineMessage[] = [];
  const events: EngineClientEvent[] = [];
  let next = 0;
  let holds = 0;
  let tookOver = false;
  const done = new Promise<EngineMessage | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    client.subscribe((event) => {
      events.push(event);
      if (event.kind !== "message") return;
      const m = event.message;
      messages.push(m);
      if (m.type === "engine.ready") client.startMatch(transcript.request);
      if (m.type === "observation" && m.hold) holds++;
      if (until(m)) {
        clearTimeout(timer);
        resolve(m);
        return;
      }
      if (m.type === "engine.waiting" && !tookOver) {
        if (client.heldObservation !== null && holds === holdNr) {
          tookOver = true;
          atHold(client);
        } else if (next < transcript.inputs.length) {
          client.sendUnchecked(transcript.inputs[next++]!);
        }
      }
    });
  });
  return { messages, events, done, inputsFed: () => next };
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
  console.error(`[node-observe] ${name}: ${result.ok ? "ok" : "FAILED"} (${result.ms} ms)${result.ok ? "" : "\n  " + failures.join("\n  ")}`);
  return result;
}

const loading = transcript.engine?.cardLoading ?? "eager";
const language = transcript.engine?.language ?? "en-US";
const results: Scenario[] = [];

results.push(
  await scenario("long-look", async (fail, details) => {
    const client = nodeClient(distDir, loading, { stallTimeoutMs: STALL_MS }, language);
    let releasedAt = 0;
    let heldId = 0;
    const p = play(client, 1, (c) => {
      heldId = c.heldObservation!.id;
      setTimeout(() => {
        releasedAt = performance.now();
        c.releaseObservation(heldId);
      }, LOOK_MS);
    }, (m) => m.type === "observation.released" || m.type === "engine.abort");
    client.start();
    const released = await p.done;
    details["looked"] = LOOK_MS;
    details["released"] = released;
    if (!released || released.type !== "observation.released") return fail(`expected observation.released, got ${JSON.stringify(released)}`);
    if (released.id !== heldId || released.by !== "release") fail(`released ${released.id} by ${released.by}, held ${heldId}`);
    const stalls = p.events.filter((e) => e.kind === "stalled");
    details["stalls"] = stalls.length;
    if (stalls.length > 0) fail(`looking at a held observation for ${LOOK_MS} ms was reported as a stall (timeout ${STALL_MS} ms)`);
    if (releasedAt === 0) fail("the release was never sent");
    // The game goes on: Forge sends its next state or observation after the release.
    const after = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 30_000);
      client.subscribe((e) => {
        if (e.kind === "message" && (e.message.type === "state" || e.message.type === "observation" || e.message.type === "question")) {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
    if (!after) fail("the engine did not go on after the release");
    client.dispose();
  }),
);

results.push(
  await scenario("concede-held", async (fail, details) => {
    const client = nodeClient(distDir, loading, {}, language);
    let seq = 0;
    const p = play(client, 1, (c) => {
      seq = c.concede();
    }, (m) => m.type === "match.finished" || m.type === "engine.abort");
    client.start();
    const end = await p.done;
    details["end"] = end?.type;
    if (!end || end.type !== "match.finished") return fail(`expected match.finished, got ${JSON.stringify(end)}`);
    const released = p.messages.find((m) => m.type === "observation.released");
    if (!released || released.type !== "observation.released" || released.by !== "concede" || released.seq !== seq) fail(`the hold did not end by the concession: ${JSON.stringify(released)}`);
    const gameEnd = p.messages.find((m) => m.type === "game.end");
    if (!gameEnd || gameEnd.type !== "game.end" || gameEnd.conceded !== true) fail(`game.end conceded expected: ${JSON.stringify(gameEnd)}`);
    if (p.messages.indexOf(released!) > p.messages.indexOf(gameEnd!)) fail("the release must come before the end of the game");
    client.dispose();
  }),
);

results.push(
  await scenario("settings-off", async (fail, details) => {
    const client = nodeClient(distDir, loading, {}, language);
    let seq = 0;
    const p = play(client, 1, (c) => {
      seq = c.changeSettings({ observation: "off" });
    }, (m) => m.type === "observation.released" || m.type === "engine.abort");
    client.start();
    const released = await p.done;
    details["released"] = released;
    if (!released || released.type !== "observation.released") return fail(`expected observation.released, got ${JSON.stringify(released)}`);
    if (released.by !== "settings" || released.seq !== seq) fail(`released by ${released.by} with seq ${released.seq}, the settings change was ${seq}`);
    const applied = p.messages.filter((m) => m.type === "settings.applied").at(-1);
    if (!applied || applied.type !== "settings.applied" || applied.seq !== seq || applied.observation !== "off") fail(`settings.applied ${JSON.stringify(applied)}`);
    if (client.settings?.observation !== "off") fail("the client does not know the new mode");
    client.abort("test: done");
    client.dispose();
  }),
);

results.push(
  await scenario("abort-held", async (fail, details) => {
    const client = nodeClient(distDir, loading, {}, language);
    let abortedAt = 0;
    const p = play(client, 1, (c) => {
      abortedAt = performance.now();
      c.abort("test: abort while an observation is held");
    }, (m) => m.type === "engine.abort" || m.type === "match.finished");
    client.start();
    const end = await p.done;
    details["ms"] = Math.round(performance.now() - abortedAt);
    if (!end || end.type !== "engine.abort") return fail(`expected engine.abort, got ${JSON.stringify(end)}`);
    if (end.reason !== "terminated" || end.origin !== "client") fail(`expected terminated/client, got ${end.reason}/${end.origin}`);
    if (client.status !== "aborted") fail(`status ${client.status}`);
    if (client.heldObservation !== null) fail("the client still believes an observation is held");
    client.dispose();
  }),
);

const report = { ok: results.every((r) => r.ok), scenarios: results };
const text = JSON.stringify(report, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);
process.exit(report.ok ? 0 : 1);
