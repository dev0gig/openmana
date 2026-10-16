/*
 * The match report (prompt 62, docs/implementation/62-partiebericht.md): a
 * recorded match (StoredMatch: header and log) as one Markdown text a foreign
 * AI can read without knowing OpenMana, Forge or this game, to judge how the
 * human played.
 *
 * A pure derivation of the recording - the recording (the portable replay
 * JSON) stays the evidence and is not touched: no DOM, no card catalog, no
 * network; the same recording gives the same text. Read with the replay's own
 * checks (checkReplay, readableProtocol, checkRecordedMessage).
 *
 * Every statement has its place in the recording ([L<seq>]): Forge's
 * questions, the player's inputs and Forge's answers to them, Forge's log
 * entries (`events`), its observations (`observation` with their results) and
 * states. Nothing is inferred from the difference of two states. Two marked
 * readings only:
 *  1. "Ungenutzte Möglichkeiten": at the player's last pass in an own main
 *     phase with an empty stack, read from that state - the hand cards Forge
 *     marked playable, the untapped lands, whether the land play was open.
 *  2. A life change without damage: Forge names no source; the report says so
 *     and may name the stack object resolving at that moment as a guess
 *     ("Vermutung").
 * Hidden stays hidden: a hidden card is "eine verdeckte Karte", never named or
 * numbered; only ids of cards the recording shows are written. The AI's deck
 * list (the header's) stands only in appendix B. Card names are Forge's English
 * keys; Forge's own texts are quoted as sent. OpenMana judges nothing.
 */
import type {
  ActionResults,
  Button,
  ButtonsQuestion,
  Card,
  EngineInput,
  EngineMessage,
  EntityRef,
  GameEnd,
  GameEvent,
  GameState,
  Item,
  Observation,
  ObservedAction,
  Player,
  Question,
  SettingsApplied,
  StackItem,
  VisibleCard,
} from "@openmana/engine-protocol"
import { ATTACK_REFUSAL_WORDS } from "@/game/attack-labels"
import { aiProfileLabel, formatDuration, questionLabel, REJECT_REASON_LABELS } from "@/game/game-labels"
import { SCHEMA_VERSION } from "@/storage/generated/constants"
import type { MatchDeck, MatchRecord } from "@/storage/generated/records"
import { StorageError } from "@/storage/errors"
import type { StoredMatch } from "@/storage/matches"
import { readableProtocol } from "./protocols"
import { checkRecordedMessage, checkReplay } from "./replay"
import {
  count,
  FOREWORD,
  HEADINGS,
  inline,
  MANA_WORDS,
  MEANING_ANSWERS,
  MEANING_WORDS,
  phaseWords,
  quote,
  REPORT_UNREADABLE,
  reportFileName,
  sideDative,
  sideGenitive,
  sideName,
  sideObject,
  sideSubject,
  STATE_ZONE_WORDS,
  utcMinute,
  zoneWords,
  type Side,
} from "./report-words"

/** Stands for a question's number in its words until they are written. */
const QUESTION_ID = "\u0000question\u0000"

type StateZone = keyof typeof STATE_ZONE_WORDS
const STATE_ZONES: readonly StateZone[] = ["hand", "battlefield", "graveyard", "exile", "command"]

/** One entry of the recording, its engine message checked like the replay checks it. */
type Entry =
  | { readonly seq: number; readonly at: number; readonly from: "engine"; readonly message: EngineMessage }
  | { readonly seq: number; readonly at: number; readonly from: "player"; readonly message: PlayerMessage }

type PlayerMessage = EngineInput | { readonly type: "recording.boot" } | { readonly type: "match.start" }

function isVisible(card: Card | null | undefined): card is VisibleCard {
  return card !== null && card !== undefined && !("hidden" in card)
}

/** The English name Forge knows a card by (its key), else Forge's display name. */
function cardWord(card: VisibleCard): string | null {
  return card.key ?? card.name ?? null
}

// ── Cards the recording shows ─────────────────────────────────────────────

interface Known {
  readonly names: string[]
  readonly typeLines: string[]
  owner: number | null
}

/**
 * Every card the recording shows (in a state, a question, an observation, a
 * message), by Forge's id. Hidden cards carry no id and never come here.
 */
class CardBook {
  readonly cards = new Map<number, Known>()
  /** Cards Forge treated as lands: played as a land (LandAction) or given a land reason (VisibleCard.landRefusal). */
  readonly lands = new Set<number>()

  see(card: Card | null | undefined): void {
    if (!isVisible(card)) return
    const known = this.cards.get(card.id) ?? { names: [], typeLines: [], owner: null }
    const name = cardWord(card)
    if (name !== null && !known.names.includes(name)) known.names.push(name)
    if (card.typeLine && !known.typeLines.includes(card.typeLine)) known.typeLines.push(card.typeLine)
    if (known.owner === null) known.owner = card.owner
    if (card.landRefusal !== undefined) this.lands.add(card.id)
    this.cards.set(card.id, known)
  }

  /** A card the recording names by id only: "Lightning Bolt (#53)". */
  label(id: number, details: readonly string[] = []): string {
    const name = this.cards.get(id)?.names[0]
    return name === undefined ? "eine nicht benannte Karte" : `${inline(name)} (${[`#${id}`, ...details].join(", ")})`
  }

  /** A card as Forge sent it: hidden stays "eine verdeckte Karte". */
  of(card: Card | null | undefined, details: readonly string[] = []): string {
    if (card === null || card === undefined) return "keine Karte (Forge nennt keine)"
    if (!isVisible(card)) return "eine verdeckte Karte"
    const name = cardWord(card) ?? this.cards.get(card.id)?.names[0] ?? null
    return `${name === null ? "eine Karte ohne Namen" : inline(name)} (${[`#${card.id}`, ...details].join(", ")})`
  }

  /** A land by Forge's word: played as a land, a land reason, or a type line naming the card type Land. */
  isLand(card: VisibleCard): boolean {
    if (this.lands.has(card.id)) return true
    const types = (card.typeLine ?? "").split(/[—–]| - /)[0] ?? ""
    return types.split(/\s+/).some((word) => /land$/i.test(word))
  }
}

function stateCards(state: GameState): Card[] {
  const cards: Card[] = []
  for (const player of state.players) {
    for (const zone of STATE_ZONES) cards.push(...player.zones[zone])
    for (const commander of player.commanders) cards.push(commander.card)
  }
  for (const item of state.stack) if (item.card !== null) cards.push(item.card)
  return cards
}

function itemCards(items: readonly Item[] | undefined): Card[] {
  const cards: Card[] = []
  for (const item of items ?? []) if (!("hidden" in item) && item.cardView !== undefined) cards.push(item.cardView)
  return cards
}

function questionCards(question: Question): Card[] {
  const cards: Card[] = []
  if ("cardView" in question && question.cardView !== undefined) cards.push(question.cardView)
  if ("items" in question) cards.push(...itemCards(question.items))
  if (question.kind === "options") cards.push(...itemCards(question.revealed))
  return cards
}

function resultCards(results: ActionResults): Card[] {
  return results.moves.map((move) => move.card)
}

function actionCards(action: ObservedAction): Card[] {
  switch (action.kind) {
    case "land":
      return [action.card]
    case "cast":
    case "activate":
    case "trigger":
      return action.card === null ? [] : [action.card]
    case "attack":
      return action.attacks.map((each) => each.attacker)
    case "block":
      return action.blocks.flatMap((each) => each.blockers)
    case "resolve":
      return [...(action.card === null ? [] : [action.card]), ...resultCards(action.results)]
    case "combatDamage":
      return resultCards(action.results)
    default:
      return []
  }
}

// ── Which of Forge's log entries an observation already tells ─────────────

/** What an observation reports, as keys a log entry of the same game event matches. */
function coverage(observation: Observation): Map<string, number> {
  const keys = new Map<string, number>()
  const add = (key: string, times = 1) => keys.set(key, (keys.get(key) ?? 0) + times)
  const results = (r: ActionResults) => {
    for (const move of r.moves) add(`ZONE_CHANGE:${move.card.id}`)
    for (const damage of r.damage) add(`DAMAGE:${damage.source ?? "?"}`)
    for (let i = 0; i < r.life.length; i++) add("LIFE")
  }
  for (const action of observation.actions) {
    switch (action.kind) {
      case "turn":
        add("TURN")
        break
      case "land":
        if (isVisible(action.card)) add(`LAND:${action.card.id}`)
        break
      case "cast":
      case "activate":
      case "trigger":
        if (isVisible(action.card)) add(`STACK_ADD:${action.card.id}`)
        break
      case "attack":
        add("COMBAT", new Set(action.attacks.map((each) => (each.defender === null ? "-" : `${each.defender.kind}${each.defender.id}`))).size)
        break
      case "block":
        add("COMBAT", action.blocks.length)
        break
      case "resolve":
        if (isVisible(action.card)) add(`STACK_RESOLVE:${action.card.id}`)
        results(action.results)
        break
      case "combatDamage":
        results(action.results)
        break
      default:
        break
    }
  }
  return keys
}

/** The key of a log entry an observation may cover (null: no observation tells such an entry). */
function eventKey(event: GameEvent): string | null {
  switch (event.kind) {
    case "TURN":
      return "TURN"
    case "LIFE":
      return "LIFE"
    case "COMBAT":
      return "COMBAT"
    case "DAMAGE":
      return `DAMAGE:${event.card ?? "?"}`
    case "LAND":
    case "STACK_ADD":
    case "STACK_RESOLVE":
    case "ZONE_CHANGE":
      return event.card === undefined ? null : `${event.kind}:${event.card}`
    default:
      return null
  }
}

// ── The report ────────────────────────────────────────────────────────────

interface TurnSection {
  readonly turn: number
  readonly side: Side
  readonly ordinal: number
  /** The state the situation is read from: the turn's first after its untap step (else its first). */
  begin: GameState
  begun: boolean
  readonly course: string[]
  unused: UnusedReading | null
  /** Fallback of reading 1 without a pass of the player's own: the last state of an own main phase with an empty stack. */
  main: GameState | null
  last: GameState
}

/** Reading 1: what the state said at the player's last pass in an own main phase with an empty stack. */
interface UnusedReading {
  readonly decision: string
  readonly seq: number
  readonly state: GameState
}

interface Decision {
  readonly label: string
  readonly seqs: number[]
  readonly answeredSeqs: number[]
  readonly head: string
  /** The question's words with QUESTION_ID where its number stands (passes in a row are different questions alike). */
  readonly question: string
  readonly questionIds: number[]
  readonly offer: string
  readonly answer: string
  readonly outcome: string
  readonly group: string | null
}

/**
 * The report of a recording, as Markdown. Throws StorageError for a recording
 * the replay could not read (an older engine protocol, a damaged recording).
 */
export function buildMatchReport(stored: StoredMatch): string {
  checkReplay({ format: "openmana-replay", version: 1, schemaVersion: SCHEMA_VERSION, match: stored.match, log: [...stored.log] })
  if (!readableProtocol(stored.match.engine.protocol)) throw new StorageError("invalid-record", REPORT_UNREADABLE)
  const entries: Entry[] = stored.log.map((entry) =>
    entry.from === "engine"
      ? { seq: entry.seq, at: entry.at, from: "engine", message: checkRecordedMessage(entry.message, stored.match.engine.protocol) }
      : { seq: entry.seq, at: entry.at, from: "player", message: entry.message as unknown as PlayerMessage },
  )
  return new Report(stored.match, entries).text()
}

/** The report as a file for the browser's download. */
export function exportMatchReport(stored: StoredMatch): { readonly blob: Blob; readonly name: string } {
  return { blob: new Blob([buildMatchReport(stored)], { type: "text/markdown;charset=utf-8" }), name: reportFileName(stored.match.id) }
}

class Report {
  readonly match: MatchRecord
  readonly entries: readonly Entry[]
  readonly book = new CardBook()
  /** The player's id (Forge's `me`). */
  me: number | null = null
  readonly inputs = new Map<number, number>()
  readonly answered = new Map<number, { readonly seq: number; readonly question: number }>()
  readonly rejected = new Map<number, { readonly seq: number; readonly reason: keyof typeof REJECT_REASON_LABELS; readonly detail: string }>()
  /** Per log entry index: the index of the next observation (for the log entries before it). */
  readonly nextObservation: number[] = []
  readonly pools = new Map<number, Map<string, number>>()

  // The walk.
  state: GameState | null = null
  readonly questions = new Map<number, Question>()
  lastPrompt: string | null = null
  /** Forge's prompt line now (empty: none) - the words of a running step's buttons and selection. */
  prompt = ""
  start: string[] = []
  readonly turns: TurnSection[] = []
  current: TurnSection | null = null
  decisions = 0
  lastDecision: string | null = null
  pending: Decision | null = null
  shownHand: string | null = null
  releases = 0
  stateRequests = 0
  end: GameEnd | null = null
  abort: Extract<EngineMessage, { type: "engine.abort" }> | null = null
  initialSettings: SettingsApplied | null = null

  constructor(match: MatchRecord, entries: readonly Entry[]) {
    this.match = match
    this.entries = entries
    this.survey()
    this.walk()
  }

  /** First pass: the cards, the player's id, which input was answered or refused, the observations ahead. */
  survey(): void {
    let next = -1
    for (let i = this.entries.length - 1; i >= 0; i--) {
      this.nextObservation[i] = next
      const entry = this.entries[i]!
      if (entry.from === "engine" && entry.message.type === "observation") {
        next = i
        this.pools.set(i, coverage(entry.message))
      }
    }
    for (const entry of this.entries) {
      if (entry.from === "player") {
        if ("seq" in entry.message) this.inputs.set(entry.message.seq, entry.seq)
        continue
      }
      const message = entry.message
      switch (message.type) {
        case "state":
          if (this.me === null) this.me = message.players.find((player) => player.me)?.id ?? null
          for (const card of stateCards(message)) this.book.see(card)
          break
        case "question":
          for (const card of questionCards(message)) this.book.see(card)
          break
        case "message":
          if (message.cardView !== undefined) this.book.see(message.cardView)
          break
        case "observation":
          for (const action of message.actions) {
            for (const card of actionCards(action)) this.book.see(card)
            if (action.kind === "land" && isVisible(action.card)) this.book.lands.add(action.card.id)
          }
          break
        case "question.answered":
          this.answered.set(message.seq, { seq: entry.seq, question: message.id })
          break
        case "input.rejected":
          this.rejected.set(message.seq, { seq: entry.seq, reason: message.reason, detail: message.detail })
          break
        default:
          break
      }
    }
  }

  side(player: number | null): Side {
    if (player === null || this.me === null) return null
    return player === this.me ? "player" : "ai"
  }

  players(state: GameState): { readonly player: Player | undefined; readonly ai: Player | undefined } {
    return { player: state.players.find((p) => p.me), ai: state.players.find((p) => !p.me) }
  }

  /** Where new lines go: the current turn's course, or the start section. */
  get course(): string[] {
    return this.current === null ? this.start : this.current.course
  }

  emit(seq: number | readonly number[], text: string, sub: readonly string[] = []): void {
    this.flush()
    this.course.push(`- [${refs(seq)}] ${text}`, ...sub.map((line) => `  - ${line}`))
  }

  after(): string {
    return this.lastDecision === null ? "vor der ersten Entscheidung des Spielers" : `nach ${this.lastDecision}`
  }

  // ── The walk ────────────────────────────────────────────────────────────

  walk(): void {
    this.entries.forEach((entry, index) => {
      if (entry.from === "player") this.player(entry.seq, entry.message)
      else this.engine(index, entry.seq, entry.message)
    })
    this.flush()
    if (this.current !== null && this.state !== null) this.current.last = this.state
  }

  /** A new turn begins with this state: close the current section, open the next. */
  turnOf(state: GameState): void {
    const at = this.current?.turn ?? 0
    if (state.turn <= at || state.turn < 1) return
    this.flush()
    if (this.current !== null && this.state !== null) this.current.last = this.state
    const side = this.side(state.activePlayer)
    const ordinal = this.turns.filter((turn) => turn.side === side).length + 1
    const section: TurnSection = { turn: state.turn, side, ordinal, begin: state, begun: state.phase !== "UNTAP", course: [], unused: null, main: null, last: state }
    this.turns.push(section)
    this.current = section
  }

  engine(index: number, seq: number, message: EngineMessage): void {
    switch (message.type) {
      case "state":
        this.turnOf(message)
        this.state = message
        if (this.current !== null) {
          const section = this.current
          section.last = message
          if (!section.begun && message.phase !== "UNTAP") {
            section.begin = message
            section.begun = true
          }
          if (this.side(message.activePlayer) === "player" && (message.phase === "MAIN1" || message.phase === "MAIN2") && message.stack.length === 0) section.main = message
        }
        break
      case "events": {
        // The log entries explain the state after them: a new turn's section opens at its TURN entry
        // (entries before it, such as the mulligans' results, still belong to what came before).
        const following = this.entries.slice(index + 1).find((each) => !(each.from === "engine" && each.message.type === "events"))
        const next = following?.from === "engine" && following.message.type === "state" ? following.message : null
        const turnAt = next === null ? -1 : message.entries.findIndex((event) => event.kind === "TURN")
        if (next !== null && turnAt < 0) this.turnOf(next)
        const pool = this.pools.get(this.nextObservation[index] ?? -1)
        message.entries.forEach((event, at) => {
          if (next !== null && at === turnAt) this.turnOf(next)
          const key = eventKey(event)
          const left = key === null ? 0 : (pool?.get(key) ?? 0)
          if (key !== null && pool !== undefined && left > 0) {
            pool.set(key, left - 1)
            return
          }
          this.emit(seq, this.eventWords(event))
        })
        break
      }
      case "question":
        this.questions.set(message.id, message)
        if (message.kind === "buttons" && (message.purpose === "mulligan" || message.purpose === "mulliganBottom")) this.showHand(seq)
        break
      case "question.withdrawn":
        this.questions.delete(message.id)
        break
      case "question.answered":
        if (!this.inputs.has(message.seq)) this.decide([seq], null, this.questions.get(message.id) ?? null, message.seq)
        this.questions.delete(message.id)
        break
      case "input.rejected":
        if (!this.inputs.has(message.seq))
          this.emit(seq, `Forge lehnte Eingabe ${message.seq} ab (die Eingabe selbst fehlt in der Aufzeichnung): ${REJECT_REASON_LABELS[message.reason]} Forge: ${quote(message.detail)}`)
        break
      case "observation":
        for (const action of message.actions) {
          const [text, ...sub] = this.actionWords(action)
          this.emit(seq, text ?? "", sub)
        }
        break
      case "message":
        if (message.kind === "prompt") {
          const text = message.text.trim()
          this.prompt = text
          if (text !== "" && text !== this.lastPrompt) {
            this.lastPrompt = text
            this.emit(seq, `Forges Hinweiszeile: ${quote(text)}`)
          }
        } else if (message.kind === "incorrect-action") this.emit(seq, `Forge wies eine Aktion des Spielers zurück${message.text.trim() === "" ? "" : `: ${quote(message.text)}`}.`)
        else this.emit(seq, `Forge-Meldung (${message.kind === "error" ? "Fehler" : "Hinweis"}): ${message.title ? `${quote(message.title)} – ` : ""}${quote(message.text)}`)
        break
      case "settings.applied":
        if (message.seq === null) this.initialSettings = message
        else this.emit(seq, `Forge bestätigt die Einstellungen: ${settingsWords(message.autoPass, message.observation)}.`)
        break
      case "game.end":
        this.end = message
        this.emit(seq, `Die Partie ist zu Ende: ${this.endWords(message)}`)
        break
      case "engine.abort":
        this.abort = message
        this.emit(seq, `Die Engine brach technisch ab (${inline(message.reason)}): ${quote(message.message)} – die Partie endet ohne Ergebnis.`)
        break
      default:
        break
    }
  }

  player(seq: number, message: PlayerMessage): void {
    switch (message.type) {
      case "recording.boot":
      case "match.start":
        return
      case "observation.release":
        this.releases++
        return
      case "state.request":
        this.stateRequests++
        return
      case "settings.change":
        this.emit(seq, `Der Spieler ändert die Einstellungen: ${settingsWords(message.autoPass ?? null, message.observation ?? null)}.`)
        return
      case "answer":
        this.decide([seq], message, this.questions.get(message.question) ?? null, message.seq)
        return
      default:
        this.decide([seq], message, this.context(), message.seq)
    }
  }

  /** The question a tap answers: the newest open one (a selection, a payment, the priority …). */
  context(): Question | null {
    let newest: Question | null = null
    for (const question of this.questions.values()) if (newest === null || question.id > newest.id) newest = question
    return newest
  }

  showHand(seq: number): void {
    const hand = this.state === null ? undefined : this.players(this.state).player?.zones.hand
    if (hand === undefined) return
    const words = this.cardList(hand)
    if (words === this.shownHand) return
    this.shownHand = words
    this.emit(seq, `Hand des Spielers (${hand.length}): ${words}`)
  }

  // ── Decisions ───────────────────────────────────────────────────────────

  decide(seqs: number[], input: Exclude<PlayerMessage, { type: "recording.boot" } | { type: "match.start" }> | null, question: Question | null, inputSeq: number): void {
    const state = this.state
    const answered = this.answered.get(inputSeq)
    const rejected = this.rejected.get(inputSeq)
    const head = state === null ? "vor dem ersten Zustand" : `Zug ${state.turn}${state.turn > 0 ? ` (${sideName(this.side(state.activePlayer))} am Zug)` : ""}, ${phaseWords(state.phase)}`
    const questionText = this.questionWords(question, input?.type === "answer" ? input.question : null)
    const questionIds = question === null ? [] : [question.id]
    const offer = this.offerWords(question)
    const answer = input === null ? `in der Aufzeichnung nicht enthalten (Eingabe ${inputSeq} fehlt; Forge bestätigte eine Antwort auf diese Frage)` : this.answerWords(input, question)
    const outcome = rejected !== undefined ? `Forge lehnte ab [L${rejected.seq}]: ${REJECT_REASON_LABELS[rejected.reason]} Forge: ${quote(rejected.detail)}` : answered !== undefined ? `Forge nahm die Antwort an [L${answered.seq}].` : ""
    const pass = input?.type === "answer" && input.kind === "buttons" && question?.kind === "buttons" && question.purpose === "priority" ? question.buttons.find((button) => button.nr === input.button)?.meaning : undefined
    const group = rejected === undefined && answered !== undefined && pass === "pass" ? `${head}\u0000${questionText}\u0000${offer}\u0000${answer}` : null
    if (group !== null && this.pending?.group === group) {
      this.pending.seqs.push(...seqs)
      this.pending.answeredSeqs.push(answered!.seq)
      this.pending.questionIds.push(...questionIds)
    } else {
      this.flush()
      this.decisions++
      this.pending = { label: `E${this.decisions}`, seqs: [...seqs], answeredSeqs: answered === undefined ? [] : [answered.seq], head, question: questionText, questionIds, offer, answer, outcome, group }
      this.lastDecision = this.pending.label
    }
    // Reading 1: the player's pass in an own main phase with an empty stack.
    if (
      state !== null &&
      this.current !== null &&
      (pass === "pass" || pass === "endTurn") &&
      rejected === undefined &&
      this.side(state.activePlayer) === "player" &&
      (state.phase === "MAIN1" || state.phase === "MAIN2") &&
      state.stack.length === 0
    )
      this.current.unused = { decision: this.pending?.label ?? "", seq: seqs[0] ?? 0, state }
  }

  /** Writes the decision waiting for passes like it (a group) to the course. */
  flush(): void {
    const decision = this.pending
    if (decision === null) return
    this.pending = null
    const times = decision.seqs.length
    const outcome =
      times > 1 ? `Forge nahm jede Antwort an [${refs(decision.answeredSeqs)}].` : decision.outcome
    this.course.push(
      `- [${refs(decision.seqs)}] **${decision.label}** · ${decision.head}`,
      `  - Frage: ${decision.question.replace(QUESTION_ID, `${decision.questionIds.length === 1 ? "Frage" : "Fragen"} ${decision.questionIds.join(", ")}`)}`,
      `  - Angebot: ${decision.offer}`,
      `  - Antwort: ${decision.answer}${times > 1 ? ` – ${times}-mal hintereinander, ohne Ereignis dazwischen` : ""}.${outcome === "" ? "" : ` ${outcome}`}`,
    )
  }

  questionWords(question: Question | null, asked: number | null): string {
    if (question === null) return asked === null ? "keine offene Frage Forges" : `Frage ${asked} – keine offene Frage Forges`
    const state = this.state
    const parts = [`${questionLabel(question)} (${QUESTION_ID})`]
    if (question.kind === "buttons" && question.purpose === "priority" && state !== null) parts.push(this.stackWords(state))
    if (question.kind === "buttons" && question.purpose === "block" && state !== null) {
      const target = this.allCards(state).find((card) => card.highlighted && card.attacking)
      if (target !== undefined) parts.push(`zu blocken ist gerade ${this.book.of(target)}`)
    }
    if ("card" in question && question.card !== undefined) parts.push(`es geht um ${this.book.label(question.card)}`)
    // A running step's buttons and selection say Forge's prompt line (their own text is the line of the moment the step began).
    const running = question.kind === "buttons" || question.kind === "select"
    const text = running && this.prompt !== "" ? this.prompt : question.text.trim()
    if (text !== "") parts.push(`${running && this.prompt !== "" ? "Forges Hinweiszeile" : "Forges Text"}: ${quote(text)}`)
    return parts.join(" · ")
  }

  stackWords(state: GameState): string {
    if (state.stack.length === 0) return "Stapel leer"
    const top = state.stack[0]!
    return `oben auf dem Stapel (${count(state.stack.length, "Objekt", "Objekte")}): ${this.stackItemWords(top)}`
  }

  stackItemWords(item: StackItem): string {
    const kind = item.ability ? (item.trigger ? "ausgelöste Fähigkeit von " : "Fähigkeit von ") : ""
    const targets = item.targets.length === 0 ? "" : `, Ziel: ${item.targets.map((target) => this.refWords(target)).join(", ")}`
    return `${kind}${this.book.of(item.card)}, gehört ${sideDative(this.side(item.player))}${targets}`
  }

  refWords(ref: EntityRef): string {
    return ref.kind === "player" ? sideObject(this.side(ref.id)) : this.book.label(ref.id)
  }

  allCards(state: GameState): VisibleCard[] {
    return stateCards(state).filter(isVisible)
  }

  /** Every card Forge marked playable now, with its place and Forge's words. */
  playable(state: GameState, only?: StateZone): string {
    const cards: string[] = []
    for (const player of state.players) {
      for (const zone of STATE_ZONES) {
        if (only !== undefined && zone !== only) continue
        for (const card of player.zones[zone]) {
          if (!isVisible(card) || !card.playable) continue
          const where = `${STATE_ZONE_WORDS[zone]}${player.me ? "" : ` ${sideGenitive("ai")}`}`
          const details = [where, ...(card.action === undefined ? [] : [`Forge: ${quote(card.action)}`]), ...(card.ways === undefined ? [] : [`Wege: ${card.ways.map(quote).join(" / ")}`])]
          cards.push(this.book.of(card, details))
        }
      }
    }
    return cards.length === 0 ? "keine" : cards.join(", ")
  }

  buttonWords(button: Button): string {
    const label = button.label ?? (button.nr === 1 ? "OK" : "Abbrechen")
    const meaning = button.meaning === undefined ? "" : ` (${MEANING_WORDS[button.meaning]})`
    return `${button.nr} ${quote(label)}${meaning}${button.enabled ? "" : " – nicht verfügbar"}`
  }

  itemWords(item: Item): string {
    if ("hidden" in item) return `${item.nr}: eine verdeckte Karte`
    const parts: string[] = []
    if (item.cardView !== undefined) parts.push(this.book.of(item.cardView))
    else if (item.card !== undefined) parts.push(this.book.label(item.card))
    if (item.player !== undefined) parts.push(sideName(this.side(item.player)))
    if (item.text !== null && item.text.trim() !== "") parts.push(quote(item.text))
    return `${item.nr}: ${parts.length === 0 ? "ohne Text" : parts.join(" – ")}`
  }

  offerWords(question: Question | null): string {
    const state = this.state
    const parts: string[] = []
    if (question !== null) {
      switch (question.kind) {
        case "buttons":
          parts.push(`Knöpfe: ${question.buttons.map((button) => this.buttonWords(button)).join(", ")}`)
          if (state !== null) parts.push(...this.purposeOffer(question, state))
          break
        case "select":
          parts.push(`wählbar (${question.min}–${question.max}): ${question.items.length === 0 ? "keine Karte" : question.items.map((item) => this.itemWords(item)).join(", ")}`)
          break
        case "choose":
          parts.push(`wählbar (${question.min}–${question.max}): ${question.items.map((item) => this.itemWords(item)).join(", ")}`)
          if (question.suggested !== undefined) parts.push(`Forges Vorschlag: ${question.suggested.join(", ")}`)
          break
        case "confirm":
          parts.push(`Ja ${quote(question.yesLabel ?? "Ja")} oder Nein ${quote(question.noLabel ?? "Nein")}; Forges Vorschlag: ${question.suggested ? "Ja" : "Nein"}`)
          break
        case "options":
          parts.push(`eine von: ${question.items.map((item) => this.itemWords(item)).join(", ")}${question.cancellable ? "; Abbrechen möglich" : ""}`)
          if (question.revealed !== undefined) parts.push(`gezeigt: ${question.revealed.map((item) => this.itemWords(item)).join(", ")}`)
          break
        case "input":
          parts.push(`${question.numeric ? "eine Zahl" : "ein Text"}${question.suggested === null ? "" : `, Forges Vorschlag: ${quote(question.suggested)}`}${question.items === undefined || question.items.length === 0 ? "" : `, erlaubt: ${question.items.map((item) => this.itemWords(item)).join(", ")}`}${question.cancellable ? "; Abbrechen möglich" : ""}`)
          break
        case "order":
          parts.push(`in Reihenfolge zu bringen: ${question.items.map((item) => this.itemWords(item)).join(", ")}${question.top === null ? "" : `; Forge: ${quote(question.top)}`}`)
          break
        case "arrange":
          parts.push(`anzuordnen: ${question.items.map((item) => this.itemWords(item)).join(", ")}; ${[question.toTop ? "nach oben" : null, question.toBottom ? "nach unten" : null, question.toAnywhere ? "an jede Stelle" : null].filter((x) => x !== null).join(", ")}; dazu ${count(question.others, "weitere verdeckte Karte", "weitere verdeckte Karten")}`)
          break
        case "distribute":
          parts.push(`${question.total} zu verteilen (je mindestens ${question.min}${question.maximums === undefined ? "" : `, höchstens ${question.maximums.join("/")}`}) auf: ${question.items.map((item) => this.itemWords(item)).join(", ")}${question.maySkip ? "; Aufschieben möglich" : ""}`)
          break
      }
    }
    if (state !== null) {
      const selectable = state.players.filter((player) => player.selectable).map((player) => sideName(this.side(player.id)))
      if (selectable.length > 0) parts.push(`wählbare Spieler: ${selectable.join(", ")}`)
      if (question === null || question.kind !== "buttons" || question.purpose !== "priority") {
        const playable = this.playable(state)
        if (playable !== "keine" && !parts.some((part) => part.startsWith("spielbar markiert"))) parts.push(`spielbar markiert: ${playable}`)
      }
    }
    return parts.length === 0 ? "nichts" : parts.join("; ")
  }

  purposeOffer(question: ButtonsQuestion, state: GameState): string[] {
    const { player } = this.players(state)
    switch (question.purpose) {
      case "priority":
        return [`spielbar markiert: ${this.playable(state)}`]
      case "mulligan":
        return player === undefined ? [] : [`Hand: ${this.cardList(player.zones.hand)}`]
      case "mulliganBottom": {
        if (player === undefined) return []
        const chosen = player.zones.hand.filter((card) => isVisible(card) && card.highlighted)
        return [`Hand: ${this.cardList(player.zones.hand)}`, `schon für unten gewählt: ${chosen.length === 0 ? "keine" : this.cardList(chosen)}`]
      }
      case "payment":
        return state.payment === undefined
          ? []
          : [`noch zu zahlen: ${state.payment.cost}`, ...(state.payment.pool === "" ? [] : [`Mana im Vorrat, das Forge nehmen würde: ${state.payment.pool}`])]
      case "attack":
      case "attackDeclared": {
        const parts: string[] = []
        const attack = state.attack
        if (attack !== undefined) {
          const entity = (ref: EntityRef) => (ref.kind === "player" ? sideName(this.side(ref.id)) : this.book.label(ref.id))
          parts.push(`Angriffsziel jetzt: ${attack.defender === null ? "keines" : entity(attack.defender)}`, `mögliche Ziele: ${attack.defenders.map(entity).join(", ") || "keine"}`)
          if (attack.unavailable.length > 0) parts.push(`bleiben zurück: ${attack.unavailable.map((each) => this.book.label(each.card, [ATTACK_REFUSAL_WORDS[each.reason].short])).join(", ")}`)
        }
        const declared = state.combat.map((entry) => this.book.label(entry.attacker))
        parts.push(`schon als Angreifer gewählt: ${declared.length === 0 ? "keine" : declared.join(", ")}`)
        return parts
      }
      case "block": {
        const assigned = state.combat.flatMap((entry) => entry.blockers.map((blocker) => `${this.book.label(blocker)} blockt ${this.book.label(entry.attacker)}`))
        return [`schon zugeordnet: ${assigned.length === 0 ? "keine Blocker" : assigned.join(", ")}`]
      }
      default:
        return []
    }
  }

  answerWords(input: Exclude<PlayerMessage, { type: "recording.boot" } | { type: "match.start" }>, question: Question | null): string {
    const items = (question: Question | null, numbers: readonly number[]): string => {
      if (numbers.length === 0) return "nichts"
      const list = question !== null && "items" in question ? question.items : undefined
      return numbers.map((nr) => {
        const item = list?.find((each) => each.nr === nr)
        return item === undefined ? `Nummer ${nr}` : this.itemWords(item).replace(/^\d+: /, "")
      }).join(", ")
    }
    switch (input.type) {
      case "answer":
        switch (input.kind) {
          case "buttons": {
            const button = question?.kind === "buttons" ? question.buttons.find((each) => each.nr === input.button) : undefined
            const label = quote(button?.label ?? (input.button === 1 ? "OK" : "Abbrechen"))
            return button?.meaning === undefined ? `wählt Knopf ${input.button} ${label}` : `${MEANING_ANSWERS[button.meaning]} (Knopf ${input.button} ${label})`
          }
          case "select":
          case "choose":
            return `wählt ${items(question, input.choices)}`
          case "confirm": {
            const labels = question?.kind === "confirm" ? (input.yes ? question.yesLabel : question.noLabel) : null
            return `antwortet ${input.yes ? "Ja" : "Nein"}${labels ? ` (${quote(labels)})` : ""}`
          }
          case "options":
            return input.option === 0 ? "bricht ab" : `wählt ${items(question, [input.option])}`
          case "input":
            return input.value === null ? "bricht die Eingabe ab" : `gibt ein: ${quote(input.value)}`
          case "order":
            return `legt die Reihenfolge fest: ${items(question, input.order)}`
          case "arrange":
            return input.positions !== undefined
              ? `ordnet an (Stellen ${input.positions.join(", ")}) für ${items(question, (question !== null && "items" in question ? question.items : []).map((item) => item.nr))}`
              : `legt nach oben: ${items(question, input.top)}; nach unten: ${items(question, input.bottom)}`
          case "distribute": {
            if (input.skip) return "schiebt die Verteilung auf"
            const list = question?.kind === "distribute" ? question.items : []
            return `verteilt: ${input.amounts.map((amount, i) => `${list[i] === undefined ? `Nummer ${i + 1}` : this.itemWords(list[i]!).replace(/^\d+: /, "")}: ${amount}`).join(", ")}`
          }
        }
        return "antwortet"
      case "card.tap": {
        const card = this.findCard(input.card)
        const action = card?.action
        return `tippt ${card === undefined ? this.book.label(input.card) : this.book.of(card)} an${action === undefined ? "" : ` – Forge bot dafür an: ${quote(action)}`}`
      }
      case "player.tap":
        return `wählt ${sideObject(this.side(input.player))}`
      case "mana.use":
        return `bezahlt mit ${MANA_WORDS[input.color]} Mana aus dem Manavorrat`
      case "concede":
        return "gibt die Partie auf"
      default:
        return "eine Eingabe"
    }
  }

  /** A card the player may see now: in the state or in an open question. */
  findCard(id: number): VisibleCard | undefined {
    const inState = this.state === null ? undefined : this.allCards(this.state).find((card) => card.id === id)
    if (inState !== undefined) return inState
    for (const question of this.questions.values()) {
      const found = questionCards(question).find((card): card is VisibleCard => isVisible(card) && card.id === id)
      if (found !== undefined) return found
    }
    return undefined
  }

  // ── Observations and log entries ────────────────────────────────────────

  actionWords(action: ObservedAction): string[] {
    const who = sideSubject(this.side(action.player))
    const targets = (list: readonly EntityRef[]) => (list.length === 0 ? "" : ` – Ziel: ${list.map((target) => this.refWords(target)).join(", ")}`)
    switch (action.kind) {
      case "turn":
        return [`Zug ${action.turn} beginnt: ${sideSubject(this.side(action.player)).replace(/^D/, "d")} ist am Zug.`]
      case "turnEnd":
        return [`Zug ${action.turn} endet.`]
      case "land":
        return [`${who} spielt ein Land: ${this.book.of(action.card)}.`]
      case "cast":
        return [`${who} wirkt ${this.book.of(action.card)}${targets(action.targets)}.`]
      case "activate":
        return [`${who} aktiviert eine Fähigkeit von ${this.book.of(action.card)}${targets(action.targets)}.`]
      case "trigger":
        return [`Eine Fähigkeit von ${this.book.of(action.card)} wird ausgelöst (gehört ${sideDative(this.side(action.player))})${targets(action.targets)}.`]
      case "attack":
        return [
          `${who} greift an (${this.after()}):`,
          ...action.attacks.map((each) => `${this.book.of(each.attacker)} greift ${each.defender === null ? "an (Forge nennt kein Ziel)" : `${this.refWords(each.defender)} an`}`),
        ]
      case "block":
        return [
          `${who} legt Blocker fest (${this.after()}):`,
          ...(action.blocks.length === 0
            ? ["keine Angreifer"]
            : action.blocks.map((each) =>
                each.blockers.length === 0
                  ? `${this.book.label(each.attacker)} wird nicht geblockt`
                  : `${each.blockers.map((blocker) => this.book.of(blocker)).join(" und ")} ${each.blockers.length === 1 ? "blockt" : "blocken"} ${this.book.label(each.attacker)}`,
              )),
        ]
      case "resolve": {
        const kind = action.stack === "spell" ? "" : action.stack === "trigger" ? "die ausgelöste Fähigkeit von " : "die Fähigkeit von "
        const what = `${kind}${this.book.of(action.card)}`
        const how = action.fizzled ? " – ohne Wirkung, Forge fand kein Ziel mehr gültig" : ""
        const lines = this.resultLines(action.results, action.card === null ? null : this.book.of(action.card))
        return [`Verrechnet${action.continued ? " (Fortsetzung)" : ""}: ${what} (gehört ${sideDative(this.side(action.player))})${how}.`, ...lines]
      }
      case "combatDamage": {
        const lines = this.resultLines(action.results, null)
        return [`Kampfschaden${action.continued ? " (Fortsetzung)" : ""}:`, ...(lines.length === 0 ? ["niemand erleidet Schaden"] : lines)]
      }
    }
  }

  /** The public results, in Forge's order: moves, damage with its source, life with its source. */
  resultLines(results: ActionResults, resolving: string | null): string[] {
    const lines: string[] = []
    for (const move of results.moves) {
      const card = this.book.of(move.card)
      const from = move.from === null ? null : zoneWords(move.from.zone, this.side(move.from.player))
      const to = move.to === null ? null : zoneWords(move.to.zone, this.side(move.to.player))
      lines.push(from === null ? `${card} entsteht${to === null ? "" : ` – ${to}`}` : to === null ? `${card} verlässt das Spiel (${from})` : `${card}: ${from} → ${to}`)
    }
    for (const damage of results.damage) {
      const source = damage.source === null ? "Eine Quelle, die Forge nicht nennt," : this.book.label(damage.source)
      const target = damage.target.kind === "player" ? sideDative(this.side(damage.target.id)) : this.book.label(damage.target.id)
      lines.push(`${source} fügt ${target} ${count(damage.amount, "Schadenspunkt", "Schadenspunkte")} zu (${this.after()})`)
    }
    for (const life of results.life) {
      const damage = results.damage.filter((each) => each.target.kind === "player" && each.target.id === life.player)
      const total = damage.reduce((sum, each) => sum + each.amount, 0)
      const head = `Leben ${sideGenitive(this.side(life.player))}: ${life.from} → ${life.to}`
      if (total > 0) {
        const sources = [...new Set(damage.map((each) => (each.source === null ? "einer Quelle, die Forge nicht nennt" : this.book.label(each.source))))]
        const rest = life.from - life.to !== total ? " (die Änderung entspricht nicht dem gemeldeten Schaden; den Rest nennt Forge nicht)" : ""
        lines.push(`${head} – durch Schaden von ${sources.join(", ")}${rest} (${this.after()})`)
      } else lines.push(`${head} – Quelle von Forge nicht genannt${resolving === null ? "" : ` (Vermutung: das gerade verrechnete Stapelobjekt ${resolving})`}`)
    }
    return lines
  }

  eventWords(event: GameEvent): string {
    const card = event.card === undefined ? "" : ` – Karte: ${this.book.label(event.card)}`
    const actor = event.actor === undefined ? "" : ` – von: ${event.actor === "me" ? "Spieler" : "Forge-KI"}`
    const life = event.kind === "LIFE" ? " – Quelle von Forge nicht genannt" : ""
    const after = event.kind === "DAMAGE" || event.kind === "COMBAT" ? ` (${this.after()})` : ""
    return `Forge-Protokoll (${code(event.kind)}): ${quote(event.text ?? "")}${card}${actor}${life}${after}`
  }

  endWords(end: GameEnd): string {
    const result = end.result === "win" ? "Der Spieler hat gewonnen" : end.result === "loss" ? "Die Forge-KI hat gewonnen" : end.result === "draw" ? "Unentschieden" : "Forge nennt kein Ergebnis"
    return `${result}. Forges Grund: ${end.reason === null ? "keiner genannt" : code(end.reason)}. Zugzahl laut Forge: ${end.turns ?? "keine"}. Aufgegeben: ${end.conceded ? "ja" : "nein"}.`
  }

  // ── States ──────────────────────────────────────────────────────────────

  cardList(cards: readonly Card[]): string {
    if (cards.length === 0) return "keine"
    const hidden = cards.filter((card) => !isVisible(card)).length
    const visible = cards.filter(isVisible).map((card) => this.book.of(card))
    return [...visible, ...(hidden === 0 ? [] : [count(hidden, "verdeckte Karte", "verdeckte Karten")])].join(", ")
  }

  permanent(card: Card): string {
    if (!isVisible(card)) return "eine verdeckte Karte"
    const facts: string[] = []
    if (card.power !== undefined && card.toughness !== undefined) facts.push(`${card.power}/${card.toughness}`)
    if (card.loyalty !== undefined && card.loyalty !== null) facts.push(`Loyalität ${inline(card.loyalty)}`)
    if (card.tapped) facts.push("getappt")
    if (card.sick) facts.push("Einsatzverzögerung")
    if (card.damage > 0) facts.push(`${card.damage} Schaden`)
    for (const [name, n] of Object.entries(card.counters ?? {})) facts.push(`Marke ${inline(name)} ×${n}`)
    if (card.attachedTo !== undefined) facts.push(`angelegt an ${this.book.label(card.attachedTo)}`)
    if (card.token) facts.push("Spielstein")
    if (card.faceDown) facts.push("verdeckt")
    if (card.phasedOut) facts.push("ausgephast")
    if (card.attacking) facts.push("greift an")
    if (card.blocking) facts.push("blockt")
    return this.book.of(card, facts)
  }

  seat(player: Player, side: Side): string[] {
    const who = sideName(side)
    const lines: string[] = []
    const lands = player.zones.battlefield.filter((card) => isVisible(card) && this.book.isLand(card)) as VisibleCard[]
    const others = player.zones.battlefield.filter((card) => !isVisible(card) || !this.book.isLand(card))
    if (side === "player") lines.push(`${who} – Hand (${player.zones.hand.length}): ${this.cardList(player.zones.hand)}`)
    else {
      const shown = player.zones.hand.filter(isVisible)
      lines.push(`${who} – Hand: ${count(player.zones.hand.length, "Karte", "Karten")}${shown.length === 0 ? " (verdeckt)" : `, davon aufgedeckt: ${this.cardList(shown)}`}`)
    }
    const untapped = lands.filter((card) => !card.tapped)
    const tapped = lands.filter((card) => card.tapped)
    lines.push(`${who} – Länder (${lands.length}): ungetappt: ${untapped.length === 0 ? "keine" : untapped.map((card) => this.permanent(card)).join(", ")}; getappt: ${tapped.length === 0 ? "keine" : tapped.map((card) => this.permanent(card)).join(", ")}`)
    lines.push(`${who} – übriges Spielfeld (${others.length}): ${others.length === 0 ? "nichts" : others.map((card) => this.permanent(card)).join(", ")}`)
    lines.push(`${who} – Friedhof (${player.zones.graveyard.length}): ${this.cardList(player.zones.graveyard)}`)
    lines.push(`${who} – Exil (${player.zones.exile.length}): ${this.cardList(player.zones.exile)}`)
    lines.push(`${who} – Bibliothek: ${count(player.library, "Karte", "Karten")}`)
    if (player.zones.command.length > 0 || player.commanders.length > 0) {
      const commanders = player.commanders.map((commander) => this.book.of(commander.card, [`gewirkt ${commander.cast}-mal`, `Steuer ${commander.tax}`, ...commander.damage.map((each) => `Kampfschaden an ${sideDative(this.side(each.player))}: ${each.amount}`)]))
      lines.push(`${who} – Kommandozone: ${this.cardList(player.zones.command)}${commanders.length === 0 ? "" : `; Kommandeure: ${commanders.join(", ")}`}`)
    }
    const mana = Object.entries(player.mana).filter(([, n]) => n > 0)
    if (mana.length > 0) lines.push(`${who} – Manavorrat: ${mana.map(([color, n]) => `${n} ${color}`).join(", ")}`)
    const counters = Object.entries(player.counters)
    if (counters.length > 0) lines.push(`${who} – Marken: ${counters.map(([name, n]) => `${inline(name)} ×${n}`).join(", ")}`)
    return lines
  }

  situation(state: GameState): string[] {
    const { player, ai } = this.players(state)
    const lines = [`Zustand [L${this.stateSeq(state)}] · Leben: Spieler ${player?.life ?? "?"} · Forge-KI ${ai?.life ?? "?"}`]
    if (player !== undefined) lines.push(...this.seat(player, "player"))
    if (ai !== undefined) lines.push(...this.seat(ai, "ai"))
    return lines.map((line) => `- ${line}`)
  }

  /** The log entry of a state (states are compared by identity). */
  stateSeq(state: GameState): number {
    return this.entries.find((entry) => entry.from === "engine" && entry.message === state)?.seq ?? -1
  }

  creatures(player: Player | undefined): number {
    return player === undefined ? 0 : player.zones.battlefield.filter((card) => isVisible(card) && card.power !== undefined && card.toughness !== undefined).length
  }

  closing(state: GameState): string[] {
    const { player, ai } = this.players(state)
    return [
      `- Zustand [L${this.stateSeq(state)}] · Leben: Spieler ${player?.life ?? "?"} · Forge-KI ${ai?.life ?? "?"}`,
      `- Handkarten: Spieler ${player?.zones.hand.length ?? "?"} · Forge-KI ${ai?.zones.hand.length ?? "?"}`,
      `- Kreaturen auf dem Feld (Karten mit Stärke/Widerstandskraft von Forge): Spieler ${this.creatures(player)} · Forge-KI ${this.creatures(ai)}`,
    ]
  }

  unusedLines(reading: UnusedReading | null, main: GameState | null): string[] {
    const state = reading?.state ?? main
    if (state === null) return ["- In diesem Zug zeigt die Aufzeichnung keinen Zustand einer Hauptphase des Spielers mit leerem Stapel; nichts zu lesen."]
    const me = this.players(state).player
    if (me === undefined) return ["- Der Zustand nennt den Spieler nicht; nichts zu lesen."]
    const open = me.landsUnlimited ? true : me.landsPlayed < me.landsAllowed
    const lands = me.zones.battlefield.filter((card): card is VisibleCard => isVisible(card) && this.book.isLand(card) && !card.tapped)
    const mana = Object.entries(me.mana).filter(([, n]) => n > 0)
    return [
      reading !== null
        ? `- Gelesen beim letzten Passen in einer eigenen Hauptphase bei leerem Stapel: ${reading.decision} [L${reading.seq}], ${phaseWords(state.phase)}, Zustand [L${this.stateSeq(state)}].`
        : `- Der Spieler passte in diesem Zug in keiner eigenen Hauptphase bei leerem Stapel selbst (Forges automatisches Passen oder keine Hauptphase mit Frage). Gelesen aus dem letzten Zustand einer eigenen Hauptphase bei leerem Stapel: ${phaseWords(state.phase)}, Zustand [L${this.stateSeq(state)}]; Forge meldete dort, der Spieler könne etwas tun: ${me.canAct ? "ja" : "nein"}.`,
      `- Landdrop offen: ${open ? "ja" : "nein"} (Forge: ${me.landsPlayed} von ${me.landsAllowed} ${me.landsAllowed === 1 ? "Land" : "Ländern"} gespielt${me.landsUnlimited ? ", beliebig viele erlaubt" : ""}).`,
      `- Ungetappte Länder: ${lands.length === 0 ? "keine" : lands.map((card) => this.book.of(card)).join(", ")}.`,
      ...(mana.length === 0 ? [] : [`- Mana im Vorrat: ${mana.map(([color, n]) => `${n} ${color}`).join(", ")}.`]),
      `- Als spielbar markierte Handkarten: ${this.playable(state, "hand")}.`,
    ]
  }

  // ── Assembly ────────────────────────────────────────────────────────────

  text(): string {
    const match = this.match
    const out: string[] = [HEADINGS.title, "", HEADINGS.foreword, ""]
    for (const paragraph of FOREWORD) out.push(paragraph, "")
    out.push(HEADINGS.head, "", ...this.head(), "")
    out.push(HEADINGS.deck, "", ...deckLines(match.human.deck), "")
    out.push(HEADINGS.start, "")
    if (this.initialSettings !== null) out.push(`- Einstellungen zu Beginn (Forge): ${settingsWords(this.initialSettings.autoPass, this.initialSettings.observation)}.`)
    out.push(...(this.start.length === 0 ? ["- Die Aufzeichnung enthält vor dem ersten Zug nichts."] : this.start), "")
    out.push(HEADINGS.turns, "")
    if (this.turns.length === 0) out.push("Die Aufzeichnung erreicht keinen Zug.", "")
    for (const turn of this.turns) {
      out.push(`### Zug ${turn.turn} (${turn.ordinal}. Zug ${sideGenitive(turn.side)})`, "")
      out.push(HEADINGS.situation, "", ...this.situation(turn.begin), "")
      out.push(HEADINGS.course, "", ...(turn.course.length === 0 ? ["- Die Aufzeichnung enthält in diesem Zug nichts weiter."] : turn.course), "")
      if (turn.side === "player") out.push(HEADINGS.unused, "", ...this.unusedLines(turn.unused, turn.main), "")
      out.push(HEADINGS.close, "", ...this.closing(turn.last), "")
    }
    out.push(HEADINGS.end, "", ...this.ending(), "")
    out.push(HEADINGS.cards, "", ...this.cardTable(), "")
    out.push(HEADINGS.aiDeck, "", "Diese Liste war dem Spieler während der Partie **nicht bekannt**. Urteile über seine Entscheidungen nur mit dem, was er zu diesem Zeitpunkt sehen konnte.", "", ...deckLines(match.ai.deck), "")
    out.push(HEADINGS.origin, "", ...this.origin(), "")
    return out.join("\n")
  }

  head(): string[] {
    const match = this.match
    const lastAt = this.entries.at(-1)?.at ?? 0
    const status = match.status === "finished" ? "beendet" : match.status === "aborted" ? "abgebrochen (technischer Abbruch der Engine)" : "laufend oder unterbrochen – die Aufzeichnung ist nicht abgeschlossen"
    const lasting = match.endedAt === null ? `unbekannt (letzter Eintrag nach ${formatDuration(lastAt)})` : formatDuration(Math.max(0, Date.parse(match.endedAt) - Date.parse(match.startedAt)))
    const end = this.end ?? (match.end === null ? null : { result: match.end.result, reason: match.end.reason, turns: match.end.turns, conceded: match.end.conceded })
    return [
      `- Beginn: ${utcMinute(match.startedAt)}`,
      `- Dauer: ${lasting}`,
      `- Modus: ${modeWords(match)}`,
      `- Deck des Spielers: ${quote(match.human.deck.name)} · Deck der Forge-KI: in Anhang B`,
      `- KI-Profil: ${quote(match.ai.profile)} (in OpenMana: ${quote(aiProfileLabel(match.ai.profile))})`,
      `- Seed: ${match.seed === null ? "nicht festgelegt" : match.seed}`,
      `- OpenMana-Version: ${inline(match.app.version)}${match.app.commit === null ? "" : ` (Commit ${match.app.commit.slice(0, 12)})`}`,
      `- Forge-Version: ${inline(match.engine.forgeVersion)} (Commit ${match.engine.forgeCommit.slice(0, 12)}), Engine-Protokoll ${match.engine.protocol}`,
      `- Status: ${status}`,
      `- Ergebnis: ${end === null ? "keines" : `${this.endWords({ type: "game.end", winner: null, players: [], ...end })}`}`,
    ]
  }

  ending(): string[] {
    const lines: string[] = []
    if (this.end !== null) lines.push(`- ${this.endWords(this.end)}`, ...this.end.players.map((each) => `- Leben laut Forges Ergebnis: ${sideName(this.side(each.id))} ${each.life}`))
    else if (this.abort !== null) lines.push(`- Die Engine brach technisch ab (${inline(this.abort.reason)}): ${quote(this.abort.message)}. Es gibt kein Ergebnis.`)
    else lines.push("- Die Aufzeichnung endet ohne Ergebnis: Die Partie lief noch oder wurde unterbrochen (etwa durch Neuladen der Seite).")
    if (this.state !== null) {
      const { player, ai } = this.players(this.state)
      lines.push(...this.closing(this.state), `- Bibliotheken: Spieler ${player?.library ?? "?"} · Forge-KI ${ai?.library ?? "?"}`)
    }
    return lines
  }

  cardTable(): string[] {
    const rows = [...this.book.cards.entries()].sort(([a], [b]) => a - b)
    if (rows.length === 0) return ["Die Aufzeichnung zeigt keine Karte."]
    return [
      "Nur Karten, die in der Aufzeichnung irgendwann sichtbar waren. Die Typzeile steht, wie Forge sie sendet (in Forges Kartensprache).",
      "",
      "| Kennung | Name | Typzeile | Besitzer |",
      "| ---: | --- | --- | --- |",
      ...rows.map(([id, known]) => `| ${id} | ${known.names.length === 0 ? "ohne Namen" : known.names.map(inline).join(" / ")} | ${known.typeLines.map(inline).join(" / ") || "–"} | ${sideName(this.side(known.owner))} |`),
    ]
  }

  origin(): string[] {
    const fromEngine = this.entries.filter((entry) => entry.from === "engine").length
    return [
      `- Kennung der Aufzeichnung: ${this.match.id}`,
      `- Logeinträge: ${this.entries.length} (von Forge ${fromEngine}, vom Spieler ${this.entries.length - fromEngine})`,
      `- Engine-Protokoll: ${this.match.engine.protocol}${this.match.engine.manifestSha256 === undefined ? "" : ` · Engine-Manifest SHA-256: ${this.match.engine.manifestSha256}`}`,
      `- Nicht als Entscheidung aufgeführt: ${count(this.releases, "weitergeschaltete Anzeige", "weitergeschaltete Anzeigen")} der Gegneraktionen, ${count(this.stateRequests, "Zustandsanfrage", "Zustandsanfragen")} der App.`,
      `- Die vollständige Aufzeichnung ist die zugehörige JSON-Datei (${quote(`openmana-wiedergabe-${this.match.id}.json`)}, „JSON speichern“). Dieser Bericht ist aus ihr abgeleitet und ersetzt sie nicht.`,
    ]
  }
}

/** One of Forge's enum words (a log entry's kind, a win condition) as code: `GAME_OUTCOME`. */
function code(word: string): string {
  return `\`${word.replace(/`/g, "")}\``
}

function refs(seq: number | readonly number[]): string {
  return (typeof seq === "number" ? [seq] : seq).map((each) => `L${each}`).join(", ")
}

function settingsWords(autoPass: string | null, observation: string | null): string {
  const parts: string[] = []
  if (autoPass !== null)
    parts.push(`automatisches Passen: ${autoPass === "noActions" ? "Forge passt, wenn der Spieler nichts tun kann" : autoPass === "noActionsRespectInterrupts" ? "Forge passt, wenn der Spieler nichts tun kann, fragt aber bei Unterbrechungen" : autoPass === "never" ? "nie – Forge fragt bei jeder Priorität" : inline(autoPass)}`)
  if (observation !== null) parts.push(`Gegneraktionen: ${observation === "hold" ? "Forge hält zum Ansehen an" : "Forge hält nicht an"}`)
  return parts.length === 0 ? "keine Angabe" : parts.join("; ")
}

/** The mode from the recorded deck (prompt 61): the format Forge played, a Jumpstart side by the name its two halves got. */
function modeWords(match: MatchRecord): string {
  if (match.format === "commander") return "Commander (Forge-Format commander)"
  const cards = match.human.deck.main.reduce((sum, entry) => sum + entry.count, 0)
  if (match.human.deckId === null && match.human.deck.name.startsWith("Jumpstart: "))
    return `Jumpstart – zwei Hälften als ein Deck von ${cards} Karten, ${quote(match.human.deck.name)} (Forge-Format constructed)`
  return "Normal (Forge-Format constructed)"
}

function deckLines(deck: MatchDeck): string[] {
  const total = (entries: readonly { readonly count: number }[]) => entries.reduce((sum, entry) => sum + entry.count, 0)
  const list = (entries: readonly { readonly card: string; readonly count: number }[]) => entries.map((entry) => `  - ${entry.count} × ${inline(entry.card)}`)
  return [
    `- Name: ${quote(deck.name)}`,
    ...(deck.commander.length === 0 ? [] : [`- Commander (${total(deck.commander)}):`, ...list(deck.commander)]),
    `- Hauptdeck (${count(total(deck.main), "Karte", "Karten")}):`,
    ...list(deck.main),
    deck.sideboard.length === 0 ? "- Sideboard: leer" : `- Sideboard (${count(total(deck.sideboard), "Karte", "Karten")}):`,
    ...list(deck.sideboard),
  ]
}
