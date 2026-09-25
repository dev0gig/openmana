/*
 * What the build tells the app about the card catalog it ships
 * (virtual:openmana-cards, written by vite/card-assets.ts). Shared by the
 * Vite plugin (Node) and the app (browser); types only.
 */

/** The catalog file is served content-addressed under cards/<id>/. */
export interface CardAssetsAvailable {
  readonly available: true
  /** First 16 hex digits of the catalog file's SHA-256. */
  readonly id: string
  /** Absolute path below the app's base URL. */
  readonly url: string
  /** The gzip file as served. */
  readonly bytes: number
  readonly sha256: string
  /** The JSON Lines inside (a host may send the file already decompressed). */
  readonly uncompressedBytes: number
  readonly uncompressedSha256: string
  readonly lines: number
  readonly schemaVersion: number
  readonly source: {
    /** When Scryfall made the bulk file the catalog comes from. */
    readonly updatedAt: string
    readonly uri: string
  }
  readonly forge: {
    readonly commit: string
    readonly cards: number
    readonly matched: number
    readonly forgeOnly: number
  }
  readonly counts: {
    readonly cards: number
    readonly germanText: number
    readonly germanImage: number
    readonly sets: number
    readonly forgeOnly: number
  }
  readonly builtAt: string
}

/**
 * - missing: the dev server found no catalog build (cards/build/dist).
 * - omitted: the build was made without card data on purpose (OPENMANA_CARDS=omit).
 */
export interface CardAssetsUnavailable {
  readonly available: false
  readonly reason: "missing" | "omitted"
  /** Technical detail for developers (English). */
  readonly detail: string
}

export type CardAssets = CardAssetsAvailable | CardAssetsUnavailable
