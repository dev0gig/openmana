// @vitest-environment node
/*
 * Searching, filtering and sorting the library (the query in the address),
 * on decks of the small real test catalog - and naming copies.
 */
import { beforeEach, describe, expect, it } from "vitest"
import type { LocalDatabase } from "@/storage/database"
import { installFixtureCatalog } from "@/test/catalog-fixtures"
import { deckList, importedDeck } from "@/test/deck-fixtures"
import { deck as sampleDeck, openTestDatabase } from "@/test/storage-fixtures"
import { EMPTY_INDEX, readDeckCards, viewDeck, type DeckView } from "./deck-view"
import { arrangeDecks, deckMatches, DEFAULT_QUERY, formatsPresent, paramsFromQuery, queryFromParams } from "./library"
import { copyName } from "./library-labels"

let db: LocalDatabase

beforeEach(async () => {
  db = await openTestDatabase()
  await installFixtureCatalog(db)
  return () => db.close()
})

async function views(...files: string[]): Promise<DeckView[]> {
  const decks = await Promise.all(files.map((file) => importedDeck(db, deckList(file))))
  const index = await readDeckCards(db, decks)
  return decks.map((deck) => viewDeck(deck, index))
}

const names = (shown: readonly DeckView[]) => shown.map((view) => view.deck.name)

describe("the query in the address", () => {
  it("round trip, defaults left out, unknown values fall back", () => {
    const query = { text: "Blitz", format: "commander", sort: "updated" } as const
    expect(queryFromParams(paramsFromQuery(query))).toEqual(query)
    expect(paramsFromQuery(DEFAULT_QUERY).toString()).toBe("")
    expect(queryFromParams(new URLSearchParams("format=vintage&sort=colour"))).toEqual(DEFAULT_QUERY)
  })
})

describe("search", () => {
  it("finds a deck by its name, ignoring case and accents", async () => {
    const [izzet] = await views("arena-constructed.txt")
    expect(deckMatches(izzet!, "izzet")).toBe(true)
    expect(deckMatches(izzet!, "DELVER")).toBe(true)
    expect(deckMatches(izzet!, "  ")).toBe(true)
    expect(deckMatches(izzet!, "Golgari")).toBe(false)
  })

  it("finds a deck by any name of its cards: English, German, a face, the name Forge knows", async () => {
    const [izzet, brawl] = await views("arena-constructed.txt", "arena-brawl.txt")
    for (const text of ["Blitzschlag", "lightning", "Geheimnisstöberer", "Insectile Aberration", "Knochenmalmer", "Daryl", "hansk", "A-Canopy", "gott der lugen"]) {
      expect(deckMatches(izzet!, text), text).toBe(true)
    }
    // Akki Lavarunner is only in the Izzet deck's sideboard; Tibalt is Valki's back face.
    expect(names(arrangeDecks([izzet!, brawl!], { ...DEFAULT_QUERY, text: "Akki" }))).toEqual(["Izzet Delver"])
    expect(names(arrangeDecks([izzet!, brawl!], { ...DEFAULT_QUERY, text: "Tibalt" }))).toEqual(["Izzet Delver", "Valki Brawl"])
  })

  it("without catalog data, by the names Forge knows", () => {
    const shown = viewDeck(sampleDeck({ name: "Rot" }), EMPTY_INDEX)
    expect(deckMatches(shown, "strike")).toBe(true)
    expect(deckMatches(shown, "Blitzschlag")).toBe(false)
  })
})

describe("filter and order", () => {
  it("by format", async () => {
    const all = await views("arena-constructed.txt", "arena-brawl.txt", "arena-companion.txt")
    expect(formatsPresent(all).sort()).toEqual(["commander", "constructed"])
    expect(names(arrangeDecks(all, { ...DEFAULT_QUERY, format: "commander" }))).toEqual(["Valki Brawl"])
    expect(names(arrangeDecks(all, { ...DEFAULT_QUERY, format: "constructed" }))).toEqual(["Izzet Delver", "Test-Deck"])
  })

  it("by name (German order, numbers as numbers), last changed or last created", () => {
    const deck = (name: string, createdAt: string, updatedAt: string) => viewDeck(sampleDeck({ name, createdAt, updatedAt }), EMPTY_INDEX)
    const all = [
      deck("Deck 10", "2026-09-20T10:00:00.000Z", "2026-09-21T10:00:00.000Z"),
      deck("Ärger", "2026-09-22T10:00:00.000Z", "2026-09-22T10:00:00.000Z"),
      deck("Deck 2", "2026-09-21T10:00:00.000Z", "2026-09-25T10:00:00.000Z"),
      deck("Zorn", "2026-09-19T10:00:00.000Z", "2026-09-19T10:00:00.000Z"),
    ]
    expect(names(arrangeDecks(all, { ...DEFAULT_QUERY, sort: "name" }))).toEqual(["Ärger", "Deck 2", "Deck 10", "Zorn"])
    expect(names(arrangeDecks(all, { ...DEFAULT_QUERY, sort: "updated" }))).toEqual(["Deck 2", "Ärger", "Deck 10", "Zorn"])
    expect(names(arrangeDecks(all, { ...DEFAULT_QUERY, sort: "created" }))).toEqual(["Ärger", "Deck 2", "Deck 10", "Zorn"])
  })
})

describe("naming a copy", () => {
  it("the first free name: (Kopie), (Kopie 2) …; a copy of a copy counts on", () => {
    expect(copyName("Izzet", ["Izzet"])).toBe("Izzet (Kopie)")
    expect(copyName("Izzet", ["Izzet", "izzet (kopie)"])).toBe("Izzet (Kopie 2)")
    expect(copyName("Izzet (Kopie)", ["Izzet", "Izzet (Kopie)"])).toBe("Izzet (Kopie 2)")
    expect(copyName("Izzet (Kopie 2)", ["Izzet", "Izzet (Kopie)", "Izzet (Kopie 2)"])).toBe("Izzet (Kopie 3)")
  })
})
