import { expect, it, vi } from "vitest"
import { SUPPORTED, TEST_ASSETS } from "@/test/game-fixtures"
import { EngineSession, loadBrowserClient } from "./engine-session"

it("releases the browser client before replacement and cancels a boot stopped during release", async () => {
  // The real browser client/port over a browser Worker stand-in; no Forge mock
  // traffic is necessary for stopping a boot and serializing its replacement.
  const workers: { terminated: boolean }[] = []
  class BrowserWorker {
    terminated = false
    constructor() { workers.push(this) }
    postMessage() {}
    terminate() { this.terminated = true }
  }
  vi.stubGlobal("Worker", BrowserWorker)
  vi.stubGlobal("crossOriginIsolated", true)
  vi.stubGlobal("WebAssembly", { validate: () => true })
  await loadBrowserClient()
  vi.useFakeTimers()
  const session = new EngineSession({ assets: TEST_ASSETS, detectFeatures: () => SUPPORTED })
  const settle = async () => { await vi.dynamicImportSettled(); await vi.advanceTimersByTimeAsync(0) }
  try {
    session.start()
    await settle()
    expect(workers).toHaveLength(1)
    session.stop()
    expect(workers[0]!.terminated).toBe(true)
    session.start()
    await settle()
    expect(workers).toHaveLength(1)
    session.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(workers).toHaveLength(1)
    expect(session.getSnapshot().engine.status).toBe("idle")
    session.start()
    await settle()
    expect(workers).toHaveLength(2)
    expect(workers[0]!.terminated).toBe(true)
    expect(workers[1]!.terminated).toBe(false)
  } finally {
    session.stop()
    await vi.advanceTimersByTimeAsync(1000)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})
