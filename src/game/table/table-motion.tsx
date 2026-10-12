/*
 * The table's motion (prompt 44, docs/design/SPIELTISCH.md §8; Arena the
 * inspiration, the style OpenMana's own): cards travel from place to place
 * (hand → Zauberchronik → battlefield → graveyard, library → hand), turn when
 * tapped, move forward to attack; damage and life totals react; a new
 * Zauberchronik entry glides in and the top one dissolves when Forge
 * resolves it; the Phasen-Tafel's gold glides to the new step and the main
 * button shimmers at a new priority.
 *
 * Never in the way (§8.1): the new state is on the table and usable at once -
 * the motion only runs over it. A card that travels lies already at its new
 * place, invisible but clickable, while a ghost (a copy of its face, no
 * pointer events, hidden from screen readers) crosses the board; a card that
 * moves within its row moves its picture, while the card itself - the
 * control - stays at its new place. A further state stops everything at once
 * (the pictures jump to their places) before it is measured; nothing waits,
 * nothing is queued, nothing is sent.
 *
 * Presentation, never narration (§8.4): a card is "the same" only by its
 * `data-card` id; the effects follow Forge's values (tapped, damage, life
 * total) and the kinds of Forge's log motion-plan.ts names. No text, no
 * history entry, no rule.
 *
 * Less motion (§8.3): with the device's prefers-reduced-motion or the
 * player's setting nothing is measured and nothing moves (motionReducedNow);
 * switching it on stops what runs. A replay jumping over several steps
 * (`animate` false) changes at once as well.
 *
 * Cost (§9): one reading of the old places before React changes the page (its
 * layout is usually clean, so this costs no layout) and one after - the
 * layout the frame needs anyway, read in one go before anything is written;
 * Web Animations of transform and opacity only. The work is measured as the
 * User Timing `openmana:table-motion`. The arrows wait for the end
 * (MOTION_END_EVENT) and are drawn at the cards' places.
 *
 * Anchors for the tests: the layer `data-slot="table-motion"` with
 * `data-moving` while something moves and `data-last` (what the last state
 * moved: "travel 2 shift 3 …"), `data-states` (how many states it animated).
 *
 * A card dragged out of the hand (prompt 46, HandDrag below): its picture -
 * a ghost like the travelling ones, a full card upright - follows the pointer
 * while the card itself stays in the hand; over the battlefields or the
 * middle the board says so (`data-hand-drop="over"`: their golden glow, only
 * for a card Forge would play). Let go elsewhere, not played or cancelled, it
 * glides back to its place in the hand; dropped and played, it waits where it
 * was let go, and the card's travel of the next state starts there (no second
 * picture from the hand) - or it fades when no travel takes it over. Under
 * less motion it jumps: gone at once.
 */
import { Component, createRef, type RefObject } from "react"
import type { GameEvent, GameState } from "@openmana/engine-protocol"
import { motionReducedNow, watchReducedMotion } from "@/app/motion"
import {
  appearFrames,
  cardSeat,
  DROP_WAIT_MS,
  dropFadeFrames,
  damagedCards,
  damageSources,
  EASE,
  entryInFrames,
  entryOutFrames,
  flashFrames,
  hasEvent,
  hiddenWhileTravelling,
  lifeChanges,
  MOTION_MS,
  newEvents,
  phaseFrames,
  pileOfCard,
  placeTransform,
  planCards,
  pulseFrames,
  REMEMBER_MS,
  shakeFrames,
  shiftFrames,
  shimmerFrames,
  stackChanges,
  travelFrames,
  turnFrames,
  vanishFrames,
  type CardSnap,
  type Place,
} from "./motion-plan"

/** The name of the User Timing measure of one state's motion work (read by the end-to-end test's cost measurement). */
export const MOTION_MEASURE = "openmana:table-motion"
/** Dispatched on the board when the motion of a state ended or was stopped (the arrows draw then). */
export const MOTION_END_EVENT = "openmana:table-motion-end"

/** At most this many ghosts per state: more cards change at once only when the whole table changes. */
const MAX_GHOSTS = 16

/** The cards of the table (not the decision region's, which repeat them): the table's own and the Zauberchronik's. */
const ANCHORS = '[data-card], [data-stack-card]'

interface Snap extends CardSnap {
  readonly anchor: HTMLElement
  readonly face: HTMLElement
  readonly picture: { readonly w: number; readonly h: number } | null
}

interface EntrySnap {
  readonly node: HTMLElement
  readonly place: Place
  readonly card: string | null
}

interface Before {
  readonly cards: ReadonlyMap<string, Snap>
  readonly entries: ReadonlyMap<number, EntrySnap>
  readonly phase: { readonly node: HTMLElement; readonly x: number; readonly y: number } | null
  readonly cost: number
}

export interface TableMotionProps {
  readonly state: GameState
  readonly history: readonly GameEvent[]
  /** Animate the change to this state; false: it changes at once (a replay jumping over several steps). */
  readonly animate: boolean
  /** The id of Forge's open priority question; a new one makes the main button shimmer once. */
  readonly priority: number | null
}

function requestFrame(callback: () => void): number {
  return typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : (setTimeout(callback, 0) as unknown as number)
}

function cancelFrame(frame: number): void {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame)
  else clearTimeout(frame)
}

function canAnimate(): boolean {
  return typeof Element !== "undefined" && typeof Element.prototype.animate === "function"
}

/** A box of the page in the board's coordinates, as a place (centre and size, unturned). */
function placeOf(rect: DOMRect, origin: DOMRect, w = rect.width, h = rect.height, angle = 0): Place {
  return { x: rect.left + rect.width / 2 - origin.left, y: rect.top + rect.height / 2 - origin.top, w, h, angle }
}

/** A fanned hand card's turn (its resting place's --rot; a lifted card stands upright). */
function handAngle(anchor: HTMLElement): number {
  const item = anchor.closest<HTMLElement>("[data-hand-card]")
  if (item === null || item.hasAttribute("data-lifted")) return 0
  return Number.parseFloat(item.style.getPropertyValue("--rot")) || 0
}

function onTable(element: Element): boolean {
  return element.closest('[data-area="decision"]') === null
}

/** Every card of the table with its face's place - read in one go. A pile's cards all lie at its front card's place. */
function measureCards(board: HTMLElement, origin: DOMRect): Map<string, Snap> {
  const cards = new Map<string, Snap>()
  for (const anchor of board.querySelectorAll<HTMLElement>(ANCHORS)) {
    if (!onTable(anchor)) continue
    const stack = anchor.dataset["card"] === undefined
    const id = anchor.dataset["card"] ?? anchor.dataset["stackCard"]
    if (id === undefined) continue
    // A card on the battlefield that is also an ability's source on the stack: the table's card is the card.
    if (stack && cards.has(`card:${id}`)) continue
    const face = anchor.querySelector<HTMLElement>('[data-slot="game-card-face"]') ?? anchor
    const rect = face.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) continue
    const picture = face.querySelector<HTMLElement>('[data-slot="game-card-picture"]')
    const snap = {
      anchor,
      face,
      node: anchor,
      tapped: anchor.dataset["tapped"] === "true",
      place: placeOf(rect, origin, face.offsetWidth || rect.width, face.offsetHeight || rect.height, handAngle(anchor)),
      picture: picture === null ? null : { w: picture.offsetWidth, h: picture.offsetHeight },
    }
    const ids = anchor.dataset["pileCards"]?.split(" ") ?? [id]
    for (const each of ids.includes(id) ? ids : [id, ...ids]) {
      const key = `card:${each}`
      if (!stack || !cards.has(key)) cards.set(key, { ...snap, key })
    }
  }
  return cards
}

function measureEntries(board: HTMLElement, origin: DOMRect): Map<number, EntrySnap> {
  const entries = new Map<number, EntrySnap>()
  for (const node of board.querySelectorAll<HTMLElement>('[data-area="center"] [data-stack-item]')) {
    const id = Number(node.dataset["stackItem"])
    const rect = node.getBoundingClientRect()
    if (!Number.isFinite(id) || rect.width < 1) continue
    const card = node.querySelector<HTMLElement>("[data-stack-card]")?.dataset["stackCard"]
    entries.set(id, { node, place: placeOf(rect, origin, node.offsetWidth || rect.width, node.offsetHeight || rect.height), card: card === undefined ? null : `card:${card}` })
  }
  return entries
}

/** The Phasen-Tafel's gold: the current step where the steps show, else the current phase (the compact line, the folded panel). */
function phaseMarker(board: HTMLElement): HTMLElement | null {
  const panel = board.querySelector('[data-slot="phase-panel"]')
  if (panel === null) return null
  const step = panel.querySelector<HTMLElement>('.table-phase-step[data-state="current"]')
  if (step !== null && step.getClientRects().length > 0) return step
  return panel.querySelector<HTMLElement>('.table-phase-group[data-state="current"] > .table-phase')
}

/** A copy of a face or an entry to travel or fade over the board: no ids, no slots, no names - nothing a test, a screen reader or the arrows count. */
function scrubbed(source: HTMLElement, picture: { readonly w: number; readonly h: number } | null): HTMLElement {
  const copy = source.cloneNode(true) as HTMLElement
  if (picture !== null) {
    const pictureCopy = copy.querySelector<HTMLElement>('[data-slot="game-card-picture"]')
    if (pictureCopy !== null) {
      pictureCopy.style.width = `${picture.w}px`
      pictureCopy.style.height = `${picture.h}px`
    }
  }
  // The picture the card shows (its loaded source, not the set to choose from again): drawn at once, from the cache. A
  // picture still loading is left out - a ghost never asks the network for anything.
  const originals = [...source.querySelectorAll("img")]
  copy.querySelectorAll("img").forEach((image, index) => {
    const shown = originals[index]?.currentSrc ?? ""
    if (shown === "") {
      image.remove()
      return
    }
    image.removeAttribute("srcset")
    image.removeAttribute("sizes")
    image.src = shown
  })
  // No plaque, no words for screen readers, no loading shimmer: a picture still loading stays the panel's tone.
  for (const part of copy.querySelectorAll(".table-plaque, .sr-only, [data-slot='skeleton']")) part.remove()
  for (const image of copy.querySelectorAll("img.opacity-0")) image.classList.remove("opacity-0")
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const name of element.getAttributeNames()) {
      if (name.startsWith("data-") || name.startsWith("aria-") || name === "id" || name === "role" || name === "title" || name === "tabindex") element.removeAttribute(name)
    }
    if (element instanceof HTMLImageElement) {
      element.alt = ""
      element.loading = "eager"
      element.decoding = "sync"
    }
  }
  copy.style.width = "100%"
  copy.style.height = "100%"
  return copy
}

/** A face shows its picture already (loaded, not a placeholder). */
function showsPicture(face: HTMLElement): boolean {
  const image = face.querySelector("img")
  return image !== null && image.complete && image.naturalWidth > 0
}

/** The ghost's box over the board, drawn unturned at `box`. */
function ghostAt(content: HTMLElement, box: Place): HTMLElement {
  const ghost = document.createElement("div")
  ghost.className = "table-motion-ghost"
  ghost.style.left = `${box.x - box.w / 2}px`
  ghost.style.top = `${box.y - box.h / 2}px`
  ghost.style.width = `${box.w}px`
  ghost.style.height = `${box.h}px`
  ghost.append(content)
  return ghost
}

/** The place an arriving card comes from, if any: the library for the player's hand, the opponent's hand for the opponent's cards. */
function sourceElement(board: HTMLElement, anchor: HTMLElement, seat: "me" | "opponent" | null): Element | null {
  if (anchor.closest('[data-area="hand"]') !== null) return board.querySelector('[data-area="me"] [data-zone-pile="Bibliothek"] .table-pile-card') ?? board.querySelector('[data-area="me"] [data-zone-pile="Bibliothek"]')
  const theirs = seat === "opponent" || anchor.closest('[data-area="opponent"], [data-area="opponent-field"]') !== null
  if (!theirs) return null
  const backs = board.querySelector('[data-area="opponent"] .table-hand-backs')
  if (backs !== null && backs.getClientRects().length > 0) return backs
  return [...board.querySelectorAll('[data-area="opponent"] [data-slot="game-player"]')].find(onTable) ?? null
}

/** The pile a leaving card glides to (only where Forge shows it there now). */
function pileElement(board: HTMLElement, pile: { readonly seat: "me" | "opponent"; readonly zone: "graveyard" | "exile" }): Element | null {
  const name = pile.zone === "graveyard" ? "Friedhof" : "Exil"
  const zone = board.querySelector(`[data-area="${pile.seat}"] [data-zone-pile="${name}"]`)
  return zone?.querySelector(".table-pile-card, .table-chip") ?? zone
}

// ── A card dragged out of the hand (prompt 46) ──

/** The regions a hand card is dropped on: both battlefields - with the centre line between them - and the middle (stack and combat). */
const FIELD_AREAS = ':scope > [data-slot="game-board-area"]:is([data-area="opponent-field"], [data-area="field"])'
const CENTER_AREA = ':scope > [data-slot="game-board-area"][data-area="center"]'
/** Where the pointer holds a dragged card: across its middle, at this share of its height (the card stands above a finger). */
const HOLD_AT = 0.7

/** A card dropped and played (prompt 46): its waiting picture where it was let go, for the travel of Forge's next state. */
interface Drop {
  /** The card's key (`card:<id>`). */
  readonly card: string
  /** Where it was let go (board coordinates, upright). */
  readonly place: Place
  readonly ghost: HTMLElement
  readonly timer: ReturnType<typeof setTimeout>
  readonly done: () => void
}

/** The drop waiting on each board (one at a time). */
const drops = new WeakMap<HTMLElement, Drop>()

/** The motion may run now: the browser animates and nobody asked for less motion. */
function moving(): boolean {
  return canAnimate() && !motionReducedNow()
}

/** The waiting picture of a drop goes (its travel took over, it faded, or a new drag began). */
function settleDrop(board: HTMLElement, drop: Drop): void {
  if (drops.get(board) !== drop) return
  drops.delete(board)
  clearTimeout(drop.timer)
  drop.ghost.remove()
  drop.done()
}

/**
 * A card dragged out of the hand (prompt 46): an upright copy of its face at
 * a full card's size - no ids, no slots, hidden from screen readers, no
 * pointer events - in the motion's layer, following the pointer (moved by
 * its transform only) and kept inside the board, so it is always seen whole.
 * The card itself stays in the hand. The board carries `data-hand-drag`
 * while it is dragged and `data-hand-drop="over"` while it lies over the
 * battlefields or the middle and would be played (the golden glow, table.css).
 */
export class HandDrag {
  private readonly board: HTMLElement
  private readonly ghost: HTMLElement
  /** Where the ghost is drawn (board coordinates); it stands at `at` by its transform. */
  private readonly box: Place
  private at: Place
  private gone = false

  private constructor(board: HTMLElement, ghost: HTMLElement, box: Place) {
    this.board = board
    this.ghost = ghost
    this.box = box
    this.at = box
  }

  /** Starts dragging the card whose face is `face` at `point` (client coordinates); null without the board's motion layer. */
  static start(face: HTMLElement, size: { readonly width: number; readonly height: number }, point: { readonly x: number; readonly y: number }): HandDrag | null {
    const board = face.closest<HTMLElement>('[data-slot="game-board"]')
    const layer = board?.querySelector<HTMLElement>(':scope > [data-slot="table-motion"]')
    if (board === null || board === undefined || layer === null || layer === undefined) return null
    const waiting = drops.get(board)
    if (waiting !== undefined) settleDrop(board, waiting)
    const picture = face.querySelector<HTMLElement>('[data-slot="game-card-picture"]')
    const scale = size.width / Math.max(1, face.offsetWidth || size.width)
    const content = scrubbed(face, picture === null ? null : { w: picture.offsetWidth * scale, h: picture.offsetHeight * scale })
    const box = HandDrag.place(board, size, point)
    const ghost = ghostAt(content, box)
    ghost.classList.add("table-hand-drag")
    layer.append(ghost)
    board.dataset["handDrag"] = ""
    return new HandDrag(board, ghost, box)
  }

  /** The card's place for a pointer at `point`: held at HOLD_AT, its whole inside the board. */
  private static place(board: HTMLElement, size: { readonly width: number; readonly height: number }, point: { readonly x: number; readonly y: number }): Place {
    const origin = board.getBoundingClientRect()
    const w = size.width
    const h = size.height
    const within = (value: number, half: number, length: number) => (length <= 2 * half ? length / 2 : Math.min(Math.max(value, half), length - half))
    return {
      x: within(point.x - origin.left, w / 2, origin.width),
      y: within(point.y - origin.top - (HOLD_AT - 0.5) * h, h / 2, origin.height),
      w,
      h,
      angle: 0,
    }
  }

  /** The card follows the pointer. */
  move(point: { readonly x: number; readonly y: number }): void {
    if (this.gone) return
    this.at = HandDrag.place(this.board, { width: this.box.w, height: this.box.h }, point)
    this.ghost.style.transform = placeTransform(this.box, this.at)
  }

  /** The card's middle lies over the battlefields (or the centre line between them) or the middle of the table. */
  over(): boolean {
    const origin = this.board.getBoundingClientRect()
    const x = origin.left + this.at.x
    const y = origin.top + this.at.y
    const inside = (box: { left: number; top: number; right: number; bottom: number }) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
    const shown = (element: Element | null): DOMRect | null => {
      const rect = element?.getBoundingClientRect()
      return rect === undefined || rect.width <= 0 || rect.height <= 0 ? null : rect
    }
    const center = shown(this.board.querySelector(CENTER_AREA))
    if (center !== null && inside(center)) return true
    const fields = [...this.board.querySelectorAll(FIELD_AREAS)].map(shown).filter((rect): rect is DOMRect => rect !== null)
    if (fields.length === 0) return false
    return inside({
      left: Math.min(...fields.map((rect) => rect.left)),
      top: Math.min(...fields.map((rect) => rect.top)),
      right: Math.max(...fields.map((rect) => rect.right)),
      bottom: Math.max(...fields.map((rect) => rect.bottom)),
    })
  }

  /** The battlefields' golden glow: the card lies over them and would be played. */
  glow(on: boolean): void {
    if (on) this.board.dataset["handDrop"] = "over"
    else delete this.board.dataset["handDrop"]
  }

  private finish(): void {
    this.gone = true
    this.glow(false)
    delete this.board.dataset["handDrag"]
  }

  /** Not played: the card glides back to its place in the hand (`rest`, its face there), then `done`; under less motion at once. */
  back(rest: HTMLElement | null, done: () => void): void {
    if (this.gone) return
    this.finish()
    const rect = rest?.getBoundingClientRect()
    if (rest === null || rect === undefined || rect.width < 1 || !moving()) {
      this.ghost.remove()
      done()
      return
    }
    const origin = this.board.getBoundingClientRect()
    const anchor = rest.closest<HTMLElement>("[data-card]") ?? rest
    const to = placeOf(rect, origin, rest.offsetWidth || rect.width, rest.offsetHeight || rect.height, handAngle(anchor))
    const played = this.ghost.animate(travelFrames(this.box, this.at, to), { duration: MOTION_MS.back, easing: EASE, fill: "forwards" })
    played.finished.then(
      () => undefined,
      () => undefined,
    ).finally(() => {
      this.ghost.remove()
      done()
    })
  }

  /**
   * Dropped and played (Forge's tap sent): the card waits where it was let go
   * for Forge's next state, whose travel of the card starts there (TableMotion
   * takes it over); without one within DROP_WAIT_MS it fades. `done` when it
   * is gone. Under less motion it is gone at once.
   */
  drop(card: number, done: () => void): void {
    if (this.gone) return
    this.finish()
    if (!moving()) {
      this.ghost.remove()
      done()
      return
    }
    const board = this.board
    const ghost = this.ghost
    const at = this.at
    const timer = setTimeout(() => {
      const waiting = drops.get(board)
      if (waiting === undefined || waiting.ghost !== ghost) return
      drops.delete(board)
      const fade = ghost.animate(dropFadeFrames(this.box, at), { duration: MOTION_MS.vanish, easing: "ease-out", fill: "forwards" })
      fade.finished.then(
        () => undefined,
        () => undefined,
      ).finally(() => {
        ghost.remove()
        done()
      })
    }, DROP_WAIT_MS)
    drops.set(board, { card: `card:${card}`, place: at, ghost, timer, done })
  }

  /** The hand went while the card was dragged: the picture goes at once. */
  cancel(): void {
    if (this.gone) return
    this.finish()
    this.ghost.remove()
  }
}

export class TableMotion extends Component<TableMotionProps> {
  private readonly root: RefObject<HTMLDivElement | null> = createRef<HTMLDivElement>()
  /** Forge's log entries the motion has already followed (those up to the last state). */
  private seen: number
  private running: Animation[] = []
  private ghosts: HTMLElement[] = []
  private moving: Element[] = []
  private generation = 0
  private states = 0
  /** Where cards that left the table without a visible new place were last (a spell paid for, then on the stack). */
  private readonly memory = new Map<string, { readonly place: Place; readonly at: number }>()
  private unwatch: (() => void) | null = null
  /** The frame the new layout is read in (after React's own follow-up renders of the same moment, before the first paint). */
  private frame: number | null = null

  constructor(props: TableMotionProps) {
    super(props)
    this.seen = props.history.length
  }

  override componentDidMount(): void {
    this.unwatch = watchReducedMotion(() => {
      if (motionReducedNow()) this.stop()
    })
  }

  override componentWillUnmount(): void {
    this.unwatch?.()
    this.stop()
  }

  private board(): HTMLElement | null {
    return this.root.current?.closest<HTMLElement>('[data-slot="game-board"]') ?? null
  }

  private allowed(): boolean {
    return canAnimate() && !motionReducedNow()
  }

  /** Ends everything at once: animations cancelled (the pictures stand at their places), ghosts gone; the arrows are told. */
  stop(): void {
    if (this.frame !== null) cancelFrame(this.frame)
    this.frame = null
    this.generation++
    const had = this.running.length > 0 || this.ghosts.length > 0
    for (const animation of this.running) animation.cancel()
    this.cleanUp()
    if (had) this.board()?.dispatchEvent(new CustomEvent(MOTION_END_EVENT))
  }

  private cleanUp(): void {
    for (const ghost of this.ghosts) ghost.remove()
    for (const element of this.moving) element.classList.remove("table-motion-moving")
    this.running = []
    this.ghosts = []
    this.moving = []
    if (this.root.current !== null) delete this.root.current.dataset["moving"]
  }

  override getSnapshotBeforeUpdate(previous: Readonly<TableMotionProps>): Before | null {
    if (previous.state === this.props.state) return null
    // A further state: what still moves jumps to its end before anything is read.
    this.stop()
    const board = this.board()
    if (board === null || !this.props.animate || !this.allowed()) return null
    const origin = board.getBoundingClientRect()
    const start = performance.now()
    const cards = measureCards(board, origin)
    const entries = measureEntries(board, origin)
    const marker = phaseMarker(board)
    const markerRect = marker?.getBoundingClientRect()
    const phase = marker === null || markerRect === undefined ? null : { node: marker, x: markerRect.left + markerRect.width / 2, y: markerRect.top + markerRect.height / 2 }
    return { cards, entries, phase, cost: performance.now() - start }
  }

  override componentDidUpdate(previous: Readonly<TableMotionProps>, _state: unknown, before: Before | null): void {
    const stateChanged = previous.state !== this.props.state
    const events = stateChanged ? newEvents(this.props.history, this.seen) : []
    if (stateChanged) this.seen = this.props.history.length
    const shimmer = previous.priority !== this.props.priority && this.props.priority !== null
    if (before !== null) {
      // The new layout is read at the next frame, before it is painted: the table settles first (a decision that grows
      // takes room in a render right after this one), and nothing is painted at its new place before the motion starts.
      const previousState = previous.state
      if (this.frame !== null) cancelFrame(this.frame)
      this.frame = requestFrame(() => {
        this.frame = null
        this.animateState(previousState, events, before, shimmer)
      })
    } else if (shimmer && this.allowed() && this.props.animate) this.shimmer()
  }

  /** The main button's gloss sweeps across once (a new priority without a new state); a further state stops it like the rest. */
  private shimmer(): void {
    const button = this.board()?.querySelector<HTMLElement>('[data-main]:not(:disabled)')
    if (button === null || button === undefined) return
    this.running.push(button.animate(shimmerFrames(), { duration: MOTION_MS.shimmer, easing: "ease-in-out", pseudoElement: "::after" }))
    if (this.root.current !== null) this.root.current.dataset["shimmers"] = String(Number(this.root.current.dataset["shimmers"] ?? 0) + 1)
  }

  /** A ghost goes the moment its own animation ends (a travelling card hands over to itself at its place). */
  private ghostAnimation(ghost: HTMLElement, played: Animation): Animation {
    played.finished.then(
      () => ghost.remove(),
      () => undefined,
    )
    return played
  }

  private animateState(previousState: GameState, events: readonly GameEvent[], before: Before, shimmer: boolean): void {
    const board = this.board()
    const layer = this.root.current
    if (board === null || layer === null) return
    const state = this.props.state
    const now = Date.now()
    for (const [key, remembered] of this.memory) if (now - remembered.at > REMEMBER_MS) this.memory.delete(key)

    // ── Reading: the new layout, in one go (nothing is written before the last read). The board's box first: it
    // brings the layout up to date (the frame would do that anyway); the measure is the motion's own work after it. ──
    const origin = board.getBoundingClientRect()
    const start = performance.now()
    const after = measureCards(board, origin)
    const plan = planCards(before.cards, after)
    let ghosts = 0
    // A travelling card's ghost is a copy of its old face where it had one (its picture is there already), else of its new one.
    // A card dropped onto the battlefield (prompt 46) travels from where it was let go, as its waiting picture showed it.
    const dropped = drops.get(board) ?? null
    const fromDrop = (key: string, snap: Snap): Snap => (dropped === null || dropped.card !== key ? snap : { ...snap, place: dropped.place, picture: snap.picture === null ? null : { w: (snap.picture.w * dropped.place.w) / Math.max(1, snap.place.w), h: (snap.picture.h * dropped.place.w) / Math.max(1, snap.place.w) } })
    let dropTaken = false
    const travels: { snap: Snap; look: Snap; from: Place; to: Place }[] = []
    const shifts: { snap: Snap; from: Place; children: { element: HTMLElement; rect: DOMRect }[] }[] = []
    // A pile's cards share one place: it moves once.
    const shifting = new Set<Element>()
    for (const move of plan.moves) {
      const snap = after.get(move.key)!
      if (!move.within && ghosts < MAX_GHOSTS) {
        ghosts++
        const look = fromDrop(move.key, before.cards.get(move.key) ?? snap)
        if (look.place !== move.from) dropTaken = true
        travels.push({ snap, look, from: look === snap ? move.from : look.place, to: move.to })
      } else if (move.within && !shifting.has(snap.anchor)) {
        shifting.add(snap.anchor)
        shifts.push({ snap, from: move.from, children: [...snap.anchor.children].filter((child): child is HTMLElement => child instanceof HTMLElement).map((element) => ({ element, rect: element.getBoundingClientRect() })) })
      }
    }
    const appears: Snap[] = []
    for (const key of plan.arrivals) {
      const snap = after.get(key)!
      const remembered = this.memory.get(key)
      if (remembered !== undefined) this.memory.delete(key)
      let from: Place | null = remembered?.place ?? null
      if (from === null) {
        const source = sourceElement(board, snap.anchor, cardSeat(state, Number(key.slice(5))))
        if (source !== null) from = placeOf(source.getBoundingClientRect(), origin)
      }
      if (from !== null && ghosts < MAX_GHOSTS) {
        ghosts++
        travels.push({ snap, look: snap, from, to: snap.place })
      } else appears.push(snap)
    }
    const departures: { snap: Snap; to: Place | null }[] = []
    for (const key of plan.departures) {
      const left = before.cards.get(key)!
      if (left.anchor.isConnected) continue
      const snap = fromDrop(key, left)
      if (snap !== left) dropTaken = true
      const pile = pileOfCard(state, Number(key.slice(5)))
      const target = pile === null ? null : pileElement(board, pile)
      if (pile === null) this.memory.set(key, { place: snap.place, at: now })
      if (ghosts >= MAX_GHOSTS) continue
      ghosts++
      departures.push({ snap, to: target === null ? null : placeOf(target.getBoundingClientRect(), origin) })
    }
    const stack = stackChanges(previousState, state)
    const added = stack.added.map((id) => board.querySelector<HTMLElement>(`[data-area="center"] [data-stack-item="${id}"]`)).filter((node): node is HTMLElement => node !== null)
    const gone = stack.gone.map((id) => before.entries.get(id)).filter((entry): entry is EntrySnap => entry !== undefined && !entry.node.isConnected)
    const marker = phaseMarker(board)
    const markerRect = marker?.getBoundingClientRect()
    const flashes = new Set<string>()
    for (const id of damageSources(events)) flashes.add(`card:${id}`)
    const shaken = damagedCards(previousState, state).map((id) => `card:${id}`)
    for (const key of shaken) flashes.add(key)
    const lives = lifeChanges(previousState, state)
      .map(({ player, tone }) => ({ tone, medallion: [...board.querySelectorAll<HTMLElement>(`[data-slot="game-player"][data-player="${player}"]`)].find(onTable) ?? null }))
      .filter((life): life is { tone: "loss" | "gain"; medallion: HTMLElement } => life.medallion !== null)

    // ── Writing: ghosts and animations. ──
    const animations: Animation[] = []
    const counts: Record<string, number> = {}
    const count = (name: string) => {
      counts[name] = (counts[name] ?? 0) + 1
    }
    const fragment = document.createDocumentFragment()
    const shown = new Set([...before.cards.values()].map((snap) => snap.node))
    const hidden = new Set<Element>()
    // An arriving card whose picture is not there yet (just put on the table) travels as OpenMana's back, like the library's.
    const back = board.querySelector<HTMLElement>('[data-zone-pile="Bibliothek"] [data-slot="game-card-back"]')
    for (const { snap, look, from, to } of travels) {
      const box = look === snap ? to : from
      const content = look === snap && !showsPicture(snap.face) && back !== null ? scrubbed(back, null) : scrubbed(look.face, look.picture)
      const ghost = ghostAt(content, box)
      fragment.append(ghost)
      this.ghosts.push(ghost)
      animations.push(this.ghostAnimation(ghost, ghost.animate(travelFrames(box, from, to), { duration: MOTION_MS.travel, easing: EASE })))
      // The card at its new place shows once its ghost arrives - unless that place showed a card before (a pile it joins).
      if (!shown.has(snap.node) && !hidden.has(snap.anchor)) {
        hidden.add(snap.anchor)
        for (const child of snap.anchor.children) animations.push(child.animate(hiddenWhileTravelling(), { duration: MOTION_MS.travel }))
      }
      count("travel")
    }
    for (const { snap, to } of departures) {
      const ghost = ghostAt(scrubbed(snap.face, snap.picture), snap.place)
      fragment.append(ghost)
      this.ghosts.push(ghost)
      animations.push(this.ghostAnimation(ghost, ghost.animate(to === null ? vanishFrames() : travelFrames(snap.place, snap.place, to, "out"), { duration: to === null ? MOTION_MS.vanish : MOTION_MS.travel, easing: EASE, fill: "forwards" })))
      count(to === null ? "vanish" : "to-pile")
    }
    for (const entry of gone) {
      const copy = scrubbed(entry.node, null)
      // The card of an entry that travels on (a permanent to the battlefield) goes with its own ghost.
      if (entry.card !== null && after.has(entry.card)) copy.querySelector<HTMLElement>(".table-chronicle-card")?.style.setProperty("visibility", "hidden")
      const ghost = ghostAt(copy, entry.place)
      fragment.append(ghost)
      this.ghosts.push(ghost)
      const dissolve = hasEvent(events, "STACK_RESOLVE")
      animations.push(this.ghostAnimation(ghost, ghost.animate(entryOutFrames(dissolve), { duration: MOTION_MS.entry, easing: "ease-out", fill: "forwards" })))
      count(dissolve ? "dissolve" : "entry-out")
    }
    if (fragment.childNodes.length > 0) layer.append(fragment)
    // The dropped card's waiting picture hands over to its travel.
    if (dropTaken && dropped !== null) settleDrop(board, dropped)
    for (const { snap, from, children } of shifts) {
      const to = snap.place
      const scale = Math.max(from.w, from.h) / Math.max(1, Math.max(to.w, to.h))
      for (const { element, rect } of children) {
        const cx = rect.left + rect.width / 2 - origin.left
        const cy = rect.top + rect.height / 2 - origin.top
        // The child's centre where it was: the card's old centre plus its offset from the card's centre, scaled.
        const dx = from.x + scale * (cx - to.x) - cx
        const dy = from.y + scale * (cy - to.y) - cy
        element.classList.add("table-motion-moving")
        this.moving.push(element)
        animations.push(element.animate(shiftFrames(dx, dy, scale), { duration: MOTION_MS.shift, easing: EASE }))
      }
      count("shift")
    }
    const turned = [...plan.moves.filter((move) => move.within && move.turned).map((move) => ({ key: move.key, tapped: after.get(move.key)!.tapped })), ...plan.turns]
    const turning = new Set<Element>()
    for (const { key, tapped } of turned) {
      const picture = after.get(key)?.face.querySelector('[data-slot="game-card-picture"]')
      if (picture === null || picture === undefined || turning.has(picture)) continue
      turning.add(picture)
      animations.push(picture.animate(turnFrames(tapped), { duration: MOTION_MS.tap, easing: "ease-out" }))
      count("turn")
    }
    for (const snap of appears) {
      for (const child of snap.anchor.children) animations.push(child.animate(appearFrames(), { duration: MOTION_MS.appear, easing: "ease-out" }))
      count("appear")
    }
    const flashing = new Set<Element>()
    for (const key of flashes) {
      const face = after.get(key)?.face
      if (face === undefined || flashing.has(face)) continue
      flashing.add(face)
      animations.push(face.animate(flashFrames(), { duration: MOTION_MS.flash, easing: "ease-out", pseudoElement: "::before" }))
      count("flash")
    }
    for (const key of shaken) {
      const face = after.get(key)?.face
      if (face === undefined) continue
      animations.push(face.animate(shakeFrames(), { duration: MOTION_MS.flash, easing: "ease-out", composite: "add" }))
      count("shake")
    }
    for (const { medallion, tone } of lives) {
      const flash = medallion.querySelector<HTMLElement>(".table-medallion-flash")
      if (flash !== null) {
        flash.dataset["tone"] = tone
        animations.push(flash.animate(flashFrames(), { duration: MOTION_MS.flash, easing: "ease-out" }))
      }
      const life = medallion.querySelector(".table-medallion-life")
      if (life !== null) animations.push(life.animate(pulseFrames(), { duration: MOTION_MS.flash, easing: "ease-out" }))
      count(`life-${tone}`)
    }
    const glide = hasEvent(events, "STACK_ADD")
    for (const node of added) {
      animations.push(node.animate(entryInFrames(glide), { duration: MOTION_MS.entry, easing: EASE }))
      count(glide ? "entry-glide" : "entry-in")
    }
    if (marker !== null && markerRect !== undefined && before.phase !== null) {
      const dx = before.phase.x - (markerRect.left + markerRect.width / 2)
      const dy = before.phase.y - (markerRect.top + markerRect.height / 2)
      if (before.phase.node !== marker || Math.hypot(dx, dy) > 1) {
        animations.push(marker.animate(phaseFrames(dx, dy), { duration: MOTION_MS.phase, easing: EASE }))
        count("phase")
      }
    }
    if (shimmer && this.props.animate) {
      const button = board.querySelector<HTMLElement>('[data-main]:not(:disabled)')
      if (button !== null) {
        animations.push(button.animate(shimmerFrames(), { duration: MOTION_MS.shimmer, easing: "ease-in-out", pseudoElement: "::after" }))
        count("shimmer")
      }
    }
    this.states++
    layer.dataset["states"] = String(this.states)
    this.track(animations, Object.entries(counts).map(([name, n]) => `${name} ${n}`).join(" "))
    if (typeof performance.measure === "function") {
      performance.clearMeasures(MOTION_MEASURE)
      performance.measure(MOTION_MEASURE, { start, duration: before.cost + (performance.now() - start) })
    }
  }

  /** Keeps the state's animations; once all ended (or were cancelled), the ghosts go and the arrows are told. */
  private track(animations: readonly Animation[], summary: string): void {
    const layer = this.root.current
    if (layer === null) return
    layer.dataset["last"] = summary
    if (animations.length === 0) {
      this.cleanUp()
      return
    }
    this.running.push(...animations)
    layer.dataset["moving"] = ""
    const generation = this.generation
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (generation !== this.generation) return
      this.generation++
      this.cleanUp()
      this.board()?.dispatchEvent(new CustomEvent(MOTION_END_EVENT))
    })
  }

  override render() {
    return <div ref={this.root} data-slot="table-motion" aria-hidden="true" className="table-motion" />
  }
}
