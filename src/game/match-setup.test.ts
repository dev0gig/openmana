// @vitest-environment node
/*
 * A game from the deck choice and the AI profile: decks go to Forge as the
 * protocol's Deck with the names Forge knows (nothing else, no file), the
 * AI's random deck and random profile are drawn anew for every game, the seed
 * is random and known, and a choice that does not allow a game gives none.
 */
import { checkMatchRequest } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { resolveSelection, type AiDeckChoice } from "@/decks/deck-selection"
import type { CheckedRecords } from "@/storage/database"
import type { DeckRecord } from "@/storage/generated/records"
import type { SettingValue } from "@/storage/settings"
import { deck } from "@/test/storage-fixtures"
import { AI_PROFILE_TABLE, DEFAULT_AI_PROFILE } from "./ai-profile-table"
import { resolveAiProfile } from "./ai-profiles"
import { engineDeck } from "./engine-deck"
import { AI_NAME, HUMAN_NAME, matchSetup, planGame, randomSeed, SEED_LIMIT } from "./match-setup"

const value = <T,>(v: T): SettingValue<T> => ({ value: v, stored: true, invalid: false })
const decks = (records: readonly DeckRecord[]): CheckedRecords<DeckRecord> => ({ records, invalid: [] })

const izzet = deck({
  name: "Izzet Tempo",
  main: [
    { count: 4, name: "Consider", set: "mid", collectorNumber: "44", oracleId: "0f4fd0f0-7a1d-4c67-9e0b-1a1b1c1d1e1f" },
    { count: 4, name: "Fire // Ice" },
    { count: 2, name: "Consider", set: "dmr", collectorNumber: "47" },
    { count: 20, name: "Island" },
  ],
  sideboard: [
    { count: 2, name: "Negate" },
    { count: 1, name: "Lurrus of the Dream-Den" },
  ],
  companion: [{ count: 1, name: "Lurrus of the Dream-Den" }],
})
const mono = deck({ name: "Mono Rot", sideboard: [] })
const other = deck({ name: "Gruul" })
const valki = deck({
  name: "Valki Brawl",
  format: "commander",
  main: [{ count: 59, name: "Mountain" }],
  sideboard: [],
  commander: [{ count: 1, name: "Valki, God of Lies" }],
})

describe("engineDeck", () => {
  it("is the protocol's Deck: Forge's names and counts, entry for entry; the companion only in the sideboard", () => {
    expect(engineDeck(izzet)).toEqual({
      name: "Izzet Tempo",
      main: [
        { card: "Consider", count: 4 },
        { card: "Fire // Ice", count: 4 },
        { card: "Consider", count: 2 },
        { card: "Island", count: 20 },
      ],
      sideboard: [
        { card: "Negate", count: 2 },
        { card: "Lurrus of the Dream-Den", count: 1 },
      ],
    })
  })

  it("names the commander and leaves empty sections out", () => {
    expect(engineDeck(valki)).toEqual({ name: "Valki Brawl", main: [{ card: "Mountain", count: 59 }], commander: [{ card: "Valki, God of Lies", count: 1 }] })
    expect(engineDeck(mono)).not.toHaveProperty("sideboard")
  })
})

describe("matchSetup", () => {
  it("is a valid match.start request in the player's format, with the names Forge calls the players by", () => {
    const setup = matchSetup(izzet, other, { seed: 42, drawn: true })
    expect(() => checkMatchRequest(setup.request)).not.toThrow()
    expect(setup.request).toMatchObject({
      seed: 42,
      format: "constructed",
      human: { name: HUMAN_NAME, deck: { name: "Izzet Tempo" } },
      ai: { name: AI_NAME, profile: DEFAULT_AI_PROFILE, deck: { name: "Gruul" } },
    })
    expect(setup.request).not.toHaveProperty("trace")
    expect(setup.human).toEqual({ deckId: izzet.id, deckName: "Izzet Tempo" })
    expect(setup.ai).toEqual({ deckId: other.id, deckName: "Gruul", drawn: true, profileDrawn: false })
    expect(DEFAULT_AI_PROFILE).toBe("Default")
    expect(matchSetup(izzet, other, { seed: 1, drawn: false, profile: "Reckless", profileDrawn: true })).toMatchObject({
      request: { ai: { profile: "Reckless" } },
      ai: { drawn: false, profileDrawn: true },
    })
  })
})

describe("randomSeed", () => {
  it("gives 48 random bits as a safe integer", () => {
    expect(randomSeed(new Uint32Array([0, 0]))).toBe(0)
    expect(randomSeed(new Uint32Array([0xffff_ffff, 0xffff_ffff]))).toBe(SEED_LIMIT - 1)
    expect(randomSeed(new Uint32Array([1, 2]))).toBe(0x1_0000_0002)
    const seeds = new Set(Array.from({ length: 50 }, () => randomSeed()))
    expect(seeds.size).toBe(50)
    for (const seed of seeds) {
      expect(Number.isSafeInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(SEED_LIMIT)
    }
  })
})

describe("planGame", () => {
  const all = decks([izzet, mono, other, valki])
  const RANDOM: AiDeckChoice = { kind: "random" }

  it("the chosen AI deck", () => {
    const setup = planGame(resolveSelection(value(izzet.id), value<AiDeckChoice>({ kind: "deck", deckId: mono.id }), all), { seed: 7 })
    expect(setup?.ai).toEqual({ deckId: mono.id, deckName: "Mono Rot", drawn: false, profileDrawn: false })
    expect(setup?.request.seed).toBe(7)
    expect(setup?.request.ai.profile).toBe("Default")
  })

  it("random: drawn anew for every game from the other decks of the format, never the player's own", () => {
    const selection = resolveSelection(value(izzet.id), value(RANDOM), all)
    expect(planGame(selection, { random: () => 0 })?.ai).toEqual({ deckId: mono.id, deckName: "Mono Rot", drawn: true, profileDrawn: false })
    expect(planGame(selection, { random: () => 0.99 })?.ai).toEqual({ deckId: other.id, deckName: "Gruul", drawn: true, profileDrawn: false })
    const drawn = new Set(Array.from({ length: 40 }, () => planGame(selection)?.ai.deckName))
    expect([...drawn].sort()).toEqual(["Gruul", "Mono Rot"])
  })

  it("every game gets its own seed", () => {
    const selection = resolveSelection(value(izzet.id), value(RANDOM), all)
    const seeds = new Set(Array.from({ length: 20 }, () => planGame(selection)?.request.seed))
    expect(seeds.size).toBe(20)
  })

  it("a mirror match on purpose, a Commander game with the commander", () => {
    const setup = planGame(resolveSelection(value(valki.id), value<AiDeckChoice>({ kind: "deck", deckId: valki.id }), all))
    expect(setup?.request.format).toBe("commander")
    expect(setup?.request.human.deck).toEqual(setup?.request.ai.deck)
    expect(setup?.request.human.deck.commander).toEqual([{ card: "Valki, God of Lies", count: 1 }])
  })

  it("the chosen AI profile goes to Forge; random draws one of the verified profiles for every game", () => {
    const selection = resolveSelection(value(izzet.id), value<AiDeckChoice>({ kind: "deck", deckId: mono.id }), all)
    const cautious = planGame(selection, { profile: resolveAiProfile({ kind: "profile", name: "Cautious" }) })
    expect(cautious?.request.ai.profile).toBe("Cautious")
    expect(cautious?.ai.profileDrawn).toBe(false)
    const random = resolveAiProfile({ kind: "random" })
    expect(planGame(selection, { profile: random, random: () => 0 })?.request.ai.profile).toBe(AI_PROFILE_TABLE[0]!.name)
    expect(planGame(selection, { profile: random, random: () => 0.999 })?.request.ai.profile).toBe(AI_PROFILE_TABLE.at(-1)!.name)
    expect(planGame(selection, { profile: random })?.ai.profileDrawn).toBe(true)
    const drawn = new Set(Array.from({ length: 80 }, () => planGame(selection, { profile: random })?.request.ai.profile))
    expect([...drawn].sort()).toEqual(AI_PROFILE_TABLE.map((profile) => profile.name).sort())
  })

  it("no game with a stored profile this version does not have", () => {
    const selection = resolveSelection(value(izzet.id), value<AiDeckChoice>({ kind: "deck", deckId: mono.id }), all)
    expect(planGame(selection, { profile: resolveAiProfile({ kind: "profile", name: "Aggressive" }) })).toBeNull()
  })

  it("no game while the choice does not allow one", () => {
    expect(planGame(resolveSelection(value(null), value(RANDOM), all))).toBeNull()
    // A Commander deck has no second Commander deck to draw.
    expect(planGame(resolveSelection(value(valki.id), value(RANDOM), all))).toBeNull()
    expect(planGame(resolveSelection(value(izzet.id), value<AiDeckChoice>({ kind: "deck", deckId: valki.id }), all))).toBeNull()
  })
})
