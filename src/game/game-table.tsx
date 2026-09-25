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
 * Answering Forge's questions follows (prompts 15-19): the decision region
 * shows what Forge asks and offers, and says that it cannot be answered here
 * yet.
 */
import { Ban, Crown, Hand as HandIcon, Heart, Library, Shield, Skull, Swords, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import { createContext, use, useMemo, useRef, useState, type ReactNode } from "react"
import type { Card, GameState, Question, VisibleCard } from "@openmana/engine-protocol"
import { Badge } from "@/components/ui/badge"
import { CardPicture } from "@/components/ui/card-picture"
import { GameBoard, GameBoardArea } from "@/components/ui/game-board"
import { GameCard, GameCardBack, GameCardButton, GameCardCaption, GameCardGroup, GameCardRow, GameCardRowButton, GameCardRowItem } from "@/components/ui/game-card"
import { Item, ItemContent, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useCardPress } from "@/hooks/use-card-press"
import { useElementHeight } from "@/hooks/use-element-height"
import { ARMING_MS, CardSheet, type CardLook } from "./card-sheet"
import { cardUse, directTaps, type CardPlace, type CardUse, type TableMoment } from "./card-use"
import { aiProfileLabel, phaseLabel, questionChoices, questionLabel } from "./game-labels"
import type { TableCardLookup } from "./table-cards"
import { attackLine, blockLine, captionFacts, cardButtonLabel, cardFacts, cardName, counterLabel, MANA_LABELS, seatName, stackTargets } from "./table-labels"
import { isVisible, tableView, type BoardEntry, type CombatView, type Seat, type TableSide, type TableView } from "./table-model"

/** Below this height a battlefield shows its cards in one row instead of two (px, measured). */
const TWO_ROWS_MIN_HEIGHT = 176

export interface GameTableProps {
  readonly state: GameState
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
}

/** What a card of the table needs to be operated: the moment's questions and Forge's state of waiting, and the two ways to use it. */
interface CardControls {
  readonly moment: TableMoment
  /** Taps can be sent (the page gave onTapCard). */
  readonly live: boolean
  readonly look: (id: number) => void
  readonly primary: (card: VisibleCard, use: CardUse) => void
}

const CardControlsContext = createContext<CardControls | null>(null)

export function GameTable({ state, questions, prompt, waiting, aiProfile, profileDrawn = false, pictures, menu, alerts, conceding = false, onTapCard }: GameTableProps) {
  const view = useMemo(() => tableView(state, questions), [state, questions])
  const profile = profileDrawn ? `${aiProfileLabel(aiProfile)} (zufällig)` : aiProfileLabel(aiProfile)
  const moment = useMemo<TableMoment>(() => ({ questions, waiting, conceding }), [questions, waiting, conceding])
  const [look, setLook] = useState<CardLook | null>(null)
  // The last card tapped at once and when: the second tap of a double tap counts once.
  const lastTap = useRef<{ readonly id: number; readonly at: number } | null>(null)
  const controls = useMemo<CardControls>(() => {
    const open = (id: number) => setLook((previous) => ({ id, open: true, serial: (previous?.serial ?? 0) + 1 }))
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
    }
  }, [moment, onTapCard])
  return (
    <CardControlsContext value={controls}>
      <GameBoard>
        <title>Partie · OpenMana</title>
        <GameBoardArea area="header" aria-label="Spielstand" className="flex items-center gap-2 px-2 py-1">
          {menu}
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="sr-only">Partie</h1>
            <p className="truncate text-sm font-medium" title={turnLine(view.turn, state.phase)}>
              {turnLine(view.turn, state.phase)}
            </p>
            <p className="truncate text-xs text-muted-foreground">{activeLine(view.activeSeat)}</p>
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
          <StackAndCombat view={view} />
        </GameBoardArea>

        <GameBoardArea area="field" aria-label="Dein Spielfeld" className="flex flex-col">
          {view.me ? <Field side={view.me} pictures={pictures} nearRow="top" owner="dir" /> : <FieldEmpty text="Forge nennt keinen Platz für dich." />}
        </GameBoardArea>

        <GameBoardArea area="me" aria-label="Du">
          {view.me ? <PlayerBar side={view.me} profile={null} pictures={pictures} /> : null}
        </GameBoardArea>

        <GameBoardArea area="decision" aria-label="Entscheidung" tabIndex={0} className="flex flex-col gap-2 px-3 py-2">
          {alerts}
          <Decision questions={questions} prompt={prompt} waiting={waiting} />
        </GameBoardArea>

        <GameBoardArea area="hand" aria-label="Deine Hand">
          <Hand cards={view.me?.hand ?? []} pictures={pictures} />
        </GameBoardArea>
        <CardSheet
          look={look}
          onOpenChange={(open) => setLook((previous) => (previous === null ? null : { ...previous, open }))}
          state={state}
          view={view}
          moment={moment}
          pictures={pictures}
          {...(onTapCard !== undefined ? { onTap: onTapCard } : {})}
        />
      </GameBoard>
    </CardControlsContext>
  )
}

/** "Zug 3 · Erste Hauptphase", before the first turn "Vor dem ersten Zug". */
function turnLine(turn: number, phase: GameState["phase"]): string {
  return turn > 0 ? `Zug ${turn} · ${phaseLabel(phase)}` : phaseLabel(phase)
}

function activeLine(seat: "me" | "opponent" | null): string {
  return seat === "me" ? "Du bist am Zug" : seat === "opponent" ? "Die Forge-KI ist am Zug" : "Die Starthände werden gezogen"
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
      <span className="flex items-center gap-1.5">
        <span className="font-heading text-sm font-semibold text-foreground">{me ? "Du" : seatName(side.seat)}</span>
        {profile !== null ? <Badge variant="secondary">{profile}</Badge> : null}
        {side.active ? <Badge variant="outline">am Zug</Badge> : null}
        {player.hasPriority ? <Badge variant="outline">Priorität</Badge> : null}
        {player.lost ? <Badge variant="destructive">verloren</Badge> : null}
      </span>
      <span className="flex items-center gap-1 text-foreground" title="Lebenspunkte">
        <Heart aria-hidden className="size-4" />
        <span className="text-base font-semibold tabular-nums">{player.life}</span>
        <span className="sr-only">Lebenspunkte</span>
      </span>
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

/** A card's picture from the catalog, a placeholder while it is looked up, or Forge's words for it. */
function Picture({ card, pictures }: { card: VisibleCard; pictures: TableCardLookup }) {
  const picture = pictures(card)
  const name = cardName(card)
  if (picture === "loading") {
    return (
      <Skeleton className="size-full rounded-xl">
        <span className="sr-only">{name}</span>
      </Skeleton>
    )
  }
  return (
    <CardPicture
      compact
      src={picture === "none" ? null : picture.src}
      {...(picture === "none" ? {} : { srcSet: picture.srcSet, sizes: "auto" })}
      alt={name}
      draggable={false}
      fallback={
        <>
          <span className="line-clamp-3 text-xs leading-tight font-medium">{name}</span>
          {card.typeLine ? <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">{card.typeLine}</span> : null}
        </>
      }
    />
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
        <Picture card={card} pictures={pictures} />
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
  const title = [cardName(card), ...cardFacts(card, count), ...(note ? [note] : [])].join(" · ")
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
          <span className="truncate">{captionFacts(card).join(" · ")}</span>
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
function StackAndCombat({ view }: { view: TableView }) {
  const { stack, combat } = view
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
          <h2 className="font-medium text-muted-foreground">Stapel</h2>
          <ol className="flex flex-col gap-1">
            {stack.map((entry, index) => {
              const targets = stackTargets(entry)
              return (
                <Item key={entry.id} asChild variant="outline" size="xs">
                  <li>
                    <ItemContent>
                      <ItemTitle className="text-xs">
                        {seatName(entry.controller)}
                        {index === 0 ? <Badge variant="outline">oben</Badge> : null}
                        {entry.trigger ? <Badge variant="secondary">ausgelöst</Badge> : null}
                      </ItemTitle>
                      <p>{entry.text ?? "Forge beschreibt diesen Eintrag nicht."}</p>
                      {targets !== null ? <p className="text-muted-foreground">{targets}</p> : null}
                    </ItemContent>
                  </li>
                </Item>
              )
            })}
          </ol>
        </div>
      ) : null}
      {combat.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h2 className="font-medium text-muted-foreground">Kampf</h2>
          <ul className="flex flex-col gap-0.5">
            {combatLines(combat).map((line) => (
              <li key={line.key}>
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
 * Combat in lines. Unblocked attackers that are the same card in the same
 * state (Forge's values, like a pile on the battlefield) attacking the same
 * target share a line ("13 × Goblin greift Forge-KI an – ungeblockt").
 */
function combatLines(combat: readonly CombatView[]): { readonly key: string; readonly view: CombatView; readonly count: number }[] {
  const lines: { key: string; view: CombatView; count: number; signature: string | null }[] = []
  for (const view of combat) {
    const card = view.attacker.card
    const signature =
      card !== null && view.blockers.length === 0 ? JSON.stringify([card.key, card.name, card.power, card.toughness, card.damage, card.counters ?? null, view.defender]) : null
    const same = signature === null ? undefined : lines.find((line) => line.signature === signature)
    if (same) same.count++
    else lines.push({ key: String(view.attacker.id), view, count: 1, signature })
  }
  return lines
}

/**
 * What Forge waits for: its prompt line, the question and the answers it
 * offers - shown, not yet answerable here (prompt 15). Where the step taps
 * cards at once (card-use.ts), it says so, and how to look at a card then.
 */
function Decision({ questions, prompt, waiting }: { questions: readonly Question[]; prompt: string | null; waiting: boolean }) {
  if (questions.length === 0) {
    return waiting ? (
      <p className="text-sm">{prompt ?? "Forge wartet auf dich."}</p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner aria-hidden />
        Forge rechnet …
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <h2 className="sr-only">Forge wartet auf deine Entscheidung</h2>
      {prompt !== null ? <p className="text-sm font-medium">{prompt}</p> : null}
      <ul className="flex flex-col gap-1.5">
        {questions.map((question) => {
          const choices = questionChoices(question)
          return (
            <li key={question.id} className="flex flex-col gap-1 text-sm">
              <span>
                <span className="text-xs text-muted-foreground">{questionLabel(question)}</span>
                {question.text && question.text !== prompt ? <span className="block">{question.text}</span> : null}
              </span>
              {choices.length > 0 ? (
                <span className="flex flex-wrap gap-1" aria-label="Antworten, die Forge anbietet">
                  {choices.map((choice) => (
                    <Badge key={choice} variant="outline">
                      {choice}
                    </Badge>
                  ))}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
      {waiting && directTaps(questions) ? (
        <p className="text-xs">Karten antippen wirkt hier sofort, ein zweiter Tipp nimmt es zurück. Lange drücken oder Rechtsklick zeigt eine Karte groß.</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Auf Forges Fragen kannst du hier noch nicht antworten. Karten ansehen geht immer, antippen dort, wo Forge es anbietet; aufgeben im Menü.
      </p>
    </div>
  )
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
