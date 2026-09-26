/*
 * The turn, the priority and the stack as data (turn-model.ts, prompt 16) and
 * their German words (game-labels.ts): on real priorities of the recorded
 * games (the player's own main phase, the AI's turn, the AI's spell on the
 * stack, the player's answer on top of it) and on small states made for one
 * case each. Nothing here is a rule: every value is Forge's.
 */
import { checkGameState, PHASES, type ButtonsQuestion, type GameState, type Question } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { gameState } from "@/test/game-fixtures"
import { tableScene, type TableSceneName } from "@/test/table-scenes"
import { endTurnText, PASS_LABELS, PASS_NOTES, priorityText, STACK_KIND_LABELS, TURN_PHASE_LABELS, turnOwnerLabel } from "./game-labels"
import { priorityHolder, priorityMoment, priorityQuestion, stackKind, stackTop, TURN_PHASES, TURN_STEPS, turnSeat, turnSteps } from "./turn-model"

/** The recorded priority of a scene with what it is about. */
function momentOf(name: TableSceneName) {
  const scene = tableScene(name)
  const question = priorityQuestion(scene.questions)
  if (question === null) throw new Error(`${name}: no priority`)
  return { scene, moment: priorityMoment(scene.state, question) }
}

describe("the turn's steps", () => {
  it("are the protocol's phases, in Forge's order, in five phases", () => {
    expect(TURN_STEPS).toEqual(PHASES)
    expect(TURN_PHASES.map((phase) => [phase.key, phase.steps.length])).toEqual([
      ["beginning", 3],
      ["main1", 1],
      ["combat", 6],
      ["main2", 1],
      ["ending", 2],
    ])
    expect(TURN_PHASES.map((phase) => TURN_PHASE_LABELS[phase.key])).toEqual(["Anfangsphase", "Erste Hauptphase", "Kampfphase", "Zweite Hauptphase", "Endphase"])
  })

  it("the steps before Forge's step are over, the ones after it to come; before the first turn all are to come", () => {
    const states = (phase: GameState["phase"]) => turnSteps(phase).map((step) => step.state)
    expect(states("MAIN1")).toEqual(["done", "done", "done", "current", ...Array<string>(9).fill("upcoming")])
    expect(states("CLEANUP")).toEqual([...Array<string>(12).fill("done"), "current"])
    expect(states("UNTAP")).toEqual(["current", ...Array<string>(12).fill("upcoming")])
    expect(states(null)).toEqual(Array<string>(13).fill("upcoming"))
    expect(turnSteps("COMBAT_DAMAGE").find((step) => step.state === "current")).toEqual({ phase: "combat", step: "COMBAT_DAMAGE", state: "current" })
  })
})

describe("the player's priority (recorded)", () => {
  it("the own main phase with an empty stack: the game moves on when passing - 'Weiter'", () => {
    const { scene, moment } = momentOf("main-phase")
    expect(moment).toMatchObject({ turn: "me", depth: 0, top: null, pass: "continue", second: "endTurn" })
    expect(priorityHolder(scene.state)?.me).toBe(true)
    expect(PASS_LABELS[moment.pass]).toBe("Weiter")
    expect(priorityText(moment)).toBe("Du kannst jetzt eine Karte spielen – oder weitergeben.")
    // Forge asked because it found something the player can do (APINA): its finding, and its marker on a card.
    const me = scene.state.players.find((player) => player.me)!
    expect(me.canAct).toBe(true)
    expect(me.zones.hand.some((card) => "playable" in card && card.playable === true)).toBe(true)
  })

  it("in the AI's turn with an empty stack: the player holds an answer - Forge asks only then", () => {
    const { scene, moment } = momentOf("opponent-turn")
    expect(moment).toMatchObject({ turn: "opponent", top: null, pass: "continue", second: "endTurn" })
    expect(turnSeat(scene.state)).toBe("opponent")
    expect(priorityText(moment)).toBe("Zug der Forge-KI: Du kannst jetzt etwas spielen – oder weitergeben.")
    expect(scene.state.players.find((player) => player.me)!.canAct).toBe(true)
  })

  it("the AI's spell on top: answer it or let it resolve - 'Verrechnen lassen'", () => {
    const { scene, moment } = momentOf("respond")
    expect(moment.pass).toBe("resolve")
    expect(moment.top).toMatchObject({ kind: "spell", controller: "opponent" })
    expect(moment.top!.card).toEqual(scene.state.stack[0]!.card)
    expect(PASS_LABELS[moment.pass]).toBe("Verrechnen lassen")
    expect(priorityText(moment)).toBe(`Die Forge-KI hat „${moment.top!.card!.name}“ gewirkt. Du kannst darauf antworten – oder es verrechnen lassen.`)
  })

  it("the player's own answer on top of the AI's spell: still the player's priority", () => {
    const { scene, moment } = momentOf("respond-own")
    expect(moment.depth).toBeGreaterThanOrEqual(2)
    expect(moment.top).toMatchObject({ kind: "spell", controller: "me" })
    expect(scene.state.stack[1]!.player).not.toBe(scene.state.me)
    expect(priorityText(moment)).toBe(`Du hast „${moment.top!.card!.name}“ gewirkt. Du kannst noch etwas darauflegen – oder es verrechnen lassen.`)
  })

  it("under a blocking question the priority is not the decision (the mode of a spell is)", () => {
    expect(priorityQuestion(tableScene("choose-mode").questions)).toBeNull()
    expect(priorityQuestion(tableScene("opening").questions)).toBeNull()
  })
})

describe("the stack's top in words (built on a recorded state)", () => {
  const base = tableScene("main-phase").state
  const card = { id: 90, key: "Shock", name: "Schock", tapped: false, sick: false, faceDown: false, damage: 0, owner: 1, controller: 1 }
  const question = priorityQuestion(tableScene("main-phase").questions)!
  const withTop = (item: Partial<GameState["stack"][number]>): GameState =>
    checkGameState({ ...base, stack: [{ id: 5, text: "Schock (90) deals 2 damage to Player.", source: 90, card, player: base.players.find((p) => !p.me)!.id, ability: false, trigger: false, targets: [], ...item }] })

  it("a spell, an activated and a triggered ability, of either player - and a hidden card", () => {
    const ai = base.players.find((p) => !p.me)!.id
    const me = base.me!
    const text = (item: Partial<GameState["stack"][number]>) => priorityText(priorityMoment(withTop(item), question))
    expect(text({})).toBe("Die Forge-KI hat „Schock“ gewirkt. Du kannst darauf antworten – oder es verrechnen lassen.")
    expect(text({ ability: true })).toBe("Die Forge-KI hat eine Fähigkeit von „Schock“ aktiviert. Du kannst darauf antworten – oder sie verrechnen lassen.")
    expect(text({ ability: true, trigger: true })).toBe("„Schock“ der Forge-KI hat eine Fähigkeit ausgelöst. Du kannst darauf antworten – oder sie verrechnen lassen.")
    expect(text({ player: me })).toBe("Du hast „Schock“ gewirkt. Du kannst noch etwas darauflegen – oder es verrechnen lassen.")
    expect(text({ player: me, ability: true, trigger: true })).toBe("Deine Karte „Schock“ hat eine Fähigkeit ausgelöst. Du kannst noch etwas darauflegen – oder sie verrechnen lassen.")
    expect(text({ source: null, card: { hidden: true } })).toBe("Die Forge-KI hat einen verdeckten Zauberspruch gewirkt. Du kannst darauf antworten – oder es verrechnen lassen.")
    expect(text({ player: null })).toBe("Oben auf dem Stapel liegt „Schock“. Du kannst darauf antworten – oder es verrechnen lassen.")
    expect(stackTop(withTop({ player: ai, ability: true, trigger: true }))).toMatchObject({ kind: "trigger", controller: "opponent" })
  })

  it("what a stack item is comes from its own flags", () => {
    const item = withTop({}).stack[0]!
    expect(stackKind(item)).toBe("spell")
    expect(stackKind({ ...item, ability: true })).toBe("ability")
    expect(stackKind({ ...item, ability: true, trigger: true })).toBe("trigger")
    expect(Object.values(STACK_KIND_LABELS)).toEqual(["Zauberspruch", "Aktivierte Fähigkeit", "Ausgelöste Fähigkeit"])
  })
})

describe("Forge's second button", () => {
  const scene = tableScene("main-phase")
  const question = priorityQuestion(scene.questions)!
  const withSecond = (meaning: "endTurn" | "undo" | undefined, label: string): ButtonsQuestion => ({
    ...question,
    buttons: [question.buttons[0]!, { nr: 2, label, enabled: true, ...(meaning !== undefined ? { meaning } : {}) }],
  })

  it("says what it does: end the turn or undo - unknown stays unknown", () => {
    expect(priorityMoment(scene.state, withSecond("undo", "Rückgängig (1)")).second).toBe("undo")
    expect(priorityMoment(scene.state, withSecond("endTurn", "Zug beenden")).second).toBe("endTurn")
    expect(priorityMoment(scene.state, withSecond(undefined, "Etwas anderes")).second).toBeNull()
  })

  it("ending the turn is explained for whose turn it is", () => {
    expect(endTurnText("me")).toContain("bis dein Zug endet – ein noch ausstehender Angriff fällt damit weg")
    expect(endTurnText("opponent")).toContain("bis dieser Zug endet")
    expect(PASS_NOTES.continue).toContain("geht es zum nächsten Schritt")
    expect(PASS_NOTES.resolve).toContain("wird das Oberste auf dem Stapel verrechnet")
  })
})

describe("whose turn", () => {
  it("in words short enough for a small phone's header", () => {
    expect(turnOwnerLabel("me")).toBe("Du bist am Zug")
    expect(turnOwnerLabel("opponent")).toBe("Forge-KI am Zug")
    expect(turnOwnerLabel(null)).toBe("Die Starthände werden gezogen")
    expect(turnSeat(gameState(1))).toBeNull()
  })

  it("who holds priority is Forge's flag, or nobody", () => {
    const state = gameState(3, { turn: 2, phase: "UPKEEP", activePlayer: 1 })
    expect(priorityHolder(state)).toBeNull()
    const [me, ai] = state.players
    expect(priorityHolder({ ...state, players: [me!, { ...ai!, hasPriority: true }] })?.me).toBe(false)
    const questions: Question[] = []
    expect(priorityQuestion(questions)).toBeNull()
  })
})
