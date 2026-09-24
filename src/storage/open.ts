/*
 * Opening the local database: upgrade it through the migrations if it is
 * older, wait (and say so) while another tab still holds an older version,
 * refuse one written by a newer OpenMana, and check that what opened has
 * exactly the stores and indexes the current schema expects. Everything that
 * can go wrong ends as a StorageError; nothing is repaired silently.
 *
 * Generic over the migrations and the layout, so tests can drive upgrades of
 * made-up schema versions through exactly this code.
 */
import { openDB, unwrap, type IDBPDatabase } from "idb"
import { StorageError, toStorageError } from "./errors"
import type { AppVersion } from "./generated/records"
import { latestVersion, runMigrations, writeDatabaseHistory, type Migration } from "./migrations"
import type { KeyPath, StoreLayout } from "./schema"

export interface OpenOptions {
  readonly name: string
  readonly migrations: readonly Migration[]
  /** The layout the last migration leads to (compared after every open). */
  readonly layout: Readonly<Record<string, StoreLayout>>
  /** Recorded in the database's history. */
  readonly app: AppVersion
  readonly now?: () => Date
  /** The open waits because another tab still uses an older version (it continues on its own once that closes). */
  readonly onBlocked?: () => void
  /** Another tab upgrades (number) or deletes (null) the database: this connection has already been closed. */
  readonly onVersionChange?: (newVersion: number | null) => void
  /** The browser closed the connection on its own (site data cleared, disk failure). */
  readonly onTerminated?: () => void
}

export async function openWithMigrations(options: OpenOptions): Promise<IDBPDatabase<unknown>> {
  const version = latestVersion(options.migrations)
  const now = options.now ?? (() => new Date())
  if (typeof globalThis.indexedDB === "undefined") {
    throw new StorageError("unsupported", "IndexedDB is not available on this page")
  }
  let upgradeFailure: unknown = undefined
  let db: IDBPDatabase<unknown>
  try {
    db = await openDB(options.name, version, {
      upgrade(database, oldVersion, newVersion, transaction) {
        // A failed upgrade is reported through the open request (below), not through this promise.
        transaction.done.catch(() => undefined)
        const raw = { db: unwrap(database), transaction: unwrap(transaction) }
        runMigrations(transaction, raw, oldVersion, newVersion ?? version, options.migrations)
          .then((info) => writeDatabaseHistory(transaction, info, options.app, now().toISOString()))
          .catch((error: unknown) => {
            upgradeFailure = error
            try {
              transaction.abort()
            } catch {
              // The transaction has already failed on its own.
            }
          })
      },
      blocked: () => options.onBlocked?.(),
      blocking: (_currentVersion, blockedVersion, event) => {
        // Never hold another tab's upgrade or reset back: let go at once.
        ;(event.target as IDBDatabase).close()
        options.onVersionChange?.(blockedVersion)
      },
      terminated: () => options.onTerminated?.(),
    })
  } catch (error) {
    if (upgradeFailure !== undefined) {
      throw new StorageError("upgrade-failed", `the database could not be upgraded to version ${version}; it is unchanged`, {
        cause: upgradeFailure,
      })
    }
    throw toStorageError(error, `opening the database (version ${version})`, "open")
  }
  const mismatch = await compareLayout(db, options.layout)
  if (mismatch.length > 0) {
    db.close()
    throw new StorageError("schema-mismatch", `the database (version ${db.version}) does not have the expected structure`, {
      detail: mismatch.join("; "),
    })
  }
  return db
}

function sameKeyPath(actual: string | string[] | null, expected: KeyPath): boolean {
  return JSON.stringify(actual) === JSON.stringify(typeof expected === "string" ? expected : [...expected])
}

/** Every difference between the database's stores and indexes and the expected layout (empty: identical). */
export async function compareLayout(db: IDBPDatabase<unknown>, layout: Readonly<Record<string, StoreLayout>>): Promise<string[]> {
  const problems: string[] = []
  const expected = Object.keys(layout)
  const actual = Array.from(db.objectStoreNames)
  for (const name of expected) if (!actual.includes(name)) problems.push(`store ${name} is missing`)
  for (const name of actual) if (!expected.includes(name)) problems.push(`unexpected store ${name}`)
  const present = expected.filter((name) => actual.includes(name))
  if (present.length === 0) return problems
  const transaction = db.transaction(present, "readonly")
  for (const name of present) {
    const store = transaction.objectStore(name)
    const want = layout[name]!
    if (!sameKeyPath(store.keyPath, want.keyPath)) {
      problems.push(`store ${name}: key path ${JSON.stringify(store.keyPath)} instead of ${JSON.stringify(want.keyPath)}`)
    }
    if (store.autoIncrement) problems.push(`store ${name}: generates keys (autoIncrement)`)
    const indexNames = Array.from(store.indexNames)
    for (const [indexName, index] of Object.entries(want.indexes)) {
      if (!indexNames.includes(indexName)) {
        problems.push(`store ${name}: index ${indexName} is missing`)
        continue
      }
      const actualIndex = store.index(indexName)
      if (!sameKeyPath(actualIndex.keyPath, index.keyPath) || actualIndex.unique !== index.unique || actualIndex.multiEntry !== index.multiEntry) {
        problems.push(`store ${name}: index ${indexName} differs`)
      }
    }
    for (const indexName of indexNames) {
      if (!(indexName in want.indexes)) problems.push(`store ${name}: unexpected index ${indexName}`)
    }
  }
  await transaction.done
  return problems
}
