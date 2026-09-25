/*
 * Everything that can go wrong with the local data, as one error type the UI
 * can explain (German wording: storage-labels.ts). The browser's errors
 * (DOMException names) are mapped here and nowhere else.
 */

export type StorageErrorCode =
  /** This page cannot use IndexedDB at all (missing, or site data blocked). */
  | "unsupported"
  /** The database was upgraded by a newer OpenMana version (VersionError). */
  | "version-too-new"
  /** The database has the expected version but not the expected stores and indexes. */
  | "schema-mismatch"
  /** A migration failed; the database stays at its old version, unchanged. */
  | "upgrade-failed"
  /** The browser could not open the database (damaged files, disk). */
  | "open-failed"
  /** The connection is gone: another tab upgraded or deleted the database, or the browser closed it. */
  | "closed"
  /** The browser refused to store more (QuotaExceededError); nothing of the write was stored. */
  | "quota-exceeded"
  /** A planned write does not fit into the space the browser reports; nothing was written. */
  | "insufficient-space"
  /** A record does not match its schema; it was not written. */
  | "invalid-record"
  /** The record to change is not there (any more): deleted meanwhile, e.g. in another tab. Nothing was written. */
  | "not-found"
  /** Any other failed read or write; nothing of a failed write was stored. */
  | "transaction-failed"
  /** A file is not a complete, readable OpenMana backup. */
  | "backup-invalid"
  /** A backup written by a newer OpenMana version. */
  | "backup-unsupported"

/** One problem of a record: where (JSON pointer) and what. */
export interface RecordProblem {
  readonly path: string
  readonly message: string
}

export class StorageError extends Error {
  readonly code: StorageErrorCode
  /** Technical detail for developers (browser error name and message …); null if there is none. */
  readonly detail: string | null
  /** Schema problems, for invalid records. */
  readonly problems: readonly RecordProblem[]

  constructor(
    code: StorageErrorCode,
    message: string,
    options: { readonly cause?: unknown; readonly detail?: string | null; readonly problems?: readonly RecordProblem[] } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = "StorageError"
    this.code = code
    this.detail = options.detail ?? (options.cause === undefined ? null : describeCause(options.cause))
    this.problems = options.problems ?? []
  }
}

/** "QuotaExceededError: …" for DOMExceptions and errors, the text for anything else. */
export function describeCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message ? `${cause.name}: ${cause.message}` : cause.name
  if (cause !== null && typeof cause === "object" && "name" in cause && typeof cause.name === "string") {
    const message = "message" in cause && typeof cause.message === "string" ? cause.message : ""
    return message ? `${cause.name}: ${message}` : cause.name
  }
  return String(cause)
}

function errorName(error: unknown): string | null {
  if (error !== null && typeof error === "object" && "name" in error && typeof error.name === "string") return error.name
  return null
}

/** Whether a database operation failed because the browser's storage is full. */
export function isQuotaError(error: unknown): boolean {
  return errorName(error) === "QuotaExceededError"
}

/**
 * The StorageError for whatever a database call threw. `operation` says what
 * was attempted (English, for the message); `phase` decides the fallback: a
 * failed open is "open-failed", a failed read or write "transaction-failed".
 */
export function toStorageError(error: unknown, operation: string, phase: "open" | "transaction" = "transaction"): StorageError {
  if (error instanceof StorageError) return error
  const name = errorName(error)
  switch (name) {
    case "QuotaExceededError":
      return new StorageError("quota-exceeded", `${operation}: the browser's storage for this site is full`, { cause: error })
    case "VersionError":
      return new StorageError("version-too-new", `${operation}: the database belongs to a newer OpenMana version`, { cause: error })
    case "SecurityError":
      return new StorageError("unsupported", `${operation}: the browser does not allow this page to store data`, { cause: error })
    case "InvalidStateError":
      // Thrown by transaction() once the connection is closing or closed.
      return new StorageError("closed", `${operation}: the database connection is closed`, { cause: error })
    case "NotFoundError":
      return new StorageError("schema-mismatch", `${operation}: an expected object store or index is missing`, { cause: error })
    case "DataCloneError":
    case "DataError":
      return new StorageError("invalid-record", `${operation}: the browser cannot store this value`, { cause: error })
    default:
      return phase === "open"
        ? new StorageError("open-failed", `${operation}: the browser could not open the database`, { cause: error })
        : new StorageError("transaction-failed", `${operation} failed`, { cause: error })
  }
}
