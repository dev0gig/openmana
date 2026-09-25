#!/usr/bin/env node
// A JVM-recorded human-vs-AI game, replayed in the Wasm engine in Node through
// the real EngineClient and SharedArrayBuffer input queue; Forge blocks in
// Atomics.wait while it waits for the next input. Same worker host code as in
// the browser. What is compared: engine/wasm/spike/replay.ts (above all the
// engine trace, entry by entry).
//
//   node engine/wasm/test/node-replay.ts --transcript t.json [--feeding lazy|eager]
//        [--queue-capacity <bytes>] [--card-loading lazy|eager] [--language en-US|de-DE]
//        [--card-language en-US|de-DE] [--out result.json] [--dist <dir>]
//
// Card loading and the languages default to the transcript's engine settings.
// Exit code 0 only if the game ends exactly as on the JVM.
import fs from "node:fs";
import path from "node:path";
import { replay, type Feeding, type Transcript } from "../spike/replay.ts";
import { ENGINE_DIR, nodeClient, option, vmHwmMiB } from "./node-engine.ts";

const args = process.argv.slice(2);
const distDir = path.resolve(option(args, "--dist", path.join(ENGINE_DIR, "build", "dist")));
const transcriptFile = option(args, "--transcript", null);
const feeding = option(args, "--feeding", "lazy") as Feeding;
const queueCapacity = Number(option(args, "--queue-capacity", feeding === "eager" ? "256" : "65536"));
const outFile = option(args, "--out", null);
const TIMEOUT_MS = 600_000;
if (!transcriptFile || (feeding !== "lazy" && feeding !== "eager")) {
  console.error("--transcript <file> is required, --feeding is lazy or eager");
  process.exit(2);
}

const transcript = JSON.parse(fs.readFileSync(transcriptFile, "utf8")) as Transcript;
const cardLoading = option(args, "--card-loading", transcript.engine?.cardLoading ?? "eager");
const language = option(args, "--language", transcript.engine?.language ?? "en-US");
const cardLanguage = option(args, "--card-language", transcript.engine?.cardLanguage ?? language);
const baselineMiB = vmHwmMiB();
const origin = performance.now();
const since = () => Math.round(performance.now() - origin);
const phases: Record<string, number> = {};
const client = nodeClient(distDir, cardLoading, { queueCapacity }, language, cardLanguage);
client.subscribe((event) => {
  if (event.kind === "message" && (event.message.type === "engine.boot" || event.message.type === "engine.ready")) {
    phases[event.message.type === "engine.boot" ? event.message.phase : "ready"] = since();
  }
  if (event.kind === "message" && event.message.type === "game.started") phases["gameStarted"] = since();
});
const timer = setTimeout(() => client.abort(`replay timeout after ${TIMEOUT_MS / 1000} s`), TIMEOUT_MS);
const run = replay(client, transcript, feeding, () => performance.now());
client.start();
const verdict = await run;
clearTimeout(timer);
phases["finished"] = since();

const report = {
  runtime: `node ${process.versions.node} (V8 ${process.versions.v8})`,
  transcript: path.basename(transcriptFile),
  fixture: transcript.name ?? null,
  seed: transcript.request.seed,
  recordedInputs: transcript.inputs.length,
  cardLoading,
  language,
  cardLanguage,
  feeding,
  ok: verdict.ok,
  failures: verdict.failures,
  phases,
  engine: client.engine?.engine ?? null,
  boot: client.engine?.boot ?? null,
  inputsSent: verdict.inputsSent,
  engineStepMs: verdict.engineStepMs,
  queue: verdict.queue,
  validation: verdict.validation,
  trace: verdict.trace,
  counters: verdict.counters,
  result: verdict.summary,
  abort: client.abortInfo,
  peakRssMiB: vmHwmMiB(),
  baselineRssMiB: baselineMiB,
};
client.dispose();
const text = JSON.stringify(report, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);
process.exit(verdict.ok ? 0 : 1);
