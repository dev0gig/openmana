/*
 * The arena (prompts 53-54, docs/design/SPIELTISCH.md §4.1b): the table's
 * background since prompt 53 - a quiet, continuous stone surface with warm
 * light above the opponent's strip and cool blue below the hand, after the
 * binding template (Dropzone workflow/OPENMANA-ARENA-VORLAGE.html, "G+").
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
 * has a size of its own (min-width/min-height 0; backgrounds and absolutely
 * positioned children only): it must never widen an `auto` track of the board
 * (the geometry contract, checked by the end-to-end test: every region and
 * card within 1 CSS px of the same scene over the drawn table).
 *
 * The seven parts of the template, and where they lie:
 *  1. the ground (prompt 53): stone, vignette, warm and cool light, grain, a
 *     few cracks - `ground`, over the whole board;
 *  2. the golden swings (prompt 54): a curve rising from the edges to the
 *     middle as the hand cell's background with a fainter twin and a warm
 *     glow below; its counterpart bending down in the opponent's cell;
 *  3. the centre line between the battlefields: 1 px of gold fading to the
 *     sides, a faint glow - the playing-area cell's ::before; no circle, no
 *     diamond, no emblem;
 *  4. ten small runes at the ends of the swings (six at the hand's, four at
 *     the opponent's), the glyphs of the drawn table's rune ring;
 *  5. two tendrils at the ends of the hand's swing (one drawing, mirrored);
 *  6. light dust: about seventy warm points, mostly at the edges, the middle
 *     free - one drawing over the whole board (`dust`, cover);
 *  7. the island of light: the playing area a shade brighter, without an
 *     edge, a shadow or a frame.
 * Nothing moves. The runes' and tendrils' glow is the only filter at runtime
 * (`--table-arena-glow`; set it to `none` and the arena must still stand) -
 * the grain tile's turbulence is rendered once as a background.
 */
import { memo, type CSSProperties } from "react"
import "./table.css"

/** The arena's pieces by their `data-arena`, in order, as table.css and the tests name them. */
export const ARENA_PIECES = ["ground", "opponent", "field", "hand", "dust"] as const

export type ArenaPiece = (typeof ARENA_PIECES)[number]

const SVG = "<svg xmlns='http://www.w3.org/2000/svg'"

/** An SVG drawing as a CSS url() value (the template's data: URLs; `#` as %23). */
const dataUrl = (svg: string) => `url("data:image/svg+xml;utf8,${svg.replace(/#/g, "%23")}")`

/**
 * The stone's grain: one tile of SVG noise (fractal turbulence tinted to a cool
 * grey-blue), repeated over the ground and blended with soft light - rendered
 * once by the browser as a background tile, never per state or per size.
 */
const GRAIN_TILE = 260

const GRAIN = dataUrl(
  `${SVG} width='${GRAIN_TILE}' height='${GRAIN_TILE}'>` +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/>" +
    "<feColorMatrix values='0 0 0 0 .55 0 0 0 0 .6 0 0 0 0 .7 0 0 0 .9 0'/></filter>" +
    "<rect width='100%' height='100%' filter='url(#n)'/></svg>",
)

/** A few fine cracks in the stone (five dark lines, three of them with a faint light edge), one tile repeated. */
const CRACKS_TILE = [900, 700] as const

const CRACKS = dataUrl(
  `${SVG} width='${CRACKS_TILE[0]}' height='${CRACKS_TILE[1]}' viewBox='0 0 ${CRACKS_TILE[0]} ${CRACKS_TILE[1]}'>` +
    "<g fill='none' stroke='#000' stroke-opacity='.55' stroke-width='1.2'>" +
    "<path d='M-20 140 L120 160 L190 230 L260 240'/><path d='M640 40 L700 120 L790 150 L920 140'/>" +
    "<path d='M80 560 L200 530 L260 600 L330 610'/><path d='M560 690 L650 620 L760 610 L880 660'/><path d='M400 300 L430 340 L470 345'/></g>" +
    "<g fill='none' stroke='#fff' stroke-opacity='.08' stroke-width='1.2'>" +
    "<path d='M-20 142 L120 162 L190 232 L260 242'/><path d='M640 42 L700 122 L790 152 L920 142'/><path d='M80 562 L200 532 L260 602 L330 612'/></g></svg>",
)

/**
 * The golden swings (prompt 54): drawn in a 1000 × 120 box and stretched to
 * the cell (`preserveAspectRatio='none'`: the line follows the cell's width
 * and height; the runes and tendrils do not). The hand's rises from the
 * edges to the middle with a fainter twin below; the opponent's bends down.
 */
const HAND_SWING = dataUrl(
  `${SVG} viewBox='0 0 1000 120' preserveAspectRatio='none'>` +
    "<path d='M0 118 C 180 112, 300 30, 500 28 C 700 30, 820 112, 1000 118' fill='none' stroke='#e2bd62' stroke-opacity='.75' stroke-width='1.6'/>" +
    "<path d='M0 120 C 180 116, 300 46, 500 44 C 700 46, 820 116, 1000 120' fill='none' stroke='#c9a24a' stroke-opacity='.35' stroke-width='1'/></svg>",
)

const OPPONENT_SWING = dataUrl(
  `${SVG} viewBox='0 0 1000 120' preserveAspectRatio='none'>` +
    "<path d='M0 2 C 180 8, 300 90, 500 92 C 700 90, 820 8, 1000 2' fill='none' stroke='#e2bd62' stroke-opacity='.65' stroke-width='1.6'/></svg>",
)

/**
 * The light dust (prompt 54): the template's seventy points - x, y in a
 * 1600 × 1000 box, radius 1.2-3.1, opacity 0.12-0.45 -, fixed, mostly at
 * the edges; one drawing over the whole board, cut to cover it (centred).
 * Six of them moved to the edges in prompt 55 (the template's 840/776,
 * 950/826, 937/812, 581/704, 966/743, 594/737): with the board 480 px wide
 * (and 360-412 px) the drawing's middle band covers it, and those lay behind
 * the hand's cards.
 */
const DUST_POINTS: readonly (readonly [number, number, number, number])[] = [
  [1508, 740, 1.3, 0.27], [1509, 649, 1.4, 0.27], [21, 217, 3.0, 0.37], [255, 797, 2.4, 0.16], [3, 871, 1.6, 0.44],
  [1396, 289, 2.3, 0.34], [328, 941, 3.1, 0.41], [478, 361, 1.5, 0.14], [482, 603, 2.6, 0.23], [496, 819, 1.8, 0.28],
  [1127, 57, 1.2, 0.37], [1352, 18, 1.9, 0.31], [15, 47, 3.1, 0.18], [1209, 930, 1.9, 0.24], [1540, 300, 2.7, 0.38],
  [1376, 37, 1.4, 0.23], [977, 918, 3.0, 0.3], [500, 317, 1.4, 0.17], [1103, 997, 1.3, 0.45], [60, 420, 2.0, 0.14],
  [1466, 33, 2.9, 0.16], [1171, 950, 2.8, 0.16], [1364, 976, 2.2, 0.36], [1536, 627, 1.9, 0.15], [520, 704, 2.2, 0.37],
  [1276, 348, 2.7, 0.39], [1101, 976, 2.2, 0.29], [266, 837, 2.2, 0.35], [1151, 730, 2.8, 0.31], [44, 160, 2.5, 0.19],
  [1098, 631, 2.1, 0.19], [87, 134, 1.6, 0.18], [57, 465, 2.4, 0.31], [381, 903, 2.0, 0.21], [598, 36, 1.4, 0.3],
  [1549, 609, 3.0, 0.12], [173, 566, 1.5, 0.33], [1426, 376, 1.7, 0.22], [1556, 380, 3.0, 0.32], [416, 981, 2.0, 0.23],
  [1575, 492, 2.2, 0.16], [1251, 827, 2.3, 0.21], [1496, 782, 1.7, 0.17], [1582, 293, 2.1, 0.33], [1100, 743, 2.7, 0.22],
  [1192, 591, 1.7, 0.27], [1467, 888, 1.2, 0.38], [314, 296, 1.3, 0.4], [1249, 911, 2.2, 0.3], [1560, 860, 1.7, 0.39],
  [1267, 664, 2.6, 0.44], [1597, 701, 2.9, 0.19], [1033, 952, 1.5, 0.22], [1469, 150, 2.0, 0.17], [996, 44, 2.0, 0.14],
  [92, 575, 3.0, 0.16], [783, 939, 1.3, 0.35], [242, 631, 3.0, 0.3], [407, 751, 1.5, 0.2], [520, 737, 2.6, 0.34],
  [136, 668, 1.4, 0.32], [382, 877, 1.8, 0.38], [47, 725, 1.5, 0.43], [1090, 223, 3.1, 0.34], [1313, 140, 1.9, 0.2],
  [1037, 805, 2.9, 0.29], [633, 97, 1.6, 0.13], [1, 470, 2.4, 0.26], [745, 100, 1.5, 0.24], [617, 880, 1.7, 0.21],
]

const DUST = dataUrl(
  `${SVG} viewBox='0 0 1600 1000' preserveAspectRatio='xMidYMid slice'>` +
    "<defs><radialGradient id='d'><stop offset='0' stop-color='#ffe3a0'/><stop offset='1' stop-color='#ffe3a0' stop-opacity='0'/></radialGradient></defs>" +
    DUST_POINTS.map(([x, y, r, opacity]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='url(#d)' opacity='${opacity}'/>`).join("") +
    "</svg>",
)

/** The ground's and the swings' drawings as CSS custom properties (table.css draws them). */
export const ARENA_STYLE = {
  "--table-arena-grain": GRAIN,
  "--table-arena-grain-size": `${GRAIN_TILE}px ${GRAIN_TILE}px`,
  "--table-arena-cracks": CRACKS,
  "--table-arena-cracks-size": `${CRACKS_TILE[0]}px ${CRACKS_TILE[1]}px`,
  "--table-arena-hand-swing": HAND_SWING,
  "--table-arena-opponent-swing": OPPONENT_SWING,
  "--table-arena-dust": DUST,
} as CSSProperties

/**
 * The rune glyphs (prompt 54): the same twelve paths the drawn table's rune
 * ring uses (surface-drawing.ts RUNES; copied, since that file goes with the
 * drawn table in prompt 56), each in a 10 × 14 box.
 */
export const ARENA_RUNES = [
  "M5 0V14M5 4 9 0M5 8 1 4", "M2 0V14M2 0 8 5 2 9", "M1 0V14M9 0V14M1 4 9 10", "M5 0V14M1 3 5 7 9 3",
  "M2 0V14M2 7H8M8 0V14", "M5 0 9 7 5 14 1 7Z", "M1 0 9 14M9 0 1 14", "M5 0V14M1 10 5 6 9 10",
  "M1 2H9M5 2V14M1 14H9", "M2 0V14M2 3 8 0M2 9 8 6", "M5 0V8M1 14 5 8 9 14", "M1 0V14M1 0 8 3 1 7 8 11",
] as const

/** A rune's place in its cell (percent of the cell's width and height) and its glyph. */
interface RunePlace {
  readonly left: number
  readonly top: number
  readonly glyph: number
}

/**
 * The four runes of the opponent's swing, 9 px wide. The template sets them at
 * its ends (12 %, 17 %, 81 %, 86 %), where the mock strip was empty; the real
 * strip carries its chips at the left and its zone piles at the right end at
 * every size (measured in prompt 54), so they sit on the swing's descent and
 * ascent between those groups and the medallion - and only where the strip is
 * wide enough for that gap whatever the game's state (table.css: not below
 * 48 rem; prompt 55 measured the chips of other scenes reaching them at
 * 609-672 px).
 */
const OPPONENT_RUNES: readonly RunePlace[] = [
  { left: 34, top: 48, glyph: 3 },
  { left: 39, top: 60, glyph: 7 },
  { left: 61, top: 60, glyph: 0 },
  { left: 66, top: 48, glyph: 8 },
]

/** The template's six runes at the ends of the hand's swing (three a side, climbing towards the middle), 10 px wide. */
const HAND_RUNES: readonly RunePlace[] = [
  { left: 9, top: 58, glyph: 0 },
  { left: 14, top: 44, glyph: 1 },
  { left: 19, top: 34, glyph: 3 },
  { left: 79, top: 34, glyph: 5 },
  { left: 84, top: 44, glyph: 7 },
  { left: 89, top: 58, glyph: 8 },
]

function Rune({ place, width }: { place: RunePlace; width: number }) {
  return (
    <svg data-arena-rune={place.glyph} className="table-arena-rune" viewBox="0 0 10 14" focusable="false" style={{ left: `${place.left}%`, top: `${place.top}%`, width }}>
      <path d={ARENA_RUNES[place.glyph]} />
    </svg>
  )
}

/** The tendril at an end of the hand's swing (the template's drawing: a stem and two leaves), mirrored on the right. */
function Tendril({ side }: { side: "left" | "right" }) {
  return (
    <svg data-arena-tendril={side} className="table-arena-tendril" viewBox="0 0 120 60" focusable="false">
      <path d="M2 58 C 20 52, 30 40, 42 36 C 56 31, 70 34, 80 26 C 88 20, 86 10, 78 8 C 70 6, 66 14, 72 18" />
      <path d="M42 36 C 36 28, 38 18, 48 14 C 44 22, 46 30, 52 34" />
      <path d="M62 32 C 70 40, 84 42, 96 36 C 88 36, 80 40, 76 46" />
      <path d="M100 34 C 108 30, 114 24, 118 16" />
    </svg>
  )
}

/**
 * The arena under the board. No props: it renders once per table and never
 * again for a new state; the board's grid places its cells.
 */
const ArenaSurface = memo(function ArenaSurface() {
  return (
    <div data-slot="table-surface" data-background="arena" aria-hidden="true" className="table-arena" style={ARENA_STYLE}>
      {/* The ground over the whole board: stone, vignette, warm light above, cool blue below, grain and cracks. */}
      <div data-arena="ground" className="table-arena-ground" />
      {/* The opponent's strip: the swing bending down, its warm glow, four runes at its ends. */}
      <div data-arena="opponent" className="table-arena-opponent">
        {OPPONENT_RUNES.map((place) => (
          <Rune key={`${place.left}-${place.top}`} place={place} width={9} />
        ))}
      </div>
      {/* The playing area (both battlefields with the centre line): the island of light and the centre line. */}
      <div data-arena="field" className="table-arena-field" />
      {/* The hand: the swing rising to the middle, its glow, two tendrils and six runes at its ends. */}
      <div data-arena="hand" className="table-arena-hand">
        <Tendril side="left" />
        <Tendril side="right" />
        {HAND_RUNES.map((place) => (
          <Rune key={`${place.left}-${place.top}`} place={place} width={10} />
        ))}
      </div>
      {/* The light dust over the whole board. */}
      <div data-arena="dust" className="table-arena-dust" />
    </div>
  )
})

export { ArenaSurface }
