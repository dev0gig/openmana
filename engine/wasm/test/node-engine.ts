/*
 * Shared by the Node engine tests: an EngineClient on Node's worker_threads
 * (engine/wasm/host/node-engine-worker.ts), started exactly like the page
 * starts it in the browser, only without the cross-origin-isolation check
 * (Node has no such notion; SharedArrayBuffer is always there).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EngineClient, type EngineClientOptions } from "../../client/src/index.ts";
import { nodeWorkerPort } from "../../client/src/node-worker-port.ts";

export const WASM_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENGINE_DIR = path.resolve(WASM_DIR, "..");

export function option(args: readonly string[], name: string, fallback: string): string;
export function option(args: readonly string[], name: string, fallback: null): string | null;
export function option(args: readonly string[], name: string, fallback: string | null): string | null {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1]! : fallback;
}

export function nodeClient(distDir: string, cardLoading: string, extra: Partial<EngineClientOptions> = {}): EngineClient {
  return new EngineClient({
    createPort: nodeWorkerPort(),
    engineScriptUrl: path.join(distDir, "openmana-engine.js"),
    wasmUrl: path.join(distDir, "openmana-engine.js.wasm"),
    engineArgs: [`--card-loading=${cardLoading}`],
    requireIsolation: false,
    ...extra,
  });
}

/** Peak resident memory of this Node process in MiB (the worker thread is part of it). */
export function vmHwmMiB(): number | null {
  const match = /VmHWM:\s+(\d+) kB/.exec(fs.readFileSync("/proc/self/status", "utf8"));
  return match ? Math.round(Number(match[1]) / 102.4) / 10 : null;
}
