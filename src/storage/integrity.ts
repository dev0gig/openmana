/*
 * Checking the local data: every record against its store's schema, every
 * match log entry against its match, the database's own metadata against
 * its version. Nothing is repaired on the side: the report says what is
 * wrong, and only an explicit removeDamaged() (after the player confirmed)
 * deletes records - and only those that are still damaged when it runs.
 */
import type { LocalDatabase } from "./database"
import type { RecordProblem } from "./errors"
import type { DatabaseMeta } from "./generated/records"
import { formatKey, RECORD_CHECKS, STORE_NAMES, type StoreName } from "./schema"

export type IntegrityProblemKind =
  /** The record does not match its schema. */
  | "invalid"
  /** A match log entry whose match does not exist. */
  | "orphan"
  /** meta/database is missing or does not name this database's version. */
  | "metadata"

export interface IntegrityProblem {
  readonly store: StoreName
  readonly key: string
  readonly kind: IntegrityProblemKind
  readonly problems: readonly RecordProblem[]
  /** Deleting the record removes the problem (not so for missing metadata). */
  readonly removable: boolean
  /** The IndexedDB key, for removal. */
  readonly rawKey: IDBValidKey
}

export interface IntegrityReport {
  readonly checkedAt: string
  readonly version: number
  readonly records: Readonly<Record<StoreName, number>>
  readonly problems: readonly IntegrityProblem[]
}

function matchIdOf(value: unknown): string | null {
  if (value !== null && typeof value === "object" && "matchId" in value && typeof value.matchId === "string") return value.matchId
  return null
}

/** Reads every store once (one read-only transaction: a consistent picture). */
export async function checkIntegrity(db: LocalDatabase, now: () => Date = () => new Date()): Promise<IntegrityReport> {
  const version = db.version
  return db.read(STORE_NAMES, async (transaction) => {
    const records = {} as Record<StoreName, number>
    const problems: IntegrityProblem[] = []
    const matchIds = new Set((await transaction.objectStore("matches").getAllKeys()).map((key) => formatKey(key)))
    for (const store of STORE_NAMES) {
      let count = 0
      let cursor = await transaction.objectStore(store).openCursor()
      while (cursor) {
        count++
        const value: unknown = cursor.value
        const key = cursor.primaryKey
        const invalid = RECORD_CHECKS[store](value)
        if (invalid !== null) {
          problems.push({ store, key: formatKey(key), kind: "invalid", problems: invalid, removable: true, rawKey: key })
        } else if (store === "matchLog") {
          const matchId = matchIdOf(value)
          if (matchId !== null && !matchIds.has(matchId)) {
            problems.push({
              store,
              key: formatKey(key),
              kind: "orphan",
              problems: [{ path: "/matchId", message: "the match of this log entry does not exist" }],
              removable: true,
              rawKey: key,
            })
          }
        }
        cursor = await cursor.continue()
      }
      records[store] = count
    }
    // A damaged meta/database is already reported above; here: missing or naming another version.
    const database: unknown = await transaction.objectStore("meta").get("database")
    if (database === undefined) {
      problems.push({
        store: "meta",
        key: "database",
        kind: "metadata",
        problems: [{ path: "/", message: "the database's own record is missing" }],
        removable: false,
        rawKey: "database",
      })
    } else if (RECORD_CHECKS.meta(database) === null && (database as DatabaseMeta).schemaVersion !== version) {
      problems.push({
        store: "meta",
        key: "database",
        kind: "metadata",
        problems: [{ path: "/schemaVersion", message: `says ${(database as DatabaseMeta).schemaVersion}, the database is version ${version}` }],
        removable: false,
        rawKey: "database",
      })
    }
    return { checkedAt: now().toISOString(), version, records, problems }
  })
}

/**
 * Deletes the removable records of a report that are still damaged now (one
 * transaction; a record repaired meanwhile, for example by loading a backup,
 * stays). Returns how many were deleted.
 */
export async function removeDamaged(db: LocalDatabase, report: IntegrityReport): Promise<number> {
  const targets = report.problems.filter((problem) => problem.removable)
  if (targets.length === 0) return 0
  const stores = [...new Set<StoreName>([...targets.map((problem) => problem.store), "matches"])]
  return db.write(stores, async (transaction) => {
    let removed = 0
    for (const problem of targets) {
      const store = transaction.objectStore(problem.store)
      const value: unknown = await store.get(problem.rawKey as never)
      if (value === undefined) continue
      let stillDamaged = RECORD_CHECKS[problem.store](value) !== null
      if (!stillDamaged && problem.kind === "orphan") {
        const matchId = matchIdOf(value)
        stillDamaged = matchId !== null && (await transaction.objectStore("matches").count(matchId)) === 0
      }
      if (stillDamaged) {
        await store.delete(problem.rawKey as never)
        removed++
      }
    }
    return removed
  })
}
