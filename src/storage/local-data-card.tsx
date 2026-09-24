/*
 * "Daten auf diesem Gerät" (settings): what the local database holds, how
 * much room the browser gives it, backups out and in, and a check of every
 * record. Every state is real: opening, waiting for another tab, failed (with
 * what can be done), lost, ready.
 */
import { CircleCheck, Database, Download, RotateCcw, ShieldCheck, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { FactList, type Fact } from "@/components/fact-list"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { createBackup, readBackup, recordExport, type ImportSummary } from "./backup"
import { BackupImportDialog, type PendingBackup } from "./backup-import-dialog"
import type { LocalDatabase } from "./database"
import { downloadFile } from "./download"
import { toStorageError, type StorageError } from "./errors"
import { checkIntegrity, removeDamaged, type IntegrityReport } from "./integrity"
import { readOverview, type StorageOverview } from "./overview"
import { isLowOnSpace, readStorageSpace, type StorageSpace } from "./quota"
import { formatProblems, STORE_NAMES } from "./schema"
import { StorageErrorAlert } from "./storage-alert"
import { appVersion, useStorage, useStorageQuery } from "./storage-context"
import { formatBytes, formatCount, formatDateTime, STORE_LABELS } from "./storage-labels"
import type { StorageSession, StorageSnapshot } from "./storage-session"

export function LocalDataCard() {
  const { snapshot, session } = useStorage()
  return (
    <Card role="region" aria-labelledby="local-data-title">
      <CardHeader>
        <CardTitle id="local-data-title" className="flex items-center gap-2">
          <Database aria-hidden className="size-5 text-primary" />
          Daten auf diesem Gerät
        </CardTitle>
        <CardDescription>Decks, Einstellungen und Partien liegen nur in diesem Browser – ohne Konto und ohne Cloud.</CardDescription>
        <CardAction>
          <StatusBadge snapshot={snapshot} />
        </CardAction>
      </CardHeader>
      {snapshot.status === "ready" ? <ReadyBody database={snapshot.database} /> : <NotReady snapshot={snapshot} session={session} />}
    </Card>
  )
}

function StatusBadge({ snapshot }: { snapshot: StorageSnapshot }) {
  switch (snapshot.status) {
    case "opening":
      return (
        <Badge variant="secondary">
          <Spinner data-icon="inline-start" />
          Öffnet
        </Badge>
      )
    case "blocked":
      return <Badge variant="secondary">Wartet</Badge>
    case "ready":
      return <Badge>Bereit</Badge>
    case "failed":
      return <Badge variant="destructive">Fehler</Badge>
    case "closed":
      return <Badge variant="destructive">Getrennt</Badge>
  }
}

// ── Not ready ────────────────────────────────────────────────────────────

function reload(): void {
  window.location.reload()
}

function NotReady({ snapshot, session }: { snapshot: Exclude<StorageSnapshot, { status: "ready" }>; session: StorageSession }) {
  switch (snapshot.status) {
    case "opening":
      return (
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Spinner className="size-4" />
            Lokale Daten werden geöffnet …
          </p>
        </CardContent>
      )
    case "blocked":
      return (
        <CardContent>
          <Alert>
            <TriangleAlert aria-hidden />
            <AlertTitle>Warte auf andere OpenMana-Tabs</AlertTitle>
            <AlertDescription>
              In einem anderen Tab ist noch eine ältere OpenMana-Version geöffnet. Schließe ihn oder lade ihn neu – dann geht es hier von
              selbst weiter.
            </AlertDescription>
          </Alert>
        </CardContent>
      )
    case "closed":
      return (
        <>
          <CardContent>
            <StorageErrorAlert error={snapshot.error} loss={snapshot.reason} />
          </CardContent>
          <CardFooter>
            <Button size="lg" onClick={reload}>
              <RotateCcw data-icon="inline-start" aria-hidden />
              Neu laden
            </Button>
          </CardFooter>
        </>
      )
    case "failed": {
      const code = snapshot.error.code
      const canReset = code === "schema-mismatch" || code === "open-failed" || code === "upgrade-failed"
      return (
        <>
          <CardContent>
            <StorageErrorAlert error={snapshot.error} />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            {code === "version-too-new" ? (
              <Button size="lg" onClick={reload}>
                <RotateCcw data-icon="inline-start" aria-hidden />
                Neu laden
              </Button>
            ) : (
              <Button size="lg" onClick={() => session.retry()}>
                <RotateCcw data-icon="inline-start" aria-hidden />
                Erneut versuchen
              </Button>
            )}
            {canReset ? <ResetButton session={session} /> : null}
          </CardFooter>
        </>
      )
    }
  }
}

function ResetButton({ session }: { session: StorageSession }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="lg" variant="destructive">
          Lokale Daten zurücksetzen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lokale Daten zurücksetzen?</AlertDialogTitle>
          <AlertDialogDescription>
            Das löscht die lokale Datenbank dieses Browsers mit allen Decks, Einstellungen und Partien endgültig. Danach ist sie leer, und du
            kannst eine Sicherung laden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void session.reset()}>
            Endgültig zurücksetzen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Ready ────────────────────────────────────────────────────────────────

/** Re-reads the browser's figures whenever the data changed. */
function useStorageSpace(refresh: unknown): StorageSpace | null {
  const [space, setSpace] = useState<StorageSpace | null>(null)
  useEffect(() => {
    let active = true
    void readStorageSpace().then((value) => {
      if (active) setSpace(value)
    })
    return () => {
      active = false
    }
  }, [refresh])
  return space
}

type Busy = "export" | "read" | "check" | "remove" | null

interface Failure {
  readonly error: StorageError
  readonly note?: string
}

function overviewFacts(overview: StorageOverview, space: StorageSpace | null): Fact[] {
  const { counts, backup, database } = overview
  const persisted = space?.persisted
  return [
    { label: "Decks", value: formatCount(counts.decks) },
    { label: "Partien", value: formatCount(counts.matches) },
    { label: "Einstellungen", value: formatCount(counts.settings) },
    { label: "Kartendaten (Scryfall)", value: counts.scryfallCards === 0 ? "noch keine" : `${formatCount(counts.scryfallCards)} Karten` },
    { label: "Belegt", value: space?.usage != null ? formatBytes(space.usage) : "unbekannt" },
    { label: "Noch frei", value: space?.available != null ? formatBytes(space.available) : "unbekannt" },
    {
      label: "Dauerhaft gespeichert",
      value: persisted === true ? "ja" : persisted === false ? "nein – der Browser darf sie bei Platzmangel löschen" : "unbekannt",
    },
    { label: "Letzte Sicherung", value: backup?.lastExport ? formatDateTime(backup.lastExport.at) : "noch keine" },
    {
      label: "Datenbank",
      value: database?.createdAt ? `Version ${overview.version}, angelegt am ${formatDateTime(database.createdAt)}` : `Version ${overview.version}`,
    },
  ]
}

function describeImport(summary: ImportSummary): string {
  const decks = summary.stores.decks
  const matches = summary.stores.matches
  const settings = summary.stores.settings
  const taken = (entry: { added: number; updated: number }) => entry.added + entry.updated
  return `Übernommen: ${formatCount(taken(decks))} Decks, ${formatCount(taken(matches))} Partien, ${formatCount(taken(settings))} Einstellungen.`
}

function ReadyBody({ database }: { database: LocalDatabase }) {
  const overview = useStorageQuery(STORE_NAMES, readOverview)
  // Re-read the browser's figures whenever the data changed (a new overview), not on every render.
  const space = useStorageSpace(overview.status === "ready" ? overview.data : null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [pending, setPending] = useState<PendingBackup | null>(null)
  const [report, setReport] = useState<IntegrityReport | null>(null)

  async function run(kind: Exclude<Busy, null>, work: () => Promise<void>) {
    setBusy(kind)
    setFailure(null)
    try {
      await work()
    } catch (error) {
      setFailure({ error: toStorageError(error, kind) })
    } finally {
      setBusy(null)
    }
  }

  const exportBackup = () =>
    run("export", async () => {
      const file = await createBackup(database, { app: appVersion() })
      downloadFile(file.blob, file.fileName)
      toast.success("Sicherung erstellt", { description: `${file.fileName} (${formatBytes(file.bytes)}) – bewahre die Datei gut auf.` })
      try {
        await recordExport(database, file)
      } catch (error) {
        setFailure({
          error: toStorageError(error, "recording the backup"),
          note: "Die Sicherung wurde trotzdem erstellt und heruntergeladen; nur der Vermerk „Letzte Sicherung“ fehlt.",
        })
      }
    })

  const readFile = (file: File) =>
    run("read", async () => {
      setReport(null)
      setPending({ fileName: file.name, contents: await readBackup(file) })
    })

  const check = () =>
    run("check", async () => {
      setReport(await checkIntegrity(database))
    })

  const remove = (current: IntegrityReport) =>
    run("remove", async () => {
      const removed = await removeDamaged(database, current)
      toast.success(removed === 1 ? "1 beschädigter Eintrag entfernt" : `${formatCount(removed)} beschädigte Einträge entfernt`)
      setReport(await checkIntegrity(database))
    })

  return (
    <>
      <CardContent className="flex flex-col gap-4">
        {overview.status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Lese die lokalen Daten …
          </p>
        ) : overview.status === "error" ? (
          <StorageErrorAlert error={overview.error} />
        ) : (
          <FactList facts={overviewFacts(overview.data, space)} />
        )}
        {space !== null && isLowOnSpace(space) ? (
          <Alert>
            <TriangleAlert aria-hidden />
            <AlertTitle>Wenig Speicher frei</AlertTitle>
            <AlertDescription>
              Noch {formatBytes(space.available ?? 0)} frei. Größere Downloads wie Kartendaten oder Engine-Updates können scheitern.
            </AlertDescription>
          </Alert>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Browser können lokale Daten löschen, etwa beim Aufräumen von Websitedaten. Eine Sicherung ist eine Datei mit allen Decks, Einstellungen
          und Partien; du kannst sie aufbewahren und später – auch in einem anderen Browser – wieder laden. Die Speicherangaben sind Schätzungen des
          Browsers.
        </p>
        <div aria-live="polite" className="flex flex-col gap-4">
          {failure ? (
            <StorageErrorAlert error={failure.error}>{failure.note ? <span className="mt-1 block">{failure.note}</span> : null}</StorageErrorAlert>
          ) : null}
          {report ? <IntegrityResult report={report} busy={busy} onRemove={remove} /> : null}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button size="lg" disabled={busy !== null} onClick={() => void exportBackup()}>
          <BusyIcon busy={busy === "export"}>
            <Download data-icon="inline-start" aria-hidden />
          </BusyIcon>
          Sicherung speichern
        </Button>
        <Button size="lg" variant="outline" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
          <BusyIcon busy={busy === "read"}>
            <Upload data-icon="inline-start" aria-hidden />
          </BusyIcon>
          Sicherung laden
        </Button>
        <Button size="lg" variant="outline" disabled={busy !== null} onClick={() => void check()}>
          <BusyIcon busy={busy === "check"}>
            <ShieldCheck data-icon="inline-start" aria-hidden />
          </BusyIcon>
          Daten prüfen
        </Button>
        <input
          ref={fileInput}
          type="file"
          hidden
          aria-label="Sicherungsdatei wählen"
          accept=".gz,.jsonl,application/gzip,application/x-gzip"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            if (file) void readFile(file)
          }}
        />
      </CardFooter>
      {pending ? (
        <BackupImportDialog
          database={database}
          pending={pending}
          onClose={() => setPending(null)}
          onImported={(summary) => {
            setPending(null)
            toast.success("Sicherung geladen", { description: describeImport(summary) })
          }}
        />
      ) : null}
    </>
  )
}

function BusyIcon({ busy, children }: { busy: boolean; children: ReactNode }) {
  return busy ? <Spinner data-icon="inline-start" /> : children
}

function IntegrityResult({ report, busy, onRemove }: { report: IntegrityReport; busy: Busy; onRemove: (report: IntegrityReport) => Promise<void> }) {
  const checked = Object.values(report.records).reduce((sum, n) => sum + n, 0)
  if (report.problems.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <CircleCheck aria-hidden className="size-4 shrink-0 text-primary" />
        Alles in Ordnung: {formatCount(checked)} Einträge geprüft ({formatDateTime(report.checkedAt)}).
      </p>
    )
  }
  const removable = report.problems.filter((problem) => problem.removable).length
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>
        {report.problems.length === 1 ? "1 Eintrag ist beschädigt" : `${formatCount(report.problems.length)} Einträge sind beschädigt`} (von{" "}
        {formatCount(checked)} geprüften)
      </AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-1">
          {report.problems.slice(0, 8).map((problem) => (
            <li key={`${problem.store}-${problem.key}-${problem.kind}`}>
              {STORE_LABELS[problem.store]} <code className="text-xs break-all">{problem.key}</code>:{" "}
              <code className="text-xs break-words">{formatProblems(problem.problems, 3)}</code>
            </li>
          ))}
          {report.problems.length > 8 ? <li>… und {formatCount(report.problems.length - 8)} weitere</li> : null}
        </ul>
        {removable > 0 ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-3" disabled={busy !== null}>
                Beschädigte Einträge entfernen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{removable === 1 ? "1 beschädigten Eintrag entfernen?" : `${formatCount(removable)} beschädigte Einträge entfernen?`}</AlertDialogTitle>
                <AlertDialogDescription>
                  Sie werden endgültig gelöscht. Willst du sie aufheben, speichere vorher eine Sicherung – sie enthält auch beschädigte Einträge
                  unverändert.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void onRemove(report)}>
                  Endgültig entfernen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
