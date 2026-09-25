/*
 * Everything that can go wrong with card data, as one error type the UI can
 * explain (German wording: card-labels.ts). Storage failures keep their
 * StorageError as the cause.
 */

export type CardDataErrorCode =
  /** This build has no card catalog (OPENMANA_CARDS=omit, or the dev server found none). */
  | "unavailable"
  /** This page cannot check or unpack the catalog (no Web Crypto or DecompressionStream: not a secure context, or an old browser). */
  | "unsupported"
  /** The catalog could not be downloaded (offline, HTTP error). */
  | "download-failed"
  /** What arrived is not the catalog the build names (size, SHA-256, format, schema, counts). */
  | "corrupt"
  /** Too little free space: the browser's estimate says so before anything is written, or it refused a write (QuotaExceededError). */
  | "insufficient-space"
  /** Writing to the local database failed otherwise (closed connection …). */
  | "storage"
  /** The player or the app stopped it. */
  | "aborted"
  /** Scryfall's API is not reachable or answered with an error. */
  | "scryfall-unreachable"
  /** Scryfall's API answered 429: OpenMana asked too often and pauses as Scryfall demands. */
  | "scryfall-rate-limited"
  /** Scryfall answered in a form OpenMana does not understand (src/cards/scryfall/scryfall.schema.json). */
  | "scryfall-format"

export class CardDataError extends Error {
  readonly code: CardDataErrorCode
  /** Technical detail for developers; null if there is none. */
  readonly detail: string | null

  constructor(code: CardDataErrorCode, message: string, options: { readonly cause?: unknown; readonly detail?: string | null } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = "CardDataError"
    this.code = code
    this.detail = options.detail ?? null
  }
}

export function isAbort(error: unknown): boolean {
  return (error instanceof CardDataError && error.code === "aborted") || (error instanceof DOMException && error.name === "AbortError")
}
