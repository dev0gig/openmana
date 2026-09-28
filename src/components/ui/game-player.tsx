/*
 * A player of the game table as a control (prompt 17), built the shadcn way
 * (data-slot, cn(), theme tokens only): shadcn/ui has nothing for a seat.
 *
 * Forge takes a player where a card would not do: as a target (Shock at the
 * opponent), as the choice of a list, as the one who pays life for Phyrexian
 * mana ("click on your life total" in Forge's own GUI). The player's name and
 * life total are then a button with Forge's mark around them - the cards'
 * marks: dashed gold (--primary) for "Forge takes this now", solid parchment
 * (--foreground) for "chosen". Drawn as an outline inside the box, the mark
 * takes no room: the player's bar keeps its height, marked or not (on a
 * small phone every pixel of it is the battlefields').
 *
 * - GamePlayer: name and life to read (no tap offered), with a mark if any.
 * - GamePlayerButton: the same as a button (a tap Forge would take).
 */
import * as React from "react"
import { cn } from "cn"
import type { GameCardMark } from "./game-card"

const ROOT = "inline-flex items-center gap-1.5 rounded-xl px-1.5"

const MARKS: Readonly<Record<GameCardMark, string>> = {
  usable: "outline-2 -outline-offset-2 outline-dashed outline-primary",
  selected: "outline-2 -outline-offset-2 outline-solid outline-foreground",
}

function GamePlayer({ className, mark = null, ...props }: React.ComponentProps<"span"> & { mark?: GameCardMark | null }) {
  return <span data-slot="game-player" data-mark={mark ?? undefined} className={cn(ROOT, mark ? MARKS[mark] : null, className)} {...props} />
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
        "cursor-pointer select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11",
        mark ? null : "outline-none",
        mark ? MARKS[mark] : null,
        className,
      )}
      {...props}
    />
  )
}

export { GamePlayer, GamePlayerButton }
