/*
 * The deck library in the local database. Import (prompt 09) and the library
 * screens (prompt 10) build on these; a deck is checked against its schema
 * before it is written, and a damaged stored deck is reported, never dropped.
 *
 * Changing a deck (rename, replace its cards) reads and writes it in one
 * transaction: a deck deleted meanwhile - in another tab, say - is never
 * brought back ("not-found"), and a damaged one is never overwritten with a
 * guess of what it was ("invalid-record"; the settings' check shows it).
 */
import { tombstoneCutoff } from "./collection"
import { StorageError } from "./errors"
import { sortOut, assertRecord, type CheckedRecords, type InvalidRecord, type LocalDatabase, type WriteTransaction } from "./database"
import type { DeckRecord } from "./generated/records"
import { RECORD_CHECKS } from "./schema"

const byName = new Intl.Collator("de-DE", { sensitivity: "base", numeric: true })

/** Every deck, sorted by name; damaged records separately. */
export async function listDecks(db: LocalDatabase): Promise<CheckedRecords<DeckRecord>> {
  const checked = await db.read(["decks"], async (transaction) => {
    const store = transaction.objectStore("decks")
    const [keys, values] = await Promise.all([store.getAllKeys(), store.getAll()])
    return sortOut("decks", keys, values)
  })
  return { records: [...checked.records].sort((a, b) => byName.compare(a.name, b.name)), invalid: checked.invalid }
}

export async function countDecks(db: LocalDatabase): Promise<number> {
  return db.read(["decks"], (transaction) => transaction.objectStore("decks").count())
}

/** One deck as the database holds it: there and valid, there but damaged, or not (any more) there. */
export type DeckLookup =
  | { readonly status: "found"; readonly deck: DeckRecord }
  | { readonly status: "damaged"; readonly record: InvalidRecord }
  | { readonly status: "missing" }

export async function getDeck(db: LocalDatabase, id: string): Promise<DeckLookup> {
  const value: unknown = await db.read(["decks"], (transaction) => transaction.objectStore("decks").get(id))
  if (value === undefined) return { status: "missing" }
  const checked = sortOut("decks", [id], [value])
  const deck = checked.records[0]
  if (deck !== undefined) return { status: "found", deck }
  return { status: "damaged", record: checked.invalid[0]! }
}

/** Writes a deck (new or updated). Throws invalid-record before touching the database if it does not match the schema. */
export async function saveDeck(db: LocalDatabase, deck: DeckRecord): Promise<void> {
  const record = assertRecord("decks", deck)
  await db.write(["decks"], async (transaction) => {
    await transaction.objectStore("decks").put(record)
  })
}

/** The stored deck, valid - inside a writing transaction (see the head comment). */
async function storedDeck(transaction: WriteTransaction<"decks">, id: string): Promise<DeckRecord> {
  const stored: unknown = await transaction.objectStore("decks").get(id)
  if (stored === undefined) throw new StorageError("not-found", `deck ${id} is not in the database`)
  return assertRecord("decks", stored)
}

/** Reads, changes and writes one deck in one transaction; the changed deck is checked before it is written. */
async function changeDeck(db: LocalDatabase, id: string, change: (deck: DeckRecord) => DeckRecord): Promise<DeckRecord> {
  return db.write(["decks"], async (transaction) => {
    const next = assertRecord("decks", change(await storedDeck(transaction, id)))
    await transaction.objectStore("decks").put(next)
    return next
  })
}

function deckName(name: string): string {
  const trimmed = name.trim()
  if (trimmed === "") throw new StorageError("invalid-record", "a deck needs a name")
  return trimmed
}

/** Gives a deck another name (trimmed, not empty); everything else stays. */
export async function renameDeck(db: LocalDatabase, id: string, name: string, now: () => Date = () => new Date()): Promise<DeckRecord> {
  const newName = deckName(name)
  const at = now().toISOString()
  return changeDeck(db, id, (deck) => ({ ...deck, name: newName, updatedAt: at }))
}

export interface DuplicateOptions {
  /** The copy's id (crypto.randomUUID()). */
  readonly id: string
  readonly name: string
  readonly now?: () => Date
}

/**
 * A copy of a deck under a new id and name: the same cards and the same
 * import (source.text and importedAt stay - the list it came from is the
 * same), created now.
 */
export async function duplicateDeck(db: LocalDatabase, id: string, options: DuplicateOptions): Promise<DeckRecord> {
  const name = deckName(options.name)
  const at = (options.now ?? (() => new Date()))().toISOString()
  return db.write(["decks"], async (transaction) => {
    const copy = assertRecord("decks", { ...(await storedDeck(transaction, id)), id: options.id, name, createdAt: at, updatedAt: at })
    // add, not put: an id that is already taken fails instead of replacing that deck.
    await transaction.objectStore("decks").add(copy)
    return copy
  })
}

/**
 * Replaces a deck's cards, format, name and import with those of `deck`
 * (a new import of its list); its id and creation stay. Fails with
 * not-found if the deck is gone.
 */
export async function replaceDeck(db: LocalDatabase, deck: DeckRecord): Promise<DeckRecord> {
  return changeDeck(db, deck.id, (stored) => ({ ...deck, createdAt: stored.createdAt }))
}

/**
 * Deletes a deck (valid or damaged). False if it was not there (deleted
 * meanwhile): the outcome is the same.
 *
 * In the same transaction it leaves a deletion mark (deck id and when), so
 * that merging the collection with the ORYX cloud does not bring the deck
 * back from another device (collection.ts) - for a record without a deck id
 * (a damaged one) there is nothing to mark. Marks older than TOMBSTONE_DAYS
 * are dropped here, so they never pile up.
 */
export async function deleteDeck(db: LocalDatabase, id: string, now: () => Date = () => new Date()): Promise<boolean> {
  const at = now()
  const mark = { id, deletedAt: at.toISOString() }
  const markable = RECORD_CHECKS.deckTombstones(mark) === null
  const cutoff = tombstoneCutoff(at)
  return db.write(["decks", "deckTombstones"], async (transaction) => {
    const store = transaction.objectStore("decks")
    const there = (await store.count(id)) > 0
    if (!there) return false
    await store.delete(id)
    const marks = transaction.objectStore("deckTombstones")
    if (markable) await marks.put(assertRecord("deckTombstones", mark))
    let cursor = await marks.openCursor()
    while (cursor) {
      const deletedAt: unknown = (cursor.value as { deletedAt?: unknown } | undefined)?.deletedAt
      // Only valid marks expire; a damaged one stays for the check to show (never dropped silently).
      if (RECORD_CHECKS.deckTombstones(cursor.value) === null && typeof deletedAt === "string" && deletedAt < cutoff) await cursor.delete()
      cursor = await cursor.continue()
    }
    return true
  })
}

/** Cards in a list of entries (4 × Forest + 1 × … = 5). */
export function cardCount(entries: readonly { readonly count: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0)
}
