/*
 * Recorded matches in the local database. Recording and the match library
 * are prompt 22; until then matches only arrive through a backup, and the
 * matches page shows them as they are.
 */
import { formatKey } from "./schema"
import { sortOut, type CheckedRecords, type LocalDatabase } from "./database"
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
