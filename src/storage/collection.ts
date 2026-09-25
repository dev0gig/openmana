/*
 * The player's collection as one JSON document - what the ORYX cloud keeps in
 * its slot "collection" (src/cloud) - and the rule that brings two of them
 * together. Storage only: reading the document from the local database and
 * applying one to it. Moving it is src/cloud's job; the storage layer never
 * talks to a network.
 *
 * The document (schema: CollectionDocument; its version = SCHEMA_VERSION):
 *
 *   { schemaVersion, decks: DeckRecord[], deckTombstones: DeckTombstoneRecord[], settings: SettingRecord[] }
 *
 * - decks: every valid deck. A damaged one stays on this device as it is
 *   (shown as damaged, never dropped) and is not sent.
 * - deckTombstones: the deletion marks (deleteDeck writes one for every
 *   deleted deck), so a merge never brings back a deck deleted on one device.
 *   Marks older than TOMBSTONE_DAYS are dropped whenever marks are written.
 * - settings: the preferences shared between the player's devices - every
 *   setting except display.* (card language, less motion), which belong to
 *   the device. Keys this version does not know (a newer version's) travel
 *   along, like in a backup.
 * Never the caches (card catalog, printings, engine), recorded matches or the
 * database's metadata. Sorted by id and key, so equal content is equal JSON
 * (the cloud compares hashes of it).
 *
 * The merge (mergeCollections) gives the same result on every device and in
 * either direction:
 * - a deck or a setting: the copy with the newer updatedAt wins; at the same
 *   time the one whose canonical JSON sorts last (a fixed choice, so that
 *   both devices make the same one);
 * - a deletion mark removes its deck unless the deck changed after the
 *   deletion (updatedAt > deletedAt; at the very same moment the deletion
 *   wins); a deck that survives drops the mark;
 * - nothing else is ever removed: a deck only one side has stays.
 * Like merging a backup (backup.ts), this goes by the times the devices
 * wrote; whether a merge is needed at all the cloud decides by its revisions
 * (src/cloud).
 */
import { assertRecord, PendingRequests, sortOut, type LocalDatabase, type ReadTransaction } from "./database"
import { StorageError, type RecordProblem } from "./errors"
import { SCHEMA_VERSION } from "./generated/constants"
import type { DeckRecord, DeckTombstoneRecord, SettingRecord } from "./generated/records"
import { validateCollectionDocument } from "./generated/validators.js"
import { MIGRATIONS, upgradeRecord } from "./migrations"
import { formatProblems, problemsOf, RECORD_CHECKS, type StoreRecord } from "./schema"

/** How long a deletion mark is kept. A device that was away longer may bring a deck deleted meanwhile back. */
export const TOMBSTONE_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/** The stores the collection is made of (one transaction reads or writes all three). */
export const COLLECTION_STORES = ["decks", "deckTombstones", "settings"] as const
export type CollectionStore = (typeof COLLECTION_STORES)[number]

/** A checked collection: valid records of the current schema version, sorted. Plain JSON. */
export interface Collection {
  readonly schemaVersion: number
  readonly decks: readonly DeckRecord[]
  readonly deckTombstones: readonly DeckTombstoneRecord[]
  readonly settings: readonly SettingRecord[]
}

const EMPTY: Collection = { schemaVersion: SCHEMA_VERSION, decks: [], deckTombstones: [], settings: [] }

/** A setting of this device that is never synced: display.* (card language, less motion). */
export function isDeviceSetting(key: string): boolean {
  return key === "display" || key.startsWith("display.")
}

/** The oldest deletion time still kept at `now` (marks before it are dropped). */
export function tombstoneCutoff(now: Date): string {
  return new Date(now.getTime() - TOMBSTONE_DAYS * DAY_MS).toISOString()
}

/** JSON with every object's keys sorted: equal content gives equal text, whatever order its keys were written in. */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map((item: unknown) => stableJson(item)).join(",")}]`
  const object = value as Record<string, unknown>
  const keys = Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** The copy that wins: the newer change; at the same time the one whose canonical JSON sorts last. */
function winner<T extends { readonly updatedAt: string }>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  return stableJson(a) >= stableJson(b) ? a : b
}

/**
 * Two collections as one (see the head comment). The same result whichever
 * side is which, and merging the result again changes nothing. `now` only
 * drops deletion marks older than TOMBSTONE_DAYS - after they removed what
 * they could.
 */
export function mergeCollections(a: Collection, b: Collection, now: Date): Collection {
  const deletedAt = new Map<string, string>()
  for (const mark of [...a.deckTombstones, ...b.deckTombstones]) {
    const known = deletedAt.get(mark.id)
    if (known === undefined || mark.deletedAt > known) deletedAt.set(mark.id, mark.deletedAt)
  }
  const decks = new Map<string, DeckRecord>()
  for (const deck of [...a.decks, ...b.decks]) {
    const known = decks.get(deck.id)
    decks.set(deck.id, known === undefined ? deck : winner(known, deck))
  }
  for (const [id, deck] of decks) {
    const mark = deletedAt.get(id)
    if (mark === undefined) continue
    // Deleted after its last change (or at that very moment): gone. Changed after the deletion: the change wins.
    if (mark >= deck.updatedAt) decks.delete(id)
    else deletedAt.delete(id)
  }
  const settings = new Map<string, SettingRecord>()
  for (const setting of [...a.settings, ...b.settings]) {
    if (isDeviceSetting(setting.key)) continue
    const known = settings.get(setting.key)
    settings.set(setting.key, known === undefined ? setting : winner(known, setting))
  }
  const cutoff = tombstoneCutoff(now)
  return {
    schemaVersion: SCHEMA_VERSION,
    decks: [...decks.values()].sort((x, y) => byText(x.id, y.id)),
    deckTombstones: [...deletedAt]
      .filter(([, at]) => at >= cutoff)
      .map(([id, at]) => ({ id, deletedAt: at }))
      .sort((x, y) => byText(x.id, y.id)),
    settings: [...settings.values()].sort((x, y) => byText(x.key, y.key)),
  }
}

function isDeviceSettingRecord(value: Record<string, unknown>): boolean {
  return typeof value["key"] === "string" && isDeviceSetting(value["key"])
}

/**
 * A collection that came from elsewhere (the cloud), checked like a backup:
 * the container, its version (a newer one is refused), then every record -
 * upgraded from the document's version with the database's own migrations -
 * against its schema. Settings of a device (display.*) are left out. Throws
 * invalid-record naming every problem; nothing is ever written from a
 * collection that fails.
 */
export function checkCollection(value: unknown): Collection {
  if (!validateCollectionDocument(value)) {
    const problems = problemsOf(validateCollectionDocument)
    throw new StorageError("invalid-record", `not a collection document: ${formatProblems(problems)}`, { problems })
  }
  const version = value.schemaVersion
  if (version > SCHEMA_VERSION) {
    throw new StorageError("invalid-record", `the collection has data version ${version}; this app knows up to ${SCHEMA_VERSION}`)
  }
  const problems: RecordProblem[] = []
  function records<S extends CollectionStore>(store: S, list: readonly Record<string, unknown>[]): StoreRecord<S>[] {
    return list.map((raw, i) => {
      const record = upgradeRecord(store, raw, version, SCHEMA_VERSION, MIGRATIONS)
      for (const problem of RECORD_CHECKS[store](record) ?? []) {
        problems.push({ path: `/${store}/${i}${problem.path === "/" ? "" : problem.path}`, message: problem.message })
      }
      return record as StoreRecord<S>
    })
  }
  const collection: Collection = {
    schemaVersion: SCHEMA_VERSION,
    decks: records("decks", value.decks),
    deckTombstones: records("deckTombstones", value.deckTombstones),
    settings: records(
      "settings",
      value.settings.filter((setting) => !isDeviceSettingRecord(setting)),
    ),
  }
  if (problems.length > 0) {
    throw new StorageError("invalid-record", `the collection holds records that do not match the schema: ${formatProblems(problems)}`, { problems })
  }
  return collection
}

/** The collection as this database holds it (valid records only; a damaged one stays where it is). */
async function localCollection(transaction: ReadTransaction<CollectionStore>): Promise<Collection> {
  const decks = transaction.objectStore("decks")
  const marks = transaction.objectStore("deckTombstones")
  const settings = transaction.objectStore("settings")
  const [deckKeys, deckValues, markKeys, markValues, settingKeys, settingValues] = await Promise.all([
    decks.getAllKeys(),
    decks.getAll(),
    marks.getAllKeys(),
    marks.getAll(),
    settings.getAllKeys(),
    settings.getAll(),
  ])
  return {
    schemaVersion: SCHEMA_VERSION,
    decks: [...sortOut("decks", deckKeys, deckValues).records].sort((x, y) => byText(x.id, y.id)),
    deckTombstones: [...sortOut("deckTombstones", markKeys, markValues).records].sort((x, y) => byText(x.id, y.id)),
    settings: sortOut("settings", settingKeys, settingValues)
      .records.filter((setting) => !isDeviceSetting(setting.key))
      .sort((x, y) => byText(x.key, y.key)),
  }
}

/**
 * This device's collection, read in one transaction; null when there is
 * nothing to sync (no deck, no deletion mark, no shared setting). The same
 * database state always gives the same document (nothing here depends on
 * the clock).
 */
export async function readCollection(db: LocalDatabase): Promise<Collection | null> {
  const collection = await db.read(COLLECTION_STORES, (transaction) => localCollection(transaction))
  const empty = collection.decks.length === 0 && collection.deckTombstones.length === 0 && collection.settings.length === 0
  return empty ? null : collection
}

export interface ApplyResult {
  /** Records written or deleted on this device. */
  readonly changes: number
  /**
   * This device keeps something the applied collection lacks (a deck only it
   * has, a newer copy, a newer deletion): the other side should get it.
   */
  readonly keptLocal: boolean
}

/**
 * Brings a collection from elsewhere (the cloud) into the local database: the
 * merge of this device's collection and that one (the rule above), in one
 * transaction - all or nothing, decided inside it, so a change made meanwhile
 * (another tab, the player) is merged, never overwritten. Checked first
 * (checkCollection: nothing is written from a collection that fails).
 * Removes a deck only for a deletion mark; a damaged record is replaced by a
 * valid copy of it, never deleted; display.* settings are never touched.
 */
export async function applyCollection(db: LocalDatabase, value: unknown, options: { readonly now?: () => Date } = {}): Promise<ApplyResult> {
  const incoming = checkCollection(value)
  const now = (options.now ?? (() => new Date()))()
  const arrived = stableJson(mergeCollections(incoming, EMPTY, now))
  return db.write(COLLECTION_STORES, async (transaction) => {
    const local = await localCollection(transaction as unknown as ReadTransaction<CollectionStore>)
    const target = mergeCollections(local, incoming, now)
    const requests = new PendingRequests()
    let changes = 0
    const decks = transaction.objectStore("decks")
    const localDecks = new Map(local.decks.map((deck) => [deck.id, stableJson(deck)]))
    const keptDecks = new Set(target.decks.map((deck) => deck.id))
    for (const deck of target.decks) {
      if (localDecks.get(deck.id) === stableJson(deck)) continue
      requests.add(decks.put(assertRecord("decks", deck)))
      changes++
    }
    for (const id of localDecks.keys()) {
      if (keptDecks.has(id)) continue
      requests.add(decks.delete(id))
      changes++
    }
    const marks = transaction.objectStore("deckTombstones")
    const localMarks = new Map(local.deckTombstones.map((mark) => [mark.id, mark.deletedAt]))
    const keptMarks = new Set(target.deckTombstones.map((mark) => mark.id))
    for (const mark of target.deckTombstones) {
      if (localMarks.get(mark.id) === mark.deletedAt) continue
      requests.add(marks.put(assertRecord("deckTombstones", mark)))
      changes++
    }
    for (const id of localMarks.keys()) {
      if (keptMarks.has(id)) continue
      requests.add(marks.delete(id))
      changes++
    }
    const settings = transaction.objectStore("settings")
    const localSettings = new Map(local.settings.map((setting) => [setting.key, stableJson(setting)]))
    for (const setting of target.settings) {
      if (localSettings.get(setting.key) === stableJson(setting)) continue
      requests.add(settings.put(assertRecord("settings", setting)))
      changes++
    }
    await requests.all()
    return { changes, keptLocal: stableJson(target) !== arrived }
  })
}

/** The short summary ORYX shows for the collection (at most a few numbers). */
export function summarizeCollection(collection: Collection): Record<string, number> {
  return { Decks: collection.decks.length }
}
