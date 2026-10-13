/*
 * The stage of the opponent's turn and the turn band (prompt 49,
 * opponent-stage.tsx) on real observations (src/test/fixtures/observations.json):
 * the words, the cards whole (a hidden one as OpenMana's back), "Weiter" that
 * drops a held key's repeats, the replay's read-only stepping, the band that
 * every touch passes through.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { GameState, Observation } from "@openmana/engine-protocol"
import fixture from "@/test/fixtures/observations.json"
import { observationSteps } from "../observation-model"
import type { TableCardLookup } from "../table-cards"
import { OpponentStage, TurnBand } from "./opponent-stage"

interface Recorded {
  readonly name: string
  readonly observation: Observation
  readonly state: GameState
}
const RECORDED = fixture.observations as unknown as readonly Recorded[]
const recorded = (name: string) => RECORDED.find((each) => each.name === name)!
const NO_PICTURES: TableCardLookup = () => "none"

function stepOf(name: string, index = 0) {
  const { observation, state } = recorded(name)
  return observationSteps(observation, state)[index]!
}

describe("OpponentStage", () => {
  it("a land of the AI: the card whole beside the sentence, the step's number, what happens next, Weiter", async () => {
    const onNext = vi.fn()
    render(<OpponentStage step={stepOf("held-land")} index={0} count={1} pictures={NO_PICTURES} summary={null} status="Geht von selbst weiter (Normal)." durationMs={1700} timerKey="a" onNext={onNext} />)
    const stage = screen.getByRole("region", { name: "Gegnerzug ansehen" })
    expect(within(stage).getByRole("heading", { level: 2 })).toHaveTextContent("Die Forge-KI spielt ein Land: Forest")
    expect(within(stage).getByText("Aktion")).toBeInTheDocument()
    expect(within(stage).getByText("Geht von selbst weiter (Normal).")).toBeInTheDocument()
    // Without card data Forge's words stand for the card - never an empty box, never anything over a picture.
    expect(stage.querySelector('[data-stage-card] [data-slot="card-picture"]')).not.toBeNull()
    expect(stage.querySelector(".table-stage-timer")).not.toBeNull()
    await userEvent.click(within(stage).getByRole("button", { name: "Weiter – nächste Aktion ansehen" }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("a key held down on Weiter: its repeats are dropped (only the first keydown can move on)", () => {
    const onNext = vi.fn()
    render(<OpponentStage step={stepOf("held-cast")} index={0} count={1} pictures={NO_PICTURES} summary={null} status="…" durationMs={null} timerKey="b" onNext={onNext} />)
    const next = screen.getByRole("button", { name: "Weiter – nächste Aktion ansehen" })
    const repeat = new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true })
    next.dispatchEvent(repeat)
    expect(repeat.defaultPrevented).toBe(true)
    const first = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    next.dispatchEvent(first)
    expect(first.defaultPrevented).toBe(false)
    // Waiting for "Weiter": no running line.
    expect(document.querySelector(".table-stage-timer")).toBeNull()
  })

  it("a change of turn: its number and whose turn, with what the AI did when it is the player's", () => {
    render(<OpponentStage step={stepOf("held-turn-me")} index={0} count={1} pictures={NO_PICTURES} summary="Die Forge-KI in Zug 2: Wald gespielt." status="…" durationMs={1700} timerKey="c" />)
    const stage = screen.getByRole("region", { name: "Gegnerzug ansehen" })
    expect(within(stage).getByText("Zugwechsel")).toBeInTheDocument()
    expect(within(stage).getByRole("heading", { level: 2 })).toHaveTextContent("Zug 1Du bist am Zug")
    expect(within(stage).getByText("Die Forge-KI in Zug 2: Wald gespielt.")).toBeInTheDocument()
    // Released already: no Weiter.
    expect(within(stage).queryByRole("button")).toBeNull()
  })

  it("a hidden card stays OpenMana's back", () => {
    const step = { ...stepOf("held-land"), cards: [{ hidden: true as const }] }
    render(<OpponentStage step={step} index={0} count={1} pictures={NO_PICTURES} summary={null} status="…" durationMs={null} timerKey="d" />)
    expect(screen.getByRole("img", { name: "Eine verdeckte Karte" }).querySelector('[data-slot="game-card-back"]')).not.toBeNull()
  })

  it("the replay: read only, its steps by hand", () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    render(<OpponentStage replay step={stepOf("held-attack")} index={0} count={2} pictures={NO_PICTURES} summary={null} status="Forge hielt hier zum Ansehen an." durationMs={null} timerKey="e" onNext={onNext} onPrevious={onPrevious} />)
    const stage = screen.getByRole("region", { name: "Aufgezeichnete Aktion" })
    expect(within(stage).getByText("Aktion 1 von 2 · Aufzeichnung")).toBeInTheDocument()
    expect(within(stage).getByRole("button", { name: "Vorherige Aktion" })).toBeDisabled()
    fireEvent.click(within(stage).getByRole("button", { name: "Nächste Aktion" }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrevious).not.toHaveBeenCalled()
  })
})

describe("TurnBand", () => {
  it("says whose turn begins; hidden from screen readers (the stage and the header say it), never in the way of a touch", () => {
    const { container } = render(<TurnBand bandKey="1" number={5} seat="me" summary="Die Forge-KI in Zug 4: Wald gespielt." />)
    const band = container.querySelector('[data-slot="turn-band"]')!
    expect(band).toHaveAttribute("aria-hidden", "true")
    expect(band).toHaveTextContent("Zug 5 · Du bist am Zug")
    expect(band).toHaveTextContent("Die Forge-KI in Zug 4: Wald gespielt.")
  })
})
