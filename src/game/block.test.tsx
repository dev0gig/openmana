/* Real Forge block scenes, plus explicitly built boundary/order cases. */
import { checkEngineMessage, inputProblems, type AnswerBody, type ButtonsQuestion, type GameState, type Question, type VisibleCard } from "@openmana/engine-protocol"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { builtQuestion } from "@/test/built-questions"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { blockView } from "./block-model"
import { ARMING_MS } from "./card-sheet"
import { cardUse, type TableMoment } from "./card-use"
import { GameTable, type GameTableProps } from "./game-table"
import { NO_PICTURES } from "./table-cards"
import { visibleCards } from "./table-model"

let clock = 10_000
beforeEach(() => {
  clock = 10_000
  vi.spyOn(performance, "now").mockImplementation(() => clock)
})

function question(name: TableSceneName): ButtonsQuestion {
  const found = tableScene(name).questions.find((q): q is ButtonsQuestion => q.kind === "buttons" && q.purpose === "block")
  if (found === undefined) throw new Error("no block input")
  return found
}

function moment(name: TableSceneName): TableMoment {
  const scene = tableScene(name)
  return { questions: scene.questions, combat: scene.state.combat, waiting: true, conceding: false }
}

function table(name: TableSceneName, overrides: Partial<GameTableProps> = {}) {
  const scene = tableScene(name)
  const onTapCard = vi.fn<(id: number) => void>()
  const onAnswer = vi.fn<(question: number, body: AnswerBody) => void>()
  const props: GameTableProps = {
    state: scene.state, questions: scene.questions, prompt: scene.prompt, waiting: true,
    aiProfile: scene.game.aiProfile, pictures: NO_PICTURES, menu: <button>Menü</button>, onTapCard, onAnswer, ...overrides,
  }
  const rendered = render(<GameTable {...props} />)
  return { ...rendered, props, onTapCard, onAnswer }
}

const decision = () => screen.getByRole("region", { name: "Entscheidung" })
const cardButton = (id: number) => document.querySelector(`button[data-card="${id}"]`)!

describe("Forge's block input", () => {
  it("uses unchanged, protocol-valid recordings with the selected attacker and a real double block", () => {
    for (const name of ["block-start", "block-multiple", "defend"] as const) {
      const scene = tableScene(name)
      expect(() => checkEngineMessage(scene.state)).not.toThrow()
      scene.questions.forEach((q) => expect(() => checkEngineMessage(q)).not.toThrow())
      const view = blockView(scene.state, question(name))
      expect(view.current?.highlighted).toBe(true)
      expect(view.attackers.map((a) => a.card.id)).toEqual(scene.state.combat.map((entry) => entry.attacker))
    }
    const scene = tableScene("block-multiple")
    const view = blockView(scene.state, question("block-multiple"))
    expect(view.assigned).toBe(2)
    expect(view.attackers[0]!.blockers.map((c) => c.id)).toEqual(scene.state.combat[0]!.blockers)
  })

  it("a marker for SOME attacker does not offer a block of THIS attacker without Forge's action", () => {
    const scene = tableScene("block-start")
    const ready = scene.state.players.find((p) => p.me)!.zones.battlefield.find((c): c is VisibleCard => "action" in c)!
    const { action: _action, ...otherTargetOnly } = ready
    expect(otherTargetOnly.playable).toBe(true)
    expect(cardUse(otherTargetOnly, { zone: "battlefield", mine: true }, moment("block-start"))).toMatchObject({ mark: null, tap: null, primary: "look" })
    // A caller without combat data still must not fall back to the broad marker.
    expect(cardUse(otherTargetOnly, { zone: "battlefield", mine: true }, { questions: scene.questions, waiting: true, conceding: false })).toMatchObject({ mark: null, tap: null, primary: "look" })
    const { playable: _playable, ...withoutMarker } = ready
    expect(cardUse(withoutMarker, { zone: "battlefield", mine: true }, moment("block-start"))).toMatchObject({ mark: "usable", markLabel: "kann diesen Angreifer blocken", primary: "tap", tap: { label: ready.action } })
  })

  it("assigned blockers stay chosen, even without Forge's general marker; their tap removes the assignment", () => {
    const scene = tableScene("block-multiple")
    const cards = visibleCards(scene.state)
    for (const id of scene.state.combat[0]!.blockers) {
      const card = cards.get(id)!
      expect(card.playable).toBeUndefined()
      expect(cardUse(card, { zone: "battlefield", mine: true }, moment("block-multiple"))).toMatchObject({ mark: "selected", markLabel: "blockt", primary: "tap", tap: { label: card.action } })
    }
  })

  it("one blocker assigned to several attackers counts once and keeps all assignments (built)", () => {
    const scene = tableScene("block-multiple")
    const entry = scene.state.combat[0]!
    const state: GameState = { ...scene.state, combat: [...scene.state.combat, { ...entry, attacker: 88, blockers: [entry.blockers[0]!] }] }
    expect(blockView(state, question("block-multiple")).assigned).toBe(2)
    const blocker = visibleCards(state).get(entry.blockers[0]!)!
    expect(cardUse(blocker, { zone: "battlefield", mine: true }, { ...moment("block-multiple"), combat: state.combat })).toMatchObject({ mark: "selected", markLabel: "blockt 2 Angreifer" })
    const { action: _action, ...unavailableNow } = blocker
    expect(cardUse(unavailableNow, { zone: "battlefield", mine: true }, { ...moment("block-multiple"), combat: state.combat })).toMatchObject({ mark: "selected", tap: null, primary: "look" })
  })

  it("never invents a selected attacker when Forge highlights none", () => {
    const scene = tableScene("block-start")
    const state = structuredClone(scene.state)
    for (const player of state.players) player.zones.battlefield = player.zones.battlefield.map((c) => {
      if ("hidden" in c) return c
      const { highlighted: _highlighted, ...plain } = c
      return plain
    })
    expect(blockView(state, question("block-start")).current).toBeNull()
  })
})

describe("block declaration on the actual table", () => {
  it("shows the block target and instructions before assignment, and sends nothing on render", () => {
    const { onAnswer, onTapCard } = table("block-start")
    const scene = tableScene("block-start")
    const current = blockView(scene.state, question("block-start")).current!
    expect(cardButton(current.id)).toHaveAttribute("data-mark", "selected")
    expect(cardButton(current.id).querySelector('[data-slot="game-card-caption"]')).toHaveTextContent("Blockziel")
    expect(decision()).toHaveTextContent(`Wähle deine Blocker für „${current.name}“.`)
    expect(decision()).toHaveTextContent("Erst den Angreifer, dann deine Kreaturen antippen")
    expect(within(decision()).getByRole("button", { name: "Nicht blocken" })).toBeEnabled()
    expect(onAnswer).not.toHaveBeenCalled()
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("shows both blockers beside their attacker, in Forge's order, and confirms only after arming", () => {
    const { onAnswer } = table("block-multiple")
    const scene = tableScene("block-multiple")
    const entry = scene.state.combat[0]!
    const line = document.querySelector(`[data-combat-attacker="${entry.attacker}"]`)!
    for (const id of entry.blockers) {
      expect(cardButton(id)).toHaveAttribute("data-mark", "selected")
      expect(cardButton(id).querySelector('[data-slot="game-card-caption"]')).toHaveTextContent("blockt")
      expect(line).toHaveTextContent(visibleCards(scene.state).get(id)!.name!)
    }
    const confirm = within(decision()).getByRole("button", { name: "Blocks bestätigen" })
    fireEvent.click(confirm)
    expect(onAnswer).not.toHaveBeenCalled()
    clock += ARMING_MS
    fireEvent.keyDown(confirm, { key: "Enter", repeat: true })
    expect(onAnswer).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(question("block-multiple").id, { kind: "buttons", button: 1 })
  })

  it("choosing an attacker and double-tapping a blocker send only the intended card ids", () => {
    const { onTapCard, onAnswer } = table("block-start")
    const scene = tableScene("block-start")
    const current = blockView(scene.state, question("block-start")).current!.id
    const other = scene.state.combat.find((e) => e.attacker !== current)!.attacker
    fireEvent.click(cardButton(other))
    const ready = scene.state.players.find((p) => p.me)!.zones.battlefield.find((c) => "action" in c)!
    expect("id" in ready).toBe(true)
    if (!("id" in ready)) throw new Error("hidden blocker")
    fireEvent.click(cardButton(ready.id))
    fireEvent.click(cardButton(ready.id))
    expect(onTapCard.mock.calls).toEqual([[other], [ready.id]])
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("inspecting a selected blocker is safe, and the card view carries Forge's current remove action", () => {
    const { onTapCard, onAnswer } = table("defend")
    fireEvent.contextMenu(cardButton(58))
    expect(screen.getByRole("dialog")).toHaveTextContent("Forge bietet an: Remove card from combat")
    expect(onTapCard).not.toHaveBeenCalled()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it.each([{ waiting: false }, { conceding: true }])("keeps busy or conceding states safe: %j", (overrides) => {
    const { onTapCard, onAnswer } = table("defend", overrides)
    fireEvent.click(cardButton(58))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("a replay without callbacks only opens the card view and disables confirmation", () => {
    const scene = tableScene("defend")
    render(<GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={<button>Menü</button>} />)
    fireEvent.click(cardButton(58))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(within(decision()).getByRole("button", { name: "Blocks bestätigen", hidden: true })).toBeDisabled()
  })

  it("re-arms confirmation after a changed assignment and displays the new live block state", () => {
    const { props, rerender, onAnswer } = table("block-multiple")
    clock += ARMING_MS
    const state = { ...props.state, combat: props.state.combat.map((e) => ({ ...e, blockers: e.blockers.slice(0, 1) })) }
    rerender(<GameTable {...props} state={state} />)
    fireEvent.click(within(decision()).getByRole("button", { name: "Blocks bestätigen" }))
    expect(onAnswer).not.toHaveBeenCalled()
    clock += ARMING_MS
    fireEvent.click(within(decision()).getByRole("button", { name: "Blocks bestätigen" }))
    expect(onAnswer).toHaveBeenCalledOnce()
  })

  it("does not offer a disabled Forge confirmation, nor restore withdrawn block controls", () => {
    const scene = tableScene("defend")
    const q = question("defend")
    const questions: Question[] = [{ ...q, buttons: [{ ...q.buttons[0], enabled: false }, { ...q.buttons[1], enabled: false }] }]
    const { props, rerender } = table("defend", { questions })
    expect(within(decision()).getByRole("button", { name: "Blocks bestätigen" })).toBeDisabled()
    rerender(<GameTable {...props} questions={[]} state={{ ...scene.state, combat: [] }} />)
    expect(within(decision()).queryByRole("button", { name: "Blocks bestätigen" })).toBeNull()
  })

  it("a blocking Forge order request supersedes block declaration; only the chosen order is sent (built)", () => {
    const scene = tableScene("block-multiple")
    const built = builtQuestion("block-order", scene)
    const q = built.questions[0]!
    expect(() => checkEngineMessage(q)).not.toThrow()
    const { onAnswer, onTapCard } = table("block-multiple", { questions: [...scene.questions, q] })
    expect(within(decision()).queryByRole("button", { name: "Blocks bestätigen" })).toBeNull()
    expect(onAnswer).not.toHaveBeenCalled()
    const down = within(decision()).getAllByRole("button", { name: /nach unten$/ })[0]!
    fireEvent.click(down)
    clock += ARMING_MS
    fireEvent.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(q.id, { kind: "order", order: [2, 1] })
    const body = onAnswer.mock.calls[0]![1]
    expect(inputProblems({ type: "answer", seq: 1, question: q.id, ...body })).toBeNull()
    expect(onTapCard).not.toHaveBeenCalled()
  })
})
