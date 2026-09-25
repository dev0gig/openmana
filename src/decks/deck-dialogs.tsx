/*
 * The deck library's dialogs: renaming a deck, deleting it (confirmed:
 * irreversible) and exporting its list. Each is opened by the deck's
 * actions (deck-actions.tsx) and says what failed, in place.
 */
import { Copy, Download } from "lucide-react"
import { useId, useState, type FormEvent } from "react"
import { toast } from "sonner"
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
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { downloadFile } from "@/storage/download"
import { toStorageError, type StorageError } from "@/storage/errors"
import type { DeckRecord, SetRecord } from "@/storage/generated/records"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { arenaList, listFileName } from "./arena-export"

const MAX_NAME = 200

/** Renaming a deck. Mounted anew for every opening (the caller keys it), so it starts from the deck's current name. */
export function RenameDialog({
  deck,
  otherNames,
  open,
  onOpenChange,
  onRename,
}: {
  deck: DeckRecord
  /** The names of the other decks (a hint when the new name is taken; two decks may share a name). */
  otherNames: readonly string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRename: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(deck.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<StorageError | null>(null)
  const trimmed = name.trim()
  const taken = trimmed !== deck.name && otherNames.some((other) => other.trim().toLocaleLowerCase("de-DE") === trimmed.toLocaleLowerCase("de-DE"))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (trimmed === "" || busy) return
    setBusy(true)
    setError(null)
    try {
      await onRename(trimmed)
      onOpenChange(false)
    } catch (caught) {
      setError(toStorageError(caught, "renaming the deck"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Deck umbenennen</DialogTitle>
            <DialogDescription>Nur der Name ändert sich; Karten und importierte Liste bleiben.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={trimmed === "" || undefined}>
            <FieldLabel htmlFor="deck-rename">Name des Decks</FieldLabel>
            <Input id="deck-rename" value={name} maxLength={MAX_NAME} autoComplete="off" aria-invalid={trimmed === "" || undefined} onChange={(event) => setName(event.currentTarget.value)} />
            {trimmed === "" ? <FieldError>Das Deck braucht einen Namen.</FieldError> : taken ? <FieldDescription>Ein anderes Deck heißt schon so.</FieldDescription> : null}
          </Field>
          {error !== null ? <StorageErrorAlert error={error} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={trimmed === "" || busy}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteDeckDialog({ deck, open, onOpenChange, onDelete }: { deck: DeckRecord; open: boolean; onOpenChange: (open: boolean) => void; onDelete: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>„{deck.name}“ löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Das Deck und seine importierte Liste werden von diesem Gerät gelöscht. Gespielte Partien behalten ihre eigene Kopie des Decks. Willst du es
            aufheben, speichere vorher eine Sicherung (Einstellungen).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type ExportKind = "arena" | "original"

const EXPORT_KINDS: readonly { readonly kind: ExportKind; readonly title: string; readonly text: string }[] = [
  {
    kind: "arena",
    title: "Liste mit den Namen, die Forge kennt",
    text: "So, wie OpenMana das Deck spielt: jede Karte geklärt, weggelassene Zeilen fehlen. Lässt sich in OpenMana ohne Rückfrage wieder importieren.",
  },
  {
    kind: "original",
    title: "Importierte Liste, unverändert",
    text: "Genau der Text, den du importiert hast – für MTG Arena am besten, denn Forge kennt manche Karten unter anderem Namen.",
  },
]

export function ExportDialog({ deck, sets, open, onOpenChange }: { deck: DeckRecord; sets: ReadonlyMap<string, SetRecord>; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [kind, setKind] = useState<ExportKind>("arena")
  const id = useId()
  const text = kind === "arena" ? arenaList(deck, sets) : deck.source.text
  const fileName = listFileName(deck.name, kind === "original" ? " (Original)" : "")
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Liste kopiert", { description: "Sie liegt jetzt in der Zwischenablage." })
    } catch (error) {
      toast.error("Kopieren ging nicht", { description: `Markiere den Text und kopiere ihn selbst. (${error instanceof Error ? error.message : String(error)})` })
    }
  }
  const save = () => {
    downloadFile(new Blob([text], { type: "text/plain;charset=utf-8" }), fileName)
    toast.success("Liste gespeichert", { description: fileName })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deck exportieren</DialogTitle>
          <DialogDescription>„{deck.name}“ als Deckliste im MTG-Arena-Format – kopieren oder als Textdatei speichern.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={kind} onValueChange={(value) => setKind(value === "original" ? "original" : "arena")} aria-label="Welche Liste?">
          {/* Choice cards as in the backup import: the radios are named by aria-labelledby. */}
          {EXPORT_KINDS.map((option) => (
            <FieldLabel key={option.kind} htmlFor={`${id}-${option.kind}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle id={`${id}-${option.kind}-title`}>{option.title}</FieldTitle>
                  <FieldDescription id={`${id}-${option.kind}-text`}>{option.text}</FieldDescription>
                </FieldContent>
                <RadioGroupItem value={option.kind} id={`${id}-${option.kind}`} aria-labelledby={`${id}-${option.kind}-title`} aria-describedby={`${id}-${option.kind}-text`} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-text`}>Deckliste</FieldLabel>
          <Textarea id={`${id}-text`} className="max-h-72 min-h-40" value={text} readOnly spellCheck={false} onFocus={(event) => event.currentTarget.select()} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={save}>
            <Download data-icon="inline-start" aria-hidden />
            Als Textdatei speichern
          </Button>
          <Button onClick={() => void copy()}>
            <Copy data-icon="inline-start" aria-hidden />
            Kopieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
