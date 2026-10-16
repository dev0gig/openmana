/*
 * Which decks play the next game: the player's deck and the deck of Forge's
 * AI. The choices are settings (the local database), so they stay until the
 * player changes them - choosing is not part of every game start (Anvil
 * lesson: one-time preferences stay out of the repeated path).
 *
 * - The player's deck decides the game's mode (deck-mode.ts: commander,
 *   Jumpstart half, normal) - nobody chooses a mode (prompt 61). Forge plays
 *   both sides in one format, so the AI's decks are of the same mode. That is
 *   how Forge plays the decks, not a legality check (Forge decides that).
 * - Jumpstart (prompt 61): the player's deck is a half; a second half
 *   (play.humanHalf) completes it, and the AI plays two halves as well -
 *   play.aiDeck and play.aiHalf, or both drawn at random. One side never plays
 *   the same half twice. A half stays one deck in the library; the two are put
 *   together only for the game (deck-mode.ts jumpstartDeck).
 * - The AI plays the player's own decks - chosen ones, or a random draw when
 *   the game starts (a new draw for every game) from the valid decks of the
 *   same mode other than the player's own. With too few such decks a random
 *   draw is not possible and the page says why; the player's own decks can
 *   still be chosen for the AI explicitly (a mirror match).
 * - A chosen deck that was deleted, is damaged or stopped fitting the mode is
 *   shown as such, never silently replaced by another one. The second halves
 *   only count while the player's deck is a half; they stay stored meanwhile.
 */
import type { CheckedRecords, LocalDatabase } from "@/storage/database"
import type { DeckRecord } from "@/storage/generated/records"
import { listDecks } from "@/storage/decks"
import { defineSetting, readSetting, type SettingValue } from "@/storage/settings"
import { deckMode, type DeckMode } from "./deck-mode"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function isDeckId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}

function isDeckIdOrNull(value: unknown): value is string | null {
  return value === null || isDeckId(value)
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
export const HUMAN_DECK = defineSetting<string | null>("play.humanDeck", null, isDeckIdOrNull)

/** The player's second Jumpstart half (null: none chosen yet); counts only while the player's deck is a half. */
export const HUMAN_HALF = defineSetting<string | null>("play.humanHalf", null, isDeckIdOrNull)

/** The AI's deck - its first half in a Jumpstart game: a random one of the player's decks unless the player chose one. */
export const AI_DECK = defineSetting<AiDeckChoice>("play.aiDeck", { kind: "random" }, isAiDeckChoice)

/** The AI's second Jumpstart half; counts only while the AI's halves are chosen (not random) in a Jumpstart game. */
export const AI_HALF = defineSetting<string | null>("play.aiHalf", null, isDeckIdOrNull)

type Found = { readonly status: "ok"; readonly deck: DeckRecord } | { readonly status: "missing" | "damaged" }

export type HumanSide =
  | { readonly status: "none" }
  | { readonly status: "ok"; readonly deck: DeckRecord }
  /** The chosen deck is gone (deleted, or a backup replaced the decks). */
  | { readonly status: "missing" }
  | { readonly status: "damaged" }

/** A second Jumpstart half, the player's or the AI's. */
export type HalfSide =
  | HumanSide
  /** Not a half (another mode). */
  | { readonly status: "mismatch"; readonly deck: DeckRecord }
  /** The same half as the first of this side. */
  | { readonly status: "same"; readonly deck: DeckRecord }

export type AiSide =
  /** pool: the decks a draw can give; null while the player's deck is not chosen. */
  | { readonly status: "random"; readonly pool: readonly DeckRecord[] | null }
  | { readonly status: "ok"; readonly deck: DeckRecord }
  /** A deck of another mode than the player's deck. */
  | { readonly status: "mismatch"; readonly deck: DeckRecord }
  | { readonly status: "missing" }
  | { readonly status: "damaged" }

/** What still stands in the way of a game (null: nothing - all decks are set). */
export type SelectionBlocker =
  | "no-human"
  | "human-missing"
  | "human-damaged"
  | "no-human-half"
  | "human-half-missing"
  | "human-half-damaged"
  | "human-half-mismatch"
  | "human-half-same"
  | "random-empty"
  | "random-halves"
  | "ai-mismatch"
  | "ai-missing"
  | "ai-damaged"
  | "no-ai-half"
  | "ai-half-missing"
  | "ai-half-damaged"
  | "ai-half-mismatch"
  | "ai-half-same"

export interface PlaySelection {
  readonly human: HumanSide
  /** The player's second half: only while the player's deck is a Jumpstart half (else null). */
  readonly humanHalf: HalfSide | null
  readonly ai: AiSide
  /** The AI's second half: only in a Jumpstart game with the AI's halves chosen, not random (else null). */
  readonly aiHalf: HalfSide | null
  /** The game's mode: the player's deck's (null while it is not chosen). */
  readonly mode: DeckMode | null
  readonly blocker: SelectionBlocker | null
  /** A stored choice did not pass its check and the default is in use. */
  readonly reset: boolean
}

/** How many decks a random draw for the AI takes in this mode: two halves, else one deck. */
export function drawSize(mode: DeckMode): 1 | 2 {
  return mode === "jumpstart" ? 2 : 1
}

/** The decks a random draw for the AI can give: valid decks of the mode, not the player's own (`own`: the player's deck and second half). */
export function randomPool(mode: DeckMode, own: readonly DeckRecord[], decks: readonly DeckRecord[]): DeckRecord[] {
  return decks.filter((deck) => deckMode(deck) === mode && !own.some((mine) => mine.id === deck.id))
}

/** One deck of the pool, each equally likely (`random` in [0, 1), Math.random by default). */
export function drawAiDeck(pool: readonly DeckRecord[], random: () => number = Math.random): DeckRecord {
  if (pool.length === 0) throw new Error("no deck to draw from")
  return pool[Math.min(Math.floor(random() * pool.length), pool.length - 1)]!
}

/** Two different halves of the pool, each pair equally likely. */
export function drawHalves(pool: readonly DeckRecord[], random: () => number = Math.random): readonly [DeckRecord, DeckRecord] {
  if (pool.length < 2) throw new Error("fewer than two halves to draw from")
  const first = drawAiDeck(pool, random)
  return [first, drawAiDeck(pool.filter((deck) => deck.id !== first.id), random)]
}

function find(id: string, decks: CheckedRecords<DeckRecord>): Found {
  const deck = decks.records.find((record) => record.id === id)
  if (deck !== undefined) return { status: "ok", deck }
  return decks.invalid.some((record) => record.key === id) ? { status: "damaged" } : { status: "missing" }
}

/** A second half: chosen, a half, and not the side's first. */
function half(id: string | null, first: DeckRecord | null, decks: CheckedRecords<DeckRecord>): HalfSide {
  if (id === null) return { status: "none" }
  const found = find(id, decks)
  if (found.status !== "ok") return found
  if (deckMode(found.deck) !== "jumpstart") return { status: "mismatch", deck: found.deck }
  return first !== null && first.id === found.deck.id ? { status: "same", deck: found.deck } : found
}

const HUMAN_BLOCKERS = { none: "no-human", missing: "human-missing", damaged: "human-damaged" } as const
const HUMAN_HALF_BLOCKERS = { none: "no-human-half", missing: "human-half-missing", damaged: "human-half-damaged", mismatch: "human-half-mismatch", same: "human-half-same" } as const
const AI_BLOCKERS = { mismatch: "ai-mismatch", missing: "ai-missing", damaged: "ai-damaged" } as const
const AI_HALF_BLOCKERS = { none: "no-ai-half", missing: "ai-half-missing", damaged: "ai-half-damaged", mismatch: "ai-half-mismatch", same: "ai-half-same" } as const

export interface StoredSelection {
  readonly human: SettingValue<string | null>
  readonly humanHalf: SettingValue<string | null>
  readonly ai: SettingValue<AiDeckChoice>
  readonly aiHalf: SettingValue<string | null>
  readonly decks: CheckedRecords<DeckRecord>
}

/** The second halves' settings (absent: none stored). */
export interface StoredHalves {
  readonly human?: SettingValue<string | null>
  readonly ai?: SettingValue<string | null>
}

const NO_HALF: SettingValue<string | null> = { value: null, stored: false, invalid: false }

export function resolveSelection(
  humanChoice: SettingValue<string | null>,
  aiChoice: SettingValue<AiDeckChoice>,
  decks: CheckedRecords<DeckRecord>,
  halves: StoredHalves = {},
): PlaySelection {
  const stored = { human: humanChoice, humanHalf: halves.human ?? NO_HALF, ai: aiChoice, aiHalf: halves.ai ?? NO_HALF }
  const human: HumanSide = stored.human.value === null ? { status: "none" } : find(stored.human.value, decks)
  const humanDeck = human.status === "ok" ? human.deck : null
  const mode = humanDeck === null ? null : deckMode(humanDeck)
  const humanHalf = mode === "jumpstart" ? half(stored.humanHalf.value, humanDeck, decks) : null
  const own = [humanDeck, humanHalf?.status === "ok" ? humanHalf.deck : null].filter((deck) => deck !== null)
  let ai: AiSide
  let aiHalf: HalfSide | null = null
  if (stored.ai.value.kind === "random") {
    ai = { status: "random", pool: mode === null ? null : randomPool(mode, own, decks.records) }
  } else {
    const found = find(stored.ai.value.deckId, decks)
    ai = found.status === "ok" && mode !== null && deckMode(found.deck) !== mode ? { status: "mismatch", deck: found.deck } : found
    if (mode === "jumpstart") aiHalf = half(stored.aiHalf.value, ai.status === "ok" ? ai.deck : null, decks)
  }
  const blocker: SelectionBlocker | null =
    human.status !== "ok"
      ? HUMAN_BLOCKERS[human.status]
      : humanHalf !== null && humanHalf.status !== "ok"
        ? HUMAN_HALF_BLOCKERS[humanHalf.status]
        : ai.status === "random"
          ? ai.pool !== null && mode !== null && ai.pool.length < drawSize(mode)
            ? mode === "jumpstart"
              ? "random-halves"
              : "random-empty"
            : null
          : ai.status !== "ok"
            ? AI_BLOCKERS[ai.status]
            : aiHalf !== null && aiHalf.status !== "ok"
              ? AI_HALF_BLOCKERS[aiHalf.status]
              : null
  return {
    human,
    humanHalf,
    ai,
    aiHalf,
    mode,
    blocker,
    reset: stored.human.invalid || stored.humanHalf.invalid || stored.ai.invalid || stored.aiHalf.invalid,
  }
}

/** The stored choices resolved against the stored decks. */
export function resolveStored(stored: StoredSelection): PlaySelection {
  return resolveSelection(stored.human, stored.ai, stored.decks, { human: stored.humanHalf, ai: stored.aiHalf })
}

/** The choices and the decks they refer to (for useStorageQuery on settings and decks). */
export async function readSelection(db: LocalDatabase): Promise<StoredSelection> {
  const [human, humanHalf, ai, aiHalf, decks] = await Promise.all([
    readSetting(db, HUMAN_DECK),
    readSetting(db, HUMAN_HALF),
    readSetting(db, AI_DECK),
    readSetting(db, AI_HALF),
    listDecks(db),
  ])
  return { human, humanHalf, ai, aiHalf, decks }
}
