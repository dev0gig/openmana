import type { GameState, Question } from "@openmana/engine-protocol"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { tableScene, TABLE_SCENES } from "@/test/table-scenes"
import { builtQuestion, BUILT_QUESTIONS } from "@/test/built-questions"
import { choiceClarity, decisionHelp, PHASE_HELP, STACK_TARGET_LABEL, stackTargetIds } from "./beginner-help"
import { GameTable, type GameTableProps } from "./game-table"
import { NO_PICTURES } from "./table-cards"
import { TURN_STEPS } from "./turn-model"

function tableProps(): GameTableProps {
  const scene = tableScene("main-phase")
  return { state: scene.state, questions: scene.questions, prompt: scene.prompt, waiting: true, aiProfile: scene.game.aiProfile, pictures: NO_PICTURES,
    menu: <button>Menü</button>, onTapCard: vi.fn(), onTapPlayer: vi.fn(), onAnswer: vi.fn(), onUseMana: vi.fn() }
}
const optional: Question = { type: "question", kind: "choose", id: 990, blocking: true, text: "A misleading MUST in prose", min: 0, max: 2, items: [{ nr: 1, text: "A" }, { nr: 2, text: "B" }] }

describe("Forge bounds and static help", () => {
  it("has a static explanation for every Forge phase, never a phase/action forecast", () => {
    expect(Object.keys(PHASE_HELP).sort()).toEqual([...TURN_STEPS].sort())
    for (const phase of TURN_STEPS) expect(PHASE_HELP[phase].length).toBeGreaterThan(30)
  })
  it("optional selection still needs an explicit response, regardless of translated question words", () => {
    expect(choiceClarity(optional)).toBe("Auswahl optional")
    expect(decisionHelp([optional])).toContain("trotzdem abschließen")
    const required: Question = { ...optional, min: 1, text: "You MAY choose nothing" }
    expect(choiceClarity(required)).toBe("Auswahl erforderlich")
    expect(decisionHelp([required])).toContain("Eine leere Auswahl genügt dieser Frage nicht")
    const confirm: Question = { type: "question", kind: "confirm", id: 991, text: "optional ability?", blocking: true, suggested: true }
    expect(choiceClarity(confirm)).toBe("Ja oder Nein")
    expect(decisionHelp([confirm])).toContain("niemals von selbst")
  })
  it("only calls cancellation available if Forge supplies it, and honours blocking precedence", () => {
    const options: Question = { type: "question", kind: "options", id: 992, text: "Cancel?", blocking: true, items: [{ nr: 1, text: "A" }] }
    expect(choiceClarity(options)).toBe("Antwort erforderlich")
    expect(choiceClarity({ ...options, cancellable: true })).toBe("Abbrechen möglich")
    const step = tableScene("main-phase").questions
    expect(decisionHelp([...step, options])).toContain("kein Abbrechen")
    expect(decisionHelp([...step, options])).not.toContain("Priorität abgeben")
    expect(decisionHelp([])).toContain("keine Frage")
  })
  it("covers recorded questions and explicitly built missing families without inspecting card names/text", () => {
    for (const scene of TABLE_SCENES) expect(decisionHelp(scene.questions).length).toBeGreaterThan(20)
    for (const name of BUILT_QUESTIONS) {
      const built = builtQuestion(name, tableScene(name === "block-order" ? "block-multiple" : "main-phase"))
      expect(decisionHelp(built.questions).length).toBeGreaterThan(20)
    }
  })
})

describe("help inspection and live withdrawal", () => {
  it("opens, scrolls, follows current questions/phase and closes without any engine input", async () => {
    const user = userEvent.setup()
    const props = tableProps()
    const { rerender } = render(<GameTable {...props} />)
    const trigger = screen.getByRole("button", { name: "Hilfe am Spieltisch" })
    await user.click(trigger)
    const sheet = screen.getByRole("dialog", { name: "Hilfe am Spieltisch" })
    expect(within(sheet).getByText("Erste Hauptphase")).toBeInTheDocument()
    expect(within(sheet).getByText(/Du kannst eine von Forge angebotene Aktion/)).toBeInTheDocument()
    rerender(<GameTable {...props} questions={[optional]} state={{ ...props.state, phase: "MAIN2" }} />)
    expect(within(sheet).getByText("Zweite Hauptphase")).toBeInTheDocument()
    expect(within(sheet).getByText(/trotzdem abschließen/)).toBeInTheDocument()
    expect(within(sheet).queryByText(/Du kannst eine von Forge angebotene Aktion/)).not.toBeInTheDocument()
    rerender(<GameTable {...props} questions={[]} replay />)
    expect(within(sheet).getByText(/Wiedergabe.*keine Frage/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole("button", { name: "Schließen" }))
    expect(trigger).toHaveFocus()
    for (const input of [props.onTapCard, props.onTapPlayer, props.onAnswer, props.onUseMana]) expect(input).not.toHaveBeenCalled()
  })
  it("shows concise required/optional clarity beside the existing decision label", () => {
    const props = tableProps()
    const { rerender } = render(<GameTable {...props} questions={[optional]} />)
    expect(screen.getByText("Auswahl · Auswahl optional")).toBeInTheDocument()
    rerender(<GameTable {...props} questions={[{ ...optional, min: 1 }]} />)
    expect(screen.getByText("Auswahl · Auswahl erforderlich")).toBeInTheDocument()
  })
})

describe("exact stack targets", () => {
  it("marks only actual IDs, never equal names, changes no offered actions, and clears on the next snapshot", async () => {
    const props = tableProps()
    const me = props.state.players.find((p) => p.me)!
    const visible = me.zones.battlefield.find((c) => !("hidden" in c))!
    if ("hidden" in visible) throw new Error("requires a visible real recorded card")
    const foe = props.state.players.find((p) => !p.me)!
    // Built target relationships on a recorded snapshot, not a new engine game.
    const state: GameState = { ...props.state, stack: [{ id: 990, source: null, card: null, player: me.id, text: "unrelated prose and a decoy name", ability: true, trigger: false, targets: [{ kind: "card", id: visible.id }, { kind: "player", id: foe.id }, { kind: "card", id: 999999 }] }] }
    expect([...stackTargetIds(state, "card")]).toEqual([visible.id, 999999])
    const { rerender } = render(<GameTable {...props} state={state} />)
    const target = document.querySelector<HTMLElement>(`[data-card="${visible.id}"]`)!
    expect(target).toHaveAttribute("data-stack-target", "true")
    expect(target).toHaveAccessibleName(new RegExp(STACK_TARGET_LABEL))
    expect(document.querySelector('[data-card="999999"]')).toBeNull()
    expect(document.querySelector(`[data-player="${foe.id}"]`)).toHaveAttribute("data-stack-target", "true")
    await userEvent.setup().click(target)
    const sheet = screen.getByRole("dialog")
    expect(within(sheet).getByText(STACK_TARGET_LABEL)).toBeInTheDocument()
    expect(props.onTapCard).not.toHaveBeenCalled()
    rerender(<GameTable {...props} />)
    expect(target).not.toHaveAttribute("data-stack-target")
    expect(within(sheet).queryByText(STACK_TARGET_LABEL)).not.toBeInTheDocument()
  })
  it("also marks a visible stack card named as a target, while hidden stack cards remain anonymous", () => {
    const scene = tableScene("stack")
    const entry = scene.state.stack.find((item) => item.card !== null && !("hidden" in item.card))!
    const card = entry.card!
    if ("hidden" in card) throw new Error("requires a visible recorded stack card")
    const targeted = { ...entry, id: 990, source: null, card: null, targets: [{ kind: "card" as const, id: card.id }] }
    const props = tableProps()
    const { rerender } = render(<GameTable {...props} state={{ ...scene.state, stack: [targeted, entry] }} questions={scene.questions} />)
    expect(document.querySelector(`[data-stack-card="${card.id}"]`)).toHaveAttribute("data-stack-target", "true")
    expect(document.querySelector(`[data-stack-card="${card.id}"]`)).toHaveAttribute("data-mark", "target")
    rerender(<GameTable {...props} state={{ ...scene.state, stack: [targeted, { ...entry, card: { hidden: true } }] }} questions={scene.questions} />)
    expect(document.querySelector(`[data-stack-card="${card.id}"]`)).toBeNull()
    expect(screen.getAllByText("verdeckte Karte").length).toBeGreaterThan(0)
    expect(props.onTapCard).not.toHaveBeenCalled()
  })

  it("preserves selection/playability marks while keeping the explicit target label", () => {
    const scene = tableScene("target")
    const props = tableProps()
    const item = scene.questions.find((q) => q.kind === "select")
    if (item?.kind !== "select") throw new Error("requires a recorded selection")
    const id = item.cards[0]!
    const me = scene.state.players.find((p) => p.me)!
    const state: GameState = { ...scene.state, stack: [{ id: 991, source: null, card: null, player: me.id, text: null, ability: false, trigger: false, targets: [{ kind: "card", id }] }] }
    render(<GameTable {...props} state={state} questions={scene.questions} />)
    const target = document.querySelector<HTMLElement>(`[data-card="${id}"]`)!
    expect(target.dataset.mark).toMatch(/usable|selected/)
    expect(target).toHaveAccessibleName(new RegExp(STACK_TARGET_LABEL))
  })
})
