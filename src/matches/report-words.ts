/*
 * The fixed words of the match report (prompt 62, report.ts): its foreword
 * for the reading AI, the German words for Forge's structured values (phases,
 * zones, buttons, refusals) and the Markdown helpers. Third person throughout -
 * the report speaks about "der Spieler" (the human) and "die Forge-KI" to a
 * reader who was not there, unlike the table, which speaks to the player.
 * Keyed by the protocol's structured values only, never by Forge's texts.
 */
import type { ActionZone, ButtonMeaning, ManaColor, Phase } from "@openmana/engine-protocol"
import { PHASE_LABELS } from "@/game/game-labels"

/** The report's file name: openmana-partiebericht-<matchId>.md. */
export function reportFileName(matchId: string): string {
  return `openmana-partiebericht-${matchId}.md`
}

/** The words when a report cannot be made (an engine protocol this app does not read): the replay's. */
export { UNREADABLE_PROTOCOL as REPORT_UNREADABLE } from "./protocols"

/** The page's words when saving failed. */
export const REPORT_FAILED = "Der Bericht konnte nicht gespeichert werden."

/** The headings, in the binding order of the prompt. */
export const HEADINGS = {
  title: "# OpenMana-Partiebericht",
  foreword: "## 1. Vorwort für die lesende KI",
  head: "## 2. Kopf",
  deck: "## 3. Deckliste des Spielers",
  start: "## 4. Starthand und Mulligan",
  turns: "## 5. Zugprotokoll",
  end: "## 6. Spielende",
  cards: "## Anhang A – Kennung → Name",
  aiDeck: "## Anhang B – Deckliste der Forge-KI (während der Partie nicht bekannt)",
  origin: "## Anhang C – Herkunft",
  situation: "#### Lage zu Beginn",
  course: "#### Ablauf",
  unused: "#### Ungenutzte Möglichkeiten",
  close: "#### Stand am Zugende",
} as const

/** The foreword: what the report is, its terms, what is hidden and why, how it was made. */
export const FOREWORD: readonly string[] = [
  "Dies ist der Bericht über eine Partie *Magic: The Gathering*, gespielt in OpenMana: ein Mensch gegen die KI der Regel-Engine Forge. Forge ist die alleinige Regelinstanz; OpenMana zeigt nur, was Forge meldet, und gibt die Eingaben des Menschen an Forge weiter.",
  "**Wozu der Bericht dient:** Du sollst das Spiel des Menschen beurteilen – seine Schwächen, vergeudete Züge, verpasste Landdrops, ungenutztes Mana, nicht gespielte spielbare Karten, fragwürdige Angriffe und Blocks, zu frühes oder zu spätes Passen und bessere Spiellinien. Der Bericht selbst urteilt nicht; er legt die Tatsachen der Partie vor. Beurteile jede Entscheidung mit dem Wissen, das der Spieler in diesem Moment hatte.",
  "**Begriffe:** „Spieler“ ist immer der Mensch, „Forge-KI“ immer sein Gegner. Kartennamen stehen englisch, wie Forge sie als Kennnamen liefert; Forges eigene Texte (Fragen, Hinweiszeilen, Protokollzeilen, Beschriftungen der Knöpfe) stehen wörtlich in Anführungszeichen, in der Sprache, in der Forge spielte. Jede Karte trägt ihre Kennung, etwa „Lightning Bolt (#53)“: Forge vergibt sie je Partie, gleiche Karten unterscheiden sich so. Anhang A nennt zu jeder Kennung den Namen.",
  "**Verdeckt bleibt verdeckt:** Die Hand der Forge-KI, beide Bibliotheken und verdeckte Karten kannte der Spieler nicht; die Aufzeichnung enthält von ihnen nur die Anzahl, und so steht es auch hier („eine verdeckte Karte“). Karten, die Forge aufdeckte, stehen mit Namen. Die Deckliste der Forge-KI steht nur in Anhang B; sie war während der Partie nicht bekannt.",
  "**Zugzählung:** Forge zählt die Züge über beide Spieler fortlaufend – Zug 1 gehört dem Spieler, der beginnt, Zug 2 dem anderen und so weiter. Jede Zugüberschrift nennt darum beides, etwa „Zug 25 (13. Zug des Spielers)“ oder „Zug 26 (13. Zug der Forge-KI)“.",
  "**Herkunft jeder Aussage:** Alles stammt aus der Aufzeichnung der Partie (Forges Nachrichten und die Eingaben des Spielers, in der Reihenfolge des Empfangs). Verweise wie [L123] nennen den Eintrag 123 der Aufzeichnung (Feld `seq` in der zugehörigen JSON-Datei). Nichts ist aus dem Unterschied zweier Spielstände erschlossen. Genau zwei Stellen sind gekennzeichnete Lesarten: (1) **Ungenutzte Möglichkeiten** – beim letzten Passen des Spielers in einer eigenen Hauptphase bei leerem Stapel gelesen aus Forges Spielstand: welche Handkarten Forge als spielbar markiert hatte, welche Länder ungetappt waren und ob der Landdrop noch offen war; (2) **Vermutung** – Forge nennt zu einer Lebensänderung ohne Schaden keine Quelle; der Bericht schreibt dann „Quelle von Forge nicht genannt“ und nennt höchstens das in diesem Moment verrechnete Stapelobjekt, ausdrücklich als Vermutung.",
  "**Entscheidungen des Spielers** stehen als Dreiklang: *Frage* (was Forge wissen wollte, mit Phase und Schritt), *Angebot* (alle Knöpfe mit Beschriftung und Bedeutung, alle wählbaren Karten und Spieler, bei der Priorität die Karten, die Forge als spielbar markierte) und *Antwort* (was der Spieler tat). Sie sind fortlaufend nummeriert (E1, E2 …); Angriffe, Blocks und Schaden nennen die Entscheidung, die ihnen voranging. Gleiche Prioritätsfragen, die der Spieler unmittelbar nacheinander und ohne Ereignis dazwischen mit „passen“ beantwortete, stehen als eine Zeile mit Zähler. Das Weiterschalten einer Anzeige der Gegneraktionen ist keine Spielentscheidung und fehlt (Anzahl in Anhang C).",
  "**Fragearten Forges in Spielerworten:** *Priorität* – der Spieler darf jetzt etwas spielen oder passen (passen = nichts tun und Forge weitermachen lassen; „Zug beenden“ = bis zum Ende dieses Zuges passen). *Angreifer wählen* – Kreaturen antippen, die angreifen sollen, dann bestätigen (ohne Kreatur = nicht angreifen). *Blocker wählen* – eigene Kreaturen einem Angreifer zuordnen, dann bestätigen. *Mulligan* – die Starthand behalten oder neu ziehen; danach so viele Karten unter die Bibliothek legen, wie Forge verlangt. *Ziel wählen / Auswahl* – Karten oder Spieler wählen, die Forge anbietet. *Kosten bezahlen* – Manaquellen antippen, Mana aus dem Vorrat nehmen oder Forge automatisch zahlen lassen. *Modus / eine Möglichkeit wählen* – eine von Forges Optionen. *Reihenfolge festlegen* und *Karten anordnen* – etwa beim Hellsehen oben oder unten. *Ja oder Nein* – eine Bestätigung.",
]

/** A phase or step in the words of Magic's German rules (the table's PHASE_LABELS). */
export function phaseWords(phase: Phase | null): string {
  return phase === null ? "vor dem ersten Zug" : PHASE_LABELS[phase]
}

/** What one of Forge's buttons does (Button.meaning), as an offer. */
export const MEANING_WORDS: Readonly<Record<ButtonMeaning, string>> = {
  pass: "passen",
  endTurn: "Zug beenden – bis zum Ende dieses Zuges passen",
  undo: "die letzte Aktion zurücknehmen",
  declare: "Angriff mit den gewählten Kreaturen bestätigen – keine gewählt: nicht angreifen",
  attackAll: "alle Kreaturen angreifen lassen",
  callBack: "alle gewählten Angreifer zurücknehmen",
}

/** The same as the player's answer. */
export const MEANING_ANSWERS: Readonly<Record<ButtonMeaning, string>> = {
  pass: "passt",
  endTurn: "beendet den Zug (passt bis zum Ende dieses Zuges)",
  undo: "nimmt die letzte Aktion zurück",
  declare: "bestätigt den Angriff",
  attackAll: "lässt alle Kreaturen angreifen",
  callBack: "nimmt alle Angreifer zurück",
}

export const MANA_WORDS: Readonly<Record<ManaColor, string>> = {
  W: "weißem",
  U: "blauem",
  B: "schwarzem",
  R: "rotem",
  G: "grünem",
  C: "farblosem",
}

const ZONE_NAMES: Readonly<Record<ActionZone["zone"], string>> = {
  battlefield: "Spielfeld",
  hand: "Hand",
  graveyard: "Friedhof",
  exile: "Exil",
  command: "Kommandozone",
  library: "Bibliothek",
  stack: "Stapel",
  other: "anderer Ort",
}

export type Side = "player" | "ai" | null

/** "des Spielers", "der Forge-KI". */
export function sideGenitive(side: Side): string {
  return side === "player" ? "des Spielers" : side === "ai" ? "der Forge-KI" : "eines Spielers"
}

/** "Der Spieler", "Die Forge-KI". */
export function sideSubject(side: Side): string {
  return side === "player" ? "Der Spieler" : side === "ai" ? "Die Forge-KI" : "Ein Spieler (Forge nennt keinen)"
}

/** "Spieler", "Forge-KI" (lists, tables). */
export function sideName(side: Side): string {
  return side === "player" ? "Spieler" : side === "ai" ? "Forge-KI" : "unbekannt"
}

/** "den Spieler", "die Forge-KI" (accusative). */
export function sideObject(side: Side): string {
  return side === "player" ? "den Spieler" : side === "ai" ? "die Forge-KI" : "einen Spieler"
}

/** "dem Spieler", "der Forge-KI" (dative). */
export function sideDative(side: Side): string {
  return side === "player" ? "dem Spieler" : side === "ai" ? "der Forge-KI" : "einem Spieler"
}

/** "Friedhof des Spielers", "Exil", "Stapel". */
export function zoneWords(zone: ActionZone["zone"], side: Side): string {
  if (zone === "exile" || zone === "stack" || zone === "other") return ZONE_NAMES[zone]
  return `${ZONE_NAMES[zone]} ${sideGenitive(side)}`
}

/** A zone of the state, for "where a playable card lies". */
export const STATE_ZONE_WORDS = {
  battlefield: "Spielfeld",
  hand: "Hand",
  graveyard: "Friedhof",
  exile: "Exil",
  command: "Kommandozone",
} as const

/**
 * Forge's or a card's text as one Markdown-safe line: whitespace folded,
 * Markdown's active characters escaped (Forge's texts are data, not markup).
 */
export function inline(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([\\`*_[\]<|])/g, "\\$1")
}

/** „Forge's words“ (empty: „“). */
export function quote(text: string): string {
  return `„${inline(text)}“`
}

/** "1 Karte", "3 Karten". */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "2026-10-14 08:05 UTC" from an ISO time - the same text on every device. */
export function utcMinute(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}
