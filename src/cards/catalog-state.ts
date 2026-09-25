/*
 * What this device holds of the card catalog: its entry in cacheIndex,
 * written by catalog-install.ts ("partial" while an install runs or after it
 * broke off, "complete" with version and record count).
 */
import type { LocalDatabase } from "@/storage/database"

/** The key of the catalog's entry in cacheIndex. */
export const CATALOG_CACHE_KEY = "card-catalog"
export const CATALOG_CACHE_KIND = "card-catalog"

export type InstalledCatalog =
  | { readonly status: "missing" }
  /** An install began and did not finish (or runs in another tab): the stores are incomplete. */
  | { readonly status: "partial"; readonly version: string | null; readonly since: string }
  | { readonly status: "complete"; readonly version: string; readonly records: number; readonly storedAt: string }

/** What the local database holds of the catalog (cacheIndex). */
export async function readInstalledCatalog(db: LocalDatabase): Promise<InstalledCatalog> {
  const entry = await db.read(["cacheIndex"], (transaction) => transaction.objectStore("cacheIndex").get(CATALOG_CACHE_KEY))
  if (entry === undefined) return { status: "missing" }
  if (entry.status === "complete" && entry.version !== null && entry.records !== null) {
    return { status: "complete", version: entry.version, records: entry.records, storedAt: entry.storedAt }
  }
  return { status: "partial", version: entry.version, since: entry.storedAt }
}
