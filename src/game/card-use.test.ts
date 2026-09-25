/*
 * What the player can do with a card (card-use.ts): marks, taps and the
 * primary activation on real states of recorded games (src/test/table-scenes.ts)
 * - priority, payment, a declared attack, blocking, the mulligan - and on
 * built moments the recordings lack (a selection, the London mulligan's
 * bottom cards, a blocking question). Everything from Forge's markers and
 * questions; no rule.
 */
import type { Question, VisibleCard } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { cardUse, currentStep, directTaps, openSelection, tapBlocked, type CardPlace, type TableMoment } from "./card-use"
import { isVisible, locateCard } from "./table-model"

function moment(name: TableSceneName, overrides: Partial<TableMoment> = {}): TableMoment {
  const scene = tableScene(name)
  return { questions: scene.questions, waiting: true, conceding: false, ...overrides }
}

/** A card of a scene and its place, found by id. */
function card(name: TableSceneName, id: number): { card: VisibleCard; place: CardPlace } {
  const located = locateCard(tableScene(name).state, id)
  if (located === null) throw new Error(`no card ${id} in scene ${name}`)
  return { card: located.card, place: { zone: located.zone, mine: located.seat === "me" } }
}

function useOf(name: TableSceneName, id: number, overrides: Partial<TableMoment> = {}) {
  const found = card(name, id)
  return cardUse(found.card, found.place, moment(name, overrides))
}

describe("marks and taps from Forge's markers (real scenes)", () => {
  it("priority: the playable land in hand is marked and looked at first; Forge's words name the tap", () => {
    expect(currentStep(tableScene("main-phase").questions)).toBe("priority")
    expect(useOf("main-phase", 25)).toEqual({ mark: "usable", markLabel: "spielbar", tap: { label: "Spiele ein Land", marked: true }, primary: "look", blocked: null })
  })

  it("priority: a land on the battlefield Forge only names an action for (its mana ability) is not marked, its tap is offered in the card view", () => {
    expect(useOf("main-phase", 28)).toEqual({ mark: null, markLabel: null, tap: { label: "Aktiviere Fähigkeit", marked: false }, primary: "look", blocked: null })
  })

  it("the mulligan: Forge offers nothing for the hand's cards - no mark, no tap, a look", () => {
    const scene = tableScene("opening")
    const me = scene.state.players.find((player) => player.me)!
    for (const hand of me.zones.hand.filter(isVisible)) {
      expect(cardUse(hand, { zone: "hand", mine: true }, moment("opening"))).toEqual({ mark: null, markLabel: null, tap: null, primary: "look", blocked: null })
    }
  })

  it("blocking: Forge's taps act at once - the blocker taken back, the attacker to assign blockers to (Forge's highlight: chosen)", () => {
    expect(currentStep(tableScene("defend").questions)).toBe("block")
    expect(useOf("defend", 58)).toEqual({ mark: null, markLabel: null, tap: { label: "Remove card from combat", marked: false }, primary: "tap", blocked: null })
    expect(useOf("defend", 80)).toEqual({ mark: "selected", markLabel: "ausgewählt", tap: { label: "Declare blockers for card", marked: false }, primary: "tap", blocked: null })
  })

  it("a declared attack: Forge's marker reads 'kann angreifen', every declared attacker can be taken back at once", () => {
    expect(currentStep(tableScene("commander-late").questions)).toBe("attackDeclared")
    expect(useOf("commander-late", 100)).toEqual({ mark: "usable", markLabel: "kann angreifen", tap: { label: "Remove card from combat", marked: true }, primary: "tap", blocked: null })
    expect(useOf("commander-late", 205)).toMatchObject({ mark: null, tap: { label: "Remove card from combat" }, primary: "tap" })
  })

  it("payment: cards Forge names nothing for stay a look", () => {
    expect(currentStep(tableScene("stack").questions)).toBe("payment")
    expect(useOf("stack", 24)).toEqual({ mark: null, markLabel: null, tap: null, primary: "look", blocked: null })
  })
})

describe("the steps that tap at once", () => {
  it("block, attack, payment and a selection tap at once; priority and the mulligan's keep-or-not do not", () => {
    expect(directTaps(tableScene("defend").questions)).toBe(true)
    expect(directTaps(tableScene("commander-late").questions)).toBe(true)
    expect(directTaps(tableScene("stack").questions)).toBe(true)
    expect(directTaps(tableScene("main-phase").questions)).toBe(false)
    expect(directTaps(tableScene("opening").questions)).toBe(false)
    expect(directTaps([])).toBe(false)
    expect(directTaps([select([1])])).toBe(true)
  })

  it("payment: a card Forge marks without words is tapped at once, named neutrally", () => {
    const land = { ...card("stack", 36).card, playable: true as const }
    expect(cardUse(land, { zone: "battlefield", mine: true }, moment("stack"))).toEqual({
      mark: "usable",
      markLabel: "kann bezahlen",
      tap: { label: "Karte antippen", marked: true },
      primary: "tap",
      blocked: null,
    })
  })
})

function select(cards: readonly number[], id = 9): Question {
  return { type: "question", kind: "select", id, blocking: false, text: "Wähle ein Ziel", min: 1, max: 1, cards: [...cards], items: cards.map((card, index) => ({ nr: index + 1, text: null, card })) }
}

describe("a selection (built: the recordings have none open at their moments)", () => {
  it("the cards it names: usable ('wählbar'), chosen once Forge highlights them; the selection, not Forge's untranslated action, names the tap", () => {
    const scene = tableScene("defend")
    const questions = [...scene.questions, select([58, 80])]
    const blocker = { ...card("defend", 58).card, action: "select card as target" }
    expect(cardUse(blocker, { zone: "battlefield", mine: true }, { questions, waiting: true, conceding: false })).toEqual({
      mark: "usable",
      markLabel: "wählbar",
      tap: { label: "Auswählen", marked: true },
      primary: "tap",
      blocked: null,
    })
    expect(cardUse(card("defend", 80).card, { zone: "battlefield", mine: false }, { questions, waiting: true, conceding: false })).toMatchObject({
      mark: "selected",
      tap: { label: "Auswahl aufheben" },
      primary: "tap",
    })
    expect(openSelection(questions)?.id).toBe(9)
  })

  it("a card the selection does not name keeps what Forge says about it", () => {
    const questions = [...tableScene("main-phase").questions, select([28])]
    expect(useOf("main-phase", 25, { questions })).toMatchObject({ mark: "usable", markLabel: "spielbar", tap: { label: "Spiele ein Land" }, primary: "look" })
  })
})

describe("the London mulligan's bottom cards (built)", () => {
  const questions: Question[] = [
    { type: "question", kind: "buttons", id: 3, blocking: false, text: "", purpose: "mulliganBottom", buttons: [{ nr: 1, label: "OK", enabled: false }, { nr: 2, label: null, enabled: false }] },
  ]
  const hand = card("opening", 53).card

  it("every card of the player's hand is chosen by a tap at once - Forge names no action there, yet every tap counts (Anvil lesson)", () => {
    expect(cardUse(hand, { zone: "hand", mine: true }, { questions, waiting: true, conceding: false })).toEqual({
      mark: "usable",
      markLabel: "wählbar",
      tap: { label: "Unter die Bibliothek legen", marked: true },
      primary: "tap",
      blocked: null,
    })
    expect(cardUse({ ...hand, highlighted: true }, { zone: "hand", mine: true }, { questions, waiting: true, conceding: false })).toMatchObject({
      mark: "selected",
      markLabel: "ausgewählt",
      tap: { label: "Doch behalten" },
      primary: "tap",
    })
  })

  it("not the opponent's cards, not the battlefield", () => {
    expect(cardUse(hand, { zone: "hand", mine: false }, { questions, waiting: true, conceding: false }).tap).toBeNull()
    expect(cardUse(hand, { zone: "battlefield", mine: true }, { questions, waiting: true, conceding: false }).tap).toBeNull()
  })
})

describe("when no tap can be sent", () => {
  it("while Forge computes: the tap stays named, the card is looked at, the reason given", () => {
    expect(useOf("defend", 58, { waiting: false })).toEqual({ mark: null, markLabel: null, tap: { label: "Remove card from combat", marked: false }, primary: "look", blocked: "Forge rechnet gerade." })
  })

  it("while a blocking question waits (the client would refuse the tap) and while the concession is on its way", () => {
    const blocking: Question = { type: "question", kind: "confirm", id: 9, blocking: true, text: "Opfern?", suggested: false }
    expect(useOf("main-phase", 25, { questions: [...tableScene("main-phase").questions, blocking] }).blocked).toBe("Forge wartet zuerst auf deine Antwort auf seine Frage.")
    expect(useOf("main-phase", 25, { conceding: true }).blocked).toBe("Die Aufgabe ist unterwegs.")
    expect(tapBlocked({ questions: [], waiting: true, conceding: false })).toBeNull()
  })

  it("a card without a tap has nothing to block", () => {
    expect(useOf("opening", 53, { waiting: false }).blocked).toBeNull()
  })
})
