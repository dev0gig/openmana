/* Local recordings, transcript transactions and retention (prompt 22). */
import { formatKey } from "./schema"
import { sortOut, type CheckedRecords, type WriteTransaction, type LocalDatabase } from "./database"
import type { MatchRecord } from "./generated/records"

/** Every match header, newest first (index startedAt); damaged records separately. */
export async function listMatches(db: LocalDatabase): Promise<CheckedRecords<MatchRecord>> {
  return db.read(["matches"], async (transaction) => {
    const keys: IDBValidKey[] = []
    const values: unknown[] = []
    let cursor = await transaction.objectStore("matches").index("startedAt").openCursor(null, "prev")
    while (cursor) {
      keys.push(cursor.primaryKey)
      values.push(cursor.value)
      cursor = await cursor.continue()
    }
    // Records whose startedAt is no valid key are missing from the index; they are damaged, and must not vanish.
    const indexed = new Set(keys.map((key) => formatKey(key)))
    const store = transaction.objectStore("matches")
    const allKeys = await store.getAllKeys()
    for (const key of allKeys) {
      if (!indexed.has(formatKey(key))) {
        keys.push(key)
        values.push(await store.get(key))
      }
    }
    return sortOut("matches", keys, values)
  })
}

import { assertRecord } from "./database"
import { StorageError } from "./errors"
import type { MatchLogEntry } from "./generated/records"
import { defineSetting, readSetting } from "./settings"

export const MATCH_RETENTION = defineSetting(
  "matches.retention",
  100,
  (value): value is number => Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 1000,
)

export interface StoredMatch {
  readonly match: MatchRecord
  readonly log: readonly MatchLogEntry[]
}

export const logRange = (id: string): IDBKeyRange => IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])

export async function readMatch(db: LocalDatabase, id: string): Promise<StoredMatch | null> {
  return db.read(["matches", "matchLog"], async (tx) => {
    const raw: unknown = await tx.objectStore("matches").get(id)
    if (raw === undefined) return null
    const match = assertRecord("matches", raw)
    const log = (await tx.objectStore("matchLog").getAll(logRange(id))).map((entry) => assertRecord("matchLog", entry))
    return { match, log }
  })
}

/** Header + transcript batch commit together. A deleted match is never resurrected. */
export async function writeMatchBatch(
  db: LocalDatabase,
  match: MatchRecord,
  log: readonly MatchLogEntry[],
  create: boolean,
): Promise<boolean> {
  assertRecord("matches", match)
  log.forEach((entry) => {
    assertRecord("matchLog", entry)
    if (entry.matchId !== match.id) throw new StorageError("invalid-record", "recording batch belongs to another match")
  })
  return db.write(["matches", "matchLog"], async (tx) => {
    const store = tx.objectStore("matches")
    if (!create) {
      const current: unknown = await store.get(match.id)
      if (current === undefined) return false
      assertRecord("matches", current)
    }
    if (create) await store.add(match)
    else await store.put(match)
    for (const entry of log) await tx.objectStore("matchLog").add(entry)
    return true
  })
}

export async function deleteMatch(db: LocalDatabase, id: string): Promise<void> {
  await db.write(["matches", "matchLog"], async (tx) => {
    await tx.objectStore("matches").delete(id)
    await tx.objectStore("matchLog").delete(logRange(id))
  })
}

/** The caller explicitly confirms clearing headers and transcripts, including running recordings. */
export async function clearMatches(db: LocalDatabase): Promise<void> {
  await db.write(["matches", "matchLog"], async (tx) => {
    await tx.objectStore("matches").clear()
    await tx.objectStore("matchLog").clear()
  })
}

/** Latest N completed recordings; never silently discard damaged or possibly live data. */
export async function pruneMatches(db: LocalDatabase): Promise<void> {
  await db.write(["settings", "matches", "matchLog"], pruneMatchTransaction)
}

/** Used inside an import transaction as well, so imported data + retention are all or nothing. */
export async function pruneMatchTransaction(tx: WriteTransaction<"settings" | "matches" | "matchLog">): Promise<void> {
  const raw: unknown = await tx.objectStore("settings").get(MATCH_RETENTION.key)
  const value = (raw as { value?: unknown } | undefined)?.value
  const limit = MATCH_RETENTION.check(value) ? value : MATCH_RETENTION.fallback
  let kept = 0
  let cursor = await tx.objectStore("matches").index("startedAt").openCursor(null, "prev")
  while (cursor) {
    // Corrupt records are left for the integrity UI, not erased by retention.
    const checked = sortOut("matches", [cursor.primaryKey], [cursor.value])
    const match = checked.records[0]
    if (match && match.status !== "running" && ++kept > limit) {
      await cursor.delete()
      await tx.objectStore("matchLog").delete(logRange(match.id))
    }
    cursor = await cursor.continue()
  }
}

export async function retention(db: LocalDatabase) {
  return readSetting(db, MATCH_RETENTION)
}
