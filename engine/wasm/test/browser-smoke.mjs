#!/usr/bin/env node
// Engine test in a real browser (Chrome for Testing via playwright-core):
// serves the diagnostics page with COOP/COEP; the page loads Forge through the
// EngineClient into a Dedicated Worker and runs one scenario; timings and
// memory are recorded.
//
//   node engine/wasm/test/browser-smoke.mjs --seed 42 [--card-loading lazy|eager]
//        [--expect-log-sha256 <hex>] [--expect-trace <jvm-trace.jsonl>] [--out result.json]
//   node engine/wasm/test/browser-smoke.mjs --transcript t.json [--feeding lazy|eager]
//        [--queue-capacity <bytes>] [--card-loading …] [--out result.json]
//   node engine/wasm/test/browser-smoke.mjs --cards [--card-loading …] [--expect jvm-probe.json] [--out result.json]
//   node engine/wasm/test/browser-smoke.mjs --negative [--out result.json]
//   node engine/wasm/test/browser-smoke.mjs --announce-protocol 999 [--out result.json]
//
// Default: Forge's AI plays against itself (diagnostics.ai-match); with
// --expect-trace its engine trace must equal the JVM's (JvmSmokeMain --trace)
// entry by entry.
// --transcript replays a JVM-recorded human-vs-AI game through the client and
// the SharedArrayBuffer input queue (engine/wasm/spike/replay.ts); passes only
// if the game ends exactly as on the JVM.
// --cards runs the card probe (diagnostics.card-probe); with --expect it must
// equal the JVM probe of the same card loading mode.
// --language en-US|de-DE (every mode): the language Forge speaks.
// --negative serves the page WITHOUT cross-origin isolation and passes only if
// the page reports the missing feature quickly instead of hanging.
// --announce-protocol: the page claims another protocol version; passes only if
// the worker refuses it at once with protocol-mismatch.
//
// Chrome: OPENMANA_CHROME=<path> or Playwright's own chromium build for
// playwright-core 1.63.0 (Chrome for Testing 153). Memory is the summed RSS of
// all processes of this browser instance, sampled every 200 ms.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { startServer } from "./serve.mjs";
import { probeDifferences, probeProblems } from "./card-probe-check.ts";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const negative = args.includes("--negative");
const announceProtocol = option("--announce-protocol", null);
const transcriptFile = option("--transcript", null);
const feeding = option("--feeding", "lazy");
const queueCapacity = option("--queue-capacity", feeding === "eager" ? "256" : null);
const seed = Number(option("--seed", "42"));
const cardLoading = option("--card-loading", "eager");
const language = option("--language", "en-US");
const cards = args.includes("--cards");
const expectFile = option("--expect", null);
const expectedSha = option("--expect-log-sha256", null);
const expectTrace = option("--expect-trace", null);
const outFile = option("--out", null);
const TEST_TIMEOUT_MS = negative || announceProtocol ? 30000 : transcriptFile || cards ? 840000 : 540000;

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

const mode = negative ? "negative (no COOP/COEP)" : announceProtocol ? "protocol mismatch" : transcriptFile ? `replay (${feeding})` : cards ? "card probe" : "positive";
const report = { mode, seed, cardLoading, language, ok: false };
if (transcriptFile) {
  const transcript = JSON.parse(fs.readFileSync(transcriptFile, "utf8"));
  report.transcript = path.basename(transcriptFile);
  report.seed = transcript.request.seed;
  report.recordedInputs = transcript.inputs.length;
}
const server = await startServer({
  port: 0,
  isolation: !negative,
  files: {
    ...(transcriptFile ? { "/transcripts/replay.json": path.resolve(transcriptFile) } : {}),
    ...(expectTrace ? { "/traces/expected.jsonl": path.resolve(expectTrace) } : {}),
  },
});
const query = announceProtocol
  ? `announceProtocol=${announceProtocol}`
  : transcriptFile
    ? `replay=transcripts/replay.json&cardLoading=${cardLoading}&language=${language}&feeding=${feeding}${queueCapacity ? `&queueCapacity=${queueCapacity}` : ""}`
    : cards
      ? `cards=1&cardLoading=${cardLoading}&language=${language}`
      : `seed=${seed}&cardLoading=${cardLoading}&language=${language}${expectTrace ? "&trace=traces/expected.jsonl" : ""}`;
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
    return { error: s.error, timings: s.timings, ready: s.ready, features: s.features, result: s.result, verdict: s.verdict, abort: s.abort, trace: s.trace, userAgent: navigator.userAgent };
  });
  report.userAgent = state.userAgent;
  report.features = state.features;
  report.timings = state.timings;
  report.boot = state.ready;
  report.idleBrowserRssMiB = idleMiB;

  if (announceProtocol) {
    const abort = state.abort;
    report.abort = abort;
    if (!abort || abort.reason !== "protocol-mismatch" || abort.origin !== "engine") failure = `expected protocol-mismatch from the worker, got: ${JSON.stringify(abort ?? state.error)}`;
    else if (report.wallMs > 10000) failure = `refusal came too late (${report.wallMs} ms)`;
    else if (state.timings["launcher-load"] !== undefined) failure = "the worker started loading the engine before refusing";
  } else if (transcriptFile) {
    // The page judged the replay (replay.ts); a failure is in state.error.
    const verdict = state.verdict;
    if (verdict) {
      report.feeding = verdict.feeding;
      report.inputsSent = verdict.inputsSent;
      report.engineStepMs = verdict.engineStepMs;
      report.queue = verdict.queue;
      report.validation = verdict.validation;
      report.trace = verdict.trace;
      report.counters = verdict.counters;
      report.failures = verdict.failures;
      report.result = verdict.summary;
    }
    if (state.error) failure = state.error;
    else if (!verdict || !verdict.ok) failure = "the page finished without a positive verdict";
    else {
      report.matchesJvm = true;
      report.uaMemory = await uaMemory(page);
    }
  } else if (cards) {
    const probe = state.result;
    if (state.error) failure = state.error;
    else if (!probe) failure = "the page finished without a card probe result";
    else {
      const problems = probeProblems(probe);
      if (probe.language.selected !== language) problems.push(`the engine speaks ${probe.language.selected}, requested was ${language}`);
      if (expectFile) {
        const jvm = JSON.parse(fs.readFileSync(expectFile, "utf8")).result;
        const differences = probeDifferences(jvm, probe);
        if (probe.fingerprint !== jvm.fingerprint) differences.unshift(`fingerprint ${probe.fingerprint} != JVM ${jvm.fingerprint}`);
        problems.push(...differences);
        report.matchesJvm = differences.length === 0;
      }
      report.result = probe;
      report.uaMemory = await uaMemory(page);
      if (problems.length > 0) failure = problems.join("\n");
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
    report.result = { ...result, log: undefined, logLines: (result.log ?? []).length };
    report.trace = state.trace ?? null;
    report.uaMemory = await uaMemory(page);
    if (result.forgeErrors.length > 0) failure = `Forge reported errors: ${result.forgeErrors.join(" | ")}`;
    else if (!(result.turns > 1) || (!result.draw && !result.winner)) failure = "game did not finish properly";
    else if (expectedSha && result.logSha256 !== expectedSha) failure = `game log differs from the JVM reference: ${result.logSha256} != ${expectedSha}`;
    else if (expectTrace && (!state.trace || state.trace.divergence)) failure = `engine trace differs from the JVM reference: ${state.trace?.divergence ?? "no trace verdict"}`;
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
