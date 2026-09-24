/*
 * OpenMana engine: the same worker host as engine-worker.js, for Node's
 * worker_threads. Used by the Wasm smoke tests (engine/wasm/test/), so the
 * engine is exercised without a browser too. Protocol: see worker-core.js.
 */
"use strict";

const { parentPort } = require("node:worker_threads");
const path = require("node:path");

require("./feature-detect.js");
require("./input-channel.js");
require("./worker-core.js");

const onEngineMessage = globalThis.OpenManaWorkerCore.attach({
  post: (message) => parentPort.postMessage(message),
  loadScript: (file) => require(path.resolve(file)),
  now: () => performance.now(),
});

parentPort.on("message", onEngineMessage);

process.on("unhandledRejection", (reason) => {
  parentPort.postMessage({
    type: "fatal",
    payload: { ok: false, stage: "unhandledRejection", error: String((reason && reason.message) || reason), stack: (reason && reason.stack) || null },
    t: performance.now(),
  });
});
