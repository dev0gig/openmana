/* Capture protocol traffic, never infer rules or events from state differences. */
import type { Deck } from "@openmana/engine-protocol"
import type { EngineSession, RecordingEvent } from "@/engine/engine-session"
import type { EngineAssets } from "@/engine/engine-assets-types"
import type { LocalDatabase } from "@/storage/database"
import type { AppVersion, MatchDeck, MatchLogEntry, MatchRecord } from "@/storage/generated/records"
import { pruneMatches, writeMatchBatch } from "@/storage/matches"

interface Recording {
  header: MatchRecord
  readonly started: number
  seq: number
  pending: MatchLogEntry[]
  chain: Promise<void>
  created: boolean
  stopped: boolean
}

function deck(value: Deck): MatchDeck {
  return { ...value, sideboard: value.sideboard ?? [], commander: value.commander ?? [] }
}

export class MatchRecorder {
  readonly #db: LocalDatabase
  readonly #assets: EngineAssets
  readonly #app: AppVersion
  readonly #error: (error: unknown) => void
  readonly #now: () => Date
  readonly #clock: () => number
  readonly #uuid: () => string
  #current: Recording | null = null
  #unsubscribe: () => void
  #timer: ReturnType<typeof setTimeout> | null = null
  #all = new Set<Recording>()

  constructor(options: {
    session: EngineSession
    database: LocalDatabase
    assets: EngineAssets
    app: AppVersion
    onError: (error: unknown) => void
    now?: () => Date
    clock?: () => number
    uuid?: () => string
  }) {
    this.#db = options.database
    this.#assets = options.assets
    this.#app = options.app
    this.#error = options.onError
    this.#now = options.now ?? (() => new Date())
    this.#clock = options.clock ?? (() => performance.now())
    this.#uuid = options.uuid ?? (() => crypto.randomUUID())
    this.#unsubscribe = options.session.subscribeRecording((event) => {
      try {
        this.#event(event)
      } catch (error) {
        if (this.#current) this.#current.stopped = true
        this.#error(error)
      }
    })
  }

  #event(event: RecordingEvent): void {
    if (event.kind === "started") {
      if (!this.#assets.available) throw new Error("cannot record without verified engine assets")
      if (this.#current) {
        const previous = this.#current
        this.#flush(previous)
        void previous.chain.then(() => this.#all.delete(previous))
      }
      const { setup, ready } = event
      const build = ready.engine
      this.#current = {
        header: {
          id: this.#uuid(),
          status: "running",
          startedAt: this.#now().toISOString(),
          endedAt: null,
          format: setup.request.format,
          seed: setup.request.seed ?? null,
          app: this.#app,
          engine: {
            id: this.#assets.id,
            protocol: ready.protocol,
            forgeVersion: build.forgeVersion,
            forgeCommit: build.forgeCommit,
            buildCommit: build.openmanaCommit,
            sourcesModified: build.engineSourcesModified,
            manifestSha256: this.#assets.build.manifestSha256,
          },
          human: { ...setup.request.human, deckId: setup.human.deckId, deck: deck(setup.request.human.deck) },
          ai: { ...setup.request.ai, deckId: setup.ai.deckId, deck: deck(setup.request.ai.deck) },
          end: null,
        },
        started: this.#clock(),
        seq: 0,
        pending: [],
        chain: Promise.resolve(),
        created: false,
        stopped: false,
      }
      this.#all.add(this.#current)
      this.#append("engine", ready)
      this.#append("player", { type: "recording.boot", args: [...event.args] })
      this.#append("player", { type: "match.start", match: setup.request })
    } else if (event.kind === "input") this.#append("player", event.message)
    else if (event.kind === "message") {
      if (event.message.type === "diagnostics.trace") return // no hidden-information diagnostics
      this.#append("engine", event.message)
      if (this.#current && event.message.type === "game.started") this.#flush(this.#current)
      if (this.#current && event.message.type === "game.end") {
        const { result, reason, turns, conceded } = event.message
        this.#current.header = {
          ...this.#current.header,
          status: "finished",
          endedAt: this.#now().toISOString(),
          end: { result, reason, turns, conceded },
        }
        this.#flush(this.#current)
      } else if (this.#current && event.message.type === "match.finished") this.#flush(this.#current)
    } else if (event.kind === "aborted" && this.#current) {
      // Client stop() has no wire message; preserve this terminal fact explicitly.
      if (this.#current.pending.at(-1)?.message.type !== "engine.abort") this.#append("engine", event.abort)
      this.#current.header = { ...this.#current.header, status: "aborted", endedAt: this.#now().toISOString() }
      this.#flush(this.#current)
    }
  }

  #append<T extends { type: string }>(from: MatchLogEntry["from"], message: T): void {
    const rec = this.#current
    if (!rec || rec.stopped) return
    rec.pending.push({
      matchId: rec.header.id,
      seq: rec.seq++,
      at: Math.max(0, this.#clock() - rec.started),
      from,
      message: structuredClone(message),
    })
    if (this.#timer === null)
      this.#timer = setTimeout(() => {
        this.#timer = null
        if (this.#current) this.#flush(this.#current)
      }, 100)
  }

  #flush(rec: Recording): void {
    if (rec.stopped || rec.pending.length === 0) return
    const entries = rec.pending
    rec.pending = []
    const header = structuredClone(rec.header)
    rec.chain = rec.chain
      .then(async () => {
        if (rec.stopped) return
        const written = await writeMatchBatch(this.#db, header, entries, !rec.created)
        rec.created = true
        if (!written)
          rec.stopped = true // explicitly removed in another tab; never bring back
        else if (header.status !== "running") await pruneMatches(this.#db)
      })
      .catch((error: unknown) => {
        rec.stopped = true
        this.#error(error)
      })
  }

  /** Tests and shutdown can await every committed batch, including the preceding game. */
  async flush(): Promise<void> {
    for (const rec of this.#all) this.#flush(rec)
    await Promise.all(Array.from(this.#all, (rec) => rec.chain))
    for (const rec of this.#all) if (rec !== this.#current) this.#all.delete(rec)
  }

  dispose(): void {
    this.#unsubscribe()
    if (this.#timer !== null) clearTimeout(this.#timer)
    this.#timer = null
    void this.flush()
  }
}
