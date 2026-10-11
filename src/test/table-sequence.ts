/*
 * A run of real consecutive game states (prompt 44, the table's motion):
 * Forge's states of the recorded test game human-3-de one after another, from
 * the player's first attacking turn up to their first creature in the
 * graveyard (scripts/record-table-sequence.ts). Unedited Forge output; the
 * motion's unit tests and the end-to-end test's table harness step through it
 * like Forge's messages arrive. Every state is checked against the protocol
 * by the tests.
 */
import type { GameEvent, GameStarted, GameState, Question } from "@openmana/engine-protocol"
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
