/*
 * The table surface: since prompt 53 the arena by default (arena-surface.tsx,
 * docs/design/SPIELTISCH.md §4.1b: a stone surface laid as a subgrid under
 * the board, nothing measured), or - chosen in Settings - the drawn wooden
 * table of prompt 37 (§4.1): a dark wooden desk over the whole screen with
 * the board set into it - carved frame, brass corner plates, leather, the
 * golden rune circle across both halves, the centre line with its diamonds
 * and the emblem, after the mockup's "Holztisch"
 * (docs/design/spieltisch-vorlage/arkan.js) - or a picture.
 *
 * What follows describes the drawn wooden table (DrawnSurface):
 *
 * Decoration only: it lies behind the regions of the GameBoard, is hidden
 * from screen readers and takes no pointer events. It knows nothing of the
 * game - no props, so a new game state never renders it again (memo).
 *
 * It measures the board (the screen while a game runs) and the playing area
 * (the battlefields' column from the opponent's strip to yours) with a
 * ResizeObserver and draws only what a changed size concerns: the desk (its
 * full-screen wood grain) only when the screen's size changes, the board (its
 * frame and leather grain) and the rune ring only when the playing area's
 * size or place changes - a region that grows with a question never
 * recomputes the desk. Each is a layer of its own; the ring stands still
 * (project owner, 2026-10-12).
 */
import { memo, useId, useLayoutEffect, useRef } from "react"
import { usePreferences } from "@/app/preferences"
import { ArenaSurface } from "./arena-surface"
import { boardMarkup, deskKey, deskMarkup, layoutKey, playingArea, ringMarkup, surfaceLayout, type Box, type PlayingRegions } from "./surface-drawing"
import { tableBackground, type TableBackground } from "./table-background"
import "./table.css"

/** The name of the User Timing measure of one drawing - desk, board or both (the end-to-end test reads it, prompt 37). */
export const SURFACE_DRAW_MEASURE = "openmana:table-surface"

/** A region of the board by its `data-area`, relative to the board. */
function regionBox(board: HTMLElement, origin: DOMRect, area: string): Box | null {
  const element = board.querySelector<HTMLElement>(`:scope > [data-slot="game-board-area"][data-area="${area}"]`)
  if (element === null) return null
  const box = element.getBoundingClientRect()
  return { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height }
}

const REGIONS = { opponent: "opponent", opponentField: "opponent-field", field: "field", me: "me" } as const satisfies Record<keyof PlayingRegions, string>

/**
 * The surface: the arena (the default since prompt 53), or - when the player
 * chose one in Settings (table-background.ts, 2026-10-12) - the drawn wooden
 * table, or a picture over the whole board instead of desk, board and ring.
 * Only a change of that choice renders it again.
 */
const TableSurface = memo(function TableSurface() {
  const { tableBackground: choice, tableBackgroundImage: image } = usePreferences()
  const background = tableBackground(choice, image)
  if (background.kind === "arena") return <ArenaSurface />
  return background.kind === "table" ? <DrawnSurface /> : <PictureSurface background={background} />
})

/** A picture over the whole board (cover, centred): a built-in one per orientation, or the player's own. */
function PictureSurface({ background }: { background: Exclude<TableBackground, { kind: "table" } | { kind: "arena" }> }) {
  return (
    <div data-slot="table-surface" data-background={background.kind === "custom" ? "custom" : background.choice} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {background.kind === "custom" ? (
        <img data-surface="picture" className="table-surface-picture" src={background.src} alt="" decoding="async" />
      ) : (
        <picture>
          <source media="(max-aspect-ratio: 1/1)" srcSet={background.tall} />
          <img data-surface="picture" className="table-surface-picture" src={background.wide} alt="" decoding="async" />
        </picture>
      )}
    </div>
  )
}

/** The drawn table: desk, board and rune ring, drawn only when a size changes. */
function DrawnSurface() {
  const root = useRef<HTMLDivElement>(null)
  const deskPaint = useRef<SVGSVGElement>(null)
  const boardPaint = useRef<SVGSVGElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const ringPaint = useRef<SVGSVGElement>(null)
  // Ids for the filters and gradients, unique on the page and valid in url(#…); desk and board each get their own.
  const id = `surface${useId().replace(/[^\w-]/g, "")}`

  useLayoutEffect(() => {
    const surface = root.current
    const board = surface?.closest<HTMLElement>('[data-slot="game-board"]')
    if (!surface || !board || !deskPaint.current || !boardPaint.current || !ring.current || !ringPaint.current) return
    const [desk, boardSvg, ringElement, ringSvg] = [deskPaint.current, boardPaint.current, ring.current, ringPaint.current]
    let drawnDesk: string | null = null
    let drawnBoard: string | null = null
    ringElement.hidden = true
    boardSvg.style.display = "none"

    const draw = () => {
      const origin = board.getBoundingClientRect()
      const regions: PlayingRegions = {
        opponent: regionBox(board, origin, REGIONS.opponent),
        opponentField: regionBox(board, origin, REGIONS.opponentField),
        field: regionBox(board, origin, REGIONS.field),
        me: regionBox(board, origin, REGIONS.me),
      }
      const area = playingArea(regions)
      const layout = area === null ? null : surfaceLayout(origin.width, origin.height, area)
      const nextDesk = layout === null ? "" : deskKey(layout)
      const nextBoard = layout === null ? "" : layoutKey(layout)
      if (nextDesk === drawnDesk && nextBoard === drawnBoard) return
      const start = performance.now()
      if (layout === null) {
        desk.replaceChildren()
        boardSvg.replaceChildren()
        boardSvg.style.display = "none"
        ringSvg.replaceChildren()
        ringElement.hidden = true
        delete surface.dataset["board"]
      } else {
        if (nextDesk !== drawnDesk) {
          desk.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`)
          desk.setAttribute("width", String(layout.width))
          desk.setAttribute("height", String(layout.height))
          desk.innerHTML = deskMarkup(layout, `${id}d`)
        }
        if (nextBoard !== drawnBoard) {
          const { x, y, width, height } = layout.board
          boardSvg.style.display = ""
          boardSvg.style.left = `${x}px`
          boardSvg.style.top = `${y}px`
          boardSvg.setAttribute("viewBox", `0 0 ${width} ${height}`)
          boardSvg.setAttribute("width", String(width))
          boardSvg.setAttribute("height", String(height))
          boardSvg.innerHTML = boardMarkup(layout, `${id}b`)
          if (layout.ring === null) {
            ringSvg.replaceChildren()
            ringElement.hidden = true
          } else {
            const side = layout.ring.width
            ringElement.hidden = false
            ringElement.style.left = `${layout.ring.x}px`
            ringElement.style.top = `${layout.ring.y}px`
            ringElement.style.width = `${side}px`
            ringElement.style.height = `${side}px`
            ringSvg.setAttribute("viewBox", `0 0 ${side} ${side}`)
            ringSvg.innerHTML = ringMarkup(layout, `${id}r`)
          }
        }
        surface.dataset["board"] = nextBoard
      }
      drawnDesk = nextDesk
      drawnBoard = nextBoard
      // One measure at a time (the newest drawing), so nothing piles up while a window is resized.
      if (typeof performance.measure === "function") {
        performance.clearMeasures(SURFACE_DRAW_MEASURE)
        performance.measure(SURFACE_DRAW_MEASURE, { start, end: performance.now() })
      }
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(board)
    for (const area of Object.values(REGIONS)) {
      const element = board.querySelector(`:scope > [data-slot="game-board-area"][data-area="${area}"]`)
      if (element !== null) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [id])

  return (
    <div ref={root} data-slot="table-surface" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg ref={deskPaint} data-surface="desk" className="table-surface-desk" focusable="false" />
      <svg ref={boardPaint} data-surface="board" className="table-surface-board" focusable="false" />
      <div ref={ring} data-surface="ring" className="table-surface-ring">
        <svg ref={ringPaint} focusable="false" />
      </div>
    </div>
  )
}

export { TableSurface }
