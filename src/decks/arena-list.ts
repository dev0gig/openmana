/*
 * MTG Arena's deck list format, read into sections and entries. Pure: text
 * in, structure out - no card lookup (deck-resolve.ts does that) and nothing
 * dropped: every line is an entry, a section header, an About line, a blank
 * line or a problem that the import report shows with its line number.
 *
 * The format, as Arena exports and imports it (checked 2026-09-25 against
 * Arena exports and Wizards' own description of what Arena accepts):
 *
 *   About
 *   Name Mono-Red Aggro
 *
 *   Companion
 *   1 Lurrus of the Dream-Den (IKO) 226
 *
 *   Commander
 *   1 Atraxa, Praetors' Voice (2X2) 190
 *
 *   Deck
 *   4 Lightning Strike (M19) 152
 *   20 Mountain (M19) 277
 *
 *   Sideboard
 *   1 Lurrus of the Dream-Den (IKO) 226
 *   2 Shock (M19) 156
 *
 * - An entry is "<count> <name>", optionally followed by "(<set>) <collector
 *   number>": the printing Arena uses. The set code is Arena's own (DAR for
 *   Dominaria, which Scryfall calls DOM); deck-resolve.ts maps it.
 * - Names are in the language of the Arena client that exported the list
 *   (a German client writes "4 Blitzschlag (STA) 42"). Arena has its own
 *   translations for a few cards; set and collector number still identify them.
 * - Sections are labelled by a header line and separated by blank lines. A
 *   block without a header follows Arena's rule: the first one is the main
 *   deck, later ones are the sideboard.
 * - About holds "Name <deck name>" (optional; older exports have no About).
 * - Arena lists a companion under Companion and again in the sideboard.
 * - The same card may stand on several lines (different printings or art
 *   styles); deck-plan.ts adds them up.
 *
 * Tolerated beyond what Arena writes: "4x Name" (deck sites), a colon after a
 * header ("Sideboard:"), a set without collector number, tabs, Windows line
 * ends, a byte order mark, and the German section names "Kommandeur" and
 * "Gefährte" (MTG's German terms - whether a German Arena client labels its
 * export so is not verified; accepting them cannot misread a card line,
 * which always starts with a count).
 */

/** Where an entry goes. The companion ends up in the sideboard for Forge (deck-plan.ts). */
export type DeckSection = "main" | "sideboard" | "commander" | "companion"

export interface ArenaEntry {
  /** 1-based line number in the text. */
  readonly line: number
  /** The line as written (whitespace tidied). */
  readonly text: string
  readonly section: DeckSection
  readonly count: number
  readonly name: string
  /** The set code as written (Arena's code, any case), or null. */
  readonly set: string | null
  readonly collectorNumber: string | null
  /** The section came from Arena's rule for blocks without a header, not from a header. */
  readonly inferred: boolean
}

export type ArenaLineProblemCode =
  /** Neither a header, an entry nor an About line. */
  | "unrecognized"
  /** "0 Name": an entry without cards. */
  | "zero-count"

export interface ArenaLineProblem {
  readonly line: number
  readonly text: string
  readonly code: ArenaLineProblemCode
}

/** A line of the About section ("Name Mono-Red Aggro"). */
export interface ArenaAboutLine {
  readonly line: number
  readonly key: string
  readonly value: string
}

export interface ArenaDeckList {
  readonly entries: readonly ArenaEntry[]
  readonly problems: readonly ArenaLineProblem[]
  /** The deck's name from About → Name (the first one), null if the list has none. */
  readonly name: string | null
  /** Every About line, the name included (the report shows what OpenMana does not use). */
  readonly about: readonly ArenaAboutLine[]
  /** How many lines the text has. */
  readonly lines: number
}

/**
 * Longest text the import takes. Arena lists are a few kilobytes (a
 * 100-card Commander deck with set codes is about 4 KB); anything this long
 * is not a deck list, and the report would be unreadable.
 */
export const MAX_LIST_CHARACTERS = 200_000

type HeaderTarget = DeckSection | "about"

const HEADERS: ReadonlyMap<string, HeaderTarget> = new Map<string, HeaderTarget>([
  ["deck", "main"],
  ["sideboard", "sideboard"],
  ["commander", "commander"],
  ["companion", "companion"],
  ["about", "about"],
  ["kommandeur", "commander"],
  ["gefährte", "companion"],
])

/**
 * "<count>[x] <name> [(<set>) [<collector number>]]". The set must be one
 * word in parentheses: a name that ends in words in parentheses
 * ("B.F.M. (Big Furry Monster)") stays a name.
 */
const ENTRY = /^(\d+)x?\s+(.+?)(?:\s+\(([^\s()]+)\)(?:\s+([^\s()]+))?)?$/i
/** An About line: a key that is not a number, then its value. */
const ABOUT = /^(\S+)(?:\s+(.*))?$/

/** Tabs, no-break spaces and runs of spaces become one space; ends trimmed. */
function tidy(line: string): string {
  return line.replace(/[\t   ]/g, " ").replace(/ {2,}/g, " ").trim()
}

function headerOf(text: string): HeaderTarget | undefined {
  return HEADERS.get(text.replace(/\s*:$/, "").toLowerCase())
}

export function parseArenaDeckList(input: string): ArenaDeckList {
  const lines = input.replace(/^﻿/, "").split(/\r\n|\r|\n/)
  // A final line break does not make one more line.
  if (lines.length > 1 && lines.at(-1) === "") lines.pop()
  const entries: ArenaEntry[] = []
  const problems: ArenaLineProblem[] = []
  const about: ArenaAboutLine[] = []
  let name: string | null = null

  // The section of the block being read (null: between blocks) and whether a header named it.
  let section: HeaderTarget | null = null
  let inferred = false
  let mainHasCards = false

  lines.forEach((raw, index) => {
    const line = index + 1
    const text = tidy(raw)
    if (text === "") {
      section = null
      inferred = false
      return
    }
    const header = headerOf(text)
    if (header !== undefined) {
      section = header
      inferred = false
      return
    }
    if (section === "about") {
      const match = ABOUT.exec(text)!
      const key = match[1]!
      if (!/^\d/.test(key)) {
        const value = match[2] ?? ""
        about.push({ line, key, value })
        if (name === null && key.toLowerCase() === "name" && value !== "") name = value
        return
      }
      // A card line right after About (no blank line): a new block without a header.
      section = null
    }
    const match = ENTRY.exec(text)
    if (!match) {
      problems.push({ line, text, code: "unrecognized" })
      return
    }
    const count = Number(match[1])
    if (count === 0 || !Number.isSafeInteger(count)) {
      problems.push({ line, text, code: count === 0 ? "zero-count" : "unrecognized" })
      return
    }
    if (section === null) {
      // Arena's rule for blocks without a header: main deck first, then the sideboard.
      section = mainHasCards ? "sideboard" : "main"
      inferred = true
    }
    const target: DeckSection = section
    if (target === "main") mainHasCards = true
    entries.push({
      line,
      text,
      section: target,
      count,
      name: match[2]!,
      set: match[3] ?? null,
      collectorNumber: match[4] ?? null,
      inferred,
    })
  })

  return { entries, problems, name, about, lines: lines.length }
}
