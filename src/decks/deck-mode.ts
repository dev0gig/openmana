/*
 * The mode a deck plays in. Nobody chooses it - it comes from the deck
 * itself (project owner, 2026-10-16; prompt 61, docs/implementation/61-jumpstart.md),
 * and every page asks this one function:
 *
 * - commander: the list names a commander (its Commander section - deck-plan.ts
 *   makes such a deck's format "commander"). Not the number 100: Forge must
 *   know which card is the commander, so a 100-card list without that section
 *   stays a normal deck.
 * - jumpstart: exactly 20 cards in the main deck and no commander - a
 *   Jumpstart half. Two different halves play together as one deck of 40.
 * - normal: everything else (typically 60 cards).
 *
 * Derived, never stored: a deck saved before prompt 61 with 20 cards is a
 * half at once, nothing in the local data, the backups or the ORYX cloud's
 * collection changes, and a deck whose main deck is edited to another size
 * changes its mode with it. Like the format it says how Forge plays the deck,
 * not whether the deck is legal (Forge decides that).
 *
 * Forge knows two formats (MatchRequest.format): a commander game, and
 * constructed for everything else - a Jumpstart game is a constructed game
 * with the two halves as one deck (jumpstartDeck).
 *
 * Node tooling imports this file (the engine proof of prompt 61), so it
 * imports without the app's aliases, like engine-deck.ts.
 */
import type { DeckCard, DeckFormat } from "../storage/generated/records.ts"
import type { DeckParts } from "../game/engine-deck.ts"

export type DeckMode = "normal" | "jumpstart" | "commander"
export const DECK_MODES: readonly DeckMode[] = ["normal", "jumpstart", "commander"]

/** The main deck of a Jumpstart half. */
export const HALF_SIZE = 20

/** What of a deck (or of an import's plan) decides its mode. */
export interface ModeParts {
  readonly format: DeckFormat
  readonly main: readonly { readonly count: number }[]
}

/** The cards of the main deck. */
export function mainCount(deck: Pick<ModeParts, "main">): number {
  return deck.main.reduce((sum, card) => sum + card.count, 0)
}

export function deckMode(deck: ModeParts): DeckMode {
  if (deck.format === "commander") return "commander"
  return mainCount(deck) === HALF_SIZE ? "jumpstart" : "normal"
}

/** The format Forge plays a game of this mode in. */
export function engineFormat(mode: DeckMode): DeckFormat {
  return mode === "commander" ? "commander" : "constructed"
}

/** The name the joined deck has in Forge, in the game page and in the recording: "Jumpstart: Goblins + Elfen". */
export function jumpstartName(first: { readonly name: string }, second: { readonly name: string }): string {
  return `Jumpstart: ${first.name} + ${second.name}`
}

function join(target: Map<string, number>, cards: readonly DeckCard[]): void {
  for (const card of cards) target.set(card.name, (target.get(card.name) ?? 0) + card.count)
}

/**
 * Two halves as the one deck Forge plays: the main decks put together - the
 * counts of a card both halves have added up, in the order the cards first
 * appear -, no sideboard and no commander.
 */
export function jumpstartDeck(first: DeckParts, second: DeckParts): DeckParts {
  const counts = new Map<string, number>()
  join(counts, first.main)
  join(counts, second.main)
  return { name: jumpstartName(first, second), main: [...counts].map(([name, count]) => ({ name, count })), sideboard: [], commander: [] }
}
