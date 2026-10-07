/* Forge's own log, in reception order. Sources are IDs resolved against the current state. */
import { useMemo, useRef } from "react"
import type { GameEvent, GameState, Question, VisibleCard } from "@openmana/engine-protocol"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useLandscape } from "@/hooks/use-landscape"
import { questionCard } from "./card-view-model"
import { cardName } from "./table-labels"
import { locateCard } from "./table-model"

/** Presentation labels only; unknown Forge kinds retain their original identifier. */
const KINDS: Readonly<Record<string, string>> = {
  TURN: "Zug", PHASE: "Schritt", LAND: "Land", STACK_ADD: "Auf dem Stapel", STACK_RESOLVE: "Verrechnung",
  DAMAGE: "Schaden", LIFE: "Lebenspunkte", COMBAT: "Kampf", GAME_OUTCOME: "Ergebnis", MATCH_RESULTS: "Partie",
  ANTE: "Ante", DRAFT: "Draft", ZONE_CHANGE: "Zonenwechsel", DISCARD: "Abwerfen", INFORMATION: "Information", EFFECT_REPLACED: "Ersatzeffekt", MANA: "Mana", MULLIGAN: "Mulligan", PLAYER_CONTROL: "Spielerkontrolle", DRAW: "Karten ziehen",
}

export function historySource(event: GameEvent, state: GameState | null, questions: readonly Question[]) {
  if (event.card === undefined) return null
  return (state === null ? null : locateCard(state, event.card)?.card) ?? questionCard(questions, event.card)?.card ?? null
}

export function HistorySheet({ open, onOpenChange, history, state, questions, onLook }: {
  open: boolean; onOpenChange: (open: boolean) => void; history: readonly GameEvent[]; state: GameState | null;
  questions: readonly Question[]; onLook: (id: number) => void;
}) {
  const landscape = useLandscape()
  const opener = useRef<HTMLElement | null>(null)
  const end = useRef<HTMLLIElement>(null)
  const sources = useMemo(() => {
    const resolved = new Map<number, VisibleCard | null>()
    if (open) for (const event of history) {
      if (event.card !== undefined && !resolved.has(event.card)) resolved.set(event.card, historySource(event, state, questions))
    }
    return resolved
  }, [open, history, state, questions])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={landscape ? "right" : "bottom"} showCloseButton={false} className="max-h-dvh data-[side=right]:sm:max-w-xl" onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onCloseAutoFocus={(event) => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus() }}>
        <SheetHeader className="shrink-0">
          <SheetTitle>Spielverlauf</SheetTitle>
          <SheetDescription>{history.length} Einträge aus Forges Spielprotokoll · älteste zuerst. Nur in dieser Sitzung verfügbar.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6" data-history-scroll>
          {!open ? null : history.length === 0 ? <p className="text-sm text-muted-foreground">Forge hat noch keine Ereignisse gemeldet.</p> : (
            <ol aria-label="Forges Spielprotokoll" className="flex flex-col gap-2">
              {history.map((event, index) => {
                const source = event.card === undefined ? null : sources.get(event.card) ?? null
                return (
                  <Item asChild variant="outline" size="xs" key={index}>
                    <li data-history-entry={index} data-history-kind={event.kind} data-history-actor={event.actor} ref={index === history.length - 1 ? end : undefined}>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="flex! flex-wrap gap-2 line-clamp-none">
                          {event.actor === "me" ? "Du" : event.actor === "opponent" ? "Forge-KI" : "Nicht zugeordnet"}
                          <Badge variant="outline" className="hidden landscape:inline-flex">{KINDS[event.kind] ?? event.kind}</Badge>
                          <span className="hidden text-xs text-muted-foreground landscape:inline">#{index + 1}</span>
                        </ItemTitle>
                        <ItemDescription className="line-clamp-none whitespace-pre-wrap break-words">{event.text === null || event.text.trim() === "" ? "Forge liefert für diesen Eintrag keinen Text." : event.text}</ItemDescription>
                        {event.card !== undefined ? source !== null ? (
                          <Button variant="outline" className="h-auto min-h-11 w-fit max-w-full whitespace-normal py-2 text-left" aria-haspopup="dialog" data-history-card={event.card} onClick={() => onLook(source.id)}>{cardName(source)} ansehen</Button>
                        ) : <p className="text-xs text-muted-foreground">Quellkarte nicht mehr sichtbar.</p> : null}
                      </ItemContent>
                    </li>
                  </Item>
                )
              })}
            </ol>
          )}
        </div>
        <SheetFooter className="shrink-0">
          <Button variant="outline" disabled={history.length === 0} onClick={() => end.current?.scrollIntoView({ block: "end" })}>Neueste Einträge</Button>
          <SheetClose asChild><Button size="lg" variant="outline">Schließen</Button></SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
