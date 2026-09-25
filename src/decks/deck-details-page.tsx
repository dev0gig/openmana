/*
 * One deck of the library (/decks/:deckId, loaded on demand): its parts
 * card by card - German where Scryfall has it, English marked, the printing
 * the list named -, format and counts, how German its cards are, and what
 * can be done with it (deck-actions.tsx: play, rename, duplicate, export,
 * import again, let the AI play it, delete). Any card opens its full view.
 *
 * A deck deleted meanwhile (another tab) or damaged is shown as such; the
 * page never shows a deck it cannot read.
 */
import { ArrowLeft, CircleHelp, ScrollText } from "lucide-react"
import { useCallback, useId, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { usePreferences } from "@/app/preferences"
import { useCardCatalog } from "@/cards/card-catalog-context"
import { CardDetails } from "@/cards/card-details"
import { cardDisplay, type TextLanguage } from "@/cards/card-display"
import { FORGE_ONLY_LABELS } from "@/cards/card-labels"
import { printKey } from "@/cards/print-key"
import { FactList, type Fact } from "@/components/fact-list"
import { Page } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { ActionBar } from "@/components/ui/action-bar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CardPicture } from "@/components/ui/card-picture"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useIsMobile } from "@/hooks/use-mobile"
import type { LocalDatabase } from "@/storage/database"
import { getDeck, listDecks, type DeckLookup } from "@/storage/decks"
import type { PrintRecord } from "@/storage/generated/records"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorage, useStorageQuery } from "@/storage/storage-context"
import { DECK_FORMAT_LABELS, formatDateTime } from "@/storage/storage-labels"
import { CatalogHint } from "./catalog-hint"
import { DeckActions } from "./deck-actions"
import { DECK_PARTS, EMPTY_INDEX, LIBRARY_STORES, pictureOf, readDeckCards, viewDeck, type DeckCardIndex, type DeckPart, type DeckView, type EntryView } from "./deck-view"
import { cardsLabel, describeDeck, LANGUAGE_BADGES, LANGUAGE_REASONS, languageSummary, PART_LABELS } from "./library-labels"
import { useNamedPrints, type NamedPrints } from "./named-prints"

interface DeckDetails {
  readonly lookup: DeckLookup
  readonly index: DeckCardIndex
  /** The names of the other decks (copies, the rename hint). */
  readonly otherNames: readonly string[]
}

async function readDeckDetails(db: LocalDatabase, id: string): Promise<DeckDetails> {
  const [lookup, all] = await Promise.all([getDeck(db, id), listDecks(db)])
  const index = lookup.status === "found" ? await readDeckCards(db, [lookup.deck]) : EMPTY_INDEX
  return { lookup, index, otherNames: all.records.filter((deck) => deck.id !== id).map((deck) => deck.name) }
}

const PART_NOTES: Partial<Record<DeckPart, string>> = {
  companion: "Spielt aus dem Sideboard – dort sucht Forge ihn zu Spielbeginn.",
}

function printOf(view: EntryView, prints: NamedPrints, language: TextLanguage): PrintRecord | null {
  const { set, collectorNumber } = view.entry
  if (set === undefined || collectorNumber === undefined) return null
  return pictureOf(view, prints.prints.get(printKey({ set, collectorNumber })), language)
}

function Thumb({ view, print }: { view: EntryView; print: PrintRecord | null }) {
  const { cardLanguage } = usePreferences()
  const url = view.card ? (cardDisplay(view.card, { ...(view.match ? { match: view.match } : {}), print, language: cardLanguage }).picture?.urls.thumb ?? null) : null
  if (url === null) {
    return (
      <ItemMedia variant="icon">
        <ScrollText aria-hidden />
      </ItemMedia>
    )
  }
  return (
    <ItemMedia>
      <div className="w-10">
        <CardPicture src={url} alt="" fallback={null} />
      </div>
    </ItemMedia>
  )
}

/** "Forge: Delver of Secrets · MID 47" - what the entry is beyond its shown name. */
function entryDetail(view: EntryView): string {
  const { entry } = view
  return [view.name.text !== entry.name ? `Forge: ${entry.name}` : null, entry.set !== undefined ? `${entry.set.toUpperCase()} ${entry.collectorNumber ?? ""}`.trim() : null]
    .filter(Boolean)
    .join(" · ")
}

/** An entry's identity in the deck (the plan adds up entries of one card and printing, so it is unique in its part). */
function entryKey(view: EntryView): string {
  return [view.part, view.entry.name, view.entry.set ?? "", view.entry.collectorNumber ?? ""].join("|")
}

function EntryRow({ view, prints, onOpen }: { view: EntryView; prints: NamedPrints; onOpen: (view: EntryView) => void }) {
  const id = useId()
  const { cardLanguage } = usePreferences()
  // With English cards only what is missing entirely is news (prompt 12).
  const badge = cardLanguage === "de" || view.language === "forge-only" || view.language === "unknown" ? LANGUAGE_BADGES[view.language] : null
  const detail = entryDetail(view)
  return (
    <div role="listitem">
      <Item asChild variant="outline" size="sm">
        <button type="button" className="text-left" onClick={() => onOpen(view)} aria-labelledby={`${id}-title`} aria-describedby={detail ? `${id}-detail` : undefined}>
          <Thumb view={view} print={printOf(view, prints, cardLanguage)} />
          <ItemContent>
            <ItemTitle id={`${id}-title`}>
              <span className="whitespace-nowrap tabular-nums">{view.entry.count} ×</span> {view.name.text}
              {badge !== null ? <Badge variant="outline">{badge}</Badge> : null}
            </ItemTitle>
            {detail ? <ItemDescription id={`${id}-detail`}>{detail}</ItemDescription> : null}
          </ItemContent>
        </button>
      </Item>
    </div>
  )
}

function PartCard({ view, part, prints, onOpen }: { view: DeckView; part: DeckPart; prints: NamedPrints; onOpen: (view: EntryView) => void }) {
  const entries = view.parts[part]
  if (entries.length === 0) return null
  const id = `deck-part-${part}`
  const note = PART_NOTES[part]
  return (
    <Card role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle id={id}>{PART_LABELS[part]}</CardTitle>
        <CardDescription>
          {cardsLabel(view.counts[part])}
          {note ? ` – ${note}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup aria-label={PART_LABELS[part]} className="gap-2">
          {entries.map((entry, i) => (
            <EntryRow key={`${entryKey(entry)}|${i}`} view={entry} prints={prints} onOpen={onOpen} />
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}

function overviewFacts(view: DeckView): Fact[] {
  const { deck, counts } = view
  const lines = deck.source.text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "").length
  return [
    { label: "Format", value: DECK_FORMAT_LABELS[deck.format] },
    ...(counts.commander > 0 ? [{ label: PART_LABELS.commander, value: view.parts.commander.map((entry) => entry.name.text).join(", ") }] : []),
    ...(counts.companion > 0 ? [{ label: PART_LABELS.companion, value: view.parts.companion.map((entry) => entry.name.text).join(", ") }] : []),
    { label: PART_LABELS.main, value: cardsLabel(counts.main) },
    { label: PART_LABELS.sideboard, value: cardsLabel(counts.sideboard) },
    { label: "Angelegt", value: formatDateTime(deck.createdAt) },
    { label: "Zuletzt geändert", value: formatDateTime(deck.updatedAt) },
    { label: "Liste importiert", value: `${formatDateTime(deck.source.importedAt)} (${lines === 1 ? "1 Zeile" : `${lines} Zeilen`}, Arena-Format)` },
  ]
}

function LanguageCard({ view, usable }: { view: DeckView; usable: boolean }) {
  const groups = (["partial", "en", "forge-only", "unknown"] as const)
    .map((language) => ({ language, names: view.language.notGerman.filter((entry) => entry.language === language).map((entry) => entry.name.text) }))
    .filter((group) => group.names.length > 0)
  return (
    <Card role="region" aria-labelledby="deck-language-title">
      <CardHeader>
        <CardTitle id="deck-language-title">Kartensprache</CardTitle>
        <CardDescription>{usable ? languageSummary(view) : "Ohne Kartendaten auf diesem Gerät nicht bekannt."}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!usable ? (
          <p className="text-muted-foreground">Die Karten erscheinen mit den englischen Namen, die Forge kennt.</p>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground">Jede Karte gibt es auf Deutsch – Name, Text und Bild.</p>
        ) : (
          groups.map((group) => (
            <div key={group.language} className="flex flex-col gap-1">
              <p className="font-medium">{LANGUAGE_REASONS[group.language]}</p>
              <p className="text-muted-foreground">{group.names.join(", ")}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

/** A card's full view. `view` stays while the dialog closes (no empty dialog in its closing animation). */
function EntryDialog({ view, open, print, onClose }: { view: EntryView | null; open: boolean; print: PrintRecord | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        {view !== null ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {view.entry.count} × {view.name.text}
              </DialogTitle>
              <DialogDescription>{[PART_LABELS[view.part], entryDetail(view) || null].filter(Boolean).join(" · ")}</DialogDescription>
            </DialogHeader>
            {view.card !== null ? (
              <CardDetails card={view.card} {...(view.match ? { match: view.match } : {})} print={print} />
            ) : (
              <Alert>
                <CircleHelp aria-hidden />
                <AlertTitle>{view.forgeOnly !== null ? "Keine Scryfall-Daten zu dieser Karte" : "Keine Kartendaten zu dieser Karte"}</AlertTitle>
                <AlertDescription>
                  {view.forgeOnly !== null
                    ? `Forge kennt „${view.entry.name}“ und spielt sie; ${FORGE_ONLY_LABELS[view.forgeOnly.reason]}. In der Partie zeigt OpenMana Forges eigenen Text.`
                    : `Forge spielt sie als „${view.entry.name}“. Auf diesem Gerät liegen dazu keine Kartendaten (nicht eingerichtet, eine andere Version, oder die Liste ließ offen, welches Kartenbild gemeint ist).`}
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

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

export function DeckDetailsPage() {
  const { deckId = "" } = useParams()
  const query = useCallback((db: LocalDatabase) => readDeckDetails(db, deckId), [deckId])
  const details = useStorageQuery(LIBRARY_STORES, query)
  const catalog = useCardCatalog()
  const { snapshot } = useStorage()
  const database = snapshot.status === "ready" ? snapshot.database : null
  const phone = useIsMobile()
  const { cardLanguage } = usePreferences()
  // The open card by its identity, resolved against the deck as it is now (Bible §16: no stale card objects kept).
  const [shown, setShown] = useState<{ readonly key: string; readonly open: boolean } | null>(null)
  const view = useMemo(
    () => (details.status === "ready" && details.data.lookup.status === "found" ? viewDeck(details.data.lookup.deck, details.data.index, cardLanguage) : null),
    [details, cardLanguage],
  )
  const prints = useNamedPrints(database, view)
  const opened = shown !== null && view !== null ? (DECK_PARTS.flatMap((part) => view.parts[part]).find((entry) => entryKey(entry) === shown.key) ?? null) : null

  if (details.status === "loading") {
    return (
      <Page title="Deck" actions={<BackToDecks />}>
        <Skeleton className="h-40 w-full" aria-label="Deck wird geladen" />
      </Page>
    )
  }
  if (details.status === "error") {
    return (
      <Page title="Deck" actions={<BackToDecks />}>
        <StorageErrorAlert error={details.error} />
      </Page>
    )
  }
  const lookup = details.data.lookup
  if (lookup.status === "missing") {
    return (
      <Page title="Deck nicht gefunden">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleHelp aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Dieses Deck gibt es nicht (mehr)</EmptyTitle>
            <EmptyDescription>Es wurde gelöscht – vielleicht in einem anderen Tab – oder der Link ist falsch.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <BackToDecks />
          </EmptyContent>
        </Empty>
      </Page>
    )
  }
  if (lookup.status === "damaged") {
    return (
      <Page title="Beschädigtes Deck" actions={<BackToDecks />}>
        <Alert variant="destructive">
          <CircleHelp aria-hidden />
          <AlertTitle>Dieses Deck hat nicht das erwartete Format</AlertTitle>
          <AlertDescription>
            <span>
              OpenMana zeigt es nicht, damit nichts Falsches gespielt wird. Prüfen und entfernen: <TextLink to="/settings">Einstellungen</TextLink> → Daten
              prüfen.
            </span>
          </AlertDescription>
        </Alert>
      </Page>
    )
  }
  if (view === null || database === null) return null

  const actions = (layout: "header" | "bar") => (
    <DeckActions database={database} deck={view.deck} otherNames={details.data.otherNames} sets={details.data.index.sets} layout={layout} />
  )
  const header = phone ? (
    <BackToDecks />
  ) : (
    <>
      <BackToDecks />
      {actions("header")}
    </>
  )
  return (
    <Page title={view.deck.name} description={describeDeck(view, DECK_FORMAT_LABELS)} actions={header}>
      <CatalogHint />
      {prints.status === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <Spinner className="size-4" />
          Lade {prints.count === 1 ? "das Bild des genannten Drucks" : `die Bilder der ${prints.count} genannten Drucke`} von Scryfall …
        </p>
      ) : prints.status === "done" && prints.error !== null ? (
        <Alert>
          <CircleHelp aria-hidden />
          <AlertTitle>Bilder der genannten Drucke nicht verfügbar</AlertTitle>
          <AlertDescription>Scryfall war nicht erreichbar; gezeigt werden die üblichen Bilder der Karten. ({prints.error.message})</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card role="region" aria-labelledby="deck-overview-title">
          <CardHeader>
            <CardTitle id="deck-overview-title">Überblick</CardTitle>
            <CardDescription>Wie Forge das Deck spielt. Ob es in einem Format erlaubt ist, entscheidet Forge.</CardDescription>
          </CardHeader>
          <CardContent>
            <FactList facts={overviewFacts(view)} />
          </CardContent>
        </Card>
        {/* How German the deck can be shown: no news with English cards (prompt 12). */}
        {cardLanguage === "de" ? <LanguageCard view={view} usable={catalog.usable} /> : null}
      </div>
      {DECK_PARTS.map((part) => (
        <PartCard key={part} view={view} part={part} prints={prints} onOpen={(entry) => setShown({ key: entryKey(entry), open: true })} />
      ))}
      <EntryDialog
        view={opened}
        // A card that is no longer in the deck (changed in another tab) closes its view.
        open={shown?.open === true && opened !== null}
        print={opened !== null ? printOf(opened, prints, cardLanguage) : null}
        onClose={() => setShown((current) => (current === null ? null : { ...current, open: false }))}
      />
      {phone ? <ActionBar aria-label="Deck-Aktionen">{actions("bar")}</ActionBar> : null}
    </Page>
  )
}
