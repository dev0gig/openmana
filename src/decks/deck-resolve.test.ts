// @vitest-environment node
/*
 * Which card a line means: through the real (small) card catalog of the
 * tests - English and German names, faces, aliases, Forge's names, cards
 * only Forge knows, cards Forge does not know, tokens, Arena's set codes -
 * and through a printing where the catalog cannot decide (Scryfall asked
 * through a stand-in that answers like ensurePrints).
 */
import fs from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { CardMatch } from "@/cards/card-lookup"
import { CardDataError } from "@/cards/errors"
import { printKey, type PrintKey, type ResolvedPrint } from "@/cards/prints"
import type { LocalDatabase } from "@/storage/database"
import type { CardRecord, PrintRecord } from "@/storage/generated/records"
import { fixtureCard, installFixtureCatalog } from "@/test/catalog-fixtures"
import { card, openTestDatabase, uuid } from "@/test/storage-fixtures"
import { parseArenaDeckList } from "./arena-list"
import { decideName, resolveDeckList, type DeckImportReport, type EntryReport, type PrintLookup } from "./deck-resolve"

let db: LocalDatabase

beforeEach(async () => {
  db = await openTestDatabase()
  await installFixtureCatalog(db)
  return () => db.close()
})

const fixture = (name: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8")
const resolve = (text: string, options?: Parameters<typeof resolveDeckList>[2]) => resolveDeckList(db, parseArenaDeckList(text), options)

/** [written name, status, Forge name, how] per entry. */
const outcome = (report: DeckImportReport) => report.entries.map((e) => [e.entry.name, e.status, e.forgeName, e.by])
const notes = (entry: EntryReport | undefined) => entry?.notes.map((note) => note.kind)

/** A printing as ensurePrints returns it. */
function printOf(of: CardRecord, set: string, collectorNumber: string): PrintRecord {
  return {
    id: uuid(),
    oracleId: of.oracleId,
    name: of.name,
    set,
    collectorNumber,
    lang: "en",
    releasedAt: "2020-01-01",
    imageStatus: "highres_scan",
    imageSides: 1,
    imageVersion: "1600000000",
    fetchedAt: "2026-09-25T08:00:00.000Z",
  }
}

/** A Scryfall stand-in: answers the printings it knows, records what it was asked. */
function scryfall(known: readonly PrintRecord[], error: CardDataError | null = null) {
  const asked: PrintKey[][] = []
  const lookup: PrintLookup = async (keys) => {
    asked.push([...keys])
    const prints = new Map<string, ResolvedPrint>()
    for (const key of keys) {
      const original = error ? null : (known.find((print) => printKey(print) === printKey(key)) ?? null)
      prints.set(printKey(key), { original, german: null })
    }
    return { prints, error }
  }
  return { lookup, asked }
}

describe("names through the card catalog", () => {
  it("an English Arena export: every card to the name Forge knows", async () => {
    const report = await resolve(fixture("arena-constructed.txt"))
    expect(outcome(report)).toEqual([
      ["Delver of Secrets", "resolved", "Delver of Secrets", "name"],
      ["Lightning Bolt", "resolved", "Lightning Bolt", "name"],
      ["Fire // Ice", "resolved", "Fire // Ice", "name"],
      ["Bonecrusher Giant", "resolved", "Bonecrusher Giant", "name"],
      ["Valki, God of Lies", "resolved", "Valki, God of Lies", "name"],
      // Universes Beyond: Scryfall's name, Forge knows the printed one.
      ["Hansk, Slayer Zealot", "resolved", "Daryl, Hunter of Walkers", "name"],
      ["Lightning Bolt", "resolved", "Lightning Bolt", "name"],
      // MTG Arena's rebalanced card: Scryfall has no data, Forge has the card.
      ["A-Canopy Tactician", "resolved", "A-Canopy Tactician", "forge-only"],
      ["Forest", "resolved", "Forest", "name"],
      ["Akki Lavarunner", "resolved", "Akki Lavarunner", "name"],
      ["Drake Stone", "resolved", "Drake Stone", "forge-only"],
    ])
    const delver = report.entries[0]!
    expect(delver.card?.name).toBe("Delver of Secrets // Insectile Aberration")
    expect(delver.match).toMatchObject({ kind: "face", face: 0 })
    expect(delver.printing).toMatchObject({ written: "MID", collectorNumber: "47", set: { code: "mid" }, print: null })
    // MH2 is not in the test catalog's sets: the line still resolves, the picture is the usual one.
    expect(report.entries[2]?.notes).toEqual([{ kind: "set-unknown", set: "MH2" }])
    expect(report.entries[7]?.forgeOnly?.reason).toBe("rebalanced")
    expect(report.printsAsked).toBe(0)
  })

  it("a German Arena export: German names, a card Forge does not know", async () => {
    const report = await resolve(fixture("arena-german.txt"))
    expect(outcome(report)).toEqual([
      ["Valki, Gott der Lügen", "resolved", "Valki, God of Lies", "printed"],
      ["Blitzschlag", "resolved", "Lightning Bolt", "printed"],
      ["Geheimnisstöberer", "resolved", "Delver of Secrets", "printed"],
      ["Wald", "resolved", "Forest", "printed"],
      ["Streitlustiges Tanzpaar", "not-in-forge", null, "printed"],
    ])
    expect(report.entries[4]?.card?.name).toBe("Ballroom Brawlers")
  })

  it("later faces find the whole card and say so", async () => {
    const report = await resolve("1 Tibalt, Cosmic Impostor\n1 Insectile Aberration\n1 Stomp\n1 Thibalt, kosmischer Hochstapler")
    expect(outcome(report).map(([, status, forgeName]) => [status, forgeName])).toEqual([
      ["resolved", "Valki, God of Lies"],
      ["resolved", "Delver of Secrets"],
      ["resolved", "Bonecrusher Giant"],
      ["resolved", "Valki, God of Lies"],
    ])
    expect(report.entries.slice(0, 3).map(notes)).toEqual([["back-face"], ["back-face"], ["back-face"]])
  })

  it("aliases and Forge's own names", async () => {
    const report = await resolve("1 Hadoken\n1 Daryl, Hunter of Walkers\n1 P-Joven and Chandler")
    expect(outcome(report)).toEqual([
      ["Hadoken", "resolved", "Lightning Bolt", "name"],
      ["Daryl, Hunter of Walkers", "resolved", "Daryl, Hunter of Walkers", "name"],
      ["P-Joven and Chandler", "resolved", "P-Joven and Chandler", "name"],
    ])
    expect(report.entries[0]?.match?.kind).toBe("alias")
  })

  it("cards Forge does not know, tokens and unknown names are never resolved", async () => {
    const report = await resolve("1 Tornellan Protector\n1 Brisela, Voice of Nightmares\n2 Goblin\n1 Zzyzx the Unprinted\n1 A-Zzyzx")
    expect(outcome(report).map(([name, status]) => [name, status])).toEqual([
      ["Tornellan Protector", "not-in-forge"],
      ["Brisela, Voice of Nightmares", "not-in-forge"],
      ["Goblin", "unresolved"],
      ["Zzyzx the Unprinted", "unresolved"],
      ["A-Zzyzx", "unresolved"],
    ])
    expect(report.entries.map(notes)).toEqual([[], [], ["token"], [], ["rebalanced-name"]])
  })

  it("two cards Forge knows under one name: ambiguous, the player chooses", async () => {
    const report = await resolve("1 Joven and Chandler")
    const entry = report.entries[0]!
    expect(entry.status).toBe("ambiguous")
    expect(entry.forgeName).toBeNull()
    expect(entry.candidates.map((c) => c.card.forgeNames[0]).sort()).toEqual(["Joven and Chandler", "P-Joven and Chandler"])
    const playtest = entry.candidates.find((c) => c.card.forgeNames[0] === "P-Joven and Chandler")!
    const chosen = await resolve("1 Joven and Chandler", { choices: new Map([[entry.key, playtest.card.oracleId]]) })
    expect(outcome(chosen)).toEqual([["Joven and Chandler", "resolved", "P-Joven and Chandler", "choice"]])
    expect(notes(chosen.entries[0])).toEqual(["chosen"])
    // A choice that is not one of the candidates changes nothing.
    const void_ = await resolve("1 Joven and Chandler", { choices: new Map([[entry.key, fixtureCard("Forest").oracleId]]) })
    expect(void_.entries[0]?.status).toBe("ambiguous")
  })

  it("maps Arena's set codes to Scryfall's", async () => {
    const report = await resolve("1 Forest (DAR) 266\n1 Forest (dom) 266\n1 Forest (XYZ) 1\n1 Forest (NEO)")
    expect(report.entries.map((e) => e.printing?.set?.code ?? null)).toEqual(["dom", "dom", null, "neo"])
    expect(report.entries.map((e) => e.status)).toEqual(["resolved", "resolved", "resolved", "resolved"])
    expect(report.entries.slice(2).map((e) => e.notes)).toEqual([[{ kind: "set-unknown", set: "XYZ" }], [{ kind: "set-without-number", set: "NEO" }]])
  })
})

describe("printings, where the catalog cannot decide", () => {
  it("a name in another language: set and collector number identify the card", async () => {
    const bolt = fixtureCard("Lightning Bolt")
    const { lookup, asked } = scryfall([printOf(bolt, "m11", "149")])
    const report = await resolve("4 Foudre (M11) 149\n4 Lightning Bolt (M11) 149", { lookupPrints: lookup })
    expect(outcome(report)).toEqual([
      ["Foudre", "resolved", "Lightning Bolt", "print"],
      ["Lightning Bolt", "resolved", "Lightning Bolt", "name"],
    ])
    expect(notes(report.entries[0])).toEqual(["print-identified"])
    expect(report.entries[0]?.printing?.print?.oracleId).toBe(bolt.oracleId)
    // Only the line the catalog could not decide was asked about.
    expect(asked).toEqual([[{ set: "m11", collectorNumber: "149" }]])
    expect(report.printsAsked).toBe(1)
  })

  it("the printing decides between cards of one name", async () => {
    const mbc = (await resolve("1 Joven and Chandler")).entries[0]!.candidates.find((c) => c.card.forgeNames[0] === "Joven and Chandler")!.card
    const { lookup } = scryfall([printOf(mbc, "mbc", "24")])
    const report = await resolve("1 Joven and Chandler (MBC) 24", { lookupPrints: lookup })
    expect(outcome(report)).toEqual([["Joven and Chandler", "resolved", "Joven and Chandler", "print"]])
    expect(notes(report.entries[0])).toEqual(["print-decided"])
  })

  it("a printing of another card, an unknown printing, Scryfall unreachable: the line stays open and says why", async () => {
    const forest = fixtureCard("Forest")
    const other = await resolve("1 Zzyzx (M11) 149\n1 Joven and Chandler (M11) 149", { lookupPrints: scryfall([printOf(forest, "m11", "149")]).lookup })
    expect(other.entries.map((e) => e.status)).toEqual(["resolved", "ambiguous"])
    // Unresolved + a printing: the printing's card (the name was simply not found) - but never for a mismatching candidate.
    expect(other.entries[0]?.forgeName).toBe("Forest")
    expect(other.entries[1]?.notes).toContainEqual({ kind: "print-other-card", card: "Forest" })

    const missing = await resolve("1 Zzyzx (M11) 999", { lookupPrints: scryfall([]).lookup })
    expect(missing.entries[0]?.status).toBe("unresolved")
    expect(notes(missing.entries[0])).toEqual(["print-missing"])

    const offline = await resolve("1 Zzyzx (M11) 149", { lookupPrints: scryfall([], new CardDataError("scryfall-unreachable", "offline")).lookup })
    expect(offline.entries[0]?.status).toBe("unresolved")
    expect(notes(offline.entries[0])).toEqual(["print-unreachable"])
    expect(offline.printError?.code).toBe("scryfall-unreachable")
  })

  it("never asks about resolved lines, unknown sets, lines without number or rebalanced names", async () => {
    const { lookup, asked } = scryfall([])
    const report = await resolve("4 Lightning Bolt (M11) 149\n1 Zzyzx (XYZ) 1\n1 Zzyzx (M11)\n1 A-Zzyzx (M11) 5\n1 Zzyzx", { lookupPrints: lookup })
    expect(asked).toEqual([])
    expect(report.printsAsked).toBe(0)
  })

  it("without Scryfall (no lookup given) nothing is asked and nothing guessed", async () => {
    const report = await resolve("4 Foudre (M11) 149")
    expect(report.entries[0]?.status).toBe("unresolved")
    expect(report.entries[0]?.notes).toEqual([])
  })
})

describe("importing a deck's list again", () => {
  const candidates = async () => (await resolve("1 Joven and Chandler")).entries[0]!.candidates
  const oracleOf = async (forgeName: string) => (await candidates()).find((c) => c.card.forgeNames[0] === forgeName)!.card.oracleId

  it("an open name becomes the card the deck already has", async () => {
    const playtest = await oracleOf("P-Joven and Chandler")
    const report = await resolve("1 Joven and Chandler\n4 Lightning Bolt", { previous: new Set([playtest, fixtureCard("Lightning Bolt").oracleId]) })
    expect(outcome(report)).toEqual([
      ["Joven and Chandler", "resolved", "P-Joven and Chandler", "previous"],
      ["Lightning Bolt", "resolved", "Lightning Bolt", "name"],
    ])
    expect(notes(report.entries[0])).toEqual(["previous"])
    // The other card stays offered.
    expect(report.entries[0]?.candidates).toHaveLength(2)
  })

  it("a choice made now wins; a deck with both cards, or with neither, leaves the choice open", async () => {
    const [playtest, real] = [await oracleOf("P-Joven and Chandler"), await oracleOf("Joven and Chandler")]
    const key = (await resolve("1 Joven and Chandler")).entries[0]!.key
    const chosen = await resolve("1 Joven and Chandler", { previous: new Set([playtest]), choices: new Map([[key, real]]) })
    expect(outcome(chosen)).toEqual([["Joven and Chandler", "resolved", "Joven and Chandler", "choice"]])
    expect((await resolve("1 Joven and Chandler", { previous: new Set([playtest, real]) })).entries[0]?.status).toBe("ambiguous")
    expect((await resolve("1 Joven and Chandler", { previous: new Set([fixtureCard("Forest").oracleId]) })).entries[0]?.status).toBe("ambiguous")
  })

  it("a printing that decides wins over the deck", async () => {
    const mbc = (await candidates()).find((c) => c.card.forgeNames[0] === "Joven and Chandler")!.card
    const { lookup } = scryfall([printOf(mbc, "mbc", "24")])
    const report = await resolve("1 Joven and Chandler (MBC) 24", { lookupPrints: lookup, previous: new Set([await oracleOf("P-Joven and Chandler")]) })
    expect(outcome(report)).toEqual([["Joven and Chandler", "resolved", "Joven and Chandler", "print"]])
  })
})

describe("deciding a name (the rules)", () => {
  const match = (candidates: readonly CardMatch[]) => candidates.map((c) => c.card.name)

  it("the card's own name beats a face of another card", () => {
    const bolt = card({ name: "Lightning Bolt", forgeNames: ["Lightning Bolt"], nameKeys: ["lightning bolt"] })
    const prepared = card({
      name: "Emeritus of Conflict // Lightning Bolt",
      layout: "prepare",
      faces: [{ name: "Emeritus of Conflict" }, { name: "Lightning Bolt" }],
      forgeNames: ["Emeritus of Conflict"],
      nameKeys: ["emeritus of conflict // lightning bolt", "emeritus of conflict", "lightning bolt"],
    })
    const decision = decideName("Lightning Bolt", { cards: [prepared, bolt], forgeOnly: null })
    expect([decision.status, decision.forgeName, decision.notes]).toEqual(["resolved", "Lightning Bolt", []])
  })

  it("an old German name of two cards: ambiguous between the two", () => {
    const duress = card({ name: "Duress", forgeNames: ["Duress"], nameKeys: ["duress", "zwang"], de: { faces: [{ name: "Zwang" }], set: "7ed", collectorNumber: "129", releasedAt: "2001-04-11" } })
    const coercion = card({ name: "Coercion", forgeNames: ["Coercion"], nameKeys: ["coercion", "zwang"], de: { faces: [{ name: "Zwang" }], set: "6ed", collectorNumber: "115", releasedAt: "1999-04-21" } })
    const decision = decideName("Zwang", { cards: [duress, coercion], forgeOnly: null })
    expect(decision.status).toBe("ambiguous")
    expect(match(decision.candidates).sort()).toEqual(["Coercion", "Duress"])
  })

  it("an English name that is another card's German name: the English card, the other one offered", () => {
    const english = card({ name: "Sturmgeist", forgeNames: ["Sturmgeist"], nameKeys: ["sturmgeist"] })
    const german = card({ name: "Storm Spirit", forgeNames: ["Storm Spirit"], nameKeys: ["storm spirit", "sturmgeist"], de: { faces: [{ name: "Sturmgeist" }], set: "ptk", collectorNumber: "1", releasedAt: "1999-05-01" } })
    const decision = decideName("Sturmgeist", { cards: [german, english], forgeOnly: null })
    expect([decision.status, decision.forgeName, decision.notes]).toEqual(["resolved", "Sturmgeist", [{ kind: "also-printed" }]])
    expect(match(decision.candidates)).toEqual(["Sturmgeist", "Storm Spirit"])
  })

  it("variants of one Forge card: that Forge card, the variant open", () => {
    const variants = [1, 2, 3].map(() => card({ name: "Everythingamajig", forgeNames: ["Everythingamajig"], nameKeys: ["everythingamajig"] }))
    const decision = decideName("Everythingamajig", { cards: variants, forgeOnly: null })
    expect([decision.status, decision.forgeName, decision.card, decision.notes]).toEqual(["resolved", "Everythingamajig", null, [{ kind: "variants", count: 3 }]])
  })

  it("several cards of one name, one of them known to Forge: that one", () => {
    const real = card({ name: "Red Herring", forgeNames: ["Red Herring"], nameKeys: ["red herring"] })
    const playtest = card({ name: "Red Herring", forgeNames: [], nameKeys: ["red herring"] })
    const decision = decideName("Red Herring", { cards: [playtest, real], forgeOnly: null })
    expect([decision.status, decision.card?.oracleId, decision.notes]).toEqual(["resolved", real.oracleId, [{ kind: "forge-known", others: 1 }]])
  })

  it("a Scryfall card Forge does not know, and a Forge-only card of the same name: the Forge card", () => {
    const scryfallOnly = card({ name: "Drake Stone", forgeNames: [], nameKeys: ["drake stone"] })
    const decision = decideName("Drake Stone", { cards: [scryfallOnly], forgeOnly: { name: "Drake Stone", nameKeys: ["drake stone"], reason: "listed" } })
    expect([decision.status, decision.by, decision.forgeName]).toEqual(["resolved", "forge-only", "Drake Stone"])
  })
})
