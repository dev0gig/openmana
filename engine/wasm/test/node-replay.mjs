#!/usr/bin/env node
// Prompt 02 in Node: a human-vs-AI game in the Wasm engine, played through
// Forge's human path (PlayerControllerHuman) on the worker's single thread.
// The inputs come from a JVM transcript (JvmHumanMatchMain) and travel through
// the SharedArrayBuffer channel exactly like a page would send them; Forge
// blocks in Atomics.wait while it waits for them. Same worker host code as in
// the browser (engine/wasm/host/).
//
//   node engine/wasm/test/node-replay.mjs --transcript t.json
//        [--card-loading lazy|eager] [--out result.json] [--dist <dir>]
//
// Exit code 0 only if the game ends exactly as on the JVM (see
// engine/wasm/spike/replay-driver.js for what is compared).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const wasmDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
require(path.join(wasmDir, "host", "input-channel.js"));
require(path.join(wasmDir, "spike", "replay-driver.js"));

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const distDir = path.resolve(option("--dist", path.resolve(wasmDir, "..", "build", "dist")));
const transcriptFile = option("--transcript", null);
const cardLoading = option("--card-loading", "lazy");
const outFile = option("--out", null);
const READY_TIMEOUT_MS = 180000;
const GAME_TIMEOUT_MS = 600000;
if (!transcriptFile) {
  console.error("--transcript <file> is required");
  process.exit(2);
}

function vmHwmMiB() {
  const match = /VmHWM:\s+(\d+) kB/.exec(fs.readFileSync("/proc/self/status", "utf8"));
  return match ? Math.round(Number(match[1]) / 102.4) / 10 : null;
}

const transcript = JSON.parse(fs.readFileSync(transcriptFile, "utf8"));
const baselineMiB = vmHwmMiB();
const origin = performance.now();
const since = () => Math.round(performance.now() - origin);
const report = {
  runtime: `node ${process.versions.node} (V8 ${process.versions.v8})`,
  transcript: path.basename(transcriptFile),
  seed: transcript.request.seed,
  recordedInputs: transcript.inputs.length,
  cardLoading,
  phases: {},
  ok: false,
};

const channel = globalThis.OpenManaInputChannel.create();
const replay = globalThis.OpenManaReplay.start(transcript, channel);
const worker = new Worker(path.join(wasmDir, "host", "node-engine-worker.cjs"));
let finished = false;
// Time from writing an input to the engine's next input.wait: Forge's work
// in between, AI turns included, as the page experiences it.
let lastInputAt = null;
const engineStepsMs = [];
const percentile = (sorted, p) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]) : null);

const finish = (error, verdict) => {
  if (finished) return;
  finished = true;
  report.ok = !error;
  report.error = error || null;
  report.inputsSent = replay.sent();
  const steps = engineStepsMs.slice().sort((a, b) => a - b);
  report.engineStepMs = { count: steps.length, p50: percentile(steps, 0.5), p95: percentile(steps, 0.95), max: percentile(steps, 1) };
  report.counters = replay.counters;
  if (verdict) {
    report.failures = verdict.failures;
    report.result = verdict.result;
  }
  report.peakRssMiB = vmHwmMiB();
  report.baselineRssMiB = baselineMiB;
  worker.terminate();
  const text = JSON.stringify(report, null, 2);
  if (outFile) fs.writeFileSync(outFile, text + "\n");
  console.log(text);
  process.exit(error ? 1 : 0);
};

const readyTimer = setTimeout(() => finish(`engine not ready after ${READY_TIMEOUT_MS / 1000} s`), READY_TIMEOUT_MS);
let gameTimer = null;

worker.on("error", (e) => finish(`worker error: ${e.stack || e}`));
worker.on("exit", (code) => finish(`worker exited unexpectedly (code ${code})`));
worker.on("message", (message) => {
  if (message.type === "boot") {
    report.phases[message.payload.phase] = since();
  } else if (message.type === "ready") {
    clearTimeout(readyTimer);
    report.phases.ready = since();
    report.boot = message.payload;
    gameTimer = setTimeout(() => finish(`game not over after ${GAME_TIMEOUT_MS / 1000} s (${replay.sent()} inputs sent)`), GAME_TIMEOUT_MS);
    report.phases.gameRequested = since();
    worker.postMessage({ type: "request", id: 1, request: replay.request });
  } else if (message.type === "fatal") {
    finish(`engine fatal (${message.payload.stage}): ${message.payload.error}\n${message.payload.stack || ""}`);
  } else if (message.type === "protocol") {
    replay.protocol(message.payload);
  } else if (message.type === "input.wait") {
    if (lastInputAt !== null) engineStepsMs.push(performance.now() - lastInputAt);
    if (!replay.inputWait(message.n)) {
      finish(replay.problem());
      return;
    }
    lastInputAt = performance.now();
  } else if (message.type === "response") {
    clearTimeout(gameTimer);
    report.phases.gameAnswered = since();
    report.requestMs = Math.round(message.ms);
    const verdict = replay.judge(message.response);
    finish(verdict.ok ? null : verdict.failures.join("\n"), verdict);
  }
});

worker.postMessage({
  type: "start",
  engineUrl: path.join(distDir, "openmana-engine.js"),
  wasmUrl: path.join(distDir, "openmana-engine.js.wasm"),
  args: [`--card-loading=${cardLoading}`],
  requireIsolation: false,
  inputBuffer: channel.buffer,
});
report.phases.workerStarted = since();
