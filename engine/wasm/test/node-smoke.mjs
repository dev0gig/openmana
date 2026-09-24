#!/usr/bin/env node
// Wasm smoke test in Node: loads the engine in a worker_threads Worker (same
// worker host code as the browser), waits for Forge to be ready, lets Forge's
// AI play one game and checks the result. One game per process, so the peak
// memory (VmHWM of this process, worker included) belongs to this run only.
//
//   node engine/wasm/test/node-smoke.mjs --seed 42 [--card-loading lazy|eager]
//        [--expect-log-sha256 <hex>] [--out result.json] [--dist <dir>]
//
// Exit code 0 only if the game finished without Forge errors and, when given,
// the game log hash equals the expected (JVM) one.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const wasmDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const distDir = path.resolve(option("--dist", path.resolve(wasmDir, "..", "build", "dist")));
const seed = Number(option("--seed", "42"));
const cardLoading = option("--card-loading", "lazy");
const expectedSha = option("--expect-log-sha256", null);
const outFile = option("--out", null);
const READY_TIMEOUT_MS = 180000;
const GAME_TIMEOUT_MS = 300000;

function vmHwmMiB() {
  const match = /VmHWM:\s+(\d+) kB/.exec(fs.readFileSync("/proc/self/status", "utf8"));
  return match ? Math.round(Number(match[1]) / 102.4) / 10 : null;
}

const baselineMiB = vmHwmMiB();
const origin = performance.now();
const since = () => Math.round(performance.now() - origin);
const report = { runtime: `node ${process.versions.node} (V8 ${process.versions.v8})`, seed, cardLoading, phases: {}, ok: false };

const worker = new Worker(path.join(wasmDir, "host", "node-engine-worker.cjs"));
const finish = (error) => {
  report.ok = !error;
  report.error = error || null;
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
    gameTimer = setTimeout(() => finish(`no game result after ${GAME_TIMEOUT_MS / 1000} s`), GAME_TIMEOUT_MS);
    report.phases.gameRequested = since();
    worker.postMessage({ type: "request", id: 1, request: { command: "smoke-match", seed, includeLog: false } });
  } else if (message.type === "fatal") {
    finish(`engine fatal (${message.payload.stage}): ${message.payload.error}\n${message.payload.stack || ""}`);
  } else if (message.type === "response") {
    clearTimeout(gameTimer);
    report.phases.gameAnswered = since();
    report.requestMs = Math.round(message.ms);
    if (!message.response.ok) {
      finish(`game failed: ${message.response.error}\n${message.response.stack || ""}`);
      return;
    }
    const result = message.response.result;
    report.result = result;
    if (result.forgeErrors.length > 0) {
      finish(`Forge reported errors: ${result.forgeErrors.join(" | ")}`);
    } else if (!(result.turns > 1) || (!result.draw && !result.winner)) {
      finish("game did not finish properly");
    } else if (expectedSha && result.logSha256 !== expectedSha) {
      finish(`game log differs from the JVM reference: ${result.logSha256} != ${expectedSha}`);
    } else {
      report.matchesJvm = expectedSha ? true : null;
      finish(null);
    }
  }
});

worker.postMessage({
  type: "start",
  engineUrl: path.join(distDir, "openmana-engine.js"),
  wasmUrl: path.join(distDir, "openmana-engine.js.wasm"),
  args: [`--card-loading=${cardLoading}`],
  requireIsolation: false,
});
report.phases.workerStarted = since();
