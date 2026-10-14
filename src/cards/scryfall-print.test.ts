// @vitest-environment node
/*
 * The picture URLs of a printing (prompt 52): Scryfall added a key "jpeg" to
 * image_uris (2026-10-14) that names the "normal" picture again. Such an extra
 * key is accepted when its URL follows the rule for the same card and side;
 * a version's own key must still hold that version, and every URL must still
 * follow src/cards/images.ts.
 */
import { describe, expect, it } from "vitest"
import { fixtureCards } from "@/test/catalog-fixtures"
import type { ScryfallCard } from "./scryfall/generated/records"
import { imageFacts, printFacts, ScryfallDataError } from "./scryfall-print"

const card = fixtureCards().find((each) => each.image_uris !== undefined && each.card_faces === undefined)!
const uris = card.image_uris as Record<string, string>

describe("picture URLs of a printing", () => {
  it("an extra key naming another version (Scryfall's \"jpeg\") is accepted", () => {
    const withJpeg = { ...card, image_uris: { ...uris, jpeg: uris["normal"]! } } as ScryfallCard
    expect(imageFacts(withJpeg)).toEqual(imageFacts(card))
    expect(printFacts(withJpeg)).toEqual(printFacts(card))
  })

  it("an extra key with a URL of another card, or not following the rule, is refused", () => {
    const other = fixtureCards().find((each) => each.id !== card.id && each.image_uris !== undefined && each.card_faces === undefined)!
    const foreign = { ...card, image_uris: { ...uris, jpeg: (other.image_uris as Record<string, string>)["normal"]! } } as ScryfallCard
    expect(() => imageFacts(foreign)).toThrow(ScryfallDataError)
    const broken = { ...card, image_uris: { ...uris, jpeg: "https://example.com/card.jpg" } } as ScryfallCard
    expect(() => imageFacts(broken)).toThrow(ScryfallDataError)
  })

  it("a version's own key must still hold that version", () => {
    const swapped = { ...card, image_uris: { ...uris, normal: uris["large"]! } } as ScryfallCard
    expect(() => imageFacts(swapped)).toThrow(/does not follow src\/cards\/images.ts/)
  })
})
