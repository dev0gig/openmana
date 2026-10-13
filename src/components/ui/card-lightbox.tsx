/*
 * One card in full screen (prompt 47), built the shadcn way on Radix's
 * Dialog (there is no registry component for it): the shadcn DialogOverlay
 * darkens everything behind, the card stands on it as large as the screen
 * allows - whole, never cut -, and beside it (or below it on a narrow
 * screen) an aside holds what belongs to the card: small boxes and buttons.
 *
 *   CardLightboxContent  the dialog in full screen, with its close button (X)
 *   CardLightboxStage    places picture and aside; measures the room
 *   CardLightboxPicture  the card, sized by the stage
 *   CardLightboxAside    the boxes (scroll if they are many)
 *   CardLightboxActions  the buttons, always under the card (stacked) or
 *                        under the boxes (beside)
 *
 * The content lets every press through that misses the card, the aside and
 * the close button (pointer-events), so a tap on the darkened table lands on
 * the overlay and closes the dialog like any shadcn Dialog. Escape closes it
 * (Radix), and so does the system's back gesture where the browser has
 * CloseWatcher (Chrome; useCloseWatcher).
 *
 * Arrangement by room, never by device: "stacked" (the card on top, the rest
 * below, the whole scrolling) or "beside" (the card left, the aside right).
 * The caller decides by the table's layout (src/game/table/table-layout.ts:
 * stacked in hoch, beside in quadrat and breit); cardFit() computes the card's
 * width from the stage's size.
 */
import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog"

/** Width to height of a Magic card. */
const CARD_RATIO = 63 / 88

export type CardLightboxArrangement = "stacked" | "beside"

/** The room the stage gives (CSS pixels, its content box) and what else must fit. */
export interface CardFitInput {
  readonly width: number
  readonly height: number
  readonly arrangement: CardLightboxArrangement
  /** Beside: whether there is an aside (boxes or buttons) next to the card. */
  readonly aside: boolean
  /** Stacked: the height of the buttons directly under the card (they stay on screen with it). */
  readonly reserve: number
  /** The root font size (rem), for the aside's width. */
  readonly rem?: number
}

/** The space between card and aside, and the aside's width beside the card: 36 % of the stage, at least 16 rem, at most 24 rem. */
export const CARD_FIT_GAP = 16

export function asideWidth(width: number, rem = 16): number {
  return Math.round(Math.min(24 * rem, Math.max(16 * rem, width * 0.36)))
}

/**
 * The card's width: as large as the room allows with the whole card visible -
 * stacked: within the stage's width and its height less the buttons under
 * the card; beside: within the height and the width less the aside.
 * Never below 0; whole pixels.
 */
export function cardFit({ width, height, arrangement, aside, reserve, rem = 16 }: CardFitInput): number {
  if (width <= 0 || height <= 0) return 0
  const byHeight = (height - (arrangement === "stacked" ? reserve : 0)) * CARD_RATIO
  const room = arrangement === "beside" && aside ? width - asideWidth(width, rem) - CARD_FIT_GAP : width
  return Math.max(0, Math.floor(Math.min(room, byHeight)))
}

/**
 * Closes on the system's back gesture or button (and Escape) where the
 * browser has CloseWatcher (Chrome since 126, also on Android); elsewhere
 * nothing - Escape stays Radix's. The watcher lives while `active`.
 */
export function useCloseWatcher(active: boolean, onClose: () => void): void {
  const close = React.useRef(onClose)
  React.useEffect(() => {
    close.current = onClose
  })
  React.useEffect(() => {
    if (!active) return undefined
    const Watcher = (globalThis as { CloseWatcher?: new () => { onclose: (() => void) | null; destroy(): void } }).CloseWatcher
    if (typeof Watcher !== "function") return undefined
    let watcher: { onclose: (() => void) | null; destroy(): void }
    try {
      watcher = new Watcher()
    } catch {
      // Chrome refuses a watcher without a user activation it can still use: Escape and the X stay.
      return undefined
    }
    watcher.onclose = () => close.current()
    return () => watcher.destroy()
  }, [active])
}

/**
 * The press that opened the dialog (a long press) ends inside it: the browser then sends that touch's mouse events
 * and a click to whatever lies under the finger now - a button of the dialog or its darkening. Only a press that
 * began after the dialog opened counts: the release of the one that opened it neither moves the focus, nor clicks,
 * nor closes (a keyboard's click comes without a press and stays).
 */
export function useOwnPresses() {
  const press = React.useRef({ pressed: false, ghost: false })
  return React.useMemo(() => ({
    reset: () => { press.current = { pressed: false, ghost: false } },
    handlers: {
      onPointerDownCapture: () => { press.current = { pressed: true, ghost: false } },
      onMouseDownCapture: (event: React.MouseEvent) => {
        if (press.current.pressed) return
        press.current.ghost = true
        event.preventDefault()
      },
      onClickCapture: (event: React.MouseEvent) => {
        if (press.current.ghost) {
          event.preventDefault()
          event.stopPropagation()
        }
        press.current = { pressed: false, ghost: false }
      },
    },
  }), [])
}

function CardLightboxContent({
  className,
  children,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const presses = useOwnPresses()
  return (
    <DialogPortal>
      <DialogOverlay data-slot="card-lightbox-overlay" {...presses.handlers} />
      <DialogPrimitive.Content
        {...presses.handlers}
        onOpenAutoFocus={(event) => {
          presses.reset()
          onOpenAutoFocus?.(event)
        }}
        data-slot="card-lightbox"
        className={cn(
          "pointer-events-none! fixed inset-0 z-50 flex text-sm text-popover-foreground outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none!",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close data-slot="card-lightbox-close" asChild>
          <Button variant="secondary" size="icon-lg" className="pointer-events-auto absolute top-3 right-3">
            <XIcon />
            <span className="sr-only">Schließen</span>
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/** What the stage measured: the card's width and, beside, the aside's width (0: none or not measured yet). */
const StageContext = React.createContext<{ readonly arrangement: CardLightboxArrangement; readonly card: number; readonly aside: number }>({ arrangement: "stacked", card: 0, aside: 0 })

function rootRem(): number {
  return typeof document === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/** Measures its own content box and keeps it current (fold, turn, resize). */
function useBox(element: React.RefObject<HTMLElement | null>): { readonly width: number; readonly height: number } {
  const [box, setBox] = React.useState({ width: 0, height: 0 })
  React.useLayoutEffect(() => {
    const node = element.current
    if (node === null) return undefined
    const measure = () => {
      const style = getComputedStyle(node)
      const width = node.clientWidth - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0")
      const height = node.clientHeight - parseFloat(style.paddingTop || "0") - parseFloat(style.paddingBottom || "0")
      setBox((previous) => (previous.width === width && previous.height === height ? previous : { width, height }))
    }
    measure()
    if (typeof ResizeObserver !== "function") return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [element])
  return box
}

function CardLightboxStage({
  arrangement,
  aside,
  reserve,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  arrangement: CardLightboxArrangement
  /** Whether an aside stands beside the card (beside) - it takes its width from the card. */
  aside: boolean
  /** Stacked: the height (px) of the buttons right under the card. */
  reserve: number
}) {
  const stage = React.useRef<HTMLDivElement>(null)
  const box = useBox(stage)
  const rem = rootRem()
  const card = cardFit({ ...box, arrangement, aside, reserve, rem })
  const asideWide = arrangement === "beside" && aside && box.width > 0 ? asideWidth(box.width, rem) : 0
  const value = React.useMemo(() => ({ arrangement, card, aside: asideWide }), [arrangement, card, asideWide])
  return (
    <StageContext.Provider value={value}>
      <div
        ref={stage}
        data-slot="card-lightbox-stage"
        data-arrangement={arrangement}
        className={cn(
          "pointer-events-none! flex size-full min-h-0 gap-4 overscroll-contain p-4",
          arrangement === "stacked" ? "flex-col items-center overflow-y-auto pt-16" : "flex-row items-center justify-center pr-16",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </StageContext.Provider>
  )
}

function CardLightboxPicture({ className, style, ...props }: React.ComponentProps<"div">) {
  const { card } = React.useContext(StageContext)
  return (
    <div
      data-slot="card-lightbox-picture"
      className={cn("pointer-events-auto shrink-0", className)}
      style={{ ...style, width: card > 0 ? card : undefined }}
      {...props}
    />
  )
}

function CardLightboxAside({ className, style, ...props }: React.ComponentProps<"div">) {
  const { arrangement, card, aside } = React.useContext(StageContext)
  // Stacked: as wide as the card (the boxes are read with it); beside: the aside's own width.
  const width = arrangement === "stacked" ? card : aside
  return (
    <div
      data-slot="card-lightbox-aside"
      className={cn("pointer-events-auto flex min-h-0 shrink-0 flex-col gap-3", arrangement === "stacked" ? "w-full" : "max-h-full self-center", className)}
      style={{ ...style, ...(width > 0 ? { width } : {}) }}
      {...props}
    />
  )
}

function CardLightboxBoxes({ className, ...props }: React.ComponentProps<"div">) {
  const { arrangement } = React.useContext(StageContext)
  return (
    <div
      data-slot="card-lightbox-boxes"
      className={cn("flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", arrangement === "beside" ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : "", className)}
      // Beside the card the boxes scroll in their column: reachable by keyboard too (WCAG 2.1.1).
      {...(arrangement === "beside" ? { tabIndex: 0 } : {})}
      {...props}
    />
  )
}

function CardLightboxActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-lightbox-actions" className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
}

export {
  CARD_RATIO,
  CardLightboxActions,
  CardLightboxAside,
  CardLightboxBoxes,
  CardLightboxContent,
  CardLightboxPicture,
  CardLightboxStage,
}
