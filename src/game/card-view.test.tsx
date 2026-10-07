/* Real recorded zones plus labelled built live-state/DFC/hidden boundaries. */
import type { OptionsQuestion, VisibleCard } from "@openmana/engine-protocol"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { ARMING_MS, CardSheet } from "./card-sheet"
import { browseIds, questionCard } from "./card-view-model"
import { GameTable, type GameTableProps } from "./game-table"
import { NO_PICTURES, type TablePicture } from "./table-cards"
import { isVisible, tableView } from "./table-model"

let clock = 10000
beforeEach(() => { clock = 10000; vi.spyOn(performance, "now").mockImplementation(() => clock) })
function table(name: TableSceneName, overrides: Partial<GameTableProps> = {}) {
  const s = tableScene(name)
  const tap = vi.fn()
  const props: GameTableProps = { state: s.state, questions: s.questions, prompt: s.prompt, waiting: true, pictures: NO_PICTURES, aiProfile: s.game.aiProfile, menu: <button>Menü</button>, onTapCard: tap, ...overrides }
  const r = render(<GameTable {...props} />)
  return { ...r, props, tap }
}
function openZone(name: string) {
  if (screen.queryByRole("dialog") === null) fireEvent.click(screen.getByRole("button", { name: "Zonen ansehen" }))
  fireEvent.click(within(dialog()).getByRole("button", { name }))
}
const dialog = () => screen.getByRole("dialog")
const card = (id: number) => document.querySelector<HTMLButtonElement>(`button[data-card="${id}"]`)!

describe("visible zones and current card identities", () => {
  it("opens the real graveyard, browses its current cards and returns focus without tapping", async () => {
    const { tap } = table("main-phase")
    const trigger = screen.getByRole("button", { name: "Zonen ansehen" })
    trigger.focus(); openZone("Dein Friedhof: 6 Karten ansehen")
    const cards = tableScene("main-phase").state.players.find((p) => p.me)!.zones.graveyard.filter(isVisible)
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(cards.length)
    fireEvent.click(within(dialog()).getByRole("button", { name: new RegExp(cards[0]!.name!) }))
    expect(dialog()).toHaveTextContent(cards[0]!.name!)
    fireEvent.click(within(dialog()).getByRole("button", { name: "Nächste Karte" }))
    expect(dialog()).toHaveTextContent(cards[1]!.name!)
    fireEvent.click(within(dialog()).getByRole("button", { name: "Schließen" }))
    expect(dialog()).toHaveAccessibleName("Dein Friedhof")
    expect(tap).not.toHaveBeenCalled()
  })

  it("empty exile stays empty; it opens even while Forge computes", () => {
    table("opening", { waiting: false })
    openZone("Dein Exil: 0 Karten ansehen")
    expect(dialog()).toHaveTextContent("Hier liegen gerade keine Karten.")
    expect(within(dialog()).queryAllByRole("listitem")).toHaveLength(0)
  })

  it("shows actual exile and command/effect cards from the recording", () => {
    const { tap } = table("command-effects")
    openZone("Dein Exil: 1 Karten ansehen")
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(1)
    fireEvent.click(within(dialog()).getByRole("button", { name: "Schließen" }))
    openZone("Deine Kommandozone: 2 Karten ansehen")
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(2)
    expect(tap).not.toHaveBeenCalled()
  })

  it("zone lists follow changes and count hidden cards without names or candidate IDs (built)", () => {
    const { props, rerender } = table("main-phase")
    openZone("Dein Friedhof: 6 Karten ansehen")
    const state = structuredClone(props.state)
    state.players.find((p) => p.me)!.zones.graveyard = [{ hidden: true }]
    rerender(<GameTable {...props} state={state} />)
    expect(dialog()).toHaveTextContent("1 verdeckte Karten")
    expect(within(dialog()).queryAllByRole("listitem")).toHaveLength(0)
    expect(browseIds(state, { kind: "zone", player: 0, zone: "graveyard" })).toEqual([])
  })

  it("browses identical battlefield cards and sends the selected ID only after re-arming (built action)", () => {
    const scene = tableScene("commander-late")
    const state = structuredClone(scene.state)
    const me = state.players.find((p) => p.me)!
    const original = me.zones.battlefield.find((c): c is VisibleCard => isVisible(c) && c.key === "Mountain")!
    me.zones.battlefield = [{ ...original, id: 700, action: "Aktiviere Fähigkeit" }, { ...original, id: 701, action: "Aktiviere Fähigkeit" }]
    const { tap } = table("commander-late", { state, questions: [] })
    fireEvent.click(card(700))
    clock += ARMING_MS
    fireEvent.click(within(dialog()).getByRole("button", { name: "Nächste Karte" }))
    fireEvent.click(within(dialog()).getByRole("button", { name: "Aktiviere Fähigkeit" }))
    expect(tap).not.toHaveBeenCalled()
    clock += ARMING_MS
    fireEvent.click(within(dialog()).getByRole("button", { name: "Aktiviere Fähigkeit" }))
    expect(tap).toHaveBeenCalledExactlyOnceWith(701)
  })

  it("an open view resolves movement, changed facts and removal against today's state (built)", () => {
    const { props, rerender, tap } = table("main-phase")
    fireEvent.click(card(25))
    const state = structuredClone(props.state)
    const me = state.players.find((p) => p.me)!
    const moved = me.zones.hand.find(isVisible)!
    me.zones.hand = []
    me.zones.exile = [{ ...moved, name: "Aktuelle Karte", action: "Aktuelle Aktion" }]
    rerender(<GameTable {...props} state={state} />)
    expect(dialog()).toHaveAccessibleName("Aktuelle Karte")
    expect(dialog()).toHaveTextContent("Dein Exil")
    expect(within(dialog()).queryByRole("button", { name: "Spiele ein Land" })).toBeNull()
    me.zones.exile = [{ hidden: true }]
    rerender(<GameTable {...props} state={structuredClone(state)} />)
    expect(dialog()).toHaveAccessibleName("Karte nicht mehr zu sehen")
    expect(within(dialog()).queryByRole("button", { name: "Aktuelle Aktion" })).toBeNull()
    expect(tap).not.toHaveBeenCalled()
  })

  it("question-only cards resolve their current source and disappear on withdrawal, even if another question has that ID (built)", () => {
    const s = tableScene("opening")
    const original = s.state.players.find((p) => p.me)!.zones.hand.find(isVisible)!
    const q: OptionsQuestion = { type: "question", kind: "options", id: 991, blocking: true, text: "Quelle", items: [{ nr: 1, text: "Karte", card: 900, cardView: { ...original, id: 900, name: "Frühere Ansicht" } }] }
    const props = { look: { id: 900, open: true, serial: 1, question: 991 }, onBrowse: vi.fn(), onOpenChange: vi.fn(), state: s.state, view: tableView(s.state), moment: { questions: [q], waiting: true, conceding: false }, pictures: NO_PICTURES }
    const r = render(<CardSheet {...props} />)
    expect(dialog()).toHaveAccessibleName("Frühere Ansicht")
    const fresh: OptionsQuestion = { ...q, items: [{ nr: 1, text: "Karte", card: 900, cardView: { ...original, id: 900, name: "Neue Ansicht" } }] }
    r.rerender(<CardSheet {...props} moment={{ ...props.moment, questions: [fresh] }} />)
    expect(dialog()).toHaveAccessibleName("Neue Ansicht")
    r.rerender(<CardSheet {...props} moment={{ ...props.moment, questions: [{ ...fresh, id: 992 }] }} />)
    expect(dialog()).toHaveAccessibleName("Karte nicht mehr zu sehen")
    expect(questionCard([fresh], 900, 992)).toBeNull()
  })

  it("the real stack can be inspected but never activated", () => {
    const { tap } = table("stack")
    openZone("Karten auf dem Stapel: 1 Einträge ansehen")
    expect(dialog()).toHaveAccessibleName("Karten auf dem Stapel")
    fireEvent.click(within(dialog()).getAllByRole("button").find((b) => b.dataset["card"] !== undefined)!)
    expect(dialog()).toHaveTextContent("Auf dem Stapel")
    expect(within(dialog()).queryByRole("button", { name: "Aktiviere Fähigkeit" })).toBeNull()
    expect(tap).not.toHaveBeenCalled()
  })
})

const dfc: TablePicture = {
  src: "https://example.invalid/front.jpg", srcSet: "", large: "https://example.invalid/front.jpg", largeSrcSet: "", lang: "en", face: 0,
  faces: [0,1].map((index) => ({ index, name: { text: index === 0 ? "Delver of Secrets" : "Insectile Aberration", lang: "en" }, englishName: index === 0 ? "Delver of Secrets" : "Insectile Aberration", typeLine: null, text: { text: index === 0 ? "Fronttext" : "Rückseitentext", lang: "en" }, manaCost: null, power: null, toughness: null, loyalty: null, defense: null, textFallback: true, picture: { src: `https://example.invalid/${index}.jpg`, srcSet: "", large: `https://example.invalid/${index}.jpg`, largeSrcSet: "", lang: "en" } })),
}

describe("DFC catalog presentation separate from Forge", () => {
  it("both faces can be inspected, English fallback is marked, and no game input is sent", () => {
    const { tap } = table("main-phase", { pictures: () => dfc })
    fireEvent.click(card(25))
    fireEvent.click(within(dialog()).getByRole("button", { name: "Insectile Aberration" }))
    expect(dialog()).toHaveTextContent("Rückseitentext")
    expect(dialog()).toHaveTextContent("englisch (kein deutscher Text verfügbar)")
    expect(dialog()).toHaveTextContent("Eine andere Kartenseite anzusehen ändert die Partie nicht")
    expect(dialog()).toHaveAccessibleName("Gebirge")
    expect(tap).not.toHaveBeenCalled()
  })

  it("the other face remains text when its picture is absent, without using the front image", () => {
    const withoutBack = { ...dfc, faces: dfc.faces!.map((f) => f.index === 1 ? { ...f, picture: null } : f) }
    table("main-phase", { pictures: () => withoutBack })
    fireEvent.click(card(25))
    fireEvent.click(within(dialog()).getByRole("button", { name: "Insectile Aberration" }))
    expect(dialog()).toHaveTextContent("Rückseitentext")
    expect(within(dialog()).queryByRole("img")).toBeNull()
  })

  it("question-only card views also inspect both sides using their latest source (built)", () => {
    const s = tableScene("opening")
    const original = s.state.players.find((p) => p.me)!.zones.hand.find(isVisible)!
    const q: OptionsQuestion = { type: "question", kind: "options", id: 990, blocking: true, text: "Quelle", items: [{ nr: 1, text: "Karte", card: 900, cardView: { ...original, id: 900 } }] }
    render(<CardSheet look={{ id: 900, open: true, serial: 1, question: 990 }} onBrowse={vi.fn()} onOpenChange={vi.fn()} state={s.state} view={tableView(s.state)} moment={{ questions: [q], waiting: true, conceding: false }} pictures={() => dfc} />)
    fireEvent.click(within(dialog()).getByRole("button", { name: "Insectile Aberration" }))
    expect(dialog()).toHaveTextContent("Rückseitentext")
    expect(within(dialog()).queryByRole("button", { name: "Spiele ein Land" })).toBeNull()
  })

  it("a Forge face change resets manual inspection to its current face (built)", () => {
    const { props, rerender } = table("main-phase", { pictures: (c) => ({ ...dfc, face: c.key === "Insectile Aberration" ? 1 : 0 }) })
    fireEvent.click(card(25))
    const state = structuredClone(props.state)
    const me = state.players.find((p) => p.me)!
    me.zones.hand = me.zones.hand.map((c) => isVisible(c) ? { ...c, key: "Insectile Aberration" } : c)
    rerender(<GameTable {...props} state={state} />)
    expect(within(dialog()).getByRole("button", { name: "Insectile Aberration" })).toHaveAttribute("aria-pressed", "true")
  })
})
