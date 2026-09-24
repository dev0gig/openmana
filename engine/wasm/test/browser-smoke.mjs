#!/usr/bin/env node
// Wasm smoke test in a real browser (Chrome for Testing via playwright-core):
// serves the spike page with COOP/COEP, lets it load Forge into a Dedicated
// Worker and play one game, and records timings and memory.
//
//   node engine/wasm/test/browser-smoke.mjs --seed 42 [--card-loading lazy|eager]
//        [--expect-log-sha256 <hex>] [--out result.json]
//   node engine/wasm/test/browser-smoke.mjs --transcript t.json [--card-loading …] [--out result.json]
//   node engine/wasm/test/browser-smoke.mjs --negative [--out result.json]
//
// Default: Forge's AI plays against itself (prompt 01).
// --transcript replays a JVM-recorded human-vs-AI game (prompt 02): the page
// writes the recorded inputs into the SharedArrayBuffer channel whenever the
// worker waits; passes only if the game ends exactly as on the JVM.
// --negative serves the page WITHOUT cross-origin isolation and passes only if
// the page reports the missing feature quickly instead of hanging.
//
// Chrome: OPENMANA_CHROME=<path> or Playwright's own chromium build for
// playwright-core 1.63.0 (Chrome for Testing 153). Memory is the summed RSS of
// all processes of this browser instance, sampled every 200 ms.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { startServer } from "./serve.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const negative = args.includes("--negative");
const transcriptFile = option("--transcript", null);
const seed = Number(option("--seed", "42"));
const cardLoading = option("--card-loading", "lazy");
const expectedSha = option("--expect-log-sha256", null);
const outFile = option("--out", null);
const TEST_TIMEOUT_MS = negative ? 30000 : transcriptFile ? 840000 : 540000;

function rssKb(pid) {
  try {
    return Number(/VmRSS:\s+(\d+) kB/.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"))?.[1] ?? 0);
  } catch {
    return 0;
  }
}

function browserRssMiB(profileDir) {
  let totalKb = 0;
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    let cmdline = "";
    try {
      cmdline = fs.readFileSync(`/proc/${entry}/cmdline`, "utf8");
    } catch {
      continue;
    }
    if (cmdline.includes(profileDir)) totalKb += rssKb(entry);
  }
  return Math.round(totalKb / 102.4) / 10;
}

// Chrome's own memory attribution (page + worker), after the game; the worker is still alive.
async function uaMemory(page) {
  if (process.env.OPENMANA_SKIP_UA_MEMORY) return undefined;
  return page.evaluate(async () => {
    if (typeof performance.measureUserAgentSpecificMemory !== "function") return { unavailable: true };
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 30000));
    const measured = performance.measureUserAgentSpecificMemory().then((m) => ({
      bytes: m.bytes,
      breakdown: m.breakdown.filter((b) => b.bytes > 0).map((b) => ({ bytes: b.bytes, types: b.types, scope: b.attribution.map((a) => a.scope) })),
    }));
    return Promise.race([measured, timeout]);
  });
}

const report = { mode: negative ? "negative (no COOP/COEP)" : transcriptFile ? "replay" : "positive", seed, cardLoading, ok: false };
if (transcriptFile) {
  const transcript = JSON.parse(fs.readFileSync(transcriptFile, "utf8"));
  report.transcript = path.basename(transcriptFile);
  report.seed = transcript.request.seed;
  report.recordedInputs = transcript.inputs.length;
}
const server = await startServer({
  port: 0,
  isolation: !negative,
  files: transcriptFile ? { "/transcripts/replay.json": path.resolve(transcriptFile) } : {},
});
const query = transcriptFile ? `replay=transcripts/replay.json&cardLoading=${cardLoading}` : `seed=${seed}&cardLoading=${cardLoading}`;
const url = `http://127.0.0.1:${server.address().port}/?${query}`;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "openmana-chrome-"));
const executablePath = process.env.OPENMANA_CHROME || chromium.executablePath();
const context = await chromium.launchPersistentContext(profileDir, {
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--enable-precise-memory-info"],
});
report.browser = `${path.basename(path.dirname(executablePath))}/${path.basename(executablePath)} ${context.browser()?.version() ?? ""}`.trim();

let peakMiB = 0;
const sampler = setInterval(() => {
  peakMiB = Math.max(peakMiB, browserRssMiB(profileDir));
}, 200);
const consoleLines = [];

let failure = null;
try {
  const page = context.pages()[0] ?? (await context.newPage());
  page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));
  const idleMiB = browserRssMiB(profileDir);
  const startedAt = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__openmanaSpike && window.__openmanaSpike.done === true, null, { timeout: TEST_TIMEOUT_MS, polling: 250 });
  report.wallMs = Date.now() - startedAt;
  const state = await page.evaluate(() => {
    const s = window.__openmanaSpike;
    return { error: s.error, timings: s.timings, ready: s.ready, features: s.features, result: s.result, verdict: s.verdict, userAgent: navigator.userAgent };
  });
  report.userAgent = state.userAgent;
  report.features = state.features;
  report.timings = state.timings;
  report.boot = state.ready;
  report.idleBrowserRssMiB = idleMiB;

  if (transcriptFile) {
    // The page judged the replay (replay-driver.js); a failure is in state.error.
    const verdict = state.verdict;
    if (verdict) {
      report.inputsSent = verdict.inputsSent;
      report.engineStepMs = verdict.engineStepMs;
      report.counters = verdict.counters;
      report.failures = verdict.failures;
      report.result = verdict.result;
    }
    if (state.error) failure = state.error;
    else if (!verdict || !verdict.ok) failure = "the page finished without a positive verdict";
    else {
      report.matchesJvm = true;
      report.uaMemory = await uaMemory(page);
    }
  } else if (negative) {
    const quick = report.wallMs < 10000;
    const explained = typeof state.error === "string" && state.error.includes("Cross-Origin-Isolation");
    report.error = state.error;
    if (!explained) failure = `expected a visible cross-origin-isolation error, got: ${state.error}`;
    else if (!quick) failure = `error came too late (${report.wallMs} ms)`;
  } else if (state.error) {
    failure = state.error;
  } else {
    const result = state.result;
    report.result = { ...result, log: undefined, logLines: result.log.length };
    report.uaMemory = await uaMemory(page);
    if (result.forgeErrors.length > 0) failure = `Forge reported errors: ${result.forgeErrors.join(" | ")}`;
    else if (!(result.turns > 1) || (!result.draw && !result.winner)) failure = "game did not finish properly";
    else if (expectedSha && result.logSha256 !== expectedSha) failure = `game log differs from the JVM reference: ${result.logSha256} != ${expectedSha}`;
    else report.matchesJvm = expectedSha ? true : null;
  }
} catch (e) {
  failure = `browser test failed: ${e.stack || e}`;
} finally {
  clearInterval(sampler);
  report.peakBrowserRssMiB = peakMiB;
  await context.close();
  server.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
}

report.ok = !failure;
report.error = failure ?? report.error ?? null;
// Page and worker console (Forge's own output included), bounded.
report.console = consoleLines.slice(-200);
const text = JSON.stringify(report, null, 2);
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);
process.exit(failure ? 1 : 0);
