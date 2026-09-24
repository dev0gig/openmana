/*
 * The engine worker in Node (worker_threads), for engine tests and tools.
 * Runs engine/wasm/host/node-engine-worker.ts, the same worker host code as
 * the browser worker. Not part of the app bundle.
 */
import { Worker } from "node:worker_threads";
import type { EngineWorkerPortFactory } from "./worker-port.ts";

/** Default: the TypeScript source of the Node worker entry (Node >= 22.18 runs it directly). */
export const NODE_ENGINE_WORKER = new URL("../../wasm/host/node-engine-worker.ts", import.meta.url);

export function nodeWorkerPort(workerFile: string | URL = NODE_ENGINE_WORKER): EngineWorkerPortFactory {
  return (handlers) => {
    const worker = new Worker(workerFile);
    let terminated = false;
    worker.on("message", (data: unknown) => handlers.message(data));
    worker.on("messageerror", (error: Error) => handlers.error({ message: "a message of the engine worker could not be read", detail: String(error) }));
    worker.on("error", (error: Error) => handlers.error({ message: error.message || "error in the engine worker", detail: error.stack ?? String(error) }));
    worker.on("exit", (code: number) => {
      if (!terminated) {
        handlers.error({ message: `the engine worker exited unexpectedly (code ${code})` });
      }
    });
    return {
      post: (command) => worker.postMessage(command),
      terminate: () => {
        terminated = true;
        void worker.terminate();
      },
    };
  };
}
