#!/usr/bin/env node
/*
 * Checks the JVM reference games of the differential tests (prompt 05)
 * before any Wasm run compares against them:
 *  - every fixture has a transcript with a complete engine trace (entries
 *    numbered from 1 without gaps, the last one taken when Forge ended the game);
 *  - every fixture's game shows what the fixture says it covers
 *    (engine/wasm/spike/trace.ts traceCoverage), so a fixture that stops
 *    testing what it is for fails instead of passing quietly;
 *  - a variant (sameGameAs) has exactly the trace of its fixture: another
 *    language or card loading mode changes Forge's texts or timing, never the game;
 *  - together the fixtures cover everything prompt 05 asks for
 *    (REQUIRED_COVERAGE).
 * Writes a report with digest, counts and coverage per fixture.
 *
 *   node engine/wasm/test/check-traces.ts --transcripts <dir> [--out report.json]
 *
 * Transcripts: <dir>/<fixture>.json (JvmHumanMatchMain --scenario, format 3).
 * Exit code 0 only if everything holds.
 */
import fs from "node:fs";
import path from "node:path";
import { loadFixtures } from "./fixtures.ts";
import { option } from "./node-engine.ts";
import { compareTraces, describeDivergence, REQUIRED_COVERAGE, traceCoverage, traceDigest, traceStats, type TraceEntry } from "../spike/trace.ts";

const args = process.argv.slice(2);
const dir = option(args, "--transcripts", null);
const outFile = option(args, "--out", null);
if (!dir) {
  console.error("usage: check-traces.ts --transcripts <dir> [--out report.json]");
  process.exit(2);
}

interface FixtureReport {
  name: string;
  sameGameAs: string | null;
  turns: unknown;
  result: unknown;
  inputs: number;
  logSha256: unknown;
  traceSha256: string | null;
  stats: ReturnType<typeof traceStats> | null;
  covers: string[];
  coverage: Record<string, number>;
  problems: string[];
}

const fixtures = loadFixtures();
const traces = new Map<string, TraceEntry[]>();
const reports: FixtureReport[] = [];
const problems: string[] = [];

for (const fixture of fixtures) {
  const report: FixtureReport = {
    name: fixture.name, sameGameAs: fixture.sameGameAs, turns: null, result: null, inputs: 0, logSha256: null,
    traceSha256: null, stats: null, covers: fixture.covers, coverage: {}, problems: [],
  };
  reports.push(report);
  const file = path.join(dir, `${fixture.name}.json`);
  if (!fs.existsSync(file)) {
    report.problems.push(`no transcript ${file}`);
    continue;
  }
  const transcript = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  const expected = (transcript["expected"] ?? {}) as Record<string, unknown>;
  report.turns = expected["turns"];
  report.result = expected["result"];
  report.logSha256 = expected["logSha256"];
  report.inputs = Array.isArray(transcript["inputs"]) ? transcript["inputs"].length : 0;
  const trace = transcript["trace"];
  if (!Array.isArray(trace) || trace.length === 0) {
    report.problems.push("the transcript has no engine trace");
    continue;
  }
  const entries = trace as TraceEntry[];
  traces.set(fixture.name, entries);
  entries.forEach((e, i) => {
    if (e.n !== i + 1) report.problems.push(`entry ${i + 1} is numbered ${e.n}`);
  });
  if (entries.at(-1)?.at !== "end") report.problems.push(`the last entry is taken at '${entries.at(-1)?.at}', not at the end of the game`);
  const summary = expected["trace"] as { entries?: number; events?: number } | undefined;
  const stats = traceStats(entries);
  if (!summary || summary.entries !== stats.entries || summary.events !== stats.events) {
    report.problems.push(`the engine reports ${JSON.stringify(summary)} trace entries/events, the transcript has ${stats.entries}/${stats.events}`);
  }
  report.stats = stats;
  report.traceSha256 = await traceDigest(entries);
  report.coverage = traceCoverage(entries);
  const expectedCovers = fixture.sameGameAs ? [] : fixture.covers;
  const missing = expectedCovers.filter((c) => !((report.coverage[c] ?? 0) > 0));
  if (missing.length > 0) report.problems.push(`the game does not show what the fixture covers: ${missing.join(", ")}`);
}

for (const fixture of fixtures.filter((f) => f.sameGameAs)) {
  const variant = traces.get(fixture.name);
  const base = traces.get(fixture.sameGameAs!);
  const report = reports.find((r) => r.name === fixture.name)!;
  if (!variant || !base) {
    report.problems.push(`cannot compare with ${fixture.sameGameAs}: a trace is missing`);
    continue;
  }
  const divergence = compareTraces(base, variant);
  if (divergence) {
    report.problems.push(`not the same game as ${fixture.sameGameAs}: ${describeDivergence(divergence, { reference: fixture.sameGameAs!, actual: fixture.name })}`);
  }
}

const covered = new Set(fixtures.filter((f) => !f.sameGameAs).flatMap((f) => f.covers));
const uncovered = REQUIRED_COVERAGE.filter((c) => !covered.has(c));
if (uncovered.length > 0) problems.push(`the fixtures together do not cover: ${uncovered.join(", ")} (prompt 05)`);
for (const r of reports) problems.push(...r.problems.map((p) => `${r.name}: ${p}`));

const text = JSON.stringify({ ok: problems.length === 0, problems, required: REQUIRED_COVERAGE, fixtures: reports }, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(problems.length === 0 ? `engine traces of ${fixtures.length} fixtures consistent` : problems.join("\n"));
process.exit(problems.length === 0 ? 0 : 1);
