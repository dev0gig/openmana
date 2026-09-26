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
 *
 * The decision region grows when its content needs it (prompt 15):
 *  - `decision="tall"` (more words than the compact region holds, e.g. a
 *    long prompt of Forge's, while stack or combat have something to show):
 *    in portrait it may grow to 28 % of the screen's height, only as far as
 *    its content needs; more words scroll inside it. Nothing else changes -
 *    the stack stays in view (the player may want to answer it), and the
 *    battlefields keep their room (paying taps lands there).
 *  - `decision="expanded"` (a question Forge waits on alone with a list, a
 *    form or amounts, cards to choose outside the table - or more words than
 *    fit while stack and combat are empty): the same in portrait, and stack
 *    and combat keep a smaller strip so the battlefields keep a row of cards;
 *    in a low landscape window (a phone turned sideways, `short:`) it takes
 *    both middle rows of the side column - stack and combat step aside while
 *    the question is open (then nothing on the table can be done, or they
 *    are empty; the question says what it is about).
 */
import * as React from "react"
import { cn } from "cn"

export type GameBoardAreaName = "header" | "opponent" | "opponent-field" | "center" | "field" | "me" | "decision" | "hand"

export type GameBoardDecision = "compact" | "tall" | "expanded"

function GameBoard({ className, decision = "compact", ...props }: React.ComponentProps<"div"> & { decision?: GameBoardDecision }) {
  return (
    <div
      data-slot="game-board"
      data-decision={decision}
      className={cn(
        // relative: what is positioned absolutely inside (screen-reader-only texts) stays inside the board.
        "group/board relative grid h-full min-h-0 w-full grid-cols-1 overflow-hidden bg-background",
        "grid-rows-[auto_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto_auto]",
        "[grid-template-areas:'header'_'opponent'_'opponent-field'_'center'_'field'_'me'_'decision'_'hand']",
        "landscape:grid-cols-[minmax(0,1fr)_minmax(15rem,24rem)]",
        "landscape:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]",
        "landscape:[grid-template-areas:'header_opponent'_'opponent-field_center'_'field_decision'_'hand_me']",
        // A decision that needs room in a low landscape window: both middle rows of the side column (see above).
        "short:landscape:data-[decision=expanded]:[grid-template-areas:'header_opponent'_'opponent-field_decision'_'field_decision'_'hand_me']",
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
  center:
    "[grid-area:center] max-h-[clamp(5rem,15dvh,8rem)] portrait:group-data-[decision=expanded]/board:max-h-[clamp(3rem,10dvh,5rem)] overflow-y-auto landscape:max-h-none landscape:border-l short:landscape:group-data-[decision=expanded]/board:hidden",
  field: "[grid-area:field]",
  me: "[grid-area:me] landscape:border-t landscape:border-l",
  // A decision that needs room may grow to 36 % of the screen's height in portrait, words that do not fit to 28 % (see above).
  decision:
    "[grid-area:decision] max-h-[clamp(7rem,18dvh,11rem)] portrait:group-data-[decision=expanded]/board:max-h-[clamp(9rem,36dvh,26rem)] portrait:group-data-[decision=tall]/board:max-h-[clamp(9rem,28dvh,20rem)] overflow-y-auto border-t landscape:max-h-none landscape:border-l",
  // The hand's height follows the screen's: 6-9 rem, the most a low screen can spare. Its row keeps the padding (room for the cards' focus ring).
  hand: "[grid-area:hand] h-[clamp(6rem,14dvh,9rem)] border-t",
}

/** One region of the board, a named section. */
function GameBoardArea({ area, className, ...props }: React.ComponentProps<"section"> & { area: GameBoardAreaName }) {
  return <section data-slot="game-board-area" data-area={area} className={cn("relative min-h-0 min-w-0", AREA_CLASSES[area], className)} {...props} />
}

export { GameBoard, GameBoardArea }
