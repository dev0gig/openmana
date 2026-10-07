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
