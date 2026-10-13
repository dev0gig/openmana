/*
 * Stepping through an observation the engine holds (prompt 49,
 * observation-playback.ts), on a real held observation with two steps built
 * from the recorded ones (src/test/fixtures/observations.json): the tempo, the
 * stepwise "Weiter", its arming against a double tap, one release only, a tab
 * in the background, a change of tempo and mode, a new observation.
 */
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { GameState, Observation } from "@openmana/engine-protocol"
import fixture from "@/test/fixtures/observations.json"
import { ARMING_MS } from "./card-view"
import { observationSteps } from "./observation-model"
import { useObservationPlayback, type PlaybackInput } from "./observation-playback"
import { stepDuration, TEMPO_MS, type OpponentTempo } from "./opponent-tempo"

interface Recorded {
  readonly name: string
  readonly observation: Observation
  readonly state: GameState
}
const RECORDED = fixture.observations as unknown as readonly Recorded[]
const land = RECORDED.find((each) => each.name === "held-land")!
const cast = RECORDED.find((each) => each.name === "held-cast")!
/** Built: the recorded land and spell of the AI in one held observation (two steps). */
const TWO: Observation = { ...land.observation, actions: [land.observation.actions[0]!, cast.observation.actions[0]!] }
const TWO_STEPS = observationSteps(TWO, land.state)
const ONE_STEPS = observationSteps(cast.observation, cast.state)

let clock = 0
let visibility: DocumentVisibilityState = "visible"

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  clock = 10_000
  vi.spyOn(performance, "now").mockImplementation(() => clock)
  visibility = "visible"
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function advance(ms: number): void {
  act(() => {
    clock += ms
    vi.advanceTimersByTime(ms)
  })
}

function setVisibility(next: DocumentVisibilityState): void {
  act(() => {
    visibility = next
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

function render(initial: Partial<PlaybackInput> = {}) {
  const release = vi.fn((_id: number) => true)
  const props: PlaybackInput = { id: TWO.id, steps: TWO_STEPS, held: true, tempo: "normal", stepwise: false, release, ...initial }
  const hook = renderHook((input: PlaybackInput) => useObservationPlayback(input), { initialProps: props })
  return { ...hook, release, props }
}

describe("the tempo", () => {
  it.each(["slow", "normal", "fast"] as OpponentTempo[])("%s: each step stays its time, then the next; after the last the observation is released once", (tempo) => {
    const { result, release } = render({ tempo })
    expect(result.current.step?.key).toBe(TWO_STEPS[0]!.key)
    expect(result.current.durationMs).toBe(stepDuration(tempo, TWO_STEPS[0]!.lines.length))
    advance(result.current.durationMs! - 1)
    expect(result.current.index).toBe(0)
    advance(1)
    expect(result.current.index).toBe(1)
    expect(release).not.toHaveBeenCalled()
    advance(stepDuration(tempo, TWO_STEPS[1]!.lines.length))
    expect(release).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledWith(TWO.id)
    expect(result.current.released).toBe(true)
    advance(60_000)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("normal lies between fast and slow, about 1-2 s per action", () => {
    expect(TEMPO_MS.fast).toBeLessThan(TEMPO_MS.normal)
    expect(TEMPO_MS.normal).toBeLessThan(TEMPO_MS.slow)
    expect(TEMPO_MS.normal).toBeGreaterThanOrEqual(1000)
    expect(TEMPO_MS.normal).toBeLessThanOrEqual(2000)
    // More to read stays longer, but bounded.
    expect(stepDuration("normal", 3)).toBeGreaterThan(stepDuration("normal", 1))
    expect(stepDuration("normal", 50)).toBe(stepDuration("normal", 5))
  })

  it("a change of tempo applies to the step on screen: its time starts again with the new length", () => {
    const { result, rerender, props } = render({ tempo: "slow" })
    advance(1000)
    rerender({ ...props, tempo: "fast" })
    expect(result.current.durationMs).toBe(stepDuration("fast", TWO_STEPS[0]!.lines.length))
    advance(stepDuration("fast", TWO_STEPS[0]!.lines.length))
    expect(result.current.index).toBe(1)
  })

  it("nothing runs while the engine does not hold", () => {
    const { result, release } = render({ held: false })
    expect(result.current.step).toBeNull()
    advance(60_000)
    expect(release).not.toHaveBeenCalled()
  })
})

describe("stepwise: Weiter", () => {
  it("waits however long the player looks; Weiter moves exactly one step, the last one releases", () => {
    const { result, release } = render({ stepwise: true })
    expect(result.current.durationMs).toBeNull()
    expect(result.current.waitingForPlayer).toBe(true)
    advance(600_000)
    expect(result.current.index).toBe(0)
    expect(release).not.toHaveBeenCalled()
    act(() => result.current.next())
    expect(result.current.index).toBe(1)
    advance(ARMING_MS)
    act(() => result.current.next())
    expect(release).toHaveBeenCalledTimes(1)
    expect(result.current.released).toBe(true)
    // A further press after the release sends nothing.
    advance(ARMING_MS)
    act(() => result.current.next())
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("a double tap moves on once: Weiter is armed only ARMING_MS after a step appeared", () => {
    const { result, release } = render({ stepwise: true })
    // Right as the step appears, a press is dropped too (the step came under the finger).
    act(() => result.current.next())
    expect(result.current.index).toBe(0)
    advance(ARMING_MS)
    act(() => result.current.next())
    expect(result.current.index).toBe(1)
    // The second tap of the double tap, a moment later: dropped.
    advance(80)
    act(() => result.current.next())
    expect(result.current.index).toBe(1)
    expect(release).not.toHaveBeenCalled()
    advance(ARMING_MS)
    act(() => result.current.next())
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("Weiter also goes on sooner while the tempo runs", () => {
    const { result } = render()
    advance(ARMING_MS)
    act(() => result.current.next())
    expect(result.current.index).toBe(1)
  })

  it("switching stepwise on stops the step on screen; off, it runs its whole time again", () => {
    const { result, rerender, props, release } = render({ steps: ONE_STEPS, id: cast.observation.id })
    advance(1000)
    rerender({ ...props, stepwise: true })
    advance(60_000)
    expect(release).not.toHaveBeenCalled()
    rerender({ ...props, stepwise: false })
    advance(stepDuration("normal", ONE_STEPS[0]!.lines.length) - 1)
    expect(release).not.toHaveBeenCalled()
    advance(1)
    expect(release).toHaveBeenCalledTimes(1)
    expect(result.current.released).toBe(true)
  })
})

describe("the background and a new observation", () => {
  it("a tab in the background keeps the step (the engine keeps holding); back in front the step runs afresh - nothing catches up", () => {
    const { result, release } = render({ steps: ONE_STEPS, id: cast.observation.id })
    advance(1000)
    setVisibility("hidden")
    expect(result.current.waitingForPlayer).toBe(true)
    advance(600_000)
    expect(release).not.toHaveBeenCalled()
    expect(result.current.index).toBe(0)
    setVisibility("visible")
    advance(stepDuration("normal", ONE_STEPS[0]!.lines.length) - 1)
    expect(release).not.toHaveBeenCalled()
    advance(1)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("a new observation starts at its first step", () => {
    const { result, rerender, props } = render({ stepwise: true })
    advance(ARMING_MS)
    act(() => result.current.next())
    expect(result.current.index).toBe(1)
    rerender({ ...props, id: cast.observation.id, steps: ONE_STEPS })
    expect(result.current.index).toBe(0)
    expect(result.current.step?.key).toBe(ONE_STEPS[0]!.key)
    expect(result.current.released).toBe(false)
  })
})
