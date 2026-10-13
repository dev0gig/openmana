/* A sideways swipe of one finger (prompt 50) - and everything that is no swipe. */
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LONG_PRESS_MS } from "./use-card-press"
import { onScreenEdge, SWIPE_EDGE_PX, SWIPE_MIN_PX, swipeDirection, useSwipe, type SwipeDirection } from "./use-swipe"

describe("swipeDirection", () => {
  it("to the left: next; to the right: previous", () => {
    expect(swipeDirection(-SWIPE_MIN_PX, 0)).toBe("next")
    expect(swipeDirection(SWIPE_MIN_PX + 10, 5)).toBe("previous")
  })
  it("too short, or not clearly sideways: none", () => {
    expect(swipeDirection(-(SWIPE_MIN_PX - 1), 0)).toBeNull()
    expect(swipeDirection(-80, 41)).toBeNull()
    expect(swipeDirection(0, -200)).toBeNull()
  })
  it("the screen's edges belong to the system's back gesture", () => {
    expect(onScreenEdge(SWIPE_EDGE_PX - 1, 400)).toBe(true)
    expect(onScreenEdge(400 - SWIPE_EDGE_PX + 1, 400)).toBe(true)
    expect(onScreenEdge(200, 400)).toBe(false)
  })
})

function Probe({ onSwipe, onClick }: { onSwipe: ((direction: SwipeDirection) => void) | null; onClick: () => void }) {
  const swipe = useSwipe(onSwipe)
  return (
    <div data-testid="card" {...swipe}>
      <button type="button" onClick={onClick}>Spielen</button>
    </div>
  )
}

describe("useSwipe", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 })
  })
  afterEach(() => vi.useRealTimers())

  const setup = (enabled = true) => {
    const onSwipe = vi.fn()
    const onClick = vi.fn()
    render(<Probe onSwipe={enabled ? onSwipe : null} onClick={onClick} />)
    return { onSwipe, onClick, card: screen.getByTestId("card"), button: screen.getByRole("button") }
  }
  const down = (element: Element, x: number, y = 300, pointerId = 1, pointerType = "touch") => fireEvent.pointerDown(element, { pointerId, pointerType, clientX: x, clientY: y })
  const move = (element: Element, x: number, y = 300, pointerId = 1, pointerType = "touch") => fireEvent.pointerMove(element, { pointerId, pointerType, clientX: x, clientY: y })
  const up = (element: Element, x: number, y = 300, pointerId = 1, pointerType = "touch") => fireEvent.pointerUp(element, { pointerId, pointerType, clientX: x, clientY: y })

  it("one finger to the left: the next card, once; to the right: the previous one", () => {
    const { onSwipe, card } = setup()
    down(card, 300); move(card, 250); up(card, 200)
    expect(onSwipe).toHaveBeenCalledExactlyOnceWith("next")
    down(card, 100); move(card, 150); up(card, 220)
    expect(onSwipe).toHaveBeenLastCalledWith("previous")
    expect(onSwipe).toHaveBeenCalledTimes(2)
  })

  it("the click after the swipe's release is swallowed - it never reaches a button where the finger let go", () => {
    const { onClick, card, button } = setup()
    down(card, 300); move(card, 200); up(button, 150)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("scrolling up and down, a short move, the browser taking the touch over: nothing", () => {
    const { onSwipe, card } = setup()
    down(card, 200, 400); move(card, 190, 300); up(card, 180, 200)
    down(card, 200); up(card, 170)
    down(card, 300); move(card, 250); fireEvent.pointerCancel(card, { pointerId: 1, pointerType: "touch" }); up(card, 150)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it("a second finger (reading the picture with two fingers): no swipe, also when the first finger moves on alone", () => {
    const { onSwipe, card } = setup()
    down(card, 300, 300, 1)
    down(card, 320, 200, 2)
    move(card, 200, 300, 1)
    up(card, 330, 200, 2)
    up(card, 150, 300, 1)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it("a long press, then a move: no swipe", () => {
    const { onSwipe, card } = setup()
    down(card, 300)
    vi.advanceTimersByTime(LONG_PRESS_MS + 10)
    move(card, 200); up(card, 150)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it("from the screen's edge (the system's back gesture), with the mouse, or with nothing to browse: no swipe", () => {
    const { onSwipe, card } = setup()
    down(card, 10); move(card, 100); up(card, 200)
    down(card, 300, 300, 1, "mouse"); up(card, 100, 300, 1, "mouse")
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it("without a list it does nothing at all", () => {
    const { onClick, card, button } = setup(false)
    down(card, 300); move(card, 200); up(card, 150)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
