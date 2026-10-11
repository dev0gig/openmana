/*
 * The frame of the game table's decision region (prompt 15), built the
 * shadcn way (data-slot, cn(), theme tokens only): shadcn/ui has no game
 * decision. The region itself (GameBoardArea "decision") scrolls; inside it:
 *
 * - GameDecision: the content, a column.
 * - GameDecisionHeader: what Forge asks - the asking card, the kind of
 *   decision, Forge's words.
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
import { cn } from "cn"

function GameDecision({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-decision" className={cn("flex min-h-full flex-col gap-2 px-3 pt-2", className)} {...props} />
}

function GameDecisionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-decision-header" className={cn("flex items-start gap-2", className)} {...props} />
}

/** The asking card beside Forge's words: a small card (its picture opens the card view). */
function GameDecisionSource({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-decision-source" className={cn("h-14 shrink-0", className)} {...props} />
}

function GameDecisionRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-decision-row" className={cn("-mx-3 flex h-24 shrink-0 flex-col pointer-coarse:h-28", className)} {...props} />
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

export { GameDecision, GameDecisionActions, GameDecisionBar, GameDecisionHeader, GameDecisionNote, GameDecisionRow, GameDecisionSource }
