/*
 * A card's picture on the game table (prompt 13) and in Forge's questions
 * (prompt 15): the catalog's picture in the player's card language
 * (table-cards.ts), a placeholder while it is looked up, Forge's own words
 * for the card without one - never an empty box, never anything drawn over
 * the picture.
 */
import type { VisibleCard } from "@openmana/engine-protocol"
import { CardPicture } from "@/components/ui/card-picture"
import { Skeleton } from "@/components/ui/skeleton"
import type { TableCardLookup } from "./table-cards"
import { cardName } from "./table-labels"

export function TablePicture({ card, pictures }: { card: VisibleCard; pictures: TableCardLookup }) {
  const picture = pictures(card)
  const name = cardName(card)
  if (picture === "loading") {
    return (
      <Skeleton className="size-full rounded-xl">
        <span className="sr-only">{name}</span>
      </Skeleton>
    )
  }
  return (
    <CardPicture
      compact
      src={picture === "none" ? null : picture.src}
      {...(picture === "none" ? {} : { srcSet: picture.srcSet, sizes: "auto" })}
      alt={name}
      draggable={false}
      fallback={
        <>
          <span className="line-clamp-3 text-xs leading-tight font-medium">{name}</span>
          {card.typeLine ? <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">{card.typeLine}</span> : null}
        </>
      }
    />
  )
}
