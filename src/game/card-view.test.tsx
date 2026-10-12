/* Real recorded zones plus labelled built live-state/DFC/hidden boundaries. */
import type { OptionsQuestion, VisibleCard } from "@openmana/engine-protocol"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { ARMING_MS, CardView } from "./card-view"
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
    const r = render(<CardView {...props} />)
    expect(dialog()).toHaveAccessibleName("Frühere Ansicht")
    const fresh: OptionsQuestion = { ...q, items: [{ nr: 1, text: "Karte", card: 900, cardView: { ...original, id: 900, name: "Neue Ansicht" } }] }
    r.rerender(<CardView {...props} moment={{ ...props.moment, questions: [fresh] }} />)
    expect(dialog()).toHaveAccessibleName("Neue Ansicht")
    r.rerender(<CardView {...props} moment={{ ...props.moment, questions: [{ ...fresh, id: 992 }] }} />)
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
  const turn = () => within(dialog()).getByRole("button", { name: /^Umdrehen/ })
  const shown = () => within(dialog()).queryByRole("img")?.getAttribute("src") ?? null

  it.each(["missing", "failed"] as const)("the %s current picture shows Forge's live text, while another face remains catalog presentation", (missing) => {
    const state = structuredClone(tableScene("main-phase").state)
    const me = state.players.find((player) => player.me)!
    const forgeText = "Forges aktueller, durch einen Effekt geänderter Regeltext."
    me.zones.hand = me.zones.hand.map((c) => isVisible(c) && c.id === 25 ? { ...c, name: "Aktuelle Forge-Karte", cost: "{2}", typeLine: "Kreatur — Probe", text: forgeText } : c)
    const picture = missing === "missing" ? { ...dfc, faces: dfc.faces!.map((face) => face.index === 0 ? { ...face, picture: null } : face) } : dfc
    const { props, rerender, tap } = table("main-phase", { state, pictures: () => picture })
    fireEvent.click(card(25))
    if (missing === "failed") fireEvent.error(within(dialog()).getByRole("img"))
    const fallback = () => dialog().querySelector('[data-slot="card-picture-fallback"]')!
    expect(fallback()).toHaveTextContent("Aktuelle Forge-Karte")
    expect(fallback()).toHaveTextContent("Kreatur — Probe")
    expect(fallback()).toHaveTextContent("{2}")
    expect(fallback()).toHaveTextContent(forgeText)
    expect(fallback()).not.toHaveTextContent("Vorderseitentext")
    const next = structuredClone(state)
    next.players.find((player) => player.me)!.zones.hand = me.zones.hand.map((c) => isVisible(c) && c.id === 25 ? { ...c, text: "Neuer Forge-Regeltext." } : c)
    rerender(<GameTable {...props} state={next} />)
    expect(fallback()).toHaveTextContent("Neuer Forge-Regeltext.")
    expect(fallback()).not.toHaveTextContent(forgeText)
    fireEvent.click(turn())
    expect(shown()).toBe("https://example.invalid/1.jpg")
    expect(tap).not.toHaveBeenCalled()
  })

  it("both faces can be inspected, English fallback is marked, and no game input is sent", () => {
    const { tap } = table("main-phase", { pictures: () => dfc })
    fireEvent.click(card(25))
    expect(shown()).toBe("https://example.invalid/0.jpg")
    expect(turn()).toHaveAccessibleName("Umdrehen – zeigt „Insectile Aberration“")
    fireEvent.click(turn())
    // The other side's picture in full size; what it means for the game is said to screen readers.
    expect(shown()).toBe("https://example.invalid/1.jpg")
    expect(dialog()).toHaveAccessibleDescription(expect.stringContaining("Du siehst die Kartenseite „Insectile Aberration“ aus dem Katalog (englisch, kein deutscher Text verfügbar)."))
    expect(dialog()).toHaveAccessibleDescription(expect.stringContaining("Eine andere Kartenseite anzusehen ändert die Partie nicht."))
    expect(dialog()).toHaveAccessibleName("Gebirge")
    fireEvent.click(turn())
    expect(shown()).toBe("https://example.invalid/0.jpg")
    expect(tap).not.toHaveBeenCalled()
  })

  it("the other face remains text when its picture is absent, without using the front image", () => {
    const withoutBack = { ...dfc, faces: dfc.faces!.map((f) => f.index === 1 ? { ...f, picture: null } : f) }
    table("main-phase", { pictures: () => withoutBack })
    fireEvent.click(card(25))
    fireEvent.click(turn())
    expect(dialog()).toHaveTextContent("Rückseitentext")
    expect(dialog()).toHaveTextContent("Katalogtext englisch.")
    expect(within(dialog()).queryByRole("img")).toBeNull()
  })

  it("question-only card views also inspect both sides using their latest source (built)", () => {
    const s = tableScene("opening")
    const original = s.state.players.find((p) => p.me)!.zones.hand.find(isVisible)!
    const q: OptionsQuestion = { type: "question", kind: "options", id: 990, blocking: true, text: "Quelle", items: [{ nr: 1, text: "Karte", card: 900, cardView: { ...original, id: 900 } }] }
    render(<CardView look={{ id: 900, open: true, serial: 1, question: 990 }} onBrowse={vi.fn()} onOpenChange={vi.fn()} state={s.state} view={tableView(s.state)} moment={{ questions: [q], waiting: true, conceding: false }} pictures={() => dfc} />)
    fireEvent.click(turn())
    expect(shown()).toBe("https://example.invalid/1.jpg")
    expect(dialog()).toHaveAccessibleDescription(expect.stringContaining("Aus Forges Frage"))
    expect(within(dialog()).queryByRole("button", { name: "Spiele ein Land" })).toBeNull()
  })

  it("a Forge face change resets manual inspection to its current face (built)", () => {
    const { props, rerender } = table("main-phase", { pictures: (c) => ({ ...dfc, face: c.key === "Insectile Aberration" ? 1 : 0 }) })
    fireEvent.click(card(25))
    const state = structuredClone(props.state)
    const me = state.players.find((p) => p.me)!
    me.zones.hand = me.zones.hand.map((c) => isVisible(c) ? { ...c, key: "Insectile Aberration" } : c)
    rerender(<GameTable {...props} state={state} />)
    expect(shown()).toBe("https://example.invalid/1.jpg")
    expect(turn()).toHaveAccessibleName("Umdrehen – zeigt „Delver of Secrets“")
  })
})

/* Prompt 47: the keyword boxes beside the card - only what Forge reports for it now, in German, live. */
describe("keyword boxes", () => {
  const boxes = () => within(dialog()).queryByRole("list", { name: "Schlüsselwörter dieser Karte" })
  const names = () => within(boxes()!).getAllByRole("listitem").map((item) => item.querySelector('[data-slot="card-title"]')!.textContent)
  /** The land of the scene, with keywords Forge would report (built: the recorded lands have none). */
  function withKeywords(keywords: VisibleCard["keywords"]) {
    const s = tableScene("main-phase")
    const state = structuredClone(s.state)
    const me = state.players.find((p) => p.me)!
    me.zones.hand = me.zones.hand.map((c) => (isVisible(c) && c.id === 25 ? { ...c, ...(keywords === undefined ? {} : { keywords }) } : c))
    return state
  }

  it("only the keywords Forge reports, in German - also one an effect gave the card (not in its text)", () => {
    const state = withKeywords([
      { keyword: "FLYING", title: "Flying", reminder: "This creature can't be blocked except by creatures with flying or reach." },
      { keyword: "PROTECTION", title: "Protection from from red", reminder: "This creature can't be blocked, targeted, dealt damage, or equipped/enchanted by from red.", detail: "from red" },
    ])
    const { tap } = table("main-phase", { state })
    fireEvent.click(card(25))
    expect(names()).toEqual(["Fliegend", "Schutz vor Rot"])
    expect(boxes()).toHaveTextContent("Diese Kreatur kann nur von fliegenden Kreaturen und Kreaturen mit Reichweite geblockt werden.")
    for (const item of within(boxes()!).getAllByRole("listitem")) expect(item).toHaveAttribute("lang", "de")
    expect(tap).not.toHaveBeenCalled()
  })

  it("the concrete form: a cost in German; a form OpenMana cannot say keeps Forge's words beside it, marked English", () => {
    table("main-phase", { state: withKeywords([
      { keyword: "KICKER", title: "Kicker {2}{R}", reminder: "You may pay an additional {2}{R} as you cast this spell.", cost: "{2}{R}" },
      { keyword: "WARD", title: "Ward—Pay 2 life.", reminder: "Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays 2 life." },
    ]) })
    fireEvent.click(card(25))
    expect(names()).toEqual(["Bonus {2}{R}", "Abwehr"])
    const ward = within(boxes()!).getAllByRole("listitem")[1]!
    expect(ward).toHaveTextContent("Bei dieser Karte, in Forges Worten:Ward—Pay 2 life.englisch")
    expect(within(ward).getByText("Ward—Pay 2 life.")).toHaveAttribute("lang", "en")
  })

  it("a keyword without German text: Forge's English words, marked - never an empty box", () => {
    table("main-phase", { state: withKeywords([{ keyword: "BRAND_NEW", title: "Brand new", reminder: "Something new." }]) })
    fireEvent.click(card(25))
    const item = within(boxes()!).getByRole("listitem")
    expect(item).toHaveAttribute("lang", "en")
    expect(item).toHaveTextContent("Brand newenglischSomething new.")
  })

  it("no keywords: no boxes and no line saying so", () => {
    table("main-phase", { state: withKeywords(undefined) })
    fireEvent.click(card(25))
    expect(boxes()).toBeNull()
    expect(dialog()).not.toHaveTextContent(/Schlüsselw/)
  })

  it("live: a keyword Forge adds or takes away while the view is open appears or goes; the button keeps its arming", () => {
    const { props, rerender, tap } = table("main-phase", { state: withKeywords(undefined) })
    fireEvent.click(card(25))
    expect(boxes()).toBeNull()
    rerender(<GameTable {...props} state={withKeywords([{ keyword: "HASTE", title: "Haste", reminder: "" }])} />)
    expect(names()).toEqual(["Eile"])
    // A new state does not re-arm the unchanged button: pressing it after ARMING_MS taps once.
    clock += ARMING_MS
    rerender(<GameTable {...props} state={withKeywords(undefined)} />)
    expect(boxes()).toBeNull()
    fireEvent.click(within(dialog()).getByRole("button", { name: "Spiele ein Land" }))
    expect(tap).toHaveBeenCalledExactlyOnceWith(25)
  })

  it("the button stays armed against a double tap with boxes beside the card", () => {
    const { tap } = table("main-phase", { state: withKeywords([{ keyword: "FLYING", title: "Flying", reminder: "" }]) })
    fireEvent.click(card(25))
    fireEvent.click(within(dialog()).getByRole("button", { name: "Spiele ein Land" }))
    expect(tap).not.toHaveBeenCalled()
    expect(dialog()).toBeInTheDocument()
  })
})

describe("the press that opened the view", () => {
  it("its release on the view's button (a long press's late click) neither taps nor takes the focus; a press of its own does", () => {
    const { tap } = table("main-phase")
    fireEvent.click(card(25))
    clock += ARMING_MS * 4
    const button = within(dialog()).getByRole("button", { name: "Spiele ein Land" })
    // The browser's mouse events of a touch that began on the table, before the view opened.
    expect(fireEvent.mouseDown(button)).toBe(false)
    fireEvent.click(button)
    expect(tap).not.toHaveBeenCalled()
    expect(dialog()).toHaveFocus()
    // A press that begins in the view.
    fireEvent.pointerDown(button)
    fireEvent.mouseDown(button)
    fireEvent.click(button)
    expect(tap).toHaveBeenCalledExactlyOnceWith(25)
  })
})

describe("closing", () => {
  it("the system's back gesture closes the view (CloseWatcher), sending nothing", () => {
    const watchers: { onclose: (() => void) | null; destroyed: boolean }[] = []
    class FakeCloseWatcher {
      onclose: (() => void) | null = null
      destroyed = false
      constructor() { watchers.push(this) }
      destroy() { this.destroyed = true }
    }
    vi.stubGlobal("CloseWatcher", FakeCloseWatcher)
    try {
      const { tap } = table("main-phase")
      fireEvent.click(card(25))
      expect(dialog()).toBeInTheDocument()
      const watcher = watchers.find((w) => !w.destroyed)!
      act(() => watcher.onclose?.())
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(watcher.destroyed).toBe(true)
      expect(tap).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  // A tap on the darkened table (Radix: a press outside the content) is checked in real Chrome: the end-to-end test's cardViewer.
  it("Escape and the X close it, and the focus returns to the card", async () => {
    const user = userEvent.setup()
    table("main-phase")
    await user.click(card(25))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(card(25)).toHaveFocus()
    await user.click(card(25))
    await user.click(within(dialog()).getByRole("button", { name: "Schließen" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(card(25)).toHaveFocus()
  })
})
