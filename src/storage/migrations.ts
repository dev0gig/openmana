/*
 * How a database of any older schema version reaches the current one.
 *
 * One migration per schema version, strictly in order (1, 2, 3 …). A
 * migration may
 * - change the structure (create or delete stores and indexes) inside the
 *   version-change transaction,
 * - upgrade the records of a store with a pure function from the previous
 *   version's shape to its own; the same function upgrades the records of an
 *   older backup (backup.ts), so a backup never needs its old app version,
 * - empty cache stores, whose content is simply downloaded again.
 *
 * Everything runs in the one version-change transaction IndexedDB gives an
 * upgrade: if any step fails, the browser rolls the whole upgrade back and
 * the database stays at its old version, unchanged (open.ts reports it).
 *
 * Rules for new migrations: never edit a released migration (a database out
 * there already went through it); describe the layout it creates in its own
 * constant, not with the current STORE_LAYOUT (which moves on); raise
 * $defs.SchemaVersion in the schema file together with it.
 */
import type { IDBPTransaction } from "idb"
import type { AppVersion, DatabaseMeta } from "./generated/records"
import { RECORD_CHECKS, type StoreLayout } from "./schema"

export interface Migration {
  /** The schema version this migration produces. */
  readonly version: number
  /** What it changes, in one sentence. */
  readonly summary: string
  /** Structural change: create or delete stores and indexes (synchronous IndexedDB calls only). */
  readonly structure?: (db: IDBDatabase, transaction: IDBTransaction) => void
  /** Record upgrades from the previous version, per store; pure functions (database and backups). */
  readonly records?: Readonly<Record<string, (record: unknown) => unknown>>
  /** Cache stores this version empties. */
  readonly clear?: readonly string[]
}

/** Creates stores and their indexes as a layout describes them. */
export function createStores(db: IDBDatabase, layout: Readonly<Record<string, StoreLayout>>): void {
  for (const [name, store] of Object.entries(layout)) {
    const created = db.createObjectStore(name, { keyPath: toKeyPath(store.keyPath), autoIncrement: false })
    for (const [indexName, index] of Object.entries(store.indexes)) {
      created.createIndex(indexName, toKeyPath(index.keyPath), { unique: index.unique, multiEntry: index.multiEntry })
    }
  }
}

function toKeyPath(keyPath: string | readonly string[]): string | string[] {
  return typeof keyPath === "string" ? keyPath : [...keyPath]
}

/** The stores of schema version 1 (frozen: this is history, STORE_LAYOUT is the present). Exported for the upgrade tests. */
export const LAYOUT_V1: Readonly<Record<string, StoreLayout>> = {
  meta: { keyPath: "key", indexes: {} },
  settings: { keyPath: "key", indexes: {} },
  decks: { keyPath: "id", indexes: {} },
  matches: { keyPath: "id", indexes: { startedAt: { keyPath: "startedAt", unique: false, multiEntry: false } } },
  matchLog: { keyPath: ["matchId", "seq"], indexes: {} },
  scryfallCards: {
    keyPath: "id",
    indexes: {
      oracleId: { keyPath: "oracleId", unique: false, multiEntry: false },
      nameKeys: { keyPath: "nameKeys", unique: false, multiEntry: true },
      print: { keyPath: ["set", "collectorNumber"], unique: false, multiEntry: false },
    },
  },
  cacheIndex: {
    keyPath: "key",
    indexes: {
      kind: { keyPath: "kind", unique: false, multiEntry: false },
      lastUsedAt: { keyPath: "lastUsedAt", unique: false, multiEntry: false },
    },
  },
}

/**
 * The card stores of schema version 2 (frozen): the card catalog (one record
 * per Oracle identity instead of one per printing), particular printings,
 * sets, and Forge cards without Scryfall data.
 */
const CARD_STORES_V2: Readonly<Record<string, StoreLayout>> = {
  scryfallCards: {
    keyPath: "oracleId",
    indexes: { nameKeys: { keyPath: "nameKeys", unique: false, multiEntry: true } },
  },
  scryfallPrints: {
    keyPath: "id",
    indexes: {
      print: { keyPath: ["set", "collectorNumber", "lang"], unique: false, multiEntry: false },
      oracleId: { keyPath: "oracleId", unique: false, multiEntry: false },
    },
  },
  scryfallSets: {
    keyPath: "code",
    indexes: {
      arenaCode: { keyPath: "arenaCode", unique: false, multiEntry: false },
      forgeCodes: { keyPath: "forgeCodes", unique: false, multiEntry: true },
    },
  },
  forgeOnlyCards: {
    keyPath: "name",
    indexes: { nameKeys: { keyPath: "nameKeys", unique: false, multiEntry: true } },
  },
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    summary: "First schema: meta, settings, decks, matches with matchLog, Scryfall card data and the cache index.",
    structure: (db) => createStores(db, LAYOUT_V1),
  },
  {
    version: 2,
    summary: "Card data as a catalog: scryfallCards keyed by Oracle id, plus scryfallPrints, scryfallSets and forgeOnlyCards; the cache index is emptied.",
    structure: (db) => {
      // A cache: its records are simply downloaded again with the catalog.
      if (db.objectStoreNames.contains("scryfallCards")) db.deleteObjectStore("scryfallCards")
      createStores(db, CARD_STORES_V2)
    },
    clear: ["cacheIndex"],
  },
]

/** The version the migrations lead to; throws if they are not 1, 2, 3 … in order. */
export function latestVersion(migrations: readonly Migration[]): number {
  migrations.forEach((migration, i) => {
    if (migration.version !== i + 1) {
      throw new Error(`migration ${i + 1} declares version ${migration.version}: migrations must be numbered 1, 2, 3 … without gaps`)
    }
  })
  if (migrations.length === 0) throw new Error("there must be at least one migration")
  return migrations.length
}

/** What happened during an upgrade (for the database's history). */
export interface UpgradeInfo {
  readonly oldVersion: number
  readonly newVersion: number
  readonly applied: readonly number[]
}

type VersionChangeTransaction = IDBPTransaction<unknown, string[], "versionchange">

/**
 * Runs every migration after `oldVersion` up to `newVersion`, each to the end
 * before the next begins (a later one may rely on the records the earlier
 * one wrote). Awaits nothing but requests of the version-change transaction,
 * so the transaction stays active throughout. Throws with the version and
 * store that failed.
 */
export async function runMigrations(
  transaction: VersionChangeTransaction,
  raw: { readonly db: IDBDatabase; readonly transaction: IDBTransaction },
  oldVersion: number,
  newVersion: number,
  migrations: readonly Migration[],
): Promise<UpgradeInfo> {
  const applied: number[] = []
  for (const migration of migrations) {
    if (migration.version <= oldVersion || migration.version > newVersion) continue
    try {
      migration.structure?.(raw.db, raw.transaction)
    } catch (error) {
      throw new Error(`migration to version ${migration.version} (structure): ${String(error)}`, { cause: error })
    }
    for (const [store, upgrade] of Object.entries(migration.records ?? {})) {
      try {
        let cursor = await transaction.objectStore(store).openCursor()
        while (cursor) {
          await cursor.update(upgrade(cursor.value))
          cursor = await cursor.continue()
        }
      } catch (error) {
        throw new Error(`migration to version ${migration.version}, store ${store}: ${String(error)}`, { cause: error })
      }
    }
    for (const store of migration.clear ?? []) {
      await transaction.objectStore(store).clear()
    }
    applied.push(migration.version)
  }
  return { oldVersion, newVersion, applied }
}

/**
 * Keeps the database's history in meta/database: created when, by which app
 * version, which migrations ran. A missing or damaged record is written anew
 * (creation unknown) instead of failing the upgrade.
 */
export async function writeDatabaseHistory(transaction: VersionChangeTransaction, info: UpgradeInfo, app: AppVersion, at: string): Promise<void> {
  if (!transaction.objectStoreNames.contains("meta")) return
  const meta = transaction.objectStore("meta")
  const stored: unknown = await meta.get("database")
  const current = RECORD_CHECKS.meta(stored) === null && (stored as DatabaseMeta).key === "database" ? (stored as DatabaseMeta) : null
  const entries = info.applied.map((version) => ({ version, appliedAt: at, app }))
  const next: DatabaseMeta =
    current === null
      ? {
          key: "database",
          schemaVersion: info.newVersion,
          createdAt: info.oldVersion === 0 ? at : null,
          createdBy: info.oldVersion === 0 ? app : null,
          migrations: entries,
        }
      : { ...current, schemaVersion: info.newVersion, migrations: [...current.migrations, ...entries] }
  await meta.put(next)
}

/**
 * A record of an older schema version, upgraded to `toVersion` with the same
 * functions the database upgrade uses (for backups of older app versions).
 */
export function upgradeRecord(store: string, record: unknown, fromVersion: number, toVersion: number, migrations: readonly Migration[]): unknown {
  let value = record
  for (const migration of migrations) {
    if (migration.version <= fromVersion || migration.version > toVersion) continue
    const upgrade = migration.records?.[store]
    if (upgrade) value = upgrade(value)
  }
  return value
}
