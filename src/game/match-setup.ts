/*
 * A game from the player's deck choice (src/decks/deck-selection.ts) and AI
 * profile (src/game/ai-profiles.ts): which decks play and which profile - the
 * AI's deck and profile drawn now if "random" is chosen, anew for every game
 * - and exactly what Forge receives (match.start). A Jumpstart side (prompt
 * 61) is two halves, put together into the one deck Forge plays
 * (deck-mode.ts jumpstartDeck); the AI's two random halves are drawn anew for
 * every game as well, never the same half twice.
 *
 * The seed: the app draws it (48 random bits from the browser's
 * cryptographic generator) instead of leaving it to Forge, so the game's
 * randomness is known. Seed and inputs reproduce a game exactly (prompts
 * 02-05), which the match recording can keep (prompt 22). Every game still
 * gets its own random seed.
 */
import type { MatchRequest, MatchSettings } from "@openmana/engine-protocol"
import { jumpstartDeck } from "@/decks/deck-mode"
import { drawAiDeck, drawHalves, type PlaySelection } from "@/decks/deck-selection"
import type { MatchSetup, MatchSideSetup } from "@/engine/engine-session"
import type { DeckRecord } from "@/storage/generated/records"
import { DEFAULT_AI_PROFILE } from "./ai-profile-table"
import { drawAiProfile, type ResolvedAiProfile } from "./ai-profiles"
import { engineDeck, type DeckParts } from "./engine-deck"

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
  /**
   * Protocol 10 (prompt 49): the game's settings - the app asks the engine to
   * hold the opponent's actions for looking (observation "hold") and passes
   * the player's choice of Forge's auto-pass. Absent: Forge's defaults
   * (observation off, auto-pass noActions), as before.
   */
  readonly settings?: MatchSettings
}

/** One side's decks: one deck, or two Jumpstart halves (prompt 61), which Forge gets put together as one deck. */
export type SideDecks = DeckRecord | readonly [DeckRecord, DeckRecord]

function isPair(decks: SideDecks): decks is readonly [DeckRecord, DeckRecord] {
  return Array.isArray(decks)
}

function side(decks: SideDecks): { readonly deck: DeckParts; readonly setup: MatchSideSetup } {
  if (!isPair(decks)) return { deck: decks, setup: { deckId: decks.id, deckName: decks.name } }
  const [first, second] = decks
  const deck = jumpstartDeck(first, second)
  return {
    deck,
    setup: { deckId: null, deckName: deck.name, halves: [{ deckId: first.id, deckName: first.name }, { deckId: second.id, deckName: second.name }] },
  }
}

/**
 * Both sides as Forge gets them, in the player's deck's format (Forge plays
 * both in one); two halves are a constructed game of their joined decks.
 */
export function matchSetup(human: SideDecks, ai: SideDecks, options: MatchSetupOptions): MatchSetup {
  const humanSide = side(human)
  const aiSide = side(ai)
  const request: MatchRequest = {
    seed: options.seed,
    format: isPair(human) ? "constructed" : human.format,
    human: { name: HUMAN_NAME, deck: engineDeck(humanSide.deck) },
    ai: { name: AI_NAME, profile: options.profile ?? DEFAULT_AI_PROFILE, deck: engineDeck(aiSide.deck) },
    ...(options.settings !== undefined ? { settings: options.settings } : {}),
  }
  return {
    request,
    human: humanSide.setup,
    ai: { ...aiSide.setup, drawn: options.drawn, profileDrawn: options.profileDrawn ?? false },
  }
}

export interface PlanOptions {
  /** The AI profile as chosen (default: Forge's default profile). */
  readonly profile?: ResolvedAiProfile
  /** In [0, 1): the random draws of deck and profile (Math.random by default). */
  readonly random?: () => number
  readonly seed?: number
  /** The game's settings (MatchSetupOptions.settings). */
  readonly settings?: MatchSettings
}

/**
 * The next game for this choice, or null while the choice does not allow one
 * (selection.blocker, or a stored profile this engine does not have).
 */
export function planGame(selection: PlaySelection, options: PlanOptions = {}): MatchSetup | null {
  if (selection.blocker !== null || selection.human.status !== "ok") return null
  const chosen = options.profile ?? { status: "ok" as const, profile: { name: DEFAULT_AI_PROFILE } }
  if (chosen.status === "missing") return null
  const jumpstart = selection.mode === "jumpstart"
  const pair = (first: DeckRecord, half: PlaySelection["humanHalf"]): SideDecks | null => (half?.status === "ok" ? [first, half.deck] : null)
  const human = jumpstart ? pair(selection.human.deck, selection.humanHalf) : selection.human.deck
  const ai = selection.ai
  const pool = ai.status === "random" ? ai.pool : null
  const deck: SideDecks | null =
    ai.status === "ok"
      ? jumpstart
        ? pair(ai.deck, selection.aiHalf)
        : ai.deck
      : pool === null
        ? null
        : jumpstart
          ? pool.length >= 2
            ? drawHalves(pool, options.random)
            : null
          : pool.length > 0
            ? drawAiDeck(pool, options.random)
            : null
  if (human === null || deck === null) return null
  const seed = options.seed ?? randomSeed()
  const profile = chosen.status === "random" ? drawAiProfile(chosen.pool, options.random).name : chosen.profile.name
  return matchSetup(human, deck, { seed, drawn: ai.status === "random", profile, profileDrawn: chosen.status === "random", ...(options.settings !== undefined ? { settings: options.settings } : {}) })
}
