/*
 * Operating the cards of the game table (prompt 14) on real recorded states:
 * looking is safe (opening, reading, closing the card view sends nothing),
 * a tap comes only from the card view's button - armed a moment after it
 * appears, never focused by itself - or, in the steps Forge lets the player
 * take back, from the card itself; mouse, keyboard and touch (long press,
 * a swipe that scrolls is no press); the view follows the live state. The
 * hand is a fan (prompt 42): a finger lifts the card under it and a swipe the
 * card under the finger, a tap is the lifted card's, a swipe nothing.
 * The table never sends anything itself: onTapCard is the page's.
 */
import type { GameState, VisibleCard } from "@openmana/engine-protocol"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LONG_PRESS_MS } from "@/hooks/use-card-press"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { ARMING_MS } from "./card-sheet"
import { GameTable, type GameTableProps } from "./game-table"
import { NO_PICTURES } from "./table-cards"

let clock = 10_000
beforeEach(() => {
  clock = 10_000
  vi.spyOn(performance, "now").mockImplementation(() => clock)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** Lets time pass for the arming of the card view (performance.now is the test's clock). */
const wait = (ms: number) => {
  clock += ms
}

function table(name: TableSceneName, overrides: Partial<GameTableProps> = {}) {
  const scene = tableScene(name)
  const onTapCard = vi.fn()
  const props: GameTableProps = {
    state: scene.state,
    questions: scene.questions,
    prompt: scene.prompt,
    waiting: true,
    aiProfile: scene.game.aiProfile,
    pictures: NO_PICTURES,
    menu: <button type="button">Menü</button>,
    onTapCard,
    ...overrides,
  }
  const view = render(<GameTable {...props} />)
  return { scene, onTapCard, rerender: (next: Partial<GameTableProps>) => view.rerender(<GameTable {...props} {...next} />) }
}

const cardButton = (id: number) => document.querySelector<HTMLButtonElement>(`button[data-card="${id}"]`)!
const cardView = () => screen.getByRole("dialog")

describe("marks: Forge's state as a frame around the picture", () => {
  it("usable (Forge's marker), chosen (Forge's highlight), nothing - on the frame, never on the picture", () => {
    table("main-phase")
    expect(cardButton(25)).toHaveAttribute("data-mark", "usable")
    expect(cardButton(25).querySelector('[data-slot="game-card-face"]')).toHaveAttribute("data-mark", "usable")
    expect(cardButton(25)).toHaveAccessibleName("Gebirge, spielbar")
    // A land Forge only names an action for (its mana ability): no mark.
    expect(cardButton(28)).not.toHaveAttribute("data-mark")
  })

  it("chosen: the attacker blockers are assigned to", () => {
    table("defend")
    expect(cardButton(80)).toHaveAttribute("data-mark", "selected")
    expect(cardButton(80)).toHaveAccessibleName(/Blockziel – Antippen: Declare blockers for card$/)
  })
})

describe("looking is safe", () => {
  it("a click on a hand card opens its view: Forge's name, place and offer - and sends nothing", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("main-phase")
    expect(cardButton(25)).toHaveAttribute("aria-haspopup", "dialog")
    await user.click(cardButton(25))
    const view = cardView()
    expect(view).toHaveAccessibleName("Gebirge")
    expect(within(view).getByText("spielbar")).toBeInTheDocument()
    expect(within(view).getByText("Deine Hand")).toBeInTheDocument()
    expect(within(within(view).getByRole("region", { name: "Was Forge anbietet" })).getByText("Forge bietet an: Spiele ein Land.")).toBeInTheDocument()
    // The view takes the focus itself, never its tap button.
    expect(view).toHaveFocus()
    expect(onTapCard).not.toHaveBeenCalled()
    await user.click(within(view).getByRole("button", { name: "Schließen" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
    // Back on the card it came from.
    expect(cardButton(25)).toHaveFocus()
  })

  it("the view's facts are Forge's: type, the pile, its state; the picture's words without a picture", async () => {
    const user = userEvent.setup()
    table("main-phase")
    await user.click(cardButton(28))
    const view = cardView()
    expect(within(view).getByText("Dein Spielfeld")).toBeInTheDocument()
    expect(within(view).getByText("6 liegen hier als Stapel")).toBeInTheDocument()
    expect(within(view).getByText("Kein Kartenbild – Forges Angaben.")).toBeInTheDocument()
    // Forge's action for a card it does not mark: the view's secondary button.
    expect(within(view).getByRole("button", { name: "Aktiviere Fähigkeit" })).toBeEnabled()
  })

  it("a card of the opponent: looked at, with nothing to tap", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("main-phase")
    await user.click(cardButton(77))
    const view = cardView()
    expect(within(view).getByText("Spielfeld der Forge-KI")).toBeInTheDocument()
    expect(within(view).getByText("Mit dieser Karte bietet Forge gerade nichts an.")).toBeInTheDocument()
    expect(within(view).getAllByRole("button").map((button) => button.textContent)).toEqual(["Vorige Karte", "Nächste Karte", "Schließen"])
    expect(onTapCard).not.toHaveBeenCalled()
  })
})

describe("cards Forge reveals from the AI's hand (built: the recordings have none)", () => {
  it("are cards to look at, in a row of their own, each with its place", async () => {
    const user = userEvent.setup()
    const scene = tableScene("main-phase")
    const me = scene.state.players.find((player) => player.me)!
    const revealed = me.zones.hand.find((card): card is VisibleCard => !("hidden" in card))!
    const state = {
      ...scene.state,
      players: scene.state.players.map((player) =>
        player.me ? player : { ...player, zones: { ...player.zones, hand: [{ ...revealed, id: 9001, owner: player.id, controller: player.id }, ...player.zones.hand.slice(1)] } },
      ) as GameState["players"],
    }
    const { onTapCard } = table("main-phase", { state })
    const row = screen.getByRole("toolbar", { name: /^Hand der Forge-KI:/ })
    expect(within(row).getAllByRole("button")).toHaveLength(1)
    await user.click(cardButton(9001))
    expect(within(cardView()).getByText("Hand der Forge-KI (aufgedeckt)")).toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
  })
})

describe("tapping from the card view", () => {
  it("the button carries Forge's words and taps only after it was armed: the second press of a double click is lost", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("main-phase")
    await user.click(cardButton(25))
    const tap = within(cardView()).getByRole("button", { name: "Spiele ein Land" })
    await user.click(tap)
    expect(onTapCard).not.toHaveBeenCalled()
    wait(ARMING_MS)
    await user.click(tap)
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(25)
    // The view closes: the tap is on its way.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("a pile is tapped through its first card (Anvil)", async () => {
    const user = userEvent.setup()
    const { onTapCard, scene } = table("main-phase")
    await user.click(cardButton(28))
    wait(ARMING_MS)
    await user.click(within(cardView()).getByRole("button", { name: "Aktiviere Fähigkeit" }))
    const me = scene.state.players.find((player) => player.me)!
    const lands = me.zones.battlefield.filter((card): card is VisibleCard => !("hidden" in card) && card.name === "Gebirge")
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(lands[0]!.id)
  })

  it("while Forge computes, the button is off and says why; the card is still looked at", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("main-phase", { waiting: false })
    await user.click(cardButton(25))
    const tap = within(cardView()).getByRole("button", { name: "Spiele ein Land" })
    expect(tap).toBeDisabled()
    expect(tap).toHaveAccessibleDescription("Forge rechnet gerade.")
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("a held key repeats nothing on the button", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("main-phase")
    await user.click(cardButton(25))
    wait(ARMING_MS)
    const tap = within(cardView()).getByRole("button", { name: "Spiele ein Land" })
    // A repeated keydown (a held Enter) is dropped before the button acts on it.
    const repeated = fireEvent.keyDown(tap, { key: "Enter", repeat: true })
    expect(repeated).toBe(false)
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("the view follows the live state: a card that leaves says so, and offers no tap", async () => {
    const user = userEvent.setup()
    const { scene, rerender } = table("main-phase")
    await user.click(cardButton(25))
    const state: GameState = {
      ...scene.state,
      players: scene.state.players.map((player) =>
        player.me ? { ...player, zones: { ...player.zones, hand: player.zones.hand.filter((card) => "hidden" in card || card.id !== 25) } } : player,
      ) as GameState["players"],
    }
    rerender({ state })
    const view = cardView()
    expect(within(view).getByRole("heading", { name: "Karte nicht mehr zu sehen" })).toBeInTheDocument()
    expect(within(view).getAllByRole("button").map((button) => button.textContent)).toEqual(["Schließen"])
  })

  it("only looked at (a replay, no page to send taps): Forge's offer named, no button", async () => {
    const user = userEvent.setup()
    const scene = tableScene("main-phase")
    render(<GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile="Default" pictures={NO_PICTURES} menu={null} />)
    await user.click(cardButton(25))
    const view = cardView()
    expect(within(view).getByText("Forge bot an: Spiele ein Land.")).toBeInTheDocument()
    expect(within(view).queryByRole("button", { name: "Spiele ein Land" })).not.toBeInTheDocument()
  })
})

describe("steps whose taps act at once (blocking, attacking, paying)", () => {
  it("a click taps at once - once for a double click - and opens no view", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("defend")
    expect(cardButton(58)).not.toHaveAttribute("aria-haspopup")
    await user.dblClick(cardButton(58))
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(58)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    // A tap later is a new one (Forge takes the first back).
    wait(ARMING_MS)
    await user.click(cardButton(58))
    expect(onTapCard).toHaveBeenCalledTimes(2)
  })

  it("a right click (the context menu) looks instead; the browser's menu stays shut", async () => {
    const { onTapCard } = table("defend")
    const opened = fireEvent.contextMenu(cardButton(58))
    expect(opened).toBe(false)
    expect(cardView()).toBeInTheDocument()
    expect(within(cardView()).getByText("In diesem Schritt wirkt ein Tipp auf die Karte sofort. Forges Worte sagen, was ein weiterer Tipp tut; Forges Knopf bestätigt den Schritt.")).toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("a long press looks, the click after it is swallowed", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { onTapCard } = table("defend")
    const card = cardButton(58)
    fireEvent.pointerDown(card, { pointerType: "touch", clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(cardView()).toBeInTheDocument()
    fireEvent.pointerUp(card, { pointerType: "touch" })
    fireEvent.click(card)
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("a touch that moves (the row scrolls sideways) is no press: no look, and the browser sends no click", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { onTapCard } = table("defend")
    const card = cardButton(58)
    fireEvent.pointerDown(card, { pointerType: "touch", clientX: 10, clientY: 10 })
    fireEvent.pointerMove(card, { pointerType: "touch", clientX: 40, clientY: 11 })
    fireEvent.pointerCancel(card, { pointerType: "touch" })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("while Forge computes, a click looks instead of tapping", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("defend", { waiting: false })
    await user.click(cardButton(58))
    expect(cardView()).toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
  })
})

describe("the hand as a fan (prompt 42): lifting, tapping, swiping, long press", () => {
  /** The hand's resting places in jsdom (no layout): card i from 40·i px, 100 px wide - card i's own strip is [40·i, 40·i + 40). */
  function restingPlaces() {
    const index = (element: HTMLElement) => (element.parentElement === null ? -1 : [...element.parentElement.children].indexOf(element))
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-hand-card") ? index(this) * 40 : 0
    })
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-hand-card") ? 100 : 0
    })
  }
  const handRow = () => screen.getByRole("toolbar", { name: "Deine Hand: 3 Karten" })
  const lifted = () => [...handRow().querySelectorAll("[data-lifted]")].map((item) => item.getAttribute("data-hand-card"))
  const touch = { pointerType: "touch", pointerId: 1 } as const
  // The scene "discard": Forge asks for a card of the hand (a selection naming them) - a tap acts at once. Cards 24, 56, 47.
  const at = (id: number) => ({ 24: 20, 56: 60, 47: 100 })[id as 24 | 56 | 47]

  it("a finger lifts the card whose resting place lies under it; swiping lifts the card under the finger; releasing after the swipe does nothing", () => {
    restingPlaces()
    const { onTapCard } = table("discard")
    fireEvent.pointerDown(cardButton(24), { ...touch, clientX: at(24), clientY: 10 })
    expect(lifted()).toEqual(["24"])
    // The finger moves on (the implicit capture keeps the events on the first card): the card under it rises.
    fireEvent.pointerMove(cardButton(24), { ...touch, clientX: at(56), clientY: 12 })
    expect(lifted()).toEqual(["56"])
    fireEvent.pointerMove(cardButton(24), { ...touch, clientX: at(47), clientY: 12 })
    expect(lifted()).toEqual(["47"])
    fireEvent.pointerUp(cardButton(24), touch)
    expect(lifted()).toEqual([])
    // The click a browser may still send after the swipe: swallowed.
    fireEvent.click(cardButton(47))
    expect(onTapCard).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("a tap without moving is the lifted card's primary activation - the card under the finger, wherever the click lands - and counts once", () => {
    restingPlaces()
    const { onTapCard } = table("discard")
    // Laid on card 56's own strip, though the event's target is card 24's button (its covered part).
    fireEvent.pointerDown(cardButton(24), { ...touch, clientX: at(56), clientY: 10 })
    expect(lifted()).toEqual(["56"])
    fireEvent.pointerMove(cardButton(24), { ...touch, clientX: at(56) + 4, clientY: 13 })
    fireEvent.pointerUp(cardButton(24), touch)
    fireEvent.click(cardButton(24))
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(56)
    // A double tap's second one: the double-tap guard of the table counts it once.
    fireEvent.pointerDown(cardButton(56), { ...touch, clientX: at(56), clientY: 10 })
    fireEvent.pointerUp(cardButton(56), touch)
    fireEvent.click(cardButton(56))
    expect(onTapCard).toHaveBeenCalledTimes(1)
  })

  it("a long press without a swipe looks at the lifted card - once, also with the browser's contextmenu -; the click after it is swallowed", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    restingPlaces()
    const { onTapCard } = table("discard")
    fireEvent.pointerDown(cardButton(24), { ...touch, clientX: at(47), clientY: 10 })
    // Chrome on Android sends its contextmenu for a long press (on whatever lies under the finger).
    const opened = fireEvent.contextMenu(cardButton(24))
    expect(opened).toBe(false)
    expect(cardView()).toHaveAccessibleName("Shock")
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    fireEvent.pointerUp(cardButton(24), touch)
    fireEvent.click(cardButton(24))
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("the long press's timer alone (no contextmenu, iOS) looks too; a swipe held still does nothing", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    restingPlaces()
    const { onTapCard } = table("discard")
    fireEvent.pointerDown(cardButton(56), { ...touch, clientX: at(56), clientY: 10 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(cardView()).toHaveAccessibleName("Goblin Arsonist")
    fireEvent.pointerUp(cardButton(56), touch)
    fireEvent.click(cardButton(56))
    fireEvent.keyDown(cardView(), { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    // Swipe, then hold still: neither a look nor a tap.
    fireEvent.pointerDown(cardButton(24), { ...touch, clientX: at(24), clientY: 10 })
    fireEvent.pointerMove(cardButton(24), { ...touch, clientX: at(47), clientY: 10 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2))
    fireEvent.pointerUp(cardButton(24), touch)
    fireEvent.click(cardButton(24))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("the mouse lifts the card it is over (kept while over the lifted card), leaving the hand drops it; its click is that card's", async () => {
    restingPlaces()
    const user = userEvent.setup()
    const { onTapCard } = table("discard")
    fireEvent.pointerMove(cardButton(47), { pointerType: "mouse", clientX: at(47), clientY: 10 })
    expect(lifted()).toEqual(["47"])
    // Over the lifted card, which now covers its neighbour's strip: it stays.
    fireEvent.pointerMove(cardButton(47), { pointerType: "mouse", clientX: at(56), clientY: 10 })
    expect(lifted()).toEqual(["47"])
    // Over another card: by the resting places.
    fireEvent.pointerMove(cardButton(24), { pointerType: "mouse", clientX: at(24), clientY: 10 })
    expect(lifted()).toEqual(["24"])
    fireEvent.pointerLeave(handRow(), { pointerType: "mouse" })
    expect(lifted()).toEqual([])
    await user.click(cardButton(47))
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(47)
  })

  it("a new hand starts with nothing lifted; only looked at (a replay), a tap on the hand looks", () => {
    restingPlaces()
    const scene = tableScene("discard")
    const { rerender } = table("discard")
    fireEvent.pointerMove(cardButton(56), { pointerType: "mouse", clientX: at(56), clientY: 10 })
    expect(lifted()).toEqual(["56"])
    const state: GameState = {
      ...scene.state,
      players: scene.state.players.map((player) => (player.me ? { ...player, zones: { ...player.zones, hand: player.zones.hand.filter((card) => "hidden" in card || card.id !== 24) } } : player)) as GameState["players"],
    }
    rerender({ state })
    expect(screen.getByRole("toolbar", { name: "Deine Hand: 2 Karten" }).querySelectorAll("[data-lifted]")).toHaveLength(0)
    cleanup()
    render(<GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile="Default" pictures={NO_PICTURES} menu={null} />)
    fireEvent.pointerDown(cardButton(47), { ...touch, clientX: at(47), clientY: 10 })
    fireEvent.pointerUp(cardButton(47), touch)
    fireEvent.click(cardButton(47))
    expect(cardView()).toHaveAccessibleName("Shock")
  })
})

describe("keyboard", () => {
  it("one stop per row for Tab; the arrow keys, Home and End move between its cards; Enter looks", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("opening")
    const hand = screen.getByRole("toolbar", { name: "Deine Hand: 7 Karten" })
    const cards = within(hand).getAllByRole("button")
    act(() => cards[0]!.focus())
    // Radix moves the focus a tick after the key (outside React's batching).
    await user.keyboard("{ArrowRight}")
    await waitFor(() => expect(cards[1]).toHaveFocus())
    await user.keyboard("{End}")
    await waitFor(() => expect(cards[6]).toHaveFocus())
    await user.keyboard("{Home}")
    await waitFor(() => expect(cards[0]).toHaveFocus())
    // Only the card last visited is in the Tab order.
    expect(cards.filter((card) => card.tabIndex === 0)).toEqual([cards[0]])
    await user.keyboard("{Enter}")
    expect(cardView()).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(cards[0]).toHaveFocus()
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("the context-menu key (Shift+F10) looks at a card that would tap at once", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("defend")
    act(() => cardButton(58).focus())
    // Browsers turn Shift+F10 and the context-menu key into a contextmenu event on the focused element.
    fireEvent.contextMenu(document.activeElement!)
    expect(cardView()).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(onTapCard).not.toHaveBeenCalled()
  })
})
