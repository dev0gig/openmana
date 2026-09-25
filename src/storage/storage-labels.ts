/*
 * German wording for the local data. Codes, stores and technical details stay
 * English (system EN); the player reads German (user DE). Technical details
 * are shown verbatim below the German text.
 */
import type { StorageError, StorageErrorCode } from "./errors"
import type { DeckFormat, GameResult, ImportMode, MatchStatus } from "./generated/records"
import type { StoreName } from "./schema"
import type { ConnectionLoss } from "./storage-session"

const ERROR_TITLES: Readonly<Record<StorageErrorCode, string>> = {
  unsupported: "Dieser Browser erlaubt OpenMana keinen lokalen Speicher",
  "version-too-new": "Die lokalen Daten stammen von einer neueren OpenMana-Version",
  "schema-mismatch": "Die lokale Datenbank ist beschädigt",
  "upgrade-failed": "Die lokalen Daten ließen sich nicht auf diese Version bringen",
  "open-failed": "Die lokale Datenbank lässt sich nicht öffnen",
  closed: "Die Verbindung zur lokalen Datenbank ist beendet",
  "quota-exceeded": "Der Speicher für OpenMana in diesem Browser ist voll",
  "insufficient-space": "Dafür ist nicht genug Speicher frei",
  "invalid-record": "Die Daten haben nicht das erwartete Format",
  "not-found": "Der Eintrag ist nicht mehr da",
  "transaction-failed": "Lesen oder Speichern ist fehlgeschlagen",
  "backup-invalid": "Diese Datei ist keine gültige OpenMana-Sicherung",
  "backup-unsupported": "Diese Sicherung stammt von einer neueren OpenMana-Version",
}

const LOSS_TITLES: Readonly<Record<ConnectionLoss, string>> = {
  upgraded: "OpenMana wurde in einem anderen Tab aktualisiert",
  deleted: "Die lokalen Daten wurden in einem anderen Tab zurückgesetzt",
  terminated: "Der Browser hat die lokale Datenbank geschlossen",
}

const ERROR_ADVICE: Readonly<Record<StorageErrorCode, string>> = {
  unsupported: "Erlaube dieser Seite, Daten zu speichern (Websitedaten), und nutze kein privates Fenster.",
  "version-too-new": "Lade die Seite neu, um die neueste OpenMana-Version zu bekommen. Eine ältere Version kann diese Daten nicht lesen.",
  "schema-mismatch":
    "Die Datenbank hat nicht den erwarteten Aufbau. Du kannst die lokalen Daten zurücksetzen und danach eine Sicherung laden.",
  "upgrade-failed":
    "Die Daten sind unverändert geblieben. Lade die Seite neu; tritt der Fehler wieder auf, bitte melden. Zurücksetzen löscht die lokalen Daten.",
  "open-failed":
    "Das kann an beschädigten Browserdaten liegen. Versuche es erneut; hilft das nicht, kannst du die lokalen Daten zurücksetzen und eine Sicherung laden.",
  closed: "Lade die Seite neu.",
  "quota-exceeded": "Es wurde nichts davon gespeichert. Gib Speicher frei (etwa Websitedaten anderer Seiten) und versuche es erneut.",
  "insufficient-space": "Es wurde nichts geschrieben. Gib Speicher frei und versuche es erneut.",
  "invalid-record": "Es wurde nichts davon gespeichert.",
  "not-found": "Er wurde inzwischen gelöscht, vielleicht in einem anderen Tab. Es wurde nichts gespeichert.",
  "transaction-failed": "Es wurde nichts davon gespeichert. Versuche es erneut.",
  "backup-invalid": "Es wurde nichts geändert. Wähle eine Datei, die OpenMana mit „Sicherung speichern“ erstellt hat.",
  "backup-unsupported": "Es wurde nichts geändert. Lade OpenMana neu, um die neueste Version zu bekommen, und versuche es dann erneut.",
}

export function storageErrorTitle(error: StorageError, loss?: ConnectionLoss): string {
  return loss ? LOSS_TITLES[loss] : ERROR_TITLES[error.code]
}

export function storageErrorAdvice(error: StorageError): string {
  return ERROR_ADVICE[error.code]
}

export const STORE_LABELS: Readonly<Record<StoreName, string>> = {
  meta: "Datenbank-Angaben",
  settings: "Einstellungen",
  decks: "Decks",
  deckTombstones: "Löschmarken gelöschter Decks",
  matches: "Partien",
  matchLog: "Partieverläufe",
  scryfallCards: "Kartendaten",
  scryfallPrints: "Kartendrucke",
  scryfallSets: "Sets",
  forgeOnlyCards: "Forge-Karten ohne Scryfall-Daten",
  cacheIndex: "Zwischenspeicher",
}

export const DECK_FORMAT_LABELS: Readonly<Record<DeckFormat, string>> = {
  constructed: "Constructed",
  commander: "Commander",
}

export const IMPORT_MODE_LABELS: Readonly<Record<ImportMode, string>> = {
  merge: "Zusammenführen",
  replace: "Ersetzen",
}

export const GAME_RESULT_LABELS: Readonly<Record<GameResult, string>> = {
  win: "Sieg",
  loss: "Niederlage",
  draw: "Unentschieden",
}

export const MATCH_STATUS_LABELS: Readonly<Record<MatchStatus, string>> = {
  running: "nicht beendet",
  finished: "beendet",
  aborted: "technisch abgebrochen",
}

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" })
const numberFormat = new Intl.NumberFormat("de-DE")
const decimalFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** "25.09.2026, 00:12" */
export function formatDateTime(iso: string): string {
  return dateFormat.format(new Date(iso))
}

/** 12345 → "12.345" */
export function formatCount(n: number): string {
  return numberFormat.format(n)
}

/** Bytes in binary units, as the browser counts them: "512 B", "3,4 KB", "1,2 MB", "58,6 GB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${numberFormat.format(bytes)} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${decimalFormat.format(value)} ${units[unit]}`
}

/** "1 Deck", "3 Decks" … for the stores the player knows. */
export function countLabel(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`
}
