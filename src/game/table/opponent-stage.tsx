/*
 * The opponent's turn on the table (prompt 49, docs/design/SPIELTISCH.md
 * §4.17): what Forge reports of the game (observation-model.ts) shown so the
 * player can follow it.
 *
 *  - OpponentStage: an action the engine holds for looking - over the
 *    player's own half of the table (the opponent's battlefield, where the
 *    land or the creature arrives, stays in view; the hand, the header and
 *    the decision region stay free): the card(s) large, whole and never
 *    cropped, beside them the action in one German sentence, its results in
 *    short lines, the step's number and what happens next - by itself after
 *    the tempo's time (a thin line runs down; still under less motion) or
 *    with "Weiter". Not a dialog: nothing is trapped, the menu, the header
 *    and the hand stay reachable, and no question can be open while the
 *    engine holds.
 *  - TurnBand: a change of turn that came without holding (Forge asks the
 *    player something right away): a band across the centre line, "Zug 5 ·
 *    Du bist am Zug", for one step's time - it lets every touch through
 *    (pointer-events: none) and hides nothing for long.
 *
 * Nothing here sends anything but "Weiter" (the page releases the
 * observation, which passes no priority) - in a replay not even that: there
 * "Weiter" and "Zurück" only step through the recorded observation.
 */
import { ChevronLeft, ChevronRight, Hourglass, Pause } from "lucide-react"
import type { CSSProperties, KeyboardEvent } from "react"
import type { Card } from "@openmana/engine-protocol"
import { Button } from "@/components/ui/button"
import type { ObservationStep } from "../observation-model"
import type { TableCardLookup } from "../table-cards"
import { isVisible } from "../table-model"
import { TablePicture } from "../table-picture"
import { TableCardBack } from "./table-art"

export interface OpponentStageProps {
  readonly step: ObservationStep
  readonly index: number
  readonly count: number
  readonly pictures: TableCardLookup
  /** At a turn of the player beginning: what the opponent did in their turn (null: nothing to say). */
  readonly summary: string | null
  /** What happens next, in words ("Geht gleich weiter", "Wartet auf „Weiter“", "Forge spielt weiter …"). */
  readonly status: string
  /** How long the step stays by itself (ms): the thin line runs down that long; null: it waits. */
  readonly durationMs: number | null
  /** Restarts the line (a new step, a new tempo, the tab back in front). */
  readonly timerKey: string
  /** "Weiter" (absent: no button - the observation was released already). */
  readonly onNext?: () => void
  /** Replay only: one step back within the recorded observation. */
  readonly onPrevious?: () => void
  /** A recorded observation (the replay): nothing is released. */
  readonly replay?: boolean
}

function StageCard({ card, pictures }: { card: Card; pictures: TableCardLookup }) {
  if (!isVisible(card)) {
    return (
      <div className="table-stage-card" data-stage-card="hidden" role="img" aria-label="Eine verdeckte Karte">
        <TableCardBack className="h-auto w-full" />
      </div>
    )
  }
  return (
    <div className="table-stage-card" data-stage-card={card.id}>
      <TablePicture card={card} pictures={pictures} sizes="16rem" />
    </div>
  )
}

/** Drops a key held down: one "Weiter" per press (a repeated keydown would move through several actions). */
function dropRepeat(event: KeyboardEvent<HTMLButtonElement>): void {
  if (event.repeat) event.preventDefault()
}

export function OpponentStage({ step, index, count, pictures, summary, status, durationMs, timerKey, onNext, onPrevious, replay = false }: OpponentStageProps) {
  const cards = step.cards
  const turn = step.turn
  const style = { "--stage-cards": String(Math.max(1, cards.length)), ...(durationMs !== null ? { "--stage-ms": `${durationMs}ms` } : {}) } as CSSProperties
  return (
    <section
      data-slot="opponent-stage"
      data-step={step.key}
      data-kind={step.kind}
      data-actor={step.actor ?? "none"}
      data-cards={cards.length}
      aria-label={replay ? "Aufgezeichnete Aktion" : "Gegnerzug ansehen"}
      aria-roledescription="Aktion"
      className="table-stage"
      style={style}
    >
      {cards.length > 0 ? (
        <div className="table-stage-cards">
          {cards.map((card, at) => (
            <StageCard key={isVisible(card) ? card.id : `hidden-${at}`} card={card} pictures={pictures} />
          ))}
        </div>
      ) : null}
      <div className="table-stage-text">
        <div className="table-stage-body">
          <p className="text-xs font-medium tracking-wide text-muted-foreground tabular-nums">
            {turn !== null ? "Zugwechsel" : count > 1 ? `Aktion ${index + 1} von ${count}` : "Aktion"}
            {replay ? " · Aufzeichnung" : ""}
          </p>
          {turn !== null ? (
            <h2 className="font-heading text-xl leading-tight font-semibold text-foreground quadrat:text-2xl breit:text-2xl" aria-live="polite">
              Zug <span className="text-primary tabular-nums">{turn.number}</span>
              <span data-stage-seat="" className="block text-base font-medium">{turn.seat === "me" ? "Du bist am Zug" : turn.seat === "opponent" ? "Die Forge-KI ist am Zug" : "Ein neuer Zug beginnt"}</span>
            </h2>
          ) : (
            <h2 className="text-base leading-snug font-semibold text-foreground breit:text-lg" aria-live="polite">
              {step.title}
            </h2>
          )}
          {step.lines.length > 0 ? (
            <ul className="flex flex-col gap-0.5 text-sm leading-snug text-foreground/90">
              {step.lines.map((line, at) => (
                <li key={at}>{line}</li>
              ))}
            </ul>
          ) : null}
          {summary !== null ? <p className="text-sm leading-snug text-muted-foreground">{summary}</p> : null}
        </div>
        <div className="table-stage-actions">
          {onPrevious !== undefined ? (
            <Button variant="outline" size="lg" onClick={onPrevious} disabled={index === 0} aria-label="Vorherige Aktion">
              <ChevronLeft aria-hidden />
            </Button>
          ) : null}
          {onNext !== undefined ? (
            <Button size="lg" data-stage-next="" onClick={onNext} onKeyDown={dropRepeat} aria-label={replay ? "Nächste Aktion" : "Weiter – nächste Aktion ansehen"} disabled={replay && index + 1 >= count}>
              Weiter
              <ChevronRight data-icon="inline-end" aria-hidden />
            </Button>
          ) : null}
          <p className="flex min-w-0 items-center gap-1.5 text-xs leading-tight text-muted-foreground" data-stage-status="">
            {durationMs === null ? <Pause className="size-3.5 shrink-0" aria-hidden /> : <Hourglass className="size-3.5 shrink-0" aria-hidden />}
            <span>{status}</span>
          </p>
        </div>
        {durationMs !== null ? <span key={timerKey} className="table-stage-timer" aria-hidden /> : null}
      </div>
    </section>
  )
}

/** A change of turn that came without holding: a band across the centre line that lets every touch through. */
export function TurnBand({ number, seat, summary, bandKey }: { number: number; seat: ObservationStep["actor"]; summary: string | null; bandKey: string }) {
  return (
    <div key={bandKey} data-slot="turn-band" data-seat={seat ?? "none"} className="table-turn-band" aria-hidden>
      <p className="font-heading text-lg leading-tight font-semibold text-foreground">
        Zug <span className="text-primary tabular-nums">{number}</span> · {seat === "me" ? "Du bist am Zug" : seat === "opponent" ? "Die Forge-KI ist am Zug" : "Neuer Zug"}
      </p>
      {summary !== null ? <p className="text-xs leading-snug text-muted-foreground">{summary}</p> : null}
    </div>
  )
}
