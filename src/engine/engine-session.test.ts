/*
 * EngineSession: the engine's life (boot, ready, abort, stop, prewarm) and
 * the game's (queued, starting, refused, playing, over, aborted). The engine
 * is the real EngineClient over a scripted worker (src/test/game-fixtures.ts),
 * so every message these tests send passes the real schema and order checks.
 */
import { checkEngineMessage, type EngineMessage, type FeatureReport } from "@openmana/engine-protocol"
import { describe, expect, it, vi } from "vitest"
import {
  gameState,
  MULLIGAN_PROMPT,
  READY,
  settle,
  SUPPORTED,
  TEST_ASSETS,
  testEngine,
  testSetup,
  type TestEngine,
} from "@/test/game-fixtures"
import { DEFAULT_BOOT_OPTIONS, engineArgs, EngineSession, matchInProgress, NOTICE_LIMIT, type MatchSnapshot } from "./engine-session"

/** A booted, ready engine. */
async function ready(): Promise<TestEngine> {
  const engine = testEngine()
  engine.session.start()
  await settle()
  engine.worker().boot()
  expect(engine.session.getSnapshot().engine.status).toBe("ready")
  return engine
}

/** A game running up to Forge's mulligan question. */
async function playing(): Promise<TestEngine> {
  const engine = await ready()
  expect(engine.session.startMatch(testSetup())).toBe(true)
  engine.worker().startGame()
  expect(engine.session.getSnapshot().match?.status).toBe("playing")
  return engine
}

function match<S extends MatchSnapshot["status"]>(engine: TestEngine, status: S): Extract<MatchSnapshot, { status: S }> {
  const current = engine.session.getSnapshot().match
  expect(current?.status).toBe(status)
  return current as Extract<MatchSnapshot, { status: S }>
}

describe("EngineSession: the engine", () => {
  it("reports a build without engine and never starts one", () => {
    const loadClient = vi.fn()
    const session = new EngineSession({ assets: { available: false, reason: "omitted", detail: "built with OPENMANA_ENGINE=omit" }, loadClient })
    expect(session.getSnapshot()).toEqual({ engine: { status: "unavailable", reason: "omitted", detail: "built with OPENMANA_ENGINE=omit" }, match: null })
    session.start()
    session.prewarm()
    expect(session.startMatch(testSetup())).toBe(false)
    expect(session.getSnapshot().engine.status).toBe("unavailable")
    expect(session.getSnapshot().match).toBeNull()
    expect(loadClient).not.toHaveBeenCalled()
  })

  it("reports a browser without what the engine needs and never starts it", () => {
    const features: FeatureReport = {
      ...SUPPORTED,
      crossOriginIsolated: false,
      sharedArrayBuffer: false,
      missing: ["Cross-Origin-Isolation (COOP/COEP-Header)", "SharedArrayBuffer"],
      supported: false,
    }
    const engine = testEngine({ features })
    const snapshot = engine.session.getSnapshot().engine
    expect(snapshot.status).toBe("unsupported")
    expect(snapshot.status === "unsupported" && snapshot.message).toBe(
      "Dieser Browser kann die Forge-Engine nicht ausführen. Es fehlt: Cross-Origin-Isolation (COOP/COEP-Header), SharedArrayBuffer.",
    )
    engine.session.start()
    engine.session.prewarm()
    expect(engine.session.startMatch(testSetup())).toBe(false)
    expect(engine.workers).toHaveLength(0)
  })

  it("boots through the engine's own phases to ready, with eager card loading and German Forge texts", async () => {
    const engine = testEngine()
    const { session } = engine
    expect(session.getSnapshot().engine.status).toBe("idle")
    const seen: string[] = []
    session.subscribe(() => seen.push(session.getSnapshot().engine.status))

    session.start()
    const booting = session.getSnapshot().engine
    expect(booting.status === "booting" && booting.steps.map((s) => s.state)).toEqual(["pending", "pending", "pending", "pending"])

    await settle()
    const worker = engine.worker()
    const launch = engine.launches[0]!
    expect(launch.workerUrl.href).toBe("https://openmana.test/engine/0123456789abcdef/engine-worker.js")
    expect(launch.engineScriptUrl).toBe("https://openmana.test/engine/0123456789abcdef/openmana-engine.js")
    expect(launch.wasmUrl).toBe("https://openmana.test/engine/0123456789abcdef/openmana-engine.js.wasm")
    expect(engineArgs(DEFAULT_BOOT_OPTIONS)).toEqual(["--card-loading=eager", "--language=de-DE", "--card-language=de-DE"])
    expect(engineArgs({ cardLanguage: "en-US" })).toEqual(["--card-loading=eager", "--language=de-DE", "--card-language=en-US"])
    // The client starts the worker with exactly these arguments.
    const start = worker.commands[0]!
    expect(start.type === "engine.start" && start.args).toEqual(["--card-loading=eager", "--language=de-DE", "--card-language=de-DE"])

    engine.tick(10)
    worker.send({ type: "engine.boot", phase: "worker-features", t: 10, features: SUPPORTED })
    engine.tick(20)
    worker.send({ type: "engine.boot", phase: "launcher-load", t: 30 })
    engine.tick(1500)
    worker.send({ type: "engine.boot", phase: "wasm-fetch-compile", t: 1530 })
    let snapshot = session.getSnapshot().engine
    expect(snapshot.status === "booting" && snapshot.steps.map((s) => s.state)).toEqual(["done", "done", "active", "pending"])
    expect(snapshot.status === "booting" && snapshot.steps[0]).toEqual({ phase: "worker-features", state: "done", startedAt: 1010, endedAt: 1030 })

    engine.tick(900)
    worker.send({ type: "engine.boot", phase: "java-main", t: 2430 })
    engine.tick(2000)
    worker.send(READY)
    snapshot = session.getSnapshot().engine
    expect(snapshot.status).toBe("ready")
    if (snapshot.status !== "ready") return
    expect(snapshot.steps.every((s) => s.state === "done")).toBe(true)
    expect(snapshot.readyAt - snapshot.startedAt).toBe(4430)
    expect(snapshot.ready.boot.language).toBe("de-DE")
    expect(seen[0]).toBe("booting")
    expect(seen.at(-1)).toBe("ready")
  })

  it("shows an abort with its reason and can start again with a fresh worker", async () => {
    const engine = testEngine()
    engine.session.start()
    await settle()
    const first = engine.worker()
    first.send({ type: "engine.boot", phase: "worker-features", t: 1 })
    first.send({ type: "engine.abort", reason: "boot-failed", origin: "engine", message: "java.lang.OutOfMemoryError", stage: "java-main" })
    const aborted = engine.session.getSnapshot().engine
    expect(aborted.status === "aborted" && aborted.abort.reason).toBe("boot-failed")
    expect(first.terminated).toBe(true)

    engine.session.start()
    await settle()
    expect(engine.workers).toHaveLength(2)
    expect(engine.session.getSnapshot().engine.status).toBe("booting")
  })

  it("stops a running engine and ignores what its old worker still says", async () => {
    const engine = await ready()
    const worker = engine.worker()
    engine.session.stop()
    expect(engine.session.getSnapshot().engine.status).toBe("idle")
    expect(worker.terminated).toBe(true)
    worker.send({ type: "engine.boot", phase: "java-main", t: 5 })
    expect(engine.session.getSnapshot().engine.status).toBe("idle")
  })

  it("drops a client that arrives after the player cancelled", async () => {
    const engine = testEngine()
    engine.session.start()
    engine.session.stop()
    await settle()
    expect(engine.workers).toHaveLength(0)
    expect(engine.session.getSnapshot().engine.status).toBe("idle")
  })

  it("reports a failed client download as an abort instead of hanging", async () => {
    const session = new EngineSession({
      assets: TEST_ASSETS,
      detectFeatures: () => SUPPORTED,
      loadClient: () => Promise.reject(new Error("Failed to fetch dynamically imported module")),
      baseUrl: "https://openmana.test/play",
    })
    session.start()
    await settle()
    const snapshot = session.getSnapshot().engine
    expect(snapshot.status).toBe("aborted")
    if (snapshot.status !== "aborted") return
    expect(snapshot.abort).toMatchObject({ reason: "boot-failed", origin: "client", stage: "client-load" })
    expect(snapshot.abort.message).toContain("Failed to fetch dynamically imported module")
    expect(() => checkEngineMessage(snapshot.abort)).not.toThrow()
  })

  it("ignores start while booting or ready", async () => {
    const engine = testEngine()
    engine.session.start()
    engine.session.start()
    await settle()
    engine.worker().boot()
    engine.session.start()
    await settle()
    expect(engine.workers).toHaveLength(1)
  })

  it("prewarms only an idle engine: never a second one, never a failed one by itself", async () => {
    const engine = testEngine()
    engine.session.prewarm()
    expect(engine.session.getSnapshot().engine.status).toBe("booting")
    engine.session.prewarm()
    await settle()
    expect(engine.workers).toHaveLength(1)
    engine.worker().boot()
    engine.session.prewarm()
    await settle()
    expect(engine.workers).toHaveLength(1)
    engine.worker().crash("the worker died")
    expect(engine.session.getSnapshot().engine.status).toBe("aborted")
    engine.session.prewarm()
    await settle()
    expect(engine.workers).toHaveLength(1)
    expect(engine.session.getSnapshot().engine.status).toBe("aborted")
  })
})

describe("EngineSession: the player's card language (prompt 12)", () => {
  const args = (worker: { commands: readonly { type: string; args?: readonly string[] }[] }) => worker.commands.find((command) => command.type === "engine.start")?.args

  it("boots with the card language it was told; the engine reports it", async () => {
    const engine = testEngine()
    engine.session.setBootOptions({ cardLanguage: "en-US" })
    expect(engine.session.bootOptions).toEqual({ cardLanguage: "en-US" })
    engine.session.prewarm()
    await settle()
    expect(args(engine.worker())).toEqual(["--card-loading=eager", "--language=de-DE", "--card-language=en-US"])
    engine.worker().boot()
    const snapshot = engine.session.getSnapshot().engine
    expect(snapshot.status === "ready" && snapshot.ready.boot.cardLanguage).toBe("en-US")
  })

  it("replaces a warm engine no game uses yet, booting or ready; the same options change nothing", async () => {
    const engine = testEngine()
    engine.session.prewarm()
    await settle()
    engine.worker().boot()
    engine.session.setBootOptions({ cardLanguage: "de-DE" })
    await settle()
    expect(engine.workers).toHaveLength(1)

    engine.session.setBootOptions({ cardLanguage: "en-US" })
    await settle()
    expect(engine.workers).toHaveLength(2)
    expect(engine.workers[0]!.terminated).toBe(true)
    expect(args(engine.worker())).toContain("--card-language=en-US")
    expect(engine.session.getSnapshot().engine.status).toBe("booting")

    // Changed again while booting: that boot is dropped for one with the new options.
    engine.session.setBootOptions({ cardLanguage: "de-DE" })
    await settle()
    expect(engine.workers).toHaveLength(3)
    expect(engine.workers[1]!.terminated).toBe(true)
    expect(args(engine.worker())).toContain("--card-language=de-DE")
  })

  it("keeps the engine of a game on its way or running; the next game boots with the new options", async () => {
    const engine = await ready()
    expect(engine.session.startMatch(testSetup())).toBe(true)
    engine.worker().startGame()
    engine.session.setBootOptions({ cardLanguage: "en-US" })
    await settle()
    expect(engine.workers).toHaveLength(1)
    expect(match(engine, "playing").game.aiProfile).toBe("Default")
    expect(engine.session.concede()).toEqual({ ok: true })
    engine.worker().concedeAccepted()
    expect(engine.session.startMatch(testSetup())).toBe(true)
    await settle()
    expect(engine.workers).toHaveLength(2)
    expect(args(engine.worker())).toContain("--card-language=en-US")
  })

  it("an idle or failed engine is not started by an option change", async () => {
    const engine = testEngine()
    engine.session.setBootOptions({ cardLanguage: "en-US" })
    await settle()
    expect(engine.workers).toHaveLength(0)
    engine.session.start()
    await settle()
    engine.worker().crash("died")
    engine.session.setBootOptions({ cardLanguage: "de-DE" })
    await settle()
    expect(engine.workers).toHaveLength(1)
    expect(engine.session.getSnapshot().engine.status).toBe("aborted")
  })
})

describe("EngineSession: a game", () => {
  it("hands the game to a ready engine and runs it to its result; the spent worker is released", async () => {
    const engine = await ready()
    const { session } = engine
    const setup = testSetup()
    engine.tick(100)
    expect(session.startMatch(setup)).toBe(true)
    const worker = engine.worker()
    expect(worker.matchStarts().map((command) => command.match)).toEqual([setup.request])
    expect(session.getSnapshot().engine.status).toBe("busy")
    expect(match(engine, "starting")).toMatchObject({ setup, requestedAt: 1100, stalledMs: null })
    expect(matchInProgress(session.getSnapshot().match)).toBe(true)

    engine.tick(50)
    worker.startGame()
    const running = match(engine, "playing")
    expect(running.startedAt).toBe(1150)
    expect(running.game).toMatchObject({ human: "Spieler", ai: "Forge-KI", aiProfile: "Default", format: "constructed" })
    expect(running.state?.seq).toBe(3)
    expect(running.state?.players.map((p) => [p.me, p.life, p.zones.hand.length, p.library])).toEqual([
      [true, 20, 7, 53],
      [false, 20, 7, 53],
    ])
    expect(running.questions.map((q) => [q.id, q.kind, q.kind === "buttons" ? q.purpose : null])).toEqual([[1, "buttons", "mulligan"]])
    expect(running.prompt).toBe(MULLIGAN_PROMPT)
    expect(running.waiting).toBe(true)
    expect(running.conceding).toBe(false)

    expect(session.concede()).toEqual({ ok: true })
    expect(worker.inputs()).toEqual([{ type: "concede", seq: 1 }])
    expect(match(engine, "playing").conceding).toBe(true)
    expect(match(engine, "playing").waiting).toBe(false)
    // A second tap on "Aufgeben" sends nothing more.
    expect(session.concede()).toEqual({ ok: true })
    expect(worker.inputs()).toEqual([])

    engine.tick(1000)
    worker.concedeAccepted()
    const over = match(engine, "over")
    expect(over.end).toMatchObject({ result: "loss", conceded: true, reason: "AllOpponentsLost", turns: 0 })
    expect(over.endedAt - over.startedAt).toBe(1000)
    expect(over.state?.running).toBe(false)
    expect(over.summary?.inputs).toBe(1)
    // One game per worker: it is terminated, the engine is idle for the next game.
    expect(worker.terminated).toBe(true)
    expect(session.getSnapshot().engine.status).toBe("idle")
    expect(matchInProgress(session.getSnapshot().match)).toBe(false)
  })

  it("waits for a booting engine and starts the game as soon as it is ready", async () => {
    const engine = testEngine()
    engine.session.prewarm()
    await settle()
    expect(engine.session.startMatch(testSetup())).toBe(true)
    expect(match(engine, "queued").setup).toEqual(testSetup())
    expect(engine.worker().matchStarts()).toHaveLength(0)
    engine.worker().boot()
    expect(engine.worker().matchStarts()).toHaveLength(1)
    expect(match(engine, "starting").setup).toEqual(testSetup())
    expect(engine.workers).toHaveLength(1)
  })

  it("boots an engine for a game when none is running, and a fresh one after an abort", async () => {
    const engine = testEngine()
    expect(engine.session.startMatch(testSetup())).toBe(true)
    expect(engine.session.getSnapshot().engine.status).toBe("booting")
    await settle()
    engine.worker().crash("the worker died")
    const failed = match(engine, "aborted")
    expect(failed.game).toBeNull()
    expect(failed.abort).toMatchObject({ reason: "worker-error", origin: "client" })

    expect(engine.session.startMatch(testSetup())).toBe(true)
    await settle()
    expect(engine.workers).toHaveLength(2)
    engine.worker().boot()
    expect(match(engine, "starting")).toBeTruthy()
  })

  it("ends a game that waits for an engine that never gets ready (the client's ready timeout), instead of waiting forever", async () => {
    const engine = testEngine()
    engine.session.startMatch(testSetup())
    await settle()
    engine.worker().send({ type: "engine.boot", phase: "worker-features", t: 3, features: SUPPORTED })
    engine.timers.advance(179_000)
    expect(match(engine, "queued")).toBeTruthy()
    engine.timers.advance(1_000)
    expect(match(engine, "aborted").abort).toMatchObject({ reason: "ready-timeout", origin: "client" })
    expect(engine.worker().terminated).toBe(true)
    expect(engine.session.getSnapshot().engine.status).toBe("aborted")
  })

  it("shows why Forge did not start a game, and the same worker takes the next one", async () => {
    const engine = await ready()
    engine.session.startMatch(testSetup())
    const worker = engine.worker()
    worker.send({
      type: "engine.error",
      code: "deck-rejected",
      message: "Forge does not know 1 card(s) of deck 'Rot': [\"No Such Card\"]",
      report: { deck: "Rot", unknownCards: ["No Such Card"] },
    })
    const refused = match(engine, "refused")
    expect(refused.error).toMatchObject({ code: "deck-rejected", report: { deck: "Rot", unknownCards: ["No Such Card"] } })
    expect(engine.session.getSnapshot().engine.status).toBe("ready")
    expect(matchInProgress(engine.session.getSnapshot().match)).toBe(false)

    expect(engine.session.startMatch(testSetup({ drawn: true }))).toBe(true)
    expect(engine.workers).toHaveLength(1)
    expect(worker.matchStarts()).toHaveLength(2)
    worker.startGame()
    expect(match(engine, "playing").setup.ai.drawn).toBe(true)
  })

  it("boots a fresh worker after a refusal that leaves the worker unable to play", async () => {
    const engine = await ready()
    engine.session.startMatch(testSetup())
    const worker = engine.worker()
    worker.send({ type: "engine.error", code: "already-started", message: "this worker already ran a game; use a fresh worker" })
    expect(match(engine, "refused").error.code).toBe("already-started")
    expect(worker.terminated).toBe(true)
    expect(engine.session.getSnapshot().engine.status).toBe("idle")
    engine.session.startMatch(testSetup())
    await settle()
    expect(engine.workers).toHaveLength(2)
  })

  it("refuses a request the protocol does not allow before sending it", async () => {
    const engine = await ready()
    const setup = testSetup()
    const broken = { ...setup, request: { ...setup.request, human: { ...setup.request.human, name: "" } } }
    expect(engine.session.startMatch(broken)).toBe(true)
    const refused = match(engine, "refused")
    expect(refused.error.code).toBe("invalid-request")
    expect(() => checkEngineMessage(refused.error)).not.toThrow()
    expect(engine.worker().matchStarts()).toHaveLength(0)
    expect(engine.session.getSnapshot().engine.status).toBe("ready")
  })

  it("never starts a second game while one is on its way or running", async () => {
    const engine = await playing()
    expect(engine.session.startMatch(testSetup())).toBe(false)
    expect(engine.worker().matchStarts()).toHaveLength(1)
    expect(match(engine, "playing")).toBeTruthy()
  })

  it("ends a running game without a result when the engine fails, keeping the last state", async () => {
    const engine = await playing()
    engine.worker().send({ type: "engine.abort", reason: "engine-failure", origin: "engine", message: "java.lang.IllegalStateException: boom", stage: "match" })
    const aborted = match(engine, "aborted")
    expect(aborted.abort).toMatchObject({ reason: "engine-failure", origin: "engine" })
    expect(aborted.game?.human).toBe("Spieler")
    expect(aborted.state?.seq).toBe(3)
    expect(engine.session.getSnapshot().engine.status).toBe("aborted")
    expect(engine.worker().terminated).toBe(true)
  })

  it("treats a message that breaks the protocol as a technical abort, never as a game event", async () => {
    const engine = await playing()
    // A state older than the one before: the client refuses it.
    engine.worker().send(gameState(2))
    expect(match(engine, "aborted").abort).toMatchObject({ reason: "protocol-violation", origin: "client" })
  })

  it("reports a silent engine and lets the player end the game without a result", async () => {
    const engine = await playing()
    engine.session.concede()
    engine.timers.advance(30_000)
    expect(match(engine, "playing").stalledMs).toBe(30_000)
    // The engine speaks again: the warning goes away.
    engine.worker().send({ type: "message", kind: "prompt", text: "" })
    expect(match(engine, "playing").stalledMs).toBeNull()
    engine.timers.advance(30_000)
    expect(match(engine, "playing").stalledMs).toBe(30_000)

    engine.session.abortMatch()
    const aborted = match(engine, "aborted")
    expect(aborted.abort).toMatchObject({ reason: "terminated", origin: "client" })
    expect(engine.worker().terminated).toBe(true)
  })

  it("stopping the engine cancels a waiting game and ends a running one", async () => {
    const waiting = testEngine()
    waiting.session.startMatch(testSetup())
    waiting.session.stop()
    expect(waiting.session.getSnapshot()).toMatchObject({ engine: { status: "idle" }, match: null })

    const engine = await playing()
    engine.session.stop()
    expect(match(engine, "aborted").abort).toMatchObject({ reason: "terminated", origin: "client" })
    expect(engine.session.getSnapshot().engine.status).toBe("idle")
    expect(engine.worker().terminated).toBe(true)
  })

  it("cancels a game waiting for the engine; the engine keeps booting", async () => {
    const engine = testEngine()
    engine.session.startMatch(testSetup())
    engine.session.cancelMatch()
    expect(engine.session.getSnapshot()).toMatchObject({ engine: { status: "booting" }, match: null })
    await settle()
    engine.worker().boot()
    expect(engine.worker().matchStarts()).toHaveLength(0)
    expect(engine.session.getSnapshot().engine.status).toBe("ready")
  })

  it("starts the next game on a fresh worker even before the last one sent its summary", async () => {
    const engine = await playing()
    engine.session.concede()
    const first = engine.worker()
    first.send({ type: "question.withdrawn", id: 1 })
    first.send(gameState(4, { running: false }))
    first.send({ type: "game.end", winner: "Forge-KI", reason: "AllOpponentsLost", turns: 0, result: "loss", players: [], conceded: true } satisfies EngineMessage)
    expect(match(engine, "over").summary).toBeNull()
    expect(engine.session.getSnapshot().engine.status).toBe("busy")

    expect(engine.session.startMatch(testSetup())).toBe(true)
    expect(first.terminated).toBe(true)
    await settle()
    expect(engine.workers).toHaveLength(2)
    engine.worker().boot()
    expect(engine.worker().matchStarts()).toHaveLength(1)
  })

  it("releases a finished game's engine that does not report its summary", async () => {
    const engine = await playing()
    engine.session.concede()
    const worker = engine.worker()
    worker.send({ type: "question.withdrawn", id: 1 })
    worker.send({ type: "game.end", winner: "Forge-KI", reason: "AllOpponentsLost", turns: 0, result: "loss", players: [], conceded: true } satisfies EngineMessage)
    engine.timers.advance(30_000)
    expect(match(engine, "over").summary).toBeNull()
    expect(worker.terminated).toBe(true)
    expect(engine.session.getSnapshot().engine.status).toBe("idle")
  })

  it("keeps Forge's notices and refused inputs for the player to see, and counts them all", async () => {
    const engine = await playing()
    const worker = engine.worker()
    expect(match(engine, "playing").noticeCount).toBe(0)
    worker.send({ type: "message", kind: "notice", text: "Forge-KI zeigt Riesenwuchs.", title: "Hinweis" })
    worker.send({ type: "message", kind: "error", text: "Etwas ging schief." })
    expect(match(engine, "playing").notices.map((n) => (n.type === "message" ? n.kind : n.type))).toEqual(["notice", "error"])
    expect(match(engine, "playing").noticeCount).toBe(2)
    // Forge's prompt line is no notice.
    worker.send({ type: "message", kind: "prompt", text: "Starthand behalten?" })
    expect(match(engine, "playing").noticeCount).toBe(2)

    engine.session.concede()
    worker.send({ type: "input.rejected", seq: 1, reason: "invalid", detail: "concede is not possible now", input: { type: "concede", seq: 1 } })
    const running = match(engine, "playing")
    expect(running.conceding).toBe(false)
    expect(running.notices.at(-1)).toMatchObject({ type: "input.rejected", reason: "invalid" })

    for (let i = 0; i < NOTICE_LIMIT + 5; i++) worker.send({ type: "message", kind: "notice", text: `Hinweis ${i}` })
    const notices = match(engine, "playing").notices
    expect(notices).toHaveLength(NOTICE_LIMIT)
    expect(notices.at(-1)).toMatchObject({ text: `Hinweis ${NOTICE_LIMIT + 4}` })
    // The count goes on past the kept ones: the table tells new notices from old ones by it.
    expect(match(engine, "playing").noticeCount).toBe(3 + NOTICE_LIMIT + 5)
  })

  it("concedes only a running game", async () => {
    const engine = await ready()
    expect(engine.session.concede()).toEqual({ ok: false, reason: "Es läuft keine Partie." })
    engine.session.startMatch(testSetup())
    expect(engine.session.concede()).toMatchObject({ ok: false })
    expect(engine.worker().inputs()).toEqual([])
  })
})

describe("EngineSession: players and floating mana (prompt 17)", () => {
  it("sends Forge's player.tap and mana.use while Forge waits; Forge then no longer waits", async () => {
    const engine = await playing()
    expect(engine.session.tapPlayer(1)).toEqual({ ok: true })
    expect(engine.worker().inputs()).toEqual([{ type: "player.tap", seq: 1, player: 1 }])
    expect(match(engine, "playing").waiting).toBe(false)
    engine.worker().send({ type: "engine.waiting", consumed: 1 })
    expect(engine.session.useMana("B")).toEqual({ ok: true })
    expect(engine.worker().inputs()).toEqual([{ type: "mana.use", seq: 2, color: "B" }])
  })

  it("never while Forge computes, never for a player that is not there, not during a concession", async () => {
    const engine = await playing()
    expect(engine.session.tapPlayer(7)).toEqual({ ok: false, reason: "Diesen Spieler gibt es nicht." })
    engine.session.tapPlayer(1)
    engine.worker().inputs()
    expect(engine.session.tapPlayer(0)).toEqual({ ok: false, reason: "Forge rechnet gerade – antippen geht, sobald Forge wieder auf dich wartet." })
    expect(engine.session.useMana("R")).toEqual({ ok: false, reason: "Forge rechnet gerade – bezahlen geht, sobald Forge wieder auf dich wartet." })
    engine.worker().send({ type: "engine.waiting", consumed: 1 })
    engine.session.concede()
    expect(engine.session.tapPlayer(0)).toEqual({ ok: false, reason: "Die Aufgabe ist unterwegs." })
    expect(engine.session.useMana("R")).toEqual({ ok: false, reason: "Die Aufgabe ist unterwegs." })
    expect(engine.worker().inputs()).toEqual([{ type: "concede", seq: 2 }])
  })
})

describe("EngineSession: tapping a card (prompt 14)", () => {
  it("sends Forge's card.tap while Forge waits; Forge then no longer waits", async () => {
    const engine = await playing()
    expect(match(engine, "playing").waiting).toBe(true)
    expect(engine.session.tapCard(1)).toEqual({ ok: true })
    expect(engine.worker().inputs()).toEqual([{ type: "card.tap", seq: 1, card: 1 }])
    expect(match(engine, "playing").waiting).toBe(false)
  })

  it("never while Forge computes: a tap would be read later, in whatever step comes then", async () => {
    const engine = await playing()
    engine.session.tapCard(1)
    engine.worker().inputs()
    expect(engine.session.tapCard(2)).toEqual({ ok: false, reason: "Forge rechnet gerade – antippen geht, sobald Forge wieder auf dich wartet." })
    expect(engine.worker().inputs()).toEqual([])
  })

  it("says why the client refused a tap (a card no longer visible), in German, and sends nothing", async () => {
    const engine = await playing()
    expect(engine.session.tapCard(999)).toEqual({ ok: false, reason: "Diese Karte ist gerade nicht mehr zu sehen." })
    expect(engine.worker().inputs()).toEqual([])
    expect(match(engine, "playing").waiting).toBe(true)
  })

  it("not while a concession is on its way, not without a running game", async () => {
    const engine = await ready()
    expect(engine.session.tapCard(1)).toEqual({ ok: false, reason: "Es läuft keine Partie." })
    engine.session.startMatch(testSetup())
    engine.worker().startGame()
    engine.session.concede()
    expect(engine.session.tapCard(1)).toEqual({ ok: false, reason: "Die Aufgabe ist unterwegs." })
    expect(engine.worker().inputs()).toEqual([{ type: "concede", seq: 1 }])
  })

  it("a tap Forge ignores comes back as its notice (input.rejected), never silently", async () => {
    const engine = await playing()
    engine.session.tapCard(1)
    engine.worker().send({ type: "input.rejected", seq: 1, reason: "no-effect", detail: "Forge did not accept this card in the current step", input: { type: "card.tap", seq: 1, card: 1 } })
    expect(match(engine, "playing").notices.at(-1)).toMatchObject({ type: "input.rejected", reason: "no-effect" })
  })
})

describe("EngineSession: answering Forge (prompt 15)", () => {
  it("sends the answer to the question it names while Forge waits; Forge then no longer waits", async () => {
    const engine = await playing()
    expect(engine.session.answer(1, { kind: "buttons", button: 1 })).toEqual({ ok: true })
    expect(engine.worker().inputs()).toEqual([{ type: "answer", seq: 1, question: 1, kind: "buttons", button: 1 }])
    expect(match(engine, "playing").waiting).toBe(false)
    // Forge closes the question it took, and asks the next.
    engine.worker().send({ type: "question.answered", id: 1, seq: 1 })
    expect(match(engine, "playing").questions).toEqual([])
  })

  it("never while Forge computes: its questions change meanwhile, and an answer is meant for the one the player saw", async () => {
    const engine = await playing()
    engine.session.tapCard(1)
    engine.worker().inputs()
    expect(engine.session.answer(1, { kind: "buttons", button: 1 })).toEqual({ ok: false, reason: "Forge rechnet gerade – antworten geht, sobald Forge wieder auf dich wartet." })
    expect(engine.worker().inputs()).toEqual([])
  })

  it("says why the client refused an answer (a question no longer open, the wrong kind), in German, and sends nothing", async () => {
    const engine = await playing()
    expect(engine.session.answer(1, { kind: "confirm", yes: true })).toEqual({ ok: false, reason: "Die Antwort passt nicht zu Forges Frage." })
    expect(engine.session.answer(7, { kind: "buttons", button: 1 })).toEqual({ ok: false, reason: "Diese Frage hat Forge nie gestellt." })
    engine.worker().send({ type: "question.withdrawn", id: 1 })
    expect(engine.session.answer(1, { kind: "buttons", button: 1 })).toEqual({ ok: false, reason: "Die Frage ist schon beantwortet oder zurückgezogen." })
    expect(engine.worker().inputs()).toEqual([])
    expect(match(engine, "playing").waiting).toBe(true)
  })

  it("only the blocking question can be answered while it is open", async () => {
    const engine = await playing()
    engine.worker().send({ type: "question", kind: "confirm", id: 2, blocking: true, text: "Möchtest du den Effekt nutzen?", suggested: true })
    engine.worker().send({ type: "engine.waiting", consumed: 0 })
    expect(engine.session.answer(1, { kind: "buttons", button: 1 })).toEqual({ ok: false, reason: "Forge wartet zuerst auf deine Antwort auf seine Frage." })
    expect(engine.session.answer(2, { kind: "confirm", yes: false })).toEqual({ ok: true })
    expect(engine.worker().inputs()).toEqual([{ type: "answer", seq: 1, question: 2, kind: "confirm", yes: false }])
  })

  it("an answer Forge refuses (it does not fit, or came too late) comes back as its notice, and the question stays open", async () => {
    const engine = await playing()
    engine.worker().send({ type: "question", kind: "distribute", id: 2, blocking: true, text: "2 Kampfschaden", total: 2, min: 0, items: [{ nr: 1, text: "A" }, { nr: 2, text: "B" }] })
    engine.worker().send({ type: "engine.waiting", consumed: 0 })
    expect(engine.session.answer(2, { kind: "distribute", amounts: [2, 1] })).toEqual({ ok: true })
    engine.worker().send({ type: "input.rejected", seq: 1, reason: "invalid", detail: "amounts sum to 3, expected 2", input: { type: "answer", seq: 1, question: 2, kind: "distribute", amounts: [2, 1] } })
    engine.worker().send({ type: "engine.waiting", consumed: 1 })
    const game = match(engine, "playing")
    expect(game.notices.at(-1)).toMatchObject({ type: "input.rejected", reason: "invalid", detail: "amounts sum to 3, expected 2" })
    expect(game.questions.map((question) => question.id)).toEqual([1, 2])
    expect(game.waiting).toBe(true)
  })

  it("not while a concession is on its way, not without a running game; nothing is ever answered by itself", async () => {
    const engine = await ready()
    expect(engine.session.answer(1, { kind: "buttons", button: 1 })).toEqual({ ok: false, reason: "Es läuft keine Partie." })
    engine.session.startMatch(testSetup())
    engine.worker().startGame()
    // Forge asks; the session holds the question and sends nothing on its own.
    expect(match(engine, "playing").questions).toHaveLength(1)
    expect(engine.worker().inputs()).toEqual([])
    engine.session.concede()
    expect(engine.session.answer(1, { kind: "buttons", button: 1 })).toEqual({ ok: false, reason: "Die Aufgabe ist unterwegs." })
    expect(engine.worker().inputs()).toEqual([{ type: "concede", seq: 1 }])
  })
})
