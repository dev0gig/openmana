/*
 * German wording for card data. Codes and technical details stay English
 * (system EN); the player reads German (user DE).
 */
import type { CardDisplay } from "./card-display"
import type { CardDataError, CardDataErrorCode } from "./errors"

const ERROR_TITLES: Readonly<Record<CardDataErrorCode, string>> = {
  unavailable: "Diese Version enthält keine Kartendaten",
  unsupported: "Dieser Browser kann die Kartendaten nicht einrichten",
  "download-failed": "Die Kartendaten ließen sich nicht herunterladen",
  corrupt: "Die heruntergeladenen Kartendaten sind fehlerhaft",
  "insufficient-space": "Für die Kartendaten ist nicht genug Speicher frei",
  storage: "Die Kartendaten ließen sich nicht speichern",
  aborted: "Das Einrichten der Kartendaten wurde abgebrochen",
  "scryfall-unreachable": "Scryfall ist gerade nicht erreichbar",
  "scryfall-rate-limited": "Scryfall bittet um eine Pause",
  "scryfall-format": "Scryfall hat unerwartet geantwortet",
}

const ERROR_ADVICE: Readonly<Record<CardDataErrorCode, string>> = {
  unavailable: "Karten werden mit Forges eigenen englischen Texten und ohne Bilder angezeigt.",
  unsupported: "OpenMana braucht dafür eine sichere Verbindung (https) und einen aktuellen Browser. Es wurde nichts geschrieben.",
  "download-failed": "Prüfe die Internetverbindung und versuche es erneut. Bis dahin fehlen deutsche Namen und Kartenbilder.",
  corrupt: "Es wurde nichts davon übernommen. Lade die Seite neu und versuche es erneut.",
  "insufficient-space": "Gib Speicher frei (etwa Websitedaten anderer Seiten) und versuche es erneut; unvollständige Kartendaten werden dabei neu eingerichtet.",
  storage: "Die Kartendaten sind unvollständig und werden beim nächsten Versuch neu eingerichtet.",
  aborted: "Die Kartendaten sind unvollständig und werden beim nächsten Versuch neu eingerichtet.",
  "scryfall-unreachable": "Angezeigt wird, was schon auf diesem Gerät liegt. Versuche es später erneut.",
  "scryfall-rate-limited": "OpenMana fragt 30 Sekunden lang nichts bei Scryfall an. Versuche es danach erneut.",
  "scryfall-format": "Angezeigt wird, was schon auf diesem Gerät liegt. Bitte melden, falls es bleibt.",
}

export function cardErrorTitle(error: CardDataError): string {
  return ERROR_TITLES[error.code]
}

export function cardErrorAdvice(error: CardDataError): string {
  return ERROR_ADVICE[error.code]
}

/** A short note on what of a card is not German (null: everything is). */
export function languageNote(display: CardDisplay): string | null {
  const { picture, text, germanTextExists, germanPictureExists } = display.language
  if (!germanTextExists && !germanPictureExists) {
    return picture === "other" ? "Keine deutsche Fassung – Text englisch, Bild in der Sprache des Drucks" : "Keine deutsche Fassung – englisch"
  }
  const parts: string[] = []
  if (text === "mixed") parts.push("Text teilweise englisch")
  if (text === "en") parts.push("Text englisch")
  if (picture === "en" || picture === "other") parts.push(germanPictureExists ? "Bild dieses Drucks nicht deutsch" : "Kein deutsches Bild – Bild englisch")
  return parts.length > 0 ? parts.join(" · ") : null
}

/** "Forge kennt die Karte, Scryfall nicht": why, in German. */
export const FORGE_ONLY_LABELS = {
  rebalanced: "Neu ausbalancierte MTG-Arena-Karte – Scryfall führt sie nicht",
  listed: "Scryfall führt diese Karte nicht",
} as const

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })

/** "24.09.2026" */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}
