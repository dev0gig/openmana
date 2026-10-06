/*
 * Block declaration, from Forge's existing protocol (prompt 19). InputBlock
 * highlights the current attacker and supplies `action` only where its tap
 * would act. `playable` means can block SOME attacker, so is deliberately
 * not used as permission to block the current one. Combat holds Forge's
 * assignments, including several blockers and a blocker on several attackers.
 * No legality, damage forecast, or parsing of Forge's words here.
 */
import type { ButtonsQuestion, CombatEntry, GameState, VisibleCard } from "@openmana/engine-protocol"
import { isVisible, visibleCards } from "./table-model"

export interface BlockView {
  readonly question: ButtonsQuestion
  readonly attackers: readonly { readonly card: VisibleCard; readonly current: boolean; readonly blockers: readonly VisibleCard[] }[]
  readonly current: VisibleCard | null
  /** A distinct creature, even when Forge assigns it to several attackers. */
  readonly assigned: number
  readonly ready: number
  /** Used to re-arm confirmation when Forge changes the assignment. */
  readonly revision: string
}

/** Forge's selected attacker, from its highlight among the combat entries. */
export function blockCurrent(cards: readonly VisibleCard[], combat: readonly CombatEntry[]): number | null {
  return combat.find((entry) => cards.some((card) => card.id === entry.attacker && card.highlighted === true))?.attacker ?? null
}

export function blockView(state: GameState, question: ButtonsQuestion): BlockView {
  const cards = visibleCards(state)
  const current = blockCurrent([...cards.values()], state.combat)
  const attackers = state.combat.flatMap((entry) => {
    const card = cards.get(entry.attacker)
    return card === undefined ? [] : [{ card, current: card.id === current, blockers: entry.blockers.flatMap((id) => cards.get(id) ?? []) }]
  })
  const own = state.players.find((player) => player.me)?.zones.battlefield.filter(isVisible) ?? []
  const assigned = new Set(state.combat.flatMap((entry) => entry.blockers))
  return {
    question,
    attackers,
    current: attackers.find((entry) => entry.current)?.card ?? null,
    assigned: own.filter((card) => assigned.has(card.id)).length,
    ready: own.filter((card) => !assigned.has(card.id) && card.action !== undefined).length,
    revision: JSON.stringify(state.combat.map((entry) => [entry.attacker, entry.blockers])),
  }
}
