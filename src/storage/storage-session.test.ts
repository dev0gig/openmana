// @vitest-environment node
/*
 * The app's session on the local database: states, retry, reset, losing the
 * connection, and change notifications here and across tabs.
 */
import { deleteDB, openDB } from "idb"
import { forceCloseDatabase } from "fake-indexeddb"
import { afterEach, describe, expect, it, vi } from "vitest"
import { APP, deck, rejectionOf } from "@/test/storage-fixtures"
import type { LocalDatabase } from "./database"
import { countDecks, saveDeck } from "./decks"
import { StorageError } from "./errors"
import { StorageSession, type StorageSnapshot } from "./storage-session"

const sessions: StorageSession[] = []

function session(options: Partial<ConstructorParameters<typeof StorageSession>[0]> = {}): StorageSession {
  const created = new StorageSession({ app: APP, ...options })
  sessions.push(created)
  return created
}

afterEach(() => {
  for (const s of sessions.splice(0)) s.close()
})

async function until(s: StorageSession, status: StorageSnapshot["status"]): Promise<StorageSnapshot> {
  await vi.waitFor(() => expect(s.getSnapshot().status).toBe(status))
  return s.getSnapshot()
}

async function ready(s: StorageSession): Promise<LocalDatabase> {
  const snapshot = await until(s, "ready")
  if (snapshot.status !== "ready") throw new Error("not ready")
  return snapshot.database
}

describe("lifecycle", () => {
  it("opens, and opens again after the app closed it (React strict mode does exactly that)", async () => {
    const s = session()
    const seen: string[] = []
    s.subscribe(() => seen.push(s.getSnapshot().status))
    s.open()
    s.close()
    s.open()
    const db = await ready(s)
    await saveDeck(db, deck())
    expect(await countDecks(db)).toBe(1)
    expect(seen.at(-1)).toBe("ready")
  })

  it("a failure is reported with its reason, and retry works once the cause is gone", async () => {
    const newer = await openDB("openmana", 9)
    newer.close()
    const s = session()
    s.open()
    const failed = await until(s, "failed")
    expect(failed.status === "failed" && failed.error.code).toBe("version-too-new")
    await deleteDB("openmana")
    s.retry()
    await ready(s)
  })

  it("reset deletes the database and opens an empty one", async () => {
    const s = session()
    s.open()
    await saveDeck(await ready(s), deck())
    await s.reset()
    expect(await countDecks(await ready(s))).toBe(0)
  })

  it("waits while another tab holds an older version", async () => {
    const stubborn = await openDB("openmana", 1, { upgrade: (db) => db.createObjectStore("old") })
    const s = session({ migrations: [...(await import("./migrations")).MIGRATIONS, { version: 2, summary: "test" }] })
    s.open()
    await until(s, "blocked")
    stubborn.close()
    // Opened, but the stubborn tab's version 1 lacked the stores: reported, not hidden.
    const failed = await until(s, "failed")
    expect(failed.status === "failed" && failed.error.code).toBe("schema-mismatch")
  })
})

describe("losing the connection", () => {
  it("another tab upgrades: closed, and reads fail as closed", async () => {
    const s = session()
    s.open()
    const db = await ready(s)
    const newer = await openDB("openmana", 2)
    const closed = await until(s, "closed")
    expect(closed.status === "closed" && closed.reason).toBe("upgraded")
    const error = await rejectionOf(countDecks(db))
    expect(error.code).toBe("closed")
    newer.close()
  })

  it("another tab resets: closed as deleted", async () => {
    const first = session()
    first.open()
    await ready(first)
    const second = session()
    second.open()
    await ready(second)
    await second.reset()
    const closed = await until(first, "closed")
    expect(closed.status === "closed" && closed.reason).toBe("deleted")
    await ready(second)
  })

  it("the browser closes it: closed as terminated", async () => {
    // Keep hold of the connection the session opens, to close it the way
    // clearing site data in the browser does.
    const factory = globalThis.indexedDB
    const realOpen = factory.open.bind(factory)
    const requests: IDBOpenDBRequest[] = []
    vi.spyOn(factory, "open").mockImplementation((name: string, version?: number) => {
      const request = realOpen(name, version)
      requests.push(request)
      return request
    })
    const s = session()
    s.open()
    await ready(s)
    forceCloseDatabase(requests.at(-1)!.result as never)
    const closed = await until(s, "closed")
    expect(closed.status === "closed" && closed.reason).toBe("terminated")
  })
})

describe("change notifications", () => {
  it("tell the listeners of the changed stores, only after the commit", async () => {
    const s = session()
    s.open()
    const db = await ready(s)
    const decks = vi.fn()
    const matches = vi.fn()
    s.subscribeChanges(["decks"], decks)
    const unsubscribe = s.subscribeChanges(["matches"], matches)
    await saveDeck(db, deck())
    expect(decks).toHaveBeenCalledTimes(1)
    expect(matches).not.toHaveBeenCalled()
    unsubscribe()
    await db.write(["matches"], async () => undefined)
    expect(matches).not.toHaveBeenCalled()
  })

  it("reach other tabs (BroadcastChannel)", async () => {
    const first = session()
    const second = session()
    first.open()
    second.open()
    await ready(first)
    const db = await ready(second)
    const listener = vi.fn()
    first.subscribeChanges(["decks"], listener)
    await saveDeck(db, deck())
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
  })

  it("a failed write announces nothing", async () => {
    const s = session()
    s.open()
    const db = await ready(s)
    const listener = vi.fn()
    s.subscribeChanges(["decks"], listener)
    await expect(saveDeck(db, { ...deck(), name: "" })).rejects.toBeInstanceOf(StorageError)
    expect(listener).not.toHaveBeenCalled()
  })
})
