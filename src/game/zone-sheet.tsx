/*
 * The visible zones of a current Forge snapshot (prompt 20; redesigned
 * 2026-10-14, docs/implementation/zone-sheet-redesign.md). Opening, switching
 * and browsing only inspect - nothing is ever sent to Forge.
 *
 * - The switcher: two shadcn ToggleGroups - whose zones (Du, Forge-KI) and
 *   which zone (Friedhof, Exil, Kommando with their counts, and the stack,
 *   which both players share: while it is shown no player is pressed, and a
 *   player's button goes back to that player's zone shown last). Empty zones
 *   stay selectable (muted), so every zone is reachable and its emptiness
 *   can be read.
 * - The cards: whole pictures in a grid (CardTile) whose columns follow the
 *   Sheet's width (container queries), identical cards grouped "×N" as the
 *   table groups its piles, graveyard and exile newest first (zone-model.ts).
 *   Forge's mark (cardUse: usable, chosen) is the table's frame around the
 *   picture; Forge's offer is in the tile's name and title. A tile opens the
 *   card view, which browses the zone in the same order.
 */
import { useRef, useState } from "react"
import { Layers } from "lucide-react"
import type { GameState } from "@openmana/engine-protocol"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardTile } from "@/components/ui/card-tile"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cardUse, type TableMoment } from "./card-use"
import type { CardBrowse } from "./card-view-model"
import type { TableCardLookup } from "./table-cards"
import { cardButtonLabel, cardName, placeLabel, seatName } from "./table-labels"
import { TablePicture } from "./table-picture"
import { useTableSheetSide } from "./table/use-table-layout"
import { SHEET_ZONES, zoneContents, type SheetZone, type ZoneEntry, type ZoneSource } from "./zone-model"

export type ZoneLook = ZoneSource

/** The zone buttons' short words (the Sheet's title and the buttons' names say the whole place). */
const ZONE_WORDS: Readonly<Record<SheetZone, string>> = { graveyard: "Friedhof", exile: "Exil", command: "Kommando" }

/** The mark beside the newest card of a graveyard or exile (zone-model.ts). */
export const LATEST_NOTE = "zuletzt"

function cards(count: number): string {
  return count === 1 ? "1 Karte" : `${count} Karten`
}

function entries(count: number): string {
  return count === 1 ? "1 Eintrag" : `${count} Einträge`
}

export function ZoneSheet({ source, state, moment, pictures, onClose, onLook, onSourceChange }: { source: ZoneLook | null; state: GameState; moment: TableMoment; pictures: TableCardLookup; onClose: () => void; onLook: (id: number, source: CardBrowse) => void; onSourceChange: (source: ZoneLook) => void }) {
  const side = useTableSheetSide()
  const opener = useRef<HTMLElement | null>(null)
  // The player's zone shown last: the stack has no player, the switcher keeps whose zones it counts.
  const [last, setLast] = useState<{ readonly player: number; readonly zone: SheetZone } | null>(null)
  if (source?.kind === "zone" && (last?.player !== source.player || last.zone !== source.zone)) setLast({ player: source.player, zone: source.zone })
  const fallback = (state.players.find((p) => p.me) ?? state.players[0])?.id ?? null
  const shownPlayer = source?.kind === "zone" ? source.player : last !== null && state.players.some((p) => p.id === last.player) ? last.player : fallback
  const shownZone: SheetZone = source?.kind === "zone" ? source.zone : last?.zone ?? "graveyard"
  const player = state.players.find((p) => p.id === shownPlayer) ?? null
  const seat = player?.me ? "me" : "opponent"
  const contents = source === null ? null : zoneContents(state, source, moment.questions)
  const title = source?.kind === "zone" ? placeLabel(source.zone, seat) : "Karten auf dem Stapel"
  const count = contents === null ? "" : source?.kind === "stack" ? entries(contents.total) : cards(contents.total)
  return (
    <Sheet open={source !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side={side} showCloseButton={false} className="max-h-dvh overflow-y-auto data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-2xl data-[side=right]:xl:max-w-3xl" onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onCloseAutoFocus={(e) => { e.preventDefault(); if (opener.current?.isConnected) opener.current.focus() }}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{count}</SheetDescription>
        </SheetHeader>
        <div data-slot="zone-switcher" className="flex flex-col gap-2 px-6 pb-4">
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label="Wessen Zonen"
            value={source?.kind === "zone" ? String(source.player) : ""}
            onValueChange={(value) => {
              // Radix empties a single group when its pressed item is pressed again: nothing changes then.
              if (value !== "") onSourceChange({ kind: "zone", player: Number(value), zone: shownZone })
            }}
          >
            {state.players.map((p) => (
              <ToggleGroupItem key={p.id} value={String(p.id)}>{seatName(p.me ? "me" : "opponent")}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label="Welche Zone"
            className="flex-wrap"
            value={source?.kind === "zone" ? source.zone : source?.kind === "stack" ? "stack" : ""}
            onValueChange={(value) => {
              if (value === "") return
              if (value === "stack") onSourceChange({ kind: "stack" })
              else if (shownPlayer !== null) onSourceChange({ kind: "zone", player: shownPlayer, zone: value as SheetZone })
            }}
          >
            {SHEET_ZONES.map((zone) => {
              const n = player?.zones[zone].length ?? 0
              return (
                <ToggleGroupItem key={zone} value={zone} disabled={player === null} aria-label={`${placeLabel(zone, seat)}: ${cards(n)}`} data-empty={n === 0 || undefined} className={n === 0 ? "text-muted-foreground" : undefined}>
                  {ZONE_WORDS[zone]}
                  <Badge variant={n === 0 ? "outline" : "secondary"} className="tabular-nums">{n}</Badge>
                </ToggleGroupItem>
              )
            })}
            <ToggleGroupItem value="stack" aria-label={`Stapel, gemeinsam: ${entries(state.stack.length)}`} data-empty={state.stack.length === 0 || undefined} className={state.stack.length === 0 ? "text-muted-foreground" : undefined}>
              Stapel
              <Badge variant={state.stack.length === 0 ? "outline" : "secondary"} className="tabular-nums">{state.stack.length}</Badge>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-3 px-6 pb-4">
          {contents !== null && contents.entries.length > 0 ? (
            <div className="@container/zone-grid">
              <ul aria-label={title} className="grid grid-cols-2 gap-2 @sm/zone-grid:grid-cols-3 @xl/zone-grid:grid-cols-4 @2xl/zone-grid:grid-cols-5">
                {contents.entries.map((entry) => (
                  <li key={entry.key}>
                    <ZoneTile entry={entry} source={source} mine={player?.me === true} moment={moment} pictures={pictures} onLook={onLook} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {contents !== null && contents.total === 0 ? (
            <Empty data-slot="zone-empty" className="p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Layers aria-hidden /></EmptyMedia>
                <EmptyTitle>Keine Karten</EmptyTitle>
                <EmptyDescription>{source?.kind === "stack" ? "Der Stapel ist leer." : "Hier liegt gerade nichts."}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {contents !== null && contents.hidden > 0 ? <p className="text-sm text-muted-foreground">{contents.hidden === 1 ? "1 verdeckte Karte" : `${contents.hidden} verdeckte Karten`} – Forge gibt ihre Identität nicht frei.</p> : null}
          {source?.kind === "stack" && contents !== null && contents.entries.length > 0 ? <p className="text-sm text-muted-foreground">Oben zuerst, in Forges Reihenfolge; jede Karte einmal.</p> : null}
        </div>
        <SheetFooter className="sticky bottom-0 bg-popover"><SheetClose asChild><Button size="lg" variant="outline">Schließen</Button></SheetClose></SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/** One tile: the card whole, its name, "×N", the newest mark; Forge's mark around the picture, its offer in the name. */
function ZoneTile({ entry, source, mine, moment, pictures, onLook }: { entry: ZoneEntry; source: ZoneLook | null; mine: boolean; moment: TableMoment; pictures: TableCardLookup; onLook: (id: number, source: CardBrowse) => void }) {
  const { card, ids } = entry
  const zone = source?.kind === "zone" ? source.zone : "stack"
  // Forge's state of the card from card-use.ts alone; the zone view only looks, so the name never says "Antippen".
  const use = cardUse(card, { zone, mine: zone !== "stack" && mine }, moment)
  const offer = use.tap !== null ? `Forge bietet an: ${use.tap.label}` : null
  const label = [cardButtonLabel(card, { ...use, primary: "look" }, { count: ids.length }), ...(offer !== null ? [offer] : []), ...(entry.latest ? ["zuletzt hinzugekommen"] : [])].join(", ")
  return (
    <CardTile
      data-card={card.id}
      data-count={ids.length > 1 ? ids.length : undefined}
      data-latest={entry.latest || undefined}
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      picture={<TablePicture card={card} pictures={pictures} />}
      name={cardName(card)}
      count={ids.length}
      mark={use.mark}
      note={entry.latest ? LATEST_NOTE : null}
      onClick={() => { if (source !== null) onLook(card.id, source) }}
    />
  )
}
