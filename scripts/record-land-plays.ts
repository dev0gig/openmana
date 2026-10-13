/*
 * Real land plays for the tests of the land and refusal hints (prompt 51):
 * what the real Forge engine (protocol 10, prompt 48) reported of the
 * player's land plays at the telling moments of the recorded fixture game
 * `lands` - green lands, Exploration (an additional land each turn) and
 * Rampant Growth (a basic land from the library onto the battlefield, no land
 * play) against red: Forge's `landsPlayed`/`landsAllowed`, its reasons on the
 * lands of the hand (`landRefusal`), the questions open at that moment, as the
 * app's engine session holds them.
 *
 * Source: the protocol messages of the fixture game of a focused engine run
 * (`OPENMANA_FIXTURES=lands,… bash engine/scripts/test-engine.sh`, JVM, the
 * transcripts in <build>/report/transcripts). Nothing is edited: each entry
 * is the first moment of the stream that matches its rule below, decided
 * from the structured messages only (never from names or texts), so running
 * this again on the same transcripts gives the same file.
 *
 *   node scripts/record-land-plays.ts [--transcripts <dir>] [--manifest <file>] [--out <file>]
 *
 * Output: src/test/fixtures/land-plays.json.
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { EngineMessage, GameState, LandRefusal, Observation, Player, Question, VisibleCard } from "../engine/protocol/src/index.ts"

const root = path.resolve(import.meta.dirname, "..")

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback
}

const transcriptsDir = path.resolve(option("--transcripts", path.join(root, "engine/build/candidate-48/report/transcripts")))
const manifestFile = path.resolve(option("--manifest", path.join(transcriptsDir, "../../dist/engine-manifest.json")))
const outFile = path.resolve(option("--out", path.join(root, "src/test/fixtures/land-plays.json")))
const FIXTURE = "lands"

interface Recorded {
  readonly name: string
  readonly fixture: string
  readonly state: GameState
  readonly questions: readonly Question[]
  /** Where it matters: Forge's state just before (the land put onto the battlefield by an effect). */
  readonly before?: GameState
  /** Where it matters: Forge's observation the state follows (the resolution that moved the land). */
  readonly observation?: Observation
}

interface Moment {
  readonly state: GameState
  readonly questions: readonly Question[]
  readonly me: Player
  readonly mine: boolean
  readonly priority: boolean
}

const hand = (me: Player) => me.zones.hand.filter((card): card is VisibleCard => !("hidden" in card))
const refused = (me: Player, reason: LandRefusal) => hand(me).filter((card) => card.landRefusal === reason)
/** The cards Forge gave a land reason in any state so far: lands by Forge's own check (it reasons only about lands). */
const lands = new Set<number>()
const playableLand = (me: Player) => hand(me).some((card) => card.playable === true && lands.has(card.id))

/** The first moment of the game each rule takes (name → rule), in this order. */
const RULES: readonly (readonly [string, (moment: Moment, taken: ReadonlyMap<string, Recorded>) => boolean])[] = [
  // The start questions: Forge sends its reasons for the opening hand already - nobody's turn yet.
  ["before-start", (m) => m.state.turn === 0 && refused(m.me, "notYourTurn").length > 0 && m.questions.length > 0],
  // The AI's turn: every land of the hand refused, not the player's turn.
  ["opponent-turn", (m) => m.state.turn > 0 && !m.mine && refused(m.me, "notYourTurn").length > 0],
  // The player's first main phase with a land to play: 0 of 1, the lands playable, Forge's priority.
  ["first-land", (m) => m.mine && m.priority && m.state.phase === "MAIN1" && m.me.landsPlayed === 0 && playableLand(m.me)],
  // Right after the first land: 1 of 1, the other lands refused - the limit.
  ["land-played", (m, taken) => m.mine && m.priority && m.state.turn === taken.get("first-land")?.state.turn && m.me.landsPlayed === 1 && m.me.landsAllowed === 1 && refused(m.me, "limit").length > 0],
  // The player's turn, not when a sorcery could be cast (a spell on the stack, the upkeep …): Forge says when.
  ["timing", (m) => m.mine && m.state.turn > 0 && refused(m.me, "timing").length > 0],
  // A later own turn: the land refused before is playable again, 0 of 1.
  [
    "next-turn",
    (m, taken) => {
      const before = taken.get("land-played")
      if (before === undefined || !m.mine || !m.priority || m.state.turn <= before.state.turn || m.me.landsPlayed !== 0) return false
      const ids = new Set(refused(before.state.players.find((player) => player.me)!, "limit").map((card) => card.id))
      return hand(m.me).some((card) => ids.has(card.id) && card.playable === true)
    },
  ],
  // Exploration on the battlefield: Forge allows two - after one land, the next is still playable (1 of 2).
  ["extra-allowed", (m) => m.mine && m.priority && m.me.landsAllowed === 2 && m.me.landsPlayed === 1 && playableLand(m.me)],
  // Both lands of the turn played: 2 of 2.
  ["extra-used", (m) => m.mine && m.me.landsAllowed === 2 && m.me.landsPlayed === 2],
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

const messages = read(FIXTURE)
const taken = new Map<string, Recorded>()
const states = new Map<number, GameState>()
let state: GameState | null = null
let questions: Question[] = []
let byEffect: Recorded | null = null
for (const message of messages) {
  if (message.type === "state") {
    states.set(message.seq, message)
    state = message
    for (const player of message.players) if (player.me) for (const card of hand(player)) if (card.landRefusal !== undefined) lands.add(card.id)
  } else if (message.type === "question") questions = [...questions, message]
  else if (message.type === "question.answered" || message.type === "question.withdrawn") questions = questions.filter((question) => question.id !== message.id)
  else if (message.type === "observation" && byEffect === null) {
    // Rampant Growth: the player's resolution moving a land from the library onto the battlefield (a move in its results).
    const after = states.get(message.state)
    const me = after?.players.find((player) => player.me)
    const moved = message.actions.some((action) => action.kind === "resolve" && action.player === me?.id && action.results.moves.some((move) => move.from?.zone === "library" && move.to?.zone === "battlefield"))
    if (after !== undefined && me !== undefined && moved) {
      const before = [...states.values()].filter((each) => each.seq < after.seq).at(-1)
      if (before === undefined) throw new Error(`${FIXTURE}: no state before ${after.seq}`)
      byEffect = { name: "land-by-effect", fixture: FIXTURE, state: after, questions, before, observation: message }
    }
  }
  if (state === null) continue
  const me = state.players.find((player) => player.me)
  if (me === undefined) continue
  const moment: Moment = { state, questions, me, mine: state.activePlayer === me.id, priority: questions.some((question) => question.kind === "buttons" && question.purpose === "priority") }
  for (const [name, rule] of RULES) {
    if (!taken.has(name) && rule(moment, taken)) taken.set(name, { name, fixture: FIXTURE, state, questions })
  }
}

const recorded: Recorded[] = []
for (const [name] of RULES) {
  const found = taken.get(name)
  if (found === undefined) throw new Error(`${FIXTURE}: no moment for ${name}`)
  recorded.push(found)
}
if (byEffect === null) throw new Error(`${FIXTURE}: no land put onto the battlefield by an effect`)
recorded.push(byEffect)

const manifest = fs.existsSync(manifestFile) ? createHash("sha256").update(fs.readFileSync(manifestFile)).digest("hex") : null
const out = {
  comment: "Real land plays of the Forge engine (protocol 10) for the tests of the land and refusal hints - written by scripts/record-land-plays.ts, never edited.",
  engineManifestSha256: manifest,
  moments: recorded,
}
fs.writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`)
console.log(`${recorded.length} moments → ${path.relative(root, outFile)} (${fs.statSync(outFile).size} bytes)`)
for (const each of recorded) {
  const me = each.state.players.find((player) => player.me)!
  console.log(`  ${each.name}: turn ${each.state.turn} ${each.state.phase ?? "-"}, lands ${me.landsPlayed}/${me.landsAllowed}, refusals ${hand(me).map((card) => card.landRefusal ?? (card.playable ? "playable" : "-")).join(",")}, questions ${each.questions.map((question) => question.kind).join(",")}`)
}
