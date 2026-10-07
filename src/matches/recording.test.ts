// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { testEngine, testSetup, settle, TEST_ASSETS } from "@/test/game-fixtures"
import { APP, match, openTestDatabase, uuid } from "@/test/storage-fixtures"
import {
  clearMatches,
  deleteMatch,
  listMatches,
  MATCH_RETENTION,
  pruneMatches,
  readMatch,
  writeMatchBatch,
} from "@/storage/matches"
import { writeSetting } from "@/storage/settings"
import { SCHEMA_VERSION } from "@/storage/generated/constants"
import { MIGRATIONS, upgradeRecord } from "@/storage/migrations"
import { MatchRecorder } from "./match-recorder"
import { checkReplay, exportReplay, importReplay, parseReplay, replayFrames } from "./replay"

async function recording() {
  const db = await openTestDatabase()
  const engine = testEngine()
  const error = vi.fn()
  let time = 100
  const assets = TEST_ASSETS.available
    ? { ...TEST_ASSETS, build: { ...TEST_ASSETS.build, manifestSha256: "a".repeat(64) } }
    : TEST_ASSETS
  const recorder = new MatchRecorder({
    session: engine.session,
    database: db,
    assets,
    app: APP,
    onError: error,
    uuid,
    now: () => new Date(1_790_000_000_000 + time),
    clock: () => time++,
  })
  engine.session.start()
  await settle()
  engine.worker().boot()
  engine.session.startMatch(testSetup())
  engine.worker().startGame()
  return { db, engine, recorder, error }
}

describe("automatic recording", () => {
  it("atomically captures exact request, build, decks, seed, snapshots, questions, accepted inputs, events and end across reload", async () => {
    const { db, engine, recorder, error } = await recording()
    const before = engine.session.getSnapshot().match
    expect(before?.status).toBe("playing")
    expect(engine.session.answer(1, { kind: "buttons", button: 1 }).ok).toBe(true)
    engine.worker().priority({ answered: 1 })
    const state = engine.session.getSnapshot().match
    expect(engine.session.tapCard(999999).ok).toBe(false)
    expect(engine.session.tapCard(1).ok).toBe(true)
    engine.worker().send({ type: "engine.waiting", consumed: 2 })
    expect(engine.session.tapPlayer(1).ok).toBe(true)
    engine.worker().send({ type: "engine.waiting", consumed: 3 })
    expect(engine.session.useMana("B").ok).toBe(true)
    engine.worker().send({ type: "engine.waiting", consumed: 4 })
    engine.session.concede()
    engine.worker().send({ type: "question.withdrawn", id: 2 })
    engine.worker().send({
      type: "events",
      entries: [
        { kind: "GAME_OUTCOME", text: null, actor: "me" },
        { kind: "GAME_OUTCOME", text: "gleich" },
        { kind: "GAME_OUTCOME", text: "gleich" },
      ],
    })
    engine.worker().send({
      type: "game.end",
      winner: "Forge-KI",
      result: "loss",
      reason: "Concede",
      turns: 1,
      conceded: true,
      players: [],
    })
    await recorder.flush()
    const headers = await listMatches(db)
    expect(headers.records).toHaveLength(1)
    const stored = (await readMatch(db, headers.records[0]!.id))!
    expect(stored.match).toMatchObject({
      status: "finished",
      seed: testSetup().request.seed,
      engine: { manifestSha256: "a".repeat(64) },
      end: { result: "loss", turns: 1 },
    })
    expect(stored.match.human.deck).toEqual({ ...testSetup().request.human.deck, sideboard: [], commander: [] })
    expect(stored.log.map((e) => e.seq)).toEqual(stored.log.map((_, i) => i))
    expect(stored.log.filter((e) => e.message.type === "answer")).toHaveLength(1)
    expect(stored.log.filter((e) => e.message.type === "card.tap")).toHaveLength(1)
    expect(stored.log.filter((e) => e.message.type === "concede")).toHaveLength(1)
    expect(
      stored.log.filter((e) => e.from === "player" && typeof e.message["seq"] === "number").map((e) => e.message),
    ).toEqual([
      { type: "answer", seq: 1, question: 1, kind: "buttons", button: 1 },
      { type: "card.tap", seq: 2, card: 1 },
      { type: "player.tap", seq: 3, player: 1 },
      { type: "mana.use", seq: 4, color: "B" },
      { type: "concede", seq: 5 },
    ])
    const frames = replayFrames(stored)
    expect(frames.find((f) => f.state.seq === (state?.status === "playing" ? state.state?.seq : 0))?.state).toEqual(
      state?.status === "playing" ? state.state : null,
    )
    expect(frames.at(-1)?.history.map((e) => e.text)).toEqual([null, "gleich", "gleich"])
    expect(frames.at(-1)?.questions).toEqual([])
    expect(error).not.toHaveBeenCalled()
    recorder.dispose()
    engine.session.stop()
    db.close()
    const reopened = await openTestDatabase()
    expect(await readMatch(reopened, stored.match.id)).toEqual(stored)
    reopened.close()
  })

  it("records a technical stop without inventing a result; next game gets another id", async () => {
    const { db, engine, recorder, error } = await recording()
    engine.session.stop()
    await recorder.flush()
    const first = (await listMatches(db)).records[0]!
    expect(first).toMatchObject({ status: "aborted", end: null })
    expect((await readMatch(db, first.id))!.log.at(-1)?.message.type).toBe("engine.abort")
    engine.session.startMatch(testSetup())
    await settle()
    engine.worker().boot()
    engine.worker().startGame()
    await recorder.flush()
    expect((await listMatches(db)).records).toHaveLength(2)
    expect(error).not.toHaveBeenCalled()
    recorder.dispose()
    engine.session.stop()
    db.close()
  })

  it("deleting a running recording or clearing never resurrects it when further snapshots arrive", async () => {
    const { db, engine, recorder } = await recording()
    await recorder.flush()
    const id = (await listMatches(db)).records[0]!.id
    await deleteMatch(db, id)
    engine.worker().priority()
    await recorder.flush()
    expect(await readMatch(db, id)).toBeNull()
    expect(await db.read(["matchLog"], (tx) => tx.objectStore("matchLog").count())).toBe(0)
    await clearMatches(db)
    recorder.dispose()
    engine.session.stop()
    db.close()
  })

  it("a failed transaction reports once, retains the prior complete batch and does not affect the game", async () => {
    const { db, engine, recorder, error } = await recording()
    await recorder.flush()
    const previous = (await listMatches(db)).records[0]!
    vi.spyOn(db, "write").mockRejectedValue(new DOMException("full", "QuotaExceededError"))
    engine.worker().priority()
    await recorder.flush()
    expect(error).toHaveBeenCalledTimes(1)
    expect(engine.session.getSnapshot().match?.status).toBe("playing")
    engine.session.stop()
    await recorder.flush()
    expect(error).toHaveBeenCalledTimes(1)
    expect((await readMatch(db, previous.id))!.match.status).toBe("running")
    recorder.dispose()
    db.close()
  })
})

describe("portable replay and retention", () => {
  it("round trips all messages and snapshots, deduplicates exact imports and rejects conflicting ids atomically", async () => {
    const { db, engine, recorder } = await recording()
    engine.session.concede()
    engine.worker().concedeAccepted()
    await recorder.flush()
    const header = (await listMatches(db)).records[0]!
    const stored = (await readMatch(db, header.id))!
    const parsed = await parseReplay(exportReplay(stored))
    expect(parsed.match).toEqual(stored.match)
    expect(parsed.log).toEqual(stored.log)
    expect(await importReplay(db, parsed)).toBe("existing")
    const reordered = { ...parsed, match: Object.fromEntries(Object.entries(parsed.match).reverse()) }
    expect(await importReplay(db, checkReplay(reordered))).toBe("existing")
    const falseResult = structuredClone(parsed)
    falseResult.match.end!.result = "win"
    expect(() => checkReplay(falseResult)).toThrow(/Ergebnis stimmt nicht/)
    const noEnd = structuredClone(parsed)
    noEnd.match.endedAt = null
    expect(() => checkReplay(noEnd)).toThrow(/unvollständig/)
    await clearMatches(db)
    expect(await importReplay(db, parsed)).toBe("imported")
    const conflicting = structuredClone(parsed)
    conflicting.match.ai.name = "anders"
    await expect(importReplay(db, conflicting)).rejects.toThrow(/andere Aufzeichnung/)
    expect(await readMatch(db, header.id)).toEqual(stored)
    recorder.dispose()
    db.close()
  })

  it("rejects malformed, missing, foreign, descending, oversized and future files before any write", async () => {
    const { db, engine, recorder } = await recording()
    await recorder.flush()
    const stored = (await readMatch(db, (await listMatches(db)).records[0]!.id))!
    const doc = await parseReplay(exportReplay(stored))
    for (const mutate of [
      (v: typeof doc) => {
        v.log[1]!.seq++
      },
      (v: typeof doc) => {
        v.log[1]!.matchId = uuid()
      },
      (v: typeof doc) => {
        v.log[1]!.at = -1
      },
      (v: typeof doc) => {
        v.log.find((e) => e.message.type === "state")!.message = { type: "state", bad: true }
      },
      (v: typeof doc) => {
        v.schemaVersion = SCHEMA_VERSION + 1
      },
      (v: typeof doc) => {
        v.match.endedAt = v.match.startedAt
      },
      (v: typeof doc) => {
        v.log.find((e) => e.message.type === "game.started")!.message["format"] = "commander"
      },
    ]) {
      const value = structuredClone(doc)
      mutate(value)
      expect(() => checkReplay(value)).toThrow()
    }
    await expect(parseReplay(new Blob(["{bad"]))).rejects.toThrow(/lesbares JSON/)
    await expect(parseReplay({ size: 101 * 1024 * 1024 } as Blob)).rejects.toThrow(/100 MiB/)
    expect((await listMatches(db)).records).toHaveLength(1)
    recorder.dispose()
    engine.session.stop()
    db.close()
  })

  it("preserves historical transcripts and migration5 data but does not interpret another protocol", () => {
    const header = match()
    expect(upgradeRecord("matches", header, 4, 5, MIGRATIONS)).toEqual(header)
    const stored = {
      match: header,
      log: [{ matchId: header.id, seq: 0, at: 0, from: "engine" as const, message: { type: "old.state" } }],
    }
    expect(() => exportReplay(stored)).not.toThrow()
    expect(() => replayFrames(stored)).toThrow(/anderes Engine-Protokoll/)
  })

  it("retains latest100 by default, custom limit, running data and atomic transcript deletion", async () => {
    const db = await openTestDatabase()
    const headers = Array.from({ length: 103 }, (_, i) =>
      match({ startedAt: new Date(1_790_000_000_000 + i).toISOString() }),
    )
    for (const header of headers)
      await writeMatchBatch(
        db,
        header,
        [{ matchId: header.id, seq: 0, at: 0, from: "engine", message: { type: "legacy" } }],
        true,
      )
    const running = match({ status: "running", end: null, endedAt: null })
    await writeMatchBatch(db, running, [], true)
    await pruneMatches(db)
    expect((await listMatches(db)).records).toHaveLength(101)
    expect(await readMatch(db, headers[0]!.id)).toBeNull()
    await writeSetting(db, MATCH_RETENTION, 2)
    await pruneMatches(db)
    expect((await listMatches(db)).records).toHaveLength(3)
    expect(await db.read(["matchLog"], (tx) => tx.objectStore("matchLog").count())).toBe(2)
    await clearMatches(db)
    expect((await listMatches(db)).records).toHaveLength(0)
    expect(await db.read(["matchLog"], (tx) => tx.objectStore("matchLog").count())).toBe(0)
    db.close()
  })
})
