/*
 * Engine spike page logic. Everything that happens is appended to the log and
 * mirrored into window.__openmanaSpike for the automated browser test.
 * Every failure ends in a visible message; the watchdogs make sure the page
 * never just waits forever.
 */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const seed = Number(params.get("seed") || 42);
  const cardLoading = params.get("cardLoading") || "lazy";
  const auto = params.get("auto") !== "0";
  const READY_TIMEOUT_MS = 180000;
  const GAME_TIMEOUT_MS = 300000;

  const statusEl = document.getElementById("status");
  const logEl = document.getElementById("log");
  const runButton = document.getElementById("run");
  const origin = performance.now();

  const state = {
    seed,
    cardLoading,
    features: null,
    events: [],
    ready: null,
    result: null,
    error: null,
    done: false,
    timings: {},
  };
  window.__openmanaSpike = state;

  const elapsed = () => Math.round(performance.now() - origin);

  function log(line) {
    logEl.textContent += "[" + String(elapsed()).padStart(6) + " ms] " + line + "\n";
  }

  function fail(message) {
    if (state.done) {
      return;
    }
    state.error = message;
    state.done = true;
    statusEl.textContent = "FEHLER: " + message;
    log("FEHLER: " + message);
  }

  function succeed(result) {
    state.result = result;
    state.done = true;
    statusEl.textContent = "Partie beendet: " + (result.draw ? "Unentschieden" : result.winner + " gewinnt") + " nach " + result.turns + " Zügen.";
  }

  state.features = window.OpenManaFeatures.detect({ requireIsolation: true });
  log("Browser: " + navigator.userAgent);
  log("crossOriginIsolated=" + state.features.crossOriginIsolated + ", SharedArrayBuffer=" + state.features.sharedArrayBuffer +
      ", Wasm GC=" + state.features.wasmGc + ", exnref=" + state.features.wasmExnref +
      ", typed function refs=" + state.features.wasmTypedFunctionReferences);
  if (!state.features.supported) {
    fail(window.OpenManaFeatures.describeMissing(state.features));
    return;
  }

  function start() {
    runButton.disabled = true;
    statusEl.textContent = "Engine startet …";
    const worker = new Worker("host/engine-worker.js");
    let readyWatchdog = setTimeout(() => fail("Die Engine hat sich nach " + READY_TIMEOUT_MS / 1000 + " s nicht bereit gemeldet."), READY_TIMEOUT_MS);
    let gameWatchdog = null;

    worker.onerror = (event) => fail("Fehler im Worker: " + (event.message || "unbekannt"));
    worker.onmessageerror = () => fail("Eine Nachricht des Workers war nicht lesbar.");
    worker.onmessage = (event) => {
      const message = event.data;
      state.events.push({ type: message.type, payload: message.payload, pageMs: elapsed(), workerMs: message.t });
      if (message.type === "boot") {
        state.timings[message.payload.phase] = elapsed();
        log("boot: " + message.payload.phase);
      } else if (message.type === "ready") {
        clearTimeout(readyWatchdog);
        state.timings.ready = elapsed();
        state.ready = message.payload;
        log("bereit: " + JSON.stringify(message.payload));
        statusEl.textContent = "Forge bereit, KI-Partie läuft (Seed " + seed + ") …";
        gameWatchdog = setTimeout(() => fail("Die Partie hat nach " + GAME_TIMEOUT_MS / 1000 + " s kein Ergebnis geliefert."), GAME_TIMEOUT_MS);
        state.timings.gameRequested = elapsed();
        worker.postMessage({ type: "request", id: 1, request: { command: "smoke-match", seed, includeLog: true } });
      } else if (message.type === "fatal") {
        clearTimeout(readyWatchdog);
        clearTimeout(gameWatchdog);
        fail("Engine-Fehler (" + message.payload.stage + "): " + message.payload.error + (message.payload.stack ? "\n" + message.payload.stack : ""));
      } else if (message.type === "response") {
        clearTimeout(gameWatchdog);
        state.timings.gameAnswered = elapsed();
        state.timings.requestMs = message.ms;
        if (!message.response.ok) {
          fail("Partie fehlgeschlagen: " + message.response.error + (message.response.stack ? "\n" + message.response.stack : ""));
          return;
        }
        const result = message.response.result;
        log("Ergebnis: " + JSON.stringify(Object.assign({}, result, { log: "(" + result.log.length + " Einträge)" })));
        log("Spielverlauf (Forge GameLog):\n  " + result.log.join("\n  "));
        succeed(result);
      }
    };

    worker.postMessage({
      type: "start",
      engineUrl: new URL("engine/openmana-engine.js", location.href).href,
      wasmUrl: new URL("engine/openmana-engine.js.wasm", location.href).href,
      args: ["--card-loading=" + cardLoading],
      requireIsolation: true,
    });
    state.timings.workerStarted = elapsed();
  }

  runButton.addEventListener("click", start);
  runButton.disabled = false;
  statusEl.textContent = "Bereit.";
  if (auto) {
    start();
  }
})();
