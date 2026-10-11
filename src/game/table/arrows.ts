/*
 * The arrows over the table (prompt 43, docs/design/SPIELTISCH.md §4.15; the
 * mockup's pfeil()): what points at what - only geometry and Forge's facts,
 * nothing derived.
 *
 *  - Which arrows (arrowRelations): from Forge's structured state alone.
 *    Target arrows from each entry of the stack (its Zauberchronik entry) to
 *    each of its targets (`StackItem.targets`: a card or a player), strong
 *    for the top entry, muted for the others; attack arrows from each
 *    attacker to whom it attacks (`GameState.combat`: a player, a
 *    planeswalker or battle - Forge reports declared attackers there while
 *    they are still being declared, and its planned blockers while blockers
 *    are); block arrows from each blocker to its attacker. Nothing about who
 *    could attack or block, no attack arrow before a creature attacks (the
 *    declaration's current defender is no relation yet).
 *  - Where (layoutArrows): the boxes the page measured. An arrow leaves the
 *    side of its start that faces its end and ends **beside** its end - left,
 *    right, above or below its card or medallion, the head a few pixels off
 *    it and pointing straight at it -, never on a picture: of all places
 *    around the end it takes the one whose head covers no card picture (and
 *    the fewest chips), faces the start best and is free of other arrows'
 *    heads. A cubic curve that arrives at a right angle, so the head stays
 *    outside the box; several arrows of a kind bend alternately and a little
 *    more each, so they do not lie on each other.
 *  - Out of sight: an arrow is drawn only between two things the player sees.
 *    A target in a graveyard or exile points at that pile on its player's
 *    strip; a card scrolled out of its row (or a chronicle entry out of its
 *    bar) gets no arrow until it is scrolled into view - the chronicle's
 *    words and the card's "Ziel" chip still say it.
 *
 * The arrows are pure presentation: aria-hidden, no pointer events
 * (table-arrows.tsx); the facts are in words in the chronicle, the combat
 * lines and the chips.
 */
import type { GameState } from "@openmana/engine-protocol"
import { locateCard, type Seat } from "../table-model"

export type ArrowKind = "target" | "attack" | "block"

/** One end of an arrow: a stack entry (its chronicle entry), a card or a player (their medallion). */
export type ArrowEnd = { readonly kind: "stack"; readonly id: number } | { readonly kind: "card"; readonly id: number } | { readonly kind: "player"; readonly id: number }

/** The zones whose cards the strip shows as a pile: a target there points at the pile. */
export type PileZone = "graveyard" | "exile"

export interface ArrowRelation {
  /** Stable while the relation lasts: kind, start and end. */
  readonly key: string
  readonly kind: ArrowKind
  readonly from: ArrowEnd
  readonly to: ArrowEnd
  /** Drawn strongly (glowing, flowing); the targets of stack entries below the top are muted. */
  readonly strong: boolean
  /** The card target lies in a graveyard or exile: the arrow points at that pile of this seat. */
  readonly pile?: { readonly seat: Seat; readonly zone: PileZone }
}

export function endKey(end: ArrowEnd): string {
  return `${end.kind}:${end.id}`
}

/**
 * The arrows of one state, from Forge's structured values only: targets of
 * every stack entry (top first; the top one strong), attackers to their
 * defenders, blockers to their attackers - in Forge's order.
 */
export function arrowRelations(state: GameState): ArrowRelation[] {
  const relations: ArrowRelation[] = []
  const seen = new Set<string>()
  const add = (relation: Omit<ArrowRelation, "key">) => {
    const key = `${relation.kind}:${endKey(relation.from)}>${endKey(relation.to)}`
    if (seen.has(key)) return
    seen.add(key)
    relations.push({ key, ...relation })
  }
  state.stack.forEach((item, index) => {
    for (const target of item.targets) {
      const to: ArrowEnd = { kind: target.kind, id: target.id }
      let pile: ArrowRelation["pile"]
      if (target.kind === "card") {
        const found = locateCard(state, target.id)
        if (found !== null && (found.zone === "graveyard" || found.zone === "exile")) pile = { seat: found.seat, zone: found.zone }
      }
      add({ kind: "target", from: { kind: "stack", id: item.id }, to, strong: index === 0, ...(pile !== undefined ? { pile } : {}) })
    }
  })
  for (const entry of state.combat) {
    if (entry.defender !== null && entry.defenderKind !== null) add({ kind: "attack", from: { kind: "card", id: entry.attacker }, to: { kind: entry.defenderKind, id: entry.defender }, strong: true })
  }
  for (const entry of state.combat) {
    for (const blocker of entry.blockers) add({ kind: "block", from: { kind: "card", id: blocker }, to: { kind: "card", id: entry.attacker }, strong: true })
  }
  return relations
}

// ── Geometry (board coordinates, px) ──

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** What the page measured for one relation: the visible boxes of its start and end (null: out of sight - no arrow). */
export interface MeasuredRelation {
  readonly relation: ArrowRelation
  readonly from: Rect | null
  readonly to: Rect | null
}

/** What an arrow's head must not cover: card pictures (never) and chips (rather not); the board it stays inside. */
export interface ArrowObstacles {
  readonly bounds: Rect
  readonly pictures: readonly Rect[]
  readonly chips: readonly Rect[]
}

export type ArrowSide = "left" | "right" | "top" | "bottom"

export interface ArrowGeometry {
  readonly relation: ArrowRelation
  /** Where the line leaves its start. */
  readonly start: Point
  /** The head's tip: beside the end's box, pointing at it. */
  readonly tip: Point
  /** The side of the end's box the head points at. */
  readonly side: ArrowSide
  /** The cubic curve's control points; the line ends at the head's base. */
  readonly c1: Point
  readonly c2: Point
  readonly lineEnd: Point
  /** The head: tip, then the two corners of its base. */
  readonly head: readonly [Point, Point, Point]
}

/** The head of a strong and of a muted arrow (px): length along the line, width across it. */
export const HEAD = { strong: { length: 12, width: 11 }, muted: { length: 9, width: 8 } } as const
/** How far the head's tip stays off the box it points at (px). */
export const TIP_GAP = 3
/** Where along a side the head may sit (0 = its start, 1 = its end). */
const SIDE_PLACES = [0.5, 0.3, 0.7, 0.12, 0.88] as const

const SIDES: readonly { readonly side: ArrowSide; readonly normal: Point }[] = [
  { side: "left", normal: { x: -1, y: 0 } },
  { side: "right", normal: { x: 1, y: 0 } },
  { side: "top", normal: { x: 0, y: -1 } },
  { side: "bottom", normal: { x: 0, y: 1 } },
]

const width = (rect: Rect) => rect.right - rect.left
const height = (rect: Rect) => rect.bottom - rect.top
const centre = (rect: Rect): Point => ({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 })
const add = (a: Point, b: Point, scale = 1): Point => ({ x: a.x + b.x * scale, y: a.y + b.y * scale })
const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)
const unit = (a: Point, b: Point): Point => {
  const d = length(a, b)
  return d === 0 ? { x: 0, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d }
}

/** The area two rectangles share (0 when they do not meet). */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/** The intersection of two rectangles, or null when they do not meet. */
export function intersect(a: Rect, b: Rect): Rect | null {
  const r = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) }
  return r.right > r.left && r.bottom > r.top ? r : null
}

export function boundsOf(points: readonly Point[]): Rect {
  return {
    left: Math.min(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    right: Math.max(...points.map((p) => p.x)),
    bottom: Math.max(...points.map((p) => p.y)),
  }
}

/** The head with its tip at `tip`, its base `size.length` back along `back` (a unit vector pointing away from the end). */
export function headAt(tip: Point, back: Point, size: { readonly length: number; readonly width: number }): [Point, Point, Point] {
  const base = add(tip, back, size.length)
  const across = { x: -back.y, y: back.x }
  return [tip, add(base, across, size.width / 2), add(base, across, -size.width / 2)]
}

/** Whether a point lies inside a rectangle. */
export function inside(point: Point, rect: Rect): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

interface EndPlace {
  readonly side: ArrowSide
  readonly normal: Point
  readonly tip: Point
  readonly head: [Point, Point, Point]
  readonly score: number
}

/**
 * The best place for an arrow's head beside `box`, coming from `from`: the
 * sides of the box at three places each; a head on a card picture costs most,
 * then one outside the board, one on a chip, one on another head, a side
 * that turns away from the start, a place off the side's middle.
 */
function endPlace(box: Rect, from: Point, size: { readonly length: number; readonly width: number }, obstacles: ArrowObstacles, heads: readonly Rect[]): EndPlace {
  let best: EndPlace | null = null
  for (const { side, normal } of SIDES) {
    for (const place of SIDE_PLACES) {
      const onSide =
        side === "left" || side === "right"
          ? { x: side === "left" ? box.left : box.right, y: box.top + height(box) * place }
          : { x: box.left + width(box) * place, y: side === "top" ? box.top : box.bottom }
      const tip = add(onSide, normal, TIP_GAP)
      const head = headAt(tip, normal, size)
      const headBox = boundsOf(head)
      const facing = unit(tip, from)
      let score = (1 - (facing.x * normal.x + facing.y * normal.y)) * 40 + Math.abs(place - 0.5) * 20
      if (headBox.left < obstacles.bounds.left || headBox.top < obstacles.bounds.top || headBox.right > obstacles.bounds.right || headBox.bottom > obstacles.bounds.bottom) score += 1e6
      for (const picture of obstacles.pictures) score += overlapArea(headBox, picture) * 100
      for (const chip of obstacles.chips) score += overlapArea(headBox, chip) * 2
      for (const other of heads) score += overlapArea(headBox, other) * 20
      if (best === null || score < best.score) best = { side, normal, tip, head, score }
    }
  }
  return best!
}

/** Where a line from inside `box` towards `to` leaves the box, and the normal of that side. */
function exitPoint(box: Rect, to: Point): { readonly point: Point; readonly normal: Point } {
  const c = centre(box)
  const dx = to.x - c.x
  const dy = to.y - c.y
  const halfW = width(box) / 2
  const halfH = height(box) / 2
  // The side the ray crosses first: compare the ray's slope with the box's.
  if (Math.abs(dx) * halfH >= Math.abs(dy) * halfW) {
    const sx = Math.sign(dx) || 1
    const t = halfW / Math.max(Math.abs(dx), 1e-6)
    return { point: { x: c.x + sx * halfW, y: c.y + dy * Math.min(t, 1) }, normal: { x: sx, y: 0 } }
  }
  const sy = Math.sign(dy) || 1
  const t = halfH / Math.max(Math.abs(dy), 1e-6)
  return { point: { x: c.x + dx * Math.min(t, 1), y: c.y + sy * halfH }, normal: { x: 0, y: sy } }
}

/** How far the curve's control points reach out of the start and the end (px). */
function reach(distance: number): number {
  return Math.min(160, Math.max(18, distance * 0.38))
}

/**
 * The arrows for the measured relations, in the order given (each head avoids
 * the heads placed before it). Relations without a visible start or end are
 * left out.
 */
export function layoutArrows(measured: readonly MeasuredRelation[], obstacles: ArrowObstacles): ArrowGeometry[] {
  const arrows: ArrowGeometry[] = []
  const heads: Rect[] = []
  const counts = new Map<ArrowKind, number>()
  for (const { relation, from, to } of measured) {
    if (from === null || to === null) continue
    const size = relation.strong ? HEAD.strong : HEAD.muted
    const end = endPlace(to, centre(from), size, obstacles, heads)
    const exit = exitPoint(from, end.tip)
    const start = add(exit.point, exit.normal, 2)
    const lineEnd = add(end.tip, end.normal, size.length * 0.6)
    const distance = length(start, lineEnd)
    const k = reach(distance)
    // Several arrows of a kind bend alternately and a little more each (the mockup's bogen), sideways to the line.
    const index = counts.get(relation.kind) ?? 0
    counts.set(relation.kind, index + 1)
    // The first bends towards the board's middle (so the curve stays on the table), the next to the other side, and so on.
    const direction = unit(start, lineEnd)
    const across = { x: -direction.y, y: direction.x }
    const middle = centre(obstacles.bounds)
    const towards = Math.sign(across.x * (middle.x - (start.x + lineEnd.x) / 2) + across.y * (middle.y - (start.y + lineEnd.y) / 2)) || 1
    const bend = towards * (index % 2 === 0 ? 1 : -1) * Math.min(80, distance * (0.1 + 0.05 * Math.floor(index / 2)))
    const c1 = add(add(start, exit.normal, k), across, bend)
    // The end's control point lies straight out of the side: the curve arrives at a right angle, its head outside the box.
    const c2 = add(lineEnd, end.normal, k)
    arrows.push({ relation, start, tip: end.tip, side: end.side, c1, c2, lineEnd, head: end.head })
    heads.push(boundsOf(end.head))
  }
  return arrows
}

const n = (value: number) => Math.round(value * 10) / 10

/** The SVG path of an arrow's line (start to the head's base). */
export function linePath(arrow: ArrowGeometry): string {
  const { start, c1, c2, lineEnd } = arrow
  return `M${n(start.x)} ${n(start.y)}C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(lineEnd.x)} ${n(lineEnd.y)}`
}

/** The SVG path of an arrow's head. */
export function headPath(arrow: ArrowGeometry): string {
  const [tip, a, b] = arrow.head
  return `M${n(tip.x)} ${n(tip.y)}L${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}Z`
}

/** Everything an arrow covers (line, control points, head), to size the layers. */
export function arrowBounds(arrows: readonly ArrowGeometry[]): Rect | null {
  if (arrows.length === 0) return null
  return boundsOf(arrows.flatMap((arrow) => [arrow.start, arrow.c1, arrow.c2, arrow.lineEnd, ...arrow.head]))
}
