// @vitest-environment node
/*
 * OpenMana's collection in the ORYX cloud, end to end in Node: the real,
 * unchanged ORYX SDK and the real CloudSync on the app's real storage session
 * (fake-indexeddb), against a stand-in for the ORYX cloud (src/test/oryx-fixtures.ts).
 * Inactive off OpenMana's address; the start's pull (new device, upload,
 * merge, a download that keeps what only this device has); uploads after the
 * player's changes only; deletions as marks; a cloud collection that is
 * damaged, newer or marked deleted; too large; disconnecting.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { MOTION } from "@/app/motion"
import { SCHEMA_VERSION } from "@/storage/generated/constants"
import type { DeckRecord } from "@/storage/generated/records"
import type { Collection } from "@/storage/collection"
import type { LocalDatabase } from "@/storage/database"
import { deleteDeck, renameDeck, saveDeck } from "@/storage/decks"
import { writeSetting } from "@/storage/settings"
import { StorageSession } from "@/storage/storage-session"
import { APP, deck, putRaw, readRaw, setting } from "@/test/storage-fixtures"
import { connectedStorage, connectingSession, fakeOryxCloud, LOCAL_ADDRESS, TEST_CODE, testOryx, type FakeOryxCloud, type MemoryStorage } from "@/test/oryx-fixtures"
import { CloudSync, COLLECTION_SLOT } from "./cloud-sync"
import type { OryxOptions, OryxPullResult } from "./oryx-sdk.js"

const NOW = new Date("2026-09-25T12:00:00.000Z")
const at = (iso: string) => () => new Date(iso)

const sessions: StorageSession[] = []
const links: (() => void)[] = []

afterEach(() => {
  for (const unlink of links.splice(0)) unlink()
  for (const session of sessions.splice(0)) session.close()
})

/** The app's storage session, open. */
async function openStorage(): Promise<{ session: StorageSession; db: LocalDatabase }> {
  const session = new StorageSession({ app: APP })
  sessions.push(session)
  session.open()
  await vi.waitFor(() => expect(session.getSnapshot().status).toBe("ready"))
  const snapshot = session.getSnapshot()
  if (snapshot.status !== "ready") throw new Error("the storage session did not open")
  return { session, db: snapshot.database }
}

/** A page load: the SDK started (main.tsx), then linked to the local database (the app shell). */
async function startApp(
  cloud: FakeOryxCloud,
  session: StorageSession,
  options: { readonly href?: string; readonly storage?: MemoryStorage; readonly sdk?: Partial<OryxOptions> } = {},
): Promise<{ sync: CloudSync; storage: MemoryStorage; replaced: string[]; started: string; unlink: () => void }> {
  const { oryx, storage, replaced } = testOryx(cloud, options)
  const sync = new CloudSync(oryx, { now: () => NOW })
  const started = await sync.start()
  const unlink = sync.attach(session)
  links.push(unlink)
  return { sync, storage, replaced, started, unlink }
}

async function pulled(sync: CloudSync): Promise<OryxPullResult> {
  await vi.waitFor(() => expect(sync.getSnapshot().pull.state).toBe("done"))
  const pull = sync.getSnapshot().pull
  return pull.state === "done" ? pull.result : "not done"
}

const puts = (cloud: FakeOryxCloud) => cloud.calls.filter((call) => call.endsWith("/rpc/oryx_put_save")).length
const cloudCollection = (cloud: FakeOryxCloud) => cloud.rows.get(COLLECTION_SLOT)?.save_data as Collection | undefined
const names = (decks: readonly unknown[]) => decks.map((d) => (d as DeckRecord).name).sort()
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function cloudRow(data: unknown, overrides: Partial<ReturnType<FakeOryxCloud["rows"]["get"]> & object> = {}) {
  return {
    revision: 7,
    save_version: SCHEMA_VERSION,
    save_data: data,
    data_hash: "from-another-device",
    summary: null,
    playtime_ms: null,
    device_label: "Linux · Browser",
    updated_at: "2026-09-25T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  }
}

function collectionOf(parts: Partial<Collection>): Collection {
  return { schemaVersion: SCHEMA_VERSION, decks: [], deckTombstones: [], settings: [], ...parts }
}

describe("off OpenMana's real address (locally, in tests, previews)", () => {
  it("stays inactive: no request, nothing stored, nothing to say", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    const { sync, storage, started } = await startApp(cloud, session, { href: LOCAL_ADDRESS, storage: connectedStorage() })
    expect(started).toBe("inactive")
    expect(await pulled(sync)).toBe("inactive")
    await saveDeck(db, deck())
    await pause(30)
    expect(cloud.calls).toEqual([])
    expect(sync.describe()).toBe("")
    expect(sync.getSnapshot().status).toBe("inactive")
    // It wrote nothing into the browser's storage (the tokens are the ones this test put there).
    expect(storage.keys().sort()).toEqual(["oryx.openmana.auth", "oryx.openmana.config"])
    expect(await sync.connect()).toBe(false)
  })
})

describe("a guest on OpenMana's real address", () => {
  it("sends nothing until the player connects; connecting leaves for ORYX's consent page", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    const { sync, replaced, started } = await startApp(cloud, session)
    expect(started).toBe("guest")
    expect(await pulled(sync)).toBe("guest")
    await saveDeck(db, deck())
    await pause(30)
    expect(cloud.calls).toEqual([])
    expect(sync.describe()).toBe("ORYX-Cloud: nicht verbunden")

    expect(await sync.connect()).toBe(true)
    expect(replaced).toHaveLength(1)
    const target = new URL(replaced[0]!)
    expect(`${target.origin}${target.pathname}`).toBe("https://fellumrfugohnnvtxxye.supabase.co/auth/v1/oauth/authorize")
    expect(target.searchParams.get("redirect_uri")).toBe("https://openmana.vercel.app/")
    expect(target.searchParams.get("response_type")).toBe("code")
    expect(target.searchParams.get("code_challenge_method")).toBe("S256")
    expect(target.searchParams.get("client_id")).toBe(cloud.clientId)
    expect(sync.getSnapshot().failure).toBeNull()
  })

  it.each([
    ["the code, for the connection this tab started", `?code=${TEST_CODE}&state=s1`, "s1", "connected"],
    ["the player declined", "?error=access_denied&error_description=declined&state=s1", "s1", "declined"],
    ["a code for another tab's connection (state differs)", `?code=${TEST_CODE}&state=other`, "s1", "failed"],
    ["a code ORYX does not take", "?code=something-else&state=s1", "s1", "failed"],
    ["no answer of ORYX at all", "", "s1", null],
  ] as const)("the return from ORYX's consent page with %s is said once (%s → %s)", async (_label, query, state, expected) => {
    const cloud = fakeOryxCloud()
    const href = `https://openmana.vercel.app/${query}`
    const { oryx } = testOryx(cloud, { href, session: connectingSession(state) })
    const sync = new CloudSync(oryx, { now: () => NOW, address: () => href })
    expect(sync.getSnapshot().returned).toBeNull()
    const started = await sync.start()
    expect(sync.getSnapshot().returned).toBe(expected)
    expect(started).toBe(expected === "connected" ? "connected" : "guest")
  })

  it("connecting that cannot start (ORYX does not know OpenMana yet) is said, and nothing leaves", async () => {
    const cloud = fakeOryxCloud()
    cloud.clientId = null
    const { session } = await openStorage()
    const { sync, replaced } = await startApp(cloud, session)
    expect(await sync.connect()).toBe(false)
    expect(replaced).toEqual([])
    expect(sync.getSnapshot().failure).toEqual({ kind: "connect" })
  })
})

describe("the start's pull", () => {
  it("a new device gets the cloud's collection; the views hear of it; nothing goes back up", async () => {
    const cloud = fakeOryxCloud()
    const decks = [deck({ name: "Aus der Cloud A" }), deck({ name: "Aus der Cloud B" })]
    const deletedId = deck().id
    cloud.rows.set(
      COLLECTION_SLOT,
      cloudRow(
        collectionOf({
          decks,
          deckTombstones: [{ id: deletedId, deletedAt: "2026-09-24T10:00:00.000Z" }],
          settings: [setting("ai.profile", { kind: "random" }), setting("display.motion", "reduce")],
        }),
      ),
    )
    const { session } = await openStorage()
    // This device's own setting: it is no part of the collection and stays.
    await putRaw("settings", setting("display.cardLanguage", "en"))
    const view = vi.fn()
    session.subscribeChanges(["decks"], view)
    const { sync, started } = await startApp(cloud, session, { storage: connectedStorage() })
    expect(started).toBe("connected")
    expect(await pulled(sync)).toBe("pulled")
    expect(names(await readRaw("decks"))).toEqual(["Aus der Cloud A", "Aus der Cloud B"])
    expect(await readRaw("deckTombstones")).toEqual([{ id: deletedId, deletedAt: "2026-09-24T10:00:00.000Z" }])
    expect(await readRaw("settings")).toEqual(expect.arrayContaining([setting("ai.profile", { kind: "random" }), setting("display.cardLanguage", "en")]))
    expect(await readRaw("settings")).toHaveLength(2)
    expect(view).toHaveBeenCalled()
    // Applying the cloud's collection is no change of the player's: no upload, no round between devices.
    await pause(60)
    expect(puts(cloud)).toBe(0)
    expect(sync.describe()).toMatch(/^ORYX-Cloud: verbunden · gesichert /)
  })

  it("a device with decks and an empty cloud uploads them", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    const saved = deck({ name: "Hier" })
    await saveDeck(db, saved)
    const { sync } = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(sync)).toBe("pushed")
    expect(cloudCollection(cloud)?.decks).toEqual([saved])
    expect(cloud.rows.get(COLLECTION_SLOT)).toMatchObject({ revision: 1, save_version: SCHEMA_VERSION, summary: { Decks: 1 } })
  })

  it("both sides changed since the last sync: merged deck by deck, never a question - and the result goes up", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    const kept = deck({ name: "A" })
    const deletedThere = deck({ name: "C" })
    await saveDeck(db, kept)
    await saveDeck(db, deletedThere)
    const first = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(first.sync)).toBe("pushed")
    // The app goes away; meanwhile this device renames A (not uploaded yet) and another device adds B and deletes C.
    first.unlink()
    await renameDeck(db, kept.id, "A hier umbenannt", at("2026-09-25T09:00:00.000Z"))
    const added = deck({ name: "B von dort" })
    cloud.rows.set(
      COLLECTION_SLOT,
      cloudRow(collectionOf({ decks: [kept, added].sort((x, y) => (x.id < y.id ? -1 : 1)), deckTombstones: [{ id: deletedThere.id, deletedAt: "2026-09-24T10:00:00.000Z" }] }), {
        revision: 2,
      }),
    )
    const second = await startApp(cloud, session, { storage: first.storage })
    expect(await pulled(second.sync)).toBe("merged")
    expect(names(await readRaw("decks"))).toEqual(["A hier umbenannt", "B von dort"])
    expect(await readRaw("deckTombstones")).toEqual([{ id: deletedThere.id, deletedAt: "2026-09-24T10:00:00.000Z" }])
    expect(cloud.rows.get(COLLECTION_SLOT)?.revision).toBe(3)
    expect(names(cloudCollection(cloud)?.decks ?? [])).toEqual(["A hier umbenannt", "B von dort"])
  })

  it("a download keeps a deck only this device has (no deletion mark for it) and sends it up", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    const onlyHere = deck({ name: "Nur hier" })
    await saveDeck(db, onlyHere)
    const first = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(first.sync)).toBe("pushed")
    first.unlink()
    // Another device uploaded a collection without it - it had no valid copy - and without a deletion mark.
    const fromThere = deck({ name: "Von dort" })
    cloud.rows.set(COLLECTION_SLOT, cloudRow(collectionOf({ decks: [fromThere] }), { revision: 2 }))
    const second = await startApp(cloud, session, { storage: first.storage })
    expect(await pulled(second.sync)).toBe("pulled")
    expect(names(await readRaw("decks"))).toEqual(["Nur hier", "Von dort"])
    await vi.waitFor(() => expect(cloud.rows.get(COLLECTION_SLOT)?.revision).toBe(3))
    expect(names(cloudCollection(cloud)?.decks ?? [])).toEqual(["Nur hier", "Von dort"])
  })

  it("a cloud collection that fails its check changes nothing here, and says why", async () => {
    const cloud = fakeOryxCloud()
    cloud.rows.set(COLLECTION_SLOT, cloudRow(collectionOf({ decks: [{ ...deck(), name: "" }] })))
    const { session } = await openStorage()
    const { sync } = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(sync)).toBe("error")
    expect(sync.getSnapshot().failure).toMatchObject({ kind: "cloud-invalid", error: { code: "invalid-record" } })
    expect(await readRaw("decks")).toEqual([])
    expect(puts(cloud)).toBe(0)
  })

  it("a collection of a newer OpenMana is neither taken over nor overwritten", async () => {
    const cloud = fakeOryxCloud()
    const newer = { schemaVersion: SCHEMA_VERSION + 1, decks: [], deckTombstones: [], settings: [], future: true }
    cloud.rows.set(COLLECTION_SLOT, cloudRow(newer, { save_version: SCHEMA_VERSION + 1 }))
    const { session, db } = await openStorage()
    const saved = deck()
    await saveDeck(db, saved)
    const { sync } = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(sync)).toBe("newer-version")
    expect(await readRaw("decks")).toEqual([saved])
    expect(cloudCollection(cloud)).toEqual(newer)
  })

  it("a collection marked deleted in the cloud is kept here and uploaded again (OpenMana never deletes it)", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    const saved = deck()
    await saveDeck(db, saved)
    const first = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(first.sync)).toBe("pushed")
    first.unlink()
    Object.assign(cloud.rows.get(COLLECTION_SLOT)!, { revision: 2, deleted_at: "2026-09-25T11:00:00.000Z" })
    const second = await startApp(cloud, session, { storage: first.storage })
    expect(await pulled(second.sync)).toBe("pushed")
    expect(await readRaw("decks")).toEqual([saved])
    expect(cloud.rows.get(COLLECTION_SLOT)).toMatchObject({ revision: 3, deleted_at: null })
  })

  it("too large for the cloud: everything stays here, and the pull says so", async () => {
    const cloud = fakeOryxCloud()
    cloud.maxSaveBytes = 200
    const { session, db } = await openStorage()
    const saved = deck()
    await saveDeck(db, saved)
    const { sync } = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(sync)).toBe("too_large")
    expect(await readRaw("decks")).toEqual([saved])
    expect(cloud.rows.has(COLLECTION_SLOT)).toBe(false)
  })

  it("a backup the cloud cannot take is never silent: a notice for the toast, the settings line, and the cloud hears it", async () => {
    const cloud = fakeOryxCloud()
    cloud.maxSaveBytes = 200
    const { session, db } = await openStorage()
    await saveDeck(db, deck())
    const { oryx } = testOryx(cloud, { storage: connectedStorage() })
    const sync = new CloudSync(oryx, { now: () => NOW })
    const notices: string[] = []
    links.push(sync.onNotice((notice) => notices.push(`${notice.kind}: ${notice.text}`)))
    await sync.start()
    links.push(sync.attach(session))
    expect(await pulled(sync)).toBe("too_large")
    expect(notices).toEqual(["failing: ORYX-Cloud: Sichern fehlgeschlagen (Spielstand zu groß). Dein Stand ist vorerst nur auf diesem Gerät gespeichert."])
    expect(sync.describe()).toBe("ORYX-Cloud: Sichern fehlgeschlagen (Spielstand zu groß) · nur auf diesem Gerät gespeichert")
    expect(sync.getSnapshot().status).toBe("connected")
    await vi.waitFor(() => expect(cloud.reports).toEqual([{ ok: false, error: "too_large" }]))
  })
})

describe("applying the cloud's collection", () => {
  it("never asks the SDK to upload it again, however the timing falls (no endless round between devices)", async () => {
    // A scripted SDK: its pull writes a collection, and its synced hash never matches - so only the guard keeps markChanged away.
    const markChanged = vi.fn()
    let config: { write(data: Collection): Promise<void> } | null = null
    const fake = {
      status: "connected",
      user: { id: "00000000-0000-4000-8000-0000000000a1", email: null },
      onStatus: () => () => undefined,
      ready: async () => "connected",
      slot: (_name: string, slotConfig: { write(data: Collection): Promise<void> }) => {
        config = slotConfig
        return {
          name: COLLECTION_SLOT,
          state: { base: 1, hash: "never-this", dirty: false, conflict: false, pendingDelete: false },
          markChanged,
          pull: async () => {
            await config!.write(collectionOf({ decks: [deck({ name: "Aus der Cloud" })] }))
            return "pulled"
          },
          flush: async () => "clean",
          remove: async () => "none",
        }
      },
    }
    const { session } = await openStorage()
    const sync = new CloudSync(fake as unknown as ConstructorParameters<typeof CloudSync>[0], { now: () => NOW })
    await sync.start()
    links.push(sync.attach(session))
    expect(await pulled(sync)).toBe("pulled")
    expect(names(await readRaw("decks"))).toEqual(["Aus der Cloud"])
    await pause(30)
    expect(markChanged).not.toHaveBeenCalled()
  })
})

describe("after the start", () => {
  it("uploads the player's changes - collected, only when the collection changed, a deletion as its mark", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    const saved = deck({ name: "Vorher" })
    await saveDeck(db, saved)
    const { sync } = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(sync)).toBe("pushed")

    await renameDeck(db, saved.id, "Nachher", at("2026-09-25T11:00:00.000Z"))
    await vi.waitFor(() => expect(cloud.rows.get(COLLECTION_SLOT)?.revision).toBe(2))
    expect(names(cloudCollection(cloud)?.decks ?? [])).toEqual(["Nachher"])

    // A setting of this device changes nothing in the collection: nothing is uploaded.
    await writeSetting(db, MOTION, "reduce")
    await pause(60)
    expect(cloud.rows.get(COLLECTION_SLOT)?.revision).toBe(2)

    await deleteDeck(db, saved.id, at("2026-09-25T11:30:00.000Z"))
    await vi.waitFor(() => expect(cloud.rows.get(COLLECTION_SLOT)?.revision).toBe(3))
    expect(cloudCollection(cloud)).toEqual(collectionOf({ deckTombstones: [{ id: saved.id, deletedAt: "2026-09-25T11:30:00.000Z" }] }))
    expect(cloud.rows.get(COLLECTION_SLOT)?.summary).toEqual({ Decks: 0 })
  })

  it("changes of another tab are that tab's to upload", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    await saveDeck(db, deck())
    const { sync } = await startApp(cloud, session, { storage: connectedStorage() })
    expect(await pulled(sync)).toBe("pushed")
    // Another tab of the app (its own session on the same database) saves a deck.
    const other = new StorageSession({ app: APP })
    sessions.push(other)
    other.open()
    await vi.waitFor(() => expect(other.getSnapshot().status).toBe("ready"))
    const otherSnapshot = other.getSnapshot()
    if (otherSnapshot.status !== "ready") throw new Error("not ready")
    const heard = vi.fn()
    session.subscribeChanges(["decks"], heard)
    await saveDeck(otherSnapshot.database, deck())
    await vi.waitFor(() => expect(heard).toHaveBeenCalledWith("other-tab"))
    await pause(60)
    expect(puts(cloud)).toBe(1)
  })

  it("disconnecting uploads what waits, then forgets the connection; the data stays", async () => {
    const cloud = fakeOryxCloud()
    const { session, db } = await openStorage()
    const saved = deck({ name: "Vorher" })
    await saveDeck(db, saved)
    // Uploads only a minute after a change: the rename below is still waiting when the player disconnects.
    const { sync, storage } = await startApp(cloud, session, { storage: connectedStorage(), sdk: { debounceMs: 60_000, maxWaitMs: 60_000 } })
    expect(await pulled(sync)).toBe("pushed")
    await renameDeck(db, saved.id, "Nachher", at("2026-09-25T11:00:00.000Z"))
    await pause(30)
    expect(cloud.rows.get(COLLECTION_SLOT)?.revision).toBe(1)
    await sync.disconnect()
    expect(names(cloudCollection(cloud)?.decks ?? [])).toEqual(["Nachher"])
    expect(sync.getSnapshot().status).toBe("guest")
    expect(storage.getItem("oryx.openmana.auth")).toBeNull()
    expect(names(await readRaw("decks"))).toEqual(["Nachher"])
    const calls = cloud.calls.length
    await renameDeck(db, saved.id, "Danach", at("2026-09-25T11:05:00.000Z"))
    await pause(30)
    // Only the (fire-and-forget) logout of the disconnect may still arrive; no upload.
    expect(cloud.calls.slice(calls).filter((call) => !call.endsWith("/auth/v1/logout"))).toEqual([])
  })
})
