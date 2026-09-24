// Feature detection: what the engine needs, reported by name, with and
// without the cross-origin-isolation requirement.
import assert from "node:assert/strict";
import { test } from "node:test";
import { describeMissingFeatures, detectEngineFeatures, type FeatureScope } from "../src/index.ts";

const browserLike: FeatureScope = {
  WebAssembly: { validate: () => true },
  SharedArrayBuffer: function SharedArrayBuffer() {},
  Atomics: { wait: () => "ok" },
  crossOriginIsolated: true,
  Worker: function Worker() {},
};

test("this Node runtime has everything the engine needs (no isolation notion in Node)", () => {
  const report = detectEngineFeatures({ requireIsolation: false });
  assert.deepEqual(report.missing, []);
  assert.equal(report.supported, true);
  assert.equal(report.wasmGc && report.wasmExnref && report.wasmTypedFunctionReferences, true, "the real Wasm probes validate");
  assert.equal(report.crossOriginIsolated, null);
  assert.equal(describeMissingFeatures(report), "");
});

test("a browser without COOP/COEP is refused with the missing features named", () => {
  const report = detectEngineFeatures({ scope: { ...browserLike, crossOriginIsolated: false, SharedArrayBuffer: undefined } });
  assert.equal(report.supported, false);
  assert.deepEqual(report.missing, ["Cross-Origin-Isolation (COOP/COEP-Header)", "SharedArrayBuffer"]);
  assert.match(describeMissingFeatures(report), /^Dieser Browser kann die Forge-Engine nicht ausführen\. Es fehlt: Cross-Origin-Isolation/);
});

test("without the isolation requirement SharedArrayBuffer and Atomics.wait are still required", () => {
  const report = detectEngineFeatures({ requireIsolation: false, scope: { ...browserLike, crossOriginIsolated: false, Atomics: {} } });
  assert.deepEqual(report.missing, ["Atomics.wait"]);
});

test("old Wasm engines fail the probes one by one", () => {
  const report = detectEngineFeatures({ scope: { ...browserLike, WebAssembly: { validate: () => false } } });
  assert.deepEqual(report.missing, ["WebAssembly Garbage Collection", "WebAssembly Exception Handling (exnref)", "WebAssembly Typed Function References"]);
  const none = detectEngineFeatures({ scope: { ...browserLike, WebAssembly: undefined } });
  assert.equal(none.missing[0], "WebAssembly");
  const throwing = detectEngineFeatures({ scope: { ...browserLike, WebAssembly: { validate: () => { throw new Error("boom"); } } } });
  assert.equal(throwing.wasmGc, false);
});

test("a complete browser is supported", () => {
  assert.deepEqual(detectEngineFeatures({ scope: browserLike }).missing, []);
});
