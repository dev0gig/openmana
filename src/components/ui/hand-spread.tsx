/*
 * A hand of cards in full screen (prompt 50), built the shadcn way on Radix's
 * Dialog like the card view (card-lightbox.tsx; there is no registry
 * component for it): shadcn's overlay darkens everything behind, the panel
 * fills the screen - a title and Forge's words at the top, every card of the
 * hand whole in the middle, the answers at the bottom.
 *
 *   HandSpreadContent  the dialog in full screen, with its close button (X)
 *   HandSpreadHeader   title and description (padded clear of the X)
 *   HandSpreadGrid     the cards: measures its room and sizes them (handSpreadFit)
 *   HandSpreadItem     one card (and what belongs under it), as wide as the grid says
 *   HandSpreadFooter   the answers, always in view at the bottom
 *
 * The cards are laid out by the room, never by device: as many columns as
 * give the largest whole cards side by side and below each other without
 * overlapping (handSpreadFit). Only where even the smallest readable card
 * would not fit the whole hand on the screen (a small phone turned, a very
 * low window) does the grid scroll inside - the cards keep that size, none
 * is cut, every one stays reachable, and the footer stays in view.
 *
 * Closing (X, Escape, the system's back gesture through the caller's
 * CloseWatcher) closes only the panel; what it means is the caller's. The
 * press that opened it (a tap on a button where the panel's answers now lie)
 * ends inside it: its mouse events and click are swallowed (useOwnPresses of
 * card-lightbox.tsx).
 */
import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CARD_RATIO, useOwnPresses } from "@/components/ui/card-lightbox"
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { useElementSize } from "@/hooks/use-element-size"

/** Space between the cards (px). */
export const HAND_SPREAD_GAP = 12
/** The smallest card the grid shows before it scrolls instead (px wide): the size of a card on a phone's battlefield. */
export const HAND_SPREAD_MIN = 88
/** The largest card (px wide): beyond it a card only grows, nothing more becomes readable. */
export const HAND_SPREAD_MAX = 352

export interface HandSpreadFitInput {
  /** The grid's room (CSS px). */
  readonly width: number
  readonly height: number
  readonly count: number
  /** Height under each card that belongs to it (a button, a caption; px). */
  readonly extra?: number
  readonly gap?: number
  readonly min?: number
  readonly max?: number
}

export interface HandSpreadFit {
  readonly columns: number
  readonly rows: number
  /** The width of each card (whole px). */
  readonly card: number
  /** The cards do not fit at the smallest size: the grid scrolls. */
  readonly scroll: boolean
}

/**
 * The cards' size: the number of columns that gives the widest card with
 * every card whole inside the room (side by side and below each other, the
 * gap between, `extra` under each); at most `max`. Below `min` the grid
 * scrolls instead: as many columns of at least `min` as the width holds.
 */
export function handSpreadFit({ width, height, count, extra = 0, gap = HAND_SPREAD_GAP, min = HAND_SPREAD_MIN, max = HAND_SPREAD_MAX }: HandSpreadFitInput): HandSpreadFit {
  if (count <= 0 || width <= 0 || height <= 0) return { columns: Math.max(count, 1), rows: count > 0 ? 1 : 0, card: 0, scroll: false }
  let best: HandSpreadFit = { columns: 1, rows: count, card: 0, scroll: false }
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns)
    const byWidth = (width - (columns - 1) * gap) / columns
    const byHeight = ((height - (rows - 1) * gap) / rows - extra) * CARD_RATIO
    const card = Math.floor(Math.min(byWidth, byHeight, max))
    if (card > best.card) best = { columns, rows, card, scroll: false }
  }
  if (best.card >= min) return best
  const columns = Math.min(count, Math.max(1, Math.floor((width + gap) / (min + gap))))
  const card = Math.max(0, Math.floor(Math.min(max, (width - (columns - 1) * gap) / columns)))
  return { columns, rows: Math.ceil(count / columns), card, scroll: true }
}

function HandSpreadContent({ className, children, onOpenAutoFocus, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const presses = useOwnPresses()
  return (
    <DialogPortal>
      <DialogOverlay data-slot="hand-spread-overlay" {...presses.handlers} />
      <DialogPrimitive.Content
        {...presses.handlers}
        onOpenAutoFocus={(event) => {
          presses.reset()
          onOpenAutoFocus?.(event)
        }}
        data-slot="hand-spread"
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-popover/95 text-sm text-popover-foreground outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none!",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close data-slot="hand-spread-close" asChild>
          <Button variant="secondary" size="icon-lg" className="absolute top-3 right-3">
            <XIcon />
            <span className="sr-only">Schließen</span>
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function HandSpreadHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="hand-spread-header" className={cn("flex shrink-0 flex-col gap-1 px-4 pt-3 pr-18 pb-2", className)} {...props} />
}

/** What the grid measured: the cards' width (0: not measured yet - the cards then take their own size). */
const GridContext = React.createContext(0)

function HandSpreadGrid({ count, extra = 0, className, style, children, ...props }: React.ComponentProps<"ul"> & {
  /** How many cards the grid holds. */
  count: number
  /** Height under each card that belongs to it (px). */
  extra?: number
}) {
  const room = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(room)
  const fit = size === null ? null : handSpreadFit({ width: size.width, height: size.height, count, extra })
  const measured = fit !== null && fit.card > 0
  return (
    <GridContext.Provider value={measured ? fit.card : 0}>
      {/* The room (measured); the list in it exactly `columns` cards wide, centred - auto margins stay safe when it scrolls. */}
      <div
        ref={room}
        data-slot="hand-spread-grid"
        data-columns={fit?.columns}
        data-scroll={fit?.scroll ? "" : undefined}
        // Scrolling (only below the smallest card): reachable by keyboard too (WCAG 2.1.1).
        {...(fit?.scroll ? { tabIndex: 0 } : {})}
        className={cn("flex min-h-0 flex-1 overscroll-contain px-4 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", fit?.scroll ? "overflow-y-auto" : "overflow-hidden")}
      >
        <ul
          className={cn("m-auto flex flex-wrap justify-center", className)}
          style={{ ...style, gap: HAND_SPREAD_GAP, ...(measured ? { width: fit.columns * fit.card + (fit.columns - 1) * HAND_SPREAD_GAP } : {}) }}
          {...props}
        >
          {children}
        </ul>
      </div>
    </GridContext.Provider>
  )
}

/** The width the grid gives each card (px), or 0 before it measured: for a picture's `sizes` (a fixed size, never "auto"). */
function useHandSpreadCard(): number {
  return React.useContext(GridContext)
}

function HandSpreadItem({ className, style, ...props }: React.ComponentProps<"li">) {
  const card = React.useContext(GridContext)
  return <li data-slot="hand-spread-item" className={cn("flex shrink-0 flex-col items-center gap-1", card > 0 ? null : "w-28", className)} style={{ ...style, ...(card > 0 ? { width: card } : {}) }} {...props} />
}

/** The card's own place in an item: exactly the card, in its proportions. */
function HandSpreadCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="hand-spread-card" className={cn("aspect-63/88 w-full", className)} {...props} />
}

function HandSpreadFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="hand-spread-footer" className={cn("flex shrink-0 flex-col gap-2 border-t bg-popover px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]", className)} {...props} />
}

export { HandSpreadCard, HandSpreadContent, HandSpreadFooter, HandSpreadGrid, HandSpreadHeader, HandSpreadItem, useHandSpreadCard }
