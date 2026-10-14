/*
 * A card in a grid of whole card pictures (the zone view, ZoneSheet), built
 * the shadcn way (data-slot, cn(), theme tokens only): shadcn/ui has no
 * playing card, and the game table's GameCardButton is sized by its row's
 * height, while a tile takes its column's width.
 *
 * - The picture (a CardPicture through TablePicture) is whole and nothing
 *   lies on it. Forge's mark is the table's frame AROUND it (GAME_CARD_MARKS
 *   of game-card.tsx, outside the picture with a small offset, taking no
 *   room): gold for "usable", the strong light frame for "chosen". An
 *   unmarked card has nothing around its picture.
 * - Below the picture: the card's name (two lines at most), how many equal
 *   cards the tile stands for ("×N", a Badge - never on the picture) and an
 *   optional note (`note`, e.g. "zuletzt").
 * - The whole tile is one button; its name (aria-label) and title say every
 *   fact the picture alone does not.
 */
import * as React from "react"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { GAME_CARD_MARKS, type GameCardMark } from "@/components/ui/game-card"

type CardTileProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** The picture (a CardPicture, or its stand-in while it loads). */
  picture: React.ReactNode
  /** The card's name under the picture. */
  name: string
  /** How many equal cards this tile stands for; from 2 on "×N" stands beside the name. */
  count?: number
  /** Forge's state of the card as a frame around the picture (null: none). */
  mark?: GameCardMark | null
  /** A short word under the name ("zuletzt"); null: none. */
  note?: string | null
}

function CardTile({ className, picture, name, count = 1, mark = null, note = null, ...props }: CardTileProps) {
  return (
    <button
      type="button"
      data-slot="card-tile"
      data-mark={mark ?? undefined}
      className={cn(
        // shadcn's focus ring around the whole tile; at least 44 px also on a small column (WCAG 2.5.5 for touch).
        "group/card-tile flex min-h-11 w-full min-w-11 cursor-pointer flex-col gap-1.5 rounded-2xl p-1.5 text-left outline-none select-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 [-webkit-touch-callout:none]",
        className,
      )}
      {...props}
    >
      <span data-slot="card-tile-face" data-mark={mark ?? undefined} className={cn("block rounded-xl", mark ? cn(GAME_CARD_MARKS[mark], "outline-offset-2") : null)}>
        {picture}
      </span>
      <span data-slot="card-tile-name" className="flex min-w-0 items-start gap-1 text-xs leading-tight">
        <span className="line-clamp-2 min-w-0 flex-1 font-medium">{name}</span>
        {count > 1 ? <Badge variant="secondary" className="tabular-nums" aria-hidden>×{count}</Badge> : null}
      </span>
      {note !== null ? <Badge variant="outline" data-slot="card-tile-note" className="text-muted-foreground" aria-hidden>{note}</Badge> : null}
    </button>
  )
}

export { CardTile }
