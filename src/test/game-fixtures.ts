/*
 * The engine for tests of the game session and its pages: the REAL
 * EngineClient (schema and order checks of every message, question
 * bookkeeping, the SharedArrayBuffer input queue, the watchdogs on test
 * timers) over a scripted fake worker. So a test script that sends a message
 * the real engine could not send fails like the real client would.
 *
 * The messages follow what the real engine sent when a game started and the
 * player conceded (recorded in Node with the engine of prompt 05,
 * --language=de-DE, prompt 11): game.started, three full states, the
 * mulligan question without text, Forge's prompt line, engine.waiting; after
 * the concession an empty prompt, the question withdrawn, the log, a last
 * state, game.end, match.finished. The real engine itself is exercised end to
 * end (scripts/e2e/run.ts).
 */
import { EngineClient, type EngineClientTimers, type EngineWorkerPortFactory, type EngineWorkerPortHandlers } from "@openmana/engine-client"
import {
  inputQueueReader,
  PROTOCOL_VERSION,
  type Button,
  type EngineMessage,
  type FeatureReport,
  type FeatureScope,
  type GameState,
  type InputQueueReader,
  type MatchSummary,
  type Question,
  type VisibleCard,
  type WorkerCommand,
} from "@openmana/engine-protocol"
import type { EngineAssets } from "@/engine/engine-assets-types"
import { EngineSession, type EngineLaunch } from "@/engine/engine-session"
import type { MatchSetup } from "@/engine/engine-session"

export const TEST_ASSETS: EngineAssets = {
  available: true,
  id: "0123456789abcdef",
  workerUrl: "/engine/0123456789abcdef/engine-worker.js",
  launcherUrl: "/engine/0123456789abcdef/openmana-engine.js",
  wasmUrl: "/engine/0123456789abcdef/openmana-engine.js.wasm",
  manifestUrl: "/engine/0123456789abcdef/engine-manifest.json",
  build: {
    manifestSha256: "a".repeat(64),
    builtAt: "2026-09-24T00:00:00.000Z",
    forgeRepository: "https://github.com/Card-Forge/forge",
    forgeCommit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798",
    forgeVersionCode: "2.0.15",
    patchCount: 6,
    protocolVersion: PROTOCOL_VERSION,
    graalvm: "25.4.4.1.1",
    downloadBytes: 100,
    downloadBrotliBytes: 50,
    wasmBytes: 80,
  },
}

export const SUPPORTED: FeatureReport = {
  webAssembly: true,
  wasmGc: true,
  wasmExnref: true,
  wasmTypedFunctionReferences: true,
  crossOriginIsolated: true,
  sharedArrayBuffer: true,
  atomicsWait: true,
  worker: true,
  missing: [],
  supported: true,
}

/** What the client's feature detection looks at, answering like a capable, isolated browser. */
export const SUPPORTED_SCOPE: FeatureScope = {
  WebAssembly: { validate: () => true },
  SharedArrayBuffer,
  Atomics: { wait: () => "ok" },
  crossOriginIsolated: true,
  Worker: function Worker() {},
}

export const READY: EngineMessage = {
  type: "engine.ready",
  protocol: PROTOCOL_VERSION,
  engine: {
    forgeVersion: "GIT",
    forgeCommit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798",
    forgeVersionCode: "2.0.15",
    patchCount: 6,
    patchesSha256: "d434f05792db3addec2bcc386318a7cdb5e0e3f4f1394d5490a73d28d3238ad7",
    openmanaCommit: "0ddfbc3000000000000000000000000000000000",
    engineSourcesModified: false,
    synchronous: true,
    resourcesSha256: "7e8aebee24e13111188a163cd5f7162ded2411728a85c6abc9ac2f5d5a0e6053",
  },
  boot: {
    resourceFiles: 36905,
    resourceBytes: 44327452,
    unpackMillis: 900,
    forgeInitMillis: 2000,
    cardLoading: "eager",
    language: "de-DE",
    cardLanguage: "de-DE",
    aiProfiles: ["Cautious", "Default", "Experimental", "Reckless"],
  },
  t: 4000,
}

/** engine.ready as the real engine answers these boot arguments (the card language, like --card-language). */
export function readyFor(args: readonly string[]): EngineMessage {
  if (READY.type !== "engine.ready") throw new Error("READY is engine.ready")
  const cardLanguage = args.find((arg) => arg.startsWith("--card-language="))?.slice("--card-language=".length)
  return cardLanguage === "en-US" || cardLanguage === "de-DE" ? { ...READY, boot: { ...READY.boot, cardLanguage } } : READY
}

export function started(format: "constructed" | "commander" = "constructed"): EngineMessage {
  return { type: "game.started", protocol: PROTOCOL_VERSION, human: "Spieler", ai: "Forge-KI", aiProfile: "Default", format, cardNames: ["Forest", "Grizzly Bears", "Mountain", "Shock"] }
}

function handCard(id: number, key: string): VisibleCard {
  return { id, key, name: key, tapped: false, sick: false, faceDown: false, damage: 0, owner: 0, controller: 0 }
}

/** A full state as the player sees it: 7 cards each (the AI's hidden), 53 in each library. */
export function gameState(seq: number, overrides: Partial<Pick<GameState, "turn" | "phase" | "activePlayer" | "running">> & { myLife?: number; aiLife?: number } = {}): GameState {
  const hand = [1, 2, 3, 4].map((id) => handCard(id, "Mountain")).concat([5, 6, 7].map((id) => handCard(id, "Shock")))
  return {
    type: "state",
    seq,
    running: overrides.running ?? true,
    turn: overrides.turn ?? 0,
    phase: overrides.phase ?? null,
    activePlayer: overrides.activePlayer ?? null,
    me: 0,
    players: [
      {
        id: 0, name: "Spieler", ai: false, me: true, life: overrides.myLife ?? 20, hasPriority: false, canAct: true, lost: false, maxHandSize: 7,
        landsPlayed: 0, landsAllowed: 1, counters: {}, mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        zones: { battlefield: [], hand, graveyard: [], exile: [], command: [] }, library: 53, commanders: [],
      },
      {
        id: 1, name: "Forge-KI", ai: true, me: false, life: overrides.aiLife ?? 20, hasPriority: false, canAct: false, lost: false, maxHandSize: 7,
        landsPlayed: 0, landsAllowed: 1, counters: {}, mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        zones: { battlefield: [], hand: Array.from({ length: 7 }, () => ({ hidden: true as const })), graveyard: [], exile: [], command: [] }, library: 53, commanders: [],
      },
    ],
    stack: [],
    combat: [],
  }
}

export function mulligan(id = 1): Question {
  return { type: "question", kind: "buttons", id, blocking: false, text: "", purpose: "mulligan", buttons: [{ nr: 1, label: "Behalten", enabled: true }, { nr: 2, label: "Mulligan", enabled: true }] }
}

/** Forge's own prompt line for the mulligan (German, verbatim from the engine). */
export const MULLIGAN_PROMPT = "Forge-KI beginnt.. Spieler, Du startest 2te.  Starthand behalten?"

/** Forge's buttons of the priority step as the real engine sends them (German, protocol 5: with what each does). */
export const PRIORITY_BUTTONS = [
  { nr: 1, label: "OK", enabled: true, meaning: "pass" },
  { nr: 2, label: "Zug beenden", enabled: true, meaning: "endTurn" },
] as const satisfies readonly Button[]

export function gameEnd(conceded = true): EngineMessage {
  return {
    type: "game.end",
    winner: "Forge-KI",
    reason: "AllOpponentsLost",
    turns: 0,
    result: "loss",
    players: [
      { id: 0, name: "Spieler", life: 20, me: true },
      { id: 1, name: "Forge-KI", life: 20, me: false },
    ],
    conceded,
  }
}

export function summary(inputs = 1): MatchSummary {
  return {
    winner: "Forge-KI",
    reason: "AllOpponentsLost",
    turns: 0,
    result: "loss",
    players: [
      { id: 0, name: "Spieler", life: 20, me: true },
      { id: 1, name: "Forge-KI", life: 20, me: false },
    ],
    conceded: true,
    gameMillis: 207,
    inputs,
    logEntries: 8,
    logSha256: "a".repeat(64),
    protocolMessages: 9,
    protocolSha256: "b".repeat(64),
    forgeCallbacks: { finishGame: 1 },
    forgeErrors: [],
    threadViolations: [],
  }
}

/** Test clock for the client's timers (ready timeout, stall watchdog). */
export class FakeTimers implements EngineClientTimers {
  time = 0
  #next = 1
  readonly pending = new Map<number, { at: number; callback: () => void }>()
  now = () => this.time
  setTimeout = (callback: () => void, ms: number) => {
    const id = this.#next++
    this.pending.set(id, { at: this.time + ms, callback })
    return id
  }
  clearTimeout = (handle: unknown) => {
    this.pending.delete(handle as number)
  }
  advance(ms: number): void {
    this.time += ms
    for (const [id, timer] of [...this.pending].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at <= this.time && this.pending.has(id)) {
        this.pending.delete(id)
        timer.callback()
      }
    }
  }
}

/** A scripted engine worker: records commands, speaks for the engine, reads the input queue. */
export class FakeEngineWorker {
  readonly commands: WorkerCommand[] = []
  terminated = false
  #reader: InputQueueReader | null = null
  #handlers: EngineWorkerPortHandlers | null = null

  readonly factory: EngineWorkerPortFactory = (handlers) => {
    this.#handlers = handlers
    return {
      post: (command) => {
        this.commands.push(command)
        if (command.type === "engine.start") this.#reader = inputQueueReader(command.queue)
      },
      terminate: () => {
        this.terminated = true
      },
    }
  }

  /** The worker posts a message (structured clone, like postMessage). */
  send(message: unknown): void {
    if (!this.#handlers) throw new Error("the worker was never created")
    this.#handlers.message(structuredClone(message))
  }

  /** The worker itself fails (script error). */
  crash(message: string): void {
    this.#handlers?.error({ message })
  }

  /** Everything written into the input queue since the last call, parsed. */
  inputs(): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = []
    for (let text = this.#reader?.tryRead() ?? null; text !== null; text = this.#reader?.tryRead() ?? null) out.push(JSON.parse(text) as Record<string, unknown>)
    return out
  }

  /** The match.start commands the page sent. */
  matchStarts(): Extract<WorkerCommand, { type: "match.start" }>[] {
    return this.commands.filter((command): command is Extract<WorkerCommand, { type: "match.start" }> => command.type === "match.start")
  }

  boot(): void {
    this.send({ type: "engine.boot", phase: "worker-features", t: 3, features: SUPPORTED })
    this.send({ type: "engine.boot", phase: "launcher-load", t: 5 })
    this.send({ type: "engine.boot", phase: "wasm-fetch-compile", t: 60 })
    this.send({ type: "engine.boot", phase: "java-main", t: 700 })
    const start = this.commands.find((command) => command.type === "engine.start")
    this.send(readyFor(start?.type === "engine.start" ? start.args : []))
  }

  /** The start of a game as the real engine sends it, up to Forge waiting for the mulligan. */
  startGame(format: "constructed" | "commander" = "constructed"): void {
    this.send(started(format))
    this.send(gameState(1))
    this.send(gameState(2))
    this.send(gameState(3))
    this.send(mulligan(1))
    this.send({ type: "message", kind: "prompt", text: MULLIGAN_PROMPT })
    this.send({ type: "engine.waiting", consumed: 0 })
  }

  /**
   * Forge after the player kept their hand: the player's first main phase,
   * the first Mountain in hand playable with Forge's words, the priority
   * buttons (protocol 5: with what they do), Forge waiting - Forge asks at
   * priority only when it found something the player can do (`canAct`). As
   * the real engine marks it (recorded scene "main-phase"). `answered`: the
   * seq of the player's answer that kept the
   * hand (prompt 15: Forge closes the mulligan question with it); without
   * it the mulligan question is withdrawn (a test that does not answer).
   */
  priority(options: { readonly answered?: number } = {}): void {
    if (options.answered !== undefined) this.send({ type: "question.answered", id: 1, seq: options.answered })
    else this.send({ type: "question.withdrawn", id: 1 })
    const state = gameState(4, { turn: 1, phase: "MAIN1", activePlayer: 0 })
    const me = state.players[0]!
    const [first, ...rest] = me.zones.hand
    const playable = { ...(first as VisibleCard), playable: true as const, action: "Spiele ein Land" }
    this.send({ ...state, players: [{ ...me, hasPriority: true, canAct: true, zones: { ...me.zones, hand: [playable, ...rest] } }, state.players[1]!] })
    this.send({ type: "question", kind: "buttons", id: 2, blocking: false, text: "", purpose: "priority", buttons: PRIORITY_BUTTONS })
    this.send({ type: "message", kind: "prompt", text: "Priorität: Spieler Zug: 1 (Spieler) Phase: Erste Hauptphase (Vor-Kampf) Stapel: Leer" })
    this.send({ type: "engine.waiting", consumed: options.answered ?? 0 })
  }

  /** What the real engine sends after the player's concession (input 1). */
  concedeAccepted(): void {
    this.send({ type: "message", kind: "prompt", text: "" })
    this.send({ type: "question.withdrawn", id: 1 })
    this.send({ type: "events", entries: [{ kind: "GAME_OUTCOME", text: "Spieler hat aufgegeben", actor: "me" }] })
    this.send(gameState(4, { running: false }))
    this.send(gameEnd(true))
    this.send({ type: "match.finished", summary: summary(1) })
  }
}

export interface TestEngine {
  readonly session: EngineSession
  /** One worker per boot, in order. */
  readonly workers: FakeEngineWorker[]
  readonly launches: EngineLaunch[]
  readonly timers: FakeTimers
  /** The newest worker. */
  worker(): FakeEngineWorker
  /** Advances the page clock the session reads (not the client's timers). */
  tick(ms: number): void
}

/** An EngineSession whose engine is the real EngineClient over scripted workers. */
export function testEngine(options: { features?: FeatureReport; assets?: EngineAssets } = {}): TestEngine {
  let clock = 1000
  const workers: FakeEngineWorker[] = []
  const launches: EngineLaunch[] = []
  const timers = new FakeTimers()
  const session = new EngineSession({
    assets: options.assets ?? TEST_ASSETS,
    detectFeatures: () => options.features ?? SUPPORTED,
    loadClient: async () => (launch) => {
      launches.push(launch)
      const worker = new FakeEngineWorker()
      workers.push(worker)
      return new EngineClient({
        createPort: worker.factory,
        engineScriptUrl: launch.engineScriptUrl,
        wasmUrl: launch.wasmUrl,
        engineArgs: launch.engineArgs,
        featureScope: SUPPORTED_SCOPE,
        timers,
        queueCapacity: 1024,
      })
    },
    now: () => clock,
    baseUrl: "https://openmana.test/play",
  })
  return {
    session,
    workers,
    launches,
    timers,
    worker() {
      const worker = workers.at(-1)
      if (!worker) throw new Error("no engine worker was created yet")
      return worker
    },
    tick(ms) {
      clock += ms
    },
  }
}

/** A game of two small decks, as match-setup.ts builds it. */
export function testSetup(overrides: { format?: "constructed" | "commander"; drawn?: boolean } = {}): MatchSetup {
  const format = overrides.format ?? "constructed"
  return {
    request: {
      seed: 123456789,
      format,
      human: { name: "Spieler", deck: { name: "Rot", main: [{ card: "Mountain", count: 24 }, { card: "Shock", count: 36 }] } },
      ai: { name: "Forge-KI", profile: "Default", deck: { name: "Grün", main: [{ card: "Forest", count: 24 }, { card: "Grizzly Bears", count: 36 }] } },
    },
    human: { deckId: "11111111-1111-4111-8111-111111111111", deckName: "Rot" },
    ai: { deckId: "22222222-2222-4222-8222-222222222222", deckName: "Grün", drawn: overrides.drawn ?? false, profileDrawn: false },
  }
}

/** Lets the (already resolved) client import settle. */
export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
