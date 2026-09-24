/*
 * Decks: the local deck library as the database holds it. Import (prompt 09)
 * and the library's own actions (prompt 10) follow; until then the page
 * shows exactly what is stored - nothing, or what a loaded backup brought -
 * and a damaged record as damaged, never hidden.
 */
import { Layers, Upload } from "lucide-react"
import { Page } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { cardCount, listDecks } from "@/storage/decks"
import type { DeckRecord } from "@/storage/generated/records"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorageQuery } from "@/storage/storage-context"
import { DECK_FORMAT_LABELS, formatDateTime } from "@/storage/storage-labels"

function ImportButton() {
  return (
    <>
      <Button size="lg" disabled aria-describedby="decks-import-note">
        <Upload data-icon="inline-start" aria-hidden />
        Arena-Deck importieren
      </Button>
      <p id="decks-import-note" className="text-sm text-muted-foreground">
        Der Import folgt in Kürze.
      </p>
    </>
  )
}

function describeDeck(deck: DeckRecord): string {
  const parts = [DECK_FORMAT_LABELS[deck.format], `${cardCount(deck.main)} Karten`]
  if (deck.commander.length > 0) parts.push(`Commander ${cardCount(deck.commander)}`)
  if (deck.sideboard.length > 0) parts.push(`Sideboard ${cardCount(deck.sideboard)}`)
  parts.push(`geändert am ${formatDateTime(deck.updatedAt)}`)
  return parts.join(" · ")
}

export function DecksPage() {
  const decks = useStorageQuery(["decks"], listDecks)
  return (
    <Page title="Decks" description="Deine Decks – gespeichert nur auf diesem Gerät.">
      {decks.status === "loading" ? (
        <Skeleton className="h-40 w-full" aria-label="Decks werden geladen" />
      ) : decks.status === "error" ? (
        <StorageErrorAlert error={decks.error}>
          <span className="mt-1 block">
            Mehr dazu in den <TextLink to="/settings">Einstellungen</TextLink> unter „Daten auf diesem Gerät“.
          </span>
        </StorageErrorAlert>
      ) : decks.data.records.length === 0 && decks.data.invalid.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Noch keine Decks</EmptyTitle>
            <EmptyDescription>Hier erscheinen deine importierten Arena-Decklisten.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ImportButton />
          </EmptyContent>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{decks.data.records.length === 1 ? "1 Deck" : `${decks.data.records.length} Decks`}</CardTitle>
            <CardDescription>Details, Bearbeiten und Löschen folgen mit der Deck-Bibliothek.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ItemGroup aria-label="Gespeicherte Decks" role="list">
              {decks.data.records.map((deck) => (
                <Item key={deck.id} variant="outline" role="listitem">
                  <ItemMedia variant="icon">
                    <Layers aria-hidden />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{deck.name}</ItemTitle>
                    <ItemDescription>{describeDeck(deck)}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
              {decks.data.invalid.map((record) => (
                <Item key={record.key} variant="outline" role="listitem">
                  <ItemContent>
                    <ItemTitle>
                      Beschädigter Eintrag <Badge variant="destructive">beschädigt</Badge>
                    </ItemTitle>
                    <ItemDescription>
                      Dieses Deck hat nicht das erwartete Format. Prüfen und entfernen: <TextLink to="/settings">Einstellungen</TextLink> → Daten
                      prüfen.
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
            <div className="flex flex-col items-start gap-2">
              <ImportButton />
            </div>
          </CardContent>
        </Card>
      )}
    </Page>
  )
}
