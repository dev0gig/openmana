/*
 * German wording of priority, stack and turn (prompt 16): the phases of a
 * turn, whose turn it is, what a stack item is, what Forge's OK does at the
 * player's priority, what the priority is about and what ending the turn
 * gives away. Keyed by Forge's structured values (turn-model.ts) - never by
 * Forge's (localized) texts. Only the game page loads it (the start page's
 * words stay in game-labels.ts).
 */
import { cardName } from "./table-labels"
import type { Seat } from "./table-model"
import type { PriorityMoment, StackKind, StackTop, TurnPhaseKey } from "./turn-model"

/** The five phases of a turn (comprehensive rules 500-514), as Magic's German rules name them. */
export const TURN_PHASE_LABELS: Readonly<Record<TurnPhaseKey, string>> = {
  beginning: "Anfangsphase",
  main1: "Erste Hauptphase",
  combat: "Kampfphase",
  main2: "Zweite Hauptphase",
  ending: "Endphase",
}

/** Whose turn it is, short enough for the header of a small phone. */
export function turnOwnerLabel(seat: Seat | null): string {
  return seat === "me" ? "Du bist am Zug" : seat === "opponent" ? "Forge-KI am Zug" : "Die Starthände werden gezogen"
}

/** What a stack item is, in the words of Magic's German rules. */
export const STACK_KIND_LABELS: Readonly<Record<StackKind, string>> = {
  spell: "Zauberspruch",
  ability: "Aktivierte Fähigkeit",
  trigger: "Ausgelöste Fähigkeit",
}

/** Forge's OK at the player's priority, by what passing does now (Button.meaning "pass"). */
export const PASS_LABELS: Readonly<Record<PriorityMoment["pass"], string>> = {
  continue: "Weiter",
  resolve: "Verrechnen lassen",
}

/**
 * What passing does, in two short sentences - a static explanation of
 * priority (comprehensive rules 117.4, 405.5, 500.2), never a forecast:
 * whether someone still acts, Forge decides.
 */
export const PASS_NOTES: Readonly<Record<PriorityMoment["pass"], string>> = {
  continue: "„Weiter“ gibt die Priorität ab. Tut danach niemand mehr etwas, geht es zum nächsten Schritt.",
  resolve: "„Verrechnen lassen“ gibt die Priorität ab. Antwortet danach niemand mehr, wird das Oberste auf dem Stapel verrechnet.",
}

/** What lies on top of the stack, from Forge's flags and who put it there. */
function topLine(top: StackTop): string {
  const name = top.card === null ? null : `„${cardName(top.card)}“`
  switch (top.controller) {
    case "me":
      if (top.kind === "spell") return name === null ? "Du hast einen verdeckten Zauberspruch gewirkt." : `Du hast ${name} gewirkt.`
      if (top.kind === "ability") return name === null ? "Du hast eine Fähigkeit aktiviert." : `Du hast eine Fähigkeit von ${name} aktiviert.`
      return name === null ? "Eine deiner Karten hat eine Fähigkeit ausgelöst." : `Deine Karte ${name} hat eine Fähigkeit ausgelöst.`
    case "opponent":
      if (top.kind === "spell") return name === null ? "Die Forge-KI hat einen verdeckten Zauberspruch gewirkt." : `Die Forge-KI hat ${name} gewirkt.`
      if (top.kind === "ability") return name === null ? "Die Forge-KI hat eine Fähigkeit aktiviert." : `Die Forge-KI hat eine Fähigkeit von ${name} aktiviert.`
      return name === null ? "Eine Karte der Forge-KI hat eine Fähigkeit ausgelöst." : `${name} der Forge-KI hat eine Fähigkeit ausgelöst.`
    default:
      return name === null ? `Oben auf dem Stapel liegt: ${STACK_KIND_LABELS[top.kind]}.` : `Oben auf dem Stapel liegt ${name}.`
  }
}

/**
 * The player's priority in words (the decision region's text instead of
 * Forge's status line, which repeats turn, step and stack with player
 * names): what lies on top of the stack, or whose turn it is - and what the
 * player can do. Everything from Forge's structured state.
 */
export function priorityText(moment: PriorityMoment): string {
  const { top } = moment
  if (top === null) {
    return moment.turn === "opponent" ? "Zug der Forge-KI: Du kannst jetzt etwas spielen – oder weitergeben." : "Du kannst jetzt eine Karte spielen – oder weitergeben."
  }
  const pronoun = top.kind === "spell" ? "es" : "sie"
  const answer = top.controller === "me" ? `Du kannst noch etwas darauflegen – oder ${pronoun} verrechnen lassen.` : `Du kannst darauf antworten – oder ${pronoun} verrechnen lassen.`
  return `${topLine(top)} ${answer}`
}

/** The question before ending the turn (Forge's End Turn: its auto-pass until the end of the turn). */
export function endTurnText(turn: Seat | null): string {
  return turn === "me"
    ? "Forge gibt die Priorität für dich weiter, bis dein Zug endet – ein noch ausstehender Angriff fällt damit weg. Wirkt die Forge-KI einen Zauberspruch, fragt Forge dich wieder."
    : "Forge gibt die Priorität für dich weiter, bis dieser Zug endet. Wirkt die Forge-KI einen Zauberspruch oder greift sie dich an, fragt Forge dich wieder."
}
