/*
 * The turn, the priority and the stack as data (prompt 16): where in its turn
 * the game is, who is at it, what lies on the stack and what the player's
 * priority means right now. Pure: no React, no engine.
 *
 * Nothing here is a Magic rule. Every value is Forge's:
 *  - the step comes from the state's `phase` (Forge's PhaseType), whose turn
 *    it is from `activePlayer` and `me`, who holds priority from the players'
 *    `hasPriority`;
 *  - the stack is Forge's, top first; what an item is comes from its own
 *    flags (`ability`, `trigger`), who put it there from its `player`;
 *  - what Forge's buttons of the priority step do comes with them
 *    (`Button.meaning`, from Forge's own label keys in the bridge).
 * The only fixed knowledge is the order of the turn's steps (comprehensive
 * rules 500-514, the same list as Forge's PhaseType) - a label for the
 * track in the header, never a decision: Forge alone moves the game on, and
 * a step Forge skips (a combat without attackers) is simply passed over.
 *
 * Forge's own auto-pass stays in charge (Bible §6 "Reduce meaningless
 * interaction"): the engine passes every priority in which Forge finds
 * nothing the player can do (APINA). What reaches the table is a priority in
 * which the player can act - the app never passes one by itself.
 */
import type { ButtonMeaning, ButtonsQuestion, GameState, Phase, Player, Question, StackItem, VisibleCard } from "@openmana/engine-protocol"
import type { Seat } from "./table-model"

/** The five phases of a turn and their steps, in Forge's order (PhaseType). */
export const TURN_PHASES: readonly { readonly key: TurnPhaseKey; readonly steps: readonly Phase[] }[] = [
  { key: "beginning", steps: ["UNTAP", "UPKEEP", "DRAW"] },
  { key: "main1", steps: ["MAIN1"] },
  { key: "combat", steps: ["COMBAT_BEGIN", "COMBAT_DECLARE_ATTACKERS", "COMBAT_DECLARE_BLOCKERS", "COMBAT_FIRST_STRIKE_DAMAGE", "COMBAT_DAMAGE", "COMBAT_END"] },
  { key: "main2", steps: ["MAIN2"] },
  { key: "ending", steps: ["END_OF_TURN", "CLEANUP"] },
]

export type TurnPhaseKey = "beginning" | "main1" | "combat" | "main2" | "ending"

/** Every step of a turn, in order. */
export const TURN_STEPS: readonly Phase[] = TURN_PHASES.flatMap((phase) => phase.steps)

/** Where a step stands against the current one: over, now, still to come. */
export type StepState = "done" | "current" | "upcoming"

/** Each step of the turn with where it stands (all upcoming before the first turn). */
export function turnSteps(current: Phase | null): readonly { readonly phase: TurnPhaseKey; readonly step: Phase; readonly state: StepState }[] {
  const index = current === null ? -1 : TURN_STEPS.indexOf(current)
  return TURN_PHASES.flatMap((phase) =>
    phase.steps.map((step) => {
      const at = TURN_STEPS.indexOf(step)
      return { phase: phase.key, step, state: index < 0 ? "upcoming" : at < index ? "done" : at === index ? "current" : "upcoming" }
    }),
  )
}

/** What a stack item is, by its own flags: a spell, an activated ability, a triggered ability. */
export type StackKind = "spell" | "ability" | "trigger"

export function stackKind(item: StackItem): StackKind {
  return item.trigger ? "trigger" : item.ability ? "ability" : "spell"
}

/** Who a player id is at this table ("me" by Forge's `me`); null: Forge did not say. */
export function seatOf(state: GameState, id: number | null): Seat | null {
  if (id === null) return null
  const player = state.players.find((candidate) => candidate.id === id)
  return player === undefined ? null : player.me ? "me" : "opponent"
}

/** The item on top of the stack (resolves next) and what it is. */
export interface StackTop {
  readonly item: StackItem
  readonly kind: StackKind
  /** Who put it there. */
  readonly controller: Seat | null
  /** Its card as Forge shows it; null: hidden, or Forge names none. */
  readonly card: VisibleCard | null
}

export function stackTop(state: GameState): StackTop | null {
  const item = state.stack[0]
  if (item === undefined) return null
  const card = item.card !== null && !("hidden" in item.card) ? item.card : null
  return { item, kind: stackKind(item), controller: seatOf(state, item.player), card }
}

/** Whose turn it is (null before the first turn). */
export function turnSeat(state: GameState): Seat | null {
  return seatOf(state, state.activePlayer)
}

/** The player Forge says holds priority right now, if one does. */
export function priorityHolder(state: GameState): Player | null {
  return state.players.find((player) => player.hasPriority) ?? null
}

/** The player's priority, as the decision region shows it. */
export interface PriorityMoment {
  readonly question: ButtonsQuestion
  /** Whose turn it is. */
  readonly turn: Seat | null
  /** How many items lie on the stack, and the top one. */
  readonly depth: number
  readonly top: StackTop | null
  /** What passing does now: with an empty stack the game moves on, else the top may resolve. */
  readonly pass: "continue" | "resolve"
  /** What Forge's second button does (end the turn, undo the last action), if Forge says. */
  readonly second: ButtonMeaning | null
}

/** Forge's buttons of the priority step, if they are open (never under a blocking question - see currentDecision). */
export function priorityQuestion(questions: readonly Question[]): ButtonsQuestion | null {
  if (questions.some((question) => question.blocking)) return null
  return questions.findLast((question): question is ButtonsQuestion => question.kind === "buttons" && question.purpose === "priority") ?? null
}

export function priorityMoment(state: GameState, question: ButtonsQuestion): PriorityMoment {
  const top = stackTop(state)
  const second = question.buttons.find((button) => button.nr === 2)?.meaning
  return {
    question,
    turn: turnSeat(state),
    depth: state.stack.length,
    top,
    pass: top === null ? "continue" : "resolve",
    second: second === undefined || second === "pass" ? null : second,
  }
}
