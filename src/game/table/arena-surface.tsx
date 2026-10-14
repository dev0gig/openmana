/*
 * The arena (prompt 53, docs/design/SPIELTISCH.md §4.1b): the table's
 * background since then - a quiet, continuous stone surface with warm light
 * above the opponent's strip and cool blue below the hand, after the binding
 * template (Dropzone workflow/OPENMANA-ARENA-VORLAGE.html, "G+").
 *
 * It is a shadow grid: a child of the GameBoard's grid that spans every track
 * and is itself a grid with `subgrid` on both axes (table.css), so each piece
 * of decoration lies in the cell of the region it belongs to - placed by the
 * board's own named lines (`grid-area: hand`, `opponent-field-start / field-end`
 * …) in every layout (hoch, quadrat, breit, breit and short, an expanded
 * decision). Nothing here measures anything: no ResizeObserver, no
 * getBoundingClientRect, no frames; the browser lays it out.
 *
 * Decoration only: hidden from screen readers, no pointer events, under every
 * region (first in the board, z-index 0). It knows nothing of the game - no
 * props, so a new game state never renders it again (memo) - and nothing in it
 * has a size of its own (min-width/min-height 0, backgrounds only): it must
 * never widen an `auto` track of the board (the geometry contract, checked by
 * the end-to-end test: every region and card within 1 CSS px of the same
 * scene over the drawn table).
 *
 * This prompt lays the ground (stone, vignette, warm and cool light, grain,
 * a few cracks). The opponent's, the playing area's and the hand's cells are
 * placed here already and dressed in prompt 54 (swings, centre line, runes,
 * tendrils, light dust, the brighter island); nothing moves.
 */
import { memo, type CSSProperties } from "react"
import "./table.css"

/** The arena's pieces by their `data-arena`, as table.css and the tests name them. */
export const ARENA_PIECES = ["ground", "opponent", "field", "hand"] as const

export type ArenaPiece = (typeof ARENA_PIECES)[number]

/**
 * The stone's grain: one tile of SVG noise (fractal turbulence tinted to a cool
 * grey-blue), repeated over the ground and blended with soft light - rendered
 * once by the browser as a background tile, never per state or per size.
 */
const GRAIN_TILE = 260

const GRAIN =
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${GRAIN_TILE}' height='${GRAIN_TILE}'>` +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/>" +
  "<feColorMatrix values='0 0 0 0 .55 0 0 0 0 .6 0 0 0 0 .7 0 0 0 .9 0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

/** A few fine cracks in the stone (five dark lines, three of them with a faint light edge), one tile repeated. */
const CRACKS_TILE = [900, 700] as const

const CRACKS =
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${CRACKS_TILE[0]}' height='${CRACKS_TILE[1]}' viewBox='0 0 ${CRACKS_TILE[0]} ${CRACKS_TILE[1]}'>` +
  "<g fill='none' stroke='%23000' stroke-opacity='.55' stroke-width='1.2'>" +
  "<path d='M-20 140 L120 160 L190 230 L260 240'/><path d='M640 40 L700 120 L790 150 L920 140'/>" +
  "<path d='M80 560 L200 530 L260 600 L330 610'/><path d='M560 690 L650 620 L760 610 L880 660'/><path d='M400 300 L430 340 L470 345'/></g>" +
  "<g fill='none' stroke='%23fff' stroke-opacity='.08' stroke-width='1.2'>" +
  "<path d='M-20 142 L120 162 L190 232 L260 242'/><path d='M640 42 L700 122 L790 152 L920 142'/><path d='M80 562 L200 532 L260 602 L330 612'/></g></svg>\")"

/** The ground's tiles as CSS custom properties (table.css draws them). */
export const ARENA_STYLE = {
  "--table-arena-grain": GRAIN,
  "--table-arena-grain-size": `${GRAIN_TILE}px ${GRAIN_TILE}px`,
  "--table-arena-cracks": CRACKS,
  "--table-arena-cracks-size": `${CRACKS_TILE[0]}px ${CRACKS_TILE[1]}px`,
} as CSSProperties

/**
 * The arena under the board. No props: it renders once per table and never
 * again for a new state; the board's grid places its cells.
 */
const ArenaSurface = memo(function ArenaSurface() {
  return (
    <div data-slot="table-surface" data-background="arena" aria-hidden="true" className="table-arena" style={ARENA_STYLE}>
      {/* The ground over the whole board: stone, vignette, warm light above, cool blue below, grain and cracks. */}
      <div data-arena="ground" className="table-arena-ground" />
      {/* The opponent's strip, the playing area (both battlefields with the centre line) and the hand: dressed in prompt 54. */}
      <div data-arena="opponent" className="table-arena-opponent" />
      <div data-arena="field" className="table-arena-field" />
      <div data-arena="hand" className="table-arena-hand" />
    </div>
  )
})

export { ArenaSurface }
