/*
 * Real recorded games for the tests of the match report (prompt 62,
 * src/matches/report.ts): complete fixture games of the engine's differential
 * tests turned into recordings as the app's MatchRecorder writes them - the
 * player's inputs and Forge's messages in reception order.
 *
 * Source: the transcripts every fixture game of `bash engine/scripts/test-engine.sh`
 * writes (JVM run, scripted rule-free test player; <build>/report/transcripts):
 * `<fixture>.messages.jsonl` (Forge's messages as sent) and `<fixture>.json`
 * (the match request and the player's inputs). Nothing of Forge's is edited;
 * the engine's diagnostics trace (hidden information) is left out, as the
 * recorder leaves it out. Each input is put where Forge read it: right after
 * the trace's checkpoint `input` with the number of inputs read before it
 * (the engine takes that checkpoint whenever it waits for the next input).
 * Every acknowledgement of an input (question.answered, input.rejected,
 * settings.applied, observation.released) must come after it, or the script
 * stops. The test player's deliberately malformed probes (an input the
 * protocol's schema refuses, such as button 3) are left out: the app's client
 * refuses such an input before it reaches the engine, so a recording never
 * holds one - Forge's input.rejected for it stays, as Forge sent it. Games with held observations are not taken: the engine does not
 * trace inputs read while it holds one, so their place is not known exactly.
 *
 * The header is built (like src/test/fixtures/replay.json's): a fixed id and
 * start, Forge's game.end as its end, the engine named by the manifest, no
 * engine.ready (the transcripts do not have it) and no timing (every `at` is 0).
 *
 *   node scripts/record-report-games.ts [--transcripts <dir>] [--manifest <file>] [--out <file>]
 *
 * Output: src/test/fixtures/report-games.json.gz (gzip: the full states of
 * five whole games are several MB of very repetitive JSON).
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { checkEngineInput, type EngineInput, type EngineMessage, type GameEnd, type MatchRequest } from "../engine/protocol/src/index.ts"
import { SCHEMA_VERSION } from "../src/storage/generated/constants.ts"

const root = path.resolve(import.meta.dirname, "..")

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback
}

const transcriptsDir = path.resolve(option("--transcripts", path.join(root, "engine/build/publish-52h/report/transcripts")))
const manifestFile = path.resolve(option("--manifest", path.join(transcriptsDir, "../../dist/engine-manifest.json")))
const outFile = path.resolve(option("--out", path.join(root, "src/test/fixtures/report-games.json.gz")))

/** The games, what each is for in the tests, and its fixed recording id. */
const GAMES: readonly { readonly fixture: string; readonly id: string; readonly why: string }[] = [
  { fixture: "human-3-de", id: "00000000-0000-4000-8000-000000000621", why: "a whole game lost, Forge speaking German: lands, spells, attacks and blocks of both, an arrangement and a mode chosen" },
  { fixture: "human-5-defend", id: "00000000-0000-4000-8000-000000000622", why: "a whole game lost in English: the player blocks often" },
  { fixture: "targets-payment", id: "00000000-0000-4000-8000-000000000623", why: "targets, payments with mana from the pool and life (Phyrexian mana)" },
  { fixture: "human-3-concede", id: "00000000-0000-4000-8000-000000000624", why: "a short game the player concedes, with a mulligan" },
  { fixture: "commander", id: "00000000-0000-4000-8000-000000000625", why: "a commander game the player wins: the command zone, 40 life" },
]

interface Transcript {
  readonly format: string
  readonly name: string
  readonly request: MatchRequest
  readonly inputs: readonly EngineInput[]
  readonly engine: { readonly language: string; readonly cardLanguage: string; readonly cardLoading: string }
}

interface TraceEntry {
  readonly type: "diagnostics.trace"
  readonly at: "input" | "phase" | "end"
  readonly inputs: number
}

const manifestBytes = fs.readFileSync(manifestFile)
const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
  readonly forge: { readonly commit: string; readonly versionCode: string }
  readonly protocol: { readonly version: number }
}
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex")

/** The seq an engine message acknowledges, if it acknowledges an input. */
function acknowledged(message: EngineMessage): number | null {
  switch (message.type) {
    case "question.answered":
    case "input.rejected":
    case "observation.released":
      return message.seq
    case "settings.applied":
      return message.seq
    default:
      return null
  }
}

/** An input the protocol's schema takes (the app's client refuses any other before sending it). */
function valid(input: EngineInput): boolean {
  try {
    checkEngineInput(input)
    return true
  } catch {
    return false
  }
}

function game(fixture: string, id: string, why: string): unknown {
  const transcript = JSON.parse(fs.readFileSync(path.join(transcriptsDir, `${fixture}.json`), "utf8")) as Transcript
  const messages = fs
    .readFileSync(path.join(transcriptsDir, `${fixture}.messages.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as EngineMessage | TraceEntry)
  if (transcript.request.settings?.observation === "hold") throw new Error(`${fixture}: held observations - the place of inputs read while holding is not traced`)
  // Where each input was read: after the first checkpoint "input" with that many inputs read before it.
  const readAfter = new Map<number, number>()
  messages.forEach((message, index) => {
    if (message.type === "diagnostics.trace" && message.at === "input" && !readAfter.has(message.inputs)) readAfter.set(message.inputs, index)
  })
  const placed = new Map<number, EngineInput[]>()
  transcript.inputs.forEach((input, ordinal) => {
    if (input.seq !== ordinal + 1) throw new Error(`${fixture}: input ${ordinal + 1} has seq ${input.seq}`)
    const index = readAfter.get(ordinal)
    if (index === undefined) throw new Error(`${fixture}: no checkpoint before input ${input.seq}`)
    placed.set(index, [...(placed.get(index) ?? []), input])
  })
  const log: { matchId: string; seq: number; at: number; from: "engine" | "player"; message: unknown }[] = []
  const append = (from: "engine" | "player", message: unknown) => log.push({ matchId: id, seq: log.length, at: 0, from, message })
  const args = [`--card-loading=${transcript.engine.cardLoading}`, `--language=${transcript.engine.language}`, `--card-language=${transcript.engine.cardLanguage}`]
  append("player", { type: "recording.boot", args })
  append("player", { type: "match.start", match: transcript.request })
  const sent = new Set<number>()
  let probes = 0
  let end: GameEnd | null = null
  messages.forEach((message, index) => {
    if (message.type !== "diagnostics.trace") {
      const seq = acknowledged(message)
      if (seq !== null && !sent.has(seq)) throw new Error(`${fixture}: message ${index} (${message.type}) acknowledges input ${seq} before it was read`)
      if (message.type === "game.end") end = message
      append("engine", message)
    }
    for (const input of placed.get(index) ?? []) {
      sent.add(input.seq)
      if (valid(input)) append("player", input)
      else probes++
    }
  })
  if (sent.size !== transcript.inputs.length) throw new Error(`${fixture}: ${transcript.inputs.length - sent.size} inputs not placed`)
  console.log(`${fixture}: ${transcript.inputs.length} inputs, ${probes} malformed probes left out`)
  const finished = end as GameEnd | null
  if (finished === null) throw new Error(`${fixture}: no game.end`)
  const deck = (value: MatchRequest["human"]["deck"]) => ({ name: value.name, main: value.main, sideboard: value.sideboard ?? [], commander: value.commander ?? [] })
  const startedAt = "2026-10-14T00:00:00.000Z"
  return {
    name: fixture,
    why,
    replay: {
      format: "openmana-replay",
      version: 1,
      schemaVersion: SCHEMA_VERSION,
      match: {
        id,
        status: "finished",
        format: transcript.request.format,
        startedAt,
        endedAt: "2026-10-14T00:30:00.000Z",
        seed: transcript.request.seed ?? null,
        app: { version: "0.0.0-report-fixture", commit: null },
        engine: {
          id: manifestSha256.slice(0, 16),
          protocol: manifest.protocol.version,
          forgeVersion: manifest.forge.versionCode,
          forgeCommit: manifest.forge.commit,
          buildCommit: "0000000000000000000000000000000000000000",
          sourcesModified: false,
          manifestSha256,
        },
        human: { name: transcript.request.human.name, deckId: null, deck: deck(transcript.request.human.deck) },
        ai: { name: transcript.request.ai.name, profile: transcript.request.ai.profile, deckId: null, deck: deck(transcript.request.ai.deck) },
        end: { result: finished.result, reason: finished.reason, turns: finished.turns, conceded: finished.conceded },
      },
      log,
    },
  }
}

const output = {
  comment:
    "Whole fixture games of engine/scripts/test-engine.sh (JVM, scripted rule-free test player) as recordings - Forge's messages unchanged and in order, the diagnostics trace left out, each player input placed at the engine checkpoint where Forge read it; header built (fixed id and times, no engine.ready, no timing). Written by scripts/record-report-games.ts, never edited.",
  engineManifestSha256: manifestSha256,
  games: GAMES.map((each) => game(each.fixture, each.id, each.why)),
}
fs.writeFileSync(outFile, zlib.gzipSync(Buffer.from(JSON.stringify(output)), { level: 9 }))
console.log(`${path.relative(root, outFile)}: ${GAMES.length} games, ${fs.statSync(outFile).size} bytes`)
