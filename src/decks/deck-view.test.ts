// @vitest-environment node
/*
 * A saved deck as the library shows it, on the small real test catalog:
 * every entry with its card (German name where there is one, the name Forge
 * knows otherwise), the parts and counts, how German the cards are, the card
 * that stands for the deck - and which picture an entry shows when the list
 * named a printing.
 */
import { beforeEach, describe, expect, it } from "vitest"
import type { ResolvedPrint } from "@/cards/prints"
import type { LocalDatabase } from "@/storage/database"
import type { DeckRecord, PrintRecord } from "@/storage/generated/records"
import { fixtureCard, installFixtureCatalog } from "@/test/catalog-fixtures"
import { deckList, importedDeck } from "@/test/deck-fixtures"
import { deck as sampleDeck, openTestDatabase, uuid } from "@/test/storage-fixtures"
import { deckOracleIds, DECK_PARTS, EMPTY_INDEX, entryView, needsNamedPrint, pictureOf, readDeckCards, readLibrary, viewDeck, type DeckView } from "./deck-view"
import { saveDeck } from "@/storage/decks"

let db: LocalDatabase

beforeEach(async () => {
  db = await openTestDatabase()
  await installFixtureCatalog(db)
  return () => db.close()
})

async function view(file: string): Promise<DeckView> {
  const deck = await importedDeck(db, deckList(file))
  return viewDeck(deck, await readDeckCards(db, [deck]))
}

/** [count, name as shown, language] per entry of a part. */
const rows = (view: DeckView, part: (typeof DECK_PARTS)[number]) => view.parts[part].map((entry) => [entry.entry.count, entry.name.text, entry.language])

describe("a deck's entries", () => {
  it("German names where the catalog has them, the name Forge knows otherwise; parts and counts", async () => {
    const constructed = await view("arena-constructed.txt")
    expect(rows(constructed, "main")).toEqual([
      [4, "Geheimnisstöberer", "de"],
      [4, "Blitzschlag", "de"],
      [2, "Fire // Ice", "partial"],
      [3, "Knochenmalmer-Riese", "de"],
      [1, "Valki, Gott der Lügen", "de"],
      // Forge knows Hansk by its Universes Beyond name; Scryfall has no German version.
      [1, "Hansk, Slayer Zealot", "en"],
      [2, "Blitzschlag", "de"],
      // Only Forge knows the rebalanced card: its name, no Scryfall data.
      [1, "A-Canopy Tactician", "forge-only"],
      [20, "Wald", "de"],
    ])
    expect(rows(constructed, "sideboard")).toEqual([
      [2, "Akki Lavarunner", "en"],
      [1, "Drake Stone", "forge-only"],
    ])
    expect(constructed.counts).toEqual({ commander: 0, companion: 0, main: 38, sideboard: 3 })
    // The name Forge knows stays with the entry.
    expect(constructed.parts.main[5]?.entry.name).toBe("Daryl, Hunter of Walkers")
  })

  it("commander and companion are parts of their own", async () => {
    const brawl = await view("arena-brawl.txt")
    expect(rows(brawl, "commander")).toEqual([[1, "Valki, Gott der Lügen", "de"]])
    expect(brawl.counts).toEqual({ commander: 1, companion: 0, main: 30, sideboard: 0 })
    const companion = await view("arena-companion.txt")
    expect(rows(companion, "companion")).toEqual([[1, "Bruna, das schwindende Licht", "de"]])
    // It plays from the sideboard, where it is as well.
    expect(rows(companion, "sideboard")[0]).toEqual([1, "Bruna, das schwindende Licht", "de"])
  })

  it("without catalog data: the name Forge knows, marked unknown - never a guessed card", () => {
    const deck = sampleDeck({ main: [{ count: 4, name: "Lightning Bolt", oracleId: fixtureCard("Lightning Bolt").oracleId }] })
    const shown = viewDeck(deck, EMPTY_INDEX)
    expect(rows(shown, "main")).toEqual([[4, "Lightning Bolt", "unknown"]])
    expect(shown.parts.main[0]?.card).toBeNull()
    expect(entryView("main", { count: 1, name: "Everythingamajig" }, EMPTY_INDEX)).toMatchObject({ card: null, forgeOnly: null, language: "unknown", name: { text: "Everythingamajig", lang: "en" } })
  })
})

describe("how German a deck is", () => {
  it("counts distinct cards across the parts, and lists those not entirely German in deck order", async () => {
    const constructed = await view("arena-constructed.txt")
    expect(constructed.language.counts).toEqual({ de: 5, partial: 1, en: 2, "forge-only": 2, unknown: 0 })
    // Lightning Bolt in two printings is one card.
    expect(constructed.language.total).toBe(10)
    expect(constructed.language.notGerman.map((entry) => entry.name.text)).toEqual(["Fire // Ice", "Hansk, Slayer Zealot", "A-Canopy Tactician", "Akki Lavarunner", "Drake Stone"])
    const companion = await view("arena-companion.txt")
    // Bruna as companion, in the main deck and in the sideboard: one card.
    expect(companion.language.total).toBe(4)
  })
})

describe("the card that stands for a deck", () => {
  it("the commander; else the main-deck card of the highest mana value, more copies first", async () => {
    expect((await view("arena-brawl.txt")).cover?.entry.name).toBe("Valki, God of Lies")
    // Fire // Ice (4, two copies) before Hansk (4, one copy); never the lands.
    expect((await view("arena-constructed.txt")).cover?.entry.name).toBe("Fire // Ice")
    expect((await view("arena-companion.txt")).cover?.entry.name).toBe("Bruna, the Fading Light")
  })

  it("without catalog data: the first entry", () => {
    expect(viewDeck(sampleDeck(), EMPTY_INDEX).cover?.entry.name).toBe("Mountain")
  })
})

describe("pictures of printings the list named", () => {
  function print(of: string, set: string, collectorNumber: string, lang: string, imageStatus: PrintRecord["imageStatus"] = "highres_scan"): PrintRecord {
    return { id: uuid(), oracleId: fixtureCard(of).oracleId, name: of, set, collectorNumber, lang, releasedAt: "2020-01-01", imageStatus, imageSides: 1, imageVersion: "1600000000", fetchedAt: "2026-09-25T08:00:00.000Z" }
  }
  const resolved = (original: PrintRecord | null, german: PrintRecord | null): ResolvedPrint => ({ original, german })

  it("Scryfall is asked only for printings the catalog does not carry, and never for Universes Beyond names", async () => {
    const constructed = await view("arena-constructed.txt")
    const asked = DECK_PARTS.flatMap((part) => constructed.parts[part].filter(needsNamedPrint).map((entry) => `${entry.entry.set} ${entry.entry.collectorNumber}`))
    // ELD 115 and 2X2 361 are not among the catalog's usual printings of their cards; MID 47, M11 149 … are.
    expect(asked).toEqual(["eld 115", "2x2 361"])
  })

  it("the named printing in German where it exists; else the card's German picture; else the named printing", async () => {
    const constructed = await view("arena-constructed.txt")
    const bolt = constructed.parts.main[6]!
    // A German version with a real picture wins.
    const german = print("Lightning Bolt", "2x2", "361", "de")
    expect(pictureOf(bolt, resolved(print("Lightning Bolt", "2x2", "361", "en"), german))).toBe(german)
    // A placeholder is no picture: the card's German picture (the default) stands in.
    expect(pictureOf(bolt, resolved(print("Lightning Bolt", "2x2", "361", "en"), print("Lightning Bolt", "2x2", "361", "de", "placeholder")))).toBeNull()
    // Akki Lavarunner has no German picture at all: the named printing, in English.
    const akki = constructed.parts.sideboard[0]!
    const english = print("Akki Lavarunner // Tok-Tok, Volcano Born", "chk", "153", "en")
    expect(pictureOf(akki, resolved(english, null))).toBe(english)
    expect(pictureOf(akki, resolved(null, null))).toBeNull()
    // Nothing asked: the default.
    expect(pictureOf(bolt, undefined)).toBeNull()
  })
})

describe("reading", () => {
  it("the library: every deck with the catalog data of its cards and sets, in one go", async () => {
    const first = await importedDeck(db, deckList("arena-constructed.txt"))
    const second = await importedDeck(db, deckList("arena-brawl.txt"))
    await saveDeck(db, first)
    await saveDeck(db, second)
    const library = await readLibrary(db)
    expect(library.decks.records.map((deck) => deck.name)).toEqual(["Izzet Delver", "Valki Brawl"])
    expect([...library.index.cards.values()].map((card) => card.name)).toEqual(expect.arrayContaining(["Lightning Bolt", "Valki, God of Lies // Tibalt, Cosmic Impostor"]))
    expect([...library.index.forgeOnly.keys()].sort()).toEqual(["A-Canopy Tactician", "Drake Stone"])
    expect(library.index.sets.get("khm")?.name).toBeDefined()
  })

  it("a deck's cards", async () => {
    const deck: DeckRecord = await importedDeck(db, deckList("arena-companion.txt"))
    expect([...deckOracleIds(deck)].sort()).toEqual(
      [fixtureCard("Bruna, the Fading Light").oracleId, fixtureCard("Lightning Bolt").oracleId, fixtureCard("Forest").oracleId, fixtureCard("Akki Lavarunner // Tok-Tok, Volcano Born").oracleId].sort(),
    )
  })
})
