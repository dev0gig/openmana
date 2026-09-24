/*
 * OpenMana engine: the same worker host as engine-worker.ts, for Node's
 * worker_threads (engine tests run the Wasm engine without a browser too).
 * Node >= 22.18 runs this TypeScript file directly. Protocol: engine/protocol.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { parentPort } from "node:worker_threads";
import { attachWorkerHost } from "./worker-host.ts";

const port = parentPort;
if (!port) {
  throw new Error("node-engine-worker.ts must run as a worker thread");
}
const onCommand = attachWorkerHost({
  post: (message) => port.postMessage(message),
  // The launcher is a classic script, loaded like importScripts does in the
  // browser: run in the worker's global scope. It recognises Node by a global
  // `require` (it reads the .wasm file with fs), so one is provided.
  loadScript: (file) => {
    const absolute = path.resolve(file);
    (globalThis as { require?: NodeJS.Require }).require = createRequire(absolute);
    vm.runInThisContext(fs.readFileSync(absolute, "utf8"), { filename: absolute });
  },
  now: () => performance.now(),
});

port.on("message", onCommand);

process.on("unhandledRejection", (reason: unknown) => {
  const error = reason as { message?: string; stack?: string } | undefined;
  port.postMessage({
    type: "engine.abort",
    reason: "worker-error",
    origin: "engine",
    message: String(error?.message ?? reason),
    stage: "unhandledRejection",
    ...(error?.stack ? { detail: error.stack } : {}),
  });
});
