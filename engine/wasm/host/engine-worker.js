/*
 * OpenMana engine: browser Dedicated Worker hosting Forge (GraalVM Web Image).
 * Forge runs synchronously inside this worker; the page never blocks.
 * Protocol: see worker-core.js.
 */
importScripts("feature-detect.js", "input-channel.js", "worker-core.js");

const onEngineMessage = globalThis.OpenManaWorkerCore.attach({
  post: (message) => postMessage(message),
  loadScript: (url) => importScripts(url),
  now: () => performance.now(),
});

self.onmessage = (event) => onEngineMessage(event.data);

// Anything that escapes must reach the page, never vanish in the worker.
self.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  postMessage({
    type: "fatal",
    payload: { ok: false, stage: "unhandledrejection", error: String((reason && reason.message) || reason), stack: (reason && reason.stack) || null },
    t: performance.now(),
  });
});
