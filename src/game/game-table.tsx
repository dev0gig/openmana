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
 * Forge's decisions (prompt 15): the decision region above the hand shows
 * what Forge asks and lets the player answer it (decision-panel.tsx) - the
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
 * Targets and payment (prompt 17): a player Forge's running input would take
 * - a target, a choice, the one paying life for Phyrexian mana - is a control
 * too: their name and life total carry Forge's mark and tap at once
 * (onTapPlayer, Forge's player.tap), like the cards of a selection. The card
 * the running step is about (the spell being cast, an ability's source) says
 * so below its picture ("Quelle"). The decision region shows the payment:
 * what is still to pay, floating mana to pay with (onUseMana).
 */
import { Ban, CircleSlash, Crown, Hand as HandIcon, Heart, History, Hourglass, Library, Shield, Skull, Swords, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import { createContext, use, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { AnswerBody, Card, GameEvent, GameState, ManaColor, Question, VisibleCard } from "@openmana/engine-protocol"
import { Badge } from "@/components/ui/badge"
import { GameBoard, GameBoardArea, type GameBoardDecision } from "@/components/ui/game-board"
import { GameCard, GameCardBack, GameCardButton, GameCardCaption, GameCardGroup, GameCardRow, GameCardRowButton, GameCardRowItem } from "@/components/ui/game-card"
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
  captionFacts,
  cardButtonLabel,
  cardFacts,
  cardName,
  counterLabel,
  MANA_LABELS,
  playerButtonLabel,
  seatName,
  SOURCE_LABEL,
  stackEntryName,
  stackOwner,
  stackTargets,
} from "./table-labels"
import { pileOf, isVisible, tableView, type BoardEntry, type CombatView, type Seat, type StackEntryView, type TableSide, type TableView } from "./table-model"
import { TablePicture } from "./table-picture"
import { TURN_PHASES, turnSteps } from "./turn-model"

/** Below this height a battlefield shows its cards in one row instead of two (px, measured). */
const TWO_ROWS_MIN_HEIGHT = 176
const EMPTY_HISTORY: readonly GameEvent[] = []

export interface GameTableProps {
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
  readonly moment: TableMoment
  /** Taps can be sent (the page gave onTapCard). */
  readonly live: boolean
  readonly look: (id: number) => void
  readonly primary: (card: VisibleCard, use: CardUse) => void
  /** Taps a player (prompt 17); null: the table is only looked at. */
  readonly tapPlayer: ((player: number) => void) | null
}

const CardControlsContext = createContext<CardControls | null>(null)

export function GameTable({
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
  // Words that do not fit may take the stack's place too where it has nothing to show (a low landscape window).
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
    }
  }, [moment, onTapCard, onTapPlayer, tapPlayer, openCard])
  return (
    <CardControlsContext value={controls}>
      <GameBoard decision={room}>
        <title>Partie · OpenMana</title>
        <GameBoardArea area="header" aria-label="Spielstand" className="flex items-center gap-2 px-2 py-1">
          {menu}
          <GameZoneButton aria-label="Zonen ansehen" title="Zonen ansehen" aria-haspopup="dialog" disabled={state.players.length === 0} onClick={() => { const player = state.players.find((p) => p.me) ?? state.players[0]; if (player !== undefined) setZone({ kind: "zone", player: player.id, zone: "graveyard" }) }}>
            <Library aria-hidden />
          </GameZoneButton>
          <GameZoneButton aria-label="Spielverlauf ansehen" title={`Spielverlauf: ${history.length} Einträge`} aria-haspopup="dialog" onClick={() => setHistoryOpen(true)}><History aria-hidden /></GameZoneButton>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="sr-only">Partie</h1>
            <p className="truncate text-sm font-medium" title={turnLine(view.turn, state.phase)}>
              {turnLine(view.turn, state.phase)}
            </p>
            <div className="flex min-w-0 items-center gap-2">
              <TurnTrack phase={state.phase} />
              <p className="truncate text-xs text-muted-foreground">{turnOwnerLabel(view.activeSeat)}</p>
            </div>
          </div>
          {conceding ? (
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

        <GameBoardArea area="hand" aria-label="Deine Hand">
          <Hand cards={view.me?.hand ?? []} pictures={pictures} />
        </GameBoardArea>
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

/** "Zug 3 · Erste Hauptphase", before the first turn "Vor dem ersten Zug". */
function turnLine(turn: number, phase: GameState["phase"]): string {
  return turn > 0 ? `Zug ${turn} · ${phaseLabel(phase)}` : phaseLabel(phase)
}

/**
 * Where in its turn the game is (prompt 16): the turn's steps as a track,
 * Forge's step wide in gold, the ones before it muted - the picture of the
 * header's words (each bar names its step as a tooltip). Before the first
 * turn there is none.
 */
function TurnTrack({ phase }: { phase: GameState["phase"] }) {
  if (phase === null) return null
  const steps = turnSteps(phase)
  return (
    <PhaseTrack data-phase={phase}>
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
 * A zone's size with its word ("Hand 7"). Where the bar is narrow (a phone,
 * the side column) the word gives way to its symbol; screen readers and the
 * tooltip keep the word.
 */
function Count({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap" title={label}>
      <Icon aria-hidden className="size-3.5" />
      <span className="sr-only @md:not-sr-only">{label} </span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </span>
  )
}

/** A player's line: who, life, the sizes of the zones, mana, counters, commanders - and the opponent's hand as backs. */
function PlayerBar({ side, profile, pictures }: { side: TableSide; profile: string | null; pictures: TableCardLookup }) {
  const { player, counts } = side
  const me = side.seat === "me"
  return (
    <div className="@container flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs text-muted-foreground">
      <SeatPlayer side={side} />
      {profile !== null || side.active || player.hasPriority || player.lost ? (
        <span className="flex items-center gap-1.5">
          {profile !== null ? <Badge variant="secondary">{profile}</Badge> : null}
          {side.active ? <Badge variant="outline">am Zug</Badge> : null}
          {player.hasPriority ? <Badge variant="outline">Priorität</Badge> : null}
          {player.lost ? <Badge variant="destructive">verloren</Badge> : null}
        </span>
      ) : null}
      <Count label="Hand" value={counts.hand} icon={HandIcon} />
      <Count label="Bibliothek" value={counts.library} icon={Library} />
      <Count label="Friedhof" value={counts.graveyard} icon={Skull} />
      <Count label="Exil" value={counts.exile} icon={Ban} />
      {counts.command > 0 ? <Count label="Kommandozone" value={counts.command} icon={Crown} /> : null}
      {side.mana.length > 0 ? (
        <span className="whitespace-nowrap">
          Manavorrat{" "}
          <span className="font-medium text-foreground">{side.mana.map(({ color, amount }) => `${amount} ${MANA_LABELS[color]}`).join(", ")}</span>
        </span>
      ) : null}
      {side.counters.map(({ name, amount }) => {
        const label = counterLabel(name)
        return (
          <span key={name} className="whitespace-nowrap">
            <span {...(label.english ? { lang: "en" } : {})}>{label.text}</span> <span className="font-medium text-foreground tabular-nums">{amount}</span>
          </span>
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
      {me ? null : <OpponentHand cards={side.hand} pictures={pictures} />}
    </div>
  )
}

/**
 * Who a seat is and their life total - and, where Forge's running input
 * would take the player (a target, a choice, life for mana; card-use.ts
 * playerUse), the button for it with Forge's mark: it taps at once, like the
 * cards of a selection. Without a tap it is only read, with Forge's
 * highlight (chosen) if any.
 */
function SeatPlayer({ side }: { side: TableSide }) {
  const controls = use(CardControlsContext)
  if (controls === null) throw new Error("SeatPlayer outside GameTable")
  const { player } = side
  const usage = playerUse(player, controls.moment)
  const name = side.seat === "me" ? "Du" : seatName(side.seat)
  const content = (
    <>
      <span className="font-heading text-sm font-semibold text-foreground">{name}</span>
      <span className="flex items-center gap-1 text-foreground" title="Lebenspunkte">
        <Heart aria-hidden className="size-4" />
        <span className="text-base font-semibold tabular-nums">{player.life}</span>
        <span className="sr-only">Lebenspunkte</span>
      </span>
    </>
  )
  const tapPlayer = controls.tapPlayer
  if (usage.tap === null || tapPlayer === null) {
    return (
      <GamePlayer data-player={player.id} mark={usage.mark} {...(usage.markLabel !== null ? { title: `${name}: ${usage.markLabel}` } : {})}>
        {content}
        {usage.markLabel !== null ? <span className="sr-only">, {usage.markLabel}</span> : null}
      </GamePlayer>
    )
  }
  const label = playerButtonLabel(name, player.life, usage)
  return (
    <GamePlayerButton
      data-player={player.id}
      mark={usage.mark}
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
      <span className="whitespace-nowrap">
        {named ? `${isVisible(commander.card) ? cardName(commander.card) : "Verdeckter Kommandeur"}: ` : null}Kommandeursteuer{" "}
        <span className="font-medium text-foreground tabular-nums">{commander.tax}</span>
      </span>
      {commander.damage.map((dealt) => (
        <span key={dealt.player} className="whitespace-nowrap">
          <span className="font-medium text-foreground tabular-nums">{dealt.amount}</span> Kommandeurschaden{" "}
          {dealt.player === playerId ? "an sich" : me ? "an Forge-KI" : "an dich"}
        </span>
      ))}
    </>
  )
}

/**
 * The opponent's hand: backs for what Forge hides, the card for what it
 * reveals (a card to look at). Where the bar is narrow (a phone, the side
 * column) only revealed cards take a row - the backs would only repeat the
 * hand's size shown beside them.
 */
function OpponentHand({ cards, pictures }: { cards: readonly Card[]; pictures: TableCardLookup }) {
  if (cards.length === 0) return null
  const revealed = cards.some(isVisible)
  const label = `Hand der Forge-KI: ${cards.length === 1 ? "1 Karte" : `${cards.length} Karten`}`
  // Revealed cards take their own place (no overlap) and a height a finger can hit (WCAG 2.5.8: 24 px).
  const items = cards.map((card, index) => (
    <GameCardRowItem key={isVisible(card) ? card.id : `hidden:${index}`} className={cn(revealed ? null : "-ml-2.5 first:ml-0", isVisible(card) ? null : "hidden @md:block")}>
      {isVisible(card) ? (
        <TableCard card={card} place={{ zone: "hand", mine: false }} pictures={pictures} />
      ) : (
        <GameCardBack>
          <span className="sr-only">verdeckte Karte</span>
        </GameCardBack>
      )}
    </GameCardRowItem>
  ))
  return revealed ? (
    <GameCardRow controls aria-label={label} className="h-10 flex-none items-center justify-start gap-1 overflow-visible p-0">
      {items}
    </GameCardRow>
  ) : (
    <ul aria-label={label} className="hidden h-7 items-center @md:flex">
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
function TableCard({ card, place, pictures, count = 1, note, caption }: { card: VisibleCard; place: CardPlace; pictures: TableCardLookup; count?: number; note?: string; caption?: ReactNode }) {
  const controls = use(CardControlsContext)
  if (controls === null) throw new Error("TableCard outside GameTable")
  const found = cardUse(card, place, controls.moment)
  // Only looked at (no page to send taps): the primary activation looks too.
  const usage: CardUse = controls.live ? found : { ...found, primary: "look" }
  const press = useCardPress({ onPrimary: () => controls.primary(card, usage), onLook: () => controls.look(card.id) })
  const label = cardButtonLabel(card, usage, { count, ...(note ? { note } : {}) })
  return (
    <GameCardRowButton>
      <GameCardButton
        tapped={card.tapped}
        mark={usage.mark}
        data-card={card.id}
        aria-label={label}
        title={label}
        {...(usage.primary === "look" ? { "aria-haspopup": "dialog" as const } : {})}
        {...(caption !== undefined ? { caption } : {})}
        {...press}
      >
        <TablePicture card={card} pictures={pictures} />
      </GameCardButton>
    </GameCardRowButton>
  )
}

/**
 * A card on the battlefield with its facts in the caption strip (never on the
 * picture): the pile's size and combat as signs, the rest in words; the whole
 * of it in the card's name for screen readers.
 */
function FieldCard({ card, count, pictures, seat, note }: { card: VisibleCard; count: number; pictures: TableCardLookup; seat: Seat; note?: string }) {
  const controls = use(CardControlsContext)
  // The card the running step is about (an ability's source while its targets or costs are chosen - prompt 17).
  const source = controls !== null && stepSource(controls.moment.questions) === card.id
  // While attackers are declared: why Forge would not declare this creature (prompt 18) - said in the caption, in place of its facts.
  const usage = controls === null ? null : cardUse(card, { zone: "battlefield", mine: seat === "me" }, controls.moment)
  const unavailable = usage?.unavailable ?? null
  const blockLabel = controls !== null && currentStep(controls.moment.questions) === "block" && openSelection(controls.moment.questions) === null ? usage?.markLabel ?? null : null
  const title = [cardName(card), ...cardFacts(card, count), ...(note ? [note] : []), ...(source ? [SOURCE_LABEL] : []), ...(blockLabel !== null ? [blockLabel] : []), ...(unavailable !== null ? [`kann nicht angreifen: ${unavailable.short}`] : [])].join(" · ")
  return (
    <TableCard
      card={card}
      place={{ zone: "battlefield", mine: seat === "me" }}
      pictures={pictures}
      count={count}
      {...(note ? { note } : {})}
      caption={
        <GameCardCaption title={title}>
          {count > 1 ? <span className="font-medium text-foreground">{count}×</span> : null}
          {card.attacking === true ? <Swords aria-hidden /> : null}
          {card.blocking === true ? <Shield aria-hidden /> : null}
          {card.sick ? <Hourglass aria-hidden /> : null}
          {source ? <span className="font-medium text-foreground">{SOURCE_LABEL}</span> : null}
          {unavailable !== null ? <CircleSlash aria-hidden /> : null}
          <span className="truncate">{unavailable !== null ? unavailable.short : blockLabel ?? captionFacts(card).join(" · ")}</span>
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
              <span className="truncate">verdeckt</span>
            </GameCardCaption>
          }
        >
          <GameCardBack>
            <span className="sr-only">verdeckte Karte</span>
          </GameCardBack>
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

/** Whether a row shows a card the player may see (then it is a toolbar of cards; see GameCardRow). */
function hasCards(entries: readonly BoardEntry[], command: readonly Card[] = []): boolean {
  return entries.some((entry) => entry.kind === "card") || command.some(isVisible)
}

function FieldEmpty({ text }: { text: string }) {
  return <p className="m-auto px-3 text-center text-xs text-muted-foreground">{text}</p>
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
              <Crown aria-hidden />
              <span className="truncate">Kommandozone</span>
            </GameCardCaption>
          }
        />
      ) : (
        <GameCard
          caption={
            <GameCardCaption title="Kommandozone">
              <Crown aria-hidden />
              <span className="truncate">Kommandozone</span>
            </GameCardCaption>
          }
        >
          <GameCardBack>
            <span className="sr-only">verdeckte Karte</span>
          </GameCardBack>
        </GameCard>
      )}
    </GameCardRowItem>
  ))
  const entries = (list: readonly BoardEntry[]) => list.map((entry) => <Entry key={entry.key} entry={entry} pictures={pictures} seat={side.seat} />)
  let rows: ReactNode
  if (empty) rows = <FieldEmpty text={`Auf dem Spielfeld von ${owner === "dir" ? "dir" : "der Forge-KI"} liegt nichts.`} />
  else if (!twoRows) {
    rows = (
      <GameCardRow aria-label={`Bleibende Karten von ${owner}`} controls={hasCards([...creatures, ...others], command)}>
        {commandItems}
        {entries(creatures)}
        {entries(others)}
      </GameCardRow>
    )
  } else {
    const near = (
      <GameCardRow key="near" aria-label={`Kreaturen von ${owner}`} controls={hasCards(creatures)}>
        {creatures.length > 0 ? entries(creatures) : <GameCardRowItem className="m-auto h-auto text-xs text-muted-foreground">Keine Kreaturen</GameCardRowItem>}
      </GameCardRow>
    )
    const outer = (
      <GameCardRow key="outer" aria-label={`Länder und weitere bleibende Karten von ${owner}`} controls={hasCards(others, command)}>
        {commandItems}
        {others.length > 0 ? (
          entries(others)
        ) : command.length === 0 ? (
          <GameCardRowItem className="m-auto h-auto text-xs text-muted-foreground">Keine weiteren Karten</GameCardRowItem>
        ) : null}
      </GameCardRow>
    )
    rows = nearRow === "top" ? [near, <Separator key="line" />, outer] : [outer, <Separator key="line" />, near]
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
        <Separator className="landscape:hidden" />
        <p className="px-3 py-2 text-xs text-muted-foreground portrait:sr-only">Der Stapel ist leer, niemand kämpft.</p>
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
  const facts = [STACK_KIND_LABELS[entry.kind], ...(owner !== null ? [owner] : []), ...(targets !== null ? [targets] : [])]
  return (
    <Item asChild variant="outline" size="xs">
      <li data-stack-item={entry.id}>
        {card !== null || entry.hidden ? (
          <ItemMedia className="h-10 self-start">
            {card !== null ? (
              <GameCardButton
                data-stack-card={card.id}
                aria-label={`${cardName(card)} ansehen`}
                aria-haspopup="dialog"
                title={cardName(card)}
                onClick={() => controls.look(card.id)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  controls.look(card.id)
                }}
              >
                <TablePicture card={card} pictures={pictures} />
              </GameCardButton>
            ) : (
              <GameCardBack>
                <span className="sr-only">verdeckte Karte</span>
              </GameCardBack>
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

/** Your hand, always at the bottom and fully visible - side by side, scrolling sideways, never fanned (Anvil lesson). */
function Hand({ cards, pictures }: { cards: readonly Card[]; pictures: TableCardLookup }) {
  if (cards.length === 0) return <FieldEmpty text="Deine Hand ist leer." />
  return (
    <GameCardRow aria-label={`Deine Hand: ${cards.length === 1 ? "1 Karte" : `${cards.length} Karten`}`} controls={cards.some(isVisible)} className="h-full">
      {cards.map((card, index) => (
        <GameCardRowItem key={isVisible(card) ? card.id : `hidden:${index}`}>
          {isVisible(card) ? (
            <TableCard card={card} place={{ zone: "hand", mine: true }} pictures={pictures} />
          ) : (
            <GameCardBack>
              <span className="sr-only">verdeckte Karte</span>
            </GameCardBack>
          )}
        </GameCardRowItem>
      ))}
    </GameCardRow>
  )
}
