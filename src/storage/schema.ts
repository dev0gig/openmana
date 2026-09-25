/*
 * The local database: its name, its object stores (layout and role) and the
 * record check of every store. Record shapes come from the schema file
 * (schema/local-data.schema.json → generated/); how older databases reach
 * this layout is migrations.ts.
 *
 * Roles:
 * - user: the player's own data (decks, settings, recorded matches). Migrated
 *   on every upgrade, part of every backup.
 * - cache: derived data (the card catalog with Scryfall data, fetched
 *   printings, cache bookkeeping). Never backed up; a migration may simply
 *   empty it, it is downloaded again.
 * - internal: this database's own bookkeeping - its metadata (meta) and the
 *   deletion marks of deleted decks (deckTombstones, which travel only inside
 *   the collection the ORYX cloud keeps: src/storage/collection.ts). Migrated
 *   like user data, but never part of a backup.
 */
import type { DBSchema } from "idb"
import type { RecordProblem } from "./errors"
import type {
  CacheEntryRecord,
  CardRecord,
  DeckRecord,
  DeckTombstoneRecord,
  ForgeOnlyCardRecord,
  MatchLogEntry,
  MatchRecord,
  MetaRecord,
  PrintRecord,
  SetRecord,
  SettingRecord,
} from "./generated/records"
import {
  validateCacheEntryRecord,
  validateCardRecord,
  validateDeckRecord,
  validateDeckTombstoneRecord,
  validateForgeOnlyCardRecord,
  validateMatchLogEntry,
  validateMatchRecord,
  validateMetaRecord,
  validatePrintRecord,
  validateSetRecord,
  validateSettingRecord,
  type SchemaError,
  type Validator,
} from "./generated/validators.js"

export const DATABASE_NAME = "openmana"

export const STORE_NAMES = [
  "meta",
  "settings",
  "decks",
  "deckTombstones",
  "matches",
  "matchLog",
  "scryfallCards",
  "scryfallPrints",
  "scryfallSets",
  "forgeOnlyCards",
  "cacheIndex",
] as const
export type StoreName = (typeof STORE_NAMES)[number]

export type StoreRole = "user" | "cache" | "internal"

export const STORE_ROLES: Readonly<Record<StoreName, StoreRole>> = {
  meta: "internal",
  settings: "user",
  decks: "user",
  deckTombstones: "internal",
  matches: "user",
  matchLog: "user",
  scryfallCards: "cache",
  scryfallPrints: "cache",
  scryfallSets: "cache",
  forgeOnlyCards: "cache",
  cacheIndex: "cache",
}

export type KeyPath = string | readonly string[]

export interface IndexLayout {
  readonly keyPath: KeyPath
  readonly unique: boolean
  readonly multiEntry: boolean
}

export interface StoreLayout {
  readonly keyPath: KeyPath
  readonly indexes: Readonly<Record<string, IndexLayout>>
}

const index = (keyPath: KeyPath, options: { multiEntry?: boolean } = {}): IndexLayout => ({
  keyPath,
  unique: false,
  multiEntry: options.multiEntry ?? false,
})

/**
 * The layout of the current schema version. The migrations must build
 * exactly this from any older version (migrations.test.ts), and every
 * opened database is compared with it (open.ts).
 */
export const STORE_LAYOUT: Readonly<Record<StoreName, StoreLayout>> = {
  meta: { keyPath: "key", indexes: {} },
  settings: { keyPath: "key", indexes: {} },
  decks: { keyPath: "id", indexes: {} },
  deckTombstones: { keyPath: "id", indexes: {} },
  matches: { keyPath: "id", indexes: { startedAt: index("startedAt") } },
  matchLog: { keyPath: ["matchId", "seq"], indexes: {} },
  scryfallCards: { keyPath: "oracleId", indexes: { nameKeys: index("nameKeys", { multiEntry: true }) } },
  scryfallPrints: { keyPath: "id", indexes: { print: index(["set", "collectorNumber", "lang"]), oracleId: index("oracleId") } },
  scryfallSets: { keyPath: "code", indexes: { arenaCode: index("arenaCode"), forgeCodes: index("forgeCodes", { multiEntry: true }) } },
  forgeOnlyCards: { keyPath: "name", indexes: { nameKeys: index("nameKeys", { multiEntry: true }) } },
  cacheIndex: { keyPath: "key", indexes: { kind: index("kind"), lastUsedAt: index("lastUsedAt") } },
}

/** The typed view of the database for idb. */
export interface OpenManaDB extends DBSchema {
  meta: { key: string; value: MetaRecord }
  settings: { key: string; value: SettingRecord }
  decks: { key: string; value: DeckRecord }
  deckTombstones: { key: string; value: DeckTombstoneRecord }
  matches: { key: string; value: MatchRecord; indexes: { startedAt: string } }
  matchLog: { key: [string, number]; value: MatchLogEntry }
  scryfallCards: { key: string; value: CardRecord; indexes: { nameKeys: string } }
  scryfallPrints: { key: string; value: PrintRecord; indexes: { print: [string, string, string]; oracleId: string } }
  scryfallSets: { key: string; value: SetRecord; indexes: { arenaCode: string; forgeCodes: string } }
  forgeOnlyCards: { key: string; value: ForgeOnlyCardRecord; indexes: { nameKeys: string } }
  cacheIndex: { key: string; value: CacheEntryRecord; indexes: { kind: string; lastUsedAt: string } }
}

export type StoreRecord<S extends StoreName> = OpenManaDB[S]["value"]

function describe(error: SchemaError): RecordProblem {
  const params = error.params
  let message = error.message ?? error.keyword
  if (error.keyword === "additionalProperties" && typeof params["additionalProperty"] === "string") {
    message = `unexpected property '${params["additionalProperty"]}'`
  } else if (error.keyword === "enum" && Array.isArray(params["allowedValues"])) {
    message = `must be one of ${JSON.stringify(params["allowedValues"])}`
  } else if (error.keyword === "const" && "allowedValue" in params) {
    message = `must be ${JSON.stringify(params["allowedValue"])}`
  }
  return { path: error.instancePath === "" ? "/" : error.instancePath, message }
}

/** The problems a validator found in its last call, without the duplicates unions produce. */
export function problemsOf(validator: Validator<unknown>): RecordProblem[] {
  const seen = new Set<string>()
  const problems: RecordProblem[] = []
  for (const error of validator.errors ?? []) {
    const problem = describe(error)
    const key = `${problem.path} ${problem.message}`
    if (!seen.has(key)) {
      seen.add(key)
      problems.push(problem)
    }
  }
  return problems.length > 0 ? problems : [{ path: "/", message: "invalid" }]
}

/** "path: message; …" with at most `max` entries. */
export function formatProblems(problems: readonly RecordProblem[], max = 4): string {
  const shown = problems.slice(0, max).map((p) => `${p.path}: ${p.message}`)
  if (problems.length > max) shown.push(`… and ${problems.length - max} more`)
  return shown.join("; ")
}

/** A record check: null if the value is a valid record of its store, else what is wrong. */
export type RecordCheck = (value: unknown) => readonly RecordProblem[] | null

function check(validator: Validator<unknown>): RecordCheck {
  return (value) => (validator(value) ? null : problemsOf(validator))
}

export const RECORD_CHECKS: Readonly<Record<StoreName, RecordCheck>> = {
  meta: check(validateMetaRecord),
  settings: check(validateSettingRecord),
  decks: check(validateDeckRecord),
  deckTombstones: check(validateDeckTombstoneRecord),
  matches: check(validateMatchRecord),
  matchLog: check(validateMatchLogEntry),
  scryfallCards: check(validateCardRecord),
  scryfallPrints: check(validatePrintRecord),
  scryfallSets: check(validateSetRecord),
  forgeOnlyCards: check(validateForgeOnlyCardRecord),
  cacheIndex: check(validateCacheEntryRecord),
}

/** The key of a record as text, for reports ("deck 1b2c…", "[match, 12]"). */
export function formatKey(key: IDBValidKey): string {
  if (Array.isArray(key)) return `[${key.map((part) => formatKey(part as IDBValidKey)).join(", ")}]`
  if (key instanceof Date) return key.toISOString()
  if (typeof key === "string" || typeof key === "number") return String(key)
  return "(binary key)"
}
