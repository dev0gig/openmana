/*
 * The player's hand as a fan (prompt 42, docs/design/SPIELTISCH.md §4.10; the
 * mockup's .hand, .hand-karte, .gehoben): where its cards rest and how a card
 * rises - only geometry from the hand's size and its number of cards, no game
 * data.
 *
 *  - Card size from the hand's height: a card is 1.1 times as tall as the
 *    hand (at most 11.5 rem wide) and sinks a little below its lower edge.
 *  - The cards never overlap (project owner, 2026-10-12; until then they
 *    overlapped by at least 14 %): side by side, GAP_REM apart, and where
 *    that leaves no room the cards get smaller (down to MIN_CARD px wide) -
 *    a tap lifts a card to a full card's size anyway, a long press shows it
 *    whole.
 *  - Turned and set on an arc by the number of cards: card d places from the
 *    middle turns d × min(3.2°, 24°/n) and drops d² × min(1.1 %, 8 %/n) of its
 *    height, around its bottom centre; the outer cards' turn is kept clear of
 *    the hand's sides.
 *  - Lifted (under the mouse, the thumb or the keyboard's focus): upright,
 *    1.12 times the size of a full card - also when the fan made the cards
 *    smaller -, its bottom 0.4 rem above the hand's lower edge, so it stands
 *    whole above the hand (over the strips; the hand clips only downwards).
 *  - Dragged out of the hand (prompt 46): a lifted full card's size, upright.
 *  - More cards than even small ones fit (some 13 on a phone): a row that
 *    scrolls sideways (mode "row"), cards that fit the hand's height and rise
 *    inside it, side by side as in the fan.
 *
 * restingCardAt is the fan's choice for a pointer: the card whose resting
 * place - the card and the gap after it - lies under or nearest to it.
 * Resting places ignore the lift and the turn (layout boxes), so the choice
 * never jumps while the lifted card moves.
 */

/** A card's width : height (Magic's 63 × 88 mm). */
const CARD_RATIO = 63 / 88
/** A full card is this many times as tall as the hand (the mockup's 1.1). */
const FULL_HEIGHT = 1.1
/** The widest a hand card gets (rem; the mockup's 11.5 rem). */
const FULL_MAX_REM = 11.5
/** The room between two cards (rem, 3 px): they never overlap. */
const GAP_REM = 0.1875
/** How much of its own every card keeps in view at the least (px): WCAG 2.5.8's 24 px target - every card is whole, at least MIN_CARD wide. */
export const MIN_STRIP = 24
/** The smallest card of the fan (px wide, WCAG 2.5.8's target; a tap lifts it to a full card); below it the hand becomes a scrolling row. */
export const MIN_CARD = MIN_STRIP
/** A lifted card's size, relative to a full card. */
const LIFT_SCALE = 1.12
/** A lifted card's lower edge above the hand's lower edge (rem). */
const LIFT_GAP_REM = 0.4
/** How far a resting card sinks below the hand's lower edge (share of its height). */
const SINK = 0.09

export interface HandFanCard {
  /** Degrees, around the card's bottom centre. */
  readonly rotate: number
  /** Px downwards (the arc). */
  readonly drop: number
}

export interface HandFan {
  /** "fan": every card fits the width; "row": too many cards - a row that scrolls sideways. */
  readonly mode: "fan" | "row"
  /** A resting card's size (px). */
  readonly cardWidth: number
  readonly cardHeight: number
  /** The room before every card but the first (px; never negative - the cards do not overlap). */
  readonly gap: number
  /** How far a resting card reaches below the hand's lower edge (px). */
  readonly sink: number
  /** A lifted card: its scale (around its bottom centre) and its move upwards from its resting place (px, negative). */
  readonly lift: { readonly scale: number; readonly y: number }
  /** A card dragged out of the hand (prompt 46): a lifted full card's size (px) - also when the cards rest smaller or in a row. */
  readonly drag: { readonly width: number; readonly height: number }
  readonly cards: readonly HandFanCard[]
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * The fan for `count` cards in a hand whose content box is `box` (px). Null
 * without cards or without a size (nothing measured yet: the stylesheet's
 * defaults apply).
 */
export function handFan(count: number, box: { readonly width: number; readonly height: number }, rem = 16): HandFan | null {
  const { width, height } = box
  if (count <= 0 || width <= 0 || height <= 0) return null
  const liftGap = LIFT_GAP_REM * rem
  const gap = GAP_REM * rem
  const turn = count > 1 ? Math.min(3.2, 24 / count) : 0
  const outer = (((count - 1) / 2) * turn * Math.PI) / 180
  const full = Math.min(height * FULL_HEIGHT * CARD_RATIO, FULL_MAX_REM * rem, width)
  const drag = { width: round(LIFT_SCALE * full), height: round((LIFT_SCALE * full) / CARD_RATIO) }
  // The widest card for which all fit side by side: width = the cards + the gaps + what the outer cards' turn reaches beyond them.
  const cardWidth = Math.min(full, (width - (count - 1) * gap) / (count + (2 * Math.sin(outer)) / CARD_RATIO))
  if (cardWidth < MIN_CARD) {
    // A row: cards that rise inside the hand (it scrolls, so it cannot let them out), side by side.
    const cardHeight = (height - 2) / LIFT_SCALE
    return {
      mode: "row",
      cardWidth: round(cardHeight * CARD_RATIO),
      cardHeight: round(cardHeight),
      gap: round(gap),
      sink: 0,
      lift: { scale: LIFT_SCALE, y: -1 },
      drag,
      cards: Array.from({ length: count }, () => ({ rotate: 0, drop: 0 })),
    }
  }
  const cardHeight = cardWidth / CARD_RATIO
  const arc = Math.min(0.011, 0.08 / count)
  const sink = SINK * cardHeight
  return {
    mode: "fan",
    cardWidth: round(cardWidth),
    cardHeight: round(cardHeight),
    gap: round(gap),
    sink: round(sink),
    lift: { scale: round((LIFT_SCALE * full) / cardWidth), y: round(-(sink + liftGap)) },
    drag,
    cards: Array.from({ length: count }, (_, index) => {
      const d = index - (count - 1) / 2
      return { rotate: round(d * turn), drop: round(d * d * arc * cardHeight) }
    }),
  }
}

/**
 * The fan's choice for a pointer at x: the card whose own part of its resting
 * place - from its left edge to the next card's, the gap included - lies under x; left of the
 * first card the first, right of the last the last. `lefts` are the cards'
 * left edges from left to right (layout boxes, in the pointer's coordinates).
 * Null without cards.
 */
export function restingCardAt(lefts: readonly number[], x: number): number | null {
  if (lefts.length === 0) return null
  for (let index = lefts.length - 1; index > 0; index--) {
    if (x >= lefts[index]!) return index
  }
  return 0
}
