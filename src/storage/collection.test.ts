// @vitest-environment node
/*
 * The collection the ORYX cloud keeps: the merge rule (every deck on its own,
 * the newer change wins, deletion marks, the device's own settings never),
 * the check of a collection from elsewhere, and reading and applying it with
 * the real database code (fake-indexeddb).
 */
import { IDBObjectStore } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import { deck, openTestDatabase, putRaw, readRaw, rejectionOf, setting } from "@/test/storage-fixtures"
import { applyCollection, checkCollection, mergeCollections, readCollection, stableJson, summarizeCollection, TOMBSTONE_DAYS, tombstoneCutoff, type Collection } from "./collection"
import type { StoreName } from "./schema"
import { saveDeck } from "./decks"
import { SCHEMA_VERSION } from "./generated/constants"
import type { DeckRecord, SettingRecord } from "./generated/records"

const NOW = new Date("2026-09-25T12:00:00.000Z")
const at = (iso: string) => () => new Date(iso)

function collection(parts: Partial<Collection> = {}): Collection {
  return { schemaVersion: SCHEMA_VERSION, decks: [], deckTombstones: [], settings: [], ...parts }
}

const mark = (id: string, deletedAt: string) => ({ id, deletedAt })
const byId = (decks: readonly DeckRecord[]) => [...decks].sort((a, b) => (a.id < b.id ? -1 : 1))

describe("merging two collections", () => {
  it("empty sides: nothing and nothing is nothing, and one empty side gives the other", () => {
    expect(mergeCollections(collection(), collection(), NOW)).toEqual(collection())
    const one = collection({ decks: [deck()], settings: [setting("ai.profile", { kind: "random" })] })
    expect(mergeCollections(one, collection(), NOW)).toEqual(one)
    expect(mergeCollections(collection(), one, NOW)).toEqual(one)
  })

  it("every deck on its own: the newer change wins, and a deck only one side has stays", () => {
    const shared = deck({ name: "Alt", updatedAt: "2026-09-20T10:00:00.000Z" })
    const renamedHere = { ...shared, name: "Hier umbenannt", updatedAt: "2026-09-24T10:00:00.000Z" }
    const other = deck({ name: "Anderes", updatedAt: "2026-09-21T10:00:00.000Z" })
    const changedThere: DeckRecord = { ...other, main: [{ count: 60, name: "Island" }], updatedAt: "2026-09-22T10:00:00.000Z" }
    const onlyHere = deck({ name: "Nur hier" })
    const onlyThere = deck({ name: "Nur dort" })
    const merged = mergeCollections(collection({ decks: [renamedHere, other, onlyHere] }), collection({ decks: [shared, changedThere, onlyThere] }), NOW)
    expect(merged.decks).toEqual(byId([renamedHere, changedThere, onlyHere, onlyThere]))
    expect(merged.deckTombstones).toEqual([])
  })

  it("the same time on both sides: both devices keep the same copy, whichever side is which", () => {
    const a = deck({ name: "Variante A", updatedAt: "2026-09-24T10:00:00.000Z" })
    const b = { ...a, name: "Variante B" }
    const here = mergeCollections(collection({ decks: [a] }), collection({ decks: [b] }), NOW)
    const there = mergeCollections(collection({ decks: [b] }), collection({ decks: [a] }), NOW)
    expect(here).toEqual(there)
    expect(here.decks).toHaveLength(1)
    // The same content on both sides (keys in another order): simply that deck.
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as DeckRecord
    expect(stableJson(mergeCollections(collection({ decks: [a] }), collection({ decks: [reordered] }), NOW).decks[0])).toBe(stableJson(a))
  })

  it("deleted on one device, changed on the other before the deletion: deleted on both", () => {
    const original = deck({ updatedAt: "2026-09-20T10:00:00.000Z" })
    const changed = { ...original, name: "Vor dem Löschen geändert", updatedAt: "2026-09-21T10:00:00.000Z" }
    const deletedHere = collection({ deckTombstones: [mark(original.id, "2026-09-22T10:00:00.000Z")] })
    const changedThere = collection({ decks: [changed] })
    for (const merged of [mergeCollections(deletedHere, changedThere, NOW), mergeCollections(changedThere, deletedHere, NOW)]) {
      expect(merged.decks).toEqual([])
      expect(merged.deckTombstones).toEqual([mark(original.id, "2026-09-22T10:00:00.000Z")])
    }
  })

  it("deleted on one device, changed on the other after the deletion: the change wins and the mark goes", () => {
    const original = deck({ updatedAt: "2026-09-20T10:00:00.000Z" })
    const changed = { ...original, name: "Nach dem Löschen geändert", updatedAt: "2026-09-23T10:00:00.000Z" }
    const deletedHere = collection({ deckTombstones: [mark(original.id, "2026-09-22T10:00:00.000Z")] })
    const changedThere = collection({ decks: [changed] })
    for (const merged of [mergeCollections(deletedHere, changedThere, NOW), mergeCollections(changedThere, deletedHere, NOW)]) {
      expect(merged.decks).toEqual([changed])
      expect(merged.deckTombstones).toEqual([])
    }
  })

  it("deleted at the very moment of its last change: the deletion wins", () => {
    const original = deck({ updatedAt: "2026-09-22T10:00:00.000Z" })
    const merged = mergeCollections(collection({ decks: [original] }), collection({ deckTombstones: [mark(original.id, original.updatedAt)] }), NOW)
    expect(merged.decks).toEqual([])
    expect(merged.deckTombstones).toEqual([mark(original.id, original.updatedAt)])
  })

  it("two marks of one deck: the later one counts", () => {
    const id = deck().id
    const merged = mergeCollections(
      collection({ deckTombstones: [mark(id, "2026-09-20T10:00:00.000Z")] }),
      collection({ deckTombstones: [mark(id, "2026-09-23T10:00:00.000Z")] }),
      NOW,
    )
    expect(merged.deckTombstones).toEqual([mark(id, "2026-09-23T10:00:00.000Z")])
  })

  it(`marks older than ${TOMBSTONE_DAYS} days go - after they removed their deck`, () => {
    const cutoff = tombstoneCutoff(NOW)
    expect(cutoff).toBe("2026-06-27T12:00:00.000Z")
    const stale = deck({ updatedAt: "2026-06-01T10:00:00.000Z" })
    const expiredId = deck().id
    const keptId = deck().id
    const merged = mergeCollections(
      collection({ decks: [stale] }),
      collection({ deckTombstones: [mark(stale.id, "2026-06-02T10:00:00.000Z"), mark(expiredId, "2026-06-27T11:59:59.999Z"), mark(keptId, cutoff)] }),
      NOW,
    )
    // The old deck is deleted by its old mark; then the old marks go, the one exactly 90 days old stays.
    expect(merged.decks).toEqual([])
    expect(merged.deckTombstones).toEqual([mark(keptId, cutoff)])
  })

  it("settings: the newer change wins per key; the device's own (display.*) are never part of it", () => {
    const here = collection({
      settings: [
        setting("ai.profile", { kind: "profile", name: "Reckless" }, "2026-09-24T10:00:00.000Z"),
        setting("play.aiDeck", { kind: "random" }, "2026-09-20T10:00:00.000Z"),
        setting("display.cardLanguage", "en", "2026-09-24T10:00:00.000Z"),
      ],
    })
    const there = collection({
      settings: [
        setting("ai.profile", { kind: "random" }, "2026-09-21T10:00:00.000Z"),
        setting("play.aiDeck", { kind: "deck", deckId: "00000000-0000-4000-8000-0000000000d1" }, "2026-09-22T10:00:00.000Z"),
        setting("play.humanDeck", "00000000-0000-4000-8000-0000000000d2", "2026-09-22T10:00:00.000Z"),
        setting("display.motion", "reduce", "2026-09-25T10:00:00.000Z"),
      ],
    })
    expect(mergeCollections(here, there, NOW).settings).toEqual([
      setting("ai.profile", { kind: "profile", name: "Reckless" }, "2026-09-24T10:00:00.000Z"),
      setting("play.aiDeck", { kind: "deck", deckId: "00000000-0000-4000-8000-0000000000d1" }, "2026-09-22T10:00:00.000Z"),
      setting("play.humanDeck", "00000000-0000-4000-8000-0000000000d2", "2026-09-22T10:00:00.000Z"),
    ])
  })

  it("is the same whichever side is which, merging again changes nothing, and the result is sorted", () => {
    const a1 = deck({ updatedAt: "2026-09-20T10:00:00.000Z" })
    const a2 = { ...a1, name: "neuer", updatedAt: "2026-09-22T10:00:00.000Z" }
    const b = deck({ updatedAt: "2026-09-21T10:00:00.000Z" })
    const c = deck({ updatedAt: "2026-09-21T10:00:00.000Z" })
    const d = deck({ updatedAt: "2026-09-24T10:00:00.000Z" })
    const left = collection({
      decks: [d, a1, c],
      deckTombstones: [mark(b.id, "2026-09-23T10:00:00.000Z")],
      settings: [setting("play.humanDeck", d.id, "2026-09-24T10:00:00.000Z")],
    })
    const right = collection({
      decks: [b, a2],
      deckTombstones: [mark(c.id, "2026-09-20T10:00:00.000Z"), mark(d.id, "2026-09-25T10:00:00.000Z")],
      settings: [setting("ai.profile", { kind: "random" })],
    })
    const merged = mergeCollections(left, right, NOW)
    expect(merged).toEqual(mergeCollections(right, left, NOW))
    expect(mergeCollections(merged, right, NOW)).toEqual(merged)
    expect(mergeCollections(left, merged, NOW)).toEqual(merged)
    expect(merged.decks).toEqual(byId([a2, c]))
    expect(merged.deckTombstones.map((m) => m.id)).toEqual([b.id, d.id].sort())
    expect(merged.settings.map((s) => s.key)).toEqual(["ai.profile", "play.humanDeck"])
    expect(summarizeCollection(merged)).toEqual({ Decks: 2 })
  })
})

describe("checking a collection from elsewhere", () => {
  it("takes a valid collection and leaves out the settings of a device", () => {
    const saved = deck()
    const checked = checkCollection({
      schemaVersion: SCHEMA_VERSION,
      decks: [saved],
      deckTombstones: [mark(deck().id, "2026-09-24T10:00:00.000Z")],
      settings: [setting("ai.profile", { kind: "random" }), setting("display.motion", "reduce")],
    })
    expect(checked.decks).toEqual([saved])
    expect(checked.settings.map((s) => s.key)).toEqual(["ai.profile"])
  })

  it("refuses what is no collection, a newer version, and records that do not match - naming each", () => {
    expect(() => checkCollection(null)).toThrow(/not a collection document/)
    expect(() => checkCollection({ decks: [] })).toThrow(/not a collection document/)
    expect(() => checkCollection({ ...collection(), schemaVersion: SCHEMA_VERSION + 1 })).toThrow(`data version ${SCHEMA_VERSION + 1}; this app knows up to ${SCHEMA_VERSION}`)
    let refused: unknown
    try {
      checkCollection(collection({ decks: [deck(), { ...deck(), name: "" }], deckTombstones: [mark("kein-deck", "2026-09-24T10:00:00.000Z")] }))
    } catch (error) {
      refused = error
    }
    expect(refused).toMatchObject({ name: "StorageError", code: "invalid-record" })
    const paths = (refused as { problems: { path: string }[] }).problems.map((p) => p.path)
    expect(paths).toContain("/decks/1/name")
    expect(paths).toContain("/deckTombstones/0/id")
  })
})

async function stored(): Promise<{ decks: unknown[]; marks: unknown[]; settings: unknown[] }> {
  return { decks: await readRaw("decks"), marks: await readRaw("deckTombstones"), settings: await readRaw("settings") }
}

describe("the collection in the local database", () => {
  it("an empty database has nothing to sync; neither has one with only the device's settings", async () => {
    const db = await openTestDatabase()
    expect(await readCollection(db)).toBeNull()
    await putRaw("settings", setting("display.cardLanguage", "en"), setting("display.motion", "reduce"))
    expect(await readCollection(db)).toBeNull()
    db.close()
  })

  it("reads the valid decks, the deletion marks and the shared settings, sorted - never display.*, never a damaged record", async () => {
    const db = await openTestDatabase()
    const first = deck({ id: "00000000-0000-4000-8000-00000000f002" })
    const second = deck({ id: "00000000-0000-4000-8000-00000000f001" })
    await saveDeck(db, first)
    await saveDeck(db, second)
    await putRaw("decks", { id: "00000000-0000-4000-8000-00000000f003", name: "" })
    await putRaw("deckTombstones", mark("00000000-0000-4000-8000-00000000f004", "2026-09-24T10:00:00.000Z"), { id: "kaputt" })
    const shared = setting("ai.profile", { kind: "random" })
    await putRaw("settings", shared, setting("display.motion", "reduce"), { key: "Kaputt!", value: 1, updatedAt: "gestern" })
    const read = await readCollection(db)
    expect(read).toEqual({
      schemaVersion: SCHEMA_VERSION,
      decks: [second, first],
      deckTombstones: [mark("00000000-0000-4000-8000-00000000f004", "2026-09-24T10:00:00.000Z")],
      settings: [shared],
    })
    // Nothing depends on the clock: the same database gives the same document.
    expect(stableJson(await readCollection(db))).toBe(stableJson(read))
    db.close()
  })

  it("applies a collection: new and newer decks, deletions, settings - the device's own settings stay", async () => {
    const db = await openTestDatabase()
    const kept = deck({ name: "Bleibt", updatedAt: "2026-09-20T10:00:00.000Z" })
    const renamed = deck({ name: "Alt", updatedAt: "2026-09-20T10:00:00.000Z" })
    const deleted = deck({ name: "Anderswo gelöscht", updatedAt: "2026-09-20T10:00:00.000Z" })
    for (const d of [kept, renamed, deleted]) await saveDeck(db, d)
    const motion = setting("display.motion", "reduce", "2026-09-20T10:00:00.000Z")
    await putRaw("settings", motion, setting("ai.profile", { kind: "random" }, "2026-09-20T10:00:00.000Z"))
    const fresh = deck({ name: "Neu von dort" })
    const cloud = collection({
      decks: [kept, { ...renamed, name: "Dort umbenannt", updatedAt: "2026-09-23T10:00:00.000Z" }, fresh],
      deckTombstones: [mark(deleted.id, "2026-09-22T10:00:00.000Z")],
      settings: [setting("ai.profile", { kind: "profile", name: "Cautious" }, "2026-09-23T10:00:00.000Z"), setting("display.motion", "system", "2026-09-24T10:00:00.000Z")],
    })
    const result = await applyCollection(db, cloud, { now: () => NOW })
    // Written: the renamed deck, the new deck, the deletion (and its mark), the profile.
    expect(result).toEqual({ changes: 5, keptLocal: false })
    const after = await stored()
    expect(after.decks).toEqual(expect.arrayContaining([kept, { ...renamed, name: "Dort umbenannt", updatedAt: "2026-09-23T10:00:00.000Z" }, fresh]))
    expect(after.decks).toHaveLength(3)
    expect(after.marks).toEqual([mark(deleted.id, "2026-09-22T10:00:00.000Z")])
    expect(after.settings).toEqual(expect.arrayContaining([motion, setting("ai.profile", { kind: "profile", name: "Cautious" }, "2026-09-23T10:00:00.000Z")]))
    expect(after.settings).toHaveLength(2)
    // This device now holds exactly the cloud's collection (apart from its own settings).
    expect(stableJson(await readCollection(db))).toBe(stableJson(mergeCollections(cloud, collection(), NOW)))
    db.close()
  })

  it("never deletes without a mark: what only this device has, or has newer, stays - and it says so (keptLocal)", async () => {
    const db = await openTestDatabase()
    const onlyHere = deck({ name: "Nur hier" })
    const newerHere = deck({ name: "Hier neuer", updatedAt: "2026-09-24T10:00:00.000Z" })
    await saveDeck(db, onlyHere)
    await saveDeck(db, newerHere)
    const result = await applyCollection(db, collection({ decks: [{ ...newerHere, name: "Dort älter", updatedAt: "2026-09-21T10:00:00.000Z" }] }), { now: () => NOW })
    expect(result).toEqual({ changes: 0, keptLocal: true })
    expect(await readRaw("decks")).toEqual(expect.arrayContaining([onlyHere, newerHere]))
    // Applying exactly what this device holds changes nothing and keeps nothing back.
    const same = await readCollection(db)
    expect(await applyCollection(db, same, { now: () => NOW })).toEqual({ changes: 0, keptLocal: false })
    db.close()
  })

  it("a damaged deck is replaced by a valid copy from elsewhere, and stays as it is where there is none (never deleted)", async () => {
    const db = await openTestDatabase()
    const repaired = deck({ id: "00000000-0000-4000-8000-00000000e001", name: "Repariert" })
    await putRaw("decks", { id: repaired.id, name: "" }, { id: "00000000-0000-4000-8000-00000000e002", name: "" })
    await applyCollection(db, collection({ decks: [repaired], deckTombstones: [mark("00000000-0000-4000-8000-00000000e002", "2026-09-24T10:00:00.000Z")] }), { now: () => NOW })
    expect(await readRaw("decks")).toEqual([repaired, { id: "00000000-0000-4000-8000-00000000e002", name: "" }])
    db.close()
  })

  it("drops deletion marks older than 90 days when it writes", async () => {
    const db = await openTestDatabase()
    await putRaw("deckTombstones", mark("00000000-0000-4000-8000-00000000c001", "2026-06-01T10:00:00.000Z"), mark("00000000-0000-4000-8000-00000000c002", "2026-09-01T10:00:00.000Z"))
    await applyCollection(db, collection(), { now: () => NOW })
    expect(await readRaw("deckTombstones")).toEqual([mark("00000000-0000-4000-8000-00000000c002", "2026-09-01T10:00:00.000Z")])
    db.close()
  })

  it("round trip: read on one device, applied on another (empty) one - the same collection there", async () => {
    const source = await openTestDatabase()
    const decks = [deck({ name: "Eins" }), deck({ name: "Zwei", format: "commander", commander: [{ count: 1, name: "Talrand, Sky Summoner" }] })]
    for (const d of decks) await saveDeck(source, d)
    await putRaw("deckTombstones", mark("00000000-0000-4000-8000-00000000c003", "2026-09-24T10:00:00.000Z"))
    await putRaw("settings", setting("ai.profile", { kind: "random" }), setting("display.cardLanguage", "en"))
    const sent = JSON.parse(JSON.stringify(await readCollection(source))) as unknown
    source.close()
    const { IDBFactory } = await import("fake-indexeddb")
    globalThis.indexedDB = new IDBFactory()
    const target = await openTestDatabase()
    expect(await applyCollection(target, sent, { now: () => NOW })).toEqual({ changes: 4, keptLocal: false })
    expect(stableJson(await readCollection(target))).toBe(stableJson(sent))
    // The device's own setting did not travel.
    expect(await readRaw("settings")).toEqual([setting("ai.profile", { kind: "random" })])
    target.close()
  })

  it("all or nothing: a collection that fails its check writes nothing, a failure while writing rolls back", async () => {
    const changes: (readonly StoreName[])[] = []
    const db = await openTestDatabase({ onChange: (stores) => changes.push(stores) })
    const saved = deck()
    await saveDeck(db, saved)
    changes.length = 0
    const before = await stored()
    const damaged: unknown = { ...collection(), decks: [{ ...deck(), main: [] }] }
    expect((await rejectionOf(applyCollection(db, damaged, { now: () => NOW }))).code).toBe("invalid-record")
    const originalPut = IDBObjectStore.prototype.put
    let calls = 0
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      calls++
      if (calls === 2) throw new DOMException("disk trouble", "UnknownError")
      return originalPut.call(this, value, key)
    })
    const error = await rejectionOf(applyCollection(db, collection({ decks: [deck(), deck(), deck()] }), { now: () => NOW }))
    vi.restoreAllMocks()
    expect(error.code).toBe("transaction-failed")
    expect(await stored()).toEqual(before)
    // Nothing was written, so nothing was announced.
    expect(changes).toEqual([])
    db.close()
  })

  it("one transaction, announced once when it is written (the views read again)", async () => {
    const changes: (readonly StoreName[])[] = []
    const db = await openTestDatabase({ onChange: (stores) => changes.push(stores) })
    await applyCollection(db, collection({ decks: [deck(), deck()] }), { now: at("2026-09-25T12:00:00.000Z") })
    expect(changes).toEqual([["decks", "deckTombstones", "settings"]])
    db.close()
  })
})

describe("stable JSON", () => {
  it("sorts the keys of every object, keeps arrays in order, leaves undefined out", () => {
    expect(stableJson({ b: 1, a: [{ d: 2, c: null }], e: undefined })).toBe('{"a":[{"c":null,"d":2}],"b":1}')
    const record: SettingRecord = setting("ai.profile", { name: "x", kind: "profile" })
    expect(stableJson(record)).toBe('{"key":"ai.profile","updatedAt":"2026-09-21T10:00:00.000Z","value":{"kind":"profile","name":"x"}}')
  })
})
