/*
 * Real game scenes for the game table's tests (prompt 13): what the real
 * Forge engine showed the player at a few telling moments of the recorded
 * test games, as the app's engine session would hold it - the latest full
 * state, the questions open at that moment, Forge's prompt line and notices.
 *
 * Source: the protocol messages every fixture game of the differential
 * tests writes (engine/scripts/test-engine.sh, JVM run with the scripted
 * rule-free test player: engine/build/report/transcripts/*.messages.jsonl).
 * Nothing is edited: a scene is the message stream up to one message,
 * folded like EngineSession folds it. Which moment is taken is decided by
 * the rules below, from the structured messages only (never from texts),
 * so running this again on the same transcripts gives the same file.
 *
 *   node scripts/record-table-scenes.ts [--transcripts <dir>] [--out <file>]
 *
 * Output: src/test/fixtures/table-scenes.json (used by the unit tests of the
 * table and by the end-to-end test's table harness).
 */
import fs from "node:fs"
import path from "node:path"
import type { EngineMessage, GameMessage, GameStarted, GameState, InputRejected, Question } from "../engine/protocol/src/index.ts"

const root = path.resolve(import.meta.dirname, "..")

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback
}

const transcriptsDir = path.resolve(option("--transcripts", path.join(root, "engine/build/report/transcripts")))
const outFile = path.resolve(option("--out", path.join(root, "src/test/fixtures/table-scenes.json")))

/** What the session holds while a game runs (EngineSession, match status "playing"), at one message. */
interface Moment {
  readonly index: number
  /** The message of this moment (the last one folded in). */
  readonly last: EngineMessage
  readonly game: GameStarted
  readonly state: GameState
  readonly questions: readonly Question[]
  readonly prompt: string | null
  readonly notices: readonly (GameMessage | InputRejected)[]
}

function moments(fixture: string): Moment[] {
  const file = path.join(transcriptsDir, `${fixture}.messages.jsonl`)
  if (!fs.existsSync(file)) throw new Error(`${file} is missing: run bash engine/scripts/test-engine.sh first`)
  const messages = fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as EngineMessage)
  const out: Moment[] = []
  let game: GameStarted | null = null
  let state: GameState | null = null
  let questions: Question[] = []
  let prompt: string | null = null
  let notices: (GameMessage | InputRejected)[] = []
  messages.forEach((message, index) => {
    switch (message.type) {
      case "game.started":
        game = message
        break
      case "state":
        state = message
        break
      case "question":
        questions = [...questions, message]
        break
      case "question.answered":
      case "question.withdrawn":
        questions = questions.filter((question) => question.id !== message.id)
        break
      case "message":
        if (message.kind === "prompt") prompt = message.text.trim() === "" ? null : message.text
        else notices = [...notices, message].slice(-20)
        break
      case "input.rejected":
        notices = [...notices, message].slice(-20)
        break
      default:
        break
    }
    if (game !== null && state !== null) out.push({ index, last: message, game, state, questions, prompt, notices })
  })
  return out
}

const permanents = (state: GameState) => state.players.reduce((sum, player) => sum + player.zones.battlefield.length, 0)
const me = (state: GameState) => state.players.find((player) => player.me)
const open = <K extends Question["kind"]>(m: Moment, kind: K) => m.questions.filter((q): q is Extract<Question, { kind: K }> => q.kind === kind)
/** Forge's buttons without a purpose (play or draw, yes or no, OK/cancel of a selection). */
const plainButtons = (m: Moment) => open(m, "buttons").filter((q) => q.purpose === undefined)
/** Forge's payment is open and its own prompt line for it has come (it follows the question - Anvil lesson). */
const paying = (m: Moment) => open(m, "buttons").some((q) => q.purpose === "payment") && m.state.payment !== undefined && m.last.type === "message" && m.last.kind === "prompt"
/** The player's priority, alone (no blocking question over it). */
/**
 * Forge's declaration of attackers is open, at the state Forge sends once its buttons are asked (prompt 18): Forge marks
 * the creatures that can attack (its weakly-selectable cards) only after the question and its prompt line.
 */
const declaring = (m: Moment) =>
  open(m, "buttons").some((q) => q.purpose === "attack" || q.purpose === "attackDeclared") &&
  m.state.attack !== undefined &&
  m.questions.every((q) => !q.blocking) &&
  m.last.type === "state" &&
  m.prompt !== null
const reasons = (m: Moment) => new Set(m.state.attack?.unavailable.map((entry) => entry.reason) ?? []).size
const attackers = (m: Moment) => me(m.state)?.zones.battlefield.filter((card) => "attacking" in card && card.attacking === true).length ?? 0
const priority = (m: Moment) => open(m, "buttons").some((q) => q.purpose === "priority") && m.questions.every((q) => !q.blocking)

interface SceneRule {
  readonly name: string
  readonly description: string
  readonly fixture: string
  /** Picks one moment (first match unless `best` ranks them). */
  readonly fits: (moment: Moment) => boolean
  readonly best?: (a: Moment, b: Moment) => number
}

const RULES: readonly SceneRule[] = [
  {
    name: "opening",
    description: "The mulligan: seven cards in the player's hand, the AI's hand hidden, Forge's German prompt (human-3-de).",
    fixture: "human-3-de",
    fits: (m) => m.questions.some((q) => q.kind === "buttons" && q.purpose === "mulligan") && m.prompt !== null && (me(m.state)?.zones.hand.length ?? 0) > 0,
  },
  {
    name: "main-phase",
    description: "The player's own main phase with priority, lands and creatures on both sides, the most permanents of such moments (human-3-de).",
    fixture: "human-3-de",
    fits: (m) =>
      (m.state.phase === "MAIN1" || m.state.phase === "MAIN2") &&
      m.state.stack.length === 0 &&
      m.state.activePlayer === m.state.me &&
      m.questions.some((q) => q.kind === "buttons" && q.purpose === "priority"),
    best: (a, b) => permanents(b.state) - permanents(a.state),
  },
  {
    name: "stack",
    description: "A spell on the stack while Forge asks the player (human-3-de).",
    fixture: "human-3-de",
    fits: (m) => m.state.stack.length > 0 && m.questions.length > 0,
  },
  {
    name: "blockers",
    description: "Combat with an attacker blocked by two creatures (blocks-multi).",
    fixture: "blocks-multi",
    fits: (m) => m.state.combat.some((entry) => entry.blockers.length > 1),
  },
  {
    name: "defend",
    description: "The player's creature blocks while Forge asks for blockers (human-5-defend).",
    fixture: "human-5-defend",
    fits: (m) => (me(m.state)?.zones.battlefield.some((card) => "blocking" in card && card.blocking === true) ?? false) && m.questions.length > 0,
  },
  {
    name: "commander-late",
    description: "A late Commander turn while the player declares attackers: the most permanents with the most attackers (tokens, counters, poison, commander tax and damage) (commander).",
    fixture: "commander",
    fits: (m) => m.state.running && m.state.phase === "COMBAT_DECLARE_ATTACKERS" && m.state.combat.length > 0 && m.questions.length > 0,
    best: (a, b) => permanents(b.state) - permanents(a.state) || b.state.combat.length - a.state.combat.length,
  },
  {
    name: "command-effects",
    description: "Forge's effect cards in the command zone of a Constructed game (an adventure; human-11).",
    fixture: "human-11",
    fits: (m) => m.state.players.some((player) => player.zones.command.length > 0) && m.questions.length > 0,
  },
  // Forge's decisions (prompt 15): one real moment per kind of question the recorded games reach.
  {
    name: "play-draw",
    description: "The player won the coin toss: Forge's two buttons without a purpose (play or draw) before the opening hands (blocks-double).",
    fixture: "blocks-double",
    fits: (m) => m.state.turn === 0 && plainButtons(m).length > 0 && m.prompt !== null,
  },
  {
    name: "target",
    description: "A spell's target: Forge names the creatures to choose from (select), no player (Dismember), and waits with OK off and cancel on (targets-payment).",
    fixture: "targets-payment",
    fits: (m) =>
      open(m, "select").some((q) => q.items.length > 0) && m.state.players.every((player) => player.selectable !== true) && plainButtons(m).length > 0 && m.prompt !== null,
  },
  {
    name: "target-player",
    description: "A spell whose only targets are players: Forge's selection names no card, the state marks the players Forge takes (human-3-de).",
    fixture: "human-3-de",
    fits: (m) => open(m, "select").some((q) => q.items.length === 0) && plainButtons(m).length > 0 && m.prompt !== null,
  },
  {
    name: "yes-no",
    description: "A trigger that may be used: Forge's own yes/no as its two buttons (human-3-de).",
    fixture: "human-3-de",
    fits: (m) => m.state.turn > 0 && open(m, "select").length === 0 && plainButtons(m).some((q) => q.buttons.every((button) => button.enabled)) && m.prompt !== null,
  },
  {
    name: "discard",
    description: "Two cards to discard from the hand: a selection of more than one, with Forge's prompt for it and no buttons (Forge ends it by itself; human-11).",
    fixture: "human-11",
    fits: (m) => open(m, "select").some((q) => q.max >= 2) && m.last.type === "message" && m.last.kind === "prompt",
  },
  {
    name: "choose-mode",
    description: "A modal spell: choose one of its modes, a blocking question (human-3-de).",
    fixture: "human-3-de",
    fits: (m) => open(m, "choose").length > 0,
  },
  {
    name: "scry",
    description: "Scrying: the library's top cards to the top or the bottom (arrange), a blocking question (human-3-de).",
    fixture: "human-3-de",
    fits: (m) => open(m, "arrange").length > 0,
  },
  {
    name: "ability",
    description: "A card with two ways to play it (an adventure): which one, cancellable (options; human-11).",
    fixture: "human-11",
    fits: (m) => open(m, "options").length > 0,
  },
  {
    name: "damage",
    description: "An attacker blocked by two creatures: its combat damage to give out among them (distribute; blocks-double).",
    fixture: "blocks-double",
    fits: (m) => open(m, "distribute").length > 0,
  },
  // Priority, stack and phases (prompt 16): the player's priority in the AI's turn and with something on the stack.
  {
    name: "opponent-turn",
    description: "The player's priority in the AI's turn with the stack empty: Forge asks only because the player holds an answer (priority-respond).",
    fixture: "priority-respond",
    fits: (m) => priority(m) && m.state.activePlayer !== m.state.me && m.state.stack.length === 0 && m.state.turn > 2,
  },
  {
    name: "respond",
    description: "The player's priority with the AI's spell on top of the stack: answer it or let it resolve (priority-respond).",
    fixture: "priority-respond",
    fits: (m) => priority(m) && m.state.stack.length === 1 && m.state.stack[0]!.player !== m.state.me && m.state.turn > 2,
  },
  {
    name: "respond-own",
    description: "The player's answer on top of the AI's spell, and the player's priority again (stack depth 2; priority-respond).",
    fixture: "priority-respond",
    fits: (m) => priority(m) && m.state.stack.length >= 2 && m.state.stack[0]!.player === m.state.me,
  },
  // Targets and payment (prompt 17): players as targets, two targets, the payment with the pool and life, a decision while casting.
  {
    name: "target-both",
    description: "A spell with any target: Forge names the creatures and marks the players it would take (human-3-de).",
    fixture: "human-3-de",
    fits: (m) =>
      open(m, "select").some((q) => q.items.length > 0) && m.state.players.some((player) => player.selectable === true) && plainButtons(m).length > 0 && m.prompt !== null,
  },
  {
    name: "payment",
    description: "Paying a spell's cost by hand: Forge's payment with what is still to pay, the mana sources Forge marks, Auto and Cancel (targets-payment).",
    fixture: "targets-payment",
    fits: (m) => paying(m) && m.state.payment!.cost !== "0" && (me(m.state)?.zones.battlefield.some((card) => "playable" in card && card.playable === true) ?? false),
  },
  {
    name: "payment-pool",
    description: "Floating mana from Dark Ritual while a spell is paid: Forge would take it from the pool (targets-payment).",
    fixture: "targets-payment",
    fits: (m) => paying(m) && m.state.payment!.pool !== "",
  },
  {
    name: "payment-life",
    description: "Phyrexian mana: Forge's payment takes the player's life - their seat is marked (Gitaxian Probe, Dismember; targets-payment).",
    fixture: "targets-payment",
    fits: (m) => paying(m) && me(m.state)?.selectable === true,
  },
  {
    name: "cast-x",
    description: "A decision while a spell is cast: the value of X for Blaze, a blocking choice before its target and payment (targets-payment).",
    fixture: "targets-payment",
    fits: (m) => open(m, "choose").length > 0 && m.state.turn > 0,
  },
  // Declaring attackers (prompt 18): Forge's reasons why creatures stay back, declared attackers, a planeswalker to attack.
  {
    name: "attack",
    description: "Declaring attackers, none yet: creatures Forge would declare and creatures it names unavailable with its reasons - the most different reasons (attackers).",
    fixture: "attackers",
    fits: (m) => declaring(m) && attackers(m) === 0 && reasons(m) > 0 && (m.state.attack?.defenders.length ?? 0) === 1,
    best: (a, b) => reasons(b) - reasons(a),
  },
  {
    name: "attack-declared",
    description: "Attackers declared: Forge's Call Back instead of Alpha Strike, the attackers in combat, creatures that stay back (attackers).",
    fixture: "attackers",
    fits: (m) => declaring(m) && attackers(m) > 0 && open(m, "buttons").some((q) => q.purpose === "attackDeclared") && reasons(m) > 0,
  },
  {
    name: "attack-planeswalker",
    description: "A planeswalker of the AI's as the defender: two defenders to choose from, the player marked as the other one (attackers).",
    fixture: "attackers",
    fits: (m) => declaring(m) && m.state.attack?.defender?.kind === "card",
  },
]

const scenes = RULES.map((rule) => {
  const fitting = moments(rule.fixture).filter(rule.fits)
  if (fitting.length === 0) throw new Error(`no moment of ${rule.fixture} fits the scene "${rule.name}"`)
  const moment = rule.best ? [...fitting].sort((a, b) => rule.best!(a, b) || a.index - b.index)[0]! : fitting[0]!
  return {
    name: rule.name,
    description: rule.description,
    fixture: rule.fixture,
    message: moment.index,
    game: moment.game,
    state: moment.state,
    questions: moment.questions,
    prompt: moment.prompt,
    notices: moment.notices,
  }
})

const manifest = JSON.parse(fs.readFileSync(path.join(root, "engine/build/dist/engine-manifest.json"), "utf8")) as {
  readonly builtAt: string
  readonly forge: { readonly commit: string }
  readonly protocol: { readonly version: number }
}
const output = {
  source: "Protocol messages of the fixture games of engine/scripts/test-engine.sh (JVM run, scripted rule-free test player), folded like EngineSession folds them; see scripts/record-table-scenes.ts.",
  engine: { builtAt: manifest.builtAt, forgeCommit: manifest.forge.commit, protocol: manifest.protocol.version },
  scenes,
}
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, `${JSON.stringify(output, null, 1)}\n`)
for (const scene of scenes) {
  const state = scene.state
  console.log(
    `${scene.name.padEnd(16)} ${scene.fixture}#${scene.message} turn ${state.turn} ${state.phase ?? "-"} permanents ${permanents(state)} stack ${state.stack.length} combat ${state.combat.length} questions ${scene.questions.map((q) => q.kind).join(",")}`,
  )
}
console.log(`→ ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`)
