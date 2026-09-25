// @vitest-environment node
/*
 * Picture URLs: built exactly the way Scryfall builds them, and only for
 * sides a printing has.
 */
import { describe, expect, it } from "vitest"
import { imageUrl, parseImageUrl, scryfallImageUrl } from "./images"

const ID = "7673784e-db4b-43a1-8d55-1bb9fc1e284f"

describe("picture URLs", () => {
  it("follow Scryfall's scheme (the one its image_uris use)", () => {
    expect(scryfallImageUrl(ID, "front", "normal", "1783903008")).toBe(`https://cards.scryfall.io/normal/front/7/6/${ID}.jpg?1783903008`)
    expect(scryfallImageUrl(ID, "back", "grid", "1783903008")).toBe(`https://cards.scryfall.io/grid/back/7/6/${ID}.webp?1783903008`)
    expect(() => scryfallImageUrl(ID, "front", "gigantic", "1")).toThrow(/unknown Scryfall image version/)
  })

  it("take a printing apart again, and refuse anything else", () => {
    expect(parseImageUrl(`https://cards.scryfall.io/display/back/7/6/${ID}.webp?42`)).toEqual({ version: "display", side: "back", id: ID, timestamp: "42" })
    for (const url of [
      `https://cards.scryfall.io/normal/front/7/6/${ID}.webp?42`,
      `https://cards.scryfall.io/normal/front/0/0/${ID}.jpg?42`,
      `https://cards.scryfall.io/normal/front/7/6/${ID}.jpg`,
      `http://cards.scryfall.io/normal/front/7/6/${ID}.jpg?42`,
      "https://errors.scryfall.com/soon.jpg",
    ]) {
      expect(parseImageUrl(url), url).toBeNull()
    }
  })

  it("exist only for the sides a printing has", () => {
    const single = { id: ID, imageSides: 1 as const, imageVersion: "5" }
    expect(imageUrl(single, "front", "thumb")).toBe(`https://cards.scryfall.io/thumb/front/7/6/${ID}.webp?5`)
    expect(imageUrl(single, "back", "grid")).toBeNull()
    expect(imageUrl({ id: ID, imageSides: 2, imageVersion: "5" }, "back", "display")).toBe(`https://cards.scryfall.io/display/back/7/6/${ID}.webp?5`)
    expect(imageUrl({ id: ID, imageSides: 0 }, "front", "grid")).toBeNull()
  })
})
