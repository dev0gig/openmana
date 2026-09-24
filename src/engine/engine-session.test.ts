import type { EngineClientEvent, EngineClientListener } from "@openmana/engine-client"
import { checkEngineMessage, type EngineMessage, type FeatureReport } from "@openmana/engine-protocol"
import { describe, expect, it, vi } from "vitest"
import type { EngineAssets } from "./engine-assets-types"
import { EngineSession, type EngineUrls, type SessionClient } from "./engine-session"

// A stand-in for the engine client. Every message it emits is checked against
// the real protocol schema, so these tests cannot drift from the protocol.
class FakeClient implements SessionClient {
  readonly listeners = new Set<EngineClientListener>()
  started = 0
  disposed = 0
  start(): void {
    this.started++
  }
  subscribe(listener: EngineClientListener): () => boolean {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  dispose(): void {
    this.disposed++
  }
  emit(message: EngineMessage): void {
    const event: EngineClientEvent = { kind: "message", message: checkEngineMessage(message) }
    for (const listener of Array.from(this.listeners)) listener(event)
  }
}

const ASSETS: EngineAssets = {
  available: true,
  id: "0123456789abcdef",
  workerUrl: "/engine/0123456789abcdef/engine-worker.js",
  launcherUrl: "/engine/0123456789abcdef/openmana-engine.js",
  wasmUrl: "/engine/0123456789abcdef/openmana-engine.js.wasm",
  manifestUrl: "/engine/0123456789abcdef/engine-manifest.json",
  build: {
    builtAt: "2026-09-24T00:00:00.000Z",
    forgeRepository: "https://github.com/Card-Forge/forge",
    forgeCommit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798",
    patchCount: 6,
    protocolVersion: 3,
    graalvm: "25.4.4.1.1",
    downloadBytes: 100,
    downloadBrotliBytes: 50,
    wasmBytes: 80,
  },
}

const SUPPORTED: FeatureReport = {
  webAssembly: true,
  wasmGc: true,
  wasmExnref: true,
  wasmTypedFunctionReferences: true,
  crossOriginIsolated: true,
  sharedArrayBuffer: true,
  atomicsWait: true,
  worker: true,
  missing: [],
  supported: true,
}

const READY: EngineMessage = {
  type: "engine.ready",
  protocol: 3,
  engine: {
    forgeVersion: "2.0.07-SNAPSHOT",
    forgeCommit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798",
    forgeVersionCode: "2.0.07",
    patchCount: 6,
    patchesSha256: "d434f05792db3addec2bcc386318a7cdb5e0e3f4f1394d5490a73d28d3238ad7",
    openmanaCommit: "0ddfbc3000000000000000000000000000000000",
    engineSourcesModified: false,
    synchronous: true,
    resourcesSha256: "7e8aebee24e13111188a163cd5f7162ded2411728a85c6abc9ac2f5d5a0e6053",
  },
  boot: { resourceFiles: 36905, resourceBytes: 44327452, unpackMillis: 900, forgeInitMillis: 2000, cardLoading: "eager", language: "en-US" },
  t: 4000,
}

function setup(options: { assets?: EngineAssets; features?: FeatureReport; load?: () => Promise<(urls: EngineUrls) => SessionClient> } = {}) {
  let clock = 1000
  const clients: FakeClient[] = []
  const urls: EngineUrls[] = []
  const load =
    options.load ??
    (async () => (u: EngineUrls) => {
      urls.push(u)
      const client = new FakeClient()
      clients.push(client)
      return client
    })
  const loadClient = vi.fn(load)
  const session = new EngineSession({
    assets: options.assets ?? ASSETS,
    detectFeatures: () => options.features ?? SUPPORTED,
    loadClient,
    now: () => clock,
    baseUrl: "https://openmana.test/play",
  })
  return {
    session,
    clients,
    urls,
    loadClient,
    tick(ms: number) {
      clock += ms
    },
  }
}

/** Lets the (already resolved) client import settle. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe("EngineSession", () => {
  it("reports a build without engine and never starts one", () => {
    const { session, loadClient } = setup({ assets: { available: false, reason: "omitted", detail: "built with OPENMANA_ENGINE=omit" } })
    expect(session.getSnapshot()).toEqual({ status: "unavailable", reason: "omitted", detail: "built with OPENMANA_ENGINE=omit" })
    session.start()
    expect(session.getSnapshot().status).toBe("unavailable")
    expect(loadClient).not.toHaveBeenCalled()
  })

  it("reports a browser without what the engine needs and never starts it", () => {
    const features: FeatureReport = {
      ...SUPPORTED,
      crossOriginIsolated: false,
      sharedArrayBuffer: false,
      missing: ["Cross-Origin-Isolation (COOP/COEP-Header)", "SharedArrayBuffer"],
      supported: false,
    }
    const { session, loadClient } = setup({ features })
    const snapshot = session.getSnapshot()
    expect(snapshot.status).toBe("unsupported")
    expect(snapshot.status === "unsupported" && snapshot.message).toBe(
      "Dieser Browser kann die Forge-Engine nicht ausführen. Es fehlt: Cross-Origin-Isolation (COOP/COEP-Header), SharedArrayBuffer.",
    )
    session.start()
    expect(loadClient).not.toHaveBeenCalled()
  })

  it("boots through the engine's own phases to ready", async () => {
    const { session, clients, urls, tick } = setup()
    expect(session.getSnapshot().status).toBe("idle")
    const seen: string[] = []
    session.subscribe(() => seen.push(session.getSnapshot().status))

    session.start()
    const booting = session.getSnapshot()
    expect(booting.status).toBe("booting")
    expect(booting.status === "booting" && booting.steps.map((s) => s.state)).toEqual(["pending", "pending", "pending", "pending"])

    await settle()
    expect(clients).toHaveLength(1)
    const client = clients[0]!
    expect(client.started).toBe(1)
    expect(urls[0]!.workerUrl.href).toBe("https://openmana.test/engine/0123456789abcdef/engine-worker.js")
    expect(urls[0]!.engineScriptUrl).toBe("https://openmana.test/engine/0123456789abcdef/openmana-engine.js")
    expect(urls[0]!.wasmUrl).toBe("https://openmana.test/engine/0123456789abcdef/openmana-engine.js.wasm")

    tick(10)
    client.emit({ type: "engine.boot", phase: "worker-features", t: 10, features: SUPPORTED })
    tick(20)
    client.emit({ type: "engine.boot", phase: "launcher-load", t: 30 })
    tick(1500)
    client.emit({ type: "engine.boot", phase: "wasm-fetch-compile", t: 1530 })
    let snapshot = session.getSnapshot()
    expect(snapshot.status === "booting" && snapshot.steps.map((s) => s.state)).toEqual(["done", "done", "active", "pending"])
    expect(snapshot.status === "booting" && snapshot.steps[0]).toEqual({ phase: "worker-features", state: "done", startedAt: 1010, endedAt: 1030 })

    tick(900)
    client.emit({ type: "engine.boot", phase: "java-main", t: 2430 })
    tick(2000)
    client.emit(READY)
    snapshot = session.getSnapshot()
    expect(snapshot.status).toBe("ready")
    if (snapshot.status !== "ready") return
    expect(snapshot.steps.every((s) => s.state === "done")).toBe(true)
    expect(snapshot.readyAt - snapshot.startedAt).toBe(4430)
    expect(snapshot.ready.engine.forgeCommit).toBe("ed0333fecb1fea0671b3e50cadc1da4f71db5798")
    expect(seen[0]).toBe("booting")
    expect(seen.at(-1)).toBe("ready")
  })

  it("shows an abort with its reason and can start again with a fresh client", async () => {
    const { session, clients } = setup()
    session.start()
    await settle()
    clients[0]!.emit({ type: "engine.boot", phase: "worker-features", t: 1 })
    clients[0]!.emit({ type: "engine.abort", reason: "ready-timeout", origin: "client", message: "the engine was not ready after 180 s", stage: "boot" })
    const aborted = session.getSnapshot()
    expect(aborted.status).toBe("aborted")
    expect(aborted.status === "aborted" && aborted.abort.reason).toBe("ready-timeout")
    expect(clients[0]!.disposed).toBe(1)
    expect(clients[0]!.listeners.size).toBe(0)

    session.start()
    await settle()
    expect(clients).toHaveLength(2)
    expect(session.getSnapshot().status).toBe("booting")
  })

  it("stops a running engine and ignores what its old client still says", async () => {
    const { session, clients } = setup()
    session.start()
    await settle()
    const client = clients[0]!
    client.emit(READY)
    expect(session.getSnapshot().status).toBe("ready")
    session.stop()
    expect(session.getSnapshot().status).toBe("idle")
    expect(client.disposed).toBe(1)
    client.emit({ type: "engine.abort", reason: "terminated", origin: "client", message: "late" })
    expect(session.getSnapshot().status).toBe("idle")
  })

  it("drops a client that arrives after the player cancelled", async () => {
    const { session, clients } = setup()
    session.start()
    session.stop()
    await settle()
    expect(clients).toHaveLength(0)
    expect(session.getSnapshot().status).toBe("idle")
  })

  it("reports a failed client download as an abort instead of hanging", async () => {
    const { session } = setup({ load: () => Promise.reject(new Error("Failed to fetch dynamically imported module")) })
    session.start()
    await settle()
    const snapshot = session.getSnapshot()
    expect(snapshot.status).toBe("aborted")
    if (snapshot.status !== "aborted") return
    expect(snapshot.abort).toMatchObject({ reason: "boot-failed", origin: "client", stage: "client-load" })
    expect(snapshot.abort.message).toContain("Failed to fetch dynamically imported module")
    expect(() => checkEngineMessage(snapshot.abort)).not.toThrow()
  })

  it("ignores start while booting or ready", async () => {
    const { session, clients, loadClient } = setup()
    session.start()
    session.start()
    await settle()
    clients[0]!.emit(READY)
    session.start()
    expect(loadClient).toHaveBeenCalledTimes(1)
  })
})
