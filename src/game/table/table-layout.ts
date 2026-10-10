/*
 * The game table's three layouts (prompt 36, docs/design/SPIELTISCH.md §3):
 * chosen by the screen's aspect ratio (width : height), never by the device
 * or its orientation alone.
 *
 *   hoch     narrower than 3:4         folded foldable, phones, tablets upright
 *   quadrat  3:4 up to 13:10 (both in) unfolded foldable either way round
 *   breit    wider than 13:10          desktop, laptop, tablets and phones turned
 *
 * The same three media queries define the CSS variants hoch:, quadrat: and
 * breit: in src/index.css (src/game/table/table-layout.test.ts keeps both
 * identical); useTableLayout() (./use-table-layout.ts) follows them in code.
 * A low window additionally keeps the existing short: variant (at most 32rem
 * high), which matters inside breit (a phone turned sideways).
 *
 * Pure and free of imports: the end-to-end test (scripts/e2e/run.ts) imports
 * it in Node to check the real browser against the same values.
 */

export type TableLayout = "hoch" | "quadrat" | "breit"

export const TABLE_LAYOUTS: readonly TableLayout[] = ["hoch", "quadrat", "breit"]

/** The media queries of the three layouts; they cover every aspect ratio exactly once. */
export const TABLE_LAYOUT_QUERIES: Readonly<Record<TableLayout, string>> = {
  hoch: "(aspect-ratio < 3/4)",
  quadrat: "(3/4 <= aspect-ratio <= 13/10)",
  breit: "(aspect-ratio > 13/10)",
}

/** The layout of a screen of this size (CSS pixels), the same decision as the media queries - in whole numbers, without rounding. */
export function tableLayoutOf(width: number, height: number): TableLayout {
  if (width * 4 < height * 3) return "hoch"
  if (width * 10 > height * 13) return "breit"
  return "quadrat"
}
