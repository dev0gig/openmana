/* The start hand's model (prompt 50): on the recorded "opening" scene (Forge's real mulligan) and built neighbours. */
import type { GameState, Question } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { tableScene } from "@/test/table-scenes"
import { awaitingOver, nextStartHandMemory, pastStart, playerHand, START_HAND_MEMORY, startHandKey, startHandOpen, startQuestion, type StartQuestion } from "./start-hand"

const opening = tableScene("opening")
const bottom = (id: number, ok = false): Question => ({ type: "question", kind: "buttons", id, blocking: false, text: "", purpose: "mulliganBottom", buttons: [{ nr: 1, label: "OK", enabled: ok }, { nr: 2, label: "Auto", enabled: true }] })

describe("Forge's start questions", () => {
  it("the recorded mulligan is one; its key is the step and the hand's ids in Forge's order", () => {
    const question = startQuestion(opening.questions)
    expect(question?.purpose).toBe("mulligan")
    expect(startHandKey(question!, opening.state)).toBe("mulligan:53,59,45,55,34,37,33")
    expect(playerHand(opening.state)).toHaveLength(7)
  })

  it("the choice for the bottom is one too - asked anew after every tap (a new id), it keeps its key", () => {
    const first = startQuestion([bottom(3)])!
    const again = startQuestion([bottom(4, true)])!
    expect(first.purpose).toBe("mulliganBottom")
    expect(startHandKey(first, opening.state)).toBe(startHandKey(again, opening.state))
    expect(startHandKey(first, opening.state)).not.toBe(startHandKey(startQuestion(opening.questions)!, opening.state))
  })

  it("not the priority, not under a blocking question or a selection, not play or draw", () => {
    expect(startQuestion(tableScene("main-phase").questions)).toBeNull()
    expect(startQuestion(tableScene("play-draw").questions)).toBeNull()
    expect(startQuestion([...opening.questions, { type: "question", kind: "confirm", id: 9, blocking: true, text: "?", yes: "Ja", no: "Nein" } as unknown as Question])).toBeNull()
    expect(startQuestion([...opening.questions, { type: "question", kind: "select", id: 9, blocking: false, text: "", cards: [53], min: 0, max: 1 } as unknown as Question])).toBeNull()
  })

  it("a new hand after a mulligan has a new key", () => {
    const state: GameState = structuredClone(opening.state)
    const me = state.players.find((player) => player.me)!
    me.zones.hand = me.zones.hand.slice(0, 6)
    expect(startHandKey(startQuestion(opening.questions)!, state)).not.toBe(startHandKey(startQuestion(opening.questions)!, opening.state))
  })
})

describe("when the overview is open", () => {
  const key = "mulligan:1,2,3"
  it("the running game opens it by itself; the replay only when asked", () => {
    expect(startHandOpen(START_HAND_MEMORY, key, true, false)).toBe(true)
    expect(startHandOpen(START_HAND_MEMORY, key, false, false)).toBe(false)
    expect(startHandOpen({ ...START_HAND_MEMORY, requested: key }, key, false, false)).toBe(true)
  })

  it("closed for a hand, it stays closed for it - not for the next hand", () => {
    const closed = { ...START_HAND_MEMORY, dismissed: key }
    expect(startHandOpen(closed, key, true, false)).toBe(false)
    expect(startHandOpen(closed, "mulligan:4,5,6", true, false)).toBe(true)
    expect(startHandOpen({ ...closed, requested: key }, key, true, false)).toBe(true)
  })

  it("after an answer from it: open while the answer is on its way and Forge computes, until the next start question or the game begins", () => {
    const answered = { ...START_HAND_MEMORY, dismissed: key, awaiting: key }
    // The answered question is still there, then gone (Forge computes): open.
    expect(startHandOpen(answered, key, true, false)).toBe(true)
    expect(startHandOpen(answered, null, true, false)).toBe(true)
    expect(awaitingOver(answered, key, false)).toBe(false)
    expect(awaitingOver(answered, null, false)).toBe(false)
    // The next hand: its own question opens it; the wait is over.
    expect(awaitingOver(answered, "mulligan:4,5,6", false)).toBe(true)
    // The game began: closed.
    expect(startHandOpen(answered, null, true, true)).toBe(false)
    expect(awaitingOver(answered, null, true)).toBe(true)
  })

  it("the game has begun at a turn or at any other question of Forge's", () => {
    expect(pastStart(opening.state, opening.questions)).toBe(false)
    expect(pastStart(opening.state, [])).toBe(false)
    expect(pastStart({ ...opening.state, turn: 1 }, [])).toBe(true)
    expect(pastStart(opening.state, tableScene("play-draw").questions)).toBe(true)
    expect(pastStart(opening.state, [bottom(3)] as StartQuestion[])).toBe(false)
  })
})

describe("between two of Forge's questions", () => {
  const key = "mulliganBottom:1,2,3"
  it("the hand shown last keeps it open while no start question is there for a moment; closed or past, not", () => {
    const shown = nextStartHandMemory(START_HAND_MEMORY, key, true, false)
    expect(shown.shown).toBe(key)
    expect(nextStartHandMemory(shown, key, true, false)).toBe(shown)
    // Forge withdrew the question and asks the next one: nothing there for a moment - still open.
    const gap = nextStartHandMemory(shown, null, startHandOpen(shown, null, true, false), false)
    expect(startHandOpen(gap, null, true, false)).toBe(true)
    // The game began: closed, forgotten.
    expect(nextStartHandMemory(gap, null, false, true).shown).toBeNull()
    // Closed by the player: nothing keeps it open.
    expect(nextStartHandMemory(shown, key, false, false).shown).toBeNull()
  })
})

