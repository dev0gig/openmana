/*
 * The frame of the game table (prompt 13), built the shadcn way (data-slot,
 * cn(), theme tokens only): shadcn/ui has no game board. It fills the
 * screen and never scrolls itself; its regions keep their places (Bible §6:
 * no vertically endless table), and what does not fit scrolls inside its
 * region - card rows sideways, texts downwards.
 *
 * Portrait (phones, a folded foldable, tablets upright), top to bottom:
 *
 *   header · opponent · opponent's battlefield · stack and combat ·
 *   your battlefield · you · decision · hand
 *
 * Landscape (desktop, tablets and foldables turned, phones turned): the
 * battlefields and the hand on the left, a side column on the right - the
 * opponent next to the header, stack and combat next to the opponent's
 * half, the decision next to your half, you next to your hand. A low screen
 * keeps its height for the cards, and both halves stay exactly as high.
 *
 * Both battlefields share the free height equally; the other regions take
 * what their content needs - the hand 6 to 9 rem by the screen's height -,
 * and the stack/combat and decision regions are capped in portrait (by the
 * screen's height too) so they never squeeze the battlefields away.
 */
import * as React from "react"
import { cn } from "cn"

export type GameBoardAreaName = "header" | "opponent" | "opponent-field" | "center" | "field" | "me" | "decision" | "hand"

function GameBoard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="game-board"
      className={cn(
        // relative: what is positioned absolutely inside (screen-reader-only texts) stays inside the board.
        "relative grid h-full min-h-0 w-full grid-cols-1 overflow-hidden bg-background",
        "grid-rows-[auto_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto_auto]",
        "[grid-template-areas:'header'_'opponent'_'opponent-field'_'center'_'field'_'me'_'decision'_'hand']",
        "landscape:grid-cols-[minmax(0,1fr)_minmax(15rem,24rem)]",
        "landscape:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]",
        "landscape:[grid-template-areas:'header_opponent'_'opponent-field_center'_'field_decision'_'hand_me']",
        className,
      )}
      {...props}
    />
  )
}

const AREA_CLASSES: Readonly<Record<GameBoardAreaName, string>> = {
  header: "[grid-area:header] border-b",
  opponent: "[grid-area:opponent] landscape:border-b landscape:border-l",
  "opponent-field": "[grid-area:opponent-field]",
  // Capped in portrait (by the screen's height: a low phone keeps more for the battlefields), full height beside them in landscape.
  center: "[grid-area:center] max-h-[clamp(5rem,15dvh,8rem)] overflow-y-auto landscape:max-h-none landscape:border-l",
  field: "[grid-area:field]",
  me: "[grid-area:me] landscape:border-t landscape:border-l",
  decision: "[grid-area:decision] max-h-[clamp(7rem,18dvh,11rem)] overflow-y-auto border-t landscape:max-h-none landscape:border-l",
  // The hand's height follows the screen's: 6-9 rem, the most a low screen can spare.
  hand: "[grid-area:hand] h-[clamp(6rem,14dvh,9rem)] border-t py-1",
}

/** One region of the board, a named section. */
function GameBoardArea({ area, className, ...props }: React.ComponentProps<"section"> & { area: GameBoardAreaName }) {
  return <section data-slot="game-board-area" data-area={area} className={cn("relative min-h-0 min-w-0", AREA_CLASSES[area], className)} {...props} />
}

export { GameBoard, GameBoardArea }
