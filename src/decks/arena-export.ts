/*
 * A saved deck as an MTG Arena deck list again - the format it was imported
 * in (arena-list.ts reads it):
 *
 *   About
 *   Name Mono-Red Aggro
 *
 *   Commander / Companion / Deck / Sideboard   (the parts the deck has)
 *   4 Lightning Strike (M19) 152
 *
 * Names are the ones Forge knows (English; a double-faced card by its front
 * face, a split card as "Fire // Ice") - so the list imports into OpenMana
 * again without a single open line. The printing is written where the deck
 * knows it, with MTG Arena's set code (DAR for Scryfall's dom). The
 * companion is in the Companion part and, as Arena writes it, in the
 * sideboard. The list as it was imported is kept unchanged with the deck
 * (source.text); that one is the list for MTG Arena itself, whose names can
 * differ from Forge's (Universes Beyond cards).
 */
import type { DeckCard, DeckRecord, SetRecord } from "@/storage/generated/records"
import { partEntries, type DeckPart } from "./deck-view"

/** Arena's headings, in the order Arena writes them. */
const HEADINGS: readonly (readonly [DeckPart, string])[] = [
  ["commander", "Commander"],
  ["companion", "Companion"],
  ["main", "Deck"],
  ["sideboard", "Sideboard"],
]

/** MTG Arena's code of a Scryfall set (Arena's own where it has one), upper case as Arena writes it. */
export function arenaSetCode(code: string, sets: ReadonlyMap<string, SetRecord>): string {
  return (sets.get(code)?.arenaCode ?? code).toUpperCase()
}

function line(entry: DeckCard, sets: ReadonlyMap<string, SetRecord>): string {
  const printing = entry.set !== undefined && entry.collectorNumber !== undefined ? ` (${arenaSetCode(entry.set, sets)}) ${entry.collectorNumber}` : ""
  return `${entry.count} ${entry.name}${printing}`
}

/** The deck as an Arena list with Forge's names (see the head comment); `sets` maps Scryfall's set codes to Arena's. */
export function arenaList(deck: DeckRecord, sets: ReadonlyMap<string, SetRecord> = new Map()): string {
  const blocks = [["About", `Name ${deck.name.replace(/\s+/g, " ")}`]]
  for (const [part, heading] of HEADINGS) {
    const entries = partEntries(deck, part)
    if (entries.length > 0) blocks.push([heading, ...entries.map((entry) => line(entry, sets))])
  }
  return `${blocks.map((block) => block.join("\n")).join("\n\n")}\n`
}

/** A file name for a list: the deck's name without what file systems refuse, and ".txt". */
export function listFileName(name: string, suffix = ""): string {
  const base = [...`${name}${suffix}`]
    .map((char) => (char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f || '<>:"/\\|?*'.includes(char) ? "_" : char))
    .join("")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 120)
  return `${base === "" ? "deck" : base}.txt`
}
