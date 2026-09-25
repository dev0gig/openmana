/*
 * What the player can do with a card of the game table right now (prompt 14):
 * how the table marks it, whether Forge offers a tap on it and what the tap
 * is called, and what the card's primary activation (click, tap, Enter)
 * does. Pure: no React, no engine.
 *
 * Nothing here is a Magic rule. Everything comes from what Forge sends:
 *  - its markers on the card: `playable` (Forge's actionable highlight:
 *    something can be done with the card now), `highlighted` (Forge's
 *    selection: chosen targets or cards, the attacker blockers are assigned
 *    to, the cards going to the bottom in the London mulligan), `action`
 *    (what a tap would do now, in Forge's words, from the input that runs);
 *  - the open questions: a selection (`select`) names the cards that may be
 *    chosen, and the purpose of Forge's two buttons says which step runs
 *    (priority, payment, attack, block, mulligan …).
 *
 * Looking at a card is always safe: it sends nothing. A tap is Forge's
 * `card.tap` - Forge decides what it means. The primary activation of a card
 * looks at it first (the tap is then a button in the card view: "look first"),
 * except in the steps where Forge's own input lets the player take a tap back
 * and confirms the whole step with its own button - choosing what a selection
 * asks for, paying a cost, declaring attackers or blockers, choosing cards
 * for the bottom in the London mulligan. There a tap is sent at once (Anvil's
 * lessons: one confirmation per land made five mana ten presses; declaring
 * several attackers must be quick; a block needs the attacker and then the
 * blocker; the London mulligan never answers `action` although every tap
 * counts). A tap that provably does nothing is never offered: the primary
 * activation then looks at the card.
 */
import type { ButtonsPurpose, Question, SelectQuestion, VisibleCard } from "@openmana/engine-protocol"
import type { CardZone } from "./table-model"

/** How the table marks a card: chosen (Forge's highlight) or usable now (Forge's marker, or named by a selection). */
export type CardMark = "selected" | "usable"

/** Where a card lies: its zone (null: none the player is shown) and whether that is the player's own (Forge's `me`). */
export interface CardPlace {
  readonly zone: CardZone | null
  readonly mine: boolean
}

/** What the table knows beside the card: the open questions, whether Forge waits, whether a concession is on its way. */
export interface TableMoment {
  readonly questions: readonly Question[]
  readonly waiting: boolean
  readonly conceding: boolean
}

export interface CardTap {
  /** The button's words: Forge's own, or - where Forge gives none - the step's (a selection, the London mulligan). */
  readonly label: string
  /** Forge marks the card for it (its marker, a selection naming it, the mulligan's hand): the card view's main button. */
  readonly marked: boolean
}

export interface CardUse {
  readonly mark: CardMark | null
  /** The mark in words for the player ("spielbar", "kann angreifen", "ausgewählt" …); null without a mark. */
  readonly markLabel: string | null
  /** The tap Forge offers now; null: a tap would do nothing. */
  readonly tap: CardTap | null
  /** The primary activation: look at the card (safe), or tap it at once. */
  readonly primary: "look" | "tap"
  /** Why no tap can be sent right now (German), or null. */
  readonly blocked: string | null
}

/** The steps in which Forge's input takes a tap back and confirms the step with its own button (see above). */
const DIRECT_STEPS: ReadonlySet<ButtonsPurpose> = new Set(["payment", "attack", "attackDeclared", "block", "mulliganBottom"])

/** The open selection (targets, cards to choose …), if any. */
export function openSelection(questions: readonly Question[]): SelectQuestion | null {
  return questions.find((question): question is SelectQuestion => question.kind === "select") ?? null
}

/** The step Forge's two buttons are for, if it says. */
export function currentStep(questions: readonly Question[]): ButtonsPurpose | null {
  for (const question of questions) if (question.kind === "buttons" && question.purpose !== undefined) return question.purpose
  return null
}

/**
 * Whether the running step taps cards at once (a selection, or one of the
 * steps above) - the table says so next to Forge's prompt, because looking at
 * a card then needs the other gesture (long press, right click).
 */
export function directTaps(questions: readonly Question[]): boolean {
  const step = currentStep(questions)
  return openSelection(questions) !== null || (step !== null && DIRECT_STEPS.has(step))
}

/** Why nothing can be tapped right now; null: taps can be sent. */
export function tapBlocked(moment: TableMoment): string | null {
  if (moment.conceding) return "Die Aufgabe ist unterwegs."
  // The client refuses card taps while a blocking question waits (protocol: not-active).
  if (moment.questions.some((question) => question.blocking)) return "Forge wartet zuerst auf deine Antwort auf seine Frage."
  if (!moment.waiting) return "Forge rechnet gerade."
  return null
}

function usableLabel(step: ButtonsPurpose | null): string {
  switch (step) {
    case "attack":
    case "attackDeclared":
      return "kann angreifen"
    case "block":
      return "kann blocken"
    case "payment":
      return "kann bezahlen"
    default:
      return "spielbar"
  }
}

export function cardUse(card: VisibleCard, place: CardPlace, moment: TableMoment): CardUse {
  const { questions } = moment
  const step = currentStep(questions)
  const selection = openSelection(questions)
  const chosen = card.highlighted === true
  const named = selection !== null && selection.cards.includes(card.id)
  // The London mulligan marks nothing and names no action, yet a tap on a hand card chooses it (Anvil lesson).
  const mulligan = step === "mulliganBottom" && place.zone === "hand" && place.mine
  const usable = named || mulligan || card.playable === true

  let tap: CardTap | null = null
  if (named) tap = { label: chosen ? "Auswahl aufheben" : "Auswählen", marked: true }
  else if (card.action !== undefined) tap = { label: card.action, marked: usable }
  else if (mulligan) tap = { label: chosen ? "Doch behalten" : "Unter die Bibliothek legen", marked: true }
  else if (card.playable === true) tap = { label: "Karte antippen", marked: true }

  const direct = tap !== null && (named || mulligan || (step !== null && DIRECT_STEPS.has(step)))
  const blocked = tap === null ? null : tapBlocked(moment)
  const mark: CardMark | null = chosen ? "selected" : usable ? "usable" : null
  return {
    mark,
    markLabel: mark === "selected" ? "ausgewählt" : mark === "usable" ? (named || mulligan ? "wählbar" : usableLabel(step)) : null,
    tap,
    primary: direct && blocked === null ? "tap" : "look",
    blocked,
  }
}
