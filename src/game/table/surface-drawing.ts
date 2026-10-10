/*
 * The table surface's drawing (prompt 37, docs/design/SPIELTISCH.md §4.1):
 * the wooden desk over the whole screen and the board set into it - after the
 * mockup's arkan.js ("Holztisch": arkan(), brett(), DEFS), recomputed for the
 * measured sizes so circles stay circles. Pure functions: from sizes to SVG
 * markup, nothing measured, nothing from the game. TableSurface
 * (table-surface.tsx) measures and puts the markup into the page - only when
 * a size changes.
 *
 * Three pieces, each an SVG of its own that is drawn only when its own size
 * changes: `deskMarkup` is the desk (wood grain, plank joints, vignette over
 * the whole screen) - it depends on the screen's size alone, so a region that
 * grows or shrinks never recomputes its full-screen grain; `boardMarkup` is
 * the board (frame, leather, circle, centre line, emblem, corner plates) for
 * the playing area's size; `ringMarkup` is the rune ring, drawn into its own
 * square so table.css can turn it and let it glimmer with transform and
 * opacity alone.
 *
 * Colours come from the --table-* tokens and the app's tokens (src/index.css);
 * depth is black or mixed from them. The expensive filters (feTurbulence for
 * the wood grain and the leather) lie only in this markup, i.e. they are
 * recomputed only when the markup is - at a new size.
 */

/** A rectangle in CSS pixels, relative to the surface (the game board's top left corner). */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The measured regions the playing area is made of (GameBoard's `data-area`s), relative to the surface. */
export interface PlayingRegions {
  readonly opponent: Box | null
  readonly opponentField: Box | null
  readonly field: Box | null
  readonly me: Box | null
}

/** Everything the drawing needs: the screen, the board and its circle. */
export interface SurfaceLayout {
  /** The surface (the whole game board, i.e. the screen while a game runs). */
  readonly width: number
  readonly height: number
  /** The board set into the desk. */
  readonly board: Box
  /** The circle's centre and radius, in surface coordinates. */
  readonly cx: number
  readonly cy: number
  readonly radius: number
  /** Width of the carved frame. */
  readonly frame: number
  /** The square the rune ring is drawn in (surface coordinates); null when the board is too small for a ring. */
  readonly ring: Box | null
}

/** Below this radius the circle's grooves would cross (R - 28 < 0.36 R) - the board then shows no circle. */
export const MIN_CIRCLE_RADIUS = 48
/** Margin of the board to the screen's left and right edge and to the playing area's top and bottom (the mockup's). */
const SIDE_MARGIN = 6
const END_MARGIN = 2
/** Room around the rune ring's glyphs for their glow. */
const RING_PAD = 12

const f = (n: number) => n.toFixed(1)

function usable(box: Box | null): box is Box {
  return box !== null && box.width > 0 && box.height > 0
}

/** The playing area: the board's rectangle and where the line between the two battlefields lies. */
export interface PlayingArea extends Box {
  /** The middle between the battlefields (surface coordinates; the centre line, prompt 38) - null without both. */
  readonly middle: number | null
}

/**
 * The playing area (SPIELTISCH.md §4.1): the battlefields' column, from the
 * opponent's strip to yours. Horizontally it is the battlefields' extent;
 * a strip counts vertically only where it stands in that column (it overlaps
 * at least half its width) - so where the strips stand beside the
 * battlefields (breit in a low window) the board spans the battlefields
 * alone. Its middle is the middle of the gap between the battlefields (the
 * grid's centre line row, or the stack bar in hoch), so the centre line lies
 * there even when the strips are not equally high. Null without a
 * battlefield on screen.
 */
export function playingArea(regions: PlayingRegions): PlayingArea | null {
  const fields = [regions.opponentField, regions.field].filter(usable)
  if (fields.length === 0) return null
  const left = Math.min(...fields.map((box) => box.x))
  const right = Math.max(...fields.map((box) => box.x + box.width))
  let top = Math.min(...fields.map((box) => box.y))
  let bottom = Math.max(...fields.map((box) => box.y + box.height))
  for (const strip of [regions.opponent, regions.me].filter(usable)) {
    const overlap = Math.min(right, strip.x + strip.width) - Math.max(left, strip.x)
    if (overlap < (right - left) / 2) continue
    top = Math.min(top, strip.y)
    bottom = Math.max(bottom, strip.y + strip.height)
  }
  const upper = regions.opponentField
  const lower = regions.field
  const middle = usable(upper) && usable(lower) && upper.y + upper.height <= lower.y + 1 ? (upper.y + upper.height + lower.y) / 2 : null
  return { x: left, y: top, width: right - left, height: bottom - top, middle }
}

/**
 * The board in the screen (as the mockup's arkan(): 6 px from the screen's
 * sides, 2 px inside the playing area's ends) and its circle (as brett()):
 * centred on the line between the battlefields (the area's middle, kept to
 * the board's middle half) and as large as the board allows on both sides of
 * it - on a board whose middle is its centre, min(46 % of the width, 44 % of
 * the height). Whole pixels, so equal sizes give equal layouts.
 */
export function surfaceLayout(width: number, height: number, area: Box & { readonly middle?: number | null }): SurfaceLayout | null {
  const W = Math.round(width)
  const H = Math.round(height)
  const left = Math.round(Math.max(area.x, SIDE_MARGIN))
  const right = Math.round(Math.min(area.x + area.width, W - SIDE_MARGIN))
  const top = Math.round(Math.max(area.y + END_MARGIN, 0))
  const bottom = Math.round(Math.min(area.y + area.height - END_MARGIN, H))
  if (W <= 0 || H <= 0 || right - left < 40 || bottom - top < 40) return null
  const board = { x: left, y: top, width: right - left, height: bottom - top }
  const frame = Math.max(10, Math.min(18, Math.min(board.width, board.height) * 0.022))
  const cx = board.x + board.width / 2
  const centre = board.y + board.height / 2
  const cy = area.middle === undefined || area.middle === null ? centre : Math.min(board.y + board.height * 0.75, Math.max(board.y + board.height * 0.25, Math.round(area.middle)))
  const radius = Math.min(board.width * 0.46, Math.min(cy - board.y, board.y + board.height - cy) * 0.88)
  const side = Math.ceil(2 * (radius + RING_PAD))
  const ring = radius >= MIN_CIRCLE_RADIUS ? { x: cx - side / 2, y: cy - side / 2, width: side, height: side } : null
  return { width: W, height: H, board, cx, cy, radius, frame, ring }
}

/** The key of the desk: the screen's size alone (TableSurface redraws the desk only when it changes). */
export function deskKey(layout: SurfaceLayout): string {
  return `${layout.width} ${layout.height}`
}

/** The key of a whole layout (desk and board): equal keys draw the same picture (TableSurface draws only when it changes). */
export function layoutKey(layout: SurfaceLayout): string {
  const { width, height, board, cy } = layout
  return [width, height, board.x, board.y, board.width, board.height, cy].join(" ")
}

// ── Paint ────────────────────────────────────────────────────────────────

/** A colour mixed from a token with black (depth) - never a new colour meaning. */
const darker = (token: string, black: number) => `color-mix(in oklch, var(${token}), black ${black}%)`
const lighter = (token: string, white: number) => `color-mix(in oklch, var(${token}), white ${white}%)`

const GOLD = "var(--primary)"
const stop = (offset: number | string, color: string, opacity = 1) =>
  `<stop offset="${offset}" style="stop-color:${color}${opacity === 1 ? "" : `;stop-opacity:${opacity}`}"/>`

/** Own rune glyphs (10 × 14), no real script (the mockup's). */
const RUNES = [
  "M5 0V14M5 4 9 0M5 8 1 4", "M2 0V14M2 0 8 5 2 9", "M1 0V14M9 0V14M1 4 9 10", "M5 0V14M1 3 5 7 9 3",
  "M2 0V14M2 7H8M8 0V14", "M5 0 9 7 5 14 1 7Z", "M1 0 9 14M9 0 1 14", "M5 0V14M1 10 5 6 9 10",
  "M1 2H9M5 2V14M1 14H9", "M2 0V14M2 3 8 0M2 9 8 6", "M5 0V8M1 14 5 8 9 14", "M1 0V14M1 0 8 3 1 7 8 11",
] as const

/**
 * Filters and gradients (the mockup's DEFS). The grain filters take their
 * colour from the tokens (feFlood) and their pattern from a fixed seed: the
 * same wood and leather on every draw. The mockup's colour matrices work in
 * the filters' linear colour space, so their grain is lighter than its
 * numbers read: a light wood tone (frame mixed with light gold) and the light
 * text tone match it.
 */
const grain = (id: string, name: string, frequency: string, octaves: number, seed: number, alpha: string, tone: string) => `
    <filter id="${id}-${name}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="${octaves}" seed="${seed}"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${alpha}" result="grain"/>
      <feFlood style="flood-color:${tone}" result="tone"/>
      <feComposite in="tone" in2="grain" operator="in"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>`
const woodGrain = (id: string) => grain(id, "wood", ".002 .035", 4, 11, "0 0 0 .9 -.25", "color-mix(in oklch, var(--table-wood-frame), var(--table-gold-light) 50%)")

/** The desk's filter and vignette. */
function deskDefs(id: string): string {
  return `
    ${woodGrain(id)}
    <radialGradient id="${id}-vignette" cx=".5" cy=".5" r=".75">${stop(0.55, "black", 0)}${stop(1, "black", 0.7)}</radialGradient>`
}

/** The board's filters and gradients (its frame has the desk's grain too, in an SVG of its own). */
function boardDefs(id: string): string {
  return `
    ${woodGrain(id)}
    ${grain(id, "leather", ".75", 2, 4, "0 0 0 .14 0", "var(--foreground)")}
    <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
    <linearGradient id="${id}-brass" x1="0" y1="0" x2="1" y2="1">${stop(0, "var(--table-gold-light)")}${stop(0.35, "color-mix(in oklch, var(--primary), var(--table-gold-dark) 40%)")}${stop(0.7, darker("--table-gold-dark", 25))}${stop(1, GOLD)}</linearGradient>
    <linearGradient id="${id}-inlay" x1="0" y1="0" x2="1" y2="1">${stop(0, "var(--table-gold-light)")}${stop(0.5, "color-mix(in oklch, var(--primary), var(--table-gold-dark) 45%)")}${stop(1, GOLD)}</linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1">${stop(0, "var(--table-gold-light)")}${stop(0.45, GOLD)}${stop(1, "var(--table-gold-dark)")}</linearGradient>
    <linearGradient id="${id}-frame" x1="0" y1="0" x2="0" y2="1">${stop(0, "var(--table-wood-frame)")}${stop(0.5, darker("--table-wood-frame", 45))}${stop(1, darker("--table-wood-frame", 20))}</linearGradient>
    <linearGradient id="${id}-centre-line" x1="0" y1="0" x2="1" y2="0">${stop(0, GOLD, 0)}${stop(0.5, GOLD)}${stop(1, GOLD, 0)}</linearGradient>
    <radialGradient id="${id}-leather-light" cx=".5" cy=".5" r=".75">${stop(0, "var(--table-leather)")}${stop(0.65, darker("--table-leather", 38))}${stop(1, darker("--table-leather", 65))}</radialGradient>
    <radialGradient id="${id}-circle-light">${stop(0, "var(--table-mana)", 0.16)}${stop(0.7, "var(--table-mana)", 0.04)}${stop(1, "var(--table-mana)", 0)}</radialGradient>`
}

/** A gold groove around (cx, cy): a dark cut and the inlay in it - real circles, so they stay round at every size. */
function groove(cx: number, cy: number, r: number, width: number, attributes = ""): string {
  const at = `cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none"`
  return `<circle ${at} style="stroke:black" stroke-opacity=".7" stroke-width="${width + 2.6}"${attributes}/><circle ${at} stroke="url(#ID-inlay)" stroke-width="${width}"/>`
}

/** The OpenMana emblem (the mockup's #emblem: an eight-pointed star in a ring), `size` wide, centred on (cx, cy). */
function emblem(cx: number, cy: number, size: number): string {
  const s = size / 100
  return `<g transform="translate(${f(cx - size / 2)} ${f(cy - size / 2)}) scale(${s.toFixed(4)})">
      <circle cx="50" cy="50" r="44" fill="none" stroke="url(#ID-gold)" stroke-width="3"/>
      <circle cx="50" cy="50" r="38" fill="none" stroke="url(#ID-gold)" stroke-width="1" stroke-dasharray="1.5 3.2"/>
      <path d="M50 4 57 43 96 50 57 57 50 96 43 57 4 50 43 43Z" fill="url(#ID-gold)"/>
      <path d="M50 22 54 46 78 50 54 54 50 78 46 54 22 50 46 46Z" style="fill:var(--background)" opacity=".55" transform="rotate(45 50 50)"/>
      <circle cx="50" cy="50" r="6" style="fill:var(--background)" stroke="url(#ID-gold)" stroke-width="2"/>
    </g>`
}

/** The board (the mockup's brett()), in board coordinates: frame, leather, circle, centre line, corner plates. */
function board(layout: SurfaceLayout): string {
  const { width: w, height: h } = layout.board
  const rand = layout.frame
  const cx = w / 2
  // The line between the battlefields (surfaceLayout), in board coordinates.
  const cy = layout.cy - layout.board.y
  const R = layout.radius
  const inner = { x: rand, y: rand, width: w - 2 * rand, height: h - 2 * rand }
  // Brass corner plates, mirrored into the four corners.
  const e = rand * 3.4
  const rivet = darker("--table-wood", 30)
  const plate = `<path d="M0 0H${f(e)}L${f(e - rand * 0.7)} ${f(rand * 0.9)}H${f(rand * 0.9)}V${f(e - rand * 0.7)}L0 ${f(e)}Z" fill="url(#ID-brass)" style="stroke:${rivet}" stroke-width="1"/>
      <path d="M${f(rand * 0.5)} ${f(rand * 0.5)}L${f(e * 0.7)} ${f(rand * 0.5)}M${f(rand * 0.5)} ${f(rand * 0.5)}L${f(rand * 0.5)} ${f(e * 0.7)}" style="stroke:${rivet}" stroke-width=".8" opacity=".6"/>
      <circle cx="${f(rand * 0.45)}" cy="${f(rand * 0.45)}" r="${f(rand * 0.16)}" style="fill:${rivet}"/>
      <circle cx="${f(e * 0.72)}" cy="${f(rand * 0.45)}" r="${f(rand * 0.12)}" style="fill:${rivet}"/><circle cx="${f(rand * 0.45)}" cy="${f(e * 0.72)}" r="${f(rand * 0.12)}" style="fill:${rivet}"/>`
  const corners = ([[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]] as const)
    .map(([x, y, sx, sy]) => `<g transform="translate(${f(x)} ${f(y)}) scale(${sx} ${sy})">${plate}</g>`)
    .join("")
  // The circle: grooves, 16 spokes, a 16-pointed star - only where the board has room for it.
  let circleParts = ""
  if (R >= MIN_CIRCLE_RADIUS) {
    let spokes = ""
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      spokes += `M${f(cx + Math.cos(a) * R * 0.36)} ${f(cy + Math.sin(a) * R * 0.36)}L${f(cx + Math.cos(a) * (R - 28))} ${f(cy + Math.sin(a) * (R - 28))}`
    }
    let star = ""
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? R * 0.12 : R * 0.33
      const a = ((-90 + i * 22.5) * Math.PI) / 180
      star += `${i ? "L" : "M"}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`
    }
    circleParts = `
      <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 1.05)}" fill="url(#ID-circle-light)"/>
      <g opacity=".75">
        ${groove(cx, cy, R, 2, ' data-surface="circle"')}${groove(cx, cy, R - 28, 1.1)}${groove(cx, cy, R * 0.36, 1.1)}
        <path d="${spokes}" style="stroke:${GOLD}" stroke-opacity=".22" stroke-width=".8"/>
        <path d="${star}Z" fill="none" style="stroke:${GOLD}" stroke-opacity=".4" stroke-width="1"/>
      </g>`
  }
  // The centre line: from the frame to the circle with a diamond at each end, and towards the emblem inside it.
  const outerEnd = R >= MIN_CIRCLE_RADIUS ? R + 6 : 0
  const size = Math.max(22, Math.min(40, Math.min(w, h) * 0.07))
  const innerStart = R >= MIN_CIRCLE_RADIUS ? R - 6 : Math.max(0, cx - inner.x - 18)
  const centre = `
      <g opacity=".75">
        ${outerEnd > 0 ? `<path d="M${f(inner.x + 18)} ${f(cy)}H${f(cx - outerEnd)}M${f(cx + outerEnd)} ${f(cy)}H${f(w - inner.x - 18)}" style="stroke:${GOLD}" stroke-opacity=".45" stroke-width="1"/>` : ""}
        <path d="M${f(inner.x + 18)} ${f(cy)}l5 -4 5 4 -5 4Z M${f(w - inner.x - 18)} ${f(cy)}l-5 -4 -5 4 5 4Z" style="fill:${GOLD}" opacity=".8"/>
      </g>
      <path d="M${f(cx - innerStart)} ${f(cy)}H${f(cx - size * 0.8)}M${f(cx + size * 0.8)} ${f(cy)}H${f(cx + innerStart)}" stroke="url(#ID-centre-line)" stroke-width="1" opacity=".55"/>
      <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(size * 0.55)}" style="fill:var(--table-mana)" opacity=".45" filter="url(#ID-glow)"/>
      ${emblem(cx, cy, size)}`
  return `
      <rect x="-4" y="6" width="${f(w + 8)}" height="${f(h)}" rx="22" style="fill:black" opacity=".7" filter="url(#ID-shadow)"/>
      <rect width="${f(w)}" height="${f(h)}" rx="20" fill="url(#ID-frame)" style="stroke:${darker("--table-wood", 60)}" stroke-width="2"/>
      <rect width="${f(w)}" height="${f(h)}" rx="20" style="fill:black" filter="url(#ID-wood)" opacity=".7"/>
      <rect x="${f(rand * 0.45)}" y="${f(rand * 0.45)}" width="${f(w - rand * 0.9)}" height="${f(h - rand * 0.9)}" rx="16" fill="none" stroke="url(#ID-inlay)" stroke-width="1.3" opacity=".75"/>
      <rect x="${f(inner.x)}" y="${f(inner.y)}" width="${f(inner.width)}" height="${f(inner.height)}" rx="12" fill="url(#ID-leather-light)" style="stroke:${darker("--table-leather", 80)}" stroke-width="3"/>
      <rect x="${f(inner.x)}" y="${f(inner.y)}" width="${f(inner.width)}" height="${f(inner.height)}" rx="12" style="fill:black" filter="url(#ID-leather)"/>
      <rect x="${f(inner.x + 7)}" y="${f(inner.y + 7)}" width="${f(inner.width - 14)}" height="${f(inner.height - 14)}" rx="8" fill="none" style="stroke:${GOLD}" stroke-opacity=".28" stroke-width="1"/>
      <rect x="${f(inner.x)}" y="${f(inner.y)}" width="${f(inner.width)}" height="${f(inner.height)}" rx="12" fill="none" style="stroke:black" stroke-opacity=".5" stroke-width="6" filter="url(#ID-soft)"/>
      ${circleParts}
      ${centre}
      ${corners}`
}

/**
 * The desk, for an SVG whose viewBox is the surface (`0 0 width height`,
 * drawn 1:1): wood grain, plank joints and vignette over the whole screen.
 * It depends on the screen's size alone (`deskKey`). `id` makes the filters'
 * and gradients' ids unique on the page.
 */
export function deskMarkup(layout: SurfaceLayout, id: string): string {
  const { width: W, height: H } = layout
  let planks = ""
  for (let k = 0; k < Math.ceil(H / 150); k++) {
    planks += `<path d="M0 ${f(k * 150 + 70)}H${W}" style="stroke:${darker("--table-wood", 60)}" stroke-width="2" opacity=".45"/><path d="M0 ${f(k * 150 + 72)}H${W}" style="stroke:${lighter("--table-wood-frame", 12)}" stroke-width=".6" opacity=".25"/>`
  }
  return `<defs>${deskDefs(id)}</defs>
      <rect width="${W}" height="${H}" style="fill:var(--table-wood)"/>
      <rect width="${W}" height="${H}" style="fill:black" filter="url(#ID-wood)"/>
      ${planks}
      <rect width="${W}" height="${H}" fill="url(#ID-vignette)"/>`.replaceAll("#ID-", `#${id}-`)
}

/**
 * The board set into the desk, for an SVG whose viewBox is the board
 * (`0 0 board.width board.height`, placed at the board's corner, drawn 1:1;
 * its shadow reaches out of it): frame, brass, leather, circle, centre line,
 * emblem and corner plates. Drawn again only when the board's size or place
 * changes (`layoutKey`).
 */
export function boardMarkup(layout: SurfaceLayout, id: string): string {
  return `<defs>${boardDefs(id)}</defs>${board(layout)}`.replaceAll("#ID-", `#${id}-`)
}

/**
 * The rune ring for an SVG whose viewBox is the ring's square
 * (`0 0 side side`): the mockup's glyphs around the circle, glowing gold.
 * Empty without a ring (a board too small for the circle).
 */
export function ringMarkup(layout: SurfaceLayout, id: string): string {
  if (layout.ring === null) return ""
  const side = layout.ring.width
  const c = side / 2
  const r = layout.radius - 14
  const count = Math.floor((2 * Math.PI * r) / 24)
  const s = 11 / 14
  let runes = ""
  for (let i = 0; i < count; i++) {
    runes += `<path d="${RUNES[(i * 5) % RUNES.length]}" transform="rotate(${f((i / count) * 360)} ${f(c)} ${f(c)}) translate(${f(c - 5 * s)} ${f(c - r - 7 * s)}) scale(${s.toFixed(3)})" vector-effect="non-scaling-stroke"/>`
  }
  return `<defs><filter id="${id}-rune-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g fill="none" style="stroke:var(--table-gold-light)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-rune-glow)">${runes}</g>`
}
