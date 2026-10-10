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
 * opens the card view (card-sheet.tsx), which sends nothing. A tap (Forge's
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
 * Priority, stack and phases (prompt 16): the header shows where in its turn
 * the game is (a track of the turn's steps beside Forge's step) and whose
 * turn it is; the stack shows each item with its card (a spell's own card
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
 * Targets and payment (prompt 17): a player Forge's running input would take
 * - a target, a choice, the one paying life for Phyrexian mana - is a control
 * too: their name and life total carry Forge's mark and tap at once
 * (onTapPlayer, Forge's player.tap), like the cards of a selection. The card
 * the running step is about (the spell being cast, an ability's source) says
 * so in a chip above its picture ("Quelle"). The decision region shows the payment:
 * what is still to pay, floating mana to pay with (onUseMana).
 */
import { CircleSlash, Crosshair, Crown, Hourglass, Layers, ScrollText, Shield, Swords } from "lucide-react"
import { cn } from "cn"
import { createContext, use, useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import type { AnswerBody, Card, GameEvent, GameState, ManaColor, Question, VisibleCard } from "@openmana/engine-protocol"
import { Badge } from "@/components/ui/badge"
import { GameBoard, GameBoardArea, type GameBoardDecision } from "@/components/ui/game-board"
import { GameCard, GameCardButton, GameCardCaption, GameCardGroup, GameCardRow, GameCardRowButton, GameCardRowItem } from "@/components/ui/game-card"
import { GameHelpButton } from "@/components/ui/game-help-button"
import { GameZoneButton } from "@/components/ui/game-zone-button"
import { GamePlayer, GamePlayerButton } from "@/components/ui/game-player"
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import { PhaseTrack, PhaseTrackGroup, PhaseTrackStep } from "@/components/ui/phase-track"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { useCardPress } from "@/hooks/use-card-press"
import { useElementHeight } from "@/hooks/use-element-height"
import { ARMING_MS, CardSheet, type CardLook } from "./card-sheet"
import { questionCard, type CardBrowse } from "./card-view-model"
import { HelpSheet } from "./help-sheet"
import { STACK_TARGET_LABEL, stackTargetIds } from "./beginner-help"
import { HistorySheet } from "./history-sheet"
import { ZoneSheet, type ZoneLook } from "./zone-sheet"
import { cardUse, currentStep, openSelection, playerUse, stepSource, type CardPlace, type CardUse, type TableMoment } from "./card-use"
import { currentDecision } from "./decision-model"
import { DecisionPanel, decisionNeedsRoom } from "./decision-panel"
import { aiProfileLabel, PHASE_LABELS, phaseLabel } from "./game-labels"
import { STACK_KIND_LABELS, TURN_PHASE_LABELS, turnOwnerLabel } from "./priority-labels"
import type { TableCardLookup } from "./table-cards"
import {
  attackLine,
  blockLine,
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
  stackEntryName,
  stackOwner,
  stackTargets,
} from "./table-labels"
import { pileOf, isVisible, tableView, type BoardEntry, type CombatView, type Seat, type StackEntryView, type TableSide, type TableView } from "./table-model"
import { TablePicture } from "./table-picture"
import { CardChip, rowSize, ValuePlaque } from "./table/card-parts"
import { TableArt, TableCardBack, TableEmblem } from "./table/table-art"
import { MedallionFace, StripChip, ZoneCount, ZoneCounter, ZonePile } from "./table/strip-parts"
import { TableSurface } from "./table/table-surface"
import { TURN_PHASES, turnSteps } from "./turn-model"

/** Below this height a battlefield shows its cards in one row instead of two (px, measured). */
const TWO_ROWS_MIN_HEIGHT = 176
const EMPTY_HISTORY: readonly GameEvent[] = []

export interface GameTableProps {
  readonly replay?: boolean
  readonly state: GameState
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
}

/** What a card of the table needs to be operated: the moment's questions and Forge's state of waiting, and the two ways to use it. */
interface CardControls {
  readonly targets: { readonly cards: ReadonlySet<number>; readonly players: ReadonlySet<number> }
  readonly moment: TableMoment
  /** Taps can be sent (the page gave onTapCard). */
  readonly live: boolean
  readonly look: (id: number) => void
  readonly primary: (card: VisibleCard, use: CardUse) => void
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
}: GameTableProps) {
  const view = useMemo(() => tableView(state, questions), [state, questions])
  const profile = profileDrawn ? `${aiProfileLabel(aiProfile)} (zufällig)` : aiProfileLabel(aiProfile)
  const moment = useMemo<TableMoment>(() => ({ questions, waiting, conceding, attack: state.attack ?? null, combat: state.combat }), [questions, waiting, conceding, state.attack, state.combat])
  const [look, setLook] = useState<CardLook | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpPhaseId = useId()
  const helpOwnerId = useId()
  const targets = useMemo(() => ({ cards: stackTargetIds(state, "card"), players: stackTargetIds(state, "player") }), [state])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inspectingHistory, setInspectingHistory] = useState(false)
  const [zone, setZone] = useState<ZoneLook | null>(null)
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
      primary: (card, use) => {
        const now = performance.now()
        const last = lastTap.current
        if (last !== null && last.id === card.id && now - last.at < ARMING_MS) return
        if (onTapCard === undefined || use.primary !== "tap") {
          open(card.id)
          return
        }
        lastTap.current = { id: card.id, at: now }
        onTapCard(card.id)
      },
      tapPlayer: onTapPlayer === undefined ? null : tapPlayer,
      lookZone: (player, zone) => setZone({ kind: "zone", player, zone }),
    }
  }, [moment, targets, onTapCard, onTapPlayer, tapPlayer, openCard])
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
            <span className="flex min-w-0 items-center gap-2">
              {/* On a phone narrower than 400 px the track (a picture of the step's words) gives way to the words themselves. */}
              <TurnTrack phase={state.phase} className="hoch:max-[25rem]:hidden" />
              <span id={helpPhaseId} className="truncate text-xs leading-tight font-medium" title={phaseLabel(state.phase)}>
                {phaseLabel(state.phase)}
              </span>
            </span>
          </GameHelpButton>
          {replay ? <Badge variant="secondary">Wiedergabe</Badge> : conceding ? (
            <Badge variant="secondary">
              <Spinner data-icon="inline-start" aria-hidden />
              Gibt auf …
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
          <StackAndCombat view={view} pictures={pictures} />
        </GameBoardArea>

        <GameBoardArea area="field" aria-label="Dein Spielfeld" className="flex flex-col">
          {view.me ? <Field side={view.me} pictures={pictures} nearRow="top" owner="dir" /> : <FieldEmpty text="Forge nennt keinen Platz für dich." />}
        </GameBoardArea>

        <GameBoardArea area="me" aria-label="Du">
          {view.me ? <PlayerBar side={view.me} profile={null} pictures={pictures} /> : null}
        </GameBoardArea>

        <GameBoardArea area="hand" aria-label="Deine Hand">
          <Hand cards={view.me?.hand ?? []} pictures={pictures} />
        </GameBoardArea>

        {/* The decision last: the order of hoch (its action bar at the very bottom) is the reading and focus order of every layout. */}
        <GameBoardArea ref={decisionArea} area="decision" aria-label="Entscheidung" tabIndex={0}>
          <DecisionPanel
            state={state}
            questions={questions}
            prompt={prompt}
            waiting={waiting}
            conceding={conceding}
            pictures={pictures}
            alerts={alerts}
            onLook={lookAtQuestionCard}
            {...(onAnswer !== undefined ? { onAnswer } : {})}
            {...(onTapPlayer !== undefined ? { onTapPlayer: tapPlayer } : {})}
            {...(onTapCard !== undefined ? { onTapCard: tapCardNow } : {})}
            {...(onUseMana !== undefined ? { onUseMana } : {})}
          />
        </GameBoardArea>
        <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} state={state} questions={questions} replay={replay} waiting={waiting} conceding={conceding} />
        <ZoneSheet onSourceChange={setZone} source={zone} state={state} pictures={pictures} onClose={() => setZone(null)} onLook={openCard} />
        <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} history={history} state={state} questions={questions} onLook={(id) => { lookAtQuestionCard(id); setInspectingHistory(true) }} />
        <CardSheet
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
 * Where in its turn the game is (prompt 16): the turn's steps as a track,
 * Forge's step wide in gold, the ones before it muted - the picture of the
 * header's words (each bar names its step as a tooltip). Before the first
 * turn there is none.
 */
function TurnTrack({ phase, className }: { phase: GameState["phase"]; className?: string }) {
  if (phase === null) return null
  const steps = turnSteps(phase)
  return (
    <PhaseTrack data-phase={phase} className={className}>
      {TURN_PHASES.map((group) => (
        <PhaseTrackGroup key={group.key} title={TURN_PHASE_LABELS[group.key]}>
          {steps
            .filter((step) => step.phase === group.key)
            .map((step) => (
              <PhaseTrackStep key={step.step} state={step.state} title={PHASE_LABELS[step.step]} />
            ))}
        </PhaseTrackGroup>
      ))}
    </PhaseTrack>
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
function PlayerBar({ side, profile, pictures }: { side: TableSide; profile: string | null; pictures: TableCardLookup }) {
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
    <GameCardRow controls aria-label={label} className="h-10 flex-none items-center justify-start gap-1 overflow-visible p-0">
      {items}
    </GameCardRow>
  ) : (
    <ul aria-label={label} className="table-hand-backs hidden h-8 items-center @md:flex quadrat:h-9 breit:h-10 breit:short:h-8">
      {items}
    </ul>
  )
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
}) {
  const controls = use(CardControlsContext)
  if (controls === null) throw new Error("TableCard outside GameTable")
  const found = cardUse(card, place, controls.moment)
  // Only looked at (no page to send taps): the primary activation looks too.
  const usage: CardUse = controls.live ? found : { ...found, primary: "look" }
  const press = useCardPress({ onPrimary: () => controls.primary(card, usage), onLook: () => controls.look(card.id) })
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
        aria-label={label}
        title={label}
        {...(usage.primary === "look" ? { "aria-haspopup": "dialog" as const } : {})}
        {...(caption !== undefined ? { caption } : target ? { caption: <GameCardCaption title={STACK_TARGET_LABEL}><TargetChip /></GameCardCaption> } : {})}
        {...press}
      >
        <TablePicture card={card} pictures={pictures} />
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
 * every other fact as a chip above the picture - the pile's size, "Ziel",
 * "Quelle", Forge's reason it would not attack, the block step's words,
 * combat and summoning sickness as signs, damage, counters and the rest in
 * words -, the whole of it in the chip line's title and the card's name for
 * screen readers.
 */
function FieldCard({ card, count, pictures, seat, note }: { card: VisibleCard; count: number; pictures: TableCardLookup; seat: Seat; note?: string }) {
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
      {...(value !== null ? { plaque: <ValuePlaque value={value} /> } : {})}
      {...(card.attacking === true ? { combat: "attacking" as const } : card.blocking === true ? { combat: "blocking" as const } : {})}
      caption={
        <GameCardCaption title={title}>
          {count > 1 ? <CardChip tone="pile">×{count}</CardChip> : null}
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
          {card.sick ? (
            <CardChip>
              <Hourglass aria-hidden />
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
  const card = <FieldCard card={entry.card} count={entry.ids.length} pictures={pictures} seat={seat} />
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

/** The stack (top first, Forge's order) and the combat, in Forge's words and the table's names. */
function StackAndCombat({ view, pictures }: { view: TableView; pictures: TableCardLookup }) {
  const { stack, combat } = view
  const controls = use(CardControlsContext)
  const blocking = controls !== null && currentStep(controls.moment.questions) === "block" && openSelection(controls.moment.questions) === null && !controls.moment.questions.some((q) => q.blocking)
  if (stack.length === 0 && combat.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center">
        {/* In hoch a bar between the battlefields: an empty one is a line (its words for screen readers); in a column its words. */}
        <Separator className="quadrat:hidden breit:hidden" />
        <p className="px-3 py-2 text-xs text-muted-foreground hoch:sr-only">Der Stapel ist leer, niemand kämpft.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 px-3 py-2 text-xs">
      {stack.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h2 className="font-medium text-muted-foreground">
            Stapel{stack.length > 1 ? ` · ${stack.length} Einträge` : null}
          </h2>
          <ol className="flex flex-col gap-1">
            {stack.map((entry, index) => (
              <StackEntry key={entry.id} entry={entry} top={index === 0} pictures={pictures} />
            ))}
          </ol>
        </div>
      ) : null}
      {combat.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h2 className="font-medium text-muted-foreground">{blocking ? "Blocks · noch nicht bestätigt" : "Kampf"}</h2>
          <ul className="flex flex-col gap-0.5">
            {combatLines(combat, blocking).map((line) => (
              <li key={line.key} data-combat-attacker={line.view.attacker.id}>
                {blocking && line.view.attacker.card?.highlighted === true ? <><Badge variant="outline">Blockziel</Badge>{" "}</> : null}
                <span className="font-medium">
                  {line.count > 1 ? `${line.count} × ` : null}
                  {cardName(line.view.attacker.card)}
                </span>{" "}
                {attackLine(line.view)} – {blockLine(line.view)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * One item of the stack (prompt 16): its card's picture (a spell's own card,
 * an ability's source; it opens the card view - a card on the stack is only
 * looked at, never tapped), its name, what it is (Forge's flags), whose it is,
 * its targets, and Forge's own description of it.
 */
function StackEntry({ entry, top, pictures }: { entry: StackEntryView; top: boolean; pictures: TableCardLookup }) {
  const controls = use(CardControlsContext)
  if (controls === null) throw new Error("StackEntry outside GameTable")
  const name = stackEntryName(entry)
  const owner = stackOwner(entry.controller)
  const targets = stackTargets(entry)
  const card = entry.card
  const target = card !== null && controls.targets.cards.has(card.id)
  const facts = [STACK_KIND_LABELS[entry.kind], ...(owner !== null ? [owner] : []), ...(targets !== null ? [targets] : [])]
  return (
    <Item asChild variant="outline" size="xs">
      <li data-stack-item={entry.id}>
        {card !== null || entry.hidden ? (
          <ItemMedia className="h-10 self-start">
            {card !== null ? (
              <GameCardButton
                data-stack-card={card.id}
                data-stack-target={target || undefined}
                mark={target ? "target" : null}
                aria-label={`${cardName(card)} ansehen${target ? ` · ${STACK_TARGET_LABEL}` : ""}`}
                aria-haspopup="dialog"
                title={`${cardName(card)}${target ? ` · ${STACK_TARGET_LABEL}` : ""}`}
                onClick={() => controls.look(card.id)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  controls.look(card.id)
                }}
              >
                <TablePicture card={card} pictures={pictures} />
              </GameCardButton>
            ) : (
              <TableCardBack>
                <span className="sr-only">verdeckte Karte</span>
              </TableCardBack>
            )}
          </ItemMedia>
        ) : null}
        <ItemContent className="min-w-0">
          <ItemTitle className="text-xs">
            {name ?? STACK_KIND_LABELS[entry.kind]}
            {top ? (
              <Badge variant="outline" title="Wird als Nächstes verrechnet">
                oben
              </Badge>
            ) : null}
          </ItemTitle>
          <p>{facts.join(" · ")}</p>
          {entry.text !== null && entry.text.trim() !== "" ? <p className="line-clamp-2 text-muted-foreground">{entry.text}</p> : null}
        </ItemContent>
      </li>
    </Item>
  )
}

/**
 * Combat in lines. Unblocked attackers that are the same card in the same
 * state (Forge's values, like a pile on the battlefield) attacking the same
 * target share a line ("13 × Goblin greift Forge-KI an – ungeblockt").
 */
function combatLines(combat: readonly CombatView[], blocking = false): { readonly key: string; readonly view: CombatView; readonly count: number }[] {
  const lines: { key: string; view: CombatView; count: number; signature: string | null }[] = []
  for (const view of combat) {
    const card = view.attacker.card
    const signature =
      !blocking && card !== null && view.blockers.length === 0 ? JSON.stringify([card.key, card.name, card.power, card.toughness, card.damage, card.counters ?? null, view.defender]) : null
    const same = signature === null ? undefined : lines.find((line) => line.signature === signature)
    if (same) same.count++
    else lines.push({ key: String(view.attacker.id), view, count: 1, signature })
  }
  return lines
}

/** Your hand, always at the bottom and fully visible - side by side, scrolling sideways (the table redesign fans it, prompt 42: docs/design/SPIELTISCH.md). */
function Hand({ cards, pictures }: { cards: readonly Card[]; pictures: TableCardLookup }) {
  if (cards.length === 0) return <FieldEmpty text="Deine Hand ist leer." />
  return (
    <GameCardRow aria-label={`Deine Hand: ${cards.length === 1 ? "1 Karte" : `${cards.length} Karten`}`} controls={cards.some(isVisible)} className="h-full">
      {cards.map((card, index) => (
        <GameCardRowItem key={isVisible(card) ? card.id : `hidden:${index}`}>
          {isVisible(card) ? (
            <TableCard card={card} place={{ zone: "hand", mine: true }} pictures={pictures} />
          ) : (
            <TableCardBack>
              <span className="sr-only">verdeckte Karte</span>
            </TableCardBack>
          )}
        </GameCardRowItem>
      ))}
    </GameCardRow>
  )
}
