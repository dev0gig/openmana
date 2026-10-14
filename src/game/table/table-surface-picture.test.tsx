/*
 * A picture instead of the drawn table (table-background.ts, 2026-10-12):
 * with a picture chosen, the surface is that picture over the whole board -
 * one per orientation for a built-in one, the player's own as it is - and no
 * desk, board or ring is drawn; still first in the board, hidden from screen
 * readers and taking no pointer events.
 */
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences"
import { tableScene } from "@/test/table-scenes"
import { GameTable } from "../game-table"
import { NO_PICTURES } from "../table-cards"

let preferences: Preferences = DEFAULT_PREFERENCES

vi.mock("@/app/preferences", async (original) => ({
  ...(await original<typeof import("@/app/preferences")>()),
  usePreferences: () => preferences,
}))

const PICTURE = "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA="

function table() {
  const scene = tableScene("main-phase")
  return <GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={null} />
}

class QuietResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe("TableSurface with a picture", () => {
  beforeEach(() => vi.stubGlobal("ResizeObserver", QuietResizeObserver))
  afterEach(() => {
    vi.unstubAllGlobals()
    preferences = DEFAULT_PREFERENCES
  })

  const surfaceOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-slot="table-surface"]')!

  it("by default (prompt 53) the arena, no desk and no picture; the drawn table when chosen: desk, board and ring", () => {
    const { container, unmount } = render(table())
    expect(surfaceOf(container).dataset["background"]).toBe("arena")
    expect(surfaceOf(container).querySelector('[data-surface="desk"], [data-surface="picture"]')).toBeNull()
    unmount()
    preferences = { ...DEFAULT_PREFERENCES, tableBackground: "table" }
    const drawn = render(table())
    const surface = surfaceOf(drawn.container)
    expect(surface.dataset["background"]).toBeUndefined()
    expect(surface.querySelector('[data-surface="desk"]')).not.toBeNull()
    expect(surface.querySelector('[data-surface="picture"], [data-arena]')).toBeNull()
  })

  it("a built-in picture: one for windows taller than wide, one for the others; nothing drawn", () => {
    preferences = { ...DEFAULT_PREFERENCES, tableBackground: "planeswalker" }
    const { container } = render(table())
    const surface = surfaceOf(container)
    const board = container.querySelector('[data-slot="game-board"]')!
    expect([...board.children].find((child) => child.tagName !== "TITLE")).toBe(surface)
    expect(surface).toHaveAttribute("aria-hidden", "true")
    expect(surface).toHaveClass("pointer-events-none", "absolute", "inset-0")
    expect(surface.dataset["background"]).toBe("planeswalker")
    expect(surface.querySelector('[data-surface="desk"], [data-surface="board"], [data-surface="ring"]')).toBeNull()
    const source = surface.querySelector("picture > source")!
    const image = surface.querySelector<HTMLImageElement>('img[data-surface="picture"]')!
    expect(source).toHaveAttribute("media", "(max-aspect-ratio: 1/1)")
    expect(source.getAttribute("srcset")).toMatch(/planeswalker-hoch/)
    expect(image.getAttribute("src")).toMatch(/planeswalker-quer/)
    expect(image).toHaveAttribute("alt", "")
  })

  it("the player's own picture as it is; without a stored one the drawn table", () => {
    preferences = { ...DEFAULT_PREFERENCES, tableBackground: "custom", tableBackgroundImage: PICTURE }
    const { container, unmount } = render(table())
    expect(surfaceOf(container).dataset["background"]).toBe("custom")
    expect(surfaceOf(container).querySelector('img[data-surface="picture"]')).toHaveAttribute("src", PICTURE)
    unmount()
    preferences = { ...DEFAULT_PREFERENCES, tableBackground: "custom", tableBackgroundImage: null }
    const again = render(table())
    expect(surfaceOf(again.container).querySelector('[data-surface="desk"]')).not.toBeNull()
  })
})
