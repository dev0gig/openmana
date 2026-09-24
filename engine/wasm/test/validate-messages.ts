#!/usr/bin/env node
// Validates recorded engine messages (one JSON per line, as written by
// JvmHumanMatchMain --messages) against the protocol: every message against
// the schema, every snapshot against the full-snapshot invariants, the
// question lifecycle (each question closed exactly once, nothing open at the
// end) and, for a traced match, the engine trace (entries numbered without
// gaps, the last one at the end of the game). The JVM bridge must meet the
// same contract as the Wasm engine, whose messages the EngineClient checks live.
//
//   node engine/wasm/test/validate-messages.ts <messages.jsonl>... [--out report.json]
//
// Exit code 0 only if every file is clean.
import fs from "node:fs";
import path from "node:path";
import { checkEngineMessage, ProtocolViolation, type EngineMessage } from "../../protocol/src/index.ts";
import { snapshotProblems } from "../spike/invariants.ts";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = outIndex >= 0 ? args[outIndex + 1] : undefined;
const files = args.filter((a, i) => a !== "--out" && (outIndex < 0 || i !== outIndex + 1));
if (files.length === 0) {
  console.error("usage: validate-messages.ts <messages.jsonl>... [--out report.json]");
  process.exit(2);
}

interface FileReport {
  file: string;
  messages: number;
  byType: Record<string, number>;
  states: number;
  questions: number;
  problems: string[];
}

const reports: FileReport[] = [];
for (const file of files) {
  const report: FileReport = { file: path.basename(file), messages: 0, byType: {}, states: 0, questions: 0, problems: [] };
  const open = new Set<number>();
  const closed = new Set<number>();
  let lastSeq = 0;
  let lastQuestion = 0;
  let ended = false;
  let traceEntries = 0;
  let lastTraceAt: string | null = null;
  const lines = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim() !== "");
  lines.forEach((line, index) => {
    const where = `line ${index + 1}`;
    let message: EngineMessage;
    try {
      message = checkEngineMessage(JSON.parse(line));
    } catch (e) {
      report.problems.push(`${where}: ${e instanceof ProtocolViolation ? e.message : String(e)}`);
      return;
    }
    report.messages++;
    report.byType[message.type] = (report.byType[message.type] ?? 0) + 1;
    // Forge's end-of-game event may come after game.end: the trace's last checkpoint.
    if (ended && message.type !== "events" && message.type !== "message" && message.type !== "diagnostics.trace") report.problems.push(`${where}: ${message.type} after game.end`);
    switch (message.type) {
      case "state":
        report.states++;
        if (message.seq <= lastSeq) report.problems.push(`${where}: state ${message.seq} after ${lastSeq}`);
        lastSeq = message.seq;
        for (const p of snapshotProblems(message)) report.problems.push(`${where} (state ${message.seq}): ${p}`);
        break;
      case "question":
        report.questions++;
        if (message.id <= lastQuestion) report.problems.push(`${where}: question id ${message.id} after ${lastQuestion}`);
        lastQuestion = message.id;
        open.add(message.id);
        break;
      case "question.withdrawn":
      case "question.answered":
        if (!open.delete(message.id)) report.problems.push(`${where}: ${message.type} for question ${message.id}, which is not open`);
        if (closed.has(message.id)) report.problems.push(`${where}: question ${message.id} closed twice`);
        closed.add(message.id);
        break;
      case "game.end":
        ended = true;
        if (open.size > 0) report.problems.push(`${where}: game.end with open questions ${[...open].join(", ")}`);
        break;
      case "diagnostics.trace":
        if (message.n !== traceEntries + 1) report.problems.push(`${where}: trace entry ${message.n} after ${traceEntries}`);
        traceEntries = message.n;
        lastTraceAt = message.at;
        break;
      default:
        break;
    }
  });
  if (!ended) report.problems.push("no game.end");
  if (traceEntries > 0 && lastTraceAt !== "end") report.problems.push(`the engine trace ends at '${lastTraceAt}', not at the end of the game`);
  reports.push(report);
}

const failures = reports.reduce((n, r) => n + r.problems.length, 0);
const text = JSON.stringify({ ok: failures === 0, files: reports.map((r) => ({ ...r, problems: r.problems.slice(0, 50), problemCount: r.problems.length })) }, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);
process.exit(failures === 0 ? 0 : 1);
