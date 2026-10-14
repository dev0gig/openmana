/*
 * The frame of the game table's decision region (prompt 15), built the
 * shadcn way (data-slot, cn(), theme tokens only): shadcn/ui has no game
 * decision. The region itself (GameBoardArea "decision") scrolls; inside it:
 *
 * - GameDecision: the content, a column.
 * - GameDecisionHeader: what Forge asks - the asking card, the kind of
 *   decision, Forge's words.
 * - GameDecisionSource: the asking card, by `size` (data-size): `sm` the
 *   thumbnail beside Forge's words (an ability of a card the table shows
 *   anyway); a spell being cast lies in no zone of the state, so the region
 *   shows it large (project owner, 2026-10-14) - `card` the whole card on top
 *   of the Phasen-Tafel (quadrat, breit; in a low window, short:, the
 *   thumbnail again), `hand` a card of the hand's height at the left of the
 *   action bar (hoch). Sized by its height, the width follows (63 × 88): the
 *   card is always whole.
 * - GameDecisionSpotlight: such a large card and what it is about - a column
 *   in the panel (`vertical`: the card above the words; a row again in a low
 *   window, beside the thumbnail), a row in the action bar (`horizontal`: the
 *   card on the left). GameDecisionSpotlightContent holds the heading and the
 *   step's parts; actions and rows inside it keep to its column.
 * - GameDecisionRow: a row of cards (a GameCardRow) of a fixed height - the
 *   cards of a question that the table does not show (the library's top
 *   while scrying, cards to choose from a pile), sized like a hand's.
 * - GameDecisionNote: a short line - how many to choose, why a button is off.
 * - GameDecisionActions: the answers. They stick to the bottom of the
 *   region, so they stay in reach while a long list scrolls above them
 *   (Anvil lesson, Bible §16: primary actions stay reachable, never at the
 *   end of a long scroll), and in a tall region (the column beside the
 *   battlefields) they sit at its bottom, next to the player's hand.
 * - GameDecisionBar (prompt 41): the answers' bar at the bottom of the
 *   region - it sticks there instead of the actions inside it, and holds
 *   what belongs beside them: on the game table the compact phases next to
 *   the main button (the action bar of a phone), or the hint below them.
 *   Actions inside a bar keep to their place in it (`in-data-[slot=...]`).
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

function GameDecision({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-decision" className={cn("flex min-h-full flex-col gap-2 px-3 pt-2", className)} {...props} />
}

function GameDecisionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-decision-header" className={cn("flex items-start gap-2", className)} {...props} />
}

const gameDecisionSourceVariants = cva("shrink-0", {
  variants: {
    size: {
      // The thumbnail beside Forge's words.
      sm: "h-14",
      // The whole card on top of the panel: 11-15 rem high (about 8-11 rem wide, inside the column of at least 15 rem);
      // in a low window the thumbnail again.
      card: "h-[clamp(11rem,28dvh,15rem)] self-center short:h-14 short:self-start",
      // A card of the hand's height (GameBoardArea "hand" in hoch) at the left of the action bar.
      hand: "h-[clamp(6rem,14dvh,9rem)] self-start",
    },
  },
  defaultVariants: { size: "sm" },
})

/** The asking card (its picture opens the card view): a thumbnail beside Forge's words, or large (see above). */
function GameDecisionSource({ className, size = "sm", ...props }: React.ComponentProps<"div"> & VariantProps<typeof gameDecisionSourceVariants>) {
  return <div data-slot="game-decision-source" data-size={size} className={cn(gameDecisionSourceVariants({ size }), className)} {...props} />
}

const gameDecisionSpotlightVariants = cva("flex gap-2", {
  variants: {
    orientation: {
      vertical: "flex-col short:flex-row short:items-start",
      horizontal: "flex-row items-start",
    },
  },
  defaultVariants: { orientation: "vertical" },
})

/** A large asking card and what it is about: the card above (vertical) or beside (horizontal) its GameDecisionSpotlightContent. */
function GameDecisionSpotlight({ className, orientation = "vertical", ...props }: React.ComponentProps<"div"> & VariantProps<typeof gameDecisionSpotlightVariants>) {
  return <div data-slot="game-decision-spotlight" data-orientation={orientation} className={cn(gameDecisionSpotlightVariants({ orientation }), className)} {...props} />
}

function GameDecisionSpotlightContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-decision-spotlight-content" className={cn("flex min-w-0 flex-auto flex-col gap-2", className)} {...props} />
}

function GameDecisionRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="game-decision-row"
      // Beside a large card the row keeps to the content's column.
      className={cn("-mx-3 flex h-24 shrink-0 flex-col pointer-coarse:h-28 in-data-[slot=game-decision-spotlight-content]:mx-0", className)}
      {...props}
    />
  )
}

function GameDecisionNote({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="game-decision-note" className={cn("text-xs text-muted-foreground", className)} {...props} />
}

function GameDecisionActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="game-decision-actions"
      className={cn(
        "sticky bottom-0 z-10 -mx-3 mt-auto flex flex-wrap items-center gap-2 border-t bg-background px-3 pt-2 pb-2",
        // Inside a GameDecisionBar the bar sticks and draws the line; the actions only line up their buttons.
        "in-data-[slot=game-decision-bar]:static in-data-[slot=game-decision-bar]:mx-0 in-data-[slot=game-decision-bar]:mt-0 in-data-[slot=game-decision-bar]:border-t-0 in-data-[slot=game-decision-bar]:bg-transparent in-data-[slot=game-decision-bar]:p-0",
        // Beside a large card (a group of the step's choices, the pool's colours): in the content's column, the bar sticks below.
        "in-data-[slot=game-decision-spotlight-content]:static in-data-[slot=game-decision-spotlight-content]:mx-0 in-data-[slot=game-decision-spotlight-content]:mt-0 in-data-[slot=game-decision-spotlight-content]:border-t-0 in-data-[slot=game-decision-spotlight-content]:bg-transparent in-data-[slot=game-decision-spotlight-content]:p-0",
        className,
      )}
      {...props}
    />
  )
}

function GameDecisionBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="game-decision-bar"
      className={cn("sticky bottom-0 z-10 -mx-3 mt-auto flex flex-wrap items-center gap-2 border-t bg-background px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]", className)}
      {...props}
    />
  )
}

export { GameDecision, GameDecisionActions, GameDecisionBar, GameDecisionHeader, GameDecisionNote, GameDecisionRow, GameDecisionSource, GameDecisionSpotlight, GameDecisionSpotlightContent }
