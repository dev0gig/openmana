/* The zone view (zone-sheet.tsx) on real recorded scenes plus labelled built boundaries: switcher, grid, groups, marks, browsing. */
import type { GameState, VisibleCard } from "@openmana/engine-protocol"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { GameTable, type GameTableProps } from "./game-table"
import { NO_PICTURES } from "./table-cards"
import { cardName } from "./table-labels"
import { isVisible } from "./table-model"

function table(name: TableSceneName, state?: GameState) {
  const s = tableScene(name)
  const tap = vi.fn()
  const props: GameTableProps = { state: state ?? s.state, questions: s.questions, prompt: s.prompt, waiting: true, pictures: NO_PICTURES, aiProfile: s.game.aiProfile, menu: <button>Menü</button>, onTapCard: tap }
  const r = render(<GameTable {...props} />)
  return { ...r, props, tap }
}
const sheet = () => screen.getByRole("dialog")
const open = () => fireEvent.click(screen.getByRole("button", { name: "Zonen ansehen" }))
const radio = (name: string) => within(sheet()).getByRole("radio", { name })
const tiles = () => within(within(sheet()).getByRole("list")).getAllByRole("button")
const visibleGraveyard = (state: GameState) => state.players.find((p) => p.me)!.zones.graveyard.filter(isVisible)

/** The recorded state with the player's graveyard changed (built). */
function built(change: (graveyard: GameState["players"][number]["zones"]["graveyard"]) => void): GameState {
  const state = structuredClone(tableScene("main-phase").state)
  change(state.players.find((p) => p.me)!.zones.graveyard)
  return state
}

describe("zone view switcher", () => {
  it("chooses player and zone in two groups whose names say player, zone and count", async () => {
    table("main-phase")
    const trigger = screen.getByRole("button", { name: "Zonen ansehen" })
    trigger.focus(); open()
    expect(sheet()).toHaveAccessibleName("Dein Friedhof")
    expect(sheet()).toHaveAccessibleDescription(expect.stringContaining("6 Karten"))
    expect(within(sheet()).getByRole("radiogroup", { name: "Wessen Zonen" })).toBeInTheDocument()
    expect(within(sheet()).getByRole("radiogroup", { name: "Welche Zone" })).toBeInTheDocument()
    expect(radio("Du")).toHaveAttribute("aria-checked", "true")
    expect(radio("Dein Friedhof: 6 Karten")).toHaveAttribute("aria-checked", "true")
    // Empty zones stay reachable (muted, not disabled).
    expect(radio("Dein Exil: 0 Karten")).toBeEnabled()
    expect(radio("Dein Exil: 0 Karten")).toHaveAttribute("data-empty", "true")
    fireEvent.click(radio("Forge-KI"))
    expect(sheet()).toHaveAccessibleName("Friedhof der Forge-KI")
    expect(radio("Friedhof der Forge-KI: 2 Karten")).toHaveAttribute("aria-checked", "true")
    expect(tiles()).toHaveLength(2)
    // The stack belongs to nobody: no player is pressed; a player goes back to the zone shown last.
    fireEvent.click(radio("Stapel, gemeinsam: 0 Einträge"))
    expect(sheet()).toHaveAccessibleName("Karten auf dem Stapel")
    expect(radio("Du")).toHaveAttribute("aria-checked", "false")
    expect(radio("Forge-KI")).toHaveAttribute("aria-checked", "false")
    expect(radio("Friedhof der Forge-KI: 2 Karten")).toHaveAttribute("aria-checked", "false")
    fireEvent.click(radio("Du"))
    expect(sheet()).toHaveAccessibleName("Dein Friedhof")
    // Pressing the pressed one again changes nothing (Radix would empty the group).
    fireEvent.click(radio("Dein Friedhof: 6 Karten"))
    expect(sheet()).toHaveAccessibleName("Dein Friedhof")
    fireEvent.click(within(sheet()).getByRole("button", { name: "Schließen" }))
    await vi.waitFor(() => expect(trigger).toHaveFocus())
  })
})

describe("zone view grid", () => {
  it("shows whole cards newest first, the newest marked, with a calm header", () => {
    const { tap } = table("main-phase")
    open()
    const cards = visibleGraveyard(tableScene("main-phase").state).reverse()
    expect(tiles().map((t) => Number(t.dataset["card"]))).toEqual(cards.map((c) => c.id))
    expect(tiles()[0]).toHaveAttribute("data-latest", "true")
    expect(tiles()[0]).toHaveTextContent("zuletzt")
    expect(tiles()[0]).toHaveAccessibleName(expect.stringContaining("zuletzt hinzugekommen"))
    expect(tiles().slice(1).every((t) => !t.hasAttribute("data-latest"))).toBe(true)
    // Without catalog pictures the card's text stands in, never an empty box.
    expect(within(tiles()[0]!).getByText(cardName(cards[0]!), { selector: '[data-slot="card-picture-fallback"] *' })).toBeInTheDocument()
    expect(sheet()).not.toHaveTextContent("Eine Karte öffnen")
    expect(tap).not.toHaveBeenCalled()
  })

  it("groups identical cards as the table groups its piles (built copies)", () => {
    const state = built((graveyard) => { const newest = graveyard.at(-1) as VisibleCard; graveyard.push({ ...newest, id: 901 }, { ...newest, id: 902 }) })
    table("main-phase", state)
    open()
    const group = tiles()[0]!
    expect(group).toHaveAttribute("data-count", "3")
    expect(group).toHaveTextContent("×3")
    expect(group).toHaveAccessibleName(expect.stringContaining("3 Karten"))
    expect(tiles()).toHaveLength(visibleGraveyard(state).length - 2)
    // Its cards are browsed one after another in the card view.
    fireEvent.click(group)
    expect(screen.getAllByRole("dialog").at(-1)!.querySelector('[data-slot="card-view-position"]')).toHaveTextContent("1 von 8")
  })

  it("an empty zone shows the Empty state, hidden cards stay a count (built)", () => {
    table("opening")
    open()
    const empty = sheet().querySelector('[data-slot="zone-empty"]')
    expect(empty).not.toBeNull()
    expect(empty).toHaveTextContent("Keine Karten")
    expect(within(sheet()).queryByRole("list")).toBeNull()
  })

  it("hidden cards are a note, never a tile (built)", () => {
    table("main-phase", built((graveyard) => { graveyard.splice(0, graveyard.length, { hidden: true }, { hidden: true }) }))
    open()
    expect(sheet()).toHaveTextContent("2 verdeckte Karten – Forge gibt ihre Identität nicht frei.")
    expect(within(sheet()).queryByRole("list")).toBeNull()
    expect(sheet().querySelector('[data-slot="zone-empty"]')).toBeNull()
  })

  it("a card Forge offers gets the gold frame around its picture and the offer in its name and title (built)", () => {
    const state = built((graveyard) => { const first = graveyard[0] as VisibleCard; graveyard[0] = { ...first, playable: true, action: "Rückblende" } })
    const { tap } = table("main-phase", state)
    open()
    const offered = tiles().find((t) => t.dataset["card"] === String((visibleGraveyard(state)[0]!).id))!
    expect(offered).toHaveAttribute("data-mark", "usable")
    expect(offered.querySelector('[data-slot="card-tile-face"]')).toHaveAttribute("data-mark", "usable")
    expect(offered).toHaveAccessibleName(expect.stringContaining("Forge bietet an: Rückblende"))
    expect(offered).toHaveAttribute("title", expect.stringContaining("Forge bietet an: Rückblende"))
    // No separate text line any more.
    expect(offered).not.toHaveTextContent("Forge bietet an")
    expect(tiles().filter((t) => t.hasAttribute("data-mark"))).toHaveLength(1)
    fireEvent.click(offered)
    expect(tap).not.toHaveBeenCalled()
  })
})

describe("browsing a zone in the card view", () => {
  it("goes next and previous through the zone in the grid's order by buttons and arrow keys", () => {
    const { tap } = table("main-phase")
    open()
    const cards = visibleGraveyard(tableScene("main-phase").state).reverse()
    fireEvent.click(tiles()[0]!)
    const view = () => screen.getAllByRole("dialog").at(-1)!
    expect(view()).toHaveAccessibleName(cardName(cards[0]!))
    expect(view().querySelector('[data-slot="card-view-position"]')).toHaveTextContent(`1 von ${cards.length}`)
    expect(within(view()).getByRole("button", { name: "Vorige Karte" })).toBeDisabled()
    fireEvent.click(within(view()).getByRole("button", { name: "Nächste Karte" }))
    expect(view()).toHaveAccessibleName(cardName(cards[1]!))
    fireEvent.keyDown(view(), { key: "ArrowRight" })
    expect(view()).toHaveAccessibleName(cardName(cards[2]!))
    fireEvent.keyDown(view(), { key: "ArrowLeft" })
    fireEvent.keyDown(view(), { key: "ArrowLeft" })
    expect(view()).toHaveAccessibleName(cardName(cards[0]!))
    expect(within(view()).getByRole("group", { name: "Karten durchsehen" })).toBeInTheDocument()
    expect(tap).not.toHaveBeenCalled()
  })
})
