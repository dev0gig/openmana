/*
 * "Erneut importieren" (/decks/:deckId/import, loaded on demand): the deck
 * import page for an existing deck - its saved list to change or replace,
 * its earlier choices kept, saving replaces the deck (deck-import-page.tsx).
 * A deck that is gone or damaged is said so instead.
 */
import { ArrowLeft, CircleHelp } from "lucide-react"
import { useCallback } from "react"
import { Link, useParams } from "react-router"
import { Page } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { LocalDatabase } from "@/storage/database"
import { getDeck } from "@/storage/decks"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorageQuery } from "@/storage/storage-context"
import { DeckImportPage } from "./deck-import-page"

const DECKS = ["decks"] as const

function BackToDecks() {
  return (
    <Button asChild variant="ghost">
      <Link to="/decks">
        <ArrowLeft data-icon="inline-start" aria-hidden />
        Zu den Decks
      </Link>
    </Button>
  )
}

export function DeckUpdatePage() {
  const { deckId = "" } = useParams()
  const query = useCallback((db: LocalDatabase) => getDeck(db, deckId), [deckId])
  const lookup = useStorageQuery(DECKS, query)
  if (lookup.status === "loading") {
    return (
      <Page title="Deck neu importieren" actions={<BackToDecks />}>
        <Skeleton className="h-40 w-full" aria-label="Deck wird geladen" />
      </Page>
    )
  }
  if (lookup.status === "error") {
    return (
      <Page title="Deck neu importieren" actions={<BackToDecks />}>
        <StorageErrorAlert error={lookup.error} />
      </Page>
    )
  }
  if (lookup.data.status === "missing") {
    return (
      <Page title="Deck nicht gefunden">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleHelp aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Dieses Deck gibt es nicht (mehr)</EmptyTitle>
            <EmptyDescription>Es wurde gelöscht – vielleicht in einem anderen Tab. Eine Liste lässt sich als neues Deck importieren.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/decks/import">Arena-Deck importieren</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Page>
    )
  }
  if (lookup.data.status === "damaged") {
    return (
      <Page title="Beschädigtes Deck" actions={<BackToDecks />}>
        <Alert variant="destructive">
          <CircleHelp aria-hidden />
          <AlertTitle>Dieses Deck hat nicht das erwartete Format</AlertTitle>
          <AlertDescription>
            <span>
              Es lässt sich nicht neu importieren. Prüfen und entfernen: <TextLink to="/settings">Einstellungen</TextLink> → Daten prüfen; danach die Liste als
              neues Deck importieren.
            </span>
          </AlertDescription>
        </Alert>
      </Page>
    )
  }
  // Keyed: another deck's import starts from its own list.
  return <DeckImportPage key={lookup.data.deck.id} update={lookup.data.deck} />
}
