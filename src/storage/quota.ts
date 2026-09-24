/*
 * How much the browser lets OpenMana store (StorageManager): usage and quota
 * of this site, whether the data is persistent, and a check before large
 * writes. The browser's figures are estimates (rounded, padded); they are
 * shown as such and only block a write that clearly cannot fit. A write that
 * fails anyway still ends as quota-exceeded (database.ts), with nothing
 * written.
 *
 * Asking the browser for persistent storage (navigator.storage.persist) is
 * prompt 25's job; here it is only read.
 */
import { StorageError } from "./errors"

export interface StorageSpace {
  /** Bytes this site uses (all of its storage: IndexedDB, caches …); null if the browser does not say. */
  readonly usage: number | null
  /** Bytes this site may use; null if unknown. */
  readonly quota: number | null
  /** quota − usage, never negative; null if unknown. */
  readonly available: number | null
  /** true: the browser will not clear the data on its own; null if unknown. */
  readonly persisted: boolean | null
}

/** Less free space than this is shown as a warning (an engine update and card data need room). */
export const LOW_SPACE_BYTES = 256 * 1024 * 1024

/** The part of StorageManager used here (tests pass a fake). */
export type StorageEstimator = Pick<StorageManager, "estimate" | "persisted">

function defaultManager(): Partial<StorageEstimator> | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.storage
}

export async function readStorageSpace(manager: Partial<StorageEstimator> | undefined = defaultManager()): Promise<StorageSpace> {
  let usage: number | null = null
  let quota: number | null = null
  let persisted: boolean | null = null
  try {
    const estimate = await manager?.estimate?.()
    usage = typeof estimate?.usage === "number" ? estimate.usage : null
    quota = typeof estimate?.quota === "number" ? estimate.quota : null
  } catch {
    // Unknown stays unknown.
  }
  try {
    const value = await manager?.persisted?.()
    persisted = typeof value === "boolean" ? value : null
  } catch {
    // Unknown stays unknown.
  }
  const available = usage !== null && quota !== null ? Math.max(0, quota - usage) : null
  return { usage, quota, available, persisted }
}

export function isLowOnSpace(space: StorageSpace): boolean {
  return space.available !== null && space.available < LOW_SPACE_BYTES
}

/**
 * Throws insufficient-space if the browser reports less free space than
 * `bytes`. Unknown figures do not block (the write itself will tell).
 */
export async function ensureSpace(bytes: number, manager: Partial<StorageEstimator> | undefined = defaultManager()): Promise<StorageSpace> {
  const space = await readStorageSpace(manager)
  if (space.available !== null && bytes > space.available) {
    throw new StorageError("insufficient-space", `about ${bytes} bytes are needed, the browser reports ${space.available} bytes free`, {
      detail: `needed ${bytes} B, available ${space.available} B (usage ${space.usage} B of ${space.quota} B)`,
    })
  }
  return space
}
