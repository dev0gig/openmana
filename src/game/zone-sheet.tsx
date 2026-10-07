/* Visible zones of a current Forge snapshot. Opening and browsing only inspect. */
import { useRef } from "react"
import type { GameState } from "@openmana/engine-protocol"
import { Button } from "@/components/ui/button"
import { CardPicture } from "@/components/ui/card-picture"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useLandscape } from "@/hooks/use-landscape"
import type { CardBrowse } from "./card-view-model"
import type { TableCardLookup } from "./table-cards"
import { cardName, placeLabel } from "./table-labels"
import { isVisible } from "./table-model"

export type ZoneLook = Extract<CardBrowse, { kind: "zone" }> | { readonly kind: "stack" }

export function ZoneSheet({ source, state, pictures, onClose, onLook, onSourceChange }: { source: ZoneLook | null; state: GameState; pictures: TableCardLookup; onClose: () => void; onLook: (id: number, source: CardBrowse) => void; onSourceChange: (source: ZoneLook) => void }) {
  const landscape = useLandscape()
  const opener = useRef<HTMLElement | null>(null)
  const player = source?.kind === "zone" ? state.players.find((p) => p.id === source.player) : null
  const cards = source?.kind === "zone" ? player?.zones[source.zone] ?? [] : state.stack.flatMap((item) => item.card === null ? [] : [item.card])
  const visible = cards.filter(isVisible)
  const hidden = cards.length - visible.length
  const title = source?.kind === "zone" ? placeLabel(source.zone, player?.me ? "me" : "opponent") : "Karten auf dem Stapel"
  return (
    <Sheet open={source !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side={landscape ? "right" : "bottom"} showCloseButton={false} className="max-h-dvh overflow-y-auto" onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onCloseAutoFocus={(e) => { e.preventDefault(); if (opener.current?.isConnected) opener.current.focus() }}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{cards.length} Karten · Eine Karte öffnen zeigt ihre aktuelle Ansicht.</SheetDescription>
        </SheetHeader>
        <div role="group" aria-label="Sichtbare Zonen" className="flex flex-wrap gap-2 px-6 pb-4">
          {state.players.flatMap((p) => (["graveyard", "exile", "command"] as const).map((zone) => <Button className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left" key={`${p.id}:${zone}`} variant={source?.kind === "zone" && source.player === p.id && source.zone === zone ? "default" : "outline"} aria-pressed={source?.kind === "zone" && source.player === p.id && source.zone === zone} onClick={() => onSourceChange({ kind: "zone", player: p.id, zone })}>{placeLabel(zone, p.me ? "me" : "opponent")}: {p.zones[zone].length} Karten ansehen</Button>))}
          <Button className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left" variant={source?.kind === "stack" ? "default" : "outline"} aria-pressed={source?.kind === "stack"} onClick={() => onSourceChange({ kind: "stack" })}>Karten auf dem Stapel: {state.stack.length} Einträge ansehen</Button>
        </div>
        <div className="flex flex-col gap-2 px-6" role={visible.length > 0 ? "list" : undefined} aria-label={visible.length > 0 ? title : undefined}>
          {visible.map((card, index) => {
            const picture = pictures(card)
            return (
              <div key={`${card.id}:${index}`} role="listitem">
                <Button variant="outline" className="h-auto w-full justify-start whitespace-normal py-2 text-left" data-card={card.id} aria-haspopup="dialog" onClick={() => { if (source !== null) onLook(card.id, source) }}>
                  <span className="w-12 shrink-0">
                    <CardPicture src={picture === "none" || picture === "loading" ? null : picture.src} alt="" compact draggable={false} fallback={<span className="text-xs">Karte</span>} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span>{cardName(card)}</span>
                    {card.typeLine ? <span className="text-xs text-muted-foreground">{card.typeLine}</span> : null}
                    {card.action ? <span className="text-xs text-muted-foreground">Forge bietet an: {card.action}</span> : null}
                  </span>
                </Button>
              </div>
            )
          })}
          {cards.length === 0 ? <p className="text-sm text-muted-foreground">Hier liegen gerade keine Karten.</p> : null}
          {hidden > 0 ? <p className="text-sm text-muted-foreground">{hidden} verdeckte Karten – Forge gibt ihre Identität nicht frei.</p> : null}
          {source?.kind === "stack" ? <p className="text-sm text-muted-foreground">Von oben nach unten in Forges Reihenfolge. Mehrere Fähigkeiten können dieselbe Karte zeigen.</p> : null}
        </div>
        <SheetFooter className="sticky bottom-0 bg-popover"><SheetClose asChild><Button size="lg" variant="outline">Schließen</Button></SheetClose></SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
