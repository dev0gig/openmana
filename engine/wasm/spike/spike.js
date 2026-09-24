/*
 * Engine spike page logic. Everything that happens is appended to the log and
 * mirrored into window.__openmanaSpike for the automated browser tests.
 * Every failure ends in a visible message; the watchdogs make sure the page
 * never just waits forever.
 *
 * Two modes:
 *   AI game (prompt 01)      ?seed=42&cardLoading=lazy|eager
 *   replay (prompt 02)       ?replay=<transcript URL>&cardLoading=…
 *     plays a JVM-recorded human-vs-AI game again in the Wasm engine: the page
 *     writes the recorded inputs into the SharedArrayBuffer channel whenever
 *     the worker waits (replay-driver.js), Forge plays the game.
 */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const seed = Number(params.get("seed") || 42);
  const cardLoading = params.get("cardLoading") || "lazy";
  const replayUrl = params.get("replay");
  const auto = params.get("auto") !== "0";
  const READY_TIMEOUT_MS = 180000;
  const GAME_TIMEOUT_MS = replayUrl ? 600000 : 300000;

  const statusEl = document.getElementById("status");
  const logEl = document.getElementById("log");
  const runButton = document.getElementById("run");
  const origin = performance.now();

  const state = {
    mode: replayUrl ? "replay" : "ai",
    seed,
    cardLoading,
    features: null,
    events: [],
    ready: null,
    result: null,
    verdict: null,
    error: null,
    done: false,
    timings: {},
  };
  window.__openmanaSpike = state;

  const elapsed = () => Math.round(performance.now() - origin);

  // Text nodes instead of textContent +=: a replayed game logs thousands of lines.
  function log(line) {
    logEl.appendChild(document.createTextNode("[" + String(elapsed()).padStart(6) + " ms] " + line + "\n"));
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

  function succeed(result, text) {
    state.result = result;
    state.done = true;
    statusEl.textContent = text;
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

  /**
   * Starts the worker and hands every message to `on`. Returns the worker.
   * `inputBuffer` is the SharedArrayBuffer of the input channel (replay only).
   */
  function startWorker(inputBuffer, on) {
    const worker = new Worker("host/engine-worker.js");
    const readyWatchdog = setTimeout(() => fail("Die Engine hat sich nach " + READY_TIMEOUT_MS / 1000 + " s nicht bereit gemeldet."), READY_TIMEOUT_MS);
    let gameWatchdog = null;
    const stop = () => {
      clearTimeout(readyWatchdog);
      clearTimeout(gameWatchdog);
      worker.terminate();
    };

    worker.onerror = (event) => {
      stop();
      fail("Fehler im Worker: " + (event.message || "unbekannt"));
    };
    worker.onmessageerror = () => {
      stop();
      fail("Eine Nachricht des Workers war nicht lesbar.");
    };
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type !== "protocol" && message.type !== "input.wait") {
        state.events.push({ type: message.type, payload: message.payload, pageMs: elapsed(), workerMs: message.t });
      }
      if (message.type === "boot") {
        state.timings[message.payload.phase] = elapsed();
        log("boot: " + message.payload.phase);
      } else if (message.type === "ready") {
        clearTimeout(readyWatchdog);
        state.timings.ready = elapsed();
        state.ready = message.payload;
        log("bereit: " + JSON.stringify(message.payload));
        gameWatchdog = setTimeout(() => {
          stop();
          fail("Die Partie hat nach " + GAME_TIMEOUT_MS / 1000 + " s kein Ergebnis geliefert.");
        }, GAME_TIMEOUT_MS);
        state.timings.gameRequested = elapsed();
        on.ready(worker);
      } else if (message.type === "fatal") {
        stop();
        fail("Engine-Fehler (" + message.payload.stage + "): " + message.payload.error + (message.payload.stack ? "\n" + message.payload.stack : ""));
      } else if (message.type === "response") {
        clearTimeout(gameWatchdog);
        state.timings.gameAnswered = elapsed();
        state.timings.requestMs = message.ms;
        // The worker stays alive: the browser test measures its memory afterwards.
        on.response(message.response);
      } else if (on.other) {
        on.other(message, stop);
      }
    };

    const start = {
      type: "start",
      engineUrl: new URL("engine/openmana-engine.js", location.href).href,
      wasmUrl: new URL("engine/openmana-engine.js.wasm", location.href).href,
      args: ["--card-loading=" + cardLoading],
      requireIsolation: true,
    };
    if (inputBuffer) {
      start.inputBuffer = inputBuffer;
    }
    worker.postMessage(start);
    state.timings.workerStarted = elapsed();
    return worker;
  }

  function startAiGame() {
    statusEl.textContent = "Engine startet …";
    startWorker(null, {
      ready(worker) {
        statusEl.textContent = "Forge bereit, KI-Partie läuft (Seed " + seed + ") …";
        worker.postMessage({ type: "request", id: 1, request: { command: "smoke-match", seed, includeLog: true } });
      },
      response(response) {
        if (!response.ok) {
          fail("Partie fehlgeschlagen: " + response.error + (response.stack ? "\n" + response.stack : ""));
          return;
        }
        const result = response.result;
        log("Ergebnis: " + JSON.stringify(Object.assign({}, result, { log: "(" + result.log.length + " Einträge)" })));
        log("Spielverlauf (Forge GameLog):\n  " + result.log.join("\n  "));
        succeed(result, "Partie beendet: " + (result.draw ? "Unentschieden" : result.winner + " gewinnt") + " nach " + result.turns + " Zügen.");
      },
    });
  }

  function startReplay(transcript) {
    const channel = window.OpenManaInputChannel.create();
    const replay = window.OpenManaReplay.start(transcript, channel);
    state.seed = transcript.request.seed;
    state.recordedInputs = transcript.inputs.length;
    const steps = [];
    let lastInputAt = null;
    statusEl.textContent = "Engine startet …";
    startWorker(channel.buffer, {
      ready(worker) {
        statusEl.textContent = "Forge bereit, aufgezeichnete Partie läuft (Seed " + transcript.request.seed + ", " + transcript.inputs.length + " Eingaben) …";
        worker.postMessage({ type: "request", id: 1, request: replay.request });
      },
      other(message, stop) {
        if (message.type === "protocol") {
          replay.protocol(message.payload);
          const m = message.payload;
          if (m.type === "question") {
            log("Frage #" + m.id + " (" + m.kind + (m.purpose ? ", " + m.purpose : "") + "): " + (m.message || ""));
          } else if (m.type === "input.rejected") {
            log("abgelehnt (" + m.reason + "): " + JSON.stringify(m.input));
          } else if (m.type === "events") {
            for (const e of m.entries) log("  " + e.text);
          }
        } else if (message.type === "input.wait") {
          if (lastInputAt !== null) steps.push(performance.now() - lastInputAt);
          if (!replay.inputWait(message.n)) {
            stop();
            fail(replay.problem());
            return;
          }
          lastInputAt = performance.now();
        }
      },
      response(response) {
        const verdict = replay.judge(response);
        const sorted = steps.sort((a, b) => a - b);
        const pick = (p) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]) : null);
        verdict.engineStepMs = { count: sorted.length, p50: pick(0.5), p95: pick(0.95), max: pick(1) };
        state.verdict = verdict;
        if (!verdict.ok) {
          fail("Wiederholung weicht von der JVM ab:\n" + verdict.failures.join("\n"));
          return;
        }
        const r = verdict.result;
        log("Ergebnis: " + JSON.stringify(r));
        succeed(r, "Aufgezeichnete Partie identisch wiederholt: " + r.result + " nach " + r.turns + " Zügen, " + verdict.inputsSent + " Eingaben.");
      },
    });
  }

  function start() {
    runButton.disabled = true;
    if (!replayUrl) {
      startAiGame();
      return;
    }
    statusEl.textContent = "Lade Aufzeichnung …";
    fetch(replayUrl)
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status + " für " + replayUrl);
        return response.json();
      })
      .then(startReplay)
      .catch((e) => fail("Aufzeichnung nicht nutzbar: " + (e.message || e)));
  }

  runButton.addEventListener("click", start);
  runButton.disabled = false;
  statusEl.textContent = "Bereit.";
  if (auto) {
    start();
  }
})();
