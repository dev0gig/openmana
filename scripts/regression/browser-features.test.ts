// @vitest-environment node
/* Independent capability losses, including each Wasm proposal. These are
 * controlled scope tests; real Chrome/isolation is tested by the full suite.
 */
import { expect, it, vi } from "vitest"
import { EngineClient } from "../../engine/client/src/index.ts"
import { WASM_PROBES, detectEngineFeatures, type FeatureScope } from "../../engine/protocol/src/index.ts"

const capable: FeatureScope = {
  WebAssembly: { validate: () => true },
  crossOriginIsolated: true,
  SharedArrayBuffer: function () {},
  Atomics: { wait: () => "ok" },
  Worker: function () {},
}

it.each([
  ["WebAssembly", { WebAssembly: undefined }],
  ["Cross-Origin-Isolation (COOP/COEP-Header)", { crossOriginIsolated: false }],
  ["SharedArrayBuffer", { SharedArrayBuffer: undefined }],
  ["Atomics.wait", { Atomics: {} }],
  ["Dedicated Worker", { Worker: undefined }],
] as const)("missing %s aborts before creating/downloading a worker", (label, missing) => {
  const scope = { ...capable, ...missing }
  const createPort = vi.fn(() => { throw new Error("unsupported browser started a worker") })
  const client = new EngineClient({ featureScope: scope, createPort, engineScriptUrl: "/never.js", wasmUrl: "/never.wasm" })
  client.start()
  expect(createPort).not.toHaveBeenCalled()
  expect(client.status).toBe("aborted")
  expect(client.abortInfo).toMatchObject({ reason: "unsupported-browser" })
  expect(client.features?.missing).toContain(label)
})

it.each([
  ["gc", "WebAssembly Garbage Collection"],
  ["exnref", "WebAssembly Exception Handling (exnref)"],
  ["typedFunctionReferences", "WebAssembly Typed Function References"],
] as const)("missing %s is reported independently and prevents startup", (key, label) => {
  const scope = { ...capable, WebAssembly: { validate: (bytes: Uint8Array) => Buffer.compare(Buffer.from(bytes), Buffer.from(WASM_PROBES[key])) !== 0 } }
  expect(detectEngineFeatures({ scope }).missing).toEqual([label])
  const createPort = vi.fn(() => { throw new Error("unsupported Wasm started a worker") })
  const client = new EngineClient({ featureScope: scope, createPort, engineScriptUrl: "/never.js", wasmUrl: "/never.wasm" })
  client.start()
  expect(createPort).not.toHaveBeenCalled()
  expect(client.abortInfo).toMatchObject({ reason: "unsupported-browser", missing: [label] })
})
