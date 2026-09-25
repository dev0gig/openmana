/*
 * The table's German words (table-labels.ts): counters, a card's facts,
 * stack targets and combat lines - from Forge's structured values.
 */
import type { VisibleCard } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { attackLine, blockLine, captionFacts, cardFacts, cardName, counterLabel, seatName, spokenFacts, stackTargets } from "./table-labels"
import type { CombatView } from "./table-model"

function card(id: number, key: string, overrides: Partial<VisibleCard> = {}): VisibleCard {
  return { id, key, name: key, tapped: false, sick: false, faceDown: false, damage: 0, owner: 0, controller: 0, ...overrides }
}

describe("counters", () => {
  it("Forge's counter types in German, keyword counters by Forge's title; others marked as English", () => {
    expect(counterLabel("+1/+1")).toEqual({ text: "+1/+1", english: false })
    expect(counterLabel("-1/-1")).toEqual({ text: "−1/−1", english: false })
    expect(counterLabel("Poison")).toEqual({ text: "Gift", english: false })
    expect(counterLabel("Loyalty")).toEqual({ text: "Loyalität", english: false })
    expect(counterLabel("First Strike")).toEqual({ text: "Erstschlag", english: false })
    expect(counterLabel("Acquired taste")).toEqual({ text: "Acquired taste", english: true })
  })
})

describe("a card's facts", () => {
  it("in words below the card: power/toughness, loyalty, damage, counters, face-down, phased out - Forge's values, nothing computed", () => {
    const bear = card(1, "Grizzly Bears", { power: 3, toughness: 3, damage: 2, counters: { "+1/+1": 1 } })
    expect(captionFacts(bear)).toEqual(["3/3", "2 Schaden", "+1/+1: 1"])
    const walker = card(2, "Jace", { loyalty: "4", counters: { Loyalty: 4, Charge: 1 } })
    // The loyalty counters are the loyalty: said once.
    expect(captionFacts(walker)).toEqual(["Loyalität 4", "Ladung: 1"])
    expect(captionFacts(card(3, "Morph", { faceDown: true, phasedOut: true }))).toEqual(["verdeckt", "ausgephast"])
  })

  it("what is a sign or the turned picture, in words for screen readers; the tooltip has everything, the pile's size first", () => {
    const token = card(4, "Goblin Token", { power: 1, toughness: 1, tapped: true, attacking: true, token: true })
    expect(spokenFacts(token)).toEqual(["getappt", "greift an", "Spielstein"])
    expect(cardFacts(token, 13)).toEqual(["13 Karten", "getappt", "greift an", "1/1", "Spielstein"])
    expect(cardFacts(card(5, "Mountain"))).toEqual([])
  })
})

describe("names", () => {
  it("Forge's live name, else its key; a card the player cannot see stays unnamed", () => {
    expect(cardName(card(1, "Lightning Bolt", { name: "Blitzschlag" }))).toBe("Blitzschlag")
    expect(cardName(card(2, "Lightning Bolt", { name: null }))).toBe("Lightning Bolt")
    expect(cardName(null)).toBe("eine verdeckte Karte")
    expect(seatName("me")).toBe("Du")
    expect(seatName("opponent")).toBe("Forge-KI")
  })
})

describe("stack and combat lines", () => {
  const giant = card(10, "Giant Spider", { name: "Riesenspinne", power: 2, toughness: 4, attacking: true })
  const jace = card(20, "Jace", { name: "Jace", loyalty: "3" })

  it("targets: players as seen from the player, cards by name", () => {
    expect(
      stackTargets({
        id: 1,
        text: "Schock",
        controller: "opponent",
        trigger: false,
        source: null,
        targets: [
          { kind: "player", id: 0, seat: "me" },
          { kind: "card", id: 10, card: giant },
        ],
      }),
    ).toBe("Ziel: dich, Riesenspinne")
  })

  it("who attacks whom - the player, the AI, a planeswalker - and who blocks", () => {
    const atYou: CombatView = { attacker: { kind: "card", id: 10, card: giant }, defender: { kind: "player", id: 0, seat: "me" }, blockers: [] }
    expect(`${attackLine(atYou)} – ${blockLine(atYou)}`).toBe("greift dich an – ungeblockt")
    const atJace: CombatView = { ...atYou, defender: { kind: "card", id: 20, card: jace }, blockers: [{ kind: "card", id: 30, card: card(30, "Wall", { name: "Mauer" }) }] }
    expect(`${attackLine(atJace)} – ${blockLine(atJace)}`).toBe("greift Jace an – geblockt von Mauer")
    expect(attackLine({ ...atYou, defender: null })).toBe("greift an")
  })
})
