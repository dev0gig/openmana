// @vitest-environment node
/*
 * From the checked list to the saved deck: sections, adding up, the
 * companion in the sideboard, the format, what blocks saving, lines left
 * out - and a DeckRecord that passes the local data schema unchanged.
 */
import fs from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { assertRecord, type LocalDatabase } from "@/storage/database"
import { fixtureCard, installFixtureCatalog } from "@/test/catalog-fixtures"
import { openTestDatabase } from "@/test/storage-fixtures"
import { parseArenaDeckList } from "./arena-list"
import { deckRecordFrom, planDeck, plannedCount, type DeckPlan } from "./deck-plan"
import { resolveDeckList } from "./deck-resolve"

let db: LocalDatabase

beforeEach(async () => {
  db = await openTestDatabase()
  await installFixtureCatalog(db)
  return () => db.close()
})

const fixture = (name: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8")
const check = async (text: string) => resolveDeckList(db, parseArenaDeckList(text))
const cards = (section: DeckPlan["main"]) => section.map((c) => [c.count, c.forgeName, c.set, c.collectorNumber])
const NOW = "2026-09-25T09:00:00.000Z"
const ID = "11111111-2222-4333-8444-555555555555"

describe("planning the deck", () => {
  it("an Arena export: sections, printings, adding up the same printing", async () => {
    const report = await check(`${fixture("arena-constructed.txt")}\n\nDeck\n2 Lightning Bolt (M11) 149\n`)
    const plan = planDeck(report)
    expect(plan.blockers).toEqual([])
    expect(plan.format).toBe("constructed")
    expect(cards(plan.main)).toEqual([
      [4, "Delver of Secrets", "mid", "47"],
      [6, "Lightning Bolt", "m11", "149"],
      // MH2 is unknown to the test catalog: no printing is kept.
      [2, "Fire // Ice", null, null],
      [3, "Bonecrusher Giant", "eld", "115"],
      [1, "Valki, God of Lies", "khm", "114"],
      [1, "Daryl, Hunter of Walkers", "slx", "22"],
      // Another printing of the same card stays its own entry (Forge adds them up).
      [2, "Lightning Bolt", "2x2", "361"],
      [1, "A-Canopy Tactician", "khm", "378"],
      [20, "Forest", "neo", "292"],
    ])
    expect(plan.main[1]?.lines).toEqual([6, 21])
    expect(cards(plan.sideboard)).toEqual([
      [2, "Akki Lavarunner", "chk", "153"],
      [1, "Drake Stone", "m11", "213"],
    ])
    expect(plannedCount(plan.main)).toBe(40)
    expect(plan.companions).toEqual([])
  })

  it("the catalog's printing gives Scryfall's id where it is one of the card's usual printings", async () => {
    const plan = planDeck(await check("4 Lightning Bolt (M11) 149\n1 Forest (NEO) 292\n1 Forest (NEO) 1"))
    const bolt = fixtureCard("Lightning Bolt")
    const forest = fixtureCard("Forest")
    expect(plan.main.map((c) => c.scryfallId)).toEqual([bolt.prints.fallback!.id, forest.prints.fallback!.id, null])
  })

  it("a companion Arena also lists in the sideboard stays there once", async () => {
    const plan = planDeck(await check(fixture("arena-companion.txt")))
    expect(plan.blockers).toEqual([])
    expect(plan.companions.map((c) => [c.entry.forgeName, c.addedToSideboard])).toEqual([["Bruna, the Fading Light", false]])
    expect(cards(plan.sideboard)).toEqual([
      [1, "Bruna, the Fading Light", "emn", "15"],
      [2, "Akki Lavarunner", "chk", "153"],
    ])
  })

  it("a companion missing from the sideboard is added there (Forge looks for it there)", async () => {
    const plan = planDeck(await check("Companion\n1 Bruna, the Fading Light (EMN) 15\n\nDeck\n20 Forest"))
    expect(plan.companions.map((c) => c.addedToSideboard)).toEqual([true])
    expect(cards(plan.sideboard)).toEqual([[1, "Bruna, the Fading Light", "emn", "15"]])
    expect(cards(plan.main)).toEqual([[20, "Forest", null, null]])
  })

  it("a commander makes it a Commander deck", async () => {
    const plan = planDeck(await check(fixture("arena-brawl.txt")))
    expect(plan.format).toBe("commander")
    expect(cards(plan.commander)).toEqual([[1, "Valki, God of Lies", "khm", "114"]])
    expect(plannedCount(plan.main)).toBe(30)
  })
})

describe("what blocks saving", () => {
  it("every open line blocks, in the order of the list", async () => {
    const plan = planDeck(await check(`${fixture("arena-german.txt")}\nfour Forest\n1 Joven and Chandler`))
    expect(plan.blockers.map((b) => (b.kind === "entry" ? [b.kind, b.entry.entry.line, b.entry.status] : b.kind === "line" ? [b.kind, b.problem.line] : [b.kind]))).toEqual([
      ["entry", 10, "not-in-forge"],
      ["line", 12],
      ["entry", 13, "ambiguous"],
    ])
    expect(() => deckRecordFrom(plan, { id: ID, name: "Test", text: "", now: NOW })).toThrow(/cannot be saved yet: 3/)
  })

  it("left-out lines do not block and are not in the deck", async () => {
    const report = await check(`${fixture("arena-german.txt")}\nfour Forest\n1 Joven and Chandler`)
    const plan = planDeck(report, new Set([10, 12, 13]))
    expect(plan.blockers).toEqual([])
    expect(plan.leftOut.entries.map((e) => e.entry.line)).toEqual([10, 13])
    expect(plan.leftOut.problems.map((p) => p.line)).toEqual([12])
    expect(plan.sideboard).toEqual([])
  })

  it("an empty main deck blocks", async () => {
    const plan = planDeck(await check("Sideboard\n2 Forest"))
    expect(plan.blockers).toEqual([{ kind: "empty-main" }])
    expect(planDeck(await check("4 Lightning Bolt"), new Set([1])).blockers).toEqual([{ kind: "empty-main" }])
    expect(planDeck(await check("")).blockers).toEqual([{ kind: "empty-main" }])
  })
})

describe("the saved record", () => {
  it("is a valid DeckRecord: Forge names, identities, the list unchanged", async () => {
    const text = fixture("arena-constructed.txt")
    const record = deckRecordFrom(planDeck(await check(text)), { id: ID, name: "  Izzet Delver  ", text, now: NOW })
    expect(assertRecord("decks", record)).toBe(record)
    expect(record).toMatchObject({ id: ID, name: "Izzet Delver", format: "constructed", commander: [], createdAt: NOW, updatedAt: NOW })
    expect(record.source).toEqual({ kind: "arena", text, importedAt: NOW })
    const bolt = fixtureCard("Lightning Bolt")
    expect(record.main[1]).toEqual({ count: 4, name: "Lightning Bolt", set: "m11", collectorNumber: "149", oracleId: bolt.oracleId, scryfallId: bolt.prints.fallback!.id })
    // Forge-only cards have no Scryfall identity; a line without known printing has none either.
    expect(record.main[7]).toEqual({ count: 1, name: "A-Canopy Tactician", set: "khm", collectorNumber: "378" })
    expect(record.main[2]).toEqual({ count: 2, name: "Fire // Ice", oracleId: fixtureCard("Fire // Ice").oracleId })
  })

  it("a commander deck with its commander", async () => {
    const text = fixture("arena-brawl.txt")
    const record = deckRecordFrom(planDeck(await check(text)), { id: ID, name: "Valki", text, now: NOW })
    expect(assertRecord("decks", record).format).toBe("commander")
    expect(record.commander.map((c) => [c.count, c.name])).toEqual([[1, "Valki, God of Lies"]])
  })

  it("needs a name", async () => {
    const plan = planDeck(await check("4 Lightning Bolt"))
    expect(() => deckRecordFrom(plan, { id: ID, name: "   ", text: "4 Lightning Bolt", now: NOW })).toThrow(/needs a name/)
  })
})
