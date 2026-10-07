/*
 * What the build tells the app about the Forge engine it ships
 * (virtual:openmana-engine, written by vite/engine-assets.ts). Shared by the
 * Vite plugin (Node) and the app (browser); types only.
 */

/** The engine artefacts are served content-addressed under engine/<id>/. */
export interface EngineAssetsAvailable {
  readonly available: true
  /** First 16 hex digits of a SHA-256 over the runtime files' SHA-256 values. */
  readonly id: string
  /** Absolute paths below the app's base URL. */
  readonly workerUrl: string
  readonly launcherUrl: string
  readonly wasmUrl: string
  readonly manifestUrl: string
  /** Facts from engine-manifest.json (engine/scripts/write-manifest.mjs). */
  readonly build: EngineBuildFacts
}

export interface EngineBuildFacts {
  readonly manifestSha256: string
  readonly builtAt: string
  readonly forgeRepository: string
  readonly forgeCommit: string
  /** Forge's own version number of the pinned commit (its pom.xml versionCode, e.g. 2.0.15). */
  readonly forgeVersionCode: string
  readonly patchCount: number
  readonly protocolVersion: number
  readonly graalvm: string
  /** Sum of the runtime files (worker, launcher, module) as served. */
  readonly downloadBytes: number
  /** The same files compressed with Brotli 11 (what a compressing host sends at best). */
  readonly downloadBrotliBytes: number
  readonly wasmBytes: number
}

/**
 * - missing: the dev server found no engine build (engine/build/dist).
 * - omitted: the build was made without an engine on purpose (OPENMANA_ENGINE=omit).
 */
export interface EngineAssetsUnavailable {
  readonly available: false
  readonly reason: "missing" | "omitted"
  /** Technical detail for developers (English). */
  readonly detail: string
}

export type EngineAssets = EngineAssetsAvailable | EngineAssetsUnavailable
