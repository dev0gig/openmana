/*
 * A deck of the library as Forge receives it: the protocol's Deck, entry for
 * entry, with the card name Forge knows (DeckCard.name, prompt 09) and its
 * count. Decks travel as data in match.start - no file, no server (Bible
 * §2, research §3.2). Forge picks its own printing (the art never changes a
 * rule); the Scryfall identities stay in the library for display.
 *
 * The companion is in the sideboard already (prompt 09: Forge looks for it
 * there), so DeckRecord.companion is not handed over a second time.
 *
 * Node tooling uses this very function (the end-to-end test hands decks to
 * the real engine with it, scripts/e2e/engine-decks.ts), so it imports
 * without the app's aliases and spells the protocol's Deck out;
 * match-setup.ts puts it into a MatchRequest, which the compiler checks.
 */
import type { DeckCard } from "../storage/generated/records.ts"

/** The protocol's DeckEntry. */
export interface EngineDeckEntry {
  card: string
  count: number
}

/** The protocol's Deck (engine/protocol). */
export interface EngineDeck {
  name: string
  main: [EngineDeckEntry, ...EngineDeckEntry[]]
  sideboard?: EngineDeckEntry[]
  commander?: EngineDeckEntry[]
}

/** What of a deck Forge needs (a DeckRecord has it). */
export interface DeckParts {
  readonly name: string
  readonly main: readonly DeckCard[]
  readonly sideboard: readonly DeckCard[]
  readonly commander: readonly DeckCard[]
}

function entries(cards: readonly DeckCard[]): EngineDeckEntry[] {
  return cards.map((card) => ({ card: card.name, count: card.count }))
}

/** The deck for match.start. Empty sections are left out. */
export function engineDeck(deck: DeckParts): EngineDeck {
  const [first, ...rest] = entries(deck.main)
  if (first === undefined) throw new Error(`deck ${deck.name} has no main deck`)
  return {
    name: deck.name,
    main: [first, ...rest],
    ...(deck.sideboard.length > 0 ? { sideboard: entries(deck.sideboard) } : {}),
    ...(deck.commander.length > 0 ? { commander: entries(deck.commander) } : {}),
  }
}
