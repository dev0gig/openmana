/*
 * Play: prepare a game against Forge's AI. The player chooses their deck and
 * the AI's - one of their decks, or a random one drawn for every game
 * (src/decks/deck-selection.ts); both choices are kept in the local
 * database, so the next game starts without choosing again. The AI profile
 * is a preference (prompt 12): shown here with a way to change it, never a
 * step before the start.
 *
 * Opening the page with a deck to play prewarms the engine (about 4-5 s of
 * boot, research §4), so "Partie starten" usually finds it ready; the engine
 * panel shows it booting. The start itself (src/game/game-start.ts) hands
 * the game to the engine session and goes to the game page, whatever the
 * engine is doing - it waits for a booting engine and restarts a failed one.
 * No sample decks, no simulated table.
 */
import { Bot, Layers, Swords, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useMemo } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { usePreferences } from "@/app/preferences"
import { Page } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { ActionBar } from "@/components/ui/action-bar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { DeckPickerDialog, type PickedDeck } from "@/decks/deck-picker-dialog"
import { AI_DECK, HUMAN_DECK, randomPool, readSelection, resolveSelection, type PlaySelection, type StoredSelection } from "@/decks/deck-selection"
import { LIBRARY_STORES, readDeckCards, viewDeck, type DeckCardIndex, type DeckView } from "@/decks/deck-view"
import { describeDeck } from "@/decks/library-labels"
import { EnginePanel } from "@/engine/engine-panel"
import { useEngineSession } from "@/engine/engine-session-context"
import { AiProfileDialog, describeAiProfileChoice } from "@/game/ai-profile-options"
import { useGameStart, type StartState } from "@/game/game-start"
import { useIsMobile } from "@/hooks/use-mobile"
import type { LocalDatabase } from "@/storage/database"
import { toStorageError } from "@/storage/errors"
import type { DeckFormat, DeckRecord } from "@/storage/generated/records"
import type { StoreName } from "@/storage/schema"
import { writeSetting } from "@/storage/settings"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorage, useStorageQuery } from "@/storage/storage-context"
import { DECK_FORMAT_LABELS, storageErrorAdvice, storageErrorTitle } from "@/storage/storage-labels"

const PLAY_STORES: readonly StoreName[] = ["settings", ...LIBRARY_STORES]

interface PlayData {
  readonly stored: StoredSelection
  readonly index: DeckCardIndex
}

async function readPlay(db: LocalDatabase): Promise<PlayData> {
  const stored = await readSelection(db)
  return { stored, index: await readDeckCards(db, stored.decks.records) }
}

function deckText(view: DeckView | undefined, deck: DeckRecord): string {
  return view ? `${deck.name} – ${describeDeck(view, DECK_FORMAT_LABELS)}` : deck.name
}

function humanText(selection: PlaySelection, views: ReadonlyMap<string, DeckView>): string {
  const human = selection.human
  switch (human.status) {
    case "none":
      return "Noch kein Deck gewählt."
    case "ok":
      return deckText(views.get(human.deck.id), human.deck)
    case "missing":
      return "Das gewählte Deck gibt es nicht mehr."
    case "damaged":
      return "Das gewählte Deck ist beschädigt."
  }
}

/** What a random draw can give (pool null: the player's deck is not chosen yet). */
function randomText(pool: readonly DeckRecord[] | null, format: DeckFormat | null): string {
  if (pool === null || format === null) return "Zufällig, für jede Partie neu gezogen."
  const label = DECK_FORMAT_LABELS[format]
  if (pool.length === 0) return `Zufällig – aber es gibt kein zweites ${label}-Deck.`
  return pool.length === 1 ? `Zufällig – dein einziges anderes ${label}-Deck.` : `Zufällig aus ${pool.length} ${label}-Decks, jede Partie neu.`
}

function aiText(selection: PlaySelection, views: ReadonlyMap<string, DeckView>): string {
  const ai = selection.ai
  switch (ai.status) {
    case "random":
      return randomText(ai.pool, selection.format)
    case "ok":
      return deckText(views.get(ai.deck.id), ai.deck)
    case "mismatch":
      return `${ai.deck.name} – ein ${DECK_FORMAT_LABELS[ai.deck.format]}-Deck passt nicht zu deinem ${selection.format !== null ? DECK_FORMAT_LABELS[selection.format] : ""}-Deck.`
    case "missing":
      return "Das gewählte Deck gibt es nicht mehr."
    case "damaged":
      return "Das gewählte Deck ist beschädigt."
  }
}

function StartButton({ state, start, className }: { state: StartState; start: () => void; className?: string }) {
  return (
    <>
      <Button size="lg" disabled={!state.enabled} aria-describedby="play-start-note" onClick={start} {...(className !== undefined ? { className } : {})}>
        <Swords data-icon="inline-start" aria-hidden />
        {state.action === "resume" ? "Zur laufenden Partie" : "Partie starten"}
      </Button>
      <span id="play-start-note" className="text-sm text-muted-foreground">
        {state.note}
      </span>
    </>
  )
}

export function PlayPage() {
  const data = useStorageQuery(PLAY_STORES, readPlay)
  const { snapshot } = useStorage()
  const database = snapshot.status === "ready" ? snapshot.database : null
  const phone = useIsMobile()
  const { prewarm } = useEngineSession()
  const preferences = usePreferences()
  const views = useMemo(
    () =>
      data.status === "ready"
        ? new Map(data.data.stored.decks.records.map((deck) => [deck.id, viewDeck(deck, data.data.index, preferences.cardLanguage)]))
        : new Map<string, DeckView>(),
    [data, preferences.cardLanguage],
  )
  const selection = data.status === "ready" ? resolveSelection(data.data.stored.human, data.data.stored.ai, data.data.stored.decks) : null
  const noDecks = data.status === "ready" && data.data.stored.decks.records.length === 0
  const { state: startState, start } = useGameStart({ data: data.status, noDecks, selection })

  // A deck to play is here: warm the engine up now, so the game does not wait for it (only from idle).
  const hasDecks = data.status === "ready" && !noDecks
  useEffect(() => {
    if (hasDecks) prewarm()
  }, [hasDecks, prewarm])

  const choose = async (write: (db: LocalDatabase) => Promise<void>) => {
    if (database === null) return
    try {
      await write(database)
    } catch (error) {
      const storageError = toStorageError(error, "saving the deck choice")
      toast.error(storageErrorTitle(storageError), { description: storageErrorAdvice(storageError) })
    }
  }
  const pickHuman = (picked: PickedDeck) => {
    if (picked.kind === "deck") void choose((db) => writeSetting(db, HUMAN_DECK, picked.deckId))
  }
  const pickAi = (picked: PickedDeck) => void choose((db) => writeSetting(db, AI_DECK, picked))

  const allViews = [...views.values()]
  const humanDeck = selection?.human.status === "ok" ? selection.human.deck : null
  const pool = humanDeck !== null && data.status === "ready" ? randomPool(humanDeck, data.data.stored.decks.records) : null
  const importLink = (
    <Button asChild variant="outline">
      <Link to="/decks/import">
        <Upload data-icon="inline-start" aria-hidden />
        Importieren
      </Link>
    </Button>
  )

  return (
    <Page title="Spielen" description="Du gegen die Forge-KI. Forge entscheidet alle Regeln, OpenMana zeigt sie dir.">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card role="region" aria-labelledby="play-setup-title">
          <CardHeader>
            <CardTitle id="play-setup-title">Partie vorbereiten</CardTitle>
            <CardDescription>Dein Deck gegen die Forge-KI. Die Wahl bleibt gespeichert, bis du sie änderst.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data.status === "loading" ? (
              <Skeleton className="h-32 w-full" aria-label="Decks werden geladen" />
            ) : data.status === "error" ? (
              <StorageErrorAlert error={data.error}>
                <span className="mt-1 block">
                  Mehr dazu in den <TextLink to="/settings">Einstellungen</TextLink> unter „Daten auf diesem Gerät“.
                </span>
              </StorageErrorAlert>
            ) : selection !== null ? (
              <>
                {selection.reset ? (
                  <Alert>
                    <TriangleAlert aria-hidden />
                    <AlertTitle>Eine gespeicherte Deckwahl war ungültig</AlertTitle>
                    <AlertDescription>Sie gilt nicht mehr; wähle die Decks bitte neu.</AlertDescription>
                  </Alert>
                ) : null}
                {startState.action === "resume" ? (
                  <Alert>
                    <Swords aria-hidden />
                    <AlertTitle>Eine Partie läuft</AlertTitle>
                    <AlertDescription>Eine neue kannst du starten, wenn sie vorbei ist. „Zur laufenden Partie“ bringt dich zurück.</AlertDescription>
                  </Alert>
                ) : null}
                <ItemGroup aria-label="Decks der Partie">
                  <Item variant="outline" role="listitem">
                    <ItemMedia variant="icon">
                      <Layers aria-hidden />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Dein Deck</ItemTitle>
                      <ItemDescription>{noDecks ? "Noch kein Deck auf diesem Gerät." : humanText(selection, views)}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {noDecks ? (
                        importLink
                      ) : (
                        <DeckPickerDialog
                          title="Dein Deck wählen"
                          description="Mit diesem Deck spielst du. Sein Format gilt für die Partie."
                          trigger={selection.human.status === "none" ? "Wählen" : "Ändern"}
                          triggerLabel="Dein Deck wählen"
                          decks={allViews}
                          selectedId={humanDeck?.id ?? null}
                          onPick={pickHuman}
                        />
                      )}
                    </ItemActions>
                  </Item>
                  <Item variant="outline" role="listitem">
                    <ItemMedia variant="icon">
                      <Bot aria-hidden />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Deck der KI</ItemTitle>
                      <ItemDescription>{noDecks ? "Die KI spielt eines deiner Decks – importiere zuerst eins." : aiText(selection, views)}</ItemDescription>
                    </ItemContent>
                    {noDecks ? null : (
                      <ItemActions>
                        <DeckPickerDialog
                          title="Deck der KI wählen"
                          description="Die KI spielt eines deiner Decks im Format deines Decks – oder ein zufälliges, für jede Partie neu gezogen."
                          trigger="Ändern"
                          triggerLabel="Deck der KI wählen"
                          decks={allViews}
                          selectedId={selection.ai.status === "ok" || selection.ai.status === "mismatch" ? selection.ai.deck.id : null}
                          disabledReason={(deck) =>
                            humanDeck !== null && deck.format !== humanDeck.format ? `anderes Format als dein Deck (${DECK_FORMAT_LABELS[humanDeck.format]})` : null
                          }
                          random={{
                            selected: selection.ai.status === "random",
                            description: randomText(pool, selection.format),
                            unavailable: humanDeck !== null && pool !== null && pool.length === 0 ? `Nicht möglich: Es gibt kein zweites ${DECK_FORMAT_LABELS[humanDeck.format]}-Deck.` : null,
                          }}
                          onPick={pickAi}
                        />
                      </ItemActions>
                    )}
                  </Item>
                  <Item variant="outline" role="listitem">
                    <ItemMedia variant="icon">
                      <Bot aria-hidden />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Gegner: Forge-KI</ItemTitle>
                      <ItemDescription>Profil {describeAiProfileChoice(preferences.aiProfile)}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <AiProfileDialog />
                    </ItemActions>
                  </Item>
                </ItemGroup>
              </>
            ) : null}
          </CardContent>
          {phone ? null : (
            <CardFooter className="flex flex-wrap items-center gap-3">
              <StartButton state={startState} start={start} />
            </CardFooter>
          )}
        </Card>
        <EnginePanel />
      </div>
      {phone ? (
        <ActionBar aria-label="Partie starten">
          <StartButton state={startState} start={start} className="w-full" />
        </ActionBar>
      ) : null}
    </Page>
  )
}
