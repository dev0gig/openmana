#!/usr/bin/env node
// Negative test of the differential harness (prompt 05): "any divergence must
// fail". A JVM transcript is tampered with in ways a real divergence would
// show, and the Wasm replay in Node (the real engine, client and queue) must
// fail - at exactly the tampered place:
//   - a value inside a snapshot in the middle of the game (a player's life),
//   - an event that is missing (the Wasm engine then sends one more),
//   - a JVM trace that is one entry longer than the game.
//
//   node engine/wasm/test/node-divergence.ts --transcript <short transcript> [--out report.json] [--dist <dir>]
//
// Exit code 0 only if every tampered replay failed where it should.
import fs from "node:fs";
import path from "node:path";
import { replay, type Transcript } from "../spike/replay.ts";
import { ENGINE_DIR, nodeClient, option } from "./node-engine.ts";

const args = process.argv.slice(2);
const distDir = path.resolve(option(args, "--dist", path.join(ENGINE_DIR, "build", "dist")));
const transcriptFile = option(args, "--transcript", null);
const outFile = option(args, "--out", null);
if (!transcriptFile) {
  console.error("--transcript <file> is required");
  process.exit(2);
}
const original = JSON.parse(fs.readFileSync(transcriptFile, "utf8")) as Transcript;
if (!original.trace || original.trace.length < 10) {
  console.error("the transcript needs an engine trace of at least 10 entries");
  process.exit(2);
}

interface Case {
  name: string;
  tamper: (t: Transcript) => void;
  /** The failure text must contain this (entry number and path). */
  expect: RegExp;
}

const middle = Math.floor(original.trace.length / 2);
const eventEntry = original.trace.findIndex((e, i) => i > 2 && e.events.length >= 2);
const cases: Case[] = [
  {
    name: "a snapshot value",
    tamper: (t) => {
      t.trace![middle]!.snapshot.players[1]!.life += 1;
    },
    expect: new RegExp(`entry ${middle + 1} .* at snapshot\\.players\\[1\\]\\.life: JVM ${original.trace[middle]!.snapshot.players[1]!.life + 1} / Wasm ${original.trace[middle]!.snapshot.players[1]!.life}`),
  },
  {
    name: "a missing event",
    tamper: (t) => {
      t.trace![eventEntry]!.events.splice(1, 1);
    },
    expect: new RegExp(`entry ${eventEntry + 1} .* at events\\[1\\]`),
  },
  {
    name: "a JVM trace longer than the game",
    tamper: (t) => {
      t.trace!.push({ ...t.trace!.at(-1)!, n: t.trace!.length + 1 });
    },
    expect: new RegExp(`entry ${original.trace.length + 1} .*compared trace ends after ${original.trace.length} entries`),
  },
];

const results: { name: string; ok: boolean; failures: string[] }[] = [];
for (const c of cases) {
  const transcript = structuredClone(original);
  c.tamper(transcript);
  const client = nodeClient(distDir, transcript.engine?.cardLoading ?? "eager", {}, transcript.engine?.language ?? "en-US");
  const timer = setTimeout(() => client.abort("timeout"), 300_000);
  const run = replay(client, transcript, "lazy", () => performance.now());
  client.start();
  const verdict = await run;
  clearTimeout(timer);
  client.dispose();
  const found = verdict.failures.some((f) => c.expect.test(f));
  const ok = !verdict.ok && found;
  results.push({ name: c.name, ok, failures: verdict.failures.slice(0, 5) });
  console.log(`${ok ? "ok  " : "FAIL"} ${c.name}: ${verdict.ok ? "the replay passed although the trace was tampered with" : found ? "failed at the tampered place" : `failed elsewhere: ${verdict.failures[0]}`}`);
}

const ok = results.every((r) => r.ok);
const text = JSON.stringify({ ok, transcript: path.basename(transcriptFile), results }, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
process.exit(ok ? 0 : 1);
