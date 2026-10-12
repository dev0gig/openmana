/*
 * A run of real consecutive game states (prompt 44, the table's motion):
 * Forge's states of the recorded test game human-3-de one after another, from
 * the player's first attacking turn up to their first creature in the
 * graveyard (scripts/record-table-sequence.ts). Unedited Forge output; the
 * motion's unit tests and the end-to-end test's table harness step through it
 * like Forge's messages arrive. Every state is checked against the protocol
 * by the tests.
 */
import type { Card, GameEvent, GameStarted, GameState, Question } from "@openmana/engine-protocol"
import recorded from "./fixtures/table-sequence.json"

export interface TableSequenceStep {
  /** The transcript's message index of the state. */
  readonly message: number
  readonly state: GameState
  readonly questions: readonly Question[]
  readonly prompt: string | null
  /** Forge's log entries since the previous step. */
  readonly events: readonly GameEvent[]
}

export interface TableSequence {
  readonly name: "first-attack"
  readonly description: string
  readonly fixture: string
  readonly game: GameStarted
  /** Forge's log before the first step. */
  readonly history: readonly GameEvent[]
  readonly steps: readonly TableSequenceStep[]
}

export const TABLE_SEQUENCE = recorded as unknown as TableSequence

/** What the session holds at a step: its state, questions and prompt line, and Forge's whole log up to it. */
export function sequenceMoment(index: number): { readonly state: GameState; readonly questions: readonly Question[]; readonly prompt: string | null; readonly history: readonly GameEvent[] } {
  const step = TABLE_SEQUENCE.steps[index]
  if (step === undefined) throw new Error(`the sequence has no step ${index}`)
  const history = [...TABLE_SEQUENCE.history, ...TABLE_SEQUENCE.steps.slice(0, index + 1).flatMap((each) => each.events)]
  return { state: step.state, questions: step.questions, prompt: step.prompt, history }
}

/**
 * The moments the tests look at, found in Forge's states by what happens -
 * never by a message number: the bridge sends a state at most every 120 ms
 * and coalesces those in between, so a new recording of the same game can
 * have more or fewer states (prompt 47: 21 instead of 25). Each is the step
 * in which it is first seen.
 */
export interface SequenceLandmarks {
  /** Forge's draw: Bergkamm (27) arrives in the player's hand. */
  readonly draw: number
  /** Gebirge (33) is played: from the hand onto the battlefield. */
  readonly land: number
  /** The attacking Goblin-Brandstifter (55) is tapped. */
  readonly tapped: number
  /** The AI loses life (the Goblin's combat damage). */
  readonly lifeLoss: number
  /** The Goblin untaps again (the player's next untap step). */
  readonly untapped: number
  /** Magmastrahl (14) goes on the stack; Forge logs its DAMAGE to the Goblin. */
  readonly onStack: number
  /** The spell resolves: the Goblin goes to the graveyard. */
  readonly dies: number
}

function landmarks(): SequenceLandmarks {
  const steps = TABLE_SEQUENCE.steps
  const zoneOf = (state: GameState, id: number): string | null => {
    for (const player of state.players) for (const [zone, cards] of Object.entries(player.zones) as [string, readonly Card[]][]) if (cards.some((card) => !("hidden" in card) && card.id === id)) return `${player.me ? "me" : "ai"}:${zone}`
    return state.stack.some((item) => item.card !== null && !("hidden" in item.card) && item.card.id === id) ? "stack" : null
  }
  const card = (state: GameState, id: number) => state.players.flatMap((player) => Object.values(player.zones).flat()).find((each) => !("hidden" in each) && each.id === id)
  const tapped = (state: GameState, id: number) => { const found = card(state, id); return found !== undefined && !("hidden" in found) && found.tapped }
  const aiLife = (state: GameState) => state.players.find((player) => !player.me)!.life
  const first = (name: string, from: number, test: (index: number) => boolean): number => {
    for (let index = Math.max(1, from); index < steps.length; index++) if (test(index)) return index
    throw new Error(`the recorded sequence has no step "${name}"`)
  }
  const state = (index: number) => steps[index]!.state
  const draw = first("draw", 1, (i) => zoneOf(state(i), 27) === "me:hand" && zoneOf(state(i - 1), 27) !== "me:hand")
  const land = first("land", 1, (i) => zoneOf(state(i - 1), 33) === "me:hand" && zoneOf(state(i), 33) === "me:battlefield")
  const tappedAt = first("tapped", land, (i) => tapped(state(i), 55) && !tapped(state(i - 1), 55))
  const lifeLoss = first("lifeLoss", 1, (i) => aiLife(state(i)) < aiLife(state(i - 1)))
  const untapped = first("untapped", tappedAt + 1, (i) => !tapped(state(i), 55) && tapped(state(i - 1), 55))
  const onStack = first("onStack", untapped, (i) => zoneOf(state(i), 14) === "stack" && zoneOf(state(i - 1), 14) !== "stack")
  const dies = first("dies", onStack, (i) => zoneOf(state(i), 55) === "me:graveyard" && zoneOf(state(i - 1), 55) !== "me:graveyard")
  return { draw, land, tapped: tappedAt, lifeLoss, untapped, onStack, dies }
}

export const SEQUENCE_STEPS: SequenceLandmarks = landmarks()
