/*
 * German wording of a game: phases, results, why a game ended, why Forge did
 * not start one, what kind of decision Forge waits for. Codes stay English
 * (system EN); the player reads German (user DE). Everything is keyed by the
 * protocol's structured values - never by Forge's (localized) texts.
 */
import type { ButtonsPurpose, EngineError, GameEnd, GameResult, Phase, Question, QuestionKind, RejectReason } from "@openmana/engine-protocol"

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

/** The answers Forge offers, as far as the question names them (its buttons, options or items). */
export function questionChoices(question: Question): string[] {
  switch (question.kind) {
    case "buttons":
      return question.buttons.filter((button) => button.enabled && button.label).map((button) => button.label!)
    case "confirm":
      return [question.yesLabel ?? "Ja", question.noLabel ?? "Nein"]
    case "options":
    case "choose":
      return question.items.flatMap((item) => ("text" in item && item.text ? [item.text] : []))
    default:
      return []
  }
}

/** Forge's AI profile (res/ai/*.ai); friendly names and choosing one are prompt 12. */
export function aiProfileLabel(profile: string): string {
  return profile === "Default" ? "Standard (Forges Vorgabe)" : profile
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
