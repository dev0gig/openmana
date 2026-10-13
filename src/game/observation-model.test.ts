/*
 * The opponent's turn in words (prompt 49) on real observations of the Forge
 * engine (protocol 10): src/test/fixtures/observations.json, recorded by
 * scripts/record-observations.ts from the fixture games priority-respond-observe
 * (the engine holds) and lands (it never holds). One case is built from a real
 * one and marked so (a turn's end alone).
 */
import { describe, expect, it } from "vitest"
import type { GameState, Observation } from "@openmana/engine-protocol"
import { foldOpponentTurn } from "@/engine/engine-session"
import fixture from "@/test/fixtures/observations.json"
import { observationCards, observationSteps, presentation, turnSummary, turnSummaryText } from "./observation-model"

interface Recorded {
  readonly name: string
  readonly observation: Observation
  readonly state: GameState
}

const RECORDED = fixture.observations as unknown as readonly Recorded[]

function recorded(name: string): Recorded {
  const found = RECORDED.find((each) => each.name === name)
  if (found === undefined) throw new Error(`no recorded observation ${name}`)
  return found
}

function steps(name: string) {
  const { observation, state } = recorded(name)
  return observationSteps(observation, state)
}

describe("the steps of an observation (real observations of Forge)", () => {
  it("the opponent's turn beginning: one step with its number and whose turn it is - the turn's end before it is folded in", () => {
    const [step, ...rest] = steps("held-turn-opponent")
    expect(rest).toEqual([])
    expect(step).toMatchObject({ kind: "turn", actor: "opponent", title: "Zug 2 · Die Forge-KI ist am Zug", turn: { number: 2, seat: "opponent" }, cards: [] })
  })

  it("the player's turn beginning, held or not", () => {
    expect(steps("held-turn-me")[0]).toMatchObject({ kind: "turn", actor: "me", turn: { number: 1, seat: "me" }, title: "Zug 1 · Du bist am Zug" })
    expect(steps("unheld-turn-me")).toHaveLength(1)
    expect(steps("unheld-turn-me")[0]).toMatchObject({ kind: "turn", actor: "me", turn: { seat: "me" } })
  })

  it("a turn's end alone is a step of its own, without a player (built from the real beginning of turn 2: its turnEnd only)", () => {
    const { observation, state } = recorded("held-turn-opponent")
    const end = observation.actions.find((action) => action.kind === "turnEnd")!
    const built = { ...observation, actions: [end] } as Observation
    expect(observationSteps(built, state)).toEqual([expect.objectContaining({ kind: "turnEnd", actor: null, title: "Zug 1 endet", turn: null })])
  })

  it("the AI's land: its card large, the action in German with the card's name as Forge names it", () => {
    const [step] = steps("held-land")
    expect(step).toMatchObject({ kind: "land", actor: "opponent", title: "Die Forge-KI spielt ein Land: Forest", lines: [] })
    expect(step!.cards).toHaveLength(1)
    expect(step!.cards[0]).toMatchObject({ key: "Forest" })
  })

  it("the AI's spell: its card, no targets", () => {
    expect(steps("held-cast")[0]).toMatchObject({ kind: "cast", actor: "opponent", title: "Die Forge-KI wirkt Llanowarelfen", lines: [] })
  })

  it("a spell with targets names them from the player's point of view", () => {
    const [step] = steps("cast-targets")
    expect(step).toMatchObject({ kind: "cast", actor: "me", title: "Du wirkst Geborstener Blitz" })
    expect(step!.lines).toEqual(["Ziel: die Forge-KI"])
  })

  it("a resolution with its public results: the creature comes onto the AI's battlefield", () => {
    const [step] = steps("held-resolve-moves")
    expect(step).toMatchObject({ kind: "resolve", actor: "opponent", title: "Llanowarelfen wird verrechnet" })
    expect(step!.lines).toContain("Llanowarelfen kommt auf das Spielfeld der Forge-KI.")
  })

  it("damage and life of a resolution, in Forge's order", () => {
    const [step] = steps("resolve-damage")
    expect(step!.title).toBe("Geborstener Blitz wird verrechnet")
    expect(step!.lines).toEqual(expect.arrayContaining(["Geborstener Blitz fügt der Forge-KI 2 Schadenspunkte zu.", "Forge-KI: 20 → 18 Lebenspunkte."]))
  })

  it("the AI's attack: the attackers' cards and whom each attacks", () => {
    const [step] = steps("held-attack")
    expect(step!.kind).toBe("attack")
    expect(step!.title).toMatch(/^Die Forge-KI greift mit (einer Kreatur|\d+ Kreaturen) an$/)
    expect(step!.cards.length).toBeGreaterThan(0)
    expect(step!.lines.every((line) => /greif(t|en) dich an$/.test(line))).toBe(true)
  })

  it("equal attackers of one defender are named together (built from the recorded attack: its first attacker three times)", () => {
    const { observation, state } = recorded("held-attack")
    const attack = observation.actions.find((action) => action.kind === "attack")!
    if (attack.kind !== "attack") throw new Error("no attack")
    const first = attack.attacks[0]
    const built = { ...observation, actions: [{ ...attack, attacks: [first, { ...first }, { ...first }] }] } as Observation
    const [step] = observationSteps(built, state)
    expect(step!.title).toBe("Die Forge-KI greift mit 3 Kreaturen an")
    expect(step!.lines).toEqual([expect.stringMatching(/^.+ \(3\) greifen dich an$/)])
    expect(step!.cards).toHaveLength(3)
  })

  it("blocks: every attacker with its blockers or unblocked", () => {
    const [step] = steps("block")
    expect(step!.kind).toBe("block")
    expect(step!.lines.length).toBeGreaterThan(0)
    expect(step!.lines.every((line) => / blockt | blocken |wird nicht geblockt$/.test(line))).toBe(true)
  })

  it("combat damage: the life totals that changed", () => {
    const [step] = steps("combat-damage")
    expect(step).toMatchObject({ kind: "combatDamage", title: "Kampfschaden" })
    expect(step!.lines.some((line) => /^Du: \d+ → \d+ Lebenspunkte\.$/.test(line))).toBe(true)
  })

  it("keys are stable per observation and action", () => {
    const { observation } = recorded("held-land")
    expect(steps("held-land")[0]!.key).toBe(`${observation.id}:${observation.actions[0]!.n}`)
  })

  it("every recorded observation gives at least one step, and only cards the player may see are looked up", () => {
    for (const each of RECORDED) {
      expect(observationSteps(each.observation, each.state).length).toBeGreaterThan(0)
      expect(observationCards(each.observation).every((card) => !("hidden" in card))).toBe(true)
    }
  })
})

describe("how an observation is presented", () => {
  it("held: the stage; a change of turn without holding: the band; an action of the AI without holding: an interruption; the player's own: nothing", () => {
    expect(presentation(recorded("held-land").observation, recorded("held-land").state)).toBe("stage")
    expect(presentation(recorded("unheld-turn-me").observation, recorded("unheld-turn-me").state)).toBe("turn")
    expect(presentation(recorded("unheld-attack").observation, recorded("unheld-attack").state)).toBe("interrupt")
    expect(presentation(recorded("own-land").observation, recorded("own-land").state)).toBe("none")
  })
})

describe("what the AI did last (EngineSession.opponentTurn)", () => {
  it("collects the AI's lands, spells and attacks of its turn and starts afresh with its next turn; the player's own actions never", () => {
    let turn = foldOpponentTurn(null, recorded("held-turn-opponent").observation, recorded("held-turn-opponent").state)
    expect(turn).toEqual({ turn: 2, actions: [] })
    expect(turnSummaryText(turn)).toBe("Die Forge-KI hat in Zug 2 nichts gespielt und nicht angegriffen.")
    for (const name of ["held-land", "held-cast", "own-land", "cast-targets", "held-attack"]) turn = foldOpponentTurn(turn, recorded(name).observation, recorded(name).state)
    expect(turn!.actions.map((action) => action.kind)).toEqual(["land", "cast", "attack"])
    expect(turnSummary(turn!)).toEqual(["Forest gespielt", "Llanowarelfen gewirkt", expect.stringMatching(/^mit (einer Kreatur|\d+ Kreaturen) angegriffen$/)])
    expect(turnSummaryText(turn)).toMatch(/^Die Forge-KI in Zug 2: Forest gespielt · Llanowarelfen gewirkt · mit .+ angegriffen\.$/)
    // The AI's next turn begins: the summary is replaced, never a growing history.
    const next = { ...recorded("held-turn-opponent").observation, actions: [{ n: 99, kind: "turn", player: 1, turn: 4 }] } as Observation
    expect(foldOpponentTurn(turn, next, recorded("held-turn-opponent").state)).toEqual({ turn: 4, actions: [] })
    // Without a state that names the player, nothing changes.
    expect(foldOpponentTurn(turn, next, null)).toBe(turn)
  })
})
