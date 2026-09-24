/*
 * Runtime feature detection for the engine.
 *
 * Runs BEFORE the ~70 MB engine is downloaded (in the page, by the client)
 * and again inside the worker, so an unsupported browser gets a clear message
 * instead of a hang (research: without COOP/COEP a Forge-Wasm game never
 * started and nothing was reported for 60 s).
 *
 * The three Wasm probes are tiny modules assembled with Binaryen 123 from the
 * WAT shown next to them; WebAssembly.validate() accepts them only if the
 * runtime implements the feature GraalVM Web Image depends on.
 */
import type { FeatureReport } from "./generated/protocol.ts";

export const WASM_PROBES = {
  // (module (type $s (struct (field i32)))
  //   (func (result (ref $s)) (struct.new $s (i32.const 1))))
  gc: [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x0a, 0x02, 0x5f, 0x01, 0x7f, 0x00, 0x60, 0x00, 0x01,
    0x64, 0x00, 0x03, 0x02, 0x01, 0x01, 0x0a, 0x09, 0x01, 0x07, 0x00, 0x41, 0x01, 0xfb, 0x00, 0x00, 0x0b],
  // (module (tag $e) (func (result exnref) (block $h (result exnref)
  //   (try_table (catch_all_ref $h) (throw $e)) (unreachable))))
  exnref: [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x60, 0x00, 0x00, 0x60, 0x00, 0x01,
    0x69, 0x03, 0x02, 0x01, 0x01, 0x0d, 0x03, 0x01, 0x00, 0x00, 0x0a, 0x10, 0x01, 0x0e, 0x00, 0x02, 0x69, 0x1f,
    0x40, 0x01, 0x03, 0x00, 0x08, 0x00, 0x0b, 0x00, 0x0b, 0x0b],
  // (module (type $t (func)) (func $f (type $t)) (elem declare func $f)
  //   (func (call_ref $t (ref.func $f))))
  typedFunctionReferences: [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
    0x03, 0x03, 0x02, 0x00, 0x00, 0x09, 0x05, 0x01, 0x03, 0x00, 0x01, 0x00, 0x0a, 0x0b, 0x02, 0x02, 0x00, 0x0b,
    0x06, 0x00, 0xd2, 0x00, 0x14, 0x00, 0x0b],
} as const;

type FeatureKey = Exclude<keyof FeatureReport, "missing" | "supported">;

/** German names for messages shown to the player. */
export const FEATURE_LABELS: Readonly<Record<FeatureKey, string>> = {
  webAssembly: "WebAssembly",
  wasmGc: "WebAssembly Garbage Collection",
  wasmExnref: "WebAssembly Exception Handling (exnref)",
  wasmTypedFunctionReferences: "WebAssembly Typed Function References",
  crossOriginIsolated: "Cross-Origin-Isolation (COOP/COEP-Header)",
  sharedArrayBuffer: "SharedArrayBuffer",
  atomicsWait: "Atomics.wait",
  worker: "Dedicated Worker",
};

/** The globals feature detection looks at; tests pass their own. */
export interface FeatureScope {
  readonly WebAssembly?: { validate?: (bytes: Uint8Array) => boolean } | undefined;
  readonly SharedArrayBuffer?: unknown;
  readonly Atomics?: { wait?: unknown } | undefined;
  readonly crossOriginIsolated?: unknown;
  readonly Worker?: unknown;
  readonly WorkerGlobalScope?: unknown;
  readonly process?: unknown;
}

export interface FeatureOptions {
  /**
   * Require crossOriginIsolated === true. Browsers: yes (default); Node has
   * no such notion and SharedArrayBuffer is always there.
   */
  readonly requireIsolation?: boolean;
  readonly scope?: FeatureScope;
}

function probe(scope: FeatureScope, bytes: readonly number[]): boolean {
  try {
    return scope.WebAssembly?.validate?.(new Uint8Array(bytes)) === true;
  } catch {
    return false;
  }
}

/** Checks everything the engine needs. SharedArrayBuffer and Atomics.wait are always required (input queue). */
export function detectEngineFeatures(options: FeatureOptions = {}): FeatureReport {
  const scope = options.scope ?? (globalThis as FeatureScope);
  const requireIsolation = options.requireIsolation !== false;
  const hasWasm = typeof scope.WebAssembly === "object" && scope.WebAssembly !== null && typeof scope.WebAssembly.validate === "function";
  const features: Record<FeatureKey, boolean | null> = {
    webAssembly: hasWasm,
    wasmGc: hasWasm && probe(scope, WASM_PROBES.gc),
    wasmExnref: hasWasm && probe(scope, WASM_PROBES.exnref),
    wasmTypedFunctionReferences: hasWasm && probe(scope, WASM_PROBES.typedFunctionReferences),
    crossOriginIsolated: typeof scope.crossOriginIsolated === "boolean" ? scope.crossOriginIsolated : null,
    sharedArrayBuffer: typeof scope.SharedArrayBuffer === "function",
    atomicsWait: typeof scope.Atomics === "object" && scope.Atomics !== null && typeof scope.Atomics.wait === "function",
    worker:
      typeof scope.Worker === "function" ||
      typeof scope.WorkerGlobalScope !== "undefined" ||
      (typeof scope.process === "object" && scope.process !== null),
  };
  const required: FeatureKey[] = ["webAssembly", "wasmGc", "wasmExnref", "wasmTypedFunctionReferences", "worker", "sharedArrayBuffer", "atomicsWait"];
  if (requireIsolation) {
    required.splice(4, 0, "crossOriginIsolated");
  }
  const missing = required.filter((key) => features[key] !== true).map((key) => FEATURE_LABELS[key]);
  return {
    webAssembly: features.webAssembly === true,
    wasmGc: features.wasmGc === true,
    wasmExnref: features.wasmExnref === true,
    wasmTypedFunctionReferences: features.wasmTypedFunctionReferences === true,
    crossOriginIsolated: features.crossOriginIsolated,
    sharedArrayBuffer: features.sharedArrayBuffer === true,
    atomicsWait: features.atomicsWait === true,
    worker: features.worker === true,
    missing,
    supported: missing.length === 0,
  };
}

/** A message for the player (German), empty if everything is supported. */
export function describeMissingFeatures(report: FeatureReport): string {
  if (report.supported) {
    return "";
  }
  return `Dieser Browser kann die Forge-Engine nicht ausführen. Es fehlt: ${report.missing.join(", ")}.`;
}
