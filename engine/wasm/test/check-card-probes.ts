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
//    really is German (Forge's messages and card names translated);
//  - German words with English cards (--card-language, prompt 12): the same
//    fingerprint, Forge's messages German, the card names English.
//
//   node engine/wasm/test/check-card-probes.ts --lazy a.json --eager b.json [--german c.json]
//        [--german-english-cards d.json] [--out verdict.json]
import fs from "node:fs";
import type { CardProbeResult } from "../../protocol/src/index.ts";
import { probeDifferences, probeProblems } from "./card-probe-check.ts";
import { option } from "./node-engine.ts";

const args = process.argv.slice(2);
const read = (file: string | null) => (file ? (JSON.parse(fs.readFileSync(file, "utf8")) as { result: CardProbeResult }).result : null);
const lazy = read(option(args, "--lazy", null));
const eager = read(option(args, "--eager", null));
const german = read(option(args, "--german", null));
const germanEnglishCards = read(option(args, "--german-english-cards", null));
const outFile = option(args, "--out", null);
if (!lazy || !eager) {
  console.error("--lazy and --eager (JVM probe results) are required");
  process.exit(2);
}

const failures: string[] = [];
for (const [name, probe] of [["lazy", lazy], ["eager", eager], ["german", german], ["german-english-cards", germanEnglishCards]] as const) {
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

if (germanEnglishCards) {
  const where = "german with english cards";
  if (germanEnglishCards.language.selected !== "en-US") failures.push(`${where}: Forge's cards are ${germanEnglishCards.language.selected}`);
  if (germanEnglishCards.fingerprint !== lazy.fingerprint) {
    failures.push(`${where} vs english: fingerprint ${germanEnglishCards.fingerprint} != ${lazy.fingerprint}${probeDifferences(lazy, germanEnglishCards).map((d) => `; ${d}`).join("")}`);
  }
  for (const [key, text] of Object.entries(germanEnglishCards.language.messages)) {
    if (text === lazy.language.messages[key]) failures.push(`${where}: message ${key} is not translated (${text})`);
    if (german && text !== german.language.messages[key]) failures.push(`${where}: message ${key} is ${text}, German says ${german.language.messages[key]}`);
  }
  if (JSON.stringify(germanEnglishCards.language.cardNames) !== JSON.stringify(lazy.language.cardNames)) {
    failures.push(`${where}: card names are not English: ${JSON.stringify(germanEnglishCards.language.cardNames)}`);
  }
}

const verdict = {
  ok: failures.length === 0,
  failures,
  fingerprints: { lazy: lazy.fingerprint, eager: eager.fingerprint, german: german?.fingerprint ?? null, germanEnglishCards: germanEnglishCards?.fingerprint ?? null },
  sections: { lazy: lazy.sections, eager: eager.sections },
  german: german?.language ?? null,
  germanEnglishCards: germanEnglishCards?.language ?? null,
};
const text = JSON.stringify(verdict, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);
process.exit(verdict.ok ? 0 : 1);
