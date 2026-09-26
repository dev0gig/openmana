/*
 * The game table (game-table.tsx) on real states of recorded games
 * (src/test/table-scenes.ts): its regions, what each shows, what stays
 * hidden, the cards' facts below their pictures, stack, combat and Forge's
 * decision in Forge's words. Layout itself (fitting the screen at every
 * size) is checked in Chrome by the end-to-end test.
 */
import type { VisibleCard } from "@openmana/engine-protocol"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { GameTable } from "./game-table"
import { NO_PICTURES, type TableCardLookup } from "./table-cards"

function renderScene(name: TableSceneName, options: { pictures?: TableCardLookup; waiting?: boolean } = {}) {
  const scene = tableScene(name)
  render(
    <GameTable
      state={scene.state}
      questions={scene.questions}
      prompt={scene.prompt}
      waiting={options.waiting ?? true}
      aiProfile={scene.game.aiProfile}
      pictures={options.pictures ?? NO_PICTURES}
      menu={<button type="button">Menü</button>}
    />,
  )
  return scene
}

const region = (name: string) => screen.getByRole("region", { name })

/** The card rows of a region (lists or toolbars), top to bottom. */
const rowsOf = (area: HTMLElement) => [...area.querySelectorAll<HTMLElement>('[data-slot="game-card-row"]')]

describe("the regions", () => {
  it("every region is there and named, from the opponent to the hand", () => {
    renderScene("opening")
    for (const name of ["Spielstand", "Forge-KI", "Spielfeld der Forge-KI", "Stapel und Kampf", "Dein Spielfeld", "Du", "Entscheidung", "Deine Hand"]) {
      expect(region(name)).toBeInTheDocument()
    }
    expect(screen.getByRole("heading", { level: 1, name: "Partie" })).toBeInTheDocument()
    expect(document.title).toBe("Partie · OpenMana")
  })

  it("the header: turn and step in German, whose turn, whether Forge waits for the player", () => {
    renderScene("main-phase")
    const header = region("Spielstand")
    expect(within(header).getByText("Zug 14 · Erste Hauptphase")).toBeInTheDocument()
    expect(within(header).getByText("Du bist am Zug")).toBeInTheDocument()
    expect(within(header).getByText("Du bist dran")).toBeInTheDocument()
    expect(within(header).getByRole("button", { name: "Menü" })).toBeInTheDocument()
  })

  it("before the first turn, and while Forge computes", () => {
    renderScene("opening", { waiting: false })
    const header = region("Spielstand")
    expect(within(header).getByText("Vor dem ersten Zug")).toBeInTheDocument()
    expect(within(header).getByText("Die Starthände werden gezogen")).toBeInTheDocument()
    expect(within(header).getByText("Forge rechnet")).toBeInTheDocument()
  })
})

describe("what each player shows", () => {
  it("the opponent's hand only as backs - no card, no name - and the player's own hand card by card", () => {
    const scene = renderScene("opening")
    const opponent = region("Forge-KI")
    const hidden = within(opponent).getByRole("list", { name: "Hand der Forge-KI: 7 Karten" })
    expect(within(hidden).getAllByRole("listitem")).toHaveLength(7)
    expect(within(hidden).getAllByText("verdeckte Karte")).toHaveLength(7)
    expect(within(hidden).queryAllByRole("img")).toHaveLength(0)
    // The player's cards are controls: a toolbar of card buttons (prompt 14).
    const hand = within(region("Deine Hand")).getByRole("toolbar", { name: "Deine Hand: 7 Karten" })
    const names = scene.state.players.find((p) => p.me)!.zones.hand.map((c) => ("hidden" in c ? null : c.name))
    // Without card data the table shows Forge's own words for each card.
    expect(within(hand).getAllByRole("button").map((button) => button.querySelector('[data-slot="card-picture-fallback"] span')?.textContent)).toEqual(names)
  })

  it("life, zone sizes and the AI profile Forge confirmed", () => {
    renderScene("opening")
    const opponent = region("Forge-KI")
    expect(within(opponent).getByText("Standard")).toBeInTheDocument()
    expect(within(opponent).getByTitle("Lebenspunkte")).toHaveTextContent("20Lebenspunkte")
    for (const [label, value] of [["Hand", "7"], ["Bibliothek", "53"], ["Friedhof", "0"], ["Exil", "0"]] as const) {
      expect(within(opponent).getByTitle(label)).toHaveTextContent(`${label} ${value}`)
    }
    expect(within(region("Du")).getByText("Du")).toBeInTheDocument()
    expect(within(region("Du")).queryByText("Standard")).not.toBeInTheDocument()
  })

  it("partner commanders: each with its name", () => {
    const scene = tableScene("commander-late")
    const [player, ai] = scene.state.players
    const partner = { card: { ...player!.commanders[0]!.card, id: 999, name: "Zweiter Kommandeur" }, cast: 0, tax: 0, damage: [] }
    const state = { ...scene.state, players: [{ ...player!, commanders: [...player!.commanders, partner] }, ai!] as typeof scene.state.players }
    render(<GameTable state={state} questions={[]} prompt={null} waiting={false} aiProfile="Default" pictures={NO_PICTURES} menu={null} />)
    expect(within(region("Du")).getAllByText(/Kommandeursteuer/).map((element) => element.textContent)).toEqual(["Krenko, Tin Street Kingpin: Kommandeursteuer 4", "Zweiter Kommandeur: Kommandeursteuer 0"])
  })

  it("poison, commander tax and commander damage, from Forge's values", () => {
    renderScene("commander-late")
    const me = region("Du")
    expect(within(me).getByText("Gift").parentElement).toHaveTextContent("Gift 6")
    expect(within(me).getByText(/^Kommandeursteuer/)).toHaveTextContent("Kommandeursteuer 4")
    expect(within(me).getByText(/Kommandeurschaden/)).toHaveTextContent("9 Kommandeurschaden an Forge-KI")
    expect(within(region("Forge-KI")).getByText(/^Kommandeursteuer/)).toHaveTextContent("Kommandeursteuer 4")
    expect(within(region("Forge-KI")).getByText(/Kommandeurschaden/)).toHaveTextContent("3 Kommandeurschaden an dich")
  })
})

describe("the battlefields", () => {
  it("two rows each: creatures next to the middle, the other permanents outside; piles with their count", () => {
    renderScene("main-phase")
    const mine = region("Dein Spielfeld")
    const rows = rowsOf(mine)
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual(["Kreaturen von dir", "Länder und weitere bleibende Karten von dir"])
    // A row without cards stays a list (focusable itself); a row of cards is a toolbar.
    expect(rows.map((row) => row.getAttribute("role"))).toEqual([null, "toolbar"])
    const lands = within(rows[1]!).getAllByRole("button")
    expect(lands).toHaveLength(1)
    expect(lands[0]!.querySelector('[data-slot="game-card-caption"]')).toHaveTextContent(/^6×/)
    expect(lands[0]!.querySelector('[data-slot="game-card-caption"]')).toHaveAttribute("title", "Gebirge · 6 Karten")
    expect(lands[0]).toHaveAccessibleName("Gebirge, 6 Karten")

    const theirs = region("Spielfeld der Forge-KI")
    // The opponent's creatures lie next to the middle too: below their lands.
    expect(rowsOf(theirs).map((row) => row.getAttribute("aria-label"))).toEqual(["Länder und weitere bleibende Karten von der Forge-KI", "Kreaturen von der Forge-KI"])
    const spiders = theirs.querySelector('[data-card="77"]')!
    expect(spiders).toHaveAttribute("data-tapped", "true")
    expect(spiders.querySelector('[data-slot="game-card-caption"]')).toHaveAttribute("title", "Riesenspinne · 2 Karten · getappt · 2/4")
  })

  it("a creature's facts below its picture: power/toughness and damage from Forge; the target of a spell stays single", () => {
    renderScene("stack")
    const arsonist = region("Dein Spielfeld").querySelector('[data-card="55"]')!
    expect(arsonist.querySelector('[data-slot="game-card-caption"]')).toHaveAttribute("title", "Goblin-Brandstifter · 1/1 · 2 Schaden")
    expect(arsonist.querySelector('[data-slot="game-card-caption"]')).toHaveTextContent("1/1 · 2 Schaden")
  })

  it("combat on the cards: attacking and blocking as signs, said in the card's name for screen readers", () => {
    renderScene("defend")
    const blocker = region("Dein Spielfeld").querySelector('[data-card="58"]')!
    expect(blocker.querySelector('[data-slot="game-card-caption"] svg')).not.toBeNull()
    expect(blocker).toHaveAccessibleName(/^Goblin Arsonist, blockt, 1\/1/)
    const attacker = region("Spielfeld der Forge-KI").querySelector('[data-card="80"]')!
    expect(attacker).toHaveAttribute("data-tapped", "true")
    expect(attacker).toHaveAccessibleName(/^Giant Spider, getappt, greift an, 2\/4, ausgewählt/)
  })

  it("the command zone leads the outer row, Forge's effect cards as Forge names them", () => {
    renderScene("command-effects")
    const outer = within(region("Dein Spielfeld")).getByRole("toolbar", { name: "Länder und weitere bleibende Karten von dir" })
    const cards = within(outer).getAllByRole("button")
    expect(cards[0]).toHaveTextContent("Stomp (54)'s Effect")
    expect(cards[0]).toHaveTextContent("Kommandozone")
    expect(cards[0]).toHaveAccessibleName("Stomp (54)'s Effect, Kommandozone")
    expect(cards[1]).toHaveTextContent("Stomp (54)'s Adventure")
  })

  it("an empty battlefield says so", () => {
    renderScene("opening")
    expect(within(region("Dein Spielfeld")).getByText("Auf dem Spielfeld von dir liegt nichts.")).toBeInTheDocument()
    expect(within(region("Spielfeld der Forge-KI")).getByText("Auf dem Spielfeld von der Forge-KI liegt nichts.")).toBeInTheDocument()
  })
})

describe("stack, combat and Forge's decision", () => {
  it("the stack in Forge's words: the top, who, the target", () => {
    renderScene("stack")
    const center = region("Stapel und Kampf")
    const [entry] = within(center).getAllByRole("listitem")
    expect(entry).toHaveTextContent("Duoben")
    expect(entry).toHaveTextContent("Magmastrahl (14) - Magmastrahl (14) deals 2 damage to Goblin-Brandstifter (55). Player scries 2.")
    expect(entry).toHaveTextContent("Ziel: Goblin-Brandstifter")
  })

  it("combat in words: who attacks whom, who blocks; alike unblocked attackers in one line", () => {
    renderScene("blockers")
    const lines = within(region("Stapel und Kampf")).getAllByRole("listitem").map((item) => item.textContent)
    expect(lines).toEqual([
      "Trained Armodon greift Forge-KI an – ungeblockt",
      "Giant Spider greift Forge-KI an – geblockt von Canyon Minotaur, Raging Goblin",
      "Grizzly Bears greift Forge-KI an – ungeblockt",
      "Llanowar Elves greift Forge-KI an – geblockt von Gray Ogre",
    ])
  })

  it("a big attack stays readable: thirteen alike tokens in one line", () => {
    renderScene("commander-late")
    const lines = within(region("Stapel und Kampf")).getAllByRole("listitem").map((item) => item.textContent)
    expect(lines).toEqual(["Krenko, Tin Street Kingpin greift Forge-KI an – ungeblockt", "13 × Goblin Token greift Forge-KI an – ungeblockt"])
  })

  it("an empty stack and no combat: a line, said to screen readers", () => {
    renderScene("opening")
    expect(within(region("Stapel und Kampf")).getByText("Der Stapel ist leer, niemand kämpft.")).toBeInTheDocument()
  })

  it("the decision: Forge's prompt, the kind, Forge's buttons - a table only looked at sends nothing and says so", () => {
    const scene = renderScene("opening")
    const decision = region("Entscheidung")
    expect(within(decision).getByRole("heading", { name: "Forge wartet auf deine Entscheidung" })).toBeInTheDocument()
    expect(within(decision).getByText(scene.prompt!.replace(/\s+/g, " "))).toBeInTheDocument()
    expect(decision.querySelector('[data-slot="game-decision-header"]')).toHaveTextContent(/^Mulligan/)
    const buttons = within(within(decision).getByRole("group", { name: "Antworten, die Forge anbietet" })).getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual(["Behalten", "Mulligan"])
    for (const button of buttons) {
      expect(button).toBeDisabled()
      expect(button).toHaveAccessibleDescription("Nur ansehen – hier wird nichts beantwortet.")
    }
    // The mulligan's keep-or-not does not tap cards at once: no hint about it.
    expect(within(decision).queryByText(/wirkt hier sofort/)).not.toBeInTheDocument()
  })

  it("in a step whose taps act at once (blocking), the decision says so - and how to look at a card then", () => {
    renderScene("defend")
    expect(within(region("Entscheidung")).getByText("Karten antippen wirkt hier sofort, ein zweiter Tipp nimmt es zurück. Lange drücken oder Rechtsklick zeigt eine Karte groß.")).toBeInTheDocument()
  })
})

describe("card pictures", () => {
  const PICTURE = {
    src: "https://cards.scryfall.io/grid/front/a/b/ab.webp?1",
    srcSet: "https://cards.scryfall.io/thumb/front/a/b/ab.webp?1 146w, https://cards.scryfall.io/grid/front/a/b/ab.webp?1 488w",
    large: "https://cards.scryfall.io/display/front/a/b/ab.webp?1",
    largeSrcSet: "https://cards.scryfall.io/grid/front/a/b/ab.webp?1 488w, https://cards.scryfall.io/display/front/a/b/ab.webp?1 672w",
    lang: "de",
  }

  it("from the catalog: the picture with both sizes, named by Forge's name; a placeholder while looking up", () => {
    const lookup: TableCardLookup = (card: VisibleCard) => (card.name === "Gebirge" ? PICTURE : "loading")
    renderScene("opening", { pictures: lookup })
    const hand = region("Deine Hand")
    const mountains = within(hand).getAllByRole("img", { name: "Gebirge" })
    expect(mountains).toHaveLength(4)
    expect(mountains[0]).toHaveAttribute("src", PICTURE.src)
    expect(mountains[0]).toHaveAttribute("srcset", PICTURE.srcSet)
    expect(mountains[0]).toHaveAttribute("sizes", "auto")
    expect(mountains[0]).toHaveAttribute("crossorigin", "anonymous")
    expect(within(hand).getByText("Goblin-Brandstifter").closest('[data-slot="skeleton"]')).not.toBeNull()
  })
})
