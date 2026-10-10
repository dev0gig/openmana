/*
 * The frame of the game table (prompt 13), built the shadcn way (data-slot,
 * cn(), theme tokens only): shadcn/ui has no game board. It fills the
 * screen and never scrolls itself; its regions keep their places (Bible §6:
 * no vertically endless table), and what does not fit scrolls inside its
 * region - card rows sideways, texts downwards.
 *
 * The regions are arranged by the window's aspect ratio (prompt 38,
 * docs/design/SPIELTISCH.md §3), through the variants hoch:, quadrat: and
 * breit: (src/index.css; exactly one applies) - never by the device or the
 * orientation alone:
 *
 *  - hoch (narrower than 3:4: phones, a folded foldable), one column, top to
 *    bottom: header · opponent · opponent's battlefield · stack and combat
 *    (a bar between the battlefields) · your battlefield · you · hand ·
 *    decision (the action bar at the very bottom). These are also the
 *    classes without a variant, the fallback of a browser that answers none
 *    of the three queries.
 *  - quadrat (3:4 up to 13:10: an unfolded foldable either way round, most
 *    tablets): the header across; on the left the strips, the battlefields
 *    with a thin centre line between them and the hand; on the right stack
 *    and combat (the Zauberchronik) next to the opponent's half, the decision
 *    (the Phasen-Tafel) from the centre line down to the bottom.
 *  - breit (wider than 13:10: desktop, laptop, tablets turned): the header
 *    across; a left column with stack and combat, the middle with the strips,
 *    the battlefields, the centre line and the hand, a right column with the
 *    decision - both side columns from the header to the bottom.
 *  - breit and short: (at most 32rem high, a phone turned sideways) keeps the
 *    arrangement of prompts 13-24, which leaves the battlefields the most
 *    height: the battlefields and the hand on the left, a side column on the
 *    right - the opponent next to the header, stack and combat next to the
 *    opponent's half, the decision next to your half, you next to your hand.
 *
 * Both battlefields share the free height equally; the other regions take
 * what their content needs - the hand 6 to 9 rem by the screen's height. In
 * hoch the stack/combat bar and the decision are capped (by the screen's
 * height too) so they never squeeze the battlefields away; beside the
 * battlefields they take their column's height and scroll inside.
 *
 * The decision region grows when its content needs it (prompt 15; measured by
 * GameTable, decisionNeedsRoom in decision-panel.tsx):
 *  - `decision="tall"` (more words than the compact region holds while stack
 *    or combat have something to show): in hoch the action bar may grow
 *    upwards to 28 % of the screen's height, only as far as its content needs;
 *    more words scroll inside it. Nothing else changes - the stack stays in
 *    view (the player may want to answer it), and the battlefields keep their
 *    room (paying taps lands there). Beside the battlefields (quadrat,
 *    breit) the region is already that tall: the words scroll inside it.
 *  - `decision="expanded"` (a question Forge waits on alone with a list, a
 *    form or amounts, cards to choose outside the table - or more words than
 *    fit while stack and combat are empty): in hoch the same up to 36 %, and
 *    the stack/combat bar keeps a smaller strip so the battlefields keep a row
 *    of cards; in quadrat the decision takes the right column from the
 *    opponent's battlefield down, stack and combat keep a small strip next to
 *    the opponent; in breit it has its whole column already; in a low window
 *    (breit and short:) it takes both middle rows of the side column - stack
 *    and combat step aside while the question is open (then nothing on the
 *    table can be done, or they are empty; the question says what it is
 *    about).
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
        // relative: what is positioned absolutely inside (screen-reader-only texts, the table surface) stays inside the board.
        "group/board relative grid h-full min-h-0 w-full overflow-hidden bg-background",
        // hoch, and the fallback without a layout (see above): one column, the decision at the very bottom.
        "grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto_auto]",
        "[grid-template-areas:'header'_'opponent'_'opponent-field'_'center'_'field'_'me'_'hand'_'decision']",
        // quadrat: the battlefields' column and a right column (Zauberchronik above, Phasen-Tafel below); the row "." is the centre line.
        "quadrat:grid-cols-[minmax(0,1fr)_clamp(15rem,30vw,20rem)]",
        "quadrat:grid-rows-[auto_auto_minmax(0,1fr)_1.5rem_minmax(0,1fr)_auto_auto]",
        "quadrat:[grid-template-areas:'header_header'_'opponent_center'_'opponent-field_center'_'._decision'_'field_decision'_'me_decision'_'hand_decision']",
        "quadrat:data-[decision=expanded]:[grid-template-areas:'header_header'_'opponent_center'_'opponent-field_decision'_'._decision'_'field_decision'_'me_decision'_'hand_decision']",
        // breit: a column on each side of the battlefields, from the header to the bottom.
        "breit:grid-cols-[clamp(12rem,20vw,18rem)_minmax(0,1fr)_clamp(15rem,22vw,18rem)]",
        "breit:grid-rows-[auto_auto_minmax(0,1fr)_1.5rem_minmax(0,1fr)_auto_auto]",
        "breit:[grid-template-areas:'header_header_header'_'center_opponent_decision'_'center_opponent-field_decision'_'center_._decision'_'center_field_decision'_'center_me_decision'_'center_hand_decision']",
        // breit in a low window (a phone turned sideways): the side column of prompts 13-24, the battlefields keep the height.
        "breit:short:grid-cols-[minmax(0,1fr)_minmax(15rem,24rem)]",
        "breit:short:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]",
        "breit:short:[grid-template-areas:'header_opponent'_'opponent-field_center'_'field_decision'_'hand_me']",
        // A decision that needs room in a low window: both middle rows of the side column (see above).
        "breit:short:data-[decision=expanded]:[grid-template-areas:'header_opponent'_'opponent-field_decision'_'field_decision'_'hand_me']",
        className,
      )}
      {...props}
    />
  )
}

const AREA_CLASSES: Readonly<Record<GameBoardAreaName, string>> = {
  header: "[grid-area:header] border-b",
  opponent: "[grid-area:opponent] breit:short:border-b breit:short:border-l",
  "opponent-field": "[grid-area:opponent-field]",
  // A bar in hoch, capped by the screen's height (a low phone keeps more for the battlefields) and smaller beside an expanded
  // decision; beside the battlefields it takes its column's height - in quadrat a small strip next to the opponent while
  // the decision is expanded; in a low window it steps aside for an expanded decision (see above).
  center:
    "[grid-area:center] max-h-[clamp(5rem,15dvh,8rem)] overflow-y-auto hoch:group-data-[decision=expanded]/board:max-h-[clamp(3rem,10dvh,5rem)] quadrat:max-h-none quadrat:border-l quadrat:group-data-[decision=expanded]/board:max-h-[clamp(3rem,10dvh,5rem)] breit:max-h-none breit:border-r breit:short:border-r-0 breit:short:border-l breit:short:group-data-[decision=expanded]/board:hidden",
  field: "[grid-area:field]",
  me: "[grid-area:me] breit:short:border-t breit:short:border-l",
  // The action bar in hoch: a decision that needs room may grow upwards to 36 % of the screen's height, words that do not
  // fit to 28 % (see above). Beside the battlefields it takes its column's height.
  decision:
    "[grid-area:decision] max-h-[clamp(7rem,18dvh,11rem)] overflow-y-auto border-t hoch:group-data-[decision=expanded]/board:max-h-[clamp(9rem,36dvh,26rem)] hoch:group-data-[decision=tall]/board:max-h-[clamp(9rem,28dvh,20rem)] quadrat:max-h-none quadrat:border-l breit:max-h-none breit:border-l breit:border-t-0 breit:short:border-t",
  // The hand's height follows the screen's: 6-9 rem, the most a low screen can spare. Its row keeps the padding (room for the cards' focus ring).
  hand: "[grid-area:hand] h-[clamp(6rem,14dvh,9rem)] border-t",
}

/** One region of the board, a named section. */
function GameBoardArea({ area, className, ...props }: React.ComponentProps<"section"> & { area: GameBoardAreaName }) {
  return <section data-slot="game-board-area" data-area={area} className={cn("relative min-h-0 min-w-0", AREA_CLASSES[area], className)} {...props} />
}

export { GameBoard, GameBoardArea }
