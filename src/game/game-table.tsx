/*
 * The game table (prompt 13): Forge's full state as a table with fixed
 * regions - the opponent with their hand, the opponent's battlefield, stack
 * and combat, your battlefield, you, Forge's decision, your hand - that fill
 * the screen on a phone, a foldable, a tablet and a desktop (GameBoard) and
 * never turn into one endless vertical page (Bible §6). What does not fit
 * scrolls inside its region: card rows sideways, texts downwards.
 *
 * Only a view: it shows one state (the latest one of a running game, later a
 * recorded one) and never acts. Everything comes from Forge's structured
 * state and questions (table-model.ts): seats from `me`, cards by their ids,
 * what is hidden stays a back (Forge's mayView), nothing is computed or
 * decided here - no legality, no summing up, no guessing. Forge's own texts
 * (prompt line, questions, stack descriptions) are shown as Forge sends
 * them. Card pictures come from the card catalog (table-cards.ts); without
 * one the table shows Forge's words for the card.
 *
 * Cards (prompt 14): every card the player may see is a control. Looking at
 * it is always safe - its primary activation or a long press / right click
 * opens the card view (card-view.tsx, full screen since prompt 47), which sends nothing. A tap (Forge's
 * card.tap) comes only from the page (onTapCard) and only where Forge offers
 * one (card-use.ts): as the card view's button, or at once in the steps whose
 * taps Forge lets the player take back (paying, attacking, blocking, the
 * London mulligan, a selection). Forge's markers show as a frame around the
 * picture (usable, chosen), never on it.
 *
 * Forge's decisions (prompt 15): the decision region (the action bar below the
 * hand in hoch, the column beside the battlefields otherwise - prompt 38)
 * shows what Forge asks and lets the player answer it (decision-panel.tsx) - the
 * page sends the answers (onAnswer), like the taps. A decision that needs
 * room gets it (GameBoard decision="expanded"); a card of a question that
 * lies in no zone of the table opens the card view as the question shows it.
 *
 * Priority, stack and phases (prompt 16): the header says whose turn it is
 * and Forge's step in words (the steps as a picture: the Phasen-Tafel since
 * prompt 41); the stack shows each item with its card (a spell's own card
 * lies on the stack), what it is, whose it is and its targets, top first -
 * its picture opens the card view. The player's priority is the decision
 * region's (decision-panel.tsx): what it is about in words, Forge's OK as
 * "Weiter" or "Verrechnen lassen". Cards are played by tapping them, as
 * always - never through a question the app makes up.
 *
 * The surface (prompt 37, table/table-surface.tsx): a wooden desk with the
 * board set into it lies behind the regions - decoration, redrawn only when a
 * size changes, never by a new state.
 *
 * The layouts (prompt 38): GameBoard arranges the regions by the window's
 * aspect ratio - hoch, quadrat, breit (docs/design/SPIELTISCH.md §3) -, and
 * the Sheets come from the bottom in hoch, from the side otherwise
 * (table/use-table-layout.ts). A new size only changes the arrangement,
 * never the game.
 *
 * Cards on the battlefield (prompt 40, table/card-parts.tsx, table.css):
 * Forge's power/toughness or loyalty on a plaque on the card's printed value
 * box - the one thing on a picture -, every other fact as a chip above it,
 * piles as cards behind each other with "×N", Forge's marks and combat as
 * frames and glows; a row sizes its cards by its height and width and scrolls
 * only below the minimum.
 *
 * The Zauberchronik and the Phasen-Tafel (prompt 41, table/chronicle.tsx,
 * table/phase-panel.tsx): stack and combat on a panel of the table, the turn's
 * phases moved from the header into the decision region - its panel in
 * quadrat and breit, the action bar in hoch with the compact phases beside the
 * main button.
 *
 * The hand (prompt 42, FannedHand below, table/hand-fan.ts): a fan of
 * cards side by side (never overlapping, since 2026-10-12); the card under the mouse, a swiping thumb or the
 * keyboard's focus rises whole above it; a tap is the lifted card's, a swipe
 * nothing, a long press looks (useFanPress).
 *
 * The arrows (prompt 43, table/table-arrows.tsx, table/arrows.ts): over the
 * board, from a Zauberchronik entry to its targets, from an attacker to whom it
 * attacks, from a blocker to its attacker - Forge's facts as a picture, never in
 * the way of an input.
 *
 * The motion (prompt 44, table/table-motion.tsx, table/motion-plan.ts): a
 * card travels to its new place (the same id), turns when tapped, moves
 * forward to attack; damage and life totals react, Zauberchronik entries glide
 * in and dissolve, the phases' gold glides on, the main button shimmers at a
 * new priority - over the new state, which is usable at once; nothing moves
 * under less motion.
 *
 * Targets and payment (prompt 17): a player Forge's running input would take
 * - a target, a choice, the one paying life for Phyrexian mana - is a control
 * too: their name and life total carry Forge's mark and tap at once
 * (onTapPlayer, Forge's player.tap), like the cards of a selection. The card
 * the running step is about (the spell being cast, an ability's source) says
 * so in a chip above its picture ("Quelle"). The decision region shows the payment:
 * what is still to pay, floating mana to pay with (onUseMana).
 */
import { CircleSlash, Crosshair, Crown, Layers, Pause, ScrollText, Shield, Swords } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"
import { createContext, use, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import type { AnswerBody, Card, GameEvent, GameState, ManaColor, Question, VisibleCard } from "@openmana/engine-protocol"
import { Badge } from "@/components/ui/badge"
import { GameBoard, GameBoardArea, type GameBoardDecision } from "@/components/ui/game-board"
import { GameCard, GameCardButton, GameCardCaption, GameCardGroup, GameCardRow, GameCardRowButton, GameCardRowItem } from "@/components/ui/game-card"
import { GameHelpButton } from "@/components/ui/game-help-button"
import { GameZoneButton } from "@/components/ui/game-zone-button"
import { GamePlayer, GamePlayerButton } from "@/components/ui/game-player"
import { Spinner } from "@/components/ui/spinner"
import { useCardPress, useFanPress } from "@/hooks/use-card-press"
import { useElementHeight } from "@/hooks/use-element-height"
import { useElementSize } from "@/hooks/use-element-size"
import { ARMING_MS, CardView, type CardLook } from "./card-view"
import { handOf, questionCard, type CardBrowse } from "./card-view-model"
import { HelpSheet } from "./help-sheet"
import { nextStartHandMemory, pastStart, START_HAND_MEMORY, startHandKey, startHandOpen, startQuestion, type StartHandMemory } from "./start-hand"
import { StartHandView } from "./start-hand-view"
import { STACK_TARGET_LABEL, stackTargetIds } from "./beginner-help"
import { HistorySheet } from "./history-sheet"
import { ZoneSheet, type ZoneLook } from "./zone-sheet"
import { cardDrop, cardUse, currentStep, momentLands, openSelection, playerUse, stepSource, type CardPlace, type CardUse, type TableMoment } from "./card-use"
import { currentDecision } from "./decision-model"
import { DecisionPanel, decisionNeedsRoom } from "./decision-panel"
import { aiProfileLabel, phaseLabel } from "./game-labels"
import { landPlayFact, type LandPlayFact } from "./land-labels"
import { turnOwnerLabel } from "./priority-labels"
import type { TableCardLookup } from "./table-cards"
import {
  cardButtonLabel,
  cardFacts,
  cardName,
  chipFacts,
  damageLabel,
  counterLabel,
  MANA_LABELS,
  placeLabel,
  plaqueValue,
  playerButtonLabel,
  seatName,
  SOURCE_LABEL,
} from "./table-labels"
import { pileOf, isVisible, tableView, type BoardEntry, type Seat, type TableSide } from "./table-model"
import { HAND_PICTURE_SIZES, TablePicture } from "./table-picture"
import { CardChip, rowSize, SickChip, ValuePlaque } from "./table/card-parts"
import { Chronicle } from "./table/chronicle"
import { handFan, restingCardAt } from "./table/hand-fan"
import { LastMoveLine } from "./table/opponent-stage"
import { PhasePanel } from "./table/phase-panel"
import { TableArrows } from "./table/table-arrows"
import { HandDrag, TableMotion } from "./table/table-motion"
import { TableArt, TableCardBack, TableEmblem } from "./table/table-art"
import { MedallionFace, StripChip, ZoneCount, ZoneCounter, ZonePile } from "./table/strip-parts"
import { TableSurface } from "./table/table-surface"
import { useTableLayout } from "./table/use-table-layout"

/** Below this height a battlefield shows its cards in one row instead of two (px, measured). */
const TWO_ROWS_MIN_HEIGHT = 176
const EMPTY_HISTORY: readonly GameEvent[] = []

export interface GameTableProps {
  readonly replay?: boolean
  readonly state: GameState
  /**
   * Animate the change to this state (prompt 44, table/table-motion.tsx; the
   * default). A replay passes false when it jumps over several steps: then the
   * table changes at once.
   */
  readonly animate?: boolean
  readonly history?: readonly GameEvent[]
  /** The questions Forge asks right now. */
  readonly questions: readonly Question[]
  /** Forge's instruction line for the current decision (null: none). */
  readonly prompt: string | null
  /** Forge waits for the player (not computing). */
  readonly waiting: boolean
  /** The AI profile Forge confirmed for this game (game.started). */
  readonly aiProfile: string
  /** The profile was drawn at random for this game. */
  readonly profileDrawn?: boolean
  readonly pictures: TableCardLookup
  /** The header's menu (the way around the app, conceding): the table itself never acts. */
  readonly menu: ReactNode
  /** Shown at the top of the decision region (a silent engine, a concession on its way). */
  readonly alerts?: ReactNode
  /** The concession is on its way. */
  readonly conceding?: boolean
  /**
   * Taps a card for the player (Forge's card.tap - the page sends it). Absent:
   * the table is only looked at (a replay): cards can be looked at, never tapped.
   */
  readonly onTapCard?: (id: number) => void
  /**
   * Answers one of Forge's questions for the player (the page sends it,
   * prompt 15). Absent: the table is only looked at - Forge's questions are
   * shown, never answered.
   */
  readonly onAnswer?: (question: number, body: AnswerBody) => void
  /**
   * Taps a player for the player (Forge's player.tap - the page sends it,
   * prompt 17): a target, a choice, life for mana. Absent: only looked at.
   */
  readonly onTapPlayer?: (player: number) => void
  /** Pays with floating mana of a colour during Forge's payment (mana.use - the page sends it, prompt 17). Absent: only looked at. */
  readonly onUseMana?: (color: ManaColor) => void
  /**
   * Prompt 49: the opponent's action the engine holds for looking (the page's
   * OpponentStage, table/opponent-stage.tsx) - a compact announcement between the battlefields, after
   * the hand and before the decision in the focus order. Absent: none.
   */
  readonly stage?: ReactNode
  /**
   * 2026-10-14: the latest move of either player in words (lastMoveText) for
   * the quiet "Zuletzt" line - on the centre line beside the side columns,
   * in place of the empty stack bar's gold line in hoch. Not while the stage
   * holds; null before the first move.
   */
  readonly lastMove?: string | null
  /** Prompt 49: a change of turn that came without holding (TurnBand) - decoration, every touch passes through. */
  readonly turnBand?: ReactNode
  /**
   * Prompt 49: the engine holds an observation (it waits for the player to
   * look, not for a decision): the header and the decision region say so in
   * these words instead of "Du bist dran". Null: it holds nothing.
   */
  readonly observing?: string | null
  /** Prompt 49: what Forge's auto-pass does, said while Forge plays on by itself (null: the general words). */
  readonly autoPass?: string | null
  /**
   * Prompt 50: the start hand in full screen (start-hand-view.tsx) opens by
   * itself at each of Forge's start questions - the running game passes it.
   * Without it (a replay, the tests' scenes) it opens only through
   * "Starthand ansehen" beside the question.
   */
  readonly startHandOpens?: boolean
}

/** What a card of the table needs to be operated: the moment's questions and Forge's state of waiting, and the two ways to use it. */
interface CardControls {
  readonly targets: { readonly cards: ReadonlySet<number>; readonly players: ReadonlySet<number> }
  readonly moment: TableMoment
  /** Taps can be sent (the page gave onTapCard). */
  readonly live: boolean
  /** Opens the card view; `browse`: the list it browses (prompt 50: the player's hand). */
  readonly look: (id: number, browse?: CardBrowse) => void
  readonly primary: (card: VisibleCard, use: CardUse, browse?: CardBrowse) => void
  /** The player's own hand as the card view's list (prompt 50), resolved from each state. */
  readonly handBrowse: CardBrowse | null
  /**
   * Plays a hand card dropped onto the battlefield (prompt 46): Forge's tap,
   * sent once where cardDrop allows it - the card view's button's guards
   * (Forge waits, no blocking question, no concession, a double tap counts
   * once). True when it was sent.
   */
  readonly play: (card: VisibleCard) => boolean
  /** Taps a player (prompt 17); null: the table is only looked at. */
  readonly tapPlayer: ((player: number) => void) | null
  /** Opens the zone view of a player's zone (prompt 39: the strip's piles) - looking only. */
  readonly lookZone: (player: number, zone: StripZone) => void
}

/** The zones a strip's pile or counter opens in the zone view. */
type StripZone = "graveyard" | "exile" | "command"

const CardControlsContext = createContext<CardControls | null>(null)

export function GameTable({ replay = false,
  state,
  animate = true,
  history = EMPTY_HISTORY,
  questions,
  prompt,
  waiting,
  aiProfile,
  profileDrawn = false,
  pictures,
  menu,
  alerts,
  conceding = false,
  onTapCard,
  onAnswer,
  onTapPlayer,
  onUseMana,
  stage = null,
  lastMove = null,
  turnBand = null,
  observing = null,
  autoPass = null,
  startHandOpens = false,
}: GameTableProps) {
  const view = useMemo(() => tableView(state, questions), [state, questions])
  const profile = profileDrawn ? `${aiProfileLabel(aiProfile)} (zufällig)` : aiProfileLabel(aiProfile)
  const lands = useMemo(() => momentLands(state), [state])
  // The player's land plays this turn on their strip (prompt 51).
  const landFact = useMemo(() => landPlayFact(state), [state])
  const moment = useMemo<TableMoment>(() => ({ questions, waiting, conceding, attack: state.attack ?? null, combat: state.combat, lands }), [questions, waiting, conceding, state.attack, state.combat, lands])
  const [look, setLook] = useState<CardLook | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpPhaseId = useId()
  const helpOwnerId = useId()
  const targets = useMemo(() => ({ cards: stackTargetIds(state, "card"), players: stackTargetIds(state, "player") }), [state])
  // The decision region's form (prompt 41): the action bar in hoch, the Phasen-Tafel beside the battlefields.
  const decisionForm = useTableLayout() === "hoch" ? "bar" : "panel"
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inspectingHistory, setInspectingHistory] = useState(false)
  const [zone, setZone] = useState<ZoneLook | null>(null)
  // The player's hand as the card view's list: one object per player, not per state (the controls stay the same).
  const myId = state.players.find((player) => player.me)?.id
  const ownHand = useMemo(() => (myId === undefined ? null : handOf(myId)), [myId])
  // The start hand in full screen (prompt 50, start-hand.ts): Forge's start question, the hand it is about, open or not.
  const start = startQuestion(questions)
  const startKey = start === null ? null : startHandKey(start, state)
  const past = pastStart(state, questions)
  const [startMemory, setStartMemory] = useState<StartHandMemory>(START_HAND_MEMORY)
  const startOpen = startHandOpen(startMemory, startKey, startHandOpens && onAnswer !== undefined && !conceding, past)
  // What this state changes: the wait after an answer from the panel ends with the next start question or when the game
  // begins; the hand shown last keeps the panel open between two of Forge's questions.
  const startNext = nextStartHandMemory(startMemory, startKey, startOpen, past)
  if (startNext !== startMemory) setStartMemory(startNext)
  const openCard = useCallback((id: number, browse?: CardBrowse, question?: number) => {
    setInspectingHistory(false)
    const pile = browse === undefined ? pileOf(view, id) : null
    setLook((previous) => ({ id, open: true, serial: (previous?.serial ?? 0) + 1,
      ...(question !== undefined ? { question } : {}),
      ...(browse !== undefined ? { browse } : pile !== null && pile.length > 1 ? { browse: { kind: "ids", ids: pile } as const } : {}),
    }))
  }, [view])
  // Only a stable question ID is held; its latest cardView is resolved while it remains open.
  const lookAtQuestionCard = useCallback((id: number) => openCard(id, undefined, questionCard(questions, id)?.question), [openCard, questions])
  // A decision gets room when it needs it (GameBoard): a question with a list, a form or cards outside the table
  // (expanded) - or more words than the compact region holds (tall), measured once per set of open questions, so
  // the region never flips back and forth.
  const decisionArea = useRef<HTMLElement>(null)
  const decisionKey = questions.map((question) => question.id).join(",")
  const [overflowed, setOverflowed] = useState<string | null>(null)
  // Words that do not fit may take the stack's room too where it has nothing to show (GameBoard: a smaller strip in hoch
  // and quadrat, its place in a low breit window).
  const quietCenter = state.stack.length === 0 && state.combat.length === 0
  const room: GameBoardDecision = decisionNeedsRoom(currentDecision(questions), state)
    ? "expanded"
    : decisionKey !== "" && overflowed === decisionKey
      ? quietCenter
        ? "expanded"
        : "tall"
      : "compact"
  useLayoutEffect(() => {
    const area = decisionArea.current
    if (area === null || room !== "compact" || decisionKey === "" || overflowed === decisionKey) return
    if (area.scrollHeight > area.clientHeight + 1) setOverflowed(decisionKey)
  }, [room, decisionKey, overflowed, questions, prompt, waiting, conceding, alerts, state])
  // The last card tapped at once and when: the second tap of a double tap counts once.
  const lastTap = useRef<{ readonly id: number; readonly at: number } | null>(null)
  // Likewise the last player tapped: a double tap would choose and take back again.
  const lastPlayerTap = useRef<{ readonly id: number; readonly at: number } | null>(null)
  const tapPlayer = useCallback(
    (player: number) => {
      const now = performance.now()
      const last = lastPlayerTap.current
      if (onTapPlayer === undefined || (last !== null && last.id === player && now - last.at < ARMING_MS)) return
      lastPlayerTap.current = { id: player, at: now }
      onTapPlayer(player)
    },
    [onTapPlayer],
  )
  // A card tapped from the decision region (a defending planeswalker - prompt 18): at once, a double tap counts once.
  const tapCardNow = useCallback(
    (card: number) => {
      const now = performance.now()
      const last = lastTap.current
      if (onTapCard === undefined || (last !== null && last.id === card && now - last.at < ARMING_MS)) return
      lastTap.current = { id: card, at: now }
      onTapCard(card)
    },
    [onTapCard],
  )
  const controls = useMemo<CardControls>(() => {
    const open = openCard
    return {
      moment,
      targets,
      live: onTapCard !== undefined,
      look: open,
      handBrowse: ownHand,
      primary: (card, use, browse) => {
        const now = performance.now()
        const last = lastTap.current
        if (last !== null && last.id === card.id && now - last.at < ARMING_MS) return
        if (onTapCard === undefined || use.primary !== "tap") {
          open(card.id, browse)
          return
        }
        lastTap.current = { id: card.id, at: now }
        onTapCard(card.id)
      },
      play: (card) => {
        const now = performance.now()
        const last = lastTap.current
        if (onTapCard === undefined || !cardDrop(card, HAND_PLACE, moment).play) return false
        if (last !== null && last.id === card.id && now - last.at < ARMING_MS) return false
        lastTap.current = { id: card.id, at: now }
        onTapCard(card.id)
        return true
      },
      tapPlayer: onTapPlayer === undefined ? null : tapPlayer,
      lookZone: (player, zone) => setZone({ kind: "zone", player, zone }),
    }
  }, [moment, targets, onTapCard, onTapPlayer, tapPlayer, openCard, ownHand])
  return (
    <CardControlsContext value={controls}>
      <GameBoard decision={room}>
        <title>Partie · OpenMana</title>
        <TableSurface />
        <TableArt />
        {/*
          The header bar (prompt 39): the emblem and wordmark, the zones and the history as symbol buttons (with words in
          breit), the turn and step - the help opens from there -, whether Forge waits, the menu.
        */}
        <GameBoardArea area="header" aria-label="Spielstand" className="flex items-center gap-1 px-2 py-0.5 quadrat:gap-2 quadrat:py-1 breit:gap-2 breit:px-3 breit:py-1">
          <span aria-hidden className="table-brand hidden shrink-0 items-center gap-2 pe-1 min-[25rem]:flex quadrat:flex breit:flex">
            <TableEmblem className="size-6 quadrat:size-8 breit:size-9 breit:short:size-7" />
            <span className="table-wordmark hidden font-heading text-xl font-semibold quadrat:inline breit:inline breit:text-2xl breit:short:hidden">OpenMana</span>
          </span>
          <GameZoneButton aria-label="Zonen ansehen" title="Zonen ansehen" aria-haspopup="dialog" className="breit:w-auto breit:gap-2 breit:px-3 breit:short:w-10 breit:short:px-0" disabled={state.players.length === 0} onClick={() => { const player = state.players.find((p) => p.me) ?? state.players[0]; if (player !== undefined) setZone({ kind: "zone", player: player.id, zone: "graveyard" }) }}>
            <Layers aria-hidden />
            <span className="hidden breit:inline breit:short:hidden">Zonen</span>
          </GameZoneButton>
          <GameZoneButton aria-label="Spielverlauf ansehen" title={`Spielverlauf: ${history.length} Einträge`} aria-haspopup="dialog" className="breit:w-auto breit:gap-2 breit:px-3 breit:short:w-10 breit:short:px-0" onClick={() => setHistoryOpen(true)}>
            <ScrollText aria-hidden />
            <span className="hidden breit:inline breit:short:hidden">Spielverlauf</span>
          </GameZoneButton>
          <h1 className="sr-only">{replay ? "Wiedergabe" : "Partie"}</h1>
          <GameHelpButton aria-label="Hilfe am Spieltisch" aria-describedby={`${helpOwnerId} ${helpPhaseId}`} title="Hilfe am Spieltisch" aria-haspopup="dialog" hint={<span className="hidden text-sm breit:inline breit:short:hidden">Hilfe</span>} onClick={() => setHelpOpen(true)}>
            <span id={helpOwnerId} className="line-clamp-2 text-xs leading-tight text-muted-foreground quadrat:truncate quadrat:text-sm breit:truncate breit:text-sm breit:short:text-xs">
              <TurnInfo turn={view.turn} seat={view.activeSeat} />
            </span>
            {/* Forge's step in words (prompt 41: its picture, the phases, is the Phasen-Tafel's / the action bar's). */}
            <span id={helpPhaseId} className="truncate text-xs leading-tight font-medium" title={phaseLabel(state.phase)}>
              {phaseLabel(state.phase)}
            </span>
          </GameHelpButton>
          {replay ? <Badge variant="secondary">Wiedergabe</Badge> : conceding ? (
            <Badge variant="secondary">
              <Spinner data-icon="inline-start" aria-hidden />
              Gibt auf …
            </Badge>
          ) : observing !== null ? (
            <Badge variant="secondary" data-observing="">
              <Pause data-icon="inline-start" aria-hidden />
              Gegnerzug
            </Badge>
          ) : waiting ? (
            <Badge>Du bist dran</Badge>
          ) : (
            <Badge variant="secondary">
              <Spinner data-icon="inline-start" aria-hidden />
              Forge rechnet
            </Badge>
          )}
          {menu}
        </GameBoardArea>

        <GameBoardArea area="opponent" aria-label="Forge-KI" className="flex flex-col">
          {view.opponents.map((side) => (
            <PlayerBar key={side.player.id} side={side} profile={profile} pictures={pictures} />
          ))}
        </GameBoardArea>

        <GameBoardArea area="opponent-field" aria-label="Spielfeld der Forge-KI" className="flex flex-col">
          {view.opponents.map((side) => (
            <Field key={side.player.id} side={side} pictures={pictures} nearRow="bottom" owner="der Forge-KI" />
          ))}
        </GameBoardArea>

        <GameBoardArea area="center" aria-label="Stapel und Kampf" tabIndex={0}>
          <Chronicle view={view} pictures={pictures} onLook={openCard} targets={targets.cards} blocking={blockDraft(questions)} />
        </GameBoardArea>

        <GameBoardArea area="field" aria-label="Dein Spielfeld" className="flex flex-col">
          {view.me ? <Field side={view.me} pictures={pictures} nearRow="top" owner="dir" /> : <FieldEmpty text="Forge nennt keinen Platz für dich." />}
        </GameBoardArea>

        <GameBoardArea area="me" aria-label="Du">
          {view.me ? <PlayerBar side={view.me} profile={null} pictures={pictures} lands={landFact} /> : null}
        </GameBoardArea>

        <GameBoardArea area="hand" aria-label="Deine Hand">
          <Hand cards={view.me?.hand ?? []} pictures={pictures} />
        </GameBoardArea>

        {/* The opponent's action the engine holds (prompt 49): a compact announcement between the battlefields, reached after the hand. */}
        {stage}
        {/* After it the latest move, one quiet line (not while the stage holds); in hoch and a low window it steps aside while the stack bar shows something. */}
        {lastMove !== null && stage === null ? <LastMoveLine text={lastMove} rests={view.stack.length > 0 || view.combat.length > 0} /> : null}
        {turnBand}
        {/* The decision last: the order of hoch (its action bar at the very bottom) is the reading and focus order of every layout. */}
        {/* Beside the battlefields the Phasen-Tafel stands in its column: at the end in quadrat, in the middle in breit (the mockup's). */}
        <GameBoardArea ref={decisionArea} area="decision" aria-label="Entscheidung" tabIndex={0} className="quadrat:flex quadrat:flex-col breit:flex breit:flex-col">
          <DecisionPanel
            form={decisionForm}
            phases={<PhasePanel phase={state.phase} turn={view.turn} place={decisionForm} folded={decisionForm === "panel" && room !== "compact"} />}
            state={state}
            questions={questions}
            prompt={prompt}
            waiting={waiting}
            conceding={conceding}
            pictures={pictures}
            alerts={alerts}
            observing={observing}
            autoPass={autoPass}
            onLook={lookAtQuestionCard}
            {...(startKey !== null ? { onShowStartHand: () => setStartMemory((previous) => ({ ...previous, dismissed: null, requested: startKey, awaiting: null })) } : {})}
            {...(onAnswer !== undefined ? { onAnswer } : {})}
            {...(onTapPlayer !== undefined ? { onTapPlayer: tapPlayer } : {})}
            {...(onTapCard !== undefined ? { onTapCard: tapCardNow } : {})}
            {...(onUseMana !== undefined ? { onUseMana } : {})}
          />
        </GameBoardArea>
        {/* The arrows over the board (prompt 43): targets, attacks, blocks - decoration, no pointer events, hidden from screen readers. */}
        <TableArrows state={state} />
        {/* The motion over the board (prompt 44): cards travelling and turning, damage, life, stack and phases - never holding a state or an input up. */}
        <TableMotion state={state} history={history} animate={animate} priority={priorityQuestion(questions)} />
        <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} state={state} questions={questions} replay={replay} waiting={waiting} conceding={conceding} />
        <ZoneSheet onSourceChange={setZone} source={zone} state={state} moment={moment} pictures={pictures} onClose={() => setZone(null)} onLook={openCard} />
        <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} history={history} state={state} questions={questions} onLook={(id) => { lookAtQuestionCard(id); setInspectingHistory(true) }} />
        {/* The start hand in full screen (prompt 50): over the table, under a card view opened from it. */}
        <StartHandView
          open={startOpen}
          onClose={() => setStartMemory({ dismissed: startKey, requested: null, awaiting: null, shown: null })}
          question={start}
          state={state}
          prompt={prompt}
          moment={moment}
          pictures={pictures}
          inspecting={look?.open === true}
          onLook={(id) => openCard(id, ownHand ?? undefined)}
          onAnswer={onAnswer}
          onAnswered={() => setStartMemory((previous) => ({ ...previous, requested: null, awaiting: startKey }))}
          // Forge's card.tap as sent; the panel's own guard counts a double tap once only until Forge answered the first.
          onTapCard={onTapCard}
        />
        <CardView
          look={look}
          onBrowse={(id) => setLook((previous) => previous === null ? null : { ...previous, id })}
          onOpenChange={(open) => setLook((previous) => (previous === null ? null : { ...previous, open }))}
          state={state}
          view={view}
          moment={moment}
          pictures={pictures}
          {...(onTapCard !== undefined && !inspectingHistory ? { onTap: onTapCard } : {})}
        />
      </GameBoard>
    </CardControlsContext>
  )
}

/**
 * The turn and whose it is (the mockup's `.zug-info`): "Zug 14 · Dein Zug",
 * "Zug 15 · Forge-KI am Zug" - the number in gold; before the first turn
 * "Die Starthände werden gezogen".
 */
function TurnInfo({ turn, seat }: { turn: number; seat: Seat | null }) {
  if (turn <= 0 || seat === null) return <>{turnOwnerLabel(seat)}</>
  return (
    <>
      Zug <b className="font-semibold text-primary tabular-nums">{turn}</b> · {turnOwnerLabel(seat)}
    </>
  )
}

/**
 * A player's strip (prompt 39, docs/design/SPIELTISCH.md §4.3-4.6; the
 * mockup's `.leiste`): the life medallion in the middle - the player's
 * control -, on the left the hand (the opponent's as overlapping backs) and
 * the short facts, on the right the zones - the library as OpenMana's back
 * with Forge's number, the graveyard with its top card, exile and the command
 * zone as counters; a tap on one of them opens the zone view (looking only).
 * The longer facts (mana pool, the player's counters such as poison,
 * commander tax and damage) follow below in a line of chips of their own,
 * only when Forge reports any. Nothing is left out that the strip showed
 * before; whose turn it is glows on the medallion and stands in the header.
 */
function PlayerBar({ side, profile, pictures, lands = null }: { side: TableSide; profile: string | null; pictures: TableCardLookup; lands?: LandPlayFact | null }) {
  const controls = use(CardControlsContext)
  if (controls === null) throw new Error("PlayerBar outside GameTable")
  const { player, counts } = side
  const me = side.seat === "me"
  const seat = me ? "me" : "opponent"
  const open = (zone: StripZone) => () => controls.lookZone(player.id, zone)
  const zoneLabel = (zone: StripZone, count: number) => `${placeLabel(zone, seat)} ansehen: ${count === 1 ? "1 Karte" : `${count} Karten`}`
  const graveyard = player.zones.graveyard
  // Forge adds a card to the end of a zone's list (Zone.add), so the graveyard's last card is the one put there last: its top.
  const top = graveyard.at(-1)
  const topCard = top !== undefined && isVisible(top) ? top : null
  const facts = side.mana.length > 0 || side.counters.length > 0 || player.commanders.length > 0
  return (
    <div className="table-strip @container flex flex-col gap-0.5 px-2 text-xs text-muted-foreground quadrat:py-0.5 breit:py-0.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-x-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 justify-self-start">
          {me ? null : <OpponentHand cards={side.hand} pictures={pictures} />}
          <ZoneCount name="Hand" count={counts.hand} />
          {lands !== null ? <LandPlays lands={lands} /> : null}
          {profile !== null ? <StripChip data-strip-fact="profile">{profile}</StripChip> : null}
          {player.hasPriority ? <StripChip data-strip-fact="priority">Priorität</StripChip> : null}
          {player.lost ? <StripChip data-strip-fact="lost" tone="danger">verloren</StripChip> : null}
        </div>
        <SeatPlayer side={side} />
        <div className="flex items-center gap-1 justify-self-end">
          <ZonePile name="Bibliothek" count={counts.library} card={counts.library > 0 ? <TableArtBack /> : null} empty={counts.library === 0} />
          <ZonePile
            name="Friedhof"
            count={counts.graveyard}
            label={`${zoneLabel("graveyard", counts.graveyard)}${topCard !== null ? `, oben: ${cardName(topCard)}` : ""}`}
            card={topCard !== null ? <TablePicture card={topCard} pictures={pictures} /> : null}
            empty={topCard === null}
            onOpen={open("graveyard")}
          />
          <ZoneCounter name="Exil" count={counts.exile} label={zoneLabel("exile", counts.exile)} icon={null} onOpen={open("exile")} />
          {counts.command > 0 ? (
            <ZoneCounter name="Kommandozone" count={counts.command} label={zoneLabel("command", counts.command)} icon={<Crown aria-hidden />} nameClassName="sr-only breit:not-sr-only breit:short:sr-only" onOpen={open("command")} />
          ) : null}
        </div>
      </div>
      {facts ? (
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 pb-0.5">
          {side.mana.length > 0 ? (
            <StripChip>
              Manavorrat{" "}
              <span className="font-medium text-foreground">{side.mana.map(({ color, amount }) => `${amount} ${MANA_LABELS[color]}`).join(", ")}</span>
            </StripChip>
          ) : null}
          {side.counters.map(({ name, amount }) => {
            const label = counterLabel(name)
            return (
              <StripChip key={name}>
                <span {...(label.english ? { lang: "en" } : {})}>{label.text}</span> <span className="font-medium text-foreground tabular-nums">{amount}</span>
              </StripChip>
            )
          })}
          {player.commanders.map((commander, index) => (
            <CommanderFacts
              key={isVisible(commander.card) ? commander.card.id : `hidden:${index}`}
              commander={commander}
              playerId={player.id}
              me={me}
              // One commander needs no name (its card lies on the table); partners do.
              named={player.commanders.length > 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The player's land plays this turn (prompt 51, land-labels.ts): Forge's
 * `landsPlayed` of `landsAllowed` ("Länder 1/1", "unbegrenzt" with Forge's
 * `landsUnlimited`) in the player's own turn - never the lands lying on the
 * battlefield, which may come from earlier turns or effects -, in the AI's
 * turn that Forge offers no land then, before the first turn nothing. Only
 * read; its sentence is the title and what screen readers hear.
 */
function LandPlays({ lands }: { lands: LandPlayFact }) {
  return (
    <StripChip data-strip-fact="lands" data-lands-turn={lands.turn} data-lands-used={lands.used || undefined} title={lands.sentence}>
      <span aria-hidden>
        {lands.label}
        {lands.value !== null ? <> <span className="font-medium text-foreground tabular-nums">{lands.value}</span></> : null}
      </span>
      <span className="sr-only">{lands.sentence}</span>
    </StripChip>
  )
}

/** The library's card: OpenMana's back (Forge sends only the library's size). */
function TableArtBack() {
  return <TableCardBack className="h-auto w-full" />
}

/**
 * Who a seat is and their life total, as the life medallion (prompt 39) -
 * and, where Forge's running input would take the player (a target, a choice,
 * life for mana; card-use.ts playerUse), the button for it with Forge's mark
 * (a ring around the medallion, red for a target): it taps at once, like the
 * cards of a selection. Without a tap it is only read, with Forge's highlight
 * (chosen) if any. Whose turn it is glows.
 */
function SeatPlayer({ side }: { side: TableSide }) {
  const controls = use(CardControlsContext)
  if (controls === null) throw new Error("SeatPlayer outside GameTable")
  const { player } = side
  const usage = playerUse(player, controls.moment)
  const target = controls.targets.players.has(player.id)
  const mark = usage.mark ?? (target ? "target" : null)
  const name = side.seat === "me" ? "Du" : seatName(side.seat)
  const content = <MedallionFace name={name} life={player.life} target={target} active={side.active} />
  const medallion = "table-medallion"
  const tapPlayer = controls.tapPlayer
  if (usage.tap === null || tapPlayer === null) {
    return (
      <GamePlayer className={medallion} data-player={player.id} data-active={side.active || undefined} data-stack-target={target || undefined} mark={mark} title={[name, usage.markLabel, target ? STACK_TARGET_LABEL : null].filter(Boolean).join(": ")}>
        {content}
        {usage.markLabel !== null ? <span className="sr-only">, {usage.markLabel}</span> : null}
        {target ? <span className="sr-only">, {STACK_TARGET_LABEL}</span> : null}
      </GamePlayer>
    )
  }
  const label = [playerButtonLabel(name, player.life, usage), ...(target ? [STACK_TARGET_LABEL] : [])].join(", ")
  return (
    <GamePlayerButton
      className={medallion}
      data-player={player.id}
      data-active={side.active || undefined}
      mark={mark}
      data-stack-target={target || undefined}
      aria-label={label}
      title={usage.blocked ?? label}
      disabled={usage.blocked !== null}
      onKeyDown={(event) => {
        if (event.repeat) event.preventDefault()
      }}
      onClick={() => tapPlayer(player.id)}
    >
      {content}
    </GamePlayerButton>
  )
}

/** A commander's tax and the commander damage it dealt, as Forge counts them - short pieces that wrap as a whole. */
function CommanderFacts({ commander, playerId, me, named }: { commander: TableSide["player"]["commanders"][number]; playerId: number; me: boolean; named: boolean }) {
  return (
    <>
      <StripChip>
        {named ? `${isVisible(commander.card) ? cardName(commander.card) : "Verdeckter Kommandeur"}: ` : null}Kommandeursteuer{" "}
        <span className="font-medium text-foreground tabular-nums">{commander.tax}</span>
      </StripChip>
      {commander.damage.map((dealt) => (
        <StripChip key={dealt.player}>
          <span className="font-medium text-foreground tabular-nums">{dealt.amount}</span> Kommandeurschaden{" "}
          {dealt.player === playerId ? "an sich" : me ? "an Forge-KI" : "an dich"}
        </StripChip>
      ))}
    </>
  )
}

/**
 * The opponent's hand (prompt 39, the mockup's `.rueckseiten`): overlapping
 * backs for what Forge hides - one per card, never told apart -, the card for
 * what it reveals (a card to look at, a toolbar as before). Where the strip
 * is narrow (a phone, the side column) the hidden backs give way: the hand's
 * size stands beside them ("6 Hand").
 */
function OpponentHand({ cards, pictures }: { cards: readonly Card[]; pictures: TableCardLookup }) {
  if (cards.length === 0) return null
  const revealed = cards.some(isVisible)
  const label = `Hand der Forge-KI: ${cards.length === 1 ? "1 Karte" : `${cards.length} Karten`}`
  // Revealed cards take their own place (no overlap) and a height a finger can hit (WCAG 2.5.8: 24 px).
  const items = cards.map((card, index) => (
    <GameCardRowItem key={isVisible(card) ? card.id : `hidden:${index}`} className={cn(revealed ? null : "table-hand-back", isVisible(card) ? null : "hidden @md:block")}>
      {isVisible(card) ? (
        <TableCard card={card} place={{ zone: "hand", mine: false }} pictures={pictures} />
      ) : (
        <TableCardBack>
          <span className="sr-only">verdeckte Karte</span>
        </TableCardBack>
      )}
    </GameCardRowItem>
  ))
  return revealed ? (
    <GameCardRow controls aria-label={label} className="table-hand-revealed h-10 flex-none items-center justify-start gap-1 overflow-visible p-0">
      {items}
    </GameCardRow>
  ) : (
    <ul aria-label={label} className="table-hand-backs hidden h-8 items-center @md:flex quadrat:h-9 breit:h-10 breit:short:h-8">
      {items}
    </ul>
  )
}

/**
 * What a card of the table does (prompt 14): Forge's use of it now - looked at
 * only where no page sends taps (a replay) -, its primary activation and
 * looking at it. The one place both a card (TableCard) and the fan's row
 * (Hand) take them from.
 */
function cardActions(controls: CardControls, card: VisibleCard, place: CardPlace): { readonly usage: CardUse; readonly primary: () => void; readonly look: () => void } {
  const found = cardUse(card, place, controls.moment)
  // Only looked at (no page to send taps): the primary activation looks too.
  const usage: CardUse = controls.live ? found : { ...found, primary: "look" }
  // A card of the player's own hand is looked at with the hand to browse (prompt 50).
  const browse = place.zone === "hand" && place.mine ? (controls.handBrowse ?? undefined) : undefined
  return { usage, primary: () => controls.primary(card, usage, browse), look: () => controls.look(card.id, browse) }
}

/**
 * A card the player may see, as a control (prompt 14): its primary
 * activation looks at it - or taps it at once where the step allows (see
 * card-use.ts) -, a long press or right click always looks at it. Forge's
 * mark is its frame; its name says the mark and, where it taps at once, what
 * the tap does. Always inside a GameCardRow with controls.
 */
function TableCard({
  card,
  place,
  pictures,
  count = 1,
  note,
  caption,
  plaque,
  combat,
  fan = false,
  pile,
}: {
  card: VisibleCard
  place: CardPlace
  pictures: TableCardLookup
  count?: number
  note?: string
  caption?: ReactNode
  /** The value plaque on the picture (battlefield cards, prompt 40). */
  plaque?: ReactNode
  /** Forge's combat fact: the frame's colour, an attacker moved towards its opponent (table.css). */
  combat?: "attacking" | "blocking"
  /** A card of the fan (prompt 42): its row handles touch and pen (useFanPress), the card only the mouse's and the keyboard's click and look. */
  fan?: boolean
  /** A pile's cards (prompt 44: every id of the pile is at this card's place - a card joining or leaving the pile travels there). */
  pile?: readonly number[]
}) {
  const controls = use(CardControlsContext)
  if (controls === null) throw new Error("TableCard outside GameTable")
  const { usage, primary, look } = cardActions(controls, card, place)
  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, ...clickAndLook } = useCardPress({ onPrimary: primary, onLook: look })
  const press = fan ? clickAndLook : { ...clickAndLook, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
  const target = controls.targets.cards.has(card.id)
  const label = [cardButtonLabel(card, usage, { count, ...(note ? { note } : {}) }), ...(target ? [STACK_TARGET_LABEL] : [])].join(", ")
  return (
    <GameCardRowButton>
      <GameCardButton
        tapped={card.tapped}
        mark={usage.mark ?? (target ? "target" : null)}
        {...(plaque !== undefined ? { plaque } : {})}
        pile={count}
        data-stack-target={target || undefined}
        data-combat={combat}
        data-card={card.id}
        data-pile-cards={pile?.join(" ")}
        aria-label={label}
        title={label}
        {...(usage.primary === "look" ? { "aria-haspopup": "dialog" as const } : {})}
        {...(caption !== undefined ? { caption } : target ? { caption: <GameCardCaption title={STACK_TARGET_LABEL}><TargetChip /></GameCardCaption> } : {})}
        {...press}
      >
        <TablePicture card={card} pictures={pictures} {...(fan ? { sizes: HAND_PICTURE_SIZES } : {})} />
      </GameCardButton>
    </GameCardRowButton>
  )
}

/** The chip of a card a spell on the stack targets (prompt 23): the crosshair and "Ziel". */
function TargetChip() {
  return (
    <CardChip tone="danger">
      <Crosshair aria-hidden />
      <span>Ziel</span>
    </CardChip>
  )
}

/**
 * A card on the battlefield (prompt 40, docs/design/SPIELTISCH.md §4.7):
 * Forge's power/toughness or loyalty as the plaque on its printed value box,
 * every other fact as a chip above the picture - the pile's size, summoning
 * sickness (the hourglass, right after the pile's count: it has no other sign
 * on the table, while "Ziel" also has the arrows and the Zauberchronik and
 * "Quelle" the decision's heading, so the line - cut at its end - cuts those
 * first), "Ziel",
 * "Quelle", Forge's reason it would not attack, the block step's words,
 * combat as signs, damage, counters and the rest in words -, the whole of it
 * in the chip line's title and the card's name for screen readers.
 */
function FieldCard({ card, count, pictures, seat, note, pile }: { card: VisibleCard; count: number; pictures: TableCardLookup; seat: Seat; note?: string; pile?: readonly number[] }) {
  const controls = use(CardControlsContext)
  // The card the running step is about (an ability's source while its targets or costs are chosen - prompt 17).
  const target = controls?.targets.cards.has(card.id) ?? false
  const source = controls !== null && stepSource(controls.moment.questions) === card.id
  // While attackers are declared: why Forge would not declare this creature (prompt 18).
  const usage = controls === null ? null : cardUse(card, { zone: "battlefield", mine: seat === "me" }, controls.moment)
  const unavailable = usage?.unavailable ?? null
  const blockLabel = controls !== null && currentStep(controls.moment.questions) === "block" && openSelection(controls.moment.questions) === null ? usage?.markLabel ?? null : null
  const title = [cardName(card), ...cardFacts(card, count), ...(note ? [note] : []), ...(source ? [SOURCE_LABEL] : []), ...(target ? [STACK_TARGET_LABEL] : []), ...(blockLabel !== null ? [blockLabel] : []), ...(unavailable !== null ? [`kann nicht angreifen: ${unavailable.short}`] : [])].join(" · ")
  const value = plaqueValue(card)
  return (
    <TableCard
      card={card}
      place={{ zone: "battlefield", mine: seat === "me" }}
      pictures={pictures}
      count={count}
      {...(note ? { note } : {})}
      {...(pile !== undefined && pile.length > 1 ? { pile } : {})}
      {...(value !== null ? { plaque: <ValuePlaque value={value} /> } : {})}
      {...(card.attacking === true ? { combat: "attacking" as const } : card.blocking === true ? { combat: "blocking" as const } : {})}
      caption={
        <GameCardCaption title={title}>
          {count > 1 ? <CardChip tone="pile">×{count}</CardChip> : null}
          {card.sick ? <SickChip /> : null}
          {target ? <TargetChip /> : null}
          {source ? <CardChip tone="strong">{SOURCE_LABEL}</CardChip> : null}
          {unavailable !== null ? (
            <CardChip>
              <CircleSlash aria-hidden />
              <span>{unavailable.short}</span>
            </CardChip>
          ) : null}
          {blockLabel !== null ? (
            <CardChip tone="block">
              {card.blocking === true ? <Shield aria-hidden /> : null}
              <span>{blockLabel}</span>
            </CardChip>
          ) : card.blocking === true ? (
            <CardChip tone="block">
              <Shield aria-hidden />
            </CardChip>
          ) : null}
          {card.attacking === true ? (
            <CardChip tone="attack">
              <Swords aria-hidden />
            </CardChip>
          ) : null}
          {chipFacts(card).map((fact) => (
            <CardChip key={fact} {...(card.damage > 0 && fact === damageLabel(card.damage) ? { tone: "danger" as const } : {})}>
              {fact}
            </CardChip>
          ))}
        </GameCardCaption>
      }
    />
  )
}

/** One place of a battlefield row: a card or pile, with its attachments; or a hidden card. */
function Entry({ entry, pictures, seat }: { entry: BoardEntry; pictures: TableCardLookup; seat: Seat }) {
  if (entry.kind === "hidden") {
    return (
      <GameCardRowItem>
        <GameCard
          caption={
            <GameCardCaption title="verdeckt">
              <CardChip>verdeckt</CardChip>
            </GameCardCaption>
          }
        >
          <TableCardBack>
            <span className="sr-only">verdeckte Karte</span>
          </TableCardBack>
        </GameCard>
      </GameCardRowItem>
    )
  }
  const card = <FieldCard card={entry.card} count={entry.ids.length} pile={entry.ids} pictures={pictures} seat={seat} />
  if (entry.attachments.length === 0) return <GameCardRowItem>{card}</GameCardRowItem>
  return (
    <GameCardRowItem>
      <GameCardGroup role="group" aria-label={`${cardName(entry.card)} mit ${entry.attachments.map(cardName).join(", ")}`}>
        {card}
        {entry.attachments.map((attachment) => (
          <FieldCard key={attachment.id} card={attachment} count={1} pictures={pictures} seat={seat} note={`an ${cardName(entry.card)}`} />
        ))}
      </GameCardGroup>
    </GameCardRowItem>
  )
}

/** The chip of a card in the command zone (its place in the battlefield's outer row). */
function CommandChip() {
  return (
    <CardChip>
      <Crown aria-hidden />
      <span>Kommandozone</span>
    </CardChip>
  )
}

/**
 * A battlefield row's size for table.css (prompt 40, the mockup's `--u`/`--c`):
 * its cards' width in card widths and how many cards it draws - the card width
 * is the least of the row's height, the free width per card and an upper
 * bound, never below the minimum; only below that does the row scroll.
 */
function rowStyle(entries: readonly BoardEntry[], command = 0): CSSProperties {
  const { units, places } = rowSize(entries, command)
  return { "--u": Number(units.toFixed(3)), "--c": places } as CSSProperties
}

/** Whether a row shows a card the player may see (then it is a toolbar of cards; see GameCardRow). */
function hasCards(entries: readonly BoardEntry[], command: readonly Card[] = []): boolean {
  return entries.some((entry) => entry.kind === "card") || command.some(isVisible)
}

/** Words on the board (prompt 37): on the panel tone, readable over the leather, the circle and its runes. */
const BOARD_TEXT = "rounded-md bg-table-panel/90 py-1"

function FieldEmpty({ text }: { text: string }) {
  return <p className={cn("m-auto px-3 text-center text-xs text-muted-foreground", BOARD_TEXT)}>{text}</p>
}

/**
 * A player's battlefield: cards with power and toughness in the row next to
 * the middle of the table (nearRow), the others in the outer row - or all in
 * one row when the region is too low for two. The command zone leads the
 * outer row.
 */
function Field({ side, pictures, nearRow, owner }: { side: TableSide; pictures: TableCardLookup; nearRow: "top" | "bottom"; owner: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const height = useElementHeight(ref)
  const twoRows = height === null || height >= TWO_ROWS_MIN_HEIGHT
  const { creatures, others } = side.battlefield
  const command = side.command
  const empty = creatures.length === 0 && others.length === 0 && command.length === 0
  const commandItems = command.map((card, index) => (
    <GameCardRowItem key={isVisible(card) ? `command:${card.id}` : `command:hidden:${index}`}>
      {isVisible(card) ? (
        <TableCard
          card={card}
          place={{ zone: "command", mine: side.seat === "me" }}
          pictures={pictures}
          note="Kommandozone"
          caption={
            <GameCardCaption title={`${cardName(card)} · Kommandozone`}>
              <CommandChip />
            </GameCardCaption>
          }
        />
      ) : (
        <GameCard
          caption={
            <GameCardCaption title="Kommandozone">
              <CommandChip />
            </GameCardCaption>
          }
        >
          <TableCardBack>
            <span className="sr-only">verdeckte Karte</span>
          </TableCardBack>
        </GameCard>
      )}
    </GameCardRowItem>
  ))
  const entries = (list: readonly BoardEntry[]) => list.map((entry) => <Entry key={entry.key} entry={entry} pictures={pictures} seat={side.seat} />)
  let rows: ReactNode
  if (empty) rows = <FieldEmpty text={`Auf dem Spielfeld von ${owner === "dir" ? "dir" : "der Forge-KI"} liegt nichts.`} />
  else if (!twoRows) {
    rows = (
      <GameCardRow aria-label={`Bleibende Karten von ${owner}`} controls={hasCards([...creatures, ...others], command)} className="table-field-row" style={rowStyle([...creatures, ...others], command.length)}>
        {commandItems}
        {entries(creatures)}
        {entries(others)}
      </GameCardRow>
    )
  } else {
    const near = (
      <GameCardRow key="near" aria-label={`Kreaturen von ${owner}`} controls={hasCards(creatures)} className="table-field-row" style={rowStyle(creatures)}>
        {creatures.length > 0 ? entries(creatures) : <GameCardRowItem className={cn("m-auto h-auto px-2 text-xs text-muted-foreground", BOARD_TEXT)}>Keine Kreaturen</GameCardRowItem>}
      </GameCardRow>
    )
    const outer = (
      <GameCardRow key="outer" aria-label={`Länder und weitere bleibende Karten von ${owner}`} controls={hasCards(others, command)} className="table-field-row" style={rowStyle(others, command.length)}>
        {commandItems}
        {others.length > 0 ? (
          entries(others)
        ) : command.length === 0 ? (
          <GameCardRowItem className={cn("m-auto h-auto px-2 text-xs text-muted-foreground", BOARD_TEXT)}>Keine weiteren Karten</GameCardRowItem>
        ) : null}
      </GameCardRow>
    )
    // No line between the rows (prompt 40): the chips and the rows' gaps part them, as in the mockup.
    rows = nearRow === "top" ? [near, outer] : [outer, near]
  }
  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col">
      {rows}
    </div>
  )
}

/** Forge's open priority question (its id): a new one makes the main button shimmer once (prompt 44). */
function priorityQuestion(questions: readonly Question[]): number | null {
  return questions.find((question) => question.kind === "buttons" && question.purpose === "priority")?.id ?? null
}

/** The player declares blockers and has not confirmed them (no selection, no blocking question open): the combat is a draft. */
function blockDraft(questions: readonly Question[]): boolean {
  return currentStep(questions) === "block" && openSelection(questions) === null && !questions.some((question) => question.blocking)
}

/** The player's hand's cards as places (card-use.ts): theirs, in the hand. */
const HAND_PLACE: CardPlace = { zone: "hand", mine: true }

/** The root font size (px): the fan's sizes in rem (hand-fan.ts). */
function rootRem(): number {
  if (typeof document === "undefined") return 16
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/**
 * Your hand, always at the bottom: a fan (prompt 42, docs/design/SPIELTISCH.md
 * §4.10, table/hand-fan.ts) - cards side by side (never overlapping), turned and on an arc, sinking
 * a little below the hand's edge; the card under the mouse, under a thumb
 * swiping over the hand (by the cards' resting places) or with the keyboard's
 * focus rises whole above the hand. A tap without a swipe is the lifted card's
 * primary activation, a swipe does nothing else, a long press looks at the
 * lifted card (useFanPress); the mouse's clicks, its right click and the
 * keyboard stay each card's own. Still the toolbar "Deine Hand: N Karten"
 * (arrows, Home, End, Enter).
 */
function Hand({ cards, pictures }: { cards: readonly Card[]; pictures: TableCardLookup }) {
  if (cards.length === 0) return <FieldEmpty text="Deine Hand ist leer." />
  return <FannedHand cards={cards} pictures={pictures} />
}

/** A card of the hand by its key: a visible card's id, a hidden card's place. */
function handKey(card: Card, index: number): string {
  return isVisible(card) ? String(card.id) : `hidden:${index}`
}

function FannedHand({ cards, pictures }: { cards: readonly Card[]; pictures: TableCardLookup }) {
  const controls = use(CardControlsContext)
  const list = useRef<HTMLUListElement>(null)
  const size = useElementSize(list)
  const rem = useMemo(() => rootRem(), [])
  const fan = size === null ? null : handFan(cards.length, size, rem)
  const keys = cards.map(handKey)
  const hand = keys.join(",")
  // The lifted card, for this hand only: a new hand (a card played, one drawn) starts with none lifted.
  const [lift, setLift] = useState<{ readonly hand: string; readonly card: string } | null>(null)
  const lifted = lift !== null && lift.hand === hand ? lift.card : null
  const liftedNow = useRef(lifted)
  useLayoutEffect(() => {
    liftedNow.current = lifted
  })
  const visible = (key: string) => cards.find((card): card is VisibleCard => isVisible(card) && String(card.id) === key) ?? null
  // Dragging a card onto the battlefield (prompt 46): its picture over the board (HandDrag), the card itself dimmed in
  // the hand until the picture is back, gone into Forge's next state, or faded.
  const [dragged, setDragged] = useState<{ readonly hand: string; readonly card: string } | null>(null)
  const draggedNow = dragged !== null && dragged.hand === hand ? dragged.card : null
  const drag = useRef<{ readonly key: string; readonly picture: HandDrag } | null>(null)
  // What a drop reads: the latest cards and controls (a new state may come while a card is dragged).
  const latest = useRef({ visible, controls })
  useLayoutEffect(() => {
    latest.current = { visible, controls }
  })
  // The dragged card left the hand (a new state) or the hand went: its picture goes.
  useEffect(() => {
    const current = drag.current
    if (current !== null && !hand.split(",").includes(current.key)) {
      current.picture.cancel()
      drag.current = null
    }
  }, [hand])
  useEffect(
    () => () => {
      drag.current?.picture.cancel()
      drag.current = null
    },
    [],
  )
  const press = useFanPress({
    pick: (x, target) => {
      const row = list.current
      if (row === null) return null
      const items = [...row.querySelectorAll<HTMLElement>(":scope > [data-hand-card]")]
      if (target !== null) {
        // The mouse: only over a card; while over the lifted card (which covers its neighbours' places) it stays lifted.
        const item = target instanceof Element ? target.closest<HTMLElement>("[data-hand-card]") : null
        if (item === null || !row.contains(item)) return null
        if (item.dataset["handCard"] === liftedNow.current) return liftedNow.current
      }
      // The resting places: layout boxes, untouched by the lift and the turn (offsetLeft), in the pointer's coordinates.
      const origin = row.getBoundingClientRect().left + row.clientLeft - row.scrollLeft
      const index = restingCardAt(items.map((item) => origin + item.offsetLeft), x)
      return index === null ? null : (items[index]!.dataset["handCard"] ?? null)
    },
    onLift: (card) => setLift((previous) => (card === null ? null : previous?.hand === hand && previous.card === card ? previous : { hand, card })),
    onPrimary: (key) => {
      const card = visible(key)
      if (card !== null && controls !== null) cardActions(controls, card, HAND_PLACE).primary()
    },
    onLook: (key) => {
      const card = visible(key)
      if (card !== null && controls !== null) cardActions(controls, card, HAND_PLACE).look()
    },
    // Dragging a card out of the hand onto the battlefield (prompt 46).
    drag: {
      start: (key, point) => {
        // A replay (no page to send taps) drags nothing.
        if (controls === null || !controls.live) return false
        const row = list.current
        const face = row?.querySelector<HTMLElement>(`:scope > [data-hand-card="${key}"] [data-slot="game-card-face"]`)
        if (row === null || face === null || face === undefined || visible(key) === null) return false
        // A full card's size (hand-fan.ts); before the hand was measured, the card's own.
        const picture = HandDrag.start(face, fan?.drag ?? { width: face.offsetWidth, height: face.offsetHeight }, point)
        if (picture === null) return false
        drag.current = { key, picture }
        setLift(null)
        setDragged({ hand, card: key })
        return true
      },
      move: (point) => {
        const current = drag.current
        if (current === null) return
        current.picture.move(point)
        const card = latest.current.visible(current.key)
        const now = latest.current.controls
        current.picture.glow(card !== null && now !== null && current.picture.over() && cardDrop(card, HAND_PLACE, now.moment).play)
      },
      end: (point) => {
        const current = drag.current
        if (current === null) return
        drag.current = null
        const card = latest.current.visible(current.key)
        const now = latest.current.controls
        const release = () => setDragged((previous) => (previous?.card === current.key ? null : previous))
        if (point !== null && card !== null && now !== null) {
          current.picture.move(point)
          if (current.picture.over()) {
            if (now.play(card)) {
              current.picture.drop(card.id, release)
              return
            }
            // Not played (prompt 51): why, from the moment of the drop - the table's reason, Forge's for a land, or that Forge
            // offers nothing now; one toast that the next drop replaces, never one per move.
            const reason = cardDrop(card, HAND_PLACE, now.moment).reason
            if (reason !== null) toast(reason, { id: "hand-drop", position: "top-center" })
          }
        }
        const rest = list.current?.querySelector<HTMLElement>(`:scope > [data-hand-card="${current.key}"] [data-slot="game-card-face"]`) ?? null
        current.picture.back(rest, release)
      },
    },
  })
  const rowStyle = (
    fan === null
      ? {}
      : {
          "--hand-card-w": `${fan.cardWidth}px`,
          "--hand-card-h": `${fan.cardHeight}px`,
          "--hand-gap": `${fan.gap}px`,
          "--hand-sink": `${fan.sink}px`,
          "--hand-lift-scale": fan.lift.scale,
          "--hand-lift-y": `${fan.lift.y}px`,
        }
  ) as CSSProperties
  return (
    <GameCardRow
      ref={list}
      aria-label={`Deine Hand: ${cards.length === 1 ? "1 Karte" : `${cards.length} Karten`}`}
      controls={cards.some(isVisible)}
      className="table-hand h-full"
      data-fan={fan?.mode ?? "fan"}
      style={rowStyle}
      {...press}
    >
      {cards.map((card, index) => {
        const key = keys[index]!
        const place = fan?.cards[index]
        return (
          <GameCardRowItem
            key={key}
            data-hand-card={key}
            data-lifted={(lifted === key && draggedNow !== key) || undefined}
            data-dragging={draggedNow === key || undefined}
            style={place === undefined ? undefined : ({ "--rot": `${place.rotate}deg`, "--drop": `${place.drop}px` } as CSSProperties)}
          >
            {isVisible(card) ? (
              <TableCard card={card} place={HAND_PLACE} pictures={pictures} fan />
            ) : (
              <TableCardBack>
                <span className="sr-only">verdeckte Karte</span>
              </TableCardBack>
            )}
          </GameCardRowItem>
        )
      })}
    </GameCardRow>
  )
}
