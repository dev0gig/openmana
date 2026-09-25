/*
 * German wording of the deck library and the deck choice for a game. Codes
 * stay English (system EN); the player reads German (user DE).
 */
import type { DeckFormat } from "@/storage/generated/records"
import { cardsLabel } from "./deck-import-labels"
import type { SelectionBlocker } from "./deck-selection"
import type { CardLanguage, DeckPart, DeckView } from "./deck-view"
import type { DeckSort, FormatFilter } from "./library"

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

export const FORMAT_FILTER_LABELS: Readonly<Record<FormatFilter, string>> = {
  all: "Alle",
  constructed: "Constructed",
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

/** "Constructed · 60 Karten · Sideboard 15" */
export function describeDeck(view: DeckView, formats: Readonly<Record<DeckFormat, string>>): string {
  const parts = [formats[view.deck.format], cardsLabel(view.counts.main)]
  if (view.counts.commander > 0) parts.push(`Kommandeur ${view.counts.commander}`)
  if (view.counts.sideboard > 0) parts.push(`Sideboard ${view.counts.sideboard}`)
  return parts.join(" · ")
}

/** Why "Partie starten" cannot start yet, for what is chosen. */
export const SELECTION_BLOCKERS: Readonly<Record<SelectionBlocker, string>> = {
  "no-human": "Wähle zuerst dein Deck.",
  "human-missing": "Dein gewähltes Deck gibt es nicht mehr – wähle ein anderes.",
  "human-damaged": "Dein gewähltes Deck ist beschädigt – wähle ein anderes.",
  "random-empty": "Für ein zufälliges Deck der KI fehlt ein zweites Deck im selben Format – wähle das Deck der KI selbst.",
  "ai-mismatch": "Das Deck der KI hat ein anderes Format als deins – wähle ein passendes.",
  "ai-missing": "Das gewählte Deck der KI gibt es nicht mehr – wähle ein anderes.",
  "ai-damaged": "Das gewählte Deck der KI ist beschädigt – wähle ein anderes.",
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
