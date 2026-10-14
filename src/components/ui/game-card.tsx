/*
 * A card on the game table (prompt 13), built the shadcn way (data-slot,
 * cn(), theme tokens only): shadcn/ui has no playing card.
 *
 * Sized by the height of its row, not by a width: a battlefield row or the
 * hand gives it its height, the card takes the width of a Magic card of that
 * height (63 × 88). So a row that gets less room shows smaller cards instead
 * of pushing the table into a vertical scroll (Bible §6).
 *
 * - GameCard: one card to look at (a figure). `tapped` turns the picture a
 *   quarter to the right (Magic's own sign for "tapped", unmistakable - Bible
 *   §6); the card then takes a landscape place. Scryfall's terms forbid
 *   covering, cropping, blurring or tinting card images, so the card's facts
 *   go into the chip line ABOVE the picture (GameCardCaption, prompt 40: in the
 *   row's gap, never on the picture). The one exception is `plaque` (prompt
 *   40): on the game table, Forge's power/toughness or loyalty on the card's
 *   own printed value box - it lies in the card's face, upright also when the
 *   card is tapped (src/game/table/card-parts.tsx, table.css).
 * - `pile` (prompt 40): a pile of equal cards - up to two cards behind the
 *   front one, offset to the left (drawn by the table's stylesheet; the count
 *   is the caption's chip).
 * - GameCardButton (prompt 14): the same card as a control - a button the
 *   player focuses, clicks, taps, long-presses. Long presses and right clicks
 *   must not open the browser's image menu or select text, so the card turns
 *   both off (the page handles the context menu itself).
 * - `mark` (prompt 14): Forge's state of the card as a frame AROUND the
 *   picture, never on it - gold for "usable now" (the one accent for "do
 *   this", --primary), a strong light frame for "chosen" (--foreground), red
 *   for a named stack target (prompt 23; --table-danger since prompt 40). On
 *   the game table, table.css adds what tells them apart beyond colour (WCAG
 *   1.4.1): a glow for usable, a thicker frame for chosen, a pulse for a
 *   target; the words stay in the chips and the card's name. Usable/selected
 *   frames take precedence. The frame is an outline: it takes no room, so a
 *   mark never moves a row and an unmarked card has nothing around its
 *   picture (project owner, 2026-10-12; until then every card kept a 2 px
 *   transparent border as the frame's room).
 * - A card whose face the player may not see (Forge's hidden cards) is the
 *   table's own back since prompt 39 (TableCardBack, src/game/table/
 *   table-art.tsx: OpenMana's back, never Wizards'), slot game-card-back.
 * - GameCardGroup: a card with what is attached to it (auras, equipment),
 *   side by side, together.
 * - GameCardRow / GameCardRowItem (prompt 14): a row of cards that scrolls
 *   sideways (a battlefield row sizes its cards by its height and width since
 *   prompt 40: table.css, class table-field-row). With cards to operate it is
 *   a toolbar (Radix): one stop for
 *   the Tab key, the arrow keys, Home and End move between its cards, and
 *   focusing a card scrolls it into view - so the row stays usable by
 *   keyboard. A row without such cards stays a list that takes the focus
 *   itself (a scrolling region must be reachable by keyboard, WCAG 2.1.1).
 */
import * as React from "react"
import { cn } from "cn"
import { Toolbar as ToolbarPrimitive } from "radix-ui"

/** How much of the card's height the chip line above the picture takes (h-3.5 and the gap-0.5 below). */
const CAPTION = "h-[calc(100%-1rem)]"

export type GameCardMark = "usable" | "selected" | "target"

/** The marks' frames around a picture - also the zone view's cards (card-tile.tsx), so a mark looks the same everywhere. */
const GAME_CARD_MARKS: Readonly<Record<GameCardMark, string>> = {
  usable: "outline-2 outline-primary",
  selected: "outline-3 outline-foreground",
  target: "outline-2 outline-table-danger",
}

/** Inside a button a caption is a span (figcaption belongs to a figure). */
const GameCardRootContext = React.createContext<"figure" | "button">("figure")

/**
 * The picture's place: exactly the picture (turned when tapped; a mark is an
 * outline around it, taking no room), the plaque on it (upright) - and, for a
 * pile, the cards behind.
 */
function GameCardFace({ tapped, mark, caption, plaque, pile, children }: { tapped: boolean; mark: GameCardMark | null; caption: boolean; plaque: React.ReactNode; pile: number; children: React.ReactNode }) {
  const face = (
    <span
      data-slot="game-card-face"
      data-mark={mark ?? undefined}
      className={cn("relative block rounded-xl", caption ? CAPTION : "h-full", tapped ? "aspect-square" : "aspect-63/88", mark ? GAME_CARD_MARKS[mark] : null)}
    >
      <span data-slot="game-card-picture" className={cn("block", tapped ? "absolute top-1/2 left-1/2 aspect-63/88 h-full -translate-x-1/2 -translate-y-1/2 rotate-90" : "size-full")}>
        {children}
      </span>
      {plaque}
    </span>
  )
  if (pile <= 1) return face
  // The front card and at most two behind it (PILE_LAYERS of src/game/table/card-parts.tsx; the chip says how many).
  const behind = Math.min(pile, 3) - 1
  return (
    <span data-slot="game-card-pile" className="relative block" style={{ "--layers": behind } as React.CSSProperties}>
      {Array.from({ length: behind }, (_, index) => (
        <span key={index} data-slot="game-card-layer" aria-hidden style={{ "--k": index } as React.CSSProperties} />
      ))}
      {face}
    </span>
  )
}

type CardLookProps = {
  tapped?: boolean
  /** Forge's state of the card as a frame around the picture (null: none). */
  mark?: GameCardMark | null
  /** The chip line above the picture; without one the picture takes the whole height. */
  caption?: React.ReactNode
  /** What lies on the picture: on the game table only the value plaque (prompt 40). */
  plaque?: React.ReactNode
  /** How many equal cards this card stands for (a pile, prompt 40): up to two are drawn behind it. */
  pile?: number
  /** The picture (a CardPicture) or the back. */
  children: React.ReactNode
}

const ROOT = "flex h-full shrink-0 flex-col items-center gap-0.5"

function GameCard({ className, tapped = false, mark = null, caption, plaque, pile = 1, children, ...props }: Omit<React.ComponentProps<"figure">, "children"> & CardLookProps) {
  return (
    <GameCardRootContext value="figure">
      <figure data-slot="game-card" data-tapped={tapped} data-mark={mark ?? undefined} className={cn(ROOT, className)} {...props}>
        {caption !== undefined ? caption : null}
        <GameCardFace tapped={tapped} mark={mark} caption={caption !== undefined} plaque={plaque} pile={pile}>
          {children}
        </GameCardFace>
      </figure>
    </GameCardRootContext>
  )
}

function GameCardButton({ className, tapped = false, mark = null, caption, plaque, pile = 1, children, ...props }: Omit<React.ComponentProps<"button">, "children"> & CardLookProps) {
  return (
    <GameCardRootContext value="button">
      <button
        type="button"
        data-slot="game-card"
        data-tapped={tapped}
        data-mark={mark ?? undefined}
        className={cn(
          ROOT,
          // The focus ring of shadcn's buttons, around the whole card. No image menu, no text selection on a long press.
          "cursor-pointer rounded-2xl outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [-webkit-touch-callout:none]",
          className,
        )}
        {...props}
      >
        {caption !== undefined ? caption : null}
        <GameCardFace tapped={tapped} mark={mark} caption={caption !== undefined} plaque={plaque} pile={pile}>
          {children}
        </GameCardFace>
      </button>
    </GameCardRootContext>
  )
}

/**
 * The chip line above a card's picture (prompt 40; before: a strip below it):
 * its facts as small chips in one line, in the row's gap, never on the
 * picture. It never widens the card (w-0 min-w-full); centred while it fits,
 * else cut at the end - with the full facts in its title.
 */
function GameCardCaption({ className, ...props }: React.ComponentProps<"figcaption">) {
  const root = React.use(GameCardRootContext)
  const Caption = root === "button" ? "span" : "figcaption"
  return (
    <Caption
      data-slot="game-card-caption"
      className={cn("flex h-3.5 w-0 min-w-full shrink-0 items-end justify-center-safe gap-0.5 overflow-hidden text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground tabular-nums [&_svg]:size-2.5 [&_svg]:shrink-0", className)}
      {...props}
    />
  )
}

/** A card and its attachments together (on the game table a plate behind them, table.css). */
function GameCardGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="game-card-group" className={cn("flex h-full shrink-0 gap-1 rounded-2xl border border-dashed p-0.5", className)} {...props} />
}

/** A row's items are list items - or, in a toolbar, only containers (role none). */
const GameCardRowContext = React.createContext(false)

const ROW = "relative flex min-h-0 flex-1 items-stretch justify-center-safe gap-1.5 overflow-x-auto overflow-y-hidden px-2 py-1"

/**
 * A row of cards (see above). `controls`: the row holds cards to operate
 * (GameCardButton inside GameCardRowButton) - a toolbar; otherwise a list
 * that takes the focus itself so it can be scrolled by keyboard.
 */
function GameCardRow({ className, controls = false, ...props }: React.ComponentProps<"ul"> & { controls?: boolean }) {
  if (!controls) {
    // A scrolling region must take the keyboard's focus (axe: scrollable-region-focusable).
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    return <ul data-slot="game-card-row" tabIndex={0} className={cn(ROW, className)} {...props} />
  }
  return (
    <GameCardRowContext value>
      <ToolbarPrimitive.Root asChild orientation="horizontal" loop={false}>
        <ul data-slot="game-card-row" className={cn(ROW, className)} {...props} />
      </ToolbarPrimitive.Root>
    </GameCardRowContext>
  )
}

function GameCardRowItem({ className, ...props }: React.ComponentProps<"li">) {
  const toolbar = React.use(GameCardRowContext)
  return <li data-slot="game-card-row-item" className={cn("h-full", className)} {...(toolbar ? { role: "none" } : {})} {...props} />
}

/** A card of a toolbar row: one of the arrow keys' stops (wraps a GameCardButton). */
function GameCardRowButton(props: React.ComponentProps<typeof ToolbarPrimitive.Button>) {
  return <ToolbarPrimitive.Button asChild {...props} />
}

export { GAME_CARD_MARKS, GameCard, GameCardButton, GameCardCaption, GameCardGroup, GameCardRow, GameCardRowButton, GameCardRowItem }
