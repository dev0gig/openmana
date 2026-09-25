/*
 * The one Scryfall API client of the app. Scryfall's rate limits count per
 * client, so every part of the app that asks Scryfall (today the deck import,
 * later the deck library and the game) shares this one. Its code and the
 * validators of Scryfall's answers load only when something is asked for the
 * first time - never at start-up.
 */
import type { LocalDatabase } from "@/storage/database"
import { CardDataError } from "./errors"
import type { PrintKey, ResolvedPrint } from "./prints"
import type { ScryfallClient } from "./scryfall-client"

let shared: Promise<ScryfallClient> | null = null

export function scryfallClient(): Promise<ScryfallClient> {
  shared ??= import("./scryfall-client").then(({ ScryfallClient }) => new ScryfallClient())
  // A failed load (offline before the code was ever fetched) is tried again next time.
  shared.catch(() => (shared = null))
  return shared
}

/**
 * Particular printings through the shared client (prints.ts: kept 30 days,
 * never a guess). If the code to ask Scryfall cannot even be loaded
 * (offline), that is reported like an unreachable Scryfall.
 */
export async function lookupPrints(
  db: LocalDatabase,
  keys: readonly PrintKey[],
): Promise<{ readonly prints: ReadonlyMap<string, ResolvedPrint>; readonly error: CardDataError | null }> {
  let ensurePrints: typeof import("./prints").ensurePrints
  let client: ScryfallClient
  try {
    ;[{ ensurePrints }, client] = await Promise.all([import("./prints"), scryfallClient()])
  } catch (error) {
    return { prints: new Map(), error: new CardDataError("scryfall-unreachable", "the code to ask Scryfall could not be loaded", { cause: error, detail: String(error) }) }
  }
  return ensurePrints(db, client, keys)
}
