/*
 * The app's handle on the Forge engine: starts, watches and stops one
 * EngineClient (engine/client) and turns what it reports into snapshots the
 * UI renders. The engine lives in a Dedicated Worker (about 1 GB); it is only
 * started when the player asks for it, and only one runs at a time.
 *
 * Everything shown comes from the engine or the browser: feature detection
 * (engine/protocol), engine.boot phases, engine.ready (Forge and engine
 * build), engine.abort. Nothing is simulated here; without an engine in the
 * build or without a capable browser the session says so and never starts.
 *
 * The engine client is loaded on first start: it carries the protocol's
 * schema validators (~380 KB), which the rest of the app does not need.
 *
 * Framework-free on purpose (tests drive it with a fake client factory);
 * React reads it through useSyncExternalStore (engine-session-context.tsx).
 */
import type { EngineClient, EngineClientEvent } from "@openmana/engine-client"
import type { BootPhase, EngineAbort, EngineReady, FeatureReport } from "@openmana/engine-protocol"
import { describeMissingFeatures, detectEngineFeatures } from "@openmana/engine-protocol/features"
import { BOOT_PHASES } from "@openmana/engine-protocol/generated/constants"
import type { EngineAssets } from "./engine-assets-types"

export type BootStepState = "pending" | "active" | "done"

export interface BootStep {
  readonly phase: BootPhase
  readonly state: BootStepState
  /** Page time (ms, performance.now()) when the engine reported the phase. */
  readonly startedAt: number | null
  readonly endedAt: number | null
}

export type EngineSessionSnapshot =
  /** This build has no engine (see EngineAssetsUnavailable). */
  | { readonly status: "unavailable"; readonly reason: "missing" | "omitted"; readonly detail: string }
  /** The browser lacks something the engine needs; it is never started here. */
  | { readonly status: "unsupported"; readonly features: FeatureReport; readonly message: string }
  | { readonly status: "idle"; readonly features: FeatureReport }
  | {
      readonly status: "booting"
      readonly features: FeatureReport
      readonly startedAt: number
      readonly steps: readonly BootStep[]
    }
  | {
      readonly status: "ready"
      readonly features: FeatureReport
      readonly startedAt: number
      readonly readyAt: number
      readonly steps: readonly BootStep[]
      readonly ready: EngineReady
    }
  | {
      readonly status: "aborted"
      readonly features: FeatureReport
      readonly startedAt: number
      readonly steps: readonly BootStep[]
      readonly abort: EngineAbort
    }

/** The part of EngineClient the session uses (tests pass a fake). */
export type SessionClient = Pick<EngineClient, "start" | "subscribe" | "dispose">

/** Where the engine is: the worker script, GraalVM's launcher, the module. */
export interface EngineUrls {
  readonly workerUrl: URL
  readonly engineScriptUrl: string
  readonly wasmUrl: string
}

export type CreateSessionClient = (urls: EngineUrls) => SessionClient

/** The real client: EngineClient with the browser's Dedicated Worker, loaded on demand. */
export async function loadBrowserClient(): Promise<CreateSessionClient> {
  const { EngineClient, browserWorkerPort } = await import("@openmana/engine-client")
  return ({ workerUrl, engineScriptUrl, wasmUrl }) =>
    new EngineClient({ createPort: browserWorkerPort(workerUrl), engineScriptUrl, wasmUrl })
}

export interface EngineSessionOptions {
  readonly assets: EngineAssets
  /** Default: loadBrowserClient. */
  readonly loadClient?: () => Promise<CreateSessionClient>
  /** Default: detectEngineFeatures() of engine/protocol (cross-origin isolation required). */
  readonly detectFeatures?: () => FeatureReport
  readonly now?: () => number
  /** Base for the engine URLs (the page's location). */
  readonly baseUrl?: string
}

type Listener = () => void

export class EngineSession {
  readonly #options: EngineSessionOptions
  readonly #now: () => number
  readonly #listeners = new Set<Listener>()
  #snapshot: EngineSessionSnapshot
  #client: SessionClient | null = null
  #unsubscribe: (() => void) | null = null
  /** Counts starts and stops; a client that arrives for an older attempt is dropped. */
  #attempt = 0

  constructor(options: EngineSessionOptions) {
    this.#options = options
    this.#now = options.now ?? (() => performance.now())
    this.#snapshot = this.#initialSnapshot()
  }

  getSnapshot = (): EngineSessionSnapshot => this.#snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** Starts the engine (idle or after an abort). Anything else is ignored. */
  start(): void {
    const current = this.#snapshot
    if (current.status !== "idle" && current.status !== "aborted") return
    const assets = this.#options.assets
    if (!assets.available) return
    const attempt = ++this.#attempt
    const features = current.features
    const startedAt = this.#now()
    const baseUrl = this.#options.baseUrl ?? globalThis.location.href
    this.#set({
      status: "booting",
      features,
      startedAt,
      steps: BOOT_PHASES.map((phase) => ({ phase, state: "pending", startedAt: null, endedAt: null })),
    })
    const loadClient = this.#options.loadClient ?? loadBrowserClient
    loadClient().then(
      (create) => {
        if (attempt !== this.#attempt) return
        const client = create({
          workerUrl: new URL(assets.workerUrl, baseUrl),
          engineScriptUrl: new URL(assets.launcherUrl, baseUrl).href,
          wasmUrl: new URL(assets.wasmUrl, baseUrl).href,
        })
        this.#client = client
        this.#unsubscribe = client.subscribe((event) => this.#onEvent(client, event))
        client.start()
      },
      (error: unknown) => {
        if (attempt !== this.#attempt) return
        this.#set({
          status: "aborted",
          features,
          startedAt,
          steps: BOOT_PHASES.map((phase) => ({ phase, state: "pending", startedAt: null, endedAt: null })),
          abort: {
            type: "engine.abort",
            origin: "client",
            reason: "boot-failed",
            stage: "client-load",
            message: `the engine client could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
          },
        })
      },
    )
  }

  /** Stops a booting or running engine (terminates the worker) and returns to idle. */
  stop(): void {
    this.#attempt++
    this.#release()
    const current = this.#snapshot
    if (current.status === "booting" || current.status === "ready" || current.status === "aborted") {
      this.#set({ status: "idle", features: current.features })
    }
  }

  #initialSnapshot(): EngineSessionSnapshot {
    const assets = this.#options.assets
    if (!assets.available) {
      return { status: "unavailable", reason: assets.reason, detail: assets.detail }
    }
    const features = (this.#options.detectFeatures ?? (() => detectEngineFeatures({ requireIsolation: true })))()
    if (!features.supported) {
      return { status: "unsupported", features, message: describeMissingFeatures(features) }
    }
    return { status: "idle", features }
  }

  #onEvent(client: SessionClient, event: EngineClientEvent): void {
    // Events of a client that was stopped meanwhile are stale.
    if (client !== this.#client || event.kind !== "message") return
    const current = this.#snapshot
    if (current.status !== "booting" && current.status !== "ready") return
    const message = event.message
    const now = this.#now()
    switch (message.type) {
      case "engine.boot":
        if (current.status === "booting") {
          this.#set({ ...current, steps: advance(current.steps, message.phase, now) })
        }
        return
      case "engine.ready":
        if (current.status === "booting") {
          this.#set({
            status: "ready",
            features: current.features,
            startedAt: current.startedAt,
            readyAt: now,
            steps: finish(current.steps, now),
            ready: message,
          })
        }
        return
      case "engine.abort":
        // The client has terminated the worker already.
        this.#release()
        this.#set({ status: "aborted", features: current.features, startedAt: current.startedAt, steps: current.steps, abort: message })
        return
      default:
        return
    }
  }

  #release(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    const client = this.#client
    this.#client = null
    client?.dispose()
  }

  #set(snapshot: EngineSessionSnapshot): void {
    this.#snapshot = snapshot
    // A copy: a listener may unsubscribe (itself or another) while being called.
    for (const listener of Array.from(this.#listeners)) listener()
  }
}

/** The engine reports the start of a phase: earlier phases are done, this one is active. */
function advance(steps: readonly BootStep[], phase: BootPhase, now: number): readonly BootStep[] {
  const index = BOOT_PHASES.indexOf(phase)
  return steps.map((step, i) => {
    if (i < index) return step.state === "done" ? step : { ...step, state: "done", startedAt: step.startedAt ?? now, endedAt: now }
    if (i === index) return { ...step, state: "active", startedAt: step.startedAt ?? now }
    return step
  })
}

/** engine.ready: every phase is over. */
function finish(steps: readonly BootStep[], now: number): readonly BootStep[] {
  return steps.map((step) => (step.state === "done" ? step : { ...step, state: "done", startedAt: step.startedAt ?? now, endedAt: now }))
}
