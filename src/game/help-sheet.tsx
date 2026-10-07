import { useRef } from "react"
import type { GameState, Question } from "@openmana/engine-protocol"
import { Button } from "@/components/ui/button"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useLandscape } from "@/hooks/use-landscape"
import { phaseLabel } from "./game-labels"
import { decisionHelp, PHASE_HELP, TERMS } from "./beginner-help"

export function HelpSheet({ open, onOpenChange, state, questions, replay, waiting, conceding }: {
  open: boolean; onOpenChange: (open: boolean) => void; state: GameState; questions: readonly Question[];
  replay: boolean; waiting: boolean; conceding: boolean;
}) {
  const landscape = useLandscape()
  const opener = useRef<HTMLElement | null>(null)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={landscape ? "right" : "bottom"} showCloseButton={false} className="max-h-dvh data-[side=right]:sm:max-w-xl" onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onCloseAutoFocus={(event) => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus() }}>
        <SheetHeader className="shrink-0">
          <SheetTitle>Hilfe am Spieltisch</SheetTitle>
          <SheetDescription>Erklärungen zum angezeigten Zustand und zu Begriffen. Forge bestimmt die Regeln und verfügbaren Aktionen.</SheetDescription>
        </SheetHeader>
        {/* A scrolling region must be reachable by keyboard (WCAG 2.1.1). */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6" tabIndex={0} role="region" aria-label="Spielhilfe">
          <div className="flex flex-col gap-3">
            <Item variant="outline"><ItemContent>
              <ItemTitle>Aktuelle Entscheidung</ItemTitle>
              <ItemDescription className="line-clamp-none">{replay ? "Wiedergabe – gespeicherte Fragen können hier nicht beantwortet werden. " : conceding ? "Aufgeben ist unterwegs; weitere Eingaben sind gesperrt. " : !waiting ? "Forge rechnet; warte auf die nächste Entscheidung. " : ""}{decisionHelp(questions)}</ItemDescription>
            </ItemContent></Item>
            <Item variant="outline"><ItemContent>
              <ItemTitle>{phaseLabel(state.phase)}</ItemTitle>
              <ItemDescription className="line-clamp-none">{state.phase === null ? "Die Partie steht vor dem ersten Zug. Forge führt die Wahl der Starthand durch." : PHASE_HELP[state.phase]}</ItemDescription>
            </ItemContent></Item>
            <Item variant="outline"><ItemContent>
              <ItemTitle>Markierungen und sichere Bedienung</ItemTitle>
              <ItemDescription className="line-clamp-none">Gestrichelter goldener Rahmen: Forge bietet eine Auswahl oder Aktion an. Heller durchgezogener Rahmen: von Forge als gewählt markiert. Doppelter goldener Rahmen und „Ziel“: eine Aktion auf dem Stapel nennt diese Karte oder diesen Spieler als Ziel; das erlaubt keine zusätzliche Aktion. Eine wählbare oder gewählte Karte behält ihren Auswahlrahmen.</ItemDescription>
              <ItemDescription className="line-clamp-none">Bei Priorität öffnet Antippen zuerst die Kartenansicht. Dort führt der Aktionsbutton Forges Angebot aus. Beim Wählen, Bezahlen und beim Angreifen oder Blocken kann ein Tap direkt auswählen. Langes Drücken oder Rechtsklick öffnet immer nur die Ansicht. Antworten und Aktionen werden niemals durch diese Hilfe gesendet.</ItemDescription>
            </ItemContent></Item>
            {TERMS.map((term) => <Item variant="outline" key={term.title}><ItemContent><ItemTitle>{term.title}</ItemTitle><ItemDescription className="line-clamp-none">{term.text}</ItemDescription></ItemContent></Item>)}
          </div>
        </div>
        <SheetFooter className="shrink-0"><SheetClose asChild><Button size="lg" variant="outline">Schließen</Button></SheetClose></SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
