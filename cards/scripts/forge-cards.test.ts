// @vitest-environment node
/*
 * Reading Forge's card database: names as Forge's deck lists use them, and
 * the printings its edition files list.
 */
import path from "node:path"
import { describe, expect, it } from "vitest"
import { FIXTURES } from "./fixtures.ts"
import { ForgeDataError, parseCardScript, parseEdition, readForgeCardDatabase } from "./forge-cards.ts"

describe("card scripts", () => {
  it("a card is named after its first state; a split card after both", () => {
    expect(parseCardScript("l/lightning_bolt.txt", "Name:Lightning Bolt\nManaCost:R\n")).toEqual({ file: "l/lightning_bolt.txt", name: "Lightning Bolt", states: ["Lightning Bolt"], mode: null })
    expect(parseCardScript("f/fire_ice.txt", "Name:Fire\nAlternateMode:Split\n\nALTERNATE\n\nName:Ice\n").name).toBe("Fire // Ice")
    expect(parseCardScript("d/delver.txt", "Name:Delver of Secrets\nAlternateMode:DoubleFaced\nALTERNATE\nName:Insectile Aberration\n")).toMatchObject({
      name: "Delver of Secrets",
      states: ["Delver of Secrets", "Insectile Aberration"],
      mode: "DoubleFaced",
    })
  })

  it("a state may take another card's face whole (CopyFaceFrom)", () => {
    expect(parseCardScript("b/bind_liberate.txt", "CopyFaceFrom:Bind\nAlternateMode:Split\n\nALTERNATE\n\nCopyFaceFrom:Liberate\n").name).toBe("Bind // Liberate")
  })

  it("a script without a name is an error", () => {
    expect(() => parseCardScript("x.txt", "ManaCost:R\n")).toThrow(ForgeDataError)
  })
})

describe("edition files", () => {
  it("reads codes and every card line of the card sections, like Forge's CARD_PATTERN", () => {
    const edition = parseEdition(
      "Conflux.txt",
      [
        "[metadata]",
        "Code=CFX",
        "Name=Conflux",
        "ScryfallCode=CON",
        "",
        "[cards]",
        "1 U Ajani's Mantra @James Paick",
        "UR05 U P-Joven and Chandler @",
        "[borderless]",
        "200 M Some Card @Artist ${\"flavor\": \"x\"}",
        "[tokens]",
        "t1 w_1_1_soldier",
        "[Common]",
        "not a card line",
      ].join("\n"),
    )
    expect(edition).toEqual({
      file: "Conflux.txt",
      code: "CFX",
      code2: "CFX",
      scryfallCode: "con",
      name: "Conflux",
      entries: [
        { collectorNumber: "1", name: "Ajani's Mantra" },
        { collectorNumber: "UR05", name: "P-Joven and Chandler" },
        { collectorNumber: "200", name: "Some Card" },
      ],
    })
  })

  it("a file without a code is no edition", () => {
    expect(parseEdition("x.txt", "[metadata]\nName=X\n")).toBeNull()
  })

  it("reads a whole res/ directory", () => {
    const database = readForgeCardDatabase(path.join(FIXTURES, "forge-res"))
    expect(database.cards.map((card) => card.name).sort()).toContain("P-Joven and Chandler")
    expect(database.editions.map((edition) => edition.scryfallCode).sort()).toEqual(["dom", "isd", "m11", "mbc", "unk"])
    expect(() => readForgeCardDatabase(FIXTURES)).toThrow(/not Forge's res\/ directory/)
  })
})
