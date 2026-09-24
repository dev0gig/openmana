#!/usr/bin/env node
/*
 * Compares two engine traces entry by entry (prompt 05) and fails with the
 * first difference. A trace is a JSON-lines file (JvmSmokeMain --trace) or a
 * transcript with a "trace" (JvmHumanMatchMain).
 *
 *   node engine/wasm/test/compare-traces.ts <reference> <other> [--names <reference name>,<other name>]
 *
 * Used for games that must be the same game on the same runtime: the AI
 * games with lazy and eager card loading, in English and in German.
 * Exit code 0 only if the traces are equal.
 */
import fs from "node:fs";
import path from "node:path";
import { compareTraces, describeDivergence, parseTraceLines, traceDigest, type TraceEntry } from "../spike/trace.ts";

function read(file: string): TraceEntry[] {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".jsonl")) return parseTraceLines(text);
  const trace = (JSON.parse(text) as { trace?: TraceEntry[] }).trace;
  if (!Array.isArray(trace)) throw new Error(`${file} has no engine trace`);
  return trace;
}

const args = process.argv.slice(2);
const namesAt = args.indexOf("--names");
const names = namesAt >= 0 ? (args[namesAt + 1] ?? "").split(",") : [];
const files = args.filter((_, i) => namesAt < 0 || (i !== namesAt && i !== namesAt + 1));
if (files.length !== 2) {
  console.error("usage: compare-traces.ts <reference> <other> [--names a,b]");
  process.exit(2);
}
const [a, b] = files.map(read) as [TraceEntry[], TraceEntry[]];
const divergence = compareTraces(a, b);
if (divergence) {
  console.error(describeDivergence(divergence, { reference: names[0] ?? path.basename(files[0]!), actual: names[1] ?? path.basename(files[1]!) }));
  process.exit(1);
}
console.log(`equal: ${a.length} entries, sha256 ${await traceDigest(a)}`);
