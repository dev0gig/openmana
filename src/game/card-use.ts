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
 *
 * Declaring attackers (prompt 18): Forge's declaration in progress
 * (`GameState.attack`) names the defender, every defender and the player's
 * creatures a tap would not declare, with Forge's reason. So the table marks
 * the declared attackers ("greift an"), the defender ("wird angegriffen"),
 * the other defenders a tap would switch to - on whichever side they lie (a
 * battle the player controls is attacked when an opponent protects it) -,
 * and says why a creature stays back - it offers no tap on it (Forge would
 * not take one).
 */
import type { Attack, ButtonsPurpose, EntityRef, Player, Question, SelectQuestion, VisibleCard } from "@openmana/engine-protocol"
import { ATTACK_REFUSAL_WORDS } from "./attack-labels"
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
  /** Forge's declaration of attackers in progress (GameState.attack, prompt 18); absent or null otherwise. */
  readonly attack?: Attack | null
}

export interface CardTap {
  /** The button's words: Forge's own, or - where Forge gives none - the step's (a selection, the London mulligan). */
  readonly label: string
  /** Forge marks the card for it (its marker, a selection naming it, the mulligan's hand): the card view's main button. */
  readonly marked: boolean
}

export interface CardUse {
  readonly mark: CardMark | null
  /** The card Forge's running step is about (the spell being cast, the ability's source - prompt 17). */
  readonly source: boolean
  /** The mark in words for the player ("spielbar", "kann angreifen", "ausgewählt" …); null without a mark. */
  readonly markLabel: string | null
  /** The tap Forge offers now; null: a tap would do nothing. */
  readonly tap: CardTap | null
  /** The primary activation: look at the card (safe), or tap it at once. */
  readonly primary: "look" | "tap"
  /** Why no tap can be sent right now (German), or null. */
  readonly blocked: string | null
  /** While attackers are declared: why Forge would not declare this creature (short and one sentence, German), or null (prompt 18). */
  readonly unavailable: { readonly short: string; readonly why: string } | null
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
  // A card on the stack is never tapped (Forge's card.tap takes cards of the players' zones; prompt 16): only looked at.
  const source = stepSource(questions) === card.id
  if (place.zone === "stack") return { mark: chosen ? "selected" : null, markLabel: chosen ? "ausgewählt" : null, source, tap: null, primary: "look", blocked: null, unavailable: null }
  const declaring = declaration(moment)
  if (declaring !== null && place.zone === "battlefield") {
    const found = attackUse(card, place, declaring, moment)
    if (found !== null) return { ...found, source }
  }
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
    source,
    tap,
    primary: direct && blocked === null ? "tap" : "look",
    blocked,
    unavailable: null,
  }
}

// ── Declaring attackers (prompt 18) ────────────────────────────────────────

/** Forge's declaration of attackers, while its buttons are the running step (never under a selection Forge asks meanwhile). */
export function declaration(moment: TableMoment): Attack | null {
  const step = currentStep(moment.questions)
  if (moment.attack === undefined || moment.attack === null) return null
  if ((step !== "attack" && step !== "attackDeclared") || openSelection(moment.questions) !== null) return null
  return moment.attack
}

/** Whether a reference names this player or card. */
export function isEntity(ref: EntityRef | null, kind: EntityRef["kind"], id: number): boolean {
  return ref !== null && ref.kind === kind && ref.id === id
}

/**
 * A card of a battlefield while attackers are declared - null where the
 * declaration says nothing about it (the general rules above apply):
 * a declared attacker of the player (chosen: "greift an"; its tap is Forge's
 * `action` - Forge takes it back from the defender, moves it to the defender
 * from another one, or bands it), the defender ("wird angegriffen"), another
 * defender a tap would make the defender (usable) - defenders as Forge names
 * them, on either side -, a creature of the player Forge would not declare
 * (no mark, no tap, Forge's reason).
 */
function attackUse(card: VisibleCard, place: CardPlace, attack: Attack, moment: TableMoment): Omit<CardUse, "source"> | null {
  const tapOf = (fallback: string): CardTap => ({ label: card.action ?? fallback, marked: true })
  const direct = (tap: CardTap | null) => {
    const blocked = tap === null ? null : tapBlocked(moment)
    return { tap, blocked, primary: tap !== null && blocked === null ? ("tap" as const) : ("look" as const) }
  }
  if (place.mine && card.attacking === true) {
    return { mark: "selected", markLabel: "greift an", unavailable: null, ...direct(card.action !== undefined ? tapOf(card.action) : null) }
  }
  if (isEntity(attack.defender, "card", card.id)) {
    return { mark: "selected", markLabel: "wird angegriffen", unavailable: null, ...direct(null) }
  }
  if (attack.defenders.some((ref) => isEntity(ref, "card", card.id))) {
    return { mark: "usable", markLabel: "kann angegriffen werden", unavailable: null, ...direct(tapOf("Angreifen")) }
  }
  const refused = place.mine ? attack.unavailable.find((entry) => entry.card === card.id) : undefined
  if (refused !== undefined) {
    const words = ATTACK_REFUSAL_WORDS[refused.reason]
    return { mark: null, markLabel: `kann nicht angreifen: ${words.short}`, unavailable: words, tap: null, blocked: null, primary: "look" }
  }
  return null
}

/**
 * The card Forge's running step is about (prompt 17): the spell being cast
 * or the ability's source, which Forge sends with the selection of its
 * targets and the payment of its cost. Forge's priority names no such card
 * (its line is about the whole game), so there is none then.
 */
export function stepSource(questions: readonly Question[]): number | null {
  for (const question of questions) {
    if (question.kind === "select" && question.card !== undefined) return question.card
    if (question.kind === "buttons" && question.purpose !== "priority" && question.card !== undefined) return question.card
  }
  return null
}

// ── Players (prompt 17) ────────────────────────────────────────────────────

export interface PlayerTap {
  /** The button's words (German). */
  readonly label: string
}

export interface PlayerUse {
  /** Forge's highlight (chosen) or its running input would take the player (usable); null: neither. */
  readonly mark: CardMark | null
  /** The mark in words ("wählbar", "gewählt", "kann mit Leben bezahlen"). */
  readonly markLabel: string | null
  /** The tap Forge's running input would take now; null: a tap would do nothing. */
  readonly tap: PlayerTap | null
  /** Why no tap can be sent right now (German), or null. */
  readonly blocked: string | null
}

/**
 * What the player can do with a player of the game table right now: only
 * what Forge's running input would take (the state's `selectable` - asked of
 * that input with the same checks its click runs) and Forge's highlight
 * (`highlighted`: chosen as a target so far). A player is chosen as a
 * target, taken back, or - while a cost is paid - pays life for mana (Forge's
 * Phyrexian mana: its prompt says so). Both steps tap at once and are taken
 * back the way Forge offers (a second tap, its Cancel), like the cards of a
 * selection or a payment. No rule, no guess: without Forge's mark no tap.
 */
export function playerUse(player: Player, moment: TableMoment): PlayerUse {
  const chosen = player.highlighted === true
  const step = currentStep(moment.questions)
  const payment = step === "payment" && openSelection(moment.questions) === null
  // While attackers are declared Forge highlights the player they attack (its current defender), and a tap on another
  // defending player makes them the defender (prompt 18).
  const attack = (step === "attack" || step === "attackDeclared") && openSelection(moment.questions) === null
  let tap: PlayerTap | null = null
  if (player.selectable === true) tap = { label: payment ? "Mit Leben bezahlen" : attack ? "Angreifen" : chosen ? "Auswahl aufheben" : "Wählen" }
  const mark: CardMark | null = chosen ? "selected" : tap !== null ? "usable" : null
  return {
    mark,
    markLabel:
      mark === "selected" ? (attack ? "wird angegriffen" : "gewählt") : mark === "usable" ? (payment ? "kann mit Leben bezahlen" : attack ? "kann angegriffen werden" : "wählbar") : null,
    tap,
    blocked: tap === null ? null : tapBlocked(moment),
  }
}
