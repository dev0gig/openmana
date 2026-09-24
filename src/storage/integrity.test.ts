// @vitest-environment node
/* Checking the local data, and removing only what is (still) damaged. */
import { openDB } from "idb"
import { describe, expect, it } from "vitest"
import { deck, logEntry, match, openTestDatabase, putRaw, readRaw } from "@/test/storage-fixtures"
import { saveDeck } from "./decks"
import { checkIntegrity, removeDamaged } from "./integrity"
import { DATABASE_NAME } from "./schema"

describe("integrity", () => {
  it("a sound database has no problems", async () => {
    const db = await openTestDatabase()
    await saveDeck(db, deck())
    const played = match()
    await putRaw("matches", played)
    await putRaw("matchLog", logEntry(played.id, 0))
    const report = await checkIntegrity(db, () => new Date("2026-09-25T12:00:00.000Z"))
    expect(report.problems).toEqual([])
    expect(report.records).toMatchObject({ decks: 1, matches: 1, matchLog: 1, meta: 1 })
    expect(report.checkedAt).toBe("2026-09-25T12:00:00.000Z")
    db.close()
  })

  it("finds damaged records, orphaned log entries and missing metadata", async () => {
    const db = await openTestDatabase()
    const played = match()
    await putRaw("decks", { id: "broken", name: "" })
    await putRaw("matches", played)
    await putRaw("matchLog", logEntry(played.id, 0), logEntry("00000000-0000-4000-8000-0000000000ee", 3))
    await putRaw("settings", { key: "ai.profile", value: "x" })
    const raw = await openDB(DATABASE_NAME)
    await raw.delete("meta", "database")
    raw.close()

    const report = await checkIntegrity(db)
    expect(report.problems.map((p) => [p.store, p.key, p.kind, p.removable])).toEqual([
      ["settings", "ai.profile", "invalid", true],
      ["decks", "broken", "invalid", true],
      ["matchLog", "[00000000-0000-4000-8000-0000000000ee, 3]", "orphan", true],
      ["meta", "database", "metadata", false],
    ])
    db.close()
  })

  it("removes what is still damaged, and nothing else", async () => {
    const db = await openTestDatabase()
    const repaired = deck()
    await putRaw("decks", { ...repaired, name: "" }, { id: "broken", name: "" })
    await putRaw("matchLog", logEntry("00000000-0000-4000-8000-0000000000ee", 3))
    const report = await checkIntegrity(db)
    expect(report.problems).toHaveLength(3)
    // Meanwhile one record was repaired (a loaded backup, say).
    await saveDeck(db, repaired)
    expect(await removeDamaged(db, report)).toBe(2)
    expect(await readRaw("decks")).toEqual([repaired])
    expect(await readRaw("matchLog")).toEqual([])
    expect((await checkIntegrity(db)).problems).toEqual([])
    db.close()
  })
})
