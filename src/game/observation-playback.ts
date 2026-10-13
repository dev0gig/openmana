/*
 * Stepping through an observation the engine holds (prompt 49; the hold is
 * prompt 48's): the table shows its steps one after the other
 * (observation-model.ts), each for the chosen tempo or - in the stepwise mode
 * - until "Weiter"; after the last step the observation is released
 * (EngineSession.releaseObservation), which passes no priority, answers
 * nothing and chooses nothing. Forge then goes on as it plays.
 *
 * No queue: the engine holds one observation at a time and sends no other
 * while it holds, so nothing old is ever played back over a newer state or
 * question. A timer here only ends the looking at what the engine holds; it
 * never sends an answer, a tap or a pass (Decision Rules: no timer answers).
 *
 *  - The step's timer runs only while the page is visible: a tab in the
 *    background keeps the engine waiting at the step the player had not seen
 *    yet, and the step starts afresh when the tab is back - nothing catches
 *    up, nothing is lost (the browser slows timers in the background anyway).
 *  - A change of tempo or of the stepwise mode applies to the step on screen:
 *    its time starts again with the new length, or it waits for "Weiter".
 *  - "Weiter" moves exactly one step (the last one releases the observation).
 *    It ignores presses for ARMING_MS after a step appeared, so a double tap
 *    or a key held down never moves through several actions; a repeated
 *    keydown is dropped by the button (OpponentStage). It also works while
 *    the tempo runs, to go on sooner.
 *  - Remounting (a resize that changes the table, leaving the game page and
 *    coming back) starts the step on screen afresh: the engine still holds it.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { ARMING_MS } from "./card-view"
import type { ObservationStep } from "./observation-model"
import { stepDuration, type OpponentTempo } from "./opponent-tempo"

export interface PlaybackInput {
  /** The observation's id (null: none). */
  readonly id: number | null
  /** Its steps (observationSteps). */
  readonly steps: readonly ObservationStep[]
  /** The engine holds it right now. */
  readonly held: boolean
  readonly tempo: OpponentTempo
  /** Wait for "Weiter" after every step. */
  readonly stepwise: boolean
  /** Releases the observation (the session's releaseObservation); false when it could not be sent. */
  readonly release: (id: number) => boolean
}

export interface Playback {
  /** The step on screen (null: nothing held). */
  readonly step: ObservationStep | null
  /** Its place among the observation's steps (0-based) and their number. */
  readonly index: number
  readonly count: number
  /** The last step was released: Forge goes on (the stage may stay until Forge's next message). */
  readonly released: boolean
  /** Waiting for "Weiter" (stepwise mode, or the tab in the background). */
  readonly waitingForPlayer: boolean
  /** How long the step on screen stays by itself (ms), or null while it waits for "Weiter". */
  readonly durationMs: number | null
  /** "Weiter": one step on, the last one releases. Ignored for ARMING_MS after a step appeared. */
  readonly next: () => void
}

function subscribeVisibility(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => undefined
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

/** The page is visible (not a tab in the background, not a minimised window). */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
    () => true,
  )
}

interface Position {
  readonly id: number | null
  readonly index: number
  readonly released: boolean
}

export function useObservationPlayback({ id, steps, held, tempo, stepwise, release }: PlaybackInput): Playback {
  const visible = useDocumentVisible()
  const [position, setPosition] = useState<Position>({ id, index: 0, released: false })
  // A new observation starts at its first step.
  const current: Position = position.id === id ? position : { id, index: 0, released: false }
  if (current !== position) setPosition(current)
  const count = steps.length
  const index = Math.min(current.index, Math.max(0, count - 1))
  const step = id === null || count === 0 || (!held && !current.released) ? null : (steps[index] ?? null)
  // What the timers and "Weiter" act on: the latest render's (synced after commit; advance() moves it on at once).
  const releaseRef = useRef(release)
  const latest = useRef(current)
  useLayoutEffect(() => {
    releaseRef.current = release
    latest.current = current
  })
  const advance = useCallback(() => {
    const previous = latest.current
    if (previous.id !== id || id === null || previous.released) return
    if (previous.index + 1 < count) {
      const moved = { ...previous, index: previous.index + 1 }
      latest.current = moved
      setPosition(moved)
      return
    }
    // The last step: the observation is released once (the engine would refuse a second release as stale anyway).
    const done = { ...previous, released: true }
    latest.current = done
    setPosition(done)
    releaseRef.current(id)
  }, [id, count])

  // "Weiter" is armed ARMING_MS after a step appeared (a double tap or a held key never moves on twice).
  const shownAt = useRef(0)
  const stepKey = step?.key ?? null
  useEffect(() => {
    shownAt.current = performance.now()
  }, [stepKey])

  const waitingForPlayer = step !== null && !current.released && (stepwise || !visible)
  const durationMs = step === null || current.released || stepwise ? null : stepDuration(tempo, step.lines.length)
  useEffect(() => {
    if (durationMs === null || !visible || !held) return
    const timer = setTimeout(advance, durationMs)
    return () => clearTimeout(timer)
    // stepKey: a new step starts its own time; tempo and mode changes restart the step on screen.
  }, [durationMs, visible, held, advance, stepKey])

  const next = useCallback(() => {
    if (performance.now() - shownAt.current < ARMING_MS) return
    advance()
  }, [advance])

  return { step, index, count, released: current.released, waitingForPlayer, durationMs, next }
}
