/*
 * The fan's gestures with dragging (prompt 46, useFanPress): a finger that
 * leaves the hand clearly upwards drags the lifted card, a sideways swipe
 * only lifts, a long press only looks; the mouse drags beyond its slop. A
 * drag ends where it is released, or is cancelled - by Escape, a second
 * finger or pointercancel - and nothing else comes of it (no tap, no look,
 * its click swallowed). Built cards on a built row: what the hook decides,
 * without the table (the table's drops: card-interaction.test.tsx).
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DRAG_START_PX, LONG_PRESS_MS, useFanPress, type FanDrag, type PressPoint } from "./use-card-press"

let clock = 10_000
beforeEach(() => {
  clock = 10_000
  vi.spyOn(performance, "now").mockImplementation(() => clock)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** Three cards side by side, each 40 px of the row: card a at 0-40, b at 40-80, c at 80-120. */
const CARDS = ["a", "b", "c"] as const
const at = (card: (typeof CARDS)[number]) => CARDS.indexOf(card) * 40 + 20

function setup({ draggable = true }: { draggable?: boolean } = {}) {
  const calls: string[] = []
  const lifts: (string | null)[] = []
  const onPrimary = vi.fn<(card: string) => void>()
  const onLook = vi.fn<(card: string) => void>()
  const start = vi.fn<(card: string, point: PressPoint, pointer: "mouse" | "touch" | "pen") => boolean>(() => draggable)
  const move = vi.fn<(point: PressPoint) => void>()
  const end = vi.fn<(point: PressPoint | null) => void>()
  const drag: FanDrag = { start, move, end }
  const cardClick = vi.fn<(card: string) => void>()
  function Row() {
    const handlers = useFanPress({
      pick: (x, target) => {
        if (target instanceof Element) return target.closest<HTMLElement>("[data-card]")?.dataset["card"] ?? null
        return CARDS[Math.max(0, Math.min(CARDS.length - 1, Math.floor(x / 40)))]!
      },
      onLift: (card) => {
        lifts.push(card)
      },
      onPrimary,
      onLook,
      drag,
    })
    return (
      <div data-testid="row" {...handlers}>
        {CARDS.map((card) => (
          <button key={card} type="button" data-card={card} onClick={() => cardClick(card)}>
            {card}
          </button>
        ))}
      </div>
    )
  }
  render(<Row />)
  const card = (name: string) => screen.getByRole("button", { name })
  return { calls, lifts, onPrimary, onLook, start, move, end, cardClick, card }
}

const touch = { pointerType: "touch", pointerId: 1 } as const
const mouse = { pointerType: "mouse", pointerId: 1, button: 0, buttons: 1 } as const

describe("dragging a card out of the fan (prompt 46)", () => {
  it("a finger moving clearly upwards drags the lifted card: start, moves, release where it is let go - no tap, its click swallowed", () => {
    const { start, move, end, onPrimary, onLook, cardClick, card } = setup()
    fireEvent.pointerDown(card("b"), { ...touch, clientX: at("b"), clientY: 300 })
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b") + 2, clientY: 300 - 12 })
    expect(start).not.toHaveBeenCalled()
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b") + 4, clientY: 300 - DRAG_START_PX - 2 })
    expect(start).toHaveBeenCalledExactlyOnceWith("b", { x: at("b") + 4, y: 300 - DRAG_START_PX - 2 }, "touch")
    fireEvent.pointerMove(card("b"), { ...touch, clientX: 200, clientY: 100 })
    expect(move).toHaveBeenLastCalledWith({ x: 200, y: 100 })
    fireEvent.pointerUp(card("b"), { ...touch, clientX: 200, clientY: 90 })
    expect(end).toHaveBeenCalledExactlyOnceWith({ x: 200, y: 90 })
    fireEvent.click(card("b"))
    expect(cardClick).not.toHaveBeenCalled()
    expect(onPrimary).not.toHaveBeenCalled()
    expect(onLook).not.toHaveBeenCalled()
  })

  it("a sideways swipe only lifts; upwards but less than the threshold, or more sideways than up, drags nothing", () => {
    const { start, lifts, onPrimary, card } = setup()
    fireEvent.pointerDown(card("a"), { ...touch, clientX: at("a"), clientY: 300 })
    fireEvent.pointerMove(card("a"), { ...touch, clientX: at("c"), clientY: 300 })
    expect(lifts.at(-1)).toBe("c")
    // From where card c rose: 20 px up only.
    fireEvent.pointerMove(card("a"), { ...touch, clientX: at("c"), clientY: 300 - DRAG_START_PX + 4 })
    fireEvent.pointerUp(card("a"), touch)
    fireEvent.click(card("a"))
    expect(start).not.toHaveBeenCalled()
    expect(onPrimary).not.toHaveBeenCalled()
    // Diagonal, more sideways than up.
    clock += 1000
    fireEvent.pointerDown(card("a"), { ...touch, pointerId: 2, clientX: 5, clientY: 300 })
    fireEvent.pointerMove(card("a"), { ...touch, pointerId: 2, clientX: 5 + 34, clientY: 300 - 30 })
    fireEvent.pointerUp(card("a"), { ...touch, pointerId: 2 })
    expect(start).not.toHaveBeenCalled()
  })

  it("a swipe, then up: the card the finger reached is dragged, measured from where it rose", () => {
    const { start, card } = setup()
    fireEvent.pointerDown(card("a"), { ...touch, clientX: at("a"), clientY: 300 })
    fireEvent.pointerMove(card("a"), { ...touch, clientX: at("c"), clientY: 304 })
    fireEvent.pointerMove(card("a"), { ...touch, clientX: at("c") + 3, clientY: 304 - DRAG_START_PX - 3 })
    expect(start).toHaveBeenCalledExactlyOnceWith("c", expect.anything(), "touch")
  })

  it("a long press looks and never drags afterwards", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { start, onLook, card } = setup()
    fireEvent.pointerDown(card("b"), { ...touch, clientX: at("b"), clientY: 300 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(onLook).toHaveBeenCalledExactlyOnceWith("b")
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b"), clientY: 200 })
    fireEvent.pointerUp(card("b"), touch)
    expect(start).not.toHaveBeenCalled()
  })

  it("a drag ends the long press: holding still while dragging looks at nothing", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { onLook, end, card } = setup()
    fireEvent.pointerDown(card("b"), { ...touch, clientX: at("b"), clientY: 300 })
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b"), clientY: 250 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2))
    expect(onLook).not.toHaveBeenCalled()
    fireEvent.pointerUp(card("b"), { ...touch, clientX: at("b"), clientY: 250 })
    expect(end).toHaveBeenCalledExactlyOnceWith({ x: at("b"), y: 250 })
  })

  it("the browser's pointercancel cancels the drag (end with null), once", () => {
    const { end, onPrimary, card } = setup()
    fireEvent.pointerDown(card("b"), { ...touch, clientX: at("b"), clientY: 300 })
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b"), clientY: 240 })
    fireEvent.pointerCancel(card("b"), touch)
    fireEvent.pointerUp(card("b"), touch)
    expect(end).toHaveBeenCalledExactlyOnceWith(null)
    expect(onPrimary).not.toHaveBeenCalled()
  })

  it("Escape cancels the drag; the release after it does nothing and its click is swallowed", () => {
    const { end, move, onPrimary, cardClick, card } = setup()
    fireEvent.pointerDown(card("b"), { ...touch, clientX: at("b"), clientY: 300 })
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b"), clientY: 240 })
    fireEvent.keyDown(window, { key: "Escape" })
    expect(end).toHaveBeenCalledExactlyOnceWith(null)
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b"), clientY: 100 })
    expect(move).not.toHaveBeenCalledWith({ x: at("b"), y: 100 })
    fireEvent.pointerUp(card("b"), { ...touch, clientX: at("b"), clientY: 100 })
    fireEvent.click(card("b"))
    expect(end).toHaveBeenCalledTimes(1)
    expect(onPrimary).not.toHaveBeenCalled()
    expect(cardClick).not.toHaveBeenCalled()
  })

  it("a second finger cancels the drag - and a press that was no drag yet: no tap, no look", () => {
    const { end, onPrimary, onLook, card } = setup()
    fireEvent.pointerDown(card("b"), { ...touch, clientX: at("b"), clientY: 300 })
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b"), clientY: 240 })
    fireEvent.pointerDown(card("c"), { ...touch, pointerId: 2, clientX: at("c"), clientY: 300 })
    expect(end).toHaveBeenCalledExactlyOnceWith(null)
    fireEvent.pointerUp(card("c"), { ...touch, pointerId: 2 })
    fireEvent.pointerUp(card("b"), touch)
    fireEvent.click(card("b"))
    // Two fingers laid on the hand without moving: nothing.
    clock += 1000
    fireEvent.pointerDown(card("a"), { ...touch, pointerId: 3, clientX: at("a"), clientY: 300 })
    fireEvent.pointerDown(card("c"), { ...touch, pointerId: 4, clientX: at("c"), clientY: 300 })
    fireEvent.pointerUp(card("c"), { ...touch, pointerId: 4 })
    fireEvent.pointerUp(card("a"), { ...touch, pointerId: 3 })
    fireEvent.click(card("a"))
    expect(onPrimary).not.toHaveBeenCalled()
    expect(onLook).not.toHaveBeenCalled()
    expect(end).toHaveBeenCalledTimes(1)
  })

  it("where the hand does not drag the card (start says no), the press goes on as a swipe", () => {
    const { start, onPrimary, lifts, card } = setup({ draggable: false })
    fireEvent.pointerDown(card("b"), { ...touch, clientX: at("b"), clientY: 300 })
    fireEvent.pointerMove(card("b"), { ...touch, clientX: at("b"), clientY: 240 })
    expect(start).toHaveBeenCalled()
    expect(lifts.at(-1)).toBe("b")
    fireEvent.pointerUp(card("b"), touch)
    fireEvent.click(card("b"))
    expect(onPrimary).not.toHaveBeenCalled()
  })

  it("the mouse drags the card it pressed beyond its slop, in any direction; its click after the drag is swallowed", () => {
    const { start, move, end, cardClick, card } = setup()
    fireEvent.pointerDown(card("c"), { ...mouse, clientX: at("c"), clientY: 300 })
    fireEvent.pointerMove(card("c"), { ...mouse, clientX: at("c") + 4, clientY: 296 })
    expect(start).not.toHaveBeenCalled()
    fireEvent.pointerMove(card("c"), { ...mouse, clientX: at("c") + 30, clientY: 290 })
    expect(start).toHaveBeenCalledExactlyOnceWith("c", { x: at("c") + 30, y: 290 }, "mouse")
    fireEvent.pointerMove(card("c"), { ...mouse, clientX: 300, clientY: 80 })
    expect(move).toHaveBeenLastCalledWith({ x: 300, y: 80 })
    fireEvent.pointerUp(card("c"), { ...mouse, buttons: 0, clientX: 300, clientY: 80 })
    expect(end).toHaveBeenCalledExactlyOnceWith({ x: 300, y: 80 })
    fireEvent.click(card("c"))
    expect(cardClick).not.toHaveBeenCalled()
  })

  it("a mouse click without moving stays the card's own; Escape cancels a mouse drag and its click is swallowed too", () => {
    const { start, end, cardClick, lifts, card } = setup()
    fireEvent.pointerDown(card("a"), { ...mouse, clientX: at("a"), clientY: 300 })
    fireEvent.pointerUp(card("a"), { ...mouse, buttons: 0, clientX: at("a"), clientY: 300 })
    fireEvent.click(card("a"))
    expect(cardClick).toHaveBeenCalledExactlyOnceWith("a")
    expect(start).not.toHaveBeenCalled()
    // Hovering (no button) still lifts.
    fireEvent.pointerMove(card("b"), { pointerType: "mouse", pointerId: 1, buttons: 0, clientX: at("b"), clientY: 300 })
    expect(lifts.at(-1)).toBe("b")
    fireEvent.pointerDown(card("b"), { ...mouse, clientX: at("b"), clientY: 300 })
    fireEvent.pointerMove(card("b"), { ...mouse, clientX: at("b"), clientY: 200 })
    fireEvent.keyDown(window, { key: "Escape" })
    expect(end).toHaveBeenCalledExactlyOnceWith(null)
    fireEvent.pointerUp(card("b"), { ...mouse, buttons: 0, clientX: at("b"), clientY: 200 })
    fireEvent.click(card("b"))
    expect(cardClick).toHaveBeenCalledTimes(1)
  })

  it("a right button or a mouse moved without its button drags nothing", () => {
    const { start, card } = setup()
    fireEvent.pointerDown(card("a"), { ...mouse, button: 2, buttons: 2, clientX: at("a"), clientY: 300 })
    fireEvent.pointerMove(card("a"), { ...mouse, buttons: 2, clientX: at("a"), clientY: 200 })
    fireEvent.pointerMove(card("a"), { pointerType: "mouse", pointerId: 1, buttons: 0, clientX: at("a"), clientY: 100 })
    expect(start).not.toHaveBeenCalled()
  })
})
