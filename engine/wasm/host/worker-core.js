/*
 * OpenMana engine: worker side of the engine spike, shared by the browser
 * Dedicated Worker (engine-worker.js) and the Node worker used in tests
 * (node-engine-worker.cjs).
 *
 * This is the minimal spike transport (prompt 01). The real, versioned
 * UI<->engine protocol with SharedArrayBuffer input queue follows in prompt 03.
 *
 * Messages to the worker:
 *   { type: "start", engineUrl, wasmUrl, args, requireIsolation }
 *   { type: "request", id, request }            request is passed to the engine
 * Messages from the worker (t = worker clock in ms):
 *   { type: "boot",  payload: { phase, … }, t }  progress of the start
 *   { type: "ready", payload: boot report, t }   Forge is initialised
 *   { type: "fatal", payload: { stage, error, stack }, t }
 *   { type: "response", id, response, t, ms }
 *
 * Plain script: loaded with importScripts() or require(). Needs
 * feature-detect.js first. Exposes globalThis.OpenManaWorkerCore.
 */
(function () {
  "use strict";

  function errorPayload(stage, error) {
    return {
      ok: false,
      stage,
      error: String((error && error.message) || error),
      stack: (error && error.stack) || null,
    };
  }

  /**
   * @param env { post(message), loadScript(urlOrPath), now() }
   * @returns the handler for incoming messages
   */
  function attach(env) {
    let engine = null;
    let started = false;
    let failed = false;

    const fatal = (stage, error) => {
      failed = true;
      env.post({ type: "fatal", payload: errorPayload(stage, error), t: env.now() });
    };

    // Called from Java (WasmMain) through @JS snippets.
    globalThis.__openmanaHost = {
      emit(kind, json) {
        let payload;
        try {
          payload = JSON.parse(json);
        } catch (e) {
          payload = { unparsed: String(json) };
        }
        if (kind === "fatal") {
          failed = true;
        }
        env.post({ type: kind, payload, t: env.now() });
      },
      registerEngine(handler) {
        engine = handler;
      },
    };

    function start(message) {
      if (started) {
        fatal("start", new Error("the engine was already started in this worker; use a fresh worker per game"));
        return;
      }
      started = true;
      const features = globalThis.OpenManaFeatures.detect({ requireIsolation: message.requireIsolation !== false });
      env.post({ type: "boot", payload: { phase: "worker-features", features }, t: env.now() });
      if (!features.supported) {
        fatal("features", new Error(globalThis.OpenManaFeatures.describeMissing(features)));
        return;
      }

      globalThis.__openmanaEngineConfig = { wasmUrl: message.wasmUrl, args: message.args || [] };
      env.post({ type: "boot", payload: { phase: "launcher-load" }, t: env.now() });
      try {
        env.loadScript(message.engineUrl);
      } catch (e) {
        fatal("launcher", e);
        return;
      }
      const running = globalThis.__openmanaEngineConfig.running;
      if (!running || typeof running.then !== "function") {
        fatal("launcher", new Error("the launcher did not expose __openmanaEngineConfig.running; is it post-processed?"));
        return;
      }
      env.post({ type: "boot", payload: { phase: "wasm-fetch-compile" }, t: env.now() });
      running.then(
        () => {
          // Java's main() has returned: it either registered the engine and
          // sent "ready", or reported "fatal" itself.
          if (!engine && !failed) {
            fatal("main", new Error("engine main() returned without registering a handler"));
          }
        },
        (e) => fatal("instantiate", e),
      );
    }

    function request(message) {
      if (!engine) {
        env.post({ type: "response", id: message.id, response: errorPayload("request", new Error("engine is not ready")), t: env.now() });
        return;
      }
      const t0 = env.now();
      let response;
      try {
        response = JSON.parse(String(engine(JSON.stringify(message.request))));
      } catch (e) {
        response = errorPayload("request", e);
      }
      const t1 = env.now();
      env.post({ type: "response", id: message.id, response, t: t1, ms: t1 - t0 });
    }

    return function onMessage(message) {
      if (!message || typeof message.type !== "string") {
        fatal("protocol", new Error("message without type"));
      } else if (message.type === "start") {
        start(message);
      } else if (message.type === "request") {
        request(message);
      } else {
        fatal("protocol", new Error("unknown message type " + message.type));
      }
    };
  }

  globalThis.OpenManaWorkerCore = { attach };
})();
