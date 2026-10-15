/*
 * The game table (game-table.tsx) on real states of recorded games
 * (src/test/table-scenes.ts): its regions, what each shows, what stays
 * hidden, the cards' facts (the value plaque on the picture, chips above it -
 * prompt 40), stack, combat and Forge's
 * decision in Forge's words. Layout itself (fitting the screen at every
 * size) is checked in Chrome by the end-to-end test.
 */
import type * as React from "react"
import type { VisibleCard } from "@openmana/engine-protocol"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { GameTable } from "./game-table"
import { NO_PICTURES, type TableCardLookup } from "./table-cards"
import { cardName } from "./table-labels"
import { isVisible } from "./table-model"

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
    // The anchors (data-area, the names) and the reading and focus order (prompt 38: the order of hoch, the decision last).
    expect([...document.querySelectorAll('[data-slot="game-board-area"]')].map((area) => [area.getAttribute("data-area"), area.getAttribute("aria-label")])).toEqual([
      ["header", "Spielstand"],
      ["opponent", "Forge-KI"],
      ["opponent-field", "Spielfeld der Forge-KI"],
      ["center", "Stapel und Kampf"],
      ["field", "Dein Spielfeld"],
      ["me", "Du"],
      ["hand", "Deine Hand"],
      ["decision", "Entscheidung"],
    ])
    expect(screen.getByRole("heading", { level: 1, name: "Partie" })).toBeInTheDocument()
    expect(document.title).toBe("Partie · OpenMana")
  })

  it("the header: turn and step in German, whose turn, whether Forge waits for the player", () => {
    renderScene("main-phase")
    const header = region("Spielstand")
    // Prompt 39: "Zug 14 · Dein Zug" (the number in gold) and the step beside the track, both inside the help button.
    const help = within(header).getByRole("button", { name: "Hilfe am Spieltisch" })
    expect(within(help).getByText((_, element) => element?.id !== "" && element?.textContent === "Zug 14 · Dein Zug")).toBeInTheDocument()
    expect(help.querySelector("span[id][title]")).toHaveTextContent(/^Erste Hauptphase$/)
    expect(help).toHaveAccessibleDescription("Zug 14 · Dein Zug Erste Hauptphase")
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

describe("the \"Zuletzt\" line (2026-10-14)", () => {
  const table = (name: TableSceneName, extra: { lastMove?: string | null; stage?: React.ReactNode }) => {
    const scene = tableScene(name)
    return render(<GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={null} {...extra} />)
  }

  it("the latest move as one line on the board - outside every region, after the hand and before the decision; nothing before the first move", () => {
    const { unmount } = table("main-phase", {})
    expect(document.querySelector('[data-slot="last-move"]')).toBeNull()
    unmount()
    table("main-phase", { lastMove: "Die Forge-KI hat Grizzlybären gewirkt" })
    const line = document.querySelector('[data-slot="last-move"]')!
    expect(line).toHaveTextContent("Zuletzt: Die Forge-KI hat Grizzlybären gewirkt")
    expect(line.parentElement).toHaveAttribute("data-slot", "game-board")
    expect(line.closest('[data-slot="game-board-area"]')).toBeNull()
    expect(line.compareDocumentPosition(region("Deine Hand")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(line.compareDocumentPosition(region("Entscheidung")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // An empty stack: the line stands (in hoch in place of the empty bar's gold line).
    expect(line).not.toHaveAttribute("data-rests")
  })

  it("rests while the stack shows something, and waits while the stage holds", () => {
    const { unmount } = table("stack", { lastMove: "Du hast Schock gewirkt" })
    expect(document.querySelector('[data-slot="last-move"]')).toHaveAttribute("data-rests", "")
    unmount()
    table("main-phase", { lastMove: "Du hast Schock gewirkt", stage: <section data-slot="opponent-stage" aria-label="Gegnerzug ansehen" /> })
    expect(document.querySelector('[data-slot="last-move"]')).toBeNull()
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

describe("the strips and the header (prompt 39)", () => {
  const medallion = (name: string) => region(name).querySelector<HTMLElement>('[data-slot="game-player"].table-medallion')!
  const pile = (name: string, zone: string) => region(name).querySelector<HTMLElement>(`[data-zone-pile="${zone}"]`)!

  it("each player is a life medallion: Forge's life total, the name band, the glow on whose turn it is", () => {
    const scene = renderScene("main-phase")
    const [me, ai] = [scene.state.players.find((p) => p.me)!, scene.state.players.find((p) => !p.me)!]
    for (const [name, player, band] of [["Du", me, "Du"], ["Forge-KI", ai, "Forge-KI"]] as const) {
      const seat = medallion(name)
      expect(seat).toHaveAttribute("data-player", String(player.id))
      expect(seat.querySelector('[title="Lebenspunkte"] .tabular-nums')).toHaveTextContent(String(player.life))
      expect(within(seat).getByText(band)).toHaveClass("table-medallion-band")
      expect(seat.querySelector('use[href="#table-art-medallion"]')).not.toBeNull()
      // The turn is the player's in this scene: only their medallion glows, and says so to screen readers.
      expect(seat.hasAttribute("data-active")).toBe(player.id === scene.state.activePlayer)
    }
    expect(within(medallion("Du")).getByText(", am Zug")).toHaveClass("sr-only")
  })

  it("the zones: the library as OpenMana's back with Forge's number, the graveyard with its top card, exile as a counter", () => {
    const scene = renderScene("main-phase")
    const ai = scene.state.players.find((p) => !p.me)!
    const library = pile("Forge-KI", "Bibliothek")
    // Forge sends only the library's size: a count to read, never a control, never a card.
    expect(library.tagName).toBe("SPAN")
    expect(library).toHaveTextContent(`Bibliothek ${ai.library}`)
    expect(library.querySelector('use[href="#table-art-back"]')).not.toBeNull()
    const graveyard = pile("Forge-KI", "Friedhof")
    const top = ai.zones.graveyard.at(-1)!
    expect(isVisible(top)).toBe(true)
    // Forge appends to a zone's list: its last card is the one put there last, the top of the pile.
    expect(graveyard).toHaveAccessibleName(`Friedhof der Forge-KI ansehen: ${ai.zones.graveyard.length} Karten, oben: ${cardName(top as VisibleCard)}`)
    expect(graveyard).toHaveTextContent(new RegExp(`Friedhof ${ai.zones.graveyard.length}$`))
    expect(pile("Forge-KI", "Exil")).toHaveAccessibleName(`Exil der Forge-KI ansehen: ${ai.zones.exile.length === 1 ? "1 Karte" : `${ai.zones.exile.length} Karten`}`)
    expect(region("Forge-KI").querySelector('[data-zone-pile="Kommandozone"]')).toBeNull()
  })

  it("an empty graveyard stays an empty place, nothing invented", () => {
    renderScene("opening")
    const graveyard = pile("Du", "Friedhof")
    expect(graveyard.querySelector(".table-pile-empty")).not.toBeNull()
    expect(graveyard.querySelector('[data-slot="card-picture"], [data-slot="game-card-back"]')).toBeNull()
    expect(graveyard).toHaveTextContent(/Friedhof 0$/)
  })

  it("a tap on a pile opens the zone view for that player and zone - looking only, focus back on the pile", async () => {
    const scene = tableScene("main-phase")
    const tap = (): void => {
      throw new Error("a pile sent a tap")
    }
    render(<GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={null} onTapCard={tap} onTapPlayer={tap} onAnswer={tap} />)
    const graveyard = pile("Forge-KI", "Friedhof")
    graveyard.focus()
    fireEvent.click(graveyard)
    expect(await screen.findByRole("dialog", { name: "Friedhof der Forge-KI" })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Schließen" }))
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await vi.waitFor(() => expect(graveyard).toHaveFocus())
    fireEvent.click(pile("Du", "Exil"))
    expect(await screen.findByRole("dialog", { name: "Dein Exil" })).toBeInTheDocument()
  })

  it("the command zone as a counter when Forge shows one; it opens that zone", async () => {
    renderScene("command-effects")
    const command = pile("Du", "Kommandozone")
    expect(command).toHaveTextContent(/Kommandozone 2$/)
    fireEvent.click(command)
    expect(await screen.findByRole("dialog", { name: "Deine Kommandozone" })).toBeInTheDocument()
  })

  it("the opponent's hand: one back per hidden card, OpenMana's own (drawn once for the table)", () => {
    renderScene("opening")
    const hidden = within(region("Forge-KI")).getByRole("list", { name: "Hand der Forge-KI: 7 Karten" })
    expect(hidden.querySelectorAll('[data-slot="game-card-back"] use[href="#table-art-back"]')).toHaveLength(7)
    expect(document.querySelectorAll("#table-art-back")).toHaveLength(1)
    expect(document.querySelector('[data-slot="table-art"]')).toHaveAttribute("aria-hidden", "true")
  })

  it("facts as chips: the AI profile, priority and lost on the strip's line, longer facts on a line below", () => {
    renderScene("commander-late")
    expect(within(region("Forge-KI")).getByText("Standard")).toHaveClass("table-chip")
    // The anchor the end-to-end test and the readiness games read the confirmed profile by.
    expect(region("Forge-KI").querySelector('[data-strip-fact="profile"]')).toHaveTextContent(/^Standard$/)
    expect(within(region("Du")).getByText(/^Kommandeursteuer/)).toHaveClass("table-chip")
  })

  it("a stack target: the medallion's ring is red (data-mark target) with a crosshair", () => {
    const scene = renderScene("target-player")
    const targets = scene.state.stack.flatMap((item) => item.targets).filter((target) => target.kind === "player").map((target) => target.id)
    for (const id of targets) {
      const seat = document.querySelector<HTMLElement>(`[data-slot="game-player"][data-player="${id}"]`)!
      expect(seat).toHaveAttribute("data-stack-target", "true")
      expect(seat.querySelector(".table-medallion-target")).not.toBeNull()
    }
  })

  it("the header: emblem and wordmark as decoration, zones and history as symbol buttons, the menu", () => {
    renderScene("main-phase")
    const header = region("Spielstand")
    expect(header.querySelector(".table-brand")).toHaveAttribute("aria-hidden", "true")
    // The app's shared emblem (prompt 57, src/components/ui/emblem.tsx) - the same drawing the card back uses.
    expect(header.querySelector('.table-brand > svg[data-slot="emblem"]')).not.toBeNull()
    expect(within(header).getByRole("button", { name: "Zonen ansehen" })).toHaveTextContent("Zonen")
    expect(within(header).getByRole("button", { name: "Spielverlauf ansehen" })).toHaveTextContent("Spielverlauf")
    expect(within(header).getByRole("button", { name: "Hilfe am Spieltisch" })).toHaveTextContent(/Hilfe$/)
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
    // Prompt 40: the pile's count as a chip above it ("×6"), two equal cards drawn behind the front one.
    expect(lands[0]!.querySelector('[data-slot="game-card-caption"]')).toHaveTextContent(/^×6$/)
    expect(lands[0]!.querySelector('[data-slot="game-card-caption"]')).toHaveAttribute("title", "Gebirge · 6 Karten")
    expect(lands[0]).toHaveAccessibleName("Gebirge, 6 Karten")
    expect(lands[0]!.querySelector('[data-slot="game-card-pile"]')).toHaveStyle({ "--layers": "2" })
    expect(lands[0]!.querySelectorAll('[data-slot="game-card-layer"]')).toHaveLength(2)
    // A land has no plaque; the rows say table.css what to size by (one pile of six: 1 + 2 × 0.12 card widths, one card).
    expect(lands[0]!.querySelector('[data-slot="game-card-plaque"]')).toBeNull()
    expect(rows[1]).toHaveClass("table-field-row")
    expect(rows[1]).toHaveStyle({ "--u": "1.24", "--c": "1" })
    // No line between the rows any more (prompt 40): the chips and the rows' gaps part them.
    expect(mine.querySelector('[data-slot="separator"]')).toBeNull()

    const theirs = region("Spielfeld der Forge-KI")
    // The opponent's creatures lie next to the middle too: below their lands.
    expect(rowsOf(theirs).map((row) => row.getAttribute("aria-label"))).toEqual(["Länder und weitere bleibende Karten von der Forge-KI", "Kreaturen von der Forge-KI"])
    const spiders = theirs.querySelector('[data-card="77"]')!
    expect(spiders).toHaveAttribute("data-tapped", "true")
    expect(spiders.querySelector('[data-slot="game-card-caption"]')).toHaveAttribute("title", "Riesenspinne · 2 Karten · getappt · 2/4")
  })

  it("a creature's facts: power/toughness on the plaque, damage and the target as chips above the picture; the target of a spell stays single", () => {
    renderScene("stack")
    const arsonist = region("Dein Spielfeld").querySelector('[data-card="55"]')!
    const caption = arsonist.querySelector('[data-slot="game-card-caption"]')!
    expect(caption).toHaveAttribute("title", "Goblin-Brandstifter · 1/1 · 2 Schaden · Ziel auf dem Stapel")
    // Prompt 40: Forge's power/toughness on the plaque in the card's face, hidden from screen readers (the name says it).
    const plaque = arsonist.querySelector('[data-slot="game-card-face"] [data-slot="game-card-plaque"]')!
    expect(plaque).toHaveTextContent(/^1\/1$/)
    expect(plaque).toHaveAttribute("data-kind", "power")
    expect(plaque).toHaveAttribute("aria-hidden", "true")
    expect(caption).not.toHaveTextContent("1/1")
    // The chips: "Ziel" and the damage, each its own chip; the chip line comes before the picture (above it).
    expect([...caption.querySelectorAll(".table-card-chip")].map((chip) => chip.textContent)).toEqual(["Ziel", "2 Schaden"])
    expect(arsonist.firstElementChild).toBe(caption)
    expect(arsonist).toHaveAttribute("data-stack-target", "true")
    expect(arsonist).toHaveAccessibleName(/1\/1, 2 Schaden/)
  })

  it("the hourglass comes before Forge's target and the damage, so the chip line - cut at its end - never cuts it", () => {
    const scene = tableScene("stack")
    // The same scene, with Forge saying the target is summoning sick (VisibleCard.sick).
    const players = scene.state.players.map((player) => ({
      ...player,
      zones: { ...player.zones, battlefield: player.zones.battlefield.map((card) => ("id" in card && card.id === 55 ? { ...card, sick: true } : card)) },
    })) as typeof scene.state.players
    render(<GameTable state={{ ...scene.state, players }} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={null} />)
    const caption = region("Dein Spielfeld").querySelector('[data-card="55"] [data-slot="game-card-caption"]')!
    expect([...caption.querySelectorAll(".table-card-chip")].map((chip) => chip.getAttribute("data-tone"))).toEqual(["sick", "danger", "danger"])
    expect([...caption.querySelectorAll(".table-card-chip")].map((chip) => chip.textContent)).toEqual(["verzögert", "Ziel", "2 Schaden"])
  })

  it("a planeswalker's loyalty on the plaque, with the shield; its counters are not repeated as chips", () => {
    renderScene("attack-planeswalker")
    const garruk = region("Spielfeld der Forge-KI").querySelector('[data-card="68"]')!
    const plaque = garruk.querySelector('[data-slot="game-card-plaque"]')!
    expect(plaque).toHaveAttribute("data-kind", "loyalty")
    expect(plaque).toHaveTextContent(/^1$/)
    expect(plaque.querySelector("svg")).not.toBeNull()
    expect(garruk.querySelector('[data-slot="game-card-caption"]')).toHaveAttribute("title", "Garruk Wildsprecher · Loyalität 1")
    expect(garruk.querySelectorAll('[data-slot="game-card-caption"] .table-card-chip')).toHaveLength(0)
    // A creature with a +1/+1 counter: Forge's power on the plaque, the counter as a chip.
    const spider = region("Spielfeld der Forge-KI").querySelector('[data-card="79"]')!
    expect(spider.querySelector('[data-slot="game-card-plaque"]')).toHaveTextContent(/^3\/5$/)
    expect(spider.querySelector('[data-slot="game-card-caption"]')).toHaveTextContent(/^\+1\/\+1: 1$/)
  })

  it("combat on the cards: attackers and blockers carry Forge's combat fact for their frame (table.css)", () => {
    renderScene("defend")
    expect(region("Dein Spielfeld").querySelector('[data-card="58"]')).toHaveAttribute("data-combat", "blocking")
    expect(region("Spielfeld der Forge-KI").querySelector('[data-card="80"]')).toHaveAttribute("data-combat", "attacking")
    expect(region("Spielfeld der Forge-KI").querySelector('[data-card="80"] .table-card-chip[data-tone="attack"] svg')).not.toBeNull()
  })

  it("combat and summoning sickness on the cards: signs, said in the card's name for screen readers", () => {
    renderScene("defend")
    const blocker = region("Dein Spielfeld").querySelector('[data-card="58"]')!
    // Blocking and Forge's summoning sickness (prompt 18): two signs, both in the name.
    expect(blocker.querySelectorAll('[data-slot="game-card-caption"] svg')).toHaveLength(2)
    expect(blocker).toHaveAccessibleName(/^Goblin Arsonist, Einsatzverzögerung, blockt, 1\/1/)
    // The hourglass in its own tone, first in the chip line (no pile here), so the line - cut at its end - never cuts it.
    const chips = [...blocker.querySelectorAll('[data-slot="game-card-caption"] .table-card-chip')]
    expect(chips.map((chip) => chip.getAttribute("data-tone"))).toEqual(["sick", "block"])
    expect(chips[0]).toHaveAttribute("title", "Einsatzverzögerung")
    expect(chips[0]).toHaveTextContent(/^verzögert$/)
    const attacker = region("Spielfeld der Forge-KI").querySelector('[data-card="80"]')!
    expect(attacker).toHaveAttribute("data-tapped", "true")
    expect(attacker).toHaveAccessibleName(/^Giant Spider, getappt, greift an, 2\/4, Blockziel/)
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
  it("the stack: the card, the top, what it is, whose, the target - and Forge's words (prompt 16)", () => {
    renderScene("stack")
    const center = region("Stapel und Kampf")
    // Prompt 41: the Zauberchronik - its title with the count, the entry with its card, name, whose (dot and words), number.
    expect(within(center).getByRole("heading", { name: "Zauber\u00ADchronik · 1 Eintrag" })).toBeInTheDocument()
    const [entry] = within(center).getAllByRole("listitem")
    expect(entry).toHaveAttribute("data-top")
    expect(entry).toHaveAttribute("data-controller", "me")
    expect(entry!.querySelector('[data-slot="chronicle-name"]')).toHaveTextContent(/^Magmastrahl · oben, wird als Nächstes verrechnet$/)
    expect(entry!.querySelector('[data-slot="chronicle-facts"]')).toHaveTextContent(/^Ziel: Goblin-Brandstifter · Zauberspruch · von dir$/)
    expect(entry!.querySelector('[data-slot="chronicle-text"]')).toHaveTextContent("Magmastrahl (14) - Magmastrahl (14) deals 2 damage to Goblin-Brandstifter (55). Player scries 2.")
    expect(entry).toHaveAttribute("title", expect.stringContaining("Magmastrahl · Ziel: Goblin-Brandstifter · Zauberspruch · von dir · Magmastrahl (14)"))
    expect(within(entry!).getByRole("button", { name: "Magmastrahl ansehen" })).toHaveAttribute("aria-haspopup", "dialog")
  })

  // Prompt 41: "Angreifer → Ziel · Blocker" in the Zauberchronik; the arrow is a picture, screen readers get "greift … an".
  const fights = () =>
    [...region("Stapel und Kampf").querySelectorAll("[data-combat-attacker]")].map((line) => [
      [...line.childNodes].filter((node) => !(node instanceof HTMLElement && node.classList.contains("sr-only"))).map((node) => node.textContent).join(""),
      line.querySelector(".sr-only")?.textContent ?? null,
    ])

  it("combat in short lines: who attacks whom, who blocks; alike unblocked attackers in one line", () => {
    renderScene("blockers")
    expect(within(region("Stapel und Kampf")).getByRole("heading", { name: "Kampf" })).toBeInTheDocument()
    expect(fights()).toEqual([
      ["Trained Armodon → Forge-KI · ungeblockt", " greift Forge-KI an"],
      ["Giant Spider → Forge-KI · geblockt von Canyon Minotaur, Raging Goblin", " greift Forge-KI an"],
      ["Grizzly Bears → Forge-KI · ungeblockt", " greift Forge-KI an"],
      ["Llanowar Elves → Forge-KI · geblockt von Gray Ogre", " greift Forge-KI an"],
    ])
  })

  it("a big attack stays readable: thirteen alike tokens in one line", () => {
    renderScene("commander-late")
    expect(fights()).toEqual([
      ["Krenko, Tin Street Kingpin → Forge-KI · ungeblockt", " greift Forge-KI an"],
      ["13 × Goblin Token → Forge-KI · ungeblockt", " greift Forge-KI an"],
    ])
  })

  it("an empty stack and no combat: a line, said to screen readers", () => {
    renderScene("opening")
    expect(within(region("Stapel und Kampf")).getByText("Der Stapel ist leer, niemand kämpft.")).toBeInTheDocument()
  })

  it("the decision: Forge's prompt, the kind, Forge's buttons - a table only looked at sends nothing and says so", () => {
    const scene = renderScene("opening")
    const decision = region("Entscheidung")
    expect(within(decision).getByRole("heading", { name: "Gespeicherte Frage von Forge" })).toBeInTheDocument()
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
    expect(within(region("Entscheidung")).getByText("Blocker erneut antippen nimmt diese Zuordnung zurück. Lange drücken oder Rechtsklick zeigt die Karte.")).toBeInTheDocument()
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

  it("from the catalog: the picture with both sizes, named by Forge's name, a hand card's chosen for its lifted size; a placeholder while looking up", () => {
    const lookup: TableCardLookup = (card: VisibleCard) => (card.name === "Gebirge" ? PICTURE : "loading")
    renderScene("opening", { pictures: lookup })
    const hand = region("Deine Hand")
    const mountains = within(hand).getAllByRole("img", { name: "Gebirge" })
    expect(mountains).toHaveLength(4)
    expect(mountains[0]).toHaveAttribute("src", PICTURE.src)
    expect(mountains[0]).toHaveAttribute("srcset", PICTURE.srcSet)
    // A hand card's picture is chosen for its lifted size (a full card), not its small resting place - sharp when it rises.
    expect(mountains[0]).toHaveAttribute("sizes", "13rem")
    expect(mountains[0]).toHaveAttribute("crossorigin", "anonymous")
    expect(within(hand).getByText("Goblin-Brandstifter").closest('[data-slot="skeleton"]')).not.toBeNull()
  })
})

/*
 * Prompt 41 (docs/design/SPIELTISCH.md §4.11-4.14): the Zauberchronik, the
 * Phasen-Tafel and the main button. The form follows the layout - the action
 * bar in hoch (jsdom answers no media query: hoch), the Phasen-Tafel beside the
 * battlefields (a stand-in matchMedia answering quadrat).
 */
describe("the Zauberchronik, the Phasen-Tafel and the main button (prompt 41)", () => {
  const decisionRegion = () => region("Entscheidung")
  const phasePanel = () => decisionRegion().querySelector<HTMLElement>('[data-slot="phase-panel"]')!
  const mainButtons = () => [...decisionRegion().querySelectorAll<HTMLElement>("[data-main]")].map((button) => button.textContent)

  function asQuadrat() {
    const original = window.matchMedia
    window.matchMedia = ((query: string) =>
      ({
        media: query,
        matches: query === "(3/4 <= aspect-ratio <= 13/10)",
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia
    return () => {
      window.matchMedia = original
    }
  }

  it.each([
    ["main-phase", ["Weiter"], "pass"],
    ["respond", ["Verrechnen lassen"], "pass"],
    ["attack", ["Nicht angreifen"], "declare"],
    ["attack-declared", ["Mit 1 Kreatur angreifen"], "declare"],
    ["block-start", ["Nicht blocken"], null],
    // Blocks declared, nothing asked (since prompt 48 the attack's buttons are withdrawn once the attack is declared): no main button.
    ["blockers", [], null],
    ["opening", ["Behalten"], null],
    ["payment", [], null],
    ["yes-no", [], null],
    ["play-draw", [], null],
  ] as const)("%s: the main button is %j (only pass and the confirmations of attack, block and the mulligan)", (scene, expected, meaning) => {
    renderScene(scene)
    expect(mainButtons()).toEqual(expected)
    const main = decisionRegion().querySelector("[data-main]")
    if (main !== null) {
      // Still Forge's button in the answers group, with its meaning; only its look is new.
      expect(main.closest('[role="group"]')).toHaveAccessibleName("Antworten, die Forge anbietet")
      expect(main.getAttribute("data-meaning")).toBe(meaning)
    }
  })

  it("hoch: the action bar - the compact phases beside the answers at the bottom, the hint above with the question", () => {
    renderScene("main-phase")
    const decision = decisionRegion().querySelector('[data-slot="game-decision"]')!
    expect(decision).toHaveAttribute("data-form", "bar")
    const bar = decisionRegion().querySelector('[data-slot="game-decision-bar"]')!
    expect(bar.contains(phasePanel())).toBe(true)
    expect(phasePanel()).toHaveAttribute("data-place", "bar")
    expect(phasePanel()).toHaveTextContent("Erste Hauptphase")
    expect(within(decisionRegion()).getByRole("group", { name: "Antworten, die Forge anbietet" }).parentElement).toBe(bar)
    const weiter = within(decisionRegion()).getByRole("button", { name: "Weiter" })
    // A table only looked at (no onAnswer) says so first; the hint explains the button.
    expect(weiter).toHaveAccessibleDescription("Nur ansehen – hier wird nichts beantwortet. „Weiter“ gibt die Priorität ab. Tut danach niemand mehr etwas, geht es zum nächsten Schritt.")
    const hint = decisionRegion().querySelector(".table-main-hint")!
    expect(hint.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("hoch: without an answer (Forge computes) the action bar still shows the phases", () => {
    renderScene("main-phase", { waiting: false })
    expect(phasePanel().closest('[data-slot="game-decision-bar"]')).not.toBeNull()
  })

  it("quadrat and breit: the Phasen-Tafel - the phases at the top, title and turn, only the current phase unfolds; the question below", () => {
    const restore = asQuadrat()
    try {
      const scene = renderScene("attack-declared")
      const decision = decisionRegion().querySelector('[data-slot="game-decision"]')!
      expect(decision).toHaveAttribute("data-form", "panel")
      expect(decision).toHaveClass("table-panel")
      expect(phasePanel()).toHaveAttribute("data-place", "panel")
      expect(phasePanel().closest('[data-slot="game-decision-bar"]')).toBeNull()
      expect(phasePanel()).toHaveTextContent(`PhasenZug ${scene.state.turn}`)
      const header = decision.querySelector('[data-slot="game-decision-header"]')!
      expect(phasePanel().compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // The combat unfolds its steps (short names, the full ones as titles); first-strike damage is not reported.
      const steps = [...phasePanel().querySelectorAll('[data-slot="phase-track-step"]')]
      expect(steps.map((step) => step.textContent)).toEqual(["Erste Hauptphase", "Kampfbeginn", "Angreifer", "Blocker", "Kampfschaden", "Kampfende", "Zweite Hauptphase"])
      const current = phasePanel().querySelector('[data-slot="phase-track-step"][data-state="current"]')!
      expect(current).toHaveTextContent("Angreifer")
      expect(current).toHaveAttribute("title", "Angreifer deklarieren")
      expect(phasePanel()).not.toHaveAttribute("data-folded")
    } finally {
      restore()
    }
  })

  it("quadrat and breit: a question that needs the room folds the phases to one line", () => {
    const restore = asQuadrat()
    try {
      renderScene("choose-mode")
      expect(board()).toHaveAttribute("data-decision", "expanded")
      expect(phasePanel()).toHaveAttribute("data-folded", "true")
    } finally {
      restore()
    }
  })

  it("the header keeps the turn and the step in words; the phases are a picture (hidden from screen readers)", () => {
    renderScene("attack-declared")
    const header = region("Spielstand")
    expect(header.querySelector('[data-slot="phase-track"]')).toBeNull()
    expect(within(header).getByRole("button", { name: "Hilfe am Spieltisch" })).toHaveAccessibleDescription(/Angreifer deklarieren$/)
    expect(phasePanel()).toHaveAttribute("aria-hidden", "true")
    expect(phasePanel()).toHaveTextContent("Kampfphase · Angreifer")
  })

  it("the Zauberchronik: a card on the stack opens the card view by a long press or a right click too - and sends nothing", async () => {
    const scene = tableScene("respond")
    const onTapCard = vi.fn()
    const onAnswer = vi.fn()
    render(
      <GameTable state={scene.state} questions={scene.questions} prompt={scene.prompt} waiting aiProfile={scene.game.aiProfile} pictures={NO_PICTURES} menu={<button type="button">Menü</button>} onTapCard={onTapCard} onAnswer={onAnswer} />,
    )
    const item = scene.state.stack[0]!
    const card = item.card !== null && !("hidden" in item.card) ? item.card : null
    expect(card).not.toBeNull()
    const button = region("Stapel und Kampf").querySelector<HTMLElement>(`[data-stack-card="${card!.id}"]`)!
    fireEvent.contextMenu(button)
    expect(await screen.findByRole("dialog", { name: card!.name! })).toBeInTheDocument()
    expect(onTapCard).not.toHaveBeenCalled()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("the Zauberchronik while empty: its title and 0, and the honest words", () => {
    renderScene("main-phase")
    const center = region("Stapel und Kampf")
    expect(center.querySelector('[data-chronicle="empty"]')).not.toBeNull()
    expect(within(center).getByRole("heading", { name: "Zauber­chronik" })).toBeInTheDocument()
    expect(center).toHaveTextContent("Der Stapel ist leer, niemand kämpft.")
  })
})

const board = () => document.querySelector<HTMLElement>('[data-slot="game-board"]')!
