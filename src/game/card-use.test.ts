/*
 * What the player can do with a card (card-use.ts): marks, taps and the
 * primary activation on real states of recorded games (src/test/table-scenes.ts)
 * - priority, payment, a declared attack, blocking, the mulligan - and on
 * built moments the recordings lack (a selection, the London mulligan's
 * bottom cards, a blocking question). Everything from Forge's markers and
 * questions; no rule.
 */
import type { Player, Question, VisibleCard } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { landMoment, type LandMomentName } from "@/test/land-plays"
import { cardDrop, cardRefusal, cardUse, currentStep, directTaps, momentLands, openSelection, playerUse, stepSource, tapBlocked, type CardPlace, type TableMoment } from "./card-use"
import { UNOFFERED_ACTION } from "./land-labels"
import { isVisible, locateCard } from "./table-model"

function moment(name: TableSceneName, overrides: Partial<TableMoment> = {}): TableMoment {
  const scene = tableScene(name)
  return { questions: scene.questions, waiting: true, conceding: false, attack: scene.state.attack ?? null, combat: scene.state.combat, lands: momentLands(scene.state), ...overrides }
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
    expect(useOf("main-phase", 25)).toEqual({ mark: "usable", markLabel: "spielbar", source: false, tap: { label: "Spiele ein Land", marked: true }, primary: "look", blocked: null, unavailable: null })
  })

  it("priority: a land on the battlefield Forge only names an action for (its mana ability) is not marked, its tap is offered in the card view", () => {
    expect(useOf("main-phase", 28)).toEqual({ mark: null, markLabel: null, source: false, tap: { label: "Aktiviere Fähigkeit", marked: false }, primary: "look", blocked: null, unavailable: null })
  })

  it("the mulligan: Forge offers nothing for the hand's cards - no mark, no tap, a look", () => {
    const scene = tableScene("opening")
    const me = scene.state.players.find((player) => player.me)!
    for (const hand of me.zones.hand.filter(isVisible)) {
      expect(cardUse(hand, { zone: "hand", mine: true }, moment("opening"))).toEqual({ mark: null, markLabel: null, source: false, tap: null, primary: "look", blocked: null, unavailable: null })
    }
  })

  it("blocking: Forge's taps act at once - the blocker taken back, the attacker to assign blockers to (Forge's highlight: chosen)", () => {
    expect(currentStep(tableScene("defend").questions)).toBe("block")
    expect(useOf("defend", 58)).toEqual({ mark: "selected", markLabel: "blockt", source: false, tap: { label: "Remove card from combat", marked: true }, primary: "tap", blocked: null, unavailable: null })
    expect(useOf("defend", 80)).toEqual({ mark: "selected", markLabel: "Blockziel", source: false, tap: { label: "Declare blockers for card", marked: true }, primary: "tap", blocked: null, unavailable: null })
  })

  it("a declared attack: every declared attacker is chosen ('greift an', prompt 18) and taken back at once with Forge's words", () => {
    expect(currentStep(tableScene("commander-late").questions)).toBe("attackDeclared")
    expect(useOf("commander-late", 100)).toEqual({ mark: "selected", markLabel: "greift an", source: false, tap: { label: "Remove card from combat", marked: true }, primary: "tap", blocked: null, unavailable: null })
    expect(useOf("commander-late", 205)).toMatchObject({ mark: "selected", markLabel: "greift an", tap: { label: "Remove card from combat" }, primary: "tap" })
  })

  it("payment: cards Forge names nothing for stay a look", () => {
    // Since prompt 48 Forge's payment of the recorded games is the scenes' own (the "stack" scene's payment buttons were left over from a payment that was done).
    expect(currentStep(tableScene("payment-pool").questions)).toBe("payment")
    expect(useOf("payment-pool", 39)).toEqual({ mark: null, markLabel: null, source: false, tap: null, primary: "look", blocked: null, unavailable: null })
  })
})

describe("the steps that tap at once", () => {
  it("block, attack, payment and a selection tap at once; priority and the mulligan's keep-or-not do not", () => {
    expect(directTaps(tableScene("defend").questions)).toBe(true)
    expect(directTaps(tableScene("commander-late").questions)).toBe(true)
    expect(directTaps(tableScene("payment-pool").questions)).toBe(true)
    expect(directTaps(tableScene("main-phase").questions)).toBe(false)
    expect(directTaps(tableScene("opening").questions)).toBe(false)
    expect(directTaps([])).toBe(false)
    expect(directTaps([select([1])])).toBe(true)
  })

  it("payment: a card Forge marks without words is tapped at once, named neutrally", () => {
    const land = { ...card("payment-pool", 39).card, playable: true as const }
    expect(cardUse(land, { zone: "battlefield", mine: true }, moment("payment-pool"))).toEqual({
      mark: "usable",
      markLabel: "kann bezahlen",
      source: false,
      tap: { label: "Karte antippen", marked: true },
      primary: "tap",
      blocked: null,
      unavailable: null,
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
      source: false,
      tap: { label: "Auswählen", marked: true },
      primary: "tap",
      blocked: null,
      unavailable: null,
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
      source: false,
      tap: { label: "Unter die Bibliothek legen", marked: true },
      primary: "tap",
      blocked: null,
      unavailable: null,
    })
    expect(cardUse({ ...hand, highlighted: true }, { zone: "hand", mine: true }, { questions, waiting: true, conceding: false })).toMatchObject({
      mark: "selected",
      markLabel: "ausgewählt",
      source: false,
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
    expect(useOf("defend", 58, { waiting: false })).toEqual({ mark: "selected", markLabel: "blockt", source: false, tap: { label: "Remove card from combat", marked: true }, primary: "look", blocked: "Forge rechnet gerade.", unavailable: null })
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

describe("the running step's source (prompt 17)", () => {
  it("the card Forge sends with a selection or a payment is the source; the priority names none", () => {
    const withCard = { ...select([58]), card: 80 } as Question
    expect(stepSource([withCard])).toBe(80)
    const payment: Question = { type: "question", kind: "buttons", id: 4, blocking: false, text: "", purpose: "payment", card: 36, buttons: [{ nr: 1, label: "Auto", enabled: true }, { nr: 2, label: "Abbrechen", enabled: true }] }
    expect(stepSource([payment])).toBe(36)
    expect(stepSource(tableScene("main-phase").questions)).toBeNull()
    expect(cardUse(card("defend", 80).card, { zone: "battlefield", mine: false }, { questions: [withCard], waiting: true, conceding: false }).source).toBe(true)
    expect(cardUse(card("defend", 58).card, { zone: "battlefield", mine: true }, { questions: [withCard], waiting: true, conceding: false }).source).toBe(false)
  })
})

describe("players (prompt 17)", () => {
  const opponent = (extra: Partial<Player> = {}): Player => ({ ...tableScene("main-phase").state.players.find((player) => !player.me)!, ...extra })
  const selecting: TableMoment = { questions: [select([])], waiting: true, conceding: false }

  it("only a player Forge's running input takes has a tap: chosen by a tap at once, taken back by another", () => {
    expect(playerUse(opponent(), selecting)).toEqual({ mark: null, markLabel: null, tap: null, blocked: null })
    expect(playerUse(opponent({ selectable: true }), selecting)).toEqual({ mark: "usable", markLabel: "wählbar", tap: { label: "Wählen" }, blocked: null })
    expect(playerUse(opponent({ selectable: true, highlighted: true }), selecting)).toEqual({ mark: "selected", markLabel: "gewählt", tap: { label: "Auswahl aufheben" }, blocked: null })
    // Chosen, but Forge would not take it back (it is done choosing): the mark alone.
    expect(playerUse(opponent({ highlighted: true }), selecting)).toEqual({ mark: "selected", markLabel: "gewählt", tap: null, blocked: null })
  })

  it("in a payment Forge takes the player's life: the words say so", () => {
    const payment: Question = { type: "question", kind: "buttons", id: 4, blocking: false, text: "", purpose: "payment", buttons: [{ nr: 1, label: "Auto", enabled: false }, { nr: 2, label: "Abbrechen", enabled: true }] }
    expect(playerUse(opponent({ selectable: true }), { questions: [payment], waiting: true, conceding: false })).toEqual({
      mark: "usable",
      markLabel: "kann mit Leben bezahlen",
      tap: { label: "Mit Leben bezahlen" },
      blocked: null,
    })
  })

  it("while attackers are declared, Forge's highlight is the player they attack (recorded)", () => {
    const scene = tableScene("commander-late")
    const defender = scene.state.players.find((player) => player.highlighted === true)!
    expect(defender.me).toBe(false)
    expect(playerUse(defender, { questions: scene.questions, waiting: true, conceding: false })).toEqual({ mark: "selected", markLabel: "wird angegriffen", tap: null, blocked: null })
  })

  it("the reasons why nothing can be sent are the cards'", () => {
    expect(playerUse(opponent({ selectable: true }), { ...selecting, waiting: false }).blocked).toBe("Forge rechnet gerade.")
    expect(playerUse(opponent({ selectable: true }), { ...selecting, conceding: true }).blocked).toBe("Die Aufgabe ist unterwegs.")
    expect(playerUse(opponent(), { ...selecting, waiting: false }).blocked).toBeNull()
  })
})

describe("a hand card dropped onto the battlefield (prompt 46)", () => {
  function dropOf(name: TableSceneName, id: number, overrides: Partial<TableMoment> = {}) {
    const found = card(name, id)
    return cardDrop(found.card, found.place, moment(name, overrides))
  }

  it("plays where Forge marks the card playable and its tap can be sent: a land, an instant at the AI's spell", () => {
    expect(dropOf("main-phase", 25)).toEqual({ play: true, reason: null })
    expect(dropOf("respond", 29)).toEqual({ play: true, reason: null })
  })

  it("never for a card Forge does not mark playable - it says why (prompt 51): Forge's reason for a land, else that Forge offers nothing", () => {
    // The opening hand (the start questions): nothing is played before the game begins - no land reason, only that.
    expect(dropOf("opening", 55)).toEqual({ play: false, reason: UNOFFERED_ACTION })
    // A land in the draw step: Forge's reason (timing); a spell Forge offers nothing for and names no reason: only that.
    expect(dropOf("stack", 36)).toEqual({ play: false, reason: "Ein Land spielst du nur in deiner Hauptphase, wenn der Stapel leer ist." })
    expect(dropOf("stack", 24)).toEqual({ play: false, reason: UNOFFERED_ACTION })
  })

  it("not while no tap can be sent: the table's reason (the card view's words)", () => {
    expect(dropOf("main-phase", 25, { conceding: true })).toEqual({ play: false, reason: "Die Aufgabe ist unterwegs." })
    expect(dropOf("main-phase", 25, { waiting: false })).toEqual({ play: false, reason: "Forge rechnet gerade." })
    // A blocking question waits (Forge asks which ability): the playable cards in the hand are not played by a drop.
    expect(dropOf("ability", 54)).toEqual({ play: false, reason: "Forge wartet zuerst auf deine Antwort auf seine Frage." })
  })

  it("not in the steps whose taps choose (a selection naming the hand's cards) - and never a card outside the player's hand", () => {
    expect(dropOf("discard", 56)).toEqual({ play: false, reason: UNOFFERED_ACTION })
    expect(dropOf("main-phase", 28)).toEqual({ play: false, reason: null })
    const land = card("main-phase", 25).card
    expect(cardDrop(land, { zone: "hand", mine: false }, moment("main-phase"))).toEqual({ play: false, reason: null })
  })
})

describe("why not (prompt 51): Forge's reason, the table's, or that Forge offers nothing", () => {
  /** A card of a recorded land moment of the fixture game `lands`, with that moment's questions and land facts. */
  function landCard(name: LandMomentName, id: number, overrides: Partial<TableMoment> = {}) {
    const { state, questions } = landMoment(name)
    const located = locateCard(state, id)
    if (located === null) throw new Error(`no card ${id} in moment ${name}`)
    const at: TableMoment = { questions, waiting: true, conceding: false, attack: state.attack ?? null, combat: state.combat, lands: momentLands(state), ...overrides }
    const place = { zone: located.zone, mine: located.seat === "me" }
    return { refusal: cardRefusal(located.card, place, at), drop: cardDrop(located.card, place, at), use: cardUse(located.card, place, at) }
  }

  it("the first land of the turn is played; the second in the same turn is refused with Forge's reason - by the card view and by a drop", () => {
    expect(landCard("first-land", 45)).toMatchObject({ refusal: null, drop: { play: true, reason: null } })
    const second = landCard("land-played", 45)
    expect(second.use.tap).toBeNull()
    expect(second.refusal).toEqual({ source: "forge", short: "Land schon gespielt", why: "Dein Land für diesen Zug ist bereits gespielt.", land: "limit" })
    expect(second.drop).toEqual({ play: false, reason: "Dein Land für diesen Zug ist bereits gespielt." })
  })

  it("the next own turn allows the refused land again", () => {
    expect(landCard("next-turn", 45)).toMatchObject({ refusal: null, drop: { play: true, reason: null } })
  })

  it("an effect raises Forge's limit (Exploration): after one land the next is still played, no reason", () => {
    expect(landCard("extra-allowed", 42)).toMatchObject({ refusal: null, drop: { play: true, reason: null } })
  })

  it("Forge's other reasons: not the player's turn (the AI's), not now (the beginning of the turn)", () => {
    expect(landCard("opponent-turn", 38).refusal).toMatchObject({ source: "forge", land: "notYourTurn", why: "Länder spielst du nur in deinem eigenen Zug." })
    expect(landCard("timing", 38).refusal).toMatchObject({ source: "forge", land: "timing" })
  })

  it("a card that is no land and not offered: honestly that Forge offers nothing - no guessed mana, target or effect", () => {
    // A spell in the draw step (Forge asks where a card goes): Forge marks nothing, names no action and no reason.
    const found = card("stack", 24)
    expect(cardRefusal(found.card, found.place, moment("stack"))).toEqual({ source: "unknown", short: "nicht angeboten", why: UNOFFERED_ACTION })
    // Grizzly Bears without the mana for them: Forge names its action ("cast spell") but does not mark the card playable -
    // the card view keeps Forge's words as before (its button not marked), a drop plays nothing and says only that.
    const bears = landCard("first-land", 5)
    expect(bears.use.tap).toEqual({ label: "cast spell", marked: false })
    expect(bears.refusal).toBeNull()
    expect(bears.drop).toEqual({ play: false, reason: UNOFFERED_ACTION })
  })

  it("before the game begins nothing is refused in words (the start hand only looks) - a drop says only that nothing is offered", () => {
    expect(landCard("before-start", 37)).toMatchObject({ refusal: null, drop: { play: false, reason: UNOFFERED_ACTION } })
  })

  it("without Forge's land facts in the moment, a land reason is not used: unknown stays unknown", () => {
    expect(landCard("land-played", 45, { lands: null }).refusal).toMatchObject({ source: "unknown" })
  })

  it("a card Forge offers a tap on: no refusal - unless no tap can be sent now (the table's reason, under the card view's button)", () => {
    expect(landCard("first-land", 45, { waiting: false })).toMatchObject({ refusal: { source: "table", why: "Forge rechnet gerade." }, drop: { play: false, reason: "Forge rechnet gerade." } })
  })

  it("the attack's reasons stay Forge's (prompt 18): the creature that cannot attack", () => {
    const scene = tableScene("attack")
    const entry = scene.state.attack?.unavailable[0]
    if (entry === undefined) throw new Error("the attack scene names no creature that stays back")
    const found = card("attack", entry.card)
    expect(cardRefusal(found.card, found.place, moment("attack"))).toMatchObject({ source: "forge" })
  })

  it("the opponent's cards and cards outside the hand: looked at, nothing refused", () => {
    expect(landCard("land-played", 38).refusal).toBeNull()
  })
})
