#!/usr/bin/env node
// The card probe (diagnostics.card-probe, bridge CardProbe) in the Wasm engine
// in Node, through the EngineClient: Forge's card scripts load and become game
// cards. With --expect the result must equal the JVM probe of the same card
// loading mode (engine/scripts/test-engine.sh passes it).
//
//   node engine/wasm/test/node-cards.ts [--card-loading lazy|eager] [--language en-US|de-DE]
//        [--card-language en-US|de-DE] [--expect jvm-probe.json] [--out result.json] [--dist <dir>]
import fs from "node:fs";
import path from "node:path";
import type { CardProbeResult } from "../../protocol/src/index.ts";
import { probeDifferences, probeProblems } from "./card-probe-check.ts";
import { ENGINE_BUILD_DIR, nodeClient, option, vmHwmMiB } from "./node-engine.ts";

const args = process.argv.slice(2);
const distDir = path.resolve(option(args, "--dist", path.join(ENGINE_BUILD_DIR, "dist")));
const cardLoading = option(args, "--card-loading", "eager");
const language = option(args, "--language", "en-US");
const cardLanguage = option(args, "--card-language", null);
const expectFile = option(args, "--expect", null);
const outFile = option(args, "--out", null);

const baselineMiB = vmHwmMiB();
const origin = performance.now();
const since = () => Math.round(performance.now() - origin);
const phases: Record<string, number> = {};
// The whole-database pass keeps the engine busy for a long time without messages.
const client = nodeClient(distDir, cardLoading, { stallTimeoutMs: 600_000 }, language, cardLanguage);
const failures: string[] = [];
const done = new Promise<void>((resolve) => {
  client.subscribe((event) => {
    if (event.kind !== "message") return;
    const m = event.message;
    if (m.type === "engine.boot") phases[m.phase] = since();
    else if (m.type === "engine.ready") {
      phases["ready"] = since();
      client.runCardProbe();
    } else if (m.type === "diagnostics.cards") {
      phases["finished"] = since();
      resolve();
    } else if (m.type === "engine.abort") {
      failures.push(`technical abort (${m.reason}): ${m.message}${m.detail ? `\n${m.detail}` : ""}`);
      resolve();
    }
  });
});
const timer = setTimeout(() => client.abort("timeout after 900 s"), 900_000);
client.start();
await done;
clearTimeout(timer);
const probe = client.cardProbe;
let matchesJvm: boolean | null = null;
if (probe) {
  failures.push(...probeProblems(probe));
  // selected: Forge's card translation, i.e. the card language.
  if (probe.language.selected !== (cardLanguage ?? language)) failures.push(`the engine's cards are ${probe.language.selected}, requested was ${cardLanguage ?? language}`);
  if (expectFile) {
    const jvm = (JSON.parse(fs.readFileSync(expectFile, "utf8")) as { result: CardProbeResult }).result;
    const differences = probeDifferences(jvm, probe);
    if (probe.fingerprint !== jvm.fingerprint) differences.unshift(`fingerprint ${probe.fingerprint} != JVM ${jvm.fingerprint}`);
    if (JSON.stringify(probe.language) !== JSON.stringify({ ...jvm.language, timeZone: probe.language.timeZone })) {
      differences.push(`language samples differ from the JVM: ${JSON.stringify(probe.language)}`);
    }
    failures.push(...differences);
    matchesJvm = differences.length === 0;
  }
} else if (failures.length === 0) {
  failures.push("no card probe result");
}
const report = {
  runtime: `node ${process.versions.node} (V8 ${process.versions.v8})`,
  cardLoading,
  language,
  cardLanguage: cardLanguage ?? language,
  ok: failures.length === 0,
  failures,
  matchesJvm,
  phases,
  engine: client.engine?.engine ?? null,
  boot: client.engine?.boot ?? null,
  result: probe,
  peakRssMiB: vmHwmMiB(),
  baselineRssMiB: baselineMiB,
};
client.dispose();
const text = JSON.stringify(report, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(JSON.stringify({ ...report, result: probe ? { fingerprint: probe.fingerprint, millis: probe.millis } : null }, null, 2));
process.exit(report.ok ? 0 : 1);
