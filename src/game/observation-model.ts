/*
 * What the player sees of Forge's public actions (prompt 49; the actions
 * and when they come are prompt 48's contract, protocol 10,
 * docs/implementation/48-observation-contract.md).
 *
 * An observation is a list of Forge's own actions since the previous one -
 * a turn beginning, a land played, a spell cast, an ability activated or
 * triggered, attackers, blockers, a resolution or combat damage with their
 * public results. This file turns one into the steps the table shows one
 * after the other (observationSteps): each with German words, the cards it
 * is about (shown large and whole) and its results in short lines. Nothing
 * is inferred: the words follow the action's kind and Forge's structured
 * fields - players by the state's `me`, cards as Forge sent them with the
 * action (their names as Forge names them), never from Forge's prose, never
 * from a difference between two states. A card the player may not see stays
 * a back ("eine verdeckte Karte").
 *
 * How an observation is presented (presentation): the engine holds it
 * (Observation.hold) - the stage over the player's half, stepped by the tempo
 * or "Weiter"; it came right before a decision of the player's and holds
 * nothing - a change of turn is a band that lets every touch through, an
 * action of the opponent a line above the decision ("Unterbrechung"); the
 * player's own actions are their own inputs and are not shown again.
 */
import type { ActionResults, ActionZone, Card, EntityRef, GameState, Observation, ObservedAction, VisibleCard } from "@openmana/engine-protocol"
import type { LastMove, OpponentTurn } from "@/engine/engine-session"
import { cardName } from "./table-labels"
import { isVisible, visibleCards } from "./table-model"

/** Whose action, from the player's point of view (null: Forge names nobody). */
export type ActionActor = "me" | "opponent" | null

export interface ObservationStep {
  /** Stable per observation and action ("<observation>:<action n>"): the playback arms "Weiter" anew per key. */
  readonly key: string
  readonly kind: ObservedAction["kind"]
  readonly actor: ActionActor
  /** The step in one German sentence (the large line). */
  readonly title: string
  /** The cards it is about, as Forge sent them with the action: shown large and whole (at most MAX_CARDS). */
  readonly cards: readonly Card[]
  /** What else to read: targets, attackers and blockers, results (moves, damage, life). */
  readonly lines: readonly string[]
  /** A change of turn: its number and whose it is. */
  readonly turn: { readonly number: number; readonly seat: ActionActor } | null
}

/** At most this many cards of one step are shown large; the others are named in the lines. */
export const MAX_CARDS = 3

/** The player's id in this state (null before the first state names one). */
export function myId(state: GameState | null): number | null {
  return state?.players.find((player) => player.me)?.id ?? null
}

export function actorOf(player: number | null, me: number | null): ActionActor {
  if (player === null || me === null) return null
  return player === me ? "me" : "opponent"
}

function subject(actor: ActionActor): string {
  return actor === "me" ? "Du" : actor === "opponent" ? "Die Forge-KI" : "Ein Spieler"
}

function verb(actor: ActionActor, me: string, other: string): string {
  return actor === "me" ? me : other
}

function name(card: Card | null): string {
  if (card === null) return "eine Karte"
  return isVisible(card) ? cardName(card) : "eine verdeckte Karte"
}

/** Whose zone, as a genitive for "auf das Spielfeld …". */
function owner(player: number | null, me: number | null): { readonly mine: boolean | null } {
  if (player === null || me === null) return { mine: null }
  return { mine: player === me }
}

function zonePhrase(zone: ActionZone, me: number | null): string {
  const { mine } = owner(zone.player, me)
  const of = (mineWord: string, theirs: string, nobody: string) => (mine === true ? mineWord : mine === false ? theirs : nobody)
  switch (zone.zone) {
    case "battlefield":
      return of("auf dein Spielfeld", "auf das Spielfeld der Forge-KI", "aufs Spielfeld")
    case "graveyard":
      return of("auf deinen Friedhof", "auf den Friedhof der Forge-KI", "auf einen Friedhof")
    case "exile":
      return "ins Exil"
    case "hand":
      return of("auf deine Hand", "auf die Hand der Forge-KI", "auf eine Hand")
    case "library":
      return of("in deine Bibliothek", "in die Bibliothek der Forge-KI", "in eine Bibliothek")
    case "command":
      return of("in deine Kommandozone", "in die Kommandozone der Forge-KI", "in die Kommandozone")
    case "stack":
      return "auf den Stapel"
    case "other":
      return "an einen anderen Ort"
  }
}

function refWords(ref: EntityRef, me: number | null, cards: ReadonlyMap<number, VisibleCard>): string {
  if (ref.kind === "player") return actorOf(ref.id, me) === "me" ? "dich" : actorOf(ref.id, me) === "opponent" ? "die Forge-KI" : "einen Spieler"
  const card = cards.get(ref.id)
  return card === undefined ? "eine Karte" : cardName(card)
}

function playerWords(player: number, me: number | null): string {
  return actorOf(player, me) === "me" ? "Du" : actorOf(player, me) === "opponent" ? "Forge-KI" : "Ein Spieler"
}

function points(amount: number): string {
  return amount === 1 ? "1 Schadenspunkt" : `${amount} Schadenspunkte`
}

/** The results of a resolution or of combat damage in short lines, in Forge's order. */
export function resultLines(results: ActionResults, me: number | null, cards: ReadonlyMap<number, VisibleCard>): string[] {
  const lines: string[] = []
  for (const move of results.moves) {
    const card = cardName(move.card)
    if (move.to === null) lines.push(`${card} verlässt das Spiel.`)
    else if (move.from === null) lines.push(`${card} entsteht – ${zonePhrase(move.to, me)}.`)
    else if (move.to.zone === "battlefield") lines.push(`${card} kommt ${zonePhrase(move.to, me)}.`)
    else if (move.to.zone === "exile") lines.push(`${card} wird ins Exil geschickt.`)
    else lines.push(`${card} kommt ${zonePhrase(move.to, me)}.`)
  }
  for (const damage of results.damage) {
    const source = damage.source === null ? null : (cards.get(damage.source) ?? null)
    const seat = damage.target.kind === "player" ? actorOf(damage.target.id, me) : null
    if (source !== null) {
      const to = damage.target.kind === "card" ? refWords(damage.target, me, cards) : seat === "me" ? "dir" : seat === "opponent" ? "der Forge-KI" : "einem Spieler"
      lines.push(`${cardName(source)} fügt ${to} ${points(damage.amount)} zu.`)
    } else {
      const who = damage.target.kind === "card" ? refWords(damage.target, me, cards) : playerWords(damage.target.id, me)
      lines.push(`${who}: ${points(damage.amount)}.`)
    }
  }
  for (const life of results.life) {
    lines.push(`${playerWords(life.player, me)}: ${life.from} → ${life.to} Lebenspunkte.`)
  }
  return lines
}

/** The cards the player may see that an observation shows (their pictures are looked up with the table's). */
export function observationCards(observation: Observation | null): VisibleCard[] {
  return observation === null ? [] : [...actionCards(observation.actions).values()]
}

/** Cards Forge sent with the actions of an observation, by id (the targets and attackers named elsewhere). */
function actionCards(actions: readonly ObservedAction[]): Map<number, VisibleCard> {
  const cards = new Map<number, VisibleCard>()
  const add = (card: Card | null | undefined) => {
    if (card !== null && card !== undefined && isVisible(card)) cards.set(card.id, card)
  }
  for (const action of actions) {
    switch (action.kind) {
      case "land":
        add(action.card)
        break
      case "cast":
      case "activate":
      case "trigger":
      case "resolve":
        add(action.card)
        if (action.kind === "resolve") for (const move of action.results.moves) add(move.card)
        break
      case "attack":
        for (const each of action.attacks) add(each.attacker)
        break
      case "block":
        for (const each of action.blocks) for (const blocker of each.blockers) add(blocker)
        break
      case "combatDamage":
        for (const move of action.results.moves) add(move.card)
        break
      default:
        break
    }
  }
  return cards
}

/** Who attacks whom, equal attackers of the same defender together: "Grizzlybären (3) greifen dich an". */
function attackLines(attacks: readonly { readonly attacker: string; readonly defender: string | null }[]): string[] {
  const groups = new Map<string, { readonly attacker: string; readonly defender: string | null; count: number }>()
  for (const each of attacks) {
    const key = `${each.attacker}\u0000${each.defender ?? ""}`
    const group = groups.get(key)
    if (group === undefined) groups.set(key, { ...each, count: 1 })
    else group.count++
  }
  return [...groups.values()].map(({ attacker, defender, count }) => `${count === 1 ? attacker : `${attacker} (${count})`} ${count === 1 ? "greift" : "greifen"} ${defender === null ? "an" : `${defender} an`}`)
}

const STACK_WORDS = { spell: "", ability: "Die Fähigkeit von ", trigger: "Die ausgelöste Fähigkeit von " } as const

/**
 * The steps of one observation, in Forge's order. A turn's end is folded
 * into the next turn's beginning when both came together (Forge names no
 * reliable player for a turn's end - prompt 48 reports Forge's phase
 * handler's), otherwise it is a step of its own. Never empty.
 */
export function observationSteps(observation: Observation, state: GameState | null): ObservationStep[] {
  const me = myId(state)
  const known = new Map([...(state === null ? [] : visibleCards(state)), ...actionCards(observation.actions)])
  const begins = observation.actions.some((action) => action.kind === "turn")
  const steps: ObservationStep[] = []
  for (const action of observation.actions) {
    const key = `${observation.id}:${action.n}`
    const actor = actorOf(action.player, me)
    const base = { key, kind: action.kind, actor, cards: [] as Card[], lines: [] as string[], turn: null }
    switch (action.kind) {
      case "turn":
        steps.push({ ...base, title: `Zug ${action.turn} · ${actor === "me" ? "Du bist am Zug" : actor === "opponent" ? "Die Forge-KI ist am Zug" : "Ein neuer Zug"}`, turn: { number: action.turn, seat: actor } })
        break
      case "turnEnd":
        if (!begins) steps.push({ ...base, actor: null, title: `Zug ${action.turn} endet`, turn: null })
        break
      case "land":
        steps.push({ ...base, title: `${subject(actor)} ${verb(actor, "spielst", "spielt")} ein Land: ${name(action.card)}`, cards: [action.card] })
        break
      case "cast":
        steps.push({
          ...base,
          title: `${subject(actor)} ${verb(actor, "wirkst", "wirkt")} ${name(action.card)}`,
          cards: action.card === null ? [] : [action.card],
          lines: action.targets.length > 0 ? [`Ziel: ${action.targets.map((target) => refWords(target, me, known)).join(", ")}`] : [],
        })
        break
      case "activate":
        steps.push({
          ...base,
          title: `${subject(actor)} ${verb(actor, "aktivierst", "aktiviert")} eine Fähigkeit von ${name(action.card)}`,
          cards: action.card === null ? [] : [action.card],
          lines: action.targets.length > 0 ? [`Ziel: ${action.targets.map((target) => refWords(target, me, known)).join(", ")}`] : [],
        })
        break
      case "trigger":
        steps.push({
          ...base,
          title: `Eine Fähigkeit von ${name(action.card)} wird ausgelöst${actor === "opponent" ? " (Forge-KI)" : actor === "me" ? " (deine)" : ""}`,
          cards: action.card === null ? [] : [action.card],
          lines: action.targets.length > 0 ? [`Ziel: ${action.targets.map((target) => refWords(target, me, known)).join(", ")}`] : [],
        })
        break
      case "attack": {
        const count = action.attacks.length
        steps.push({
          ...base,
          title: `${subject(actor)} ${verb(actor, "greifst", "greift")} mit ${count === 1 ? "einer Kreatur" : `${count} Kreaturen`} an`,
          cards: action.attacks.slice(0, MAX_CARDS).map((each) => each.attacker),
          lines: attackLines(action.attacks.map((each) => ({ attacker: name(each.attacker), defender: each.defender === null ? null : refWords(each.defender, me, known) }))),
        })
        break
      }
      case "block": {
        const blockers = action.blocks.flatMap((each) => each.blockers)
        const attacker = (id: number) => known.get(id)
        steps.push({
          ...base,
          title: blockers.length === 0 ? `${actor === "me" ? "Du blockst" : actor === "opponent" ? "Die Forge-KI blockt" : "Niemand blockt"} nicht` : `${actor === "me" ? "Deine Blocker" : actor === "opponent" ? "Die Forge-KI blockt" : "Blocker"}`,
          cards: blockers.slice(0, MAX_CARDS),
          lines: action.blocks.map((each) => {
            const target = attacker(each.attacker)
            const attackerName = target === undefined ? "Ein Angreifer" : cardName(target)
            return each.blockers.length === 0 ? `${attackerName} wird nicht geblockt` : `${each.blockers.map((blocker) => name(blocker)).join(" und ")} ${each.blockers.length === 1 ? "blockt" : "blocken"} ${attackerName}`
          }),
        })
        break
      }
      case "resolve": {
        const what = `${STACK_WORDS[action.stack]}${name(action.card)}`
        const title = action.fizzled
          ? `${what} wird ohne Wirkung verrechnet – kein Ziel ist mehr gültig`
          : action.continued
            ? `${what} wird weiter verrechnet`
            : `${what} wird verrechnet`
        steps.push({ ...base, title, cards: action.card === null ? [] : [action.card], lines: resultLines(action.results, me, known) })
        break
      }
      case "combatDamage": {
        const lines = resultLines(action.results, me, known)
        steps.push({ ...base, title: action.continued ? "Der Kampfschaden geht weiter" : "Kampfschaden", lines: lines.length > 0 ? lines : ["Niemand erleidet Schaden."] })
        break
      }
    }
  }
  if (steps.length === 0) steps.push({ key: `${observation.id}:0`, kind: observation.actions[0].kind, actor: null, title: "Forge spielt weiter", cards: [], lines: [], turn: null })
  return steps
}

/** How the table presents an observation (see the file's comment). */
export type Presentation = "stage" | "turn" | "interrupt" | "none"

/**
 * stage: the engine holds it; turn: it came without holding and a turn
 * began; interrupt: it came without holding with an action of the opponent
 * (a real decision of the player follows); none: only the player's own
 * actions.
 */
export function presentation(observation: Observation, state: GameState | null): Presentation {
  if (observation.hold) return "stage"
  if (observation.actions.some((action) => action.kind === "turn")) return "turn"
  const me = myId(state)
  if (observation.actions.some((action) => action.kind !== "turnEnd" && actorOf(action.player, me) === "opponent")) return "interrupt"
  return "none"
}


/** The opponent's turn in a few words: "Wald gespielt · Llanowarelfen gewirkt · mit 2 Kreaturen angegriffen" (empty: nothing). */
export function turnSummary(turn: OpponentTurn): string[] {
  const parts: string[] = []
  for (const action of turn.actions) {
    switch (action.kind) {
      case "land":
        parts.push(`${name(action.card)} gespielt`)
        break
      case "cast":
        parts.push(`${name(action.card)} gewirkt`)
        break
      case "activate":
        parts.push(`Fähigkeit von ${name(action.card)} aktiviert`)
        break
      case "attack":
        parts.push(`mit ${action.attacks.length === 1 ? "einer Kreatur" : `${action.attacks.length} Kreaturen`} angegriffen`)
        break
      default:
        break
    }
  }
  return parts
}

/** The summary as one sentence for the table. */
export function turnSummaryText(turn: OpponentTurn | null): string | null {
  if (turn === null) return null
  const parts = turnSummary(turn)
  return parts.length === 0 ? `Die Forge-KI hat in Zug ${turn.turn} nichts gespielt und nicht angegriffen.` : `Die Forge-KI in Zug ${turn.turn}: ${parts.join(" · ")}.`
}

/**
 * The "Zuletzt" line (2026-10-14): the latest move of either player in past
 * words - "Die Forge-KI hat Grizzlybären gewirkt", "Du hast Wald gespielt" -,
 * from the action's kind and Forge's structured fields as captured
 * (EngineSession.lastMove), never from Forge's prose or a state difference.
 * Null before the first move.
 */
export function lastMoveText(move: LastMove | null): string | null {
  if (move === null) return null
  const { action, me } = move
  const actor = actorOf(action.player, me)
  const who = actor === "me" ? "Du hast" : actor === "opponent" ? "Die Forge-KI hat" : "Ein Spieler hat"
  const creatures = (count: number) => (count === 1 ? "einer Kreatur" : `${count} Kreaturen`)
  switch (action.kind) {
    case "land":
      return `${who} ${name(action.card)} gespielt`
    case "cast":
      return `${who} ${name(action.card)} gewirkt`
    case "activate":
      return `${who} eine Fähigkeit von ${name(action.card)} aktiviert`
    case "attack":
      return `${who} mit ${creatures(action.attacks.length)} angegriffen`
    case "block": {
      const blockers = action.blocks.reduce((sum, each) => sum + each.blockers.length, 0)
      return blockers === 0 ? `${who} nicht geblockt` : `${who} mit ${creatures(blockers)} geblockt`
    }
    default:
      return null
  }
}
