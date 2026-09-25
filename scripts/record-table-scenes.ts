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
    if (game !== null && state !== null) out.push({ index, game, state, questions, prompt, notices })
  })
  return out
}

const permanents = (state: GameState) => state.players.reduce((sum, player) => sum + player.zones.battlefield.length, 0)
const me = (state: GameState) => state.players.find((player) => player.me)

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
    description: "A late Commander turn while Forge asks the player: the most permanents with the most attackers (tokens, counters, poison, commander tax and damage) (commander).",
    fixture: "commander",
    fits: (m) => m.state.running && m.state.combat.length > 0 && m.questions.length > 0,
    best: (a, b) => permanents(b.state) - permanents(a.state) || b.state.combat.length - a.state.combat.length,
  },
  {
    name: "command-effects",
    description: "Forge's effect cards in the command zone of a Constructed game (an adventure; human-11).",
    fixture: "human-11",
    fits: (m) => m.state.players.some((player) => player.zones.command.length > 0) && m.questions.length > 0,
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
