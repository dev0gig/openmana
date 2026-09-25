// @vitest-environment node
/*
 * The card catalog builder on real Scryfall and Forge data (cards/fixtures):
 * which printings are shown, which German text is taken, how Forge's cards
 * are matched, and that it refuses what it cannot explain.
 */
import path from "node:path"
import { describe, expect, it } from "vitest"
import { nameKey } from "../../src/cards/names.ts"
import type { ScryfallCard } from "../../src/cards/scryfall/generated/records.ts"
import { buildFixtureCatalog, fixtureCard, fixtureCards, fixtureCatalogFile, FIXTURES } from "./fixtures.ts"
import { CatalogBuilder, CatalogError, compareCandidates } from "./catalog.ts"
import { readForgeCardDatabase } from "./forge-cards.ts"
import { readSets } from "./scryfall-bulk.ts"

const catalog = buildFixtureCatalog()
const card = (name: string) => fixtureCard(name, catalog)

describe("records", () => {
  it("one record per Oracle identity, sorted, no Art Series and no reversible printings", () => {
    const ids = catalog.cards.map((record) => record.oracleId)
    expect(ids).toEqual([...ids].sort())
    expect(new Set(ids).size).toBe(ids.length)
    expect(catalog.cards.some((record) => record.layout === "art_series" || record.layout === "reversible_card")).toBe(false)
    expect(catalog.report.skippedPrintings).toBe(3)
  })

  it("German default printing: a real picture, highres before lowres; placeholders never count", () => {
    const bolt = card("Lightning Bolt")
    expect(bolt.prints.de).toMatchObject({ lang: "de", set: "tle", imageStatus: "highres_scan", imageSides: 1 })
    expect(bolt.prints.de?.imageVersion).toMatch(/^\d+$/)
    expect(bolt.prints.fallback).toMatchObject({ lang: "en", imageStatus: "highres_scan" })
    // The Secret Lair printing with a flavour name is a promo-free alias printing, not the default.
    expect(bolt.prints.fallback?.set).not.toBe("sld")
  })

  it("a German printing without picture gives text, never the picture", () => {
    const brawlers = card("Ballroom Brawlers")
    expect(brawlers.prints.de).toBeNull()
    expect(brawlers.prints.fallback).toMatchObject({ lang: "en", imageSides: 1 })
    expect(brawlers.de?.faces[0]?.name).toBe("Streitlustiges Tanzpaar")
    expect(brawlers.nameKeys).toContain("streitlustiges tanzpaar")
  })

  it("German text: only fields that are really translated count (Scryfall has English 'printed' texts on some German printings)", () => {
    const forest = card("Forest")
    expect(forest.de?.faces[0]).toMatchObject({ name: "Wald" })
    expect(forest.nameKeys).toEqual(["forest", "wald"])
    const delver = card("Delver of Secrets // Insectile Aberration")
    expect(delver.de?.faces.map((face) => face.name)).toEqual(["Geheimnisstöberer", "Insekten-Scheußlichkeit"])
    expect(delver.nameKeys).toEqual(
      expect.arrayContaining(["delver of secrets", "insectile aberration", "geheimnisstoberer", "insekten-scheusslichkeit", "geheimnisstoberer // insekten-scheusslichkeit"]),
    )
  })

  it("double-faced cards: two faces with their own colours, a picture per side", () => {
    const delver = card("Delver of Secrets // Insectile Aberration")
    expect(delver.layout).toBe("transform")
    expect(delver.faces.map((face) => [face.name, face.power, face.toughness, face.colors])).toEqual([
      ["Delver of Secrets", "1", "1", "U"],
      ["Insectile Aberration", "3", "2", "U"],
    ])
    expect(delver.colors).toBe("U")
    expect(delver.prints.de?.imageSides).toBe(2)
    expect(delver.prints.fallback?.imageSides).toBe(2)
    const valki = card("Valki, God of Lies // Tibalt, Cosmic Impostor")
    expect(valki.faces.map((face) => face.colors)).toEqual(["B", "BR"])
    expect(valki.colors).toBe("B")
    expect(valki.prints.fallback?.imageSides).toBe(2)
  })

  it("split, adventure and flip cards: faces in Scryfall's order, one picture", () => {
    expect(card("Fire // Ice").faces.map((face) => face.name)).toEqual(["Fire", "Ice"])
    expect(card("Fire // Ice").prints.fallback?.imageSides).toBe(1)
    const giant = card("Bonecrusher Giant // Stomp")
    expect(giant.faces.map((face) => [face.name, face.typeLine])).toEqual([
      ["Bonecrusher Giant", "Creature — Giant"],
      ["Stomp", "Instant — Adventure"],
    ])
    expect(giant.de?.faces.map((face) => face.name)).toEqual(["Knochenmalmer-Riese", "Stampfen"])
    expect(card("Akki Lavarunner // Tok-Tok, Volcano Born").prints).toMatchObject({ de: null, fallback: { imageSides: 1 } })
  })

  it("keeps the Oracle's mana cost exactly: none stays absent, {0} stays {0}", () => {
    expect(card("Forest").faces[0]).not.toHaveProperty("manaCost")
    expect(card("Lightning Bolt").faces[0]?.manaCost).toBe("{R}")
  })

  it("English names printed on some printings are aliases with the printing that shows them", () => {
    const hansk = card("Hansk, Slayer Zealot")
    expect(hansk.aliases).toEqual([{ name: "Daryl, Hunter of Walkers", print: expect.objectContaining({ set: "sld", collectorNumber: "144" }) }])
    expect(hansk.forgeNames).toEqual(["Daryl, Hunter of Walkers"])
    expect(card("Lightning Bolt").aliases?.map((alias) => alias.name)).toContain("Hadoken")
  })

  it("a card printed only in Japanese has that printing as fallback", () => {
    const protector = card("Tornellan Protector")
    expect(protector.prints).toMatchObject({ de: null, fallback: { lang: "ja" } })
  })

  it("tokens are catalog cards too (Forge's game makes them), with power and toughness", () => {
    const goblins = catalog.cards.filter((record) => record.name === "Goblin")
    expect(goblins.length).toBe(4)
    expect(goblins.every((goblin) => goblin.layout === "token" && goblin.forgeNames.length === 0)).toBe(true)
  })

  it("sets carry Arena and Forge codes", () => {
    expect(catalog.sets.find((set) => set.code === "dom")).toMatchObject({ arenaCode: "dar", forgeCodes: ["DOM"] })
    expect(catalog.sets.find((set) => set.code === "m11")).toMatchObject({ forgeCodes: ["M11"] })
    expect(catalog.sets.find((set) => set.code === "isd")?.forgeCodes).toEqual(["ISD"])
  })
})

describe("matching Forge's cards", () => {
  it("by name, face name, alias and edition; every record names its Forge cards", () => {
    expect(catalog.report.matched).toEqual({ name: 4, face: 4, alias: 1, edition: 2 })
    expect(card("Lightning Bolt").forgeNames).toEqual(["Lightning Bolt"])
    expect(card("Fire // Ice").forgeNames).toEqual(["Fire // Ice"])
    expect(card("Delver of Secrets // Insectile Aberration").forgeNames).toEqual(["Delver of Secrets"])
    expect(card("Bonecrusher Giant // Stomp").forgeNames).toEqual(["Bonecrusher Giant"])
    expect(card("Bruna, the Fading Light").forgeNames).toEqual(["Bruna, the Fading Light"])
  })

  it("two cards of one name: Forge's edition entries decide which is which", () => {
    const joven = catalog.cards.filter((record) => record.name === "Joven and Chandler")
    expect(joven).toHaveLength(2)
    const byForgeName = Object.fromEntries(joven.map((record) => [record.forgeNames.join(","), record.prints.fallback?.set]))
    expect(byForgeName).toEqual({ "Joven and Chandler": "mbc", "P-Joven and Chandler": "unk" })
    expect(catalog.report.ambiguous).toEqual([])
  })

  it("the Forge name is a lookup key of its card", () => {
    const playtest = catalog.cards.find((record) => record.forgeNames.includes("P-Joven and Chandler"))
    expect(playtest?.nameKeys).toContain(nameKey("P-Joven and Chandler"))
  })

  it("Forge cards without Scryfall data: rebalanced Arena cards on their own, others only with a note", () => {
    expect(catalog.forgeOnly).toEqual([
      { name: "A-Canopy Tactician", nameKeys: ["a-canopy tactician"], reason: "rebalanced" },
      { name: "Drake Stone", nameKeys: ["drake stone"], reason: "listed", note: expect.stringContaining("Drake Stone") },
    ])
  })

  it("stops on a Forge card it cannot explain, and on a stale exception", () => {
    const forge = readForgeCardDatabase(path.join(FIXTURES, "forge-res"))
    const sets = readSets(path.join(FIXTURES, "scryfall-sets.json"))
    const build = (cards: typeof forge.cards, unmatched: { name: string; note: string }[]) => {
      const builder = new CatalogBuilder()
      for (const scryfall of fixtureCards()) builder.add(scryfall)
      return () => builder.build({ forge: { ...forge, cards }, sets, unmatched })
    }
    const unknown = { file: "z/zzz.txt", name: "Zzyzx the Unprinted", states: ["Zzyzx the Unprinted"], mode: null }
    expect(build([...forge.cards, unknown], [{ name: "Drake Stone", note: "n" }])).toThrow(/Zzyzx the Unprinted \(z\/zzz.txt\)/)
    expect(build(forge.cards, [{ name: "Drake Stone", note: "n" }, { name: "Lightning Bolt", note: "n" }])).toThrow(/no longer unmatched.*Lightning Bolt/)
  })
})

describe("printing order", () => {
  const base = { imageRank: 3, regular: true, flags: { contentWarning: false, oversized: false, promo: false, paper: true } }
  const ref = (id: string, releasedAt: string) => ({ id, set: "x", collectorNumber: "1", lang: "en", releasedAt, imageStatus: "highres_scan" as const, imageSides: 1 as const })
  it("picture, no content warning, not oversized, regular frame, no promo, paper, newest - then the id", () => {
    const newer = { ...base, ref: ref("b", "2024-01-01") }
    const older = { ...base, ref: ref("a", "2020-01-01") }
    expect(compareCandidates(newer, older)).toBeGreaterThan(0)
    expect(compareCandidates({ ...older, imageRank: 3 }, { ...newer, imageRank: 2 })).toBeGreaterThan(0)
    expect(compareCandidates(older, { ...newer, flags: { ...newer.flags, contentWarning: true } })).toBeGreaterThan(0)
    expect(compareCandidates(older, { ...newer, regular: false })).toBeGreaterThan(0)
    expect(compareCandidates(older, { ...newer, flags: { ...newer.flags, promo: true } })).toBeGreaterThan(0)
    expect(compareCandidates({ ...base, ref: ref("a", "2020-01-01") }, { ...base, ref: ref("b", "2020-01-01") })).toBeGreaterThan(0)
  })
})

describe("the catalog file", () => {
  it("is the same for the same inputs, and every line is checked", () => {
    const first = fixtureCatalogFile()
    const second = fixtureCatalogFile()
    expect(second.text).toBe(first.text)
    expect(first.lines[0]).toContain('"type":"header"')
    expect(JSON.parse(first.lines.at(-1)!)).toEqual({
      type: "end",
      counts: { card: first.catalog.cards.length, set: first.catalog.sets.length, "forge-only": 2 },
      records: first.lines.length - 2,
    })
  })

  it("refuses Scryfall data it does not understand instead of storing it wrong", () => {
    const [bolt] = fixtureCards()
    const broken = { ...bolt, image_uris: { ...bolt!.image_uris, normal: "https://example.com/bolt.jpg" } } as ScryfallCard
    expect(() => new CatalogBuilder().add(broken)).toThrow(CatalogError)
    const noOracle = { ...bolt, oracle_id: undefined } as unknown as ScryfallCard
    expect(() => new CatalogBuilder().add(noOracle)).toThrow(/no oracle_id/)
  })
})
