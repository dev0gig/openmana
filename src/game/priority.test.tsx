/*
 * Priority, stack and phases on the game table (prompt 16), in the real table
 * code on real moments of the recorded games (src/test/table-scenes.ts: the
 * player's own main phase, the AI's turn, the AI's spell on top of the stack,
 * the player's answer on top of it, a trigger, a spell being paid for) and on
 * one question built after the schema (Forge's Undo). The table never sends
 * anything itself: onAnswer and onTapCard are the page's. Nothing is passed
 * for the player; cards are played by tapping them, never through a question
 * the app makes up.
 */
import { inputProblems, type AnswerBody, type ButtonsQuestion, type GameState } from "@openmana/engine-protocol"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { ARMING_MS } from "./card-sheet"
import { GameTable, type GameTableProps } from "./game-table"
import { NO_PICTURES } from "./table-cards"
import { priorityQuestion } from "./turn-model"

let clock = 10_000
beforeEach(() => {
  clock = 10_000
  vi.spyOn(performance, "now").mockImplementation(() => clock)
})
afterEach(() => {
  vi.restoreAllMocks()
})

const wait = (ms = ARMING_MS) => {
  clock += ms
}

function table(name: TableSceneName, overrides: Partial<GameTableProps> = {}) {
  const scene = tableScene(name)
  const onAnswer = vi.fn<(question: number, body: AnswerBody) => void>()
  const onTapCard = vi.fn<(id: number) => void>()
  const props: GameTableProps = {
    state: scene.state,
    questions: scene.questions,
    prompt: scene.prompt,
    waiting: true,
    aiProfile: scene.game.aiProfile,
    pictures: NO_PICTURES,
    menu: <button type="button">Menü</button>,
    onTapCard,
    onAnswer,
    ...overrides,
  }
  const view = render(<GameTable {...props} />)
  return { scene, onAnswer, onTapCard, rerender: (next: Partial<GameTableProps>) => view.rerender(<GameTable {...props} {...next} />) }
}

const decision = () => screen.getByRole("region", { name: "Entscheidung" })
const header = () => screen.getByRole("region", { name: "Spielstand" })
const stackRegion = () => screen.getByRole("region", { name: "Stapel und Kampf" })
const answersGroup = () => within(decision()).getByRole("group", { name: "Antworten, die Forge anbietet" })

function answers(onAnswer: ReturnType<typeof vi.fn>): [number, AnswerBody][] {
  const calls = onAnswer.mock.calls as [number, AnswerBody][]
  for (const [question, body] of calls) expect(inputProblems({ type: "answer", seq: 1, question, ...body })).toBeNull()
  return calls
}

function priorityOf(name: TableSceneName): ButtonsQuestion {
  const question = priorityQuestion(tableScene(name).questions)
  if (question === null) throw new Error(`${name}: no priority`)
  return question
}

describe("the player's priority", () => {
  it("own main phase (recorded): words instead of Forge's status line, 'Weiter' is Forge's OK - sent only once armed, never by itself", async () => {
    const user = userEvent.setup()
    const { scene, onAnswer, rerender } = table("main-phase")
    const question = priorityOf("main-phase")
    expect(scene.prompt).toMatch(/^Priorität: /)
    expect(within(decision()).queryByText(scene.prompt!)).not.toBeInTheDocument()
    expect(within(decision()).getByText("Du kannst jetzt eine Karte spielen – oder weitergeben.")).toBeInTheDocument()
    expect(decision().querySelector('[data-slot="game-decision-header"] p')).toHaveTextContent("Priorität")
    const buttons = within(answersGroup()).getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual(["Weiter", "Zug beenden …"])
    expect(buttons[0]).toHaveAccessibleDescription("„Weiter“ gibt die Priorität ab. Tut danach niemand mehr etwas, geht es zum nächsten Schritt.")
    // Nothing is passed for the player: new states, time - no answer.
    rerender({ state: { ...scene.state, seq: scene.state.seq + 1 } })
    wait(60_000)
    expect(onAnswer).not.toHaveBeenCalled()
    // Too soon after the question appeared: dropped; then sent once.
    clock = 10_000
    await user.click(buttons[0]!)
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    await user.click(buttons[0]!)
    expect(answers(onAnswer)).toEqual([[question.id, { kind: "buttons", button: 1 }]])
  })

  it("End Turn asks first, and says what it gives away; only confirming sends Forge's button", async () => {
    const user = userEvent.setup()
    const { onAnswer } = table("main-phase")
    const question = priorityOf("main-phase")
    await user.click(within(answersGroup()).getByRole("button", { name: "Zug beenden …" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Zug beenden?" })
    expect(dialog).toHaveAccessibleDescription(/bis dein Zug endet – ein noch ausstehender Angriff fällt damit weg\. Wirkt die Forge-KI einen Zauberspruch, fragt Forge dich wieder\./)
    // The dialog's first focus is keeping on playing (a held Enter keeps things as they are).
    expect(within(dialog).getByRole("button", { name: "Weiterspielen" })).toHaveFocus()
    await user.click(within(dialog).getByRole("button", { name: "Weiterspielen" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(onAnswer).not.toHaveBeenCalled()
    await user.click(within(answersGroup()).getByRole("button", { name: "Zug beenden …" }))
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Zug beenden" }))
    expect(answers(onAnswer)).toEqual([[question.id, { kind: "buttons", button: 2 }]])
  })

  it("Forge's Undo (built on the main phase): its own words, sent at once when armed - it only takes the last action back", async () => {
    const user = userEvent.setup()
    const scene = tableScene("main-phase")
    const priority = priorityOf("main-phase")
    const undo: ButtonsQuestion = { ...priority, buttons: [priority.buttons[0]!, { nr: 2, label: "Rückgängig (1)", enabled: true, meaning: "undo" }] }
    const { onAnswer } = table("main-phase", { questions: scene.questions.map((question) => (question === priority ? undo : question)) })
    const back = within(answersGroup()).getByRole("button", { name: "Rückgängig (1)" })
    expect(back).toHaveAttribute("title", "Nimmt deine letzte Aktion zurück, etwa ein für Mana getapptes Land")
    wait()
    await user.click(back)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(answers(onAnswer)).toEqual([[undo.id, { kind: "buttons", button: 2 }]])
  })

  it("in the AI's turn (recorded): Forge asks only because the player holds an answer - the header and the words say whose turn it is", () => {
    table("opponent-turn")
    expect(within(header()).getByText("Forge-KI am Zug")).toBeInTheDocument()
    expect(within(decision()).getByText("Zug der Forge-KI: Du kannst jetzt etwas spielen – oder weitergeben.")).toBeInTheDocument()
    expect(within(answersGroup()).getAllByRole("button").map((button) => button.textContent)).toEqual(["Weiter", "Zug beenden …"])
  })

  it("the AI's spell on top (recorded): its card beside the words, 'Verrechnen lassen', announced for screen readers", async () => {
    const user = userEvent.setup()
    const { scene, onAnswer } = table("respond")
    const top = scene.state.stack[0]!.card
    if (top === null || "hidden" in top) throw new Error("respond: the AI's spell must be visible")
    const name = top.name!
    expect(within(decision()).getByText(`Die Forge-KI hat „${name}“ gewirkt. Du kannst darauf antworten – oder es verrechnen lassen.`)).toBeInTheDocument()
    expect(within(decision()).getByRole("button", { name: `${name} ansehen` })).toBeInTheDocument()
    const pass = within(answersGroup()).getByRole("button", { name: "Verrechnen lassen" })
    expect(pass).toHaveAccessibleDescription("„Verrechnen lassen“ gibt die Priorität ab. Antwortet danach niemand mehr, wird das Oberste auf dem Stapel verrechnet.")
    expect(decision().querySelector('[aria-live="polite"]')).toHaveTextContent(`Priorität: Die Forge-KI hat „${name}“ gewirkt.`)
    wait()
    await user.click(pass)
    expect(answers(onAnswer)).toEqual([[priorityOf("respond").id, { kind: "buttons", button: 1 }]])
  })

  it("the player's answer on top of the AI's spell (recorded): still the player's priority, the stack top first", () => {
    const { scene } = table("respond-own")
    const [answer, spell] = scene.state.stack
    const name = (item: GameState["stack"][number]) => (item.card !== null && !("hidden" in item.card) ? item.card.name! : "")
    expect(within(decision()).getByText(`Du hast „${name(answer!)}“ gewirkt. Du kannst noch etwas darauflegen – oder es verrechnen lassen.`)).toBeInTheDocument()
    const entries = within(stackRegion()).getAllByRole("listitem")
    expect(entries.map((entry) => entry.getAttribute("data-stack-item"))).toEqual(scene.state.stack.map((item) => String(item.id)))
    const title = (entry: HTMLElement) => entry.querySelector('[data-slot="item-title"]')!.textContent
    expect([title(entries[0]!), title(entries[1]!)]).toEqual([`${name(answer!)}oben`, name(spell!)])
    expect(entries[0]).toHaveTextContent("Zauberspruch · von dir · Ziel: Forge-KI")
    expect(entries[1]).toHaveTextContent("Zauberspruch · von der Forge-KI")
    expect(within(stackRegion()).getByRole("heading", { name: `Stapel · ${scene.state.stack.length} Einträge` })).toBeInTheDocument()
  })

  it("playing a card is its tap (the card view's button), never a question the app makes up", async () => {
    const user = userEvent.setup()
    const { onAnswer, onTapCard } = table("main-phase")
    // The priority's region holds Forge's two buttons and nothing to choose from.
    for (const role of ["radio", "checkbox", "toolbar", "textbox"] as const) expect(within(decision()).queryByRole(role)).not.toBeInTheDocument()
    const hand = screen.getByRole("toolbar", { name: /^Deine Hand/ })
    await user.click(within(hand).getAllByRole("button", { name: /, spielbar$/ })[0]!)
    const view = await screen.findByRole("dialog")
    wait()
    await user.click(within(view).getByRole("button", { name: "Spiele ein Land" }))
    expect(onTapCard).toHaveBeenCalledTimes(1)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})

describe("the stack", () => {
  it("each item with its card, what it is, whose, its targets and Forge's words (recorded: a spell being paid for)", () => {
    const { scene } = table("stack")
    const item = scene.state.stack[0]!
    const entry = within(stackRegion()).getByRole("listitem")
    const card = item.card !== null && !("hidden" in item.card) ? item.card : null
    expect(card).not.toBeNull()
    expect(within(entry).getByRole("button", { name: `${card!.name} ansehen` })).toHaveAttribute("data-stack-card", String(card!.id))
    expect(entry).toHaveTextContent("Zauberspruch · von dir · Ziel: ")
    expect(entry).toHaveTextContent(item.text!.slice(0, 20))
  })

  it("a spell's card on the stack opens the card view: where it is, how far from the top, Forge's words - to look at, never to tap", async () => {
    const user = userEvent.setup()
    const { scene, onTapCard, onAnswer } = table("respond-own")
    const lower = scene.state.stack[1]!.card
    if (lower === null || "hidden" in lower) throw new Error("respond-own: the AI's spell must be visible")
    await user.click(within(stackRegion()).getByRole("button", { name: `${lower.name} ansehen` }))
    const view = await screen.findByRole("dialog", { name: lower.name! })
    expect(within(view).getByText("Auf dem Stapel – von der Forge-KI")).toBeInTheDocument()
    expect(within(view).getByRole("region", { name: "Auf dem Stapel" })).toHaveTextContent("Auf dem Stapel: Zauberspruch von der Forge-KI – 1 Eintrag liegt darüber.")
    expect(within(view).getAllByRole("button").map((button) => button.textContent)).toEqual(["Schließen"])
    expect(onTapCard).not.toHaveBeenCalled()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("a triggered ability (recorded): its source stays on the battlefield; the card view tells both", async () => {
    const user = userEvent.setup()
    const { scene } = table("yes-no")
    const item = scene.state.stack[0]!
    expect(item.trigger).toBe(true)
    const entry = within(stackRegion()).getByRole("listitem")
    expect(entry).toHaveTextContent("Ausgelöste Fähigkeit · von dir")
    const source = item.card !== null && !("hidden" in item.card) ? item.card : null
    await user.click(within(entry).getByRole("button", { name: `${source!.name} ansehen` }))
    const view = await screen.findByRole("dialog", { name: source!.name! })
    expect(within(view).getByRole("region", { name: "Auf dem Stapel" })).toHaveTextContent("Auf dem Stapel: Ausgelöste Fähigkeit von dir – wird als Nächstes verrechnet.")
    fireEvent.keyDown(view, { key: "Escape" })
  })
})

describe("turn and phases in the header", () => {
  it("the turn's steps as a track (a picture of the words beside it): the step Forge is in, the ones before it over", () => {
    table("respond")
    const track = header().querySelector('[data-slot="phase-track"]')!
    expect(track).toHaveAttribute("aria-hidden", "true")
    const phase = tableScene("respond").state.phase!
    expect(track).toHaveAttribute("data-phase", phase)
    const steps = [...track.querySelectorAll('[data-slot="phase-track-step"]')]
    expect(steps).toHaveLength(13)
    expect(steps.filter((step) => step.getAttribute("data-state") === "current")).toHaveLength(1)
    const groups = [...track.querySelectorAll('[data-slot="phase-track-group"]')].map((group) => group.getAttribute("title"))
    expect(groups).toEqual(["Anfangsphase", "Erste Hauptphase", "Kampfphase", "Zweite Hauptphase", "Endphase"])
  })

  it("before the first turn there is no track, the header says the opening hands are drawn", () => {
    table("opening")
    expect(header().querySelector('[data-slot="phase-track"]')).toBeNull()
    expect(within(header()).getByText("Die Starthände werden gezogen")).toBeInTheDocument()
  })
})

describe("while Forge computes", () => {
  it("who is at it, and that Forge plays on by itself only where the player has nothing to do", () => {
    const scene = tableScene("opponent-turn")
    const players = scene.state.players.map((player) => ({ ...player, hasPriority: !player.me }))
    table("opponent-turn", { questions: [], waiting: false, state: { ...scene.state, players: players as GameState["players"] } })
    expect(within(decision()).getByText("Die Forge-KI ist dran …")).toBeInTheDocument()
    expect(within(decision()).getByText("Forge spielt von selbst weiter, bis du etwas tun oder entscheiden kannst – dann hält Forge an.")).toBeInTheDocument()
  })
})
