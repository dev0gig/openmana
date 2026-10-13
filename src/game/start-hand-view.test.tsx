/*
 * The start hand in full screen (prompt 50) on the recorded "opening" scene -
 * Forge's real mulligan with the player's seven cards - and built neighbours
 * (a new hand after a mulligan, the London mulligan's choice for the bottom,
 * the game's first priority). The panel shows the current hand, answers only
 * with Forge's buttons when pressed (armed), looks at a card in the card view
 * with the hand to browse, and closing it answers nothing.
 */
import type { GameState, Question, VisibleCard } from "@openmana/engine-protocol"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
    // Looking is still a tap on the card; choosing is the button under it - Forge's card.tap, a double press once.
    const toggle = within(panel()).getByRole("button", { name: `${fresh[1]!.name}: Unter die Bibliothek legen` })
    fireEvent.click(toggle)
    expect(onTapCard).not.toHaveBeenCalled()
    wait()
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(201)
    // A card looked at meanwhile; Forge withdraws its question and asks anew (a new id): for a moment no question - the
    // panel and the card view over it stay; then the mark shows, OK is on.
    fireEvent.click(document.querySelector('[data-start-hand-card="203"]')!)
    expect(screen.getByRole("dialog", { name: fresh[3]!.name! })).toBeInTheDocument()
    rerender({ questions: [] })
    // Under the card view the panel is hidden from the accessibility tree (a modal over it), but there.
    expect(document.querySelector('[data-slot="hand-spread"]')).not.toBeNull()
    expect(screen.getByRole("dialog", { name: fresh[3]!.name! })).toBeInTheDocument()
    const marked = fresh.map((card) => (card.id === 201 ? { ...card, highlighted: true as const } : card))
    rerender({ state: withHand(marked), questions: [bottom(4, true)] })
    escape(screen.getByRole("dialog", { name: fresh[3]!.name! }))
    expect(panel()).toBeInTheDocument()
    expect(within(panel()).getByText("1 ausgewählt")).toBeInTheDocument()
    expect(within(panel()).getByRole("button", { name: `${fresh[1]!.name}: Doch behalten` })).toHaveAttribute("aria-pressed", "true")
    expect(document.querySelector('[data-start-hand-card="201"]')).toHaveAttribute("data-mark", "selected")
    wait()
    fireEvent.click(answerButton("OK"))
    expect(onAnswer).toHaveBeenLastCalledWith(4, { kind: "buttons", button: 1 })
    expect(onAnswer).toHaveBeenCalledTimes(3)
    // The game begins: turn 1, Forge's priority - back to the table.
    rerender({ state: withHand(fresh.slice(0, 6), 1), questions: tableScene("main-phase").questions, prompt: null })
    expect(panelGone()).toBe(true)
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

