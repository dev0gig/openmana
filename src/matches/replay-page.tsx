import { useCallback, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { ChevronLeft, ChevronRight, Menu } from "lucide-react"
import { useImmersive } from "@/app/immersive"
import { usePreferences } from "@/app/preferences"
import { Page } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FactList } from "@/components/fact-list"
import { GameTable } from "@/game/game-table"
import { visibleCards } from "@/game/table-model"
import { questionCards } from "@/game/decision-model"
import { useTableCards } from "@/game/table-cards"
import { readMatch } from "@/storage/matches"
import type { LocalDatabase } from "@/storage/database"
import { downloadFile } from "@/storage/download"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorageQuery } from "@/storage/storage-context"
import { exportReplay, replayFrames, type ReplayFrame } from "./replay"

export function ReplayPage() {
  const { matchId = "" } = useParams()
  return <ReplayView key={matchId} matchId={matchId} />
}

function ReplayView({ matchId }: { matchId: string }) {
  const query = useCallback((db: LocalDatabase) => readMatch(db, matchId), [matchId])
  const stored = useStorageQuery(["matches", "matchLog"], query)
  const parsed = useMemo(() => {
    if (stored.status !== "ready" || stored.data === null) return null
    try {
      return { frames: replayFrames(stored.data), error: null }
    } catch (error) {
      return { frames: [], error: error instanceof Error ? error.message : String(error) }
    }
  }, [stored])
  const [position, setPosition] = useState(0)
  const [jump, setJump] = useState("")
  const count = parsed?.frames.length ?? 0
  const index = Math.min(position, Math.max(0, count - 1))
  const frame: ReplayFrame | undefined = parsed?.frames[index]
  useImmersive(frame !== undefined)
  const { cardLanguage } = usePreferences()
  const cards = useMemo(
    () => (frame ? [...visibleCards(frame.state).values(), ...questionCards(frame.questions)] : []),
    [frame],
  )
  const pictures = useTableCards(cards, cardLanguage)
  const [fileError, setFileError] = useState<string | null>(null)
  const save = () => {
    if (stored.status !== "ready" || stored.data === null) return
    try {
      downloadFile(exportReplay(stored.data), `openmana-wiedergabe-${matchId}.json`)
    } catch {
      setFileError("Die JSON-Datei konnte nicht gespeichert werden.")
    }
  }
  if (!frame || stored.status !== "ready" || stored.data === null)
    return (
      <Page title="Wiedergabe" description="Gespeicherte Forge-Zustände ansehen.">
        <Button asChild variant="outline">
          <Link to="/matches">Zurück zu Partien</Link>
        </Button>
        {stored.status === "loading" ? (
          <Skeleton className="h-40" aria-label="Wiedergabe wird geladen" />
        ) : stored.status === "error" ? (
          <StorageErrorAlert error={stored.error} />
        ) : (
          <Alert>
            <AlertTitle>
              {stored.data === null ? "Die Partie ist nicht mehr da" : "Keine Wiedergabe verfügbar"}
            </AlertTitle>
            <AlertDescription>
              {parsed?.error ??
                "Diese Aufzeichnung enthält noch keinen gespeicherten Zustand. Das Spiel kann daraus nicht fortgesetzt werden."}
            </AlertDescription>
          </Alert>
        )}
        {stored.status === "ready" && stored.data !== null && <Button onClick={save}>JSON speichern</Button>}
        {fileError && <p role="alert">{fileError}</p>}
      </Page>
    )
  const match = stored.data.match
  const stepLabel = `Schritt ${index + 1} von ${count}`
  const navigation = (
    <div className="flex flex-wrap items-center gap-2" aria-label="Wiedergabeschritte">
      <Button
        variant="outline"
        size="icon"
        aria-label="Vorheriger Schritt"
        disabled={index === 0}
        onClick={() => setPosition(index - 1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <span className="text-sm" role="status">
        {stepLabel}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Nächster Schritt"
        disabled={index + 1 >= count}
        onClick={() => setPosition(index + 1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  )
  const menu = (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Wiedergabemenü">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Wiedergabe</SheetTitle>
          <SheetDescription>
            Nur gespeicherte Zustände. Keine Eingabe geht an Forge; eine laufende Partie bleibt unberührt.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          <Button asChild variant="outline">
            <Link to="/matches">Zurück zu Partien</Link>
          </Button>
          <p>
            {stepLabel} · {Math.floor(frame.at / 1000)} Sekunden seit Beginn
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPosition(0)}>
              Anfang
            </Button>
            <Button variant="outline" onClick={() => setPosition(count - 1)}>
              Ende
            </Button>
          </div>
          <Field>
            <FieldLabel htmlFor="replay-step">Schritt wählen (1–{count})</FieldLabel>
            <Input
              id="replay-step"
              type="number"
              min={1}
              max={count}
              value={jump}
              onChange={(event) => setJump(event.target.value)}
            />
          </Field>
          <Button
            disabled={!Number.isInteger(Number(jump)) || Number(jump) < 1 || Number(jump) > count}
            onClick={() => setPosition(Number(jump) - 1)}
          >
            Zum Schritt
          </Button>
          <Button variant="outline" onClick={save}>
            JSON speichern
          </Button>
          <FactList
            facts={[
              { label: "App-Version", value: match.app.version },
              { label: "Forge-Version", value: match.engine.forgeVersion },
              { label: "Protokoll", value: String(match.engine.protocol) },
              { label: "Seed", value: match.seed === null ? "nicht festgelegt" : String(match.seed) },
              {
                label: "Manifest-SHA256",
                value: match.engine.manifestSha256 ?? "in dieser älteren Aufzeichnung nicht vorhanden",
              },
            ]}
          />
          {fileError && <p role="alert">{fileError}</p>}
        </div>
      </SheetContent>
    </Sheet>
  )
  return (
    <>
      <title>Wiedergabe · OpenMana</title>
      <GameTable
        key={matchId}
        replay
        state={frame.state}
        questions={frame.questions}
        history={frame.history}
        prompt={frame.prompt}
        waiting={false}
        aiProfile={match.ai.profile}
        pictures={pictures}
        menu={menu}
        alerts={navigation}
      />
    </>
  )
}
