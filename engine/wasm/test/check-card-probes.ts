#!/usr/bin/env node
// Compares the JVM card probes of one test run with each other
// (engine/scripts/test-engine.sh, step 1):
//
//  - each probe on its own: no failures, every named-creation case works,
//    every card, variant card and token script becomes a game card;
//  - lazy against eager card loading: the same cards, tokens, editions and
//    database; the named-creation cases create the same cards (only what was
//    loaded before differs, by design);
//  - German against English: the same fingerprint (the probe describes cards
//    by structure, so the language must not change anything), and German
//    really is German (Forge's messages and card names translated).
//
//   node engine/wasm/test/check-card-probes.ts --lazy a.json --eager b.json [--german c.json] [--out verdict.json]
import fs from "node:fs";
import type { CardProbeResult } from "../../protocol/src/index.ts";
import { probeDifferences, probeProblems } from "./card-probe-check.ts";
import { option } from "./node-engine.ts";

const args = process.argv.slice(2);
const read = (file: string | null) => (file ? (JSON.parse(fs.readFileSync(file, "utf8")) as { result: CardProbeResult }).result : null);
const lazy = read(option(args, "--lazy", null));
const eager = read(option(args, "--eager", null));
const german = read(option(args, "--german", null));
const outFile = option(args, "--out", null);
if (!lazy || !eager) {
  console.error("--lazy and --eager (JVM probe results) are required");
  process.exit(2);
}

const failures: string[] = [];
for (const [name, probe] of [["lazy", lazy], ["eager", eager], ["german", german]] as const) {
  if (probe) failures.push(...probeProblems(probe).map((p) => `${name}: ${p}`));
}
if (lazy.cardLoading !== "lazy" || eager.cardLoading !== "eager") {
  failures.push(`card loading modes are ${lazy.cardLoading}/${eager.cardLoading}, expected lazy/eager`);
}
failures.push(...probeDifferences(lazy, { ...eager, cardLoading: "lazy" }, ["representative", "tokens", "newestEditions", "database"]).map((d) => `lazy vs eager: ${d}`));
const created = (p: CardProbeResult) => p.namedCreation.map((c) => ({ id: c.id, created: c.created }));
if (JSON.stringify(created(lazy)) !== JSON.stringify(created(eager))) {
  failures.push(`lazy vs eager: the named-creation cases created different cards: ${JSON.stringify(created(lazy))} / ${JSON.stringify(created(eager))}`);
}
const lazyCase = lazy.namedCreation.find((c) => c.id === "conjure-by-name");
if (!lazyCase || lazyCase.uniqueCardsKnownBefore === undefined || lazyCase.uniqueCardsKnownBefore >= eager.database.cards.unique) {
  failures.push("lazy: the card database was already complete before the first named creation; lazy loading is not in effect");
}

if (german) {
  if (german.language.selected !== "de-DE") failures.push(`german: Forge speaks ${german.language.selected}`);
  if (german.fingerprint !== lazy.fingerprint) {
    failures.push(`german vs english: fingerprint ${german.fingerprint} != ${lazy.fingerprint}${probeDifferences(lazy, german).map((d) => `; ${d}`).join("")}`);
  }
  for (const [key, text] of Object.entries(german.language.messages)) {
    if (text === lazy.language.messages[key]) failures.push(`german: message ${key} is not translated (${text})`);
  }
  const translatedNames = Object.entries(german.language.cardNames).filter(([english, shown]) => english !== shown);
  if (translatedNames.length === 0) failures.push(`german: no card name is translated: ${JSON.stringify(german.language.cardNames)}`);
}

const verdict = {
  ok: failures.length === 0,
  failures,
  fingerprints: { lazy: lazy.fingerprint, eager: eager.fingerprint, german: german?.fingerprint ?? null },
  sections: { lazy: lazy.sections, eager: eager.sections },
  german: german?.language ?? null,
};
const text = JSON.stringify(verdict, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);
process.exit(verdict.ok ? 0 : 1);
