// @vitest-environment node
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { runInNewContext } from "node:vm"
import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import { completeCache, isolated, verifiedDownload } from "../pwa/cache-runtime.js"
import { ISOLATION_HEADERS } from "./isolation-headers.ts"
import { pwa } from "./pwa.ts"

const sha = (text: string) => createHash("sha256").update(text).digest("hex")
const files = [{ url: "/engine/one/host.js", bytes: 4, sha256: sha("host") }, { url: "/engine/one/engine.wasm", bytes: 4, sha256: sha("wasm") }]
const marker = "/complete"
function memoryStorage() {
  const data = new Map<string, Map<string, Response>>()
  const storage = {
    open: async (name: string) => {
      if (!data.has(name)) data.set(name, new Map())
      const responses = data.get(name)!
      return { match: async (url: string) => responses.get(url)?.clone(), put: async (url: string, response: Response) => { responses.set(url, response.clone()) }, delete: async (url: string) => responses.delete(url) }
    },
    delete: async (name: string) => data.delete(name),
  } as unknown as CacheStorage
  return { storage, data }
}
const fetcher = vi.fn<typeof fetch>(async (url) => new Response(String(url).endsWith("host.js") ? "host" : "wasm", { headers: { "Content-Type": String(url).endsWith("js") ? "text/javascript" : "application/wasm" } }))

describe("PWA verified staging", () => {
  it("enables registration for builds, never for serve even if NODE_ENV remains production", () => {
    const plugin = pwa()
    const config = plugin.config as (options: unknown, env: { command: string }) => { define: Record<string, string> }
    const before = process.env["NODE_ENV"]
    process.env["NODE_ENV"] = "production"
    try {
      expect(config({}, { command: "serve" }).define["import.meta.env.OPENMANA_PWA_BUILD"]).toBe("false")
      expect(config({}, { command: "build" }).define["import.meta.env.OPENMANA_PWA_BUILD"]).toBe("true")
    } finally {
      if (before === undefined) delete process.env["NODE_ENV"]
      else process.env["NODE_ENV"] = before
    }
  })
  it("publishes readiness last, only after all bytes verify, and serves isolation/type intact", async () => {
    const { storage, data } = memoryStorage()
    const paused = vi.fn<typeof fetch>(async (url, options) => {
      expect(data.get("engine")?.has(marker)).toBe(false)
      expect(options).toMatchObject({ cache: "no-store", redirect: "error", credentials: "same-origin" })
      return fetcher(url, options)
    })
    const cache = await completeCache(storage, "engine", files, marker, ISOLATION_HEADERS, paused)
    expect(data.get("engine")?.size).toBe(3)
    expect(await cache.match(marker)).toBeTruthy()
    const wasm = (await cache.match(files[1]!.url))!
    expect(wasm.headers.get("Content-Type")).toBe("application/wasm")
    for (const [key, value] of Object.entries(ISOLATION_HEADERS)) expect(wasm.headers.get(key)).toBe(value)
    expect(await wasm.text()).toBe("wasm")
    paused.mockClear()
    await completeCache(storage, "engine", files, marker, ISOLATION_HEADERS, paused)
    expect(paused).not.toHaveBeenCalled()
  })
  it.each(["hash", "size", "network", "http", "quota"])("rolls back %s failure without touching the previous engine or user's caches", async (kind) => {
    const { storage, data } = memoryStorage()
    await (await storage.open("old-engine")).put(marker, new Response("old"))
    await (await storage.open("user-cache")).put(marker, new Response("user"))
    const broken = vi.fn<typeof fetch>(async (url, options) => {
      if (String(url).endsWith("host.js")) return fetcher(url, options)
      if (kind === "network") throw new TypeError("connection lost")
      if (kind === "http") return new Response("oops", { status: 503 })
      return new Response(kind === "size" ? "was" : kind === "hash" ? "xxxx" : "wasm")
    })
    if (kind === "quota") {
      const original = storage.open.bind(storage)
      storage.open = async (name) => {
        const cache = await original(name)
        const put = cache.put.bind(cache)
        cache.put = async (url, response) => { if (url === files[1]!.url) throw new DOMException("full", "QuotaExceededError"); await put(url, response) }
        return cache
      }
    }
    await expect(completeCache(storage, "new-engine", files, marker, ISOLATION_HEADERS, broken)).rejects.toThrow()
    expect(data.has("new-engine")).toBe(false)
    expect(await (await storage.open("old-engine")).match(marker)).toBeTruthy()
    expect(await (await storage.open("user-cache")).match(marker)).toBeTruthy()
  })
  it("rechecks a terminated partial download and repairs a missing member even with a marker", async () => {
    const { storage, data } = memoryStorage()
    const partial = await storage.open("engine")
    await partial.put(files[0]!.url, new Response("wrong"))
    await completeCache(storage, "engine", files, marker, ISOLATION_HEADERS, fetcher)
    expect(await (await partial.match(files[0]!.url))!.text()).toBe("host")
    data.get("engine")!.delete(files[1]!.url)
    await completeCache(storage, "engine", files, marker, ISOLATION_HEADERS, fetcher)
    expect(await (await partial.match(files[1]!.url))!.text()).toBe("wasm")
  })
  it("checks the body rather than trusting HTTP cache/manifest claims", async () => {
    await expect(verifiedDownload(files[0]!, async () => new Response("evil"))).rejects.toThrow("Integrity check failed")
  })
  it("drops decoded transport headers while preserving the isolation policy", async () => {
    const response = isolated(new Response("body", { headers: { "content-encoding": "gzip", "content-length": "99", "content-type": "text/html" } }), ISOLATION_HEADERS)
    expect(response.headers.has("content-encoding")).toBe(false)
    expect(response.headers.has("content-length")).toBe(false)
    expect(response.headers.get("content-type")).toBe("text/html")
    expect(await response.text()).toBe("body")
  })
})


describe("ORYX trust metadata", () => {
  it("keeps server trust statements outside the offline app cache", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "omtrust-"))
    try {
      const outDir = path.join(dir, "dist")
      await fs.mkdir(path.join(outDir, ".well-known"), { recursive: true })
      await fs.writeFile(path.join(outDir, "index.html"), "shell")
      await fs.writeFile(path.join(outDir, ".well-known/assetlinks.json"), "[]")
      const plugin = pwa()
      const resolved = plugin.configResolved as (config: unknown) => void
      resolved({ root: path.resolve(import.meta.dirname, ".."), command: "build", base: "/", build: { outDir } })
      const close = plugin.closeBundle as () => Promise<void>
      await close()
      const sw = await fs.readFile(path.join(outDir, "sw.js"), "utf8")
      const config = JSON.parse(/^const CONFIG = (.+);\n/.exec(sw)![1]!)
      expect(config.shell.map((entry: { url: string }) => entry.url)).toEqual(["/index.html"])
    } finally { await fs.rm(dir, { recursive: true, force: true }) }
  })
  it.each(["/.well-known/assetlinks.json", "/.well-known/missing"])("never replaces %s with cached trust or the SPA", async (pathname) => {
    const handlers = new Map<string, (event: unknown) => void>()
    runInNewContext(await fs.readFile(path.resolve(import.meta.dirname, "../pwa/service-worker.js"), "utf8"), {
      CONFIG: { shell: [], engine: [], version: "one", engineVersion: "one" }, URL,
      self: { location: { origin: "https://openmana.vercel.app" }, addEventListener: (type: string, handle: (event: unknown) => void) => handlers.set(type, handle) },
    })
    const respondWith = vi.fn()
    handlers.get("fetch")!({ request: { method: "GET", mode: "navigate", url: `https://openmana.vercel.app${pathname}` }, respondWith })
    expect(respondWith).not.toHaveBeenCalled()
  })
})
