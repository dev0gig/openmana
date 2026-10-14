/*
 * The decision region's frame (prompt 15): the asking card's sizes
 * (GameDecisionSource, data-size - project owner, 2026-10-14: a spell being
 * cast large, an ability's source as the thumbnail) and the spotlight that
 * holds a large card beside or above its words. jsdom has no layout: the
 * sizes are read from the classes; the real browser places them in the
 * end-to-end test (decisionFits, checkTableArrangement).
 */
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { GameDecisionActions, GameDecisionRow, GameDecisionSource, GameDecisionSpotlight, GameDecisionSpotlightContent } from "./game-decision"

const classesOf = (element: Element) => element.className.split(/\s+/)

describe("GameDecisionSource", () => {
  it("is the thumbnail beside Forge's words by default", () => {
    const { container } = render(<GameDecisionSource />)
    const source = container.firstElementChild!
    expect(source).toHaveAttribute("data-slot", "game-decision-source")
    expect(source).toHaveAttribute("data-size", "sm")
    expect(classesOf(source)).toEqual(expect.arrayContaining(["h-14", "shrink-0"]))
  })

  it("card: the whole card on top of the panel, sized by its height (8-11 rem wide), the thumbnail again in a low window", () => {
    const { container } = render(<GameDecisionSource size="card" />)
    const source = container.firstElementChild!
    expect(source).toHaveAttribute("data-size", "card")
    expect(classesOf(source)).toEqual(expect.arrayContaining(["h-[clamp(11rem,28dvh,15rem)]", "self-center", "short:h-14", "short:self-start"]))
    // 11-15 rem high at the card's 63 × 88: about 7.9-10.7 rem wide - inside the panel's column of at least 15 rem.
    expect((11 * 63) / 88).toBeGreaterThan(7.8)
    expect((15 * 63) / 88).toBeLessThan(15 - 1.5)
  })

  it("hand: a card of the hand's height in the action bar (the hand region's height in hoch)", () => {
    const { container } = render(<GameDecisionSource size="hand" />)
    const source = container.firstElementChild!
    expect(source).toHaveAttribute("data-size", "hand")
    expect(classesOf(source)).toEqual(expect.arrayContaining(["h-[clamp(6rem,14dvh,9rem)]", "self-start"]))
  })
})

describe("GameDecisionSpotlight", () => {
  it("vertical (the panel): the card above its words, a row again in a low window; horizontal (the action bar): the card on the left", () => {
    const vertical = render(<GameDecisionSpotlight />).container.firstElementChild!
    expect(vertical).toHaveAttribute("data-slot", "game-decision-spotlight")
    expect(vertical).toHaveAttribute("data-orientation", "vertical")
    expect(classesOf(vertical)).toEqual(expect.arrayContaining(["flex-col", "short:flex-row"]))
    const horizontal = render(<GameDecisionSpotlight orientation="horizontal" />).container.firstElementChild!
    expect(horizontal).toHaveAttribute("data-orientation", "horizontal")
    expect(classesOf(horizontal)).toEqual(expect.arrayContaining(["flex-row", "items-start"]))
  })

  it("actions and card rows inside its content keep to the content's column (no sticky bleed over the card)", () => {
    const { container } = render(
      <GameDecisionSpotlight orientation="horizontal">
        <GameDecisionSource size="hand" />
        <GameDecisionSpotlightContent>
          <GameDecisionActions />
          <GameDecisionRow />
        </GameDecisionSpotlightContent>
      </GameDecisionSpotlight>,
    )
    const actions = container.querySelector('[data-slot="game-decision-actions"]')!
    expect(classesOf(actions)).toEqual(expect.arrayContaining(["in-data-[slot=game-decision-spotlight-content]:static", "in-data-[slot=game-decision-spotlight-content]:mx-0", "in-data-[slot=game-decision-spotlight-content]:border-t-0"]))
    expect(classesOf(container.querySelector('[data-slot="game-decision-row"]')!)).toContain("in-data-[slot=game-decision-spotlight-content]:mx-0")
    expect(classesOf(container.querySelector('[data-slot="game-decision-spotlight-content"]')!)).toContain("min-w-0")
  })
})
