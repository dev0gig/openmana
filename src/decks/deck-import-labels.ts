/*
 * German wording of the deck import. Codes, statuses and technical details
 * stay English (system EN); the player reads German (user DE).
 */
import type { ArenaLineProblemCode, DeckSection } from "./arena-list"
import type { ImportBlocker } from "./deck-plan"
import type { EntryNote, EntryStatus } from "./deck-resolve"

export const SECTION_LABELS: Readonly<Record<DeckSection, string>> = {
  main: "Hauptdeck",
  sideboard: "Sideboard",
  commander: "Kommandeur",
  companion: "Gefährte",
}

export const STATUS_LABELS: Readonly<Record<EntryStatus, string>> = {
  resolved: "Erkannt",
  ambiguous: "Mehrdeutig",
  "not-in-forge": "Nicht spielbar",
  unresolved: "Nicht gefunden",
}

const LINE_PROBLEMS: Readonly<Record<ArenaLineProblemCode, { readonly title: string; readonly text: string }>> = {
  unrecognized: {
    title: "Zeile nicht erkannt",
    text: "Erwartet wird eine Anzahl und ein Kartenname, etwa „4 Blitzschlag“, oder ein Abschnitt wie „Sideboard“.",
  },
  "zero-count": { title: "Anzahl 0", text: "Die Zeile enthält keine Karte." },
}

/** Headline and explanation of what blocks saving. */
export function blockerText(blocker: ImportBlocker): { readonly title: string; readonly text: string } {
  switch (blocker.kind) {
    case "line":
      return LINE_PROBLEMS[blocker.problem.code]
    case "empty-main":
      return { title: "Das Hauptdeck ist leer", text: "Mindestens eine Karte muss im Hauptdeck stehen." }
    case "entry": {
      const entry = blocker.entry
      switch (entry.status) {
        case "ambiguous":
          return { title: "Mehrdeutig", text: `Der Name passt zu ${entry.candidates.length} Karten. Wähle die gemeinte – oder nenne sie in der Liste mit Set und Sammlernummer.` }
        case "not-in-forge":
          return {
            title: "Forge kennt diese Karte nicht",
            text: "Die Spiel-Engine dieser OpenMana-Version hat die Karte nicht; ein Deck mit ihr lässt sich nicht spielen. Lass die Zeile weg oder ersetze die Karte in der Liste.",
          }
        case "unresolved":
        case "resolved":
          return { title: "Keine Karte gefunden", text: "Kein Kartenname passt – deutsch oder englisch. Prüfe die Schreibweise in der Liste." }
      }
    }
  }
}

/** What a note says, in one sentence. */
export function noteText(note: EntryNote): string {
  switch (note.kind) {
    case "variants":
      return `Scryfall führt ${note.count} Varianten dieses Namens, Forge hat eine Karte dafür – welches Kartenbild gemeint ist, ist offen.`
    case "forge-known":
      return note.others === 1
        ? "Den Namen trägt noch eine Karte, die Forge nicht kennt – genommen wird die spielbare."
        : `Den Namen tragen noch ${note.others} Karten, die Forge nicht kennt – genommen wird die spielbare.`
    case "also-printed":
      return "Der Name ist auch der deutsche Name einer anderen Karte."
    case "back-face":
      return "Name einer anderen Kartenseite – ins Deck kommt die ganze Karte."
    case "token":
      return "So heißt nur ein Spielstein. Spielsteine entstehen im Spiel und gehören nicht ins Deck."
    case "rebalanced-name":
      return "Neu ausbalancierte Arena-Karten („A-…“) findet OpenMana nur unter ihrem englischen Namen."
    case "set-unknown":
      return `Set „${note.set}“ ist unbekannt – gezeigt wird das übliche Bild der Karte.`
    case "set-without-number":
      return `Set „${note.set}“ ohne Sammlernummer – gezeigt wird das übliche Bild der Karte.`
    case "print-identified":
      return "Über Set und Sammlernummer erkannt (bei Scryfall nachgefragt)."
    case "print-decided":
      return "Set und Sammlernummer haben entschieden, welche Karte gemeint ist."
    case "print-other-card":
      return `Set und Sammlernummer gehören zu „${note.card}“ – das passt nicht zum Namen.`
    case "print-missing":
      return "Scryfall kennt diesen Druck (Set und Sammlernummer) nicht."
    case "print-unreachable":
      return "Scryfall war nicht erreichbar; über Set und Sammlernummer ließ sich die Karte nicht bestimmen. Prüfe die Liste später erneut."
    case "chosen":
      return "Von dir gewählt."
    case "previous":
      return "Wie bisher im Deck – der Name passt auch zu anderen Karten."
  }
}

/** Notes worth showing on a resolved line (everything but what is plain from the line itself). */
export function isInformative(note: EntryNote): boolean {
  return note.kind !== "chosen"
}

// Shared with the deck library (library-labels.ts, part of the start bundle, unlike this file).
export { cardsLabel } from "./library-labels"

/** "Zeile 12" */
export function lineLabel(line: number): string {
  return `Zeile ${line}`
}
