// @vitest-environment node
/*
 * The mode comes from the deck (prompt 61): a commander makes a Commander
 * deck (not the number 100), exactly 20 main deck cards without one a
 * Jumpstart half, everything else a normal deck; two halves are joined into
 * the one deck Forge plays.
 */
import { describe, expect, it } from "vitest"
import { engineDeck } from "@/game/engine-deck"
import { deck } from "@/test/storage-fixtures"
import { deckMode, engineFormat, jumpstartDeck, jumpstartName, mainCount } from "./deck-mode"

const goblins = deck({
  name: "Goblins",
  main: [
    { count: 8, name: "Mountain", set: "m19", collectorNumber: "263" },
    { count: 6, name: "Raging Goblin" },
    { count: 6, name: "Shock" },
  ],
  sideboard: [{ count: 2, name: "Abrade" }],
})
const elves = deck({
  name: "Elfen",
  main: [
    { count: 8, name: "Forest" },
    { count: 6, name: "Llanowar Elves" },
    { count: 4, name: "Mountain" },
    { count: 2, name: "Shock" },
  ],
  sideboard: [],
})

describe("deckMode", () => {
  it("20 cards in the main deck and no commander: a Jumpstart half - the sideboard does not count", () => {
    expect(mainCount(goblins)).toBe(20)
    expect(deckMode(goblins)).toBe("jumpstart")
    expect(deckMode(elves)).toBe("jumpstart")
  })

  it("a commander: Commander, whatever the size; 100 cards without one stay normal", () => {
    expect(deckMode(deck({ format: "commander", main: [{ count: 19, name: "Mountain" }], commander: [{ count: 1, name: "Krenko, Mob Boss" }] }))).toBe("commander")
    expect(deckMode(deck({ format: "commander", main: [{ count: 99, name: "Mountain" }], commander: [{ count: 1, name: "Krenko, Mob Boss" }] }))).toBe("commander")
    expect(deckMode(deck({ main: [{ count: 100, name: "Mountain" }] }))).toBe("normal")
  })

  it("everything else is normal - 60, 40, 19 or 21 cards", () => {
    for (const n of [60, 40, 19, 21]) expect(deckMode(deck({ main: [{ count: n, name: "Mountain" }] }))).toBe("normal")
  })

  it("an import's plan has its mode too (counts per entry)", () => {
    expect(deckMode({ format: "constructed", main: [{ count: 12 }, { count: 8 }] })).toBe("jumpstart")
  })

  it("Forge plays a Commander game as commander, everything else as constructed", () => {
    expect(engineFormat("commander")).toBe("commander")
    expect(engineFormat("jumpstart")).toBe("constructed")
    expect(engineFormat("normal")).toBe("constructed")
  })
})

describe("jumpstartDeck", () => {
  it("joins the main decks - counts of the same card added up -, no sideboard, no commander", () => {
    const joined = jumpstartDeck(goblins, elves)
    expect(joined.name).toBe("Jumpstart: Goblins + Elfen")
    expect(joined.main).toEqual([
      { name: "Mountain", count: 12 },
      { name: "Raging Goblin", count: 6 },
      { name: "Shock", count: 8 },
      { name: "Forest", count: 8 },
      { name: "Llanowar Elves", count: 6 },
    ])
    expect(mainCount(joined)).toBe(40)
    expect(joined.sideboard).toEqual([])
    expect(joined.commander).toEqual([])
    expect(engineDeck(joined)).toEqual({
      name: "Jumpstart: Goblins + Elfen",
      main: [
        { card: "Mountain", count: 12 },
        { card: "Raging Goblin", count: 6 },
        { card: "Shock", count: 8 },
        { card: "Forest", count: 8 },
        { card: "Llanowar Elves", count: 6 },
      ],
    })
  })

  it("names both halves in the order chosen", () => {
    expect(jumpstartName(elves, goblins)).toBe("Jumpstart: Elfen + Goblins")
    expect(jumpstartDeck(elves, goblins).main[0]).toEqual({ name: "Forest", count: 8 })
  })
})
