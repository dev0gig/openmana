/*
 * Declaring attackers on the game table (prompt 18), in the real table code
 * on real moments of the recorded game `attackers` (src/test/table-scenes.ts:
 * no attacker yet with creatures Forge names unavailable, attackers declared,
 * a planeswalker of the AI's as the defender) - and card-use.ts / the attack
 * model on the same states. Everything comes from Forge's declaration in
 * progress (GameState.attack), its marks and its buttons' meanings; the
 * table sends nothing itself (onAnswer, onTapCard, onTapPlayer are the
 * page's).
 */
import { inputProblems, type AnswerBody, type ButtonsQuestion, type VisibleCard } from "@openmana/engine-protocol"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { ATTACK_REFUSAL_WORDS, SICK_LABEL, SICK_NOTE } from "./attack-labels"
import { attackView } from "./attack-model"
import { ARMING_MS } from "./card-sheet"
import { cardUse, playerUse, type TableMoment } from "./card-use"
import { GameTable, type GameTableProps } from "./game-table"
import { NO_PICTURES } from "./table-cards"

let clock = 10_000
beforeEach(() => {
  clock = 10_000
  vi.spyOn(performance, "now").mockImplementation(() => clock)
})
afterEach(() => {
  vi.restoreAllMocks()
})

const wait = (ms = ARMING_MS) => {
  clock += ms
}

function table(name: TableSceneName, overrides: Partial<GameTableProps> = {}) {
  const scene = tableScene(name)
  const onAnswer = vi.fn<(question: number, body: AnswerBody) => void>()
  const onTapCard = vi.fn<(id: number) => void>()
  const onTapPlayer = vi.fn<(id: number) => void>()
  const props: GameTableProps = {
    state: scene.state,
    questions: scene.questions,
    prompt: scene.prompt,
    waiting: true,
    aiProfile: scene.game.aiProfile,
    pictures: NO_PICTURES,
    menu: <button type="button">Menü</button>,
    onTapCard,
    onTapPlayer,
    onAnswer,
    ...overrides,
  }
  render(<GameTable {...props} />)
  return { scene, onAnswer, onTapCard, onTapPlayer }
}

const decision = () => screen.getByRole("region", { name: "Entscheidung" })
const answersGroup = () => within(decision()).getByRole("group", { name: "Antworten, die Forge anbietet" })

function moment(name: TableSceneName): TableMoment {
  const scene = tableScene(name)
  return { questions: scene.questions, waiting: true, conceding: false, attack: scene.state.attack ?? null }
}

function attackQuestion(name: TableSceneName): ButtonsQuestion {
  const question = tableScene(name).questions.find((q): q is ButtonsQuestion => q.kind === "buttons" && (q.purpose === "attack" || q.purpose === "attackDeclared"))
  if (question === undefined) throw new Error(`${name}: no declaration of attackers`)
  return question
}

function myField(name: TableSceneName): VisibleCard[] {
  const me = tableScene(name).state.players.find((player) => player.me)!
  return me.zones.battlefield.filter((card): card is VisibleCard => !("hidden" in card))
}

describe("the recorded declarations", () => {
  it("carry Forge's declaration: the opponent attacked, creatures Forge names unavailable with a reason, buttons with meanings", () => {
    const scene = tableScene("attack")
    const attack = scene.state.attack!
    const opponent = scene.state.players.find((player) => !player.me)!
    expect(attack.defender).toEqual({ kind: "player", id: opponent.id })
    expect(attack.unavailable.length).toBeGreaterThan(0)
    expect(attackQuestion("attack").buttons.map((button) => button.meaning)).toEqual(["declare", "attackAll"])
    expect(attackQuestion("attack-declared").buttons.map((button) => button.meaning)).toEqual(["declare", "callBack"])
    expect(tableScene("attack-planeswalker").state.attack!.defender?.kind).toBe("card")
  })
})

describe("cards and players while attackers are declared (card-use.ts)", () => {
  it("a creature Forge names unavailable: no mark, no tap, Forge's reason in words; one Forge marks is usable and taps at once", () => {
    const scene = tableScene("attack")
    const cards = new Map(myField("attack").map((card) => [card.id, card]))
    for (const entry of scene.state.attack!.unavailable) {
      const use = cardUse(cards.get(entry.card)!, { zone: "battlefield", mine: true }, moment("attack"))
      expect(use).toMatchObject({ mark: null, tap: null, primary: "look", unavailable: ATTACK_REFUSAL_WORDS[entry.reason] })
      expect(use.markLabel).toBe(`kann nicht angreifen: ${ATTACK_REFUSAL_WORDS[entry.reason].short}`)
    }
    const ready = myField("attack").find((card) => card.playable === true)!
    expect(cardUse(ready, { zone: "battlefield", mine: true }, moment("attack"))).toMatchObject({ mark: "usable", markLabel: "kann angreifen", primary: "tap", unavailable: null })
  })

  it("a declared attacker is chosen ('greift an'), Forge's tap takes it back at once; the opponent is attacked", () => {
    const attacker = myField("attack-declared").find((card) => card.attacking === true)!
    const use = cardUse(attacker, { zone: "battlefield", mine: true }, moment("attack-declared"))
    expect(use).toMatchObject({ mark: "selected", markLabel: "greift an", primary: "tap", tap: { label: attacker.action } })
    const opponent = tableScene("attack-declared").state.players.find((player) => !player.me)!
    expect(playerUse(opponent, moment("attack-declared"))).toEqual({ mark: "selected", markLabel: "wird angegriffen", tap: null, blocked: null })
  })

  it("a planeswalker as the defender: it is attacked, the opponent a tap away ('Angreifen')", () => {
    const scene = tableScene("attack-planeswalker")
    const defender = scene.state.attack!.defender!
    const opponent = scene.state.players.find((player) => !player.me)!
    const walker = opponent.zones.battlefield.find((card): card is VisibleCard => !("hidden" in card) && card.id === defender.id)!
    expect(cardUse(walker, { zone: "battlefield", mine: false }, moment("attack-planeswalker"))).toMatchObject({ mark: "selected", markLabel: "wird angegriffen", tap: null })
    expect(opponent.selectable).toBe(true)
    expect(playerUse(opponent, moment("attack-planeswalker"))).toEqual({ mark: "usable", markLabel: "kann angegriffen werden", tap: { label: "Angreifen" }, blocked: null })
  })

  it("without Forge's declaration in the moment the general rules stand (a replay without it, another step)", () => {
    const ready = myField("attack").find((card) => card.playable === true)!
    expect(cardUse(ready, { zone: "battlefield", mine: true }, { ...moment("attack"), attack: null }).unavailable).toBeNull()
  })

  it("a creature Forge lets attack only another defender: its marker counts for nothing, no mark, no tap (built on attack-planeswalker)", () => {
    // Forge marks creatures that can attack anyone (pushAttackerCandidates); the declaration names those the defender now excludes.
    const scene = tableScene("attack-planeswalker")
    const spider = myField("attack-planeswalker").find((card) => card.playable === true)!
    const attack = { ...scene.state.attack!, unavailable: [{ card: spider.id, reason: "defender" as const }] }
    expect(attackView(scene.state, attackQuestion("attack-planeswalker"))!.ready).toBe(1)
    expect(attackView({ ...scene.state, attack }, attackQuestion("attack-planeswalker"))!.ready).toBe(0)
    expect(cardUse(spider, { zone: "battlefield", mine: true }, { ...moment("attack-planeswalker"), attack })).toMatchObject({
      mark: null,
      markLabel: `kann nicht angreifen: ${ATTACK_REFUSAL_WORDS.defender.short}`,
      tap: null,
      primary: "look",
    })
  })

  it("a defender on the player's own side (a battle an opponent protects): marked and tapped like any defender Forge names (built on attack)", () => {
    const scene = tableScene("attack")
    const battle = myField("attack").find((card) => card.power === undefined)!
    const attack = { ...scene.state.attack!, defenders: [...scene.state.attack!.defenders, { kind: "card" as const, id: battle.id }] }
    expect(cardUse(battle, { zone: "battlefield", mine: true }, { ...moment("attack"), attack })).toMatchObject({
      mark: "usable",
      markLabel: "kann angegriffen werden",
      tap: { label: battle.action ?? "Angreifen", marked: true },
      primary: "tap",
    })
    const attacked = { ...attack, defender: { kind: "card" as const, id: battle.id } }
    expect(cardUse(battle, { zone: "battlefield", mine: true }, { ...moment("attack"), attack: attacked })).toMatchObject({ mark: "selected", markLabel: "wird angegriffen", tap: null })
  })
})

describe("the decision region while attackers are declared", () => {
  it("says whom tapped creatures attack and who stays back and why, instead of Forge's sentence", () => {
    const { scene } = table("attack")
    expect(within(decision()).queryByText(scene.prompt!)).not.toBeInTheDocument()
    expect(within(decision()).getByText("Tippe die Kreaturen an, die die Forge-KI angreifen sollen.")).toBeInTheDocument()
    const view = attackView(scene.state, attackQuestion("attack"))!
    const back = decision().querySelector("[data-attack-unavailable]")!
    for (const { card, words } of view.unavailable) expect(back).toHaveTextContent(`${card.name} (${words.short})`)
    expect(within(decision()).queryByRole("group", { name: "Wen greifst du an?" })).not.toBeInTheDocument()
    expect(within(decision()).getByText(/^1 Kreatur kann angreifen \(gold gestrichelt\)\. Antippen lässt eine Kreatur angreifen, ein zweiter Tipp nimmt sie zurück\./)).toBeInTheDocument()
  })

  it("Forge's buttons by meaning: 'Nicht angreifen' without attackers, 'Alle angreifen' - each sent once armed", async () => {
    const user = userEvent.setup()
    const { onAnswer } = table("attack")
    const question = attackQuestion("attack")
    const buttons = within(answersGroup()).getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual(["Nicht angreifen", "Alle angreifen"])
    expect(buttons[0]).toHaveAccessibleDescription("„Nicht angreifen“ lässt den Angriff in diesem Zug aus.")
    await user.click(buttons[1]!)
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    await user.click(buttons[1]!)
    const calls = onAnswer.mock.calls as [number, AnswerBody][]
    expect(calls).toEqual([[question.id, { kind: "buttons", button: 2 }]])
    for (const [id, body] of calls) expect(inputProblems({ type: "answer", seq: 1, question: id, ...body })).toBeNull()
  })

  it("with attackers: how many attack, 'Alle zurück' for Forge's Call Back", async () => {
    const user = userEvent.setup()
    const { onAnswer } = table("attack-declared")
    const count = myField("attack-declared").filter((card) => card.attacking === true).length
    const buttons = within(answersGroup()).getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual([count === 1 ? "Mit 1 Kreatur angreifen" : `Mit ${count} Kreaturen angreifen`, "Alle zurück"])
    wait()
    await user.click(buttons[0]!)
    expect(onAnswer).toHaveBeenCalledWith(attackQuestion("attack-declared").id, { kind: "buttons", button: 1 })
  })

  it("with attackers the region keeps to a priority's room: the sentence, one note (how to take one back, what OK does), no hints, no list", () => {
    // Combat shows on the table now; the reasons stay below the cards (the table's cards, below).
    const { scene } = table("attack-declared")
    expect(scene.state.attack!.unavailable.length).toBeGreaterThan(0)
    expect(decision().querySelector("[data-attack-hints]")).toBeNull()
    expect(decision().querySelector("[data-attack-unavailable]")).toBeNull()
    expect(within(answersGroup()).getAllByRole("button")[0]).toHaveAccessibleDescription("Ein zweiter Tipp nimmt eine Kreatur zurück. Mit dem Bestätigen steht der Angriff fest.")
    const field = screen.getByRole("region", { name: "Dein Spielfeld" })
    for (const entry of scene.state.attack!.unavailable) {
      expect(field.querySelector(`[data-card="${entry.card}"] [data-slot="game-card-caption"]`)).toHaveTextContent(ATTACK_REFUSAL_WORDS[entry.reason].short)
    }
  })

  it("several defenders: the attacked one marked, the other a button that taps at once (the player: Forge's player.tap)", async () => {
    const user = userEvent.setup()
    const { scene, onTapPlayer, onTapCard } = table("attack-planeswalker")
    const group = within(within(decision()).getByRole("group", { name: "Wen greifst du an?" }))
    const opponent = scene.state.players.find((player) => !player.me)!
    // The defender attacked now: marked, nothing to press, its mark in words for screen readers like a seat's (a span has no name of its own).
    const attacked = decision().querySelector('[data-defender][data-mark="selected"]')!
    expect(attacked).toHaveAttribute("data-defender", `card:${scene.state.attack!.defender!.id}`)
    expect(attacked.tagName).toBe("SPAN")
    expect(attacked).not.toHaveAttribute("aria-label")
    expect(attacked).toHaveTextContent(/, wird angegriffen$/)
    // With several defenders a tap also moves an attacker to the chosen one: the note names it.
    expect(within(decision()).getByText(/Antippen lässt eine Kreatur das gewählte Ziel angreifen, ein zweiter Tipp nimmt sie zurück\./)).toBeInTheDocument()
    const other = group.getByRole("button", { name: /Forge-KI.*Antippen: als Angriffsziel wählen/ })
    await user.click(other)
    expect(onTapPlayer).toHaveBeenCalledWith(opponent.id)
    // A double press counts once.
    await user.click(other)
    expect(onTapPlayer).toHaveBeenCalledTimes(1)
    expect(onTapCard).not.toHaveBeenCalled()
  })
})

describe("the table's cards", () => {
  it("a creature Forge names unavailable says why in its caption and its name; a sick creature carries Forge's summoning sickness", () => {
    const { scene } = table("attack")
    const field = screen.getByRole("region", { name: "Dein Spielfeld" })
    for (const entry of scene.state.attack!.unavailable) {
      const button = field.querySelector(`[data-card="${entry.card}"]`)!
      const words = ATTACK_REFUSAL_WORDS[entry.reason]
      expect(button.querySelector('[data-slot="game-card-caption"]')).toHaveTextContent(words.short)
      expect(button).toHaveAccessibleName(new RegExp(`kann nicht angreifen: ${words.short}`))
    }
    const sick = myField("attack").find((card) => card.sick)!
    expect(field.querySelector(`[data-card="${sick.id}"]`)).toHaveAccessibleName(new RegExp(SICK_LABEL))
  })

  it("the card view of a creature Forge names unavailable: Forge's reason instead of an offer", () => {
    const { scene } = table("attack")
    const [entry] = scene.state.attack!.unavailable.filter((candidate) => candidate.reason === "restricted")
    const words = ATTACK_REFUSAL_WORDS.restricted
    fireEvent.contextMenu(screen.getByRole("region", { name: "Dein Spielfeld" }).querySelector(`[data-card="${entry!.card}"]`)!)
    const view = within(screen.getByRole("dialog"))
    expect(view.getByText(`Kann gerade nicht angreifen: ${words.short}.`)).toBeInTheDocument()
    expect(view.getByText(words.why)).toBeInTheDocument()
  })

  it("the card view says what summoning sickness means - also on the AI's creature, still sick in the player's turn", () => {
    // Forge ends summoning sickness when its player's next turn begins: the AI's creature cast in its turn is sick in the player's.
    const { scene } = table("attack")
    const opponent = scene.state.players.find((player) => !player.me)!
    const sick = opponent.zones.battlefield.find((card): card is VisibleCard => !("hidden" in card) && card.sick)!
    fireEvent.contextMenu(screen.getByRole("region", { name: "Spielfeld der Forge-KI" }).querySelector(`[data-card="${sick.id}"]`)!)
    expect(within(screen.getByRole("dialog")).getByText(SICK_NOTE)).toBeInTheDocument()
  })
})
