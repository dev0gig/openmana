/*
 * Forge's decisions on the game table (prompt 15): the decision region, right
 * above the player's hand (beside the player's half in landscape), shows what
 * Forge asks and lets the player answer it - every kind of question the
 * protocol knows (Anvil's decision families):
 *
 *   buttons     Forge's two buttons of the running step (keep/mulligan,
 *               OK/end turn, auto/cancel …), with Forge's own words
 *   select      the cards Forge names to select (targets, cards to discard);
 *               cards the table does not show appear here as a row
 *   choose      pick from a list (modes, cards, players, colours, numbers)
 *   confirm     yes or no, with Forge's words for both
 *   options     one of several possibilities (which ability to use); or a
 *               list Forge only shows, with one OK
 *   input       a number or a text
 *   order       put items in an order (Forge's dual list: some may remain)
 *   arrange     cards to the top or bottom of a hidden pile (scrying)
 *   distribute  give out a total (damage) among targets
 *
 * Nothing is answered for the player: every answer is the player's press on
 * a button that says what it sends, never a default Forge suggested (a
 * suggestion is only the first draft). A draft that does not fit the numbers
 * Forge sent is never sent - its button stays off and says why
 * (decision-model.ts). Sending buttons are armed a moment after they appear
 * (ARMING_MS, like the card view's button of prompt 14): Forge asks the next
 * question at once, often with a button in the same place, and the second
 * press of a double click must not answer it. Held keys repeat nothing.
 *
 * While Forge computes, a concession is on its way, or the table is only
 * looked at (no page to send answers), nothing can be sent, and the region
 * says so. An answer the client or the engine refuses (a question withdrawn
 * meanwhile, a misfit only the engine can tell) never disappears silently:
 * the page shows the client's reason, the engine's comes as Forge's notice.
 * A question Forge withdraws takes its controls - and any draft - with it.
 *
 * Forge's texts are shown as Forge sends them. For the buttons and the
 * selection of a running step the words are Forge's current prompt line: the
 * question's own text is the line Forge showed when the step began, often
 * the one before (Anvil lesson). A blocking question brings its own text.
 *
 * The player's priority (prompt 16) is the one step with words of its own:
 * Forge's prompt line there is a status report (turn, step, stack, with the
 * players' names) that the header and the stack already show, so the region
 * says what the moment is about instead - from Forge's structured state -
 * and Forge's OK says what passing does now (see PriorityDecision).
 *
 * Targets and payment (prompt 17): a selection says how many Forge wants in
 * its own numbers - cards and players together - and how many are chosen;
 * the players Forge would take are buttons here as on the table (Forge's
 * player.tap: choose, take back). While a cost is paid the region shows what
 * is still to pay (Forge's mana symbols, from its payment), floating mana
 * Forge would take from the pool (mana.use) and - for Phyrexian mana - life
 * (the player's own seat). All of it taps at once, like the mana sources on
 * the table; Forge's Cancel takes the whole payment back.
 *
 * Declaring attackers (prompt 18) has words of its own like the priority:
 * Forge's prompt line there repeats a fixed sentence with the defender's
 * name, so the region says from Forge's declaration in progress whom a
 * creature tapped now attacks, which creatures attack so far, which stay
 * back and why (Forge's reasons), lets the player switch among the defenders
 * Forge offers (Forge's player.tap / card.tap), and names Forge's buttons by
 * what they do (see AttackDecision).
 */
import { ArrowDown, ArrowUp, Minus, Plus, Search, X } from "lucide-react"
import { createContext, use, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react"
import type {
  AnswerBody,
  ArrangeQuestion,
  Button as ForgeButton,
  ButtonsQuestion,
  ChooseQuestion,
  ConfirmQuestion,
  DistributeQuestion,
  GameState,
  InputQuestion,
  Item,
  ManaColor,
  OptionsQuestion,
  OrderQuestion,
  Question,
  SelectQuestion,
  VisibleCard,
} from "@openmana/engine-protocol"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { GameCardBack, GameCardButton, GameCardRow, GameCardRowButton, GameCardRowItem, type GameCardMark } from "@/components/ui/game-card"
import { GameDecision, GameDecisionActions, GameDecisionHeader, GameDecisionNote, GameDecisionRow, GameDecisionSource } from "@/components/ui/game-decision"
import { GamePlayer, GamePlayerButton } from "@/components/ui/game-player"
import { Input } from "@/components/ui/input"
import { Item as ItemRow, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { useCardPress } from "@/hooks/use-card-press"
import { ARMING_MS } from "./card-sheet"
import { attackText, CALL_BACK_LABEL, declareLabel, declareNote } from "./attack-labels"
import { attackView, type AttackView, type DefenderView } from "./attack-model"
import { directTaps, playerUse, tapBlocked, type TableMoment } from "./card-use"
import {
  arrangeAnswer,
  buttonsAnswer,
  buttonText,
  cardItems,
  changeAmount,
  checkArrangement,
  checkChoose,
  checkDistribution,
  checkInput,
  checkOrder,
  chooseAnswer,
  confirmAnswer,
  confirmLabels,
  countRule,
  currentDecision,
  decisionQuestion,
  distributeAnswer,
  initialAmounts,
  initialArrangement,
  initialChoice,
  initialInput,
  initialOption,
  initialOrder,
  inputAnswer,
  isVisibleItem,
  itemLabel,
  moveEntry,
  moveToSide,
  optionsAnswer,
  orderAnswer,
  orderRule,
  paymentView,
  selectAnswer,
  selectView,
  toggleChoice,
  type Arrangement,
  type BlockingQuestion,
  type Decision,
  type PaymentView,
  type PileSide,
  type SelectView,
} from "./decision-model"
import { questionLabel } from "./game-labels"
import { endTurnText, PASS_LABELS, PASS_NOTES, priorityText } from "./priority-labels"
import type { TableCardLookup } from "./table-cards"
import { cardName, MANA_LABELS, manaSymbolsText, playerButtonLabel, seatName } from "./table-labels"
import { TablePicture } from "./table-picture"
import { priorityHolder, priorityMoment, type PriorityMoment } from "./turn-model"

/** From this many entries a list gets a search field. */
const SEARCH_FROM = 12
/** A searched list shows at most this many entries at once (and says how many more match). */
const SHOWN_AT_MOST = 50

export interface DecisionPanelProps {
  readonly state: GameState
  /** The questions Forge asks right now, in the order asked. */
  readonly questions: readonly Question[]
  /** Forge's instruction line for the running step (null: none). */
  readonly prompt: string | null
  /** Forge waits for the player (not computing). */
  readonly waiting: boolean
  /** The concession is on its way. */
  readonly conceding: boolean
  readonly pictures: TableCardLookup
  /** Shown at the top of the region (a silent engine, a concession on its way). */
  readonly alerts?: ReactNode
  /** Sends an answer (the page does it). Absent: the table is only looked at - nothing can be answered. */
  readonly onAnswer?: (question: number, body: AnswerBody) => void
  /** Opens the card view for a card of a question (with the question's view of it, for a card in no zone of the state). */
  readonly onLook: (id: number, snapshot?: VisibleCard) => void
  /** Taps a player (Forge's player.tap, prompt 17 - the page sends it). Absent: nothing is tapped. */
  readonly onTapPlayer?: (player: number) => void
  /** Taps a card at once (Forge's card.tap - a defending planeswalker, prompt 18; the table's guard against a double tap). Absent: nothing is tapped. */
  readonly onTapCard?: (card: number) => void
  /** Pays with floating mana (mana.use, prompt 17 - the page sends it). Absent: nothing is paid. */
  readonly onUseMana?: (color: ManaColor) => void
}

interface DecisionContextValue {
  readonly state: GameState
  readonly pictures: TableCardLookup
  /** Why nothing can be sent right now (null: answers can be sent). */
  readonly blocked: string | null
  /** The id of the line that says why (for aria-describedby). */
  readonly blockedId: string
  readonly answer: (question: number, body: AnswerBody) => void
  readonly look: (id: number, snapshot?: VisibleCard) => void
  /** The moment as the table's cards see it (card-use.ts): the questions, whether Forge waits, a concession. */
  readonly moment: TableMoment
  /** Why no tap can be sent (a player, mana), or null - the table's reasons, or that it is only looked at. */
  readonly tapBlocked: string | null
  readonly tapPlayer: (player: number) => void
  readonly tapCard: (card: number) => void
  readonly payWithMana: (color: ManaColor) => void
}

const DecisionContext = createContext<DecisionContextValue | null>(null)

function useDecision(): DecisionContextValue {
  const context = use(DecisionContext)
  if (context === null) throw new Error("a decision control outside DecisionPanel")
  return context
}

/** Why nothing can be sent now, or null. */
export function answerBlocked({ live, conceding, waiting }: { live: boolean; conceding: boolean; waiting: boolean }): string | null {
  if (!live) return "Nur ansehen – hier wird nichts beantwortet."
  if (conceding) return "Die Aufgabe ist unterwegs."
  if (!waiting) return "Forge rechnet gerade – antworten geht, sobald Forge wieder auf dich wartet."
  return null
}

/**
 * Whether the decision needs room (GameBoard decision="expanded"): a
 * blocking question with a list or a form, or a selection with cards the
 * table does not show. A yes/no question and Forge's buttons fit the
 * compact region.
 */
export function decisionNeedsRoom(decision: Decision, state: GameState | null): boolean {
  if (decision.kind === "blocking") return decision.question.kind !== "confirm"
  if (decision.kind === "step" && decision.select !== null && state !== null) return selectView(decision.select, state).offTable.length > 0
  return false
}

export function DecisionPanel({ state, questions, prompt, waiting, conceding, pictures, alerts, onAnswer, onLook, onTapPlayer, onTapCard, onUseMana }: DecisionPanelProps) {
  const decision = currentDecision(questions)
  const blocked = answerBlocked({ live: onAnswer !== undefined, conceding, waiting })
  const blockedId = useId()
  const moment = useMemo<TableMoment>(() => ({ questions, waiting, conceding, attack: state.attack ?? null }), [questions, waiting, conceding, state.attack])
  const tapReason = onTapPlayer === undefined ? "Nur ansehen – hier wird nichts angetippt." : tapBlocked(moment)
  const context = useMemo<DecisionContextValue>(
    () => ({
      state,
      pictures,
      blocked,
      blockedId,
      answer: onAnswer ?? (() => undefined),
      look: onLook,
      moment,
      tapBlocked: tapReason,
      tapPlayer: onTapPlayer ?? (() => undefined),
      tapCard: onTapCard ?? (() => undefined),
      payWithMana: onUseMana ?? (() => undefined),
    }),
    [state, pictures, blocked, blockedId, onAnswer, onLook, moment, tapReason, onTapPlayer, onTapCard, onUseMana],
  )
  const question = decisionQuestion(decision)
  return (
    <DecisionContext value={context}>
      <GameDecision {...(question !== null ? { "data-question": question.id } : {})}>
        {alerts}
        {decision.kind === "none" ? (
          waiting ? (
            <p className="text-sm">{prompt ?? "Forge wartet auf dich."}</p>
          ) : (
            <ForgeWorking state={state} />
          )
        ) : (
          <>
            <h2 className="sr-only">Forge wartet auf deine Entscheidung</h2>
            {decision.kind === "blocking" ? (
              <BlockingDecision key={decision.question.id} question={decision.question} />
            ) : (
              <StepDecision key={`${decision.buttons?.id ?? 0}:${decision.select?.id ?? 0}`} buttons={decision.buttons} select={decision.select} prompt={prompt} />
            )}
          </>
        )}
        {/* New decisions are announced; a priority only with something on the stack (a chance to answer) - "Du bist dran" says the others. */}
        <p className="sr-only" aria-live="polite">
          {announcement(question, state)}
        </p>
      </GameDecision>
    </DecisionContext>
  )
}

/** What the live region says about a new decision. */
function announcement(question: Question | null, state: GameState): string {
  if (question === null) return ""
  if (question.kind === "buttons" && question.purpose === "priority") {
    const moment = priorityMoment(state, question)
    return moment.top === null ? "" : `Priorität: ${priorityText(moment)}`
  }
  return `Forge fragt: ${questionLabel(question)}`
}

/**
 * Forge computes - the AI's turn, a spell resolving, the next step: who is
 * at it, and that the game runs on by itself only where the player has
 * nothing to do (Forge's own auto-pass, APINA - prompt 16).
 */
function ForgeWorking({ state }: { state: GameState }) {
  const holder = priorityHolder(state)
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner aria-hidden />
        {holder !== null && !holder.me ? "Die Forge-KI ist dran …" : "Forge rechnet …"}
      </p>
      <GameDecisionNote>Forge spielt von selbst weiter, bis du etwas tun oder entscheiden kannst – dann hält Forge an.</GameDecisionNote>
    </div>
  )
}

// ── Building blocks ────────────────────────────────────────────────────────

/** The card a question is about (Forge sends it with the question), if the player may see it. */
function sourceOf(question: Question | null): { readonly id: number; readonly card: VisibleCard } | null {
  if (question === null || !("cardView" in question) || question.cardView === undefined || question.card === undefined) return null
  return { id: question.card, card: question.cardView }
}

/** What Forge asks: the asking card (its picture opens the card view), the kind of decision, Forge's words. */
function DecisionHeading({ label, text, source }: { label: string; text: string | null; source: { readonly id: number; readonly card: VisibleCard } | null }) {
  const { pictures, look } = useDecision()
  return (
    <GameDecisionHeader>
      {source !== null ? (
        <GameDecisionSource>
          <GameCardButton
            data-question-card={source.id}
            aria-label={`${cardName(source.card)} ansehen`}
            aria-haspopup="dialog"
            title={cardName(source.card)}
            onClick={() => look(source.id, source.card)}
            onContextMenu={(event) => {
              event.preventDefault()
              look(source.id, source.card)
            }}
          >
            <TablePicture card={source.card} pictures={pictures} />
          </GameCardButton>
        </GameDecisionSource>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          {label}
          {source !== null ? ` · ${cardName(source.card)}` : null}
        </p>
        {text ? <p className="text-sm font-medium break-words">{text}</p> : null}
      </div>
    </GameDecisionHeader>
  )
}

/**
 * A button that sends an answer: off while nothing can be sent (with the
 * reason), armed ARMING_MS after its question appeared (a press before that is
 * dropped - see above), a held key repeats nothing.
 */
function SendButton({ armKey, onSend, reasonId, disabled = false, ...props }: Omit<ComponentProps<typeof Button>, "onClick"> & { armKey: number; onSend: () => void; reasonId?: string | undefined }) {
  const { blocked, blockedId } = useDecision()
  const armedAt = useRef<number | null>(null)
  useEffect(() => {
    armedAt.current = performance.now()
  }, [armKey])
  const off = disabled || blocked !== null
  const describedBy = [blocked !== null ? blockedId : null, reasonId ?? null].filter((id) => id !== null).join(" ")
  return (
    <Button
      size="lg"
      disabled={off}
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
      onKeyDown={(event) => {
        if (event.repeat) event.preventDefault()
      }}
      onClick={() => {
        const at = armedAt.current
        if (at === null || performance.now() - at < ARMING_MS) return
        onSend()
      }}
      {...props}
    />
  )
}

/** Why nothing can be sent now (the line the sending buttons point to). */
function BlockedNote() {
  const { blocked, blockedId } = useDecision()
  if (blocked === null) return null
  return (
    <GameDecisionNote id={blockedId} className="flex items-center gap-2">
      {blocked.startsWith("Forge rechnet") ? <Spinner aria-hidden /> : null}
      {blocked}
    </GameDecisionNote>
  )
}

/** A card of a question (or a hidden one), as a small picture that opens the card view. */
function ItemThumb({ item }: { item: Item }) {
  const { pictures, look } = useDecision()
  if (!isVisibleItem(item)) {
    return (
      <GameCardBack>
        <span className="sr-only">verdeckte Karte</span>
      </GameCardBack>
    )
  }
  if (item.cardView === undefined || item.card === undefined) return null
  const card = item.cardView
  const id = item.card
  return (
    <GameCardButton
      data-question-card={id}
      aria-label={`${cardName(card)} ansehen`}
      aria-haspopup="dialog"
      title={cardName(card)}
      onClick={() => look(id, card)}
      onContextMenu={(event) => {
        event.preventDefault()
        look(id, card)
      }}
    >
      <TablePicture card={card} pictures={pictures} />
    </GameCardButton>
  )
}

/** Whether an item shows a card (visible or hidden) - then it gets a picture in lists. */
function hasThumb(item: Item): boolean {
  return !isVisibleItem(item) || item.cardView !== undefined
}

/**
 * A row of a question's cards (a toolbar: one Tab stop, arrow keys). The
 * primary activation does `onPrimary` (choose, select …) unless nothing can
 * be sent - then, like a long press or a right click, it opens the card view.
 * `direct`: the press is sent at once (a selection) - a second press of the
 * same card within ARMING_MS counts once.
 */
function ItemCards({
  items,
  label,
  markOf,
  describe,
  onPrimary,
  direct = false,
}: {
  items: readonly Item[]
  label: string
  markOf: (item: Item) => GameCardMark | null
  describe: (item: Item) => string
  /** null: the cards are only to look at (the primary activation opens the card view too). */
  onPrimary: ((nr: number) => void) | null
  direct?: boolean
}) {
  const { blocked } = useDecision()
  const last = useRef<{ readonly nr: number; readonly at: number } | null>(null)
  return (
    <GameDecisionRow>
      <GameCardRow controls aria-label={label}>
        {items.map((item) => (
          <GameCardRowItem key={item.nr}>
            <ItemCard
              item={item}
              mark={markOf(item)}
              label={describe(item)}
              active={onPrimary !== null && (!direct || blocked === null)}
              onPrimary={() => {
                if (onPrimary === null) return
                if (direct) {
                  const now = performance.now()
                  if (last.current !== null && last.current.nr === item.nr && now - last.current.at < ARMING_MS) return
                  last.current = { nr: item.nr, at: now }
                }
                onPrimary(item.nr)
              }}
            />
          </GameCardRowItem>
        ))}
      </GameCardRow>
    </GameDecisionRow>
  )
}

function ItemCard({ item, mark, label, active, onPrimary }: { item: Item; mark: GameCardMark | null; label: string; active: boolean; onPrimary: () => void }) {
  const { pictures, look } = useDecision()
  const visible = isVisibleItem(item) && item.cardView !== undefined && item.card !== undefined ? { id: item.card, card: item.cardView } : null
  const lookAt = () => {
    if (visible !== null) look(visible.id, visible.card)
  }
  const press = useCardPress({ onPrimary: active ? onPrimary : lookAt, onLook: lookAt })
  return (
    <GameCardRowButton>
      <GameCardButton mark={mark} data-item={item.nr} {...(visible !== null ? { "data-question-card": visible.id } : {})} aria-label={label} title={label} {...press}>
        {visible !== null ? (
          <TablePicture card={visible.card} pictures={pictures} />
        ) : (
          <GameCardBack>
            <span className="sr-only">verdeckte Karte</span>
          </GameCardBack>
        )}
      </GameCardButton>
    </GameCardRowButton>
  )
}

/** A list's search field and which entries it shows (all, or the matches - at most SHOWN_AT_MOST, saying how many more). */
function useSearch(items: readonly Item[], labelOf: (item: Item) => string): { readonly field: ReactNode; readonly shown: readonly Item[]; readonly note: string | null } {
  const [query, setQuery] = useState("")
  const id = useId()
  const searchable = items.length >= SEARCH_FROM
  const needle = query.trim().toLocaleLowerCase("de")
  const matches = searchable && needle !== "" ? items.filter((item) => labelOf(item).toLocaleLowerCase("de").includes(needle)) : items
  const shown = searchable ? matches.slice(0, SHOWN_AT_MOST) : matches
  const more = matches.length - shown.length
  const note = !searchable
    ? null
    : matches.length === 0
      ? "Kein Eintrag passt zur Suche."
      : more > 0
        ? `${matches.length.toLocaleString("de-DE")} Einträge passen, die ersten ${shown.length} stehen hier – grenze die Suche ein, um die übrigen ${more.toLocaleString("de-DE")} zu finden.`
        : null
  const field = searchable ? (
    <Field>
      <FieldLabel htmlFor={id} className="sr-only">
        In {items.length.toLocaleString("de-DE")} Einträgen suchen
      </FieldLabel>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} type="search" className="pl-9" placeholder={`In ${items.length.toLocaleString("de-DE")} Einträgen suchen`} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
    </Field>
  ) : null
  return { field, shown, note }
}

// ── A running step: Forge's buttons and its selection ──────────────────────

function StepDecision({ buttons, select, prompt }: { buttons: ButtonsQuestion | null; select: SelectQuestion | null; prompt: string | null }) {
  const { state } = useDecision()
  if (buttons?.purpose === "priority" && select === null) return <PriorityDecision moment={priorityMoment(state, buttons)} />
  if ((buttons?.purpose === "attack" || buttons?.purpose === "attackDeclared") && select === null) {
    const view = attackView(state, buttons)
    if (view !== null) return <AttackDecision view={view} />
  }
  const selection = select === null ? null : selectView(select, state)
  const main = buttons ?? select
  const label = buttons?.purpose !== undefined ? questionLabel(buttons) : select !== null ? questionLabel(select) : main !== null ? questionLabel(main) : "Entscheidung"
  // Forge's current prompt line; the questions' own texts are the line of the moment the step began (see above).
  const text = prompt ?? (main?.text.trim() ? main.text : null)
  const open = [buttons, select].filter((question): question is ButtonsQuestion | SelectQuestion => question !== null)
  return (
    <>
      <DecisionHeading label={label} text={text} source={sourceOf(buttons) ?? sourceOf(select)} />
      {select !== null && selection !== null ? <SelectPart question={select} view={selection} /> : null}
      {buttons?.purpose === "payment" && select === null ? <PaymentPart /> : null}
      {buttons?.purpose === "mulliganBottom" ? <MulliganChosen /> : null}
      {directTaps(open) ? <GameDecisionNote>Karten antippen wirkt hier sofort, ein zweiter Tipp nimmt es zurück. Lange drücken oder Rechtsklick zeigt eine Karte groß.</GameDecisionNote> : null}
      <BlockedNote />
      {buttons !== null ? <ForgeButtons question={buttons} /> : null}
    </>
  )
}

/**
 * The player's priority (prompt 16). Instead of Forge's status line (turn,
 * step and stack with the players' names - what the header and the stack
 * already show) the region says what the moment is about, from Forge's
 * structured state: whose turn it is, what lies on top of the stack (its
 * card beside the words, to look at). Forge's OK says what passing does now
 * - "Weiter" with an empty stack, "Verrechnen lassen" with something on it -
 * and the line above the buttons explains it. Forge's second button keeps
 * Forge's words: Undo takes the last action back (a land tapped for mana),
 * End Turn - Forge's auto-pass until the end of the turn, which also leaves
 * out an attack of the player's own turn - only after asking: the one press
 * here that gives more than this moment away (Bible §6).
 *
 * Playing a card is not answered here: cards are played by tapping them -
 * their card view's button, Forge's card.tap (prompt 14) - exactly as
 * Forge's own GUI plays them during priority, never through a list the app
 * would make up.
 */
function PriorityDecision({ moment }: { moment: PriorityMoment }) {
  const { answer } = useDecision()
  const noteId = useId()
  const offId = useId()
  const { question, top } = moment
  const pass = question.buttons.find((button) => button.nr === 1) ?? null
  const second = question.buttons.find((button) => button.nr === 2) ?? null
  const off = question.buttons.filter((button) => !button.enabled)
  return (
    <>
      <DecisionHeading label={questionLabel(question)} text={priorityText(moment)} source={top?.card ? { id: top.card.id, card: top.card } : null} />
      <GameDecisionNote id={noteId}>{PASS_NOTES[moment.pass]}</GameDecisionNote>
      {off.length > 0 ? (
        <GameDecisionNote id={offId}>
          {off.length === 1 ? `„${off[0]!.nr === 1 ? PASS_LABELS[moment.pass] : buttonText(off[0]!)}“ hat Forge gerade abgeschaltet.` : "Forge hat beide Knöpfe gerade abgeschaltet."}
        </GameDecisionNote>
      ) : null}
      <BlockedNote />
      <GameDecisionActions role="group" aria-label="Antworten, die Forge anbietet">
        {pass !== null ? (
          <SendButton
            armKey={question.id}
            data-meaning="pass"
            disabled={!pass.enabled}
            reasonId={pass.enabled ? noteId : offId}
            onSend={() => answer(question.id, buttonsAnswer(1))}
          >
            {PASS_LABELS[moment.pass]}
          </SendButton>
        ) : null}
        {second === null ? null : moment.second === "endTurn" ? (
          <EndTurnButton question={question} button={second} turn={moment.turn} reasonId={second.enabled ? undefined : offId} />
        ) : (
          <SendButton
            armKey={question.id}
            variant="outline"
            {...(moment.second !== null ? { "data-meaning": moment.second } : {})}
            {...(moment.second === "undo" ? { title: "Nimmt deine letzte Aktion zurück, etwa ein für Mana getapptes Land" } : {})}
            disabled={!second.enabled}
            reasonId={second.enabled ? undefined : offId}
            onSend={() => answer(question.id, buttonsAnswer(2))}
          >
            {buttonText(second)}
          </SendButton>
        )}
      </GameDecisionActions>
    </>
  )
}

/**
 * Declaring attackers (prompt 18). Instead of Forge's fixed sentence the
 * region says from Forge's declaration in progress whom a creature tapped
 * now attacks and who attacks so far; with several defenders (a planeswalker
 * or battle besides the player) they are buttons - a tap makes one the
 * defender (Forge's player.tap / card.tap, at once like its click). The
 * creatures Forge would not declare are named with Forge's reason. Forge's
 * buttons by their meaning: OK attacks with the declared creatures - or,
 * with none, leaves the attack out -, the second declares all (Alpha
 * Strike) or takes all back (Call Back). Creatures are declared by tapping
 * them on the table (a tap there is sent at once and taken back by a second).
 */
function AttackDecision({ view }: { view: AttackView }) {
  const { answer } = useDecision()
  const noteId = useId()
  const offId = useId()
  const { question, declare, second, attackers } = view
  const off = question.buttons.filter((button) => !button.enabled)
  const secondLabel = second === null ? null : second.meaning === "callBack" ? CALL_BACK_LABEL : buttonText(second.button)
  return (
    <>
      <DecisionHeading label={questionLabel(question)} text={attackText(view)} source={null} />
      {view.defenders.length > 1 ? <DefenderChoices view={view} /> : null}
      <GameDecisionNote>
        {view.ready > 0 ? `${view.ready === 1 ? "1 weitere Kreatur kann" : `${view.ready} weitere Kreaturen können`} angreifen (gold gestrichelt). ` : null}
        Antippen lässt eine Kreatur angreifen, ein zweiter Tipp nimmt sie zurück. Lange drücken oder Rechtsklick zeigt eine Karte groß.
      </GameDecisionNote>
      {view.unavailable.length > 0 ? (
        <GameDecisionNote data-attack-unavailable>
          Bleiben zurück: {view.unavailable.map(({ card, words }) => `${cardName(card)} (${words.short})`).join(", ")}.
        </GameDecisionNote>
      ) : null}
      <GameDecisionNote id={noteId}>{declareNote(attackers.length)}</GameDecisionNote>
      {off.length > 0 ? (
        <GameDecisionNote id={offId}>{off.length === 1 ? `„${buttonText(off[0]!)}“ hat Forge gerade abgeschaltet.` : "Forge hat beide Knöpfe gerade abgeschaltet."}</GameDecisionNote>
      ) : null}
      <BlockedNote />
      <GameDecisionActions role="group" aria-label="Antworten, die Forge anbietet">
        {declare !== null ? (
          <SendButton
            armKey={question.id}
            {...(declare.meaning !== undefined ? { "data-meaning": declare.meaning } : {})}
            disabled={!declare.enabled}
            reasonId={declare.enabled ? noteId : offId}
            onSend={() => answer(question.id, buttonsAnswer(1))}
          >
            {declare.meaning === "declare" ? declareLabel(attackers.length) : buttonText(declare)}
          </SendButton>
        ) : null}
        {second !== null ? (
          <SendButton
            armKey={question.id}
            variant="outline"
            data-meaning={second.meaning}
            disabled={!second.button.enabled}
            reasonId={second.button.enabled ? undefined : offId}
            onSend={() => answer(question.id, buttonsAnswer(2))}
          >
            {secondLabel}
          </SendButton>
        ) : (
          question.buttons
            .filter((button) => button.nr === 2)
            .map((button) => (
              <SendButton key={button.nr} armKey={question.id} variant="outline" disabled={!button.enabled} reasonId={button.enabled ? undefined : offId} onSend={() => answer(question.id, buttonsAnswer(2))}>
                {buttonText(button)}
              </SendButton>
            ))
        )}
      </GameDecisionActions>
    </>
  )
}

/**
 * The defenders Forge offers (prompt 18), as buttons: the one attacked now
 * pressed, the others make themselves the defender at once (Forge's
 * player.tap for a player, card.tap for a planeswalker or battle - like
 * tapping them on the table), guarded against a double press.
 */
function DefenderChoices({ view }: { view: AttackView }) {
  const { tapBlocked: blocked, blockedId, tapPlayer, tapCard } = useDecision()
  return (
    <GameDecisionActions role="group" aria-label="Wen greifst du an?" className="justify-start">
      {view.defenders.map((defender) => {
        const label = defenderLabel(defender)
        const key = `${defender.ref.kind}:${defender.ref.id}`
        // The defender attacked now: its mark to read (a tap would change nothing, so there is none to press).
        if (defender.current) {
          return (
            <GamePlayer key={key} data-defender={key} mark="selected" aria-label={`${label}, wird angegriffen`}>
              <span className="font-heading text-sm font-semibold">{defender.name}</span>
              {defender.detail !== null ? <span className="text-xs text-muted-foreground tabular-nums">{defender.detail}</span> : null}
            </GamePlayer>
          )
        }
        return (
          <GamePlayerButton
            key={key}
            data-defender={key}
            mark="usable"
            aria-label={`${label} – Antippen: als Angriffsziel wählen`}
            {...(blocked !== null ? { "aria-describedby": blockedId, title: blocked } : {})}
            disabled={blocked !== null}
            onKeyDown={(event) => {
              if (event.repeat) event.preventDefault()
            }}
            onClick={() => (defender.ref.kind === "player" ? tapPlayer(defender.ref.id) : tapCard(defender.ref.id))}
          >
            <span className="font-heading text-sm font-semibold">{defender.name}</span>
            {defender.detail !== null ? <span className="text-xs text-muted-foreground tabular-nums">{defender.detail}</span> : null}
          </GamePlayerButton>
        )
      })}
    </GameDecisionActions>
  )
}

function defenderLabel(defender: DefenderView): string {
  return defender.detail === null ? defender.name : `${defender.name}, ${defender.detail}`
}

/**
 * Forge's End Turn, only after asking (see PriorityDecision): the dialog says
 * what it gives away; its confirming button sends Forge's button. Opening it
 * sends nothing, so it needs no arming; while nothing can be sent it stays off.
 */
function EndTurnButton({ question, button, turn, reasonId }: { question: ButtonsQuestion; button: ForgeButton; turn: PriorityMoment["turn"]; reasonId: string | undefined }) {
  const { answer, blocked, blockedId } = useDecision()
  const [open, setOpen] = useState(false)
  const label = buttonText(button)
  const off = !button.enabled || blocked !== null
  const describedBy = [blocked !== null ? blockedId : null, reasonId ?? null].filter((id) => id !== null).join(" ")
  return (
    <AlertDialog open={open && !off} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="lg" variant="outline" data-meaning="endTurn" disabled={off} {...(describedBy ? { "aria-describedby": describedBy } : {})}>
          {label} …
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{endTurnText(turn)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Weiterspielen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={off} onClick={() => answer(question.id, buttonsAnswer(2))}>
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * The London mulligan: how many hand cards Forge marks for the bottom (its
 * highlight - the solid frame). How many it wants says Forge's prompt line;
 * its OK stays off until they match.
 */
function MulliganChosen() {
  const { state } = useDecision()
  const hand = state.players.find((player) => player.me)?.zones.hand ?? []
  const chosen = hand.filter((card) => !("hidden" in card) && card.highlighted === true).length
  return <GameDecisionNote>{chosen === 1 ? "1 Karte ausgewählt" : `${chosen} Karten ausgewählt`} (durchgezogener Rahmen).</GameDecisionNote>
}

/** Forge's two buttons with Forge's words; one Forge switched off stays visible, off, with the reason (above them: the buttons alone stick to the bottom). */
function ForgeButtons({ question }: { question: ButtonsQuestion }) {
  const { answer } = useDecision()
  const offId = useId()
  const off = question.buttons.filter((button) => !button.enabled)
  return (
    <>
      {off.length > 0 ? (
        <GameDecisionNote id={offId}>{off.length === 1 ? `„${buttonText(off[0]!)}“ hat Forge gerade abgeschaltet.` : "Forge hat beide Knöpfe gerade abgeschaltet."}</GameDecisionNote>
      ) : null}
      <GameDecisionActions role="group" aria-label="Antworten, die Forge anbietet">
        {question.buttons.map((button) => (
          <SendButton
            key={button.nr}
            armKey={question.id}
            variant={button.nr === 1 ? "default" : "outline"}
            disabled={!button.enabled}
            reasonId={button.enabled ? undefined : offId}
            onSend={() => answer(question.id, buttonsAnswer(button.nr))}
          >
            {buttonText(button)}
          </SendButton>
        ))}
      </GameDecisionActions>
    </>
  )
}

/**
 * The cards and players Forge names to select: how many in Forge's own
 * numbers (cards and players together), how many are chosen, which cards lie
 * on the table, a row of those the table does not show, and the players
 * Forge would take (prompt 17) - buttons like their seats on the table.
 */
function SelectPart({ question, view }: { question: SelectQuestion; view: SelectView }) {
  const { answer, state } = useDecision()
  if (view.rule === null) {
    return <GameDecisionNote>Forge bietet gerade weder eine Karte noch einen Spieler zur Wahl an – Forges Knöpfe führen weiter.</GameDecisionNote>
  }
  const parts = [`Wähle ${view.rule}`]
  if (view.chosen !== null) parts.push(`${view.chosen} gewählt`)
  if (view.onTable > 0) parts.push(view.onTable === 1 ? "1 Karte davon liegt auf dem Tisch (gold gestrichelt)" : `${view.onTable} Karten davon liegen auf dem Tisch (gold gestrichelt)`)
  const cards = visibleCardsById(state)
  return (
    <>
      <GameDecisionNote>{parts.join(" · ")}.</GameDecisionNote>
      {view.offTable.length > 0 ? (
        <ItemCards
          items={view.offTable}
          label="Wählbare Karten, die nicht auf dem Tisch liegen"
          direct
          markOf={(item) => (isVisibleItem(item) && item.card !== undefined && cards.get(item.card)?.highlighted === true ? "selected" : "usable")}
          describe={(item) => `${itemLabel(item, state)}, wählbar`}
          onPrimary={(nr) => answer(question.id, selectAnswer(nr))}
        />
      ) : null}
      {view.players.length > 0 ? <PlayerChoices players={view.players} label="Spieler, die Forge hier nimmt" /> : null}
    </>
  )
}

/**
 * Players as buttons (prompt 17): name and life with Forge's mark, a tap
 * sends Forge's player.tap at once (a second tap takes a chosen target back).
 * A player Forge has chosen but would not take back shows only the mark.
 */
function PlayerChoices({ players, label }: { players: readonly GameState["players"][number][]; label: string }) {
  const { moment, tapBlocked: blocked, blockedId, tapPlayer } = useDecision()
  return (
    <GameDecisionActions role="group" aria-label={label} className="justify-start">
      {players.map((player) => {
        const usage = { ...playerUse(player, moment), blocked }
        const name = seatName(player.me ? "me" : "opponent")
        return (
          <GamePlayerButton
            key={player.id}
            data-player-choice={player.id}
            mark={usage.mark}
            aria-label={playerButtonLabel(name, player.life, usage)}
            aria-pressed={player.highlighted === true}
            {...(blocked !== null ? { "aria-describedby": blockedId, title: blocked } : {})}
            disabled={usage.tap === null || blocked !== null}
            onKeyDown={(event) => {
              if (event.repeat) event.preventDefault()
            }}
            onClick={() => tapPlayer(player.id)}
          >
            <span className="font-heading text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{player.life} Leben</span>
          </GamePlayerButton>
        )
      })}
    </GameDecisionActions>
  )
}

/**
 * Forge's payment in progress (prompt 17): what is still to pay in Forge's
 * mana symbols (spoken as words), the floating mana Forge would take from the
 * pool - a button per colour, it pays at once (mana.use) - and, for
 * Phyrexian mana, the player's life (their seat, Forge's player.tap). Mana
 * sources on the table are tapped there (gold dashed). Forge's Cancel takes
 * the whole payment back.
 */
function PaymentPart() {
  const { state } = useDecision()
  const view = paymentView(state)
  if (view === null) return null
  // Only where Forge marks mana sources of the player's (its payment's highlight).
  const sources = state.players.some((player) => player.me && player.zones.battlefield.some((card) => !("hidden" in card) && card.playable === true))
  return (
    <>
      <GameDecisionNote>
        Noch zu zahlen: <span className="font-medium text-foreground tabular-nums" aria-hidden>{view.cost}</span>
        <span className="sr-only">{manaSymbolsText(view.cost)}</span>.{sources ? " Manaquellen auf dem Tisch (gold gestrichelt) bezahlen beim Antippen." : null}
      </GameDecisionNote>
      {view.pool.length > 0 ? <PoolChoices view={view} /> : null}
      {view.life !== null ? <PlayerChoices players={[view.life]} label="Mit Leben statt Mana bezahlen" /> : null}
    </>
  )
}

/** Floating mana Forge would pay with now: one button per colour (mana.use), guarded against a double press. */
function PoolChoices({ view }: { view: PaymentView }) {
  const { tapBlocked: blocked, blockedId, payWithMana } = useDecision()
  const last = useRef<{ readonly color: ManaColor; readonly at: number } | null>(null)
  return (
    <GameDecisionActions role="group" aria-label="Aus deinem Manavorrat bezahlen" className="justify-start">
      {view.pool.map(({ color, amount }) => (
        <Button
          key={color}
          size="lg"
          variant="outline"
          data-mana={color}
          disabled={blocked !== null}
          {...(blocked !== null ? { "aria-describedby": blockedId, title: blocked } : {})}
          onKeyDown={(event) => {
            if (event.repeat) event.preventDefault()
          }}
          onClick={() => {
            const now = performance.now()
            const previous = last.current
            if (previous !== null && previous.color === color && now - previous.at < ARMING_MS) return
            last.current = { color, at: now }
            payWithMana(color)
          }}
        >
          {MANA_LABELS[color]} aus dem Vorrat{amount > 0 ? ` (${amount})` : ""}
        </Button>
      ))}
    </GameDecisionActions>
  )
}

function visibleCardsById(state: GameState): ReadonlyMap<number, VisibleCard> {
  const cards = new Map<number, VisibleCard>()
  for (const player of state.players) {
    const { battlefield, hand, graveyard, exile, command } = player.zones
    for (const card of [...battlefield, ...hand, ...graveyard, ...exile, ...command]) if (!("hidden" in card)) cards.set(card.id, card)
  }
  return cards
}

// ── Blocking questions ─────────────────────────────────────────────────────

function BlockingDecision({ question }: { question: BlockingQuestion }) {
  const body = (() => {
    switch (question.kind) {
      case "choose":
        return <ChooseBody question={question} />
      case "confirm":
        return <ConfirmBody question={question} />
      case "options":
        return <OptionsBody question={question} />
      case "input":
        return <InputBody question={question} />
      case "order":
        return <OrderBody question={question} />
      case "arrange":
        return <ArrangeBody question={question} />
      case "distribute":
        return <DistributeBody question={question} />
    }
  })()
  return (
    <>
      <DecisionHeading label={questionLabel(question)} text={question.text.trim() ? question.text : null} source={sourceOf(question)} />
      {body}
    </>
  )
}

/** The note under a list that says why its button is off (and is what the button points to). */
function CheckNote({ id, reason }: { id: string; reason: string | null }) {
  return reason === null ? null : (
    <GameDecisionNote id={id} role="status">
      {reason}
    </GameDecisionNote>
  )
}

function ChooseBody({ question }: { question: ChooseQuestion }) {
  const { answer, state } = useDecision()
  const [chosen, setChosen] = useState<readonly number[]>(() => initialChoice(question))
  const check = checkChoose(question, chosen)
  const reasonId = useId()
  const count = question.items.length
  const rule = `Wähle ${countRule(question.min, question.max, count)} · ${chosen.length} gewählt`
  const toggle = (nr: number) => setChosen((previous) => toggleChoice(previous, nr, question.max))
  const full = question.max > 1 && chosen.length >= question.max
  return (
    <>
      <GameDecisionNote>{rule}</GameDecisionNote>
      {cardItems(question.items) ? (
        <ItemCards
          items={question.items}
          label="Karten zur Wahl"
          markOf={(item) => (chosen.includes(item.nr) ? "selected" : "usable")}
          describe={(item) => `${itemLabel(item, state)}${chosen.includes(item.nr) ? ", ausgewählt" : ""}`}
          onPrimary={toggle}
        />
      ) : question.max === 1 ? (
        <SingleChoiceList items={question.items} value={chosen[0] ?? null} onChange={(nr) => setChosen([nr])} label={question.text || "Wahl"} />
      ) : (
        <MultiChoiceList items={question.items} chosen={chosen} full={full} onToggle={toggle} />
      )}
      <CheckNote id={reasonId} reason={check.reason} />
      <BlockedNote />
      <GameDecisionActions>
        <SendButton armKey={question.id} disabled={!check.ok} reasonId={check.ok ? undefined : reasonId} onSend={() => answer(question.id, chooseAnswer(chosen))}>
          {chosen.length === 0 && question.min === 0 ? "Nichts wählen" : "Bestätigen"}
        </SendButton>
      </GameDecisionActions>
    </>
  )
}

/** One of a list (choice cards with a radio each); a long list gets a search field. */
function SingleChoiceList({ items, value, onChange, label }: { items: readonly Item[]; value: number | null; onChange: (nr: number) => void; label: string }) {
  const { state } = useDecision()
  const { field, shown, note } = useSearch(items, (item) => itemLabel(item, state))
  return (
    <>
      {field}
      <RadioGroup value={value === null ? "" : String(value)} onValueChange={(next) => onChange(Number(next))} aria-label={label} className="gap-2">
        {shown.map((item) => (
          <ChoiceOption key={item.nr} item={item}>
            {(id, titleId) => <RadioGroupItem value={String(item.nr)} id={id} aria-labelledby={titleId} />}
          </ChoiceOption>
        ))}
      </RadioGroup>
      {note !== null ? <GameDecisionNote>{note}</GameDecisionNote> : null}
    </>
  )
}

/** Several of a list (choice cards with a checkbox each); at the maximum the others wait until one is taken back. */
function MultiChoiceList({ items, chosen, full, onToggle }: { items: readonly Item[]; chosen: readonly number[]; full: boolean; onToggle: (nr: number) => void }) {
  const { state } = useDecision()
  const { field, shown, note } = useSearch(items, (item) => itemLabel(item, state))
  return (
    <>
      {field}
      <div role="group" aria-label="Wahl" className="flex flex-col gap-2">
        {shown.map((item) => {
          const checked = chosen.includes(item.nr)
          return (
            <ChoiceOption key={item.nr} item={item}>
              {(id, titleId) => <Checkbox id={id} aria-labelledby={titleId} checked={checked} disabled={full && !checked} onCheckedChange={() => onToggle(item.nr)} />}
            </ChoiceOption>
          )
        })}
      </div>
      {note !== null ? <GameDecisionNote>{note}</GameDecisionNote> : null}
    </>
  )
}

/** A choice card: the item's words (and its card's picture, which opens the card view), the control on the right. */
function ChoiceOption({ item, children }: { item: Item; children: (id: string, titleId: string) => ReactNode }) {
  const { state } = useDecision()
  const id = useId()
  const titleId = `${id}-title`
  return (
    <div className="flex items-center gap-2">
      {hasThumb(item) ? (
        <div className="h-14 shrink-0">
          <ItemThumb item={item} />
        </div>
      ) : null}
      <FieldLabel htmlFor={id} className="flex-1 *:data-[slot=field]:p-3">
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle id={titleId} className="w-auto break-words">
              {itemLabel(item, state)}
            </FieldTitle>
          </FieldContent>
          {children(id, titleId)}
        </Field>
      </FieldLabel>
    </div>
  )
}

function ConfirmBody({ question }: { question: ConfirmQuestion }) {
  const { answer } = useDecision()
  const labels = confirmLabels(question)
  return (
    <>
      <BlockedNote />
      <GameDecisionActions role="group" aria-label="Antworten, die Forge anbietet">
        <SendButton armKey={question.id} variant={question.suggested ? "default" : "outline"} onSend={() => answer(question.id, confirmAnswer(true))}>
          {labels.yes}
        </SendButton>
        <SendButton armKey={question.id} variant={question.suggested ? "outline" : "default"} onSend={() => answer(question.id, confirmAnswer(false))}>
          {labels.no}
        </SendButton>
      </GameDecisionActions>
    </>
  )
}

function OptionsBody({ question }: { question: OptionsQuestion }) {
  const { answer, state } = useDecision()
  const [option, setOption] = useState<number | null>(() => initialOption(question))
  const reasonId = useId()
  if (question.revealed !== undefined) {
    // A list Forge only shows: look at it, then Forge's one button (its OK).
    const revealed = question.revealed
    return (
      <>
        {revealed.length === 0 ? (
          <GameDecisionNote>Forge zeigt nichts (die Liste ist leer).</GameDecisionNote>
        ) : cardItems(revealed) ? (
          <ItemCards items={revealed} label="Was Forge zeigt" markOf={() => null} describe={(item) => itemLabel(item, state)} onPrimary={null} />
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {revealed.map((item) => (
              <li key={item.nr}>{itemLabel(item, state)}</li>
            ))}
          </ul>
        )}
        <BlockedNote />
        <GameDecisionActions>
          {question.items.map((item) => (
            <SendButton key={item.nr} armKey={question.id} onSend={() => answer(question.id, optionsAnswer(item.nr))}>
              {itemLabel(item, state)}
            </SendButton>
          ))}
        </GameDecisionActions>
      </>
    )
  }
  const reason = option === null ? "Wähle eine Möglichkeit." : null
  return (
    <>
      {cardItems(question.items) ? (
        <ItemCards
          items={question.items}
          label="Möglichkeiten"
          markOf={(item) => (item.nr === option ? "selected" : "usable")}
          describe={(item) => `${itemLabel(item, state)}${item.nr === option ? ", ausgewählt" : ""}`}
          onPrimary={(nr) => setOption(nr)}
        />
      ) : (
        <SingleChoiceList items={question.items} value={option} onChange={setOption} label={question.text || "Möglichkeiten"} />
      )}
      <CheckNote id={reasonId} reason={reason} />
      <BlockedNote />
      <GameDecisionActions>
        <SendButton armKey={question.id} disabled={option === null} reasonId={option === null ? reasonId : undefined} onSend={() => option !== null && answer(question.id, optionsAnswer(option))}>
          Bestätigen
        </SendButton>
        {question.cancellable === true ? (
          <SendButton armKey={question.id} variant="outline" onSend={() => answer(question.id, optionsAnswer(0))}>
            Abbrechen
          </SendButton>
        ) : null}
      </GameDecisionActions>
    </>
  )
}

function InputBody({ question }: { question: InputQuestion }) {
  const { answer, blocked, blockedId, state } = useDecision()
  const [value, setValue] = useState(() => initialInput(question))
  const check = checkInput(question, value)
  const id = useId()
  const reasonId = `${id}-reason`
  const armedAt = useRef<number | null>(null)
  useEffect(() => {
    armedAt.current = performance.now()
  }, [question.id])
  const send = () => {
    const at = armedAt.current
    if (!check.ok || blocked !== null || at === null || performance.now() - at < ARMING_MS) return
    answer(question.id, inputAnswer(question, value))
  }
  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <Field data-invalid={!check.ok || undefined}>
        <FieldLabel htmlFor={id}>{question.numeric ? "Deine Zahl" : "Deine Antwort"}</FieldLabel>
        <Input
          id={id}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          {...(question.numeric ? { inputMode: "numeric" as const } : {})}
          autoComplete="off"
          aria-invalid={!check.ok}
          {...(check.ok ? {} : { "aria-describedby": reasonId })}
        />
        {question.items !== undefined && question.items.length > 0 ? (
          <FieldDescription>Forges Vorschläge übernehmen den Wert ins Feld; gesendet wird erst mit „Bestätigen“.</FieldDescription>
        ) : null}
      </Field>
      {question.items !== undefined && question.items.length > 0 ? (
        <div role="group" aria-label="Forges Vorschläge" className="flex flex-wrap gap-2">
          {question.items.map((item) => {
            const text = itemLabel(item, state)
            return (
              <Button key={item.nr} type="button" variant="outline" aria-pressed={value === text} onClick={() => setValue(text)}>
                {text}
              </Button>
            )
          })}
        </div>
      ) : null}
      <CheckNote id={reasonId} reason={check.reason} />
      <BlockedNote />
      <GameDecisionActions>
        <Button
          type="submit"
          size="lg"
          disabled={!check.ok || blocked !== null}
          {...(!check.ok || blocked !== null ? { "aria-describedby": [check.ok ? null : reasonId, blocked === null ? null : blockedId].filter((id) => id !== null).join(" ") } : {})}
          onKeyDown={(event) => event.repeat && event.preventDefault()}
        >
          Bestätigen
        </Button>
      </GameDecisionActions>
    </form>
  )
}

/** A row of a list with a card's picture (if it is a card), its words and its controls. */
function ListRow({ item, position, children }: { item: Item; position?: number; children: ReactNode }) {
  const { state } = useDecision()
  return (
    <ItemRow asChild variant="outline" size="xs">
      <li>
        {position !== undefined ? (
          <Badge variant="secondary" className="tabular-nums" aria-hidden>
            {position}
          </Badge>
        ) : null}
        {hasThumb(item) ? (
          <ItemMedia className="h-14">
            <ItemThumb item={item} />
          </ItemMedia>
        ) : null}
        {/* The words keep room for a name; the controls go below them where the row is narrow. */}
        <ItemContent className="min-w-32">
          <ItemTitle className="break-words">
            {position !== undefined ? <span className="sr-only">{position}. </span> : null}
            {itemLabel(item, state)}
          </ItemTitle>
        </ItemContent>
        <ItemActions>{children}</ItemActions>
      </li>
    </ItemRow>
  )
}

function MoveButtons({ name, index, length, onMove }: { name: string; index: number; length: number; onMove: (delta: number) => void }) {
  return (
    <>
      <Button type="button" variant="outline" size="icon" aria-label={`${name} nach oben`} disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp aria-hidden />
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label={`${name} nach unten`} disabled={index === length - 1} onClick={() => onMove(1)}>
        <ArrowDown aria-hidden />
      </Button>
    </>
  )
}

function OrderBody({ question }: { question: OrderQuestion }) {
  const { answer, state } = useDecision()
  const rule = orderRule(question)
  const [order, setOrder] = useState<readonly number[]>(() => initialOrder(question))
  const check = checkOrder(question, order)
  const reasonId = useId()
  const byNr = new Map(question.items.map((item) => [item.nr, item]))
  const rest = question.items.filter((item) => !order.includes(item.nr))
  const count = question.items.length
  const ruleText = rule.all ? `Lege die Reihenfolge aller ${count} fest.` : `Wähle ${countRule(rule.pickMin, rule.pickMax, count)} und lege ihre Reihenfolge fest · ${order.length} gewählt.`
  return (
    <>
      <GameDecisionNote>
        {ruleText}
        {question.top?.trim() ? ` Platz 1: ${question.top.trim()}.` : null}
      </GameDecisionNote>
      <section aria-label="Reihenfolge" className="flex flex-col gap-1">
        {order.length === 0 ? (
          <GameDecisionNote>Noch nichts gewählt.</GameDecisionNote>
        ) : (
          <ol className="flex flex-col gap-1">
            {order.map((nr, index) => {
              const item = byNr.get(nr)
              if (item === undefined) return null
              const name = itemLabel(item, state)
              return (
                <ListRow key={nr} item={item} position={index + 1}>
                  <MoveButtons name={name} index={index} length={order.length} onMove={(delta) => setOrder((previous) => moveEntry(previous, index, delta))} />
                  {rule.all ? null : (
                    <Button type="button" variant="outline" size="icon" aria-label={`${name} herausnehmen`} onClick={() => setOrder((previous) => previous.filter((other) => other !== nr))}>
                      <X aria-hidden />
                    </Button>
                  )}
                </ListRow>
              )
            })}
          </ol>
        )}
      </section>
      {rule.all || rest.length === 0 ? null : (
        <section aria-label="Übrig" className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Übrig</p>
          <ul className="flex flex-col gap-1">
            {rest.map((item) => (
              <ListRow key={item.nr} item={item}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`${itemLabel(item, state)} hinzufügen`}
                  disabled={order.length >= rule.pickMax}
                  onClick={() => setOrder((previous) => [...previous, item.nr])}
                >
                  <Plus aria-hidden />
                </Button>
              </ListRow>
            ))}
          </ul>
        </section>
      )}
      <CheckNote id={reasonId} reason={check.reason} />
      <BlockedNote />
      <GameDecisionActions>
        <SendButton armKey={question.id} disabled={!check.ok} reasonId={check.ok ? undefined : reasonId} onSend={() => answer(question.id, orderAnswer(order))}>
          Bestätigen
        </SendButton>
        <Button type="button" size="lg" variant="outline" onClick={() => setOrder(initialOrder(question))}>
          Zurücksetzen
        </Button>
      </GameDecisionActions>
    </>
  )
}

const SIDE_TITLES: Readonly<Record<PileSide, string>> = {
  top: "Oben – die erste liegt ganz oben",
  bottom: "Unten – die letzte liegt ganz unten",
}

function ArrangeBody({ question }: { question: ArrangeQuestion }) {
  const { answer, state } = useDecision()
  const [arrangement, setArrangement] = useState<Arrangement>(() => initialArrangement(question))
  const check = checkArrangement(question, arrangement)
  const reasonId = useId()
  const byNr = new Map(question.items.map((item) => [item.nr, item]))
  const both = question.toTop && question.toBottom
  const side = (which: PileSide) => {
    const list = which === "top" ? arrangement.top : arrangement.bottom
    return (
      <section aria-label={SIDE_TITLES[which]} className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{SIDE_TITLES[which]}</p>
        {list.length === 0 ? (
          <GameDecisionNote>Keine Karte.</GameDecisionNote>
        ) : (
          <ol className="flex flex-col gap-1">
            {list.map((nr, index) => {
              const item = byNr.get(nr)
              if (item === undefined) return null
              const name = itemLabel(item, state)
              const other: PileSide = which === "top" ? "bottom" : "top"
              return (
                <ListRow key={nr} item={item} position={index + 1}>
                  <MoveButtons
                    name={name}
                    index={index}
                    length={list.length}
                    onMove={(delta) =>
                      setArrangement((previous) => (which === "top" ? { ...previous, top: moveEntry(previous.top, index, delta) } : { ...previous, bottom: moveEntry(previous.bottom, index, delta) }))
                    }
                  />
                  {both ? (
                    // The name starts with the words on the button (WCAG 2.5.3), then says which card.
                    <Button type="button" variant="outline" aria-label={`${other === "top" ? "Nach oben" : "Nach unten"} (${name})`} onClick={() => setArrangement((previous) => moveToSide(previous, nr, other))}>
                      {other === "top" ? "Nach oben" : "Nach unten"}
                    </Button>
                  ) : null}
                </ListRow>
              )
            })}
          </ol>
        )}
      </section>
    )
  }
  return (
    <>
      {question.toTop ? side("top") : null}
      {question.others > 0 ? <GameDecisionNote className="text-center">… dazwischen {question.others === 1 ? "1 weitere Karte" : `${question.others.toLocaleString("de-DE")} weitere Karten`}, die bleiben, wo sie sind …</GameDecisionNote> : null}
      {question.toBottom ? side("bottom") : null}
      <CheckNote id={reasonId} reason={check.reason} />
      <BlockedNote />
      <GameDecisionActions>
        <SendButton armKey={question.id} disabled={!check.ok} reasonId={check.ok ? undefined : reasonId} onSend={() => answer(question.id, arrangeAnswer(arrangement))}>
          Bestätigen
        </SendButton>
        <Button type="button" size="lg" variant="outline" onClick={() => setArrangement(initialArrangement(question))}>
          Zurücksetzen
        </Button>
      </GameDecisionActions>
    </>
  )
}

function DistributeBody({ question }: { question: DistributeQuestion }) {
  const { answer, state } = useDecision()
  const [amounts, setAmounts] = useState<readonly number[]>(() => initialAmounts(question))
  const check = checkDistribution(question, amounts)
  const reasonId = useId()
  const status = `${check.sum} von ${question.total} verteilt${check.open > 0 ? ` · noch ${check.open} offen` : ""}${question.min > 0 ? ` · jedes Ziel mindestens ${question.min}` : ""}`
  return (
    <>
      <GameDecisionNote role="status">{status}</GameDecisionNote>
      <ul className="flex flex-col gap-1">
        {question.items.map((item, index) => {
          const name = itemLabel(item, state)
          const amount = amounts[index] ?? question.min
          return (
            <ListRow key={item.nr} item={item}>
              <Button type="button" variant="outline" size="icon" aria-label={`Bei ${name} einen weniger`} disabled={amount <= question.min} onClick={() => setAmounts((previous) => changeAmount(question, previous, index, -1))}>
                <Minus aria-hidden />
              </Button>
              <output className="min-w-8 text-center text-base font-semibold tabular-nums" aria-label={`${name}: ${amount}`}>
                {amount}
              </output>
              <Button type="button" variant="outline" size="icon" aria-label={`Bei ${name} einen mehr`} disabled={check.open <= 0} onClick={() => setAmounts((previous) => changeAmount(question, previous, index, 1))}>
                <Plus aria-hidden />
              </Button>
            </ListRow>
          )
        })}
      </ul>
      <CheckNote id={reasonId} reason={check.reason} />
      <BlockedNote />
      <GameDecisionActions>
        <SendButton armKey={question.id} disabled={!check.ok} reasonId={check.ok ? undefined : reasonId} onSend={() => answer(question.id, distributeAnswer(amounts))}>
          Bestätigen
        </SendButton>
      </GameDecisionActions>
    </>
  )
}
