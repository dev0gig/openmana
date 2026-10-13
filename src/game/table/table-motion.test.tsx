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
 * invisible to tests, screen readers and pointers. A hand card dragged onto
 * the battlefield (prompt 46) travels from where it was let go, glides back
 * when not played, and jumps under less motion.
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REDUCED_MOTION_ATTRIBUTE } from "@/app/motion"
import { SEQUENCE_STEPS, sequenceMoment, TABLE_SEQUENCE } from "@/test/table-sequence"
import { GameTable } from "../game-table"
import { NO_PICTURES } from "../table-cards"
import { DROP_WAIT_MS, MOTION_PROPERTIES } from "./motion-plan"
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
  it("the recorded run begins with Forge's draw and then the land played (the steps the tests below start from)", () => {
    expect(SEQUENCE_STEPS.draw).toBe(1)
    expect(SEQUENCE_STEPS.land).toBe(2)
  })

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
    const view = render(table(SEQUENCE_STEPS.onStack - 1))
    view.rerender(table(SEQUENCE_STEPS.onStack))
    await nextFrame()
    expect(layer().dataset["last"] ?? "").toContain("entry-glide 1")
    // Forge's DAMAGE: in the same step or - since prompt 48, when Forge sends the spell on the stack first - a later one.
    if (SEQUENCE_STEPS.damaged !== SEQUENCE_STEPS.onStack) {
      view.rerender(table(SEQUENCE_STEPS.damaged - 1))
      await nextFrame()
      view.rerender(table(SEQUENCE_STEPS.damaged))
      await nextFrame()
    }
    const last = layer().dataset["last"] ?? ""
    expect(last).toContain("shake 1")
    expect(last).toMatch(/flash [12]/)
    // The shake is added to whatever else moves the card; the flash is the glow layer around the picture.
    const goblin = document.querySelector('[data-area="field"] [data-card="55"] [data-slot="game-card-face"]')!
    expect(played.some((call) => call.target === goblin && call.options.composite === "add")).toBe(true)
    expect(played.some((call) => call.target === goblin && call.options.pseudoElement === "::before")).toBe(true)
  })

  it("Forge resolves the spell: the entry dissolves, the cards glide to the graveyard", async () => {
    const view = render(table(SEQUENCE_STEPS.dies - 1))
    view.rerender(table(SEQUENCE_STEPS.dies))
    await nextFrame()
    const last = layer().dataset["last"] ?? ""
    expect(last).toContain("dissolve 1")
    expect(last).toContain("to-pile 2")
  })

  it("a life total that changes: the medallion's number pulses and its ring of light flashes red", async () => {
    const view = render(table(SEQUENCE_STEPS.lifeLoss - 1))
    view.rerender(table(SEQUENCE_STEPS.lifeLoss))
    await nextFrame()
    expect(layer().dataset["last"]).toContain("life-loss 1")
    const flash = document.querySelector<HTMLElement>('[data-area="opponent"] .table-medallion-flash')!
    expect(flash.dataset["tone"]).toBe("loss")
    expect(played.some((call) => call.target === flash)).toBe(true)
  })

  it("a card turns when Forge taps or untaps it", async () => {
    const turns = (from: string) => played.filter((call) => (call.target as HTMLElement).dataset["slot"] === "game-card-picture" && call.keyframes[0]!["transform"] === from && call.keyframes.at(-1)!["transform"] === "rotate(0deg)")
    // The attacking Goblin-Brandstifter (55) is tapped - its picture turns a quarter to the right.
    const view = render(table(SEQUENCE_STEPS.tapped - 1))
    view.rerender(table(SEQUENCE_STEPS.tapped))
    await nextFrame()
    const goblin = document.querySelector('[data-area="field"] [data-card="55"] [data-slot="game-card-picture"]')
    expect(turns("rotate(-90deg)").map((call) => call.target)).toContain(goblin)
    // The player's next untap step - it turns back.
    played = []
    view.rerender(table(SEQUENCE_STEPS.untapped - 1))
    await nextFrame()
    played = []
    view.rerender(table(SEQUENCE_STEPS.untapped))
    await nextFrame()
    expect(turns("rotate(90deg)").map((call) => call.target)).toContain(document.querySelector('[data-area="field"] [data-card="55"] [data-slot="game-card-picture"]'))
  })
})

describe("a hand card dragged onto the battlefield (prompt 46)", () => {
  /** The live table of a sequence step: the page sends taps (recorded), Forge waits. */
  function live(step: number, onTapCard: (id: number) => void) {
    const moment = sequenceMoment(step)
    return (
      <GameTable
        state={moment.state}
        history={moment.history}
        questions={moment.questions}
        prompt={moment.prompt}
        waiting
        aiProfile={TABLE_SEQUENCE.game.aiProfile}
        pictures={NO_PICTURES}
        menu={<button type="button">Menü</button>}
        onTapCard={onTapCard}
      />
    )
  }
  /** The hand's resting places as fakeRect draws its cards: card i from 20 + 70·i px. */
  function restingPlaces() {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetLeft")!
    Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute("data-hand-card") && this.parentElement !== null ? 20 + [...this.parentElement.children].indexOf(this) * 70 : 0
      },
    })
    // The hand's size (useElementSize): a full card's size for the dragged picture (hand-fan.ts).
    const sizes = (["clientWidth", "clientHeight"] as const).map((name) => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)!] as const)
    for (const [name, descriptor] of sizes) {
      Object.defineProperty(HTMLElement.prototype, name, {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains("table-hand") ? (name === "clientWidth" ? 600 : 120) : (descriptor.get?.call(this) as number)
        },
      })
    }
    return () => {
      Object.defineProperty(HTMLElement.prototype, "offsetLeft", original)
      for (const [name] of sizes) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
    }
  }
  const touch = { pointerType: "touch", pointerId: 1 } as const
  const button = (id: number) => document.querySelector<HTMLElement>(`[data-area="hand"] [data-card="${id}"]`)!
  const dragGhost = () => layer().querySelector<HTMLElement>(".table-hand-drag")
  /** The middle of your battlefield's stand-in box. */
  const field = () => {
    const box = document.querySelector<HTMLElement>('[data-slot="game-board-area"][data-area="field"]')!.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  }
  /** Card `id` (place `index` in the hand) dragged up and let go at `to`. */
  function drop(id: number, index: number, to: { x: number; y: number }) {
    const row = document.querySelector<HTMLElement>(".table-hand")!.getBoundingClientRect()
    const x = row.left + 20 + index * 70 + 10
    fireEvent.pointerDown(button(id), { ...touch, clientX: x, clientY: 760 })
    fireEvent.pointerMove(button(id), { ...touch, clientX: x, clientY: 720 })
    fireEvent.pointerMove(button(id), { ...touch, clientX: to.x, clientY: to.y })
    fireEvent.pointerUp(button(id), { ...touch, clientX: to.x, clientY: to.y })
    fireEvent.click(button(id))
  }

  it("dropped and played: the picture waits where it was let go, and the card's travel of the next state starts there - one picture, not two", async () => {
    const restore = restingPlaces()
    try {
      const onTapCard = vi.fn()
      const view = render(live(1, onTapCard))
      const to = field()
      // Step 1: Gebirge (33), second in the hand, playable.
      drop(33, 1, to)
      expect(onTapCard).toHaveBeenCalledExactlyOnceWith(33)
      const waiting = dragGhost()
      expect(waiting).not.toBeNull()
      // Forge's next state: the land on the battlefield. Its travel begins at the drop (its box is drawn there).
      view.rerender(live(2, onTapCard))
      await nextFrame()
      expect(travels()).toHaveLength(1)
      const [travel] = travels()
      expect(travel!.keyframes[0]!["transform"]).toBe("translate(0px, 0px) rotate(0deg) scale(1)")
      const ghost = travel!.target as HTMLElement
      expect(Number.parseFloat(ghost.style.left) + Number.parseFloat(ghost.style.width) / 2).toBeCloseTo(to.x, 0)
      // Held at 70 % of its height: the card stands above the finger, its middle a fifth of its height above it.
      const height = Number.parseFloat(ghost.style.height)
      expect(height).toBeGreaterThan(0)
      expect(Number.parseFloat(ghost.style.top) + height / 2).toBeCloseTo(to.y - 0.2 * height, 0)
      // The waiting picture handed over: gone.
      expect(waiting!.isConnected).toBe(false)
      expect(dragGhost()).toBeNull()
    } finally {
      restore()
    }
  })

  it("no next state in time: the waiting picture fades where it was let go, the card shows in the hand again", async () => {
    const restore = restingPlaces()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    try {
      const onTapCard = vi.fn()
      render(live(1, onTapCard))
      drop(33, 1, field())
      expect(document.querySelector('[data-hand-card="33"]')).toHaveAttribute("data-dragging")
      act(() => vi.advanceTimersByTime(DROP_WAIT_MS))
      const fade = played.find((call) => call.target === dragGhost())
      expect(fade?.keyframes.at(-1)?.["opacity"]).toBe(0)
      await act(async () => {
        fade!.end()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(dragGhost()).toBeNull()
      expect(document.querySelector('[data-hand-card="33"]')).not.toHaveAttribute("data-dragging")
    } finally {
      vi.useRealTimers()
      restore()
    }
  })

  it("let go outside the battlefield: it glides back to its place in the hand (transform and opacity only), nothing is sent", async () => {
    const restore = restingPlaces()
    try {
      const onTapCard = vi.fn()
      render(live(1, onTapCard))
      drop(33, 1, { x: 500, y: 640 })
      expect(onTapCard).not.toHaveBeenCalled()
      const back = played.find((call) => call.target === dragGhost())
      expect(back).toBeDefined()
      for (const frame of back!.keyframes) for (const property of Object.keys(frame)) if (property !== "offset") expect(MOTION_PROPERTIES).toContain(property)
      await act(async () => {
        back!.end()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(dragGhost()).toBeNull()
      expect(document.querySelector('[data-hand-card="33"]')).not.toHaveAttribute("data-dragging")
    } finally {
      restore()
    }
  })

  it("under less motion it jumps: dropped or not, the picture is gone at once and nothing is animated", () => {
    document.documentElement.setAttribute(REDUCED_MOTION_ATTRIBUTE, "")
    const restore = restingPlaces()
    try {
      const onTapCard = vi.fn()
      render(live(1, onTapCard))
      drop(33, 1, { x: 500, y: 640 })
      expect(dragGhost()).toBeNull()
      drop(36, 2, field())
      expect(onTapCard).toHaveBeenCalledExactlyOnceWith(36)
      expect(dragGhost()).toBeNull()
      expect(played).toEqual([])
    } finally {
      restore()
    }
  })
})
