/*
 * The table surface (prompt 37, table-surface.tsx and surface-drawing.ts):
 * where the board lies, that circles stay circles, that it is decoration
 * (hidden from screen readers, no pointer events) and that it draws only when
 * a size changes - never because the game's state changed. jsdom has no
 * layout: the sizes are given, the ResizeObserver is driven by the test. The
 * real browser (sizes, roundness, motion, cost) is checked by the end-to-end
 * test, section 12.
 */
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { GameTable } from "../game-table"
import { NO_PICTURES } from "../table-cards"
import { boardMarkup, deskKey, deskMarkup, layoutKey, MIN_CIRCLE_RADIUS, playingArea, ringMarkup, surfaceLayout, type Box } from "./surface-drawing"

const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height })

describe("where the board lies", () => {
  it("one column (hoch): the battlefields' column from the opponent's strip to yours, its middle between the battlefields", () => {
    const area = playingArea({ opponent: box(0, 50, 412, 40), opponentField: box(0, 90, 412, 300), field: box(0, 400, 412, 300), me: box(0, 700, 412, 40) })
    expect(area).toEqual({ ...box(0, 50, 412, 690), middle: 395 })
  })

  it("strips beside the battlefields (breit in a low window) do not stretch it", () => {
    const area = playingArea({ opponent: box(1056, 0, 384, 57), opponentField: box(0, 57, 1056, 359), field: box(0, 416, 1056, 359), me: box(1056, 775, 384, 125) })
    expect(area).toEqual({ ...box(0, 57, 1056, 718), middle: 416 })
  })

  it("strips of different heights above and below (quadrat, breit): the circle and the centre line stay on the line between the battlefields", () => {
    // The opponent's strip wraps to two lines, yours keeps one; the centre line row lies between the battlefields.
    const area = playingArea({ opponent: box(0, 53, 580, 68), opponentField: box(0, 121, 580, 206), field: box(0, 351, 580, 206), me: box(0, 557, 580, 36) })!
    expect(area.middle).toBe(339)
    const layout = surfaceLayout(829, 690, area)!
    expect(layout.cy).toBe(339)
    // The circle stays inside the board on both sides of the line.
    expect(layout.cy - layout.radius).toBeGreaterThanOrEqual(layout.board.y)
    expect(layout.cy + layout.radius).toBeLessThanOrEqual(layout.board.y + layout.board.height)
    expect(layout.ring!.y + layout.ring!.height / 2).toBeCloseTo(layout.cy)
    // Drawn into the board at that height; another middle is another board.
    expect(boardMarkup(layout, "m")).toContain(`cy="${(339 - layout.board.y).toFixed(1)}"`)
    expect(layoutKey(surfaceLayout(829, 690, { ...area, middle: 330 })!)).not.toBe(layoutKey(layout))
  })

  it("no battlefield on screen, no board", () => {
    expect(playingArea({ opponent: box(0, 0, 400, 40), opponentField: null, field: box(0, 0, 0, 0), me: null })).toBeNull()
  })

  it("the board keeps the mockup's margins and stays inside the screen; its circle and ring are round", () => {
    const layout = surfaceLayout(412, 915, box(0, 50, 412, 690))!
    expect(layout.board).toEqual(box(6, 52, 400, 686))
    expect(layout.board.x + layout.board.width).toBeLessThanOrEqual(412)
    expect(layout.radius).toBeCloseTo(400 * 0.46)
    expect(layout.cx).toBe(6 + 200)
    expect(layout.cy).toBe(52 + 343)
    expect(layout.ring!.width).toBe(layout.ring!.height)
    expect(layout.ring!.x + layout.ring!.width / 2).toBeCloseTo(layout.cx)
    expect(layout.ring!.y + layout.ring!.height / 2).toBeCloseTo(layout.cy)
    // Equal sizes, equal key; another size, another key.
    expect(layoutKey(surfaceLayout(412, 915, box(0, 50, 412, 690))!)).toBe(layoutKey(layout))
    expect(layoutKey(surfaceLayout(412, 915, box(0, 50, 412, 680))!)).not.toBe(layoutKey(layout))
  })

  it("a board too small for the circle draws none, and none at all below 40 px", () => {
    const small = surfaceLayout(400, 200, box(0, 50, 400, 100))!
    expect(small.radius).toBeLessThan(MIN_CIRCLE_RADIUS)
    expect(small.ring).toBeNull()
    expect(ringMarkup(small, "s")).toBe("")
    expect(boardMarkup(small, "s")).not.toContain('data-surface="circle"')
    expect(surfaceLayout(400, 200, box(0, 50, 400, 30))).toBeNull()
  })
})

describe("the drawing", () => {
  const layout = surfaceLayout(1440, 900, box(0, 57, 1056, 718))!

  it("the desk and the board as the mockup's Holztisch, in the tokens' colours, with unique ids", () => {
    const desk = deskMarkup(layout, "t1")
    const board = boardMarkup(layout, "t2")
    const markup = desk + board
    // The desk: its wood grain alone (drawn once per screen size); the board: the frame's grain and the leather (once
    // per size of the playing area). No other noise filter.
    expect(desk.match(/<feTurbulence/g)).toHaveLength(1)
    expect(board.match(/<feTurbulence/g)).toHaveLength(2)
    for (const part of ['id="t1-wood"', 'url(#t1-vignette)']) expect(desk).toContain(part)
    for (const part of ['id="t2-wood"', 'id="t2-leather"', 'url(#t2-brass)', 'url(#t2-inlay)', 'url(#t2-gold)', 'data-surface="circle"']) expect(board).toContain(part)
    // Each piece refers only to its own ids.
    expect(desk).not.toMatch(/#t2-|#ID-/)
    expect(board).not.toMatch(/#t1-|#ID-/)
    // The desk depends on the screen alone: another playing area, the same desk.
    expect(deskMarkup(surfaceLayout(1440, 900, box(0, 100, 1056, 600))!, "t1")).toBe(desk)
    expect(deskKey(surfaceLayout(1440, 900, box(0, 100, 1056, 600))!)).toBe(deskKey(layout))
    for (const token of ["--table-wood", "--table-wood-frame", "--table-leather", "--table-gold-light", "--table-gold-dark", "--table-mana", "--primary"]) expect(markup).toContain(`var(${token})`)
    // No colour literal: what is not a token is black (depth) or mixed from a token.
    expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    // 16 spokes, a 16-pointed star, four corner plates.
    expect(markup.match(/translate\([\d.]+ [\d.]+\) scale\(-?1 -?1\)/g)).toHaveLength(4)
    // Nothing moves in the markup itself (table.css moves the ring; SMIL could not be stopped).
    expect(markup).not.toMatch(/<animate|<set\b/)
  })

  it("the circle is a circle around the board's centre, its grooves too", () => {
    const markup = boardMarkup(layout, "t")
    const circle = /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"[^>]*data-surface="circle"/.exec(markup)!
    expect(Number(circle[3])).toBeCloseTo(layout.radius, 1)
    // Drawn in the board's own coordinates: its centre is the layout's, less the board's place.
    expect(Number(circle[1]) + layout.board.x).toBeCloseTo(layout.cx, 1)
    expect(Number(circle[2]) + layout.board.y).toBeCloseTo(layout.cy, 1)
    // Three grooves, each a dark cut and its inlay; no ellipse, no arc that could come out oval.
    expect(markup.match(/<circle [^>]*fill="none"/g)!.length).toBeGreaterThanOrEqual(6)
    expect(markup).not.toMatch(/<ellipse| a[\d.]+ [\d.]+ 0/)
  })

  it("the rune ring: own glyphs around the circle, one every 24 px", () => {
    const markup = ringMarkup(layout, "t")
    const count = Math.floor((2 * Math.PI * (layout.radius - 14)) / 24)
    expect(markup.match(/<path /g)).toHaveLength(count)
    expect(markup).toContain('filter="url(#t-rune-glow)"')
    expect(markup).toContain("var(--table-gold-light)")
  })
})

// ── The component in the real table ──

type Sizes = Record<string, Box>

/** Portrait phone: header, opponent, their field, stack, your field, you, decision, hand. */
const PORTRAIT: Sizes = {
  board: box(0, 0, 412, 915),
  header: box(0, 0, 412, 60),
  opponent: box(0, 60, 412, 40),
  "opponent-field": box(0, 100, 412, 300),
  center: box(0, 400, 412, 2),
  field: box(0, 402, 412, 300),
  me: box(0, 702, 412, 40),
  decision: box(0, 742, 412, 70),
  hand: box(0, 812, 412, 103),
}

let sizes: Sizes = PORTRAIT
const observers: { callback: ResizeObserverCallback; observed: Element[] }[] = []

class FakeResizeObserver {
  private readonly entry: { callback: ResizeObserverCallback; observed: Element[] }
  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, observed: [] }
    observers.push(this.entry)
  }
  observe(element: Element): void {
    this.entry.observed.push(element)
  }
  unobserve(): void {}
  disconnect(): void {
    observers.splice(observers.indexOf(this.entry), 1)
  }
}

/** The browser reports a size change: every observer is told. */
function resize(next: Sizes): void {
  sizes = next
  for (const { callback } of observers.slice()) callback([], {} as ResizeObserver)
}

function rectOf(element: Element): DOMRect {
  const name = element.getAttribute("data-slot") === "game-board" ? "board" : element.getAttribute("data-slot") === "game-board-area" ? element.getAttribute("data-area") : null
  const b = name !== null ? sizes[name] : undefined
  const { x, y, width, height } = b ?? box(0, 0, 0, 0)
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect
}

function table(name: TableSceneName) {
  const scene = tableScene(name)
  return <GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={null} />
}

describe("TableSurface in the game table", () => {
  beforeEach(() => {
    sizes = PORTRAIT
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return rectOf(this)
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const surfaceOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-slot="table-surface"]')!

  it("lies first in the board behind the regions, hidden from screen readers and taking no pointer events", () => {
    const { container } = render(table("main-phase"))
    const surface = surfaceOf(container)
    const board = container.querySelector('[data-slot="game-board"]')!
    expect(surface.parentElement).toBe(board)
    expect([...board.children].find((child) => child.tagName !== "TITLE")).toBe(surface)
    expect(surface).toHaveAttribute("aria-hidden", "true")
    expect(surface).toHaveClass("pointer-events-none", "absolute", "inset-0")
    // Nothing in it can be reached: no focusable element, no names.
    expect(surface.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0)
    expect(surface.querySelectorAll("text, title")).toHaveLength(0)
  })

  it("draws for the measured sizes: the desk 1:1 over the board, the board at its place, the ring a square around the circle", () => {
    const { container } = render(table("main-phase"))
    const surface = surfaceOf(container)
    const desk = surface.querySelector('[data-surface="desk"]')!
    const boardSvg = surface.querySelector<SVGSVGElement>('[data-surface="board"]')!
    const ring = surface.querySelector<HTMLElement>('[data-surface="ring"]')!
    const layout = surfaceLayout(412, 915, box(0, 60, 412, 682))!
    expect(surface.dataset["board"]).toBe(layoutKey(layout))
    expect(desk.getAttribute("viewBox")).toBe("0 0 412 915")
    expect(desk.getAttribute("width")).toBe("412")
    expect(desk.getAttribute("height")).toBe("915")
    expect(boardSvg.getAttribute("viewBox")).toBe(`0 0 ${layout.board.width} ${layout.board.height}`)
    expect(boardSvg.style.left).toBe(`${layout.board.x}px`)
    expect(boardSvg.style.top).toBe(`${layout.board.y}px`)
    expect(boardSvg.querySelector('[data-surface="circle"]')).not.toBeNull()
    expect(ring.hidden).toBe(false)
    expect(ring.style.width).toBe(ring.style.height)
    expect(ring.style.width).toBe(`${layout.ring!.width}px`)
    expect(ring.querySelector("svg")!.getAttribute("viewBox")).toBe(`0 0 ${layout.ring!.width} ${layout.ring!.width}`)
    // Desk, board and ring each with their own ids: none twice in the page.
    const ids = [...surface.querySelectorAll("[id]")].map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    // It watches the board and the four regions the playing area is made of.
    const watched = observers.flatMap(({ observed }) => observed).map((element) => element.getAttribute("data-area") ?? element.getAttribute("data-slot"))
    expect(watched).toEqual(expect.arrayContaining(["game-board", "opponent", "opponent-field", "field", "me"]))
  })

  it("draws again only when a size changes - never for a new game state; the desk only for a new screen size", () => {
    const { container, rerender } = render(table("main-phase"))
    const surface = surfaceOf(container)
    const desk = surface.querySelector('[data-surface="desk"]')!
    const boardSvg = surface.querySelector('[data-surface="board"]')!
    let mutations = 0
    const watcher = new MutationObserver((records) => (mutations += records.length))
    watcher.observe(surface, { subtree: true, childList: true, attributes: true, characterData: true })
    const deskDrawing = desk.firstElementChild
    const boardDrawing = boardSvg.firstElementChild

    // New states of the same game, and the browser reporting unchanged sizes: nothing is drawn.
    for (const name of ["stack", "scry", "yes-no", "main-phase"] as const) rerender(table(name))
    resize(PORTRAIT)
    resize({ ...PORTRAIT })
    expect(watcher.takeRecords().length + mutations).toBe(0)
    expect(desk.firstElementChild).toBe(deskDrawing)
    expect(boardSvg.firstElementChild).toBe(boardDrawing)

    // A larger decision shrinks the battlefields: a new board, the same desk (its full-screen grain is not recomputed).
    resize({ ...PORTRAIT, field: box(0, 402, 412, 250), me: box(0, 652, 412, 40), decision: box(0, 692, 412, 120) })
    expect(boardSvg.firstElementChild).not.toBe(boardDrawing)
    expect(desk.firstElementChild).toBe(deskDrawing)
    // The circle stays on the line between the battlefields (the stack bar), now below the board's centre.
    expect(surface.dataset["board"]).toBe(layoutKey(surfaceLayout(412, 915, { ...box(0, 60, 412, 632), middle: 401 })!))
    // The window turned: the desk follows the screen.
    resize({ ...PORTRAIT, board: box(0, 0, 915, 412), "opponent-field": box(0, 60, 600, 150), field: box(0, 212, 600, 150), opponent: box(600, 0, 315, 60), me: box(600, 352, 315, 60) })
    expect(desk.getAttribute("viewBox")).toBe("0 0 915 412")
    expect(desk.firstElementChild).not.toBe(deskDrawing)
    watcher.disconnect()
  })

  it("without a battlefield on screen it draws nothing and hides the ring", () => {
    sizes = { ...PORTRAIT, "opponent-field": box(0, 0, 0, 0), field: box(0, 0, 0, 0) }
    const { container } = render(table("main-phase"))
    const surface = surfaceOf(container)
    expect(surface.querySelector('[data-surface="desk"]')!.childElementCount).toBe(0)
    expect(surface.querySelector('[data-surface="board"]')!.childElementCount).toBe(0)
    expect(surface.querySelector<HTMLElement>('[data-surface="ring"]')!.hidden).toBe(true)
    expect(surface.dataset["board"]).toBeUndefined()
  })

  it("stops watching when the table goes", () => {
    const { unmount } = render(table("main-phase"))
    expect(observers.length).toBeGreaterThan(0)
    unmount()
    expect(observers).toHaveLength(0)
  })
})
