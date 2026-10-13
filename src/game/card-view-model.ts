/* Viewer identity and browsing: IDs/source references only, resolved from today's Forge snapshot. */
import type { GameState, Question, VisibleCard } from "@openmana/engine-protocol"
import { isVisible, locateCard } from "./table-model"

export type BrowseZone = "graveyard" | "exile" | "command" | "hand"
export type CardBrowse = { readonly kind: "ids"; readonly ids: readonly number[] } | { readonly kind: "zone"; readonly player: number; readonly zone: BrowseZone } | { readonly kind: "stack" }

export function questionCard(questions: readonly Question[], id: number, source?: number): { readonly question: number; readonly card: VisibleCard } | null {
  for (const q of questions) {
    if (source !== undefined && q.id !== source) continue
    if ("cardView" in q && q.cardView?.id === id) return { question: q.id, card: q.cardView }
    const items = "items" in q ? q.items : undefined
    for (const item of items ?? []) if ("cardView" in item && item.cardView?.id === id) return { question: q.id, card: item.cardView }
    if (q.kind === "options") for (const item of q.revealed ?? []) if ("cardView" in item && item.cardView?.id === id) return { question: q.id, card: item.cardView }
  }
  return null
}

/** Hidden cards are counted elsewhere, never candidates for the viewer. */
export function browseIds(state: GameState, source: CardBrowse | undefined): readonly number[] {
  if (source === undefined) return []
  if (source.kind === "ids") return source.ids.filter((id) => locateCard(state, id) !== null)
  if (source.kind === "stack") return [...new Set(state.stack.flatMap((item) => item.card !== null && isVisible(item.card) ? [item.card.id] : []))]
  const player = state.players.find((p) => p.id === source.player)
  return (player?.zones[source.zone] ?? []).filter(isVisible).map((c) => c.id)
}

/** The player's own hand as a browse source (prompt 50): resolved from each state like a zone. */
export function handBrowse(state: GameState): CardBrowse | null {
  const me = state.players.find((player) => player.me)
  return me === undefined ? null : handOf(me.id)
}

/** A player's hand as a browse source. */
export function handOf(player: number): CardBrowse {
  return { kind: "zone", player, zone: "hand" }
}

/**
 * Where the card being looked at stands in the list it is browsed in
 * (prompt 50), from the list of this state: its position ("3 von 7"), the
 * card before and after it - none past the ends, the list never wraps. A
 * card that left the list meanwhile (played from the hand, discarded) keeps
 * its former place: before it the card that stood before it, after it the
 * card that moved up into its place. Nothing is chosen for the player: the
 * view stays on the card that left until the player browses.
 */
export interface BrowsePosition {
  /** The card's place in the list (0-based), or null: it left the list. */
  readonly index: number | null
  readonly total: number
  readonly previous: number | null
  readonly next: number | null
}

export function browsePosition(ids: readonly number[], id: number, formerIndex: number | null): BrowsePosition {
  const index = ids.indexOf(id)
  if (index >= 0) return { index, total: ids.length, previous: ids[index - 1] ?? null, next: ids[index + 1] ?? null }
  if (formerIndex === null) return { index: null, total: ids.length, previous: null, next: ids[0] ?? null }
  const at = Math.min(formerIndex, ids.length)
  return { index: null, total: ids.length, previous: ids[at - 1] ?? null, next: ids[at] ?? null }
}
