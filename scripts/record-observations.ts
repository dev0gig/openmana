/*
 * Real observations for the tests of the opponent's turn (prompt 49): what
 * the real Forge engine (protocol 10, prompt 48) reported of the game at a few
 * telling moments of the recorded test games - the observation, the state it
 * follows (Observation.state) and the questions open at that moment, as the
 * app's engine session holds them.
 *
 * Source: the protocol messages of the fixture games `priority-respond-observe`
 * (the engine holds) and `lands` (it never holds) of a focused engine run
 * (`OPENMANA_FIXTURES=lands,priority-respond-observe bash engine/scripts/test-engine.sh`,
 * JVM, the transcripts in <build>/report/transcripts). Nothing is edited: each
 * entry is the first observation of the stream that matches its rule below,
 * decided from the structured messages only, so running this again on the same
 * transcripts gives the same file.
 *
 *   node scripts/record-observations.ts [--transcripts <dir>] [--manifest <file>] [--out <file>]
 *
 * Output: src/test/fixtures/observations.json.
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { EngineMessage, GameState, Observation, ObservedAction, Question } from "../engine/protocol/src/index.ts"

const root = path.resolve(import.meta.dirname, "..")

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback
}

const transcriptsDir = path.resolve(option("--transcripts", path.join(root, "engine/build/candidate-48/report/transcripts")))
const manifestFile = path.resolve(option("--manifest", path.join(transcriptsDir, "../../dist/engine-manifest.json")))
const outFile = path.resolve(option("--out", path.join(root, "src/test/fixtures/observations.json")))

interface Recorded {
  readonly name: string
  readonly fixture: string
  readonly observation: Observation
  readonly state: GameState
  readonly questions: readonly Question[]
}

type Rule = (observation: Observation, me: number) => boolean

const has = (observation: Observation, test: (action: ObservedAction) => boolean) => observation.actions.some(test)
const byOpponent = (action: ObservedAction, me: number) => action.player !== null && action.player !== me

/** Which moments are taken (name → rule), in this order; each the first observation of its fixture that matches. */
const RULES: readonly (readonly [string, string, Rule])[] = [
  ["held-turn-opponent", "priority-respond-observe", (o, me) => o.hold && has(o, (a) => a.kind === "turn" && byOpponent(a, me))],
  ["held-turn-me", "priority-respond-observe", (o, me) => o.hold && has(o, (a) => a.kind === "turn" && a.player === me)],
  ["unheld-turn-me", "priority-respond-observe", (o, me) => !o.hold && has(o, (a) => a.kind === "turn" && a.player === me)],
  ["held-land", "priority-respond-observe", (o, me) => o.hold && has(o, (a) => a.kind === "land" && byOpponent(a, me))],
  ["held-cast", "priority-respond-observe", (o, me) => o.hold && has(o, (a) => a.kind === "cast" && byOpponent(a, me))],
  ["cast-targets", "priority-respond-observe", (o) => has(o, (a) => (a.kind === "cast" || a.kind === "activate" || a.kind === "trigger") && a.targets.length > 0)],
  ["held-resolve-moves", "priority-respond-observe", (o, me) => o.hold && has(o, (a) => a.kind === "resolve" && byOpponent(a, me) && a.results.moves.length > 0)],
  ["resolve-damage", "priority-respond-observe", (o) => has(o, (a) => a.kind === "resolve" && a.results.damage.length > 0)],
  ["held-attack", "priority-respond-observe", (o, me) => o.hold && has(o, (a) => a.kind === "attack" && byOpponent(a, me))],
  ["block", "priority-respond-observe", (o) => has(o, (a) => a.kind === "block")],
  ["combat-damage", "priority-respond-observe", (o) => has(o, (a) => a.kind === "combatDamage" && a.results.life.length > 0)],
  ["own-land", "priority-respond-observe", (o, me) => !o.hold && has(o, (a) => a.kind === "land" && a.player === me)],
  ["unheld-attack", "lands", (o, me) => !o.hold && has(o, (a) => a.kind === "attack" && byOpponent(a, me))],
]

function read(fixture: string): EngineMessage[] {
  const file = path.join(transcriptsDir, `${fixture}.messages.jsonl`)
  if (!fs.existsSync(file)) throw new Error(`${file} is missing: run the focused engine run first`)
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as EngineMessage)
}

const recorded: Recorded[] = []
for (const [name, fixture, rule] of RULES) {
  const states = new Map<number, GameState>()
  let questions: Question[] = []
  let found: Recorded | null = null
  for (const message of read(fixture)) {
    if (message.type === "state") states.set(message.seq, message)
    else if (message.type === "question") questions = [...questions, message]
    else if (message.type === "question.answered" || message.type === "question.withdrawn") questions = questions.filter((question) => question.id !== message.id)
    else if (message.type === "observation") {
      const state = states.get(message.state)
      const me = state?.players.find((player) => player.me)?.id
      if (state === undefined || me === undefined) throw new Error(`${fixture}: observation ${message.id} follows no state`)
      if (rule(message, me)) {
        found = { name, fixture, observation: message, state, questions }
        break
      }
    }
  }
  if (found === null) throw new Error(`${fixture}: no observation for ${name}`)
  recorded.push(found)
}

const manifest = fs.existsSync(manifestFile) ? createHash("sha256").update(fs.readFileSync(manifestFile)).digest("hex") : null
const out = {
  comment: "Real observations of the Forge engine (protocol 10) for the tests of the opponent's turn - written by scripts/record-observations.ts, never edited.",
  engineManifestSha256: manifest,
  observations: recorded,
}
fs.writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`)
console.log(`${recorded.length} observations → ${path.relative(root, outFile)} (${fs.statSync(outFile).size} bytes)`)
