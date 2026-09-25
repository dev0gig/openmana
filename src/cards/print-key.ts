/*
 * A printing's key and what Scryfall said about it - the part of prints.ts
 * that pages need up front. prints.ts itself (fetching and keeping
 * printings) loads only when Scryfall is first asked (scryfall-access.ts);
 * importing it statically would pull it into the pages' chunks.
 */
import type { PrintRecord } from "@/storage/generated/records"

export interface PrintKey {
  readonly set: string
  readonly collectorNumber: string
}

/** "m19|152": set codes are compared in lower case, as Scryfall writes them. */
export function printKey(key: PrintKey): string {
  return `${key.set.toLowerCase()}|${key.collectorNumber}`
}

export interface ResolvedPrint {
  /** The printing as Scryfall lists it by default (English, or its only language); null: no such printing. */
  readonly original: PrintRecord | null
  /** Its German version; null: none. */
  readonly german: PrintRecord | null
}
