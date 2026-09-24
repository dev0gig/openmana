/*
 * What the local database holds, at a glance (settings page): records per
 * store, the database's history and the last backup. One read-only
 * transaction; counts only, no records are loaded.
 */
import type { LocalDatabase } from "./database"
import type { BackupMeta, DatabaseMeta } from "./generated/records"
import { RECORD_CHECKS, STORE_NAMES, type StoreName } from "./schema"

export interface StorageOverview {
  readonly version: number
  readonly counts: Readonly<Record<StoreName, number>>
  /** meta/database, if present and valid. */
  readonly database: DatabaseMeta | null
  /** meta/backup, if present and valid. */
  readonly backup: BackupMeta | null
}

function metaRecord<K extends "database" | "backup">(value: unknown, key: K): Extract<DatabaseMeta | BackupMeta, { key: K }> | null {
  if (RECORD_CHECKS.meta(value) !== null || (value as { key: string }).key !== key) return null
  return value as Extract<DatabaseMeta | BackupMeta, { key: K }>
}

export async function readOverview(db: LocalDatabase): Promise<StorageOverview> {
  return db.read(STORE_NAMES, async (transaction) => {
    const counts = {} as Record<StoreName, number>
    for (const store of STORE_NAMES) counts[store] = await transaction.objectStore(store).count()
    const meta = transaction.objectStore("meta")
    return {
      version: db.version,
      counts,
      database: metaRecord(await meta.get("database"), "database"),
      backup: metaRecord(await meta.get("backup"), "backup"),
    }
  })
}
