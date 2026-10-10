/*
 * The game table's layout (prompt 36): "hoch", "quadrat" or "breit" by the
 * screen's aspect ratio (./table-layout.ts), kept current - the same media
 * queries as the CSS variants hoch:, quadrat: and breit: (src/index.css), for
 * what CSS alone cannot place (for example from which side a Sheet comes).
 *
 * "hoch" where there is no screen or no query answers (tests in jsdom) - the
 * Sheets then come from the bottom.
 */
import { useSyncExternalStore } from "react"
import { TABLE_LAYOUT_QUERIES, TABLE_LAYOUTS, tableSheetSide, type TableLayout, type TableSheetSide } from "./table-layout"

/** The three media query lists, asked once per matchMedia (a test may swap it). */
let asked: { readonly matchMedia: typeof window.matchMedia; readonly lists: readonly MediaQueryList[] } | null = null

function queries(): readonly MediaQueryList[] | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null
  if (asked?.matchMedia !== window.matchMedia) asked = { matchMedia: window.matchMedia, lists: TABLE_LAYOUTS.map((layout) => window.matchMedia(TABLE_LAYOUT_QUERIES[layout])) }
  return asked.lists
}

function subscribe(onChange: () => void): () => void {
  const lists = queries()
  if (lists === null) return () => undefined
  for (const list of lists) list.addEventListener("change", onChange)
  return () => {
    for (const list of lists) list.removeEventListener("change", onChange)
  }
}

function layout(): TableLayout {
  const lists = queries()
  if (lists === null) return "hoch"
  const index = lists.findIndex((list) => list.matches)
  return index < 0 ? "hoch" : TABLE_LAYOUTS[index]!
}

export function useTableLayout(): TableLayout {
  return useSyncExternalStore(subscribe, layout, () => "hoch")
}

/** From where the table's Sheets come now (prompt 38): from the bottom in hoch, from the right in quadrat and breit. */
export function useTableSheetSide(): TableSheetSide {
  return tableSheetSide(useTableLayout())
}
