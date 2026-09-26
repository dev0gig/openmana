// Types for oryx-sdk.js v1.1.1 (master copy: oryx-games/shared/oryx-sdk.d.ts). Copy unchanged next to oryx-sdk.js.

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

/** A save that cannot be backed up right now (1.1.0). The connection itself may be fine. */
export interface OryxProblem {
  slot: string
  /** 'rejected', 'too_large', 'too_many_slots', 'download_failed', 'delete_failed', 'error' or a code of the cloud. */
  code: string
  /** Short reason in the game's language, e.g. 'vom Server abgelehnt'. */
  text: string
  /** Technical detail (HTTP status and message), for ORYX and diagnosis. */
  detail: string | null
  since: number
}

/** A short notice for the player (1.1.0). The built-in one shows it; with ui: false the game shows it itself. */
export interface OryxNotice {
  kind: 'failing' | 'error' | 'offline' | 'conflict' | 'recovered'
  text: string
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
  /** This slot's problem, or null (1.1.0). */
  readonly problem: OryxProblem | null
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
  /** First retry pause after a failed upload (default 15 s; doubles up to 5 min). */
  retryFirstMs?: number
  /** Test hook: replace window, fetch, storage, clock … */
  env?: Record<string, unknown>
}

export interface Oryx {
  readonly version: string
  readonly status: OryxStatus
  readonly user: { id: string | null; email: string | null } | null
  readonly lastSyncAt: number | null
  /** The first save that cannot be backed up right now, or null (1.1.0). `status` stays the connection state. */
  readonly problem: OryxProblem | null
  /** Call once at start. 'redirecting' = connecting, the page is about to leave: stop booting. */
  ready(): Promise<OryxStatus | 'redirecting'>
  /** Start connecting (menu button). Leaves the page. */
  connect(): Promise<boolean>
  /** Forget the connection on this device (local saves stay). */
  disconnect(): Promise<void>
  slot<T>(name: string, config: OryxSlotConfig<T>): OryxSlot
  flush(options?: { keepalive?: boolean }): Promise<unknown>
  /** Called when the connection or a problem changes: re-render the menu line with describe(). */
  onStatus(listener: (status: OryxStatus) => void): () => void
  /** Short notices (failing, unreachable, offline, conflict, recovered) – for games with ui: false (1.1.0). */
  onNotice(listener: (notice: OryxNotice) => void): () => void
  /** One line for the game's menu, '' when inactive. */
  describe(): string
  /** Built-in texts: 'connect', 'disconnect', … */
  text(name: string, values?: Record<string, string | number>): string
  /** Foreground time as one growing total per device and account (1.1.0); reported by the SDK itself. */
  readonly playtime: { start(): void; pause(): void; resume(): void; report(options?: { keepalive?: boolean }): Promise<void>; readonly pending: number; readonly total: number }
}

export declare function createOryx(options: OryxOptions): Oryx
export declare function canonicalJson(value: unknown): string
/** The extras sent next to a save, made safe for the database (whole ms, small flat summary, short label). */
export declare function saveExtras(extras: { summary?: unknown; playtime?: unknown; deviceLabel?: unknown }): {
  summary: Record<string, string | number | boolean> | null
  playtime: number | null
  deviceLabel: string | null
}
