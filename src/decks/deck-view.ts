/*
 * A saved deck as the library shows it: every entry with the catalog card
 * behind it (German where Scryfall has it, English marked), how German the
 * deck's cards are, and the card that stands for the deck in lists.
 *
 * Display only. Which cards a deck has is the saved deck (the names Forge
 * knows, prompt 09); Scryfall's data only say how to show them, never what
 * a card does or whether a deck may be played (Forge decides).
 *
 * - An entry finds its card by the Oracle id the import stored; a card only
 *   Forge knows by its Forge name. Without catalog data on this device (none
 *   installed, another catalog version, or Un-card variants the import left
 *   open) the entry shows the name Forge knows, marked as such - never a
 *   guessed card.
 * - The name shown is the one the game will show: the card as Forge names
 *   it (a double-faced card by its front face, a Universes Beyond card by
 *   the name Forge plays it under), in German where there is one.
 * - Pictures: a printing the list named (set and collector number) is shown
 *   in German where that printing exists in German; otherwise the card's
 *   German picture wins over an English picture of the named printing
 *   (Bible §4: German first) - the named printing stays as text and in the
 *   export. A Universes Beyond card shows the printing with the name Forge
 *   plays it under.
 */
import { cardDisplay, type LocalizedText } from "@/cards/card-display"
import { describeMatch, type CardMatch } from "@/cards/card-lookup"
import type { ResolvedPrint } from "@/cards/print-key"
import type { CheckedRecords, LocalDatabase } from "@/storage/database"
import { listDecks } from "@/storage/decks"
import type { CardRecord, DeckCard, DeckRecord, ForgeOnlyCardRecord, PrintRecord, SetRecord } from "@/storage/generated/records"
import type { StoreName } from "@/storage/schema"

/** The parts of a saved deck, in the order the library shows them. */
export type DeckPart = "commander" | "companion" | "main" | "sideboard"
export const DECK_PARTS: readonly DeckPart[] = ["commander", "companion", "main", "sideboard"]

export function partEntries(deck: DeckRecord, part: DeckPart): readonly DeckCard[] {
  return part === "companion" ? (deck.companion ?? []) : deck[part]
}

/** The cards (Oracle ids) of a deck, all parts. */
export function deckOracleIds(deck: DeckRecord): ReadonlySet<string> {
  return new Set(DECK_PARTS.flatMap((part) => partEntries(deck, part).flatMap((entry) => (entry.oracleId !== undefined ? [entry.oracleId] : []))))
}

/** What the card catalog on this device holds for some decks' cards. */
export interface DeckCardIndex {
  /** By Oracle id. */
  readonly cards: ReadonlyMap<string, CardRecord>
  /** Cards only Forge knows, by Forge name. */
  readonly forgeOnly: ReadonlyMap<string, ForgeOnlyCardRecord>
  /** By Scryfall set code. */
  readonly sets: ReadonlyMap<string, SetRecord>
}

export const EMPTY_INDEX: DeckCardIndex = { cards: new Map(), forgeOnly: new Map(), sets: new Map() }

/** The catalog data of the decks' cards and sets, in one read (nothing for a device without catalog). */
export async function readDeckCards(db: LocalDatabase, decks: readonly DeckRecord[]): Promise<DeckCardIndex> {
  const oracleIds = new Set<string>()
  const forgeNames = new Set<string>()
  const setCodes = new Set<string>()
  for (const deck of decks) {
    for (const part of DECK_PARTS) {
      for (const entry of partEntries(deck, part)) {
        if (entry.oracleId !== undefined) oracleIds.add(entry.oracleId)
        else forgeNames.add(entry.name)
        if (entry.set !== undefined) setCodes.add(entry.set)
      }
    }
  }
  return db.read(["scryfallCards", "forgeOnlyCards", "scryfallSets"], async (transaction) => {
    const cardStore = transaction.objectStore("scryfallCards")
    const forgeOnlyStore = transaction.objectStore("forgeOnlyCards")
    const setStore = transaction.objectStore("scryfallSets")
    const [cards, forgeOnly, sets] = await Promise.all([
      Promise.all([...oracleIds].map((id) => cardStore.get(id))),
      Promise.all([...forgeNames].map((name) => forgeOnlyStore.get(name))),
      Promise.all([...setCodes].map((code) => setStore.get(code))),
    ])
    return {
      cards: new Map(cards.flatMap((card) => (card ? [[card.oracleId, card] as const] : []))),
      forgeOnly: new Map(forgeOnly.flatMap((card) => (card ? [[card.name, card] as const] : []))),
      sets: new Map(sets.flatMap((set) => (set ? [[set.code, set] as const] : []))),
    }
  })
}

/** The stores the library reads: a change to any of them (a deck, a catalog install) shows at once. */
export const LIBRARY_STORES: readonly StoreName[] = ["decks", "scryfallCards", "forgeOnlyCards", "scryfallSets"]

export interface Library {
  readonly decks: CheckedRecords<DeckRecord>
  readonly index: DeckCardIndex
}

/** Every deck and the catalog data of its cards (for useStorageQuery on LIBRARY_STORES). */
export async function readLibrary(db: LocalDatabase): Promise<Library> {
  const decks = await listDecks(db)
  return { decks, index: await readDeckCards(db, decks.records) }
}

export type CardLanguage =
  /** Name, type line, text and picture in German. */
  | "de"
  /** Partly German: the picture or some of the text is English. */
  | "partial"
  /** No German version at all (Scryfall knows none): English. */
  | "en"
  /** Only Forge knows the card: its English name, no picture. */
  | "forge-only"
  /** No catalog data for it on this device. */
  | "unknown"

export interface EntryView {
  readonly part: DeckPart
  readonly entry: DeckCard
  readonly card: CardRecord | null
  /** How the entry's name (Forge's) finds the card: the face or alias to show. */
  readonly match: CardMatch | null
  readonly forgeOnly: ForgeOnlyCardRecord | null
  readonly language: CardLanguage
  /** The name the player reads: German where there is one, else English (lang "en"). */
  readonly name: LocalizedText
}

function languageOf(card: CardRecord): CardLanguage {
  const { text, germanPictureExists } = cardDisplay(card).language
  if (text === "de" && germanPictureExists) return "de"
  if (text === "en" && !germanPictureExists) return "en"
  return "partial"
}

export function entryView(part: DeckPart, entry: DeckCard, index: DeckCardIndex): EntryView {
  const card = entry.oracleId !== undefined ? (index.cards.get(entry.oracleId) ?? null) : null
  if (card !== null) {
    const match = describeMatch(card, entry.name)
    return { part, entry, card, match, forgeOnly: null, language: languageOf(card), name: cardDisplay(card, { match }).name }
  }
  const forgeOnly = entry.oracleId === undefined ? (index.forgeOnly.get(entry.name) ?? null) : null
  return { part, entry, card: null, match: null, forgeOnly, language: forgeOnly !== null ? "forge-only" : "unknown", name: { text: entry.name, lang: "en" } }
}

/** A card's identity across a deck's parts (the same card in main deck and sideboard is one card). */
function identity(view: EntryView): string {
  return view.card !== null ? `oracle:${view.card.oracleId}` : `forge:${view.entry.name}`
}

export interface DeckLanguage {
  /** Distinct cards per language. */
  readonly counts: Readonly<Record<CardLanguage, number>>
  readonly total: number
  /** Distinct cards that are not entirely German, in deck order. */
  readonly notGerman: readonly EntryView[]
}

export interface DeckView {
  readonly deck: DeckRecord
  readonly parts: Readonly<Record<DeckPart, readonly EntryView[]>>
  /** Cards (copies) per part. */
  readonly counts: Readonly<Record<DeckPart, number>>
  readonly language: DeckLanguage
  /** The card that stands for the deck (see cover()); null for an empty deck. */
  readonly cover: EntryView | null
}

/**
 * The deck's commander; else the main-deck card of the highest mana value
 * (the "biggest" card, never a land) - more copies, then list order, break
 * ties. Chosen from the catalog's numbers, not from card names or texts.
 */
function cover(parts: Readonly<Record<DeckPart, readonly EntryView[]>>): EntryView | null {
  const commander = parts.commander.find((view) => view.card !== null) ?? parts.commander[0]
  if (commander !== undefined) return commander
  let best: EntryView | null = null
  for (const view of parts.main) {
    if (view.card === null) continue
    if (best === null || view.card.manaValue > best.card!.manaValue || (view.card.manaValue === best.card!.manaValue && view.entry.count > best.entry.count)) best = view
  }
  return best ?? parts.main[0] ?? null
}

export function viewDeck(deck: DeckRecord, index: DeckCardIndex): DeckView {
  const parts = Object.fromEntries(DECK_PARTS.map((part) => [part, partEntries(deck, part).map((entry) => entryView(part, entry, index))])) as Record<DeckPart, EntryView[]>
  const counts = Object.fromEntries(DECK_PARTS.map((part) => [part, partEntries(deck, part).reduce((sum, entry) => sum + entry.count, 0)])) as Record<DeckPart, number>
  const languageCounts: Record<CardLanguage, number> = { de: 0, partial: 0, en: 0, "forge-only": 0, unknown: 0 }
  const seen = new Set<string>()
  const notGerman: EntryView[] = []
  for (const part of DECK_PARTS) {
    for (const view of parts[part]) {
      const id = identity(view)
      if (seen.has(id)) continue
      seen.add(id)
      languageCounts[view.language]++
      if (view.language !== "de") notGerman.push(view)
    }
  }
  return { deck, parts, counts, language: { counts: languageCounts, total: seen.size, notGerman }, cover: cover(parts) }
}

/** Every name an entry is known by, as name keys (English, faces, aliases, German, Forge's). */
export function entryNameKeys(view: EntryView): readonly string[] {
  return view.card?.nameKeys ?? view.forgeOnly?.nameKeys ?? []
}

/** Only real pictures count: a placeholder is Scryfall's stand-in until it has a scan. */
function hasPicture(print: PrintRecord | null | undefined): print is PrintRecord {
  return print != null && print.imageSides > 0 && (print.imageStatus === "lowres" || print.imageStatus === "highres_scan")
}

/**
 * The printing whose picture an entry shows (see the head comment); null:
 * the card's default picture (German where there is one). `resolved` is
 * what Scryfall said about the printing the list named, if it was asked.
 */
export function pictureOf(view: EntryView, resolved: ResolvedPrint | undefined): PrintRecord | null {
  const card = view.card
  if (card === null || resolved === undefined || view.match?.kind === "alias") return null
  if (hasPicture(resolved.german)) return resolved.german
  if (card.prints.de !== null) return null
  return hasPicture(resolved.original) ? resolved.original : null
}

/** A printing the list named that the catalog does not carry for the card (Scryfall is asked for these, and only these). */
export function needsNamedPrint(view: EntryView): boolean {
  const { card, entry } = view
  if (card === null || entry.set === undefined || entry.collectorNumber === undefined || view.match?.kind === "alias") return false
  const carried = [card.prints.de, card.prints.fallback].some((print) => print !== null && print.set === entry.set && print.collectorNumber === entry.collectorNumber)
  return !carried
}
