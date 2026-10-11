/*
 * The arrows over the table (prompt 43, docs/design/SPIELTISCH.md §4.15; the
 * mockup's .pfeile and pfeil()): red from a Zauberchronik entry to each of its
 * targets, amber from an attacker to whom it attacks, mana blue from a blocker
 * to its attacker (arrows.ts decides which and where).
 *
 * Decoration over the board: hidden from screen readers (the chronicle, the
 * combat lines and the chips say the same in words), no pointer events - a
 * click or tap always reaches what lies under an arrow. It knows the state
 * only to know the relations; everything else it measures in the page:
 *
 *  - Drawn again for a new state, a new size of the board or a region (the
 *    decision opening or closing, a resize - ResizeObserver), a row or a
 *    region scrolled (a scroll listener in the capture phase), the end of
 *    a transition (a card lifted) and the end of the table's motion (prompt
 *    44: cards travelling, an attacker moving forward - while it runs the
 *    arrows wait) - every cause batched into one drawing per animation
 *    frame, which reads the boxes once. Nothing is measured while there is
 *    no arrow.
 *  - Layers, each its own SVG sized to the arrows: the muted arrows (still),
 *    the strong arrows' glow (it pulses in opacity), their dashed line in
 *    three phases a third of a dash apart (they take turns in opacity, so the
 *    dashes seem to flow from start to end - table.css; only transform and
 *    opacity move, §8) and the heads (still, on top). Under less motion
 *    nothing moves: the first phase stands, the glow stays.
 *
 * The anchors of the end-to-end test: the wrapper `data-slot="table-arrows"`
 * with `data-arrows` (how many are drawn), each head a `g[data-arrow]` with
 * the kind, `data-from`/`data-to` (`stack:N`, `card:N`, `player:N`, a pile
 * `pile:<seat>:<zone>`), `data-strong` and `data-end` (the tip, board
 * coordinates).
 */
import { memo, useLayoutEffect, useMemo, useRef } from "react"
import type { GameState } from "@openmana/engine-protocol"
import { MOTION_END_EVENT } from "./table-motion"
import { arrowBounds, arrowRelations, endKey, headPath, intersect, layoutArrows, linePath, type ArrowGeometry, type ArrowObstacles, type ArrowRelation, type MeasuredRelation, type Rect } from "./arrows"

/** The name of the User Timing measure of one drawing (read by the end-to-end test's cost measurement). */
export const ARROWS_DRAW_MEASURE = "openmana:table-arrows"

/** Smaller than this (px, either way) a box counts as out of sight. */
const MIN_VISIBLE = 8
/** Room around the arrows in each layer (px): the glow's width and the curves' round caps. */
const LAYER_MARGIN = 12

const LAYERS = ["muted", "glow", "flow-0", "flow-1", "flow-2", "heads"] as const
type Layer = (typeof LAYERS)[number]

/** The overflow values that cut an element's content to its box (a scrolling row, a region, the board's clip). */
const CLIPPING = new Set(["hidden", "clip", "auto", "scroll"])

/** A rectangle of the page in the board's coordinates. */
function toBoard(rect: Rect, origin: DOMRect): Rect {
  return { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top }
}

/**
 * The measurements of one drawing: the part of an element the player sees -
 * its box cut by every ancestor up to the board that clips (a scrolling row,
 * a region) and by the board itself; null when (almost) nothing of it shows.
 * The area an ancestor leaves visible is worked out once per drawing.
 */
function measurer(board: HTMLElement, origin: DOMRect) {
  const clips = new Map<Element, Rect | null>()
  /** What of the page an element lets its content show: its own box if it clips, cut by its ancestors'. */
  const clipOf = (element: Element | null): Rect | null => {
    if (element === null || element === board) return origin
    if (clips.has(element)) return clips.get(element)!
    const outer = clipOf(element.parentElement)
    let area = outer
    if (outer !== null) {
      const style = getComputedStyle(element)
      if (CLIPPING.has(style.overflowX) || CLIPPING.has(style.overflowY)) area = intersect(outer, element.getBoundingClientRect())
    }
    clips.set(element, area)
    return area
  }
  const visible = (element: Element | null): Rect | null => {
    if (element === null) return null
    const area = clipOf(element.parentElement)
    const box = area === null ? null : intersect(element.getBoundingClientRect(), area)
    if (box === null || box.right - box.left < MIN_VISIBLE || box.bottom - box.top < MIN_VISIBLE) return null
    return toBoard(box, origin)
  }
  return { visible }
}

/** Outside the decision region: its rows and buttons repeat cards and players, the arrows point at the table's. */
function onTable(element: Element): boolean {
  return element.closest('[data-area="decision"]') === null
}

/** The element an end of an arrow points at or leaves from. */
function anchorOf(board: HTMLElement, relation: ArrowRelation, which: "from" | "to"): Element | null {
  const end = relation[which]
  switch (end.kind) {
    case "stack":
      return board.querySelector(`[data-area="center"] [data-stack-item="${end.id}"]`)
    case "player":
      return [...board.querySelectorAll(`[data-slot="game-player"][data-player="${end.id}"]`)].find(onTable) ?? null
    case "card": {
      const card = [...board.querySelectorAll(`[data-card="${end.id}"], [data-stack-card="${end.id}"]`)].find(onTable)
      // The card's face: its picture with the frame its marks glow on (the chip line above it is not the card's box).
      if (card !== undefined) return card.querySelector('[data-slot="game-card-face"]') ?? card
      if (which === "to" && relation.pile !== undefined) {
        const strip = relation.pile.seat === "me" ? "me" : "opponent"
        return board.querySelector(`[data-area="${strip}"] [data-zone-pile="${relation.pile.zone === "graveyard" ? "Friedhof" : "Exil"}"]`)
      }
      return null
    }
  }
}

/** What an end is called in `data-from`/`data-to`: the relation's end, or the pile a target in a zone points at. */
function anchorName(relation: ArrowRelation, board: HTMLElement): string {
  const to = relation.to
  if (to.kind === "card" && relation.pile !== undefined && board.querySelector(`[data-card="${to.id}"], [data-stack-card="${to.id}"]`) === null) return `pile:${relation.pile.seat}:${relation.pile.zone}`
  return endKey(to)
}

const SVG_NS = "http://www.w3.org/2000/svg"

/** The markup of each layer for the arrows. */
function layerMarkup(arrows: readonly ArrowGeometry[], names: ReadonlyMap<string, string>): Record<Layer, string> {
  const out: Record<Layer, string> = { muted: "", glow: "", "flow-0": "", "flow-1": "", "flow-2": "", heads: "" }
  for (const arrow of arrows) {
    const { relation } = arrow
    const kind = `table-arrow-${relation.kind}`
    const d = linePath(arrow)
    if (relation.strong) {
      out.glow += `<path class="table-arrow-glow ${kind}" d="${d}"/>`
      for (const phase of ["flow-0", "flow-1", "flow-2"] as const) out[phase] += `<path class="table-arrow-line ${kind}" d="${d}"/>`
    } else {
      out.muted += `<path class="table-arrow-glow ${kind}" d="${d}"/><path class="table-arrow-line ${kind}" d="${d}"/>`
    }
    const tip = arrow.tip
    out.heads +=
      `<g data-arrow="${relation.kind}" data-from="${endKey(relation.from)}" data-to="${names.get(relation.key) ?? endKey(relation.to)}" data-strong="${relation.strong}" data-side="${arrow.side}" data-end="${Math.round(tip.x * 10) / 10} ${Math.round(tip.y * 10) / 10}">` +
      `<path class="table-arrow-head ${kind}${relation.strong ? "" : " table-arrow-muted"}" d="${headPath(arrow)}"/></g>`
  }
  return out
}

const TableArrows = memo(function TableArrows({ state }: { state: GameState }) {
  const root = useRef<HTMLDivElement>(null)
  const relations = useMemo(() => arrowRelations(state), [state])
  const current = useRef<readonly ArrowRelation[]>(relations)
  const schedule = useRef<() => void>(() => undefined)

  useLayoutEffect(() => {
    const wrapper = root.current
    const board = wrapper?.closest<HTMLElement>('[data-slot="game-board"]')
    if (!wrapper || !board) return
    const layers = new Map<Layer, SVGSVGElement>()
    for (const layer of LAYERS) {
      const svg = wrapper.querySelector<SVGSVGElement>(`svg[data-layer-name="${layer}"]`)
      if (svg !== null) layers.set(layer, svg)
    }
    let drawn = ""
    let frame: number | null = null
    let draws = 0

    const draw = () => {
      frame = null
      // While cards travel (prompt 44) their pictures are not at their places yet: the arrows wait for the end of the motion.
      if (board.querySelector('[data-slot="table-motion"][data-moving]') !== null) return
      const relationsNow = current.current
      if (relationsNow.length === 0 && drawn === "") return
      // The board's box first: it brings the layout of the new state up to date (the frame would do that anyway), the
      // measure is the arrows' own work after it.
      const origin = board.getBoundingClientRect()
      const start = performance.now()
      let arrows: ArrowGeometry[] = []
      const names = new Map<string, string>()
      let bounds: Rect | null = null
      if (relationsNow.length > 0) {
        const { visible } = measurer(board, origin)
        // Strong arrows first: their heads choose their places before the muted ones.
        const ordered = [...relationsNow.filter((relation) => relation.strong), ...relationsNow.filter((relation) => !relation.strong)]
        const measured: MeasuredRelation[] = ordered.map((relation) => ({ relation, from: visible(anchorOf(board, relation, "from")), to: visible(anchorOf(board, relation, "to")) }))
        const boxes = (selector: string) => [...board.querySelectorAll(selector)].map(visible).filter((box): box is Rect => box !== null)
        const obstacles: ArrowObstacles = {
          bounds: { left: 0, top: 0, right: origin.width, bottom: origin.height },
          // The cards' faces (picture and frame) rather than the pictures: the same box whether the picture has loaded yet or not.
          pictures: boxes('[data-slot="game-card-face"], [data-slot="game-card-back"], .table-pile-card'),
          chips: boxes('[data-slot="game-card-caption"] > *'),
        }
        arrows = layoutArrows(measured, obstacles)
        for (const arrow of arrows) names.set(arrow.relation.key, anchorName(arrow.relation, board))
        bounds = arrowBounds(arrows)
      }
      const markup = layerMarkup(arrows, names)
      const box = bounds === null ? null : { x: Math.floor(bounds.left - LAYER_MARGIN), y: Math.floor(bounds.top - LAYER_MARGIN), w: Math.ceil(bounds.right - bounds.left + 2 * LAYER_MARGIN), h: Math.ceil(bounds.bottom - bounds.top + 2 * LAYER_MARGIN) }
      const next = `${box === null ? "" : `${box.x} ${box.y} ${box.w} ${box.h}`}|${LAYERS.map((layer) => markup[layer]).join("|")}`
      if (next !== drawn) {
        for (const [layer, svg] of layers) {
          if (box === null) {
            svg.replaceChildren()
            svg.style.display = "none"
            continue
          }
          svg.style.display = ""
          svg.style.left = `${box.x}px`
          svg.style.top = `${box.y}px`
          svg.setAttribute("width", String(box.w))
          svg.setAttribute("height", String(box.h))
          svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`)
          svg.innerHTML = markup[layer]
        }
        drawn = arrows.length === 0 ? "" : next
        wrapper.dataset["arrows"] = String(arrows.length)
      }
      draws++
      wrapper.dataset["draws"] = String(draws)
      if (typeof performance.measure === "function") {
        performance.clearMeasures(ARROWS_DRAW_MEASURE)
        performance.measure(ARROWS_DRAW_MEASURE, { start, end: performance.now() })
      }
    }
    const request = () => {
      if (frame === null) frame = requestAnimationFrame(draw)
    }
    schedule.current = request
    // Only while there is something to point at: a scroll or a transition elsewhere costs nothing.
    const whenArrows = () => {
      if (current.current.length > 0 || drawn !== "") request()
    }
    request()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(whenArrows)
    if (observer !== null) {
      observer.observe(board)
      for (const region of board.querySelectorAll(':scope > [data-slot="game-board-area"]')) observer.observe(region)
    }
    board.addEventListener("scroll", whenArrows, { capture: true, passive: true })
    board.addEventListener("transitionend", whenArrows, { capture: true, passive: true })
    board.addEventListener(MOTION_END_EVENT, whenArrows)
    return () => {
      board.removeEventListener(MOTION_END_EVENT, whenArrows)
      observer?.disconnect()
      board.removeEventListener("scroll", whenArrows, { capture: true })
      board.removeEventListener("transitionend", whenArrows, { capture: true })
      if (frame !== null) cancelAnimationFrame(frame)
      schedule.current = () => undefined
    }
  }, [])

  // Every new state: the relations may be the same, the cards under them may have moved.
  useLayoutEffect(() => {
    current.current = relations
    schedule.current()
  }, [relations])

  return (
    <div ref={root} data-slot="table-arrows" data-arrows="0" aria-hidden="true" className="table-arrows">
      {LAYERS.map((layer) => {
        const [kind, phase] = layer.startsWith("flow-") ? ["flow", layer.slice(5)] : [layer, undefined]
        return <svg key={layer} xmlns={SVG_NS} data-layer-name={layer} data-layer={kind} data-phase={phase} className="table-arrows-layer" focusable="false" style={{ display: "none" }} />
      })}
    </div>
  )
})

export { TableArrows }
