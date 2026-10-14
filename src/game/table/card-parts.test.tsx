/*
 * The pieces of a card on the battlefield (prompt 40, card-parts.tsx): the
 * plaque shows Forge's values as sent, a chip is a chip, and a battlefield
 * row's size counts tapped cards turned, piles with the cards behind their
 * front card and attachments with their host (the mockup's --u and --c).
 */
import type { VisibleCard } from "@openmana/engine-protocol"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { BoardEntry } from "../table-model"
import { CardChip, cardUnits, PILE_STEP, pileLayers, rowSize, SickChip, TAPPED_WIDTH, ValuePlaque } from "./card-parts"

function card(id: number, overrides: Partial<VisibleCard> = {}): VisibleCard {
  return { id, key: `Card ${id}`, name: `Card ${id}`, tapped: false, sick: false, faceDown: false, damage: 0, owner: 0, controller: 0, ...overrides }
}

function entry(first: VisibleCard, count = 1, attachments: VisibleCard[] = []): BoardEntry {
  return { kind: "card", key: String(first.id), card: first, ids: Array.from({ length: count }, (_, index) => first.id + index), attachments }
}

describe("the value plaque and the chips", () => {
  it("the plaque: Forge's power/toughness, or loyalty with the shield; hidden from screen readers", () => {
    const { container, rerender } = render(<ValuePlaque value={{ kind: "power", text: "*/1" }} />)
    const plaque = container.querySelector('[data-slot="game-card-plaque"]')!
    expect(plaque).toHaveTextContent(/^\*\/1$/)
    expect(plaque).toHaveAttribute("aria-hidden", "true")
    expect(plaque.querySelector("svg")).toBeNull()
    rerender(<ValuePlaque value={{ kind: "loyalty", text: "4" }} />)
    expect(container.querySelector('[data-slot="game-card-plaque"]')).toHaveAttribute("data-kind", "loyalty")
    expect(container.querySelector('[data-slot="game-card-plaque"] svg')).not.toBeNull()
  })

  it("a chip carries its tone", () => {
    const { container } = render(<CardChip tone="pile">×3</CardChip>)
    expect(container.firstElementChild).toHaveClass("table-card-chip")
    expect(container.firstElementChild).toHaveAttribute("data-tone", "pile")
  })

  it("summoning sickness: the hourglass in its own tone, its short word for wide cards, titled Einsatzverzögerung", () => {
    const { container } = render(<SickChip />)
    const chip = container.firstElementChild!
    expect(chip).toHaveClass("table-card-chip")
    expect(chip).toHaveAttribute("data-tone", "sick")
    expect(chip).toHaveAttribute("title", "Einsatzverzögerung")
    expect(chip.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    expect(chip.querySelector(".table-card-chip-word")).toHaveTextContent(/^verzögert$/)
  })
})

describe("a battlefield row's size", () => {
  it("a card is one card width, a tapped card lies turned, a pile shows up to two cards behind its front card", () => {
    expect(cardUnits(false)).toBe(1)
    expect(cardUnits(true)).toBeCloseTo(88 / 63)
    expect(pileLayers(1)).toBe(1)
    expect(pileLayers(2)).toBe(2)
    expect(pileLayers(13)).toBe(3)
    expect(cardUnits(false, 2)).toBeCloseTo(1 + PILE_STEP)
    expect(cardUnits(true, 13)).toBeCloseTo(TAPPED_WIDTH + 2 * PILE_STEP)
  })

  it("counts every card it draws: piles once, attachments with their host, hidden cards and the command zone's cards", () => {
    const host = card(1, { tapped: true })
    const entries: BoardEntry[] = [entry(card(10), 6), entry(host, 1, [card(2), card(3, { tapped: true })]), { kind: "hidden", key: "hidden:0" }]
    const size = rowSize(entries, 1)
    expect(size.places).toBe(1 + 1 + 3 + 1)
    expect(size.units).toBeCloseTo(1 + (1 + 2 * PILE_STEP) + TAPPED_WIDTH + 1 + TAPPED_WIDTH + 1)
    // An empty row still divides by one place.
    expect(rowSize([])).toEqual({ units: 1, places: 1 })
  })
})
