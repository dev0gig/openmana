/*
 * Play: prepare a game against Forge's AI. The player chooses their deck and
 * the AI's - one of their decks, or a random one drawn for every game
 * (src/decks/deck-selection.ts); the choices are kept in the local
 * database, so the next game starts without choosing again. Nobody chooses a
 * mode (prompt 61): the player's deck sets it - a Jumpstart half brings the
 * row "Zweite Hälfte" at once, and the AI plays two halves too -, and from
 * then on the pickers offer only decks of that mode, with one line on how
 * many they leave out. The AI profile
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
import { useEffect, useMemo, type ReactNode } from "react"
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
import { deckMode, type DeckMode } from "@/decks/deck-mode"
import { DeckPickerDialog, type PickedDeck } from "@/decks/deck-picker-dialog"
import { AI_DECK, AI_HALF, drawSize, HUMAN_DECK, HUMAN_HALF, randomPool, readSelection, resolveStored, type HalfSide, type PlaySelection, type StoredSelection } from "@/decks/deck-selection"
import { LIBRARY_STORES, readDeckCards, viewDeck, type DeckCardIndex, type DeckView } from "@/decks/deck-view"
import { DECK_MODE_LABELS, describeDeck, GAME_MODE_LABELS, hiddenDecksNote } from "@/decks/library-labels"
import { EnginePanel } from "@/engine/engine-panel"
import { useEngineSession } from "@/engine/engine-session-context"
import { AiProfileDialog, describeAiProfileChoice } from "@/game/ai-profile-options"
import { useGameStart, type StartState } from "@/game/game-start"
import { useIsMobile } from "@/hooks/use-mobile"
import type { LocalDatabase } from "@/storage/database"
import { toStorageError } from "@/storage/errors"
import type { DeckRecord } from "@/storage/generated/records"
import type { StoreName } from "@/storage/schema"
import { writeSetting } from "@/storage/settings"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorage, useStorageQuery } from "@/storage/storage-context"
import { storageErrorAdvice, storageErrorTitle } from "@/storage/storage-labels"

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
  return view ? `${deck.name} – ${describeDeck(view)}` : deck.name
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

/** A second half, the player's or the AI's. */
function halfText(half: HalfSide, views: ReadonlyMap<string, DeckView>): string {
  switch (half.status) {
    case "none":
      return "Noch keine zweite Hälfte gewählt."
    case "ok":
      return deckText(views.get(half.deck.id), half.deck)
    case "missing":
      return "Die gewählte Hälfte gibt es nicht mehr."
    case "damaged":
      return "Die gewählte Hälfte ist beschädigt."
    case "mismatch":
      return `${half.deck.name} – keine Jumpstart-Hälfte (${DECK_MODE_LABELS[deckMode(half.deck)]}).`
    case "same":
      return `${half.deck.name} – dieselbe Hälfte wie die erste.`
  }
}

/** What a random draw can give (pool null: the player's deck is not chosen yet). */
function randomText(pool: readonly DeckRecord[] | null, mode: DeckMode | null): string {
  if (pool === null || mode === null) return "Zufällig, für jede Partie neu gezogen."
  if (mode === "jumpstart") {
    if (pool.length < 2) return `Zufällig – aber es gibt ${pool.length === 0 ? "keine weitere" : "nur eine weitere"} Jumpstart-Hälfte.`
    return pool.length === 2 ? "Zufällig – deine beiden anderen Jumpstart-Hälften." : `Zufällig: zwei von ${pool.length} Jumpstart-Hälften, jede Partie neu.`
  }
  const label = GAME_MODE_LABELS[mode]
  if (pool.length === 0) return `Zufällig – aber es gibt kein zweites ${label}-Deck.`
  return pool.length === 1 ? `Zufällig – dein einziges anderes ${label}-Deck.` : `Zufällig aus ${pool.length} ${label}-Decks, jede Partie neu.`
}

function aiText(selection: PlaySelection, views: ReadonlyMap<string, DeckView>): string {
  const ai = selection.ai
  switch (ai.status) {
    case "random":
      return randomText(ai.pool, selection.mode)
    case "ok":
      return deckText(views.get(ai.deck.id), ai.deck)
    case "mismatch":
      return `${ai.deck.name} – ${DECK_MODE_LABELS[deckMode(ai.deck)]} passt nicht zu deinem Deck (${selection.mode !== null ? GAME_MODE_LABELS[selection.mode] : ""}).`
    case "missing":
      return "Das gewählte Deck gibt es nicht mehr."
    case "damaged":
      return "Das gewählte Deck ist beschädigt."
  }
}

/** The decks a picker offers once the game's mode is set: only that mode's, and the line about the others. */
function fitting(views: readonly DeckView[], mode: DeckMode | null): { readonly decks: readonly DeckView[]; readonly note: string | null } {
  if (mode === null) return { decks: views, note: null }
  const decks = views.filter((view) => deckMode(view.deck) === mode)
  return { decks, note: hiddenDecksNote(views.length - decks.length, mode) }
}

/** One row of the game's decks. */
function DeckRow({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <Item variant="outline" role="listitem">
      <ItemMedia variant="icon">{icon}</ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{text}</ItemDescription>
      </ItemContent>
      {children !== null ? <ItemActions>{children}</ItemActions> : null}
    </Item>
  )
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
  const selection = data.status === "ready" ? resolveStored(data.data.stored) : null
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
  const stored = data.status === "ready" ? data.data.stored : null
  // A first deck that was the side's second half takes its place: the second slot is emptied (shown as empty), never the same half twice.
  const pickHuman = (picked: PickedDeck) => {
    if (picked.kind !== "deck") return
    void choose(async (db) => {
      await writeSetting(db, HUMAN_DECK, picked.deckId)
      if (stored?.humanHalf.value === picked.deckId) await writeSetting(db, HUMAN_HALF, null)
    })
  }
  const pickHumanHalf = (picked: PickedDeck) => {
    if (picked.kind === "deck") void choose((db) => writeSetting(db, HUMAN_HALF, picked.deckId))
  }
  const pickAi = (picked: PickedDeck) =>
    void choose(async (db) => {
      await writeSetting(db, AI_DECK, picked)
      if (picked.kind === "deck" && stored?.aiHalf.value === picked.deckId) await writeSetting(db, AI_HALF, null)
    })
  const pickAiHalf = (picked: PickedDeck) => {
    if (picked.kind === "deck") void choose((db) => writeSetting(db, AI_HALF, picked.deckId))
  }

  const allViews = [...views.values()]
  const mode = selection?.mode ?? null
  const jumpstart = mode === "jumpstart"
  const humanDeck = selection?.human.status === "ok" ? selection.human.deck : null
  const aiDeck = selection?.ai.status === "ok" || selection?.ai.status === "mismatch" ? selection.ai.deck : null
  // What a random draw could give now, also while the AI's decks are chosen (the picker's "Zufällig" says it).
  const ownDecks = [humanDeck, selection?.humanHalf?.status === "ok" ? selection.humanHalf.deck : null].filter((deck) => deck !== null)
  const pool = mode !== null && data.status === "ready" ? randomPool(mode, ownDecks, data.data.stored.decks.records) : null
  const offered = fitting(allViews, mode)
  const halfId = (half: HalfSide | null | undefined) => (half !== null && half !== undefined && "deck" in half ? half.deck.id : null)
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
            <CardDescription>
              Dein Deck gegen die Forge-KI. Der Modus ergibt sich aus deinem Deck{mode !== null ? ` – hier ${GAME_MODE_LABELS[mode]}` : ""}. Die Wahl bleibt
              gespeichert, bis du sie änderst.
            </CardDescription>
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
                  <DeckRow icon={<Layers aria-hidden />} title={jumpstart ? "Deine erste Hälfte" : "Dein Deck"} text={noDecks ? "Noch kein Deck auf diesem Gerät." : humanText(selection, views)}>
                    {noDecks ? (
                      importLink
                    ) : (
                      <DeckPickerDialog
                        title="Dein Deck wählen"
                        description="Mit diesem Deck spielst du; sein Modus gilt für die Partie. Eine Jumpstart-Hälfte (20 Karten) spielt mit einer zweiten Hälfte, ein Deck mit Kommandeur als Commander, jedes andere normal."
                        trigger={selection.human.status === "none" ? "Wählen" : "Ändern"}
                        triggerLabel="Dein Deck wählen"
                        decks={allViews}
                        selectedId={humanDeck?.id ?? null}
                        onPick={pickHuman}
                      />
                    )}
                  </DeckRow>
                  {jumpstart && selection.humanHalf !== null ? (
                    <DeckRow icon={<Layers aria-hidden />} title="Zweite Hälfte" text={halfText(selection.humanHalf, views)}>
                      <DeckPickerDialog
                        title="Zweite Hälfte wählen"
                        description="Zusammen mit deiner ersten Hälfte ergibt sie dein Deck der Partie: 40 Karten."
                        trigger={selection.humanHalf.status === "none" ? "Wählen" : "Ändern"}
                        triggerLabel="Zweite Hälfte wählen"
                        decks={offered.decks}
                        hiddenNote={offered.note}
                        selectedId={halfId(selection.humanHalf)}
                        disabledReason={(deck) => (deck.id === humanDeck?.id ? "schon deine erste Hälfte" : null)}
                        onPick={pickHumanHalf}
                      />
                    </DeckRow>
                  ) : null}
                  <DeckRow
                    icon={<Bot aria-hidden />}
                    title={jumpstart ? (selection.ai.status === "random" ? "Hälften der KI" : "Erste Hälfte der KI") : "Deck der KI"}
                    text={noDecks ? "Die KI spielt eines deiner Decks – importiere zuerst eins." : aiText(selection, views)}
                  >
                    {noDecks ? null : (
                      <DeckPickerDialog
                        title={jumpstart ? "Hälften der KI wählen" : "Deck der KI wählen"}
                        description={
                          jumpstart
                            ? "Die KI spielt zwei deiner Jumpstart-Hälften: zwei zufällige, für jede Partie neu gezogen – oder du wählst hier ihre erste und danach ihre zweite."
                            : "Die KI spielt eines deiner Decks im Modus deines Decks – oder ein zufälliges, für jede Partie neu gezogen."
                        }
                        trigger="Ändern"
                        triggerLabel={jumpstart ? "Hälften der KI wählen" : "Deck der KI wählen"}
                        decks={offered.decks}
                        hiddenNote={offered.note}
                        selectedId={aiDeck?.id ?? null}
                        random={{
                          selected: selection.ai.status === "random",
                          description: randomText(pool, mode),
                          unavailable:
                            mode !== null && pool !== null && pool.length < drawSize(mode)
                              ? jumpstart
                                ? "Nicht möglich: Dafür fehlen zwei weitere Jumpstart-Hälften."
                                : `Nicht möglich: Es gibt kein zweites ${GAME_MODE_LABELS[mode]}-Deck.`
                              : null,
                        }}
                        onPick={pickAi}
                      />
                    )}
                  </DeckRow>
                  {jumpstart && selection.aiHalf !== null ? (
                    <DeckRow icon={<Bot aria-hidden />} title="Zweite Hälfte der KI" text={halfText(selection.aiHalf, views)}>
                      <DeckPickerDialog
                        title="Zweite Hälfte der KI wählen"
                        description="Zusammen mit ihrer ersten Hälfte ergibt sie das Deck der KI: 40 Karten."
                        trigger={selection.aiHalf.status === "none" ? "Wählen" : "Ändern"}
                        triggerLabel="Zweite Hälfte der KI wählen"
                        decks={offered.decks}
                        hiddenNote={offered.note}
                        selectedId={halfId(selection.aiHalf)}
                        disabledReason={(deck) => (deck.id === aiDeck?.id ? "schon die erste Hälfte der KI" : null)}
                        onPick={pickAiHalf}
                      />
                    </DeckRow>
                  ) : null}
                  <DeckRow icon={<Bot aria-hidden />} title="Gegner: Forge-KI" text={`Profil ${describeAiProfileChoice(preferences.aiProfile)}`}>
                    <AiProfileDialog />
                  </DeckRow>
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
