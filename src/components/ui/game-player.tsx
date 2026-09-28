/*
 * A player of the game table as a control (prompt 17), built the shadcn way
 * (data-slot, cn(), theme tokens only): shadcn/ui has nothing for a seat.
 *
 * Forge takes a player where a card would not do: as a target (Shock at the
 * opponent), as the choice of a list, as the one who pays life for Phyrexian
 * mana ("click on your life total" in Forge's own GUI). The player's name and
 * life total are then a button with Forge's mark around them - the same
 * frames as a card's (GAME_MARK_FRAMES): dashed gold for "Forge takes this
 * now", solid parchment for "chosen". Every player keeps the frame's room,
 * marked or not, so a mark never moves the bar.
 *
 * - GamePlayer: name and life to read (no tap offered), with a mark if any.
 * - GamePlayerButton: the same as a button (a tap Forge would take).
 */
import * as React from "react"
import { cn } from "cn"
import { GAME_MARK_FRAMES, type GameCardMark } from "./game-card"

const ROOT = "inline-flex items-center gap-1.5 rounded-xl border-2 border-transparent px-1.5 py-0.5"

function GamePlayer({ className, mark = null, ...props }: React.ComponentProps<"span"> & { mark?: GameCardMark | null }) {
  return <span data-slot="game-player" data-mark={mark ?? undefined} className={cn(ROOT, mark ? GAME_MARK_FRAMES[mark] : null, className)} {...props} />
}

function GamePlayerButton({ className, mark = null, ...props }: React.ComponentProps<"button"> & { mark?: GameCardMark | null }) {
  return (
    <button
      type="button"
      data-slot="game-player"
      data-mark={mark ?? undefined}
      className={cn(
        ROOT,
        // The focus ring and touch size of shadcn's buttons; no text selection on a long press.
        "cursor-pointer outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11",
        mark ? GAME_MARK_FRAMES[mark] : null,
        className,
      )}
      {...props}
    />
  )
}

export { GamePlayer, GamePlayerButton }
