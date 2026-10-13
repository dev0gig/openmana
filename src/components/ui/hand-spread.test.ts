/* The start hand's grid (prompt 50): every card whole, side by side and below each other, as large as the room allows. */
import { describe, expect, it } from "vitest"
import { CARD_RATIO } from "./card-lightbox"
import { HAND_SPREAD_GAP, HAND_SPREAD_MAX, HAND_SPREAD_MIN, handSpreadFit } from "./hand-spread"

/** The cards' room at a size: what the panel leaves (header about 76 px, footer about 132 px, 16 px each side). */
const room = (width: number, height: number) => ({ width: width - 32, height: height - 76 - 132 - 16 })

function fits(input: { width: number; height: number; count: number; extra?: number }) {
  const fit = handSpreadFit(input)
  const rows = Math.ceil(input.count / fit.columns)
  const usedWidth = fit.columns * fit.card + (fit.columns - 1) * HAND_SPREAD_GAP
  const usedHeight = rows * (fit.card / CARD_RATIO + (input.extra ?? 0)) + (rows - 1) * HAND_SPREAD_GAP
  return { fit, rows, usedWidth, usedHeight }
}

describe("handSpreadFit", () => {
  it.each([
    ["small phone", 360, 740],
    ["phone", 412, 915],
    ["folded foldable", 480, 1040],
    ["foldable open", 870, 960],
    ["foldable open turned", 960, 870],
    ["tablet", 884, 1104],
    ["desktop", 1440, 900],
  ])("seven cards whole without overlapping and without scrolling: %s", (_name, width, height) => {
    const box = room(width, height)
    const { fit, usedWidth, usedHeight } = fits({ ...box, count: 7 })
    expect(fit.scroll).toBe(false)
    expect(fit.card).toBeGreaterThanOrEqual(HAND_SPREAD_MIN)
    expect(usedWidth).toBeLessThanOrEqual(box.width)
    expect(usedHeight).toBeLessThanOrEqual(box.height + 0.5)
  })

  it("the largest cards: no other number of columns gives wider ones", () => {
    const box = room(412, 915)
    const best = handSpreadFit({ ...box, count: 7 })
    for (let columns = 1; columns <= 7; columns++) {
      const rows = Math.ceil(7 / columns)
      const card = Math.floor(Math.min((box.width - (columns - 1) * HAND_SPREAD_GAP) / columns, ((box.height - (rows - 1) * HAND_SPREAD_GAP) / rows) * CARD_RATIO))
      expect(card).toBeLessThanOrEqual(best.card)
    }
    expect(best).toMatchObject({ columns: 3, rows: 3 })
  })

  it("a phone turned (915 × 412): one row of seven", () => {
    expect(handSpreadFit({ ...room(915, 412), count: 7 })).toMatchObject({ columns: 7, rows: 1, scroll: false })
  })

  it("the button under each card (the choice for the bottom) is room the cards leave", () => {
    const box = room(412, 915)
    const plain = handSpreadFit({ ...box, count: 7 })
    const { fit, usedHeight } = fits({ ...box, count: 7, extra: 48 })
    expect(fit.card).toBeLessThanOrEqual(plain.card)
    expect(handSpreadFit({ ...room(915, 412), count: 7, extra: 48 }).card).toBeLessThan(handSpreadFit({ ...room(915, 412), count: 7 }).card)
    expect(usedHeight).toBeLessThanOrEqual(box.height + 0.5)
  })

  it("too low for the smallest card: the grid scrolls, cards stay whole and at least the smallest size, columns fit the width", () => {
    const box = { width: 600, height: 120 }
    const { fit, usedWidth } = fits({ ...box, count: 9 })
    expect(fit.scroll).toBe(true)
    expect(fit.card).toBeGreaterThanOrEqual(HAND_SPREAD_MIN)
    expect(usedWidth).toBeLessThanOrEqual(box.width)
  })

  it("never larger than the largest card; nothing for an empty hand or no room", () => {
    expect(handSpreadFit({ width: 3000, height: 3000, count: 1 }).card).toBe(HAND_SPREAD_MAX)
    expect(handSpreadFit({ width: 400, height: 400, count: 0 }).card).toBe(0)
    expect(handSpreadFit({ width: 0, height: 0, count: 7 }).card).toBe(0)
  })
})
