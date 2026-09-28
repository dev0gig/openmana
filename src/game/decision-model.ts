/*
 * Forge's decisions as data (prompt 15): which of the open questions the
 * table's decision region answers now, what each kind of question asks for
 * in the numbers Forge sends with it, whether the player's draft answer fits,
 * and the answer as the protocol wants it. Pure: no React, no engine.
 *
 * Nothing here is a Magic rule. Every bound comes from the question itself -
 * min/max, remainingMin/remainingMax, total and the minimum per item, the
 * sides a card may go to, whether a number is asked for - and the engine
 * checks the very same numbers again before Forge sees the answer (the
 * bridge's own answer check: a misfit is rejected loudly, never bent into
 * shape). What is legal in the game Forge decided when it built the
 * question. A draft that does not fit is never sent: the button that would
 * send it stays disabled and says why.
 *
 * Which question is answered where:
 *  - A blocking question (a Forge method with a return value: choose,
 *    confirm, options, input, order, arrange, distribute) is answered alone:
 *    while it is open, the engine takes no other answer and no tap.
 *  - Otherwise Forge's running step shows its two buttons (buttons) and may
 *    name cards to select (select); both are answered side by side.
 */
import type {
  AnswerBodyFor,
  ArrangeQuestion,
  Button,
  ButtonsQuestion,
  ChooseQuestion,
  DistributeQuestion,
  GameState,
  InputQuestion,
  Item,
  ManaColor,
  OptionsQuestion,
  OrderQuestion,
  Player,
  Question,
  SelectQuestion,
  VisibleCard,
  VisibleItem,
} from "@openmana/engine-protocol"
import { cardName, seatName } from "./table-labels"
import { isVisible } from "./table-model"

/** The questions Forge waits on alone (see above). */
export type BlockingQuestion = Exclude<Question, ButtonsQuestion | SelectQuestion>

export type Decision =
  | { readonly kind: "none" }
  /** A question Forge waits on alone: only it can be answered now. */
  | { readonly kind: "blocking"; readonly question: BlockingQuestion }
  /** Forge's running step: its two buttons and the cards it names to select (either may be missing). */
  | { readonly kind: "step"; readonly buttons: ButtonsQuestion | null; readonly select: SelectQuestion | null }

function isBlocking(question: Question): question is BlockingQuestion {
  return question.blocking
}

/** What the decision region answers now (questions in the order Forge asked them; the newest wins). */
export function currentDecision(questions: readonly Question[]): Decision {
  const blocking = questions.findLast(isBlocking)
  if (blocking !== undefined) return { kind: "blocking", question: blocking }
  const buttons = questions.findLast((question): question is ButtonsQuestion => question.kind === "buttons") ?? null
  const select = questions.findLast((question): question is SelectQuestion => question.kind === "select") ?? null
  return buttons === null && select === null ? { kind: "none" } : { kind: "step", buttons, select }
}

/** The question the decision is about (for keys and announcements): the blocking one, else the step's buttons, else its selection. */
export function decisionQuestion(decision: Decision): Question | null {
  switch (decision.kind) {
    case "none":
      return null
    case "blocking":
      return decision.question
    case "step":
      return decision.buttons ?? decision.select
  }
}

/** Whether a draft answer fits its question, and if not, why (German, for the player). */
export interface Check {
  readonly ok: boolean
  readonly reason: string | null
}

const OK: Check = { ok: true, reason: null }

function problem(reason: string): Check {
  return { ok: false, reason }
}

// ── Buttons ────────────────────────────────────────────────────────────────

/**
 * A button's words: Forge's label as it sends it (German, like all of Forge's
 * texts in a game). Without one, what the button does in the protocol:
 * button 1 is Forge's OK, button 2 its cancel.
 */
export function buttonText(button: Button): string {
  const label = button.label?.trim()
  if (label) return label
  return button.nr === 1 ? "OK" : "Abbrechen"
}

export function buttonsAnswer(button: 1 | 2): AnswerBodyFor<"buttons"> {
  return { kind: "buttons", button }
}

// ── Items ──────────────────────────────────────────────────────────────────

export function isVisibleItem(item: Item): item is VisibleItem {
  return !("hidden" in item)
}

/**
 * What an item of a question is called: a card by Forge's name for it (the
 * player's card language), a player as the table calls them ("Du",
 * "Forge-KI" - from the state's `me`, never from a name), anything else in
 * Forge's words. A card the player may not see is only that.
 */
export function itemLabel(item: Item, state: GameState | null): string {
  if (!isVisibleItem(item)) return "verdeckte Karte"
  if (item.cardView !== undefined) return cardName(item.cardView)
  if (item.player !== undefined) {
    const player = state?.players.find((candidate) => candidate.id === item.player)
    return player === undefined ? (item.text ?? `Spieler ${item.player}`) : seatName(player.me ? "me" : "opponent")
  }
  const text = item.text?.trim()
  return text ? text : `Eintrag ${item.nr}`
}

/** Every card a question shows (the asking card, its items, what it reveals): their pictures are looked up with the table's. */
export function questionCards(questions: readonly Question[]): VisibleCard[] {
  const cards: VisibleCard[] = []
  for (const question of questions) {
    if ("cardView" in question && question.cardView !== undefined) cards.push(question.cardView)
    const lists: readonly (readonly Item[])[] = [
      "items" in question && question.items !== undefined ? question.items : [],
      question.kind === "options" && question.revealed !== undefined ? question.revealed : [],
    ]
    for (const list of lists) for (const item of list) if (isVisibleItem(item) && item.cardView !== undefined) cards.push(item.cardView)
  }
  return cards
}

/** Whether every item shows a card (a card of the game or a hidden one): then the items are a row of cards. */
export function cardItems(items: readonly Item[]): boolean {
  return items.length > 0 && items.every((item) => !isVisibleItem(item) || item.cardView !== undefined)
}

// ── How many ───────────────────────────────────────────────────────────────

/** How many to pick, in words ("genau 1", "1 bis 3", "bis zu 2", "beliebig viele") - only Forge's numbers. */
export function countRule(min: number, max: number, count: number): string {
  if (min === max) return `genau ${min}`
  if (min <= 0) return max >= count && count > 1 ? "beliebig viele" : `bis zu ${max}`
  return `${min} bis ${max}`
}

/** A number of picks against Forge's bounds. */
export function checkCount(min: number, max: number, picked: number): Check {
  if (picked < min) return problem(min - picked === 1 ? "Wähle noch 1." : `Wähle noch ${min - picked}.`)
  if (picked > max) return problem(`Höchstens ${max} – nimm zuerst etwas zurück.`)
  return OK
}

// ── select (Forge's selectable cards) ──────────────────────────────────────

/** The ids of the cards the table itself shows as cards: battlefields, hands (the player's, the AI's revealed ones), command zones. */
export function tableCardIds(state: GameState): ReadonlySet<number> {
  const ids = new Set<number>()
  for (const player of state.players) {
    for (const card of [...player.zones.battlefield, ...player.zones.hand, ...player.zones.command]) if (isVisible(card)) ids.add(card.id)
  }
  return ids
}

export interface SelectView {
  /** Forge names no card to select (then only players can be chosen, if any - prompt 17). */
  readonly noCard: boolean
  /** How many to pick ("genau 1" …) - Forge's own numbers for cards and players together; null when Forge offers nothing to pick. */
  readonly rule: string | null
  /** Items the table does not show as cards (graveyard, exile, library, hidden): the decision region shows them. */
  readonly offTable: readonly Item[]
  /** How many of the named cards lie on the table (marked there, "wählbar"). */
  readonly onTable: number
  /** How many are chosen (Forge's highlight on cards and players), if that can be known for every item (null: not for all). */
  readonly chosen: number | null
  /** The players Forge's running input would take (selectable) or has chosen (highlighted), the opponent first (prompt 17). */
  readonly players: readonly Player[]
}

/** The players a selection is about (prompt 17): Forge takes them now or has chosen them; the opponent first. */
export function selectionPlayers(state: GameState): Player[] {
  return state.players.filter((player) => player.selectable === true || player.highlighted === true).sort((a, b) => Number(a.me) - Number(b.me))
}

/**
 * A selection as the decision region shows it. Only the items' own ids are
 * used (a hidden item is only its number); whether one is chosen is Forge's
 * highlight on the card in the state - for a card outside the state (the
 * library) it is not known, and then no count is claimed.
 */
export function selectView(question: SelectQuestion, state: GameState): SelectView {
  const onTableIds = tableCardIds(state)
  const cards = new Map<number, VisibleCard>()
  for (const player of state.players) {
    const { battlefield, hand, graveyard, exile, command } = player.zones
    for (const card of [...battlefield, ...hand, ...graveyard, ...exile, ...command]) if (isVisible(card)) cards.set(card.id, card)
  }
  const offTable: Item[] = []
  let onTable = 0
  let chosen: number | null = 0
  for (const item of question.items) {
    const id = isVisibleItem(item) ? item.card : undefined
    if (id !== undefined && onTableIds.has(id)) onTable++
    else offTable.push(item)
    const card = id === undefined ? undefined : cards.get(id)
    if (card === undefined) chosen = null
    else if (chosen !== null && card.highlighted === true) chosen++
  }
  const players = selectionPlayers(state)
  if (chosen !== null) chosen += players.filter((player) => player.highlighted === true).length
  const noCard = question.items.length === 0
  const count = question.items.length + players.length
  return { noCard, rule: count === 0 ? null : countRule(question.min, question.max, count), offTable, onTable, chosen, players }
}

// ── The payment (prompt 17) ────────────────────────────────────────────────

export interface PaymentView {
  /** The mana still to pay, in Forge's mana symbols ("{1}{R}"; "0" = nothing left). */
  readonly cost: string
  /** Floating mana Forge would pay with now (mana.use): colour and how much of it floats. */
  readonly pool: readonly { readonly color: ManaColor; readonly amount: number }[]
  /** Forge's payment takes the player's own life now (Phyrexian mana: their seat is selectable). */
  readonly life: Player | null
}

/** Forge's payment in progress as the decision region shows it, or null when none runs. */
export function paymentView(state: GameState): PaymentView | null {
  const payment = state.payment
  if (payment === undefined) return null
  const me = state.players.find((player) => player.me) ?? null
  const pool = [...payment.pool].map((color) => color as ManaColor).map((color) => ({ color, amount: me?.mana[color] ?? 0 }))
  return { cost: payment.cost, pool, life: me !== null && me.selectable === true ? me : null }
}

/** Selecting an item: Forge's click on it (it toggles; the question stays open until Forge is done). */
export function selectAnswer(nr: number): AnswerBodyFor<"select"> {
  return { kind: "select", choices: [nr] }
}

// ── choose ─────────────────────────────────────────────────────────────────

/** Forge's suggestion as the first draft (never sent by itself): valid numbers only, at most max. */
export function initialChoice(question: ChooseQuestion): readonly number[] {
  const valid = (question.suggested ?? []).filter((nr, index, all) => nr >= 1 && nr <= question.items.length && all.indexOf(nr) === index)
  return valid.slice(0, question.max)
}

/** Toggles an item of a draft; with max 1 a new pick replaces the old one. */
export function toggleChoice(chosen: readonly number[], nr: number, max: number): readonly number[] {
  if (chosen.includes(nr)) return chosen.filter((other) => other !== nr)
  if (max === 1) return [nr]
  return chosen.length >= max ? chosen : [...chosen, nr]
}

export function checkChoose(question: ChooseQuestion, chosen: readonly number[]): Check {
  return checkCount(question.min, question.max, chosen.length)
}

export function chooseAnswer(chosen: readonly number[]): AnswerBodyFor<"choose"> {
  return { kind: "choose", choices: [...chosen].sort((a, b) => a - b) }
}

// ── confirm ────────────────────────────────────────────────────────────────

/** The two answers with Forge's words for them (its own yes/no where it sends none). */
export function confirmLabels(question: Extract<Question, { kind: "confirm" }>): { readonly yes: string; readonly no: string } {
  return { yes: question.yesLabel?.trim() || "Ja", no: question.noLabel?.trim() || "Nein" }
}

export function confirmAnswer(yes: boolean): AnswerBodyFor<"confirm"> {
  return { kind: "confirm", yes }
}

// ── options ────────────────────────────────────────────────────────────────

/** Forge's suggested option as the first draft (null: none). */
export function initialOption(question: OptionsQuestion): number | null {
  const suggested = question.suggested
  return suggested !== undefined && suggested >= 1 && suggested <= question.items.length ? suggested : null
}

/** option 0 = cancel (only if the question is cancellable). */
export function optionsAnswer(option: number): AnswerBodyFor<"options"> {
  return { kind: "options", option }
}

// ── input ──────────────────────────────────────────────────────────────────

const JAVA_INT_MAX = 2_147_483_647

/** The first draft: Forge's suggestion, else empty. */
export function initialInput(question: InputQuestion): string {
  return question.suggested ?? ""
}

/** Whether a typed answer fits: a whole number where Forge asks for one (what Forge can read, Java's int). */
export function checkInput(question: InputQuestion, value: string): Check {
  if (!question.numeric) return OK
  const text = value.trim()
  if (text === "") return problem("Gib eine ganze Zahl ein.")
  if (!/^[+-]?\d+$/.test(text)) return problem("Nur eine ganze Zahl, ohne Komma oder Buchstaben.")
  const number = Number(text)
  if (number > JAVA_INT_MAX || number < -JAVA_INT_MAX - 1) return problem("Diese Zahl ist zu groß.")
  return OK
}

export function inputAnswer(question: InputQuestion, value: string): AnswerBodyFor<"input"> {
  return { kind: "input", value: question.numeric ? value.trim() : value }
}

// ── order ──────────────────────────────────────────────────────────────────

/**
 * What an order question asks (Forge's dual list): pick items into an
 * ordered list; the rest remains. `all`: every item must be ordered (both
 * bounds 0). Else between pickMin and pickMax items (a negative maximum of
 * what remains = any number).
 */
export interface OrderRule {
  readonly all: boolean
  readonly pickMin: number
  readonly pickMax: number
}

export function orderRule(question: OrderQuestion): OrderRule {
  const count = question.items.length
  if (question.remainingMax < 0) return { all: false, pickMin: 0, pickMax: count }
  if (question.remainingMin === 0 && question.remainingMax === 0) return { all: true, pickMin: count, pickMax: count }
  const pickMin = Math.max(0, count - question.remainingMax)
  const pickMax = Math.min(count, Math.max(0, count - question.remainingMin))
  return { all: false, pickMin, pickMax }
}

/** Forge's suggested list as the first draft; with "order all" and no suggestion Forge's own order of the items. */
export function initialOrder(question: OrderQuestion): readonly number[] {
  const count = question.items.length
  const suggested = (question.suggested ?? []).filter((nr, index, all) => nr >= 1 && nr <= count && all.indexOf(nr) === index)
  if (suggested.length > 0) return suggested
  return orderRule(question).all ? question.items.map((item) => item.nr) : []
}

export function checkOrder(question: OrderQuestion, order: readonly number[]): Check {
  const rule = orderRule(question)
  if (rule.all && order.length < question.items.length) return problem("Bringe alle in eine Reihenfolge.")
  return checkCount(rule.pickMin, rule.pickMax, order.length)
}

export function orderAnswer(order: readonly number[]): AnswerBodyFor<"order"> {
  return { kind: "order", order: [...order] }
}

/** Moves the entry at `index` by `delta` places (nothing if it would leave the list). */
export function moveEntry<T>(list: readonly T[], index: number, delta: number): readonly T[] {
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list
  const next = [...list]
  const [entry] = next.splice(index, 1)
  next.splice(target, 0, entry as T)
  return next
}

// ── arrange ────────────────────────────────────────────────────────────────

export type PileSide = "top" | "bottom"

/** Where the movable cards go: each list in order (top: the first is the very top; bottom: the last is the very bottom). */
export interface Arrangement {
  readonly top: readonly number[]
  readonly bottom: readonly number[]
}

/** The first draft changes nothing: every card where it is (on top, in Forge's order) - or, if only the bottom is allowed, there. */
export function initialArrangement(question: ArrangeQuestion): Arrangement {
  const all = question.items.map((item) => item.nr)
  return question.toTop || !question.toBottom ? { top: all, bottom: [] } : { top: [], bottom: all }
}

/** Puts a card on a side (at the end of that side's list: right above the rest, or at the very bottom). */
export function moveToSide(arrangement: Arrangement, nr: number, side: PileSide): Arrangement {
  const top = arrangement.top.filter((other) => other !== nr)
  const bottom = arrangement.bottom.filter((other) => other !== nr)
  return side === "top" ? { top: [...top, nr], bottom } : { top, bottom: [...bottom, nr] }
}

export function checkArrangement(question: ArrangeQuestion, arrangement: Arrangement): Check {
  const placed = [...arrangement.top, ...arrangement.bottom]
  if (new Set(placed).size !== placed.length || placed.length !== question.items.length) return problem("Jede Karte muss genau einmal liegen.")
  if (!question.toTop && arrangement.top.length > 0) return problem("Nach oben darf hier keine Karte.")
  if (!question.toBottom && arrangement.bottom.length > 0) return problem("Nach unten darf hier keine Karte.")
  return OK
}

export function arrangeAnswer(arrangement: Arrangement): AnswerBodyFor<"arrange"> {
  return { kind: "arrange", top: [...arrangement.top], bottom: [...arrangement.bottom] }
}

// ── distribute ─────────────────────────────────────────────────────────────

/** The first draft: every item at Forge's minimum; the player gives out the rest. */
export function initialAmounts(question: DistributeQuestion): readonly number[] {
  return question.items.map(() => question.min)
}

export interface Distribution extends Check {
  readonly sum: number
  /** What is still to give out (negative: too much). */
  readonly open: number
}

export function checkDistribution(question: DistributeQuestion, amounts: readonly number[]): Distribution {
  const sum = amounts.reduce((total, amount) => total + amount, 0)
  const open = question.total - sum
  const base = { sum, open }
  if (amounts.length !== question.items.length) return { ...base, ok: false, reason: "Jedes Ziel braucht einen Wert." }
  if (amounts.some((amount) => amount < question.min)) return { ...base, ok: false, reason: `Jedes Ziel bekommt mindestens ${question.min}.` }
  if (open > 0) return { ...base, ok: false, reason: open === 1 ? "Noch 1 zu verteilen." : `Noch ${open} zu verteilen.` }
  if (open < 0) return { ...base, ok: false, reason: `${-open} zu viel verteilt.` }
  return { ...base, ok: true, reason: null }
}

/** Changes one item's amount by `delta`, never below Forge's minimum and never beyond the total. */
export function changeAmount(question: DistributeQuestion, amounts: readonly number[], index: number, delta: number): readonly number[] {
  const current = amounts[index]
  if (current === undefined || delta === 0) return amounts
  const { open } = checkDistribution(question, amounts)
  const next = delta > 0 ? current + Math.min(delta, Math.max(open, 0)) : Math.max(question.min, current + delta)
  return next === current ? amounts : amounts.map((amount, i) => (i === index ? next : amount))
}

export function distributeAnswer(amounts: readonly number[]): AnswerBodyFor<"distribute"> {
  return { kind: "distribute", amounts: [...amounts] }
}
