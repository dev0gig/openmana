/*
 * The game, from the moment the player starts it until its result: waiting
 * for the engine (its boot phases), Forge building the game, the running
 * game, the result - or why Forge did not start it, or why it ended without
 * a result. Every state comes from the engine session; a failure always
 * says what happened and offers a way on, so a start never looks frozen.
 *
 * A running game is the game table (prompt 13, game-table.tsx): it takes the
 * whole screen (the app's frame steps aside, src/app/immersive.tsx), and its
 * menu holds the way around the app, Forge's notices and conceding (asked
 * first). Cards can be looked at and - where Forge offers it - tapped (prompt
 * 14: the page hands the table the session's tapCard; a tap that cannot be
 * sent says why), and Forge's questions answered (prompt 15: the session's
 * answer; an answer that cannot be sent says why, one Forge refuses comes as
 * its notice).
 * Nothing here is invented or computed: who is who comes from the state's
 * `me` flags, the result from game.end.
 *
 * A running game lives only in this page: reloading or closing it ends the
 * game (the session asks first). The page says so.
 */
import { ImageOff, Menu, OctagonAlert, Swords, TriangleAlert } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, NavLink, useNavigate } from "react-router"
import { toast } from "sonner"
import type { AnswerBody, GameState, ManaColor } from "@openmana/engine-protocol"
import { useImmersive } from "@/app/immersive"
import { DESTINATIONS } from "@/app/navigation"
import { usePreferences } from "@/app/preferences"
import { useCardCatalog } from "@/cards/card-catalog-context"
import { InstallButton, InstallProgressView } from "@/cards/card-data-card"
import { CardDataErrorAlert } from "@/cards/card-error-alert"
import { FactList } from "@/components/fact-list"
import { Page } from "@/components/page-header"
import { ActionBar } from "@/components/ui/action-bar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { GameBoard, GameBoardArea } from "@/components/ui/game-board"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { readSelection, resolveSelection } from "@/decks/deck-selection"
import { BootSteps } from "@/engine/engine-panel"
import { abortTitle, formatSeconds } from "@/engine/engine-labels"
import type { EngineSnapshot, GameNotice, MatchSetup, MatchSnapshot } from "@/engine/engine-session"
import { useEngineSession } from "@/engine/engine-session-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { useNow } from "@/hooks/use-now"
import type { StoreName } from "@/storage/schema"
import { useStorageQuery } from "@/storage/storage-context"
import { DECK_FORMAT_LABELS } from "@/storage/storage-labels"
import {
  aiProfileLabel,
  endReason,
  formatDuration,
  phaseLabel,
  REFUSAL_ADVICE,
  REFUSAL_TITLES,
  REJECT_REASON_LABELS,
  resultWord,
  turnsLabel,
} from "./game-labels"
import { questionCards } from "./decision-model"
import { useGameStart, type StartState } from "./game-start"
import { GameTable } from "./game-table"
import { useTableCards } from "./table-cards"
import { visibleCards } from "./table-model"

const SELECTION_STORES: readonly StoreName[] = ["settings", "decks"]

/** After this long without the engine, the waiting page says that it takes longer than usual. */
const SLOW_BOOT_MS = 30_000

type Of<S extends MatchSnapshot["status"]> = Extract<MatchSnapshot, { status: S }>

export function GamePage() {
  const { snapshot, prewarm } = useEngineSession()
  const { engine, match } = snapshot
  const data = useStorageQuery(SELECTION_STORES, readSelection)
  const selection = data.status === "ready" ? resolveSelection(data.data.human, data.data.ai, data.data.decks) : null
  const noDecks = data.status === "ready" && data.data.decks.records.length === 0
  const { state: startState, start } = useGameStart({ data: data.status, noDecks, selection })
  const phone = useIsMobile()

  // A finished game's engine is spent (one game per engine): prepare the next one while the player reads the result.
  const over = match?.status === "over"
  const canStart = startState.enabled && startState.action === "start"
  useEffect(() => {
    if (over && engine.status === "idle" && canStart) prewarm()
  }, [over, engine.status, canStart, prewarm])

  const again = match?.status === "over" || match?.status === "aborted" ? <NewGameButton state={startState} start={start} /> : null
  const live = (
    <p className="sr-only" aria-live="polite">
      {announcement(match)}
    </p>
  )
  // The running game is the table: the whole screen, no page frame around it.
  if (match?.status === "playing") {
    return (
      <>
        {live}
        <Playing match={match} />
      </>
    )
  }
  return (
    <>
      {live}
      <GameFrame match={match} engine={engine} again={again} phone={phone} note={startState.enabled ? null : startState.note} />
    </>
  )
}

/** Every state but the running game: a page in the app's frame. */
function GameFrame({ match, engine, again, phone, note }: { match: Exclude<MatchSnapshot, { status: "playing" }> | null; engine: EngineSnapshot; again: ReactNode; phone: boolean; note: string | null }) {
  return (
    <Page title="Partie" description="Du gegen die Forge-KI. Forge entscheidet jede Regel.">
      {match === null ? (
        <NoGame />
      ) : match.status === "queued" ? (
        <Queued match={match} engine={engine} />
      ) : match.status === "starting" ? (
        <Starting match={match} />
      ) : match.status === "refused" ? (
        <Refused match={match} />
      ) : match.status === "over" ? (
        <Over match={match} again={phone ? null : again} note={note} />
      ) : (
        <Aborted match={match} again={phone ? null : again} note={note} />
      )}
      {phone && again !== null ? <ActionBar aria-label="Neue Partie">{again}</ActionBar> : null}
    </Page>
  )
}

/** For screen readers: the game's state in a few words, announced when it changes. */
function announcement(match: MatchSnapshot | null): string {
  switch (match?.status) {
    case undefined:
      return ""
    case "queued":
    case "starting":
      return "Partie wird vorbereitet"
    case "refused":
      return "Forge hat die Partie nicht gestartet"
    case "playing":
      return "Partie läuft"
    case "over":
      return `Partie beendet: ${resultWord(match.end.result)}`
    case "aborted":
      return "Partie abgebrochen"
  }
}

function NewGameButton({ state, start }: { state: StartState; start: () => void }) {
  return (
    <Button size="lg" className="max-md:flex-1" disabled={!state.enabled || state.action !== "start"} onClick={start} {...(state.enabled ? {} : { "aria-describedby": "game-again-note" })}>
      <Swords data-icon="inline-start" aria-hidden />
      Neue Partie
    </Button>
  )
}

function BackButton() {
  return (
    <Button asChild size="lg" variant="outline">
      <Link to="/play">Zur Deckwahl</Link>
    </Button>
  )
}

function NoGame() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Swords aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Gerade läuft keine Partie</EmptyTitle>
        <EmptyDescription>
          Starte eine unter „Spielen“. Eine laufende Partie endet, wenn du die Seite neu lädst oder schließt – wiederherstellen lässt sie sich noch
          nicht.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild size="lg">
          <Link to="/play">Zur Deckwahl</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

/** Which decks play, in which format, against which AI profile (the one Forge confirmed, once the game runs). */
function Matchup({ setup, confirmedProfile }: { setup: MatchSetup; confirmedProfile?: string }) {
  const profile = confirmedProfile ?? setup.request.ai.profile
  return (
    <FactList
      facts={[
        { label: "Dein Deck", value: setup.human.deckName },
        { label: "Deck der Forge-KI", value: setup.ai.drawn ? `${setup.ai.deckName} (zufällig gezogen)` : setup.ai.deckName },
        { label: "Format", value: DECK_FORMAT_LABELS[setup.request.format] },
        { label: "KI-Profil", value: setup.ai.profileDrawn ? `${aiProfileLabel(profile)} (zufällig gezogen)` : aiProfileLabel(profile) },
      ]}
    />
  )
}

function GameCard({ title, description, badge, children, footer }: { title: string; description?: ReactNode; badge?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card role="region" aria-labelledby="game-card-title">
      <CardHeader>
        <CardTitle id="game-card-title">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {badge ? <CardAction>{badge}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
      {footer ? <CardFooter className="flex flex-wrap items-center gap-3">{footer}</CardFooter> : null}
    </Card>
  )
}

function Queued({ match, engine }: { match: Of<"queued">; engine: EngineSnapshot }) {
  const { cancelMatch } = useEngineSession()
  const navigate = useNavigate()
  const now = useNow(true)
  const waited = Math.max(0, now - match.requestedAt)
  return (
    <GameCard
      title="Partie wird vorbereitet"
      description="Die Partie beginnt, sobald Forge bereit ist."
      badge={
        <Badge variant="secondary">
          <Spinner data-icon="inline-start" aria-hidden />
          Forge lädt
        </Badge>
      }
      footer={
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            cancelMatch()
            void navigate("/play")
          }}
        >
          Abbrechen
        </Button>
      }
    >
      {engine.status === "booting" ? <BootSteps steps={engine.steps} now={now} /> : <Skeleton className="h-24 w-full" aria-label="Forge startet" />}
      <p className="text-sm text-muted-foreground tabular-nums">Wartet seit {formatSeconds(waited)}</p>
      {waited > SLOW_BOOT_MS ? (
        <p className="text-sm text-muted-foreground">
          Das dauert länger als üblich. Auf langsamen Geräten braucht der erste Start bis zu einer Minute; nach drei Minuten ohne Antwort bricht
          OpenMana ab und sagt warum.
        </p>
      ) : null}
      <Matchup setup={match.setup} />
    </GameCard>
  )
}

function Starting({ match }: { match: Of<"starting"> }) {
  return (
    <GameCard
      title="Forge baut die Partie auf"
      description="Decks mischen, Hand ziehen – gleich geht es los."
      badge={
        <Badge variant="secondary">
          <Spinner data-icon="inline-start" aria-hidden />
          Startet
        </Badge>
      }
    >
      {match.stalledMs !== null ? <Stalled silentMs={match.stalledMs} /> : null}
      <Matchup setup={match.setup} />
    </GameCard>
  )
}

function Refused({ match }: { match: Of<"refused"> }) {
  const { error, setup } = match
  const unknown = error.report?.unknownCards ?? []
  const deckName = error.report?.deck
  // Which of the two decks Forge named (a mirror match is one deck).
  const deckId = deckName === setup.human.deckName ? setup.human.deckId : deckName === setup.ai.deckName ? setup.ai.deckId : null
  return (
    <GameCard
      title="Die Partie hat nicht begonnen"
      description="Forge hat sie nicht gestartet. Die Engine bleibt bereit für die nächste."
      footer={
        <>
          <Button asChild size="lg">
            <Link to="/play">Zur Deckwahl</Link>
          </Button>
          {deckId !== null ? (
            <Button asChild size="lg" variant="outline">
              <Link to={`/decks/${deckId}`}>Deck ansehen</Link>
            </Button>
          ) : null}
        </>
      }
    >
      <Alert variant="destructive">
        <OctagonAlert aria-hidden />
        <AlertTitle>{REFUSAL_TITLES[error.code]}</AlertTitle>
        <AlertDescription>
          {unknown.length > 0 ? (
            <span className="block">
              Forge kennt {unknown.length === 1 ? "eine Karte" : `${unknown.length} Karten`}
              {deckName ? ` aus „${deckName}“` : ""} nicht: {unknown.join(", ")}.
            </span>
          ) : null}
          <span className="block">{REFUSAL_ADVICE[error.code]}</span>
          <code className="mt-2 block text-xs break-words">{error.message}</code>
        </AlertDescription>
      </Alert>
      <Matchup setup={setup} />
    </GameCard>
  )
}

/** The engine is busy and silent (the client's watchdog): wait, or end the game without a result. */
function Stalled({ silentMs }: { silentMs: number }) {
  const { abortMatch } = useEngineSession()
  const [confirming, setConfirming] = useState(false)
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>Die Engine reagiert seit {formatSeconds(silentMs)} nicht</AlertTitle>
      <AlertDescription>
        <span className="block">Vielleicht rechnet Forge noch – oder die Engine hängt. Du kannst warten oder die Partie ohne Ergebnis beenden.</span>
        <Button className="mt-2" variant="destructive" onClick={() => setConfirming(true)}>
          Partie beenden
        </Button>
      </AlertDescription>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partie ohne Ergebnis beenden?</AlertDialogTitle>
            <AlertDialogDescription>Die Engine wird beendet, die Partie hat kein Ergebnis. Danach kannst du eine neue starten.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter warten</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={abortMatch}>
              Partie beenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Alert>
  )
}

/** Who is active, from the state's structured data (never by comparing names). */
function turnLine(state: GameState): string {
  const me = state.players.find((player) => player.me)
  const parts = [state.turn > 0 ? `Zug ${state.turn}` : null, phaseLabel(state.phase)]
  if (state.activePlayer !== null) parts.push(me !== undefined && state.activePlayer === me.id ? "Du bist am Zug" : "Die Forge-KI ist am Zug")
  return parts.filter((part) => part !== null).join(" · ")
}

function noticeText(notice: GameNotice): { readonly text: string; readonly detail: string | null; readonly error: boolean } {
  if (notice.type === "input.rejected") return { text: `Forge hat eine Eingabe nicht ausgeführt: ${REJECT_REASON_LABELS[notice.reason]}`, detail: notice.detail, error: true }
  return { text: notice.title ? `${notice.title}: ${notice.text}` : notice.text, detail: null, error: notice.kind === "error" }
}

/** Forge's notices of this game, oldest first (the menu keeps them; a new one also shows as a toast). */
function Notices({ notices }: { notices: readonly GameNotice[] }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="game-notices-title">
      <h2 id="game-notices-title" className="text-sm font-medium">
        Meldungen von Forge
      </h2>
      {notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">In dieser Partie hat Forge noch nichts gemeldet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {notices.map((notice, index) => {
            const { text, detail, error } = noticeText(notice)
            return (
              <li key={index} className={error ? "text-destructive" : undefined}>
                {text}
                {detail ? <code className="block text-xs break-words text-muted-foreground">{detail}</code> : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * Shows each notice Forge sends from now on as a toast at the top (the hand
 * stays free); notices that came while the player was elsewhere are in the
 * menu. Nothing fails silently (Bible §16).
 */
function useNoticeToasts(notices: readonly GameNotice[], count: number): void {
  const seen = useRef(count)
  useEffect(() => {
    const fresh = Math.min(count - seen.current, notices.length)
    seen.current = count
    for (const notice of notices.slice(notices.length - fresh)) {
      const { text, detail, error } = noticeText(notice)
      const options = { position: "top-center" as const, ...(detail ? { description: detail } : {}) }
      if (error) toast.error(text, options)
      else toast(text, options)
    }
  }, [count, notices])
}

/**
 * Without card data on this device the table shows every card in Forge's
 * words (prompt 14: a clear fallback, never an empty box). The menu says why,
 * and sets the card data up right here - the pictures appear during the game.
 * Nothing while the data is being read or cannot be (the settings say why).
 */
function TableCardData() {
  const catalog = useCardCatalog()
  if (catalog.usable || catalog.status === "loading" || catalog.status === "storage-error") return null
  const title =
    catalog.status === "unavailable" ? "Diese Version enthält keine Kartendaten" : catalog.status === "installing" ? "Die Kartendaten werden eingerichtet" : "Ohne Kartendaten: keine Kartenbilder"
  return (
    <>
      <Alert>
        <ImageOff aria-hidden />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          {catalog.status === "installing" ? (
            <InstallProgressView state={catalog} />
          ) : (
            <>
              <span>Der Tisch zeigt die Karten mit Forges Worten.{catalog.status === "unavailable" ? "" : " Mit den Kartendaten erscheinen ihre Bilder – auch während der Partie."}</span>
              {catalog.status === "unavailable" ? null : (
                <span className="mt-2 block">
                  <InstallButton state={catalog} />
                </span>
              )}
            </>
          )}
        </AlertDescription>
      </Alert>
      {catalog.error !== null ? <CardDataErrorAlert error={catalog.error} /> : null}
    </>
  )
}

/**
 * The table's menu: the game takes the whole screen, so the way around the
 * app is here - the game keeps running on other pages -, the game's facts,
 * Forge's notices, the card data where they are missing, and conceding
 * (which the page confirms first).
 */
function TableMenu({ match, onConcede }: { match: Of<"playing">; onConcede: () => void }) {
  const [open, setOpen] = useState(false)
  const notices = match.notices.length
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label={notices > 0 ? `Menü, ${notices === 1 ? "1 Meldung" : `${notices} Meldungen`} von Forge` : "Menü"}>
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Partie</SheetTitle>
          <SheetDescription>Die Partie läuft weiter, wenn du eine andere Seite öffnest. Neu laden oder Schließen beendet sie.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <Matchup setup={match.setup} confirmedProfile={match.game.aiProfile} />
          <TableCardData />
          <Notices notices={match.notices} />
          <nav aria-label="OpenMana" className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Zu einer anderen Seite</h2>
            {DESTINATIONS.map((destination) => (
              <Button key={destination.path} asChild variant="ghost" className="justify-start">
                <NavLink to={destination.path} end={destination.path === "/"}>
                  <destination.icon data-icon="inline-start" aria-hidden />
                  {destination.label}
                </NavLink>
              </Button>
            ))}
          </nav>
        </div>
        <SheetFooter>
          <Button
            size="lg"
            variant="outline"
            disabled={match.conceding}
            onClick={() => {
              setOpen(false)
              onConcede()
            }}
          >
            {match.conceding ? <Spinner data-icon="inline-start" aria-hidden /> : null}
            {match.conceding ? "Gibt auf …" : "Aufgeben"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/** The running game: the table on the whole screen, its menu, the confirmation before conceding. */
function Playing({ match }: { match: Of<"playing"> }) {
  useImmersive(true)
  const { concede, tapCard, tapPlayer, useMana: payWithMana, answer } = useEngineSession()
  const { cardLanguage } = usePreferences()
  const [confirming, setConfirming] = useState(false)
  // The table's cards and those of Forge's questions (the library's top while scrying …): their pictures are looked up together.
  const cards = useMemo(() => [...(match.state === null ? [] : visibleCards(match.state).values()), ...questionCards(match.questions)], [match.state, match.questions])
  const pictures = useTableCards(cards, cardLanguage)
  useNoticeToasts(match.notices, match.noticeCount)
  const giveUp = () => {
    const result = concede()
    if (!result.ok) toast.error("Aufgeben hat nicht geklappt", { description: result.reason })
  }
  // Nothing fails silently: a tap the session cannot send says why (at the top - the hand stays free).
  const tap = useCallback(
    (card: number) => {
      const result = tapCard(card)
      if (!result.ok) toast.error("Die Karte wurde nicht angetippt", { description: result.reason, position: "top-center" })
    },
    [tapCard],
  )
  // Likewise a player's tap and floating mana (prompt 17).
  const tapSeat = useCallback(
    (player: number) => {
      const result = tapPlayer(player)
      if (!result.ok) toast.error("Der Spieler wurde nicht angetippt", { description: result.reason, position: "top-center" })
    },
    [tapPlayer],
  )
  const payFromPool = useCallback(
    (color: ManaColor) => {
      const result = payWithMana(color)
      if (!result.ok) toast.error("Das Mana wurde nicht verwendet", { description: result.reason, position: "top-center" })
    },
    [payWithMana],
  )
  // Likewise an answer (prompt 15): the client's reason at the top; Forge's own refusal comes as its notice.
  const reply = useCallback(
    (question: number, body: AnswerBody) => {
      const result = answer(question, body)
      if (!result.ok) toast.error("Die Antwort wurde nicht gesendet", { description: result.reason, position: "top-center" })
    },
    [answer],
  )
  const menu = <TableMenu match={match} onConcede={() => setConfirming(true)} />
  const alerts = match.stalledMs !== null ? <Stalled silentMs={match.stalledMs} /> : null
  return (
    <>
      {match.state === null ? (
        // game.started came, the first full state is a moment behind it.
        <GameBoard>
          <title>Partie · OpenMana</title>
          <GameBoardArea area="header" aria-label="Spielstand" className="flex items-center gap-2 px-2 py-1">
            {menu}
            <h1 className="text-sm font-medium">Partie</h1>
          </GameBoardArea>
          <GameBoardArea area="opponent-field" aria-label="Spielstand wird geladen" className="p-3">
            <Skeleton className="size-full" />
          </GameBoardArea>
          <GameBoardArea area="decision" aria-label="Entscheidung" className="flex flex-col gap-2 px-3 py-2">
            {alerts}
            <p className="text-sm text-muted-foreground">Forge teilt gleich den Spielstand mit.</p>
          </GameBoardArea>
        </GameBoard>
      ) : (
        <GameTable
          state={match.state}
          questions={match.questions}
          prompt={match.prompt}
          waiting={match.waiting}
          aiProfile={match.game.aiProfile}
          profileDrawn={match.setup.ai.profileDrawn}
          pictures={pictures}
          conceding={match.conceding}
          menu={menu}
          alerts={alerts}
          onTapCard={tap}
          onAnswer={reply}
          onTapPlayer={tapSeat}
          onUseMana={payFromPool}
        />
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partie aufgeben?</AlertDialogTitle>
            <AlertDialogDescription>Die Forge-KI gewinnt die Partie. Das lässt sich nicht rückgängig machen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiterspielen</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={giveUp}>
              Aufgeben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const RESULT_TONES = { win: "text-primary", loss: "text-destructive", draw: "text-foreground" } as const

function Over({ match, again, note }: { match: Of<"over">; again: ReactNode; note: string | null }) {
  const { end, setup } = match
  const players = [...end.players].sort((a, b) => Number(b.me) - Number(a.me))
  return (
    <Card role="region" aria-labelledby="game-result-title">
      <CardHeader>
        <h2 id="game-result-title" className={`font-heading text-4xl font-semibold tracking-wide md:text-6xl ${end.result ? RESULT_TONES[end.result] : ""}`}>
          {resultWord(end.result)}
        </h2>
        <CardDescription>{endReason(end)}</CardDescription>
      </CardHeader>
      <CardContent>
        <FactList
          facts={[
            ...players.map((player) => ({
              label: player.me ? `Du (${setup.human.deckName})` : `Forge-KI (${setup.ai.deckName})`,
              value: `${player.life} Lebenspunkte`,
            })),
            ...(end.turns !== null ? [{ label: "Dauer", value: `${turnsLabel(end.turns)} · ${formatDuration(match.endedAt - match.startedAt)}` }] : []),
            { label: "Format", value: DECK_FORMAT_LABELS[setup.request.format] },
          ]}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        {again}
        <BackButton />
        {note !== null ? (
          <span id="game-again-note" className="text-sm text-muted-foreground">
            {note}
          </span>
        ) : null}
      </CardFooter>
    </Card>
  )
}

function Aborted({ match, again, note }: { match: Of<"aborted">; again: ReactNode; note: string | null }) {
  const { abort, setup } = match
  return (
    <GameCard
      title={match.game === null ? "Die Partie konnte nicht starten" : "Partie abgebrochen"}
      description={match.game === null ? "Die Engine ist ausgefallen, bevor die Partie begann." : "Die Engine ist ausgefallen; die Partie endete ohne Ergebnis."}
      footer={
        <>
          {again}
          <BackButton />
          {note !== null ? (
            <span id="game-again-note" className="text-sm text-muted-foreground">
              {note}
            </span>
          ) : null}
        </>
      }
    >
      <Alert variant="destructive">
        <OctagonAlert aria-hidden />
        <AlertTitle>{abortTitle(abort)}</AlertTitle>
        <AlertDescription>
          <span className="break-words">{abort.message}</span>
          {abort.detail ? <code className="mt-2 block text-xs break-words">{abort.detail}</code> : null}
        </AlertDescription>
      </Alert>
      {match.state ? <p className="text-sm text-muted-foreground">Zuletzt: {turnLine(match.state)}.</p> : null}
      <Matchup setup={setup} />
    </GameCard>
  )
}
