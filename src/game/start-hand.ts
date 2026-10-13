/*
 * The start hand in full screen (prompt 50): when it is shown and what it
 * shows - pure, no React, no engine.
 *
 * Forge asks about the start hand with its two buttons: `mulligan` (keep or
 * take a mulligan - after each mulligan again, about the new hand) and, after
 * keeping a hand of a London mulligan, `mulliganBottom` (the cards that go
 * under the library: a tap on a hand card marks it - Forge's `highlighted` -,
 * Forge's OK confirms, enabled by Forge once the number is right). Those are
 * the start questions; the overview shows the player's hand whole for them
 * and offers exactly Forge's buttons. Nothing here decides or answers.
 *
 * When the overview is open (`startHandOpen`):
 *  - the running game opens it by itself at each start question whose hand
 *    it has not shown yet - a new hand after a mulligan, the choice for the
 *    bottom -, the replay only when asked ("Starthand ansehen");
 *  - closing it (X, Escape, the system's back) never answers: the decision
 *    region keeps Forge's buttons, and the overview stays closed for this
 *    hand (`dismissed`), until the player opens it again;
 *  - after an answer sent from the overview it stays open while Forge
 *    computes (the next hand, the AI's mulligan) - until the next start
 *    question shows its hand, or the game begins: a turn, or any other
 *    question of Forge's (then it closes: back to the normal table).
 *
 * The key of a start question is its step and the ids of the hand's cards:
 * Forge asks the same step again after every tap during the choice for the
 * bottom (a new question id each time), so the question id alone would open
 * the overview again after every card the player marks on the table.
 */
import type { ButtonsQuestion, ButtonsPurpose, GameState, Question } from "@openmana/engine-protocol"
import { currentDecision } from "./decision-model"
import { isVisible } from "./table-model"

/** The two start questions (Forge's purposes). */
export type StartStep = Extract<ButtonsPurpose, "mulligan" | "mulliganBottom">

const START_STEPS: ReadonlySet<ButtonsPurpose> = new Set<ButtonsPurpose>(["mulligan", "mulliganBottom"])

export type StartQuestion = ButtonsQuestion & { readonly purpose: StartStep }

/** Forge's start question the decision region answers now (never under a blocking question or a selection Forge asks meanwhile). */
export function startQuestion(questions: readonly Question[]): StartQuestion | null {
  const decision = currentDecision(questions)
  if (decision.kind !== "step" || decision.select !== null || decision.buttons === null) return null
  const purpose = decision.buttons.purpose
  return purpose !== undefined && START_STEPS.has(purpose) ? (decision.buttons as StartQuestion) : null
}

/** The player's hand as Forge sends it (its order), hidden cards included (they stay backs). */
export function playerHand(state: GameState): GameState["players"][number]["zones"]["hand"] {
  return state.players.find((player) => player.me)?.zones.hand ?? []
}

/** Which hand a start question is about: its step and the ids of the hand's visible cards (see above). */
export function startHandKey(question: StartQuestion, state: GameState): string {
  const ids = playerHand(state).filter(isVisible).map((card) => card.id)
  return `${question.purpose}:${ids.join(",")}`
}

/** What the overview remembers between states. */
export interface StartHandMemory {
  /** The hand the player closed the overview for (it does not open by itself again for it). */
  readonly dismissed: string | null
  /** The hand the player opened it for ("Starthand ansehen"; in a replay the only way). */
  readonly requested: string | null
  /** The hand an answer went from the overview for; it stays open until Forge's next start question or the game begins. */
  readonly awaiting: string | null
  /**
   * The hand the overview was open for last. Forge withdraws a question and asks the next one (after every tap during
   * the choice for the bottom): in between there is no start question for a moment - the overview stays open over it,
   * and so does a card view opened from it.
   */
  readonly shown: string | null
}

export const START_HAND_MEMORY: StartHandMemory = { dismissed: null, requested: null, awaiting: null, shown: null }

/** The memory after this state: the wait after an answer ends with another start question or when the game began; what was shown last. */
export function nextStartHandMemory(memory: StartHandMemory, key: string | null, open: boolean, past: boolean): StartHandMemory {
  const awaiting = awaitingOver(memory, key, past) ? null : memory.awaiting
  const shown = past ? null : key === null ? memory.shown : open ? key : null
  return awaiting === memory.awaiting && shown === memory.shown ? memory : { ...memory, awaiting, shown }
}

/** Whether the wait after an answer from the overview is over: another start question, or the game began. */
export function awaitingOver(memory: StartHandMemory, key: string | null, past: boolean): boolean {
  return memory.awaiting !== null && ((key !== null && key !== memory.awaiting) || (key === null && past))
}

/** Whether the game has begun past the start questions: a turn, or another question of Forge's. */
export function pastStart(state: GameState, questions: readonly Question[]): boolean {
  return state.turn > 0 || (questions.length > 0 && startQuestion(questions) === null)
}

/**
 * Whether the overview is open: at a start question, when the game opens it
 * by itself (`auto`) and the player did not close it for this hand, or when
 * the player asked for it; between the start questions after an answer from
 * the overview (`awaiting`), until the game begins.
 */
export function startHandOpen(memory: StartHandMemory, key: string | null, auto: boolean, past: boolean): boolean {
  if (key !== null) return memory.requested === key || memory.awaiting === key || (auto && memory.dismissed !== key)
  return (memory.awaiting !== null || memory.shown !== null) && !past
}
