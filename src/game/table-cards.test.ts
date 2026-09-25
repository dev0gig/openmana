// @vitest-environment node
/*
 * The pictures of the table's cards (table-cards.ts) against the small real
 * card catalog: Forge's key resolved once per key, shown in the player's
 * card language; no picture - never a guess - where the catalog cannot
 * decide.
 */
import type { VisibleCard } from "@openmana/engine-protocol"
import { beforeEach, describe, expect, it } from "vitest"
import type { LocalDatabase } from "@/storage/database"
import { installFixtureCatalog } from "@/test/catalog-fixtures"
import { openTestDatabase } from "@/test/storage-fixtures"
import { pictureKey, pictureOf, resolvePictures } from "./table-cards"

let db: LocalDatabase

beforeEach(async () => {
  db = await openTestDatabase()
  await installFixtureCatalog(db)
  return () => db.close()
})

function card(id: number, key: string | null, overrides: Partial<VisibleCard> = {}): VisibleCard {
  return { id, key, name: key, tapped: false, sick: false, faceDown: false, damage: 0, owner: 0, controller: 0, ...overrides }
}

describe("the lookup key", () => {
  it("is Forge's key; for tokens also what tells tokens of one name apart", () => {
    expect(pictureKey(card(1, "Lightning Bolt"))).toBe("card|Lightning Bolt")
    expect(pictureKey(card(2, "Goblin Token", { token: true, power: 1, toughness: 1 }))).toBe("token|Goblin Token|1|1|")
    expect(pictureKey(card(3, "Goblin Token", { token: true, power: 2, toughness: 1, colors: "R" }))).toBe("token|Goblin Token|2|1|R")
    expect(pictureKey(card(4, null))).toBeNull()
    expect(pictureKey(card(5, ""))).toBeNull()
  })
})

describe("resolving against the catalog", () => {
  it("one answer per key; German picture by default, English with the English card language", async () => {
    const bolts = [card(1, "Lightning Bolt"), card(2, "Lightning Bolt"), card(3, "Lightning Bolt", { tapped: true })]
    const found = await resolvePictures(db, bolts, new Map())
    expect([...found.keys()]).toEqual(["card|Lightning Bolt"])
    const resolution = found.get("card|Lightning Bolt")!
    const german = pictureOf(resolution, "de")
    const english = pictureOf(resolution, "en")
    expect(german).toMatchObject({ lang: "de" })
    expect(english).toMatchObject({ lang: "en" })
    if (german === "loading" || german === "none") throw new Error("a picture was expected")
    expect(german.src).toMatch(/^https:\/\/cards\.scryfall\.io\/grid\/front\//)
    expect(german.srcSet).toMatch(/\/thumb\/front\/.* 146w, https:\/\/cards\.scryfall\.io\/grid\/front\/.* 488w$/)
  })

  it("keys already known are not asked again", async () => {
    const first = await resolvePictures(db, [card(1, "Lightning Bolt")], new Map())
    expect(await resolvePictures(db, [card(2, "Lightning Bolt")], first)).toEqual(new Map())
  })

  it("the face Forge shows: a transformed card shows its back", async () => {
    const found = await resolvePictures(db, [card(1, "Insectile Aberration")], new Map())
    const picture = pictureOf(found.get("card|Insectile Aberration")!, "de")
    expect(picture !== "loading" && picture !== "none" && picture.src).toMatch(/\/grid\/back\//)
  })

  it("no picture instead of a guess: tokens that fit alike, cards the catalog lacks, Forge's effect cards", async () => {
    const cards = [
      card(1, "Goblin Token", { token: true, power: 1, toughness: 1, colors: "R" }),
      card(2, "Mountain"),
      card(3, "Stomp (54)'s Effect"),
      card(4, "A-Canopy Tactician"),
    ]
    const found = await resolvePictures(db, cards, new Map())
    expect(Object.fromEntries([...found].map(([key, resolution]) => [key, pictureOf(resolution, "de")]))).toEqual({
      "token|Goblin Token|1|1|R": "none",
      "card|Mountain": "none",
      "card|Stomp (54)'s Effect": "none",
      "card|A-Canopy Tactician": "none",
    })
  })

  it("a token Forge's values single out gets its picture", async () => {
    const found = await resolvePictures(db, [card(1, "Goblin Token", { token: true, power: 2, toughness: 1, colors: "R" })], new Map())
    expect(pictureOf(found.get("token|Goblin Token|2|1|R")!, "de")).toMatchObject({ lang: "en" })
  })
})
