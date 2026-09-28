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
 *   §6); the card then takes a square place. Nothing is ever drawn over the
 *   picture: Scryfall's terms forbid covering, cropping, blurring or tinting
 *   card images, so all the card's facts (power, counters, how many in a pile
 *   …) go into the caption strip below it (GameCardCaption).
 * - GameCardButton (prompt 14): the same card as a control - a button the
 *   player focuses, clicks, taps, long-presses. Long presses and right clicks
 *   must not open the browser's image menu or select text, so the card turns
 *   both off (the page handles the context menu itself).
 * - `mark` (prompt 14): Forge's state of the card as a frame AROUND the
 *   picture, never on it - a dashed gold frame for "usable now" (the one
 *   accent for "do this", --primary), a solid parchment frame for "chosen"
 *   (--foreground). Dashed against solid tells the two apart without colour
 *   (WCAG 1.4.1); both reach 3:1 against the table (1.4.11). Every card keeps
 *   the frame's room, marked or not, so a mark never moves a row.
 * - GameCardBack: a card whose face the player may not see (Forge's hidden
 *   cards): OpenMana's own back, never Wizards' card back.
 * - GameCardGroup: a card with what is attached to it (auras, equipment),
 *   side by side in one frame.
 * - GameCardRow / GameCardRowItem (prompt 14): a row of cards that scrolls
 *   sideways. With cards to operate it is a toolbar (Radix): one stop for
 *   the Tab key, the arrow keys, Home and End move between its cards, and
 *   focusing a card scrolls it into view - so the row stays usable by
 *   keyboard. A row without such cards stays a list that takes the focus
 *   itself (a scrolling region must be reachable by keyboard, WCAG 2.1.1).
 */
import * as React from "react"
import { cn } from "cn"
import { Layers } from "lucide-react"
import { Toolbar as ToolbarPrimitive } from "radix-ui"

/** How much of the card's height the caption strip takes (h-5 below). */
const CAPTION = "h-[calc(100%-1.375rem)]"

export type GameCardMark = "usable" | "selected"

/** The frames of Forge's marks (shared with GamePlayerButton, prompt 17). */
export const GAME_MARK_FRAMES: Readonly<Record<GameCardMark, string>> = {
  usable: "border-dashed border-primary",
  selected: "border-solid border-foreground",
}

/** Inside a button a caption is a span (figcaption belongs to a figure). */
const GameCardRootContext = React.createContext<"figure" | "button">("figure")

/** The picture's place: the frame's room around it, the picture itself (turned when tapped). */
function GameCardFace({ tapped, mark, caption, children }: { tapped: boolean; mark: GameCardMark | null; caption: boolean; children: React.ReactNode }) {
  return (
    <span
      data-slot="game-card-face"
      data-mark={mark ?? undefined}
      className={cn("relative block rounded-2xl border-2 border-transparent", caption ? CAPTION : "h-full", tapped ? "aspect-square" : "aspect-63/88", mark ? GAME_MARK_FRAMES[mark] : null)}
    >
      <span className={cn("block", tapped ? "absolute top-1/2 left-1/2 aspect-63/88 h-full -translate-x-1/2 -translate-y-1/2 rotate-90" : "size-full")}>{children}</span>
    </span>
  )
}

type CardLookProps = {
  tapped?: boolean
  /** Forge's state of the card as a frame around the picture (null: none). */
  mark?: GameCardMark | null
  /** The strip below the picture; without one the picture takes the whole height. */
  caption?: React.ReactNode
  /** The picture (a CardPicture) or the back. */
  children: React.ReactNode
}

const ROOT = "flex h-full shrink-0 flex-col items-center gap-0.5"

function GameCard({ className, tapped = false, mark = null, caption, children, ...props }: Omit<React.ComponentProps<"figure">, "children"> & CardLookProps) {
  return (
    <GameCardRootContext value="figure">
      <figure data-slot="game-card" data-tapped={tapped} data-mark={mark ?? undefined} className={cn(ROOT, className)} {...props}>
        <GameCardFace tapped={tapped} mark={mark} caption={caption !== undefined}>
          {children}
        </GameCardFace>
        {caption !== undefined ? caption : null}
      </figure>
    </GameCardRootContext>
  )
}

function GameCardButton({ className, tapped = false, mark = null, caption, children, ...props }: Omit<React.ComponentProps<"button">, "children"> & CardLookProps) {
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
        <GameCardFace tapped={tapped} mark={mark} caption={caption !== undefined}>
          {children}
        </GameCardFace>
        {caption !== undefined ? caption : null}
      </button>
    </GameCardRootContext>
  )
}

/**
 * The strip below a card: its facts in one line. It never widens the card
 * (w-0 min-w-full); centred while it fits, else cut at the end - text that
 * may be cut goes into a `truncate` span - with the full text in its title.
 */
function GameCardCaption({ className, ...props }: React.ComponentProps<"figcaption">) {
  const root = React.use(GameCardRootContext)
  const Caption = root === "button" ? "span" : "figcaption"
  return (
    <Caption
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

export { GameCard, GameCardBack, GameCardButton, GameCardCaption, GameCardGroup, GameCardRow, GameCardRowButton, GameCardRowItem }
