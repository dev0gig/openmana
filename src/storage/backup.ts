/*
 * Backups: all of the player's own data in one file, and back again.
 *
 * Browsers may delete a site's data (clearing site data, storage pressure),
 * and OpenMana has no account or cloud (Bible §5, §15), so a backup file is
 * the only copy outside this browser.
 *
 * Format "openmana-backup", format version 1 (BACKUP_FORMAT_VERSION):
 * UTF-8 JSON Lines, gzip-compressed (the reader also takes it uncompressed).
 *
 *   {"type":"header","format":"openmana-backup","formatVersion":1,"schemaVersion":1,"createdAt":…,"app":{…},"stores":["decks",…]}
 *   {"type":"record","store":"decks","record":{…}}        one line per record, stores in header order
 *   {"type":"end","counts":{"decks":3,…},"records":3}     a file without this line is incomplete
 *
 * The lines are defined in schema/local-data.schema.json (BackupHeader,
 * BackupRecordLine, BackupEnd); records are the stores' records of the
 * header's schema version. JSON Lines keep a backup streamable: it is written
 * record by record and read line by line, never as one huge string.
 *
 * - Only the user's own stores travel (BACKUP_STORES); caches and the
 *   database's metadata do not.
 * - Export copies every record exactly as stored, a damaged one too: the
 *   backup loses nothing, and reading it reports the damage.
 * - Reading checks the whole file before anything is written: container,
 *   completeness (end line and counts), every record against its schema
 *   (after upgrading records of an older schema version with the database's
 *   own migrations). A file of a newer OpenMana is refused.
 * - Importing is one transaction: all or nothing. "merge" adds what is new
 *   and lets the newer copy of a deck or setting win (updatedAt); a recorded
 *   match is never overwritten. "replace" empties the stores of the backup
 *   first. Decisions are taken inside the writing transaction, so a change
 *   in another tab cannot slip in between.
 */
import { StorageError, type RecordProblem } from "./errors"
import { BACKUP_FORMAT_VERSION, BACKUP_STORES, SCHEMA_VERSION } from "./generated/constants"
import type { AppVersion, BackupEnd, BackupHeader, BackupMeta, BackupStore, ImportMode } from "./generated/records"
import { validateBackupEnd, validateBackupHeader, validateBackupRecordLine } from "./generated/validators.js"
import { MIGRATIONS, upgradeRecord, type Migration } from "./migrations"
import { ensureSpace, type StorageEstimator } from "./quota"
import { formatKey, formatProblems, problemsOf, RECORD_CHECKS, type StoreRecord } from "./schema"
import { PendingRequests, type LocalDatabase, type ReadTransaction } from "./database"

export const BACKUP_FORMAT = "openmana-backup"
export const BACKUP_MEDIA_TYPE = "application/gzip"

/** Room a write needs next to the records' own size (indexes, the browser's bookkeeping). */
const WRITE_OVERHEAD = 2

type Counts = Record<BackupStore, number>

function zeroCounts(): Counts {
  return { decks: 0, settings: 0, matches: 0, matchLog: 0 }
}

// ── Writing ────────────────────────────────────────────────────────────────

export interface BackupFile {
  readonly blob: Blob
  readonly fileName: string
  readonly createdAt: string
  readonly counts: Readonly<Counts>
  readonly records: number
  /** Size of the file (compressed). */
  readonly bytes: number
}

const pad = (n: number) => String(n).padStart(2, "0")

/** openmana-sicherung-2026-09-25-2140.jsonl.gz (local time: the name is for the player). */
export function backupFileName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `openmana-sicherung-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.jsonl.gz`
}

/**
 * Valid records are plain JSON; a damaged one may hold a BigInt (IndexedDB can
 * store it, JSON cannot). It is written as text rather than failing the whole
 * backup; reading the backup then reports that record as damaged.
 */
function keepBigInts(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value
}

function linesStream(lines: Iterable<string>): ReadableStream<BufferSource> {
  const encoder = new TextEncoder()
  const iterator = lines[Symbol.iterator]()
  return new ReadableStream<BufferSource>({
    pull(controller) {
      const next = iterator.next()
      if (next.done) controller.close()
      else controller.enqueue(encoder.encode(`${next.value}\n`))
    },
  })
}

/**
 * A backup of every user store, read in one transaction (a consistent
 * snapshot). Does not touch the database; recordExport() notes it afterwards.
 */
export async function createBackup(db: LocalDatabase, options: { readonly app: AppVersion; readonly now?: () => Date }): Promise<BackupFile> {
  const date = (options.now ?? (() => new Date()))()
  const createdAt = date.toISOString()
  const stored = await db.read(BACKUP_STORES, async (transaction) => {
    const entries = await Promise.all(BACKUP_STORES.map(async (store) => [store, await transaction.objectStore(store).getAll()] as const))
    return new Map<BackupStore, readonly unknown[]>(entries)
  })
  const counts = zeroCounts()
  for (const store of BACKUP_STORES) counts[store] = stored.get(store)?.length ?? 0
  const records = BACKUP_STORES.reduce((sum, store) => sum + counts[store], 0)
  const header: BackupHeader = {
    type: "header",
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: db.version,
    createdAt,
    app: options.app,
    stores: [...BACKUP_STORES],
  }
  const end: BackupEnd = { type: "end", counts, records }
  function* lines(): Generator<string> {
    yield JSON.stringify(header)
    for (const store of BACKUP_STORES) {
      for (const record of stored.get(store) ?? []) yield JSON.stringify({ type: "record", store, record }, keepBigInts)
    }
    yield JSON.stringify(end)
  }
  const compressed = linesStream(lines()).pipeThrough(new CompressionStream("gzip"))
  const blob = new Blob([await new Response(compressed).arrayBuffer()], { type: BACKUP_MEDIA_TYPE })
  return { blob, fileName: backupFileName(date), createdAt, counts, records, bytes: blob.size }
}

function readBackupMeta(value: unknown): BackupMeta {
  if (RECORD_CHECKS.meta(value) === null && (value as { key: string }).key === "backup") return value as BackupMeta
  return { key: "backup", lastExport: null, lastImport: null }
}

/** Notes a created backup in meta/backup (for "last backup" in the settings). */
export async function recordExport(db: LocalDatabase, file: BackupFile): Promise<void> {
  await db.write(["meta"], async (transaction) => {
    const meta = transaction.objectStore("meta")
    const current = readBackupMeta(await meta.get("backup"))
    await meta.put({ ...current, lastExport: { at: file.createdAt, records: file.records, bytes: file.bytes } })
  })
}

// ── Reading ────────────────────────────────────────────────────────────────

/** A record of the file that is not taken over, and why. */
export interface BackupProblem {
  readonly store: BackupStore
  /** Line in the (uncompressed) file, from 1. */
  readonly line: number
  readonly key: string | null
  readonly problems: readonly RecordProblem[]
}

export interface BackupRecords {
  readonly decks: readonly StoreRecord<"decks">[]
  readonly settings: readonly StoreRecord<"settings">[]
  readonly matches: readonly StoreRecord<"matches">[]
  readonly matchLog: readonly StoreRecord<"matchLog">[]
}

export interface BackupContents {
  readonly header: BackupHeader
  /** Valid records, upgraded to the current schema version, per store. */
  readonly records: BackupRecords
  /** Serialized size of each valid record (same order as records), for the space check. */
  readonly sizes: Readonly<Record<BackupStore, readonly number[]>>
  /** Records of the file that are skipped (damaged, duplicate, without their match). */
  readonly skipped: readonly BackupProblem[]
  /** Records per store as the file declares them. */
  readonly counts: Readonly<Counts>
}

export interface ReadBackupOptions {
  /** Default: this app's schema version and migrations (tests pass made-up ones). */
  readonly schemaVersion?: number
  readonly migrations?: readonly Migration[]
}

function invalid(message: string, detail?: string): StorageError {
  return new StorageError("backup-invalid", message, detail === undefined ? {} : { detail })
}

function byteStream(file: Blob, contents: ArrayBuffer | null): ReadableStream<BufferSource> {
  if (contents !== null) return new Response(contents).body as ReadableStream<BufferSource>
  return file.stream()
}

/** The file's lines, decompressed if it is gzip, decoded strictly as UTF-8. */
async function* fileLines(file: Blob): AsyncGenerator<string> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  const gzip = head[0] === 0x1f && head[1] === 0x8b
  // Blob.stream() is missing in some implementations; reading it whole works everywhere.
  const whole = typeof file.stream === "function" ? null : await file.arrayBuffer()
  let bytes = byteStream(file, whole)
  if (gzip) bytes = bytes.pipeThrough(new DecompressionStream("gzip"))
  const reader = bytes.pipeThrough(new TextDecoderStream("utf-8", { fatal: true })).getReader()
  let rest = ""
  let finished = false
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<string>
      try {
        chunk = await reader.read()
      } catch (error) {
        throw invalid(
          gzip ? "the file is damaged or incomplete (it cannot be decompressed or decoded)" : "the file is not UTF-8 text",
          error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        )
      }
      if (chunk.done) break
      const parts = (rest + chunk.value).split("\n")
      rest = parts.pop() ?? ""
      for (const part of parts) yield part.endsWith("\r") ? part.slice(0, -1) : part
    }
    finished = true
  } finally {
    // Stopped early (a refused line) or failed: let go of the rest of the file.
    if (!finished) reader.cancel().catch(() => undefined)
  }
  if (rest !== "") yield rest.endsWith("\r") ? rest.slice(0, -1) : rest
}

function parseLine(text: string, line: number): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw invalid(`line ${line} is not valid JSON`, error instanceof Error ? error.message : String(error))
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw invalid(`line ${line} is not a JSON object`)
  return value as Record<string, unknown>
}

const KEY_FIELDS: Readonly<Record<BackupStore, (record: Record<string, unknown>) => IDBValidKey | null>> = {
  decks: (r) => (typeof r["id"] === "string" ? r["id"] : null),
  settings: (r) => (typeof r["key"] === "string" ? r["key"] : null),
  matches: (r) => (typeof r["id"] === "string" ? r["id"] : null),
  matchLog: (r) => (typeof r["matchId"] === "string" && typeof r["seq"] === "number" ? [r["matchId"], r["seq"]] : null),
}

function keyOf(store: BackupStore, record: unknown): string | null {
  if (record === null || typeof record !== "object") return null
  const key = KEY_FIELDS[store](record as Record<string, unknown>)
  return key === null ? null : formatKey(key)
}

/**
 * Reads and checks a backup file completely. Throws backup-invalid (not a
 * backup, damaged, incomplete) or backup-unsupported (newer version);
 * otherwise returns the valid records and the ones that are skipped.
 */
export async function readBackup(file: Blob, options: ReadBackupOptions = {}): Promise<BackupContents> {
  const currentVersion = options.schemaVersion ?? SCHEMA_VERSION
  const migrations = options.migrations ?? MIGRATIONS
  let header: BackupHeader | null = null
  let end: BackupEnd | null = null
  let lineNumber = 0
  const found = zeroCounts()
  const valid: Record<BackupStore, { readonly record: unknown; readonly size: number; readonly line: number }[]> = {
    decks: [],
    settings: [],
    matches: [],
    matchLog: [],
  }
  const keys: Record<BackupStore, Set<string>> = { decks: new Set(), settings: new Set(), matches: new Set(), matchLog: new Set() }
  const skipped: BackupProblem[] = []

  for await (const text of fileLines(file)) {
    lineNumber++
    if (header === null) {
      header = readHeader(text, currentVersion)
      continue
    }
    if (end !== null) throw invalid(`line ${lineNumber} follows the end line`)
    const line = parseLine(text, lineNumber)
    if (line["type"] === "end") {
      if (!validateBackupEnd(line)) throw invalid(`the end line (${lineNumber}) is malformed`, formatProblems(problemsOf(validateBackupEnd)))
      end = line
      continue
    }
    if (!validateBackupRecordLine(line)) {
      throw invalid(`line ${lineNumber} is not a record line`, formatProblems(problemsOf(validateBackupRecordLine)))
    }
    const store = line.store
    if (!header.stores.includes(store)) throw invalid(`line ${lineNumber} holds a ${store} record, which the header does not announce`)
    found[store]++
    let record: unknown
    try {
      record = header.schemaVersion < currentVersion ? upgradeRecord(store, line.record, header.schemaVersion, currentVersion, migrations) : line.record
    } catch (error) {
      skipped.push({ store, line: lineNumber, key: keyOf(store, line.record), problems: [{ path: "/", message: `cannot be upgraded: ${String(error)}` }] })
      continue
    }
    const problems = RECORD_CHECKS[store](record)
    const key = keyOf(store, record)
    if (problems !== null) {
      skipped.push({ store, line: lineNumber, key, problems })
    } else if (key !== null && keys[store].has(key)) {
      skipped.push({ store, line: lineNumber, key, problems: [{ path: "/", message: "appears twice in the backup; the first one counts" }] })
    } else {
      if (key !== null) keys[store].add(key)
      valid[store].push({ record, size: text.length, line: lineNumber })
    }
  }

  if (header === null) throw invalid("the file is empty")
  if (end === null) throw invalid("the file is incomplete: its end line is missing")
  for (const store of BACKUP_STORES) {
    const declared = end.counts[store] ?? 0
    if (declared !== found[store]) throw invalid(`the file is incomplete: ${store} has ${found[store]} records, its end line says ${declared}`)
  }
  const total = BACKUP_STORES.reduce((sum, store) => sum + found[store], 0)
  if (end.records !== total) throw invalid(`the file is incomplete: ${total} records, its end line says ${end.records}`)

  // A log entry belongs to a match of the same backup.
  const matchIds = new Set(valid.matches.map((entry) => (entry.record as StoreRecord<"matches">).id))
  const log = valid.matchLog.filter((entry) => {
    const logEntry = entry.record as StoreRecord<"matchLog">
    if (matchIds.has(logEntry.matchId)) return true
    skipped.push({
      store: "matchLog",
      line: entry.line,
      key: formatKey([logEntry.matchId, logEntry.seq]),
      problems: [{ path: "/matchId", message: "belongs to no match in this backup" }],
    })
    return false
  })
  const kept = { ...valid, matchLog: log }
  const recordsOf = <S extends BackupStore>(store: S) => kept[store].map((entry) => entry.record as StoreRecord<S>)
  const sizesOf = (store: BackupStore) => kept[store].map((entry) => entry.size)

  return {
    header,
    records: { decks: recordsOf("decks"), settings: recordsOf("settings"), matches: recordsOf("matches"), matchLog: recordsOf("matchLog") },
    sizes: { decks: sizesOf("decks"), settings: sizesOf("settings"), matches: sizesOf("matches"), matchLog: sizesOf("matchLog") },
    skipped: skipped.sort((a, b) => a.line - b.line),
    counts: found,
  }
}

function readHeader(text: string, currentVersion: number): BackupHeader {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw invalid("this is not an OpenMana backup (the first line is not JSON)")
  }
  const candidate = value as Partial<BackupHeader> | null
  if (candidate === null || typeof candidate !== "object" || candidate.type !== "header" || candidate.format !== BACKUP_FORMAT) {
    throw invalid("this is not an OpenMana backup (no backup header)")
  }
  if (typeof candidate.formatVersion === "number" && candidate.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new StorageError("backup-unsupported", `backup format ${candidate.formatVersion} is newer than this app understands (${BACKUP_FORMAT_VERSION})`)
  }
  if (!validateBackupHeader(value)) throw invalid("the backup header is malformed", formatProblems(problemsOf(validateBackupHeader)))
  if (value.formatVersion !== BACKUP_FORMAT_VERSION) throw invalid(`unknown backup format version ${value.formatVersion}`)
  if (value.schemaVersion > currentVersion) {
    throw new StorageError("backup-unsupported", `the backup has data version ${value.schemaVersion}; this app knows up to ${currentVersion}`)
  }
  if (new Set(value.stores).size !== value.stores.length) throw invalid("the backup header names a store twice")
  return value
}

// ── Importing ──────────────────────────────────────────────────────────────

/** What an import does to one store. */
export interface StoreImport {
  /** Valid records of this store in the backup. */
  readonly inBackup: number
  /** New here. */
  readonly added: number
  /** Replace an older (or damaged) copy here. */
  readonly updated: number
  /** Identical age here: nothing to do. */
  readonly unchanged: number
  /** The copy here is newer (or a recorded match): kept. */
  readonly keptLocal: number
  /** Deleted because the store is replaced. */
  readonly removed: number
}

export interface ImportSummary {
  readonly mode: ImportMode
  readonly stores: Readonly<Record<BackupStore, StoreImport>>
  /** Records written. */
  readonly writes: number
  /** Serialized size of the records written (the space check doubles it). */
  readonly bytes: number
}

interface LocalEntry {
  readonly valid: boolean
  readonly updatedAt: string | null
}

interface LocalState {
  readonly counts: Readonly<Counts>
  readonly entries: Readonly<Record<"decks" | "settings" | "matches", ReadonlyMap<string, LocalEntry>>>
}

interface Decision {
  readonly summary: ImportSummary
  readonly clear: readonly BackupStore[]
  readonly put: { readonly [S in BackupStore]: readonly StoreRecord<S>[] }
  /** Matches whose local log is replaced along with their header. */
  readonly replaceLogOf: readonly string[]
}

type ImportStores = BackupStore | "meta"

/** Reads only; a writing transaction is passed as the reading one it also is. */
async function readLocalState(transaction: ReadTransaction<BackupStore>): Promise<LocalState> {
  const counts = zeroCounts()
  const entries = { decks: new Map<string, LocalEntry>(), settings: new Map<string, LocalEntry>(), matches: new Map<string, LocalEntry>() }
  for (const store of ["decks", "settings", "matches"] as const) {
    const source = transaction.objectStore(store)
    const [keys, values] = await Promise.all([source.getAllKeys(), source.getAll()])
    counts[store] = keys.length
    keys.forEach((key, i) => {
      const value = values[i]
      const valid = RECORD_CHECKS[store](value) === null
      const updatedAt = valid && store !== "matches" ? (value as { updatedAt: string }).updatedAt : null
      entries[store].set(formatKey(key), { valid, updatedAt })
    })
  }
  counts.matchLog = await transaction.objectStore("matchLog").count()
  return { counts, entries }
}

function decide(local: LocalState, contents: BackupContents, mode: ImportMode): Decision {
  const stores = {} as Record<BackupStore, StoreImport>
  const put = { decks: [] as StoreRecord<"decks">[], settings: [] as StoreRecord<"settings">[], matches: [] as StoreRecord<"matches">[], matchLog: [] as StoreRecord<"matchLog">[] }
  let bytes = 0
  const replaceLogOf: string[] = []
  const inHeader = new Set<BackupStore>(contents.header.stores)

  if (mode === "replace") {
    for (const store of BACKUP_STORES) {
      const records = contents.records[store]
      const removed = inHeader.has(store) ? local.counts[store] : 0
      stores[store] = { inBackup: records.length, added: records.length, updated: 0, unchanged: 0, keptLocal: 0, removed }
      ;(put[store] as unknown[]).push(...records)
      bytes += contents.sizes[store].reduce((sum, size) => sum + size, 0)
    }
    return { summary: summarize(mode, stores, put, bytes), clear: contents.header.stores, put, replaceLogOf }
  }

  // merge: the newer copy of a deck or setting wins.
  for (const store of ["decks", "settings"] as const) {
    let added = 0
    let updated = 0
    let unchanged = 0
    let keptLocal = 0
    contents.records[store].forEach((record, i) => {
      const key = store === "decks" ? (record as StoreRecord<"decks">).id : (record as StoreRecord<"settings">).key
      const here = local.entries[store].get(key)
      const take = () => {
        ;(put[store] as unknown[]).push(record)
        bytes += contents.sizes[store][i] ?? 0
      }
      if (here === undefined) {
        added++
        take()
      } else if (!here.valid || here.updatedAt === null || record.updatedAt > here.updatedAt) {
        updated++
        take()
      } else if (record.updatedAt === here.updatedAt) {
        unchanged++
      } else {
        keptLocal++
      }
    })
    stores[store] = { inBackup: contents.records[store].length, added, updated, unchanged, keptLocal, removed: 0 }
  }

  // A recorded match is never overwritten; a damaged local one is replaced together with its log.
  const takeMatch = new Set<string>()
  let added = 0
  let updated = 0
  let keptLocal = 0
  contents.records.matches.forEach((match, i) => {
    const here = local.entries.matches.get(match.id)
    if (here !== undefined && here.valid) {
      keptLocal++
      return
    }
    if (here === undefined) added++
    else {
      updated++
      replaceLogOf.push(match.id)
    }
    takeMatch.add(match.id)
    put.matches.push(match)
    bytes += contents.sizes.matches[i] ?? 0
  })
  stores.matches = { inBackup: contents.records.matches.length, added, updated, unchanged: 0, keptLocal, removed: 0 }
  let logAdded = 0
  let logKept = 0
  contents.records.matchLog.forEach((entry, i) => {
    if (takeMatch.has(entry.matchId)) {
      logAdded++
      put.matchLog.push(entry)
      bytes += contents.sizes.matchLog[i] ?? 0
    } else {
      logKept++
    }
  })
  stores.matchLog = { inBackup: contents.records.matchLog.length, added: logAdded, updated: 0, unchanged: 0, keptLocal: logKept, removed: 0 }
  return { summary: summarize(mode, stores, put, bytes), clear: [], put, replaceLogOf }
}

function summarize(mode: ImportMode, stores: Record<BackupStore, StoreImport>, put: Decision["put"], bytes: number): ImportSummary {
  const writes = BACKUP_STORES.reduce((sum, store) => sum + put[store].length, 0)
  return { mode, stores, writes, bytes }
}

/** The free space an import needs: its records plus the database's own overhead. */
export function importSpaceNeeded(summary: ImportSummary): number {
  return summary.bytes * WRITE_OVERHEAD
}

/** What importing would do right now (read only; the import decides again when it writes). */
export async function planImport(db: LocalDatabase, contents: BackupContents, mode: ImportMode): Promise<ImportSummary> {
  const local = await db.read(BACKUP_STORES, (transaction) => readLocalState(transaction))
  return decide(local, contents, mode).summary
}

export interface ImportOptions {
  readonly now?: () => Date
  /** Default: navigator.storage. */
  readonly storage?: Partial<StorageEstimator>
}

/**
 * Imports a checked backup in one transaction. Checks the space first
 * (insufficient-space, nothing written); any failure while writing leaves
 * the database exactly as it was.
 */
export async function importBackup(db: LocalDatabase, contents: BackupContents, mode: ImportMode, options: ImportOptions = {}): Promise<ImportSummary> {
  const planned = await planImport(db, contents, mode)
  await ensureSpace(importSpaceNeeded(planned), options.storage)
  const at = (options.now ?? (() => new Date()))().toISOString()
  const stores: ImportStores[] = [...BACKUP_STORES, "meta"]
  return db.write(stores, async (transaction) => {
    const decision = decide(await readLocalState(transaction as unknown as ReadTransaction<BackupStore>), contents, mode)
    const meta = transaction.objectStore("meta")
    const current = readBackupMeta(await meta.get("backup"))
    const requests = new PendingRequests()
    for (const store of decision.clear) requests.add(transaction.objectStore(store).clear())
    for (const matchId of decision.replaceLogOf) {
      requests.add(transaction.objectStore("matchLog").delete(IDBKeyRange.bound([matchId, 0], [matchId, Infinity])))
    }
    for (const store of BACKUP_STORES) {
      const target = transaction.objectStore(store)
      for (const record of decision.put[store]) requests.add(target.put(record as never))
    }
    requests.add(
      meta.put({
        ...current,
        lastImport: { at, mode, records: decision.summary.writes, backupCreatedAt: contents.header.createdAt, backupApp: contents.header.app },
      }),
    )
    await requests.all()
    return decision.summary
  })
}
