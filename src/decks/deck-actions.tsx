/*
 * What can be done with one deck: play it (the primary action), and in the
 * menu rename, duplicate, export, import its list again, let the AI play it,
 * delete. On phones the page puts these into the action bar at the bottom
 * of the screen, from md into its header - the same component either way.
 *
 * Everything goes through the storage layer (src/storage/decks.ts,
 * settings); a failure is a toast with the reason (Bible §16), a deleted
 * deck is not brought back by a late action.
 */
import { Bot, Copy, Download, Ellipsis, FileInput, Pencil, Swords, Trash2 } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { LocalDatabase } from "@/storage/database"
import { deleteDeck, duplicateDeck, renameDeck } from "@/storage/decks"
import { toStorageError } from "@/storage/errors"
import type { DeckRecord, SetRecord } from "@/storage/generated/records"
import { writeSetting } from "@/storage/settings"
import { storageErrorAdvice, storageErrorTitle } from "@/storage/storage-labels"
import { DeleteDeckDialog, ExportDialog, RenameDialog } from "./deck-dialogs"
import { AI_DECK, HUMAN_DECK } from "./deck-selection"
import { copyName } from "./library-labels"

type OpenDialog = "rename" | "export" | "delete" | null

function failed(error: unknown, operation: string): void {
  const storageError = toStorageError(error, operation)
  toast.error(storageErrorTitle(storageError), { description: storageErrorAdvice(storageError) })
}

export function DeckActions({
  database,
  deck,
  otherNames,
  sets,
  layout,
}: {
  database: LocalDatabase
  deck: DeckRecord
  /** The names of the library's other decks. */
  otherNames: readonly string[]
  /** For the export (Arena's set codes). */
  sets: ReadonlyMap<string, SetRecord>
  /** bar: the phone's action bar (the primary action takes the width). */
  layout: "header" | "bar"
}) {
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<OpenDialog>(null)
  // A new key for every opening: the rename dialog starts from the deck's current name.
  const [opened, setOpened] = useState(0)
  const show = (which: Exclude<OpenDialog, null>) => {
    setOpened((n) => n + 1)
    setDialog(which)
  }
  const openChange = (which: Exclude<OpenDialog, null>) => (open: boolean) => setDialog(open ? which : null)

  const play = async () => {
    try {
      await writeSetting(database, HUMAN_DECK, deck.id)
      void navigate("/play")
    } catch (error) {
      failed(error, "choosing the deck for a game")
    }
  }

  const forAi = async () => {
    try {
      await writeSetting(database, AI_DECK, { kind: "deck", deckId: deck.id })
      toast.success(`Die KI spielt jetzt „${deck.name}“`, { description: "Ändern kannst du das unter „Spielen“." })
    } catch (error) {
      failed(error, "choosing the AI's deck")
    }
  }

  const duplicate = async () => {
    try {
      const copy = await duplicateDeck(database, deck.id, { id: crypto.randomUUID(), name: copyName(deck.name, [deck.name, ...otherNames]) })
      toast.success(`Kopie „${copy.name}“ angelegt`)
      void navigate(`/decks/${copy.id}`)
    } catch (error) {
      failed(error, "duplicating the deck")
    }
  }

  const remove = async () => {
    try {
      await deleteDeck(database, deck.id)
      toast.success(`Deck „${deck.name}“ gelöscht`)
      void navigate("/decks")
    } catch (error) {
      failed(error, "deleting the deck")
    }
  }

  return (
    <>
      <Button size="lg" className={layout === "bar" ? "flex-1" : undefined} onClick={() => void play()}>
        <Swords data-icon="inline-start" aria-hidden />
        Mit diesem Deck spielen
      </Button>
      {/* Not modal: a dialog opened from the menu must get the focus and the pointer, not the closing menu. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button size="lg" variant="outline">
            <Ellipsis data-icon="inline-start" aria-hidden />
            Mehr
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuItem onSelect={() => show("rename")}>
            <Pencil aria-hidden />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void duplicate()}>
            <Copy aria-hidden />
            Duplizieren
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => show("export")}>
            <Download aria-hidden />
            Exportieren
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void navigate(`/decks/${deck.id}/import`)}>
            <FileInput aria-hidden />
            Erneut importieren
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void forAi()}>
            <Bot aria-hidden />
            Als Deck der KI wählen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => show("delete")}>
            <Trash2 aria-hidden />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog
        key={opened}
        deck={deck}
        otherNames={otherNames}
        open={dialog === "rename"}
        onOpenChange={openChange("rename")}
        onRename={async (name) => {
          const renamed = await renameDeck(database, deck.id, name)
          toast.success(`Deck heißt jetzt „${renamed.name}“`)
        }}
      />
      <ExportDialog deck={deck} sets={sets} open={dialog === "export"} onOpenChange={openChange("export")} />
      <DeleteDeckDialog deck={deck} open={dialog === "delete"} onOpenChange={openChange("delete")} onDelete={() => void remove()} />
    </>
  )
}
