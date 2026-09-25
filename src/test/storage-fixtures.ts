/*
 * Test data and helpers for the local database (fake-indexeddb, see
 * setup.ts). Sample data only - neutral names, made-up ids.
 */
import { openDB, type IDBPDatabase } from "idb"
import { LocalDatabase } from "@/storage/database"
import { StorageError } from "@/storage/errors"
import type { AppVersion, CardRecord, DeckRecord, MatchLogEntry, MatchRecord, SettingRecord } from "@/storage/generated/records"
import { MIGRATIONS } from "@/storage/migrations"
import { openWithMigrations } from "@/storage/open"
import { DATABASE_NAME, STORE_LAYOUT, type OpenManaDB, type StoreName } from "@/storage/schema"

export const APP: AppVersion = { version: "0.0.0-test", commit: null }
export const FIXED_NOW = new Date("2026-09-25T08:00:00.000Z")

let counter = 0
/** A fresh lower-case UUID (deterministic within a test run). */
export function uuid(): string {
  counter++
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, "0")}`
}

export function deck(overrides: Partial<DeckRecord> = {}): DeckRecord {
  return {
    id: uuid(),
    name: "Muster-Deck",
    format: "constructed",
    main: [
      { count: 20, name: "Mountain" },
      { count: 4, name: "Lightning Strike", set: "M19", collectorNumber: "152" },
    ],
    sideboard: [{ count: 2, name: "Shock" }],
    commander: [],
    source: { kind: "arena", text: "Deck\n20 Mountain\n4 Lightning Strike (M19) 152\n\nSideboard\n2 Shock", importedAt: "2026-09-20T10:00:00.000Z" },
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

export function setting(key: string, value: unknown, updatedAt = "2026-09-21T10:00:00.000Z"): SettingRecord {
  return { key, value, updatedAt }
}

export function match(overrides: Partial<MatchRecord> = {}): MatchRecord {
  const sample = { name: "Muster-Deck", main: [{ card: "Mountain", count: 20 }] as MatchRecord["human"]["deck"]["main"], sideboard: [], commander: [] }
  return {
    id: uuid(),
    status: "finished",
    format: "constructed",
    startedAt: "2026-09-22T18:00:00.000Z",
    endedAt: "2026-09-22T18:20:00.000Z",
    seed: 42,
    app: APP,
    engine: {
      id: "0c82db80023ac0cc",
      protocol: 3,
      forgeVersion: "2.0.15",
      forgeCommit: "ed0333fecb000000000000000000000000000000",
      buildCommit: "0ddfbc3a04000000000000000000000000000000",
      sourcesModified: false,
    },
    human: { name: "Spieler", deckId: null, deck: sample },
    ai: { name: "Forge-KI", profile: "Default", deckId: null, deck: { ...sample, name: "KI-Deck" } },
    end: { result: "win", reason: "AllOpponentsLost", turns: 9, conceded: false },
    ...overrides,
  }
}

export function logEntry(matchId: string, seq: number): MatchLogEntry {
  return { matchId, seq, at: seq * 100, from: seq % 2 === 0 ? "engine" : "player", message: { type: seq % 2 === 0 ? "game.state" : "answer", seq } }
}

export function card(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    oracleId: uuid(),
    name: "Lightning Strike",
    layout: "normal",
    faces: [{ name: "Lightning Strike", manaCost: "{1}{R}", typeLine: "Instant", oracleText: "Lightning Strike deals 3 damage to any target." }],
    manaValue: 2,
    colors: "R",
    colorIdentity: "R",
    forgeNames: ["Lightning Strike"],
    nameKeys: ["lightning strike", "blitzschlag"],
    de: {
      faces: [{ name: "Blitzschlag", typeLine: "Spontanzauber", text: "Blitzschlag fügt einem Ziel deiner Wahl 3 Schadenspunkte zu." }],
      set: "m19",
      collectorNumber: "152",
      releasedAt: "2018-07-13",
    },
    prints: {
      de: { id: uuid(), set: "m19", collectorNumber: "152", lang: "de", releasedAt: "2018-07-13", imageStatus: "lowres", imageSides: 1, imageVersion: "1562302708" },
      fallback: { id: uuid(), set: "m19", collectorNumber: "152", lang: "en", releasedAt: "2018-07-13", imageStatus: "highres_scan", imageSides: 1, imageVersion: "1562302708" },
    },
    ...overrides,
  }
}

/** The production database, opened on this test's fake IndexedDB. */
export async function openTestDatabase(options: { readonly onChange?: (stores: readonly StoreName[]) => void } = {}): Promise<LocalDatabase> {
  const db = await openWithMigrations({ name: DATABASE_NAME, migrations: MIGRATIONS, layout: STORE_LAYOUT, app: APP, now: () => FIXED_NOW })
  return new LocalDatabase(db as unknown as IDBPDatabase<OpenManaDB>, options.onChange)
}

/** Writes values exactly as given, past every check (to plant damaged records). */
export async function putRaw(store: StoreName, ...values: unknown[]): Promise<void> {
  const db = await openDB(DATABASE_NAME)
  const transaction = db.transaction(store, "readwrite")
  for (const value of values) await transaction.store.put(value)
  await transaction.done
  db.close()
}

/** Everything a store holds, read past every check. */
export async function readRaw(store: StoreName): Promise<unknown[]> {
  const db = await openDB(DATABASE_NAME)
  const values = await db.getAll(store)
  db.close()
  return values
}

/** A backup file from lines (JSON values are serialized; strings are taken as they are). */
export function backupFile(lines: readonly unknown[], options: { readonly gzip?: boolean; readonly name?: string } = {}): Promise<File> {
  const text = lines.map((line) => (typeof line === "string" ? line : JSON.stringify(line))).join("\n") + "\n"
  const name = options.name ?? "sicherung.jsonl.gz"
  if (!options.gzip) return Promise.resolve(new File([text], name))
  // Response bodies stream in jsdom and Node alike (jsdom's Blob has no stream()).
  const body = new Response(text).body as ReadableStream<BufferSource>
  return new Response(body.pipeThrough(new CompressionStream("gzip"))).arrayBuffer().then((bytes) => new File([bytes], name))
}

export function backupHeader(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "header",
    format: "openmana-backup",
    formatVersion: 1,
    schemaVersion: 1,
    createdAt: "2026-09-24T12:00:00.000Z",
    app: APP,
    stores: ["decks", "settings", "matches", "matchLog"],
    ...overrides,
  }
}

export function backupEnd(counts: Partial<Record<"decks" | "settings" | "matches" | "matchLog", number>>): Record<string, unknown> {
  const full = { decks: 0, settings: 0, matches: 0, matchLog: 0, ...counts }
  return { type: "end", counts: full, records: Object.values(full).reduce((sum, n) => sum + n, 0) }
}

/** The StorageError a promise rejects with (fails the test if it resolves or rejects with anything else). */
export async function rejectionOf(promise: Promise<unknown>): Promise<StorageError> {
  const outcome = await promise.then(
    () => ({ rejected: false as const }),
    (error: unknown) => ({ rejected: true as const, error }),
  )
  if (!outcome.rejected) throw new Error("expected a StorageError, the promise resolved")
  if (!(outcome.error instanceof StorageError)) throw outcome.error
  return outcome.error
}
