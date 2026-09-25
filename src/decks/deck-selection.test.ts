// @vitest-environment node
/*
 * Which decks play the next game: both choices as settings (checked, kept),
 * the AI's deck of the player's format, a random draw from the fitting
 * decks other than the player's own, and every way a choice can stop
 * fitting (deleted, damaged, another format) - said, never replaced.
 */
import { describe, expect, it } from "vitest"
import type { CheckedRecords } from "@/storage/database"
import { saveDeck } from "@/storage/decks"
import type { DeckRecord } from "@/storage/generated/records"
import { readSetting, writeSetting, type SettingValue } from "@/storage/settings"
import { deck, openTestDatabase, putRaw, setting } from "@/test/storage-fixtures"
import { AI_DECK, drawAiDeck, HUMAN_DECK, randomPool, readSelection, resolveSelection, type AiDeckChoice } from "./deck-selection"

const value = <T,>(v: T, invalid = false): SettingValue<T> => ({ value: v, stored: true, invalid })
const decks = (records: readonly DeckRecord[], damaged: readonly string[] = []): CheckedRecords<DeckRecord> => ({
  records,
  invalid: damaged.map((key) => ({ store: "decks", key, problems: [{ path: "/", message: "invalid" }] })),
})

const red = deck({ name: "Rot" })
const blue = deck({ name: "Blau" })
const green = deck({ name: "Grün" })
const brawl = deck({ name: "Brawl", format: "commander", commander: [{ count: 1, name: "Valki, God of Lies" }] })
const all = decks([red, blue, green, brawl])
const RANDOM: AiDeckChoice = { kind: "random" }

describe("the settings", () => {
  it("accept a deck id or nothing, and random or one deck; anything else falls back", async () => {
    const db = await openTestDatabase()
    expect(await readSetting(db, HUMAN_DECK)).toEqual({ value: null, stored: false, invalid: false })
    expect(await readSetting(db, AI_DECK)).toEqual({ value: RANDOM, stored: false, invalid: false })
    await writeSetting(db, HUMAN_DECK, red.id)
    await writeSetting(db, AI_DECK, { kind: "deck", deckId: blue.id })
    expect((await readSetting(db, HUMAN_DECK)).value).toBe(red.id)
    expect((await readSetting(db, AI_DECK)).value).toEqual({ kind: "deck", deckId: blue.id })
    await expect(writeSetting(db, HUMAN_DECK, "Rot")).rejects.toMatchObject({ code: "invalid-record" })
    await putRaw("settings", setting("play.aiDeck", { kind: "deck", deckId: blue.id, extra: 1 }), setting("play.humanDeck", 42))
    expect(await readSetting(db, AI_DECK)).toEqual({ value: RANDOM, stored: true, invalid: true })
    expect(await readSetting(db, HUMAN_DECK)).toEqual({ value: null, stored: true, invalid: true })
    db.close()
  })
})

describe("the choice", () => {
  it("nothing chosen yet: the player's deck is missing, the AI plays a random deck", () => {
    const selection = resolveSelection(value(null), value(RANDOM), all)
    expect(selection).toMatchObject({ human: { status: "none" }, ai: { status: "random", pool: null }, format: null, blocker: "no-human", reset: false })
  })

  it("random: one of the other decks of the player's format", () => {
    const selection = resolveSelection(value(red.id), value(RANDOM), all)
    expect(selection.blocker).toBeNull()
    expect(selection.format).toBe("constructed")
    expect(selection.ai.status === "random" && selection.ai.pool?.map((d) => d.name)).toEqual(["Blau", "Grün"])
    // A Commander deck has no other Commander deck to draw.
    expect(resolveSelection(value(brawl.id), value(RANDOM), all)).toMatchObject({ ai: { status: "random", pool: [] }, blocker: "random-empty" })
  })

  it("a chosen deck of the same format - the player's own too (a mirror match)", () => {
    expect(resolveSelection(value(red.id), value<AiDeckChoice>({ kind: "deck", deckId: blue.id }), all)).toMatchObject({ ai: { status: "ok", deck: blue }, blocker: null })
    expect(resolveSelection(value(brawl.id), value<AiDeckChoice>({ kind: "deck", deckId: brawl.id }), all)).toMatchObject({ ai: { status: "ok", deck: brawl }, blocker: null })
  })

  it("a deck of another format, a deleted or damaged deck: said so, never replaced", () => {
    expect(resolveSelection(value(red.id), value<AiDeckChoice>({ kind: "deck", deckId: brawl.id }), all)).toMatchObject({ ai: { status: "mismatch", deck: brawl }, blocker: "ai-mismatch" })
    const gone = "00000000-0000-4000-8000-ffffffffffff"
    expect(resolveSelection(value(red.id), value<AiDeckChoice>({ kind: "deck", deckId: gone }), all)).toMatchObject({ ai: { status: "missing" }, blocker: "ai-missing" })
    expect(resolveSelection(value(gone), value(RANDOM), all)).toMatchObject({ human: { status: "missing" }, blocker: "human-missing" })
    const withDamaged = decks([red], ["11111111-1111-4111-8111-111111111111"])
    expect(resolveSelection(value("11111111-1111-4111-8111-111111111111"), value(RANDOM), withDamaged)).toMatchObject({ human: { status: "damaged" }, blocker: "human-damaged" })
    expect(resolveSelection(value(red.id), value<AiDeckChoice>({ kind: "deck", deckId: "11111111-1111-4111-8111-111111111111" }), withDamaged)).toMatchObject({
      ai: { status: "damaged" },
      blocker: "ai-damaged",
    })
  })

  it("a stored value that failed its check is reported", () => {
    expect(resolveSelection(value(null, true), value(RANDOM), all).reset).toBe(true)
  })

  it("reads both choices and the decks", async () => {
    const db = await openTestDatabase()
    await saveDeck(db, red)
    await writeSetting(db, HUMAN_DECK, red.id)
    const stored = await readSelection(db)
    expect(stored.human.value).toBe(red.id)
    expect(stored.ai.value).toEqual(RANDOM)
    expect(stored.decks.records).toEqual([red])
    db.close()
  })
})

describe("the draw", () => {
  it("the pool leaves out the player's own deck, other formats and damaged decks (they are not in the records)", () => {
    expect(randomPool(red, [red, blue, brawl, green]).map((d) => d.name)).toEqual(["Blau", "Grün"])
    expect(randomPool(brawl, [red, brawl])).toEqual([])
  })

  it("each deck equally likely; an empty pool is an error", () => {
    const pool = [blue, green, red]
    expect(drawAiDeck(pool, () => 0)).toBe(blue)
    expect(drawAiDeck(pool, () => 0.34)).toBe(green)
    expect(drawAiDeck(pool, () => 0.999999)).toBe(red)
    const counts = new Map<string, number>()
    for (let i = 0; i < 3000; i++) {
      const drawn = drawAiDeck(pool, () => i / 3000)
      counts.set(drawn.name, (counts.get(drawn.name) ?? 0) + 1)
    }
    expect([...counts.values()]).toEqual([1000, 1000, 1000])
    expect(() => drawAiDeck([])).toThrow(/no deck/)
  })
})
