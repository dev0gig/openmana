/*
 * The two ways to use a card of the game table (prompt 14), as event
 * handlers for its button:
 *  - the primary activation: a click, a tap, Enter or Space;
 *  - looking at it: a long press on a touch screen, a right click, the
 *    context-menu key or Shift+F10 - the browser's contextmenu event, which
 *    is prevented, so no browser menu opens over the table. Looking never
 *    acts.
 *
 * Browsers without a contextmenu event for a long press (iOS Safari) are
 * covered by a touch or pen held still for LONG_PRESS_MS; where both come
 * (Chrome on Android), the look opens once. A press that moves (the row
 * scrolls sideways) is no press: the browser cancels the pointer and sends no
 * click (Anvil lesson: long presses and sideways rows must not fight). The
 * click some browsers still send after a long press is swallowed.
 */
import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react"

/** A touch held this long is a long press (Android's own long press takes about as long). */
export const LONG_PRESS_MS = 500

/** A touch that moves farther than this (px) scrolls; it is no press. */
const SLOP_PX = 10

/** The click a browser sends for a released touch comes at once; a later click (Enter) is a new activation. */
const CLICK_AFTER_RELEASE_MS = 400

export interface CardPressHandlers {
  readonly onClick: (event: MouseEvent<HTMLElement>) => void
  readonly onContextMenu: (event: MouseEvent<HTMLElement>) => void
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerUp: () => void
  readonly onPointerCancel: () => void
}

export function useCardPress({ onPrimary, onLook }: { readonly onPrimary: () => void; readonly onLook: () => void }): CardPressHandlers {
  // The touch or pen press on its way: where it began, whether it became a long press, when it was released.
  const press = useRef<{ x: number; y: number; long: boolean; releasedAt: number | null } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actions = useRef({ onPrimary, onLook })
  useEffect(() => {
    actions.current = { onPrimary, onLook }
  })
  const stopTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stopTimer, [])
  return {
    onClick: () => {
      const last = press.current
      press.current = null
      const afterLongPress = last !== null && last.long && (last.releasedAt === null || performance.now() - last.releasedAt < CLICK_AFTER_RELEASE_MS)
      if (!afterLongPress) actions.current.onPrimary()
    },
    onContextMenu: (event) => {
      event.preventDefault()
      if (press.current !== null) {
        // A touch's long press: the timer may have opened the look already.
        stopTimer()
        if (press.current.long) return
        press.current.long = true
      }
      actions.current.onLook()
    },
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") return
      stopTimer()
      press.current = { x: event.clientX, y: event.clientY, long: false, releasedAt: null }
      timer.current = setTimeout(() => {
        timer.current = null
        if (press.current === null) return
        press.current.long = true
        actions.current.onLook()
      }, LONG_PRESS_MS)
    },
    onPointerMove: (event) => {
      const start = press.current
      if (start === null || start.long) return
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP_PX) {
        stopTimer()
        press.current = null
      }
    },
    // The click follows the pointer's release; it reads (and clears) the press.
    onPointerUp: () => {
      stopTimer()
      if (press.current !== null) press.current.releasedAt = performance.now()
    },
    onPointerCancel: () => {
      stopTimer()
      press.current = null
    },
  }
}
