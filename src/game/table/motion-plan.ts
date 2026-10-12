/*
 * What the table's motion does for a new state (prompt 44,
 * docs/design/SPIELTISCH.md §8): pure rules and keyframes, no DOM - the
 * component (table-motion.tsx) measures the page and starts the animations.
 *
 * Presentation, never narration: a card gliding from its old to its new place
 * (the same `data-card` id), a card turning when Forge's `tapped` changes, a
 * number reacting when Forge's life total changes. Nothing here makes a text,
 * a history entry or a rule, and nothing decides what happened in the game -
 * the effects that follow an event use only the kinds Forge's log sends
 * (`DAMAGE`, `STACK_ADD`, `STACK_RESOLVE`; recorded in the test games'
 * transcripts), every other kind is ignored.
 *
 * Every keyframe animates only `transform` and `opacity` (MOTION_PROPERTIES,
 * checked by the unit tests and src/app/motion.test.ts).
 */
import type { GameEvent, GameState } from "@openmana/engine-protocol"
import { isVisible, stackCard } from "../table-model"

/** The only properties the table's own animations touch (§8: what the compositor moves without layout or paint). */
export const MOTION_PROPERTIES = ["transform", "opacity"] as const

/** How long each kind of motion lasts (ms): quick, never holding anything up (§8: a new state is usable at once). */
export const MOTION_MS = {
  /** A card travelling to another region (hand → Zauberchronik → battlefield → graveyard …). */
  travel: 340,
  /** A card moving within its row (its neighbours came or went, an attacker moving forward). */
  shift: 260,
  /** A card turning to tapped or back. */
  tap: 240,
  /** A card that came without a place before, from nowhere in particular. */
  appear: 240,
  /** A card that left without a visible new place. */
  vanish: 260,
  /** A Zauberchronik entry gliding in, or the top entry dissolving. */
  entry: 300,
  /** A short flash, shake or pulse (damage, life). */
  flash: 460,
  /** The gold marker of the Phasen-Tafel gliding to the new step. */
  phase: 300,
  /** The shimmer across the main button at a new priority. */
  shimmer: 720,
  /** A card dragged out of the hand gliding back to its place (prompt 46: not dropped, or not played). */
  back: 220,
} as const

/**
 * How long a card dropped onto the battlefield (prompt 46) waits where it was
 * let go for Forge's next state (ms): the card's travel then starts there; if
 * none comes - Forge keeps the card in the hand while it asks - it fades.
 */
export const DROP_WAIT_MS = 1500

/** How long a card's last place is remembered after it left the table (ms): a spell leaves the hand while it is paid for and appears on the stack afterwards. */
export const REMEMBER_MS = 15_000

/** The ease of every travel: fast out, gently in. */
export const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)"

/** A card's place on the page, in the board's coordinates: the centre of its face, its face's size (unturned, in layout) and its turn (a fanned hand card's, in degrees). */
export interface Place {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly angle: number
}

/** One card of the table at one moment, as the component measured it. */
export interface CardSnap {
  readonly key: string
  readonly place: Place
  readonly tapped: boolean
  /** The element that stands for the card: the same element before and after means React kept it in its place. */
  readonly node: object
}

/** A card that moved: within its place (the same element) or to another (a new element; the travel crosses regions). */
export interface CardMove {
  readonly key: string
  readonly from: Place
  readonly to: Place
  readonly within: boolean
  /** Forge's tapped changed (the picture turns). */
  readonly turned: boolean
}

export interface CardPlan {
  readonly moves: readonly CardMove[]
  /** Cards that stayed where they were but turned (tapped / untapped). */
  readonly turns: readonly { readonly key: string; readonly tapped: boolean }[]
  /** Cards with no place before. */
  readonly arrivals: readonly string[]
  /** Cards no longer on the table. */
  readonly departures: readonly string[]
}

/** Below these a change of place is no move (px, and the size's share). */
const STILL_PX = 1.5
const STILL_SCALE = 0.02

/** The longer side of a face: the size a card keeps when it turns (a tapped face is the untapped one lying down). */
export function longSide(place: Place): number {
  return Math.max(place.w, place.h)
}

/**
 * What the cards did between two moments: a card is the same card when its
 * `data-card` id is the same (Forge keeps the id from the hand over the stack
 * to the battlefield and from the battlefield to the graveyard). Only cards
 * whose place changed move; nothing is concluded beyond the two pictures.
 */
export function planCards(before: ReadonlyMap<string, CardSnap>, after: ReadonlyMap<string, CardSnap>): CardPlan {
  const moves: CardMove[] = []
  const turns: { key: string; tapped: boolean }[] = []
  const arrivals: string[] = []
  for (const [key, next] of after) {
    const previous = before.get(key)
    if (previous === undefined) {
      arrivals.push(key)
      continue
    }
    const turned = previous.tapped !== next.tapped
    const within = previous.node === next.node
    const moved =
      !within ||
      Math.hypot(previous.place.x - next.place.x, previous.place.y - next.place.y) > STILL_PX ||
      Math.abs(longSide(previous.place) / Math.max(1, longSide(next.place)) - 1) > STILL_SCALE
    if (moved) moves.push({ key, from: previous.place, to: next.place, within, turned })
    else if (turned) turns.push({ key, tapped: next.tapped })
  }
  const departures = [...before.keys()].filter((key) => !after.has(key))
  return { moves, turns, arrivals, departures }
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** The transform that shows a box drawn at `box` (unturned, its own size) at the place `at`: moved, turned and scaled by the long sides. */
export function placeTransform(box: Place, at: Place, extraScale = 1): string {
  const scale = (longSide(at) / Math.max(1, longSide(box))) * extraScale
  return `translate(${round(at.x - box.x)}px, ${round(at.y - box.y)}px) rotate(${round(at.angle)}deg) scale(${round(scale, 3)})`
}

/**
 * The keyframes of a card's ghost - a copy of its face that travels over the
 * board while the card itself already lies (invisible, but clickable) at its
 * new place, or that leaves for a pile. The ghost is drawn unturned at `box`
 * (its face's size there); it goes from `from` to `to`. `fade` lets it vanish
 * at the end (into a pile).
 */
export function travelFrames(box: Place, from: Place, to: Place, fade: "none" | "out" = "none"): Keyframe[] {
  const start = placeTransform(box, from)
  return fade === "out"
    ? [
        { transform: start, opacity: 1 },
        { transform: placeTransform(box, to), opacity: 1, offset: 0.75 },
        { transform: placeTransform(box, to, 0.8), opacity: 0 },
      ]
    : [
        { transform: start, opacity: 1 },
        { transform: placeTransform(box, to), opacity: 1 },
      ]
}

/** The card's own picture while its ghost travels: invisible, then there - a click already finds it at its place. */
export function hiddenWhileTravelling(): Keyframe[] {
  return [{ opacity: 0 }, { opacity: 0, offset: 0.98 }, { opacity: 1 }]
}

/** A card moving within its place: from where it was (relative to where it is now) back to rest. */
export function shiftFrames(dx: number, dy: number, scale: number): Keyframe[] {
  return [{ transform: `translate(${round(dx)}px, ${round(dy)}px) scale(${round(scale, 3)})` }, { transform: "translate(0px, 0px) scale(1)" }]
}

/** A card turning: the picture stands at its old turn and turns to its new one (tapping turns it a quarter to the right). */
export function turnFrames(tapped: boolean): Keyframe[] {
  return [{ transform: `rotate(${tapped ? -90 : 90}deg)` }, { transform: "rotate(0deg)" }]
}

/** A card that came without a place before (a token, a card revealed): it grows into its place. */
export function appearFrames(): Keyframe[] {
  return [
    { transform: "scale(0.82)", opacity: 0 },
    { transform: "scale(1)", opacity: 1 },
  ]
}

/** A card that left without a visible new place: it fades where it was. */
export function vanishFrames(): Keyframe[] {
  return [
    { transform: "scale(1)", opacity: 1 },
    { transform: "scale(0.9)", opacity: 0 },
  ]
}

/** A dropped card (prompt 46) that no travel took over: it fades where it was let go (drawn at `box`, standing at `at`). */
export function dropFadeFrames(box: Place, at: Place): Keyframe[] {
  return [
    { transform: placeTransform(box, at), opacity: 1 },
    { transform: placeTransform(box, at, 0.9), opacity: 0 },
  ]
}

/** A Zauberchronik entry that is new: it glides in from the top of the list. */
export function entryInFrames(glide: boolean): Keyframe[] {
  return glide
    ? [
        { transform: "translate(-0.5rem, -0.6rem) scale(0.96)", opacity: 0 },
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
      ]
    : [{ opacity: 0 }, { opacity: 1 }]
}

/** A Zauberchronik entry that is gone: dissolving (Forge resolved the stack) or simply fading. */
export function entryOutFrames(dissolve: boolean): Keyframe[] {
  return dissolve
    ? [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(1.06)", opacity: 0.7, offset: 0.35 },
        { transform: "scale(1.12)", opacity: 0 },
      ]
    : [{ opacity: 1 }, { opacity: 0 }]
}

/** A short flash of a glow layer (a card's red glow, a medallion's red or green ring). */
export function flashFrames(): Keyframe[] {
  return [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }]
}

/** A card shaken by damage (added to whatever else moves it). */
export function shakeFrames(): Keyframe[] {
  return [
    { transform: "translateX(0px)" },
    { transform: "translateX(-3px)", offset: 0.2 },
    { transform: "translateX(3px)", offset: 0.45 },
    { transform: "translateX(-2px)", offset: 0.7 },
    { transform: "translateX(0px)" },
  ]
}

/** The life total's number when it changes: a pulse. */
export function pulseFrames(): Keyframe[] {
  return [{ transform: "scale(1)" }, { transform: "scale(1.28)", offset: 0.3 }, { transform: "scale(1)" }]
}

/** The gold marker of the Phasen-Tafel: from the old step's place to the new one. */
export function phaseFrames(dx: number, dy: number): Keyframe[] {
  return [
    { transform: `translate(${round(dx)}px, ${round(dy)}px)`, opacity: 0.55 },
    { transform: "translate(0px, 0px)", opacity: 1 },
  ]
}

/** The main button's gloss sweeping across once (its ::after, the same layer as the slow gloss of table.css). */
export function shimmerFrames(): Keyframe[] {
  return [{ transform: "translateX(-120%)" }, { transform: "translateX(120%)" }]
}

/** Every keyframe builder of the table's motion, for the property check (only transform and opacity). */
export const KEYFRAME_SAMPLES: readonly Keyframe[][] = [
  travelFrames({ x: 100, y: 50, w: 40, h: 56, angle: 0 }, { x: 0, y: 0, w: 63, h: 88, angle: 4 }, { x: 100, y: 50, w: 40, h: 56, angle: 0 }),
  travelFrames({ x: 0, y: 0, w: 63, h: 88, angle: 0 }, { x: 0, y: 0, w: 63, h: 88, angle: 0 }, { x: 100, y: 50, w: 20, h: 28, angle: 0 }, "out"),
  hiddenWhileTravelling(),
  shiftFrames(10, -4, 1.1),
  turnFrames(true),
  turnFrames(false),
  appearFrames(),
  vanishFrames(),
  dropFadeFrames({ x: 0, y: 0, w: 80, h: 112, angle: 0 }, { x: 40, y: -30, w: 80, h: 112, angle: 0 }),
  entryInFrames(true),
  entryInFrames(false),
  entryOutFrames(true),
  entryOutFrames(false),
  flashFrames(),
  shakeFrames(),
  pulseFrames(),
  phaseFrames(0, 20),
  shimmerFrames(),
]

/** The entries of Forge's log since the last state the table showed (they come before the state they explain); none when the log was cut back (a replay stepping back). */
export function newEvents(history: readonly GameEvent[], seen: number): readonly GameEvent[] {
  if (seen < 0 || seen >= history.length) return []
  return history.slice(seen)
}

/** The kinds of Forge's log the motion follows - exactly these, all others are ignored. */
export type FollowedEvent = "DAMAGE" | "STACK_ADD" | "STACK_RESOLVE"

export function hasEvent(events: readonly GameEvent[], kind: FollowedEvent): boolean {
  return events.some((event) => event.kind === kind)
}

/** The cards Forge's DAMAGE entries name (the damage's source, if the player may see it). */
export function damageSources(events: readonly GameEvent[]): readonly number[] {
  return [...new Set(events.filter((event) => event.kind === "DAMAGE" && event.card !== undefined).map((event) => event.card!))]
}

/** Players whose life total Forge reports changed: lost (red) or gained (green). */
export function lifeChanges(previous: GameState, next: GameState): readonly { readonly player: number; readonly tone: "loss" | "gain" }[] {
  const out: { player: number; tone: "loss" | "gain" }[] = []
  for (const player of next.players) {
    const before = previous.players.find((candidate) => candidate.id === player.id)
    if (before === undefined || before.life === player.life) continue
    out.push({ player: player.id, tone: player.life < before.life ? "loss" : "gain" })
  }
  return out
}

/** Cards on the battlefields whose damage Forge reports grew (the number on their chip changes): they shake. */
export function damagedCards(previous: GameState, next: GameState): readonly number[] {
  const before = new Map<number, number>()
  for (const player of previous.players) for (const card of player.zones.battlefield) if (isVisible(card)) before.set(card.id, card.damage)
  const out: number[] = []
  for (const player of next.players) {
    for (const card of player.zones.battlefield) {
      if (!isVisible(card)) continue
      const was = before.get(card.id)
      if (was !== undefined && card.damage > was) out.push(card.id)
    }
  }
  return out
}

/** The stack items that are new in this state and those that are gone (Forge's ids, top first). */
export function stackChanges(previous: GameState, next: GameState): { readonly added: readonly number[]; readonly gone: readonly number[] } {
  const before = new Set(previous.stack.map((item) => item.id))
  const after = new Set(next.stack.map((item) => item.id))
  return { added: next.stack.filter((item) => !before.has(item.id)).map((item) => item.id), gone: previous.stack.filter((item) => !after.has(item.id)).map((item) => item.id) }
}

/** Where a card lies in a graveyard or exile of this state, if the player may see it there: whose and which (a leaving card glides there only then). */
export function pileOfCard(state: GameState, id: number): { readonly seat: "me" | "opponent"; readonly zone: "graveyard" | "exile" } | null {
  for (const player of state.players) {
    for (const zone of ["graveyard", "exile"] as const) {
      if (player.zones[zone].some((card) => isVisible(card) && card.id === id)) return { seat: player.me ? "me" : "opponent", zone }
    }
  }
  return null
}

/** Whose a card is in this state, as far as Forge shows it: the controller of a visible card or of a stack item's card; null if unknown. */
export function cardSeat(state: GameState, id: number): "me" | "opponent" | null {
  const me = state.me
  for (const player of state.players) {
    for (const zone of ["battlefield", "hand", "graveyard", "exile", "command"] as const) {
      const card = player.zones[zone].find((candidate) => isVisible(candidate) && candidate.id === id)
      if (card !== undefined && isVisible(card)) return card.controller === me ? "me" : "opponent"
    }
  }
  for (const item of state.stack) {
    const card = stackCard(item)
    if (card !== null && card.id === id) return (item.player ?? card.controller) === me ? "me" : "opponent"
  }
  return null
}
