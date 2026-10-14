/*
 * What the zone view (ZoneSheet) shows of a zone or the stack, from one full
 * state of Forge's and nothing else. Pure: no React.
 *
 * - Order: Forge's list of a graveyard and of exile is in the order the
 *   cards arrived - Forge's `Zone.add` appends every card it moves there
 *   (`GameAction.moveToGraveyard` and `exile` pass no position; cards that
 *   move together come in the order their player chose, `orderMoveToZoneList`),
 *   and the bridge (`StateBuilder`) sends `PlayerView.getCards` in that order.
 *   So the view shows those two newest first and marks the newest ("zuletzt").
 *   The one exception is Forge's `ReorderZone` effect, which only Fossil Find
 *   and Search for Survivors use on a graveyard (the order then is the one
 *   Forge's reordering chose; the newest mark names the top card).
 *   The command zone is not in arrival order (Forge puts a commander first),
 *   so it keeps Forge's order and gets no mark; so does the stack (first =
 *   top, the one that resolves next).
 * - Identical cards ("×N") are grouped exactly as the table groups its
 *   piles: every value Forge sends about them is equal (`cardSignature`),
 *   and none of them is named elsewhere - in an open question, on the stack,
 *   in combat (`namedCardIds`). The stack is never grouped.
 * - Hidden cards are only counted; they have no id and are never told apart.
 */
import type { GameState, Question, VisibleCard } from "@openmana/engine-protocol"
import type { BrowseZone } from "./card-view-model"
import { cardSignature, isVisible, namedCardIds } from "./table-model"

/** The zones the zone view shows (the hand has its own place, the library is a number). */
export type SheetZone = Exclude<BrowseZone, "hand">

export const SHEET_ZONES: readonly SheetZone[] = ["graveyard", "exile", "command"]

/** What the zone view looks at: one player's zone, or the stack (shared by both players). */
export type ZoneSource = { readonly kind: "zone"; readonly player: number; readonly zone: SheetZone } | { readonly kind: "stack" }

/** The zones whose Forge order is the order of arrival: shown newest first. */
const NEWEST_FIRST: ReadonlySet<SheetZone> = new Set(["graveyard", "exile"])

/** One tile of the zone view: a card, or several identical ones. */
export interface ZoneEntry {
  /** Stable for React: the first card's id. */
  readonly key: string
  /** The card shown (the first of the group). */
  readonly card: VisibleCard
  /** Every card of the group, in the view's order (one for a single card). */
  readonly ids: readonly number[]
  /** The newest card of a graveyard or exile is in this tile (only when more than one card is visible). */
  readonly latest: boolean
}

export interface ZoneContents {
  readonly entries: readonly ZoneEntry[]
  /** Every card of the zone (hidden ones included), or every entry of the stack. */
  readonly total: number
  /** Cards (stack entries) whose identity Forge keeps hidden. */
  readonly hidden: number
  /** Whether the view shows the newest first (graveyard, exile) or Forge's order. */
  readonly order: "newest-first" | "forge"
}

export function zoneContents(state: GameState, source: ZoneSource, questions: readonly Question[]): ZoneContents {
  if (source.kind === "stack") {
    const seen = new Set<number>()
    const entries: ZoneEntry[] = []
    let hidden = 0
    for (const item of state.stack) {
      if (item.card === null) continue
      if (!isVisible(item.card)) { hidden += 1; continue }
      // A card with several abilities on the stack is one tile (its entries are the Zauberchronik's).
      if (seen.has(item.card.id)) continue
      seen.add(item.card.id)
      entries.push({ key: String(item.card.id), card: item.card, ids: [item.card.id], latest: false })
    }
    return { entries, total: state.stack.length, hidden, order: "forge" }
  }
  const cards = state.players.find((player) => player.id === source.player)?.zones[source.zone] ?? []
  const newestFirst = NEWEST_FIRST.has(source.zone)
  const visible = cards.filter(isVisible)
  const ordered = newestFirst ? [...visible].reverse() : visible
  const newest = cards.at(-1)
  const latestId = newestFirst && visible.length > 1 && newest !== undefined && isVisible(newest) ? newest.id : null
  const named = namedCardIds(state, questions)
  const entries: { key: string; card: VisibleCard; ids: number[] }[] = []
  const groups = new Map<string, { ids: number[] }>()
  for (const card of ordered) {
    if (!named.has(card.id)) {
      const key = cardSignature(card)
      const group = groups.get(key)
      if (group !== undefined) { group.ids.push(card.id); continue }
      const entry = { key: String(card.id), card, ids: [card.id] }
      groups.set(key, entry)
      entries.push(entry)
      continue
    }
    entries.push({ key: String(card.id), card, ids: [card.id] })
  }
  return {
    entries: entries.map((entry) => ({ ...entry, latest: latestId !== null && entry.ids.includes(latestId) })),
    total: cards.length,
    hidden: cards.length - visible.length,
    order: newestFirst ? "newest-first" : "forge",
  }
}

/** The ids the card view browses when it was opened from the zone view: the tiles' order, a group's cards one after another. */
export function zoneBrowseIds(state: GameState, source: ZoneSource, questions: readonly Question[]): readonly number[] {
  return zoneContents(state, source, questions).entries.flatMap((entry) => entry.ids)
}
