/*
 * A game from the player's deck choice (src/decks/deck-selection.ts): which
 * decks play - the AI's drawn now if "random" is chosen, anew for every game
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
import { engineDeck } from "./engine-deck"

/** How Forge calls the players (its game log uses the names; the app says "Du" and "Forge-KI"). */
export const HUMAN_NAME = "Spieler"
export const AI_NAME = "Forge-KI"

/** Forge's default AI profile (res/ai/Default.ai). Choosing one is prompt 12. */
export const DEFAULT_AI_PROFILE = "Default"

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
  readonly profile?: string
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
    ai: { deckId: ai.id, deckName: ai.name, drawn: options.drawn },
  }
}

export interface PlanOptions {
  /** In [0, 1): the random deck draw (Math.random by default). */
  readonly random?: () => number
  readonly seed?: number
}

/** The next game for this choice, or null while the choice does not allow one (selection.blocker). */
export function planGame(selection: PlaySelection, options: PlanOptions = {}): MatchSetup | null {
  if (selection.blocker !== null || selection.human.status !== "ok") return null
  const seed = options.seed ?? randomSeed()
  const human = selection.human.deck
  const ai = selection.ai
  if (ai.status === "ok") return matchSetup(human, ai.deck, { seed, drawn: false })
  if (ai.status === "random" && ai.pool !== null && ai.pool.length > 0) return matchSetup(human, drawAiDeck(ai.pool, options.random), { seed, drawn: true })
  return null
}
