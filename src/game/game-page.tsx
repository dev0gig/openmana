/*
 * The game, from the moment the player starts it until its result: waiting
 * for the engine (its boot phases), Forge building the game, the running
 * game, the result - or why Forge did not start it, or why it ended without
 * a result. Every state comes from the engine session; a failure always
 * says what happened and offers a way on, so a start never looks frozen.
 *
 * The game table (cards, decisions, priority, combat) is built from prompt 13
 * on. Until then a running game shows Forge's authoritative state in summary
 * - turn, step, life, zone sizes, the decision Forge waits for, Forge's
 * messages - and can be conceded. Nothing here is invented or computed: who
 * is who comes from the state's `me` flags, the result from game.end.
 *
 * A running game lives only in this page: reloading or closing it ends the
 * game (the session asks first). The page says so.
 */
import { Hourglass, OctagonAlert, Swords, TriangleAlert } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import type { GameState, Player, Question } from "@openmana/engine-protocol"
import { FactList, type Fact } from "@/components/fact-list"
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
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
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
  questionChoices,
  questionLabel,
  REFUSAL_ADVICE,
  REFUSAL_TITLES,
  REJECT_REASON_LABELS,
  resultWord,
  turnsLabel,
} from "./game-labels"
import { useGameStart, type StartState } from "./game-start"

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
  return (
    <Page title="Partie" description="Du gegen die Forge-KI. Forge entscheidet jede Regel.">
      <p className="sr-only" aria-live="polite">
        {announcement(match)}
      </p>
      {match === null ? (
        <NoGame />
      ) : match.status === "queued" ? (
        <Queued match={match} engine={engine} />
      ) : match.status === "starting" ? (
        <Starting match={match} />
      ) : match.status === "refused" ? (
        <Refused match={match} />
      ) : match.status === "playing" ? (
        <Playing match={match} />
      ) : match.status === "over" ? (
        <Over match={match} again={phone ? null : again} note={startState.enabled ? null : startState.note} />
      ) : (
        <Aborted match={match} again={phone ? null : again} note={startState.enabled ? null : startState.note} />
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

/** Which decks play, in which format, against which AI profile. */
function Matchup({ setup }: { setup: MatchSetup }) {
  return (
    <FactList
      facts={[
        { label: "Dein Deck", value: setup.human.deckName },
        { label: "Deck der Forge-KI", value: setup.ai.drawn ? `${setup.ai.deckName} (zufällig gezogen)` : setup.ai.deckName },
        { label: "Format", value: DECK_FORMAT_LABELS[setup.request.format] },
        { label: "KI-Profil", value: setup.ai.profileDrawn ? `${aiProfileLabel(setup.request.ai.profile)} (zufällig gezogen)` : aiProfileLabel(setup.request.ai.profile) },
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

function zoneFacts(player: Player): Fact[] {
  const { zones } = player
  return [
    { label: "Lebenspunkte", value: player.life },
    { label: "Hand", value: zones.hand.length },
    { label: "Bibliothek", value: player.library },
    { label: "Spielfeld", value: zones.battlefield.length },
    { label: "Friedhof", value: zones.graveyard.length },
    { label: "Exil", value: zones.exile.length },
    ...(zones.command.length > 0 ? [{ label: "Kommandozone", value: zones.command.length }] : []),
  ]
}

/** aiProfile: the profile Forge confirmed it plays (game.started), Forge's own word on it. */
function Players({ state, setup, aiProfile }: { state: GameState; setup: MatchSetup; aiProfile: string }) {
  // The player first, then the AI.
  const players = [...state.players].sort((a, b) => Number(b.me) - Number(a.me))
  return (
    <ItemGroup className="grid gap-3 sm:grid-cols-2" aria-label="Spieler">
      {players.map((player) => (
        <Item key={player.id} variant="outline" role="listitem" className="items-start">
          <ItemContent>
            <ItemTitle>
              {player.me ? "Du" : "Forge-KI"}
              {player.me ? null : <Badge variant="secondary">{setup.ai.profileDrawn ? `${aiProfileLabel(aiProfile)} (zufällig)` : aiProfileLabel(aiProfile)}</Badge>}
              {player.hasPriority ? <Badge variant="outline">Priorität</Badge> : null}
              {player.lost ? <Badge variant="destructive">verloren</Badge> : null}
            </ItemTitle>
            <ItemDescription>{player.me ? setup.human.deckName : setup.ai.drawn ? `${setup.ai.deckName} (zufällig gezogen)` : setup.ai.deckName}</ItemDescription>
            <FactList facts={zoneFacts(player)} />
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}

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
    <Alert>
      <Hourglass aria-hidden />
      <AlertTitle>Forge wartet auf deine Entscheidung</AlertTitle>
      <AlertDescription>
        {prompt !== null ? <span className="block text-foreground">{prompt}</span> : null}
        <ul className="flex flex-col gap-2">
          {questions.map((question) => {
            const choices = questionChoices(question)
            return (
              <li key={question.id}>
                <span className="font-medium text-foreground">{questionLabel(question)}</span>
                {question.text && question.text !== prompt ? `: ${question.text}` : null}
                {choices.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1" aria-label="Antworten, die Forge anbietet">
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
        <span className="mt-2 block">
          Entscheiden wirst du am Spieltisch, der als Nächstes entsteht. Bis dahin kannst du die Partie hier verfolgen und aufgeben.
        </span>
      </AlertDescription>
    </Alert>
  )
}

function noticeText(notice: GameNotice): { readonly text: string; readonly detail: string | null; readonly error: boolean } {
  if (notice.type === "input.rejected") return { text: `Forge hat eine Eingabe nicht ausgeführt: ${REJECT_REASON_LABELS[notice.reason]}`, detail: notice.detail, error: true }
  return { text: notice.title ? `${notice.title}: ${notice.text}` : notice.text, detail: null, error: notice.kind === "error" }
}

function Notices({ notices }: { notices: readonly GameNotice[] }) {
  if (notices.length === 0) return null
  return (
    <section className="flex flex-col gap-2" aria-labelledby="game-notices-title">
      <h2 id="game-notices-title" className="text-sm font-medium">
        Meldungen von Forge
      </h2>
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
    </section>
  )
}

function Playing({ match }: { match: Of<"playing"> }) {
  const { concede } = useEngineSession()
  const [confirming, setConfirming] = useState(false)
  const giveUp = () => {
    const result = concede()
    if (!result.ok) toast.error("Aufgeben hat nicht geklappt", { description: result.reason })
  }
  return (
    <GameCard
      title="Partie läuft"
      description={match.state ? turnLine(match.state) : "Forge teilt gleich den Spielstand mit."}
      badge={match.waiting ? <Badge>Du bist dran</Badge> : <Badge variant="secondary">Forge rechnet</Badge>}
      footer={
        <>
          <Button size="lg" variant="outline" disabled={match.conceding} onClick={() => setConfirming(true)}>
            {match.conceding ? <Spinner data-icon="inline-start" aria-hidden /> : null}
            {match.conceding ? "Gibt auf …" : "Aufgeben"}
          </Button>
          <span className="text-sm text-muted-foreground">Neu laden oder Schließen der Seite beendet die Partie.</span>
        </>
      }
    >
      {match.stalledMs !== null ? <Stalled silentMs={match.stalledMs} /> : null}
      {match.state ? <Players state={match.state} setup={match.setup} aiProfile={match.game.aiProfile} /> : <Skeleton className="h-40 w-full" aria-label="Spielstand wird geladen" />}
      <Decision questions={match.questions} prompt={match.prompt} waiting={match.waiting} />
      <Notices notices={match.notices} />
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
    </GameCard>
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
