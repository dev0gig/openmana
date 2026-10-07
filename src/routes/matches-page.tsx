import { History, Swords } from "lucide-react"
import { useRef, useState, type ChangeEvent } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { ActionBar } from "@/components/ui/action-bar"
import { Page } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDuration } from "@/game/game-labels"
import type { MatchRecord } from "@/storage/generated/records"
import {
  clearMatches,
  deleteMatch,
  listMatches,
  MATCH_RETENTION,
  pruneMatches,
  readMatch,
  retention,
} from "@/storage/matches"
import { writeSetting } from "@/storage/settings"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { toStorageError } from "@/storage/errors"
import { useStorage, useStorageQuery } from "@/storage/storage-context"
import {
  formatDateTime,
  GAME_RESULT_LABELS,
  MATCH_STATUS_LABELS,
  storageErrorTitle,
  storageErrorAdvice,
} from "@/storage/storage-labels"
import { downloadFile } from "@/storage/download"
import { RecordingAlert } from "@/matches/recording-status"

function describeMatch(match: MatchRecord): string {
  const parts = [formatDateTime(match.startedAt)]
  if (match.end?.result) parts.push(GAME_RESULT_LABELS[match.end.result])
  else parts.push(MATCH_STATUS_LABELS[match.status])
  if (match.end?.turns != null) parts.push(match.end.turns === 1 ? "1 Zug" : `${match.end.turns} Züge`)
  if (match.endedAt !== null)
    parts.push(formatDuration(Math.max(0, Date.parse(match.endedAt) - Date.parse(match.startedAt))))
  return parts.join(" · ")
}

export function MatchesPage() {
  const mobile = useIsMobile()
  const matches = useStorageQuery(["matches"], listMatches)
  const limit = useStorageQuery(["settings"], retention)
  const { snapshot } = useStorage()
  const database = snapshot.status === "ready" ? snapshot.database : null
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ id: string | null; limit: number | null } | null>(null)
  const [draftLimit, setDraftLimit] = useState("")
  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (error) {
      const problem = toStorageError(error, "processing match data")
      setError(`${storageErrorTitle(problem)}. ${storageErrorAdvice(problem)}`)
    } finally {
      setBusy(false)
    }
  }
  async function load(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !database) return
    await run(async () => {
      const { parseReplay, importReplay } = await import("@/matches/replay")
      const parsed = await parseReplay(file)
      const result = await importReplay(database, parsed)
      toast.success(result === "existing" ? "Diese Partie ist schon gespeichert" : "Wiedergabe geladen")
    })
  }
  const hasRecords = matches.status === "ready" && (matches.data.records.length > 0 || matches.data.invalid.length > 0)
  return (
    <Page title="Partien" description="Deine gespielten Partien auf diesem Gerät.">
      <RecordingAlert />
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Die Partiedaten ließen sich nicht verarbeiten</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {!mobile && (
          <Button disabled={!database || busy} onClick={() => fileInput.current?.click()}>
            Wiedergabe laden
          </Button>
        )}
        <Input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          aria-label="Wiedergabedatei"
          className="hidden"
          onChange={(event) => {
            void load(event)
          }}
        />
        <Button
          variant="outline"
          disabled={!database || busy || !hasRecords}
          onClick={() => setConfirm({ id: null, limit: null })}
        >
          Alle Partien löschen
        </Button>
      </div>
      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Aufbewahrung</CardTitle>
          <CardDescription>
            Standard: die neuesten 100 beendeten Partien. Laufende oder unterbrochene Aufzeichnungen bleiben erhalten,
            bis du sie selbst löschst. Importierte Partien zählen mit. Unvollständig nach Neuladen bedeutet keine
            fortsetzbare Partie.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field>
            <FieldLabel htmlFor="match-retention">Beendete Partien behalten (1–1000)</FieldLabel>
            <Input
              id="match-retention"
              type="number"
              min={1}
              max={1000}
              value={draftLimit || (limit.status === "ready" ? String(limit.data.value) : "")}
              onChange={(event) => setDraftLimit(event.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            disabled={!database || busy || !MATCH_RETENTION.check(Number(draftLimit))}
            onClick={() => setConfirm({ id: null, limit: Number(draftLimit) })}
          >
            Aufbewahrung ändern
          </Button>
          {limit.status === "ready" && limit.data.invalid && (
            <p>Die gespeicherte Vorgabe war ungültig; es gelten 100 Partien.</p>
          )}
          {limit.status === "error" && <StorageErrorAlert error={limit.error} />}
        </CardContent>
      </Card>
      {matches.status === "loading" ? (
        <Skeleton className="h-40 w-full" aria-label="Partien werden geladen" />
      ) : matches.status === "error" ? (
        <StorageErrorAlert error={matches.error}>
          <span>
            Mehr dazu in den <TextLink to="/settings">Einstellungen</TextLink>.
          </span>
        </StorageErrorAlert>
      ) : !hasRecords ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Noch keine Partien</EmptyTitle>
            <EmptyDescription>
              Jede von Forge gestartete Partie wird automatisch auf diesem Gerät aufgezeichnet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="shrink-0">
          <CardHeader>
            <CardTitle>
              {matches.data.records.length === 1 ? "1 Partie" : `${matches.data.records.length} Partien`}
            </CardTitle>
            <CardDescription>
              Gespeicherte Zustände Schritt für Schritt ansehen. Die Wiedergabe sendet keine Spieleingaben.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup aria-label="Gespeicherte Partien" role="list">
              {matches.data.records.map((match) => (
                <Item key={match.id} variant="outline" role="listitem" className="flex-wrap">
                  <ItemMedia variant="icon">
                    <Swords aria-hidden />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {match.human.deck.name} gegen {match.ai.name}
                    </ItemTitle>
                    <ItemDescription>{describeMatch(match)}</ItemDescription>
                  </ItemContent>
                  <ItemActions className="w-full flex-wrap">
                    <Button asChild variant="outline">
                      <Link to={`/matches/${match.id}`}>Ansehen</Link>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void run(async () => {
                          if (!database) return
                          const stored = await readMatch(database, match.id)
                          if (!stored) throw new Error("Die Partie wurde inzwischen entfernt.")
                          const { exportReplay } = await import("@/matches/replay")
                          downloadFile(exportReplay(stored), `openmana-wiedergabe-${match.id}.json`)
                        })
                      }}
                    >
                      JSON speichern
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => setConfirm({ id: match.id, limit: null })}>
                      Löschen
                    </Button>
                  </ItemActions>
                </Item>
              ))}
              {matches.data.invalid.map((record) => (
                <Item key={record.key} variant="outline" role="listitem">
                  <ItemContent>
                    <ItemTitle>
                      Beschädigter Eintrag <Badge variant="destructive">beschädigt</Badge>
                    </ItemTitle>
                    <ItemDescription>
                      Prüfen und entfernen: <TextLink to="/settings">Einstellungen</TextLink> → Daten prüfen.
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}
      {mobile && (
        <ActionBar aria-label="Partie laden">
          <Button disabled={!database || busy} onClick={() => fileInput.current?.click()}>
            Wiedergabe laden
          </Button>
        </ActionBar>
      )}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm !== null && confirm.limit !== null
                ? "Aufbewahrung ändern?"
                : confirm?.id
                  ? "Partie löschen?"
                  : "Alle Partien löschen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm !== null && confirm.limit !== null
                ? "Ältere beendete Partien samt Verlauf werden entsprechend der neuen Grenze endgültig entfernt."
                : "Partien und ihre Verläufe werden auf diesem Gerät endgültig entfernt. Eine laufende Aufzeichnung wird nach dem Löschen nicht wieder angelegt. Gespeicherte JSON-Dateien bleiben erhalten."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Behalten</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const choice = confirm
                setConfirm(null)
                void run(async () => {
                  if (!database || !choice) return
                  if (choice.limit !== null) {
                    await writeSetting(database, MATCH_RETENTION, choice.limit)
                    await pruneMatches(database)
                    setDraftLimit("")
                  } else if (choice.id) await deleteMatch(database, choice.id)
                  else await clearMatches(database)
                })
              }}
            >
              {confirm !== null && confirm.limit !== null ? "Ändern und ältere entfernen" : "Endgültig entfernen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
