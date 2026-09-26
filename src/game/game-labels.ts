/*
 * German wording of a game: phases, results, why a game ended, why Forge did
 * not start one, what kind of decision Forge waits for. Codes stay English
 * (system EN); the player reads German (user DE). Everything is keyed by the
 * protocol's structured values - never by Forge's (localized) texts.
 */
import type { ButtonsPurpose, EngineError, GameEnd, GameResult, Phase, Question, QuestionKind, RejectReason } from "@openmana/engine-protocol"
import { AI_PROFILE_TABLE } from "./ai-profile-table"
import { cardName } from "./table-labels"
import type { Seat } from "./table-model"
import type { PriorityMoment, StackKind, StackTop, TurnPhaseKey } from "./turn-model"

/** The steps of a turn (comprehensive rules 500-514), as short labels. */
export const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  UNTAP: "Enttappsegment",
  UPKEEP: "Versorgungssegment",
  DRAW: "Ziehsegment",
  MAIN1: "Erste Hauptphase",
  COMBAT_BEGIN: "Beginn des Kampfes",
  COMBAT_DECLARE_ATTACKERS: "Angreifer deklarieren",
  COMBAT_DECLARE_BLOCKERS: "Blocker deklarieren",
  COMBAT_FIRST_STRIKE_DAMAGE: "Kampfschaden (Erstschlag)",
  COMBAT_DAMAGE: "Kampfschaden",
  COMBAT_END: "Ende des Kampfes",
  MAIN2: "Zweite Hauptphase",
  END_OF_TURN: "Endsegment",
  CLEANUP: "Aufräumsegment",
}

/** null: before the first turn (the mulligan). */
export function phaseLabel(phase: Phase | null): string {
  return phase === null ? "Vor dem ersten Zug" : PHASE_LABELS[phase]
}

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

/** How a game ended for the player, in one word (Anvil: "am Ende einer Partie soll immer stehen: verloren oder gewonnen"). */
export const RESULT_WORDS: Readonly<Record<GameResult, string>> = {
  win: "Gewonnen",
  loss: "Verloren",
  draw: "Unentschieden",
}

/** Forge did not say (result null): no guess. */
export function resultWord(result: GameResult | null): string {
  return result === null ? "Partie beendet" : RESULT_WORDS[result]
}

/**
 * Why the game ended, from Forge's win condition (GameEnd.reason: Forge's
 * GameEndReason) and whether the player conceded - one sentence.
 */
export function endReason(end: GameEnd): string {
  if (end.conceded) return "Du hast aufgegeben."
  switch (end.reason) {
    case "AllOpponentsLost":
    case "AllOpposingTeamsLost":
      return end.result === "win" ? "Die Forge-KI hat verloren." : end.result === "loss" ? "Du hast verloren." : "Alle Gegner haben verloren."
    case "AllHumansLost":
      return "Du hast verloren."
    case "Draw":
      return "Niemand hat gewonnen."
    case "WinsGameSpellEffect":
      return "Eine Karte hat die Partie entschieden."
    default:
      return "Forge hat die Partie beendet."
  }
}

/** "1 Zug", "12 Züge" */
export function turnsLabel(turns: number): string {
  return turns === 1 ? "1 Zug" : `${turns.toLocaleString("de-DE")} Züge`
}

/** 42000 → "42 s", 192000 → "3 min 12 s" */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`
}

/** Why Forge did not start the game (engine.error). */
export const REFUSAL_TITLES: Readonly<Record<EngineError["code"], string>> = {
  "deck-rejected": "Forge kann ein Deck so nicht spielen",
  "invalid-request": "Die Anfrage an Forge war ungültig",
  "not-ready": "Die Engine war noch nicht bereit",
  "already-started": "Diese Engine hatte schon eine Partie gespielt",
}

/** What the player can do about it. */
export const REFUSAL_ADVICE: Readonly<Record<EngineError["code"], string>> = {
  "deck-rejected": "Importiere die Liste des Decks erneut und lass diese Karten weg, oder wähle ein anderes Deck.",
  "invalid-request": "Das ist ein Fehler von OpenMana, nicht deiner Decks. Die technische Meldung steht darunter.",
  "not-ready": "Starte die Partie noch einmal – die nächste bekommt eine frisch gestartete Engine.",
  "already-started": "Starte die Partie noch einmal – die nächste bekommt eine frisch gestartete Engine.",
}

const QUESTION_KIND_LABELS: Readonly<Record<QuestionKind, string>> = {
  select: "Auswahl",
  choose: "Auswahl",
  buttons: "Entscheidung",
  confirm: "Ja oder Nein",
  options: "Eine Möglichkeit wählen",
  input: "Eingabe",
  order: "Reihenfolge festlegen",
  arrange: "Karten anordnen",
  distribute: "Verteilen",
}

const PURPOSE_LABELS: Readonly<Record<ButtonsPurpose, string>> = {
  priority: "Priorität",
  mulligan: "Mulligan",
  mulliganBottom: "Karten unter die Bibliothek legen",
  payment: "Kosten bezahlen",
  attack: "Angreifer wählen",
  attackDeclared: "Angriff bestätigen",
  block: "Blocker wählen",
}

/** What kind of decision a question is (Forge's purpose where it says one). */
export function questionLabel(question: Question): string {
  if (question.kind === "buttons" && question.purpose !== undefined) return PURPOSE_LABELS[question.purpose]
  return QUESTION_KIND_LABELS[question.kind]
}

/** Forge's AI profile (res/ai/*.ai) by its German name (ai-profile-table.ts); an unknown one by Forge's name. */
export function aiProfileLabel(profile: string): string {
  return AI_PROFILE_TABLE.find((info) => info.name === profile)?.label ?? profile
}

/** Why Forge did not carry out an input (input.rejected); the engine's own detail stays below it. */
export const REJECT_REASON_LABELS: Readonly<Record<RejectReason, string>> = {
  stale: "Die Frage war schon beantwortet oder zurückgezogen.",
  "not-active": "Zuerst muss eine andere Frage beantwortet werden.",
  invalid: "Die Antwort passte nicht zur Frage.",
  malformed: "Forge kennt diese Eingabe nicht.",
  "unknown-card": "Diese Karte ist gerade nicht sichtbar.",
  "unknown-player": "Diesen Spieler gibt es nicht.",
  "no-effect": "Forge hat das in diesem Schritt nicht angenommen.",
}
