/*
 * Forge's declaration of the player's attackers, as the decision region
 * shows it (prompt 18). Pure: no React, no engine. Everything comes from
 * Forge's structured state - its declaration in progress (GameState.attack:
 * the defender, every defender, the creatures a tap would not declare with
 * Forge's reason), the cards it marks (`attacking`, `playable`) and the
 * meanings of its buttons (Button.meaning). Nothing here is a rule: who can
 * attack whom, Forge alone says.
 */
import type { Attack, ButtonsQuestion, Button as ForgeButton, EntityRef, GameState, Player, VisibleCard } from "@openmana/engine-protocol"
import { ATTACK_REFUSAL_WORDS, type RefusalWords } from "./attack-labels"
import { isEntity } from "./card-use"
import { cardName, seatName } from "./table-labels"

/** A defender Forge offers: a player, or a planeswalker or battle. */
export interface DefenderView {
  readonly ref: EntityRef
  /** The player as a seat's name ("Forge-KI"), a card by its name. */
  readonly name: string
  /** The player's life or the card's loyalty, in words; null without either. */
  readonly detail: string | null
  /** Whether a creature tapped now attacks it (Forge's current defender). */
  readonly current: boolean
  readonly player: Player | null
  readonly card: VisibleCard | null
}

export interface AttackView {
  readonly question: ButtonsQuestion
  readonly attack: Attack
  /** Whom a creature tapped now attacks; null: Forge names none. */
  readonly defender: DefenderView | null
  /** Every defender Forge offers, in its order. */
  readonly defenders: readonly DefenderView[]
  /** The player's creatures declared as attackers so far. */
  readonly attackers: readonly VisibleCard[]
  /**
   * How many more creatures Forge would declare on a tap: its marker, less
   * those it names unavailable for the defender now (the marker also carries
   * creatures that could attack only another defender).
   */
  readonly ready: number
  /** The player's creatures Forge would not declare now, with its reason. */
  readonly unavailable: readonly { readonly card: VisibleCard; readonly words: RefusalWords }[]
  /** Forge's OK: attack with the declared creatures (none: no attack). */
  readonly declare: ForgeButton | null
  /** Forge's second button: Alpha Strike or Call Back, by its meaning. */
  readonly second: { readonly button: ForgeButton; readonly meaning: "attackAll" | "callBack" } | null
}

function visible(cards: readonly GameState["players"][number]["zones"]["battlefield"][number][]): VisibleCard[] {
  return cards.filter((card): card is VisibleCard => !("hidden" in card))
}

function defenderView(state: GameState, ref: EntityRef, attack: Attack): DefenderView | null {
  const current = isEntity(attack.defender, ref.kind, ref.id)
  if (ref.kind === "player") {
    const player = state.players.find((candidate) => candidate.id === ref.id)
    if (player === undefined) return null
    return { ref, name: seatName(player.me ? "me" : "opponent"), detail: `${player.life} Leben`, current, player, card: null }
  }
  for (const player of state.players) {
    const card = visible(player.zones.battlefield).find((candidate) => candidate.id === ref.id)
    if (card !== undefined) {
      const detail = card.loyalty !== undefined && card.loyalty !== null ? `Loyalität ${card.loyalty}` : null
      return { ref, name: cardName(card), detail, current, player: null, card }
    }
  }
  return null
}

/** The declaration as the region shows it; null when Forge sends no declaration with its buttons (then Forge's own words stand). */
export function attackView(state: GameState, question: ButtonsQuestion): AttackView | null {
  const attack = state.attack
  if (attack === undefined) return null
  const mine = state.players.find((player) => player.me)
  const field = mine === undefined ? [] : visible(mine.zones.battlefield)
  const cards = new Map(field.map((card) => [card.id, card]))
  const defenders = attack.defenders.map((ref) => defenderView(state, ref, attack)).filter((view): view is DefenderView => view !== null)
  const second = question.buttons.find((button) => button.nr === 2)
  const meaning = second?.meaning
  const refused = new Set(attack.unavailable.map((entry) => entry.card))
  return {
    question,
    attack,
    defender: defenders.find((view) => view.current) ?? null,
    defenders,
    attackers: field.filter((card) => card.attacking === true),
    ready: field.filter((card) => card.attacking !== true && card.playable === true && !refused.has(card.id)).length,
    unavailable: attack.unavailable.flatMap((entry) => {
      const card = cards.get(entry.card)
      return card === undefined ? [] : [{ card, words: ATTACK_REFUSAL_WORDS[entry.reason] }]
    }),
    declare: question.buttons.find((button) => button.nr === 1) ?? null,
    second: second !== undefined && (meaning === "attackAll" || meaning === "callBack") ? { button: second, meaning } : null,
  }
}
