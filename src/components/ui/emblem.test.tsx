/*
 * The shared emblem, the wordmark and the background shimmer (series
 * openmana-menuestil, prompt 57): decoration only - hidden from screen
 * readers, never focusable, never in the way of a click - and one drawing of
 * the emblem for the app and the game table.
 */
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AppSurface } from "./app-surface"
import { Emblem, Wordmark } from "./emblem"

describe("Emblem", () => {
  it("is decoration: aria-hidden, not focusable, no pointer, a slot and the caller's size", () => {
    const { container } = render(<Emblem className="size-8" />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("data-slot", "emblem")
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg).toHaveAttribute("focusable", "false")
    expect(svg).toHaveAttribute("viewBox", "0 0 100 100")
    expect(svg).toHaveClass("size-8", "pointer-events-none")
    expect(svg.querySelector("[tabindex], a, button")).toBeNull()
  })

  it("draws the table's compass in its own gold: every instance its own gradient, used by its shapes", () => {
    const { container } = render(
      <>
        <Emblem />
        <Emblem />
      </>,
    )
    const ids = [...container.querySelectorAll("svg[data-slot='emblem']")].map((svg) => {
      const gradient = svg.querySelector("linearGradient")!
      const id = gradient.getAttribute("id")!
      expect(id).toMatch(/^[\w-]+$/)
      // The table's gold: --table-gold-light over --primary to --table-gold-dark.
      expect([...gradient.querySelectorAll("stop")].map((stop) => stop.getAttribute("style"))).toEqual([
        "stop-color: var(--table-gold-light);",
        "stop-color: var(--primary);",
        "stop-color: var(--table-gold-dark);",
      ])
      // The ring, the dotted ring, the star and the hub's rim are gold; the inner star and the hub night blue.
      expect(svg.querySelectorAll(`[stroke="url(#${id})"], [fill="url(#${id})"]`)).toHaveLength(4)
      return id
    })
    expect(new Set(ids).size).toBe(2)
  })
})

describe("Wordmark", () => {
  it("is the logotype OpenMana in the heading font, hidden from screen readers", () => {
    const { container } = render(<Wordmark className="text-xl" />)
    const mark = container.querySelector("[data-slot='wordmark']")!
    expect(mark).toHaveTextContent("OpenMana")
    expect(mark).toHaveAttribute("aria-hidden", "true")
    expect(mark).toHaveClass("font-heading", "bg-clip-text", "text-transparent", "text-xl")
  })
})

describe("AppSurface", () => {
  it("is decoration behind everything: aria-hidden, no pointer, fixed to the window, nothing focusable", () => {
    const { container } = render(<AppSurface />)
    const surface = container.querySelector("[data-slot='app-surface']")!
    expect(surface).toHaveAttribute("aria-hidden", "true")
    // Fixed to the window (takes no room, never grows or scrolls a page), under the content, no clicks.
    expect(surface).toHaveClass("pointer-events-none", "fixed", "inset-0", "z-0", "overflow-hidden")
    expect(surface.querySelector("[tabindex], a, button, input")).toBeNull()
    expect(surface.querySelector("svg")).toHaveAttribute("focusable", "false")
  })

  it("draws the template's light and two pairs of golden swings, still", () => {
    const { container } = render(<AppSurface />)
    const surface = container.querySelector("[data-slot='app-surface']")!
    expect(surface.querySelectorAll("radialGradient")).toHaveLength(2)
    const swings = surface.querySelectorAll("path")
    expect(swings).toHaveLength(4)
    for (const swing of swings) expect(swing).toHaveAttribute("vector-effect", "non-scaling-stroke")
    // No motion: nothing animates.
    expect(surface.querySelector("animate, animateTransform, animateMotion, set")).toBeNull()
    expect(surface.outerHTML).not.toMatch(/animate-|transition/)
  })
})
