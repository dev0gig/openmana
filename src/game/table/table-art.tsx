/*
 * The table's drawn pieces (prompt 39, docs/design/SPIELTISCH.md §4.2-4.6):
 * the OpenMana emblem, the life medallion's ring and OpenMana's own card back
 * - after the mockup's SVG symbols `#emblem`, `#medaillon` and `#rueckseite`
 * (docs/design/spieltisch-vorlage/index.html), coloured from the tokens.
 * Since prompt 57 (series openmana-menuestil) the emblem and its gold are the
 * app's shared ones (src/components/ui/emblem.tsx): the header draws `Emblem`,
 * the card back the same shapes; the app's bars and start page show it too.
 *
 * `TableArt` holds them once per table as SVG symbols (fixed ids, like the
 * surface's: one table per page); the pieces below draw them with <use>, so
 * seven backs of the opponent's hand are seven small references, not seven
 * drawings. All of it is decoration (aria-hidden): what a piece means is said
 * in words beside it (the life total, "verdeckte Karte", the zone's name and
 * count).
 *
 * The card back is OpenMana's own - never the publisher's -, and only ever
 * stands for a card Forge hides (a HiddenCard: the opponent's hand, a
 * face-down permanent, the library). It is never shown as a picture of a card
 * the player may see (the card view shows Forge's words for a card without a
 * picture, never this back).
 */
import { cn } from "cn"
import type { ComponentProps } from "react"
import { Emblem, EmblemGold, EmblemShapes } from "@/components/ui/emblem"

/** The symbols' ids. */
export const TABLE_ART = { emblem: "table-art-emblem", medallion: "table-art-medallion", back: "table-art-back" } as const

const GOLD = "url(#table-art-gold)"
const stop = (offset: number, color: string, opacity = 1) => <stop offset={offset} style={{ stopColor: color, stopOpacity: opacity }} />
const darker = (token: string, black: number) => `color-mix(in oklch, var(${token}), black ${black}%)`

/** The symbols, once in the table (first in the board, after the surface; it takes no room and no pointer). */
export function TableArt() {
  return (
    <svg data-slot="table-art" aria-hidden="true" focusable="false" width="0" height="0" className="pointer-events-none absolute size-0 overflow-hidden">
      <defs>
        <EmblemGold id="table-art-gold" />
        <linearGradient id="table-art-back-ground" x1="0" y1="0" x2="1" y2="1">
          {stop(0, darker("--table-leather", 8))}
          {stop(0.55, darker("--table-panel", 40))}
          {stop(1, `color-mix(in oklch, ${darker("--table-leather", 25)}, var(--table-danger) 10%)`)}
        </linearGradient>
        <radialGradient id="table-art-medallion-inner" cx=".5" cy=".38" r=".7">
          {stop(0, "var(--table-leather)")}
          {stop(0.7, darker("--table-panel", 35))}
          {stop(1, darker("--table-panel", 80))}
        </radialGradient>

        {/* The emblem inside the card back: the app's one drawing of it (src/components/ui/emblem.tsx), in the table's gold. */}
        <symbol id={TABLE_ART.emblem} viewBox="0 0 100 100">
          <EmblemShapes gold={GOLD} />
        </symbol>

        {/* The life medallion: a gold ring with ticks, four gems and a dark inner disc; the number is HTML on top. */}
        <symbol id={TABLE_ART.medallion} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="56" style={{ fill: darker("--table-panel", 75) }} stroke={GOLD} strokeWidth="4" />
          <circle cx="60" cy="60" r="49" fill="url(#table-art-medallion-inner)" stroke={GOLD} strokeWidth="1.5" />
          <circle cx="60" cy="60" r="52.5" fill="none" style={{ stroke: "var(--primary)" }} strokeWidth="2.4" strokeDasharray="1 5.6" opacity=".8" />
          <g fill={GOLD}>
            <path d="M60 0 66 8 60 14 54 8Z" />
            <path d="M60 120 66 112 60 106 54 112Z" />
            <path d="M0 60 8 54 14 60 8 66Z" />
            <path d="M120 60 112 54 106 60 112 66Z" />
          </g>
          <circle cx="60" cy="8" r="2.2" style={{ fill: "var(--table-mana)" }} />
        </symbol>

        {/* OpenMana's own card back: night blue, a gold frame, the emblem. */}
        <symbol id={TABLE_ART.back} viewBox="0 0 63 88">
          <rect x=".5" y=".5" width="62" height="87" rx="3.5" style={{ fill: darker("--table-panel", 75) }} />
          <rect x="2.5" y="2.5" width="58" height="83" rx="2.5" fill="url(#table-art-back-ground)" stroke={GOLD} strokeWidth="1" />
          <rect x="5" y="5" width="53" height="78" rx="1.5" fill="none" style={{ stroke: "var(--primary)" }} strokeWidth=".4" opacity=".6" />
          <path d="M31.5 9 33 15M31.5 79 30 73" style={{ stroke: "var(--primary)" }} strokeWidth=".5" opacity=".5" />
          <use href={`#${TABLE_ART.emblem}`} x="14" y="26.5" width="35" height="35" />
        </symbol>
      </defs>
    </svg>
  )
}

/** One of the symbols, drawn to fill its box (decoration). */
export function TableArtPiece({ piece, viewBox, className }: { piece: keyof typeof TABLE_ART; viewBox: string; className?: string | undefined }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox={viewBox} className={className}>
      <use href={`#${TABLE_ART[piece]}`} />
    </svg>
  )
}

/**
 * The emblem (the header's mark): the app's shared `Emblem` (series
 * openmana-menuestil, prompt 57) - the same drawing and gold as before, so
 * the table looks as it did.
 */
export function TableEmblem({ className }: { className?: string | undefined }) {
  return <Emblem className={className} />
}

/**
 * A card the player may not see (Forge's HiddenCard): OpenMana's back, the
 * height of its row, a card's proportions. `children`: what a screen reader
 * hears ("verdeckte Karte"). Keeps the slot `game-card-back` (the end-to-end
 * test counts the opponent's hidden hand by it).
 */
export function TableCardBack({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="game-card-back" className={cn("table-card-back relative aspect-63/88 h-full shrink-0", className)} {...props}>
      <TableArtPiece piece="back" viewBox="0 0 63 88" className="absolute inset-0 size-full" />
      {children}
    </div>
  )
}
