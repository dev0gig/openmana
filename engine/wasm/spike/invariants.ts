/*
 * Test-only checks of what a full snapshot promises beyond its schema: every
 * id it refers to can be resolved inside the same snapshot, so a UI never
 * needs an earlier state to draw this one (Bible §9.2, "full snapshots").
 * Used by the replay tests (Node, Chrome) and the JVM message check.
 *
 * Deliberately not part of the client: these are properties the engine must
 * guarantee and the tests verify, not rules a player's game should abort on.
 */
import type { GameState, Observation, VisibleCard } from "../../protocol/src/index.ts";

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
        // Protocol 10: Forge's land refusal only on a land of the player's own hand Forge does not mark playable, and only where the state says so.
        if (card.landRefusal !== undefined) {
          if (!p.me || zone !== "hand" || card.playable) problems.push(`card ${card.id}: a land refusal outside the player's hand or on a playable card`);
          if (card.landRefusal === "limit" && (p.landsUnlimited || p.landsPlayed < p.landsAllowed)) problems.push(`card ${card.id}: limit with ${p.landsPlayed}/${p.landsAllowed} lands`);
          if (card.landRefusal === "notYourTurn" && state.activePlayer === p.id) problems.push(`card ${card.id}: not your turn in the player's turn`);
        }
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

/** Ids of every visible card of a state: its zones and the cards on its stack (protocol 10: what the player has seen). */
export function visibleCardIds(state: GameState): Set<number> {
  const ids = new Set<number>();
  for (const p of state.players) {
    for (const list of Object.values(p.zones)) {
      for (const card of list) if ("id" in card) ids.add(card.id);
    }
  }
  for (const item of state.stack) if (item.card && "id" in item.card) ids.add(item.card.id);
  return ids;
}

/**
 * Protocol 10: problems of an observation against the cards the player has
 * seen in the states so far - a card it shows must have been visible, or come
 * into being in it (a created token: a move from no zone). A hidden card
 * never appears with an id.
 */
export function observationProblems(observation: Observation, seen: ReadonlySet<number>): string[] {
  const created = new Set<number>();
  const shown = new Set<number>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value !== null && typeof value === "object") {
      const o = value as Record<string, unknown>;
      if (typeof o["id"] === "number" && "owner" in o && "tapped" in o) shown.add(o["id"]);
      Object.values(o).forEach(visit);
    }
  };
  for (const action of observation.actions) {
    if (action.kind === "resolve" || action.kind === "combatDamage") {
      for (const move of action.results.moves) if (move.from === null) created.add(move.card.id);
    }
  }
  visit(observation.actions);
  return [...shown].filter((id) => !seen.has(id) && !created.has(id)).map((id) => `observation ${observation.id} shows card ${id}, which the player never saw`);
}
