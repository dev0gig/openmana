// @vitest-environment node
/*
 * Opening the database in every situation a browser produces: no IndexedDB,
 * a newer version, a damaged structure, another tab holding an old version,
 * another tab upgrading or deleting, the browser closing the connection.
 */
import { deleteDB, openDB, unwrap } from "idb"
import { forceCloseDatabase } from "fake-indexeddb"
import { afterEach, describe, expect, it, vi } from "vitest"
import { APP } from "@/test/storage-fixtures"
import { StorageError } from "./errors"
import { createStores, MIGRATIONS, type Migration } from "./migrations"
import { compareLayout, openWithMigrations, type OpenOptions } from "./open"
import { STORE_LAYOUT, type StoreLayout } from "./schema"

const NAME = "open-test"
const LAYOUT: Record<string, StoreLayout> = { items: { keyPath: "id", indexes: {} } }
const V1: Migration = { version: 1, summary: "items", structure: (db) => createStores(db, LAYOUT) }
const V2: Migration = { version: 2, summary: "nothing new" }

function open(options: Partial<OpenOptions> = {}) {
  return openWithMigrations({ name: NAME, migrations: [V1], layout: LAYOUT, app: APP, ...options })
}

async function failure(promise: Promise<unknown>): Promise<StorageError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(StorageError)
  return error as StorageError
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("opening fails loudly", () => {
  it("without IndexedDB", async () => {
    vi.stubGlobal("indexedDB", undefined)
    expect((await failure(open())).code).toBe("unsupported")
  })

  it("when a newer OpenMana upgraded the database", async () => {
    const newer = await openDB(NAME, 7)
    newer.close()
    const error = await failure(open())
    expect(error.code).toBe("version-too-new")
    expect(error.detail).toMatch(/VersionError/)
  })

  it("when the database has the version but not the structure", async () => {
    const damaged = await openDB(NAME, 1, { upgrade: (db) => db.createObjectStore("items", { keyPath: "key" }).createIndex("extra", "extra") })
    damaged.close()
    const error = await failure(open())
    expect(error.code).toBe("schema-mismatch")
    expect(error.detail).toContain('store items: key path "key" instead of "id"')
    expect(error.detail).toContain("unexpected index extra")
    // The refused connection was closed: deleting does not block.
    await deleteDB(NAME, { blocked: () => expect.fail("the refused connection is still open") })
  })

  it("the production database is compared store by store and index by index", async () => {
    const partial = await openDB("openmana-partial", 1, {
      upgrade: (db) => {
        db.createObjectStore("decks", { keyPath: "id" })
        db.createObjectStore("surplus", { keyPath: "id" })
      },
    })
    const problems = await compareLayout(partial, STORE_LAYOUT)
    partial.close()
    expect(problems).toContain("store matches is missing")
    expect(problems).toContain("unexpected store surplus")
    expect(problems).not.toContain("store decks is missing")
  })
})

describe("other tabs", () => {
  it("an older version held open elsewhere blocks the upgrade until it lets go", async () => {
    const first = await open()
    first.close()
    // A tab of an older app that does not react to versionchange.
    const stubborn = await openDB(NAME, 1)
    const onBlocked = vi.fn()
    const upgrading = open({ migrations: [V1, V2], onBlocked })
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalled())
    stubborn.close()
    const db = await upgrading
    expect(db.version).toBe(2)
    db.close()
  })

  it("lets go at once when another tab upgrades, and says so", async () => {
    const onVersionChange = vi.fn()
    const db = await open({ onVersionChange })
    const newer = await openDB(NAME, 2)
    expect(onVersionChange).toHaveBeenCalledWith(2)
    expect(() => db.transaction("items")).toThrow()
    newer.close()
  })

  it("lets go at once when another tab deletes the database, and says so", async () => {
    const onVersionChange = vi.fn()
    await open({ onVersionChange })
    await deleteDB(NAME)
    expect(onVersionChange).toHaveBeenCalledWith(null)
  })

  it("reports when the browser closes the connection (site data cleared)", async () => {
    const onTerminated = vi.fn()
    const db = await open({ onTerminated })
    forceCloseDatabase(unwrap(db) as never)
    await vi.waitFor(() => expect(onTerminated).toHaveBeenCalledTimes(1))
  })
})

describe("the app's database", () => {
  it("opens with the app's migrations and layout", async () => {
    const db = await openWithMigrations({ name: "openmana-app", migrations: MIGRATIONS, layout: STORE_LAYOUT, app: APP })
    expect(db.version).toBe(MIGRATIONS.length)
    db.close()
  })
})
