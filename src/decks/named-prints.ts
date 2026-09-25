/*
 * The printings a deck's list named that the card catalog does not carry
 * (deck-view.ts needsNamedPrint): asked of Scryfall once through the app's
 * one client (scryfall-access.ts: its rate limits, 30 days kept, stale
 * answers used offline), so the deck details can show them - in German where
 * that printing exists in German (deck-view.ts pictureOf). Until the answer
 * is there, and if Scryfall cannot be reached, the card's usual picture
 * stands in; nothing is guessed.
 */
import { useEffect, useMemo, useState } from "react"
import { CardDataError } from "@/cards/errors"
import { printKey, type PrintKey, type ResolvedPrint } from "@/cards/print-key"
import { lookupPrints } from "@/cards/scryfall-access"
import type { LocalDatabase } from "@/storage/database"
import { DECK_PARTS, needsNamedPrint, type DeckView } from "./deck-view"

export interface NamedPrints {
  /** loading: Scryfall (or the local copy of its answers) is being asked. */
  readonly status: "none" | "loading" | "done"
  /** By printKey(). */
  readonly prints: ReadonlyMap<string, ResolvedPrint>
  readonly error: CardDataError | null
  /** How many printings are asked about. */
  readonly count: number
}

/** The printings of a deck view to ask about (each once). */
export function namedPrintKeys(view: DeckView): PrintKey[] {
  const keys = new Map<string, PrintKey>()
  for (const part of DECK_PARTS) {
    for (const entry of view.parts[part]) {
      if (!needsNamedPrint(entry)) continue
      const key = { set: entry.entry.set!, collectorNumber: entry.entry.collectorNumber! }
      keys.set(printKey(key), key)
    }
  }
  return [...keys.values()]
}

export function useNamedPrints(database: LocalDatabase | null, view: DeckView | null): NamedPrints {
  const keys = useMemo(() => (view === null ? [] : namedPrintKeys(view)), [view])
  const id = keys.map(printKey).join(",")
  const [answer, setAnswer] = useState<{ readonly id: string; readonly prints: ReadonlyMap<string, ResolvedPrint>; readonly error: CardDataError | null } | null>(null)
  useEffect(() => {
    if (database === null || keys.length === 0) return
    let active = true
    // Asked again when the deck view changes: answers already kept locally are only read, not fetched.
    lookupPrints(database, keys).then(
      (result) => {
        if (active) setAnswer({ id, prints: result.prints, error: result.error })
      },
      (error: unknown) => {
        // Keeping Scryfall's answers locally failed: the usual pictures stand in, and the details say why.
        if (active) setAnswer({ id, prints: new Map(), error: error instanceof CardDataError ? error : new CardDataError("storage", "keeping Scryfall's printings failed", { cause: error, detail: String(error) }) })
      },
    )
    return () => {
      active = false
    }
  }, [database, keys, id])
  if (keys.length === 0) return { status: "none", prints: new Map(), error: null, count: 0 }
  if (answer === null || answer.id !== id) return { status: "loading", prints: answer?.prints ?? new Map(), error: null, count: keys.length }
  return { status: "done", prints: answer.prints, error: answer.error, count: keys.length }
}
