// @vitest-environment node
/*
 * The local data schema: generated files match it, the validators accept
 * valid records and name what is wrong with invalid ones, and the enums that
 * mirror the engine protocol stay equal to it.
 */
import { execFileSync } from "node:child_process"
import path from "node:path"
import { GAME_RESULTS as PROTOCOL_GAME_RESULTS, MATCH_FORMATS } from "@openmana/engine-protocol/generated/constants"
import { describe, expect, it } from "vitest"
import { APP, card, deck, logEntry, match, setting } from "@/test/storage-fixtures"
import { DECK_FORMATS, GAME_RESULTS, SCHEMA_VERSION } from "./generated/constants"
import { validateBackupEnd, validateBackupHeader, validateCollectionDocument } from "./generated/validators.js"
import { formatKey, RECORD_CHECKS, STORE_LAYOUT, STORE_NAMES, STORE_ROLES } from "./schema"

describe("generated files", () => {
  it("match the schema (run npm run generate after a schema change)", () => {
    const root = path.resolve(import.meta.dirname, "../..")
    // Throws (with the generator's message) if a generated file is stale.
    const output = execFileSync(process.execPath, ["scripts/generate-schemas.ts", "--check"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    expect(output).toBe("")
  })
})

describe("record checks", () => {
  it("accept valid records of every store", () => {
    expect(RECORD_CHECKS.decks(deck())).toBeNull()
    expect(RECORD_CHECKS.settings(setting("ai.profile", "Default"))).toBeNull()
    expect(RECORD_CHECKS.matches(match())).toBeNull()
    expect(RECORD_CHECKS.matchLog(logEntry("00000000-0000-4000-8000-000000000001", 0))).toBeNull()
    expect(RECORD_CHECKS.scryfallCards(card())).toBeNull()
    expect(
      RECORD_CHECKS.cacheIndex({
        key: "scryfall:bulk",
        kind: "scryfall-bulk",
        status: "partial",
        source: null,
        version: null,
        storedAt: "2026-09-25T08:00:00.000Z",
        lastUsedAt: "2026-09-25T08:00:00.000Z",
        bytes: null,
        records: 0,
      }),
    ).toBeNull()
    expect(RECORD_CHECKS.meta({ key: "database", schemaVersion: 1, createdAt: null, createdBy: APP, migrations: [] })).toBeNull()
    expect(RECORD_CHECKS.meta({ key: "backup", lastExport: null, lastImport: null })).toBeNull()
  })

  it("name the path and the problem of invalid records", () => {
    const problems = RECORD_CHECKS.decks({ ...deck(), name: "  ", extra: true, main: [] })
    expect(problems).not.toBeNull()
    const text = (problems ?? []).map((p) => `${p.path} ${p.message}`).join("; ")
    expect(text).toContain("/name")
    expect(text).toContain("unexpected property 'extra'")
    expect(text).toContain("/main")
  })

  it("refuse malformed ids, timestamps and counts", () => {
    expect(RECORD_CHECKS.decks(deck({ id: "not-a-uuid" }))).not.toBeNull()
    expect(RECORD_CHECKS.decks(deck({ updatedAt: "2026-09-25" }))).not.toBeNull()
    expect(RECORD_CHECKS.decks(deck({ main: [{ count: 0, name: "Mountain" }] }))).not.toBeNull()
    expect(RECORD_CHECKS.settings(setting("Not-A-Key", 1))).not.toBeNull()
    expect(RECORD_CHECKS.matchLog({ ...logEntry("00000000-0000-4000-8000-000000000001", 0), message: { seq: 1 } })).not.toBeNull()
  })

  it("check deletion marks: a deck id and when", () => {
    expect(RECORD_CHECKS.deckTombstones({ id: "00000000-0000-4000-8000-000000000001", deletedAt: "2026-09-25T08:00:00.000Z" })).toBeNull()
    expect(RECORD_CHECKS.deckTombstones({ id: "broken", deletedAt: "2026-09-25T08:00:00.000Z" })).not.toBeNull()
    expect(RECORD_CHECKS.deckTombstones({ id: "00000000-0000-4000-8000-000000000001", deletedAt: "2026-09-25" })).not.toBeNull()
    expect(RECORD_CHECKS.deckTombstones({ id: "00000000-0000-4000-8000-000000000001", deletedAt: "2026-09-25T08:00:00.000Z", name: "x" })).not.toBeNull()
  })

  it("check the collection document's container (its records are checked one by one: collection.test.ts)", () => {
    const empty = { schemaVersion: 4, decks: [], deckTombstones: [], settings: [] }
    expect(validateCollectionDocument(empty)).toBe(true)
    expect(validateCollectionDocument({ ...empty, schemaVersion: 3 })).toBe(false)
    expect(validateCollectionDocument({ ...empty, matches: [] })).toBe(false)
    expect(validateCollectionDocument({ schemaVersion: 4, decks: [] })).toBe(false)
    expect(validateCollectionDocument({ ...empty, decks: ["not a record"] })).toBe(false)
  })

  it("tell the meta records apart by key", () => {
    expect(RECORD_CHECKS.meta({ key: "database", lastExport: null, lastImport: null })).not.toBeNull()
    expect(RECORD_CHECKS.meta({ key: "other" })).not.toBeNull()
  })

  it("check the backup lines", () => {
    expect(validateBackupHeader({ type: "header", format: "openmana-backup", formatVersion: 1, schemaVersion: 1, createdAt: "2026-09-25T08:00:00.000Z", app: APP, stores: ["decks"] })).toBe(true)
    expect(validateBackupHeader({ type: "header", format: "something-else", formatVersion: 1, schemaVersion: 1, createdAt: "2026-09-25T08:00:00.000Z", app: APP, stores: [] })).toBe(false)
    expect(validateBackupEnd({ type: "end", counts: { decks: 1 }, records: 1 })).toBe(true)
    expect(validateBackupEnd({ type: "end", counts: { scryfallCards: 1 }, records: 1 })).toBe(false)
  })
})

describe("stores", () => {
  it("every store has a layout, a role and a record check", () => {
    for (const store of STORE_NAMES) {
      expect(STORE_LAYOUT[store]).toBeDefined()
      expect(STORE_ROLES[store]).toMatch(/^(user|cache|internal)$/)
      expect(typeof RECORD_CHECKS[store]).toBe("function")
    }
    expect(Object.keys(STORE_LAYOUT).sort()).toEqual([...STORE_NAMES].sort())
  })

  it("backups hold exactly the user stores", async () => {
    const { BACKUP_STORES } = await import("./generated/constants")
    expect([...BACKUP_STORES].sort()).toEqual(STORE_NAMES.filter((store) => STORE_ROLES[store] === "user").sort())
  })

  it("the schema version is the database version", () => {
    // Version 2 (prompt 08): the card catalog stores. Version 3 (prompt 10): a deck names its companion.
    // Version 4 (ORYX cloud): the deletion marks of deleted decks.
    expect(SCHEMA_VERSION).toBe(4)
  })

  it("deletion marks are the database's own bookkeeping: never in a backup", async () => {
    const { BACKUP_STORES } = await import("./generated/constants")
    expect(STORE_ROLES.deckTombstones).toBe("internal")
    expect([...BACKUP_STORES]).not.toContain("deckTombstones")
    expect(STORE_LAYOUT.deckTombstones).toEqual({ keyPath: "id", indexes: {} })
  })

  it("formats keys for reports", () => {
    expect(formatKey("abc")).toBe("abc")
    expect(formatKey(["m", 3])).toBe("[m, 3]")
  })
})

describe("mirrors of the engine protocol", () => {
  it("a stored deck format is a format Forge can be asked to play", () => {
    expect([...DECK_FORMATS]).toEqual([...MATCH_FORMATS])
  })

  it("a stored game result is Forge's game result", () => {
    expect([...GAME_RESULTS]).toEqual([...PROTOCOL_GAME_RESULTS])
  })
})
