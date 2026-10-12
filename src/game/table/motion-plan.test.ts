// @vitest-environment node
/*
 * The rules of the table's motion (prompt 44, motion-plan.ts) on the recorded
 * run of real consecutive states (src/test/table-sequence.ts): a card moves
 * only as itself (the same id), the effects follow Forge's values and the log
 * kinds Forge sends, every keyframe touches only transform and opacity.
 */
import { checkEngineMessage, checkGameState } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { SEQUENCE_STEPS, sequenceMoment, TABLE_SEQUENCE } from "@/test/table-sequence"
import {
  cardSeat,
  damagedCards,
  damageSources,
  hasEvent,
  KEYFRAME_SAMPLES,
  lifeChanges,
  MOTION_MS,
  MOTION_PROPERTIES,
  newEvents,
  pileOfCard,
  placeTransform,
  planCards,
  stackChanges,
  travelFrames,
  type CardSnap,
  type Place,
} from "./motion-plan"

const state = (step: number) => TABLE_SEQUENCE.steps[step]!.state

function snap(key: string, x: number, y: number, node: object, tapped = false, size = 80): CardSnap {
  return { key, node, tapped, place: { x, y, w: size * (63 / 88), h: size, angle: 0 } }
}

describe("the recorded sequence", () => {
  it("is Forge's own: consecutive states of one game, every message passes the protocol's checks", () => {
    expect(TABLE_SEQUENCE.name).toBe("first-attack")
    expect(TABLE_SEQUENCE.steps.length).toBeGreaterThanOrEqual(20)
    expect(() => checkEngineMessage(TABLE_SEQUENCE.game)).not.toThrow()
    let seq = 0
    for (const step of TABLE_SEQUENCE.steps) {
      expect(() => checkGameState(step.state)).not.toThrow()
      for (const question of step.questions) expect(() => checkEngineMessage(question)).not.toThrow()
      if (step.events.length > 0) expect(() => checkEngineMessage({ type: "events", entries: step.events } as never)).not.toThrow()
      expect(step.state.seq).toBeGreaterThan(seq)
      seq = step.state.seq
    }
    // The log of a step is everything up to it, in Forge's order.
    const last = sequenceMoment(TABLE_SEQUENCE.steps.length - 1)
    expect(last.history.length).toBe(TABLE_SEQUENCE.history.length + TABLE_SEQUENCE.steps.reduce((sum, step) => sum + step.events.length, 0))
  })

  it("Forge keeps a card's id from the hand to the battlefield and from the battlefield to the graveyard", () => {
    // Gebirge (33) is played from the hand; Goblin-Brandstifter (55) goes to the graveyard (steps found by what happens: SEQUENCE_STEPS).
    const { land, dies } = SEQUENCE_STEPS
    const inHand = (step: number, id: number) => state(step).players.find((p) => p.me)!.zones.hand.some((card) => !("hidden" in card) && card.id === id)
    const onField = (step: number, id: number) => state(step).players.find((p) => p.me)!.zones.battlefield.some((card) => !("hidden" in card) && card.id === id)
    expect(inHand(land - 1, 33) && !onField(land - 1, 33)).toBe(true)
    expect(!inHand(land, 33) && onField(land, 33)).toBe(true)
    expect(onField(dies - 1, 55)).toBe(true)
    expect(pileOfCard(state(dies), 55)).toEqual({ seat: "me", zone: "graveyard" })
    expect(pileOfCard(state(dies - 1), 55)).toBeNull()
  })
})

describe("cards move only as themselves", () => {
  it("the same id at another place moves; another id at the same place does not", () => {
    const row = {}
    const hand = {}
    const before = new Map([
      ["card:1", snap("card:1", 10, 10, hand)],
      ["card:2", snap("card:2", 100, 10, row)],
      ["card:3", snap("card:3", 200, 10, row)],
    ])
    const after = new Map([
      // 1 travels (another element: another region), 2 stays, 4 takes 3's place - a new card, not a move.
      ["card:1", snap("card:1", 10, 300, {})],
      ["card:2", snap("card:2", 100, 10, row)],
      ["card:4", snap("card:4", 200, 10, row)],
    ])
    const plan = planCards(before, after)
    expect(plan.moves.map((move) => [move.key, move.within])).toEqual([["card:1", false]])
    expect(plan.arrivals).toEqual(["card:4"])
    expect(plan.departures).toEqual(["card:3"])
    expect(plan.turns).toEqual([])
  })

  it("within its row a card shifts; a card that only turns turns; nothing else moves", () => {
    const row = {}
    const before = new Map([
      ["card:1", snap("card:1", 10, 10, row)],
      ["card:2", snap("card:2", 100, 10, row)],
    ])
    const after = new Map([
      ["card:1", snap("card:1", 40, 10, row)],
      ["card:2", snap("card:2", 100.5, 10, row, true)],
    ])
    const plan = planCards(before, after)
    expect(plan.moves.map((move) => [move.key, move.within, move.turned])).toEqual([["card:1", true, false]])
    expect(plan.turns).toEqual([{ key: "card:2", tapped: true }])
  })

  it("a ghost's keyframes take it from the old place to the new one", () => {
    const from: Place = { x: 10, y: 20, w: 72, h: 100, angle: 6 }
    const to: Place = { x: 210, y: 420, w: 36, h: 50, angle: 0 }
    const frames = travelFrames(to, from, to)
    expect(frames[0]!["transform"]).toBe("translate(-200px, -400px) rotate(6deg) scale(2)")
    expect(frames.at(-1)!["transform"]).toBe(placeTransform(to, to))
    expect(placeTransform(to, to)).toBe("translate(0px, 0px) rotate(0deg) scale(1)")
    // Into a pile: it shrinks and fades at the end.
    const out = travelFrames(from, from, to, "out")
    expect(out.at(-1)!["opacity"]).toBe(0)
  })

  it("every keyframe animates only transform and opacity, briefly", () => {
    for (const frames of KEYFRAME_SAMPLES) {
      for (const frame of frames) {
        for (const property of Object.keys(frame)) if (!["offset", "easing", "composite"].includes(property)) expect(MOTION_PROPERTIES).toContain(property)
      }
    }
    for (const duration of Object.values(MOTION_MS)) expect(duration).toBeLessThanOrEqual(720)
    expect(MOTION_MS.travel).toBeGreaterThanOrEqual(250)
    expect(MOTION_MS.travel).toBeLessThanOrEqual(400)
  })
})

describe("effects follow Forge", () => {
  it("only the log entries since the last state; none when the log was cut back", () => {
    const { lifeLoss, land } = SEQUENCE_STEPS
    const history = sequenceMoment(lifeLoss).history
    const seen = sequenceMoment(lifeLoss - 1).history.length
    expect(newEvents(history, seen).map((event) => event.kind)).toEqual(TABLE_SEQUENCE.steps[lifeLoss]!.events.map((event) => event.kind))
    expect(newEvents(history, history.length)).toEqual([])
    expect(newEvents(sequenceMoment(land).history, sequenceMoment(lifeLoss).history.length)).toEqual([])
  })

  it("damage: the sources Forge's DAMAGE entries name, and the cards whose damage Forge reports grew", () => {
    // Magmastrahl (14) goes on the stack; Forge logs its DAMAGE to Goblin-Brandstifter (55), whose damage grows to 2.
    const { onStack } = SEQUENCE_STEPS
    const events = TABLE_SEQUENCE.steps[onStack]!.events
    expect(hasEvent(events, "STACK_ADD")).toBe(true)
    expect(damageSources(events)).toEqual([14])
    expect(damagedCards(state(onStack - 1), state(onStack))).toEqual([55])
    expect(damagedCards(state(onStack), state(onStack + 1))).toEqual([])
    // Kinds Forge does not send are no reason for anything.
    expect(damageSources([{ kind: "SOMETHING", text: null, card: 3 }])).toEqual([])
  })

  it("life: a loss and a gain by Forge's totals", () => {
    // The Goblin's combat damage - the AI loses 1.
    const { lifeLoss } = SEQUENCE_STEPS
    const ai = state(lifeLoss).players.find((player) => !player.me)!
    expect(lifeChanges(state(lifeLoss - 1), state(lifeLoss))).toEqual([{ player: ai.id, tone: "loss" }])
    const healed = structuredClone(state(lifeLoss))
    healed.players.find((player) => !player.me)!.life += 3
    expect(lifeChanges(state(lifeLoss), healed)).toEqual([{ player: ai.id, tone: "gain" }])
    expect(lifeChanges(state(lifeLoss), state(lifeLoss + 1))).toEqual([])
  })

  it("the stack: new entries and gone ones by Forge's ids; whose a card is", () => {
    const { onStack, dies } = SEQUENCE_STEPS
    const added = stackChanges(state(onStack - 1), state(onStack))
    expect(added.added).toEqual(state(onStack).stack.map((item) => item.id))
    expect(added.gone).toEqual([])
    const resolved = stackChanges(state(dies - 1), state(dies))
    expect(resolved.added).toEqual([])
    expect(resolved.gone).toEqual(state(dies - 1).stack.map((item) => item.id))
    expect(cardSeat(state(onStack), 14)).toBe("me")
    expect(cardSeat(state(onStack), 77)).toBe("opponent")
    expect(cardSeat(state(onStack), 999_999)).toBeNull()
  })
})
