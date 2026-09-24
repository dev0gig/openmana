/*
 * The deck library in the local database. Import (prompt 09) and the library
 * screens (prompt 10) build on these; a deck is checked against its schema
 * before it is written, and a damaged stored deck is reported, never dropped.
 */
import { sortOut, assertRecord, type CheckedRecords, type LocalDatabase } from "./database"
import type { DeckRecord } from "./generated/records"

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

/** Writes a deck (new or updated). Throws invalid-record before touching the database if it does not match the schema. */
export async function saveDeck(db: LocalDatabase, deck: DeckRecord): Promise<void> {
  const record = assertRecord("decks", deck)
  await db.write(["decks"], async (transaction) => {
    await transaction.objectStore("decks").put(record)
  })
}

/** Cards in a list of entries (4 × Forest + 1 × … = 5). */
export function cardCount(entries: readonly { readonly count: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0)
}
