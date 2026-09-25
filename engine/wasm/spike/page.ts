/*
 * Diagnostics page of the engine (not OpenMana's UI): loads Forge through the
 * real EngineClient into a Dedicated Worker and runs one scenario. Everything
 * that happens is appended to the log and mirrored into window.__openmanaSpike
 * for engine/wasm/test/browser-smoke.mjs. Bundled by
 * engine/scripts/bundle-host.mjs into build/harness/spike.js.
 *
 *   ?seed=42&cardLoading=eager|lazy          Forge's AI plays itself (diagnostics.ai-match)
 *   &trace=<JVM trace URL>                   … and its engine trace must equal the JVM's (prompt 05)
 *   ?replay=<transcript URL>&feeding=lazy|eager&queueCapacity=256
 *                                            a JVM-recorded human-vs-AI game (replay.ts)
 *   ?cards=1&cardLoading=eager|lazy          Forge's card scripts are checked (diagnostics.card-probe)
 *   &language=en-US|de-DE                    the language Forge speaks (every mode)
 *   &cardLanguage=en-US|de-DE                the language of the cards in Forge's texts (default: language)
 *   ?announceProtocol=999                    the page claims another protocol version:
 *                                            the worker must refuse it at once
 *
 * Every failure ends in a visible message; the client's watchdogs make sure
 * the page never waits forever.
 */
import { browserWorkerPort, EngineClient, type EngineClientEvent } from "../../client/src/index.ts";
import { describeMissingFeatures, detectEngineFeatures, type EngineMessage } from "../../protocol/src/index.ts";
import { replay, type Feeding, type ReplayVerdict, type TraceVerdict, type Transcript } from "./replay.ts";
import { describeDivergence, parseTraceLines, TraceComparison, traceDigest, type TraceEntry } from "./trace.ts";

interface SpikeState {
  mode: "ai" | "replay" | "cards" | "mismatch";
  done: boolean;
  error: string | null;
  features: unknown;
  timings: Record<string, number>;
  ready: unknown;
  result: unknown;
  verdict: (ReplayVerdict & { engineStepMs: ReplayVerdict["engineStepMs"] }) | null;
  abort: unknown;
  /** AI game with an expected engine trace: how it compared (replays carry it in verdict.trace). */
  trace: TraceVerdict | null;
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 42);
const cardLoading = params.get("cardLoading") ?? "eager";
const language = params.get("language") ?? "en-US";
const cardLanguage = params.get("cardLanguage");
const replayUrl = params.get("replay");
const feeding = (params.get("feeding") ?? "lazy") as Feeding;
const queueCapacity = params.get("queueCapacity") ? Number(params.get("queueCapacity")) : undefined;
const announceProtocol = params.get("announceProtocol") ? Number(params.get("announceProtocol")) : undefined;
const traceUrl = params.get("trace");
let traceComparison: TraceComparison | null = null;
let traceReference = 0;
let traceDiverged = false;
const traceEntries: TraceEntry[] = [];

const statusEl = document.getElementById("status")!;
const logEl = document.getElementById("log")!;
const origin = performance.now();
const elapsed = () => Math.round(performance.now() - origin);

const state: SpikeState = {
  mode: announceProtocol !== undefined ? "mismatch" : replayUrl ? "replay" : params.get("cards") ? "cards" : "ai",
  done: false,
  error: null,
  features: null,
  timings: {},
  ready: null,
  result: null,
  verdict: null,
  abort: null,
  trace: null,
};
(window as unknown as { __openmanaSpike: SpikeState }).__openmanaSpike = state;

// Text nodes instead of textContent +=: a replayed game logs thousands of lines.
function log(line: string): void {
  logEl.appendChild(document.createTextNode(`[${String(elapsed()).padStart(6)} ms] ${line}\n`));
}

function fail(message: string): void {
  if (state.done) return;
  state.error = message;
  state.done = true;
  statusEl.textContent = `FEHLER: ${message}`;
  log(`FEHLER: ${message}`);
}

function succeed(text: string): void {
  state.done = true;
  statusEl.textContent = text;
  log(text);
}

const features = detectEngineFeatures({ requireIsolation: true });
state.features = features;
log(`Browser: ${navigator.userAgent}`);
log(`crossOriginIsolated=${features.crossOriginIsolated}, SharedArrayBuffer=${features.sharedArrayBuffer}, Wasm GC=${features.wasmGc}, exnref=${features.wasmExnref}, typed function refs=${features.wasmTypedFunctionReferences}`);

const client = new EngineClient({
  createPort: browserWorkerPort(new URL("engine/engine-worker.js", location.href)),
  engineScriptUrl: new URL("engine/openmana-engine.js", location.href).href,
  wasmUrl: new URL("engine/openmana-engine.js.wasm", location.href).href,
  engineArgs: [`--card-loading=${cardLoading}`, `--language=${language}`, ...(cardLanguage ? [`--card-language=${cardLanguage}`] : [])],
  // The card probe's whole-database pass keeps the engine busy without messages.
  ...(state.mode === "cards" ? { stallTimeoutMs: 600_000 } : {}),
  ...(queueCapacity ? { queueCapacity } : {}),
  ...(announceProtocol !== undefined ? { announceProtocol } : {}),
});

client.subscribe((event: EngineClientEvent) => {
  if (event.kind === "status") {
    state.timings[event.status] = elapsed();
    return;
  }
  if (event.kind === "stalled") {
    log(`Engine reagiert seit ${Math.round(event.silentMs / 1000)} s nicht.`);
    return;
  }
  if (event.kind !== "message") return;
  const m: EngineMessage = event.message;
  switch (m.type) {
    case "engine.boot":
      state.timings[m.phase] = elapsed();
      log(`boot: ${m.phase}`);
      break;
    case "engine.ready":
      state.timings["ready"] = elapsed();
      state.ready = { protocol: m.protocol, engine: m.engine, boot: m.boot, workerMs: m.t };
      log(`bereit: Protokoll ${m.protocol}, Forge ${m.engine.forgeCommit.slice(0, 10)}, ${m.engine.patchCount} Patches, Start ${Math.round(m.t)} ms`);
      if (state.mode === "ai") {
        statusEl.textContent = `Forge bereit, KI-Partie läuft (Seed ${seed}) …`;
        client.runAiDiagnostics(seed, true, traceComparison !== null);
      } else if (state.mode === "cards") {
        statusEl.textContent = "Forge bereit, Kartenprüfung läuft (alle Karten) …";
        client.runCardProbe();
      }
      break;
    case "question":
      log(`Frage #${m.id} (${m.kind}${m.kind === "buttons" && m.purpose ? `, ${m.purpose}` : ""}${m.blocking ? ", blockierend" : ""}): ${m.text}`);
      break;
    case "input.rejected":
      log(`abgelehnt (${m.reason}): Eingabe ${m.seq} ${JSON.stringify(m.input)}`);
      break;
    case "events":
      for (const e of m.entries) log(`  ${e.text ?? ""}`);
      break;
    case "diagnostics.trace": {
      traceEntries.push(m);
      const d = traceComparison?.add(m) ?? null;
      if (d && !traceDiverged) {
        traceDiverged = true;
        fail(describeDivergence(d));
        client.abort("the engine trace diverged from the JVM game");
      }
      break;
    }
    case "diagnostics.result": {
      state.timings["gameAnswered"] = elapsed();
      state.result = m.result;
      log(`Spielverlauf (Forge GameLog):\n  ${(m.result.log ?? []).join("\n  ")}`);
      const missing = traceComparison ? traceComparison.finish() : null;
      const comparison = traceComparison;
      const done = () => {
        if (missing) fail(describeDivergence(missing));
        else succeed(`Partie beendet: ${m.result.draw ? "Unentschieden" : `${m.result.winner} gewinnt`} nach ${m.result.turns} Zügen.`);
      };
      if (!comparison) {
        done();
        break;
      }
      // The page is done only once the trace verdict is there.
      void traceDigest(traceEntries).then((sha256) => {
        state.trace = { reference: traceReference, compared: comparison.compared, sha256, divergence: missing ? describeDivergence(missing) : null };
        done();
      });
      break;
    }
    case "diagnostics.cards": {
      state.timings["cardsAnswered"] = elapsed();
      state.result = m.result;
      const cards = m.result.database.cards;
      log(`Kartenprüfung: ${cards.instantiated} von ${cards.unique} Karten als Spielkarten, Fingerabdruck ${m.result.fingerprint.slice(0, 12)}, Fehler: ${m.result.failures.length}`);
      succeed(`Kartenprüfung fertig (${m.result.failures.length === 0 ? "ohne Befund" : `${m.result.failures.length} Befunde`}).`);
      break;
    }
    case "engine.abort":
      state.abort = m;
      fail(`Technischer Abbruch (${m.reason}, ${m.origin}): ${m.message}${m.detail ? `\n${m.detail}` : ""}`);
      break;
    default:
      break;
  }
});

async function main(): Promise<void> {
  if (!features.supported && state.mode !== "mismatch") {
    // The client refuses too (engine.abort unsupported-browser); say it right away.
    fail(describeMissingFeatures(features));
    return;
  }
  if (state.mode === "replay") {
    const response = await fetch(replayUrl!);
    if (!response.ok) {
      fail(`Aufzeichnung nicht ladbar: ${response.status}`);
      return;
    }
    const transcript = (await response.json()) as Transcript;
    statusEl.textContent = `Engine startet, danach aufgezeichnete Partie (Seed ${transcript.request.seed}, ${transcript.inputs.length} Eingaben, ${feeding}) …`;
    const run = replay(client, transcript, feeding, () => performance.now());
    client.start();
    const verdict = await run;
    state.verdict = verdict;
    state.result = verdict.summary;
    state.timings["gameAnswered"] = elapsed();
    if (verdict.ok) {
      succeed(`Aufgezeichnete Partie gleich wie auf der JVM beendet: ${verdict.summary?.result} nach ${verdict.summary?.turns} Zügen, ${verdict.inputsSent} Eingaben.`);
    } else {
      fail(verdict.failures.join("\n"));
    }
    return;
  }
  if (state.mode === "ai" && traceUrl) {
    const response = await fetch(traceUrl);
    if (!response.ok) {
      fail(`JVM-Spur nicht ladbar: ${response.status}`);
      return;
    }
    const reference = parseTraceLines(await response.text());
    traceReference = reference.length;
    traceComparison = new TraceComparison(reference);
  }
  statusEl.textContent = "Engine startet …";
  client.start();
}

void main().catch((e: unknown) => fail(`Seitenfehler: ${e instanceof Error ? e.stack : String(e)}`));
