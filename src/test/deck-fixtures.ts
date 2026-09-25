/*
 * Decks for the library's tests, saved exactly as the import saves them: a
 * list of src/decks/fixtures (or any text) through the parser, the resolver
 * and the plan, against the small real test catalog (catalog-fixtures.ts,
 * installed into the test database first).
 */
import fs from "node:fs"
import path from "node:path"
import { parseArenaDeckList } from "@/decks/arena-list"
import { deckRecordFrom, planDeck } from "@/decks/deck-plan"
import { resolveDeckList, type ResolveOptions } from "@/decks/deck-resolve"
import type { LocalDatabase } from "@/storage/database"
import type { DeckRecord } from "@/storage/generated/records"
import { uuid } from "./storage-fixtures"

export function deckList(name: string): string {
  return fs.readFileSync(path.resolve(import.meta.dirname, "../decks/fixtures", name), "utf8")
}

export interface ImportOptions extends ResolveOptions {
  readonly id?: string
  readonly name?: string
  readonly now?: string
  /** Line numbers to leave out. */
  readonly leftOut?: ReadonlySet<number>
}

/** The DeckRecord the import saves for `text` (throws if a line is still open). Not written: saveDeck does that. */
export async function importedDeck(db: LocalDatabase, text: string, options: ImportOptions = {}): Promise<DeckRecord> {
  const list = parseArenaDeckList(text)
  const report = await resolveDeckList(db, list, options)
  return deckRecordFrom(planDeck(report, options.leftOut), {
    id: options.id ?? uuid(),
    name: options.name ?? list.name ?? "Test-Deck",
    text,
    now: options.now ?? "2026-09-25T09:00:00.000Z",
  })
}
