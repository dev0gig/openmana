/* Recorded Forge cards; explicitly built logs exercise presentation and live identity boundaries. */
import type { GameEvent } from "@openmana/engine-protocol"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { tableScene } from "@/test/table-scenes"
import { GameTable, type GameTableProps } from "./game-table"
import { HistorySheet, historySource } from "./history-sheet"
import { NO_PICTURES } from "./table-cards"
import { isVisible } from "./table-model"

const scene = tableScene("main-phase")
const visible = scene.state.players.find((p) => p.me)!.zones.graveyard.filter(isVisible)[0]!
function table(history: readonly GameEvent[]) {
  const tap = vi.fn(); const answer = vi.fn()
  const props: GameTableProps = { state: scene.state, questions: scene.questions, prompt: scene.prompt, waiting: true, aiProfile: scene.game.aiProfile, pictures: NO_PICTURES, menu: <button>Menü</button>, onTapCard: tap, onAnswer: answer, history }
  return { ...render(<GameTable {...props} />), props, tap, answer }
}
const dialog = () => screen.getByRole("dialog")
const open = () => fireEvent.click(screen.getByRole("button", { name: "Spielverlauf ansehen" }))
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
afterEach(() => {
  if (originalScroll === undefined) Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
  else Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll)
})

describe("Forge game history", () => {
  it("has an honest empty state and restores trigger focus", async () => {
    table([])
    const trigger = screen.getByRole("button", { name: "Spielverlauf ansehen" }); trigger.focus(); open()
    expect(dialog()).toHaveTextContent("Forge hat noch keine Ereignisse gemeldet.")
    expect(within(dialog()).queryByRole("list")).toBeNull()
    expect(within(dialog()).getByRole("button", { name: "Neueste Einträge" })).toBeDisabled()
    fireEvent.click(within(dialog()).getByRole("button", { name: "Schließen" }))
    await vi.waitFor(() => expect(trigger).toHaveFocus())
  })

  it("keeps raw Forge text in chronological order and actor identity independent of misleading prose", () => {
    table([{ kind: "LAND", text: "Forge-KI spielt", actor: "me" }, { kind: "LIFE", text: "Du bist betroffen", actor: "opponent" }, { kind: "FUTURE_KIND", text: null }, { kind: "LIFE", text: "" }])
    open()
    const rows = within(dialog()).getAllByRole("listitem")
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent("Du"); expect(rows[0]).toHaveTextContent("Forge-KI spielt")
    expect(rows[1]).toHaveTextContent("Forge-KI"); expect(rows[1]).toHaveTextContent("Du bist betroffen")
    expect(rows[2]).toHaveTextContent("Nicht zugeordnet"); expect(rows[2]).toHaveTextContent("FUTURE_KIND")
    expect(rows[2]).toHaveTextContent("Forge liefert für diesen Eintrag keinen Text.")
  })

  it("inspects the currently resolved source read-only and returns to the log without sending anything", async () => {
    const { tap, answer } = table([{ kind: "LAND", text: "Originaltext", actor: "me", card: visible.id }])
    open()
    const source = within(dialog()).getByRole("button", { name: `${visible.name} ansehen` })
    source.focus(); fireEvent.click(source)
    expect(dialog()).toHaveAccessibleName(visible.name!)
    expect(within(dialog()).queryByRole("button", { name: /Spiele|Aktiviere/ })).toBeNull()
    fireEvent.click(within(dialog()).getByRole("button", { name: "Schließen" }))
    expect(dialog()).toHaveAccessibleName("Spielverlauf")
    await vi.waitFor(() => expect(source).toHaveFocus())
    expect(tap).not.toHaveBeenCalled(); expect(answer).not.toHaveBeenCalled()
  })

  it("does not offer the real playable land's Forge action when opened from history", () => {
    const land = scene.state.players.find((p) => p.me)!.zones.hand.filter(isVisible).find((card) => card.action !== undefined)!
    expect(land.action).toBe("Spiele ein Land")
    const { tap, answer } = table([{ kind: "LAND", text: "Built reference to a currently playable recorded card", card: land.id }])
    open(); fireEvent.click(within(dialog()).getByRole("button", { name: `${land.name} ansehen` }))
    expect(dialog()).toHaveTextContent("Forge bot an: Spiele ein Land.")
    expect(within(dialog()).queryByRole("button", { name: "Spiele ein Land" })).toBeNull()
    expect(tap).not.toHaveBeenCalled(); expect(answer).not.toHaveBeenCalled()
  })

  it("follows a removed/hidden source and never keeps an old card object; existing text remains", () => {
    const history = [{ kind: "LAND", text: "Originaltext", card: visible.id }]
    const { props, rerender } = table(history); open()
    fireEvent.click(within(dialog()).getByRole("button", { name: `${visible.name} ansehen` }))
    const state = structuredClone(props.state)
    state.players.find((p) => p.me)!.zones.graveyard = [{ hidden: true }]
    rerender(<GameTable {...props} state={state} />)
    expect(dialog()).toHaveTextContent("Karte nicht mehr zu sehen")
    fireEvent.click(within(dialog()).getByRole("button", { name: "Schließen" }))
    expect(dialog()).toHaveTextContent("Quellkarte nicht mehr sichtbar.")
    expect(dialog()).toHaveTextContent("Originaltext")
    expect(within(dialog()).queryByRole("button", { name: /ansehen/ })).toBeNull()
  })

  it("inspects a real question-only source and follows withdrawal of that exact question", () => {
    const payment = tableScene("payment")
    const question = payment.questions.find((q) => "cardView" in q && q.cardView !== undefined)!
    if (!("cardView" in question) || question.cardView === undefined) throw new Error("no recorded question card")
    const source = question.cardView
    const history = [{ kind: "STACK_ADD", text: "Built history reference to real recorded payment source", card: source.id }]
    const { props, rerender } = table([])
    rerender(<GameTable {...props} state={payment.state} questions={payment.questions} history={history} />)
    open(); fireEvent.click(within(dialog()).getByRole("button", { name: `${source.name} ansehen` }))
    expect(dialog()).toHaveAccessibleName(source.name!)
    rerender(<GameTable {...props} state={payment.state} questions={[]} history={history} />)
    expect(dialog()).toHaveTextContent("Karte nicht mehr zu sehen")
    expect(historySource(history[0]!, payment.state, [])).toBeNull()
  })

  it("does not guess missing card identities from log text", () => {
    table([{ kind: "STACK_ADD", text: visible.name!, card: -999 }]); open()
    expect(dialog()).toHaveTextContent("Quellkarte nicht mehr sichtbar.")
    expect(within(dialog()).queryByRole("button", { name: /ansehen/ })).toBeNull()
    expect(historySource({ kind: "LIFE", text: visible.name! }, scene.state, [])).toBeNull()
  })

  it("keeps every log entry and appends live batches without forcing scrolling", () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({ kind: "TURN", text: `Eintrag ${i}` }))
    const onLook = vi.fn(); const props = { open: true, onOpenChange: vi.fn(), history: entries, state: scene.state, questions: [], onLook }
    const scroll = vi.fn(); HTMLElement.prototype.scrollIntoView = scroll
    const { rerender } = render(<HistorySheet {...props} />)
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(100)
    rerender(<HistorySheet {...props} history={[...entries, entries[0]!]} />)
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(101)
    expect(scroll).not.toHaveBeenCalled()
    fireEvent.click(within(dialog()).getByRole("button", { name: "Neueste Einträge" }))
    expect(scroll).toHaveBeenCalledOnce()
  })
})
