/*
 * The readiness player (prompt 32, docs/READINESS.md): plays a complete game
 * against Forge's AI through the real game table, as a player would - only
 * where the table offers something, never past it:
 *
 *  - lands and spells through the card view's main button (Forge's own action
 *    words) - or, in some of its turns, by dragging the card onto the
 *    battlefield (prompt 46: the card view only read first, then the card
 *    dragged; dragCard) -, abilities of the player's permanents Forge marks (once a turn),
 *    answers with an instant Forge offers while the AI's spell is on the stack;
 *  - targets and choices Forge marks (the AI's seat and cards first), cards to
 *    discard, cards for the bottom of the London mulligan;
 *  - payments: Forge's Auto, now and then a land Forge marks tapped by hand,
 *    floating mana, life for Phyrexian mana;
 *  - attackers and blockers Forge marks (also Alpha Strike, another defender,
 *    another block target), Forge's buttons;
 *  - every other kind of question through its own controls (choices, options,
 *    a list Forge shows, numbers, order, arrangement, distribution).
 *
 * The opponent's turn (prompts 48/49): while the engine holds an action of the
 * AI to be looked at, the header says "Gegnerzug" and no question is open - the
 * player waits for the stage, or, with "Nach jeder Gegneraktion warten"
 * (`stepwise`), presses the stage's own "Weiter" (`[data-stage-next]` inside
 * `[data-slot="opponent-stage"]`, never a button of the decision region - the
 * priority's pass is also called "Weiter"). It never presses the stage while a
 * question is open, and never answers a question to get past the stage. The
 * start questions (prompt 50) are answered in the full-screen start hand that
 * opens by itself (its own buttons: Forge's words, the London mulligan's
 * "Nach unten"), or - `startHandView: false` - after closing it, in the
 * decision region.
 *
 * The policy is deterministic per seed - not an AI of its own, it plays to
 * exercise the paths, not to win. Every send waits until the button is armed
 * (ARMING_MS). After every action the table must change (Forge took it); six
 * times the same table, no way on, or no question for ten minutes fail the
 * game. Used by scripts/readiness/matches.ts and scripts/deploy/live-check.ts.
 */
import type { Locator, Page } from "playwright-core"

/** Forge's send buttons and the card view's button ignore presses for 500 ms after they appear (ARMING_MS). */
export const ARMED_AFTER_MS = 650

/**
 * Where to press a card of the table (relative to its box, for Playwright's `position`): the middle of the part of it
 * no other card covers. The player's hand is a fan (prompt 42; side by side since 2026-10-12) whose touch gestures go to the card
 * whose resting place lies under the finger - a lifted neighbour may cover its centre. Cards that nothing covers (the
 * battlefields) get their centre. Undefined where no part of the card is its own on screen (Playwright then reports it).
 */
export async function cardPoint(card: Locator): Promise<{ readonly x: number; readonly y: number } | undefined> {
  const point = await card.evaluate((element) => {
    const box = element.getBoundingClientRect()
    // Lower on the card: the lifted card stands above the others' tops.
    const row = element.closest('[data-slot="game-card-row"]')?.getBoundingClientRect()
    const y = Math.min(box.top + box.height * 0.6, (row?.bottom ?? Infinity) - 4)
    const own = (x: number) => {
      const hit = document.elementFromPoint(x, y)
      return hit !== null && element.contains(hit)
    }
    let first: number | null = null
    let last: number | null = null
    for (let x = Math.ceil(box.left) + 1; x < box.right - 1; x += 2) {
      if (own(x)) {
        first ??= x
        last = x
      } else if (first !== null) break
    }
    return first === null || last === null ? null : { x: (first + last) / 2 - box.left, y: y - box.top }
  })
  return point ?? undefined
}

/**
 * Where a thumb presses a card of the fanned hand that another card covers whole (a lifted neighbour - lifted by the
 * keyboard's focus after a card view closed with Escape): on its resting place, its own strip from its left edge to the
 * next card's (layout boxes, as the hand chooses for touch - prompt 42), near the hand's lower edge. Relative to the
 * card's box; undefined outside the hand. The touch goes to the hand's row, which picks the card by that place, so the
 * press is forced past Playwright's check of what lies on top.
 */
export async function restingPoint(card: Locator): Promise<{ readonly x: number; readonly y: number } | undefined> {
  const point = await card.evaluate((element) => {
    const item = element.closest<HTMLElement>("[data-hand-card]")
    const row = item?.parentElement
    if (item === null || item === undefined || row === null || row === undefined) return null
    const items = [...row.querySelectorAll<HTMLElement>(":scope > [data-hand-card]")]
    const next = items[items.indexOf(item) + 1]
    const rowBox = row.getBoundingClientRect()
    const origin = rowBox.left + row.clientLeft - row.scrollLeft
    const strip = next === undefined ? item.offsetWidth : next.offsetLeft - item.offsetLeft
    const box = element.getBoundingClientRect()
    return { x: origin + item.offsetLeft + Math.max(1, strip) / 2 - box.left, y: rowBox.bottom - 8 - box.top }
  })
  return point ?? undefined
}

/**
 * Drags a card of the player's hand onto the battlefield (prompt 46), as a thumb or the mouse does: pressed where it is
 * its own (cardPoint; covered whole: its resting place), up out of the hand, across to `to` (client coordinates) and let
 * go there - or, with `cancel`, taken back: released over the hand again ("hand"), Escape before releasing ("escape",
 * the mouse and keyboard's way), a second finger ("finger", touch). A touch goes through Chrome's own touch input.
 */
export async function dragCard(page: Page, card: Locator, to: { readonly x: number; readonly y: number }, touch: boolean, cancel?: "hand" | "escape" | "finger"): Promise<void> {
  const box = await card.boundingBox()
  if (box === null) throw new Error("the card has no box")
  const own = (await cardPoint(card)) ?? (await restingPoint(card))
  const start = own === undefined ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : { x: box.x + own.x, y: box.y + own.y }
  const path: { x: number; y: number }[] = []
  for (let step = 1; step <= 4; step++) path.push({ x: start.x, y: start.y - step * 12 })
  const lifted = path.at(-1)!
  for (let step = 1; step <= 10; step++) path.push({ x: lifted.x + ((to.x - lifted.x) * step) / 10, y: lifted.y + ((to.y - lifted.y) * step) / 10 })
  if (cancel === "hand") for (let step = 1; step <= 10; step++) path.push({ x: to.x + ((start.x - to.x) * step) / 10, y: to.y + ((start.y - to.y) * step) / 10 })
  const end = path.at(-1)!
  if (touch) {
    const cdp = await page.context().newCDPSession(page)
    try {
      const send = (type: "touchStart" | "touchMove" | "touchEnd", points: readonly { readonly x: number; readonly y: number }[]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((point, id) => ({ x: point.x, y: point.y, id })) })
      await send("touchStart", [start])
      await page.waitForTimeout(40)
      for (const point of path) {
        await send("touchMove", [point])
        await page.waitForTimeout(16)
      }
      if (cancel === "finger") {
        // A second finger laid on the hand while the first drags: the drag goes back.
        await send("touchStart", [end, start])
        await page.waitForTimeout(40)
      }
      await send("touchEnd", [])
    } finally {
      await cdp.detach()
    }
  } else {
    await page.mouse.move(start.x, start.y)
    await page.waitForTimeout(40)
    await page.mouse.down()
    for (const point of path) {
      await page.mouse.move(point.x, point.y)
      await page.waitForTimeout(16)
    }
    if (cancel === "escape") await page.keyboard.press("Escape")
    await page.mouse.up()
  }
}

/** Where to let a dragged card go: the middle of the player's battlefield. */
export async function battlefieldPoint(page: Page): Promise<{ readonly x: number; readonly y: number }> {
  const field = await page.locator('section[aria-label="Dein Spielfeld"]').boundingBox()
  if (field === null) throw new Error("the battlefield has no box")
  return { x: field.x + field.width / 2, y: field.y + field.height / 2 }
}

export interface PlayOptions {
  /** Names the game in failures and screenshots. */
  readonly id: string
  /** The policy's random source (choices repeat with it). */
  readonly seed: number
  /** Taps instead of clicks (a touch screen). */
  readonly touch: boolean
  /** Take one mulligan (London: then cards to the bottom). */
  readonly mulligan: boolean
  readonly maxMinutes: number
  /** Records a failed expectation in the caller's report; returns the condition. */
  readonly check: (condition: unknown, message: string) => boolean
  /** Saves a screenshot under this name. */
  readonly shot: (name: string) => Promise<void>
  /** Forge's notices seen during the game (toasts), appended here. */
  readonly notices: { at: number; text: string }[]
  /** Measures what the page with its running engine takes in memory (bytes), once from turn 5; optional. */
  readonly measureMemory?: () => Promise<number | null>
  /** Called once per turn the table shows (at the player's first priority in it), before the player acts; optional (prompt 45: the table's listeners and animations per turn). */
  readonly sampleTurn?: (turn: number) => Promise<void>
  /**
   * The game runs with "Nach jeder Gegneraktion warten" (prompt 49, set by the caller in the settings): the player
   * presses the stage's own "Weiter" for every step the engine holds. Without it the stage goes on by the tempo and the
   * player only looks.
   */
  readonly stepwise?: boolean
  /** Answers the start questions in the full-screen start hand (prompt 50, the default) or, false, closes it and answers in the decision region. */
  readonly startHandView?: boolean
  /** Called once when the start hand first stands open at a start question, before the player answers there (looking only); optional. */
  readonly atStartHand?: () => Promise<void>
}

/** What the player saw of the AI's turn and the start hand (prompts 49/50). */
export interface ObservedFlow {
  /** Steps of the AI's actions the stage showed (each step once, by its key). */
  readonly steps: number
  /** The steps by kind (land, cast, attack, turn …). */
  readonly kinds: Record<string, number>
  /** Steps with at least one card shown. */
  readonly withCards: number
  /** "Weiter" pressed on the stage (stepwise). */
  readonly stagePresses: number
  /** Questions that came with "Unterbrechung" (an action of the AI to answer). */
  readonly interruptions: number
  /** Changes of turn shown by the turn band (without holding). */
  readonly bands: number
  /** The start hand opened by itself at a start question. */
  readonly startHandOpened: number
  /** Start answers given in the start hand itself (Forge's buttons, "Nach unten"). */
  readonly startHandAnswers: number
  /** The land chip's words seen on the player's strip ("Länder 0/1", "Kein Land im KI-Zug" …). */
  readonly landChips: readonly string[]
}

export interface PlayResult extends GameStats {
  /** Forge's result as the table shows it ("Gewonnen", "Verloren", "Unentschieden"), null if none was reached. */
  readonly result: string | null
  /** The highest turn the table showed while Forge asked. */
  readonly turns: number
  readonly ms: number
  readonly bootMs: number | null
  readonly pictures: { readonly loaded: number; readonly broken: number } | null
  readonly languages: Record<string, unknown> | null
  /** The highest value `measureMemory` reported with the engine running (sampled every five turns from turn 5), bytes; null without it. */
  readonly memoryInGame: number | null
  /** What the player saw of the AI's turn and the start hand (prompts 49-51). */
  readonly observed: ObservedFlow
}

/**
 * Watches the stage, the turn band and the start hand in the page (a MutationObserver of the running game page - the
 * app is one page, it stays): every step once by its key, every band once by its text, every opening of the start hand.
 */
function watchFlow(): void {
  type Flow = { keys: string[]; kinds: Record<string, number>; withCards: number; bands: number; lastBand: string | null; startHand: number; startOpen: boolean; landChips: string[] }
  const w = window as unknown as { __playerFlow?: Flow }
  if (w.__playerFlow !== undefined) return
  const flow: Flow = { keys: [], kinds: {}, withCards: 0, bands: 0, lastBand: null, startHand: 0, startOpen: false, landChips: [] }
  w.__playerFlow = flow
  const look = () => {
    const stage = document.querySelector<HTMLElement>('[data-slot="opponent-stage"]')
    const key = stage?.dataset["step"]
    if (stage !== null && key !== undefined && !flow.keys.includes(key)) {
      flow.keys.push(key)
      const kind = stage.dataset["kind"] ?? "?"
      flow.kinds[kind] = (flow.kinds[kind] ?? 0) + 1
      if (Number(stage.dataset["cards"] ?? 0) > 0) flow.withCards++
    }
    const band = document.querySelector('[data-slot="turn-band"]')
    const text = band === null ? null : (band.textContent ?? "").trim()
    if (text !== flow.lastBand) {
      flow.lastBand = text
      if (text !== null && text !== "") flow.bands++
    }
    const open = document.querySelector('[data-slot="hand-spread"] [data-start-question]') !== null
    if (open && !flow.startOpen) flow.startHand++
    flow.startOpen = open
    const chip = (document.querySelector('section[aria-label="Du"] [data-strip-fact="lands"]')?.textContent ?? "").trim()
    if (chip !== "" && !flow.landChips.includes(chip) && flow.landChips.length < 40) flow.landChips.push(chip)
  }
  // The last pointer events and clicks on the hand and the table (diagnostics for a card view that did not open).
  const events: string[] = []
  ;(window as unknown as { __playerEvents: string[] }).__playerEvents = events
  for (const type of ["pointerdown", "pointerup", "pointercancel", "click", "contextmenu", "lostpointercapture"]) {
    document.addEventListener(type, (event) => {
      const target = event.target instanceof Element ? event.target : null
      const pointer = event as PointerEvent
      events.push(`${Math.round(performance.now())} ${type}${"pointerType" in pointer ? `:${pointer.pointerType}#${pointer.pointerId}` : ""} card=${target?.closest("[data-card]")?.getAttribute("data-card") ?? "-"} hand=${target?.closest('section[aria-label="Deine Hand"]') !== null} prevented=${event.defaultPrevented}`)
      if (events.length > 40) events.shift()
    }, true)
  }
  new MutationObserver(look).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-step", "data-slot", "data-start-question"] })
  look()
}

function readFlow(page: Page): Promise<{ keys: string[]; kinds: Record<string, number>; withCards: number; bands: number; startHand: number; landChips: string[] }> {
  return page.evaluate(() => {
    const flow = (window as unknown as { __playerFlow?: { keys: string[]; kinds: Record<string, number>; withCards: number; bands: number; startHand: number; landChips: string[] } }).__playerFlow
    return flow === undefined ? { keys: [], kinds: {}, withCards: 0, bands: 0, startHand: 0, landChips: [] } : { keys: flow.keys, kinds: flow.kinds, withCards: flow.withCards, bands: flow.bands, startHand: flow.startHand, landChips: flow.landChips }
  })
}

/** A small deterministic random source per game (mulberry32): the policy's choices repeat with the seed. */
export function randomSource(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface CardInfo {
  readonly id: number
  readonly label: string
  readonly mark: string | null
}

export interface TableView {
  readonly question: string | null
  readonly line: string
  readonly kind: string
  readonly text: string
  readonly answers: readonly { readonly name: string; readonly enabled: boolean; readonly meaning: string | null }[]
  readonly buttons: readonly { readonly name: string; readonly enabled: boolean }[]
  readonly phase: string | null
  readonly owner: string
  readonly turn: number
  readonly hand: readonly CardInfo[]
  readonly mine: readonly CardInfo[]
  readonly theirs: readonly CardInfo[]
  readonly players: readonly { readonly id: number; readonly label: string; readonly mark: string | null; readonly choice: boolean }[]
  readonly offTable: readonly CardInfo[]
  readonly radios: number
  readonly checkboxes: number
  readonly dialog: boolean
}

export function readTable(page: Page): Promise<TableView> {
  return page.evaluate(() => {
    const decision = document.querySelector('section[aria-label="Entscheidung"]')
    const content = decision?.querySelector('[data-slot="game-decision"]') ?? null
    const header = decision?.querySelectorAll('[data-slot="game-decision-header"] p') ?? []
    const line = (header[0]?.textContent ?? "").trim()
    const cards = (selector: string) =>
      [...document.querySelectorAll<HTMLElement>(selector)].map((element) => ({ id: Number(element.dataset["card"]), label: element.getAttribute("aria-label") ?? "", mark: element.dataset["mark"] ?? null }))
    const headerText = document.querySelector('section[aria-label="Spielstand"]')?.textContent ?? ""
    const group = decision?.querySelector('[role="group"][aria-label="Antworten, die Forge anbietet"]')
    return {
      question: content?.getAttribute("data-question") ?? null,
      line,
      kind: (line.split(" · ")[0] ?? "").trim(),
      text: (header[1]?.textContent ?? "").trim(),
      answers: [...(group?.querySelectorAll("button") ?? [])].map((button) => ({ name: (button.textContent ?? "").trim(), enabled: !(button as HTMLButtonElement).disabled, meaning: button.getAttribute("data-meaning") })),
      buttons: [...(decision?.querySelectorAll('[data-slot="game-decision-actions"] button') ?? [])].map((button) => ({ name: (button.getAttribute("aria-label") ?? button.textContent ?? "").trim(), enabled: !(button as HTMLButtonElement).disabled })),
      phase: document.querySelector('[data-slot="phase-track"]')?.getAttribute("data-phase") ?? null,
      owner: headerText.includes("Dein Zug") ? "me" : headerText.includes("Forge-KI am Zug") ? "ai" : "none",
      turn: Number(/Zug (\d+)/.exec(headerText)?.[1] ?? 0),
      hand: cards('section[aria-label="Deine Hand"] button[data-slot="game-card"][data-card]'),
      mine: cards('section[aria-label="Dein Spielfeld"] button[data-slot="game-card"][data-card]'),
      theirs: cards('section[aria-label="Spielfeld der Forge-KI"] button[data-slot="game-card"][data-card]'),
      players: [
        ...[...document.querySelectorAll<HTMLElement>('button[data-slot="game-player"][data-player]')].map((element) => ({ id: Number(element.dataset["player"]), label: element.getAttribute("aria-label") ?? "", mark: element.dataset["mark"] ?? null, choice: false })),
        ...[...(decision?.querySelectorAll<HTMLElement>("[data-player-choice]") ?? [])].map((element) => ({ id: Number(element.dataset["playerChoice"]), label: element.getAttribute("aria-label") ?? "", mark: element.dataset["mark"] ?? null, choice: true })),
      ],
      offTable: [...(decision?.querySelectorAll<HTMLElement>('[role="toolbar"][aria-label="Wählbare Karten, die nicht auf dem Tisch liegen"] button[data-item]') ?? [])].map((element) => ({ id: Number(element.dataset["item"]), label: element.getAttribute("aria-label") ?? "", mark: element.dataset["mark"] ?? null })),
      radios: decision?.querySelectorAll('[role="radio"]').length ?? 0,
      checkboxes: decision?.querySelectorAll('[role="checkbox"]').length ?? 0,
      dialog: document.querySelector('[role="dialog"],[role="alertdialog"]') !== null,
    }
  })
}

/** What changes when Forge takes an input: the decision, the marks, the zones, a notice. */
function fingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const decision = document.querySelector('section[aria-label="Entscheidung"]')
    const marks = [...document.querySelectorAll<HTMLElement>("[data-mark]")].map((element) => `${element.dataset["card"] ?? element.dataset["player"] ?? element.dataset["playerChoice"] ?? ""}:${element.dataset["mark"]}`).join(",")
    const tapped = [...document.querySelectorAll<HTMLElement>('[data-slot="game-card"][data-tapped="true"]')].length
    const regions = ["Deine Hand", "Dein Spielfeld", "Spielfeld der Forge-KI", "Stapel und Kampf", "Du", "Forge-KI", "Spielstand"].map((name) => document.querySelector(`section[aria-label="${name}"]`)?.textContent?.length ?? 0).join("/")
    return `${decision?.querySelector('[data-slot="game-decision"]')?.getAttribute("data-question")}|${decision?.textContent}|${marks}|${tapped}|${regions}|${document.querySelectorAll("[data-sonner-toast]").length}`
  })
}

export interface GameStats {
  kinds: Record<string, number>
  actions: Record<string, number>
  unanswered: string[]
  noEffect: number
}

export const RESULT = /^(Gewonnen|Verloren|Unentschieden)$/

export async function playGame(page: Page, game: PlayOptions): Promise<PlayResult> {
  const { check } = game
  const random = randomSource(game.seed)
  const touch = game.touch
  const decision = page.getByRole("region", { name: "Entscheidung" })
  const result = page.getByRole("heading", { level: 2, name: RESULT })
  const stats: GameStats = { kinds: {}, actions: {}, unanswered: [], noEffect: 0 }
  const count = (name: string) => {
    stats.actions[name] = (stats.actions[name] ?? 0) + 1
  }
  const activate = async (locator: Locator) => {
    if (touch) await locator.tap()
    else await locator.click()
  }
  // A card is pressed where it is its own (cardPoint): in the fanned hand the next card covers part of it.
  const activateCard = async (locator: Locator) => {
    const position = await cardPoint(locator)
    // A hand card covered whole by a lifted neighbour: a thumb presses its resting place (the hand picks by it).
    const resting = position === undefined && touch ? await restingPoint(locator) : undefined
    const options = position !== undefined ? { position } : resting !== undefined ? { position: resting, force: true } : {}
    if (touch) await locator.tap(options)
    else await locator.click(options)
  }
  const cardButton = (id: number) => page.locator(`button[data-slot="game-card"][data-card="${id}"]`).first()
  // The table counts a second tap on the same card within ARMING_MS once (its double-tap guard, never weakened for a
  // test): a player who taps the same card again - its view right after choosing it in a selection - waits that long,
  // as a person would. Without it the second tap was rightly dropped and the view never opened (prompt 38's runs).
  let lastCardTap: { readonly id: number; readonly at: number } | null = null
  const tapCard = async (id: number) => {
    const since = lastCardTap !== null && lastCardTap.id === id ? Date.now() - lastCardTap.at : Infinity
    if (since < ARMED_AFTER_MS) await page.waitForTimeout(ARMED_AFTER_MS - since)
    await activateCard(cardButton(id))
    lastCardTap = { id, at: Date.now() }
  }

  /** Presses a send button of the decision once armed. */
  const press = async (locator: Locator, name: string) => {
    await page.waitForTimeout(ARMED_AFTER_MS)
    await activate(locator)
    count(name)
  }
  const answerButton = (predicate: (button: TableView["answers"][number]) => boolean, view: TableView): Locator | null => {
    const index = view.answers.findIndex((button) => button.enabled && predicate(button))
    return index < 0 ? null : decision.getByRole("group", { name: "Antworten, die Forge anbietet" }).getByRole("button").nth(index)
  }
  const decisionButton = (name: string | RegExp) => decision.locator('[data-slot="game-decision-actions"]').getByRole("button", { name, exact: typeof name === "string" })
  /** The full-screen start hand (prompt 50) while it shows one of Forge's start questions. */
  const startView = page.locator('[data-slot="hand-spread"]').filter({ has: page.locator("[data-start-question]") })
  const useStartView = game.startHandView !== false
  const startAnswer = (name: string) => startView.locator("[data-start-answer]").filter({ hasText: new RegExp(`^${name}$`) }).first()
  let startHandAnswers = 0
  let startHandLooked = false
  let stagePresses = 0
  let interruptions = 0
  const interruptionsSeen = new Set<string>()

  /**
   * Waits for the card view a tap opened (10 s); if none opens, the failure says what lay where the card was pressed,
   * the card's mark and name, the open dialogs and the decision (prompt 52: a single such stop needed its cause).
   */
  const viewOpened = async (id: number) => {
    const opened = await page.getByRole("dialog").waitFor({ timeout: 10_000 }).then(() => true, () => false)
    if (opened) return
    const card = cardButton(id)
    const point = await cardPoint(card).catch(() => undefined)
    const facts = await card.evaluate((element, at) => {
      const box = element.getBoundingClientRect()
      const x = at === undefined ? box.left + box.width / 2 : box.left + at.x
      const y = at === undefined ? box.top + box.height / 2 : box.top + at.y
      const hit = document.elementFromPoint(x, y)
      return {
        label: element.getAttribute("aria-label"),
        mark: element.getAttribute("data-mark"),
        box: [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)],
        point: [Math.round(x), Math.round(y)],
        hit: hit === null ? null : `${hit.tagName.toLowerCase()} slot=${hit.closest("[data-slot]")?.getAttribute("data-slot")} card=${hit.closest("[data-card]")?.getAttribute("data-card")}`,
        dialogs: document.querySelectorAll('[role="dialog"],[role="alertdialog"]').length,
        decision: (document.querySelector('section[aria-label="Entscheidung"] [data-slot="game-decision-header"]')?.textContent ?? "").trim().slice(0, 120),
        badges: [...(document.querySelector('section[aria-label="Spielstand"]')?.querySelectorAll('[data-slot="badge"]') ?? [])].map((badge) => (badge.textContent ?? "").trim()),
        lifted: [...document.querySelectorAll("[data-hand-card][data-lifted]")].map((item) => item.getAttribute("data-hand-card")),
        events: ((window as unknown as { __playerEvents?: string[] }).__playerEvents ?? []).slice(-14),
        now: Math.round(performance.now()),
      }
    }, point).catch((error: Error) => ({ error: error.message }))
    throw new Error(`${game.id}: the card view of card ${id} did not open within 10 s after a ${touch ? "tap" : "click"} ${JSON.stringify(facts)}`)
  }

  /**
   * Plays a card by dragging it onto the battlefield (prompt 46) if Forge's words for it pass `want`: its view is only
   * read (looking is safe) and closed again, then the card is dragged. Returns the words, or null (nothing sent).
   */
  const byDragging = async (id: number, want: (words: string) => boolean): Promise<string | null> => {
    await tapCard(id)
    const view = page.getByRole("dialog")
    await viewOpened(id)
    // Forge's offer: the one button under the card or its keyword boxes (prompt 47); none without an offer.
    const main = view.locator('[data-slot="card-view-offer"] button').first()
    const offered = (await main.count()) > 0
    const words = offered ? ((await main.textContent()) ?? "").trim() : ""
    const usable = offered && (await main.isEnabled())
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 10_000 }).catch(() => undefined)
    if (!usable || !want(words)) return null
    await dragCard(page, cardButton(id), await battlefieldPoint(page), touch)
    dragTurns.add(lastTurn)
    count("drag")
    return words
  }
  /** The player's turns in which it played by dragging (prompt 46). */
  const dragTurns = new Set<number>()
  let lastTurn = 0
  /** Plays by dragging in the first turns it plays something, then in every fourth turn (prompt 46: at least one). */
  const dragNow = (turn: number) => dragTurns.size < 2 || dragTurns.has(turn) || turn % 4 === 0

  /**
   * Opens a card's view (looking is safe) and presses its main button if its words pass `want`; closes the view
   * otherwise. Returns the words pressed, or null.
   */
  const throughView = async (id: number, want: (words: string) => boolean, hand = false): Promise<string | null> => {
    // A card of the hand Forge marks playable (gold): in a dragging turn it is dragged onto the battlefield instead.
    if (hand && dragNow(lastTurn) && (await cardButton(id).getAttribute("data-mark")) === "usable") return byDragging(id, want)
    await tapCard(id)
    const view = page.getByRole("dialog")
    await viewOpened(id)
    const buttons = view.locator('[data-slot="card-view-offer"] button')
    let chosen: Locator | null = null
    let words: string | null = null
    for (let index = 0; index < (await buttons.count()); index++) {
      const text = ((await buttons.nth(index).textContent()) ?? "").trim()
      if ((await buttons.nth(index).isEnabled()) && want(text)) {
        chosen = buttons.nth(index)
        words = text
        break
      }
    }
    if (chosen === null) {
      await page.keyboard.press("Escape")
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 10_000 }).catch(() => undefined)
      return null
    }
    await page.waitForTimeout(ARMED_AFTER_MS)
    await activate(chosen)
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 10_000 }).catch(() => undefined)
    return words
  }

  // Bookkeeping of the policy (never of the game: Forge's state is read anew every step).
  const landTurns = new Set<number>()
  const tried = new Set<string>()
  let mulliganTaken = !game.mulligan
  let attackAllUsed = false
  let defenderSwitched = false
  const attackDecided = new Map<number, boolean>()
  let attackTurn = -1
  let blocksThisCombat = 0
  let blockTurn = -1
  const blockTargetsVisited = new Set<number>()
  let paymentTurns = 0
  const selectTaps = new Map<string, number>()
  let lastFingerprint = ""
  let sameCount = 0
  const started = Date.now()
  let bootMs: number | null = null
  let ended: string | null = null
  let pictures: { loaded: number; broken: number } | null = null
  let maxTurn = 0
  let lastShotTurn = 0
  let languages: Record<string, unknown> | null = null
  let memoryInGame: number | null = null
  let nextMemoryTurn = 5
  let sampledTurn = 0

  await page.evaluate(watchFlow)
  for (let step = 0; step < 4000; step++) {
    if (Date.now() - started > game.maxMinutes * 60_000) {
      check(false, `${game.id}: no result after ${game.maxMinutes} min (turn ${maxTurn})`)
      break
    }
    // Forge waits for the player: the header says so ("Du bist dran", engine.waiting) and a question is open. A question
    // shown while Forge still computes (its answer on the way) is not one to act on.
    // The engine holding an action of the AI to be looked at (prompts 48/49) is no question: the header says
    // "Gegnerzug", the stage shows the step - with `stepwise` it waits for the stage's own "Weiter".
    const state = await page
      .waitForFunction(
        (stepwise) => {
          const h2 = [...document.querySelectorAll("h2")].map((heading) => (heading.textContent ?? "").trim())
          if (h2.some((text) => /^(Gewonnen|Verloren|Unentschieden)$/.test(text))) return "ended"
          const badges = [...(document.querySelector('section[aria-label="Spielstand"]')?.querySelectorAll('[data-slot="badge"]') ?? [])].map((badge) => (badge.textContent ?? "").trim())
          const asked = h2.includes("Forge wartet auf deine Entscheidung")
          if (stepwise && !asked && badges.includes("Gegnerzug") && document.querySelector('[data-slot="opponent-stage"] [data-stage-next]') !== null) return "stage"
          return badges.includes("Du bist dran") && asked ? "asked" : false
        },
        game.stepwise === true,
        { timeout: 600_000, polling: 100 },
      )
      .then((handle) => handle.jsonValue() as Promise<string>, () => "silent")
    if (state === "ended") {
      ended = ((await result.first().textContent()) ?? "").trim()
      break
    }
    if (state === "stage") {
      // Stepwise: the stage's own "Weiter" once it is armed - only while the engine holds and no question is open. The
      // step moves on (or the stage goes, the observation released); nothing else is pressed here.
      const stage = page.locator('[data-slot="opponent-stage"]')
      const key = await stage.getAttribute("data-step").catch(() => null)
      await page.waitForTimeout(ARMED_AFTER_MS)
      const still = await page.evaluate((stepKey) => {
        const stage = document.querySelector<HTMLElement>('[data-slot="opponent-stage"]')
        const badges = [...(document.querySelector('section[aria-label="Spielstand"]')?.querySelectorAll('[data-slot="badge"]') ?? [])].map((badge) => (badge.textContent ?? "").trim())
        const asked = [...document.querySelectorAll("h2")].some((heading) => (heading.textContent ?? "").trim() === "Forge wartet auf deine Entscheidung")
        return stage !== null && stage.dataset["step"] === stepKey && stage.querySelector("[data-stage-next]") !== null && badges.includes("Gegnerzug") && !asked
      }, key)
      if (!still) continue
      if (stagePresses < 3) await game.shot(`${game.id}-stage-${stagePresses + 1}`)
      await activate(stage.locator("[data-stage-next]"))
      stagePresses++
      count("stage:next")
      await page.waitForFunction((stepKey) => document.querySelector<HTMLElement>('[data-slot="opponent-stage"]')?.dataset["step"] !== stepKey, key, { timeout: 15_000, polling: 50 }).catch(() => undefined)
      continue
    }
    if (state !== "asked") {
      check(false, `${game.id}: Forge neither asked nor ended the game within 10 min (turn ${maxTurn})`)
      await game.shot(`${game.id}-silent`)
      break
    }
    if (bootMs === null) {
      bootMs = Date.now() - started
      await game.shot(`${game.id}-first-decision`)
    }
    // A view left open (a card that left the table meanwhile …) is closed first: looking never answers. The start
    // hand that opened by itself at a start question stays open when the player answers there (prompt 50).
    const inStartView = useStartView && (await startView.count()) > 0 && (await page.locator('[role="dialog"],[role="alertdialog"]').count()) === 1
    if (!inStartView && (await page.locator('[role="dialog"],[role="alertdialog"]').count())) {
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    }
    if (inStartView && !startHandLooked) {
      startHandLooked = true
      await game.shot(`${game.id}-start-hand`)
      if (game.atStartHand !== undefined) {
        await game.atStartHand()
        continue
      }
    }
    const view = await readTable(page)
    // "Unterbrechung" (prompt 49): the AI's latest action is something to answer - the question came with it.
    const interruption = await page.evaluate(() => [...document.querySelectorAll('[data-slot="alert"]')].map((alert) => (alert.textContent ?? "").trim()).find((text) => text.startsWith("Unterbrechung")) ?? null)
    if (interruption !== null && !interruptionsSeen.has(`${view.question}:${interruption}`)) {
      interruptionsSeen.add(`${view.question}:${interruption}`)
      interruptions++
    }
    maxTurn = Math.max(maxTurn, view.turn)
    if (view.turn >= lastShotTurn + 5) {
      lastShotTurn = view.turn
      await game.shot(`${game.id}-turn-${view.turn}`)
    }
    if (pictures === null && view.turn >= 3) {
      pictures = await page.evaluate(() => {
        const images = [...document.querySelectorAll("img")].filter((img) => img.src.includes("scryfall.io"))
        return { loaded: images.filter((img) => img.complete && img.naturalWidth > 0).length, broken: images.filter((img) => img.complete && img.naturalWidth === 0).length }
      })
    }
    if (languages === null && view.turn >= 5 && view.kind === "Priorität") {
      languages = await cardLanguages(page).catch((error: Error) => ({ error: error.message }))
    }
    // Memory grows with the game: sampled every five turns, the highest value counts.
    if (game.measureMemory !== undefined && view.turn >= nextMemoryTurn && view.kind === "Priorität") {
      nextMemoryTurn = (Math.floor(view.turn / 5) + 1) * 5
      const bytes = await game.measureMemory().catch(() => null)
      if (bytes !== null && (memoryInGame === null || bytes > memoryInGame)) memoryInGame = bytes
    }
    if (game.sampleTurn !== undefined && view.turn > sampledTurn && view.kind === "Priorität") {
      sampledTurn = view.turn
      await game.sampleTurn(view.turn)
    }
    stats.kinds[view.kind] = (stats.kinds[view.kind] ?? 0) + 1
    const before = await fingerprint(page)
    if (before === lastFingerprint) sameCount++
    else sameCount = 0
    lastFingerprint = before
    if (sameCount >= 6) {
      check(false, `${game.id}: the table did not change after six actions in "${view.line}" (${view.text})`)
      await game.shot(`${game.id}-stuck`)
      break
    }

    const acted = await (async (): Promise<boolean> => {
      const usableIn = (cards: readonly CardInfo[]) => cards.filter((card) => card.mark === "usable")
      switch (view.kind) {
        case "Entscheidung": {
          const play = answerButton((button) => button.name === "Spielen", view)
          if (play !== null) {
            await press(play, "play-first")
            return true
          }
          const first = answerButton(() => true, view)
          if (first !== null) {
            await press(first, `buttons:${view.answers.find((button) => button.enabled)?.name}`)
            return true
          }
          return false
        }
        case "Mulligan": {
          if (inStartView) {
            // In the start hand itself: Forge's buttons with Forge's words, armed like the decision's.
            const name = !mulliganTaken ? "Mulligan" : "Behalten"
            const button = startAnswer(name)
            if ((await button.count()) && (await button.isEnabled())) {
              if (name === "Mulligan") mulliganTaken = true
              await press(button, name === "Mulligan" ? "mulligan" : "keep")
              startHandAnswers++
              return true
            }
            const keep = startAnswer("Behalten")
            if ((await keep.count()) && (await keep.isEnabled())) {
              await press(keep, "keep")
              startHandAnswers++
              return true
            }
            return false
          }
          if (!mulliganTaken) {
            const mulligan = answerButton((button) => button.name === "Mulligan", view)
            if (mulligan !== null) {
              mulliganTaken = true
              await press(mulligan, "mulligan")
              return true
            }
          }
          const keep = answerButton((button) => button.name === "Behalten", view)
          if (keep !== null) {
            await press(keep, "keep")
            return true
          }
          return false
        }
        case "Karten unter die Bibliothek legen": {
          if (inStartView) {
            // The London mulligan in the start hand: "Nach unten" under a card (Forge's card.tap), then Forge's OK there.
            const ok = startAnswer("OK")
            if ((await ok.count()) && (await ok.isEnabled())) {
              await press(ok, "mulligan-bottom-done")
              startHandAnswers++
              return true
            }
            // Not while Forge computes (the buttons keep their look then and are only aria-disabled).
            const toggle = startView.locator('[data-bottom-toggle][aria-pressed="false"]:not([disabled]):not([aria-disabled="true"])').first()
            if (await toggle.count()) {
              await press(toggle, "mulligan-bottom-card")
              startHandAnswers++
              return true
            }
            return false
          }
          // The player's own choice (a tap on a hand card), then Forge's OK - never Forge's Auto.
          const ok = answerButton((button) => button.name === "OK", view)
          if (ok !== null) {
            await press(ok, "mulligan-bottom-done")
            return true
          }
          const card = view.hand.find((candidate) => candidate.mark !== "selected")
          if (card !== undefined) {
            await tapCard(card.id)
            count("mulligan-bottom-card")
            return true
          }
          return false
        }
        case "Priorität":
          return priority(view)
        case "Kosten bezahlen":
          return payment(view)
        case "Angreifer wählen":
        case "Angriff bestätigen":
          return attack(view)
        case "Blocker wählen":
          return block(view)
        case "Auswahl":
          return view.radios > 0 || view.checkboxes > 0 || (await decision.getByRole("toolbar", { name: "Karten zur Wahl" }).count()) ? choose(view) : select(view)
        case "Ja oder Nein": {
          const yes = answerButton(() => true, view)
          if (yes === null) return false
          await press(yes, "confirm")
          return true
        }
        case "Eine Möglichkeit wählen":
          return options(view)
        case "Eingabe":
          return input()
        case "Reihenfolge festlegen":
          return confirmList("order", async () => {
            const add = decision.getByRole("button", { name: / hinzufügen$/ }).first()
            if ((await add.count()) && (await add.isEnabled())) await activate(add)
          })
        case "Karten anordnen":
          return confirmList("arrange", async () => {
            const fields = decision.getByRole("textbox", { name: /^Position von / })
            for (let index = 0; index < (await fields.count()); index++) await fields.nth(index).fill(String(index + 1))
          })
        case "Verteilen":
          return confirmList("distribute", async () => {
            const more = decision.getByRole("button", { name: / einen mehr$/ })
            for (let index = 0; index < (await more.count()); index++) {
              if (await more.nth(index).isEnabled()) {
                await activate(more.nth(index))
                return
              }
            }
          })
        default: {
          const first = view.buttons.find((button) => button.enabled && button.name !== "Zurücksetzen")
          stats.unanswered.push(view.line)
          if (first === undefined) return false
          await press(decisionButton(first.name).first(), `other:${view.kind}`)
          return true
        }
      }

      async function priority(current: TableView): Promise<boolean> {
        const pass = answerButton((button) => button.meaning === "pass", current)
        const myTurn = current.owner === "me"
        const main = current.phase === "MAIN1" || current.phase === "MAIN2"
        const stackEmpty = current.answers.some((button) => button.meaning === "pass" && button.name === "Weiter")
        const answering = current.text.includes("Du kannst darauf antworten")
        const playable = usableIn(current.hand)
        const key = (card: CardInfo) => `${current.turn}:${current.phase}:${current.text.slice(0, 40)}:${card.id}`
        lastTurn = current.turn
        if (myTurn && main && stackEmpty) {
          if (!landTurns.has(current.turn)) {
            for (const card of playable) {
              if (tried.has(`land:${key(card)}`)) continue
              tried.add(`land:${key(card)}`)
              const words = await throughView(card.id, (text) => text === "Spiele ein Land", true)
              if (words !== null) {
                landTurns.add(current.turn)
                count("land")
                return true
              }
            }
          }
          for (const card of playable) {
            if (tried.has(key(card))) continue
            tried.add(key(card))
            const words = await throughView(card.id, (text) => text !== "Spiele ein Land", true)
            if (words !== null) {
              count(`cast:${words}`)
              return true
            }
          }
          // Abilities of the player's permanents Forge marks (planeswalkers, activated abilities) - once a turn each.
          for (const card of usableIn(current.mine)) {
            const once = `ability:${current.turn}:${card.id}`
            if (tried.has(once) || random() < 0.3) continue
            tried.add(once)
            const words = await throughView(card.id, (text) => !/^(Spiele ein Land)$/.test(text))
            if (words !== null) {
              count(`ability:${words}`)
              return true
            }
          }
        } else if (answering && playable.length > 0 && random() < 0.7) {
          // An answer to the AI's spell or ability: an instant Forge offers now.
          for (const card of playable) {
            if (tried.has(key(card))) continue
            tried.add(key(card))
            const words = await throughView(card.id, (text) => text !== "Spiele ein Land", true)
            if (words !== null) {
              count(`respond:${words}`)
              return true
            }
          }
        }
        if (pass === null) return false
        await press(pass, stackEmpty ? "pass" : "resolve")
        return true
      }

      async function payment(current: TableView): Promise<boolean> {
        paymentTurns++
        // Now and then by hand: a land Forge marks on the player's battlefield, floating mana, life for Phyrexian mana.
        const sources = usableIn(current.mine)
        if (paymentTurns % 3 === 0 && sources.length > 0) {
          await tapCard(sources[0]!.id)
          count("pay:source")
          return true
        }
        const pool = decision.locator("[data-mana]")
        if ((await pool.count()) && (await pool.first().isEnabled())) {
          await activate(pool.first())
          count("pay:pool")
          return true
        }
        const life = current.players.find((player) => player.choice && player.mark === "usable")
        if (life !== undefined && random() < 0.5) {
          await activate(decision.locator(`[data-player-choice="${life.id}"]`))
          count("pay:life")
          return true
        }
        const auto = answerButton((button) => button.name !== "Abbrechen", current)
        if (auto !== null) {
          await press(auto, `pay:${current.answers.find((button) => button.enabled && button.name !== "Abbrechen")?.name}`)
          return true
        }
        if (sources.length > 0) {
          await tapCard(sources[0]!.id)
          count("pay:source")
          return true
        }
        const cancel = answerButton((button) => button.name === "Abbrechen", current)
        if (cancel === null) return false
        await press(cancel, "pay:cancel")
        return true
      }

      async function attack(current: TableView): Promise<boolean> {
        if (attackTurn !== current.turn) {
          attackTurn = current.turn
          attackDecided.clear()
        }
        if (!attackAllUsed && current.turn >= 6) {
          const all = answerButton((button) => button.meaning === "attackAll", current)
          if (all !== null) {
            attackAllUsed = true
            await press(all, "attack:all")
            return true
          }
        }
        const defender = decision.getByRole("group", { name: "Wen greifst du an?" }).locator("button[data-defender]")
        if (!defenderSwitched && (await defender.count()) && random() < 0.5) {
          defenderSwitched = true
          await activate(defender.first())
          count("attack:defender")
          return true
        }
        for (const card of current.mine) {
          if (card.mark !== "usable" || !card.label.includes("kann angreifen")) continue
          if (!attackDecided.has(card.id)) attackDecided.set(card.id, random() < 0.75)
          if (attackDecided.get(card.id) === true) {
            attackDecided.set(card.id, false)
            await tapCard(card.id)
            count("attack:creature")
            return true
          }
        }
        const declare = answerButton((button) => button.meaning === "declare", current) ?? answerButton(() => true, current)
        if (declare === null) return false
        await press(declare, `attack:${(current.answers.find((button) => button.enabled && button.meaning === "declare") ?? current.answers.find((button) => button.enabled))?.name.replace(/\d+/, "n")}`)
        return true
      }

      async function block(current: TableView): Promise<boolean> {
        if (blockTurn !== current.turn) {
          blockTurn = current.turn
          blocksThisCombat = 0
          blockTargetsVisited.clear()
        }
        const blocker = current.mine.find((card) => card.mark === "usable" && card.label.includes("kann diesen Angreifer blocken"))
        if (blocker !== undefined && blocksThisCombat < 2 && random() < 0.6) {
          blocksThisCombat++
          await tapCard(blocker.id)
          count("block:assign")
          return true
        }
        const other = current.theirs.find((card) => card.mark === "usable" && card.label.includes("Blocker zuweisen") && !blockTargetsVisited.has(card.id))
        if (other !== undefined && blocksThisCombat < 2) {
          blockTargetsVisited.add(other.id)
          await tapCard(other.id)
          count("block:target")
          return true
        }
        const confirm = answerButton(() => true, current)
        if (confirm === null) return false
        await press(confirm, `block:${current.answers.find((button) => button.enabled)?.name}`)
        return true
      }

      async function select(current: TableView): Promise<boolean> {
        const taps = selectTaps.get(current.question ?? "") ?? 0
        selectTaps.set(current.question ?? "", taps + 1)
        const ok = answerButton((button) => button.name !== "Abbrechen" && button.name !== "Cancel", current)
        if (taps < 6) {
          // Targets of the AI's first (its seat, then its cards), else the player's own, else what Forge offers elsewhere.
          const aiPlayer = current.players.find((player) => player.mark === "usable" && /Forge-KI/.test(player.label))
          const choices: (() => Promise<void>)[] = []
          if (aiPlayer !== undefined) choices.push(async () => activate(aiPlayer.choice ? decision.locator(`[data-player-choice="${aiPlayer.id}"]`) : page.locator(`button[data-slot="game-player"][data-player="${aiPlayer.id}"]`).first()))
          for (const card of usableIn(current.theirs)) choices.push(async () => tapCard(card.id))
          for (const card of usableIn(current.mine)) choices.push(async () => tapCard(card.id))
          for (const card of usableIn(current.hand)) choices.push(async () => tapCard(card.id))
          for (const card of usableIn(current.offTable)) choices.push(async () => activate(decision.locator(`button[data-item="${card.id}"]`).first()))
          const me = current.players.find((player) => player.mark === "usable" && !/Forge-KI/.test(player.label))
          if (me !== undefined) choices.push(async () => activate(me.choice ? decision.locator(`[data-player-choice="${me.id}"]`) : page.locator(`button[data-slot="game-player"][data-player="${me.id}"]`).first()))
          if (choices.length > 0 && (ok === null || taps === 0)) {
            await choices[0]!()
            count(aiPlayer !== undefined ? "select:ai-player" : "select:card")
            return true
          }
        }
        if (ok !== null) {
          await press(ok, `select:${current.answers.find((button) => button.enabled && button.name !== "Abbrechen")?.name}`)
          return true
        }
        const cancel = answerButton((button) => button.name === "Abbrechen", current)
        if (cancel === null) return false
        await press(cancel, "select:cancel")
        return true
      }

      async function choose(current: TableView): Promise<boolean> {
        const confirm = decisionButton(/^(Bestätigen|Nichts wählen)$/).first()
        if ((await confirm.count()) && (await confirm.isEnabled())) {
          const words = ((await confirm.textContent()) ?? "").trim()
          if (words === "Bestätigen" || current.radios + current.checkboxes === 0) {
            await press(confirm, `choose:${words}`)
            return true
          }
        }
        const radio = decision.getByRole("radio").first()
        if (current.radios > 0) {
          await activate(radio)
          count("choose:radio")
          return true
        }
        const box = decision.locator('[role="checkbox"]:not([disabled]):not([data-state="checked"])').first()
        if ((await box.count()) && (await box.isEnabled())) {
          await activate(box)
          count("choose:checkbox")
          return true
        }
        const card = decision.getByRole("toolbar", { name: "Karten zur Wahl" }).locator('button:not([data-mark="selected"])').first()
        if (await card.count()) {
          await activate(card)
          count("choose:card")
          return true
        }
        if ((await confirm.count()) && (await confirm.isEnabled())) {
          await press(confirm, "choose:nothing")
          return true
        }
        return false
      }

      async function options(current: TableView): Promise<boolean> {
        const confirm = decisionButton("Bestätigen").first()
        if ((await confirm.count()) && (await confirm.isEnabled())) {
          await press(confirm, "options:confirm")
          return true
        }
        if (current.radios > 0) {
          await activate(decision.getByRole("radio").first())
          count("options:radio")
          return true
        }
        const card = decision.getByRole("toolbar", { name: "Möglichkeiten" }).getByRole("button").first()
        if (await card.count()) {
          await activate(card)
          count("options:card")
          return true
        }
        // A list Forge only shows: its one button.
        const first = current.buttons.find((button) => button.enabled)
        if (first === undefined) return false
        await press(decisionButton(first.name).first(), "options:acknowledge")
        return true
      }

      async function input(): Promise<boolean> {
        const offered = decision.getByRole("group", { name: "Forges angebotene Werte" }).getByRole("button")
        if (await offered.count()) await activate(offered.last())
        const field = decision.getByRole("textbox").first()
        if ((await field.inputValue()) === "") await field.fill("1")
        const confirm = decisionButton("Bestätigen").first()
        if (await confirm.isEnabled()) {
          await press(confirm, "input")
          return true
        }
        const cancel = decisionButton("Abbrechen").first()
        if ((await cancel.count()) && (await cancel.isEnabled())) {
          await press(cancel, "input:cancel")
          return true
        }
        return false
      }

      async function confirmList(name: string, fix: () => Promise<void>): Promise<boolean> {
        const confirm = decisionButton("Bestätigen").first()
        for (let attempt = 0; attempt < 40 && !(await confirm.isEnabled()); attempt++) await fix()
        if (!(await confirm.isEnabled())) return false
        await press(confirm, name)
        return true
      }
    })()

    if (!acted) {
      check(false, `${game.id}: no way on in "${view.line}" (${view.text}; buttons ${JSON.stringify(view.answers)})`)
      await game.shot(`${game.id}-no-way`)
      break
    }
    // Forge takes the input: the table changes (a new question, marks, zones) or the game ends.
    const changed = await page
      .waitForFunction(
        async (previous) => {
          if (document.querySelector("h2") && /^(Gewonnen|Verloren|Unentschieden)$/.test(document.querySelector("h2")?.textContent ?? "")) return true
          const decision = document.querySelector('section[aria-label="Entscheidung"]')
          const marks = [...document.querySelectorAll<HTMLElement>("[data-mark]")].map((element) => `${element.dataset["card"] ?? element.dataset["player"] ?? element.dataset["playerChoice"] ?? ""}:${element.dataset["mark"]}`).join(",")
          const tapped = [...document.querySelectorAll<HTMLElement>('[data-slot="game-card"][data-tapped="true"]')].length
          const regions = ["Deine Hand", "Dein Spielfeld", "Spielfeld der Forge-KI", "Stapel und Kampf", "Du", "Forge-KI", "Spielstand"].map((name) => document.querySelector(`section[aria-label="${name}"]`)?.textContent?.length ?? 0).join("/")
          const now = `${decision?.querySelector('[data-slot="game-decision"]')?.getAttribute("data-question")}|${decision?.textContent}|${marks}|${tapped}|${regions}|${document.querySelectorAll("[data-sonner-toast]").length}`
          return now !== previous
        },
        before,
        { timeout: 30_000, polling: 100 },
      )
      .then(() => true, () => false)
    if (!changed) stats.noEffect++
    // Forge's notices (toasts): input.rejected and Forge's own messages - recorded with their words.
    for (const text of await page.locator("[data-sonner-toast]").allTextContents()) {
      if (!game.notices.some((notice) => notice.text === text && Date.now() - notice.at < 15_000)) game.notices.push({ at: Date.now(), text })
    }
  }
  await game.shot(`${game.id}-result`)
  // Prompt 46: a player who played cards played some of them by dragging them onto the battlefield.
  const played = Object.entries(stats.actions).filter(([name]) => name === "land" || name.startsWith("cast:") || name.startsWith("respond:")).reduce((sum, [, n]) => sum + n, 0)
  if (played > 0) check(dragTurns.size > 0 && (stats.actions["drag"] ?? 0) > 0, `${game.id}: played ${played} cards, none of them by dragging`)
  // Prompts 49-51: the AI's turn was shown on the stage, the start hand opened by itself, the land chip said Forge's count.
  const flow = await readFlow(page).catch(() => ({ keys: [], kinds: {}, withCards: 0, bands: 0, startHand: 0, landChips: [] }))
  const observed: ObservedFlow = { steps: flow.keys.length, kinds: flow.kinds, withCards: flow.withCards, stagePresses, interruptions, bands: flow.bands, startHandOpened: flow.startHand, startHandAnswers, landChips: flow.landChips }
  if (maxTurn >= 2) check(observed.steps > 0 && observed.withCards > 0, `${game.id}: the AI's turn was never shown on the stage (${JSON.stringify(observed.kinds)})`)
  check(observed.startHandOpened > 0, `${game.id}: the start hand did not open by itself at Forge's start question`)
  if (useStartView) check(startHandAnswers > 0, `${game.id}: no start question was answered in the start hand`)
  if (game.stepwise === true && maxTurn >= 2) check(stagePresses > 0, `${game.id}: stepwise, but "Weiter" on the stage was never pressed`)
  if ((stats.actions["land"] ?? 0) > 0) check(observed.landChips.some((chip) => /^Länder \d+\/\d+/.test(chip)), `${game.id}: the strip never said Forge's land count (${JSON.stringify(observed.landChips)})`)
  return { result: ended, turns: maxTurn, ms: Date.now() - started, bootMs, pictures, languages, memoryInGame, observed, ...stats }
}

// ── DE→EN: what the card view says about the catalog's languages ──────────

/**
 * Looks at cards of the hands and battlefields (a right click or long press: safe, sends nothing) and collects what
 * the card view says about languages - in its description (prompt 47: the view shows the card in full screen, its
 * facts are for screen readers): the name shown, the picture's language ("Kartenbild"), the catalog text's language
 * where Forge sends no rules text ("Katalogtext"), Forge's own rules text ("Regeltext").
 */
export async function cardLanguages(page: Page, limit = 16): Promise<Record<string, unknown>> {
  const cards = page.locator(
    'section[aria-label="Deine Hand"] button[data-slot="game-card"][data-card], section[aria-label="Dein Spielfeld"] button[data-slot="game-card"][data-card], section[aria-label="Spielfeld der Forge-KI"] button[data-slot="game-card"][data-card]',
  )
  const seen: { name: string; picture: string | null; catalogText: string | null; forgeText: string | null }[] = []
  const total = Math.min(await cards.count(), limit)
  for (let index = 0; index < total; index++) {
    const position = await cardPoint(cards.nth(index))
    await cards.nth(index).click({ button: "right", ...(position === undefined ? {} : { position }) })
    const view = page.getByRole("dialog")
    if (!(await view.waitFor({ timeout: 5000 }).then(() => true, () => false))) continue
    const description = await view.evaluate((node) => document.getElementById(node.getAttribute("aria-describedby") ?? "")?.textContent ?? "")
    const name = ((await view.getByRole("heading").first().textContent()) ?? "").trim()
    const forgeText = /Regeltext: (.*?)\.(?:[A-ZÄÖÜ][a-zäöü]+:|$)/s.exec(description)?.[1] ?? null
    seen.push({ name, picture: /Kartenbild: ([^.]+)\./.exec(description)?.[1] ?? null, catalogText: /Katalogtext: ([^.]+)\./.exec(description)?.[1] ?? null, forgeText: forgeText === null ? null : forgeText.trim().slice(0, 80) })
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 10_000 }).catch(() => undefined)
  }
  return { looked: seen.length, cards: seen }
}
