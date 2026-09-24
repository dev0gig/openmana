/*
 * How the client talks to "a worker": the browser's Dedicated Worker in the
 * app, Node's worker_threads in tests (node-worker-port.ts). The client only
 * needs to post commands, receive messages and errors, and terminate.
 */
import type { WorkerCommand } from "../../protocol/src/index.ts";

/** A problem of the worker itself (script error, unreadable message, unexpected exit). */
export interface WorkerProblem {
  readonly message: string;
  readonly detail?: string;
}

export interface EngineWorkerPortHandlers {
  message(data: unknown): void;
  error(problem: WorkerProblem): void;
}

export interface EngineWorkerPort {
  post(command: WorkerCommand): void;
  terminate(): void;
}

/** Creates the worker and wires it to the handlers. */
export type EngineWorkerPortFactory = (handlers: EngineWorkerPortHandlers) => EngineWorkerPort;

/**
 * The engine worker in a browser: a classic Dedicated Worker (the GraalVM
 * launcher is loaded with importScripts). `workerUrl` points to the bundled
 * engine-worker.js next to the engine artefacts.
 */
export function browserWorkerPort(workerUrl: string | URL): EngineWorkerPortFactory {
  return (handlers) => {
    const worker = new Worker(workerUrl);
    worker.onmessage = (event: MessageEvent<unknown>) => handlers.message(event.data);
    worker.onmessageerror = () => handlers.error({ message: "a message of the engine worker could not be read (structured clone failed)" });
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      const where = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : null;
      handlers.error(where === null ? { message: event.message || "error in the engine worker" } : { message: event.message || "error in the engine worker", detail: where });
    };
    return {
      post: (command) => worker.postMessage(command),
      terminate: () => worker.terminate(),
    };
  };
}
