/*
 * Test-only checks of what a full snapshot promises beyond its schema: every
 * id it refers to can be resolved inside the same snapshot, so a UI never
 * needs an earlier state to draw this one (Bible §9.2, "full snapshots").
 * Used by the replay tests (Node, Chrome) and the JVM message check.
 *
 * Deliberately not part of the client: these are properties the engine must
 * guarantee and the tests verify, not rules a player's game should abort on.
 */
import type { GameState, VisibleCard } from "../../protocol/src/index.ts";

/** Problems of one snapshot; empty if it is self-contained. */
export function snapshotProblems(state: GameState): string[] {
  const problems: string[] = [];
  const players = new Set<number>();
  for (const p of state.players) {
    if (players.has(p.id)) problems.push(`player id ${p.id} twice`);
    players.add(p.id);
  }
  const me = state.players.filter((p) => p.me);
  if (state.me === null ? me.length !== 0 : me.length !== 1 || me[0]!.id !== state.me) {
    problems.push(`state.me=${state.me} but players marked me: ${me.map((p) => p.id).join(",")}`);
  }
  if (state.activePlayer !== null && !players.has(state.activePlayer)) problems.push(`activePlayer ${state.activePlayer} is not a player`);

  const cards = new Map<number, VisibleCard>();
  const battlefield = new Set<number>();
  for (const p of state.players) {
    for (const [zone, list] of Object.entries(p.zones)) {
      for (const card of list) {
        if (!("id" in card)) continue;
        if (cards.has(card.id)) problems.push(`card ${card.id} appears twice`);
        cards.set(card.id, card);
        if (zone === "battlefield") battlefield.add(card.id);
        if (card.owner !== null && !players.has(card.owner)) problems.push(`card ${card.id}: owner ${card.owner} is not a player`);
        if (card.controller !== null && !players.has(card.controller)) problems.push(`card ${card.id}: controller ${card.controller} is not a player`);
      }
    }
  }
  for (const card of cards.values()) {
    if (card.attachedTo !== undefined && !cards.has(card.attachedTo)) problems.push(`card ${card.id} is attached to ${card.attachedTo}, which is not in the snapshot`);
    for (const a of card.attached ?? []) {
      if (!cards.has(a)) problems.push(`card ${card.id} carries ${a}, which is not in the snapshot`);
    }
  }
  for (const c of state.combat) {
    if (!battlefield.has(c.attacker)) problems.push(`attacker ${c.attacker} is not on the battlefield`);
    for (const b of c.blockers) {
      if (!battlefield.has(b)) problems.push(`blocker ${b} is not on the battlefield`);
    }
    if (c.defenderKind === "player" && (c.defender === null || !players.has(c.defender))) problems.push(`attacker ${c.attacker} attacks unknown player ${c.defender}`);
    if (c.defenderKind === "card" && (c.defender === null || !battlefield.has(c.defender))) problems.push(`attacker ${c.attacker} attacks card ${c.defender}, which is not on the battlefield`);
  }
  for (const item of state.stack) {
    if (item.player !== null && !players.has(item.player)) problems.push(`stack item ${item.id}: player ${item.player} is not a player`);
    for (const t of item.targets) {
      if (t.kind === "player" && !players.has(t.id)) problems.push(`stack item ${item.id} targets unknown player ${t.id}`);
    }
  }
  return problems;
}

/** Hidden cards in the hands of players other than "me" vs. visible ones (the tests expect none visible). */
export function opponentHand(state: GameState): { hidden: number; visible: number } {
  let hidden = 0;
  let visible = 0;
  for (const p of state.players) {
    if (p.me) continue;
    for (const card of p.zones.hand) {
      if ("id" in card) visible++;
      else hidden++;
    }
  }
  return { hidden, visible };
}
