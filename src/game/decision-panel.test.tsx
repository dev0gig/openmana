/*
 * Answering Forge on the game table (prompt 15): every kind of question the
 * protocol knows, in the real table code - on the real questions of the
 * recorded games (src/test/table-scenes.ts: the mulligan, play or draw, a
 * target, a target that is a player, yes or no, two cards to discard, a mode,
 * scrying, which way to play a card, combat damage) and on questions built
 * after the schema for the kinds the recorded games do not reach (confirm,
 * input, order, a revealed list, cards outside the table). The table never
 * sends anything itself: onAnswer is the page's, and what it receives is
 * checked against the protocol's validator. Nothing is answered without the
 * player; a draft that does not fit is never sent; sending buttons are armed
 * ARMING_MS after they appear.
 */
import { inputProblems, type AnswerBody, type ArrangeQuestion, type GameState, type OrderQuestion, type Question, type SelectQuestion, type VisibleCard } from "@openmana/engine-protocol"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { ARMING_MS } from "./card-sheet"
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

/** Lets time pass for the arming of the sending buttons (performance.now is the test's clock). */
const wait = (ms = ARMING_MS) => {
  clock += ms
}

function table(name: TableSceneName, overrides: Partial<GameTableProps> = {}) {
  const scene = tableScene(name)
  const onAnswer = vi.fn<(question: number, body: AnswerBody) => void>()
  const onTapCard = vi.fn()
  const props: GameTableProps = {
    state: scene.state,
    questions: scene.questions,
    prompt: scene.prompt,
    waiting: true,
    aiProfile: scene.game.aiProfile,
    pictures: NO_PICTURES,
    menu: <button type="button">Menü</button>,
    onTapCard,
    onAnswer,
    ...overrides,
  }
  const view = render(<GameTable {...props} />)
  return { scene, onAnswer, onTapCard, rerender: (next: Partial<GameTableProps>) => view.rerender(<GameTable {...props} {...next} />) }
}

/** A list with at least one entry, as the schema wants some lists (items of choose, options, distribute). */
function nonEmpty<T>(list: readonly T[]): [T, ...T[]] {
  if (list.length === 0) throw new Error("an empty list")
  return list as [T, ...T[]]
}

/** A recorded scene's state with one question built after the schema (for the kinds the recorded games do not reach). */
function built(question: Question, overrides: Partial<GameTableProps> = {}) {
  return table("main-phase", { questions: [question], prompt: null, ...overrides })
}

const decision = () => screen.getByRole("region", { name: "Entscheidung" })
const board = () => document.querySelector<HTMLElement>('[data-slot="game-board"]')!

/** Every answer the table handed the page, each checked against the protocol (what the client would send). */
function answers(onAnswer: ReturnType<typeof vi.fn>): [number, AnswerBody][] {
  const calls = onAnswer.mock.calls as [number, AnswerBody][]
  for (const [question, body] of calls) expect(inputProblems({ type: "answer", seq: 1, question, ...body })).toBeNull()
  return calls
}

describe("Forge's buttons (a running step)", () => {
  it("the mulligan: Forge's words, its prompt line, the kind; a press is sent only once the buttons are armed", async () => {
    const user = userEvent.setup()
    const { scene, onAnswer } = table("opening")
    expect(within(decision()).getByText(scene.prompt!.replace(/\s+/g, " "))).toBeInTheDocument()
    const group = within(decision()).getByRole("group", { name: "Antworten, die Forge anbietet" })
    const [keep, mulligan] = within(group).getAllByRole("button")
    expect([keep!.textContent, mulligan!.textContent]).toEqual(["Behalten", "Mulligan"])
    // Right after the question appeared: the second press of a double click would land here - dropped.
    await user.click(keep!)
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    await user.click(mulligan!)
    expect(answers(onAnswer)).toEqual([[1, { kind: "buttons", button: 2 }]])
    // A compact decision: the board keeps its usual regions.
    expect(board()).toHaveAttribute("data-decision", "compact")
  })

  it("play or draw (recorded): Forge's buttons without a purpose, its prompt line for the words", async () => {
    const user = userEvent.setup()
    const { onAnswer } = table("play-draw")
    expect(within(decision()).getByText("Player, you have won the coin toss. Would you like to play or draw?")).toBeInTheDocument()
    expect(decision().querySelector('[data-slot="game-decision-header"]')).toHaveTextContent(/^Entscheidung/)
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Play" }))
    expect(answers(onAnswer)).toEqual([[1, { kind: "buttons", button: 1 }]])
  })

  it("yes or no as Forge's two buttons (recorded: a trigger that may be used)", async () => {
    const user = userEvent.setup()
    const { onAnswer, scene } = table("yes-no")
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Nein" }))
    expect(answers(onAnswer)).toEqual([[scene.questions[0]!.id, { kind: "buttons", button: 2 }]])
  })

  it("a button Forge switched off stays visible, off, with the reason", () => {
    table("target")
    const ok = within(decision()).getByRole("button", { name: "OK" })
    expect(ok).toBeDisabled()
    expect(ok).toHaveAccessibleDescription("„OK“ hat Forge gerade abgeschaltet.")
    expect(within(decision()).getByRole("button", { name: "Abbrechen" })).toBeEnabled()
  })

  it("while Forge computes nothing can be sent, and the region says why; a held key repeats nothing", async () => {
    const { onAnswer, rerender } = table("opening", { waiting: false })
    const keep = within(decision()).getByRole("button", { name: "Behalten" })
    expect(keep).toBeDisabled()
    expect(keep).toHaveAccessibleDescription("Forge rechnet gerade – antworten geht, sobald Forge wieder auf dich wartet.")
    rerender({ waiting: true })
    wait()
    const armed = within(decision()).getByRole("button", { name: "Behalten" })
    expect(armed).toBeEnabled()
    // A key held down from before: its repeats do not press the button.
    expect(fireEvent.keyDown(armed, { key: "Enter", repeat: true })).toBe(false)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("the London mulligan (built on the opening): how many hand cards Forge marks, Forge's OK off until they match", () => {
    const scene = tableScene("opening")
    const me = scene.state.players.find((player) => player.me)!
    const [first, ...rest] = me.zones.hand
    const marked = { ...(first as VisibleCard), highlighted: true as const }
    const state = { ...scene.state, players: nonEmpty(scene.state.players.map((player) => (player.me ? { ...player, zones: { ...player.zones, hand: [marked, ...rest] } } : player))) }
    const bottom: Question = {
      type: "question",
      kind: "buttons",
      id: 7,
      blocking: false,
      text: "",
      purpose: "mulliganBottom",
      buttons: [
        { nr: 1, label: "OK", enabled: false },
        { nr: 2, label: "Auto", enabled: true },
      ],
    }
    table("opening", { state, questions: [bottom], prompt: "Lege 2 Karten unter die Bibliothek" })
    expect(within(decision()).getByText("1 Karte ausgewählt (durchgezogener Rahmen).")).toBeInTheDocument()
    expect(within(decision()).getByRole("button", { name: "OK" })).toBeDisabled()
    expect(within(decision()).getByText(/wirkt hier sofort/)).toBeInTheDocument()
  })

  it("not while a concession is on its way; a table only looked at shows Forge's buttons off", () => {
    table("opening", { conceding: true })
    expect(within(decision()).getByRole("button", { name: "Behalten" })).toHaveAccessibleDescription("Die Aufgabe ist unterwegs.")
  })
})

describe("select (Forge's selectable cards)", () => {
  it("a target on the table (recorded): how many, where they are, Forge's prompt - not the step's stale text", () => {
    table("target")
    const note = within(decision()).getByText(/^Wähle genau 1/)
    expect(note).toHaveTextContent("Wähle genau 1 · 0 gewählt · 2 davon liegen auf dem Tisch (gold gestrichelt).")
    expect(within(decision()).getByText(/^Magmastrahl \(14\) - Der Magmastrahl/)).toBeInTheDocument()
    expect(within(decision()).queryByText(/Priorität: Player Zug: 8/)).not.toBeInTheDocument()
    // The cards lie on the table: no second row of them here.
    expect(decision().querySelector('[data-slot="game-decision-row"]')).toBeNull()
    expect(board()).toHaveAttribute("data-decision", "compact")
  })

  it("a target that is a player (recorded): Forge names no card - said honestly, cancel stays", () => {
    table("target-player")
    expect(within(decision()).getByText(/^Forge bietet keine Karte zur Wahl an – gewählt wird hier ein Spieler\./)).toBeInTheDocument()
    expect(within(decision()).getByRole("button", { name: "Abbrechen" })).toBeEnabled()
  })

  it("two cards to discard (recorded): no buttons - Forge ends the step itself", () => {
    table("discard")
    expect(within(decision()).getByText("Wähle genau 2 · 0 gewählt · 3 davon liegen auf dem Tisch (gold gestrichelt).")).toBeInTheDocument()
    expect(within(decision()).queryByRole("group", { name: "Antworten, die Forge anbietet" })).not.toBeInTheDocument()
  })

  it("cards the table does not show come as a row here: a tap selects at once (counted once), a long press only looks", async () => {
    const user = userEvent.setup()
    const scene = tableScene("target")
    const select = scene.questions.find((question): question is SelectQuestion => question.kind === "select")!
    const library: VisibleCard = { id: 999, key: "Mountain", name: "Gebirge", typeLine: "Standardland — Gebirge", tapped: false, sick: false, faceDown: false, damage: 0, owner: 0, controller: 0 }
    const questions = scene.questions.map((question) => (question === select ? { ...select, max: 2, items: [...select.items, { nr: 3, text: "Gebirge (999)", card: 999, cardView: library }, { nr: 4, hidden: true as const }] } : question))
    const { onAnswer } = table("target", { questions })
    const row = within(decision()).getByRole("toolbar", { name: "Wählbare Karten, die nicht auf dem Tisch liegen" })
    const [mountain, hidden] = within(row).getAllByRole("button")
    expect(mountain).toHaveAccessibleName("Gebirge, wählbar")
    expect(hidden).toHaveAccessibleName("verdeckte Karte, wählbar")
    expect(board()).toHaveAttribute("data-decision", "expanded")
    await user.dblClick(mountain!)
    expect(answers(onAnswer)).toEqual([[select.id, { kind: "select", choices: [3] }]])
    // Looking at it (right click): the card view shows it as the question does, and nothing is sent.
    wait()
    fireEvent.contextMenu(mountain!)
    const view = screen.getByRole("dialog")
    expect(view).toHaveAccessibleName("Gebirge")
    expect(within(view).getByText("Aus Forges Frage – diese Karte liegt nicht sichtbar auf dem Tisch.")).toBeInTheDocument()
    expect(onAnswer).toHaveBeenCalledTimes(1)
    await user.click(within(view).getByRole("button", { name: "Schließen" }))
    wait()
    await user.click(hidden!)
    expect(answers(onAnswer).at(-1)).toEqual([select.id, { kind: "select", choices: [4] }])
  })
})

describe("choose (a blocking question)", () => {
  it("a mode (recorded): nothing chosen first - the button says why it is off; one pick, then confirm", async () => {
    const user = userEvent.setup()
    const { onAnswer } = table("choose-mode")
    expect(within(decision()).getByText("Player aktivierte Feurige Konfluenz - wähle einen Modus")).toBeInTheDocument()
    // The step's priority buttons wait under the blocking question: not shown.
    expect(within(decision()).queryByRole("button", { name: "Zug beenden" })).not.toBeInTheDocument()
    expect(board()).toHaveAttribute("data-decision", "expanded")
    const confirm = within(decision()).getByRole("button", { name: "Bestätigen" })
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveAccessibleDescription("Wähle noch 1.")
    const modes = within(decision()).getAllByRole("radio")
    expect(modes).toHaveLength(2)
    await user.click(modes[1]!)
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer)).toEqual([[36, { kind: "choose", choices: [2] }]])
  })

  it("several (built): up to the maximum; Forge's suggestion is the first draft, never sent by itself", async () => {
    const user = userEvent.setup()
    const question: Question = { type: "question", kind: "choose", id: 80, blocking: true, text: "Wähle bis zu zwei Farben", min: 0, max: 2, items: nonEmpty(["Weiß", "Blau", "Schwarz"].map((text, index) => ({ nr: index + 1, text }))), suggested: [2] }
    const { onAnswer } = built(question)
    const boxes = within(decision()).getAllByRole("checkbox")
    expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
    await user.click(boxes[0]!)
    // At the maximum the others wait until one is taken back.
    expect(within(decision()).getAllByRole("checkbox")[2]).toBeDisabled()
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer)).toEqual([[80, { kind: "choose", choices: [1, 2] }]])
  })

  it("choosing nothing where Forge allows it says so on the button", () => {
    const question: Question = { type: "question", kind: "choose", id: 81, blocking: true, text: "Wähle beliebig viele", min: 0, max: 3, items: nonEmpty(["A", "B", "C"].map((text, index) => ({ nr: index + 1, text }))) }
    built(question)
    expect(within(decision()).getByRole("button", { name: "Nichts wählen" })).toBeEnabled()
  })

  it("a long list gets a search field and says how many more match", async () => {
    const user = userEvent.setup()
    const names = Array.from({ length: 120 }, (_, index) => `Karte ${String(index + 1).padStart(3, "0")}`)
    const question: Question = { type: "question", kind: "choose", id: 82, blocking: true, text: "Nenne eine Karte", min: 1, max: 1, items: nonEmpty(names.map((text, index) => ({ nr: index + 1, text }))) }
    built(question)
    expect(within(decision()).getAllByRole("radio")).toHaveLength(50)
    expect(within(decision()).getByText("120 Einträge passen, die ersten 50 stehen hier – grenze die Suche ein, um die übrigen 70 zu finden.")).toBeInTheDocument()
    await user.type(within(decision()).getByRole("searchbox", { name: "In 120 Einträgen suchen" }), "Karte 11")
    const found = within(decision()).getAllByRole("radio")
    expect(found.map((radio) => radio.getAttribute("aria-labelledby") && document.getElementById(radio.getAttribute("aria-labelledby")!)?.textContent)).toEqual(
      Array.from({ length: 10 }, (_, index) => `Karte ${110 + index}`),
    )
    expect(within(decision()).queryByText(/Einträge passen/)).not.toBeInTheDocument()
  })

  it("cards to choose from (built): a row of their pictures; a tap marks, the button sends", async () => {
    const user = userEvent.setup()
    const scene = tableScene("scry")
    const arrange = scene.questions.find((question): question is ArrangeQuestion => question.kind === "arrange")!
    const question: Question = { type: "question", kind: "choose", id: 83, blocking: true, text: "Wähle eine Karte", min: 1, max: 1, items: nonEmpty(arrange.items) }
    const { onAnswer } = table("scry", { questions: [question] })
    const row = within(decision()).getByRole("toolbar", { name: "Karten zur Wahl" })
    const [first, second] = within(row).getAllByRole("button")
    await user.click(second!)
    expect(second).toHaveAttribute("data-mark", "selected")
    expect(first).toHaveAttribute("data-mark", "usable")
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer)).toEqual([[83, { kind: "choose", choices: [2] }]])
  })
})

describe("confirm (built)", () => {
  it("Forge's words for yes and no; its suggestion is highlighted, never chosen", async () => {
    const user = userEvent.setup()
    const question: Question = { type: "question", kind: "confirm", id: 90, blocking: true, text: "Möchtest du die Karte aufdecken?", suggested: false, yesLabel: "Aufdecken", noLabel: "Verdeckt lassen" }
    const { onAnswer } = built(question)
    const yes = within(decision()).getByRole("button", { name: "Aufdecken" })
    const no = within(decision()).getByRole("button", { name: "Verdeckt lassen" })
    expect(no).toHaveAttribute("data-variant", "default")
    expect(yes).toHaveAttribute("data-variant", "outline")
    expect(board()).toHaveAttribute("data-decision", "compact")
    await user.click(yes)
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    await user.click(yes)
    expect(answers(onAnswer)).toEqual([[90, { kind: "confirm", yes: true }]])
  })
})

describe("options", () => {
  it("which way to play a card (recorded): choose, confirm - or cancel", async () => {
    const user = userEvent.setup()
    const { onAnswer } = table("ability")
    expect(within(decision()).getByRole("button", { name: "Bestätigen" })).toHaveAccessibleDescription("Wähle eine Möglichkeit.")
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Abbrechen" }))
    expect(answers(onAnswer)).toEqual([[14, { kind: "options", option: 0 }]])
    await user.click(within(decision()).getByRole("radio", { name: "Damage can't be prevented this turn. Stomp deals 2 damage to any target." }))
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer).at(-1)).toEqual([14, { kind: "options", option: 2 }])
  })

  it("the asking card beside the question opens the card view as the question shows it", async () => {
    const user = userEvent.setup()
    table("ability")
    await user.click(within(decision()).getByRole("button", { name: "Bonecrusher Giant ansehen" }))
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Bonecrusher Giant")
  })

  it("a list Forge only shows (built): its cards to look at, and Forge's one button", async () => {
    const user = userEvent.setup()
    const damage = tableScene("damage").questions.find((question) => question.kind === "distribute")!
    const question: Question = { type: "question", kind: "options", id: 91, blocking: true, text: "Forge-KI deckt auf", items: [{ nr: 1, text: "OK" }], revealed: "items" in damage ? damage.items : [] }
    const { onAnswer } = table("damage", { questions: [question] })
    expect(within(within(decision()).getByRole("toolbar", { name: "Was Forge zeigt" })).getAllByRole("button")).toHaveLength(2)
    wait()
    await user.click(within(decision()).getByRole("button", { name: "OK" }))
    expect(answers(onAnswer)).toEqual([[91, { kind: "options", option: 1 }]])
  })
})

describe("input (built)", () => {
  it("a number: Forge's suggestion first, a misfit is never sent, Enter sends once armed", async () => {
    const user = userEvent.setup()
    const question: Question = { type: "question", kind: "input", id: 100, blocking: true, text: "Wähle X", numeric: true, suggested: "1" }
    const { onAnswer } = built(question)
    const field = within(decision()).getByRole("textbox", { name: "Deine Zahl" })
    expect(field).toHaveValue("1")
    expect(field).toHaveAttribute("inputmode", "numeric")
    await user.clear(field)
    await user.type(field, "2,5")
    const send = within(decision()).getByRole("button", { name: "Bestätigen" })
    expect(send).toBeDisabled()
    expect(send).toHaveAccessibleDescription("Nur eine ganze Zahl, ohne Komma oder Buchstaben.")
    expect(field).toHaveAttribute("aria-invalid", "true")
    await user.clear(field)
    await user.type(field, "4{Enter}")
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    await user.type(field, "{Enter}")
    expect(answers(onAnswer)).toEqual([[100, { kind: "input", value: "4" }]])
  })

  it("Forge's suggestions fill the field; only the button sends", async () => {
    const user = userEvent.setup()
    const question: Question = { type: "question", kind: "input", id: 101, blocking: true, text: "Nenne einen Kreaturentyp", numeric: false, suggested: null, items: [{ nr: 1, text: "Goblin" }, { nr: 2, text: "Elf" }] }
    const { onAnswer } = built(question)
    await user.click(within(decision()).getByRole("button", { name: "Elf" }))
    expect(within(decision()).getByRole("textbox", { name: "Deine Antwort" })).toHaveValue("Elf")
    expect(onAnswer).not.toHaveBeenCalled()
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer)).toEqual([[101, { kind: "input", value: "Elf" }]])
  })
})

describe("order (built)", () => {
  const triggers = (overrides: Partial<OrderQuestion> = {}): Question => ({
    type: "question",
    kind: "order",
    id: 110,
    blocking: true,
    text: "Ordne Reihenfolge für simultane Fähigkeiten neu",
    top: "Lege zuerst",
    remainingMin: 0,
    remainingMax: 0,
    items: ["A", "B", "C"].map((name, index) => ({ nr: index + 1, text: `Ausgelöste Fähigkeit ${name}` })),
    ...overrides,
  })

  it("order all: Forge's order first, moved with the arrows, then sent", async () => {
    const user = userEvent.setup()
    const { onAnswer } = built(triggers())
    expect(within(decision()).getByText("Lege die Reihenfolge aller 3 fest. Platz 1: Lege zuerst.")).toBeInTheDocument()
    const list = within(decision()).getByRole("region", { name: "Reihenfolge" })
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["11. Ausgelöste Fähigkeit A", "22. Ausgelöste Fähigkeit B", "33. Ausgelöste Fähigkeit C"])
    await user.click(within(decision()).getByRole("button", { name: "Ausgelöste Fähigkeit C nach oben" }))
    expect(within(decision()).getByRole("button", { name: "Ausgelöste Fähigkeit A nach oben" })).toBeDisabled()
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer)).toEqual([[110, { kind: "order", order: [1, 3, 2] }]])
  })

  it("some to pick: added and taken out; Forge's bounds decide when it can be sent", async () => {
    const user = userEvent.setup()
    const { onAnswer } = built(triggers({ id: 111, remainingMin: 1, remainingMax: 1, text: "Wähle zwei, in Reihenfolge" }))
    expect(within(decision()).getByRole("button", { name: "Bestätigen" })).toHaveAccessibleDescription("Wähle noch 2.")
    await user.click(within(decision()).getByRole("button", { name: "Ausgelöste Fähigkeit B hinzufügen" }))
    await user.click(within(decision()).getByRole("button", { name: "Ausgelöste Fähigkeit A hinzufügen" }))
    expect(within(decision()).getByRole("button", { name: "Ausgelöste Fähigkeit C hinzufügen" })).toBeDisabled()
    await user.click(within(decision()).getByRole("button", { name: "Ausgelöste Fähigkeit B herausnehmen" }))
    await user.click(within(decision()).getByRole("button", { name: "Ausgelöste Fähigkeit C hinzufügen" }))
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer)).toEqual([[111, { kind: "order", order: [1, 3] }]])
  })
})

describe("arrange (recorded: scrying 2)", () => {
  it("both cards stay on top first; one goes under the pile; the rest of the library in between", async () => {
    const user = userEvent.setup()
    const { onAnswer } = table("scry")
    expect(within(decision()).getByText("Bewege Karte an Anfang oder Ende der Bibliothek")).toBeInTheDocument()
    expect(within(decision()).getByText("… dazwischen 48 weitere Karten, die bleiben, wo sie sind …")).toBeInTheDocument()
    expect(board()).toHaveAttribute("data-decision", "expanded")
    await user.click(within(decision()).getByRole("button", { name: "Nach unten (Goblin-Brandstifter)" }))
    const bottom = within(decision()).getByRole("region", { name: "Unten – die letzte liegt ganz unten" })
    const moved = within(bottom).getAllByRole("listitem")
    expect(moved).toHaveLength(1)
    expect(moved[0]).toHaveTextContent("Goblin-Brandstifter")
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer)).toEqual([[31, { kind: "arrange", top: [2], bottom: [1] }]])
    await user.click(within(decision()).getByRole("button", { name: "Zurücksetzen" }))
    expect(within(within(decision()).getByRole("region", { name: "Oben – die erste liegt ganz oben" })).getAllByRole("listitem")).toHaveLength(2)
  })
})

describe("distribute (recorded: combat damage between two blockers)", () => {
  it("everyone at Forge's minimum first; the total and what is open; sent only when all is given out", async () => {
    const user = userEvent.setup()
    const { onAnswer } = table("damage")
    expect(within(decision()).getByText("0 von 2 verteilt · noch 2 offen")).toBeInTheDocument()
    const send = within(decision()).getByRole("button", { name: "Bestätigen" })
    expect(send).toHaveAccessibleDescription("Noch 2 zu verteilen.")
    await user.click(within(decision()).getByRole("button", { name: "Bei Canyon Minotaur einen mehr" }))
    await user.click(within(decision()).getByRole("button", { name: "Bei Canyon Minotaur einen mehr" }))
    expect(within(decision()).getByRole("button", { name: "Bei Raging Goblin einen mehr" })).toBeDisabled()
    expect(within(decision()).getByText("2 von 2 verteilt")).toBeInTheDocument()
    wait()
    await user.click(within(decision()).getByRole("button", { name: "Bestätigen" }))
    expect(answers(onAnswer)).toEqual([[46, { kind: "distribute", amounts: [2, 0] }]])
  })
})

describe("withdrawal and the next question", () => {
  it("a question Forge withdraws takes its controls and the draft with it; the next one starts afresh", async () => {
    const user = userEvent.setup()
    const { rerender, scene } = table("choose-mode")
    await user.click(within(decision()).getAllByRole("radio")[0]!)
    expect(within(decision()).getByRole("button", { name: "Bestätigen" })).toBeEnabled()
    // Forge withdraws it (the step's buttons remain): the mode list is gone.
    const rest = scene.questions.filter((question) => question.kind !== "choose")
    rerender({ questions: rest })
    expect(within(decision()).queryByRole("radio")).not.toBeInTheDocument()
    expect(within(decision()).getByRole("button", { name: "OK" })).toBeInTheDocument()
    // The same kind of question again, a new id: no draft carried over.
    const again = scene.questions.map((question) => (question.kind === "choose" ? { ...question, id: 99 } : question))
    rerender({ questions: again })
    expect(within(decision()).getAllByRole("radio").map((radio) => radio.getAttribute("aria-checked"))).toEqual(["false", "false"])
    expect(within(decision()).getByRole("button", { name: "Bestätigen" })).toBeDisabled()
  })

  it("nothing is answered without the player: rendering, waiting and new states send nothing", () => {
    const { onAnswer, rerender, scene } = table("choose-mode")
    wait(60_000)
    rerender({ state: { ...scene.state, seq: scene.state.seq + 1 } as GameState })
    rerender({ waiting: false })
    rerender({ waiting: true })
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("the decision region announces a new decision to screen readers (not every priority)", () => {
    const { rerender } = table("main-phase")
    const live = () => decision().querySelector('[aria-live="polite"]')!
    expect(live()).toHaveTextContent("")
    rerender({ questions: tableScene("choose-mode").questions })
    expect(live()).toHaveTextContent("Forge fragt: Auswahl")
  })
})
