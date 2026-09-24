/*
 * OpenMana engine: the browser's Dedicated Worker hosting Forge (GraalVM Web
 * Image). Bundled by engine/scripts/bundle-host.mjs into a classic worker
 * script (engine-worker.js next to the engine artefacts): the launcher is
 * loaded with importScripts. Forge runs synchronously in here; the page never
 * blocks. Protocol: engine/protocol; logic: worker-host.ts.
 */
import { attachWorkerHost } from "./worker-host.ts";

interface DedicatedWorkerScope {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  addEventListener(type: "unhandledrejection", listener: (event: PromiseRejectionEvent) => void): void;
}

declare function importScripts(...urls: string[]): void;

const scope = globalThis as unknown as DedicatedWorkerScope;

const onCommand = attachWorkerHost({
  post: (message) => scope.postMessage(message),
  loadScript: (url) => importScripts(url),
  now: () => performance.now(),
});

scope.onmessage = (event) => onCommand(event.data);

// Anything that escapes must reach the page, never vanish in the worker.
scope.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as { message?: string; stack?: string } | undefined;
  scope.postMessage({
    type: "engine.abort",
    reason: "worker-error",
    origin: "engine",
    message: String(reason?.message ?? reason),
    stage: "unhandledrejection",
    ...(reason?.stack ? { detail: reason.stack } : {}),
  });
});
