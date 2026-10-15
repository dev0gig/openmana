/*
 * OpenMana's own mana symbols in a text (2026-10-15): the words stay as they
 * are, each known symbol is a picture named in words, a run of symbols stays
 * on one line, unknown symbols stay as written.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ManaLegend, MANA_LEGEND } from "@/components/mana-legend"
import { ManaSymbol, ManaText } from "./mana-symbol"

describe("ManaText", () => {
  it("draws the symbols of a cost and names them in words", () => {
    const { container } = render(<p>Zahle die Spruchkosten: <ManaText text="{2}{U}" /></p>)
    expect(screen.getByRole("img", { name: "2 beliebig" })).toHaveAttribute("data-symbol", "2")
    expect(screen.getByRole("img", { name: "Blau" })).toHaveAttribute("data-slot", "mana-symbol")
    expect(container.querySelectorAll('[data-slot="mana-symbols"]')).toHaveLength(1)
    expect(container.textContent).not.toContain("{")
  })

  it("keeps words and unknown symbols as written", () => {
    const { container } = render(<p><ManaText text="Zahle {H} oder {T}: nichts" /></p>)
    expect(container.textContent).toBe("Zahle {H} oder Tappen: nichts")
    expect(screen.getAllByRole("img")).toHaveLength(1)
    const plain = render(<p><ManaText text="Grizzlybären" /></p>)
    expect(plain.container.querySelector("svg")).toBeNull()
  })

  it("hides decorative symbols where the words stand beside them", () => {
    const { container } = render(<span><ManaText text="{G/P}" decorative /></span>)
    expect(screen.queryByRole("img")).toBeNull()
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })

  it("draws hybrid and phyrexian symbols without ids that could clash", () => {
    const { container } = render(<><ManaSymbol symbol="W/U" /><ManaSymbol symbol="W/U" /><ManaSymbol symbol="W/U/P" /></>)
    expect(container.querySelectorAll("[id]")).toHaveLength(0)
    expect(screen.getByRole("img", { name: "Weiß oder Blau oder Leben" })).toBeInTheDocument()
  })
})

describe("ManaLegend", () => {
  it("lists every sign with its meaning in Magic", () => {
    render(<ManaLegend />)
    const rows = screen.getAllByRole("listitem")
    expect(rows).toHaveLength(MANA_LEGEND.length)
    expect(screen.getByText("Wellen").closest('[data-slot="mana-legend-row"]')).toHaveTextContent("Blaues Mana")
    expect(screen.getByText("Herz").closest('[data-slot="mana-legend-row"]')).toHaveTextContent("Phyrexanisches Mana – ein Mana dieser Farbe oder 2 Lebenspunkte")
  })
})
