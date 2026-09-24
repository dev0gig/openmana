#!/usr/bin/env node
// Runs a command and reports its wall time and peak memory, Linux only.
//
//   node engine/scripts/measure.mjs <label> <report.jsonl> -- <command> [args…]
//
// Memory is sampled every 100 ms from /proc as the summed RSS of the whole
// process tree (shared pages count once per process, so this is an upper
// bound). The command's stdin/stdout/stderr pass through unchanged; the exit
// code is passed on. One JSON line is appended to <report.jsonl>.

import { spawn } from "node:child_process";
import fs from "node:fs";

const sep = process.argv.indexOf("--");
const [label, reportFile] = process.argv.slice(2, sep);
const command = process.argv.slice(sep + 1);
if (sep < 0 || !label || !reportFile || command.length === 0) {
  console.error("usage: measure.mjs <label> <report.jsonl> -- <command> [args…]");
  process.exit(2);
}

function childrenOf(pid) {
  try {
    return fs
      .readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8")
      .split(" ")
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

function rssKb(pid) {
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
    const match = /VmRSS:\s+(\d+) kB/.exec(status);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

function treeRssKb(root) {
  let total = 0;
  const stack = [root];
  const seen = new Set();
  while (stack.length) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    total += rssKb(pid);
    stack.push(...childrenOf(pid));
  }
  return total;
}

const started = process.hrtime.bigint();
const child = spawn(command[0], command.slice(1), { stdio: "inherit" });
let peakKb = 0;
const timer = setInterval(() => {
  peakKb = Math.max(peakKb, treeRssKb(child.pid));
}, 100);

child.on("exit", (code, signal) => {
  clearInterval(timer);
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const entry = {
    label,
    seconds: +seconds.toFixed(2),
    peakTreeRssMiB: +(peakKb / 1024).toFixed(1),
    exitCode: code,
    signal,
    at: new Date().toISOString(),
  };
  fs.appendFileSync(reportFile, JSON.stringify(entry) + "\n");
  console.error(`[measure] ${label}: ${entry.seconds} s, peak RSS ${entry.peakTreeRssMiB} MiB, exit ${code ?? signal}`);
  process.exit(code ?? 1);
});
