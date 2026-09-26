/*
 * OpenMana in the ORYX cloud: the player's collection (decks, deletion marks,
 * shared settings - src/storage/collection.ts) in the ORYX cloud's slot
 * "collection" (Supabase), next to the local database, which stays the source
 * of truth. The cloud is an addition the player connects explicitly (Bible
 * §15); every failure (offline, not connected, ORYX paused) leaves the local
 * data exactly as it is.
 *
 * All requests go through the ORYX SDK (./oryx-sdk.js, an unchanged copy of
 * oryx-games/shared/oryx-sdk.js - oryx-sdk.test.ts checks it). Its built-in
 * dialog is off (ui: false: OpenMana's UI is shadcn only); none is needed -
 * the collection is merged, never chosen (merge), and a collection marked
 * deleted in the cloud is kept here and uploaded again (OpenMana never deletes
 * it; a deletion there is never taken over silently).
 *
 * - Start: main.tsx awaits start() (oryx.ready(): the return from ORYX's
 *   consent page, connecting by itself when ORYX starts OpenMana with
 *   ?oryx_sync=1) before anything renders; "redirecting" means the page is
 *   leaving. Once the local database is open, one pull(): nothing to do,
 *   upload, download or merge. The pages do not wait for it - local data
 *   shows at once - and re-read whatever it changed (the storage session
 *   announces every write).
 * - Afterwards: every change this tab commits to the collection's stores asks
 *   the SDK to upload (markChanged: collected, at most every 15-60 s, flushed
 *   when the page is hidden) - unless the collection did not change (a
 *   display.* setting, the same values again): its hash is compared with the
 *   synced one first. Applying the cloud's collection never marks it changed
 *   (no endless round between devices), and changes of other tabs are theirs
 *   to upload.
 * - Only on OpenMana's real address (redirectUri's origin). Locally, in tests
 *   and previews the SDK stays "inactive": no request, nothing stored, and the
 *   settings card is not shown.
 */
import { applyCollection, checkCollection, COLLECTION_STORES, mergeCollections, readCollection, summarizeCollection, type Collection } from "@/storage/collection"
import type { LocalDatabase } from "@/storage/database"
import { StorageError, toStorageError } from "@/storage/errors"
import { SCHEMA_VERSION } from "@/storage/generated/constants"
import type { StorageSession } from "@/storage/storage-session"
import { canonicalJson, createOryx, type Oryx, type OryxNotice, type OryxOptions, type OryxPullResult, type OryxSlot, type OryxStatus } from "./oryx-sdk.js"

/** OpenMana's entry in the ORYX cloud (games.id 'openmana'). The publishable key is public by design, no secret. */
export const ORYX_OPTIONS: OryxOptions = {
  gameId: "openmana",
  supabaseUrl: "https://fellumrfugohnnvtxxye.supabase.co",
  publishableKey: "sb_publishable_PyrsaxhYoNHtFoGhR_cOzw_VXyjdadr",
  // Exactly as registered for OpenMana's OAuth client; the SDK is active only on this origin.
  redirectUri: "https://openmana.vercel.app/",
  locale: "de",
  // No SDK dialog (not shadcn): the collection is merged, a deletion in the cloud is answered below.
  ui: false,
  // OpenMana never deletes its collection in the cloud. Marked deleted anyway: keep it here and upload it again.
  onConflict: (conflict) => (conflict.kind === "deleted" ? "keep" : "later"),
}

/** The one slot OpenMana uses. */
export const COLLECTION_SLOT = "collection"

/** What went wrong in the last step of the sync (the settings card says it). */
export type CloudFailure =
  /** The cloud's collection failed its check (collection.ts): nothing of it was applied. */
  | { readonly kind: "cloud-invalid"; readonly error: StorageError }
  /** Applying it failed on this device (storage full, database closed …): nothing of it was applied. */
  | { readonly kind: "local"; readonly error: StorageError }
  /** Connecting could not start (ORYX unreachable, or OpenMana not registered there yet). */
  | { readonly kind: "connect" }

/**
 * What the return from ORYX's consent page brought (this page load's address
 * carried ORYX's answer): connected, the player declined, or connecting
 * failed. The app says it once (cloud-context.tsx), wherever the player lands.
 */
export type CloudReturn = "connected" | "declined" | "failed"

export type CloudPull =
  /** Waiting for the local database (and the SDK's start). */
  | { readonly state: "waiting" }
  | { readonly state: "running" }
  /** What the start's pull did (the SDK's answer: none, pushed, pulled, merged, offline, too_large …). */
  | { readonly state: "done"; readonly result: OryxPullResult }

export interface CloudSnapshot {
  readonly status: OryxStatus
  readonly pull: CloudPull
  readonly failure: CloudFailure | null
  /** Set when this page load is the return from ORYX's consent page. */
  readonly returned: CloudReturn | null
}

type Listener = () => void

export interface CloudSyncOptions {
  /** The clock of the merge (deletion marks expire after 90 days). */
  readonly now?: () => Date
  /** The page's address as it was loaded (default: location.href) - it carries ORYX's answer after connecting. */
  readonly address?: () => string
}

/** ORYX's answer in an address: the redirect back from its consent page carries state and code, or state and error. */
function answerIn(address: string): "code" | "declined" | "error" | null {
  let params: URLSearchParams
  try {
    params = new URL(address).searchParams
  } catch {
    return null
  }
  if (!params.has("state")) return null
  if (params.has("code")) return "code"
  if (params.get("error") === "access_denied") return "declined"
  return params.has("error") ? "error" : null
}

export class CloudSync {
  readonly #oryx: Oryx
  readonly #slot: OryxSlot
  readonly #now: () => Date
  readonly #address: () => string
  readonly #listeners = new Set<Listener>()
  #snapshot: CloudSnapshot
  #session: StorageSession | null = null
  #pullStarted = false
  /** The cloud's collection is being written: the change announcements are not the player's. */
  #applying = false
  /** The last download kept something only this device had (it goes to the cloud next). */
  #keptLocal = false

  constructor(oryx: Oryx, options: CloudSyncOptions = {}) {
    this.#oryx = oryx
    this.#now = options.now ?? (() => new Date())
    this.#address = options.address ?? (() => globalThis.location?.href ?? "")
    this.#snapshot = { status: oryx.status, pull: { state: "waiting" }, failure: null, returned: null }
    this.#slot = oryx.slot<Collection>(COLLECTION_SLOT, {
      schemaVersion: SCHEMA_VERSION,
      read: () => this.#read(),
      write: (collection) => this.#write(collection),
      merge: (local, cloud) => this.#merge(local, cloud),
      summarize: (collection) => summarizeCollection(collection),
    })
    oryx.onStatus(() => this.#update({}))
  }

  getSnapshot = (): CloudSnapshot => this.#snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /**
   * The SDK's short notices (oryx-sdk 1.1.0): a backup that failed, the cloud out of reach, offline with
   * changes waiting, and "backed up again" when it is over. OpenMana shows them itself as toasts
   * (cloud-context.tsx), since its SDK has no built-in UI (ui: false). Returns the unsubscribe.
   */
  onNotice = (listener: (notice: OryxNotice) => void): (() => void) => this.#oryx.onNotice(listener)

  /** The SDK's one line about the connection ("ORYX-Cloud: verbunden · gesichert vor 2 Min."); "" while inactive. */
  describe(): string {
    return this.#oryx.describe()
  }

  /**
   * Once, before the app renders: finishes connecting (the return from
   * ORYX's consent page) or starts it (?oryx_sync=1). "redirecting": the page
   * is about to leave - render nothing. Never throws.
   */
  async start(): Promise<OryxStatus | "redirecting"> {
    // Read before ready(): it cleans code and state out of the address.
    const answer = answerIn(this.#address())
    const status = await this.#oryx.ready()
    if (status === "redirecting" || answer === null) {
      this.#update({})
      return status
    }
    // Connected means the SDK now holds the player's tokens (whatever ORYX's sync switch says).
    const returned: CloudReturn = answer === "code" ? (this.#oryx.user !== null ? "connected" : "failed") : answer === "declined" ? "declined" : "failed"
    this.#update({ returned })
    return status
  }

  /**
   * Links the cloud to the app's local database: the start's pull once it is
   * open (once per page load), uploads after this tab's changes. Returns the
   * unlink (React effects, Strict Mode).
   */
  attach(session: StorageSession): () => void {
    this.#session = session
    const stopState = session.subscribe(() => this.#pullOnceOpen())
    const stopChanges = session.subscribeChanges(COLLECTION_STORES, (origin) => {
      if (origin === "this-tab") this.#changedHere()
    })
    this.#pullOnceOpen()
    return () => {
      stopState()
      stopChanges()
      if (this.#session === session) this.#session = null
    }
  }

  /** Leaves the page for ORYX's consent page (false - and a failure to show - if connecting cannot start). */
  async connect(): Promise<boolean> {
    this.#update({ failure: null })
    const leaving = await this.#oryx.connect()
    if (!leaving) this.#update({ failure: { kind: "connect" } })
    return leaving
  }

  /** Uploads what waits, then forgets the connection on this device. The data stays here; the cloud keeps its last collection. */
  async disconnect(): Promise<void> {
    await this.#oryx.flush().catch(() => undefined)
    await this.#oryx.disconnect()
    this.#update({ failure: null })
  }

  #database(): LocalDatabase | null {
    const snapshot = this.#session?.getSnapshot()
    return snapshot?.status === "ready" ? snapshot.database : null
  }

  #pullOnceOpen(): void {
    if (this.#pullStarted || this.#database() === null) return
    this.#pullStarted = true
    void this.#pull()
  }

  async #pull(): Promise<void> {
    this.#keptLocal = false
    this.#update({ pull: { state: "running" }, failure: null })
    const result = await this.#slot.pull()
    // A download kept what only this device has (applyCollection): the cloud gets it with the next upload.
    if (result === "pulled" && this.#keptLocal) this.#slot.markChanged()
    this.#update({ pull: { state: "done", result } })
  }

  /** The SDK's read: this device's collection. Nothing readable is nothing to upload (a download is merged with what is really there). */
  async #read(): Promise<Collection | null> {
    const database = this.#database()
    if (database === null) return null
    try {
      return await readCollection(database)
    } catch {
      return null
    }
  }

  /** The SDK's write: the cloud's collection merged into the local database (never replacing it). Must not mark a change. */
  async #write(collection: Collection): Promise<void> {
    const database = this.#database()
    try {
      if (database === null) throw new StorageError("closed", "the local database is not open")
      this.#applying = true
      const result = await applyCollection(database, collection, { now: this.#now })
      if (result.keptLocal) this.#keptLocal = true
    } catch (error) {
      this.#fail(error)
      throw error
    } finally {
      this.#applying = false
    }
  }

  /** The SDK's merge: both sides changed since the last sync (collection.ts, never a question to the player). */
  #merge(local: Collection, cloud: Collection): Collection {
    try {
      return mergeCollections(checkCollection(local), checkCollection(cloud), this.#now())
    } catch (error) {
      this.#fail(error)
      throw error
    }
  }

  #fail(error: unknown): void {
    const storageError = toStorageError(error, "syncing with the ORYX cloud")
    this.#update({ failure: { kind: storageError.code === "invalid-record" ? "cloud-invalid" : "local", error: storageError } })
  }

  #changedHere(): void {
    // The cloud's own collection being applied: nothing new to upload.
    if (this.#applying) return
    // Not connected: the SDK uploads nothing anyway (and a guest's changes are merged when connecting).
    if (this.#oryx.status === "inactive" || this.#oryx.user === null) return
    const slot = this.#slot
    void this.#hash().then(
      (hash) => {
        if (hash !== slot.state.hash) slot.markChanged()
      },
      () => slot.markChanged(),
    )
  }

  /** The hash the SDK keeps of a synced collection (the same canonical JSON, SHA-256); null when there is nothing to sync. */
  async #hash(): Promise<string | null> {
    const collection = await this.#read()
    if (collection === null) return null
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(collection)))
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  #update(change: Partial<Omit<CloudSnapshot, "status">>): void {
    this.#snapshot = { ...this.#snapshot, ...change, status: this.#oryx.status }
    for (const listener of Array.from(this.#listeners)) listener()
  }
}

/** The app's one CloudSync (main.tsx). */
export function createAppCloud(): CloudSync {
  return new CloudSync(createOryx(ORYX_OPTIONS))
}
