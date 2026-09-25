/*
 * Which decks play the next game: the player's deck and the deck of Forge's
 * AI. Both choices are settings (the local database), so they stay until the
 * player changes them - choosing is not part of every game start (Anvil
 * lesson: one-time preferences stay out of the repeated path).
 *
 * - The player's deck decides the game's format: Forge plays both decks in
 *   one format (the protocol's MatchRequest.format), so the AI's deck must
 *   be of the same format. That is how Forge plays the decks, not a
 *   legality check (Forge decides that).
 * - The AI plays one of the player's own decks - or a random one: then one of
 *   the valid decks of the same format other than the player's own is drawn
 *   when the game starts (a new draw for every game). With no such deck a
 *   random draw is not possible and the page says why; the player's own
 *   deck can still be chosen for the AI explicitly (a mirror match).
 * - A chosen deck that was deleted or is damaged is shown as such, never
 *   silently replaced by another one.
 */
import type { CheckedRecords, LocalDatabase } from "@/storage/database"
import type { DeckFormat, DeckRecord } from "@/storage/generated/records"
import { listDecks } from "@/storage/decks"
import { defineSetting, readSetting, type SettingValue } from "@/storage/settings"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function isDeckId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}

export type AiDeckChoice = { readonly kind: "random" } | { readonly kind: "deck"; readonly deckId: string }

function isAiDeckChoice(value: unknown): value is AiDeckChoice {
  if (typeof value !== "object" || value === null) return false
  const keys = Object.keys(value).sort().join(",")
  const choice = value as { kind?: unknown; deckId?: unknown }
  if (choice.kind === "random") return keys === "kind"
  return choice.kind === "deck" && keys === "deckId,kind" && isDeckId(choice.deckId)
}

/** The player's deck (null: none chosen yet). */
export const HUMAN_DECK = defineSetting<string | null>("play.humanDeck", null, (value): value is string | null => value === null || isDeckId(value))

/** The AI's deck: a random one of the player's decks unless the player chose one. */
export const AI_DECK = defineSetting<AiDeckChoice>("play.aiDeck", { kind: "random" }, isAiDeckChoice)

export type HumanSide =
  | { readonly status: "none" }
  | { readonly status: "ok"; readonly deck: DeckRecord }
  /** The chosen deck is gone (deleted, or a backup replaced the decks). */
  | { readonly status: "missing" }
  | { readonly status: "damaged" }

export type AiSide =
  /** pool: the decks a draw can give; null while the player's deck is not chosen. */
  | { readonly status: "random"; readonly pool: readonly DeckRecord[] | null }
  | { readonly status: "ok"; readonly deck: DeckRecord }
  /** A deck of another format than the player's deck. */
  | { readonly status: "mismatch"; readonly deck: DeckRecord }
  | { readonly status: "missing" }
  | { readonly status: "damaged" }

/** What still stands in the way of a game (null: nothing - both decks are set). */
export type SelectionBlocker = "no-human" | "human-missing" | "human-damaged" | "random-empty" | "ai-mismatch" | "ai-missing" | "ai-damaged"

export interface PlaySelection {
  readonly human: HumanSide
  readonly ai: AiSide
  /** The game's format: the player's deck's. */
  readonly format: DeckFormat | null
  readonly blocker: SelectionBlocker | null
  /** A stored choice did not pass its check and the default is in use. */
  readonly reset: boolean
}

/** The decks a random draw for the AI can give: valid decks of the player's format, not the player's own. */
export function randomPool(human: DeckRecord, decks: readonly DeckRecord[]): DeckRecord[] {
  return decks.filter((deck) => deck.format === human.format && deck.id !== human.id)
}

/** One deck of the pool, each equally likely (`random` in [0, 1), Math.random by default). */
export function drawAiDeck(pool: readonly DeckRecord[], random: () => number = Math.random): DeckRecord {
  if (pool.length === 0) throw new Error("no deck to draw from")
  return pool[Math.min(Math.floor(random() * pool.length), pool.length - 1)]!
}

function side(id: string, decks: CheckedRecords<DeckRecord>): { readonly status: "ok"; readonly deck: DeckRecord } | { readonly status: "missing" | "damaged" } {
  const deck = decks.records.find((record) => record.id === id)
  if (deck !== undefined) return { status: "ok", deck }
  return decks.invalid.some((record) => record.key === id) ? { status: "damaged" } : { status: "missing" }
}

export function resolveSelection(human: SettingValue<string | null>, ai: SettingValue<AiDeckChoice>, decks: CheckedRecords<DeckRecord>): PlaySelection {
  const humanSide: HumanSide = human.value === null ? { status: "none" } : side(human.value, decks)
  const humanDeck = humanSide.status === "ok" ? humanSide.deck : null
  let aiSide: AiSide
  if (ai.value.kind === "random") {
    aiSide = { status: "random", pool: humanDeck === null ? null : randomPool(humanDeck, decks.records) }
  } else {
    const found = side(ai.value.deckId, decks)
    aiSide = found.status === "ok" && humanDeck !== null && found.deck.format !== humanDeck.format ? { status: "mismatch", deck: found.deck } : found
  }
  const blocker: SelectionBlocker | null =
    humanSide.status === "none"
      ? "no-human"
      : humanSide.status === "missing"
        ? "human-missing"
        : humanSide.status === "damaged"
          ? "human-damaged"
          : aiSide.status === "random"
            ? aiSide.pool !== null && aiSide.pool.length === 0
              ? "random-empty"
              : null
            : aiSide.status === "ok"
              ? null
              : aiSide.status === "mismatch"
                ? "ai-mismatch"
                : aiSide.status === "missing"
                  ? "ai-missing"
                  : "ai-damaged"
  return { human: humanSide, ai: aiSide, format: humanDeck?.format ?? null, blocker, reset: human.invalid || ai.invalid }
}

export interface StoredSelection {
  readonly human: SettingValue<string | null>
  readonly ai: SettingValue<AiDeckChoice>
  readonly decks: CheckedRecords<DeckRecord>
}

/** Both choices and the decks they refer to (for useStorageQuery on settings and decks). */
export async function readSelection(db: LocalDatabase): Promise<StoredSelection> {
  const [human, ai, decks] = await Promise.all([readSetting(db, HUMAN_DECK), readSetting(db, AI_DECK), listDecks(db)])
  return { human, ai, decks }
}
