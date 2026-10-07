#!/usr/bin/env node
// Forge's AI plays itself in the Wasm engine in Node (diagnostics.ai-match),
// through the EngineClient; the game log must equal the JVM reference and,
// with --expect-trace, the engine trace the JVM's (JvmSmokeMain --trace), entry
// by entry (prompt 05).
//
//   node engine/wasm/test/node-ai.ts --seed 42 [--card-loading lazy|eager] [--language en-US|de-DE]
//        [--expect-log-sha256 <hex>] [--expect-trace <trace.jsonl>] [--out result.json] [--dist <dir>]
import fs from "node:fs";
import path from "node:path";
import { describeDivergence, parseTraceLines, TraceComparison, traceDigest, type TraceEntry } from "../spike/trace.ts";
import { ENGINE_BUILD_DIR, nodeClient, option, vmHwmMiB } from "./node-engine.ts";

const args = process.argv.slice(2);
const distDir = path.resolve(option(args, "--dist", path.join(ENGINE_BUILD_DIR, "dist")));
const seed = Number(option(args, "--seed", "42"));
const cardLoading = option(args, "--card-loading", "eager");
const language = option(args, "--language", "en-US");
const expected = option(args, "--expect-log-sha256", null);
const expectTrace = option(args, "--expect-trace", null);
const outFile = option(args, "--out", null);
const reference = expectTrace ? parseTraceLines(fs.readFileSync(expectTrace, "utf8")) : null;
const comparison = reference ? new TraceComparison(reference) : null;
const traceEntries: TraceEntry[] = [];
let diverged = false;

const baselineMiB = vmHwmMiB();
const origin = performance.now();
const since = () => Math.round(performance.now() - origin);
const phases: Record<string, number> = {};
const client = nodeClient(distDir, cardLoading, {}, language);
const failures: string[] = [];
const done = new Promise<void>((resolve) => {
  client.subscribe((event) => {
    if (event.kind !== "message") return;
    const m = event.message;
    if (m.type === "engine.boot") phases[m.phase] = since();
    else if (m.type === "engine.ready") {
      phases["ready"] = since();
      client.runAiDiagnostics(seed, false, comparison !== null);
    } else if (m.type === "diagnostics.trace") {
      traceEntries.push(m);
      const d = comparison?.add(m) ?? null;
      if (d && !diverged) {
        diverged = true;
        failures.push(describeDivergence(d));
        client.abort("the engine trace diverged from the JVM game");
      }
    } else if (m.type === "diagnostics.result") {
      phases["finished"] = since();
      resolve();
    } else if (m.type === "engine.abort") {
      if (!(diverged && m.origin === "client")) failures.push(`technical abort (${m.reason}): ${m.message}${m.detail ? `\n${m.detail}` : ""}`);
      resolve();
    }
  });
});
const timer = setTimeout(() => client.abort("timeout after 540 s"), 540_000);
client.start();
await done;
clearTimeout(timer);
const result = client.diagnostics;
if (result) {
  if (result.forgeErrors.length > 0) failures.push(`Forge reported errors: ${result.forgeErrors.join(" | ")}`);
  if (!(result.turns > 1) || (!result.draw && !result.winner)) failures.push("the game did not finish properly");
  if (expected && result.logSha256 !== expected) failures.push(`game log differs from the JVM reference: ${result.logSha256} != ${expected}`);
  const missing = comparison && !diverged ? comparison.finish() : null;
  if (missing) failures.push(describeDivergence(missing));
}
const trace = comparison
  ? { reference: reference!.length, compared: comparison.compared, sha256: await traceDigest(traceEntries), divergence: comparison.divergence ? describeDivergence(comparison.divergence) : null }
  : null;
const report = {
  runtime: `node ${process.versions.node} (V8 ${process.versions.v8})`,
  seed,
  cardLoading,
  language,
  ok: failures.length === 0 && result !== null,
  failures,
  matchesJvm: expected ? result?.logSha256 === expected : null,
  trace,
  phases,
  engine: client.engine?.engine ?? null,
  boot: client.engine?.boot ?? null,
  result,
  peakRssMiB: vmHwmMiB(),
  baselineRssMiB: baselineMiB,
};
client.dispose();
const text = JSON.stringify(report, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);
process.exit(report.ok ? 0 : 1);
