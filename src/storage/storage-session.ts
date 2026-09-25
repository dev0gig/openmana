/*
 * The app's handle on the local database: opens it once for the whole app,
 * says what state it is in, and tells the views when data changed - in this
 * tab and in other tabs of the app (BroadcastChannel).
 *
 * States: opening → ready, or failed (with the reason), or blocked while
 * another tab still holds an older version (it continues by itself). A ready
 * connection can be lost: another tab upgrades or resets the database, or
 * the browser closes it (site data cleared) - then the state says so, and
 * nothing keeps working on a stale connection.
 *
 * Framework-free on purpose (tests drive it directly); React reads it
 * through useSyncExternalStore (storage-context.tsx).
 */
import { deleteDB, type IDBPDatabase } from "idb"
import { LocalDatabase } from "./database"
import { StorageError, toStorageError } from "./errors"
import type { AppVersion } from "./generated/records"
import { MIGRATIONS, type Migration } from "./migrations"
import { openWithMigrations } from "./open"
import { DATABASE_NAME, STORE_LAYOUT, STORE_NAMES, type OpenManaDB, type StoreLayout, type StoreName } from "./schema"

export type ConnectionLoss = "upgraded" | "deleted" | "terminated"

export type StorageSnapshot =
  | { readonly status: "opening" }
  /** Another tab still uses an older version; the open continues once it lets go. */
  | { readonly status: "blocked" }
  | { readonly status: "ready"; readonly database: LocalDatabase }
  | { readonly status: "failed"; readonly error: StorageError }
  | { readonly status: "closed"; readonly reason: ConnectionLoss; readonly error: StorageError }

export interface StorageSessionOptions {
  readonly app: AppVersion
  readonly name?: string
  readonly migrations?: readonly Migration[]
  readonly layout?: Readonly<Record<string, StoreLayout>>
  readonly now?: () => Date
  /** Default: a BroadcastChannel if the browser has one. */
  readonly channel?: () => BroadcastChannel | null
}

const CHANNEL_NAME = "openmana-storage"

interface ChangeMessage {
  readonly type: "changed"
  readonly stores: readonly StoreName[]
}

function isChangeMessage(value: unknown): value is ChangeMessage {
  if (value === null || typeof value !== "object") return false
  const message = value as { type?: unknown; stores?: unknown }
  return message.type === "changed" && Array.isArray(message.stores) && message.stores.every((store) => (STORE_NAMES as readonly unknown[]).includes(store))
}

const LOSS_MESSAGES: Readonly<Record<ConnectionLoss, string>> = {
  upgraded: "another tab opened a newer version of the database; this connection was closed",
  deleted: "another tab deleted the database; this connection was closed",
  terminated: "the browser closed the database connection",
}

type Listener = () => void

/** Where a change was made: a write of this tab, or one another tab of the app announced. */
export type ChangeOrigin = "this-tab" | "other-tab"

export type StoreChangeListener = (origin: ChangeOrigin) => void

export class StorageSession {
  readonly #options: StorageSessionOptions
  readonly #listeners = new Set<Listener>()
  readonly #changeListeners = new Set<{ readonly stores: ReadonlySet<StoreName>; readonly listener: StoreChangeListener }>()
  #snapshot: StorageSnapshot = { status: "opening" }
  #database: LocalDatabase | null = null
  #channel: BroadcastChannel | null = null
  /** Counts opens and closes; a connection that arrives for an older attempt is closed again. */
  #attempt = 0
  #opening = false

  constructor(options: StorageSessionOptions) {
    this.#options = options
  }

  get name(): string {
    return this.#options.name ?? DATABASE_NAME
  }

  getSnapshot = (): StorageSnapshot => this.#snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /**
   * Calls `listener` whenever one of `stores` changed (a committed write here
   * or in another tab), saying which: this tab's writes are the ones this tab
   * uploads to the ORYX cloud (src/cloud); another tab uploads its own.
   */
  subscribeChanges(stores: readonly StoreName[], listener: StoreChangeListener): () => void {
    const entry = { stores: new Set(stores), listener }
    this.#changeListeners.add(entry)
    return () => {
      this.#changeListeners.delete(entry)
    }
  }

  /** Opens the database (again). Does nothing while opening or ready. */
  open(): void {
    if (this.#opening || this.#snapshot.status === "ready") return
    const attempt = ++this.#attempt
    this.#opening = true
    this.#listenToOtherTabs()
    this.#set({ status: "opening" })
    openWithMigrations({
      name: this.name,
      migrations: this.#options.migrations ?? MIGRATIONS,
      layout: this.#options.layout ?? STORE_LAYOUT,
      app: this.#options.app,
      ...(this.#options.now ? { now: this.#options.now } : {}),
      onBlocked: () => {
        if (attempt === this.#attempt) this.#set({ status: "blocked" })
      },
      onVersionChange: (newVersion) => this.#lose(attempt, newVersion === null ? "deleted" : "upgraded"),
      onTerminated: () => this.#lose(attempt, "terminated"),
    }).then(
      (db) => {
        if (attempt !== this.#attempt) {
          db.close()
          return
        }
        this.#opening = false
        const database = new LocalDatabase(db as unknown as IDBPDatabase<OpenManaDB>, (stores) => this.#announce(stores, true))
        this.#database = database
        this.#set({ status: "ready", database })
      },
      (error: unknown) => {
        if (attempt !== this.#attempt) return
        this.#opening = false
        this.#set({ status: "failed", error: toStorageError(error, "opening the local database", "open") })
      },
    )
  }

  /** Closes the connection (the app goes away); open() starts again. */
  close(): void {
    this.#attempt++
    this.#opening = false
    this.#database?.close()
    this.#database = null
    this.#channel?.close()
    this.#channel = null
    this.#set({ status: "opening" })
  }

  /** After a failure: try again. */
  retry(): void {
    if (this.#snapshot.status === "failed" || this.#snapshot.status === "closed") this.open()
  }

  /**
   * Deletes the whole local database and opens a new, empty one. Only after
   * the player confirmed it; other tabs lose their connection and say so.
   */
  async reset(): Promise<void> {
    this.#attempt++
    this.#opening = false
    this.#database?.close()
    this.#database = null
    this.#set({ status: "opening" })
    try {
      await deleteDB(this.name, { blocked: () => this.#set({ status: "blocked" }) })
    } catch (error) {
      this.#set({ status: "failed", error: toStorageError(error, "deleting the local database", "open") })
      return
    }
    this.open()
  }

  #lose(attempt: number, reason: ConnectionLoss): void {
    if (attempt !== this.#attempt) return
    // The connection is closed already (open.ts) or gone; a new attempt would get a fresh one.
    this.#attempt++
    this.#opening = false
    this.#database = null
    this.#set({ status: "closed", reason, error: new StorageError("closed", LOSS_MESSAGES[reason]) })
  }

  #listenToOtherTabs(): void {
    if (this.#channel !== null) return
    const create = this.#options.channel ?? (() => (typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME)))
    const channel = create()
    if (channel === null) return
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isChangeMessage(event.data) && this.#snapshot.status === "ready") this.#announce(event.data.stores, false)
    }
    this.#channel = channel
  }

  #announce(stores: readonly StoreName[], broadcast: boolean): void {
    const origin: ChangeOrigin = broadcast ? "this-tab" : "other-tab"
    for (const entry of Array.from(this.#changeListeners)) {
      if (stores.some((store) => entry.stores.has(store))) entry.listener(origin)
    }
    if (broadcast) {
      try {
        this.#channel?.postMessage({ type: "changed", stores } satisfies ChangeMessage)
      } catch {
        // Other tabs refresh on their next read; this tab is up to date.
      }
    }
  }

  #set(snapshot: StorageSnapshot): void {
    this.#snapshot = snapshot
    for (const listener of Array.from(this.#listeners)) listener()
  }
}
