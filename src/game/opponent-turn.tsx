/*
 * The opponent's turn in the running game (prompt 49): from the session's
 * latest observation (protocol 10, prompt 48) to what the table shows -
 *
 *  - the stage of an action the engine holds, stepped by the tempo or
 *    "Weiter" and released after its last step (useObservationPlayback);
 *  - the band of a change of turn that came without holding (Forge asks the
 *    player right away): shown for one step's time, every touch passes through;
 *  - "Unterbrechung": an action of the opponent that came right before a
 *    decision of the player's - a line above the decision, whose controls are
 *    there at once; it goes when the player has answered;
 *  - the words of the decision region while the engine holds, and of Forge
 *    playing on by itself (Forge's auto-pass).
 *
 * And Forge's auto-pass: the saved choice (display.autoPass) is sent to the
 * running game through settings.change whenever it differs from what Forge
 * confirmed last - once per choice; Forge's settings.applied confirms it.
 */
import { Zap } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { usePreferences } from "@/app/preferences"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { MatchSnapshot } from "@/engine/engine-session"
import { useEngineSession } from "@/engine/engine-session-context"
import { actorOf, myId, observationSteps, presentation, turnSummaryText, type ObservationStep } from "./observation-model"
import { useDocumentVisible, useObservationPlayback } from "./observation-playback"
import { autoPassNote, stepDuration, TEMPO_LABELS } from "./opponent-tempo"
import type { TableCardLookup } from "./table-cards"
import { OpponentStage, TurnBand } from "./table/opponent-stage"

type Playing = Extract<MatchSnapshot, { status: "playing" }>

export interface OpponentTurnView {
  /** The stage over the player's half (GameTable stage), or null. */
  readonly stage: ReactNode
  /** The band of a change of turn (GameTable turnBand), or null. */
  readonly turnBand: ReactNode
  /** The words while the engine holds (GameTable observing), or null. */
  readonly observing: string | null
  /** "Unterbrechung" above the decision (into GameTable alerts), or null. */
  readonly interrupt: ReactNode
  /** What Forge's auto-pass does (GameTable autoPass). */
  readonly autoPass: string
}

/** The opponent's last action of an observation that the player can answer: a spell, an ability, a trigger, an attack. */
function interruptStepOf(steps: readonly ObservationStep[]): ObservationStep | undefined {
  return steps.findLast((each) => each.actor === "opponent" && (each.kind === "cast" || each.kind === "activate" || each.kind === "trigger" || each.kind === "attack"))
}

export function useOpponentTurn(match: Playing, pictures: TableCardLookup): OpponentTurnView {
  const { releaseObservation, changeSettings } = useEngineSession()
  const preferences = usePreferences()
  const { opponentTempo: tempo, opponentStepwise: stepwise } = preferences
  const observation = match.observation
  const steps = useMemo(() => (observation === null ? [] : observationSteps(observation, match.state)), [observation, match.state])
  const shown = observation === null ? "none" : presentation(observation, match.state)
  const release = useCallback(
    (id: number) => {
      const result = releaseObservation(id)
      if (!result.ok) toast.error("Es ging nicht weiter", { description: result.reason, position: "top-center" })
      return result.ok
    },
    [releaseObservation],
  )
  const playback = useObservationPlayback({
    id: shown === "stage" && observation !== null ? observation.id : null,
    steps,
    held: match.observationHeld,
    tempo,
    stepwise,
    release,
  })
  const visible = useDocumentVisible()

  // Forge's auto-pass: the saved choice reaches the running game (once per choice; Forge confirms it).
  const requested = useRef<string | null>(null)
  const confirmed = match.settings?.autoPass ?? null
  const wanted = preferences.status === "ready" ? preferences.autoPass : null
  useEffect(() => {
    if (wanted === null || confirmed === null || match.conceding) return
    if (wanted === confirmed) {
      requested.current = null
      return
    }
    if (requested.current === wanted) return
    requested.current = wanted
    const result = changeSettings({ autoPass: wanted })
    if (!result.ok) toast.error("Forge hat die Einstellung nicht übernommen", { description: result.reason, position: "top-center" })
  }, [wanted, confirmed, match.conceding, changeSettings])

  // The band of a change of turn that came without holding: one step's time, then gone (also under less motion).
  const [band, setBand] = useState<number | null>(null)
  const bandId = shown === "turn" && observation !== null ? observation.id : null
  const bandMs = stepDuration(tempo, 1)
  useEffect(() => {
    if (bandId === null) return
    setBand(bandId)
    const timer = setTimeout(() => setBand((current) => (current === bandId ? null : current)), bandMs)
    return () => clearTimeout(timer)
    // The time is the tempo's when the band came; a later change of tempo does not restart it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [bandId])

  // "Unterbrechung": the opponent's latest action (held and seen, or not) is something to answer - a spell or an ability on
  // the stack, an attack - and Forge asks the player now. It stays until the player has answered (Forge no longer waits),
  // not again for Forge's next question about the same thing.
  const [answered, setAnswered] = useState<number | null>(null)
  const answerable = match.state !== null && (match.state.stack.length > 0 || match.state.combat.length > 0)
  const interruptSource = observation !== null && answerable ? interruptStepOf(steps) : undefined
  const interruptId = interruptSource !== undefined && observation !== null ? observation.id : null
  // Shown once Forge waits for the answer; answered once Forge no longer waits after that (the question may come a
  // moment before Forge reports waiting - that moment is not an answer).
  const shownInterrupt = useRef<number | null>(null)
  const asked = match.questions.length > 0
  useEffect(() => {
    if (interruptId === null) return
    if (match.waiting && asked) shownInterrupt.current = interruptId
    else if (!match.waiting && shownInterrupt.current === interruptId) setAnswered(interruptId)
  }, [interruptId, match.waiting, asked])

  const me = myId(match.state)
  const summary = turnSummaryText(match.opponentTurn)
  const step = playback.step
  // After its release the step stays on screen only until Forge says anything new (a state, a question, waiting) - then
  // it is gone for good, never shown again over a newer moment.
  const [gone, setGone] = useState<number | null>(null)
  const releasedId = playback.released && observation !== null ? observation.id : null
  const lingering = releasedId !== null && gone !== releasedId && !match.waiting && match.questions.length === 0 && match.state?.seq === observation?.state
  useEffect(() => {
    if (releasedId !== null && !lingering) setGone(releasedId)
  }, [releasedId, lingering])
  const stageShown = step !== null && (match.observationHeld || lingering)
  const status = playback.released
    ? "Forge spielt weiter …"
    : stepwise
      ? "Wartet auf „Weiter“ – Forge hält so lange an."
      : !visible
        ? "Angehalten, solange OpenMana im Hintergrund ist."
        : `Geht von selbst weiter (${TEMPO_LABELS[tempo]}).`
  const stage =
    stageShown && step !== null ? (
      <OpponentStage
        step={step}
        index={playback.index}
        count={playback.count}
        pictures={pictures}
        summary={step.turn?.seat === "me" ? summary : null}
        status={status}
        durationMs={match.observationHeld && visible ? playback.durationMs : null}
        timerKey={`${step.key}:${tempo}:${String(visible)}`}
        {...(playback.released ? {} : { onNext: playback.next })}
      />
    ) : null

  const turnAction = observation?.actions.find((action) => action.kind === "turn")
  const turnBand =
    band !== null && band === bandId && turnAction !== undefined && turnAction.kind === "turn" ? (
      <TurnBand
        bandKey={String(band)}
        number={turnAction.turn}
        seat={actorOf(turnAction.player, me)}
        summary={actorOf(turnAction.player, me) === "me" ? summary : null}
      />
    ) : null

  const interruptStep = interruptId !== null && answered !== interruptId && match.waiting && asked && !match.observationHeld ? interruptSource : undefined
  const interrupt =
    interruptStep !== undefined ? (
      <Alert data-interrupt="" className="py-2">
        <Zap aria-hidden />
        <AlertTitle>Unterbrechung: {interruptStep.title}</AlertTitle>
        <AlertDescription>Du kannst jetzt reagieren – oder weitergeben.</AlertDescription>
      </Alert>
    ) : null

  const observing = match.observationHeld
    ? stepwise
      ? "„Weiter“ zeigt die nächste Aktion – es spielt und passt nichts für dich."
      : `Geht von selbst weiter (${TEMPO_LABELS[tempo]}); „Weiter“ geht sofort weiter.`
    : null

  return { stage, turnBand, observing, interrupt, autoPass: autoPassNote(confirmed ?? preferences.autoPass) }
}
