// @vitest-environment node
/*
 * The deck library in the local database: one deck read as found, damaged
 * or missing; renaming, duplicating, replacing and deleting - each in one
 * transaction, checked before it is written, never bringing back a deck
 * that is gone or overwriting a damaged one.
 */
import { describe, expect, it } from "vitest"
import { deck, openTestDatabase, putRaw, readRaw, rejectionOf } from "@/test/storage-fixtures"
import { deleteDeck, duplicateDeck, getDeck, listDecks, renameDeck, replaceDeck, saveDeck } from "./decks"
import type { StoreName } from "./schema"

const at = (iso: string) => () => new Date(iso)
const COPY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

describe("reading one deck", () => {
  it("found, damaged or missing", async () => {
    const db = await openTestDatabase()
    const saved = deck({ name: "Izzet" })
    await saveDeck(db, saved)
    await putRaw("decks", { id: "broken", name: "" })
    expect(await getDeck(db, saved.id)).toEqual({ status: "found", deck: saved })
    const damaged = await getDeck(db, "broken")
    expect(damaged.status).toBe("damaged")
    expect(damaged.status === "damaged" && damaged.record.key).toBe("broken")
    expect(await getDeck(db, "00000000-0000-4000-8000-ffffffffffff")).toEqual({ status: "missing" })
    db.close()
  })
})

describe("renaming", () => {
  it("changes the name (trimmed) and the time of change, nothing else", async () => {
    const db = await openTestDatabase()
    const saved = deck({ name: "Izzet" })
    await saveDeck(db, saved)
    const renamed = await renameDeck(db, saved.id, "  Izzet Tempo  ", at("2026-09-25T10:00:00.000Z"))
    expect(renamed).toEqual({ ...saved, name: "Izzet Tempo", updatedAt: "2026-09-25T10:00:00.000Z" })
    expect(await readRaw("decks")).toEqual([renamed])
    db.close()
  })

  it("an empty name, a deck that is gone, a damaged deck: refused, nothing written", async () => {
    const db = await openTestDatabase()
    const saved = deck()
    await saveDeck(db, saved)
    await putRaw("decks", { id: "broken", name: "" })
    expect((await rejectionOf(renameDeck(db, saved.id, "   "))).code).toBe("invalid-record")
    const gone = await rejectionOf(renameDeck(db, "00000000-0000-4000-8000-ffffffffffff", "Neu"))
    expect(gone.code).toBe("not-found")
    expect((await rejectionOf(renameDeck(db, "broken", "Neu"))).code).toBe("invalid-record")
    // The deck that was gone is not brought back, the damaged one not overwritten.
    expect(await readRaw("decks")).toEqual(expect.arrayContaining([saved, { id: "broken", name: "" }]))
    expect(await readRaw("decks")).toHaveLength(2)
    db.close()
  })
})

describe("duplicating", () => {
  it("a copy under a new id and name: the same cards and the same import, created now", async () => {
    const db = await openTestDatabase()
    const saved = deck({ name: "Izzet", companion: [{ count: 1, name: "Lurrus of the Dream-Den" }] })
    await saveDeck(db, saved)
    const copy = await duplicateDeck(db, saved.id, { id: COPY_ID, name: "Izzet (Kopie)", now: at("2026-09-25T11:00:00.000Z") })
    expect(copy).toEqual({ ...saved, id: COPY_ID, name: "Izzet (Kopie)", createdAt: "2026-09-25T11:00:00.000Z", updatedAt: "2026-09-25T11:00:00.000Z" })
    // The list and when it was imported stay the original's.
    expect(copy.source).toEqual(saved.source)
    expect((await listDecks(db)).records).toEqual([copy, saved].sort((a, b) => a.name.localeCompare(b.name, "de")))
    db.close()
  })

  it("an id that is taken fails and replaces nothing; a deck that is gone cannot be copied", async () => {
    const db = await openTestDatabase()
    const first = deck({ name: "Erstes" })
    const second = deck({ name: "Zweites" })
    await saveDeck(db, first)
    await saveDeck(db, second)
    await expect(duplicateDeck(db, first.id, { id: second.id, name: "Kopie" })).rejects.toMatchObject({ name: "StorageError" })
    expect(await getDeck(db, second.id)).toEqual({ status: "found", deck: second })
    expect((await rejectionOf(duplicateDeck(db, "00000000-0000-4000-8000-ffffffffffff", { id: COPY_ID, name: "Kopie" }))).code).toBe("not-found")
    expect(await readRaw("decks")).toHaveLength(2)
    db.close()
  })
})

describe("replacing (importing a deck's list again)", () => {
  it("new cards, format, name and list; the id and the creation stay; an old companion goes", async () => {
    const db = await openTestDatabase()
    const saved = deck({ name: "Alt", createdAt: "2026-09-01T08:00:00.000Z", companion: [{ count: 1, name: "Lurrus of the Dream-Den" }] })
    await saveDeck(db, saved)
    const next = deck({
      id: saved.id,
      name: "Neu",
      format: "commander",
      main: [{ count: 99, name: "Forest" }],
      commander: [{ count: 1, name: "Valki, God of Lies" }],
      source: { kind: "arena", text: "Commander\n1 Valki, God of Lies\n\nDeck\n99 Forest", importedAt: "2026-09-25T12:00:00.000Z" },
      createdAt: "2026-09-25T12:00:00.000Z",
      updatedAt: "2026-09-25T12:00:00.000Z",
    })
    const replaced = await replaceDeck(db, next)
    expect(replaced).toEqual({ ...next, createdAt: "2026-09-01T08:00:00.000Z" })
    expect("companion" in replaced).toBe(false)
    expect(await readRaw("decks")).toEqual([replaced])
    db.close()
  })

  it("a deck that is gone is not brought back", async () => {
    const db = await openTestDatabase()
    expect((await rejectionOf(replaceDeck(db, deck()))).code).toBe("not-found")
    expect(await readRaw("decks")).toEqual([])
    db.close()
  })
})

describe("deleting", () => {
  it("removes a deck, valid or damaged; a deck already gone is no error", async () => {
    const db = await openTestDatabase()
    const saved = deck()
    await saveDeck(db, saved)
    await putRaw("decks", { id: "broken", name: "" })
    expect(await deleteDeck(db, saved.id)).toBe(true)
    expect(await deleteDeck(db, "broken")).toBe(true)
    expect(await deleteDeck(db, saved.id)).toBe(false)
    expect(await readRaw("decks")).toEqual([])
    db.close()
  })
})

it("every change is announced after it is written (other views and tabs update)", async () => {
  const changes: (readonly StoreName[])[] = []
  const db = await openTestDatabase({ onChange: (stores) => changes.push(stores) })
  const saved = deck()
  await saveDeck(db, saved)
  await renameDeck(db, saved.id, "Neu")
  await duplicateDeck(db, saved.id, { id: COPY_ID, name: "Kopie" })
  await deleteDeck(db, COPY_ID)
  // A refused change announces nothing.
  await rejectionOf(renameDeck(db, COPY_ID, "Weg"))
  expect(changes).toEqual([["decks"], ["decks"], ["decks"], ["decks"]])
  db.close()
})
