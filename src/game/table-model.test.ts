/*
 * The table's arrangement of Forge's state (table-model.ts): on real states
 * of recorded games (src/test/table-scenes.ts) and on small states made for
 * one case each (attachments, hidden cards, questions), all checked against
 * the protocol first.
 */
import { checkEngineMessage, checkGameState, type GameState, type Question, type VisibleCard } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { TABLE_SCENES, tableScene } from "@/test/table-scenes"
import { gameState } from "@/test/game-fixtures"
import { namedCardIds, tableView, visibleCards, type BoardEntry } from "./table-model"

/** What a row shows: "id" for a single card, "id×n" for a pile, "hidden" for a hidden card, "+id" for attachments. */
function row(entries: readonly BoardEntry[]): string[] {
  return entries.map((entry) => {
    if (entry.kind === "hidden") return "hidden"
    const pile = entry.ids.length > 1 ? `${entry.ids[0]}×${entry.ids.length}` : String(entry.card.id)
    return entry.attachments.length > 0 ? `${pile}+${entry.attachments.map((a) => a.id).join("+")}` : pile
  })
}

function card(id: number, key: string, overrides: Partial<VisibleCard> = {}): VisibleCard {
  return { id, key, name: key, tapped: false, sick: false, faceDown: false, damage: 0, owner: 0, controller: 0, ...overrides }
}

/** A state with these battlefields (the player's first), checked against the protocol. */
function withBattlefields(mine: VisibleCard[] | GameState["players"][number]["zones"]["battlefield"], theirs: GameState["players"][number]["zones"]["battlefield"], extra: Partial<GameState> = {}): GameState {
  const base = gameState(5, { turn: 3, phase: "MAIN1", activePlayer: 0 })
  const [me, ai] = base.players
  return checkGameState({
    ...base,
    players: [
      { ...me!, zones: { ...me!.zones, battlefield: mine } },
      { ...ai!, zones: { ...ai!.zones, battlefield: theirs } },
    ],
    ...extra,
  })
}

describe("recorded scenes", () => {
  it("are real protocol messages: every state, question and notice passes the protocol's checks", () => {
    expect(TABLE_SCENES.map((scene) => scene.name)).toEqual(["opening", "main-phase", "stack", "blockers", "defend", "commander-late", "command-effects"])
    for (const scene of TABLE_SCENES) {
      expect(() => checkGameState(scene.state), scene.name).not.toThrow()
      expect(() => checkEngineMessage(scene.game), scene.name).not.toThrow()
      for (const question of scene.questions) expect(() => checkEngineMessage(question), scene.name).not.toThrow()
      for (const notice of scene.notices) expect(() => checkEngineMessage(notice), scene.name).not.toThrow()
    }
  })

  it("the opening: seats from `me`, the player's seven cards, the AI's hand only counted", () => {
    const { state, questions } = tableScene("opening")
    const view = tableView(state, questions)
    expect(view.me?.player.name).toBe("Player")
    expect(view.me?.seat).toBe("me")
    expect(view.opponents.map((side) => [side.player.name, side.seat])).toEqual([["Forge AI", "opponent"]])
    expect(view.activeSeat).toBeNull()
    expect(view.me?.hand).toHaveLength(7)
    expect(view.me?.hand.every((c) => !("hidden" in c))).toBe(true)
    expect(view.opponents[0]?.hand).toEqual(Array.from({ length: 7 }, () => ({ hidden: true })))
    expect(view.me?.counts).toEqual({ hand: 7, library: 53, graveyard: 0, exile: 0, command: 0 })
    expect(view.me?.battlefield).toEqual({ creatures: [], others: [] })
    expect(view.stack).toEqual([])
    expect(view.combat).toEqual([])
  })

  it("a main phase: identical cards as one pile, tapped ones apart, creatures (power and toughness) in their own row", () => {
    const { state, questions } = tableScene("main-phase")
    const view = tableView(state, questions)
    expect(view.activeSeat).toBe("me")
    expect(row(view.me!.battlefield.others)).toEqual(["28×6"])
    expect(view.me!.battlefield.others[0]).toMatchObject({ kind: "card", ids: [28, 26, 33, 36, 27, 30] })
    expect(row(view.me!.battlefield.creatures)).toEqual([])
    const ai = view.opponents[0]!
    // One tapped Forest alone, the six untapped ones as a pile.
    expect(row(ai.battlefield.others)).toEqual(["116", "113×6"])
    // Two tapped Giant Spiders alike, the Armodon alone.
    expect(row(ai.battlefield.creatures)).toEqual(["77×2", "74"])
  })

  it("the stack: Forge's text, who, the target resolved on the table; the spell's own card is on the stack (no zone the player gets)", () => {
    const { state, questions } = tableScene("stack")
    const [entry] = tableView(state, questions).stack
    expect(entry).toMatchObject({ id: 14, controller: "me", trigger: false, source: { kind: "card", id: 14, card: null } })
    expect(entry!.text).toBe("Magmastrahl (14) - Magmastrahl (14) deals 2 damage to Goblin-Brandstifter (55). Player scries 2.")
    expect(entry!.targets).toHaveLength(1)
    expect(entry!.targets[0]).toMatchObject({ kind: "card", id: 55, card: { name: "Goblin-Brandstifter", damage: 2 } })
  })

  it("combat: attackers, defenders and blockers by id; cards in combat never go into a pile", () => {
    const { state, questions } = tableScene("blockers")
    const view = tableView(state, questions)
    expect(view.combat.map((c) => [c.attacker.id, c.defender, c.blockers.map((b) => b.card?.name)])).toEqual([
      [16, { kind: "player", id: 1, seat: "opponent" }, []],
      [18, { kind: "player", id: 1, seat: "opponent" }, ["Canyon Minotaur", "Raging Goblin"]],
      [3, { kind: "player", id: 1, seat: "opponent" }, []],
      [29, { kind: "player", id: 1, seat: "opponent" }, ["Gray Ogre"]],
    ])
    expect(row(view.me!.battlefield.creatures)).toEqual(["29", "3", "18", "16", "11"])
    expect(row(view.opponents[0]!.battlefield.creatures)).toEqual(["115", "114", "103", "94"])
  })

  it("the player defends: the blocker and whom the attacker attacks (the player)", () => {
    const { state, questions } = tableScene("defend")
    const [fight] = tableView(state, questions).combat
    expect(fight).toMatchObject({ attacker: { id: 80, card: { name: "Giant Spider", attacking: true } }, defender: { kind: "player", seat: "me" }, blockers: [{ id: 58, card: { blocking: true } }] })
  })

  it("a late Commander turn: nine Mountains as one pile, every attacker single, poison, commander tax and damage", () => {
    const { state, questions } = tableScene("commander-late")
    const view = tableView(state, questions)
    const me = view.me!
    expect(row(me.battlefield.others)).toEqual(["18×9"])
    expect(me.battlefield.creatures.every((entry) => entry.kind === "card" && entry.ids.length === 1)).toBe(true)
    expect(me.battlefield.creatures).toHaveLength(view.combat.length)
    expect(me.counters).toEqual([{ name: "Poison", amount: 6 }])
    expect(me.player.commanders.map((c) => ({ tax: c.tax, damage: c.damage }))).toEqual([{ tax: 4, damage: [{ player: 1, amount: 9 }] }])
    expect(row(view.opponents[0]!.battlefield.others)).toEqual(["117×4", "118×4"])
  })

  it("Forge's effect cards in the command zone stay as Forge sends them", () => {
    const { state, questions } = tableScene("command-effects")
    const view = tableView(state, questions)
    expect(view.me!.command.map((c) => ("hidden" in c ? null : c.name))).toEqual(["Stomp (54)'s Effect", "Stomp (54)'s Adventure"])
    expect(view.me!.counts.command).toBe(2)
  })
})

describe("made for one case", () => {
  it("an aura of the opponent's on the player's creature lies with that creature, not in the opponent's row", () => {
    const bear = card(10, "Grizzly Bears", { power: 2, toughness: 2, attached: [50, 11] })
    const sword = card(11, "Short Sword", { attachedTo: 10 })
    const pacifism = card(50, "Pacifism", { owner: 1, controller: 1, attachedTo: 10 })
    const state = withBattlefields([bear, sword, card(12, "Mountain")], [card(51, "Forest", { owner: 1, controller: 1 }), pacifism])
    const view = tableView(state)
    expect(row(view.me!.battlefield.creatures)).toEqual(["10+11+50"])
    expect(row(view.me!.battlefield.others)).toEqual(["12"])
    expect(row(view.opponents[0]!.battlefield.others)).toEqual(["51"])
  })

  it("an attachment whose card is not on a battlefield stays where Forge puts it", () => {
    const state = withBattlefields([card(20, "Short Sword", { attachedTo: 99 })], [])
    expect(row(tableView(state).me!.battlefield.others)).toEqual(["20"])
  })

  it("hidden cards: counted in place, never told apart; a card Forge reveals from the opponent's hand is shown", () => {
    const base = withBattlefields([], [{ hidden: true }, card(60, "Forest", { owner: 1, controller: 1 }), { hidden: true }])
    const [me, ai] = base.players
    const state = checkGameState({ ...base, players: [me!, { ...ai!, zones: { ...ai!.zones, hand: [{ hidden: true }, card(61, "Shock", { owner: 1, controller: 1 })] } }] })
    const view = tableView(state)
    expect(row(view.opponents[0]!.battlefield.others)).toEqual(["hidden", "60", "hidden"])
    expect(view.opponents[0]!.battlefield.others.map((e) => e.key)).toEqual(["hidden:0", "60", "hidden:2"])
    expect(view.opponents[0]!.hand).toEqual([{ hidden: true }, expect.objectContaining({ id: 61, name: "Shock" })])
  })

  it("a pile needs every value alike: other counters, damage or tapping make separate places", () => {
    const state = withBattlefields(
      [
        card(1, "Grizzly Bears", { power: 3, toughness: 3, counters: { "+1/+1": 1 } }),
        card(2, "Grizzly Bears", { power: 3, toughness: 3, counters: { "+1/+1": 1 } }),
        card(3, "Grizzly Bears", { power: 4, toughness: 4, counters: { "+1/+1": 2 } }),
        card(4, "Grizzly Bears", { power: 3, toughness: 3, counters: { "+1/+1": 1 }, damage: 1 }),
        card(5, "Grizzly Bears", { power: 3, toughness: 3, counters: { "+1/+1": 1 }, tapped: true }),
      ],
      [],
    )
    expect(row(tableView(state).me!.battlefield.creatures)).toEqual(["1×2", "3", "4", "5"])
  })

  it("a card a question names never goes into a pile", () => {
    const state = withBattlefields([card(1, "Mountain"), card(2, "Mountain"), card(3, "Mountain")], [])
    const question: Question = { type: "question", kind: "select", id: 9, blocking: false, text: "Wähle ein Land", min: 1, max: 1, cards: [2], items: [] }
    expect(row(tableView(state).me!.battlefield.others)).toEqual(["1×3"])
    expect(row(tableView(state, [question]).me!.battlefield.others)).toEqual(["1×2", "2"])
    expect([...namedCardIds(state, [question])]).toEqual([2])
  })

  it("the stack keeps Forge's order (the first item is the top) and names players by seat", () => {
    const state = withBattlefields([card(1, "Mountain")], [], {
      stack: [
        { id: 7, text: "Schock fügt dir 2 Schadenspunkte zu.", source: null, player: 1, trigger: false, targets: [{ kind: "player", id: 0 }] },
        { id: 6, text: "Gebirge", source: 1, player: 0, trigger: true, targets: [] },
      ],
    })
    const view = tableView(state)
    expect(view.stack.map((entry) => [entry.id, entry.controller, entry.trigger])).toEqual([
      [7, "opponent", false],
      [6, "me", true],
    ])
    expect(view.stack[0]!.targets).toEqual([{ kind: "player", id: 0, seat: "me" }])
    expect(view.stack[1]!.source).toMatchObject({ kind: "card", id: 1, card: { key: "Mountain" } })
  })

  it("mana and counters without the empty ones; every visible card of every zone by id", () => {
    const base = withBattlefields([card(1, "Mountain")], [])
    const [me, ai] = base.players
    const state = checkGameState({ ...base, players: [{ ...me!, mana: { W: 0, U: 0, B: 0, R: 2, G: 0, C: 1 }, counters: { Poison: 0, Energy: 3 } }, ai!] })
    const view = tableView(state)
    expect(view.me!.mana).toEqual([
      { color: "R", amount: 2 },
      { color: "C", amount: 1 },
    ])
    expect(view.me!.counters).toEqual([{ name: "Energy", amount: 3 }])
    expect([...visibleCards(state).keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
