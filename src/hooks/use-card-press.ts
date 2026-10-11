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
 *
 * The player's hand is a fan (prompt 42, useFanPress below): the same press,
 * but for a whole row of overlapping cards whose touch and pen gestures the
 * row handles itself - a finger laid on the hand lifts the card whose resting
 * place lies under it and follows the finger sideways; release without moving
 * is the primary activation of the lifted card, release after a swipe does
 * nothing, a long press without a swipe looks at the lifted card. The mouse
 * lifts by hovering; its clicks, the keyboard's Enter and the right click
 * stay each card's own (useCardPress).
 */
import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react"

/** A touch held this long is a long press (Android's own long press takes about as long). */
export const LONG_PRESS_MS = 500

/** A touch that moves farther than this (px) scrolls - or, in the hand, swipes; it is no press. */
const SLOP_PX = 10

/** The click a browser sends for a released touch comes at once; a later click (Enter) is a new activation. */
const CLICK_AFTER_RELEASE_MS = 400

/** A touch or pen press on its way: where it began, whether it became a long press, when it was released. */
interface Press {
  readonly x: number
  readonly y: number
  long: boolean
  releasedAt: number | null
}

/** Whether a press moved farther than the slop (it scrolls or swipes). */
function moved(press: Press, event: PointerEvent<HTMLElement>): boolean {
  return Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP_PX
}

/** The click that follows a long press (at once after its release, or while still held) is no activation. */
function clickAfterLongPress(press: Press | null): boolean {
  return press !== null && press.long && (press.releasedAt === null || performance.now() - press.releasedAt < CLICK_AFTER_RELEASE_MS)
}

/** The long press's timer, shared by both hooks: started on a press, stopped on a move, a release or unmounting. */
function useLongPressTimer(): { readonly start: (onLong: () => void) => void; readonly stop: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])
  return {
    start: (onLong) => {
      stop()
      timer.current = setTimeout(() => {
        timer.current = null
        onLong()
      }, LONG_PRESS_MS)
    },
    stop,
  }
}

export interface CardPressHandlers {
  readonly onClick: (event: MouseEvent<HTMLElement>) => void
  readonly onContextMenu: (event: MouseEvent<HTMLElement>) => void
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerUp: () => void
  readonly onPointerCancel: () => void
}

export function useCardPress({ onPrimary, onLook }: { readonly onPrimary: () => void; readonly onLook: () => void }): CardPressHandlers {
  const press = useRef<Press | null>(null)
  const timer = useLongPressTimer()
  const actions = useRef({ onPrimary, onLook })
  useEffect(() => {
    actions.current = { onPrimary, onLook }
  })
  return {
    onClick: () => {
      const last = press.current
      press.current = null
      if (!clickAfterLongPress(last)) actions.current.onPrimary()
    },
    onContextMenu: (event) => {
      event.preventDefault()
      if (press.current !== null) {
        // A touch's long press: the timer may have opened the look already.
        timer.stop()
        if (press.current.long) return
        press.current.long = true
      }
      actions.current.onLook()
    },
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") return
      press.current = { x: event.clientX, y: event.clientY, long: false, releasedAt: null }
      timer.start(() => {
        if (press.current === null) return
        press.current.long = true
        actions.current.onLook()
      })
    },
    onPointerMove: (event) => {
      const start = press.current
      if (start === null || start.long) return
      if (moved(start, event)) {
        timer.stop()
        press.current = null
      }
    },
    // The click follows the pointer's release; it reads (and clears) the press.
    onPointerUp: () => {
      timer.stop()
      if (press.current !== null) press.current.releasedAt = performance.now()
    },
    onPointerCancel: () => {
      timer.stop()
      press.current = null
    },
  }
}

/** A press on the fan: the card it lifted (by key) and whether it swiped. */
interface FanPress extends Press {
  readonly pointer: number
  card: string | null
  swiped: boolean
}

export interface FanPressHandlers {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerLeave: (event: PointerEvent<HTMLElement>) => void
  readonly onClickCapture: (event: MouseEvent<HTMLElement>) => void
  readonly onContextMenuCapture: (event: MouseEvent<HTMLElement>) => void
}

export interface FanPressOptions {
  /**
   * The card to lift (its key) for a pointer at clientX: for touch and pen the
   * card whose resting place lies nearest (target null); for the mouse the
   * card under it (target: the element it is over), or null.
   */
  readonly pick: (x: number, target: EventTarget | null) => string | null
  /** The card that is lifted now (null: none). */
  readonly onLift: (card: string | null) => void
  /** The primary activation of a card (a tap without a swipe). */
  readonly onPrimary: (card: string) => void
  /** Looking at a card (a long press without a swipe). */
  readonly onLook: (card: string) => void
}

/**
 * The fan's gestures, for the row of the hand (see above). Each card keeps
 * useCardPress's onClick and onContextMenu for the mouse and the keyboard, but
 * not its pointer handlers: a touch or pen press belongs to the row, which
 * swallows the browser's click after it (in the capture phase, before the
 * card's own click) and acts on the lifted card instead - a tap where the
 * finger did not move (within the slop) and the click came at once. A long
 * press's contextmenu (Chrome on Android) looks once, at the lifted card. The
 * row sets touch-action none, so a swipe never scrolls it.
 */
export function useFanPress(options: FanPressOptions): FanPressHandlers {
  const press = useRef<FanPress | null>(null)
  const timer = useLongPressTimer()
  const actions = useRef(options)
  useEffect(() => {
    actions.current = options
  })
  const end = () => {
    timer.stop()
    actions.current.onLift(null)
  }
  return {
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") return
      const card = actions.current.pick(event.clientX, null)
      const started: FanPress = { pointer: event.pointerId, x: event.clientX, y: event.clientY, long: false, releasedAt: null, card, swiped: false }
      press.current = started
      actions.current.onLift(card)
      timer.start(() => {
        if (press.current !== started || started.card === null) return
        started.long = true
        actions.current.onLook(started.card)
      })
    },
    onPointerMove: (event) => {
      if (event.pointerType === "mouse") {
        actions.current.onLift(actions.current.pick(event.clientX, event.target))
        return
      }
      const current = press.current
      if (current === null || current.pointer !== event.pointerId || current.releasedAt !== null || current.long) return
      if (!current.swiped && moved(current, event)) {
        current.swiped = true
        timer.stop()
      }
      if (!current.swiped) return
      // The finger swipes: the card under it rises, chosen by the cards' resting places (the choice never jumps).
      current.card = actions.current.pick(event.clientX, null)
      actions.current.onLift(current.card)
    },
    onPointerUp: (event) => {
      const current = press.current
      if (event.pointerType === "mouse" || current === null || current.pointer !== event.pointerId) return
      current.releasedAt = performance.now()
      end()
    },
    onPointerCancel: (event) => {
      if (event.pointerType !== "mouse" && press.current?.pointer === event.pointerId) press.current = null
      end()
    },
    onPointerLeave: (event) => {
      if (event.pointerType === "mouse") actions.current.onLift(null)
    },
    onClickCapture: (event) => {
      const current = press.current
      if (current === null) return
      // The click of this press: at once after its release, or while a long press is held. Any other click (long after
      // the release, or during a short touch) is the keyboard's or the mouse's: the card handles it.
      const ours = current.releasedAt === null ? current.long : performance.now() - current.releasedAt < CLICK_AFTER_RELEASE_MS
      if (current.releasedAt !== null || ours) press.current = null
      if (!ours) return
      event.preventDefault()
      event.stopPropagation()
      if (!current.swiped && !current.long && current.card !== null) actions.current.onPrimary(current.card)
    },
    onContextMenuCapture: (event) => {
      const current = press.current
      // A right click or the context-menu key: the card's own (useCardPress) looks at it.
      if (current === null || current.releasedAt !== null) return
      event.preventDefault()
      event.stopPropagation()
      timer.stop()
      if (current.long || current.swiped || current.card === null) return
      current.long = true
      actions.current.onLook(current.card)
    },
  }
}
