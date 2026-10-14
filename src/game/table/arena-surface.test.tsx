/*
 * The arena (arena-surface.tsx, prompt 53): the table's background by default -
 * a shadow grid under the board (first in it, hidden from screen readers, no
 * pointer events, nothing focusable) with the ground and the three cells the
 * board's lines place; it measures nothing (no ResizeObserver), renders once
 * and never again for a new game state, and leaves nothing behind when the
 * table goes or the player chooses another background. jsdom has no layout:
 * where the cells lie, that no region moves and how it looks is checked by the
 * end-to-end test in Chrome (scripts/e2e/run.ts, arenaSurface).
 */
import fs from "node:fs"
import path from "node:path"
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { GameTable } from "../game-table"
import { NO_PICTURES } from "../table-cards"
import { ARENA_PIECES, ARENA_RUNES, ARENA_STYLE, ArenaSurface } from "./arena-surface"

let preferences: Preferences = DEFAULT_PREFERENCES

vi.mock("@/app/preferences", async (original) => ({
  ...(await original<typeof import("@/app/preferences")>()),
  usePreferences: () => preferences,
}))

/** What any ResizeObserver of the table watches (the arrows and the decision keep theirs; the arena asks for none). */
let watched: Element[] = []

class WatchingResizeObserver {
  observe(element: Element): void {
    watched.push(element)
  }
  unobserve(): void {}
  disconnect(): void {}
}

function table(name: TableSceneName = "main-phase") {
  const scene = tableScene(name)
  return <GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={null} />
}

const surfaceOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-slot="table-surface"]')!

/** The arena's rule block of table.css (the stylesheet jsdom does not apply). */
function arenaRule(): string {
  const css = fs.readFileSync(path.join(__dirname, "table.css"), "utf8")
  const start = css.indexOf('[data-slot="game-board"] > [data-slot="table-surface"][data-background="arena"] {')
  expect(start).toBeGreaterThan(0)
  return css.slice(start, css.indexOf("}", start))
}

describe("the arena in the game table", () => {
  beforeEach(() => {
    watched = []
    preferences = DEFAULT_PREFERENCES
    vi.stubGlobal("ResizeObserver", WatchingResizeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is the table's background by default: first in the board, hidden, no pointer, nothing to reach, nothing measured", () => {
    const { container } = render(table())
    const surface = surfaceOf(container)
    const board = container.querySelector('[data-slot="game-board"]')!
    expect(surface.parentElement).toBe(board)
    expect([...board.children].find((child) => child.tagName !== "TITLE")).toBe(surface)
    expect(surface.dataset["background"]).toBe("arena")
    expect(surface).toHaveAttribute("aria-hidden", "true")
    expect(surface).toHaveClass("table-arena")
    // Its pieces, in order: the ground, the cells of the opponent's strip, the playing area and the hand, the dust - no words,
    // nothing of their own: only the runes and the tendrils as absolutely positioned drawings (prompt 54).
    expect([...surface.children].map((child) => child.getAttribute("data-arena"))).toEqual([...ARENA_PIECES])
    expect(surface.textContent).toBe("")
    for (const piece of surface.children) for (const child of piece.children) expect(child.matches("svg[data-arena-rune], svg[data-arena-tendril]")).toBe(true)
    // The template's ten runes (four at the opponent's swing, six at the hand's) and two tendrils; every drawing unfocusable, nothing readable.
    expect(surface.querySelectorAll('[data-arena="opponent"] > svg[data-arena-rune]')).toHaveLength(4)
    expect(surface.querySelectorAll('[data-arena="hand"] > svg[data-arena-rune]')).toHaveLength(6)
    expect([...surface.querySelectorAll("[data-arena-tendril]")].map((tendril) => tendril.getAttribute("data-arena-tendril"))).toEqual(["left", "right"])
    for (const svg of surface.querySelectorAll("svg")) expect(svg).toHaveAttribute("focusable", "false")
    // Nothing in it can be reached or read; nothing of the drawn table or a picture.
    expect(surface.querySelectorAll("a, button, input, [tabindex], text, title, img, image, animate")).toHaveLength(0)
    expect(surface.querySelector('[data-surface]')).toBeNull()
    // The arrows and the decision keep their observers; nothing watches the arena or anything in it.
    expect(watched.filter((element) => element === surface || surface.contains(element))).toHaveLength(0)
  })

  it("renders once: no props, memoised, untouched by twenty new states of the game", () => {
    expect((ArenaSurface as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for("react.memo"))
    expect((ArenaSurface as unknown as { type: (...args: unknown[]) => unknown }).type).toHaveLength(0)
    const { container, rerender } = render(table())
    const surface = surfaceOf(container)
    let mutations = 0
    const watcher = new MutationObserver((records) => (mutations += records.length))
    watcher.observe(surface, { subtree: true, childList: true, attributes: true, characterData: true })
    const scenes: readonly TableSceneName[] = ["opening", "stack", "scry", "yes-no", "main-phase", "commander-late", "attack-declared", "respond", "target", "payment"]
    for (let i = 0; i < 20; i++) rerender(table(scenes[i % scenes.length]!))
    expect(watcher.takeRecords().length + mutations).toBe(0)
    expect(surfaceOf(container)).toBe(surface)
    watcher.disconnect()
  })

  it("leaves nothing behind: another background has no arena, the arena no desk; the table gone, the arena too", () => {
    // TableSurface is memoised and reads the preferences from context: a new choice reaches it through the app's
    // provider; here each choice is a fresh table, as the picture test does.
    const first = render(table())
    expect(first.container.querySelectorAll("[data-arena]")).toHaveLength(ARENA_PIECES.length)
    first.unmount()
    expect(document.querySelector("[data-arena], [data-slot='table-surface']")).toBeNull()
    preferences = { ...DEFAULT_PREFERENCES, tableBackground: "table" }
    const drawn = render(table())
    expect(drawn.container.querySelector("[data-arena], [data-background]")).toBeNull()
    expect(drawn.container.querySelector('[data-surface="desk"]')).not.toBeNull()
    drawn.unmount()
    preferences = { ...DEFAULT_PREFERENCES, tableBackground: "planeswalker" }
    const picture = render(table())
    expect(picture.container.querySelector("[data-arena]")).toBeNull()
    expect(surfaceOf(picture.container).dataset["background"]).toBe("planeswalker")
    picture.unmount()
    preferences = DEFAULT_PREFERENCES
    const again = render(table())
    expect(again.container.querySelector("[data-surface], img")).toBeNull()
    expect(again.container.querySelectorAll("[data-arena]")).toHaveLength(ARENA_PIECES.length)
    again.unmount()
    expect(document.querySelector("[data-arena], [data-slot='table-surface']")).toBeNull()
  })

  it("draws the ground, the swings and the dust from SVG data that never moves; the runes are the rune ring's glyphs", () => {
    const style = ARENA_STYLE as Record<string, string>
    // The swings stretch with their cell; the dust covers the board; seventy points, mostly at the edges.
    expect(style["--table-arena-hand-swing"]).toContain("preserveAspectRatio='none'")
    expect(style["--table-arena-hand-swing"]!.match(/<path /g)).toHaveLength(2)
    expect(style["--table-arena-opponent-swing"]!.match(/<path /g)).toHaveLength(1)
    expect(style["--table-arena-dust"]).toContain("preserveAspectRatio='xMidYMid slice'")
    expect(style["--table-arena-dust"]!.match(/<circle /g)).toHaveLength(70)
    expect(ARENA_RUNES).toHaveLength(12)
    for (const glyph of ARENA_RUNES) expect(glyph).toMatch(/^M[\d .VHZML]+$/)
    expect(style["--table-arena-grain"]).toMatch(/^url\("data:image\/svg\+xml;utf8,<svg /)
    expect(style["--table-arena-grain"]).toContain("feTurbulence")
    expect(style["--table-arena-grain"]).toContain("stitchTiles='stitch'")
    expect(style["--table-arena-grain-size"]).toBe("260px 260px")
    expect(style["--table-arena-cracks"]).toMatch(/^url\("data:image\/svg\+xml;utf8,<svg /)
    // Five dark cracks, three with a light edge; no raster picture, nothing animated.
    expect(style["--table-arena-cracks"]!.match(/<path /g)).toHaveLength(8)
    expect(style["--table-arena-cracks-size"]).toBe("900px 700px")
    for (const value of Object.values(style)) expect(value).not.toMatch(/<animate|<set\b|<image|data:image\/(png|webp|jpeg)/)
  })

  it("is a subgrid of the board without containment, under every region and taking no pointer (table.css)", () => {
    const rule = arenaRule()
    expect(rule).toMatch(/grid-column:\s*1 \/ -1/)
    expect(rule).toMatch(/grid-row:\s*1 \/ -1/)
    expect(rule).toMatch(/grid-template-columns:\s*subgrid/)
    expect(rule).toMatch(/grid-template-rows:\s*subgrid/)
    expect(rule).toMatch(/z-index:\s*0/)
    expect(rule).toMatch(/pointer-events:\s*none/)
    // Any containment makes Chrome drop the subgrid (measured in prompt 53).
    expect(rule).toMatch(/contain:\s*none/)
  })
})
