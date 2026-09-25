// @vitest-environment node
/*
 * Upgrades through made-up schema versions (1 → 2 → 3) with the real
 * upgrade code, and the app's real schema versions (1 → 2 → 3).
 */
import { openDB } from "idb"
import { describe, expect, it } from "vitest"
import { APP, card, deck, FIXED_NOW, logEntry, match, openTestDatabase, setting, uuid } from "@/test/storage-fixtures"
import { StorageError } from "./errors"
import { SCHEMA_VERSION } from "./generated/constants"
import type { DatabaseMeta } from "./generated/records"
import { createStores, LAYOUT_V1, latestVersion, MIGRATIONS, upgradeRecord, type Migration } from "./migrations"
import { compareLayout, openWithMigrations } from "./open"
import { DATABASE_NAME, RECORD_CHECKS, STORE_LAYOUT, type StoreLayout } from "./schema"

const NAME = "migration-test"

const LAYOUT_1: Record<string, StoreLayout> = {
  meta: { keyPath: "key", indexes: {} },
  items: { keyPath: "id", indexes: {} },
  cache: { keyPath: "id", indexes: {} },
}
const LAYOUT_3: Record<string, StoreLayout> = {
  ...LAYOUT_1,
  items: { keyPath: "id", indexes: { title: { keyPath: "title", unique: false, multiEntry: false } } },
}

interface Item {
  readonly id: string
  readonly name: string
  readonly title?: string
  readonly marker?: string
}

const V1: Migration = { version: 1, summary: "items, cache and meta", structure: (db) => createStores(db, LAYOUT_1) }
const V2: Migration = {
  version: 2,
  summary: "title from name, indexed",
  structure: (_db, transaction) => {
    transaction.objectStore("items").createIndex("title", "title", { unique: false, multiEntry: false })
  },
  records: { items: (record) => ({ ...(record as Item), title: (record as Item).name.toUpperCase() }) },
}
const V3: Migration = {
  version: 3,
  summary: "marker built from the title (needs version 2 done), cache emptied",
  records: { items: (record) => ({ ...(record as Item), marker: `v3:${String((record as Item).title)}` }) },
  clear: ["cache"],
}

function at(iso: string) {
  return () => new Date(iso)
}

async function openAt(migrations: readonly Migration[], layout: Record<string, StoreLayout>, now = at("2026-09-01T00:00:00.000Z")) {
  return openWithMigrations({ name: NAME, migrations, layout, app: APP, now })
}

async function history() {
  const db = await openDB(NAME)
  const meta = (await db.get("meta", "database")) as DatabaseMeta
  db.close()
  return meta
}

describe("upgrades", () => {
  it("a new database runs every migration and records its history", async () => {
    const db = await openAt([V1, V2, V3], LAYOUT_3)
    expect(db.version).toBe(3)
    expect(await compareLayout(db, LAYOUT_3)).toEqual([])
    db.close()
    const meta = await history()
    expect(meta).toEqual({
      key: "database",
      schemaVersion: 3,
      createdAt: "2026-09-01T00:00:00.000Z",
      createdBy: APP,
      migrations: [1, 2, 3].map((version) => ({ version, appliedAt: "2026-09-01T00:00:00.000Z", app: APP })),
    })
  })

  it("an old database gets its records upgraded step by step, caches emptied", async () => {
    const v1 = await openAt([V1], LAYOUT_1)
    await v1.put("items", { id: "a", name: "alpha" })
    await v1.put("items", { id: "b", name: "beta" })
    await v1.put("cache", { id: "x" })
    v1.close()

    const v3 = await openAt([V1, V2, V3], LAYOUT_3, at("2026-09-10T00:00:00.000Z"))
    expect(await v3.getAll("items")).toEqual([
      { id: "a", name: "alpha", title: "ALPHA", marker: "v3:ALPHA" },
      { id: "b", name: "beta", title: "BETA", marker: "v3:BETA" },
    ])
    expect(await v3.getAllFromIndex("items", "title", "BETA")).toHaveLength(1)
    expect(await v3.count("cache")).toBe(0)
    v3.close()
    const meta = await history()
    expect(meta.createdAt).toBe("2026-09-01T00:00:00.000Z")
    expect(meta.migrations.map((m) => [m.version, m.appliedAt])).toEqual([
      [1, "2026-09-01T00:00:00.000Z"],
      [2, "2026-09-10T00:00:00.000Z"],
      [3, "2026-09-10T00:00:00.000Z"],
    ])
  })

  it("runs only the migrations after the database's version", async () => {
    const v2 = await openAt([V1, V2], { ...LAYOUT_1, items: LAYOUT_3["items"]! })
    await v2.put("items", { id: "a", name: "alpha", title: "custom" })
    v2.close()
    const v3 = await openAt([V1, V2, V3], LAYOUT_3)
    // Version 2's upgrade did not run again (title stays), version 3's did.
    expect(await v3.get("items", "a")).toEqual({ id: "a", name: "alpha", title: "custom", marker: "v3:custom" })
    v3.close()
  })

  it("a failing migration leaves the database unchanged at its old version", async () => {
    const v1 = await openAt([V1], LAYOUT_1)
    await v1.put("items", { id: "a", name: "alpha" })
    await v1.put("items", { id: "b", name: "beta" })
    v1.close()
    const broken: Migration = {
      version: 2,
      summary: "fails on the second record",
      structure: (_db, transaction) => {
        transaction.objectStore("items").createIndex("title", "title")
      },
      records: {
        items: (record) => {
          if ((record as Item).id === "b") throw new Error("cannot upgrade b")
          return { ...(record as Item), title: "changed" }
        },
      },
    }
    const failure = await openAt([V1, broken], LAYOUT_3).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(StorageError)
    expect((failure as StorageError).code).toBe("upgrade-failed")
    expect((failure as StorageError).detail).toContain("migration to version 2, store items")
    expect((failure as StorageError).detail).toContain("cannot upgrade b")

    const after = await openDB(NAME)
    expect(after.version).toBe(1)
    expect(Array.from(after.transaction("items").store.indexNames)).toEqual([])
    expect(await after.getAll("items")).toEqual([
      { id: "a", name: "alpha" },
      { id: "b", name: "beta" },
    ])
    after.close()
    expect((await history()).migrations.map((m) => m.version)).toEqual([1])
  })

  it("rewrites a missing history instead of failing", async () => {
    const v1 = await openAt([V1], LAYOUT_1)
    await v1.delete("meta", "database")
    v1.close()
    const v2 = await openAt([V1, V2], { ...LAYOUT_1, items: LAYOUT_3["items"]! }, at("2026-09-05T00:00:00.000Z"))
    v2.close()
    expect(await history()).toEqual({
      key: "database",
      schemaVersion: 2,
      createdAt: null,
      createdBy: null,
      migrations: [{ version: 2, appliedAt: "2026-09-05T00:00:00.000Z", app: APP }],
    })
  })
})

describe("records of older backups", () => {
  it("are upgraded with the same functions as the database", () => {
    expect(upgradeRecord("items", { id: "a", name: "alpha" }, 1, 3, [V1, V2, V3])).toEqual({ id: "a", name: "alpha", title: "ALPHA", marker: "v3:ALPHA" })
    expect(upgradeRecord("items", { id: "a", name: "alpha", title: "t" }, 2, 3, [V1, V2, V3])).toEqual({ id: "a", name: "alpha", title: "t", marker: "v3:t" })
    expect(upgradeRecord("cache", { id: "x" }, 1, 3, [V1, V2, V3])).toEqual({ id: "x" })
  })
})

describe("migration list", () => {
  it("must be numbered 1, 2, 3 … without gaps", () => {
    expect(latestVersion([V1, V2, V3])).toBe(3)
    expect(() => latestVersion([V1, V3])).toThrow(/without gaps/)
    expect(() => latestVersion([])).toThrow(/at least one/)
  })

  it("the app's migrations lead to the schema version of the record schema", () => {
    expect(latestVersion(MIGRATIONS)).toBe(SCHEMA_VERSION)
  })
})

describe("the app's schema versions", () => {
  it("a new database gets exactly the current layout and records its creation", async () => {
    const db = await openTestDatabase()
    db.close()
    const raw = await openDB(DATABASE_NAME)
    expect(await compareLayout(raw, STORE_LAYOUT)).toEqual([])
    expect(await raw.get("meta", "database")).toEqual({
      key: "database",
      schemaVersion: SCHEMA_VERSION,
      createdAt: FIXED_NOW.toISOString(),
      createdBy: APP,
      migrations: MIGRATIONS.map(({ version }) => ({ version, appliedAt: FIXED_NOW.toISOString(), app: APP })),
    })
    raw.close()
  })

  it("version 1 → current keeps every user record, replaces the card store and empties the cache index", async () => {
    // A database exactly as the prompt-07 app left it, with one record in every store.
    const v1 = await openWithMigrations({ name: DATABASE_NAME, migrations: MIGRATIONS.slice(0, 1), layout: LAYOUT_V1, app: APP, now: at("2026-09-25T01:00:00.000Z") })
    const userRecords = { decks: deck(), settings: setting("ai.profile", "Default"), matches: match() }
    const played = userRecords.matches
    await v1.put("decks", userRecords.decks)
    await v1.put("settings", userRecords.settings)
    await v1.put("matches", played)
    await v1.put("matchLog", logEntry(played.id, 0))
    await v1.put("scryfallCards", { id: uuid(), oracleId: null, lang: "de", name: "Shock", printedName: "Schock", nameKeys: ["shock"], set: "m19", collectorNumber: "156", data: {} })
    await v1.put("cacheIndex", { key: "old", kind: "bulk", status: "complete", source: null, version: null, storedAt: "2026-09-25T01:00:00.000Z", lastUsedAt: "2026-09-25T01:00:00.000Z", bytes: null, records: null })
    v1.close()

    const db = await openTestDatabase()
    db.close()
    const raw = await openDB(DATABASE_NAME)
    expect(raw.version).toBe(SCHEMA_VERSION)
    expect(await compareLayout(raw, STORE_LAYOUT)).toEqual([])
    expect(await raw.getAll("decks")).toEqual([userRecords.decks])
    expect(await raw.getAll("settings")).toEqual([userRecords.settings])
    expect(await raw.getAll("matches")).toEqual([played])
    expect(await raw.getAll("matchLog")).toEqual([logEntry(played.id, 0)])
    for (const store of ["scryfallCards", "scryfallPrints", "scryfallSets", "forgeOnlyCards", "cacheIndex"]) {
      expect(await raw.count(store)).toBe(0)
    }
    const meta = (await raw.get("meta", "database")) as DatabaseMeta
    expect(meta.schemaVersion).toBe(SCHEMA_VERSION)
    expect(meta.createdAt).toBe("2026-09-25T01:00:00.000Z")
    expect(meta.migrations.map((entry) => entry.version)).toEqual(MIGRATIONS.map((migration) => migration.version))
    raw.close()
  })

  it("version 2 → 3 keeps every record as it is: a deck without companion stays valid, the card data stay installed", async () => {
    const v2 = await openWithMigrations({ name: DATABASE_NAME, migrations: MIGRATIONS.slice(0, 2), layout: STORE_LAYOUT, app: APP, now: at("2026-09-25T02:00:00.000Z") })
    const saved = deck()
    const cardRecord = card()
    await v2.put("decks", saved)
    await v2.put("scryfallCards", cardRecord)
    v2.close()

    const db = await openTestDatabase()
    db.close()
    const raw = await openDB(DATABASE_NAME)
    expect(raw.version).toBe(3)
    expect(await raw.getAll("decks")).toEqual([saved])
    expect(RECORD_CHECKS.decks(saved)).toBeNull()
    expect(await raw.getAll("scryfallCards")).toEqual([cardRecord])
    const meta = (await raw.get("meta", "database")) as DatabaseMeta
    expect(meta.migrations.map((entry) => entry.version)).toEqual([1, 2, 3])
    raw.close()
    // A deck that names its companion is a valid record of version 3.
    expect(RECORD_CHECKS.decks({ ...saved, companion: [{ count: 1, name: "Lurrus of the Dream-Den" }] })).toBeNull()
  })
})
