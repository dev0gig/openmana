/*
 * The opened local database. Every read and write goes through one
 * IndexedDB transaction:
 *
 * - write(): all or nothing. The promise resolves only once the browser has
 *   committed the transaction (durability "strict" by default: on disk), and
 *   only then are the changed stores announced. If anything fails, the
 *   transaction is rolled back and the caller gets a StorageError; a failure
 *   the browser only reports at commit (QuotaExceededError) is caught too.
 * - read(): one consistent view over the given stores.
 *
 * The work function may only await requests of its own transaction: an
 * await on anything else lets the browser commit the transaction early (the
 * IndexedDB rule). Prepare and validate data before, not inside.
 */
import type { IDBPDatabase, IDBPTransaction } from "idb"
import { StorageError, toStorageError, type RecordProblem } from "./errors"
import { formatKey, formatProblems, RECORD_CHECKS, type OpenManaDB, type StoreName, type StoreRecord } from "./schema"

export type ReadTransaction<S extends StoreName> = IDBPTransaction<OpenManaDB, S[], "readonly">
export type WriteTransaction<S extends StoreName> = IDBPTransaction<OpenManaDB, S[], "readwrite">

export interface WriteOptions {
  /** "strict" (default): committed means written to disk. "relaxed" suits caches that are downloaded again anyway. */
  readonly durability?: IDBTransactionDurability
}

export type ChangeListener = (stores: readonly StoreName[]) => void

export class LocalDatabase {
  readonly #db: IDBPDatabase<OpenManaDB>
  readonly #changed: ChangeListener

  constructor(db: IDBPDatabase<OpenManaDB>, changed: ChangeListener = () => undefined) {
    this.#db = db
    this.#changed = changed
  }

  get version(): number {
    return this.#db.version
  }

  async read<S extends StoreName, T>(stores: readonly S[], work: (transaction: ReadTransaction<S>) => Promise<T>): Promise<T> {
    const operation = `reading ${stores.join(", ")}`
    let transaction: ReadTransaction<S>
    try {
      transaction = this.#db.transaction([...stores], "readonly")
    } catch (error) {
      throw toStorageError(error, operation)
    }
    try {
      const result = await work(transaction)
      await transaction.done
      return result
    } catch (error) {
      transaction.done.catch(() => undefined)
      throw toStorageError(error instanceof StorageError ? error : (transactionError(transaction) ?? error), operation)
    }
  }

  async write<S extends StoreName, T>(
    stores: readonly S[],
    work: (transaction: WriteTransaction<S>) => Promise<T>,
    options: WriteOptions = {},
  ): Promise<T> {
    const operation = `writing ${stores.join(", ")}`
    let transaction: WriteTransaction<S>
    try {
      transaction = this.#db.transaction([...stores], "readwrite", { durability: options.durability ?? "strict" })
    } catch (error) {
      throw toStorageError(error, operation)
    }
    let result: T
    try {
      result = await work(transaction)
    } catch (error) {
      // Roll back whatever the work did so far (if the browser has not already).
      transaction.done.catch(() => undefined)
      const own = transactionError(transaction)
      try {
        transaction.abort()
      } catch {
        // Already aborted by the failed request.
      }
      throw toStorageError(error instanceof StorageError ? error : (own ?? error), operation)
    }
    try {
      await transaction.done
    } catch (error) {
      throw toStorageError(error, operation)
    }
    this.#changed(stores)
    return result
  }

  close(): void {
    this.#db.close()
  }
}

/**
 * The error the browser aborted a transaction with, if it did (QuotaExceededError,
 * ConstraintError …): it says more than the AbortError of the requests still
 * pending at that moment.
 */
function transactionError(transaction: { readonly error: DOMException | null }): DOMException | null {
  try {
    const error = transaction.error
    return error !== null && error.name !== "AbortError" ? error : null
  } catch {
    // Old implementations throw while the transaction is still running.
    return null
  }
}

/**
 * Requests placed without awaiting each one (many writes in one transaction,
 * then one wait). If placing a request throws, the transaction aborts and
 * the requests already placed reject: that is handled here, so it never
 * surfaces as an unhandled rejection; the caller sees the error that stopped it.
 */
export class PendingRequests {
  readonly #requests: Promise<unknown>[] = []

  add(request: Promise<unknown>): void {
    request.catch(() => undefined)
    this.#requests.push(request)
  }

  async all(): Promise<void> {
    await Promise.all(this.#requests)
  }
}

/** A stored record that does not match its schema (kept as it is, shown as damaged). */
export interface InvalidRecord {
  readonly store: StoreName
  readonly key: string
  readonly problems: readonly RecordProblem[]
}

export interface CheckedRecords<T> {
  readonly records: readonly T[]
  readonly invalid: readonly InvalidRecord[]
}

/** Splits what a store returned into valid records and damaged ones (keys and values from the same transaction). */
export function sortOut<S extends StoreName>(store: S, keys: readonly IDBValidKey[], values: readonly unknown[]): CheckedRecords<StoreRecord<S>> {
  const records: StoreRecord<S>[] = []
  const invalid: InvalidRecord[] = []
  values.forEach((value, i) => {
    const problems = RECORD_CHECKS[store](value)
    if (problems === null) records.push(value as StoreRecord<S>)
    else invalid.push({ store, key: formatKey(keys[i] ?? "?"), problems })
  })
  return { records, invalid }
}

/** Throws invalid-record unless `value` is a valid record of `store` (checked before anything is written). */
export function assertRecord<S extends StoreName>(store: S, value: unknown): StoreRecord<S> {
  const problems = RECORD_CHECKS[store](value)
  if (problems !== null) {
    throw new StorageError("invalid-record", `a ${store} record does not match the schema: ${formatProblems(problems)}`, { problems })
  }
  return value as StoreRecord<S>
}
