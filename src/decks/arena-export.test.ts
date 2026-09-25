// @vitest-environment node
/*
 * A saved deck as an MTG Arena list again: the parts under Arena's headings,
 * Forge's names, Arena's set codes, the companion - and back through the
 * import to the very same deck, without an open line or a question to
 * Scryfall.
 */
import { beforeEach, describe, expect, it } from "vitest"
import type { LocalDatabase } from "@/storage/database"
import type { DeckRecord, SetRecord } from "@/storage/generated/records"
import { installFixtureCatalog } from "@/test/catalog-fixtures"
import { deckList, importedDeck } from "@/test/deck-fixtures"
import { deck as sampleDeck, openTestDatabase } from "@/test/storage-fixtures"
import { parseArenaDeckList } from "./arena-list"
import { arenaList, arenaSetCode, listFileName } from "./arena-export"
import { planDeck } from "./deck-plan"
import { resolveDeckList } from "./deck-resolve"
import { readDeckCards } from "./deck-view"

let db: LocalDatabase

beforeEach(async () => {
  db = await openTestDatabase()
  await installFixtureCatalog(db)
  return () => db.close()
})

const set = (code: string, arenaCode?: string): SetRecord => ({ code, name: code, setType: "expansion", digital: false, cardCount: 1, forgeCodes: [], ...(arenaCode ? { arenaCode } : {}) })

describe("the list", () => {
  it("Arena's headings in Arena's order, Forge's names, printings where known", () => {
    const deck = sampleDeck({
      name: "Rot  und\tWeiß",
      main: [
        { count: 20, name: "Mountain" },
        { count: 4, name: "Lightning Strike", set: "m19", collectorNumber: "152" },
        { count: 1, name: "Island", set: "dom", collectorNumber: "254" },
      ],
      sideboard: [{ count: 1, name: "Lurrus of the Dream-Den", set: "iko", collectorNumber: "226" }],
      companion: [{ count: 1, name: "Lurrus of the Dream-Den", set: "iko", collectorNumber: "226" }],
    })
    expect(arenaList(deck, new Map([["dom", set("dom", "dar")]]))).toBe(
      [
        "About",
        "Name Rot und Weiß",
        "",
        "Companion",
        "1 Lurrus of the Dream-Den (IKO) 226",
        "",
        "Deck",
        "20 Mountain",
        "4 Lightning Strike (M19) 152",
        // Arena's own code for Scryfall's dom.
        "1 Island (DAR) 254",
        "",
        "Sideboard",
        "1 Lurrus of the Dream-Den (IKO) 226",
        "",
      ].join("\n"),
    )
    expect(arenaSetCode("m19", new Map())).toBe("M19")
  })

  it("a commander deck starts with its commander", () => {
    const text = arenaList(sampleDeck({ format: "commander", commander: [{ count: 1, name: "Valki, God of Lies", set: "khm", collectorNumber: "114" }], sideboard: [] }))
    expect(text.split("\n\n").map((block) => block.split("\n")[0])).toEqual(["About", "Commander", "Deck"])
  })
})

describe("back through the import", () => {
  async function roundTrip(file: string): Promise<{ readonly deck: DeckRecord; readonly again: ReturnType<typeof planDeck> }> {
    const deck = await importedDeck(db, deckList(file))
    const text = arenaList(deck, (await readDeckCards(db, [deck])).sets)
    const report = await resolveDeckList(db, parseArenaDeckList(text))
    return { deck, again: planDeck(report) }
  }
  const same = (cards: readonly { readonly count: number; readonly forgeName?: string; readonly name?: string; readonly set?: string | null; readonly collectorNumber?: string | null }[]) =>
    cards.map((card) => [card.count, card.forgeName ?? card.name, card.set ?? null, card.collectorNumber ?? null])

  for (const file of ["arena-constructed.txt", "arena-companion.txt", "arena-brawl.txt"]) {
    it(`${file}: the same deck, every line clear, Scryfall not needed`, async () => {
      const { deck, again } = await roundTrip(file)
      expect(again.blockers).toEqual([])
      expect(again.format).toBe(deck.format)
      expect(same(again.main)).toEqual(same(deck.main))
      expect(same(again.sideboard)).toEqual(same(deck.sideboard))
      expect(same(again.commander)).toEqual(same(deck.commander))
      expect(same(again.companions.map((companion) => companion.card))).toEqual(same(deck.companion ?? []))
    })
  }

  it("the name comes back", async () => {
    const deck = await importedDeck(db, deckList("arena-constructed.txt"), { name: "Mein Izzet" })
    expect(parseArenaDeckList(arenaList(deck)).name).toBe("Mein Izzet")
  })
})

describe("file names", () => {
  it("the deck's name without what file systems refuse", () => {
    expect(listFileName("Izzet Delver")).toBe("Izzet Delver.txt")
    expect(listFileName('Rot/Weiß: "Aggro"?', " (Original)")).toBe("Rot_Weiß_ _Aggro__ (Original).txt")
    expect(listFileName(" .. ")).toBe("deck.txt")
    expect(listFileName("A\u0007B")).toBe("A_B.txt")
  })
})
