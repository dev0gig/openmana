// @vitest-environment node
/*
 * Forge's decisions as data (decision-model.ts): which question is answered
 * now, what each kind asks for in Forge's own numbers, whether a draft fits,
 * and the answer the protocol wants - on the real questions of the recorded
 * games (src/test/table-scenes.ts: play or draw, a target, a target that is
 * a player, yes or no, two cards to discard, a mode, scrying, an ability, combat
 * damage) and, for the kinds the recorded games do not reach (confirm, input,
 * order), on questions built after the protocol's schema. Every answer is
 * checked against the protocol's own validator.
 */
import { checkEngineMessage, inputProblems, type AnswerBody, type ArrangeQuestion, type DistributeQuestion, type GameState, type OrderQuestion, type Question } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { BUILT_QUESTIONS, builtQuestion } from "@/test/built-questions"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import {
  arrangeAnswer,
  buttonText,
  cardItems,
  changeAmount,
  checkArrangement,
  checkChoose,
  checkDistribution,
  checkInput,
  checkOrder,
  chooseAnswer,
  confirmLabels,
  countRule,
  currentDecision,
  distributeAnswer,
  initialAmounts,
  initialArrangement,
  initialChoice,
  initialInput,
  initialOption,
  initialOrder,
  inputAnswer,
  itemLabel,
  moveEntry,
  moveToSide,
  orderAnswer,
  orderRule,
  paymentView,
  questionCards,
  selectAnswer,
  selectView,
  toggleChoice,
  type BlockingQuestion,
} from "./decision-model"

/** A list with at least one entry, as the schema wants some lists (items of choose, options, distribute). */
function nonEmpty<T>(list: readonly T[]): [T, ...T[]] {
  if (list.length === 0) throw new Error("an empty list")
  return list as [T, ...T[]]
}

/** The protocol's own check of an answer to question `id` (what the client would send). */
function valid(id: number, body: AnswerBody): boolean {
  return inputProblems({ type: "answer", seq: 1, question: id, ...body }) === null
}

function blockingOf(name: TableSceneName): BlockingQuestion {
  const decision = currentDecision(tableScene(name).questions)
  if (decision.kind !== "blocking") throw new Error(`scene ${name} has no blocking question`)
  return decision.question
}

function kindOf<K extends Question["kind"]>(question: Question, kind: K): Extract<Question, { kind: K }> {
  if (question.kind !== kind) throw new Error(`expected a ${kind} question, got ${question.kind}`)
  return question as Extract<Question, { kind: K }>
}

const order = (overrides: Partial<OrderQuestion> = {}): OrderQuestion => ({
  type: "question",
  kind: "order",
  id: 40,
  blocking: true,
  text: "Ordne Reihenfolge für simultane Fähigkeiten neu",
  top: "Lege zuerst",
  remainingMin: 0,
  remainingMax: 0,
  items: [
    { nr: 1, text: "Ausgelöste Fähigkeit A" },
    { nr: 2, text: "Ausgelöste Fähigkeit B" },
    { nr: 3, text: "Ausgelöste Fähigkeit C" },
  ],
  ...overrides,
})

describe("which question is answered now", () => {
  it("nothing open: none", () => {
    expect(currentDecision([])).toEqual({ kind: "none" })
  })

  it("a blocking question stands alone, although the step's buttons are still open under it (recorded: modes during priority, scrying during payment, combat damage while attacking)", () => {
    for (const [name, kind] of [
      ["choose-mode", "choose"],
      ["scry", "arrange"],
      ["ability", "options"],
      ["damage", "distribute"],
    ] as const) {
      const scene = tableScene(name)
      expect(scene.questions.some((question) => question.kind === "buttons")).toBe(true)
      const decision = currentDecision(scene.questions)
      expect(decision.kind).toBe("blocking")
      expect(decision.kind === "blocking" && decision.question.kind).toBe(kind)
    }
  })

  it("a running step: Forge's buttons and its selection together, either may be missing", () => {
    const target = currentDecision(tableScene("target").questions)
    expect(target.kind === "step" && [target.buttons?.kind, target.select?.kind]).toEqual(["buttons", "select"])
    const discard = currentDecision(tableScene("discard").questions)
    expect(discard.kind === "step" && [discard.buttons, discard.select?.kind]).toEqual([null, "select"])
    const mulligan = currentDecision(tableScene("opening").questions)
    expect(mulligan.kind === "step" && [mulligan.buttons?.purpose, mulligan.select]).toEqual(["mulligan", null])
  })
})

describe("buttons", () => {
  it("Forge's own words; without one, what the button does (1 = OK, 2 = cancel)", () => {
    const playDraw = kindOf(tableScene("play-draw").questions[0]!, "buttons")
    expect(playDraw.buttons.map(buttonText)).toEqual(["Play", "Draw"])
    const yesNo = kindOf(tableScene("yes-no").questions[0]!, "buttons")
    expect(yesNo.buttons.map(buttonText)).toEqual(["Ja", "Nein"])
    expect(buttonText({ nr: 1, label: null, enabled: true })).toBe("OK")
    expect(buttonText({ nr: 2, label: "  ", enabled: true })).toBe("Abbrechen")
    expect(valid(playDraw.id, { kind: "buttons", button: 2 })).toBe(true)
  })
})

describe("select (Forge's selectable cards)", () => {
  it("a target on the table: how many, and that the cards lie on the table (recorded)", () => {
    const scene = tableScene("target")
    const select = kindOf(scene.questions.find((question) => question.kind === "select")!, "select")
    const view = selectView(select, scene.state)
    expect(view).toMatchObject({ noCard: false, rule: "genau 1", onTable: 5, chosen: 0, players: [] })
    expect(view.offTable).toEqual([])
    const answer = selectAnswer(2)
    expect(answer).toEqual({ kind: "select", choices: [2] })
    expect(valid(select.id, answer)).toBe(true)
  })

  it("a target that is a player: Forge names no card, the state marks the players it takes - the opponent first (recorded, prompt 17)", () => {
    const scene = tableScene("target-player")
    const select = kindOf(scene.questions.find((question) => question.kind === "select")!, "select")
    const view = selectView(select, scene.state)
    expect(view).toMatchObject({ noCard: true, rule: "genau 1", onTable: 0, offTable: [], chosen: 0 })
    expect(view.players.map((player) => player.me)).toEqual([false, true])
  })

  it("any target: cards and players count together in Forge's numbers; a chosen player counts as chosen (recorded)", () => {
    const scene = tableScene("target-both")
    const select = kindOf(scene.questions.find((question) => question.kind === "select")!, "select")
    expect(selectView(select, scene.state)).toMatchObject({ rule: "genau 1", onTable: 2, chosen: 0 })
    const chosen = { ...scene.state, players: scene.state.players.map((player) => (player.me ? player : { ...player, highlighted: true as const })) as GameState["players"] }
    expect(selectView({ ...select, max: 2 }, chosen)).toMatchObject({ rule: "1 bis 2", chosen: 1 })
  })

  it("nothing to pick: neither a card nor a player", () => {
    const scene = tableScene("target-player")
    const select = kindOf(scene.questions.find((question) => question.kind === "select")!, "select")
    const none = { ...scene.state, players: scene.state.players.map(({ selectable: _selectable, ...player }) => player) as GameState["players"] }
    expect(selectView(select, none)).toMatchObject({ noCard: true, rule: null, players: [] })
  })

  it("two cards to discard from the hand (recorded)", () => {
    const scene = tableScene("discard")
    const select = kindOf(scene.questions[0]!, "select")
    expect(selectView(select, scene.state)).toMatchObject({ rule: "genau 2", onTable: 3, offTable: [], chosen: 0 })
  })

  it("cards the table does not show (a library, a hidden card) are listed; whether they are chosen is not claimed", () => {
    const scene = tableScene("target")
    const select = kindOf(scene.questions.find((question) => question.kind === "select")!, "select")
    // Dismember names five creatures on the table; a card of the library and a hidden one come after them.
    expect(select.items).toHaveLength(5)
    const library = { nr: 6, text: "Gebirge (999)", card: 999, cardView: { id: 999, key: "Mountain", name: "Gebirge", tapped: false, sick: false, faceDown: false, damage: 0, owner: 0, controller: 0 } }
    const extended = { ...select, max: 2, items: [...select.items, library, { nr: 7, hidden: true as const }] }
    const view = selectView(extended, scene.state)
    expect(view.offTable.map((item) => item.nr)).toEqual([6, 7])
    expect(view.onTable).toBe(5)
    expect(view.chosen).toBeNull()
    expect(view.rule).toBe("1 bis 2")
  })
})

describe("the payment (prompt 17)", () => {
  it("by hand (recorded): what is still to pay, nothing floating, no life", () => {
    expect(paymentView(tableScene("payment").state)).toEqual({ cost: "{R}", pool: [], life: null })
  })

  it("floating mana (recorded: Dark Ritual): the colours Forge takes, with how much of each floats", () => {
    expect(paymentView(tableScene("payment-pool").state)).toEqual({
      cost: "{1}{R}",
      pool: [
        { color: "B", amount: 3 },
        { color: "R", amount: 1 },
      ],
      life: null,
    })
  })

  it("Phyrexian mana (recorded: Dismember): Forge takes the player's life", () => {
    const state = tableScene("payment-life").state
    expect(paymentView(state)).toMatchObject({ cost: "{1}{B/P}{B/P}", pool: [], life: { me: true } })
  })

  it("no payment runs: nothing", () => {
    expect(paymentView(tableScene("main-phase").state)).toBeNull()
  })
})

describe("choose", () => {
  it("one of two modes (recorded): nothing chosen first, one pick replaces the other, the answer in item order", () => {
    const question = kindOf(blockingOf("choose-mode"), "choose")
    expect(countRule(question.min, question.max, question.items.length)).toBe("genau 1")
    expect(initialChoice(question)).toEqual([])
    expect(checkChoose(question, [])).toEqual({ ok: false, reason: "Wähle noch 1." })
    const first = toggleChoice([], 2, question.max)
    expect(toggleChoice(first, 1, question.max)).toEqual([1])
    expect(checkChoose(question, first)).toEqual({ ok: true, reason: null })
    expect(chooseAnswer(first)).toEqual({ kind: "choose", choices: [2] })
    expect(valid(question.id, chooseAnswer(first))).toBe(true)
    expect(itemLabel(question.items[0]!, null)).toBe("• Die Feurige Konfluenz fügt jeder Kreatur 1 Schadenspunkt zu.")
    expect(cardItems(question.items)).toBe(false)
  })

  it("several: up to the maximum, then nothing more until one is taken back; Forge's suggestion is only the first draft", () => {
    const question = { ...kindOf(blockingOf("choose-mode"), "choose"), min: 0, max: 2, items: nonEmpty([1, 2, 3].map((nr) => ({ nr, text: `Farbe ${nr}` }))), suggested: [3, 3, 9] }
    expect(initialChoice(question)).toEqual([3])
    expect(countRule(0, 2, 3)).toBe("bis zu 2")
    expect(countRule(0, 3, 3)).toBe("beliebig viele")
    expect(countRule(1, 3, 3)).toBe("1 bis 3")
    const two = toggleChoice(toggleChoice([], 1, 2), 3, 2)
    expect(toggleChoice(two, 2, 2)).toEqual(two)
    expect(toggleChoice(two, 1, 2)).toEqual([3])
    expect(checkChoose(question, [])).toEqual({ ok: true, reason: null })
    expect(chooseAnswer([3, 1])).toEqual({ kind: "choose", choices: [1, 3] })
  })

  it("players by who they are (the state's me), never by their names", () => {
    const scene = tableScene("main-phase")
    const me = scene.state.players.find((player) => player.me)!
    const ai = scene.state.players.find((player) => !player.me)!
    expect(itemLabel({ nr: 1, text: "Player", player: me.id }, scene.state)).toBe("Du")
    expect(itemLabel({ nr: 2, text: "Forge AI", player: ai.id }, scene.state)).toBe("Forge-KI")
    expect(itemLabel({ nr: 3, hidden: true }, scene.state)).toBe("verdeckte Karte")
    expect(itemLabel({ nr: 4, text: null }, scene.state)).toBe("Eintrag 4")
  })
})

describe("confirm (built: the recorded games reach none)", () => {
  it("Forge's words for yes and no, else Ja/Nein", () => {
    const base = { type: "question", kind: "confirm", id: 50, blocking: true, text: "Möchtest du den Effekt nutzen?", suggested: false } as const
    expect(confirmLabels(base)).toEqual({ yes: "Ja", no: "Nein" })
    expect(confirmLabels({ ...base, yesLabel: "Aufdecken", noLabel: "Behalten" })).toEqual({ yes: "Aufdecken", no: "Behalten" })
    expect(valid(base.id, { kind: "confirm", yes: false })).toBe(true)
  })
})

describe("options", () => {
  it("which way to play a card (recorded): nothing preselected without Forge's suggestion; 0 cancels", () => {
    const question = kindOf(blockingOf("ability"), "options")
    expect(question.cancellable).toBe(true)
    expect(initialOption(question)).toBeNull()
    expect(initialOption({ ...question, suggested: 2 })).toBe(2)
    expect(initialOption({ ...question, suggested: 7 })).toBeNull()
    expect(valid(question.id, { kind: "options", option: 0 })).toBe(true)
  })
})

describe("input (built: the recorded games reach none)", () => {
  const numeric = { type: "question", kind: "input", id: 60, blocking: true, text: "Wähle eine Zahl", numeric: true, suggested: "3" } as const

  it("a whole number where Forge asks for one - what Forge can read", () => {
    expect(initialInput(numeric)).toBe("3")
    expect(checkInput(numeric, " 12 ").ok).toBe(true)
    expect(checkInput(numeric, "-4").ok).toBe(true)
    expect(checkInput(numeric, "").reason).toBe("Gib eine ganze Zahl ein.")
    expect(checkInput(numeric, "2,5").reason).toBe("Nur eine ganze Zahl, ohne Komma oder Buchstaben.")
    expect(checkInput(numeric, "zwei").ok).toBe(false)
    expect(checkInput(numeric, "3000000000").reason).toBe("Diese Zahl ist zu groß.")
    expect(inputAnswer(numeric, " 12 ")).toEqual({ kind: "input", value: "12" })
  })

  it("a text: anything, as typed", () => {
    const text = { ...numeric, numeric: false, suggested: null }
    expect(initialInput(text)).toBe("")
    expect(checkInput(text, "").ok).toBe(true)
    expect(inputAnswer(text, " Name ")).toEqual({ kind: "input", value: " Name " })
    expect(valid(text.id, inputAnswer(text, "x"))).toBe(true)
  })
})

describe("order (built: the recorded games reach none)", () => {
  it("order all (both bounds 0): Forge's order as the first draft, moved up and down", () => {
    const question = order()
    expect(orderRule(question)).toEqual({ all: true, pickMin: 3, pickMax: 3 })
    const draft = initialOrder(question)
    expect(draft).toEqual([1, 2, 3])
    expect(checkOrder(question, draft).ok).toBe(true)
    expect(checkOrder(question, [1, 2]).reason).toBe("Bringe alle in eine Reihenfolge.")
    const moved = moveEntry(draft, 2, -1)
    expect(moved).toEqual([1, 3, 2])
    expect(moveEntry(moved, 0, -1)).toBe(moved)
    expect(orderAnswer(moved)).toEqual({ kind: "order", order: [1, 3, 2] })
    expect(valid(question.id, orderAnswer(moved))).toBe(true)
  })

  it("pick any number (negative maximum): nothing picked first, all may remain", () => {
    const question = order({ remainingMin: -1, remainingMax: -1 })
    expect(orderRule(question)).toEqual({ all: false, pickMin: 0, pickMax: 3 })
    expect(initialOrder(question)).toEqual([])
    expect(checkOrder(question, []).ok).toBe(true)
  })

  it("Forge's bounds of what remains become how many to pick; its suggestion is the first draft", () => {
    const question = order({ remainingMin: 1, remainingMax: 2, suggested: [2] })
    expect(orderRule(question)).toEqual({ all: false, pickMin: 1, pickMax: 2 })
    expect(initialOrder(question)).toEqual([2])
    expect(checkOrder(question, []).reason).toBe("Wähle noch 1.")
    expect(checkOrder(question, [1, 2, 3]).reason).toBe("Höchstens 2 – nimm zuerst etwas zurück.")
  })
})

describe("arrange (recorded: scrying 2)", () => {
  it("the first draft changes nothing; cards move between the sides; every card exactly once", () => {
    const question = kindOf(blockingOf("scry"), "arrange") as ArrangeQuestion
    expect([question.toTop, question.toBottom, question.toAnywhere, question.others]).toEqual([true, true, false, 48])
    const draft = initialArrangement(question)
    expect(draft).toEqual({ top: [1, 2], bottom: [] })
    expect(checkArrangement(question, draft).ok).toBe(true)
    const one = moveToSide(draft, 1, "bottom")
    expect(one).toEqual({ top: [2], bottom: [1] })
    expect(moveToSide(one, 2, "bottom")).toEqual({ top: [], bottom: [1, 2] })
    expect(checkArrangement(question, { top: [1], bottom: [] }).reason).toBe("Jede Karte muss genau einmal liegen.")
    expect(checkArrangement({ ...question, toTop: false }, draft).reason).toBe("Nach oben darf hier keine Karte.")
    expect(initialArrangement({ ...question, toTop: false })).toEqual({ top: [], bottom: [1, 2] })
    expect(arrangeAnswer(one)).toEqual({ kind: "arrange", top: [2], bottom: [1] })
    expect(valid(question.id, arrangeAnswer(one))).toBe(true)
  })
})

describe("distribute (recorded: 2 combat damage between two blockers)", () => {
  it("everyone at Forge's minimum first; never below it, never beyond the total; only the whole total is an answer", () => {
    const question = kindOf(blockingOf("damage"), "distribute") as DistributeQuestion
    expect([question.total, question.min, question.items.length]).toEqual([2, 0, 2])
    const start = initialAmounts(question)
    expect(start).toEqual([0, 0])
    expect(checkDistribution(question, start)).toMatchObject({ ok: false, sum: 0, open: 2, reason: "Noch 2 zu verteilen." })
    const one = changeAmount(question, start, 0, 1)
    expect(one).toEqual([1, 0])
    const two = changeAmount(question, one, 1, 1)
    expect(checkDistribution(question, two)).toMatchObject({ ok: true, open: 0, reason: null })
    expect(changeAmount(question, two, 0, 1)).toBe(two)
    expect(changeAmount(question, start, 0, -1)).toBe(start)
    expect(checkDistribution(question, [3, 0]).reason).toBe("1 zu viel verteilt.")
    expect(checkDistribution({ ...question, min: 1 }, [2, 0]).reason).toBe("Jedes Ziel bekommt mindestens 1.")
    expect(distributeAnswer(two)).toEqual({ kind: "distribute", amounts: [1, 1] })
    expect(valid(question.id, distributeAnswer(two))).toBe(true)
  })
})

describe("the cards of questions", () => {
  it("the asking card, the items' cards and revealed cards - for the picture lookup", () => {
    const ids = (name: TableSceneName) => questionCards(tableScene(name).questions).map((card) => card.id)
    expect(ids("scry")).toEqual([14, 56, 30])
    expect(ids("damage")).toEqual([18, 101, 115])
    expect(ids("choose-mode")).toEqual([])
    const revealed: Question = { type: "question", kind: "options", id: 70, blocking: true, text: "Forge zeigt", items: [{ nr: 1, text: "OK" }], revealed: tableScene("damage").questions.flatMap((question) => ("items" in question && question.items !== undefined ? question.items : [])) }
    expect(questionCards([revealed]).map((card) => card.id)).toEqual([101, 115])
    expect(cardItems(kindOf(blockingOf("scry"), "arrange").items)).toBe(true)
  })
})

describe("the built questions of the end-to-end test's harness (src/test/built-questions.ts)", () => {
  it("are what the protocol allows, each of the kind it names", () => {
    const kinds = BUILT_QUESTIONS.map((name) => {
      const { questions } = builtQuestion(name, tableScene(name === "block-order" ? "blockers" : "main-phase"))
      for (const question of questions) expect(() => checkEngineMessage(question), name).not.toThrow()
      return currentDecision(questions).kind === "blocking" ? (currentDecision(questions) as { question: Question }).question.kind : "select"
    })
    expect(kinds).toEqual(["confirm", "input", "order", "order", "options", "choose", "select"])
  })
})
