// @vitest-environment node
/*
 * Backups: the file format, what reading checks (and refuses), merge and
 * replace, all-or-nothing imports, the space check, older backups.
 */
import { IDBObjectStore } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import {
  APP,
  backupEnd,
  backupFile,
  backupHeader,
  card,
  deck,
  logEntry,
  match,
  openTestDatabase,
  putRaw,
  readRaw,
  rejectionOf,
  setting,
} from "@/test/storage-fixtures"
import { backupFileName, createBackup, importBackup, importSpaceNeeded, planImport, readBackup, recordExport, type BackupContents } from "./backup"
import type { LocalDatabase } from "./database"
import { saveDeck } from "./decks"
import { StorageError } from "./errors"
import type { DeckRecord } from "./generated/records"
import { createStores, type Migration } from "./migrations"
import { readOverview } from "./overview"

const PLENTY = { estimate: async () => ({ usage: 1_000, quota: 10_000_000_000 }), persisted: async () => false }

async function filled(db: LocalDatabase) {
  const decks = [deck({ name: "Rot" }), deck({ name: "Blau", format: "commander", commander: [{ count: 1, name: "Talrand, Sky Summoner" }] })]
  const played = match()
  const log = [logEntry(played.id, 0), logEntry(played.id, 1), logEntry(played.id, 2)]
  const settings = [setting("ai.profile", "Reckless")]
  await db.write(["decks", "matches", "matchLog", "settings", "scryfallCards", "meta"], async (transaction) => {
    for (const d of decks) await transaction.objectStore("decks").put(d)
    await transaction.objectStore("matches").put(played)
    for (const entry of log) await transaction.objectStore("matchLog").put(entry)
    for (const s of settings) await transaction.objectStore("settings").put(s)
    await transaction.objectStore("scryfallCards").put(card())
  })
  return { decks, played, log, settings }
}

async function lines(blob: Blob): Promise<Record<string, unknown>[]> {
  const text = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text()
  expect(text.endsWith("\n")).toBe(true)
  return text
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

async function refused(file: Promise<File> | File, code: StorageError["code"] = "backup-invalid"): Promise<StorageError> {
  const error = await readBackup(await file).then(
    () => null,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(StorageError)
  expect((error as StorageError).code).toBe(code)
  return error as StorageError
}

describe("creating a backup", () => {
  it("writes gzip-compressed JSON Lines: header, every user record, end", async () => {
    const db = await openTestDatabase()
    const { decks, played, log, settings } = await filled(db)
    const file = await createBackup(db, { app: APP, now: () => new Date(2026, 8, 25, 21, 40) })
    expect(file.fileName).toBe("openmana-sicherung-2026-09-25-2140.jsonl.gz")
    expect(file.blob.type).toBe("application/gzip")
    const head = new Uint8Array(await file.blob.slice(0, 2).arrayBuffer())
    expect([head[0], head[1]]).toEqual([0x1f, 0x8b])
    expect(file.bytes).toBe(file.blob.size)
    expect(file.counts).toEqual({ decks: 2, settings: 1, matches: 1, matchLog: 3 })

    const content = await lines(file.blob)
    expect(content[0]).toEqual({
      type: "header",
      format: "openmana-backup",
      formatVersion: 1,
      schemaVersion: 1,
      createdAt: file.createdAt,
      app: APP,
      stores: ["decks", "settings", "matches", "matchLog"],
    })
    expect(content.at(-1)).toEqual({ type: "end", counts: file.counts, records: 7 })
    const records = content.slice(1, -1)
    expect(records.map((line) => line["store"])).toEqual(["decks", "decks", "settings", "matches", "matchLog", "matchLog", "matchLog"])
    const byStore = (store: string) => records.filter((line) => line["store"] === store).map((line) => line["record"])
    expect(byStore("decks")).toEqual(expect.arrayContaining(decks))
    expect(byStore("settings")).toEqual(settings)
    expect(byStore("matches")).toEqual([played])
    expect(byStore("matchLog")).toEqual(log)
    // Caches and the database's metadata stay here.
    expect(JSON.stringify(records)).not.toContain("Blitzschlag")
    expect(records.some((line) => line["store"] === "meta")).toBe(false)
    db.close()
  })

  it("never fails on a damaged record that JSON cannot hold", async () => {
    const db = await openTestDatabase()
    await putRaw("decks", { id: "odd", name: "Groß", count: 10n })
    const file = await createBackup(db, { app: APP })
    const contents = await readBackup(file.blob)
    expect(contents.skipped).toMatchObject([{ store: "decks", key: "odd" }])
    db.close()
  })

  it("copies a damaged record unchanged; reading the backup reports it", async () => {
    const db = await openTestDatabase()
    await saveDeck(db, deck())
    await putRaw("decks", { id: "damaged", name: "" })
    const file = await createBackup(db, { app: APP })
    expect(file.counts.decks).toBe(2)
    const contents = await readBackup(file.blob)
    expect(contents.records.decks).toHaveLength(1)
    expect(contents.skipped).toMatchObject([{ store: "decks", key: "damaged", line: expect.any(Number) }])
    db.close()
  })

  it("notes the export for 'last backup'", async () => {
    const db = await openTestDatabase()
    const file = await createBackup(db, { app: APP, now: () => new Date("2026-09-25T10:00:00.000Z") })
    await recordExport(db, file)
    const overview = await readOverview(db)
    expect(overview.backup?.lastExport).toEqual({ at: "2026-09-25T10:00:00.000Z", records: 0, bytes: file.bytes })
    db.close()
  })

  it("names files by local time", () => {
    expect(backupFileName(new Date(2026, 0, 2, 3, 4))).toBe("openmana-sicherung-2026-01-02-0304.jsonl.gz")
  })
})

describe("reading a backup", () => {
  it("round trip: what was exported is read back exactly", async () => {
    const db = await openTestDatabase()
    const { decks, played, log, settings } = await filled(db)
    const contents = await readBackup((await createBackup(db, { app: APP })).blob)
    expect(contents.records.decks).toEqual(expect.arrayContaining(decks))
    expect(contents.records.settings).toEqual(settings)
    expect(contents.records.matches).toEqual([played])
    expect(contents.records.matchLog).toEqual(log)
    expect(contents.skipped).toEqual([])
    db.close()
  })

  it("refuses text that is not UTF-8", async () => {
    const error = await refused(new File([new Uint8Array([0xff, 0xfe, 0x7b, 0x7d, 0x0a])], "binaer.jsonl"))
    expect(error.message).toBe("the file is not UTF-8 text")
  })

  it("takes uncompressed JSON Lines too (also with CRLF and a byte order mark)", async () => {
    const record = deck()
    const file = new File(
      ["\uFEFF" + [backupHeader(), { type: "record", store: "decks", record }, backupEnd({ decks: 1 })].map((line) => JSON.stringify(line)).join("\r\n")],
      "sicherung.jsonl",
    )
    expect((await readBackup(file)).records.decks).toEqual([record])
  })

  it("refuses what is not an OpenMana backup", async () => {
    await refused(new File([""], "leer.jsonl"))
    await refused(new File(["Deck\n4 Mountain\n"], "arena.txt"))
    await refused(backupFile([{ type: "header", format: "other-app" }]))
    await refused(backupFile([backupHeader({ stores: ["decks", "decks"] }), backupEnd({})]))
    const malformed = await refused(backupFile([backupHeader({ createdAt: "gestern" }), backupEnd({})]))
    expect(malformed.detail).toContain("/createdAt")
  })

  it("refuses incomplete files", async () => {
    const record = deck()
    const withoutEnd = await refused(backupFile([backupHeader(), { type: "record", store: "decks", record }], { gzip: true }))
    expect(withoutEnd.message).toContain("end line is missing")
    const wrongCount = await refused(backupFile([backupHeader(), { type: "record", store: "decks", record }, backupEnd({ decks: 2 })]))
    expect(wrongCount.message).toContain("decks has 1 records, its end line says 2")
    await refused(backupFile([backupHeader(), backupEnd({}), { type: "record", store: "decks", record }]))
    // A gzip file cut off in the middle.
    const whole = await backupFile([backupHeader(), { type: "record", store: "decks", record }, backupEnd({ decks: 1 })], { gzip: true })
    const cut = new File([(await whole.arrayBuffer()).slice(0, whole.size - 12)], whole.name)
    const truncated = await refused(cut)
    expect(truncated.message).toBe("the file is damaged or incomplete (it cannot be decompressed or decoded)")
  })

  it("names the line of a broken line", async () => {
    const error = await refused(backupFile([backupHeader(), '{"type":"record",', backupEnd({})]))
    expect(error.message).toBe("line 2 is not valid JSON")
    const store = await refused(backupFile([backupHeader({ stores: ["decks"] }), { type: "record", store: "matches", record: match() }, backupEnd({ matches: 1 })]))
    expect(store.message).toContain("line 2 holds a matches record, which the header does not announce")
    const kind = await refused(backupFile([backupHeader(), { type: "comment", text: "hallo" }, backupEnd({})]))
    expect(kind.message).toContain("line 2 is not a record line")
  })

  it("refuses backups of a newer OpenMana", async () => {
    await refused(backupFile([backupHeader({ formatVersion: 2 }), backupEnd({})]), "backup-unsupported")
    await refused(backupFile([backupHeader({ schemaVersion: 2 }), backupEnd({})]), "backup-unsupported")
  })

  it("skips damaged, duplicate and orphaned records and says why", async () => {
    const good = deck({ name: "Gut" })
    const played = match()
    const file = await backupFile([
      backupHeader(),
      { type: "record", store: "decks", record: good },
      { type: "record", store: "decks", record: { ...deck(), name: "" } },
      { type: "record", store: "decks", record: { ...good, name: "Doppelt" } },
      { type: "record", store: "matches", record: played },
      { type: "record", store: "matchLog", record: logEntry(played.id, 0) },
      { type: "record", store: "matchLog", record: logEntry("00000000-0000-4000-8000-00000000ffff", 0) },
      backupEnd({ decks: 3, matches: 1, matchLog: 2 }),
    ])
    const contents = await readBackup(file)
    expect(contents.records.decks).toEqual([good])
    expect(contents.records.matchLog).toHaveLength(1)
    expect(contents.skipped.map((problem) => [problem.store, problem.line, problem.problems[0]?.path, problem.problems[0]?.message])).toEqual([
      ["decks", 3, "/name", expect.stringContaining("must match pattern")],
      ["decks", 4, "/", "appears twice in the backup; the first one counts"],
      ["matchLog", 7, "/matchId", "belongs to no match in this backup"],
    ])
    expect(contents.counts).toEqual({ decks: 3, settings: 0, matches: 1, matchLog: 2 })
  })

  it("upgrades the records of an older schema version with the database's migrations", async () => {
    const V1: Migration = { version: 1, summary: "decks", structure: (db) => createStores(db, { decks: { keyPath: "id", indexes: {} } }) }
    // A made-up version 2 that renamed "title" to "name".
    const V2: Migration = {
      version: 2,
      summary: "title → name",
      records: {
        decks: (record) => {
          const { title, ...rest } = record as { title: string }
          return { ...rest, name: title }
        },
      },
    }
    const { name, ...old } = deck()
    const file = await backupFile([backupHeader({ schemaVersion: 1 }), { type: "record", store: "decks", record: { ...old, title: name } }, backupEnd({ decks: 1 })])
    const contents = await readBackup(file, { schemaVersion: 2, migrations: [V1, V2] })
    expect(contents.records.decks).toEqual([{ ...old, name }])
    expect(contents.skipped).toEqual([])
  })
})

async function contentsOf(records: { decks?: DeckRecord[]; settings?: ReturnType<typeof setting>[]; matches?: ReturnType<typeof match>[]; log?: ReturnType<typeof logEntry>[] }, stores?: string[]): Promise<BackupContents> {
  const body = [
    ...(records.decks ?? []).map((record) => ({ type: "record", store: "decks", record })),
    ...(records.settings ?? []).map((record) => ({ type: "record", store: "settings", record })),
    ...(records.matches ?? []).map((record) => ({ type: "record", store: "matches", record })),
    ...(records.log ?? []).map((record) => ({ type: "record", store: "matchLog", record })),
  ]
  const counts = { decks: records.decks?.length ?? 0, settings: records.settings?.length ?? 0, matches: records.matches?.length ?? 0, matchLog: records.log?.length ?? 0 }
  return readBackup(await backupFile([backupHeader(stores ? { stores } : {}), ...body, backupEnd(counts)]))
}

describe("importing", () => {
  it("merge: new records come in, the newer copy wins, recorded matches stay", async () => {
    const db = await openTestDatabase()
    const newerHere = deck({ name: "Hier neuer", updatedAt: "2026-09-24T10:00:00.000Z" })
    const olderHere = deck({ name: "Hier älter", updatedAt: "2026-09-01T10:00:00.000Z" })
    const same = deck({ name: "Gleich" })
    const played = match()
    await db.write(["decks", "matches", "matchLog"], async (transaction) => {
      for (const d of [newerHere, olderHere, same]) await transaction.objectStore("decks").put(d)
      await transaction.objectStore("matches").put(played)
      await transaction.objectStore("matchLog").put(logEntry(played.id, 0))
    })
    await putRaw("decks", { id: "00000000-0000-4000-8000-0000000000aa", name: "" })

    const fresh = deck({ name: "Neu" })
    const newMatch = match()
    const contents = await contentsOf({
      decks: [
        { ...newerHere, name: "Aus der Sicherung (älter)", updatedAt: "2026-09-10T10:00:00.000Z" },
        { ...olderHere, name: "Aus der Sicherung (neuer)", updatedAt: "2026-09-20T10:00:00.000Z" },
        same,
        fresh,
        deck({ id: "00000000-0000-4000-8000-0000000000aa", name: "Repariert" }),
      ],
      matches: [{ ...played, seed: 999 }, newMatch],
      log: [logEntry(played.id, 0), logEntry(played.id, 1), logEntry(newMatch.id, 0), logEntry(newMatch.id, 1)],
    })
    const plan = await planImport(db, contents, "merge")
    expect(plan.stores.decks).toEqual({ inBackup: 5, added: 1, updated: 2, unchanged: 1, keptLocal: 1, removed: 0 })
    expect(plan.stores.matches).toEqual({ inBackup: 2, added: 1, updated: 0, unchanged: 0, keptLocal: 1, removed: 0 })
    expect(plan.stores.matchLog).toMatchObject({ added: 2, keptLocal: 2 })

    const summary = await importBackup(db, contents, "merge", { storage: PLENTY, now: () => new Date("2026-09-25T11:00:00.000Z") })
    expect(summary).toEqual(plan)
    const names = (await readRaw("decks")).map((d) => (d as DeckRecord).name).sort()
    expect(names).toEqual(["Aus der Sicherung (neuer)", "Gleich", "Hier neuer", "Neu", "Repariert"])
    expect((await readRaw("matches")).map((m) => (m as { seed: number }).seed).sort()).toEqual([42, 42])
    expect(await readRaw("matchLog")).toHaveLength(3)
    expect((await readOverview(db)).backup?.lastImport).toEqual({
      at: "2026-09-25T11:00:00.000Z",
      mode: "merge",
      records: summary.writes,
      backupCreatedAt: "2026-09-24T12:00:00.000Z",
      backupApp: APP,
    })
    db.close()
  })

  it("merge replaces a damaged recorded match together with its log", async () => {
    const db = await openTestDatabase()
    const played = match()
    await putRaw("matches", { ...played, status: "kaputt" })
    await putRaw("matchLog", logEntry(played.id, 0), logEntry(played.id, 5))
    const contents = await contentsOf({ matches: [played], log: [logEntry(played.id, 0), logEntry(played.id, 1)] })
    await importBackup(db, contents, "merge", { storage: PLENTY })
    expect(await readRaw("matches")).toEqual([played])
    expect((await readRaw("matchLog")).map((e) => (e as { seq: number }).seq)).toEqual([0, 1])
    db.close()
  })

  it("replace: the backup's stores are emptied first, caches stay", async () => {
    const db = await openTestDatabase()
    await filled(db)
    const only = deck({ name: "Einziges" })
    const contents = await contentsOf({ decks: [only] })
    const plan = await planImport(db, contents, "replace")
    expect(plan.stores.decks).toMatchObject({ added: 1, removed: 2 })
    expect(plan.stores.matches).toMatchObject({ added: 0, removed: 1 })
    await importBackup(db, contents, "replace", { storage: PLENTY })
    expect(await readRaw("decks")).toEqual([only])
    expect(await readRaw("matches")).toEqual([])
    expect(await readRaw("matchLog")).toEqual([])
    expect(await readRaw("settings")).toEqual([])
    expect(await readRaw("scryfallCards")).toHaveLength(1)
    db.close()
  })

  it("replace only empties the stores the backup holds", async () => {
    const db = await openTestDatabase()
    await filled(db)
    const contents = await contentsOf({ decks: [deck()] }, ["decks"])
    await importBackup(db, contents, "replace", { storage: PLENTY })
    expect(await readRaw("decks")).toHaveLength(1)
    expect(await readRaw("matches")).toHaveLength(1)
    expect(await readRaw("settings")).toHaveLength(1)
    db.close()
  })

  it("is all or nothing: a failure while writing leaves everything as it was", async () => {
    const db = await openTestDatabase()
    const { decks } = await filled(db)
    const contents = await contentsOf({ decks: [deck({ name: "A" }), deck({ name: "B" }), deck({ name: "C" })] })
    const originalPut = IDBObjectStore.prototype.put
    let calls = 0
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      calls++
      if (calls === 3) throw new DOMException("disk trouble", "UnknownError")
      return originalPut.call(this, value, key)
    })
    const error = await rejectionOf(importBackup(db, contents, "replace", { storage: PLENTY }))
    vi.restoreAllMocks()
    expect(error.code).toBe("transaction-failed")
    // The stores had been emptied inside the transaction: all rolled back.
    expect((await readRaw("decks")).length).toBe(decks.length)
    expect(await readRaw("matches")).toHaveLength(1)
    expect(await readRaw("matchLog")).toHaveLength(3)
    expect((await readOverview(db)).backup).toBeNull()
    db.close()
  })

  it("does not start when the browser reports too little space", async () => {
    const db = await openTestDatabase()
    const contents = await contentsOf({ decks: [deck(), deck()] })
    const plan = await planImport(db, contents, "merge")
    expect(importSpaceNeeded(plan)).toBeGreaterThan(plan.bytes)
    const tight = { estimate: async () => ({ usage: 1_000, quota: 1_000 + importSpaceNeeded(plan) - 1 }), persisted: async () => false }
    const error = await rejectionOf(importBackup(db, contents, "merge", { storage: tight }))
    expect(error.code).toBe("insufficient-space")
    expect(await readRaw("decks")).toEqual([])
    db.close()
  })

  it("a full export imported into an empty database is the same data", async () => {
    const source = await openTestDatabase()
    const { decks, played, log, settings } = await filled(source)
    const blob = (await createBackup(source, { app: APP })).blob
    source.close()
    // A different browser: a new, empty database.
    const { IDBFactory } = await import("fake-indexeddb")
    globalThis.indexedDB = new IDBFactory()
    const target = await openTestDatabase()
    await importBackup(target, await readBackup(blob), "merge", { storage: PLENTY })
    expect(await readRaw("decks")).toEqual(expect.arrayContaining(decks))
    expect(await readRaw("settings")).toEqual(settings)
    expect(await readRaw("matches")).toEqual([played])
    expect(await readRaw("matchLog")).toEqual(log)
    expect(await readRaw("scryfallCards")).toEqual([])
    target.close()
  })
})
