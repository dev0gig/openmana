/*
 * A sideways swipe of one finger (prompt 50): the card view browses with it -
 * a swipe to the left shows the next card, to the right the previous one.
 * Looking only; what a swipe does is the caller's (never a tap, never an
 * answer).
 *
 * Told apart from everything else a finger does on the card:
 *  - scrolling up and down: the element lets the browser pan vertically
 *    (`touch-action: pan-y pinch-zoom` - the caller's class SWIPE_TOUCH), the
 *    browser then cancels the pointer (pointercancel) and nothing happens; a
 *    movement that is not clearly sideways (at least SWIPE_MIN_PX, twice as
 *    far sideways as up or down) is no swipe either;
 *  - reading the picture with two fingers (pinch): a second finger cancels the
 *    swipe for as long as any finger stays down;
 *  - the system's back gesture: a touch that begins within SWIPE_EDGE_PX of
 *    the screen's left or right edge is the system's, never a swipe;
 *  - a long press: a finger held still for LONG_PRESS_MS (the card press's
 *    long press) is no swipe, whatever it does afterwards;
 *  - the mouse: it has the buttons and the keyboard's arrows; only touch and
 *    pen swipe.
 * The click a browser may send after the swipe's release (at the place the
 * finger let go - perhaps a button of the view) is swallowed.
 */
import { useEffect, useRef, type PointerEvent } from "react"
import { LONG_PRESS_MS } from "./use-card-press"

/** A swipe moves at least this far sideways (px). */
export const SWIPE_MIN_PX = 48
/** A touch that begins this close to the screen's left or right edge (px) is the system's back gesture. */
export const SWIPE_EDGE_PX = 24
/** The click after a swipe's release comes at once; it is swallowed this long (ms). */
const CLICK_AFTER_SWIPE_MS = 400
/** A finger that moves farther than this (px) is no longer held still (no long press). */
const STILL_PX = 10

/** The classes an element needs so the browser leaves sideways moves to the swipe and keeps vertical panning and pinching. */
export const SWIPE_TOUCH = "touch-pan-y touch-pinch-zoom"

export type SwipeDirection = "next" | "previous"

/** A finger's way from where it was laid on to where it let go: a swipe to the left (next), to the right (previous), or none. */
export function swipeDirection(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return null
  return dx < 0 ? "next" : "previous"
}

/** Whether a touch beginning at x (client px) lies on the system's edge for a screen this wide. */
export function onScreenEdge(x: number, width: number): boolean {
  return x < SWIPE_EDGE_PX || x > width - SWIPE_EDGE_PX
}

export interface SwipeHandlers {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void
}

interface Track {
  readonly pointer: number
  readonly x: number
  readonly y: number
  /** Not a swipe any more (a second finger, a long press). */
  void: boolean
  still: boolean
}

/** Swallows the next click for a moment (the release of a swipe) - not one that follows a new press. */
function swallowClick(): void {
  const swallow = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  }
  const stop = () => {
    window.removeEventListener("click", swallow, { capture: true })
    window.removeEventListener("pointerdown", stop, { capture: true })
  }
  window.addEventListener("click", swallow, { capture: true, once: true })
  window.addEventListener("pointerdown", stop, { capture: true, once: true })
  setTimeout(stop, CLICK_AFTER_SWIPE_MS)
}

/** Handlers for the element a finger swipes on; `onSwipe` null: no swipe (nothing to browse). */
export function useSwipe(onSwipe: ((direction: SwipeDirection) => void) | null): SwipeHandlers {
  const track = useRef<Track | null>(null)
  // Fingers down on the element now: more than one is a pinch.
  const fingers = useRef(new Set<number>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(onSwipe)
  useEffect(() => {
    latest.current = onSwipe
  })
  const stopTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stopTimer, [])
  const lift = (event: PointerEvent<HTMLElement>) => {
    fingers.current.delete(event.pointerId)
    if (track.current?.pointer === event.pointerId) {
      track.current = null
      stopTimer()
    }
  }
  return {
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") return
      fingers.current.add(event.pointerId)
      if (fingers.current.size > 1) {
        // A second finger: a pinch, never a swipe.
        if (track.current !== null) track.current.void = true
        stopTimer()
        return
      }
      if (latest.current === null || onScreenEdge(event.clientX, window.innerWidth)) {
        track.current = null
        return
      }
      const started: Track = { pointer: event.pointerId, x: event.clientX, y: event.clientY, void: false, still: true }
      track.current = started
      stopTimer()
      timer.current = setTimeout(() => {
        timer.current = null
        // Held still: a long press, never a swipe.
        if (track.current === started && started.still) started.void = true
      }, LONG_PRESS_MS)
    },
    onPointerMove: (event) => {
      const current = track.current
      if (current === null || current.pointer !== event.pointerId || !current.still) return
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > STILL_PX) {
        current.still = false
        stopTimer()
      }
    },
    onPointerUp: (event) => {
      const current = track.current
      const many = fingers.current.size > 1
      lift(event)
      if (current === null || current.pointer !== event.pointerId || current.void || many) return
      const direction = swipeDirection(event.clientX - current.x, event.clientY - current.y)
      if (direction === null || latest.current === null) return
      swallowClick()
      latest.current(direction)
    },
    // The browser took the touch over (vertical panning, a pinch, the system's gesture): no swipe.
    onPointerCancel: lift,
  }
}
