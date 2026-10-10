/*
 * The pieces of a card on the battlefield (prompt 40, docs/design/SPIELTISCH.md
 * §4.7-4.9; mockup `.werte`, `.stapel-zahl`, `.reihe`): the value plaque on the
 * card's printed value box, the fact chips above the picture, and the numbers a
 * battlefield row sizes its cards by. Only presentation of Forge's values -
 * GameTable decides what each card shows.
 */
import { Shield } from "lucide-react"
import { cn } from "cn"
import type { ComponentProps } from "react"
import type { PlaqueValue } from "../table-labels"
import type { BoardEntry } from "../table-model"

/**
 * Forge's power/toughness or loyalty on the card's printed value box at the
 * bottom right (the one thing on a card picture; table.css places it - upright
 * on a tapped card, clear of the copyright edge - and hides it on cards
 * narrower than 44 px). Hidden from screen readers: the card's name says it.
 */
export function ValuePlaque({ value }: { value: PlaqueValue }) {
  return (
    <span data-slot="game-card-plaque" data-kind={value.kind} aria-hidden className="table-plaque">
      {value.kind === "loyalty" ? <Shield className="table-plaque-symbol" /> : null}
      {value.text}
    </span>
  )
}

/** How a chip stands out: a pile's count, a word that matters (Quelle), danger (Ziel, damage), combat. */
export type CardChipTone = "pile" | "strong" | "danger" | "attack" | "block"

/** A fact as a small chip in the card's chip line above its picture (GameCardCaption). */
export function CardChip({ tone, className, ...props }: ComponentProps<"span"> & { tone?: CardChipTone }) {
  return <span data-tone={tone} className={cn("table-card-chip", className)} {...props} />
}

/** Cards a pile draws: the front and up to two behind it; the chip says how many there are. */
export const PILE_LAYERS = 3
/** A tapped card's width in card widths (it lies turned: 88 : 63). */
export const TAPPED_WIDTH = 88 / 63
/** How far each card behind a pile's front card shows (in card widths, the mockup's 0.12). */
export const PILE_STEP = 0.12

/** The cards a pile of `count` equal cards draws. */
export function pileLayers(count: number): number {
  return Math.max(1, Math.min(count, PILE_LAYERS))
}

/** The width one card or pile takes in a row, in card widths (the mockup's `--u` per card). */
export function cardUnits(tapped: boolean, count = 1): number {
  return (tapped ? TAPPED_WIDTH : 1) + PILE_STEP * (pileLayers(count) - 1)
}

/**
 * What a battlefield row sizes its cards by (the mockup's `--u` and `--c`):
 * the width of all its cards in card widths - tapped cards lie turned, a pile
 * shows the cards behind its front card - and the number of cards it draws
 * (each with its frame; attachments count, they stay with their host). The
 * command zone's cards are single cards.
 */
export function rowSize(entries: readonly BoardEntry[], command = 0): { readonly units: number; readonly places: number } {
  let units = command
  let places = command
  for (const entry of entries) {
    if (entry.kind === "hidden") {
      units += 1
      places += 1
      continue
    }
    units += cardUnits(entry.card.tapped, entry.ids.length)
    places += 1
    for (const attachment of entry.attachments) {
      units += cardUnits(attachment.tapped)
      places += 1
    }
  }
  return { units: Math.max(units, 1), places: Math.max(places, 1) }
}
