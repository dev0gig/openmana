/*
 * From a checked Arena list to the deck that is saved: what goes into main
 * deck, sideboard and command zone, what still stands in the way, and the
 * DeckRecord itself. Pure - the report (deck-resolve.ts) and the player's
 * decisions in, the plan out - so the import page shows exactly what will be
 * saved before the player saves it.
 *
 * - Lines the player left out are not in the deck; they stay in the saved
 *   import text, and the report shows them as left out.
 * - Entries of the same card and printing in one section are added up
 *   (Arena lists a card twice when its copies differ in art style).
 * - A companion plays from the sideboard: Forge looks for it there when a
 *   game starts. Arena lists it in the sideboard as well; a list that does
 *   not gets it added there, and the plan says so.
 * - The format is "commander" when the list names a commander, otherwise
 *   "constructed" - how Forge plays the deck, not a legality verdict.
 */
import type { CardMatch } from "@/cards/card-lookup"
import type { CardRecord, DeckCard, DeckFormat, DeckRecord, ForgeOnlyCardRecord } from "@/storage/generated/records"
import type { ArenaLineProblem, DeckSection } from "./arena-list"
import type { DeckImportReport, EntryReport } from "./deck-resolve"

export interface PlannedCard {
  readonly count: number
  /** The card name Forge knows. */
  readonly forgeName: string
  readonly card: CardRecord | null
  readonly match: CardMatch | null
  readonly forgeOnly: ForgeOnlyCardRecord | null
  /** The printing the list names (Scryfall's set code), if the catalog knows the set and the line has a collector number. */
  readonly set: string | null
  readonly collectorNumber: string | null
  /** Scryfall's id of that printing, where it is known (catalog or Scryfall asked). */
  readonly scryfallId: string | null
  /** The list's lines this entry comes from. */
  readonly lines: readonly number[]
}

export interface PlannedCompanion {
  readonly entry: EntryReport
  /** The list did not have it in the sideboard; the plan adds it there. */
  readonly addedToSideboard: boolean
}

export type ImportBlocker =
  /** A line that is neither a card nor a section (the player corrects or leaves it out). */
  | { readonly kind: "line"; readonly problem: ArenaLineProblem }
  /** An entry that is not resolved to a card Forge knows. */
  | { readonly kind: "entry"; readonly entry: EntryReport }
  /** Nothing is left in the main deck. */
  | { readonly kind: "empty-main" }

export interface DeckPlan {
  readonly main: readonly PlannedCard[]
  readonly sideboard: readonly PlannedCard[]
  readonly commander: readonly PlannedCard[]
  readonly companions: readonly PlannedCompanion[]
  readonly format: DeckFormat
  /** Empty: the deck can be saved. */
  readonly blockers: readonly ImportBlocker[]
  /** Entries and unreadable lines the player left out. */
  readonly leftOut: { readonly entries: readonly EntryReport[]; readonly problems: readonly ArenaLineProblem[] }
}

type Section = Exclude<DeckSection, "companion">

function printingOf(entry: EntryReport): Pick<PlannedCard, "set" | "collectorNumber" | "scryfallId"> {
  const printing = entry.printing
  const none = { set: null, collectorNumber: null, scryfallId: null }
  if (printing === null || printing.set === null || printing.collectorNumber === null) return none
  const set = printing.set.code
  const collectorNumber = printing.collectorNumber
  const fetched = printing.print
  if (fetched !== null) {
    // A printing of another card is not this entry's printing.
    if (entry.card === null || fetched.oracleId !== entry.card.oracleId) return none
    return { set, collectorNumber, scryfallId: fetched.id }
  }
  // The catalog knows the ids of a card's usual printings (in the language Scryfall lists them in by default).
  const known = entry.card ? [entry.card.prints.fallback, ...(entry.card.aliases ?? []).map((alias) => alias.print)] : []
  const id = known.find((print) => print && print.set === set && print.collectorNumber === collectorNumber)?.id ?? null
  return { set, collectorNumber, scryfallId: id }
}

function add(section: PlannedCard[], entry: EntryReport, count: number, forgeName: string): void {
  const printing = printingOf(entry)
  const same = section.findIndex((planned) => planned.forgeName === forgeName && planned.set === printing.set && planned.collectorNumber === printing.collectorNumber)
  if (same >= 0) {
    const planned = section[same]!
    section[same] = { ...planned, count: planned.count + count, lines: [...planned.lines, entry.entry.line] }
    return
  }
  section.push({ count, forgeName, card: entry.card, match: entry.match, forgeOnly: entry.forgeOnly, ...printing, lines: [entry.entry.line] })
}

/** The deck the report and the player's decisions give (see the head comment). leftOut: line numbers the player left out. */
export function planDeck(report: DeckImportReport, leftOut: ReadonlySet<number> = new Set()): DeckPlan {
  const sections: Record<Section, PlannedCard[]> = { main: [], sideboard: [], commander: [] }
  const blockers: ImportBlocker[] = []
  const leftOutEntries: EntryReport[] = []
  const leftOutProblems: ArenaLineProblem[] = []
  const companions: EntryReport[] = []

  for (const problem of report.list.problems) {
    if (leftOut.has(problem.line)) leftOutProblems.push(problem)
    else blockers.push({ kind: "line", problem })
  }
  for (const entry of report.entries) {
    if (leftOut.has(entry.entry.line)) {
      leftOutEntries.push(entry)
      continue
    }
    if (entry.status !== "resolved" || entry.forgeName === null) {
      blockers.push({ kind: "entry", entry })
      continue
    }
    if (entry.entry.section === "companion") companions.push(entry)
    else add(sections[entry.entry.section], entry, entry.entry.count, entry.forgeName)
  }

  const planned: PlannedCompanion[] = companions.map((entry) => {
    const inSideboard = sections.sideboard.some((card) => card.forgeName === entry.forgeName)
    if (!inSideboard) add(sections.sideboard, entry, entry.entry.count, entry.forgeName!)
    return { entry, addedToSideboard: !inSideboard }
  })

  if (sections.main.length === 0) blockers.push({ kind: "empty-main" })
  // Blockers in the order of the list.
  const lineOf = (blocker: ImportBlocker) => (blocker.kind === "line" ? blocker.problem.line : blocker.kind === "entry" ? blocker.entry.entry.line : Number.MAX_SAFE_INTEGER)
  blockers.sort((a, b) => lineOf(a) - lineOf(b))

  return {
    main: sections.main,
    sideboard: sections.sideboard,
    commander: sections.commander,
    companions: planned,
    format: sections.commander.length > 0 ? "commander" : "constructed",
    blockers,
    leftOut: { entries: leftOutEntries, problems: leftOutProblems },
  }
}

/** Cards in a section (4 × … + 20 × … = 24). */
export function plannedCount(cards: readonly PlannedCard[]): number {
  return cards.reduce((sum, card) => sum + card.count, 0)
}

function deckCard(planned: PlannedCard): DeckCard {
  return {
    count: planned.count,
    name: planned.forgeName,
    ...(planned.set !== null && planned.collectorNumber !== null ? { set: planned.set, collectorNumber: planned.collectorNumber } : {}),
    ...(planned.card !== null ? { oracleId: planned.card.oracleId } : {}),
    ...(planned.scryfallId !== null ? { scryfallId: planned.scryfallId } : {}),
  }
}

export interface DeckRecordInput {
  readonly id: string
  readonly name: string
  /** The list as it was checked: kept unchanged in the deck (Bible §5). */
  readonly text: string
  /** ISO timestamp (Date.toISOString()). */
  readonly now: string
}

/** The DeckRecord of a plan without blockers (throws if it has any: saving is only possible after a clean check). */
export function deckRecordFrom(plan: DeckPlan, input: DeckRecordInput): DeckRecord {
  if (plan.blockers.length > 0) throw new Error(`the deck cannot be saved yet: ${plan.blockers.length} open problem(s)`)
  const name = input.name.trim()
  if (name === "") throw new Error("the deck needs a name")
  // An empty main deck is a blocker, so there is a first card.
  const [first, ...rest] = plan.main.map(deckCard)
  if (first === undefined) throw new Error("the main deck is empty")
  return {
    id: input.id,
    name,
    format: plan.format,
    main: [first, ...rest],
    sideboard: plan.sideboard.map(deckCard),
    commander: plan.commander.map(deckCard),
    source: { kind: "arena", text: input.text, importedAt: input.now },
    createdAt: input.now,
    updatedAt: input.now,
  }
}
