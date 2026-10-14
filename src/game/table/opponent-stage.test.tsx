/*
 * The stage of the opponent's turn and the turn band (prompt 49,
 * opponent-stage.tsx) on real observations (src/test/fixtures/observations.json):
 * the compact announcement's quiet words, the cards whole (a hidden one as
 * OpenMana's back), "Weiter" quiet while the tempo runs and gold stepwise,
 * dropping a held key's repeats, the replay's read-only stepping, the
 * "Zuletzt" line (2026-10-14), the band that every touch passes through.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { GameState, Observation } from "@openmana/engine-protocol"
import fixture from "@/test/fixtures/observations.json"
import { observationSteps } from "../observation-model"
import type { TableCardLookup } from "../table-cards"
import { LastMoveLine, OpponentStage, TurnBand } from "./opponent-stage"

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
  it("a land of the AI: a compact announcement - the card whole as a small preview beside the sentence, a quiet Weiter while the tempo runs", async () => {
    const onNext = vi.fn()
    render(<OpponentStage step={stepOf("held-land")} index={0} count={1} pictures={NO_PICTURES} summary={null} mode="tempo" durationMs={1700} timerKey="a" onNext={onNext} />)
    const stage = screen.getByRole("region", { name: "Gegnerzug ansehen" })
    const title = within(stage).getByRole("heading", { level: 2 })
    expect(title).toHaveTextContent("Die Forge-KI spielt ein Land: Forest")
    // Quiet words (2026-10-14): the title small, no "Aktion" above it, no line of what happens next (the decision says it).
    expect(title).toHaveClass("text-sm", "font-medium")
    expect(title).toHaveAttribute("aria-live", "polite")
    expect(within(stage).queryByText("Aktion")).toBeNull()
    expect(stage.querySelector("[data-stage-count]")).toBeNull()
    expect(stage.querySelector("[data-stage-status]")).toBeNull()
    expect(stage).toHaveAttribute("data-stage-mode", "tempo")
    // Without card data Forge's words stand for the card - never an empty box, never anything over a picture.
    expect(stage.querySelector('[data-stage-card] [data-slot="card-picture"]')).not.toBeNull()
    expect(stage.querySelector(".table-stage-timer")).not.toBeNull()
    const next = within(stage).getByRole("button", { name: "Weiter – nächste Aktion ansehen" })
    // While the tempo runs "Weiter" only goes on sooner: a quiet button, not the gold one.
    expect(next).toHaveAttribute("data-variant", "secondary")
    await userEvent.click(next)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("stepwise: Weiter is the way on - the gold button; several steps show their count compactly", () => {
    render(<OpponentStage step={stepOf("held-attack")} index={1} count={3} pictures={NO_PICTURES} summary={null} mode="stepwise" durationMs={null} timerKey="s" onNext={() => undefined} />)
    const stage = screen.getByRole("region", { name: "Gegnerzug ansehen" })
    expect(stage).toHaveAttribute("data-stage-mode", "stepwise")
    expect(within(stage).getByRole("button", { name: "Weiter – nächste Aktion ansehen" })).toHaveAttribute("data-variant", "default")
    expect(stage.querySelector("[data-stage-count]")).toHaveTextContent("2 von 3")
    expect(within(stage).queryByText(/^Aktion/)).toBeNull()
  })

  it("a key held down on Weiter: its repeats are dropped (only the first keydown can move on)", () => {
    const onNext = vi.fn()
    render(<OpponentStage step={stepOf("held-cast")} index={0} count={1} pictures={NO_PICTURES} summary={null} durationMs={null} timerKey="b" onNext={onNext} />)
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

  it("a change of turn: its number and whose turn in one quiet line, with what the AI did when it is the player's", () => {
    render(<OpponentStage step={stepOf("held-turn-me")} index={0} count={1} pictures={NO_PICTURES} summary="Die Forge-KI in Zug 2: Wald gespielt." durationMs={1700} timerKey="c" />)
    const stage = screen.getByRole("region", { name: "Gegnerzug ansehen" })
    const title = within(stage).getByRole("heading", { level: 2 })
    expect(title).toHaveTextContent("Zug 1 · Du bist am Zug")
    expect(title).toHaveClass("text-sm")
    expect(title.className).not.toMatch(/text-(x|2x)l/)
    expect(within(stage).queryByText("Zugwechsel")).toBeNull()
    expect(within(stage).getByText("Die Forge-KI in Zug 2: Wald gespielt.")).toBeInTheDocument()
    // Without onNext: no Weiter.
    expect(within(stage).queryByRole("button")).toBeNull()
  })

  it("a hidden card stays OpenMana's back", () => {
    const step = { ...stepOf("held-land"), cards: [{ hidden: true as const }] }
    render(<OpponentStage step={step} index={0} count={1} pictures={NO_PICTURES} summary={null} durationMs={null} timerKey="d" />)
    expect(screen.getByRole("img", { name: "Eine verdeckte Karte" }).querySelector('[data-slot="game-card-back"]')).not.toBeNull()
  })

  it("the replay: read only, its steps by hand", () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    render(<OpponentStage replay step={stepOf("held-attack")} index={0} count={2} pictures={NO_PICTURES} summary={null} durationMs={null} timerKey="e" onNext={onNext} onPrevious={onPrevious} />)
    const stage = screen.getByRole("region", { name: "Aufgezeichnete Aktion" })
    expect(stage).toHaveAttribute("data-stage-mode", "replay")
    expect(within(stage).getByText("1 von 2 · Aufzeichnung")).toBeInTheDocument()
    expect(within(stage).getByRole("button", { name: "Vorherige Aktion" })).toBeDisabled()
    fireEvent.click(within(stage).getByRole("button", { name: "Nächste Aktion" }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrevious).not.toHaveBeenCalled()
  })
})

describe("LastMoveLine", () => {
  it("one quiet line - no picture, no button, no timer, not announced, distinct from the stage's anchors", () => {
    const { container } = render(<LastMoveLine text="Die Forge-KI hat Grizzlybären gewirkt" rests={false} />)
    const line = container.querySelector('[data-slot="last-move"]')!
    expect(line).toHaveTextContent("Zuletzt: Die Forge-KI hat Grizzlybären gewirkt")
    expect(line).toHaveClass("text-muted-foreground")
    expect(line).not.toHaveAttribute("aria-live")
    expect(line.querySelector("[aria-live]")).toBeNull()
    expect(line).not.toHaveAttribute("data-rests")
    expect(within(line as HTMLElement).queryByRole("button")).toBeNull()
    expect(line.querySelector('img, [data-slot="card-picture"], .table-stage-timer, [data-stage-next]')).toBeNull()
    expect(container.querySelector('[data-slot="opponent-stage"]')).toBeNull()
  })

  it("rests while the stack bar shows something (hoch steps it aside there)", () => {
    const { container } = render(<LastMoveLine text="Du hast Wald gespielt" rests />)
    expect(container.querySelector('[data-slot="last-move"]')).toHaveAttribute("data-rests", "")
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
