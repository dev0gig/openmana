/*
 * The card catalog on this device: is it there, in which version, and
 * installing it from the file the build ships (vite/card-assets.ts) into
 * IndexedDB (stores scryfallCards, scryfallSets, forgeOnlyCards).
 *
 * Installing, once per catalog version (~10 MB download, ~45 MB in the
 * database):
 *  1. check the free space the browser reports (nothing written if too little),
 *  2. mark the catalog "partial" and empty the catalog stores (one transaction),
 *  3. download the file and check it: SHA-256 as the build recorded it (of
 *     the gzip file, or of the JSON Lines if a host already unpacked it),
 *  4. unpack it as a stream and check every line against the local data
 *     schema (header first, end line with the right counts last),
 *  5. write the records in batches (durability "relaxed": it is a cache;
 *     an interrupted install stays "partial" and starts over next time),
 *  6. mark it "complete" with version and record count.
 *
 * One tab installs at a time (Web Locks); a second tab waits and then finds
 * the catalog installed. A catalog of an older version stays usable until a
 * new one is being installed.
 *
 * The app loads this module (and the catalog's validators) only when an
 * install starts; what is installed is read by catalog-state.ts.
 */
import type { LocalDatabase } from "@/storage/database"
import { PendingRequests } from "@/storage/database"
import { StorageError } from "@/storage/errors"
import { CATALOG_FORMAT_VERSION, SCHEMA_VERSION } from "@/storage/generated/constants"
import type { CacheEntryRecord, CatalogEnd, CatalogHeader, CatalogLine } from "@/storage/generated/records"
import { validateCatalogEnd, validateCatalogHeader, validateCatalogLine } from "@/storage/generated/catalog/validators.js"
import { ensureSpace, type StorageEstimator } from "@/storage/quota"
import { formatProblems, problemsOf } from "@/storage/schema"
import type { CardAssetsAvailable } from "./card-assets-types"
import { CATALOG_CACHE_KEY, CATALOG_CACHE_KIND, readInstalledCatalog } from "./catalog-state"
import { CardDataError } from "./errors"

export { CATALOG_CACHE_KEY, readInstalledCatalog, type InstalledCatalog } from "./catalog-state"

/** The stores the catalog fills (scryfallPrints holds fetched printings and stays). */
export const CATALOG_STORES = ["scryfallCards", "scryfallSets", "forgeOnlyCards"] as const
const LOCK_NAME = "openmana-card-catalog"
/** Records per transaction while installing. */
const BATCH_SIZE = 1000
/** Room the records need in IndexedDB next to their JSON size (indexes, the browser's bookkeeping). */
const SPACE_FACTOR = 1.5

export type InstallPhase = "download" | "store"

export interface InstallProgress {
  readonly phase: InstallPhase
  /** download: bytes received; store: records stored. */
  readonly done: number
  readonly total: number
}

export interface InstallOptions {
  readonly fetch?: typeof fetch
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: InstallProgress) => void
  readonly now?: () => Date
  readonly storage?: Partial<StorageEstimator>
  /** Default: navigator.locks where the browser has it. */
  readonly locks?: Pick<LockManager, "request"> | null
}

export interface InstallResult {
  readonly version: string
  readonly records: number
  /** false: another tab had installed it meanwhile. */
  readonly installed: boolean
}

function defaultLocks(): Pick<LockManager, "request"> | null {
  return typeof navigator !== "undefined" && navigator.locks ? navigator.locks : null
}

function checkAbort(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new CardDataError("aborted", "installing the card catalog was stopped")
}

function cacheEntry(assets: CardAssetsAvailable, status: CacheEntryRecord["status"], at: string, records: number | null): CacheEntryRecord {
  return { key: CATALOG_CACHE_KEY, kind: CATALOG_CACHE_KIND, status, source: assets.url, version: assets.id, storedAt: at, lastUsedAt: at, bytes: assets.bytes, records }
}

/**
 * Installs the build's catalog unless exactly it is already there. Throws
 * CardDataError (the stores stay "partial" after a failure past step 2).
 */
export async function installCatalog(db: LocalDatabase, assets: CardAssetsAvailable, options: InstallOptions = {}): Promise<InstallResult> {
  const locks = options.locks === undefined ? defaultLocks() : options.locks
  const run = () => installLocked(db, assets, options)
  if (locks === null) return run()
  return locks.request(LOCK_NAME, run) as Promise<InstallResult>
}

async function installLocked(db: LocalDatabase, assets: CardAssetsAvailable, options: InstallOptions): Promise<InstallResult> {
  const now = options.now ?? (() => new Date())
  const installed = await readInstalledCatalog(db)
  if (installed.status === "complete" && installed.version === assets.id) {
    return { version: assets.id, records: installed.records, installed: false }
  }
  checkAbort(options.signal)
  // Checking needs Web Crypto, unpacking DecompressionStream: both only in a secure context (https, localhost).
  if (typeof crypto === "undefined" || crypto.subtle === undefined || typeof DecompressionStream === "undefined" || typeof TextDecoderStream === "undefined") {
    throw new CardDataError("unsupported", "this page cannot check and unpack the card catalog", {
      detail: `crypto.subtle ${typeof crypto === "undefined" ? "missing" : typeof crypto.subtle}, DecompressionStream ${typeof DecompressionStream}, secure context ${String(globalThis.isSecureContext)}`,
    })
  }
  try {
    await ensureSpace(Math.ceil(assets.uncompressedBytes * SPACE_FACTOR), options.storage)
  } catch (error) {
    if (error instanceof StorageError && error.code === "insufficient-space") {
      throw new CardDataError("insufficient-space", "not enough free space for the card catalog", { cause: error, detail: error.detail })
    }
    throw error
  }
  await storing("marking the catalog as being installed", () =>
    db.write(["cacheIndex", ...CATALOG_STORES], async (transaction) => {
      await transaction.objectStore("cacheIndex").put(cacheEntry(assets, "partial", now().toISOString(), null))
      for (const store of CATALOG_STORES) await transaction.objectStore(store).clear()
    }),
  )
  const bytes = await download(assets, options)
  const text = await unpack(bytes, assets)
  const records = await store(db, text, assets, options)
  await storing("marking the catalog as installed", () =>
    db.write(["cacheIndex"], async (transaction) => {
      await transaction.objectStore("cacheIndex").put(cacheEntry(assets, "complete", now().toISOString(), records))
    }),
  )
  return { version: assets.id, records, installed: true }
}

async function storing<T>(what: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof CardDataError) throw error
    const detail = error instanceof StorageError ? `${error.code}: ${error.message}` : String(error)
    // A full storage is a space problem the player can solve, not a damaged database.
    const code = error instanceof StorageError && error.code === "quota-exceeded" ? "insufficient-space" : "storage"
    throw new CardDataError(code, `${what} failed`, { cause: error, detail })
  }
}

/** The whole file (it is small enough to check before anything is parsed). */
async function download(assets: CardAssetsAvailable, options: InstallOptions): Promise<Uint8Array> {
  const request = options.fetch ?? globalThis.fetch.bind(globalThis)
  let response: Response
  try {
    response = await request(assets.url, options.signal ? { signal: options.signal } : {})
  } catch (error) {
    checkAbort(options.signal)
    throw new CardDataError("download-failed", `the card catalog could not be downloaded (${assets.url})`, { cause: error, detail: String(error) })
  }
  if (!response.ok || response.body === null) {
    throw new CardDataError("download-failed", `the card catalog could not be downloaded: HTTP ${response.status}`, { detail: `${assets.url}: HTTP ${response.status}` })
  }
  // A host may send the file with Content-Encoding: gzip (Vite's preview server does); the
  // browser then hands over the unpacked JSON Lines, and those are what arrives.
  const unpacked = /\bgzip\b/i.test(response.headers.get("Content-Encoding") ?? "")
  const total = unpacked ? assets.uncompressedBytes : assets.bytes
  // Written straight into a buffer of the expected size: no second copy of ~10-45 MB.
  const buffer = new Uint8Array(total)
  let received = 0
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (received + value.byteLength > total) {
        await reader.cancel()
        throw new CardDataError("corrupt", "the downloaded card catalog is larger than this app version expects", {
          detail: `more than ${total} bytes (${unpacked ? "unpacked by the host" : "gzip"})`,
        })
      }
      buffer.set(value, received)
      received += value.byteLength
      options.onProgress?.({ phase: "download", done: received, total })
    }
  } catch (error) {
    if (error instanceof CardDataError) throw error
    checkAbort(options.signal)
    throw new CardDataError("download-failed", "the download of the card catalog broke off", { cause: error, detail: String(error) })
  }
  return buffer.subarray(0, received)
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
}

/** The checked JSON Lines as a text stream: gzip unpacked, or as a host already sent it unpacked. */
async function unpack(bytes: Uint8Array, assets: CardAssetsAvailable): Promise<ReadableStream<string>> {
  const gzip = isGzip(bytes)
  const expected = gzip ? { bytes: assets.bytes, sha256: assets.sha256 } : { bytes: assets.uncompressedBytes, sha256: assets.uncompressedSha256 }
  const actual = await sha256(bytes)
  if (bytes.byteLength !== expected.bytes || actual !== expected.sha256) {
    throw new CardDataError("corrupt", "the downloaded card catalog is not the one this app version expects", {
      detail: `${gzip ? "gzip" : "uncompressed"} file: ${bytes.byteLength} bytes, SHA-256 ${actual}; expected ${expected.bytes} bytes, SHA-256 ${expected.sha256}`,
    })
  }
  const body = new Response(bytes as Uint8Array<ArrayBuffer>).body as ReadableStream<Uint8Array<ArrayBuffer>>
  const raw = gzip ? body.pipeThrough(new DecompressionStream("gzip")) : body
  return raw.pipeThrough(new TextDecoderStream("utf-8", { fatal: true }))
}

async function* lines(text: ReadableStream<string>): AsyncGenerator<string> {
  const reader = text.getReader()
  let rest = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    rest += value
    let newline = rest.indexOf("\n")
    while (newline >= 0) {
      yield rest.slice(0, newline)
      rest = rest.slice(newline + 1)
      newline = rest.indexOf("\n")
    }
  }
  if (rest !== "") yield rest
}

function corrupt(message: string, detail?: string): CardDataError {
  return new CardDataError("corrupt", `the card catalog is damaged: ${message}`, detail === undefined ? {} : { detail })
}

function parse(line: string, number: number): unknown {
  try {
    return JSON.parse(line) as unknown
  } catch (error) {
    throw corrupt(`line ${number} is not JSON`, String(error))
  }
}

type Batch = Record<(typeof CATALOG_STORES)[number], CatalogLine["record"][]>

function emptyBatch(): Batch {
  return { scryfallCards: [], scryfallSets: [], forgeOnlyCards: [] }
}

const STORE_OF: Readonly<Record<CatalogLine["type"], (typeof CATALOG_STORES)[number]>> = {
  card: "scryfallCards",
  set: "scryfallSets",
  "forge-only": "forgeOnlyCards",
}

/** Checks and writes every record line; returns how many records were stored. */
async function store(db: LocalDatabase, text: ReadableStream<string>, assets: CardAssetsAvailable, options: InstallOptions): Promise<number> {
  // Records: every line but the header and the end line.
  const total = Math.max(0, assets.lines - 2)
  let number = 0
  let header: CatalogHeader | null = null
  let end: CatalogEnd | null = null
  const counts: CatalogEnd["counts"] = { card: 0, set: 0, "forge-only": 0 }
  let batch = emptyBatch()
  let pending = 0
  let written = 0
  const flush = async () => {
    if (pending === 0) return
    const current = batch
    batch = emptyBatch()
    pending = 0
    await storing("storing card data", () =>
      db.write(
        [...CATALOG_STORES],
        async (transaction) => {
          const requests = new PendingRequests()
          for (const storeName of CATALOG_STORES) {
            const target = transaction.objectStore(storeName)
            for (const record of current[storeName]) requests.add(target.put(record as never))
          }
          await requests.all()
        },
        { durability: "relaxed" },
      ),
    )
    written += current.scryfallCards.length + current.scryfallSets.length + current.forgeOnlyCards.length
    options.onProgress?.({ phase: "store", done: written, total })
  }
  for await (const line of lines(text)) {
    number++
    if (line.trim() === "") throw corrupt(`line ${number} is empty`)
    if (end !== null) throw corrupt(`line ${number} follows the end line`)
    const value = parse(line, number)
    if (header === null) {
      if (!validateCatalogHeader(value)) throw corrupt("the first line is not a catalog header", formatProblems(problemsOf(validateCatalogHeader)))
      if (value.formatVersion !== CATALOG_FORMAT_VERSION || value.schemaVersion !== SCHEMA_VERSION) {
        throw corrupt(`format ${value.formatVersion}/schema ${value.schemaVersion}, this app reads ${CATALOG_FORMAT_VERSION}/${SCHEMA_VERSION}`)
      }
      header = value
      continue
    }
    if ((value as { type?: unknown }).type === "end") {
      if (!validateCatalogEnd(value)) throw corrupt("the end line is malformed", formatProblems(problemsOf(validateCatalogEnd)))
      end = value
      continue
    }
    if (!validateCatalogLine(value)) throw corrupt(`line ${number} does not match the schema`, formatProblems(problemsOf(validateCatalogLine)))
    counts[value.type]++
    batch[STORE_OF[value.type]].push(value.record)
    if (++pending >= BATCH_SIZE) {
      checkAbort(options.signal)
      await flush()
    }
  }
  checkAbort(options.signal)
  if (header === null) throw corrupt("it is empty")
  if (end === null) throw corrupt("the end line is missing (incomplete file)")
  const records = counts.card + counts.set + counts["forge-only"]
  if (end.records !== records || end.counts.card !== counts.card || end.counts.set !== counts.set || end.counts["forge-only"] !== counts["forge-only"]) {
    throw corrupt(`the end line counts ${JSON.stringify(end.counts)}, the file has ${JSON.stringify(counts)}`)
  }
  if (header.counts.cards !== counts.card || header.counts.sets !== counts.set || header.counts.forgeOnly !== counts["forge-only"]) {
    throw corrupt("the header's counts do not match the file")
  }
  await flush()
  return records
}
