// Types for oryx-sdk.js v1.0.0 (master copy: oryx-games/shared/oryx-sdk.d.ts). Copy unchanged next to oryx-sdk.js.

export declare const ORYX_SDK_VERSION: string

export type OryxStatus = 'inactive' | 'guest' | 'connected' | 'disabled' | 'offline' | 'error'

/** What pull() did. On 'pulled' and 'merged' the game must re-read its local save. */
export type OryxPullResult =
  | 'inactive' | 'guest' | 'disabled' | 'offline' | 'error' | 'timeout'
  | 'none' | 'pushed' | 'pulled' | 'merged' | 'removed' | 'later' | 'newer-version'
  | 'too_large' | 'empty' | 'revoked' | string

export interface OryxSide {
  device: string
  at: string | null
  summary: Record<string, string | number> | null
  playtime: number | null
}

export interface OryxConflict {
  kind: 'conflict' | 'deleted'
  slot: string
  cloud: OryxSide
  local: OryxSide
  cloudText: string
  localText: string
}

export interface OryxSlotConfig<T> {
  /** The game's save schema version (never lower a cloud save written by a newer version). */
  schemaVersion: number
  /** Current local save of this slot, or null when the slot is empty. Must be plain JSON. */
  read(): T | null | undefined | Promise<T | null | undefined>
  /** Replace the local save with data from the cloud. Must NOT call markChanged(). */
  write(data: T): void | Promise<void>
  /** Delete the local save (offered when the save was deleted on another device). */
  remove?(): void | Promise<void>
  /** Bring an older cloud save up to schemaVersion (the game's own migration chain). */
  migrate?(data: unknown, fromVersion: number): T | Promise<T>
  /** Tiny summary for ORYX and the conflict dialog, e.g. { Level: 18 }. Max 2 KB. */
  summarize?(data: T): Record<string, string | number> | null
  /** Play time in ms stored in the save, if the game counts it. */
  playtime?(data: T): number | null
  /** Mergeable data (e.g. decks): merge instead of asking the player. */
  merge?(local: T, cloud: T): T | Promise<T>
}

export interface OryxSlotState {
  base: number
  hash: string | null
  dirty: boolean
  conflict: boolean
  pendingDelete: boolean
}

export interface OryxSlot {
  readonly name: string
  readonly state: OryxSlotState
  /** Call at start, before the game reads its local save. Never throws. */
  pull(options?: { timeoutMs?: number }): Promise<OryxPullResult>
  /** Call after every local save. Uploads are collected (15–60 s). */
  markChanged(): void
  /** Upload now if something waits (page hidden, before leaving). */
  flush(options?: { keepalive?: boolean }): Promise<string>
  /** The player deleted this save locally: mark it deleted in the cloud. */
  remove(): Promise<string>
}

export interface OryxOptions {
  gameId: string
  supabaseUrl: string
  publishableKey: string
  /** Exact redirect URI registered for the game's OAuth client, e.g. 'https://threnfall.vercel.app/'. */
  redirectUri: string
  /** 'de' (default) or 'en' for the built-in texts; a function is asked each time. */
  locale?: string | (() => string)
  /** Own conflict UI instead of the built-in dialog. Return 'cloud' | 'local' | 'later' ('keep' | 'delete' for kind 'deleted'). */
  onConflict?(conflict: OryxConflict): string | Promise<string>
  /** false: no built-in dialog (conflicts wait as 'later' unless onConflict decides). */
  ui?: boolean
  /** false: stay inactive (e.g. a demo or test mode). */
  enabled?: boolean
  debounceMs?: number
  maxWaitMs?: number
  requestTimeoutMs?: number
  /** Test hook: replace window, fetch, storage, clock … */
  env?: Record<string, unknown>
}

export interface Oryx {
  readonly version: string
  readonly status: OryxStatus
  readonly user: { id: string | null; email: string | null } | null
  readonly lastSyncAt: number | null
  /** Call once at start. 'redirecting' = connecting, the page is about to leave: stop booting. */
  ready(): Promise<OryxStatus | 'redirecting'>
  /** Start connecting (menu button). Leaves the page. */
  connect(): Promise<boolean>
  /** Forget the connection on this device (local saves stay). */
  disconnect(): Promise<void>
  slot<T>(name: string, config: OryxSlotConfig<T>): OryxSlot
  flush(options?: { keepalive?: boolean }): Promise<unknown>
  onStatus(listener: (status: OryxStatus) => void): () => void
  /** One line for the game's menu, '' when inactive. */
  describe(): string
  /** Built-in texts: 'connect', 'disconnect', … */
  text(name: string, values?: Record<string, string | number>): string
  readonly playtime: { start(): void; pause(): void; resume(): void; report(options?: { keepalive?: boolean }): Promise<void>; readonly pending: number }
}

export declare function createOryx(options: OryxOptions): Oryx
export declare function canonicalJson(value: unknown): string
