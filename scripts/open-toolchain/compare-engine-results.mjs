#!/usr/bin/env node
// Compares the engine results of two builds run by engine/scripts/test-engine.sh
// (Prompt 34: Oracle build publish-31b against the open build). Every run of
// report/test-report.json must exist in both and agree in every field except
// clocks, memory, runtime/browser strings and build identities (commit,
// manifest): game results, inputs, log/protocol/trace digests and counts.
//
// Memory figures and console durations are measurements, not results.
// Some values also differ between two runs of the SAME build: how many
// intermediate states/events the engine emits and the transport refuses
// depends on timing, and stack traces name Wasm function numbers and ports.
// They are listed separately as "volatile" (Oracle publish-31 vs publish-31b,
// same sources and toolchain, differ in exactly these fields). The check fails
// only on a difference in a result field.
//
//   node scripts/open-toolchain/compare-engine-results.mjs <old build dir> <new build dir>
import fs from "node:fs";
import path from "node:path";

const IGNORED = /(^|\.)(phases|timings|runtime|browser|userAgent|wallMs|gameMillis|ms|seconds|millis|startedAt|finishedAt|openmanaCommit|openmanaEngineSourcesModified|manifestSha256|memory|uaMemory|idleBrowserRssMiB|peakBrowserRssMiB|log|features)$/i;
// Console lines of the engine carry durations ("... in 920 ms"); they are compared without the numbers.
const CONSOLE_TIME = /\d+ ms\b/g;
const VOLATILE = [
  /(^|\.)counters\.(emit|state):/,
  /(^|\.)validation\.messages$/,
  /^files\.\d+\.(messages|states|byType\.[a-z.]+)$/,
  /(^|\.)queue\.fullRefusals$/,
  /(^|\.)(baseline|peak)RssMiB$/,
  /(^|\.)console\.\d+$/,
  /(^|\.)details\.end\.detail$/,
];
const [oldDir, newDir] = process.argv.slice(2);
if (!oldDir || !newDir) throw new Error("Usage: compare-engine-results.mjs <old build dir> <new build dir>");
const runs = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "report/test-report.json"), "utf8")).runs;
const before = runs(oldDir);
const after = runs(newDir);

function flatten(value, prefix, out) {
  if (IGNORED.test(prefix) || /Ms$|Millis$/.test(prefix)) return out;
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out);
  } else out[prefix] = /(^|\.)console\.\d+$/.test(prefix) && typeof value === "string" ? value.replace(CONSOLE_TIME, "<n> ms") : value;
  return out;
}

const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
const differences = {};
const volatile = {};
let compared = 0;
let digests = 0;
for (const name of names) {
  if (!before[name] || !after[name]) {
    differences[name] = [`only in ${before[name] ? "old" : "new"} build`];
    continue;
  }
  const a = flatten(before[name], "", {});
  const b = flatten(after[name], "", {});
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const changed = keys.filter((key) => a[key] !== b[key]);
  const show = (key) => `${key}: ${JSON.stringify(a[key])} -> ${JSON.stringify(b[key])}`;
  const isVolatile = (key) => VOLATILE.some((pattern) => pattern.test(key));
  compared += keys.length;
  digests += keys.filter((key) => /sha256$/i.test(key)).length;
  if (changed.some((key) => !isVolatile(key))) differences[name] = changed.filter((key) => !isVolatile(key)).map(show);
  if (changed.some(isVolatile)) volatile[name] = changed.filter(isVolatile).length;
}
const ok = (run) => run.ok !== false && !(run.failures?.length);
console.log(JSON.stringify({
  format: "openmana-engine-compare/1",
  old: oldDir, new: newDir,
  runs: names.length,
  passedOld: Object.values(before).filter(ok).length,
  passedNew: Object.values(after).filter(ok).length,
  identical: names.length - Object.keys(differences).length,
  comparedFields: compared,
  comparedDigests: digests,
  differences,
  volatileFieldsChanged: volatile,
}, null, 2));
process.exitCode = Object.keys(differences).length ? 1 : 0;
