/*
 * The start hand in full screen (prompt 50) on the recorded "opening" scene -
 * Forge's real mulligan with the player's seven cards - and built neighbours
 * (a new hand after a mulligan, the London mulligan's choice for the bottom,
 * the game's first priority). The panel shows the current hand, answers only
 * with Forge's buttons when pressed (armed), looks at a card in the card view
 * with the hand to browse, and closing it answers nothing. In the choice for
 * the bottom a tap on a picture chooses (Forge's card.tap, once), a long press
 * looks, and Forge's gap between two questions moves nothing.
 */
import type { GameState, Question, VisibleCard } from "@openmana/engine-protocol"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LONG_PRESS_MS } from "@/hooks/use-card-press"
import { tableScene } from "@/test/table-scenes"
import { ARMING_MS } from "./card-view"
import { GameTable, type GameTableProps } from "./game-table"
import { NO_PICTURES } from "./table-cards"
import { isVisible } from "./table-model"

let clock = 10_000
beforeEach(() => {
  clock = 10_000
  vi.spyOn(performance, "now").mockImplementation(() => clock)
})
afterEach(() => vi.restoreAllMocks())
const wait = (ms = ARMING_MS) => {
  clock += ms
}

const opening = tableScene("opening")
const HAND = [53, 59, 45, 55, 34, 37, 33]

function table(overrides: Partial<GameTableProps> = {}) {
  const onAnswer = vi.fn()
  const onTapCard = vi.fn()
  const props: GameTableProps = {
    state: opening.state,
    questions: opening.questions,
    prompt: opening.prompt,
    waiting: true,
    aiProfile: opening.game.aiProfile,
    pictures: NO_PICTURES,
    menu: <button type="button">Menü</button>,
    onAnswer,
    onTapCard,
    startHandOpens: true,
    ...overrides,
  }
  const view = render(<GameTable {...props} />)
  let current = props
  return {
    onAnswer,
    onTapCard,
    rerender: (next: Partial<GameTableProps>) => {
      current = { ...current, ...next }
      view.rerender(<GameTable {...current} />)
    },
  }
}

const panel = () => screen.getByRole("dialog", { name: /^(Deine Starthand|Karten unter die Bibliothek legen)$/ })
const panelGone = () => screen.queryByRole("dialog", { name: /^(Deine Starthand|Karten unter die Bibliothek legen)$/ }) === null
const handCards = () => [...document.querySelectorAll<HTMLButtonElement>("[data-start-hand-card]")].map((button) => Number(button.dataset["startHandCard"]))
const answerButton = (name: string) => within(within(panel()).getByRole("group", { name: "Antworten, die Forge anbietet" })).getByRole("button", { name })
const escape = (element: Element) => fireEvent.keyDown(element, { key: "Escape" })

/** The state with another hand (Forge's new hand after a mulligan, built). */
function withHand(cards: readonly VisibleCard[], turn = 0): GameState {
  const state = structuredClone(opening.state)
  const me = state.players.find((player) => player.me)!
  me.zones.hand = [...cards]
  state.turn = turn
  return state
}
const original = opening.state.players.find((player) => player.me)!.zones.hand.filter(isVisible)
const mulligan = (id: number): Question => ({ ...opening.questions[0]!, id }) as Question
const bottom = (id: number, ok: boolean): Question => ({ type: "question", kind: "buttons", id, blocking: false, text: "", purpose: "mulliganBottom", buttons: [{ nr: 1, label: "OK", enabled: ok }, { nr: 2, label: "Auto", enabled: true }] })

describe("the start hand opens by itself at Forge's mulligan", () => {
  it("the whole hand in Forge's order, Forge's words and exactly Forge's buttons - armed, one answer per press", () => {
    const { onAnswer, onTapCard } = table()
    expect(panel()).toBeInTheDocument()
    expect(handCards()).toEqual(HAND)
    expect(within(panel()).getByText("7 Karten")).toBeInTheDocument()
    expect(within(panel()).getByText(opening.prompt!.replace(/\s+/g, " "))).toBeInTheDocument()
    const group = within(panel()).getByRole("group", { name: "Antworten, die Forge anbietet" })
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual(["Behalten", "Mulligan"])
    // Pressed right after the panel appeared: nothing (the double tap's second press).
    fireEvent.click(answerButton("Behalten"))
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    fireEvent.click(answerButton("Behalten"))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(1, { kind: "buttons", button: 1 })
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("a held key repeats nothing; Forge's switched-off button stays visible, off, with the reason", () => {
    const question = { ...opening.questions[0]!, buttons: [{ nr: 1, label: "Behalten", enabled: true }, { nr: 2, label: "Mulligan", enabled: false }] } as Question
    const { onAnswer } = table({ questions: [question] })
    wait()
    const keep = answerButton("Behalten")
    expect(fireEvent.keyDown(keep, { key: "Enter", repeat: true })).toBe(false)
    expect(answerButton("Mulligan")).toBeDisabled()
    expect(answerButton("Mulligan")).toHaveAccessibleDescription("„Mulligan“ hat Forge gerade abgeschaltet.")
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("while Forge computes or a concession is on its way nothing is sent; a concession does not open it", () => {
    const { onAnswer } = table({ waiting: false })
    wait()
    expect(answerButton("Behalten")).toBeDisabled()
    fireEvent.click(answerButton("Behalten"))
    expect(onAnswer).not.toHaveBeenCalled()
    cleanup()
    table({ conceding: true })
    expect(panelGone()).toBe(true)
  })
})

describe("closing answers nothing", () => {
  it("Escape and the X close it; Forge's question stays in the decision region, \"Starthand ansehen\" opens it again", async () => {
    const { onAnswer } = table()
    escape(panel())
    expect(panelGone()).toBe(true)
    const decision = screen.getByRole("region", { name: "Entscheidung" })
    expect(within(decision).getByRole("button", { name: "Behalten" })).toBeInTheDocument()
    // Closed for this hand: a new state of the same hand does not open it again.
    expect(panelGone()).toBe(true)
    fireEvent.click(within(decision).getByRole("button", { name: "Starthand ansehen" }))
    expect(handCards()).toEqual(HAND)
    fireEvent.click(within(panel()).getByRole("button", { name: "Schließen" }))
    expect(panelGone()).toBe(true)
    await waitFor(() => expect(document.activeElement).toBe(within(decision).getByRole("button", { name: "Starthand ansehen" })))
    expect(onAnswer).not.toHaveBeenCalled()
  })
})

describe("a card of the start hand, large", () => {
  it("a tap opens the card view with the hand to browse: arrow keys, buttons, \"N von 7\", no wrapping; back to the panel; nothing sent", async () => {
    const { onAnswer, onTapCard } = table()
    const first = document.querySelector<HTMLButtonElement>('[data-start-hand-card="53"]')!
    first.focus()
    fireEvent.click(first)
    const view = screen.getByRole("dialog", { name: "Bonecrusher Giant" })
    const position = () => document.querySelector('[data-slot="card-view-position"]')?.textContent
    expect(position()).toBe("1 von 7")
    expect(within(view).getByRole("group", { name: "Deine Hand durchsehen" })).toBeInTheDocument()
    expect(within(view).getByRole("button", { name: "Vorige Karte" })).toBeDisabled()
    // The first card: to the left nothing (no wrapping).
    fireEvent.keyDown(view, { key: "ArrowLeft" })
    expect(screen.getByRole("dialog", { name: "Bonecrusher Giant" })).toBeInTheDocument()
    fireEvent.keyDown(view, { key: "ArrowRight" })
    expect(screen.getByRole("dialog", { name: "Goblin-Plünderer" })).toHaveTextContent("2 von 7")
    // A held key moves one card only.
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Goblin-Plünderer" }), { key: "ArrowRight", repeat: true })
    expect(screen.getByRole("dialog", { name: "Goblin-Plünderer" })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole("dialog", { name: "Goblin-Plünderer" })).getByRole("button", { name: "Nächste Karte" }))
    const third = screen.getByRole("dialog", { name: "Gebirge" })
    expect(third).toHaveTextContent("3 von 7")
    // The pressed button keeps the focus while the card changes.
    expect(document.activeElement).toBe(within(third).getByRole("button", { name: "Nächste Karte" }))
    // Back to the panel: the focus on the card that opened the view.
    escape(third)
    expect(panel()).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Gebirge" })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(first))
    expect(onAnswer).not.toHaveBeenCalled()
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("the last card: to the right nothing", () => {
    table()
    fireEvent.click(document.querySelector('[data-start-hand-card="33"]')!)
    const view = screen.getByRole("dialog", { name: "Gebirge" })
    expect(view).toHaveTextContent("7 von 7")
    expect(within(view).getByRole("button", { name: "Nächste Karte" })).toBeDisabled()
    fireEvent.keyDown(view, { key: "ArrowRight" })
    expect(screen.getByRole("dialog", { name: "Gebirge" })).toHaveTextContent("7 von 7")
  })

  it("the press that closes the card view never answers: Forge's buttons re-arm when it closes", () => {
    const { onAnswer } = table()
    wait()
    fireEvent.click(document.querySelector('[data-start-hand-card="53"]')!)
    escape(screen.getByRole("dialog", { name: "Bonecrusher Giant" }))
    fireEvent.click(answerButton("Behalten"))
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    fireEvent.click(answerButton("Mulligan"))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(1, { kind: "buttons", button: 2 })
  })
})

describe("mulligans, the London mulligan's choice and back to the table (built from Forge's messages)", () => {
  it("after a mulligan the panel waits for Forge and shows the new hand; the choice for the bottom; then the game", () => {
    const { onAnswer, onTapCard, rerender } = table()
    wait()
    fireEvent.click(answerButton("Mulligan"))
    expect(onAnswer).toHaveBeenLastCalledWith(1, { kind: "buttons", button: 2 })
    // Forge took the answer and computes: the panel stays and says so.
    rerender({ questions: [], waiting: false })
    expect(within(panel()).getByRole("status")).toHaveTextContent("Forge rechnet")
    // The new hand (other cards), Forge asks again: the panel shows it.
    const fresh = original.map((card, index) => ({ ...card, id: 200 + index }))
    rerender({ state: withHand(fresh), questions: [mulligan(2)], waiting: true })
    expect(handCards()).toEqual(fresh.map((card) => card.id))
    wait()
    fireEvent.click(answerButton("Behalten"))
    expect(onAnswer).toHaveBeenLastCalledWith(2, { kind: "buttons", button: 1 })
    // The London mulligan: one card for the bottom; Forge's OK off until it is chosen.
    rerender({ questions: [bottom(3, false)], prompt: "Lege 1 Karte unter deine Bibliothek." })
    expect(panel()).toHaveAccessibleName("Karten unter die Bibliothek legen")
    expect(within(panel()).getByText("0 ausgewählt")).toBeInTheDocument()
    expect(answerButton("OK")).toBeDisabled()
    expect(answerButton("Auto")).toBeEnabled()
    // Choosing is a tap on the picture (as on the table) - Forge's card.tap, a double tap once. Only right after the
    // step appeared is a press dropped (the stray press of the answer before).
    const picture = (id: number) => document.querySelector<HTMLButtonElement>(`[data-start-hand-card="${id}"]`)!
    fireEvent.click(picture(201))
    expect(onTapCard).not.toHaveBeenCalled()
    wait()
    fireEvent.click(picture(201))
    fireEvent.click(picture(201))
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(201)
    expect(screen.queryByRole("dialog", { name: fresh[1]!.name! })).toBeNull()
    // Forge computes and withdraws its question: no question for a moment - everything stays, only waiting.
    rerender({ waiting: false })
    rerender({ questions: [], waiting: false })
    const marked = fresh.map((card) => (card.id === 201 ? { ...card, highlighted: true as const } : card))
    rerender({ state: withHand(marked) })
    expect(panel()).toHaveAccessibleName("Karten unter die Bibliothek legen")
    expect(within(panel()).getByText("1 ausgewählt")).toBeInTheDocument()
    expect(within(panel()).getByText("Lege 1 Karte unter deine Bibliothek.")).toBeInTheDocument()
    expect(picture(201)).toHaveAttribute("data-mark", "selected")
    expect(document.querySelectorAll("[data-bottom-toggle]")).toHaveLength(7)
    expect(document.querySelector("[data-start-hand-status]")).toHaveAttribute("data-start-hand-status", "computing")
    expect(answerButton("OK")).toBeDisabled()
    // A press meanwhile is not sent - and says so.
    fireEvent.click(picture(202))
    expect(onTapCard).toHaveBeenCalledTimes(1)
    expect(toast.getToasts().map((shown) => ("title" in shown ? shown.title : null))).toEqual(["Die Karte wurde nicht gewählt"])
    // Forge asks anew (a new id): the mark shows, OK is on - and the next press counts at once (no re-arming).
    rerender({ questions: [bottom(4, true)], waiting: true })
    expect(within(panel()).getByRole("button", { name: `${fresh[1]!.name}: Doch behalten` })).toHaveAttribute("aria-pressed", "true")
    expect(picture(201)).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(panel()).getByRole("button", { name: `${fresh[1]!.name}: Doch behalten` }))
    expect(onTapCard).toHaveBeenLastCalledWith(201)
    expect(onTapCard).toHaveBeenCalledTimes(2)
    // OK and Auto are not re-armed by Forge's new question either: an OK right after the last card counts.
    const answered = onAnswer.mock.calls.length
    fireEvent.click(answerButton("OK"))
    expect(onAnswer).toHaveBeenLastCalledWith(4, { kind: "buttons", button: 1 })
    expect(onAnswer).toHaveBeenCalledTimes(answered + 1)
    onAnswer.mockClear()
    // Forge takes it back, then the button under another card chooses it - the same card.tap.
    rerender({ state: withHand(fresh), questions: [bottom(5, false)] })
    fireEvent.click(within(panel()).getByRole("button", { name: `${fresh[1]!.name}: Unter die Bibliothek legen` }))
    expect(onTapCard).toHaveBeenCalledTimes(3)
    rerender({ state: withHand(marked), questions: [bottom(6, true)] })
    // A card looked at meanwhile (the context menu: a right click, the long press's event); Forge withdraws its
    // question and asks anew: the panel and the card view over it stay; then OK confirms.
    expect(fireEvent.contextMenu(picture(203))).toBe(false)
    expect(screen.getByRole("dialog", { name: fresh[3]!.name! })).toBeInTheDocument()
    rerender({ questions: [] })
    // Under the card view the panel is hidden from the accessibility tree (a modal over it), but there.
    expect(document.querySelector('[data-slot="hand-spread"]')).not.toBeNull()
    expect(screen.getByRole("dialog", { name: fresh[3]!.name! })).toBeInTheDocument()
    rerender({ questions: [bottom(7, true)] })
    escape(screen.getByRole("dialog", { name: fresh[3]!.name! }))
    expect(panel()).toBeInTheDocument()
    expect(within(panel()).getByText("1 ausgewählt")).toBeInTheDocument()
    expect(document.querySelector('[data-start-hand-card="201"]')).toHaveAttribute("data-mark", "selected")
    // The press that closed the card view never chooses (re-armed when it closed).
    fireEvent.click(picture(204))
    expect(onTapCard).toHaveBeenCalledTimes(3)
    wait()
    fireEvent.click(answerButton("OK"))
    expect(onAnswer).toHaveBeenLastCalledWith(7, { kind: "buttons", button: 1 })
    expect(onAnswer).toHaveBeenCalledTimes(1)
    // Answered from here: in Forge's gap after it nothing is held - Forge computes the next step, the panel says so.
    rerender({ questions: [], waiting: false })
    expect(within(panel()).getByRole("status")).toHaveTextContent("Forge rechnet")
    expect(document.querySelectorAll("[data-bottom-toggle]")).toHaveLength(0)
    // The game begins: turn 1, Forge's priority - back to the table.
    rerender({ state: withHand(fresh.slice(0, 6), 1), questions: tableScene("main-phase").questions, prompt: null })
    expect(panelGone()).toBe(true)
  })

  it("in the choice for the bottom a touch's tap on a picture sends exactly one card.tap; a long press opens the card view and sends nothing", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { onTapCard, onAnswer } = table({ questions: [bottom(3, false)] })
    wait()
    const card = document.querySelector<HTMLButtonElement>('[data-start-hand-card="45"]')!
    expect(card).toHaveAccessibleName(/antippen legt sie unter die Bibliothek, lange drücken zeigt sie groß$/)
    // A tap: pressed and released at once, the browser's click.
    fireEvent.pointerDown(card, { pointerType: "touch", clientX: 10, clientY: 10 })
    fireEvent.pointerUp(card, { pointerType: "touch" })
    fireEvent.click(card)
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(45)
    expect(screen.queryByRole("dialog", { name: "Gebirge" })).toBeNull()
    // A long press on another card: its view, the click after it swallowed - nothing sent.
    const other = document.querySelector<HTMLButtonElement>('[data-start-hand-card="33"]')!
    fireEvent.pointerDown(other, { pointerType: "touch", clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(screen.getByRole("dialog", { name: "Gebirge" })).toBeInTheDocument()
    fireEvent.pointerUp(other, { pointerType: "touch" })
    fireEvent.click(other)
    expect(onTapCard).toHaveBeenCalledTimes(1)
    expect(onAnswer).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("the gap between Forge's questions keeps title, count, marks, the buttons under the cards and Forge's buttons - only waiting, one status line", () => {
    const marked = original.map((card) => (card.id === 45 ? { ...card, highlighted: true as const } : card))
    const { rerender } = table({ state: withHand(marked), questions: [bottom(3, true)], prompt: "Lege 1 Karte unter deine Bibliothek." })
    const before = {
      toggles: [...document.querySelectorAll("[data-bottom-toggle]")].map((toggle) => toggle.textContent),
      marks: [...document.querySelectorAll('[data-start-hand-card][data-mark="selected"]')].map((card) => card.getAttribute("data-start-hand-card")),
      answers: [...document.querySelectorAll("[data-start-answer]")].map((button) => button.textContent),
      status: document.querySelectorAll("[data-start-hand-status]").length,
    }
    rerender({ questions: [], waiting: false })
    expect(panel()).toHaveAccessibleName("Karten unter die Bibliothek legen")
    expect(within(panel()).getByText("1 ausgewählt")).toBeInTheDocument()
    expect(within(panel()).getByText("Lege 1 Karte unter deine Bibliothek.")).toBeInTheDocument()
    expect([...document.querySelectorAll("[data-bottom-toggle]")].map((toggle) => toggle.textContent)).toEqual(before.toggles)
    expect([...document.querySelectorAll('[data-start-hand-card][data-mark="selected"]')].map((card) => card.getAttribute("data-start-hand-card"))).toEqual(before.marks)
    expect([...document.querySelectorAll("[data-start-answer]")].map((button) => button.textContent)).toEqual(before.answers)
    expect(document.querySelectorAll("[data-start-hand-status]")).toHaveLength(before.status)
    // Waiting: the buttons under the cards keep their look (aria-disabled), Forge's buttons are off, the line says why.
    for (const toggle of document.querySelectorAll("[data-bottom-toggle]")) {
      expect(toggle).toHaveAttribute("aria-disabled", "true")
      expect(toggle).not.toHaveAttribute("disabled")
    }
    expect(answerButton("OK")).toBeDisabled()
    expect(answerButton("OK")).toHaveAccessibleDescription("Forge rechnet … gleich geht es weiter.")
    expect(document.querySelector("[data-start-pending]")).not.toBeNull()
    // Another hand ends the hold (a mulligan's new draw): no stale choice.
    rerender({ state: withHand(original.slice(0, 6)) })
    expect(document.querySelectorAll("[data-bottom-toggle]")).toHaveLength(0)
    expect(within(panel()).getByRole("status")).toHaveTextContent("Forge rechnet")
  })

  it("a choice made on the table (the hand's direct taps) does not open the panel again once closed", () => {
    const { rerender } = table({ questions: [bottom(3, false)] })
    escape(panel())
    const marked = original.map((card) => (card.id === 45 ? { ...card, highlighted: true as const } : card))
    rerender({ state: withHand(marked), questions: [bottom(4, true)] })
    expect(panelGone()).toBe(true)
  })
})

/** The table of a replay: no answers, no taps, nothing opens by itself. */
function renderReplay() {
  render(<GameTable state={opening.state} questions={opening.questions} prompt={opening.prompt} waiting aiProfile={opening.game.aiProfile} pictures={NO_PICTURES} menu={<button type="button">Menü</button>} replay />)
}

describe("a replay", () => {
  it("does not open it by itself; asked, it shows the hand and answers nothing", () => {
    renderReplay()
    expect(panelGone()).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Starthand ansehen" }))
    expect(handCards()).toEqual(HAND)
    expect(answerButton("Behalten")).toBeDisabled()
    expect(within(panel()).getByText("Nur ansehen – hier wird nichts beantwortet.")).toBeInTheDocument()
  })
})

describe("a replay of the choice for the bottom", () => {
  it("a tap on a picture only looks; the buttons under the cards are off", () => {
    render(<GameTable state={opening.state} questions={[bottom(3, false)]} prompt={null} waiting aiProfile={opening.game.aiProfile} pictures={NO_PICTURES} menu={<button type="button">Menü</button>} replay />)
    fireEvent.click(screen.getByRole("button", { name: "Starthand ansehen" }))
    expect(document.querySelector('[data-bottom-toggle="45"]')).toBeDisabled()
    wait()
    fireEvent.click(document.querySelector('[data-start-hand-card="45"]')!)
    expect(screen.getByRole("dialog", { name: "Gebirge" })).toBeInTheDocument()
  })
})

describe("only beside Forge's start questions", () => {
  it("no \"Starthand ansehen\" at a priority, play or draw, a payment", () => {
    for (const name of ["main-phase", "play-draw", "payment"] as const) {
      const scene = tableScene(name)
      render(<GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={<button type="button">Menü</button>} onAnswer={vi.fn()} startHandOpens />)
      expect(screen.queryByRole("button", { name: "Starthand ansehen" })).toBeNull()
      expect(panelGone()).toBe(true)
      cleanup()
    }
  })
})

