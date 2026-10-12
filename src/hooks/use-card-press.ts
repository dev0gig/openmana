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
 *
 * Dragging (prompt 46, useFanPress's `drag`): a finger that leaves the hand
 * clearly upwards - more than DRAG_START_PX up and more up than sideways,
 * measured from where the lifted card rose - drags the lifted card instead of
 * lifting; the mouse drags the card it pressed once it moves beyond the slop.
 * A sideways swipe still only lifts and a long press still only looks (a press
 * that became a long press never drags). A drag ends where it is released; it
 * is cancelled - nothing is released - by Escape, a second finger or the
 * browser's pointercancel. The click after a drag is swallowed.
 */
import { useEffect, useRef, type DragEvent, type MouseEvent, type PointerEvent } from "react"

/** A touch held this long is a long press (Android's own long press takes about as long). */
export const LONG_PRESS_MS = 500

/** A touch that moves farther than this (px) scrolls - or, in the hand, swipes; it is no press. */
const SLOP_PX = 10

/** A finger that moves this far upwards out of the hand (px, and more up than sideways) drags the lifted card (prompt 46). */
export const DRAG_START_PX = 24

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

/** A point of the page (client coordinates). */
export interface PressPoint {
  readonly x: number
  readonly y: number
}

/** A press on the fan: the card it lifted (by key), whether it swiped, and whether it drags (prompt 46). */
interface FanPress extends Press {
  readonly pointer: number
  /** A mouse press (it drags only, the click stays the card's). */
  readonly mouse: boolean
  card: string | null
  swiped: boolean
  /** Where an upward move is measured from: the lowest point since the lifted card rose, at the x where it rose. */
  anchor: { x: number; y: number }
  /** A drag is on its way now. */
  dragging: boolean
  /** The press dragged (or was cancelled): nothing else comes of it, its click is swallowed. */
  done: boolean
}

export interface FanPressHandlers {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerLeave: (event: PointerEvent<HTMLElement>) => void
  readonly onClickCapture: (event: MouseEvent<HTMLElement>) => void
  readonly onContextMenuCapture: (event: MouseEvent<HTMLElement>) => void
  /** The browser's own drag of a card's picture never starts (it would cancel the pointer). */
  readonly onDragStart: (event: DragEvent<HTMLElement>) => void
}

/** Dragging the lifted card out of the hand (prompt 46). */
export interface FanDrag {
  /** A drag of this card begins at this point; false: the card is not dragged (the press goes on as before). */
  readonly start: (card: string, point: PressPoint, pointer: "mouse" | "touch" | "pen") => boolean
  readonly move: (point: PressPoint) => void
  /** Released at this point, or cancelled (null: Escape, a second finger, pointercancel). */
  readonly end: (point: PressPoint | null) => void
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
  /** Dragging cards out of the hand (prompt 46); absent: no dragging. */
  readonly drag?: FanDrag
}

function pointOf(event: PointerEvent<HTMLElement>): PressPoint {
  return { x: event.clientX, y: event.clientY }
}

function pointerKind(type: string): "mouse" | "touch" | "pen" {
  return type === "mouse" ? "mouse" : type === "pen" ? "pen" : "touch"
}

/** A finger left the hand clearly upwards since its anchor (prompt 46). */
function leftUpwards(press: FanPress, event: PointerEvent<HTMLElement>): boolean {
  const up = press.anchor.y - event.clientY
  return up > DRAG_START_PX && up > Math.abs(event.clientX - press.anchor.x)
}

/**
 * The fan's gestures, for the row of the hand (see above). Each card keeps
 * useCardPress's onClick and onContextMenu for the mouse and the keyboard, but
 * not its pointer handlers: a touch or pen press belongs to the row, which
 * swallows the browser's click after it (in the capture phase, before the
 * card's own click) and acts on the lifted card instead - a tap where the
 * finger did not move (within the slop) and the click came at once. A long
 * press's contextmenu (Chrome on Android) looks once, at the lifted card. The
 * row sets touch-action none, so a swipe never scrolls it. With `drag`, a
 * finger leaving the hand upwards and a mouse pressed and moved drag a card.
 */
export function useFanPress(options: FanPressOptions): FanPressHandlers {
  const press = useRef<FanPress | null>(null)
  const timer = useLongPressTimer()
  const actions = useRef(options)
  useEffect(() => {
    actions.current = options
  })
  /** Escape while dragging (the keyboard's way out); removed when the drag ends. */
  const escape = useRef<((event: KeyboardEvent) => void) | null>(null)
  const stopListening = () => {
    if (escape.current !== null) window.removeEventListener("keydown", escape.current, true)
    escape.current = null
  }
  const end = () => {
    timer.stop()
    actions.current.onLift(null)
  }
  /** Ends a drag on its way: released at `point`, or cancelled (null). The press is done either way. */
  const finishDrag = (current: FanPress, point: PressPoint | null) => {
    stopListening()
    if (!current.dragging) return
    current.dragging = false
    actions.current.drag?.end(point)
  }
  /** Cancels the press: a drag goes back, nothing else comes of it (its click is swallowed). */
  const cancel = (current: FanPress) => {
    finishDrag(current, null)
    current.done = true
    current.card = null
    end()
  }
  useEffect(
    () => () => {
      const current = press.current
      if (current !== null && current.dragging) finishDrag(current, null)
      stopListening()
    },
    // Only when the hand goes: a drag on its way is cancelled.
    [],
  )
  /** Starts dragging the press's card; false where the hand does not drag it. */
  const startDrag = (current: FanPress, event: PointerEvent<HTMLElement>): boolean => {
    const drag = actions.current.drag
    if (drag === undefined || current.card === null || current.done) return false
    if (!drag.start(current.card, pointOf(event), pointerKind(event.pointerType))) return false
    timer.stop()
    current.dragging = true
    current.done = true
    current.swiped = true
    actions.current.onLift(null)
    // Where the drag begins is its first place (over the battlefield already, for a quick mouse).
    drag.move(pointOf(event))
    const onKey = (key: KeyboardEvent) => {
      if (key.key !== "Escape" || press.current !== current || !current.dragging) return
      key.preventDefault()
      key.stopPropagation()
      finishDrag(current, null)
    }
    escape.current = onKey
    window.addEventListener("keydown", onKey, true)
    if (event.pointerType === "mouse") {
      // The mouse is followed beyond the hand (a finger's events stay with the element it pressed anyway).
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // The pointer is gone already: its pointerup or pointercancel follows.
      }
    }
    return true
  }
  return {
    onPointerDown: (event) => {
      const current = press.current
      // A second finger while one presses: the gesture is cancelled (a drag goes back), nothing is tapped or looked at.
      if (current !== null && !current.mouse && event.pointerType !== "mouse" && current.releasedAt === null && current.pointer !== event.pointerId) {
        cancel(current)
        return
      }
      if (event.pointerType === "mouse") {
        // The mouse drags the card it presses (prompt 46); its click stays the card's.
        if (event.button !== 0 || actions.current.drag === undefined) return
        const card = actions.current.pick(event.clientX, event.target)
        press.current = { pointer: event.pointerId, mouse: true, x: event.clientX, y: event.clientY, long: false, releasedAt: null, card, swiped: false, anchor: { x: event.clientX, y: event.clientY }, dragging: false, done: false }
        return
      }
      const card = actions.current.pick(event.clientX, null)
      const started: FanPress = { pointer: event.pointerId, mouse: false, x: event.clientX, y: event.clientY, long: false, releasedAt: null, card, swiped: false, anchor: { x: event.clientX, y: event.clientY }, dragging: false, done: false }
      press.current = started
      actions.current.onLift(card)
      timer.start(() => {
        if (press.current !== started || started.card === null || started.done) return
        started.long = true
        actions.current.onLook(started.card)
      })
    },
    onPointerMove: (event) => {
      const current = press.current
      const ours = current !== null && current.pointer === event.pointerId && current.releasedAt === null
      if (event.pointerType === "mouse") {
        // A press whose release the row never saw (let go outside it): over.
        if (ours && current.mouse && !current.dragging && (event.buttons & 1) === 0) press.current = null
        else if (ours && current.mouse) {
          if (current.dragging) actions.current.drag?.move(pointOf(event))
          else if (!current.done && moved(current, event) && !startDrag(current, event)) press.current = null
          return
        }
        actions.current.onLift(actions.current.pick(event.clientX, event.target))
        return
      }
      if (!ours || current.long) return
      if (current.dragging) {
        actions.current.drag?.move(pointOf(event))
        return
      }
      if (current.done) return
      current.anchor.y = Math.max(current.anchor.y, event.clientY)
      // Out of the hand upwards: the lifted card is dragged (prompt 46).
      if (leftUpwards(current, event) && startDrag(current, event)) return
      if (!current.swiped && moved(current, event)) {
        current.swiped = true
        timer.stop()
      }
      if (!current.swiped) return
      // The finger swipes: the card under it rises, chosen by the cards' resting places (the choice never jumps).
      const card = actions.current.pick(event.clientX, null)
      if (card !== current.card) current.anchor = { x: event.clientX, y: event.clientY }
      current.card = card
      actions.current.onLift(current.card)
    },
    onPointerUp: (event) => {
      const current = press.current
      if (current === null || current.pointer !== event.pointerId) return
      if (current.mouse) {
        // A mouse press that never dragged: the click that follows is the card's own.
        if (!current.done) {
          press.current = null
          return
        }
        current.releasedAt = performance.now()
        finishDrag(current, pointOf(event))
        return
      }
      current.releasedAt = performance.now()
      finishDrag(current, pointOf(event))
      end()
    },
    onPointerCancel: (event) => {
      const current = press.current
      if (current !== null && current.pointer === event.pointerId) {
        finishDrag(current, null)
        press.current = null
      }
      if (event.pointerType !== "mouse") end()
    },
    onPointerLeave: (event) => {
      if (event.pointerType === "mouse" && !(press.current?.mouse === true && press.current.dragging)) actions.current.onLift(null)
    },
    onClickCapture: (event) => {
      const current = press.current
      if (current === null) return
      // The click of this press: at once after its release, or while a long press is held. Any other click (long after
      // the release, or during a short touch) is the keyboard's or the mouse's: the card handles it.
      const ours = current.releasedAt === null ? current.long || (current.done && !current.mouse) : performance.now() - current.releasedAt < CLICK_AFTER_RELEASE_MS
      if (current.releasedAt !== null || ours) press.current = null
      if (!ours) return
      event.preventDefault()
      event.stopPropagation()
      if (!current.swiped && !current.long && !current.done && current.card !== null) actions.current.onPrimary(current.card)
    },
    onContextMenuCapture: (event) => {
      const current = press.current
      // A right click or the context-menu key: the card's own (useCardPress) looks at it.
      if (current === null || current.releasedAt !== null || current.mouse) return
      event.preventDefault()
      event.stopPropagation()
      timer.stop()
      if (current.long || current.swiped || current.done || current.card === null) return
      current.long = true
      actions.current.onLook(current.card)
    },
    onDragStart: (event) => {
      event.preventDefault()
    },
  }
}
