/*
 * Scryfall's bulk data for the catalog build: the index of bulk files, the
 * "all_cards" file (every printing in every language, ~400 MB gzip JSON
 * Lines, never unpacked on disk) and the set list - downloaded once into a
 * cache directory and read from there.
 *
 * Scryfall's rules (https://scryfall.com/docs/api, checked 2026-09-25):
 * every request to api.scryfall.com sends a User-Agent naming the
 * application and an Accept header; the build makes two such requests (bulk
 * index, sets), far below the 10 per second. The bulk file itself comes
 * from data.scryfall.io, which has no rate limit. Scryfall publishes it
 * daily; for game data "once per week or after set releases" is enough.
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createGunzip } from "node:zlib"
import type { ScryfallBulkData, ScryfallCard, ScryfallSet } from "../../src/cards/scryfall/generated/records.ts"
import { validateScryfallBulkDataList, validateScryfallCard, validateScryfallList, validateScryfallSet } from "../../src/cards/scryfall/generated/validators.js"

export const API_ORIGIN = "https://api.scryfall.com"
export const BULK_TYPE = "all_cards"

export class ScryfallBulkError extends Error {
  override name = "ScryfallBulkError"
}

/** Scryfall asks for an accurate User-Agent naming the application, and an Accept header. */
export function requestHeaders(appVersion: string): Record<string, string> {
  return { "User-Agent": `OpenMana-CardCatalog/${appVersion}`, Accept: "application/json;q=0.9,*/*;q=0.8" }
}

function schemaProblem(errors: readonly { instancePath: string; message?: string }[] | null | undefined): string {
  return (errors ?? [])
    .slice(0, 3)
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`)
    .join("; ")
}

async function getJson(url: string, appVersion: string): Promise<{ readonly body: unknown; readonly bytes: Buffer }> {
  const response = await fetch(url, { headers: requestHeaders(appVersion) })
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!response.ok) throw new ScryfallBulkError(`GET ${url}: HTTP ${response.status} ${bytes.toString("utf8").slice(0, 300)}`)
  return { body: JSON.parse(bytes.toString("utf8")) as unknown, bytes }
}

/** The current entry of the all_cards bulk file. */
export async function fetchBulkEntry(appVersion: string): Promise<ScryfallBulkData> {
  const { body } = await getJson(`${API_ORIGIN}/bulk-data`, appVersion)
  if (!validateScryfallBulkDataList(body)) throw new ScryfallBulkError(`/bulk-data: unexpected answer (${schemaProblem(validateScryfallBulkDataList.errors)})`)
  const entry = body.data.find((item) => item.type === BULK_TYPE)
  if (!entry) throw new ScryfallBulkError(`/bulk-data lists no ${BULK_TYPE} file`)
  return entry
}

export interface CachedFile {
  readonly file: string
  readonly bytes: number
  readonly sha256: string
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256")
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest("hex")
}

/**
 * The bulk file in the cache (downloaded if it is not there yet, complete:
 * size as Scryfall announced it). Written to a temporary name first, so an
 * interrupted download never looks complete.
 */
export async function cachedBulkFile(entry: ScryfallBulkData, cacheDir: string, appVersion: string, log: (message: string) => void): Promise<CachedFile> {
  fs.mkdirSync(cacheDir, { recursive: true })
  const file = path.join(cacheDir, path.basename(new URL(entry.jsonl_download_uri).pathname))
  if (!fs.existsSync(file) || fs.statSync(file).size !== entry.compressed_size) {
    log(`downloading ${entry.jsonl_download_uri} (${(entry.compressed_size / 1e6).toFixed(0)} MB)`)
    const response = await fetch(entry.jsonl_download_uri, { headers: requestHeaders(appVersion) })
    if (!response.ok || response.body === null) throw new ScryfallBulkError(`GET ${entry.jsonl_download_uri}: HTTP ${response.status}`)
    const partial = `${file}.part`
    await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), fs.createWriteStream(partial))
    const size = fs.statSync(partial).size
    if (size !== entry.compressed_size) throw new ScryfallBulkError(`${entry.jsonl_download_uri}: ${size} bytes received, Scryfall announced ${entry.compressed_size}`)
    fs.renameSync(partial, file)
  }
  const bytes = fs.statSync(file).size
  return { file, bytes, sha256: await sha256File(file) }
}

/** The set list (one request; Scryfall returns every set at once) in the cache. */
export async function cachedSetsFile(cacheDir: string, appVersion: string, label: string): Promise<CachedFile> {
  fs.mkdirSync(cacheDir, { recursive: true })
  const file = path.join(cacheDir, `sets-${label}.json`)
  if (!fs.existsSync(file)) {
    const { body, bytes } = await getJson(`${API_ORIGIN}/sets`, appVersion)
    if (!validateScryfallList(body) || body.has_more === true) throw new ScryfallBulkError("/sets: unexpected answer (not one complete list)")
    fs.writeFileSync(file, bytes)
  }
  return { file, bytes: fs.statSync(file).size, sha256: await sha256File(file) }
}

/** Every set of a set list file, each checked against the Scryfall schema. */
export function readSets(file: string): ScryfallSet[] {
  const body: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
  if (!validateScryfallList(body)) throw new ScryfallBulkError(`${file}: not a Scryfall list (${schemaProblem(validateScryfallList.errors)})`)
  return body.data.map((item, i) => {
    if (!validateScryfallSet(item)) throw new ScryfallBulkError(`${file}: set ${i} (${JSON.stringify((item as { code?: unknown }).code)}): ${schemaProblem(validateScryfallSet.errors)}`)
    return item
  })
}

/**
 * The card objects of a bulk file (gzip JSON Lines, or plain JSON Lines for
 * test fixtures), each checked against the Scryfall schema: a card that does
 * not fit stops the build with its line number instead of ending up wrong
 * in the catalog.
 */
export async function* readBulkCards(file: string): AsyncGenerator<ScryfallCard> {
  const raw = fs.createReadStream(file)
  const input = file.endsWith(".gz") ? raw.pipe(createGunzip()) : raw
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  let number = 0
  for await (const line of lines) {
    number++
    const text = line.trim()
    if (text === "" || text === "[" || text === "]") continue
    let value: unknown
    try {
      value = JSON.parse(text.endsWith(",") ? text.slice(0, -1) : text)
    } catch (error) {
      throw new ScryfallBulkError(`${file}, line ${number}: not JSON (${error instanceof Error ? error.message : String(error)})`)
    }
    if (!validateScryfallCard(value)) {
      const id = (value as { id?: unknown }).id
      throw new ScryfallBulkError(`${file}, line ${number} (card ${String(id)}): ${schemaProblem(validateScryfallCard.errors)}`)
    }
    yield value
  }
}
