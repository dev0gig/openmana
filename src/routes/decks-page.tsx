/*
 * Decks: the local deck library. Every deck the database holds - searchable
 * by its name or any of its cards' names (German or English), filtered by
 * format, sorted by name or date - with its format, card counts and how
 * German its cards are; a deck opens its details (/decks/:id: rename,
 * duplicate, export, import again, delete, play). The query is in the
 * address. A damaged record is listed as damaged, never hidden.
 */
import { ChevronRight, Layers, SearchX, Upload } from "lucide-react"
import { useMemo } from "react"
import { Link, useSearchParams } from "react-router"
import { useCardCatalog } from "@/cards/card-catalog-context"
import { cardDisplay } from "@/cards/card-display"
import { Page } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardPicture } from "@/components/ui/card-picture"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CatalogHint } from "@/decks/catalog-hint"
import { LIBRARY_STORES, readLibrary, viewDeck, type DeckView } from "@/decks/deck-view"
import { arrangeDecks, DECK_SORTS, formatsPresent, FORMAT_FILTERS, paramsFromQuery, queryFromParams, type DeckSort, type FormatFilter, type LibraryQuery } from "@/decks/library"
import { describeDeck, FORMAT_FILTER_LABELS, SORT_LABELS } from "@/decks/library-labels"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorageQuery } from "@/storage/storage-context"
import { DECK_FORMAT_LABELS, formatDateTime } from "@/storage/storage-labels"

function ImportButton() {
  return (
    <Button asChild size="lg">
      <Link to="/decks/import">
        <Upload data-icon="inline-start" aria-hidden />
        Arena-Deck importieren
      </Link>
    </Button>
  )
}

/** The card standing for the deck, or the deck icon where there is no picture. */
function Cover({ view }: { view: DeckView }) {
  const cover = view.cover
  const url = cover?.card ? (cardDisplay(cover.card, cover.match ? { match: cover.match } : {}).picture?.urls.thumb ?? null) : null
  if (url === null) {
    return (
      <ItemMedia variant="icon">
        <Layers aria-hidden />
      </ItemMedia>
    )
  }
  return (
    <ItemMedia>
      <div className="w-12">
        <CardPicture src={url} alt="" fallback={null} />
      </div>
    </ItemMedia>
  )
}

function DeckRow({ view, catalogUsable }: { view: DeckView; catalogUsable: boolean }) {
  const notGerman = view.language.notGerman.length
  const companion = view.parts.companion[0]
  return (
    <div role="listitem">
      <Item asChild variant="outline">
        <Link to={`/decks/${view.deck.id}`}>
          <Cover view={view} />
          <ItemContent>
            <ItemTitle>{view.deck.name}</ItemTitle>
            <ItemDescription>{describeDeck(view, DECK_FORMAT_LABELS)}</ItemDescription>
            <div className="flex flex-wrap gap-2">
              {view.parts.commander.map((commander) => (
                <Badge key={commander.entry.name} variant="secondary">
                  Kommandeur: {commander.name.text}
                </Badge>
              ))}
              {companion !== undefined ? <Badge variant="secondary">Gefährte: {companion.name.text}</Badge> : null}
              {catalogUsable && notGerman > 0 ? (
                <Badge variant="outline">{notGerman === 1 ? "1 Karte nicht ganz deutsch" : `${notGerman} Karten nicht ganz deutsch`}</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Geändert am {formatDateTime(view.deck.updatedAt)}</p>
          </ItemContent>
          <ItemActions>
            <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
          </ItemActions>
        </Link>
      </Item>
    </div>
  )
}

function DamagedRow() {
  return (
    <Item variant="outline" role="listitem">
      <ItemContent>
        <ItemTitle>
          Beschädigter Eintrag <Badge variant="destructive">beschädigt</Badge>
        </ItemTitle>
        <ItemDescription>
          Dieses Deck hat nicht das erwartete Format. Prüfen und entfernen: <TextLink to="/settings">Einstellungen</TextLink> → Daten prüfen.
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}

function Toolbar({ query, views, onChange }: { query: LibraryQuery; views: readonly DeckView[]; onChange: (query: LibraryQuery) => void }) {
  const formats = formatsPresent(views)
  return (
    <div role="search" aria-label="Decks durchsuchen" className="flex flex-wrap items-end gap-3">
      <Field className="min-w-48 flex-1">
        <FieldLabel htmlFor="deck-search">Suchen</FieldLabel>
        <Input
          id="deck-search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Deck- oder Kartenname"
          value={query.text}
          onChange={(event) => onChange({ ...query, text: event.currentTarget.value })}
        />
      </Field>
      {formats.length > 1 || query.format !== "all" ? (
        <Field className="w-auto">
          <FieldLabel id="deck-format-label">Format</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby="deck-format-label"
            value={query.format}
            onValueChange={(value) => {
              // Radix clears a single toggle group when the active item is pressed again: that means "all".
              onChange({ ...query, format: (FORMAT_FILTERS as readonly string[]).includes(value) ? (value as FormatFilter) : "all" })
            }}
          >
            {FORMAT_FILTERS.map((format) => (
              <ToggleGroupItem key={format} value={format}>
                {FORMAT_FILTER_LABELS[format]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      ) : null}
      <Field className="w-auto">
        <FieldLabel htmlFor="deck-sort">Sortieren</FieldLabel>
        <Select value={query.sort} onValueChange={(value) => onChange({ ...query, sort: value as DeckSort })}>
          <SelectTrigger id="deck-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DECK_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}

export function DecksPage() {
  const library = useStorageQuery(LIBRARY_STORES, readLibrary)
  const catalog = useCardCatalog()
  const [params, setParams] = useSearchParams()
  const query = queryFromParams(params)
  const views = useMemo(() => (library.status === "ready" ? library.data.decks.records.map((deck) => viewDeck(deck, library.data.index)) : []), [library])
  const shown = useMemo(() => arrangeDecks(views, query), [views, query])
  // Typing replaces the address instead of adding a history entry per letter.
  const change = (next: LibraryQuery) => setParams(paramsFromQuery(next), { replace: true })
  const filtered = query.text.trim() !== "" || query.format !== "all"

  return (
    <Page title="Decks" description="Deine Decks – gespeichert nur auf diesem Gerät." actions={library.status === "ready" && views.length > 0 ? <ImportButton /> : undefined}>
      {library.status === "loading" ? (
        <Skeleton className="h-40 w-full" aria-label="Decks werden geladen" />
      ) : library.status === "error" ? (
        <StorageErrorAlert error={library.error}>
          <span className="mt-1 block">
            Mehr dazu in den <TextLink to="/settings">Einstellungen</TextLink> unter „Daten auf diesem Gerät“.
          </span>
        </StorageErrorAlert>
      ) : views.length === 0 && library.data.decks.invalid.length === 0 ? (
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
        <>
          <CatalogHint />
          {views.length > 0 ? <Toolbar query={query} views={views} onChange={change} /> : null}
          <p className="text-sm text-muted-foreground" role="status">
            {filtered ? `${shown.length} von ${views.length} ${views.length === 1 ? "Deck" : "Decks"}` : views.length === 1 ? "1 Deck" : `${views.length} Decks`}
          </p>
          {filtered && shown.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Kein Deck passt</EmptyTitle>
                <EmptyDescription>
                  {query.text.trim() !== "" ? `Weder ein Deckname noch eine Karte enthält „${query.text.trim()}“` : "Kein Deck in diesem Format"}
                  {query.format !== "all" && query.text.trim() !== "" ? ` (Format ${FORMAT_FILTER_LABELS[query.format]})` : ""}.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => change({ ...query, text: "", format: "all" })}>
                  Suche zurücksetzen
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup aria-label="Gespeicherte Decks">
              {shown.map((view) => (
                <DeckRow key={view.deck.id} view={view} catalogUsable={catalog.usable} />
              ))}
              {library.data.decks.invalid.map((record) => (
                <DamagedRow key={record.key} />
              ))}
            </ItemGroup>
          )}
        </>
      )}
    </Page>
  )
}
