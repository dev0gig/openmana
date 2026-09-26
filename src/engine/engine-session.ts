/*
 * The app's handle on the Forge engine and on the game it plays: starts,
 * watches and stops one EngineClient (engine/client) and turns what it
 * reports into snapshots the UI renders. The engine lives in a Dedicated
 * Worker (about 1 GB); only one runs at a time.
 *
 * Two parts, updated together:
 *  - engine: the worker - not loaded, booting (the engine's own boot phases),
 *    ready (what the engine reports about itself), busy (it plays a game),
 *    aborted (why). It starts when the player asks for it, when the play page
 *    prewarms it (prewarm), or when a game is started and none is running.
 *  - match: the game the player asked for (null: none) - queued (waits for
 *    the engine), starting, refused (engine.error: Forge did not start it;
 *    the worker stays usable), playing (game.started, the latest full state,
 *    the open questions, whether Forge waits for the player), over (game.end,
 *    then match.finished) or aborted (a technical abort ended it without a
 *    result).
 *
 * One game per worker (Forge's state is static; research §4): when a game is
 * finished its worker is released, and the next game boots a fresh one.
 *
 * Everything shown comes from the engine or the browser: feature detection
 * (engine/protocol), engine.boot, engine.ready, the game messages,
 * engine.error, engine.abort. Nothing is simulated here; without an engine in
 * the build or without a capable browser the session says so and never
 * starts. A failure is never swallowed: it ends in refused or aborted, with
 * the engine's reason.
 *
 * The engine client is loaded on first start: it carries the protocol's
 * schema validators (~380 KB), which the rest of the app does not need.
 *
 * Framework-free on purpose (tests drive it with a fake client factory);
 * React reads it through useSyncExternalStore (engine-session-context.tsx).
 */
import type { EngineClient, EngineClientEvent } from "@openmana/engine-client"
import type {
  AnswerBody,
  BootPhase,
  EngineAbort,
  EngineError,
  EngineLanguage,
  EngineMessage,
  EngineReady,
  FeatureReport,
  GameEnd,
  GameMessage,
  GameStarted,
  GameState,
  InputRejected,
  MatchRequest,
  MatchSummary,
  Question,
} from "@openmana/engine-protocol"
import { describeMissingFeatures, detectEngineFeatures } from "@openmana/engine-protocol/features"
import { BOOT_PHASES } from "@openmana/engine-protocol/generated/constants"
import type { EngineAssets } from "./engine-assets-types"

/** What of the engine's start follows the player's preferences (prompt 12). */
export interface EngineBootOptions {
  /**
   * The language of the cards in Forge's texts and card views (boot argument
   * --card-language): the player's card language (src/cards/card-language.ts).
   */
  readonly cardLanguage: EngineLanguage
}

/** Until the preferences are read: German cards, like the rest of the app. */
export const DEFAULT_BOOT_OPTIONS: EngineBootOptions = { cardLanguage: "de-DE" }

/**
 * How the app boots Forge (engine.start args). Cards load eagerly: lazily the
 * engine stalls a game for tens of seconds when an effect needs all cards
 * (prompt 04). Forge speaks German: its questions, buttons and messages are
 * what the player reads during a game, and the language changes only Forge's
 * words, never the game (prompts 04/05: identical traces). The cards inside
 * them are in the player's card language (prompt 12, same trace too).
 */
export function engineArgs(options: EngineBootOptions): readonly string[] {
  return ["--card-loading=eager", "--language=de-DE", `--card-language=${options.cardLanguage}`]
}

function sameOptions(a: EngineBootOptions, b: EngineBootOptions): boolean {
  return a.cardLanguage === b.cardLanguage
}

export type BootStepState = "pending" | "active" | "done"

export interface BootStep {
  readonly phase: BootPhase
  readonly state: BootStepState
  /** Page time (ms, performance.now()) when the engine reported the phase. */
  readonly startedAt: number | null
  readonly endedAt: number | null
}

export type EngineSnapshot =
  /** This build has no engine (see EngineAssetsUnavailable). */
  | { readonly status: "unavailable"; readonly reason: "missing" | "omitted"; readonly detail: string }
  /** The browser lacks something the engine needs; it is never started here. */
  | { readonly status: "unsupported"; readonly features: FeatureReport; readonly message: string }
  | { readonly status: "idle"; readonly features: FeatureReport }
  | {
      readonly status: "booting"
      readonly features: FeatureReport
      readonly startedAt: number
      readonly steps: readonly BootStep[]
    }
  | {
      /** ready: waits for a game; busy: plays one (this worker cannot take another). */
      readonly status: "ready" | "busy"
      readonly features: FeatureReport
      readonly startedAt: number
      readonly readyAt: number
      readonly steps: readonly BootStep[]
      readonly ready: EngineReady
    }
  | {
      readonly status: "aborted"
      readonly features: FeatureReport
      readonly startedAt: number
      readonly steps: readonly BootStep[]
      readonly abort: EngineAbort
    }

/** One side of a game as the player chose it. */
export interface MatchSideSetup {
  readonly deckId: string
  readonly deckName: string
}

/** A game the player asked for: exactly what goes to Forge, and which decks of the library it came from. */
export interface MatchSetup {
  /** The match.start request (a copy of both decks; the library may change meanwhile). */
  readonly request: MatchRequest
  readonly human: MatchSideSetup
  /** drawn: the AI's deck was drawn at random for this game; profileDrawn: its profile (request.ai.profile) too. */
  readonly ai: MatchSideSetup & { readonly drawn: boolean; readonly profileDrawn: boolean }
}

interface MatchBase {
  readonly setup: MatchSetup
  /** Page time when the player asked for the game. */
  readonly requestedAt: number
}

/** Forge's messages during a game that the player must see (the prompt line is kept on its own). */
export type GameNotice = GameMessage | InputRejected

/** How many notices a game keeps (the newest); the full history is prompt 21. */
export const NOTICE_LIMIT = 20

export type MatchSnapshot =
  /** Waits for the engine (booting, or about to boot). */
  | (MatchBase & { readonly status: "queued" })
  /** match.start is sent; Forge builds the game. stalledMs: the engine has been silent this long (watchdog). */
  | (MatchBase & { readonly status: "starting"; readonly stalledMs: number | null })
  /** Forge did not start the game (engine.error); the worker is still usable. */
  | (MatchBase & { readonly status: "refused"; readonly error: EngineError })
  | (MatchBase & {
      readonly status: "playing"
      readonly startedAt: number
      readonly game: GameStarted
      /** The latest full snapshot (null until the first arrives). */
      readonly state: GameState | null
      /** Questions Forge is asking right now, in the order asked. */
      readonly questions: readonly Question[]
      /** Forge's instruction line for the current decision (message kind prompt; null: none). */
      readonly prompt: string | null
      /** Forge waits for the player (not computing). */
      readonly waiting: boolean
      readonly stalledMs: number | null
      /** The concession is sent; game.end follows. */
      readonly conceding: boolean
      /** Forge's notices, errors and refused inputs, oldest first (at most NOTICE_LIMIT). */
      readonly notices: readonly GameNotice[]
      /** How many notices this game has had in all (the newest are the last of `notices`): the table announces new ones. */
      readonly noticeCount: number
    })
  | (MatchBase & {
      readonly status: "over"
      readonly startedAt: number
      readonly endedAt: number
      readonly game: GameStarted
      readonly state: GameState | null
      readonly end: GameEnd
      /** match.finished: the engine's technical summary (null until it arrives, or if the engine was released first). */
      readonly summary: MatchSummary | null
    })
  /** A technical abort ended the game without a result. */
  | (MatchBase & {
      readonly status: "aborted"
      readonly game: GameStarted | null
      readonly state: GameState | null
      readonly abort: EngineAbort
    })

export type MatchStatus = MatchSnapshot["status"]

export interface EngineSessionSnapshot {
  readonly engine: EngineSnapshot
  readonly match: MatchSnapshot | null
}

/** A game is on its way or running: the page must not be left without a warning, and no second game can start. */
export function matchInProgress(match: MatchSnapshot | null): boolean {
  return match !== null && (match.status === "queued" || match.status === "starting" || match.status === "playing")
}

/** The part of EngineClient the session uses (tests pass a fake). */
export type SessionClient = Pick<EngineClient, "start" | "subscribe" | "dispose" | "startMatch" | "concede" | "tapCard" | "answer" | "abort" | "engineWaiting">

/** Where the engine is (the worker script, GraalVM's launcher, the module) and how it boots. */
export interface EngineLaunch {
  readonly workerUrl: URL
  readonly engineScriptUrl: string
  readonly wasmUrl: string
  readonly engineArgs: readonly string[]
}

export type CreateSessionClient = (launch: EngineLaunch) => SessionClient

/** The real client: EngineClient with the browser's Dedicated Worker, loaded on demand. */
export async function loadBrowserClient(): Promise<CreateSessionClient> {
  const { EngineClient, browserWorkerPort } = await import("@openmana/engine-client")
  return ({ workerUrl, engineScriptUrl, wasmUrl, engineArgs }) =>
    new EngineClient({ createPort: browserWorkerPort(workerUrl), engineScriptUrl, wasmUrl, engineArgs })
}

export interface EngineSessionOptions {
  readonly assets: EngineAssets
  /** Default: loadBrowserClient. */
  readonly loadClient?: () => Promise<CreateSessionClient>
  /** Default: detectEngineFeatures() of engine/protocol (cross-origin isolation required). */
  readonly detectFeatures?: () => FeatureReport
  readonly now?: () => number
  /** Base for the engine URLs (the page's location). */
  readonly baseUrl?: string
  /** The boot options until setBootOptions says otherwise (default DEFAULT_BOOT_OPTIONS). */
  readonly bootOptions?: EngineBootOptions
}

/** What an input of the player did: sent, or why not (German, for the player). */
export type InputResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }

/** What concede() did. */
export type ConcedeResult = InputResult

/**
 * Why the client refused an input without sending it (EngineInputError's
 * reason, engine/client/src/errors.ts), for the player. Read by name: the
 * client is loaded on demand, its classes are not imported here.
 */
const INPUT_REFUSALS: Readonly<Record<string, string>> = {
  "no-match": "Es läuft keine Partie.",
  "not-active": "Forge wartet zuerst auf deine Antwort auf seine Frage.",
  "unknown-card": "Diese Karte ist gerade nicht mehr zu sehen.",
  "unknown-player": "Diesen Spieler gibt es nicht.",
  stale: "Die Frage ist schon beantwortet oder zurückgezogen.",
  "unknown-question": "Diese Frage hat Forge nie gestellt.",
  "wrong-kind": "Die Antwort passt nicht zu Forges Frage.",
  malformed: "Die Eingabe passt nicht zum Protokoll.",
  "queue-full": "Forge hat die letzten Eingaben noch nicht gelesen – gleich noch einmal versuchen.",
  "too-large": "Die Eingabe ist zu groß.",
}

function refusal(error: unknown): string {
  const reason = error instanceof Error && "reason" in error && typeof error.reason === "string" ? error.reason : null
  const known = reason === null ? undefined : INPUT_REFUSALS[reason]
  return known ?? (error instanceof Error ? error.message : String(error))
}

type Listener = () => void

export class EngineSession {
  readonly #options: EngineSessionOptions
  readonly #now: () => number
  readonly #listeners = new Set<Listener>()
  #snapshot: EngineSessionSnapshot
  #client: SessionClient | null = null
  #unsubscribe: (() => void) | null = null
  /** Counts boots and stops; a client that arrives for an older attempt is dropped. */
  #attempt = 0
  /** The input number of the concession sent in the running game (null: none). */
  #concedeSeq: number | null = null
  /** How the next engine boots (the player's preferences). */
  #bootOptions: EngineBootOptions
  /** How the current worker was booted (null: no worker). */
  #workerOptions: EngineBootOptions | null = null

  constructor(options: EngineSessionOptions) {
    this.#options = options
    this.#now = options.now ?? (() => performance.now())
    this.#bootOptions = options.bootOptions ?? DEFAULT_BOOT_OPTIONS
    this.#snapshot = { engine: this.#initialEngine(), match: null }
  }

  /** How the next engine boots. */
  get bootOptions(): EngineBootOptions {
    return this.#bootOptions
  }

  /**
   * The player's preferences for the engine's start changed. The next boot
   * uses them. A warm engine that no game uses yet (booting or ready) is
   * replaced right away by one booted with them, so the next game does not
   * wait; an engine that is part of a game (on its way, running) is kept -
   * that game was asked for with the old options.
   */
  setBootOptions(options: EngineBootOptions): void {
    if (sameOptions(options, this.#bootOptions)) return
    this.#bootOptions = options
    const { engine, match } = this.#snapshot
    const warm = engine.status === "booting" || engine.status === "ready"
    if (warm && !matchInProgress(match) && this.#workerOptions !== null && !sameOptions(this.#workerOptions, options)) this.#boot()
  }

  getSnapshot = (): EngineSessionSnapshot => this.#snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** Loads the engine on request (idle or after an abort). Anything else is ignored. */
  start(): void {
    const status = this.#snapshot.engine.status
    if (status === "idle" || status === "aborted") this.#boot()
  }

  /**
   * Boots the engine ahead of a game (the play page), so "Partie starten"
   * does not wait for it. Only from idle: never retries a failed engine by
   * itself (the player sees the failure and asks again).
   */
  prewarm(): void {
    if (this.#snapshot.engine.status === "idle") this.#boot()
  }

  /**
   * Stops the engine (terminates the worker) and returns to idle. A game
   * waiting for the engine is cancelled; a running game ends without a
   * result (aborted, terminated by the player).
   */
  stop(): void {
    this.#attempt++
    this.#release()
    const { engine, match } = this.#snapshot
    const nextEngine = engine.status === "idle" ? engine : idleOf(engine)
    let nextMatch = match
    if (match?.status === "queued") nextMatch = null
    else if (match?.status === "starting" || match?.status === "playing") {
      nextMatch = aborted(match, { type: "engine.abort", reason: "terminated", origin: "client", message: "the engine was stopped by the player", stage: "client" })
    }
    if (nextEngine !== engine || nextMatch !== match) this.#set({ engine: nextEngine, match: nextMatch })
  }

  /**
   * Starts a game against Forge's AI with `setup`. Boots the engine if none
   * is ready (a fresh worker per game) and sends the request as soon as it
   * is. Returns false - and changes nothing - if a game is already on its
   * way or running, or the engine cannot run here.
   */
  startMatch(setup: MatchSetup): boolean {
    const { engine, match } = this.#snapshot
    if (engine.status === "unavailable" || engine.status === "unsupported" || matchInProgress(match)) return false
    const queued: MatchSnapshot = { status: "queued", setup, requestedAt: this.#now() }
    const fitting = this.#workerOptions !== null && sameOptions(this.#workerOptions, this.#bootOptions)
    if (engine.status === "ready" && this.#client && fitting) {
      this.#set({ engine, match: queued })
      this.#send(this.#client, queued)
      return true
    }
    this.#set({ engine, match: queued })
    if (engine.status === "busy") {
      // The previous game is over and its worker only reports its summary: release it now.
      this.#attempt++
      this.#release()
    }
    // An engine booting with other options than the player's now is replaced.
    if (engine.status !== "booting" || !fitting) this.#boot()
    return true
  }

  /** A game that waits for the engine is not wanted any more; the engine keeps booting. */
  cancelMatch(): void {
    if (this.#snapshot.match?.status === "queued") this.#set({ ...this.#snapshot, match: null })
  }

  /** Concedes the running game. Confirm with the player BEFORE calling this: Forge does not ask again. */
  concede(): ConcedeResult {
    const match = this.#snapshot.match
    const client = this.#client
    if (match?.status !== "playing" || client === null) return { ok: false, reason: "Es läuft keine Partie." }
    if (match.conceding) return { ok: true }
    try {
      this.#concedeSeq = client.concede()
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    }
    // The input is on its way: Forge no longer waits.
    this.#set({ ...this.#snapshot, match: { ...match, conceding: true, waiting: client.engineWaiting } })
    return { ok: true }
  }

  /**
   * Taps a card for the player (prompt 14): Forge's card.tap - how cards are
   * played, activated, paid with, declared as attackers or blockers, chosen;
   * Forge decides what the tap means and rejects one it ignores (a notice).
   * Only while Forge waits for the player: a tap sent while it computes would
   * be read later, in whatever step comes then. Never for a concession on its
   * way. The UI offers a tap only where Forge does (src/game/card-use.ts).
   */
  tapCard(card: number): InputResult {
    const match = this.#snapshot.match
    const client = this.#client
    if (match?.status !== "playing" || client === null) return { ok: false, reason: "Es läuft keine Partie." }
    if (match.conceding) return { ok: false, reason: "Die Aufgabe ist unterwegs." }
    if (!client.engineWaiting) return { ok: false, reason: "Forge rechnet gerade – antippen geht, sobald Forge wieder auf dich wartet." }
    try {
      client.tapCard(card)
    } catch (error) {
      return { ok: false, reason: refusal(error) }
    }
    // The input is on its way: Forge no longer waits.
    this.#set({ ...this.#snapshot, match: { ...match, waiting: client.engineWaiting } })
    return { ok: true }
  }

  /**
   * Answers one of Forge's questions for the player (prompt 15): the answer
   * to question `question` (its id), shaped by its kind (src/game/decision-model.ts).
   * Like a tap, only while Forge waits for the player - its questions change
   * while it computes, and an answer is meant for the question the player
   * saw - and never for a concession on its way. The client refuses what it
   * can already tell is wrong (a question no longer open, another one that
   * must be answered first, the wrong kind) and nothing is sent; what only
   * the engine can tell (the answer does not fit its question, the question
   * was withdrawn meanwhile) comes back as Forge's notice (input.rejected).
   * Nothing is ever answered without the player: the session only sends
   * what the page hands it.
   */
  answer(question: number, body: AnswerBody): InputResult {
    const match = this.#snapshot.match
    const client = this.#client
    if (match?.status !== "playing" || client === null) return { ok: false, reason: "Es läuft keine Partie." }
    if (match.conceding) return { ok: false, reason: "Die Aufgabe ist unterwegs." }
    if (!client.engineWaiting) return { ok: false, reason: "Forge rechnet gerade – antworten geht, sobald Forge wieder auf dich wartet." }
    try {
      client.answer(question, body)
    } catch (error) {
      return { ok: false, reason: refusal(error) }
    }
    // The input is on its way: Forge no longer waits.
    this.#set({ ...this.#snapshot, match: { ...match, waiting: client.engineWaiting } })
    return { ok: true }
  }

  /**
   * Ends a game that is starting or running by terminating the engine (for
   * an engine that stopped responding). The game ends without a result.
   */
  abortMatch(): void {
    const status = this.#snapshot.match?.status
    if ((status === "starting" || status === "playing") && this.#client) {
      // The client reports engine.abort (terminated) to the session and terminates the worker.
      this.#client.abort("the player ended the game because the engine stopped responding")
    }
  }

  #initialEngine(): EngineSnapshot {
    const assets = this.#options.assets
    if (!assets.available) {
      return { status: "unavailable", reason: assets.reason, detail: assets.detail }
    }
    const features = (this.#options.detectFeatures ?? (() => detectEngineFeatures({ requireIsolation: true })))()
    if (!features.supported) {
      return { status: "unsupported", features, message: describeMissingFeatures(features) }
    }
    return { status: "idle", features }
  }

  /** Loads the client and starts a fresh worker. */
  #boot(): void {
    const current = this.#snapshot.engine
    const assets = this.#options.assets
    if (!assets.available || current.status === "unavailable" || current.status === "unsupported") return
    this.#release()
    const attempt = ++this.#attempt
    const options = this.#bootOptions
    this.#workerOptions = options
    const features = current.features
    const startedAt = this.#now()
    const baseUrl = this.#options.baseUrl ?? globalThis.location.href
    const pendingSteps = BOOT_PHASES.map((phase): BootStep => ({ phase, state: "pending", startedAt: null, endedAt: null }))
    this.#set({ ...this.#snapshot, engine: { status: "booting", features, startedAt, steps: pendingSteps } })
    const loadClient = this.#options.loadClient ?? loadBrowserClient
    loadClient().then(
      (create) => {
        if (attempt !== this.#attempt) return
        const client = create({
          workerUrl: new URL(assets.workerUrl, baseUrl),
          engineScriptUrl: new URL(assets.launcherUrl, baseUrl).href,
          wasmUrl: new URL(assets.wasmUrl, baseUrl).href,
          engineArgs: engineArgs(options),
        })
        this.#client = client
        this.#unsubscribe = client.subscribe((event) => this.#onEvent(client, event))
        client.start()
      },
      (error: unknown) => {
        if (attempt !== this.#attempt) return
        this.#aborted({
          type: "engine.abort",
          origin: "client",
          reason: "boot-failed",
          stage: "client-load",
          message: `the engine client could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
        })
      },
    )
  }

  #onEvent(client: SessionClient, event: EngineClientEvent): void {
    // Events of a client that was released meanwhile are stale.
    if (client !== this.#client) return
    switch (event.kind) {
      case "message":
        this.#onMessage(client, event.message)
        return
      case "stalled":
      case "responsive":
        this.#onWatchdog(event.kind === "stalled" ? event.silentMs : null)
        return
      case "status":
        return
    }
  }

  #onMessage(client: SessionClient, message: EngineMessage): void {
    const { engine, match } = this.#snapshot
    const now = this.#now()
    switch (message.type) {
      case "engine.boot":
        if (engine.status === "booting") this.#set({ engine: { ...engine, steps: advance(engine.steps, message.phase, now) }, match })
        return
      case "engine.ready": {
        if (engine.status !== "booting") return
        const ready: EngineSnapshot = { status: "ready", features: engine.features, startedAt: engine.startedAt, readyAt: now, steps: finish(engine.steps, now), ready: message }
        this.#set({ engine: ready, match })
        if (match?.status === "queued") this.#send(client, match)
        return
      }
      case "engine.error": {
        if (match?.status !== "starting") return
        const refused: MatchSnapshot = { status: "refused", setup: match.setup, requestedAt: match.requestedAt, error: message }
        if (message.code === "deck-rejected" || message.code === "invalid-request") {
          // Forge never started the game: this worker takes the next one.
          this.#set({ engine: engine.status === "busy" ? { ...engine, status: "ready" } : engine, match: refused })
        } else {
          // not-ready / already-started: this worker cannot play; the next game boots a fresh one.
          this.#attempt++
          this.#release()
          this.#set({ engine: idleOf(engine), match: refused })
        }
        return
      }
      case "engine.abort":
        // The client has terminated the worker already.
        this.#release()
        this.#aborted(message)
        return
      case "game.started":
        if (match?.status !== "starting") return
        this.#concedeSeq = null
        this.#set({
          engine,
          match: {
            status: "playing",
            setup: match.setup,
            requestedAt: match.requestedAt,
            startedAt: now,
            game: message,
            state: null,
            questions: [],
            prompt: null,
            waiting: client.engineWaiting,
            stalledMs: match.stalledMs,
            conceding: false,
            notices: [],
            noticeCount: 0,
          },
        })
        return
      case "match.finished":
        if (match?.status === "over") {
          // One game per worker: this one is spent. Release it; the next game boots a fresh one.
          this.#attempt++
          this.#release()
          this.#set({ engine: idleOf(engine), match: { ...match, summary: message.summary } })
        }
        return
      default:
        if (match?.status === "playing") this.#onGameMessage(client, match, message)
    }
  }

  /** Messages of a running game. The client has checked each one (schema, order, question lifecycle). */
  #onGameMessage(client: SessionClient, match: Extract<MatchSnapshot, { status: "playing" }>, message: EngineMessage): void {
    const engine = this.#snapshot.engine
    const waiting = client.engineWaiting
    switch (message.type) {
      case "state":
        this.#set({ engine, match: { ...match, state: message, waiting } })
        return
      case "question":
        this.#set({ engine, match: { ...match, questions: [...match.questions, message], waiting } })
        return
      case "question.withdrawn":
      case "question.answered":
        this.#set({ engine, match: { ...match, questions: match.questions.filter((q) => q.id !== message.id), waiting } })
        return
      case "engine.waiting":
        this.#set({ engine, match: { ...match, waiting } })
        return
      case "message":
        // The prompt line belongs to the current decision (an empty one clears it); everything else must be seen.
        if (message.kind === "prompt") this.#set({ engine, match: { ...match, prompt: message.text.trim() === "" ? null : message.text, waiting } })
        else this.#set({ engine, match: { ...match, notices: keep(match.notices, message), noticeCount: match.noticeCount + 1, waiting } })
        return
      case "input.rejected":
        this.#set({
          engine,
          match: { ...match, notices: keep(match.notices, message), noticeCount: match.noticeCount + 1, conceding: match.conceding && message.seq !== this.#concedeSeq, waiting },
        })
        return
      case "game.end":
        this.#set({
          engine,
          match: {
            status: "over",
            setup: match.setup,
            requestedAt: match.requestedAt,
            startedAt: match.startedAt,
            endedAt: this.#now(),
            game: match.game,
            state: match.state,
            end: message,
            summary: null,
          },
        })
        return
      default:
        // events: the game history is prompt 21.
        return
    }
  }

  /** The client's watchdog: the busy engine has been silent (silentMs) or speaks again (null). */
  #onWatchdog(silentMs: number | null): void {
    const { engine, match } = this.#snapshot
    if (match?.status === "starting" || match?.status === "playing") {
      this.#set({ engine, match: { ...match, stalledMs: silentMs } })
    } else if (match?.status === "over" && silentMs !== null) {
      // The result is known; an engine that does not finish is released instead of holding its memory.
      this.#attempt++
      this.#release()
      this.#set({ engine: idleOf(engine), match })
    }
  }

  /** Hands the game to a ready engine. */
  #send(client: SessionClient, match: Extract<MatchSnapshot, { status: "queued" }>): void {
    const engine = this.#snapshot.engine
    try {
      client.startMatch(match.setup.request)
    } catch (error) {
      // The client refused the request before sending it (it does not fit the protocol).
      const refused: EngineError = { type: "engine.error", code: "invalid-request", message: error instanceof Error ? error.message : String(error) }
      this.#set({ engine, match: { status: "refused", setup: match.setup, requestedAt: match.requestedAt, error: refused } })
      return
    }
    this.#set({
      engine: engine.status === "ready" ? { ...engine, status: "busy" } : engine,
      match: { status: "starting", setup: match.setup, requestedAt: match.requestedAt, stalledMs: null },
    })
  }

  /** The engine is gone: it and a game on its way or running end with this abort. */
  #aborted(abort: EngineAbort): void {
    const { engine, match } = this.#snapshot
    if (engine.status === "unavailable" || engine.status === "unsupported") return
    const startedAt = engine.status === "idle" ? this.#now() : engine.startedAt
    const steps = engine.status === "idle" ? BOOT_PHASES.map((phase): BootStep => ({ phase, state: "pending", startedAt: null, endedAt: null })) : engine.steps
    const nextMatch = match?.status === "queued" || match?.status === "starting" || match?.status === "playing" ? aborted(match, abort) : match
    this.#set({ engine: { status: "aborted", features: engine.features, startedAt, steps, abort }, match: nextMatch })
  }

  #release(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    const client = this.#client
    this.#client = null
    this.#workerOptions = null
    client?.dispose()
  }

  #set(snapshot: EngineSessionSnapshot): void {
    this.#snapshot = snapshot
    // A copy: a listener may unsubscribe (itself or another) while being called.
    for (const listener of Array.from(this.#listeners)) listener()
  }
}

function aborted(match: Extract<MatchSnapshot, { status: "queued" | "starting" | "playing" }>, abort: EngineAbort): MatchSnapshot {
  return {
    status: "aborted",
    setup: match.setup,
    requestedAt: match.requestedAt,
    game: match.status === "playing" ? match.game : null,
    state: match.status === "playing" ? match.state : null,
    abort,
  }
}

function idleOf(engine: EngineSnapshot): EngineSnapshot {
  return engine.status === "unavailable" || engine.status === "unsupported" ? engine : { status: "idle", features: engine.features }
}

function keep(notices: readonly GameNotice[], notice: GameNotice): readonly GameNotice[] {
  return [...notices, notice].slice(-NOTICE_LIMIT)
}

/** The engine reports the start of a phase: earlier phases are done, this one is active. */
function advance(steps: readonly BootStep[], phase: BootPhase, now: number): readonly BootStep[] {
  const index = BOOT_PHASES.indexOf(phase)
  return steps.map((step, i) => {
    if (i < index) return step.state === "done" ? step : { ...step, state: "done", startedAt: step.startedAt ?? now, endedAt: now }
    if (i === index) return { ...step, state: "active", startedAt: step.startedAt ?? now }
    return step
  })
}

/** engine.ready: every phase is over. */
function finish(steps: readonly BootStep[], now: number): readonly BootStep[] {
  return steps.map((step) => (step.state === "done" ? step : { ...step, state: "done", startedAt: step.startedAt ?? now, endedAt: now }))
}
