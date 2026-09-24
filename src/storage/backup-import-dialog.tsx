/*
 * Loading a backup the player picked: what is in it, what loading it would
 * do here (merge or replace), whether it fits - then, only on the player's
 * word, one all-or-nothing import. Replacing deletes local data and says so
 * on its button (Bible §6: irreversible actions need clear intent).
 */
import { Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { FactList, type Fact } from "@/components/fact-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { importBackup, importSpaceNeeded, planImport, type BackupContents, type ImportSummary, type StoreImport } from "./backup"
import type { LocalDatabase } from "./database"
import { StorageError, toStorageError } from "./errors"
import { SCHEMA_VERSION } from "./generated/constants"
import type { BackupStore, ImportMode } from "./generated/records"
import { readStorageSpace } from "./quota"
import { formatProblems } from "./schema"
import { StorageErrorAlert } from "./storage-alert"
import { formatBytes, formatCount, formatDateTime, IMPORT_MODE_LABELS, STORE_LABELS } from "./storage-labels"

export interface PendingBackup {
  readonly fileName: string
  readonly contents: BackupContents
}

/** The stores the player knows by name (match logs belong to their matches). */
const SHOWN_STORES: readonly BackupStore[] = ["decks", "matches", "settings"]

function describeStore(entry: StoreImport, mode: ImportMode): string {
  if (mode === "replace") {
    return entry.removed > 0 ? `${formatCount(entry.added)} statt ${formatCount(entry.removed)}` : `${formatCount(entry.added)} neu`
  }
  const parts = [
    entry.added > 0 ? `${formatCount(entry.added)} neu` : null,
    entry.updated > 0 ? `${formatCount(entry.updated)} aktualisiert` : null,
    entry.unchanged > 0 ? `${formatCount(entry.unchanged)} unverändert` : null,
    entry.keptLocal > 0 ? `${formatCount(entry.keptLocal)} bleibt wie hier` : null,
  ].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(" · ") : "nichts"
}

type Plan = { readonly status: "planning" } | { readonly status: "ready"; readonly summary: ImportSummary; readonly available: number | null } | { readonly status: "error"; readonly error: StorageError }

export function BackupImportDialog({
  database,
  pending,
  onClose,
  onImported,
}: {
  database: LocalDatabase
  pending: PendingBackup
  onClose: () => void
  onImported: (summary: ImportSummary) => void
}) {
  const { contents, fileName } = pending
  const [mode, setMode] = useState<ImportMode>("merge")
  const [plan, setPlan] = useState<{ readonly mode: ImportMode; readonly plan: Plan } | null>(null)
  const [importing, setImporting] = useState(false)
  const [failure, setFailure] = useState<StorageError | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([planImport(database, contents, mode), readStorageSpace()]).then(
      ([summary, space]) => {
        if (active) setPlan({ mode, plan: { status: "ready", summary, available: space.available } })
      },
      (error: unknown) => {
        if (active) setPlan({ mode, plan: { status: "error", error: toStorageError(error, "planning the import") } })
      },
    )
    return () => {
      active = false
    }
  }, [database, contents, mode])

  const current: Plan = plan !== null && plan.mode === mode ? plan.plan : { status: "planning" }
  const needed = current.status === "ready" ? importSpaceNeeded(current.summary) : 0
  const tooBig = current.status === "ready" && current.available !== null && needed > current.available
  const nothingToDo = current.status === "ready" && mode === "merge" && current.summary.writes === 0
  const header = contents.header

  async function confirm() {
    setImporting(true)
    setFailure(null)
    try {
      onImported(await importBackup(database, contents, mode))
    } catch (error) {
      setFailure(toStorageError(error, "importing the backup"))
    } finally {
      setImporting(false)
    }
  }

  const inBackup: Fact[] = SHOWN_STORES.map((store) => ({ label: STORE_LABELS[store], value: formatCount(contents.records[store].length) }))

  return (
    <Dialog open onOpenChange={(open) => (open || importing ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sicherung laden</DialogTitle>
          <DialogDescription>
            {fileName} – erstellt am {formatDateTime(header.createdAt)} mit OpenMana {header.app.version}.
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby="import-content-title" className="flex flex-col gap-3">
          <p id="import-content-title" className="text-sm font-medium">
            In der Sicherung
          </p>
          <FactList facts={inBackup} />
          {header.schemaVersion < SCHEMA_VERSION ? (
            <p className="text-sm text-muted-foreground">
              Sie stammt von einer älteren Version (Datenstand {header.schemaVersion}); die Einträge werden beim Laden angepasst.
            </p>
          ) : null}
          {contents.skipped.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>
                {contents.skipped.length === 1
                  ? "1 Eintrag der Sicherung ist beschädigt und wird nicht übernommen."
                  : `${formatCount(contents.skipped.length)} Einträge der Sicherung sind beschädigt und werden nicht übernommen.`}
              </AlertTitle>
              <AlertDescription>
                <ul className="flex flex-col gap-1">
                  {contents.skipped.slice(0, 5).map((problem) => (
                    <li key={`${problem.store}-${problem.line}-${problem.key ?? ""}`}>
                      {STORE_LABELS[problem.store]}
                      {problem.line > 0 ? `, Zeile ${problem.line}` : ""}:{" "}
                      <code className="text-xs break-words">{formatProblems(problem.problems, 3)}</code>
                    </li>
                  ))}
                  {contents.skipped.length > 5 ? <li>… und {formatCount(contents.skipped.length - 5)} weitere</li> : null}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </section>

        <RadioGroup value={mode} onValueChange={(value) => setMode(value === "replace" ? "replace" : "merge")} aria-label="Wie laden?">
          {/* The radios are buttons: they are named by aria-labelledby (a label element does not name a button for every screen reader). */}
          <FieldLabel htmlFor="import-merge">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle id="import-merge-title">{IMPORT_MODE_LABELS.merge} (empfohlen)</FieldTitle>
                <FieldDescription id="import-merge-description">
                  Neues kommt dazu, von zwei Fassungen gewinnt die neuere. Hier wird nichts gelöscht.
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem value="merge" id="import-merge" aria-labelledby="import-merge-title" aria-describedby="import-merge-description" />
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor="import-replace">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle id="import-replace-title">{IMPORT_MODE_LABELS.replace}</FieldTitle>
                <FieldDescription id="import-replace-description">
                  Alle Decks, Einstellungen und Partien auf diesem Gerät werden gelöscht und durch die Sicherung ersetzt.
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem value="replace" id="import-replace" aria-labelledby="import-replace-title" aria-describedby="import-replace-description" />
            </Field>
          </FieldLabel>
        </RadioGroup>

        <section aria-labelledby="import-changes-title" aria-live="polite" className="flex flex-col gap-3">
          <p id="import-changes-title" className="text-sm font-medium">
            Das ändert sich auf diesem Gerät
          </p>
          {current.status === "planning" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Vergleiche mit den Daten auf diesem Gerät …
            </p>
          ) : current.status === "error" ? (
            <StorageErrorAlert error={current.error} />
          ) : (
            <>
              <FactList facts={SHOWN_STORES.map((store) => ({ label: STORE_LABELS[store], value: describeStore(current.summary.stores[store], mode) }))} />
              {nothingToDo ? <p className="text-sm text-muted-foreground">Alles aus dieser Sicherung ist hier schon vorhanden.</p> : null}
              {tooBig ? (
                <StorageErrorAlert
                  error={
                    new StorageError("insufficient-space", "the import does not fit", {
                      detail: `needed about ${needed} B, available ${current.available ?? "?"} B`,
                    })
                  }
                >
                  <span className="mt-1 block">
                    Nötig sind etwa {formatBytes(needed)}, frei sind {formatBytes(current.available ?? 0)}.
                  </span>
                </StorageErrorAlert>
              ) : null}
            </>
          )}
          {failure ? <StorageErrorAlert error={failure} /> : null}
        </section>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={importing}>
              Abbrechen
            </Button>
          </DialogClose>
          <Button
            variant={mode === "replace" ? "destructive" : "default"}
            disabled={current.status !== "ready" || tooBig || nothingToDo || importing}
            onClick={() => void confirm()}
          >
            {importing ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" aria-hidden />}
            {mode === "replace" ? "Lokale Daten ersetzen" : "Zusammenführen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
