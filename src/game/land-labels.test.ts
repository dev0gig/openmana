/*
 * The player's land plays and Forge's reasons in words (prompt 51) on real
 * moments of the Forge engine (protocol 10): src/test/fixtures/land-plays.json,
 * recorded by scripts/record-land-plays.ts from the fixture game `lands`
 * (green lands, Exploration, Rampant Growth against red). One case is built
 * from a real one and marked so (Forge's `landsUnlimited`: no card of the test
 * decks grants it).
 */
import { describe, expect, it } from "vitest"
import type { GameState, LandRefusal, Player } from "@openmana/engine-protocol"
import { landMoment } from "@/test/land-plays"
import { LAND_REFUSAL_WORDS, landPlayFact, landRefusalWords } from "./land-labels"

const me = (state: GameState): Player => state.players.find((player) => player.me)!

describe("the player's land plays (Forge's numbers, real moments)", () => {
  it("before the first turn nothing: no turn to count yet (Forge's reasons on the opening hand are not shown either)", () => {
    expect(landMoment("before-start").state.turn).toBe(0)
    expect(landPlayFact(landMoment("before-start").state)).toBeNull()
  })

  it("the player's main phase: Forge's 0 of 1 before the land, 1 of 1 after it - the land for the turn is played", () => {
    expect(landPlayFact(landMoment("first-land").state)).toEqual({
      turn: "mine",
      label: "Länder",
      value: "0/1",
      sentence: "In diesem Zug hast du 0 von 1 Land gespielt, die Forge dir erlaubt.",
      used: false,
    })
    expect(landPlayFact(landMoment("land-played").state)).toEqual({
      turn: "mine",
      label: "Länder",
      value: "1/1",
      sentence: "In diesem Zug hast du 1 von 1 Land gespielt, die Forge dir erlaubt. Dein Land für diesen Zug ist bereits gespielt.",
      used: true,
    })
  })

  it("the next own turn counts afresh (Forge's number), though a land from before lies on the battlefield", () => {
    const { state } = landMoment("next-turn")
    expect(me(state).zones.battlefield.length).toBeGreaterThan(0)
    expect(landPlayFact(state)).toMatchObject({ turn: "mine", value: "0/1", used: false })
  })

  it("an effect raises Forge's limit (Exploration): 1 of 2 with a land still playable, then 2 of 2", () => {
    expect(landPlayFact(landMoment("extra-allowed").state)).toMatchObject({ value: "1/2", used: false })
    expect(landPlayFact(landMoment("extra-used").state)).toEqual({
      turn: "mine",
      label: "Länder",
      value: "2/2",
      sentence: "In diesem Zug hast du 2 von 2 Ländern gespielt, die Forge dir erlaubt. Deine Länder für diesen Zug sind bereits gespielt.",
      used: true,
    })
  })

  it("a land put onto the battlefield by an effect (Rampant Growth) is no land play: one land more on the battlefield, Forge's count unchanged", () => {
    const { state, before, observation } = landMoment("land-by-effect")
    expect(before).toBeDefined()
    expect(observation?.actions.some((action) => action.kind === "resolve" && action.results.moves.some((move) => move.from?.zone === "library" && move.to?.zone === "battlefield"))).toBe(true)
    expect(me(state).zones.battlefield.length).toBe(me(before!).zones.battlefield.length + 1)
    expect(landPlayFact(state)).toEqual(landPlayFact(before!))
    expect(landPlayFact(state)).toMatchObject({ value: "0/2" })
  })

  it("in the AI's turn no numbers that look available: Forge offers the player no land then", () => {
    expect(landPlayFact(landMoment("opponent-turn").state)).toEqual({
      turn: "opponent",
      label: "Kein Land im KI-Zug",
      value: null,
      sentence: "Im Zug der Forge-KI bietet Forge dir kein Land zum Spielen an – deine Länder spielst du in deinem eigenen Zug.",
      used: false,
    })
  })

  it("Forge's unlimited land plays (built from a real moment: no card of the test decks grants it): the count and \"unbegrenzt\", never used up", () => {
    const { state } = landMoment("extra-used")
    const built: GameState = { ...state, players: state.players.map((player) => (player.me ? { ...player, landsUnlimited: true } : player)) as GameState["players"] }
    expect(landPlayFact(built)).toEqual({ turn: "mine", label: "Länder", value: "2 · unbegrenzt", sentence: "In diesem Zug hast du 2 Länder gespielt; Forge erlaubt dir gerade beliebig viele.", used: false })
  })
})

describe("Forge's reasons in words", () => {
  it("every reason the protocol knows has a few words and a sentence", () => {
    const reasons: readonly LandRefusal[] = ["notYourTurn", "timing", "notOwner", "zone", "restricted", "limit"]
    expect(Object.keys(LAND_REFUSAL_WORDS).sort()).toEqual([...reasons].sort())
    for (const reason of reasons) {
      expect(LAND_REFUSAL_WORDS[reason].short.length).toBeGreaterThan(0)
      expect(LAND_REFUSAL_WORDS[reason].why).toMatch(/\.$/)
    }
  })

  it("the limit in the player's words: one land, or more than one when Forge allows more", () => {
    expect(landRefusalWords("limit", 1).why).toBe("Dein Land für diesen Zug ist bereits gespielt.")
    expect(landRefusalWords("limit", 2).why).toBe("Deine Länder für diesen Zug sind bereits gespielt.")
    expect(landRefusalWords("timing", 2)).toBe(LAND_REFUSAL_WORDS.timing)
  })
})
