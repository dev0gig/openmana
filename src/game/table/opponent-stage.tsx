/*
 * The opponent's turn on the table (prompt 49, docs/design/SPIELTISCH.md
 * §4.17): what Forge reports of the game (observation-model.ts) shown so the
 * player can follow it.
 *
 *  - OpponentStage: an action the engine holds for looking - since
 *    2026-10-14 a compact announcement, only as tall as its content (the
 *    project owner: the large panel was too prominent): in hoch over the
 *    lower edge of the opponent's battlefield, right above the stack bar (the
 *    player's battlefield, the stack bar, the hand, the header and the
 *    decision stay free); beside the side columns on the centre line between
 *    the battlefields. The card(s) as small previews, whole and never
 *    cropped, beside them the action in one German sentence, its results in
 *    short lines, "2 von 3" when the observation has several steps, and
 *    "Weiter" - by itself after the tempo's time (a thin line runs down;
 *    still under less motion) or with "Weiter" (stepwise: the gold button).
 *    Not a dialog: nothing is trapped, the menu, the header and the hand stay
 *    reachable, and no question can be open while the engine holds.
 *  - LastMoveLine: after the release the stage is gone and one quiet line
 *    stays, "Zuletzt: Die Forge-KI hat Grizzlybären gewirkt" - the latest
 *    move of either player (EngineSession.lastMove, lastMoveText); no
 *    picture, no button, no timer, nothing to tap, not announced.
 *  - TurnBand: a change of turn that came without holding (Forge asks the
 *    player something right away): a band across the centre line, "Zug 5 ·
 *    Du bist am Zug", for one step's time - it lets every touch through
 *    (pointer-events: none) and hides nothing for long.
 *
 * Nothing here sends anything but "Weiter" (the page releases the
 * observation, which passes no priority) - in a replay not even that: there
 * "Weiter" and "Zurück" only step through the recorded observation.
 */
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useId, type CSSProperties, type KeyboardEvent } from "react"
import type { Card } from "@openmana/engine-protocol"
import { Button } from "@/components/ui/button"
import type { ObservationStep } from "../observation-model"
import type { TableCardLookup } from "../table-cards"
import { isVisible } from "../table-model"
import { TablePicture } from "../table-picture"
import { TableCardBack } from "./table-art"

/** How the step on the stage goes on: by the tempo, only by "Weiter", paused while the tab is in the background. */
export type StageMode = "tempo" | "stepwise" | "paused"

export interface OpponentStageProps {
  readonly step: ObservationStep
  readonly index: number
  readonly count: number
  readonly pictures: TableCardLookup
  /** At a turn of the player beginning: what the opponent did in their turn (null: nothing to say). */
  readonly summary: string | null
  /**
   * How it goes on (`data-stage-mode`; the decision region says it in words):
   * "Weiter" is the gold button only when it is the way on (stepwise, the
   * replay), a quiet one while the tempo runs. Default: stepwise.
   */
  readonly mode?: StageMode
  /** How long the step stays by itself (ms): the thin line runs down that long; null: it waits. */
  readonly durationMs: number | null
  /** Restarts the line (a new step, a new tempo, the tab back in front). */
  readonly timerKey: string
  /** "Weiter" (absent: no button). */
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
      <TablePicture card={card} pictures={pictures} sizes="6rem" />
    </div>
  )
}

/** Drops a key held down: one "Weiter" per press (a repeated keydown would move through several actions). */
function dropRepeat(event: KeyboardEvent<HTMLButtonElement>): void {
  if (event.repeat) event.preventDefault()
}

export function OpponentStage({ step, index, count, pictures, summary, mode = "stepwise", durationMs, timerKey, onNext, onPrevious, replay = false }: OpponentStageProps) {
  const cards = step.cards
  const turn = step.turn
  const titleId = useId()
  const style = (durationMs !== null ? { "--stage-ms": `${durationMs}ms` } : {}) as CSSProperties
  const counted = count > 1 || replay
  return (
    <section
      data-slot="opponent-stage"
      data-step={step.key}
      data-kind={step.kind}
      data-actor={step.actor ?? "none"}
      data-cards={cards.length}
      data-stage-mode={replay ? "replay" : mode}
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
      {/* Focusable: its words scroll inside when they need more room than the stage has, and a keyboard must reach them too (axe scrollable-region-focusable). */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="table-stage-body" tabIndex={0} role="group" aria-labelledby={titleId}>
        {counted ? (
          <p className="text-xs leading-tight text-muted-foreground tabular-nums" data-stage-count="">
            {count > 1 ? `${index + 1} von ${count}` : ""}
            {replay ? `${count > 1 ? " · " : ""}Aufzeichnung` : ""}
          </p>
        ) : null}
        <h2 id={titleId} className="text-sm leading-snug font-medium text-foreground" aria-live="polite">
          {turn !== null ? (
            <>
              Zug <span className="text-primary tabular-nums">{turn.number}</span> · {turn.seat === "me" ? "Du bist am Zug" : turn.seat === "opponent" ? "Die Forge-KI ist am Zug" : "Ein neuer Zug beginnt"}
            </>
          ) : (
            step.title
          )}
        </h2>
        {step.lines.length > 0 ? (
          <ul className="flex flex-col text-xs leading-snug text-foreground/90">
            {step.lines.map((line, at) => (
              <li key={at}>{line}</li>
            ))}
          </ul>
        ) : null}
        {summary !== null ? <p className="text-xs leading-snug text-muted-foreground">{summary}</p> : null}
      </div>
      {onNext !== undefined || onPrevious !== undefined ? (
        <div className="table-stage-actions">
          {onPrevious !== undefined ? (
            <Button variant="outline" size="icon" onClick={onPrevious} disabled={index === 0} aria-label="Vorherige Aktion">
              <ChevronLeft aria-hidden />
            </Button>
          ) : null}
          {onNext !== undefined ? (
            <Button
              variant={mode === "tempo" && !replay ? "secondary" : "default"}
              data-stage-next=""
              onClick={onNext}
              onKeyDown={dropRepeat}
              aria-label={replay ? "Nächste Aktion" : "Weiter – nächste Aktion ansehen"}
              disabled={replay && index + 1 >= count}
            >
              Weiter
              <ChevronRight data-icon="inline-end" aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
      {durationMs !== null ? <span key={timerKey} className="table-stage-timer" aria-hidden /> : null}
    </section>
  )
}

/**
 * After the release: the latest move in one quiet line (2026-10-14) - no
 * picture, no button, no timer, nothing to tap, not announced (aria-live
 * belongs to the stage). `rests`: the stack bar shows something (hoch, a low
 * window: the line steps aside, the bar has the spell).
 */
export function LastMoveLine({ text, rests }: { text: string; rests: boolean }) {
  return (
    <p data-slot="last-move" {...(rests ? { "data-rests": "" } : {})} className="table-last-move text-xs leading-tight text-muted-foreground">
      <span className="truncate">Zuletzt: {text}</span>
    </p>
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
