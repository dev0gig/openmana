/*
 * A game from the player's deck choice (src/decks/deck-selection.ts) and AI
 * profile (src/game/ai-profiles.ts): which decks play and which profile - the
 * AI's deck and profile drawn now if "random" is chosen, anew for every game
 * - and exactly what Forge receives (match.start).
 *
 * The seed: the app draws it (48 random bits from the browser's
 * cryptographic generator) instead of leaving it to Forge, so the game's
 * randomness is known. Seed and inputs reproduce a game exactly (prompts
 * 02-05), which the match recording can keep (prompt 22). Every game still
 * gets its own random seed.
 */
import type { MatchRequest } from "@openmana/engine-protocol"
import { drawAiDeck, type PlaySelection } from "@/decks/deck-selection"
import type { MatchSetup } from "@/engine/engine-session"
import type { DeckRecord } from "@/storage/generated/records"
import { DEFAULT_AI_PROFILE } from "./ai-profile-table"
import { drawAiProfile, type ResolvedAiProfile } from "./ai-profiles"
import { engineDeck } from "./engine-deck"

/** How Forge calls the players (its game log uses the names; the app says "Du" and "Forge-KI"). */
export const HUMAN_NAME = "Spieler"
export const AI_NAME = "Forge-KI"

/** Largest seed + 1: java.util.Random, which Forge seeds with it, keeps 48 bits. */
export const SEED_LIMIT = 2 ** 48

/** 48 random bits as a safe integer (0 ≤ seed < 2^48). */
export function randomSeed(values: Uint32Array = crypto.getRandomValues(new Uint32Array(2))): number {
  return (values[0]! & 0xffff) * 0x1_0000_0000 + values[1]!
}

export interface MatchSetupOptions {
  readonly seed: number
  /** The AI's deck was drawn at random. */
  readonly drawn: boolean
  /** Forge's AI profile (default: Forge's default profile). */
  readonly profile?: string
  /** The profile was drawn at random. */
  readonly profileDrawn?: boolean
}

/** Both decks as Forge gets them, in the player's deck's format (Forge plays both in one). */
export function matchSetup(human: DeckRecord, ai: DeckRecord, options: MatchSetupOptions): MatchSetup {
  const request: MatchRequest = {
    seed: options.seed,
    format: human.format,
    human: { name: HUMAN_NAME, deck: engineDeck(human) },
    ai: { name: AI_NAME, profile: options.profile ?? DEFAULT_AI_PROFILE, deck: engineDeck(ai) },
  }
  return {
    request,
    human: { deckId: human.id, deckName: human.name },
    ai: { deckId: ai.id, deckName: ai.name, drawn: options.drawn, profileDrawn: options.profileDrawn ?? false },
  }
}

export interface PlanOptions {
  /** The AI profile as chosen (default: Forge's default profile). */
  readonly profile?: ResolvedAiProfile
  /** In [0, 1): the random draws of deck and profile (Math.random by default). */
  readonly random?: () => number
  readonly seed?: number
}

/**
 * The next game for this choice, or null while the choice does not allow one
 * (selection.blocker, or a stored profile this engine does not have).
 */
export function planGame(selection: PlaySelection, options: PlanOptions = {}): MatchSetup | null {
  if (selection.blocker !== null || selection.human.status !== "ok") return null
  const chosen = options.profile ?? { status: "ok" as const, profile: { name: DEFAULT_AI_PROFILE } }
  if (chosen.status === "missing") return null
  const seed = options.seed ?? randomSeed()
  const human = selection.human.deck
  const ai = selection.ai
  const deck = ai.status === "ok" ? ai.deck : ai.status === "random" && ai.pool !== null && ai.pool.length > 0 ? drawAiDeck(ai.pool, options.random) : null
  if (deck === null) return null
  const profile = chosen.status === "random" ? drawAiProfile(chosen.pool, options.random).name : chosen.profile.name
  return matchSetup(human, deck, { seed, drawn: ai.status === "random", profile, profileDrawn: chosen.status === "random" })
}
