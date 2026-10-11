/*
 * The arrows in the game table (prompt 43, table-arrows.tsx): over the board,
 * hidden from screen readers and out of the way; one arrow per relation Forge's
 * state names, drawn from the boxes the page measures (here a phone's table
 * laid out for the test: getBoundingClientRect answers by region and order) -
 * in a running game and in the replay alike; drawn again for a new state, a
 * scroll and a new size, nothing left over when the relations are gone.
 */
import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { builtTableScene } from "@/test/built-scenes"
import { tableScene, type TableScene, type TableSceneName } from "@/test/table-scenes"
import { GameTable } from "../game-table"
import { NO_PICTURES } from "../table-cards"

const observers: { callback: ResizeObserverCallback }[] = []

class FakeResizeObserver {
  private readonly entry: { callback: ResizeObserverCallback }
  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback }
    observers.push(this.entry)
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    observers.splice(observers.indexOf(this.entry), 1)
  }
}

/** Cards that are out of sight in this test (their box is empty, like a card scrolled out of its row). */
let hidden = new Set<number>()

const domRect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect
const ROW_TOP: Record<string, number> = { "opponent-field": 200, field: 480, center: 330, hand: 800 }

/** A phone's table (412 × 915): cards 60 × 84 side by side in their region, chronicle entries in a bar, the medallions above and below. */
function rectOf(element: Element): DOMRect {
  if (element.getAttribute("data-slot") === "game-board") return domRect(0, 0, 412, 915)
  const area = element.closest("[data-area]")?.getAttribute("data-area") ?? null
  if (element.getAttribute("data-slot") === "game-card-face" && area !== null) {
    const card = element.closest("[data-card], [data-stack-card]")
    const id = Number(card?.getAttribute("data-card") ?? card?.getAttribute("data-stack-card"))
    if (hidden.has(id)) return domRect(0, 0, 0, 0)
    const faces = [...element.closest("[data-area]")!.querySelectorAll('[data-slot="game-card-face"]')]
    return domRect(8 + faces.indexOf(element) * 68, ROW_TOP[area] ?? 0, 60, 84)
  }
  if (element.hasAttribute("data-stack-item")) {
    const entries = [...element.parentElement!.children]
    return domRect(8 + entries.indexOf(element) * 150, 330, 140, 56)
  }
  if (element.getAttribute("data-slot") === "game-player" && area !== null) return area === "opponent" ? domRect(184, 30, 44, 44) : domRect(184, 700, 44, 44)
  return domRect(0, 0, 0, 0)
}

function table(scene: TableScene, replay = false) {
  const live = replay ? {} : { onTapCard: () => undefined, onAnswer: () => undefined, onTapPlayer: () => undefined }
  return <GameTable replay={replay} state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={null} {...live} />
}

const recorded = (name: TableSceneName) => tableScene(name)

/** The arrows draw in the next animation frame. */
async function frame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

const arrowsOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-slot="table-arrows"]')!
const heads = (container: HTMLElement) => [...container.querySelectorAll<SVGGElement>("[data-arrow]")].map((g) => `${g.dataset["arrow"]} ${g.dataset["from"]}>${g.dataset["to"]}${g.dataset["strong"] === "true" ? "" : " muted"}`)

describe("TableArrows in the game table", () => {
  beforeEach(() => {
    hidden = new Set()
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return rectOf(this)
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("lies over the board, hidden from screen readers, with nothing to reach", async () => {
    const { container } = render(table(recorded("blockers")))
    await frame()
    const arrows = arrowsOf(container)
    expect(arrows.parentElement).toBe(container.querySelector('[data-slot="game-board"]'))
    expect(arrows).toHaveAttribute("aria-hidden", "true")
    expect(arrows).toHaveClass("table-arrows")
    expect(arrows.querySelectorAll("a, button, input, [tabindex], title, text")).toHaveLength(0)
    // No SVG animation (less motion could not stop it): the flow is table.css's.
    expect(arrows.innerHTML).not.toMatch(/<(animate|set)\b/)
  })

  it("draws an arrow per relation of combat with blockers: attackers to the player, blockers to their attackers", async () => {
    const { container } = render(table(recorded("blockers")))
    await frame()
    expect(heads(container)).toEqual([
      "attack card:16>player:1",
      "attack card:18>player:1",
      "attack card:3>player:1",
      "attack card:29>player:1",
      "block card:103>card:18",
      "block card:115>card:18",
      "block card:94>card:29",
    ])
    const arrows = arrowsOf(container)
    expect(arrows.dataset["arrows"]).toBe("7")
    // Strong arrows: a glow and three flow phases each; nothing muted.
    for (const layer of ["glow", "flow-0", "flow-1", "flow-2"]) expect(arrows.querySelectorAll(`svg[data-layer-name="${layer}"] path`)).toHaveLength(7)
    expect(arrows.querySelectorAll('svg[data-layer-name="muted"] path')).toHaveLength(0)
    expect(arrows.querySelectorAll('svg[data-layer-name="heads"] path.table-arrow-head')).toHaveLength(7)
    expect(arrows.querySelectorAll(".table-arrow-attack.table-arrow-head")).toHaveLength(4)
    expect(arrows.querySelectorAll(".table-arrow-block.table-arrow-head")).toHaveLength(3)
    // Each tip in the board, outside the box it points at.
    for (const g of arrows.querySelectorAll<SVGGElement>("[data-arrow]")) {
      const [x, y] = g.dataset["end"]!.split(" ").map(Number) as [number, number]
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(412)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(915)
    }
  })

  it("draws the target of the stack's top entry from its chronicle entry, and a planeswalker attacked (built from Forge's next state)", async () => {
    const { container, rerender } = render(table(recorded("stack")))
    await frame()
    expect(heads(container)).toEqual(["target stack:14>card:55"])
    rerender(table(builtTableScene("attack-planeswalker-declared")))
    await frame()
    expect(heads(container)).toEqual(["attack card:17>card:68"])
  })

  it("draws the same in the replay (no input callbacks)", async () => {
    const { container } = render(table(recorded("block-multiple"), true))
    await frame()
    expect(heads(container)).toEqual(["attack card:101>player:0", "block card:11>card:101", "block card:2>card:101"])
  })

  it("a new state without relations takes every arrow away", async () => {
    const { container, rerender } = render(table(recorded("blockers")))
    await frame()
    rerender(table(recorded("main-phase")))
    await frame()
    const arrows = arrowsOf(container)
    expect(arrows.dataset["arrows"]).toBe("0")
    expect(arrows.querySelectorAll("path")).toHaveLength(0)
    for (const svg of arrows.querySelectorAll<SVGSVGElement>("svg")) expect(svg.style.display).toBe("none")
  })

  it("a card out of sight gets no arrow; scrolled into view it gets one", async () => {
    hidden = new Set([94])
    const { container } = render(table(recorded("blockers")))
    await frame()
    expect(heads(container)).not.toContain("block card:94>card:29")
    expect(heads(container)).toHaveLength(6)
    hidden = new Set()
    container.querySelector('[data-slot="game-board"] [data-slot="game-card-row"]')!.dispatchEvent(new Event("scroll"))
    await frame()
    expect(heads(container)).toContain("block card:94>card:29")
  })

  it("is drawn again for a new size, and lets go of its observers when the table goes", async () => {
    const { container, unmount } = render(table(recorded("blockers")))
    await frame()
    const arrows = arrowsOf(container)
    const draws = Number(arrows.dataset["draws"])
    act(() => {
      for (const { callback } of observers.slice()) callback([], {} as ResizeObserver)
    })
    await frame()
    expect(Number(arrows.dataset["draws"])).toBe(draws + 1)
    const before = observers.length
    expect(before).toBeGreaterThan(0)
    unmount()
    expect(observers.length).toBeLessThan(before)
  })
})
