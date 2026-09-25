/*
 * The deck library's list: searching, filtering by format and sorting - pure
 * functions over the decks as deck-view.ts shows them. The query lives in the
 * page's address (?q=…&format=…&sort=…), so it survives a reload and the
 * back button and needs no storage.
 *
 * Search finds a deck by its name or by any name of any of its cards -
 * English, German, a face, the name Forge knows - ignoring case, accents and
 * the other differences card names have between sources (cards/names.ts).
 */
import { nameKey } from "@/cards/names"
import type { DeckFormat } from "@/storage/generated/records"
import { DECK_PARTS, entryNameKeys, type DeckView } from "./deck-view"

export type DeckSort = "name" | "updated" | "created"
export const DECK_SORTS: readonly DeckSort[] = ["name", "updated", "created"]

export type FormatFilter = "all" | DeckFormat
export const FORMAT_FILTERS: readonly FormatFilter[] = ["all", "constructed", "commander"]

export interface LibraryQuery {
  readonly text: string
  readonly format: FormatFilter
  readonly sort: DeckSort
}

export const DEFAULT_QUERY: LibraryQuery = { text: "", format: "all", sort: "name" }

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** The query in an address; unknown values fall back to the defaults. */
export function queryFromParams(params: URLSearchParams): LibraryQuery {
  return {
    text: params.get("q") ?? "",
    format: oneOf(params.get("format"), FORMAT_FILTERS, DEFAULT_QUERY.format),
    sort: oneOf(params.get("sort"), DECK_SORTS, DEFAULT_QUERY.sort),
  }
}

/** The address of a query: only what differs from the defaults. */
export function paramsFromQuery(query: LibraryQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.text !== "") params.set("q", query.text)
  if (query.format !== DEFAULT_QUERY.format) params.set("format", query.format)
  if (query.sort !== DEFAULT_QUERY.sort) params.set("sort", query.sort)
  return params
}

/** Whether a deck's name or one of its cards' names contains the text. */
export function deckMatches(view: DeckView, text: string): boolean {
  const key = nameKey(text)
  if (key === "") return true
  if (nameKey(view.deck.name).includes(key)) return true
  return DECK_PARTS.some((part) =>
    view.parts[part].some((entry) => nameKey(entry.entry.name).includes(key) || entryNameKeys(entry).some((name) => name.includes(key))),
  )
}

const byName = new Intl.Collator("de-DE", { sensitivity: "base", numeric: true })

function compare(sort: DeckSort): (a: DeckView, b: DeckView) => number {
  const name = (a: DeckView, b: DeckView) => byName.compare(a.deck.name, b.deck.name) || a.deck.id.localeCompare(b.deck.id)
  switch (sort) {
    case "name":
      return name
    case "updated":
      // ISO timestamps sort as text; newest first.
      return (a, b) => (a.deck.updatedAt < b.deck.updatedAt ? 1 : a.deck.updatedAt > b.deck.updatedAt ? -1 : name(a, b))
    case "created":
      return (a, b) => (a.deck.createdAt < b.deck.createdAt ? 1 : a.deck.createdAt > b.deck.createdAt ? -1 : name(a, b))
  }
}

/** The decks the query shows, in its order. */
export function arrangeDecks(views: readonly DeckView[], query: LibraryQuery): DeckView[] {
  return views.filter((view) => (query.format === "all" || view.deck.format === query.format) && deckMatches(view, query.text)).sort(compare(query.sort))
}

/** The formats present among the decks (the format filter is only worth showing for more than one). */
export function formatsPresent(views: readonly DeckView[]): DeckFormat[] {
  return [...new Set(views.map((view) => view.deck.format))]
}
