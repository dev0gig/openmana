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
 */
import { ArrowDown, ArrowUp, Minus, Plus, Search, X } from "lucide-react"
import { createContext, use, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react"
import type {
  AnswerBody,
  ArrangeQuestion,
  ButtonsQuestion,
  ChooseQuestion,
  ConfirmQuestion,
  DistributeQuestion,
  GameState,
  InputQuestion,
  Item,
  OptionsQuestion,
  OrderQuestion,
  Question,
  SelectQuestion,
  VisibleCard,
} from "@openmana/engine-protocol"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { GameCardBack, GameCardButton, GameCardRow, GameCardRowButton, GameCardRowItem, type GameCardMark } from "@/components/ui/game-card"
import { GameDecision, GameDecisionActions, GameDecisionHeader, GameDecisionNote, GameDecisionRow, GameDecisionSource } from "@/components/ui/game-decision"
import { Input } from "@/components/ui/input"
import { Item as ItemRow, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { useCardPress } from "@/hooks/use-card-press"
import { ARMING_MS } from "./card-sheet"
import { directTaps } from "./card-use"
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
  selectAnswer,
  selectView,
  toggleChoice,
  type Arrangement,
  type BlockingQuestion,
  type Decision,
  type PileSide,
  type SelectView,
} from "./decision-model"
import { questionLabel } from "./game-labels"
import type { TableCardLookup } from "./table-cards"
import { cardName } from "./table-labels"
import { TablePicture } from "./table-picture"

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

export function DecisionPanel({ state, questions, prompt, waiting, conceding, pictures, alerts, onAnswer, onLook }: DecisionPanelProps) {
  const decision = currentDecision(questions)
  const blocked = answerBlocked({ live: onAnswer !== undefined, conceding, waiting })
  const blockedId = useId()
  const context = useMemo<DecisionContextValue>(
    () => ({ state, pictures, blocked, blockedId, answer: onAnswer ?? (() => undefined), look: onLook }),
    [state, pictures, blocked, blockedId, onAnswer, onLook],
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
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner aria-hidden />
              Forge rechnet …
            </p>
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
        {/* New decisions are announced (the priority of every step is not: "Du bist dran" says it). */}
        <p className="sr-only" aria-live="polite">
          {question === null || (question.kind === "buttons" && question.purpose === "priority") ? "" : `Forge fragt: ${questionLabel(question)}`}
        </p>
      </GameDecision>
    </DecisionContext>
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
      {buttons?.purpose === "mulliganBottom" ? <MulliganChosen /> : null}
      {directTaps(open) ? <GameDecisionNote>Karten antippen wirkt hier sofort, ein zweiter Tipp nimmt es zurück. Lange drücken oder Rechtsklick zeigt eine Karte groß.</GameDecisionNote> : null}
      <BlockedNote />
      {buttons !== null ? <ForgeButtons question={buttons} /> : null}
    </>
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

/** The cards Forge names to select: how many, which lie on the table, and a row of those the table does not show. */
function SelectPart({ question, view }: { question: SelectQuestion; view: SelectView }) {
  const { answer, state } = useDecision()
  if (view.noCard) {
    return (
      <GameDecisionNote>
        Forge bietet keine Karte zur Wahl an – gewählt wird hier ein Spieler. Einen Spieler zu wählen geht in OpenMana noch nicht; mit „Abbrechen“ geht es weiter.
      </GameDecisionNote>
    )
  }
  const parts = [`Wähle ${view.rule}`]
  if (view.chosen !== null) parts.push(`${view.chosen} gewählt`)
  if (view.onTable > 0) parts.push(view.onTable === 1 ? "1 davon liegt auf dem Tisch (gold gestrichelt)" : `${view.onTable} davon liegen auf dem Tisch (gold gestrichelt)`)
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
    </>
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
