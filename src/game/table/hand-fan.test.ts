// @vitest-environment node
/*
 * The fanned hand's geometry (prompt 42, hand-fan.ts): cards sized by the
 * hand's height, side by side and never overlapping (2026-10-12),
 * smaller cards when there are many, a scrolling row only when even small
 * ones do not fit; the lifted card at a full card's size; the choice of a
 * pointer by the cards' resting places.
 */
import { describe, expect, it } from "vitest"
import { handFan, MIN_CARD, MIN_STRIP, restingCardAt, type HandFan } from "./hand-fan"

/** The width the fan takes: the cards side by side plus what the outer cards' turn reaches beyond them. */
function used(fan: HandFan): number {
  const count = fan.cards.length
  const outer = (Math.abs(fan.cards[0]!.rotate) * Math.PI) / 180
  return fan.cardWidth + (count - 1) * (fan.cardWidth + fan.gap) + 2 * fan.cardHeight * Math.sin(outer)
}

describe("handFan", () => {
  it("three cards on a phone (412 px wide, a hand of 127 px): full cards 1.1 times the hand's height, side by side, sinking below the edge", () => {
    const fan = handFan(3, { width: 396, height: 127 })!
    expect(fan.mode).toBe("fan")
    expect(fan.cardHeight).toBeCloseTo(127 * 1.1, 1)
    expect(fan.cardWidth).toBeCloseTo((127 * 1.1 * 63) / 88, 1)
    expect(fan.gap).toBe(3)
    expect(used(fan)).toBeLessThanOrEqual(396 + 0.1)
    expect(fan.sink).toBeCloseTo(fan.cardHeight * 0.09, 1)
    // The lifted card: a full card's 1.12, its lower edge 0.4 rem above the hand's.
    expect(fan.lift).toEqual({ scale: 1.12, y: -Math.round((fan.sink + 6.4) * 100) / 100 })
  })

  it("seven cards on a phone: smaller cards that fit the width side by side, never overlapping; the lifted card at a full card's size", () => {
    const fan = handFan(7, { width: 396, height: 127 })!
    expect(fan.mode).toBe("fan")
    expect(fan.cardWidth).toBeLessThan((127 * 1.1 * 63) / 88)
    expect(fan.cardWidth).toBeGreaterThanOrEqual(MIN_CARD)
    expect(fan.gap).toBeGreaterThan(0)
    expect(used(fan)).toBeCloseTo(396, 0)
    expect(fan.lift.scale * fan.cardWidth).toBeCloseTo(1.12 * ((127 * 1.1 * 63) / 88), 0)
  })

  it("turns and drops the cards symmetrically around the middle: d × min(3.2°, 24°/n) and d² × min(1.1 %, 8 %/n) of a card's height", () => {
    const fan = handFan(7, { width: 900, height: 160 })!
    expect(fan.cards.map((card) => card.rotate)).toEqual([-9.6, -6.4, -3.2, 0, 3.2, 6.4, 9.6])
    expect(fan.cards[3]!.drop).toBe(0)
    expect(fan.cards[0]!.drop).toBeCloseTo(9 * 0.011 * fan.cardHeight, 1)
    expect(fan.cards[0]!.drop).toBe(fan.cards[6]!.drop)
    const many = handFan(12, { width: 2000, height: 160 })!
    expect(many.cards[0]!.rotate).toBeCloseTo(-5.5 * 2, 5)
  })

  it("turned on the arc, neighbouring cards still do not touch: their facing edges part upwards from a gap at the bottom", () => {
    for (const count of [2, 5, 7, 10]) {
      const fan = handFan(count, { width: 396, height: 127 })!
      for (let index = 0; index + 1 < count; index++) {
        const left = (fan.cards[index]!.rotate * Math.PI) / 180
        const right = (fan.cards[index + 1]!.rotate * Math.PI) / 180
        // Bottom corners, relative to each card's bottom centre (turned around it), the right card one step further.
        const step = fan.cardWidth + fan.gap
        const leftCorner = (fan.cardWidth / 2) * Math.cos(left)
        const rightCorner = step - (fan.cardWidth / 2) * Math.cos(right)
        expect(rightCorner - leftCorner).toBeGreaterThan(0)
        // Upwards the right card's left edge leans right at least as much as the left card's right edge.
        expect(Math.sin(right)).toBeGreaterThanOrEqual(Math.sin(left))
      }
    }
  })

  it("more cards than even small ones fit: a scrolling row, cards that rise inside the hand, side by side", () => {
    const fan = handFan(16, { width: 344, height: 103 })!
    expect(fan.mode).toBe("row")
    expect(fan.sink).toBe(0)
    expect(fan.gap).toBeGreaterThan(0)
    expect(fan.cards.every((card) => card.rotate === 0 && card.drop === 0)).toBe(true)
    // Lifted it stays inside the hand: 1.12 times its height and 1 px up still fit.
    expect(fan.cardHeight * fan.lift.scale - fan.lift.y).toBeLessThanOrEqual(103)
  })

  it("one card: full size, upright, in the middle; no cards or no size: nothing to arrange", () => {
    const one = handFan(1, { width: 400, height: 120 })!
    expect(one.cards).toEqual([{ rotate: 0, drop: 0 }])
    expect(one.cardWidth).toBeCloseTo((120 * 1.1 * 63) / 88, 1)
    expect(handFan(0, { width: 400, height: 120 })).toBeNull()
    expect(handFan(3, { width: 0, height: 120 })).toBeNull()
  })

  it("every count up to 30 on the smallest phone: whole cards of at least 24 px, never overlapping, fitting the width as a fan", () => {
    for (let count = 2; count <= 30; count++) {
      const fan = handFan(count, { width: 344, height: 103 })!
      expect(fan.cardWidth).toBeGreaterThanOrEqual(MIN_STRIP)
      expect(fan.gap).toBeGreaterThan(0)
      if (fan.mode === "fan") expect(used(fan)).toBeLessThanOrEqual(344 + 0.1)
    }
    // Up to twelve cards stay a fan there.
    expect(handFan(12, { width: 344, height: 103 })!.mode).toBe("fan")
  })
})

describe("restingCardAt: the card whose own part of its resting place lies under the pointer", () => {
  const lefts = [100, 140, 180, 220]
  it("from a card's left edge to the next card's is that card's; the last card's is all of it", () => {
    expect(restingCardAt(lefts, 100)).toBe(0)
    expect(restingCardAt(lefts, 139.9)).toBe(0)
    expect(restingCardAt(lefts, 140)).toBe(1)
    expect(restingCardAt(lefts, 219)).toBe(2)
    expect(restingCardAt(lefts, 300)).toBe(3)
  })

  it("beside the hand the nearest end; no cards, no card", () => {
    expect(restingCardAt(lefts, 0)).toBe(0)
    expect(restingCardAt(lefts, 5000)).toBe(3)
    expect(restingCardAt([], 10)).toBeNull()
  })
})
