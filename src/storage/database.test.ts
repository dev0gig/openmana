// @vitest-environment node
/*
 * Transactions: a write is all or nothing and is announced only once it is
 * committed; failures come back as StorageErrors with the browser's reason;
 * records are checked before they are written; damaged stored records are
 * reported, not dropped.
 */
import { IDBObjectStore } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import { deck, openTestDatabase, putRaw, readRaw, rejectionOf, setting } from "@/test/storage-fixtures"
import { assertRecord, sortOut } from "./database"
import { countDecks, listDecks, saveDeck } from "./decks"
import { describeCause, isQuotaError, StorageError, toStorageError } from "./errors"
import { defineSetting, readSetting, writeSetting } from "./settings"

describe("write", () => {
  it("commits, then announces the changed stores", async () => {
    const changes: string[][] = []
    const db = await openTestDatabase({ onChange: (stores) => changes.push([...stores]) })
    const record = deck()
    await db.write(["decks", "settings"], async (transaction) => {
      await transaction.objectStore("decks").put(record)
      expect(changes).toEqual([])
      await transaction.objectStore("settings").put(setting("ai.profile", "Default"))
    })
    expect(changes).toEqual([["decks", "settings"]])
    expect(await readRaw("decks")).toEqual([record])
    db.close()
  })

  it("is all or nothing when the work fails part-way", async () => {
    const changes = vi.fn()
    const db = await openTestDatabase({ onChange: changes })
    const kept = deck({ name: "Bestehend" })
    await saveDeck(db, kept)
    changes.mockClear()
    const error = await rejectionOf(
      db.write(["decks"], async (transaction) => {
        const store = transaction.objectStore("decks")
        await store.put(deck({ name: "Neu 1" }))
        await store.delete(kept.id)
        assertRecord("decks", { ...deck(), name: "" })
      })
    )
    expect(error.code).toBe("invalid-record")
    expect(await readRaw("decks")).toEqual([kept])
    expect(changes).not.toHaveBeenCalled()
    db.close()
  })

  it("is all or nothing when a request fails (the browser's reason is kept)", async () => {
    const db = await openTestDatabase()
    const existing = deck()
    await saveDeck(db, existing)
    const error = await rejectionOf(
      db.write(["decks"], async (transaction) => {
        const store = transaction.objectStore("decks")
        await store.put(deck({ name: "Neu" }))
        await store.add(existing)
      })
    )
    expect(error.code).toBe("transaction-failed")
    expect(error.detail).toMatch(/ConstraintError/)
    expect(await readRaw("decks")).toEqual([existing])
    db.close()
  })

  it("rolls back and reports a full browser storage", async () => {
    const db = await openTestDatabase()
    const existing = deck({ name: "Bestehend" })
    await saveDeck(db, existing)
    // The browser refuses the second write of the transaction.
    const originalPut = IDBObjectStore.prototype.put
    let calls = 0
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      calls++
      if (calls === 2) throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
      return originalPut.call(this, value, key)
    })
    const error = await rejectionOf(
      db.write(["decks"], async (transaction) => {
        const store = transaction.objectStore("decks")
        await store.put(deck({ name: "Eins" }))
        await store.put(deck({ name: "Zwei" }))
      })
    )
    vi.restoreAllMocks()
    expect(error.code).toBe("quota-exceeded")
    expect(await readRaw("decks")).toEqual([existing])
    db.close()
  })

  it("on a closed connection fails as closed", async () => {
    const db = await openTestDatabase()
    db.close()
    const error = await rejectionOf(db.write(["decks"], async () => undefined))
    expect(error.code).toBe("closed")
    const readError = await rejectionOf(db.read(["decks"], async () => undefined))
    expect(readError.code).toBe("closed")
  })
})

describe("records", () => {
  it("a deck is checked before anything is written", async () => {
    const db = await openTestDatabase()
    const error = await rejectionOf(saveDeck(db, { ...deck(), main: [] as never }))
    expect(error.code).toBe("invalid-record")
    expect(error.problems.map((p) => p.path)).toContain("/main")
    expect(await countDecks(db)).toBe(0)
    db.close()
  })

  it("damaged stored records are reported next to the valid ones, never dropped", async () => {
    const db = await openTestDatabase()
    const good = deck({ name: "Zebra" })
    const other = deck({ name: "alpha" })
    await saveDeck(db, good)
    await saveDeck(db, other)
    await putRaw("decks", { id: "broken-1", name: 42 })
    const { records, invalid } = await listDecks(db)
    expect(records.map((d) => d.name)).toEqual(["alpha", "Zebra"])
    expect(invalid).toHaveLength(1)
    expect(invalid[0]).toMatchObject({ store: "decks", key: "broken-1" })
    expect(await countDecks(db)).toBe(3)
    db.close()
  })

  it("sortOut pairs keys and values", () => {
    const result = sortOut("settings", ["a.b", "bad"], [setting("a.b", 1), { key: "bad" }])
    expect(result.records).toHaveLength(1)
    expect(result.invalid.map((r) => r.key)).toEqual(["bad"])
  })
})

describe("settings", () => {
  const profile = defineSetting("ai.profile", "Default", (value): value is string => typeof value === "string" && value.length > 0)

  it("falls back until a value is stored", async () => {
    const db = await openTestDatabase()
    expect(await readSetting(db, profile)).toEqual({ value: "Default", stored: false, invalid: false })
    await writeSetting(db, profile, "Reckless", () => new Date("2026-09-25T09:00:00.000Z"))
    expect(await readSetting(db, profile)).toEqual({ value: "Reckless", stored: true, invalid: false })
    expect(await readRaw("settings")).toEqual([{ key: "ai.profile", value: "Reckless", updatedAt: "2026-09-25T09:00:00.000Z" }])
    db.close()
  })

  it("a stored value that fails its check falls back visibly", async () => {
    const db = await openTestDatabase()
    await putRaw("settings", setting("ai.profile", 17))
    expect(await readSetting(db, profile)).toEqual({ value: "Default", stored: true, invalid: true })
    db.close()
  })

  it("refuses values that are not allowed or not plain JSON", async () => {
    const db = await openTestDatabase()
    const any = defineSetting("test.any", null as unknown, (value): value is unknown => value !== undefined)
    await expect(writeSetting(db, profile, "")).rejects.toMatchObject({ code: "invalid-record" })
    await expect(writeSetting(db, any, new Date())).rejects.toMatchObject({ code: "invalid-record" })
    await expect(writeSetting(db, any, { nested: [1, Number.NaN] })).rejects.toMatchObject({ code: "invalid-record" })
    await writeSetting(db, any, { nested: [1, "zwei", null, true] })
    db.close()
  })

  it("keeps keys this version does not know", async () => {
    const db = await openTestDatabase()
    await putRaw("settings", setting("future.option", { level: 3 }))
    await writeSetting(db, profile, "Cautious")
    expect((await readRaw("settings")).map((r) => (r as { key: string }).key).sort()).toEqual(["ai.profile", "future.option"])
    db.close()
  })
})

describe("errors", () => {
  it("map the browser's reasons", () => {
    const cases: [string, string, "open" | "transaction"][] = [
      ["QuotaExceededError", "quota-exceeded", "transaction"],
      ["VersionError", "version-too-new", "open"],
      ["SecurityError", "unsupported", "open"],
      ["InvalidStateError", "closed", "transaction"],
      ["NotFoundError", "schema-mismatch", "transaction"],
      ["DataCloneError", "invalid-record", "transaction"],
      ["UnknownError", "open-failed", "open"],
      ["UnknownError", "transaction-failed", "transaction"],
      ["AbortError", "transaction-failed", "transaction"],
    ]
    for (const [name, code, phase] of cases) {
      const error = toStorageError(new DOMException("detail", name), "testing", phase)
      expect(error.code, name).toBe(code)
      expect(error.detail).toBe(`${name}: detail`)
    }
    const own = new StorageError("backup-invalid", "x")
    expect(toStorageError(own, "testing")).toBe(own)
    expect(isQuotaError(new DOMException("", "QuotaExceededError"))).toBe(true)
    expect(describeCause("plain")).toBe("plain")
  })
})
