/*
 * A card on the game table (prompt 13), built the shadcn way (data-slot,
 * cn(), theme tokens only): shadcn/ui has no playing card.
 *
 * Sized by the height of its row, not by a width: a battlefield row or the
 * hand gives it its height, the card takes the width of a Magic card of that
 * height (63 × 88). So a row that gets less room shows smaller cards instead
 * of pushing the table into a vertical scroll (Bible §6).
 *
 * - GameCard: one card. `tapped` turns the picture a quarter to the right
 *   (Magic's own sign for "tapped", unmistakable - Bible §6); the card then
 *   takes a square place. Nothing is ever drawn over the picture: Scryfall's
 *   terms forbid covering, cropping, blurring or tinting card images, so all
 *   the card's facts (power, counters, how many in a pile …) go into the
 *   caption strip below it (GameCardCaption).
 * - GameCardBack: a card whose face the player may not see (Forge's hidden
 *   cards): OpenMana's own back, never Wizards' card back.
 * - GameCardGroup: a card with what is attached to it (auras, equipment),
 *   side by side in one frame.
 */
import * as React from "react"
import { cn } from "cn"
import { Layers } from "lucide-react"

/** How much of the card's height the caption strip takes (h-5 below). */
const CAPTION = "h-[calc(100%-1.375rem)]"

function GameCard({
  className,
  tapped = false,
  caption,
  children,
  ...props
}: Omit<React.ComponentProps<"figure">, "children"> & {
  tapped?: boolean
  /** The strip below the picture; without one the picture takes the whole height. */
  caption?: React.ReactNode
  /** The picture (a CardPicture) or the back. */
  children: React.ReactNode
}) {
  return (
    <figure data-slot="game-card" data-tapped={tapped} className={cn("flex h-full shrink-0 flex-col items-center gap-0.5", className)} {...props}>
      <div data-slot="game-card-face" className={cn("relative", caption !== undefined ? CAPTION : "h-full", tapped ? "aspect-square" : "aspect-63/88")}>
        <div className={cn(tapped ? "absolute top-1/2 left-1/2 aspect-63/88 h-full -translate-x-1/2 -translate-y-1/2 rotate-90" : "size-full")}>{children}</div>
      </div>
      {caption !== undefined ? caption : null}
    </figure>
  )
}

/**
 * The strip below a card: its facts in one line. It never widens the card
 * (w-0 min-w-full); centred while it fits, else cut at the end - text that
 * may be cut goes into a `truncate` span - with the full text in its title.
 */
function GameCardCaption({ className, ...props }: React.ComponentProps<"figcaption">) {
  return (
    <figcaption
      data-slot="game-card-caption"
      className={cn("flex h-5 w-0 min-w-full items-center justify-center-safe gap-1 overflow-hidden text-xs leading-none whitespace-nowrap text-muted-foreground tabular-nums [&_svg]:size-3 [&_svg]:shrink-0", className)}
      {...props}
    />
  )
}

/** A card the player may not see: only that it is there (children: what a screen reader hears). */
function GameCardBack({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="game-card-back"
      className={cn("flex aspect-63/88 h-full items-center justify-center rounded-xl border bg-secondary text-muted-foreground [&_svg]:size-1/3 [&_svg]:max-h-6", className)}
      {...props}
    >
      <Layers aria-hidden />
      {children}
    </div>
  )
}

/** A card and its attachments in one frame. */
function GameCardGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-card-group" className={cn("flex h-full shrink-0 gap-1 rounded-2xl border border-dashed p-0.5", className)} {...props} />
}

export { GameCard, GameCardBack, GameCardCaption, GameCardGroup }
