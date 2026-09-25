/*
 * The game table as data (prompt 13): who sits where, what lies in which row
 * of a battlefield, which identical cards lie as one pile, which auras and
 * equipment belong to which card, what is on the stack and who fights whom -
 * derived from Forge's full state (and the open questions) and nothing else.
 * Pure: no React, no database, no network.
 *
 * Nothing here is a Magic rule. Every value is Forge's; this module only
 * arranges them:
 *  - Seats come from the state's structured `me` flags, never from names.
 *  - A battlefield has two rows, like Anvil's table: cards with power and
 *    toughness (Forge sends them only for creatures and cards with printed
 *    power/toughness, e.g. vehicles) lie in the row next to the middle, all
 *    other permanents in the outer row. That is a field that is there or not,
 *    not a type check; a card Forge makes a creature moves by itself.
 *  - Identical cards form one pile ("9 × Gebirge"): every value Forge sends
 *    about them is the same (tapped, counters, damage, markers ...), only the
 *    id differs. A card Forge names anywhere else - in a question, on the
 *    stack, in combat, as host or attachment - always stays single, so the one
 *    card that matters is never hidden in a pile (Anvil lesson).
 *  - An aura or equipment lies with the card it is attached to (attachedTo),
 *    on whichever side that card is.
 *  - Hidden cards (Forge's mayView said no) are only counted: they have no id
 *    and no name, and nothing here tries to tell them apart.
 * The stack is in Forge's order: the first item is the top (Forge's
 * MagicStack adds to the front), the one that resolves next.
 */
import type { Card, CombatEntry, GameState, Phase, Player, Question, StackItem, VisibleCard } from "@openmana/engine-protocol"

export type Seat = "me" | "opponent"

/** One place in a battlefield row: a card (alone or a pile of identical ones) or a hidden card. */
export type BoardEntry =
  | {
      readonly kind: "card"
      /** Stable for React: the first card's id. */
      readonly key: string
      /** The card shown (the first of the pile). */
      readonly card: VisibleCard
      /** Every card of the pile, in Forge's order (one for a single card). */
      readonly ids: readonly number[]
      /** Auras, equipment … attached to this card (from any battlefield), in Forge's order. */
      readonly attachments: readonly VisibleCard[]
    }
  | { readonly kind: "hidden"; readonly key: string }

export interface BoardRows {
  /** Cards with power and toughness (Forge's fields), the row next to the middle of the table. */
  readonly creatures: readonly BoardEntry[]
  /** Everything else: lands, other permanents, hidden cards. */
  readonly others: readonly BoardEntry[]
}

export interface ZoneCounts {
  readonly hand: number
  readonly library: number
  readonly graveyard: number
  readonly exile: number
  readonly command: number
}

export type ManaColor = "W" | "U" | "B" | "R" | "G" | "C"

export const MANA_COLORS: readonly ManaColor[] = ["W", "U", "B", "R", "G", "C"]

export interface TableSide {
  readonly seat: Seat
  readonly player: Player
  /** Forge's active player (whose turn it is). */
  readonly active: boolean
  readonly battlefield: BoardRows
  /** The hand as Forge sends it: the player's own cards, the opponent's hidden (or revealed) ones. */
  readonly hand: readonly Card[]
  /** The command zone (commanders, emblems, Forge's effect cards). */
  readonly command: readonly Card[]
  readonly counts: ZoneCounts
  /** Mana in the pool, colours with nothing left out. */
  readonly mana: readonly { readonly color: ManaColor; readonly amount: number }[]
  /** The player's counters (poison, energy …), Forge's names; zero ones left out. */
  readonly counters: readonly { readonly name: string; readonly amount: number }[]
}

export type PlayerRef = { readonly kind: "player"; readonly id: number; readonly seat: Seat | null }
export type CardRef = { readonly kind: "card"; readonly id: number; readonly card: VisibleCard | null }

export interface StackEntryView {
  readonly id: number
  /** Forge's own description of the spell or ability. */
  readonly text: string | null
  /** Who put it there (null: Forge did not say). */
  readonly controller: Seat | null
  readonly trigger: boolean
  /** The source card, if it is visible somewhere on the table (a spell's card is on the stack itself, which is no zone the player gets). */
  readonly source: CardRef | null
  readonly targets: readonly (PlayerRef | CardRef)[]
}

export interface CombatView {
  readonly attacker: CardRef
  /** Whom it attacks: a player, a planeswalker or battle (a card), or null if Forge did not say. */
  readonly defender: PlayerRef | CardRef | null
  readonly blockers: readonly CardRef[]
}

export interface TableView {
  readonly turn: number
  readonly phase: Phase | null
  /** Whose turn it is (null before the first turn). */
  readonly activeSeat: Seat | null
  /** The player (null only if Forge sends no player marked as `me`). */
  readonly me: TableSide | null
  /** Everyone else - in OpenMana's games one AI. */
  readonly opponents: readonly TableSide[]
  readonly stack: readonly StackEntryView[]
  readonly combat: readonly CombatView[]
}

export function isVisible(card: Card): card is VisibleCard {
  return !("hidden" in card)
}

/** Every visible card of the state by id: all zones of all players and their commanders. */
export function visibleCards(state: GameState): ReadonlyMap<number, VisibleCard> {
  const cards = new Map<number, VisibleCard>()
  for (const player of state.players) {
    const { battlefield, hand, graveyard, exile, command } = player.zones
    for (const card of [...battlefield, ...hand, ...graveyard, ...exile, ...command]) if (isVisible(card)) cards.set(card.id, card)
    for (const commander of player.commanders) if (isVisible(commander.card) && !cards.has(commander.card.id)) cards.set(commander.card.id, commander.card)
  }
  return cards
}

/** The card ids Forge names outside the card itself: questions, stack, combat, attachments. They never go into a pile. */
export function namedCardIds(state: GameState, questions: readonly Question[]): ReadonlySet<number> {
  const ids = new Set<number>()
  for (const question of questions) {
    if ("card" in question && question.card !== undefined) ids.add(question.card)
    if (question.kind === "select") for (const id of question.cards) ids.add(id)
    if ("items" in question) for (const item of question.items) if ("card" in item && item.card !== undefined) ids.add(item.card)
  }
  for (const item of state.stack) {
    if (item.source !== null) ids.add(item.source)
    for (const target of item.targets) if (target.kind === "card") ids.add(target.id)
  }
  for (const entry of state.combat) {
    ids.add(entry.attacker)
    for (const blocker of entry.blockers) ids.add(blocker)
    if (entry.defenderKind === "card" && entry.defender !== null) ids.add(entry.defender)
  }
  for (const player of state.players) {
    for (const card of player.zones.battlefield) {
      if (!isVisible(card)) continue
      if (card.attachedTo !== undefined) ids.add(card.id)
      if (card.attached !== undefined) ids.add(card.id)
    }
  }
  return ids
}

/** JSON with the keys of every object sorted (Forge's key order is not part of the meaning). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

/** Everything Forge says about a card except its id: equal signatures = the same card in the same state. */
function signature(card: VisibleCard): string {
  const { id: _id, ...rest } = card
  return canonical(rest)
}

function hasStats(card: VisibleCard): boolean {
  return card.power !== undefined && card.toughness !== undefined
}

/**
 * The rows of one battlefield. `hosted` holds the ids of cards that lie with
 * their host elsewhere; `attachmentsOf` gives each host its attachments.
 */
function rows(battlefield: readonly Card[], named: ReadonlySet<number>, hosted: ReadonlySet<number>, attachmentsOf: ReadonlyMap<number, readonly VisibleCard[]>): BoardRows {
  const creatures: BoardEntry[] = []
  const others: BoardEntry[] = []
  const piles = new Map<string, { entry: Extract<BoardEntry, { kind: "card" }>; row: BoardEntry[]; index: number }>()
  battlefield.forEach((card, index) => {
    if (!isVisible(card)) {
      others.push({ kind: "hidden", key: `hidden:${index}` })
      return
    }
    if (hosted.has(card.id)) return
    const row = hasStats(card) ? creatures : others
    const attachments = attachmentsOf.get(card.id) ?? []
    if (!named.has(card.id) && attachments.length === 0) {
      const key = signature(card)
      const pile = piles.get(key)
      if (pile) {
        const grown = { ...pile.entry, ids: [...pile.entry.ids, card.id] }
        pile.row[pile.index] = grown
        pile.entry = grown
        return
      }
      const entry: Extract<BoardEntry, { kind: "card" }> = { kind: "card", key: String(card.id), card, ids: [card.id], attachments }
      piles.set(key, { entry, row, index: row.length })
      row.push(entry)
      return
    }
    row.push({ kind: "card", key: String(card.id), card, ids: [card.id], attachments })
  })
  return { creatures, others }
}

function countersOf(counters: Readonly<Record<string, number>>): { readonly name: string; readonly amount: number }[] {
  return Object.entries(counters)
    .filter(([, amount]) => amount !== 0)
    .map(([name, amount]) => ({ name, amount }))
}

function side(player: Player, state: GameState, named: ReadonlySet<number>, hosted: ReadonlySet<number>, attachmentsOf: ReadonlyMap<number, readonly VisibleCard[]>): TableSide {
  const { zones } = player
  return {
    seat: player.me ? "me" : "opponent",
    player,
    active: state.activePlayer !== null && state.activePlayer === player.id,
    battlefield: rows(zones.battlefield, named, hosted, attachmentsOf),
    hand: zones.hand,
    command: zones.command,
    counts: { hand: zones.hand.length, library: player.library, graveyard: zones.graveyard.length, exile: zones.exile.length, command: zones.command.length },
    mana: MANA_COLORS.filter((color) => player.mana[color] > 0).map((color) => ({ color, amount: player.mana[color] })),
    counters: countersOf(player.counters),
  }
}

function playerRef(state: GameState, id: number): PlayerRef {
  const player = state.players.find((candidate) => candidate.id === id)
  return { kind: "player", id, seat: player === undefined ? null : player.me ? "me" : "opponent" }
}

function cardRef(cards: ReadonlyMap<number, VisibleCard>, id: number): CardRef {
  return { kind: "card", id, card: cards.get(id) ?? null }
}

function stackEntry(state: GameState, cards: ReadonlyMap<number, VisibleCard>, item: StackItem): StackEntryView {
  return {
    id: item.id,
    text: item.text,
    controller: item.player === null ? null : playerRef(state, item.player).seat,
    trigger: item.trigger,
    source: item.source === null ? null : cardRef(cards, item.source),
    targets: item.targets.map((target) => (target.kind === "player" ? playerRef(state, target.id) : cardRef(cards, target.id))),
  }
}

function combatView(state: GameState, cards: ReadonlyMap<number, VisibleCard>, entry: CombatEntry): CombatView {
  const defender =
    entry.defender === null || entry.defenderKind === null ? null : entry.defenderKind === "player" ? playerRef(state, entry.defender) : cardRef(cards, entry.defender)
  return { attacker: cardRef(cards, entry.attacker), defender, blockers: entry.blockers.map((id) => cardRef(cards, id)) }
}

/** The table for one full state. `questions`: the ones open right now (their cards never go into a pile). */
export function tableView(state: GameState, questions: readonly Question[] = []): TableView {
  const cards = visibleCards(state)
  const named = namedCardIds(state, questions)
  // Attachments lie with their host - if the host is on a battlefield the player can see.
  const onBattlefield = new Set<number>()
  for (const player of state.players) for (const card of player.zones.battlefield) if (isVisible(card)) onBattlefield.add(card.id)
  const hosted = new Set<number>()
  const attachmentsOf = new Map<number, VisibleCard[]>()
  for (const player of state.players) {
    for (const card of player.zones.battlefield) {
      if (!isVisible(card) || card.attachedTo === undefined || !onBattlefield.has(card.attachedTo) || card.attachedTo === card.id) continue
      hosted.add(card.id)
      attachmentsOf.set(card.attachedTo, [...(attachmentsOf.get(card.attachedTo) ?? []), card])
    }
  }
  const sides = state.players.map((player) => side(player, state, named, hosted, attachmentsOf))
  const me = sides.find((candidate) => candidate.player.me) ?? null
  const active = state.activePlayer === null ? undefined : state.players.find((player) => player.id === state.activePlayer)
  return {
    turn: state.turn,
    phase: state.phase,
    activeSeat: active === undefined ? null : active.me ? "me" : "opponent",
    me,
    opponents: sides.filter((candidate) => candidate !== me),
    stack: state.stack.map((item) => stackEntry(state, cards, item)),
    combat: state.combat.map((entry) => combatView(state, cards, entry)),
  }
}
