// @vitest-environment node
/*
 * Which decks play the next game: the choices as settings (checked, kept),
 * the AI's deck of the player's mode, a random draw from the fitting decks
 * other than the player's own, Jumpstart's two halves on each side (prompt
 * 61: never the same half twice, the AI's random halves never the player's),
 * and every way a choice can stop fitting (deleted, damaged, another mode,
 * the same half) - said, never replaced.
 */
import { describe, expect, it } from "vitest"
import type { CheckedRecords } from "@/storage/database"
import { saveDeck } from "@/storage/decks"
import type { DeckRecord } from "@/storage/generated/records"
import { readSetting, writeSetting, type SettingValue } from "@/storage/settings"
import { deck, openTestDatabase, putRaw, setting } from "@/test/storage-fixtures"
import { AI_DECK, AI_HALF, drawAiDeck, drawHalves, HUMAN_DECK, HUMAN_HALF, randomPool, readSelection, resolveSelection, resolveStored, type AiDeckChoice } from "./deck-selection"

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
    expect(selection).toMatchObject({ human: { status: "none" }, humanHalf: null, ai: { status: "random", pool: null }, aiHalf: null, mode: null, blocker: "no-human", reset: false })
  })

  it("random: one of the other decks of the player's mode", () => {
    const selection = resolveSelection(value(red.id), value(RANDOM), all)
    expect(selection.blocker).toBeNull()
    expect(selection.mode).toBe("normal")
    expect(selection.ai.status === "random" && selection.ai.pool?.map((d) => d.name)).toEqual(["Blau", "Grün"])
    // A Commander deck has no other Commander deck to draw.
    expect(resolveSelection(value(brawl.id), value(RANDOM), all)).toMatchObject({ ai: { status: "random", pool: [] }, blocker: "random-empty" })
  })

  it("a chosen deck of the same format - the player's own too (a mirror match)", () => {
    expect(resolveSelection(value(red.id), value<AiDeckChoice>({ kind: "deck", deckId: blue.id }), all)).toMatchObject({ ai: { status: "ok", deck: blue }, blocker: null })
    expect(resolveSelection(value(brawl.id), value<AiDeckChoice>({ kind: "deck", deckId: brawl.id }), all)).toMatchObject({ ai: { status: "ok", deck: brawl }, blocker: null })
  })

  it("a deck of another mode, a deleted or damaged deck: said so, never replaced", () => {
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
  it("the pool leaves out the player's own decks, other modes and damaged decks (they are not in the records)", () => {
    expect(randomPool("normal", [red], [red, blue, brawl, green]).map((d) => d.name)).toEqual(["Blau", "Grün"])
    expect(randomPool("commander", [brawl], [red, brawl])).toEqual([])
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

describe("Jumpstart (prompt 61)", () => {
  const half = (name: string) => deck({ name, main: [{ count: 8, name: "Mountain" }, { count: 12, name: "Raging Goblin" }], sideboard: [] })
  const goblins = half("Goblins")
  const elves = half("Elfen")
  const fire = half("Feuer")
  const wilds = half("Wildnis")
  const jumpstart = decks([red, blue, brawl, goblins, elves, fire, wilds])
  const choose = (deckId: string): AiDeckChoice => ({ kind: "deck", deckId })

  it("a half brings the second half at once; nothing is set before it is chosen", () => {
    const selection = resolveSelection(value(goblins.id), value(RANDOM), jumpstart)
    expect(selection).toMatchObject({ mode: "jumpstart", humanHalf: { status: "none" }, blocker: "no-human-half" })
    const both = resolveSelection(value(goblins.id), value(RANDOM), jumpstart, { human: value(elves.id) })
    expect(both).toMatchObject({ mode: "jumpstart", humanHalf: { status: "ok", deck: elves }, blocker: null })
  })

  it("never the same half twice, and only halves", () => {
    expect(resolveSelection(value(goblins.id), value(RANDOM), jumpstart, { human: value(goblins.id) })).toMatchObject({ humanHalf: { status: "same", deck: goblins }, blocker: "human-half-same" })
    expect(resolveSelection(value(goblins.id), value(RANDOM), jumpstart, { human: value(red.id) })).toMatchObject({ humanHalf: { status: "mismatch", deck: red }, blocker: "human-half-mismatch" })
    const ai = resolveSelection(value(goblins.id), value(choose(fire.id)), jumpstart, { human: value(elves.id), ai: value(fire.id) })
    expect(ai).toMatchObject({ ai: { status: "ok", deck: fire }, aiHalf: { status: "same", deck: fire }, blocker: "ai-half-same" })
  })

  it("random: two halves other than the player's two, drawn anew, never the same twice", () => {
    const selection = resolveSelection(value(goblins.id), value(RANDOM), jumpstart, { human: value(elves.id) })
    expect(selection.ai.status === "random" && selection.ai.pool?.map((d) => d.name)).toEqual(["Feuer", "Wildnis"])
    expect(selection.aiHalf).toBeNull()
    for (let i = 0; i < 50; i++) {
      const [first, second] = drawHalves([goblins, elves, fire, wilds], () => (i % 10) / 10)
      expect(first.id).not.toBe(second.id)
    }
    expect(drawHalves([fire, wilds], () => 0).map((d) => d.name)).toEqual(["Feuer", "Wildnis"])
    expect(() => drawHalves([fire])).toThrow(/fewer than two/)
  })

  it("too few halves for a random draw: said so, choosing them stays possible (the player's own too)", () => {
    const few = decks([red, goblins, elves, fire])
    expect(resolveSelection(value(goblins.id), value(RANDOM), few, { human: value(elves.id) })).toMatchObject({ ai: { status: "random", pool: [fire] }, blocker: "random-halves" })
    const chosen = resolveSelection(value(goblins.id), value(choose(goblins.id)), few, { human: value(elves.id), ai: value(elves.id) })
    expect(chosen).toMatchObject({ ai: { status: "ok", deck: goblins }, aiHalf: { status: "ok", deck: elves }, blocker: null })
    expect(resolveSelection(value(goblins.id), value(choose(fire.id)), few, { human: value(elves.id) })).toMatchObject({ aiHalf: { status: "none" }, blocker: "no-ai-half" })
  })

  it("a deleted or damaged half is shown as such, never replaced", () => {
    const gone = "00000000-0000-4000-8000-ffffffffffff"
    const damaged = "11111111-1111-4111-8111-111111111111"
    const withDamaged = decks([goblins, elves, fire, wilds], [damaged])
    expect(resolveSelection(value(goblins.id), value(RANDOM), withDamaged, { human: value(gone) })).toMatchObject({ humanHalf: { status: "missing" }, blocker: "human-half-missing" })
    expect(resolveSelection(value(goblins.id), value(RANDOM), withDamaged, { human: value(damaged) })).toMatchObject({ humanHalf: { status: "damaged" }, blocker: "human-half-damaged" })
    expect(resolveSelection(value(goblins.id), value(choose(fire.id)), withDamaged, { human: value(elves.id), ai: value(damaged) })).toMatchObject({ aiHalf: { status: "damaged" }, blocker: "ai-half-damaged" })
  })

  it("switching modes: the second half goes away, an AI deck of the other mode stops fitting", () => {
    // From a half to a normal deck: the stored second half no longer counts.
    expect(resolveSelection(value(red.id), value(RANDOM), jumpstart, { human: value(elves.id) })).toMatchObject({ mode: "normal", humanHalf: null, blocker: null })
    expect(resolveSelection(value(red.id), value(choose(fire.id)), jumpstart, { ai: value(wilds.id) })).toMatchObject({ ai: { status: "mismatch", deck: fire }, aiHalf: null, blocker: "ai-mismatch" })
    expect(resolveSelection(value(brawl.id), value(choose(red.id)), jumpstart)).toMatchObject({ mode: "commander", ai: { status: "mismatch" }, blocker: "ai-mismatch" })
    // From a normal deck to a half: a chosen normal AI deck stops fitting.
    expect(resolveSelection(value(goblins.id), value(choose(red.id)), jumpstart, { human: value(elves.id) })).toMatchObject({ ai: { status: "mismatch", deck: red }, blocker: "ai-mismatch" })
    // Halves are no longer drawn for a normal game.
    const normal = resolveSelection(value(red.id), value(RANDOM), jumpstart)
    expect(normal.ai.status === "random" && normal.ai.pool?.map((d) => d.name)).toEqual(["Blau"])
  })

  it("the new settings: a deck id or nothing; old settings stay valid; a bad value is reported", async () => {
    const db = await openTestDatabase()
    expect(await readSetting(db, HUMAN_HALF)).toEqual({ value: null, stored: false, invalid: false })
    expect(await readSetting(db, AI_HALF)).toEqual({ value: null, stored: false, invalid: false })
    await saveDeck(db, goblins)
    await saveDeck(db, elves)
    await writeSetting(db, HUMAN_DECK, goblins.id)
    await writeSetting(db, HUMAN_HALF, elves.id)
    await expect(writeSetting(db, AI_HALF, "Elfen")).rejects.toMatchObject({ code: "invalid-record" })
    const stored = await readSelection(db)
    expect(resolveStored(stored)).toMatchObject({ mode: "jumpstart", humanHalf: { status: "ok", deck: elves }, reset: false })
    await putRaw("settings", setting("play.humanHalf", 7))
    expect(resolveStored(await readSelection(db)).reset).toBe(true)
    db.close()
  })
})
