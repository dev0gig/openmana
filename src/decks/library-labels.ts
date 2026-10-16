/*
 * German wording of the deck library and the deck choice for a game. Codes
 * stay English (system EN); the player reads German (user DE).
 */
import { deckMode, type DeckMode } from "./deck-mode"
import type { SelectionBlocker } from "./deck-selection"
import type { CardLanguage, DeckPart, DeckView } from "./deck-view"
import type { DeckSort, FormatFilter } from "./library"

/** "1 Karte", "60 Karten" */
export function cardsLabel(n: number): string {
  return n === 1 ? "1 Karte" : `${n.toLocaleString("de-DE")} Karten`
}

export const PART_LABELS: Readonly<Record<DeckPart, string>> = {
  commander: "Kommandeur",
  companion: "Gefährte",
  main: "Hauptdeck",
  sideboard: "Sideboard",
}

export const SORT_LABELS: Readonly<Record<DeckSort, string>> = {
  name: "Name (A–Z)",
  updated: "Zuletzt geändert",
  created: "Zuletzt angelegt",
}

/** A deck's mode (deck-mode.ts) - a Jumpstart deck is one half. */
export const DECK_MODE_LABELS: Readonly<Record<DeckMode, string>> = {
  normal: "Normal",
  jumpstart: "Jumpstart-Hälfte",
  commander: "Commander",
}

/** What the mode means for a game, after the mode's name (import page). */
export const MODE_NOTES: Readonly<Record<DeckMode, string>> = {
  normal: "",
  jumpstart: " – auf „Spielen“ kommt eine zweite Hälfte dazu, zusammen 40 Karten",
  commander: " – Forge spielt das Deck als Commander-Partie",
}

/** A game's mode: its player's deck's, a Jumpstart game of two halves. */
export const GAME_MODE_LABELS: Readonly<Record<DeckMode, string>> = {
  normal: "Normal",
  jumpstart: "Jumpstart",
  commander: "Commander",
}

/** "5 Decks passen nicht zu Jumpstart." - the decks a picker leaves out once the game's mode is set (null: none). */
export function hiddenDecksNote(count: number, mode: DeckMode): string | null {
  if (count === 0) return null
  return `${count === 1 ? "1 Deck passt" : `${count} Decks passen`} nicht zu ${GAME_MODE_LABELS[mode]}.`
}

export const FORMAT_FILTER_LABELS: Readonly<Record<FormatFilter, string>> = {
  all: "Alle",
  normal: "Normal",
  jumpstart: "Jumpstart",
  commander: "Commander",
}

/** The badge a card gets in a deck list (null: German, nothing to say). */
export const LANGUAGE_BADGES: Readonly<Record<CardLanguage, string | null>> = {
  de: null,
  partial: "teilweise englisch",
  en: "englisch",
  "forge-only": "nur Forge",
  unknown: "ohne Kartendaten",
}

/** Why a card is not (entirely) German, in one sentence. */
export const LANGUAGE_REASONS: Readonly<Record<Exclude<CardLanguage, "de">, string>> = {
  partial: "Scryfall hat die Karte nur teilweise auf Deutsch (Text oder Bild englisch).",
  en: "Scryfall kennt keine deutsche Fassung – Name, Text und Bild englisch.",
  "forge-only": "Nur Forge kennt die Karte – angezeigt mit ihrem englischen Namen, ohne Bild.",
  unknown: "Zu dieser Karte liegen auf diesem Gerät keine Kartendaten – angezeigt mit dem Namen, den Forge kennt.",
}

/** The deck's cards at a glance: "Alle Karten deutsch" or "3 von 21 Karten nicht ganz deutsch". */
export function languageSummary(view: DeckView): string {
  const { total, notGerman } = view.language
  if (total === 0) return "Keine Karten"
  if (notGerman.length === 0) return "Alle Karten deutsch"
  return `${notGerman.length} von ${total} Karten nicht ganz deutsch`
}

/** "Normal · 60 Karten · Sideboard 15", "Jumpstart-Hälfte · 20 Karten"; without the mode where a badge shows it. */
export function describeDeck(view: DeckView, withMode = true): string {
  const parts = [...(withMode ? [DECK_MODE_LABELS[deckMode(view.deck)]] : []), cardsLabel(view.counts.main)]
  if (view.counts.commander > 0) parts.push(`Kommandeur ${view.counts.commander}`)
  if (view.counts.sideboard > 0) parts.push(`Sideboard ${view.counts.sideboard}`)
  return parts.join(" · ")
}

/** Why "Partie starten" cannot start yet, for what is chosen. */
export const SELECTION_BLOCKERS: Readonly<Record<SelectionBlocker, string>> = {
  "no-human": "Wähle zuerst dein Deck.",
  "human-missing": "Dein gewähltes Deck gibt es nicht mehr – wähle ein anderes.",
  "human-damaged": "Dein gewähltes Deck ist beschädigt – wähle ein anderes.",
  "no-human-half": "Wähle die zweite Hälfte deines Jumpstart-Decks.",
  "human-half-missing": "Deine gewählte zweite Hälfte gibt es nicht mehr – wähle eine andere.",
  "human-half-damaged": "Deine gewählte zweite Hälfte ist beschädigt – wähle eine andere.",
  "human-half-mismatch": "Deine gewählte zweite Hälfte ist keine Jumpstart-Hälfte (20 Karten) mehr – wähle eine andere.",
  "human-half-same": "Deine zweite Hälfte ist dieselbe wie die erste – wähle eine andere.",
  "random-empty": "Für ein zufälliges Deck der KI fehlt ein zweites Deck im selben Modus – wähle das Deck der KI selbst.",
  "random-halves": "Für zufällige Hälften der KI fehlen zwei weitere Jumpstart-Hälften – wähle die Hälften der KI selbst.",
  "ai-mismatch": "Das Deck der KI passt nicht zum Modus deines Decks – wähle ein passendes.",
  "ai-missing": "Das gewählte Deck der KI gibt es nicht mehr – wähle ein anderes.",
  "ai-damaged": "Das gewählte Deck der KI ist beschädigt – wähle ein anderes.",
  "no-ai-half": "Wähle die zweite Hälfte der KI.",
  "ai-half-missing": "Die gewählte zweite Hälfte der KI gibt es nicht mehr – wähle eine andere.",
  "ai-half-damaged": "Die gewählte zweite Hälfte der KI ist beschädigt – wähle eine andere.",
  "ai-half-mismatch": "Die gewählte zweite Hälfte der KI ist keine Jumpstart-Hälfte (20 Karten) mehr – wähle eine andere.",
  "ai-half-same": "Die zweite Hälfte der KI ist dieselbe wie ihre erste – wähle eine andere.",
}

const COPY = / \(Kopie(?: (\d+))?\)$/

/** "Izzet (Kopie)", then "Izzet (Kopie 2)" …: the first name no other deck has (a copy of a copy counts on). */
export function copyName(name: string, taken: Iterable<string>): string {
  const names = new Set([...taken].map((other) => other.trim().toLocaleLowerCase("de-DE")))
  const base = name.trim().replace(COPY, "")
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${base} (Kopie)` : `${base} (Kopie ${n})`
    if (!names.has(candidate.toLocaleLowerCase("de-DE"))) return candidate
  }
}
