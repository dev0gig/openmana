/*
 * The land and refusal hints of the game table (prompt 51) on real moments of
 * the Forge engine (src/test/land-plays.ts: the fixture game `lands`, protocol
 * 10) and recorded scenes (src/test/table-scenes.ts):
 *  - the player's strip says Forge's land plays of this turn ("Länder 1/1"),
 *    in the AI's turn that Forge offers no land, before the first turn nothing;
 *  - the card view says why a card of the hand is not offered - Forge's reason
 *    for a land, else honestly that Forge offers nothing -, follows each state
 *    and every card browsed, and never pops anything up;
 *  - a failed drop says the same reason once, from the moment of the drop;
 *  - a replay and the start questions tell no reason on screen.
 * Nothing here sends anything: onTapCard is the page's.
 */
import type { GameState, Question } from "@openmana/engine-protocol"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { landMoment, type LandMomentName } from "@/test/land-plays"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { ARMING_MS } from "./card-view"
import { GameTable, type GameTableProps } from "./game-table"
import { UNOFFERED_ACTION, UNOFFERED_CARD } from "./land-labels"
import { NO_PICTURES } from "./table-cards"

let clock = 10_000
beforeEach(() => {
  clock = 10_000
  vi.spyOn(performance, "now").mockImplementation(() => clock)
})
afterEach(() => {
  vi.restoreAllMocks()
})

interface Shown {
  readonly state: GameState
  readonly questions: readonly Question[]
}

const fromLands = (name: LandMomentName): Shown => landMoment(name)
const fromScene = (name: TableSceneName): Shown => tableScene(name)

function table(shown: Shown, { replay = false, ...overrides }: Partial<GameTableProps> & { readonly replay?: boolean } = {}) {
  const onTapCard = vi.fn()
  const props: GameTableProps = {
    state: shown.state,
    questions: shown.questions,
    prompt: null,
    waiting: true,
    aiProfile: "Default",
    pictures: NO_PICTURES,
    menu: <button type="button">Menü</button>,
    // A replay: the table without the page's taps (prompt 22).
    ...(replay ? {} : { onTapCard }),
    ...overrides,
  }
  const view = render(<GameTable {...props} />)
  return { onTapCard, show: (next: Shown) => view.rerender(<GameTable {...props} state={next.state} questions={next.questions} />) }
}

const strip = () => document.querySelectorAll('[data-strip-fact="lands"]')
const cardButton = (id: number) => document.querySelector<HTMLButtonElement>(`button[data-card="${id}"]`)!
const dialog = () => screen.getByRole("dialog")
const note = () => document.querySelector('[data-slot="card-view-refusal"]')
const toasts = () => toast.getToasts().map((shown) => ("title" in shown ? shown.title : null))

describe("the player's land plays on the strip", () => {
  it("the player's turn: Forge's count of this turn - 0/1, after the land 1/1 with the sentence why no other", () => {
    const { show } = table(fromLands("first-land"))
    expect(strip()).toHaveLength(1)
    const chip = strip()[0]!
    // On the player's own strip, not the AI's.
    expect(chip.closest('section[aria-label="Du"]')).not.toBeNull()
    expect(chip).toHaveTextContent("Länder 0/1")
    expect(chip).toHaveAttribute("data-lands-turn", "mine")
    expect(chip).not.toHaveAttribute("data-lands-used")
    show(fromLands("land-played"))
    expect(strip()[0]).toHaveAttribute("data-lands-used", "true")
    expect(strip()[0]).toHaveAttribute("title", "In diesem Zug hast du 1 von 1 Land gespielt, die Forge dir erlaubt. Dein Land für diesen Zug ist bereits gespielt.")
    expect(within(strip()[0] as HTMLElement).getByText(/Dein Land für diesen Zug ist bereits gespielt\./)).toHaveClass("sr-only")
    // A new own turn: Forge counts afresh, though a land lies on the battlefield.
    show(fromLands("next-turn"))
    expect(strip()[0]).toHaveTextContent("Länder 0/1")
  })

  it("Exploration (Forge allows two): 1/2, then 2/2", () => {
    const { show } = table(fromLands("extra-allowed"))
    expect(strip()[0]).toHaveTextContent("Länder 1/2")
    show(fromLands("extra-used"))
    expect(strip()[0]).toHaveTextContent("Länder 2/2")
  })

  it("the AI's turn: no numbers, the words that Forge offers no land then; before the first turn nothing", () => {
    const { show } = table(fromLands("opponent-turn"))
    expect(strip()[0]).toHaveTextContent("Kein Land im KI-Zug")
    expect(strip()[0]).toHaveAttribute("data-lands-turn", "opponent")
    show(fromLands("before-start"))
    expect(strip()).toHaveLength(0)
  })

  it("a replay shows the recorded count too (it is the state)", () => {
    table(fromLands("land-played"), { replay: true })
    expect(strip()[0]).toHaveTextContent("Länder 1/1")
  })
})

describe("the card view says why not", () => {
  it("a land after the land of the turn: Forge's reason where its button would be - no button, nothing sent, nothing popping up", () => {
    const { onTapCard } = table(fromLands("land-played"))
    fireEvent.click(cardButton(45))
    expect(dialog()).toHaveAccessibleName("Forest")
    expect(note()).toHaveTextContent("Dein Land für diesen Zug ist bereits gespielt.")
    expect(note()).toHaveAttribute("data-refusal", "limit")
    expect(within(dialog()).queryByRole("button", { name: "play land" })).toBeNull()
    expect(dialog()).toHaveAccessibleDescription(expect.stringContaining("Nicht spielbar: Dein Land für diesen Zug ist bereits gespielt."))
    expect(onTapCard).not.toHaveBeenCalled()
    expect(toasts()).toEqual([])
  })

  it("a card Forge offers nothing for and names no reason for: honestly that", () => {
    table(fromScene("stack"))
    fireEvent.click(cardButton(24))
    expect(note()).toHaveTextContent(UNOFFERED_CARD)
    expect(note()).toHaveAttribute("data-refusal", "unknown")
  })

  it("browsing the hand: the reason of each card, a playable card's button instead - and nothing sent or popping up", () => {
    const { onTapCard } = table(fromLands("land-played"))
    fireEvent.click(cardButton(45))
    expect(note()).toHaveTextContent("Dein Land für diesen Zug ist bereits gespielt.")
    // The hand: Grizzly Bears (5, 6), Forest (45, 48, 42), Llanowar Elves (22, Forge marks it playable).
    fireEvent.keyDown(dialog(), { key: "ArrowRight" })
    expect(dialog()).toHaveAccessibleName("Forest")
    expect(note()).toHaveAttribute("data-refusal", "limit")
    fireEvent.keyDown(dialog(), { key: "ArrowRight" })
    fireEvent.keyDown(dialog(), { key: "ArrowRight" })
    expect(dialog()).toHaveAccessibleName("Llanowar Elves")
    expect(note()).toBeNull()
    expect(within(dialog()).getByRole("button", { name: "cast spell" })).toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
    expect(toasts()).toEqual([])
  })

  it("follows each state: the land played elsewhere turns the offer into Forge's reason; the next turn brings the offer back, armed afresh", () => {
    const { onTapCard, show } = table(fromLands("first-land"))
    fireEvent.click(cardButton(45))
    expect(within(dialog()).getByRole("button", { name: "play land" })).toBeInTheDocument()
    expect(note()).toBeNull()
    show(fromLands("land-played"))
    expect(within(dialog()).queryByRole("button", { name: "play land" })).toBeNull()
    expect(note()).toHaveTextContent("Dein Land für diesen Zug ist bereits gespielt.")
    clock += ARMING_MS * 4
    show(fromLands("next-turn"))
    expect(note()).toBeNull()
    // The button came back: a press right away is dropped (it changed meaning), one after ARMING_MS taps.
    fireEvent.click(within(dialog()).getByRole("button", { name: "play land" }))
    expect(onTapCard).not.toHaveBeenCalled()
    clock += ARMING_MS
    fireEvent.click(within(dialog()).getByRole("button", { name: "play land" }))
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(45)
  })

  it("a replay names Forge's reason only for screen readers and shows nothing to do", () => {
    table(fromLands("land-played"), { replay: true })
    fireEvent.click(cardButton(45))
    expect(note()).toBeNull()
    expect(dialog()).toHaveAccessibleDescription(expect.stringContaining("Forge ließ das Land nicht spielen: Dein Land für diesen Zug ist bereits gespielt."))
  })

  it("before the game begins (the start questions) no reason is told: the opening hand is only looked at", () => {
    table(fromLands("before-start"))
    fireEvent.click(cardButton(37))
    expect(note()).toBeNull()
    expect(dialog()).not.toHaveAccessibleDescription(expect.stringContaining("Länder spielst du nur"))
  })
})

describe("a failed drop says why (prompt 51)", () => {
  /** The table's layout in jsdom (as in card-interaction.test.tsx): your battlefield 340-560, the hand 600-700; card i's resting place from 40·i px. */
  function layout() {
    const rows: Record<string, readonly [number, number]> = { header: [0, 40], opponent: [40, 100], "opponent-field": [100, 300], center: [300, 340], field: [340, 560], me: [560, 600], hand: [600, 700], decision: [700, 800] }
    const box = (top: number, bottom: number) => ({ x: 0, y: top, left: 0, top, right: 400, bottom, width: 400, height: bottom - top, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.getAttribute("data-slot") === "game-board") return box(0, 800)
      const area = this.getAttribute("data-slot") === "game-board-area" ? this.getAttribute("data-area") : null
      const row = area === null ? undefined : rows[area]
      return row === undefined ? box(0, 0) : box(row[0], row[1])
    })
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-hand-card") && this.parentElement !== null ? [...this.parentElement.children].indexOf(this) * 40 : 0
    })
  }
  const board = () => document.querySelector<HTMLElement>('[data-slot="game-board"]')!
  const item = (id: number) => document.querySelector<HTMLElement>(`[data-hand-card="${id}"]`)!
  const rest = (id: number) => ({ clientX: [...item(id).parentElement!.children].indexOf(item(id)) * 40 + 20, clientY: 680 })
  const touch = { pointerType: "touch", pointerId: 1 } as const
  const lift = (id: number) => {
    const start = rest(id)
    fireEvent.pointerDown(cardButton(id), { ...touch, ...start })
    fireEvent.pointerMove(cardButton(id), { ...touch, clientX: start.clientX, clientY: start.clientY - 40 })
    fireEvent.pointerMove(cardButton(id), { ...touch, clientX: 200, clientY: 450 })
  }
  const release = (id: number) => {
    fireEvent.pointerUp(cardButton(id), { ...touch, clientX: 200, clientY: 450 })
    fireEvent.click(cardButton(id))
  }

  it("the second land of the turn: no glow, nothing sent, Forge's reason once - a second drop replaces it", () => {
    layout()
    const { onTapCard } = table(fromLands("land-played"))
    lift(45)
    expect(board()).not.toHaveAttribute("data-hand-drop")
    release(45)
    expect(onTapCard).not.toHaveBeenCalled()
    expect(toasts()).toEqual(["Dein Land für diesen Zug ist bereits gespielt."])
    lift(48)
    release(48)
    expect(toasts()).toEqual(["Dein Land für diesen Zug ist bereits gespielt."])
  })

  it("a card Forge offers nothing for: honestly that", () => {
    layout()
    const { onTapCard } = table(fromLands("first-land"))
    lift(5)
    release(5)
    expect(onTapCard).not.toHaveBeenCalled()
    expect(toasts()).toEqual([UNOFFERED_ACTION])
  })

  it("swiping over the hand, lifting and putting back: nothing pops up", () => {
    layout()
    table(fromLands("land-played"))
    fireEvent.pointerDown(cardButton(45), { ...touch, ...rest(45) })
    fireEvent.pointerMove(cardButton(45), { ...touch, clientX: rest(22).clientX, clientY: 682 })
    fireEvent.pointerUp(cardButton(45), { ...touch, clientX: rest(22).clientX, clientY: 682 })
    lift(45)
    // Back over the hand: cancelled.
    fireEvent.pointerMove(cardButton(45), { ...touch, clientX: 200, clientY: 650 })
    fireEvent.pointerUp(cardButton(45), { ...touch, clientX: 200, clientY: 650 })
    expect(toasts()).toEqual([])
  })

  it("a new state while dragging: a land allowed when the drag began, refused when dropped - nothing sent, today's reason", () => {
    layout()
    const { onTapCard, show } = table(fromLands("first-land"))
    lift(45)
    expect(board()).toHaveAttribute("data-hand-drop", "over")
    // Forge's next state: a land was played meanwhile (1/1) - the glow goes with the next move.
    show(fromLands("land-played"))
    fireEvent.pointerMove(cardButton(45), { ...touch, clientX: 210, clientY: 450 })
    expect(board()).not.toHaveAttribute("data-hand-drop")
    release(45)
    expect(onTapCard).not.toHaveBeenCalled()
    expect(toasts()).toEqual(["Dein Land für diesen Zug ist bereits gespielt."])
  })

  it("and the other way round: refused when the drag began, allowed when dropped - played once, no old reason", () => {
    layout()
    const { onTapCard, show } = table(fromLands("land-played"))
    lift(45)
    expect(board()).not.toHaveAttribute("data-hand-drop")
    show(fromLands("next-turn"))
    fireEvent.pointerMove(cardButton(45), { ...touch, clientX: 210, clientY: 450 })
    expect(board()).toHaveAttribute("data-hand-drop", "over")
    release(45)
    expect(onTapCard).toHaveBeenCalledExactlyOnceWith(45)
    expect(toasts()).toEqual([])
  })
})
