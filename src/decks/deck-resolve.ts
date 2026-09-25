/*
 * Which card each line of an Arena list means: first through the card
 * catalog on this device (any name a card is known by - English, a face, a
 * printed alias, German, Forge's own name), then, only for lines the catalog
 * cannot decide and that name a printing, through Scryfall's API (set and
 * collector number identify a card in any language). The result is a report
 * line per entry: resolved to the name Forge knows, ambiguous (the player
 * chooses), unknown to Forge, or not found - never silently dropped, never
 * guessed.
 *
 * How a name is decided (the ranks follow how Arena and Forge name cards):
 *  1. A card's own name (English Oracle name or Forge's name) beats the name
 *     of a front face, which beats a later face, then an English name printed
 *     on some printings (alias), then a printed German name. "Lightning Bolt"
 *     is Lightning Bolt, not the second face of a card called "Emeritus of
 *     Conflict // Lightning Bolt"; "Delver of Secrets" is the double-faced
 *     card it is the front of.
 *  2. Several cards on the best rank: if all of them are one Forge card (Un-
 *     card variants), that Forge card - which picture is open; if exactly one
 *     of them is known to Forge (a playtest card beside the real one), that
 *     one; otherwise the player chooses (old German translations: "Zwang" is
 *     Duress and Coercion). A printing named in the line decides first, if it
 *     can.
 *  3. A card only Forge knows (Scryfall has no data: MTG Arena's rebalanced
 *     "A-" cards and a few others) is found by its Forge name.
 *  4. A card Forge does not know cannot be played: reported as such.
 *
 * Scryfall data is display and identity only; whether a deck is legal is
 * Forge's decision and not checked here.
 */
import { describeMatch, getCards, type CardMatch } from "@/cards/card-lookup"
import type { CardDataError } from "@/cards/errors"
import { nameKey, TOKEN_LAYOUTS } from "@/cards/names"
import { printKey, type PrintKey, type ResolvedPrint } from "@/cards/prints"
import type { LocalDatabase } from "@/storage/database"
import type { CardRecord, ForgeOnlyCardRecord, PrintRecord, SetRecord } from "@/storage/generated/records"
import type { ArenaDeckList, ArenaEntry } from "./arena-list"

export type EntryStatus =
  /** A card Forge knows: forgeName is set. */
  | "resolved"
  /** Several cards fit; the player chooses among candidates (or corrects the list). */
  | "ambiguous"
  /** The card exists, but the engine's Forge has no such card: a deck with it cannot be played. */
  | "not-in-forge"
  /** No card of this name (and no printing that says which). */
  | "unresolved"

export type ResolvedBy =
  /** An English name: the card's own, a face's, an alias, or Forge's. */
  | "name"
  /** A printed German name. */
  | "printed"
  /** A card only Forge knows, by its Forge name. */
  | "forge-only"
  /** Set and collector number, asked of Scryfall. */
  | "print"
  /** The player chose it. */
  | "choice"

export type EntryNote =
  /** Several Scryfall cards (variants of an Un-card) share the name; Forge has one card of that name. Which picture is open. */
  | { readonly kind: "variants"; readonly count: number }
  /** Several cards share the name, only this one is known to Forge. */
  | { readonly kind: "forge-known"; readonly others: number }
  /** The name is this card's English name and also the German name of the candidates' other cards. */
  | { readonly kind: "also-printed" }
  /** A later face's name found the card (it goes into the deck as a whole). */
  | { readonly kind: "back-face"; readonly face: number }
  /** Only a token has this name: tokens are made during a game, never part of a deck. */
  | { readonly kind: "token" }
  /** An "A-" name that is not a rebalanced card Forge knows by this English name. */
  | { readonly kind: "rebalanced-name" }
  /** The line's set code is not a set the card catalog knows: the picture is the card's usual one. */
  | { readonly kind: "set-unknown"; readonly set: string }
  /** A set without collector number does not name a printing: the picture is the card's usual one. */
  | { readonly kind: "set-without-number"; readonly set: string }
  /** The name was not enough; the printing (set and collector number) identified the card. */
  | { readonly kind: "print-identified" }
  /** Several cards fit the name; the printing decided. */
  | { readonly kind: "print-decided" }
  /** The printing belongs to a card the name does not fit: the printing is not used. */
  | { readonly kind: "print-other-card"; readonly card: string }
  /** Scryfall knows no such printing. */
  | { readonly kind: "print-missing" }
  /** Scryfall could not be asked (offline, error, pause after too many requests). */
  | { readonly kind: "print-unreachable" }
  /** The player chose this card among the candidates. */
  | { readonly kind: "chosen" }

/** The printing a line names: what was written, the Scryfall set behind it and - where Scryfall was asked - the printing. */
export interface EntryPrinting {
  readonly written: string
  readonly collectorNumber: string | null
  /** The Scryfall set of the written code (Arena's code or Scryfall's); null: no set of that code. */
  readonly set: SetRecord | null
  /** The printing itself, where Scryfall was asked for it (lines the catalog could not decide). */
  readonly print: PrintRecord | null
}

export interface EntryReport {
  readonly entry: ArenaEntry
  /** The name's lookup key (choices are kept by it). */
  readonly key: string
  readonly status: EntryStatus
  readonly by: ResolvedBy | null
  /** The catalog card (resolved, not-in-forge); null for Forge-only cards and undecided variants. */
  readonly card: CardRecord | null
  /** How the name found the card (the face or alias to show). */
  readonly match: CardMatch | null
  readonly forgeOnly: ForgeOnlyCardRecord | null
  /** The card name Forge knows (resolved only). */
  readonly forgeName: string | null
  /** ambiguous: the cards to choose from; also-printed: this card and the others the name fits. */
  readonly candidates: readonly CardMatch[]
  readonly notes: readonly EntryNote[]
  readonly printing: EntryPrinting | null
}

export interface DeckImportReport {
  readonly list: ArenaDeckList
  readonly entries: readonly EntryReport[]
  /** Scryfall was needed for some lines and could not be asked (those lines carry print-unreachable). */
  readonly printError: CardDataError | null
  /** How many printings were asked of Scryfall. */
  readonly printsAsked: number
}

/** Asks Scryfall for printings (the app: ensurePrints with the shared client). */
export type PrintLookup = (keys: readonly PrintKey[]) => Promise<{ readonly prints: ReadonlyMap<string, ResolvedPrint>; readonly error: CardDataError | null }>

export interface ResolveOptions {
  /** The player's choices for ambiguous names: name key → Oracle id of the chosen card. */
  readonly choices?: ReadonlyMap<string, string>
  /** Omitted: no network; lines the catalog cannot decide stay as they are. */
  readonly lookupPrints?: PrintLookup
}

const RANK_PRINTED = 4

/** How well a name identifies a card (lower is better; see the head comment). */
export function matchRank(match: CardMatch): number {
  switch (match.kind) {
    case "name":
      return 0
    case "face":
      return match.face === 0 ? 1 : 2
    case "alias":
      return 3
    case "printed":
      return RANK_PRINTED
  }
}

/** What the catalog holds for one name. */
interface Found {
  /** Every catalog card with this name among its keys (tokens included). */
  readonly cards: readonly CardRecord[]
  readonly forgeOnly: ForgeOnlyCardRecord | null
}

type Decision = Omit<EntryReport, "entry" | "key" | "printing">

const UNRESOLVED: Decision = { status: "unresolved", by: null, card: null, match: null, forgeOnly: null, forgeName: null, candidates: [], notes: [] }

function forgeOnlyDecision(forgeOnly: ForgeOnlyCardRecord, notes: readonly EntryNote[] = []): Decision {
  return { status: "resolved", by: "forge-only", card: null, match: null, forgeOnly, forgeName: forgeOnly.name, candidates: [], notes }
}

/** A decision for one card the name (or a printing, or the player) found. */
function cardDecision(match: CardMatch, found: Found, key: string, by: ResolvedBy, notes: readonly EntryNote[], candidates: readonly CardMatch[] = []): Decision {
  const card = match.card
  const allNotes = match.kind === "face" && match.face !== null && match.face > 0 ? [{ kind: "back-face", face: match.face } as const, ...notes] : notes
  if (card.forgeNames.length === 0) {
    // Forge knows a card of this name without Scryfall data: that is the card to play.
    if (found.forgeOnly) return forgeOnlyDecision(found.forgeOnly, notes)
    return { status: "not-in-forge", by, card, match, forgeOnly: null, forgeName: null, candidates, notes: allNotes }
  }
  // A card is normally one Forge card; should Forge have several scripts of it, the one of this name plays it.
  const forgeName = card.forgeNames.find((name) => nameKey(name) === key) ?? card.forgeNames[0]!
  return { status: "resolved", by, card, match, forgeOnly: null, forgeName, candidates, notes: allNotes }
}

/** Decides a name from what the catalog holds for it (pure). */
export function decideName(name: string, found: Found): Decision {
  const key = nameKey(name)
  const all = found.cards.map((card) => describeMatch(card, name))
  const matches = all.filter((match) => !TOKEN_LAYOUTS.has(match.card.layout))
  if (matches.length === 0) {
    if (found.forgeOnly) return forgeOnlyDecision(found.forgeOnly)
    if (all.length > 0) return { ...UNRESOLVED, notes: [{ kind: "token" }] }
    if (/^a-/i.test(name.trim())) return { ...UNRESOLVED, notes: [{ kind: "rebalanced-name" }] }
    return UNRESOLVED
  }
  const best = Math.min(...matches.map(matchRank))
  const top = matches.filter((match) => matchRank(match) === best)
  const by: ResolvedBy = best === RANK_PRINTED ? "printed" : "name"
  if (top.length === 1) {
    const [only] = top as [CardMatch]
    // An English name that is also another card's German name: say so, and let the player switch.
    const printed = best < RANK_PRINTED ? matches.filter((match) => matchRank(match) === RANK_PRINTED && match.card.forgeNames.length > 0) : []
    if (printed.length > 0) return cardDecision(only, found, key, by, [{ kind: "also-printed" }], [only, ...printed])
    return cardDecision(only, found, key, by, [])
  }
  const known = top.filter((match) => match.card.forgeNames.length > 0)
  const forgeNames = new Set(known.flatMap((match) => match.card.forgeNames))
  if (known.length === top.length && forgeNames.size === 1) {
    // Variants of one Forge card (Un-cards): Forge plays its one card; which Scryfall variant is meant stays open.
    const [forgeName] = forgeNames
    return { status: "resolved", by, card: null, match: null, forgeOnly: null, forgeName: forgeName!, candidates: top, notes: [{ kind: "variants", count: top.length }] }
  }
  if (known.length === 1) return cardDecision(known[0]!, found, key, by, [{ kind: "forge-known", others: top.length - 1 }])
  if (known.length === 0) {
    if (found.forgeOnly) return forgeOnlyDecision(found.forgeOnly)
    return { status: "not-in-forge", by, card: top[0]!.card, match: top[0]!, forgeOnly: null, forgeName: null, candidates: top, notes: [] }
  }
  return { status: "ambiguous", by: null, card: null, match: null, forgeOnly: null, forgeName: null, candidates: known, notes: [] }
}

/** The player's choice, if it is one of the candidates (a choice for other cards of the name is void). */
function applyChoice(decision: Decision, found: Found, key: string, choice: string | undefined): Decision {
  if (choice === undefined) return decision
  const chosen = decision.candidates.find((candidate) => candidate.card.oracleId === choice)
  if (!chosen || decision.card?.oracleId === choice) return decision
  return cardDecision(chosen, found, key, "choice", [{ kind: "chosen" }], decision.candidates)
}

/** A set code as the catalog finds it: Arena's code first, then Scryfall's own (card-lookup.ts findSetByArenaCode, for many codes at once). */
async function readCatalog(db: LocalDatabase, keys: readonly string[], setCodes: readonly string[]) {
  return db.read(["scryfallCards", "forgeOnlyCards", "scryfallSets"], async (transaction) => {
    const cards = transaction.objectStore("scryfallCards").index("nameKeys")
    const forgeOnly = transaction.objectStore("forgeOnlyCards").index("nameKeys")
    const sets = transaction.objectStore("scryfallSets")
    const found = new Map<string, Found>()
    for (const key of keys) {
      const [records, only] = await Promise.all([cards.getAll(key), forgeOnly.get(key)])
      found.set(key, { cards: records, forgeOnly: only ?? null })
    }
    const setsByCode = new Map<string, SetRecord | null>()
    for (const code of setCodes) {
      const lower = code.toLowerCase()
      const byArena = (await sets.index("arenaCode").getAll(lower))[0] ?? (await sets.index("arenaCode").getAll(code.toUpperCase()))[0]
      setsByCode.set(lower, byArena ?? (await sets.get(lower)) ?? null)
    }
    return { found, setsByCode }
  })
}

function printingOf(entry: ArenaEntry, setsByCode: ReadonlyMap<string, SetRecord | null>): EntryPrinting | null {
  if (entry.set === null) return null
  return { written: entry.set, collectorNumber: entry.collectorNumber, set: setsByCode.get(entry.set.toLowerCase()) ?? null, print: null }
}

function printingNotes(printing: EntryPrinting | null): EntryNote[] {
  if (printing === null) return []
  if (printing.set === null) return [{ kind: "set-unknown", set: printing.written }]
  if (printing.collectorNumber === null) return [{ kind: "set-without-number", set: printing.written }]
  return []
}

/** Lines the catalog could not decide that name a printing Scryfall can be asked about. Rebalanced ("A-") cards are not: Scryfall only has their originals. */
function needsPrint(decision: Decision, entry: ArenaEntry, printing: EntryPrinting | null): printing is EntryPrinting & { set: SetRecord; collectorNumber: string } {
  return (
    (decision.status === "unresolved" || decision.status === "ambiguous") &&
    printing !== null &&
    printing.set !== null &&
    printing.collectorNumber !== null &&
    !/^a-/i.test(entry.name.trim())
  )
}

/** Resolves every entry of a parsed list (see the head comment). Reads the catalog in one transaction. */
export async function resolveDeckList(db: LocalDatabase, list: ArenaDeckList, options: ResolveOptions = {}): Promise<DeckImportReport> {
  const keys = [...new Set(list.entries.map((entry) => nameKey(entry.name)))]
  const setCodes = [...new Set(list.entries.flatMap((entry) => (entry.set === null ? [] : [entry.set.toLowerCase()])))]
  const { found, setsByCode } = await readCatalog(db, keys, setCodes)
  const choices = options.choices ?? new Map<string, string>()

  const drafts = list.entries.map((entry) => {
    const key = nameKey(entry.name)
    const known = found.get(key) ?? { cards: [], forgeOnly: null }
    const decision = applyChoice(decideName(entry.name, known), known, key, choices.get(key))
    return { entry, key, found: known, decision, printing: printingOf(entry, setsByCode) }
  })

  // Scryfall, only for what the catalog could not decide.
  const asked = drafts.filter((draft) => needsPrint(draft.decision, draft.entry, draft.printing))
  const printKeys = [...new Map(asked.map((draft) => [printKey(printKeyOf(draft.printing!)), printKeyOf(draft.printing!)])).values()]
  let printError: CardDataError | null = null
  let prints: ReadonlyMap<string, ResolvedPrint> = new Map()
  if (printKeys.length > 0 && options.lookupPrints) {
    const answer = await options.lookupPrints(printKeys)
    prints = answer.prints
    printError = answer.error
  }
  const printedCards = await getCards(
    db,
    [...prints.values()].flatMap((resolved) => (resolved.original ? [resolved.original.oracleId] : [])),
  )

  const entries = drafts.map(({ entry, key, found: known, decision, printing }): EntryReport => {
    let result = decision
    let shown = printing
    if (needsPrint(decision, entry, printing) && options.lookupPrints) {
      const resolved = prints.get(printKey(printKeyOf(printing)))
      const original = resolved?.original ?? null
      shown = { ...printing, print: original }
      if (original === null) {
        result = { ...decision, notes: [...decision.notes, { kind: printError ? "print-unreachable" : "print-missing" }] }
      } else if (decision.status === "unresolved") {
        const card = printedCards.get(original.oracleId)
        result = card
          ? cardDecision({ card, kind: "name", face: null, alias: null }, known, key, "print", [{ kind: "print-identified" }])
          : { ...decision, notes: [...decision.notes, { kind: "print-other-card", card: original.name }] }
      } else {
        const candidate = decision.candidates.find((match) => match.card.oracleId === original.oracleId)
        result = candidate
          ? cardDecision(candidate, known, key, "print", [{ kind: "print-decided" }], decision.candidates)
          : { ...decision, notes: [...decision.notes, { kind: "print-other-card", card: original.name }] }
      }
    }
    return { entry, key, ...result, notes: [...result.notes, ...printingNotes(printing)], printing: shown }
  })

  return { list, entries, printError, printsAsked: printKeys.length }
}

function printKeyOf(printing: EntryPrinting): PrintKey {
  return { set: printing.set!.code, collectorNumber: printing.collectorNumber! }
}
