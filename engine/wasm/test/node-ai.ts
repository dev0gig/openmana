#!/usr/bin/env node
// Forge's AI plays itself in the Wasm engine in Node (diagnostics.ai-match),
// through the EngineClient; the game log must equal the JVM reference.
//
//   node engine/wasm/test/node-ai.ts --seed 42 [--card-loading lazy|eager] [--language en-US|de-DE]
//        [--expect-log-sha256 <hex>] [--out result.json] [--dist <dir>]
import fs from "node:fs";
import path from "node:path";
import { ENGINE_DIR, nodeClient, option, vmHwmMiB } from "./node-engine.ts";

const args = process.argv.slice(2);
const distDir = path.resolve(option(args, "--dist", path.join(ENGINE_DIR, "build", "dist")));
const seed = Number(option(args, "--seed", "42"));
const cardLoading = option(args, "--card-loading", "eager");
const language = option(args, "--language", "en-US");
const expected = option(args, "--expect-log-sha256", null);
const outFile = option(args, "--out", null);

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
      client.runAiDiagnostics(seed, false);
    } else if (m.type === "diagnostics.result") {
      phases["finished"] = since();
      resolve();
    } else if (m.type === "engine.abort") {
      failures.push(`technical abort (${m.reason}): ${m.message}${m.detail ? `\n${m.detail}` : ""}`);
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
}
const report = {
  runtime: `node ${process.versions.node} (V8 ${process.versions.v8})`,
  seed,
  cardLoading,
  language,
  ok: failures.length === 0 && result !== null,
  failures,
  matchesJvm: expected ? result?.logSha256 === expected : null,
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
