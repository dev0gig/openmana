/*
 * Test stand-in for virtual:openmana-engine (vitest.config.ts): a fixed,
 * clearly fake engine description so component tests do not depend on an
 * engine build. It is never bundled into the app; the real engine is tested
 * end to end (scripts/e2e/run.mjs).
 */
import { PROTOCOL_VERSION } from "@openmana/engine-protocol/generated/constants"
import type { EngineAssets } from "@/engine/engine-assets-types"

export const ENGINE_ASSETS: EngineAssets = {
  available: true,
  id: "0123456789abcdef",
  workerUrl: "/engine/0123456789abcdef/engine-worker.js",
  launcherUrl: "/engine/0123456789abcdef/openmana-engine.js",
  wasmUrl: "/engine/0123456789abcdef/openmana-engine.js.wasm",
  manifestUrl: "/engine/0123456789abcdef/engine-manifest.json",
  build: {
    manifestSha256: "a".repeat(64),
    builtAt: "2026-09-24T00:00:00.000Z",
    forgeRepository: "https://github.com/Card-Forge/forge",
    forgeCommit: "0000000000000000000000000000000000000000",
    forgeVersionCode: "0.0.0",
    patchCount: 6,
    protocolVersion: PROTOCOL_VERSION,
    graalvm: "test",
    downloadBytes: 1048576,
    downloadBrotliBytes: 524288,
    wasmBytes: 1000000,
  },
}
