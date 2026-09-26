// @vitest-environment node
/*
 * Finding cards in the installed catalog: by every kind of name, by the
 * engine's key (faces, tokens, Forge-only cards), sets by their codes.
 */
import { beforeEach, describe, expect, it } from "vitest"
import type { LocalDatabase } from "@/storage/database"
import type { CardRecord } from "@/storage/generated/records"
import { fixtureCard, installFixtureCatalog } from "@/test/catalog-fixtures"
import { openTestDatabase } from "@/test/storage-fixtures"
import { findCardsByName, findForgeOnly, findSetByArenaCode, findSetsByForgeCode, getCard, getCards, getSet, resolveEngineKey, searchCardsByName } from "./card-lookup"

let db: LocalDatabase

beforeEach(async () => {
  db = await openTestDatabase()
  await installFixtureCatalog(db)
  return () => db.close()
})

const summary = (matches: Awaited<ReturnType<typeof findCardsByName>>) => matches.map((m) => [m.card.name, m.kind, m.face])

describe("by name", () => {
  it("English, whatever the spelling", async () => {
    expect(summary(await findCardsByName(db, "Lightning Bolt"))).toEqual([["Lightning Bolt", "name", null]])
    expect(summary(await findCardsByName(db, "  lightning   BOLT "))).toEqual([["Lightning Bolt", "name", null]])
  })

  it("German printed names, with umlauts or without", async () => {
    expect(summary(await findCardsByName(db, "Blitzschlag"))).toEqual([["Lightning Bolt", "printed", null]])
    expect(summary(await findCardsByName(db, "Geheimnisstöberer"))).toEqual([["Delver of Secrets // Insectile Aberration", "printed", 0]])
    expect(summary(await findCardsByName(db, "Insekten-Scheußlichkeit"))).toEqual([["Delver of Secrets // Insectile Aberration", "printed", 1]])
    expect(summary(await findCardsByName(db, "Wald"))).toEqual([["Forest", "printed", null]])
  })

  it("face names and whole split names", async () => {
    expect(summary(await findCardsByName(db, "Insectile Aberration"))).toEqual([["Delver of Secrets // Insectile Aberration", "face", 1]])
    expect(summary(await findCardsByName(db, "Stomp"))).toEqual([["Bonecrusher Giant // Stomp", "face", 1]])
    expect(summary(await findCardsByName(db, "Fire//Ice"))).toEqual([["Fire // Ice", "name", null]])
  })

  it("aliases and Forge names", async () => {
    const daryl = await findCardsByName(db, "Daryl, Hunter of Walkers")
    // Forge knows the card by this name: it is the card's own name there.
    expect(summary(daryl)).toEqual([["Hansk, Slayer Zealot", "name", null]])
    const hadoken = await findCardsByName(db, "Hadoken")
    expect(summary(hadoken)).toEqual([["Lightning Bolt", "alias", null]])
    expect(hadoken[0]?.alias?.print.set).toBe("sld")
    expect(summary(await findCardsByName(db, "P-Joven and Chandler"))).toEqual([["Joven and Chandler", "name", null]])
  })

  it("nothing for unknown or empty names", async () => {
    expect(await findCardsByName(db, "Zzyzx the Unprinted")).toEqual([])
    expect(await findCardsByName(db, "   ")).toEqual([])
  })

  it("search by the start of a name, each card once, exact names first", async () => {
    const found = await searchCardsByName(db, "blitz")
    expect(found.map((m) => m.card.name)).toEqual(["Lightning Bolt"])
    const goblins = await searchCardsByName(db, "gob")
    expect(goblins.every((m) => m.card.name === "Goblin")).toBe(true)
    expect(await searchCardsByName(db, "b")).toEqual([])
    expect((await searchCardsByName(db, "bo", 2)).length).toBeLessThanOrEqual(2)
  })

  it("by Oracle id, one or many", async () => {
    const [bolt] = await findCardsByName(db, "Lightning Bolt")
    expect((await getCard(db, bolt!.card.oracleId))?.name).toBe("Lightning Bolt")
    expect(await getCard(db, "00000000-0000-4000-8000-000000000000")).toBeNull()
    const many = await getCards(db, [bolt!.card.oracleId, bolt!.card.oracleId, "00000000-0000-4000-8000-000000000000"])
    expect([...many.keys()]).toEqual([bolt!.card.oracleId])
  })
})

describe("the engine's key", () => {
  it("names the face a card shows", async () => {
    const aberration = await resolveEngineKey(db, "Insectile Aberration")
    expect(aberration.status === "found" && [aberration.match.card.name, aberration.match.face]).toEqual(["Delver of Secrets // Insectile Aberration", 1])
    const giant = await resolveEngineKey(db, "Bonecrusher Giant")
    expect(giant.status === "found" && giant.match.face).toBe(0)
    const brisela = await resolveEngineKey(db, "Brisela, Voice of Nightmares")
    expect(brisela.status === "found" && brisela.match.card.layout).toBe("meld")
  })

  it("a card's own name beats another card's face of the same name - by the name Forge knows (prompt 16)", async () => {
    // Real since 2026: "Rampant Growth" is a card of its own and the second face of Studious First-Year; Forge names
    // the one "Rampant Growth", the other "Studious First-Year". Both are Forge cards.
    const base = fixtureCard("Lightning Bolt")
    const growth: CardRecord = { ...base, oracleId: "00000000-0000-4000-8000-000000000001", name: "Rampant Growth", nameKeys: ["rampant growth"], forgeNames: ["Rampant Growth"] }
    const studious: CardRecord = {
      ...base,
      oracleId: "00000000-0000-4000-8000-000000000002",
      name: "Studious First-Year // Rampant Growth",
      layout: "prepare",
      faces: [
        { ...base.faces[0], name: "Studious First-Year" },
        { ...base.faces[0], name: "Rampant Growth" },
      ],
      nameKeys: ["studious first-year // rampant growth", "studious first-year", "rampant growth"],
      forgeNames: ["Studious First-Year"],
    }
    await db.write(["scryfallCards"], async (transaction) => {
      await transaction.objectStore("scryfallCards").put(growth)
      await transaction.objectStore("scryfallCards").put(studious)
    })
    expect(summary(await findCardsByName(db, "Rampant Growth"))).toEqual([
      ["Rampant Growth", "name", null],
      ["Studious First-Year // Rampant Growth", "face", 1],
    ])
    const found = await resolveEngineKey(db, "Rampant Growth")
    expect(found.status === "found" && found.match.card.oracleId).toBe(growth.oracleId)
    const front = await resolveEngineKey(db, "Studious First-Year")
    expect(found.status === "found" && front.status === "found" && [front.match.card.oracleId, front.match.face]).toEqual([studious.oracleId, 0])
  })

  it("never resolves by a German name (the engine's keys are English)", async () => {
    expect(await resolveEngineKey(db, "Blitzschlag")).toEqual({ status: "not-found" })
  })

  it("tokens by name, power, toughness and colours - or honestly ambiguous", async () => {
    const twoOne = await resolveEngineKey(db, "Goblin Token", { token: true, power: 2, toughness: 1, colors: "R" })
    expect(twoOne.status === "found" && twoOne.match.card.faces[0].power).toBe("2")
    const blackRed = await resolveEngineKey(db, "Goblin Token", { token: true, power: 1, toughness: 1, colors: "BR" })
    expect(blackRed.status).toBe("found")
    const plain = await resolveEngineKey(db, "Goblin Token", { token: true, power: 1, toughness: 1, colors: "R" })
    expect(plain.status === "ambiguous" && plain.matches.length).toBe(2)
    expect(await resolveEngineKey(db, "Goblin Token", { token: true, power: 9, toughness: 9 })).toEqual({ status: "not-found" })
    // A token is never a card of the same name, and a card never a token.
    expect((await resolveEngineKey(db, "Goblin")).status).toBe("not-found")
  })

  it("Forge cards without Scryfall data are known as such", async () => {
    const tactician = await resolveEngineKey(db, "A-Canopy Tactician")
    expect(tactician).toEqual({ status: "forge-only", card: { name: "A-Canopy Tactician", nameKeys: ["a-canopy tactician"], reason: "rebalanced" } })
    expect((await findForgeOnly(db, "drake stone"))?.reason).toBe("listed")
    expect(await resolveEngineKey(db, "Zzyzx the Unprinted")).toEqual({ status: "not-found" })
  })
})

describe("sets", () => {
  it("by Scryfall, Arena and Forge code", async () => {
    expect((await getSet(db, "DOM"))?.name).toBe("Dominaria")
    expect((await findSetByArenaCode(db, "DAR"))?.code).toBe("dom")
    expect((await findSetByArenaCode(db, "m11"))?.code).toBe("m11")
    expect((await findSetsByForgeCode(db, "M11")).map((set) => set.code)).toEqual(["m11"])
    expect(await findSetByArenaCode(db, "XYZ")).toBeNull()
  })
})
