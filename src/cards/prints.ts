/*
 * Particular printings: a deck names set and collector number ("4 Lightning
 * Strike (M19) 152"), and the player should see that printing - in German if
 * it was printed in German, else as printed. The catalog carries only each
 * card's default printings, so these come from Scryfall's API
 * (scryfall-client.ts): the printing itself in batches of 75
 * (/cards/collection), its German version one request each. Both answers -
 * also "there is no German version" and "there is no such printing" - are
 * kept in the local database and asked again only after PRINT_MAX_AGE
 * (Scryfall: cache at least 24 hours; printings hardly ever change).
 *
 * Without network, a stale answer is still used; a printing never fetched
 * stays unknown, and the display falls back to the catalog's default
 * printing (card-display.ts) - never a guess.
 */
import type { LocalDatabase } from "@/storage/database"
import { assertRecord, PendingRequests } from "@/storage/database"
import type { CacheEntryRecord, PrintRecord } from "@/storage/generated/records"
import { CardDataError } from "./errors"
import type { ScryfallCard } from "./scryfall/generated/records"
import type { ScryfallClient } from "./scryfall-client"
import { printFacts, ScryfallDataError, translatedFaces } from "./scryfall-print"

export const PRINT_MAX_AGE = 30 * 24 * 60 * 60 * 1000
/** cacheIndex kind of "Scryfall has no such printing (in that language)". */
export const MISSING_PRINT_KIND = "scryfall-print-missing"

export interface PrintKey {
  readonly set: string
  readonly collectorNumber: string
}

/** "m19|152": set codes are compared in lower case, as Scryfall writes them. */
export function printKey(key: PrintKey): string {
  return `${key.set.toLowerCase()}|${key.collectorNumber}`
}

function missingKey(lang: "de" | "default", key: PrintKey): string {
  return `print:${lang}:${printKey(key)}`
}

export interface ResolvedPrint {
  /** The printing as Scryfall lists it by default (English, or its only language); null: no such printing. */
  readonly original: PrintRecord | null
  /** Its German version; null: none. */
  readonly german: PrintRecord | null
}

interface Known {
  original?: { readonly record: PrintRecord | null; readonly at: string }
  german?: { readonly record: PrintRecord | null; readonly at: string }
}

/** A Scryfall card object as a PrintRecord (null: it has no Oracle id, a reversible card). */
export function printRecord(card: ScryfallCard, fetchedAt: string): PrintRecord | null {
  const oracleId = card.oracle_id ?? card.card_faces?.[0]?.oracle_id
  if (oracleId === undefined) return null
  let facts
  try {
    facts = printFacts(card)
  } catch (error) {
    if (error instanceof ScryfallDataError) throw new CardDataError("scryfall-format", error.message)
    throw error
  }
  const printed = card.lang === "en" ? null : translatedFaces(card)
  const record = {
    ...facts,
    oracleId,
    name: card.name,
    ...(printed !== null && printed.completeness > 0 ? { printed: printed.faces } : {}),
    fetchedAt,
  }
  return assertRecord("scryfallPrints", record)
}

/** What the local database knows about these printings (any age). */
async function readKnown(db: LocalDatabase, keys: readonly PrintKey[]): Promise<Map<string, Known>> {
  return db.read(["scryfallPrints", "cacheIndex"], async (transaction) => {
    const prints = transaction.objectStore("scryfallPrints").index("print")
    const cache = transaction.objectStore("cacheIndex")
    const known = new Map<string, Known>()
    for (const key of keys) {
      const id = printKey(key)
      if (known.has(id)) continue
      const entry: Known = {}
      const set = key.set.toLowerCase()
      const all = await prints.getAll(IDBKeyRange.bound([set, key.collectorNumber, ""], [set, key.collectorNumber, "￿"]))
      const german = all.find((record) => record.lang === "de")
      // A printing that exists only in German is its own default printing.
      const original = all.find((record) => record.lang !== "de") ?? german
      if (german) entry.german = { record: german, at: german.fetchedAt }
      if (original) entry.original = { record: original, at: original.fetchedAt }
      const noGerman = await cache.get(missingKey("de", key))
      if (!entry.german && noGerman) entry.german = { record: null, at: noGerman.storedAt }
      const noOriginal = await cache.get(missingKey("default", key))
      if (!entry.original && noOriginal) entry.original = { record: null, at: noOriginal.storedAt }
      known.set(id, entry)
    }
    return known
  })
}

function fresh(at: string | undefined, now: number): boolean {
  return at !== undefined && now - Date.parse(at) < PRINT_MAX_AGE
}

function missingEntry(key: string, source: string, at: string): CacheEntryRecord {
  return { key, kind: MISSING_PRINT_KIND, status: "complete", source, version: null, storedAt: at, lastUsedAt: at, bytes: null, records: 0 }
}

export interface EnsurePrintsOptions {
  readonly now?: () => Date
}

/**
 * The printings, fetched where the database has no fresh answer. If
 * Scryfall cannot be reached, what the database has (even stale) is
 * returned and the error is reported in `error`; nothing is guessed.
 */
export async function ensurePrints(
  db: LocalDatabase,
  client: ScryfallClient,
  keys: readonly PrintKey[],
  options: EnsurePrintsOptions = {},
): Promise<{ readonly prints: ReadonlyMap<string, ResolvedPrint>; readonly error: CardDataError | null }> {
  const now = options.now ?? (() => new Date())
  const unique = [...new Map(keys.map((key) => [printKey(key), { set: key.set.toLowerCase(), collectorNumber: key.collectorNumber }])).values()]
  const known = await readKnown(db, unique)
  const at = now().toISOString()
  const needOriginal = unique.filter((key) => !fresh(known.get(printKey(key))?.original?.at, now().getTime()))
  const needGerman = unique.filter((key) => !fresh(known.get(printKey(key))?.german?.at, now().getTime()))
  const records: PrintRecord[] = []
  const missing: CacheEntryRecord[] = []
  let error: CardDataError | null = null
  try {
    if (needOriginal.length > 0) {
      const { cards } = await client.collection(needOriginal.map((key) => ({ set: key.set, collector_number: key.collectorNumber })))
      const found = new Set<string>()
      for (const card of cards) {
        const record = printRecord(card, at)
        if (record === null) continue
        records.push(record)
        const id = printKey(record)
        found.add(id)
        const entry = known.get(id) ?? {}
        entry.original = { record, at }
        if (record.lang === "de") entry.german = { record, at }
        known.set(id, entry)
      }
      for (const key of needOriginal) {
        const id = printKey(key)
        if (found.has(id)) continue
        missing.push(missingEntry(missingKey("default", key), `https://api.scryfall.com/cards/${key.set}/${key.collectorNumber}`, at))
        known.set(id, { ...known.get(id), original: { record: null, at } })
      }
    }
    for (const key of needGerman) {
      const id = printKey(key)
      const entry = known.get(id) ?? {}
      if (entry.german && fresh(entry.german.at, now().getTime())) continue
      // No German version of a printing that does not exist.
      if (entry.original?.record === null) continue
      const card = await client.cardByPrint(key.set, key.collectorNumber, "de")
      const record = card === null ? null : printRecord(card, at)
      if (record !== null) records.push(record)
      else missing.push(missingEntry(missingKey("de", key), `https://api.scryfall.com/cards/${key.set}/${key.collectorNumber}/de`, at))
      entry.german = { record, at }
      known.set(id, entry)
    }
  } catch (caught) {
    if (!(caught instanceof CardDataError)) throw caught
    error = caught
  }
  if (records.length > 0 || missing.length > 0) {
    await db.write(["scryfallPrints", "cacheIndex"], async (transaction) => {
      const requests = new PendingRequests()
      for (const record of records) requests.add(transaction.objectStore("scryfallPrints").put(record))
      for (const entry of missing) requests.add(transaction.objectStore("cacheIndex").put(entry))
      await requests.all()
    })
  }
  const prints = new Map<string, ResolvedPrint>()
  for (const key of unique) {
    const entry = known.get(printKey(key))
    prints.set(printKey(key), { original: entry?.original?.record ?? null, german: entry?.german?.record ?? null })
  }
  return { prints, error }
}
