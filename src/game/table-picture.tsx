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

/** A hand card's picture is chosen for its lifted size: a full card (at most 11.5 rem) times 1.12 (table/hand-fan.ts). */
export const HAND_PICTURE_SIZES = "13rem"

/**
 * `sizes` for the picture's choice from the srcset: by default its laid-out
 * width ("auto"); a card of the hand passes HAND_PICTURE_SIZES, because it is
 * shown lifted at a full card's size (a transform the browser does not count).
 */
export function TablePicture({ card, pictures, sizes = "auto" }: { card: VisibleCard; pictures: TableCardLookup; sizes?: string }) {
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
      {...(picture === "none" ? {} : { srcSet: picture.srcSet, sizes })}
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
