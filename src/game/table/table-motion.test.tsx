/*
 * The table's motion in the real table (prompt 44, table-motion.tsx; GameTable
 * on the recorded run of consecutive real states, src/test/table-sequence.ts).
 * jsdom has neither layout nor Web Animations: the boxes are stand-ins by
 * region and place in the row, and element.animate records what would move.
 * Real Chrome checks the same in the end-to-end test (tableMotion).
 *
 * What is checked: a card moves only as itself (its id); nothing moves under
 * less motion (the device's or the player's) or when a replay jumps; a
 * further state stops what runs (and a state that comes before the motion
 * started skips it); a click during the motion hits the card at its new
 * place; the effects follow Forge (damage, life, stack); the ghosts are
 * invisible to tests, screen readers and pointers.
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REDUCED_MOTION_ATTRIBUTE } from "@/app/motion"
import { sequenceMoment, TABLE_SEQUENCE } from "@/test/table-sequence"
import { GameTable } from "../game-table"
import { NO_PICTURES } from "../table-cards"
import { MOTION_PROPERTIES } from "./motion-plan"
import { MOTION_END_EVENT } from "./table-motion"

interface Played {
  readonly target: Element
  readonly keyframes: Keyframe[]
  readonly options: KeyframeAnimationOptions
  readonly animation: { cancel: ReturnType<typeof vi.fn>; finished: Promise<unknown> }
  readonly end: () => void
}

let played: Played[] = []
const originalAnimate = Element.prototype.animate
const originalRect = HTMLElement.prototype.getBoundingClientRect

/** Stand-in places: each region a band of the page, each card its place in its row. */
const AREA_Y: Readonly<Record<string, number>> = { header: 0, opponent: 40, "opponent-field": 120, center: 320, field: 420, me: 620, hand: 700, decision: 860 }

function fakeRect(this: HTMLElement): DOMRect {
  if (this.matches('[data-slot="game-board"]')) return new DOMRect(0, 0, 1000, 1000)
  const area = this.closest<HTMLElement>("[data-area]")?.dataset["area"]
  if (area === undefined) return new DOMRect(0, 0, 0, 0)
  const item = this.closest("li") ?? this
  const index = item.parentElement === null ? 0 : [...item.parentElement.children].indexOf(item)
  return new DOMRect(20 + index * 70, AREA_Y[area] ?? 0, 60, 84)
}

function fakeAnimate(this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions): Animation {
  let resolve: (value: unknown) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const finished = new Promise((ok, fail) => {
    resolve = ok
    reject = fail
  })
  finished.catch(() => undefined)
  const animation = { cancel: vi.fn(() => reject(new Error("cancelled"))), finished }
  played.push({ target: this, keyframes: keyframes as Keyframe[], options: (typeof options === "number" ? { duration: options } : options) ?? {}, animation, end: () => resolve(animation) })
  return animation as unknown as Animation
}

beforeEach(() => {
  played = []
  Element.prototype.animate = fakeAnimate as typeof Element.prototype.animate
  HTMLElement.prototype.getBoundingClientRect = fakeRect
})

afterEach(() => {
  Element.prototype.animate = originalAnimate
  HTMLElement.prototype.getBoundingClientRect = originalRect
  document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE)
})

function table(step: number, animate = true) {
  const moment = sequenceMoment(step)
  return (
    <GameTable
      state={moment.state}
      history={moment.history}
      questions={moment.questions}
      prompt={moment.prompt}
      waiting
      animate={animate}
      aiProfile={TABLE_SEQUENCE.game.aiProfile}
      pictures={NO_PICTURES}
      menu={<button type="button">Menü</button>}
    />
  )
}

/** The frame the motion reads the new layout in. */
async function nextFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40))
  })
}

const layer = () => document.querySelector<HTMLElement>('[data-slot="table-motion"]')!
const ghosts = () => [...layer().querySelectorAll<HTMLElement>(".table-motion-ghost")]
/** The ghosts' travels: animations on a ghost whose first frame moves it. */
const travels = () => played.filter((call) => call.target.classList.contains("table-motion-ghost") && String(call.keyframes[0]?.["transform"] ?? "").startsWith("translate("))

describe("cards travel as themselves", () => {
  it("a card drawn comes from the library; nothing else travels; the card itself lies at its place", async () => {
    const view = render(table(0))
    expect(played).toEqual([])
    view.rerender(table(1))
    // Nothing before the frame: the table first settles.
    expect(played).toEqual([])
    await nextFrame()
    // Step 1: Forge's draw - Bergkamm (27) into the player's hand.
    const drawn = document.querySelector('[data-area="hand"] [data-card="27"]')!
    expect(drawn).not.toBeNull()
    expect(travels()).toHaveLength(1)
    expect(ghosts()).toHaveLength(1)
    // The ghost starts at the library (its stand-in place: the strip "Du", first place) and ends at the card's place.
    const [travel] = travels()
    expect(travel!.keyframes[0]!["transform"]).toMatch(/^translate\(-?\d/)
    expect(travel!.keyframes.at(-1)!["transform"]).toBe("translate(0px, 0px) rotate(0deg) scale(1)")
    // The card's own parts are invisible until the ghost arrives - and the card itself never moves.
    const hidden = played.filter((call) => call.target.parentElement === drawn)
    expect(hidden.length).toBeGreaterThan(0)
    expect(hidden.every((call) => call.keyframes[0]!["opacity"] === 0 && call.keyframes.at(-1)!["opacity"] === 1)).toBe(true)
    expect(played.some((call) => call.target === drawn)).toBe(false)
    expect(layer().dataset["last"]).toContain("travel 1")
  })

  it("a card played from the hand travels to its new place by its id; the cards that stay do not travel", async () => {
    const view = render(table(1))
    view.rerender(table(2))
    await nextFrame()
    // Step 2: Gebirge (33) from the hand to the battlefield, onto the pile of the other Gebirge.
    const pile = document.querySelector<HTMLElement>('[data-area="field"] [data-pile-cards~="33"]')!
    expect(pile).not.toBeNull()
    expect(travels()).toHaveLength(1)
    // It joins a pile that was there: the pile stays visible, nothing of it is hidden.
    expect(played.some((call) => call.target.parentElement === pile && call.keyframes[0]!["opacity"] === 0)).toBe(false)
    // Every animation of the table touches only transform and opacity.
    for (const call of played) for (const frame of call.keyframes) for (const property of Object.keys(frame)) if (!["offset", "easing", "composite"].includes(property)) expect(MOTION_PROPERTIES).toContain(property)
  })

  it("a click while a card travels hits the card at its new place (it looks at it)", async () => {
    const view = render(table(0))
    view.rerender(table(1))
    await nextFrame()
    expect(travels()).toHaveLength(1)
    expect(layer().hasAttribute("data-moving")).toBe(true)
    const card = document.querySelector<HTMLElement>('[data-area="hand"] [data-card="27"]')!
    // The control is never made unclickable; the ghosts take no pointer and are hidden from screen readers and tests.
    expect(card.closest(".table-motion-moving")).toBeNull()
    expect(layer().getAttribute("aria-hidden")).toBe("true")
    expect(layer().querySelector("[data-card], [data-stack-card], [data-slot], [aria-label]")).toBeNull()
    fireEvent.click(card)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })
})

describe("never in the way", () => {
  it("under the player's setting for less motion nothing moves, nothing is copied", async () => {
    document.documentElement.setAttribute(REDUCED_MOTION_ATTRIBUTE, "")
    const view = render(table(0))
    view.rerender(table(1))
    await nextFrame()
    view.rerender(table(2))
    await nextFrame()
    expect(played).toEqual([])
    expect(ghosts()).toEqual([])
    expect(layer().hasAttribute("data-moving")).toBe(false)
  })

  it("under the device's wish for less motion nothing moves", async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({ ...original(query), matches: query.includes("prefers-reduced-motion") })) as typeof window.matchMedia
    try {
      const view = render(table(0))
      view.rerender(table(1))
      await nextFrame()
      expect(played).toEqual([])
      expect(ghosts()).toEqual([])
    } finally {
      window.matchMedia = original
    }
  })

  it("switching less motion on while something moves stops it at once", async () => {
    const view = render(table(0))
    view.rerender(table(1))
    await nextFrame()
    const running = [...played]
    expect(running.length).toBeGreaterThan(0)
    await act(async () => {
      document.documentElement.setAttribute(REDUCED_MOTION_ATTRIBUTE, "")
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(running.every((call) => call.animation.cancel.mock.calls.length === 1)).toBe(true)
    expect(ghosts()).toEqual([])
    expect(layer().hasAttribute("data-moving")).toBe(false)
  })

  it("a replay jumping over steps changes at once", async () => {
    const view = render(table(0, false))
    view.rerender(table(5, false))
    await nextFrame()
    expect(played).toEqual([])
  })

  it("a further state stops the motion at once: animations cancelled, ghosts gone, the arrows told", async () => {
    const view = render(table(0))
    view.rerender(table(1))
    await nextFrame()
    const first = [...played]
    expect(first.length).toBeGreaterThan(0)
    expect(ghosts()).toHaveLength(1)
    const ended = vi.fn()
    document.querySelector('[data-slot="game-board"]')!.addEventListener(MOTION_END_EVENT, ended)
    view.rerender(table(2))
    // Before anything of the new state is read: every animation of the last one cancelled, its ghost removed.
    expect(first.every((call) => call.animation.cancel.mock.calls.length === 1)).toBe(true)
    expect(ghosts()).toEqual([])
    expect(ended).toHaveBeenCalledTimes(1)
    await nextFrame()
    // The new state's motion runs from the places the last one had reached (its end).
    expect(travels()).toHaveLength(2)
  })

  it("a state that comes before the motion started skips it", async () => {
    const view = render(table(0))
    view.rerender(table(1))
    view.rerender(table(2))
    await nextFrame()
    // Only step 2's travel (Gebirge 33): the drawn card of step 1 was already at its place when step 2 was read.
    expect(travels()).toHaveLength(1)
    expect(layer().dataset["states"]).toBe("1")
  })

  it("when the motion ends the ghosts go and the arrows are told", async () => {
    const view = render(table(0))
    view.rerender(table(1))
    await nextFrame()
    const ended = vi.fn()
    document.querySelector('[data-slot="game-board"]')!.addEventListener(MOTION_END_EVENT, ended)
    await act(async () => {
      for (const call of played) call.end()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(layer().hasAttribute("data-moving")).toBe(false)
    expect(ghosts()).toEqual([])
    expect(ended).toHaveBeenCalledTimes(1)
  })
})

describe("effects follow Forge", () => {
  it("a spell put on the stack: its entry glides in, the damage's source flashes, the damaged card shakes", async () => {
    const view = render(table(21))
    view.rerender(table(22))
    await nextFrame()
    const last = layer().dataset["last"] ?? ""
    expect(last).toContain("entry-glide 1")
    expect(last).toContain("shake 1")
    expect(last).toMatch(/flash [12]/)
    // The shake is added to whatever else moves the card; the flash is the glow layer around the picture.
    const goblin = document.querySelector('[data-area="field"] [data-card="55"] [data-slot="game-card-face"]')!
    expect(played.some((call) => call.target === goblin && call.options.composite === "add")).toBe(true)
    expect(played.some((call) => call.target === goblin && call.options.pseudoElement === "::before")).toBe(true)
  })

  it("Forge resolves the spell: the entry dissolves, the cards glide to the graveyard", async () => {
    const view = render(table(23))
    view.rerender(table(24))
    await nextFrame()
    const last = layer().dataset["last"] ?? ""
    expect(last).toContain("dissolve 1")
    expect(last).toContain("to-pile 2")
  })

  it("a life total that changes: the medallion's number pulses and its ring of light flashes red", async () => {
    const view = render(table(8))
    view.rerender(table(9))
    await nextFrame()
    expect(layer().dataset["last"]).toContain("life-loss 1")
    const flash = document.querySelector<HTMLElement>('[data-area="opponent"] .table-medallion-flash')!
    expect(flash.dataset["tone"]).toBe("loss")
    expect(played.some((call) => call.target === flash)).toBe(true)
  })

  it("a card turns when Forge taps or untaps it", async () => {
    const turns = (from: string) => played.filter((call) => (call.target as HTMLElement).dataset["slot"] === "game-card-picture" && call.keyframes[0]!["transform"] === from && call.keyframes.at(-1)!["transform"] === "rotate(0deg)")
    // Step 8 → 9: the attacking Goblin-Brandstifter (55) is tapped - its picture turns a quarter to the right.
    const view = render(table(8))
    view.rerender(table(9))
    await nextFrame()
    const goblin = document.querySelector('[data-area="field"] [data-card="55"] [data-slot="game-card-picture"]')
    expect(turns("rotate(-90deg)").map((call) => call.target)).toContain(goblin)
    // Step 13 → 14: the player's untap step - it turns back.
    played = []
    view.rerender(table(13))
    await nextFrame()
    played = []
    view.rerender(table(14))
    await nextFrame()
    expect(turns("rotate(90deg)").map((call) => call.target)).toContain(document.querySelector('[data-area="field"] [data-card="55"] [data-slot="game-card-picture"]'))
  })
})
