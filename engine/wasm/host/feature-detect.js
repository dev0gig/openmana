/*
 * OpenMana engine: browser/runtime feature detection.
 *
 * Checked BEFORE the ~70 MB engine is downloaded, so an unsupported browser
 * gets a clear message instead of a hang (research: without COOP/COEP a
 * Forge-Wasm game never started and nothing was reported for 60 s).
 *
 * Plain script (no module syntax): usable via <script>, importScripts() in a
 * worker, and require() in Node. Exposes globalThis.OpenManaFeatures.
 *
 * The three Wasm probes are tiny modules assembled with Binaryen 123 from the
 * WAT shown next to them; WebAssembly.validate() accepts them only if the
 * runtime implements the feature GraalVM Web Image depends on.
 */
(function () {
  "use strict";

  const WASM_PROBES = {
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
  };

  const LABELS = {
    webAssembly: "WebAssembly",
    wasmGc: "WebAssembly Garbage Collection",
    wasmExnref: "WebAssembly Exception Handling (exnref)",
    wasmTypedFunctionReferences: "WebAssembly Typed Function References",
    crossOriginIsolated: "Cross-Origin-Isolation (COOP/COEP-Header)",
    sharedArrayBuffer: "SharedArrayBuffer",
    atomicsWait: "Atomics.wait",
    worker: "Dedicated Worker",
  };

  function validate(bytes) {
    try {
      return WebAssembly.validate(new Uint8Array(bytes));
    } catch (e) {
      return false;
    }
  }

  /**
   * @param {{ requireIsolation?: boolean }} options  requireIsolation: the
   *   page/worker must be cross-origin isolated (SharedArrayBuffer transport,
   *   needed as soon as a human answers Forge's questions).
   */
  function detect(options) {
    const requireIsolation = !options || options.requireIsolation !== false;
    const hasWasm = typeof WebAssembly === "object" && typeof WebAssembly.validate === "function";
    const result = {
      webAssembly: hasWasm,
      wasmGc: hasWasm && validate(WASM_PROBES.gc),
      wasmExnref: hasWasm && validate(WASM_PROBES.exnref),
      wasmTypedFunctionReferences: hasWasm && validate(WASM_PROBES.typedFunctionReferences),
      crossOriginIsolated: typeof globalThis.crossOriginIsolated === "boolean" ? globalThis.crossOriginIsolated : null,
      sharedArrayBuffer: typeof SharedArrayBuffer === "function",
      atomicsWait: typeof Atomics === "object" && typeof Atomics.wait === "function",
      worker: typeof Worker === "function" || typeof WorkerGlobalScope !== "undefined" || typeof process === "object",
    };
    const required = ["webAssembly", "wasmGc", "wasmExnref", "wasmTypedFunctionReferences", "worker"];
    if (requireIsolation) {
      required.push("crossOriginIsolated", "sharedArrayBuffer", "atomicsWait");
    }
    result.missing = required.filter((key) => result[key] !== true).map((key) => LABELS[key]);
    result.supported = result.missing.length === 0;
    return result;
  }

  function describeMissing(result) {
    if (result.supported) {
      return "";
    }
    return "Dieser Browser kann die Forge-Engine nicht ausführen. Es fehlt: " + result.missing.join(", ") + ".";
  }

  globalThis.OpenManaFeatures = { detect, describeMissing, WASM_PROBES };
})();
