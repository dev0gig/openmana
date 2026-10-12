/*
 * Operating the cards of the game table (prompt 14) on real recorded states:
 * looking is safe (opening, reading, closing the card view sends nothing),
 * a tap comes only from the card view's button - armed a moment after it
 * appears, never focused by itself - or, in the steps Forge lets the player
 * take back, from the card itself; mouse, keyboard and touch (long press,
 * a swipe that scrolls is no press); the view follows the live state. The
 * hand is a fan (prompt 42): a finger lifts the card under it and a swipe the
 * card under the finger, a tap is the lifted card's, a swipe nothing.
 * Dragging a hand card onto the battlefield (prompt 46) plays it - one tap,
 * where Forge marks it playable and a tap can be sent - and does nothing else.
 * The table never sends anything itself: onTapCard is the page's.
 */
import type { GameState, VisibleCard } from "@openmana/engine-protocol"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LONG_PRESS_MS } from "@/hooks/use-card-press"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { ARMING_MS } from "./card-view"
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
    // Full screen since prompt 47: the card itself is what one reads; Forge's facts stay in the view's description.
    expect(view).toHaveAccessibleDescription(expect.stringContaining("Deine Hand · spielbar."))
    expect(within(within(view).getByRole("region", { name: "Was Forge anbietet" })).getByText("Forge bietet an: Spiele ein Land.")).toBeInTheDocument()
    expect(view).toHaveAccessibleDescription(expect.stringContaining("Forge bietet an: Spiele ein Land."))
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
    expect(view).toHaveAccessibleDescription(expect.stringContaining("Dein Spielfeld."))
    expect(view).toHaveAccessibleDescription(expect.stringContaining("Gleiche Karten: 6 liegen hier als Stapel."))
    expect(within(view).getByText("Kein Kartenbild – Forges Angaben.")).toBeInTheDocument()
    // Forge's action for a card it does not mark: the view's secondary button.
    expect(within(view).getByRole("button", { name: "Aktiviere Fähigkeit" })).toBeEnabled()
  })

  it("a card of the opponent: looked at, with nothing to tap", async () => {
    const user = userEvent.setup()
    const { onTapCard } = table("main-phase")
    await user.click(cardButton(77))
    const view = cardView()
    expect(view).toHaveAccessibleDescription(expect.stringContaining("Spielfeld der Forge-KI."))
    expect(view).toHaveAccessibleDescription(expect.stringContaining("Mit dieser Karte bietet Forge gerade nichts an."))
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
    expect(cardView()).toHaveAccessibleDescription(expect.stringContaining("Hand der Forge-KI (aufgedeckt)"))
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

describe("dragging a hand card onto the battlefield (prompt 46)", () => {
  /**
   * The table's layout in jsdom (none of its own): the board 400 × 800 px, the AI's battlefield 100-300, the middle
   * 300-340, your battlefield 340-560, your strip 560-600, the hand 600-700, the decision below; the hand's cards side by
   * side, card i's resting place from 40·i px.
   */
  function layout() {
    const rows: Record<string, readonly [number, number]> = { header: [0, 40], opponent: [40, 100], "opponent-field": [100, 300], center: [300, 340], field: [340, 560], me: [560, 600], hand: [600, 700], decision: [700, 800] }
    const box = (top: number, bottom: number) => ({ x: 0, y: top, left: 0, top, right: 400, bottom, width: 400, height: bottom - top, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.getAttribute("data-slot") === "game-board") return box(0, 800)
      const area = this.getAttribute("data-slot") === "game-board-area" ? this.getAttribute("data-area") : null
      const row = area === null ? undefined : rows[area]
      return row === undefined ? box(0, 0) : box(row[0], row[1])
    })
    const index = (element: HTMLElement) => (element.parentElement === null ? -1 : [...element.parentElement.children].indexOf(element))
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-hand-card") ? index(this) * 40 : 0
    })
  }
  const board = () => document.querySelector<HTMLElement>('[data-slot="game-board"]')!
  const item = (id: number) => document.querySelector<HTMLElement>(`[data-hand-card="${id}"]`)!
  /** The middle of card `id`'s resting place, low in the hand. */
  const rest = (id: number) => ({ clientX: index(id) * 40 + 20, clientY: 680 })
  const index = (id: number) => [...item(id).parentElement!.children].indexOf(item(id))
  const touch = { pointerType: "touch", pointerId: 1 } as const
  /** A finger on card `id`, up out of the hand, over to `to` (y), released there (or not: `release` false). */
  function dragTo(id: number, y: number, { release = true, pointerId = 1 }: { release?: boolean; pointerId?: number } = {}) {
    const start = rest(id)
    const finger = { ...touch, pointerId }
    fireEvent.pointerDown(cardButton(id), { ...finger, ...start })
    fireEvent.pointerMove(cardButton(id), { ...finger, clientX: start.clientX, clientY: start.clientY - 40 })
    fireEvent.pointerMove(cardButton(id), { ...finger, clientX: 200, clientY: y })
    if (!release) return
    fireEvent.pointerUp(cardButton(id), { ...finger, clientX: 200, clientY: y })
    fireEvent.click(cardButton(id))
  }
  const ghost = () => document.querySelector('[data-slot="table-motion"] .table-hand-drag')

  it("a playable land dropped on your battlefield: the battlefields glow while it is over them, exactly one tap - no view", () => {
    layout()
    const { onTapCard } = table("main-phase")
    dragTo(25, 450, { release: false })
    // The picture follows the finger: a copy without ids, slots or names; the card itself stays in the hand, faint.
    expect(ghost()).not.toBeNull()
    expect(ghost()!.querySelector("[data-card], [data-slot], [id], [aria-label]")).toBeNull()
    expect(ghost()!.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(item(25)).toHaveAttribute("data-dragging")
    expect(board()).toHaveAttribute("data-hand-drop", "over")
    // Back over your strip (not the battlefield): no glow.
    fireEvent.pointerMove(cardButton(25), { ...touch, clientX: 200, clientY: 580 })
    expect(board()).not.toHaveAttribute("data-hand-drop")
    fireEvent.pointerMove(cardButton(25), { ...touch, clientX: 200, clientY: 450 })
    expect(board()).toHaveAttribute("data-hand-drop", "over")
    fireEvent.pointerUp(cardButton(25), { ...touch, clientX: 200, clientY: 450 })
    fireEvent.click(cardButton(25))
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(25)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    // Under jsdom (no animations) the picture is gone at once, and the board is quiet again.
    expect(ghost()).toBeNull()
    expect(board()).not.toHaveAttribute("data-hand-drag")
    expect(board()).not.toHaveAttribute("data-hand-drop")
  })

  it("the AI's battlefield and the middle take the card too; a second drop right after it counts once (the double-tap guard)", () => {
    layout()
    const { onTapCard } = table("main-phase")
    dragTo(25, 150)
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(25)
    dragTo(25, 320)
    expect(onTapCard).toHaveBeenCalledTimes(1)
    wait(ARMING_MS)
    dragTo(25, 320)
    expect(onTapCard).toHaveBeenCalledTimes(2)
  })

  it("a spell (an instant at the AI's spell): one tap - Forge asks for its target afterwards, as when tapped", () => {
    layout()
    const { onTapCard } = table("respond")
    dragTo(29, 200)
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(29)
  })

  it("let go in the hand, over your strip or the decision: it goes back, nothing is sent", () => {
    layout()
    const { onTapCard } = table("main-phase")
    for (const y of [650, 580, 750]) {
      dragTo(25, y)
      expect(item(25)).not.toHaveAttribute("data-dragging")
      expect(ghost()).toBeNull()
    }
    expect(onTapCard).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("a card Forge does not mark playable: lifted and dragged, no glow, nothing sent - and no words made up", () => {
    layout()
    const { onTapCard } = table("opening")
    dragTo(55, 450, { release: false })
    expect(ghost()).not.toBeNull()
    expect(board()).not.toHaveAttribute("data-hand-drop")
    fireEvent.pointerUp(cardButton(55), { ...touch, clientX: 200, clientY: 450 })
    expect(onTapCard).not.toHaveBeenCalled()
    expect(toast.getToasts()).toHaveLength(0)
  })

  it("while a concession is on its way, Forge computes or a blocking question waits: nothing is sent, the table's reason shows", () => {
    layout()
    const { onTapCard, rerender } = table("main-phase", { conceding: true })
    dragTo(25, 450, { release: false })
    expect(board()).not.toHaveAttribute("data-hand-drop")
    fireEvent.pointerUp(cardButton(25), { ...touch, clientX: 200, clientY: 450 })
    expect(toast.getToasts().map((shown) => ("title" in shown ? shown.title : null))).toEqual(["Die Aufgabe ist unterwegs."])
    rerender({ conceding: false, waiting: false })
    dragTo(25, 450)
    expect(onTapCard).not.toHaveBeenCalled()
    cleanup()
    const ability = table("ability")
    dragTo(54, 450)
    expect(ability.onTapCard).not.toHaveBeenCalled()
  })

  it("in a step whose taps choose (a selection naming the hand's cards): a drop plays nothing", () => {
    layout()
    const { onTapCard } = table("discard")
    dragTo(56, 450)
    expect(onTapCard).not.toHaveBeenCalled()
  })

  it("Escape, a second finger or pointercancel take the card back: nothing is sent", () => {
    layout()
    const { onTapCard } = table("main-phase")
    dragTo(25, 450, { release: false })
    fireEvent.keyDown(window, { key: "Escape" })
    expect(ghost()).toBeNull()
    expect(board()).not.toHaveAttribute("data-hand-drop")
    fireEvent.pointerUp(cardButton(25), { ...touch, clientX: 200, clientY: 450 })
    fireEvent.click(cardButton(25))
    dragTo(25, 450, { release: false, pointerId: 2 })
    fireEvent.pointerDown(cardButton(25), { ...touch, pointerId: 3, clientX: 100, clientY: 680 })
    expect(ghost()).toBeNull()
    fireEvent.pointerUp(cardButton(25), { ...touch, pointerId: 2, clientX: 200, clientY: 450 })
    fireEvent.pointerUp(cardButton(25), { ...touch, pointerId: 3, clientX: 100, clientY: 680 })
    fireEvent.click(cardButton(25))
    dragTo(25, 450, { release: false, pointerId: 4 })
    fireEvent.pointerCancel(cardButton(25), { ...touch, pointerId: 4 })
    expect(ghost()).toBeNull()
    expect(onTapCard).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("the mouse: pressed and moved beyond its slop, it drags; dropped on the battlefield, one tap - the click after it opens nothing", () => {
    layout()
    const { onTapCard } = table("main-phase")
    const start = rest(25)
    const mouse = { pointerType: "mouse", pointerId: 1, button: 0, buttons: 1 } as const
    fireEvent.pointerDown(cardButton(25), { ...mouse, ...start })
    fireEvent.pointerMove(cardButton(25), { ...mouse, clientX: 200, clientY: 450 })
    expect(board()).toHaveAttribute("data-hand-drop", "over")
    fireEvent.pointerUp(cardButton(25), { ...mouse, buttons: 0, clientX: 200, clientY: 450 })
    fireEvent.click(cardButton(25))
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(25)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("only looked at (a replay): the hand drags nothing", () => {
    layout()
    const scene = tableScene("main-phase")
    render(<GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile="Default" pictures={NO_PICTURES} menu={null} />)
    dragTo(25, 450, { release: false })
    expect(ghost()).toBeNull()
    expect(board()).not.toHaveAttribute("data-hand-drag")
  })

  it("the card leaves the hand while it is dragged (a new state): its picture goes", () => {
    layout()
    const scene = tableScene("main-phase")
    const { rerender } = table("main-phase")
    dragTo(25, 450, { release: false })
    expect(ghost()).not.toBeNull()
    const state: GameState = { ...scene.state, players: scene.state.players.map((player) => (player.me ? { ...player, zones: { ...player.zones, hand: [] } } : player)) as GameState["players"] }
    rerender({ state })
    expect(ghost()).toBeNull()
    expect(board()).not.toHaveAttribute("data-hand-drag")
  })
})
