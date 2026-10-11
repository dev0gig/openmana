/*
 * A run of real consecutive game states for the table's motion (prompt 44,
 * docs/design/SPIELTISCH.md §8): what the real Forge engine showed the player,
 * state after state, in a stretch of a recorded test game where cards travel
 * (library → hand, hand → battlefield, hand → stack → graveyard, battlefield →
 * graveyard), turn (tapped and untapped), attack, take damage, and life totals
 * change. The motion's unit tests and the end-to-end test's table harness
 * (`?sequence=first-attack`) step through it like Forge's messages arrive.
 *
 * Source and folding as scripts/record-table-scenes.ts: the protocol messages
 * of a fixture game (engine/scripts/test-engine.sh's transcripts), folded
 * like EngineSession folds them; one step per state message, with the
 * questions, Forge's prompt line and the log entries that came before it.
 * Nothing is edited. The stretch is chosen from structured messages only:
 * from the first state of the first turn in which a creature of the player
 * attacks, up to the state in which a creature of the player first went from
 * the battlefield to the graveyard.
 *
 *   node scripts/record-table-sequence.ts [--transcripts <dir>] [--manifest <file>] [--out <file>]
 *
 * Output: src/test/fixtures/table-sequence.json.
 */
import fs from "node:fs"
import path from "node:path"
import type { EngineMessage, GameEvent, GameStarted, GameState, Question } from "../engine/protocol/src/index.ts"

const root = path.resolve(import.meta.dirname, "..")

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback
}

const FIXTURE = "human-3-de"
const transcriptsDir = path.resolve(option("--transcripts", path.join(root, "engine/build/report/transcripts")))
const outFile = path.resolve(option("--out", path.join(root, "src/test/fixtures/table-sequence.json")))

interface Step {
  readonly message: number
  readonly state: GameState
  readonly questions: readonly Question[]
  readonly prompt: string | null
  /** Forge's log entries since the previous step (they come before the state they explain). */
  readonly events: readonly GameEvent[]
}

const file = path.join(transcriptsDir, `${FIXTURE}.messages.jsonl`)
if (!fs.existsSync(file)) throw new Error(`${file} is missing: run bash engine/scripts/test-engine.sh first`)
const messages = fs
  .readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as EngineMessage)

let game: GameStarted | null = null
let questions: Question[] = []
let prompt: string | null = null
let pending: GameEvent[] = []
const history: GameEvent[] = []
const steps: (Step & { readonly history: number })[] = []
messages.forEach((message, index) => {
  switch (message.type) {
    case "game.started":
      game = message
      break
    case "events":
      pending = [...pending, ...message.entries]
      history.push(...message.entries)
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
      break
    case "state":
      steps.push({ message: index, state: message, questions, prompt, events: pending, history: history.length - pending.length })
      pending = []
      break
    default:
      break
  }
})
if (game === null) throw new Error(`${FIXTURE}: no game.started`)

const mine = (state: GameState) => state.players.find((player) => player.me)
const attacking = (state: GameState) => mine(state)?.zones.battlefield.some((card) => !("hidden" in card) && card.attacking === true) ?? false
const firstAttack = steps.findIndex((step) => attacking(step.state))
if (firstAttack < 0) throw new Error(`${FIXTURE}: the player never attacks`)
const turn = steps[firstAttack]!.state.turn
const first = steps.findIndex((step) => step.state.turn === turn)
const creatureIds = (state: GameState) => new Set(mine(state)?.zones.battlefield.flatMap((card) => (!("hidden" in card) && card.power !== undefined && card.power !== null ? [card.id] : [])) ?? [])
const last = steps.findIndex((step, index) => {
  if (index <= first) return false
  const before = creatureIds(steps[index - 1]!.state)
  return mine(step.state)?.zones.graveyard.some((card) => !("hidden" in card) && before.has(card.id)) ?? false
})
if (last < 0) throw new Error(`${FIXTURE}: no creature of the player goes to the graveyard after turn ${turn}`)

const stretch = steps.slice(first, last + 1)
const manifest = JSON.parse(fs.readFileSync(option("--manifest", path.join(root, "engine/build/dist/engine-manifest.json")), "utf8")) as {
  readonly builtAt: string
  readonly forge: { readonly commit: string }
  readonly protocol: { readonly version: number }
}
if ((game as GameStarted).protocol !== manifest.protocol.version) throw new Error("The transcript and the selected engine manifest have different protocol versions")
const output = {
  source: "Protocol messages of the fixture game human-3-de of engine/scripts/test-engine.sh (JVM run, scripted rule-free test player), folded like EngineSession folds them; see scripts/record-table-sequence.ts.",
  engine: { builtAt: manifest.builtAt, forgeCommit: manifest.forge.commit, protocol: manifest.protocol.version },
  name: "first-attack",
  description: `The player's first attacking turn (turn ${turn}) up to the first creature of the player in the graveyard (${FIXTURE}): ${stretch.length} consecutive states.`,
  fixture: FIXTURE,
  game,
  // Forge's log before the first step (the game's start, the mulligans …).
  history: history.slice(0, stretch[0]!.history),
  steps: stretch.map(({ message, state, questions: open, prompt: line, events }) => ({ message, state, questions: open, prompt: line, events })),
}
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, `${JSON.stringify(output)}\n`)
for (const step of stretch) {
  console.log(`#${step.message} turn ${step.state.turn} ${step.state.phase ?? "-"} stack ${step.state.stack.length} combat ${step.state.combat.length} events ${step.events.map((event) => event.kind).join(",")}`)
}
console.log(`→ ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB, ${stretch.length} states)`)
