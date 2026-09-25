// @vitest-environment node
/*
 * Installing the card catalog into IndexedDB (fake-indexeddb): complete,
 * checked, all-or-restart, once per version, one tab at a time.
 */
import { IDBObjectStore } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import { fixtureCatalogFile, serveFile } from "@/test/catalog-fixtures"
import { openTestDatabase, readRaw } from "@/test/storage-fixtures"
import { CATALOG_CACHE_KEY, installCatalog, readInstalledCatalog, type InstallProgress } from "./catalog-install"
import { CardDataError } from "./errors"

const PLENTY = { estimate: async () => ({ usage: 1_000, quota: 10_000_000_000 }) }
const NO_LOCKS = { locks: null }

async function rejection(promise: Promise<unknown>): Promise<CardDataError> {
  const outcome = await promise.then(
    () => null,
    (error: unknown) => error,
  )
  if (!(outcome instanceof CardDataError)) throw new Error(`expected a CardDataError, got ${String(outcome)}`)
  return outcome
}

describe("installing the catalog", () => {
  it("stores every record, checked, and notes version and count", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    expect(await readInstalledCatalog(db)).toEqual({ status: "missing" })
    const progress: InstallProgress[] = []
    const served = serveFile(file.assets.url, file.gzip, { chunk: 4096 })
    const result = await installCatalog(db, file.assets, { fetch: served.fetch, storage: PLENTY, ...NO_LOCKS, onProgress: (p) => progress.push(p) })
    const records = file.catalog.cards.length + file.catalog.sets.length + file.catalog.forgeOnly.length
    expect(result).toEqual({ version: file.assets.id, records, installed: true })
    expect(await readRaw("scryfallCards")).toHaveLength(file.catalog.cards.length)
    expect(await readRaw("scryfallSets")).toHaveLength(file.catalog.sets.length)
    expect(await readRaw("forgeOnlyCards")).toEqual(file.catalog.forgeOnly)
    expect(await readInstalledCatalog(db)).toMatchObject({ status: "complete", version: file.assets.id, records })
    expect(progress.filter((p) => p.phase === "download").at(-1)).toEqual({ phase: "download", done: file.gzip.byteLength, total: file.gzip.byteLength })
    expect(progress.filter((p) => p.phase === "store").at(-1)).toEqual({ phase: "store", done: records, total: records })
    db.close()
  })

  it("does nothing when exactly this version is installed", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    await installCatalog(db, file.assets, { fetch: serveFile(file.assets.url, file.gzip).fetch, storage: PLENTY, ...NO_LOCKS })
    const served = serveFile(file.assets.url, file.gzip)
    const again = await installCatalog(db, file.assets, { fetch: served.fetch, storage: PLENTY, ...NO_LOCKS })
    expect(again.installed).toBe(false)
    expect(served.calls).toEqual([])
    db.close()
  })

  it("replaces an older version completely", async () => {
    const current = fixtureCatalogFile()
    const db = await openTestDatabase()
    // An installed older version: a card the current catalog does not have.
    await db.write(["scryfallCards", "cacheIndex"], async (transaction) => {
      await transaction.objectStore("scryfallCards").put({ ...current.catalog.cards[0]!, oracleId: "00000000-0000-4000-8000-00000000abcd" })
      await transaction.objectStore("cacheIndex").put({
        key: CATALOG_CACHE_KEY,
        kind: "card-catalog",
        status: "complete",
        source: "/cards/0000000000000000/card-catalog.jsonl.gz",
        version: "0000000000000000",
        storedAt: "2026-09-01T00:00:00.000Z",
        lastUsedAt: "2026-09-01T00:00:00.000Z",
        bytes: 1,
        records: 1,
      })
    })
    expect(await readInstalledCatalog(db)).toMatchObject({ status: "complete", version: "0000000000000000" })
    await installCatalog(db, current.assets, { fetch: serveFile(current.assets.url, current.gzip).fetch, storage: PLENTY, ...NO_LOCKS })
    const stored = (await readRaw("scryfallCards")) as { oracleId: string }[]
    expect(stored.map((card) => card.oracleId)).not.toContain("00000000-0000-4000-8000-00000000abcd")
    expect(stored).toHaveLength(current.catalog.cards.length)
    db.close()
  })

  it("takes the catalog from a host that already unpacked it (checked against the JSON Lines' SHA-256)", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    const unpacked = serveFile(file.assets.url, file.text, { headers: { "Content-Encoding": "gzip" } })
    const progress: InstallProgress[] = []
    await installCatalog(db, file.assets, { fetch: unpacked.fetch, storage: PLENTY, ...NO_LOCKS, onProgress: (p) => progress.push(p) })
    expect(await readRaw("scryfallCards")).toHaveLength(file.catalog.cards.length)
    // Progress counts what arrives: the unpacked size.
    expect(progress.filter((p) => p.phase === "download").at(-1)).toEqual({ phase: "download", done: file.assets.uncompressedBytes, total: file.assets.uncompressedBytes })
    db.close()
  })

  it("refuses a file that is not the one the build names, and stays partial", async () => {
    const file = fixtureCatalogFile()
    // Same size, one byte different: only the SHA-256 tells.
    const other = new Uint8Array(file.gzip)
    other[other.length >> 1] = (other[other.length >> 1] ?? 0) ^ 0xff
    const db = await openTestDatabase()
    const error = await rejection(installCatalog(db, file.assets, { fetch: serveFile(file.assets.url, other).fetch, storage: PLENTY, ...NO_LOCKS }))
    expect(error.code).toBe("corrupt")
    expect(error.detail).toMatch(/SHA-256/)
    expect(await readInstalledCatalog(db)).toMatchObject({ status: "partial", version: file.assets.id })
    expect(await readRaw("scryfallCards")).toEqual([])
    db.close()
  })

  it.each([
    [
      "a line that breaks the schema",
      (lines: string[]) => {
        const first = lines.findIndex((line) => line.startsWith('{"type":"card"'))
        return lines.map((line, i) => (i === first ? line.replace('"layout":', '"layuot":') : line))
      },
      /line \d+ does not match the schema/,
    ],
    ["a missing end line", (lines: string[]) => lines.slice(0, -1), /end line is missing/],
    ["wrong counts", (lines: string[]) => [...lines.slice(0, 3), ...lines.slice(4)], /counts/],
    ["no header", (lines: string[]) => lines.slice(1), /first line is not a catalog header/],
    ["a newer format", (lines: string[]) => [lines[0]!.replace('"formatVersion":1', '"formatVersion":2'), ...lines.slice(1)], /format 2/],
  ])("refuses a catalog with %s (its own hash is right, its content is not)", async (_label, edit, message) => {
    const broken = fixtureCatalogFile(edit)
    const db = await openTestDatabase()
    const error = await rejection(installCatalog(db, broken.assets, { fetch: serveFile(broken.assets.url, broken.gzip).fetch, storage: PLENTY, ...NO_LOCKS }))
    expect(error.code).toBe("corrupt")
    expect(`${error.message} ${error.detail ?? ""}`).toMatch(message)
    expect(await readInstalledCatalog(db)).toMatchObject({ status: "partial" })
    db.close()
  })

  it("an unreachable file or HTTP error is a failed download; nothing counts as installed", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    }) as unknown as typeof fetch
    expect((await rejection(installCatalog(db, file.assets, { fetch: offline, storage: PLENTY, ...NO_LOCKS }))).code).toBe("download-failed")
    const missing = await rejection(installCatalog(db, file.assets, { fetch: serveFile("/elsewhere", file.gzip).fetch, storage: PLENTY, ...NO_LOCKS }))
    expect(missing.code).toBe("download-failed")
    expect(missing.detail).toMatch(/HTTP 404/)
    expect((await readInstalledCatalog(db)).status).toBe("partial")
    db.close()
  })

  it("checks the space first and writes nothing if it does not fit", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    const tight = { estimate: async () => ({ usage: 1_000, quota: 2_000 }) }
    const error = await rejection(installCatalog(db, file.assets, { fetch: serveFile(file.assets.url, file.gzip).fetch, storage: tight, ...NO_LOCKS }))
    expect(error.code).toBe("insufficient-space")
    expect(await readInstalledCatalog(db)).toEqual({ status: "missing" })
    db.close()
  })

  it("a page without Web Crypto (no secure context) is told so before anything is written", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    vi.stubGlobal("crypto", {})
    const error = await rejection(installCatalog(db, file.assets, { fetch: serveFile(file.assets.url, file.gzip).fetch, storage: PLENTY, ...NO_LOCKS }))
    vi.unstubAllGlobals()
    expect(error.code).toBe("unsupported")
    expect(await readInstalledCatalog(db)).toEqual({ status: "missing" })
    db.close()
  })

  it("a download larger than announced is refused as it arrives", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    const bigger = new Uint8Array(file.gzip.byteLength + 10)
    bigger.set(file.gzip)
    const error = await rejection(installCatalog(db, file.assets, { fetch: serveFile(file.assets.url, bigger).fetch, storage: PLENTY, ...NO_LOCKS }))
    expect(error.code).toBe("corrupt")
    expect(error.message).toMatch(/larger/)
    db.close()
  })

  it("a full storage while writing is a space problem, and the catalog stays partial", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    const originalPut = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === "scryfallCards") throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
      return originalPut.call(this, value, key)
    })
    const error = await rejection(installCatalog(db, file.assets, { fetch: serveFile(file.assets.url, file.gzip).fetch, storage: PLENTY, ...NO_LOCKS }))
    vi.restoreAllMocks()
    expect(error.code).toBe("insufficient-space")
    expect(error.detail).toMatch(/quota-exceeded/)
    expect((await readInstalledCatalog(db)).status).toBe("partial")
    db.close()
  })

  it("can be stopped; the next attempt starts over", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    const controller = new AbortController()
    const served = serveFile(file.assets.url, file.gzip, { chunk: 1024 })
    const stopping = installCatalog(db, file.assets, {
      fetch: served.fetch,
      storage: PLENTY,
      ...NO_LOCKS,
      signal: controller.signal,
      onProgress: (p) => {
        if (p.phase === "download" && p.done > 2048) controller.abort()
      },
    })
    expect((await rejection(stopping)).code).toBe("aborted")
    expect((await readInstalledCatalog(db)).status).toBe("partial")
    await installCatalog(db, file.assets, { fetch: serveFile(file.assets.url, file.gzip).fetch, storage: PLENTY, ...NO_LOCKS })
    expect((await readInstalledCatalog(db)).status).toBe("complete")
    db.close()
  })

  it("one tab at a time: the second waits for the lock and then finds it installed", async () => {
    const file = fixtureCatalogFile()
    const db = await openTestDatabase()
    let chain = Promise.resolve<unknown>(undefined)
    const locks = {
      request: (_name: string, work: () => Promise<unknown>) => {
        const run = chain.then(work)
        chain = run.catch(() => undefined)
        return run
      },
    } as unknown as Pick<LockManager, "request">
    const first = serveFile(file.assets.url, file.gzip)
    const second = serveFile(file.assets.url, file.gzip)
    const [a, b] = await Promise.all([
      installCatalog(db, file.assets, { fetch: first.fetch, storage: PLENTY, locks }),
      installCatalog(db, file.assets, { fetch: second.fetch, storage: PLENTY, locks }),
    ])
    expect([a.installed, b.installed]).toEqual([true, false])
    expect(second.calls).toEqual([])
    db.close()
  })
})
