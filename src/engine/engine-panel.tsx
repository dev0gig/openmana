/*
 * The Forge engine as the player sees it: not loaded, loading (the engine's
 * own boot phases), ready (what the engine reports about itself), playing a
 * game, or aborted (why). Every state is real; the panel never pretends the
 * engine is there.
 */
import { Check, Circle, Cpu, OctagonAlert, Power, RotateCcw, Swords } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"
import { FactList } from "@/components/fact-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { aiProfileLabel } from "@/game/game-labels"
import { useNow } from "@/hooks/use-now"
import { engineAssets } from "./engine-assets"
import { abortAdvice, abortTitle, BOOT_PHASE_LABELS, ENGINE_LANGUAGE_LABELS, formatMegabytes, formatSeconds, shortCommit } from "./engine-labels"
import type { BootStep, EngineSnapshot } from "./engine-session"
import { useEngineSession } from "./engine-session-context"

export function EnginePanel() {
  const { snapshot: session, start, stop } = useEngineSession()
  const snapshot = session.engine
  const now = useNow(snapshot.status === "booting")
  return (
    <Card role="region" aria-labelledby="engine-panel-title">
      <CardHeader>
        <CardTitle id="engine-panel-title" className="flex items-center gap-2">
          <Cpu aria-hidden className="size-5 text-primary" />
          Forge-Engine
        </CardTitle>
        <CardDescription>Forge läuft als WebAssembly direkt in diesem Browser – ohne Server.</CardDescription>
        <CardAction>
          <StatusBadge snapshot={snapshot} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4" aria-live="polite">
        <PanelBody snapshot={snapshot} now={now} />
      </CardContent>
      <PanelActions snapshot={snapshot} start={start} stop={stop} />
    </Card>
  )
}

function StatusBadge({ snapshot }: { snapshot: EngineSnapshot }) {
  switch (snapshot.status) {
    case "unavailable":
      return <Badge variant="destructive">Nicht enthalten</Badge>
    case "unsupported":
      return <Badge variant="destructive">Nicht unterstützt</Badge>
    case "idle":
      return <Badge variant="outline">Nicht geladen</Badge>
    case "booting":
      return (
        <Badge variant="secondary">
          <Spinner data-icon="inline-start" />
          Lädt
        </Badge>
      )
    case "ready":
      return <Badge>Bereit</Badge>
    case "busy":
      return <Badge>Spielt</Badge>
    case "aborted":
      return <Badge variant="destructive">Abgebrochen</Badge>
  }
}

function PanelBody({ snapshot, now }: { snapshot: EngineSnapshot; now: number }): ReactNode {
  switch (snapshot.status) {
    case "unavailable":
      return (
        <Alert variant="destructive">
          <OctagonAlert aria-hidden />
          <AlertTitle>Diese App-Version enthält keine Forge-Engine.</AlertTitle>
          <AlertDescription>
            {snapshot.reason === "omitted"
              ? "Sie wurde absichtlich ohne Engine gebaut."
              : "Die Engine wurde beim Bauen der App nicht gefunden. Entwicklung: Engine bauen (bash engine/scripts/build.sh) und den Dev-Server neu starten."}
            <code className="mt-2 block text-xs break-words text-muted-foreground">{snapshot.detail}</code>
          </AlertDescription>
        </Alert>
      )
    case "unsupported":
      return (
        <Alert variant="destructive">
          <OctagonAlert aria-hidden />
          <AlertTitle>Dieser Browser kann die Forge-Engine nicht ausführen.</AlertTitle>
          <AlertDescription>
            Es fehlt: {snapshot.features.missing.join(", ")}. Nötig ist ein aktueller Browser mit WebAssembly GC und
            Exception Handling (etwa Chrome ab Version 137), und die Seite muss mit Cross-Origin-Isolation ausgeliefert werden.
          </AlertDescription>
        </Alert>
      )
    case "idle":
      return (
        <>
          <EngineFacts />
          <p className="text-sm text-muted-foreground">
            Steht ein Deck bereit, lädt „Spielen“ die Engine von selbst vor – dann startet die Partie ohne Wartezeit.
          </p>
        </>
      )
    case "booting":
      return (
        <>
          <BootSteps steps={snapshot.steps} now={now} />
          <p className="text-sm text-muted-foreground tabular-nums">Seit {formatSeconds(Math.max(0, now - snapshot.startedAt))}</p>
        </>
      )
    case "ready":
    case "busy": {
      const { engine, boot } = snapshot.ready
      return (
        <>
          {snapshot.status === "busy" ? <p className="text-sm">Forge spielt gerade deine Partie. Eine Engine spielt eine Partie; die nächste bekommt eine frische.</p> : null}
          <BootSteps steps={snapshot.steps} now={snapshot.readyAt} />
          <FactList
            facts={[
              { label: "Startzeit", value: formatSeconds(snapshot.readyAt - snapshot.startedAt) },
              { label: "Forge", value: `${engine.forgeVersionCode} (${shortCommit(engine.forgeCommit)})` },
              {
                label: "Engine-Build",
                value: `${shortCommit(engine.openmanaCommit)}${engine.engineSourcesModified ? " (mit lokalen Änderungen)" : ""}`,
              },
              { label: "Protokoll", value: `Version ${snapshot.ready.protocol}` },
              { label: "Forge-Daten", value: `${boot.resourceFiles.toLocaleString("de-DE")} Dateien` },
              { label: "Karten", value: boot.cardLoading === "eager" ? "vollständig geladen" : "werden bei Bedarf geladen" },
              { label: "Sprache von Forge", value: ENGINE_LANGUAGE_LABELS[boot.language] },
              { label: "Karten in Forges Texten", value: ENGINE_LANGUAGE_LABELS[boot.cardLanguage] },
              { label: "KI-Profile", value: boot.aiProfiles.map(aiProfileLabel).join(", ") },
            ]}
          />
        </>
      )
    }
    case "aborted":
      return (
        <>
          <Alert variant="destructive">
            <OctagonAlert aria-hidden />
            <AlertTitle>{abortTitle(snapshot.abort)}</AlertTitle>
            <AlertDescription>
              <span>{abortAdvice(snapshot.abort)}</span>
              <code className="mt-2 block text-xs break-words">{snapshot.abort.message}</code>
              {snapshot.abort.detail ? <code className="mt-2 block text-xs break-words">{snapshot.abort.detail}</code> : null}
            </AlertDescription>
          </Alert>
          <BootSteps steps={snapshot.steps} now={now} />
        </>
      )
  }
}

/** What loading the engine costs, from the engine manifest of this build. */
function EngineFacts() {
  if (!engineAssets.available) return null
  const { build } = engineAssets
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Die Engine umfasst {formatMegabytes(build.downloadBytes)} (komprimiert rund {formatMegabytes(build.downloadBrotliBytes)}) und
        braucht, solange sie läuft, etwa 1 GB Arbeitsspeicher.
      </p>
      <FactList
        facts={[
          { label: "Forge-Stand", value: shortCommit(build.forgeCommit) },
          { label: "Protokoll", value: `Version ${build.protocolVersion}` },
        ]}
      />
    </>
  )
}

/** The engine's boot phases with their times (also shown while a game waits for the engine). */
export function BootSteps({ steps, now }: { steps: readonly BootStep[]; now: number }) {
  return (
    <ol className="flex flex-col gap-2 text-sm" aria-label="Startschritte der Engine">
      {steps.map((step) => (
        <li key={step.phase} className="flex items-center gap-2" data-state={step.state}>
          {step.state === "done" ? (
            <Check aria-hidden className="size-4 shrink-0 text-primary" />
          ) : step.state === "active" ? (
            <Spinner className="size-4 shrink-0 text-primary" />
          ) : (
            <Circle aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className={step.state === "pending" ? "text-muted-foreground" : undefined}>{BOOT_PHASE_LABELS[step.phase]}</span>
          {step.startedAt !== null ? (
            <span className="ml-auto text-muted-foreground tabular-nums">
              {formatSeconds(Math.max(0, (step.endedAt ?? now) - step.startedAt))}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function PanelActions({ snapshot, start, stop }: { snapshot: EngineSnapshot; start: () => void; stop: () => void }) {
  switch (snapshot.status) {
    case "idle":
      return (
        <CardFooter>
          <Button size="lg" onClick={start}>
            <Power data-icon="inline-start" aria-hidden />
            Engine laden
          </Button>
        </CardFooter>
      )
    case "booting":
      return (
        <CardFooter>
          <Button size="lg" variant="outline" onClick={stop}>
            Abbrechen
          </Button>
        </CardFooter>
      )
    case "ready":
      return (
        <CardFooter className="flex flex-wrap items-center gap-3">
          <Button size="lg" variant="outline" onClick={stop}>
            <Power data-icon="inline-start" aria-hidden />
            Engine beenden
          </Button>
          <span className="text-sm text-muted-foreground">Gibt den Arbeitsspeicher wieder frei.</span>
        </CardFooter>
      )
    case "busy":
      // No "stop" here: that would end the game. The game page has its own ways out (concede, end after a stall).
      return (
        <CardFooter>
          <Button asChild size="lg">
            <Link to="/play/game">
              <Swords data-icon="inline-start" aria-hidden />
              Zur Partie
            </Link>
          </Button>
        </CardFooter>
      )
    case "aborted":
      return (
        <CardFooter>
          <Button size="lg" onClick={start}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            Erneut versuchen
          </Button>
        </CardFooter>
      )
    default:
      return null
  }
}
