/*
 * The pieces of a player's strip (prompt 39, docs/design/SPIELTISCH.md
 * §4.3-4.6; mockup `.medaillon`, `.zone*`, `.anzahl-text`): the life
 * medallion's face, the zone piles and counters, the strip's chips. Only
 * presentation of Forge's numbers - GameTable decides what each one shows and
 * what a tap on a zone opens (the zone view: looking only, nothing sent).
 *
 * Every count keeps its anchor: an element with the zone's title ("Hand",
 * "Bibliothek", "Friedhof", "Exil", "Kommandozone") whose text ends with the
 * number - the name first in the page, the number shown first (the mockup's
 * "7 Hand") by the layout, never by reordering the words.
 */
import { Crosshair } from "lucide-react"
import { cn } from "cn"
import type { ComponentProps, ReactNode } from "react"
import { TableArtPiece } from "./table-art"

/**
 * The medallion's face: the gold ring, the life total in Cinzel (`title`
 * "Lebenspunkte", the number in `.tabular-nums`), the name band, a crosshair
 * while a spell on the stack targets the player. Goes inside GamePlayer or
 * GamePlayerButton (the medallion is the player's control).
 */
export function MedallionFace({ name, life, target, active }: { name: string; life: number; target: boolean; active: boolean }) {
  return (
    <>
      <TableArtPiece piece="medallion" viewBox="0 0 120 120" className="table-medallion-ring" />
      <span className="table-medallion-life" title="Lebenspunkte">
        <span className="tabular-nums">{life}</span>
        <span className="sr-only">Lebenspunkte</span>
      </span>
      <span className="table-medallion-band">{name}</span>
      {target ? <Crosshair aria-hidden className="table-medallion-target" /> : null}
      {active ? <span className="sr-only">, am Zug</span> : null}
    </>
  )
}

/** A zone's name and number: the name first in the page, the number shown first ("7 Hand"). */
export function ZoneWords({ name, count, nameClassName }: { name: string; count: number; nameClassName?: string }) {
  return (
    <span className="table-zone-words">
      <span className={nameClassName}>{name}</span>{" "}
      <span className="table-zone-count tabular-nums">{count}</span>
    </span>
  )
}

/** A count in words on the strip ("Hand 7"), not a control. */
export function ZoneCount({ name, count, className }: { name: string; count: number; className?: string }) {
  return (
    <span className={cn("table-chip table-count", className)} title={name}>
      <ZoneWords name={name} count={count} />
    </span>
  )
}

const PILE_BUTTON = "min-h-6 min-w-6 cursor-pointer outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-11 pointer-coarse:min-w-11 [-webkit-touch-callout:none]"

/**
 * A zone as a pile (the mockup's `.zone`): its card - OpenMana's back for the
 * library, the top card for the graveyard, nothing for an empty place -, the
 * number and, where there is room, the name. With `onOpen` a button that
 * opens the zone view (looking only); without it (the library: Forge sends
 * only its size) a count to read.
 */
export function ZonePile({ name, count, label, card, onOpen, empty = false }: { name: string; count: number; label?: string; card: ReactNode; onOpen?: () => void; empty?: boolean }) {
  const content = (
    <>
      <span className={cn("table-pile-card", empty ? "table-pile-empty" : null)}>{card}</span>
      <ZoneWords name={name} count={count} nameClassName="table-pile-name" />
    </>
  )
  if (onOpen === undefined) {
    return (
      <span data-zone-pile={name} className="table-pile" title={name}>
        {content}
      </span>
    )
  }
  return (
    <button type="button" data-zone-pile={name} className={cn("table-pile", PILE_BUTTON)} title={name} aria-label={label} aria-haspopup="dialog" onClick={onOpen}>
      {content}
    </button>
  )
}

/**
 * A zone as a compact counter (exile, command zone): a symbol, the number and
 * the name in a chip; a button - its touch area at least 44 px, larger than
 * the chip - that opens the zone view (looking only).
 */
export function ZoneCounter({ name, count, label, icon, onOpen, nameClassName }: { name: string; count: number; label: string; icon: ReactNode; onOpen: () => void; nameClassName?: string }) {
  return (
    <button type="button" data-zone-pile={name} className={cn("table-counter", PILE_BUTTON)} title={name} aria-label={label} aria-haspopup="dialog" onClick={onOpen}>
      <span className="table-chip">
        {icon}
        <ZoneWords name={name} count={count} {...(nameClassName !== undefined ? { nameClassName } : {})} />
      </span>
    </button>
  )
}

/** A fact of the strip as a small chip in the table's style (profile, priority, mana, counters, commander values …). */
export function StripChip({ className, tone, ...props }: ComponentProps<"span"> & { tone?: "danger" }) {
  return <span data-tone={tone} className={cn("table-chip whitespace-nowrap", className)} {...props} />
}
