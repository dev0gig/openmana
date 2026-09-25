/*
 * "Arena-Deck importieren": paste an MTG Arena deck list (or open a text
 * file), let OpenMana check it against the card catalog, decide what is open,
 * name the deck and save it into the local library.
 *
 * The flow (Bible §5): the list is read line by line (arena-list.ts), every
 * entry is resolved to the card Forge knows (deck-resolve.ts - the catalog on
 * this device; Scryfall's API only for lines the catalog cannot decide that
 * name a printing), and the report shows everything before anything is
 * saved: unreadable lines, names without a card, ambiguous names (the player
 * chooses), cards Forge does not know. Saving is possible only once every
 * line is clear - corrected, chosen, or left out on purpose - and the deck
 * has a name. The list itself is kept with the deck, unchanged.
 *
 * Without the card catalog nothing can be checked: the page offers to set
 * it up right here (the same install as in the settings).
 *
 * The same page imports a deck's list again (the library's "Erneut
 * importieren", /decks/:id/import): it starts with the deck's saved list and
 * name, a name the deck's cards decide is taken as before (the player chose
 * it then), and saving replaces the deck's cards and list - confirmed, since
 * it cannot be undone - while the deck keeps its id and creation.
 */
import { ArrowLeft, FileText, ListChecks, RefreshCw, Save } from "lucide-react"
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import { useCardCatalog } from "@/cards/card-catalog-context"
import { CardDataErrorAlert } from "@/cards/card-error-alert"
import { InstallButton, InstallProgressView } from "@/cards/card-data-card"
import { lookupPrints } from "@/cards/scryfall-access"
import { Page } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
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
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { replaceDeck, saveDeck } from "@/storage/decks"
import { toStorageError, type StorageError } from "@/storage/errors"
import type { DeckRecord } from "@/storage/generated/records"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorage } from "@/storage/storage-context"
import { DECK_FORMAT_LABELS, formatBytes } from "@/storage/storage-labels"
import { MAX_LIST_CHARACTERS, parseArenaDeckList } from "./arena-list"
import { cardsLabel } from "./deck-import-labels"
import { deckRecordFrom, planDeck, plannedCount } from "./deck-plan"
import { resolveDeckList, type DeckImportReport } from "./deck-resolve"
import { deckOracleIds } from "./deck-view"
import { DeckPreview, OpenLines, ReportSummary } from "./import-report"

interface Checked {
  readonly status: "done"
  /** The text that was checked (kept with the deck). */
  readonly text: string
  readonly report: DeckImportReport
}

type Check =
  | { readonly status: "idle" }
  /**
   * scryfall: how many printings are being asked of Scryfall (0: the catalog is being read).
   * previous: the report being updated (a choice, checking again) - it stays on screen meanwhile.
   */
  | { readonly status: "checking"; readonly scryfall: number; readonly previous: Checked | null }
  | Checked
  | { readonly status: "failed"; readonly error: StorageError }

const TOO_LONG = `Die Liste ist länger als ${MAX_LIST_CHARACTERS.toLocaleString("de-DE")} Zeichen – so lang ist keine Arena-Deckliste.`

/** A text file as text: UTF-8 (with or without byte order mark) or UTF-16 with byte order mark; anything else is refused. */
async function readTextFile(file: File): Promise<string> {
  if (file.size > MAX_LIST_CHARACTERS * 4) throw new Error(TOO_LONG)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8"
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    throw new Error("Die Datei ist keine Textdatei (UTF-8). Öffne sie in einem Texteditor und füge die Liste hier ein.")
  }
}

function CatalogNeeded() {
  const catalog = useCardCatalog()
  if (catalog.usable || catalog.status === "loading") return null
  if (catalog.status === "unavailable") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Diese Version enthält keine Kartendaten</AlertTitle>
        <AlertDescription>Ohne Kartendaten kann OpenMana Decklisten nicht prüfen; der Import ist in dieser Version nicht möglich.</AlertDescription>
      </Alert>
    )
  }
  if (catalog.status === "storage-error") return null
  return (
    <Card role="region" aria-labelledby="import-catalog-title">
      <CardHeader>
        <CardTitle id="import-catalog-title">Kartendaten nötig</CardTitle>
        <CardDescription>
          Zum Prüfen der Liste braucht OpenMana die Kartendaten auf diesem Gerät: einmalig{" "}
          {catalog.assets.available ? formatBytes(catalog.assets.bytes) : "ein Download"}, danach geht
          alles ohne Internet.
        </CardDescription>
      </CardHeader>
      {catalog.status === "installing" || catalog.error !== null ? (
        <CardContent className="flex flex-col gap-4">
          {catalog.status === "installing" ? <InstallProgressView state={catalog} /> : null}
          {catalog.error !== null ? <CardDataErrorAlert error={catalog.error} /> : null}
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap gap-3">
        {catalog.status === "installing" ? (
          <Button size="lg" variant="outline" onClick={catalog.cancel}>
            Abbrechen
          </Button>
        ) : (
          <InstallButton state={catalog} />
        )}
      </CardFooter>
    </Card>
  )
}

/** update: the deck whose list is imported again (see the head comment); absent: a new deck. */
export function DeckImportPage({ update }: { update?: DeckRecord }) {
  const navigate = useNavigate()
  const catalog = useCardCatalog()
  const { snapshot } = useStorage()
  const database = snapshot.status === "ready" ? snapshot.database : null
  const [text, setText] = useState(update?.source.text ?? "")
  const [view, setView] = useState<"input" | "report">("input")
  const [check, setCheck] = useState<Check>({ status: "idle" })
  const [choices, setChoices] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [leftOut, setLeftOut] = useState<ReadonlySet<number>>(() => new Set())
  const [name, setName] = useState<string | null>(update?.name ?? null)
  const [confirming, setConfirming] = useState(false)
  const previous = useMemo(() => (update ? deckOracleIds(update) : null), [update])
  const [fileError, setFileError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<StorageError | null>(null)
  const ticket = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  /** The report on screen: the finished one, or the one being updated. */
  const shown: Checked | null = check.status === "done" ? check : check.status === "checking" ? check.previous : null

  const run = useCallback(
    async (source: string, picks: ReadonlyMap<string, string>) => {
      if (database === null) return
      const mine = ++ticket.current
      setView("report")
      // The same list again (a choice, checking again): its report stays on screen while it updates.
      const previousOf = (current: Check): Checked | null =>
        current.status === "done" ? current : current.status === "checking" ? current.previous : null
      setCheck((current) => {
        const previous = previousOf(current)
        return { status: "checking", scryfall: 0, previous: previous?.text === source ? previous : null }
      })
      try {
        const report = await resolveDeckList(database, parseArenaDeckList(source), {
          choices: picks,
          ...(previous !== null ? { previous } : {}),
          lookupPrints: (keys) => {
            if (mine === ticket.current) setCheck((current) => ({ status: "checking", scryfall: keys.length, previous: current.status === "checking" ? current.previous : null }))
            return lookupPrints(database, keys)
          },
        })
        if (mine === ticket.current) setCheck({ status: "done", text: source, report })
      } catch (error) {
        if (mine === ticket.current) setCheck({ status: "failed", error: toStorageError(error, "checking the deck list") })
      }
    },
    [database, previous],
  )

  const start = (source: string) => {
    // Line numbers of another text mean other lines: what was left out starts over.
    if (shown?.text !== source) setLeftOut(new Set())
    setSaveError(null)
    void run(source, choices)
  }

  const choose = (key: string, oracleId: string) => {
    if (shown === null) return
    const next = new Map(choices).set(key, oracleId)
    setChoices(next)
    void run(shown.text, next)
  }

  const leaveOut = (line: number, leave: boolean) => {
    const next = new Set(leftOut)
    if (leave) next.add(line)
    else next.delete(line)
    setLeftOut(next)
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file) return
    setFileError(null)
    try {
      const content = await readTextFile(file)
      if (content.length > MAX_LIST_CHARACTERS) throw new Error(TOO_LONG)
      setText(content)
      if (catalog.usable) start(content)
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error))
    }
  }

  const plan = useMemo(() => (shown === null ? null : planDeck(shown.report, leftOut)), [shown, leftOut])
  const updating = check.status === "checking"
  const deckName = name ?? (shown?.report.list.name ?? "")
  const tooLong = text.length > MAX_LIST_CHARACTERS
  const canCheck = catalog.usable && database !== null && text.trim() !== "" && !tooLong

  const saveBlocked =
    plan === null || updating
      ? "Die Liste wird noch geprüft."
      : plan.blockers.length > 0
        ? plan.blockers.length === 1
          ? "Eine Zeile ist noch zu klären."
          : `Noch ${plan.blockers.length} Zeilen zu klären.`
        : deckName.trim() === ""
          ? "Das Deck braucht einen Namen."
          : database === null
            ? "Die lokale Datenbank ist nicht bereit."
            : null

  const save = async () => {
    if (plan === null || database === null || shown === null || saveBlocked !== null) return
    setSaving(true)
    setSaveError(null)
    try {
      const record = deckRecordFrom(plan, { id: update?.id ?? crypto.randomUUID(), name: deckName, text: shown.text, now: new Date().toISOString() })
      if (update) {
        // The deck keeps its id and creation; a deck deleted meanwhile is not brought back (not-found).
        await replaceDeck(database, record)
        toast.success(`Deck „${record.name}“ aktualisiert`, { description: `${cardsLabel(plannedCount(plan.main))} im Hauptdeck.` })
        void navigate(`/decks/${record.id}`)
      } else {
        await saveDeck(database, record)
        toast.success(`Deck „${record.name}“ gespeichert`, { description: `${cardsLabel(plannedCount(plan.main))} im Hauptdeck.` })
        void navigate("/decks")
      }
    } catch (error) {
      setSaveError(toStorageError(error, "saving the deck"))
    } finally {
      setSaving(false)
    }
  }

  const back = (
    <Button asChild variant="ghost">
      <Link to={update ? `/decks/${update.id}` : "/decks"}>
        <ArrowLeft data-icon="inline-start" aria-hidden />
        {update ? "Zum Deck" : "Zu den Decks"}
      </Link>
    </Button>
  )

  return (
    <Page
      title={update ? "Deck neu importieren" : "Arena-Deck importieren"}
      description={
        update
          ? `Eine neue oder geänderte Arena-Liste für „${update.name}“ – sie ersetzt die Karten und die gespeicherte Liste des Decks.`
          : "Eine Deckliste aus MTG Arena einfügen – sie bleibt auf diesem Gerät."
      }
      actions={back}
    >
      {snapshot.status === "failed" || snapshot.status === "closed" ? <StorageErrorAlert error={snapshot.error} /> : null}
      <CatalogNeeded />

      {view === "input" ? (
        <Card role="region" aria-labelledby="import-input-title">
          <CardHeader>
            <CardTitle id="import-input-title">Deckliste</CardTitle>
            <CardDescription>
              In MTG Arena ein Deck öffnen und „Exportieren“ wählen – die Liste liegt dann in der Zwischenablage. Deutsche und englische Listen gehen
              beide.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field data-invalid={tooLong || undefined}>
              <FieldLabel htmlFor="deck-import-text">Liste im Arena-Format</FieldLabel>
              <Textarea
                id="deck-import-text"
                className="max-h-96 min-h-48"
                value={text}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-invalid={tooLong || undefined}
                placeholder={"Deck\n4 Blitzschlag (M11) 149\n20 Gebirge\n\nSideboard\n2 Schock"}
                onChange={(event) => setText(event.currentTarget.value)}
              />
              <FieldDescription>Abschnitte wie „Deck“, „Sideboard“, „Commander“ und „Companion“ und Angaben wie „(M11) 149“ sind freiwillig.</FieldDescription>
              {tooLong ? <FieldError>{TOO_LONG}</FieldError> : null}
            </Field>
            {fileError !== null ? (
              <Alert variant="destructive">
                <AlertTitle>Die Datei lässt sich nicht lesen</AlertTitle>
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button size="lg" disabled={!canCheck} onClick={() => start(text)} aria-describedby={canCheck ? undefined : "deck-import-check-note"}>
              <ListChecks data-icon="inline-start" aria-hidden />
              Liste prüfen
            </Button>
            <Button size="lg" variant="outline" onClick={() => fileInput.current?.click()}>
              <FileText data-icon="inline-start" aria-hidden />
              Textdatei öffnen
            </Button>
            <input ref={fileInput} type="file" accept=".txt,text/plain" hidden aria-hidden tabIndex={-1} onChange={(event) => void onFile(event)} />
            {!canCheck ? (
              <p id="deck-import-check-note" className="basis-full text-sm text-muted-foreground">
                {!catalog.usable ? "Erst die Kartendaten einrichten." : text.trim() === "" ? "Füge zuerst eine Liste ein." : tooLong ? TOO_LONG : "Die lokale Datenbank ist nicht bereit."}
              </p>
            ) : null}
            {shown !== null ? (
              <Button size="lg" variant="ghost" onClick={() => setView("report")}>
                Zum letzten Prüfbericht
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      ) : shown === null && (check.status === "checking" || check.status === "idle") ? (
        <div className="flex flex-col gap-4" aria-busy>
          <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Spinner className="size-4" />
            {check.status === "checking" && check.scryfall > 0
              ? `Frage Scryfall nach ${check.scryfall === 1 ? "einem Druck" : `${check.scryfall} Drucken`} (Set und Sammlernummer) …`
              : "Prüfe die Liste …"}
          </p>
          <Skeleton className="h-40 w-full" />
        </div>
      ) : check.status === "failed" ? (
        <StorageErrorAlert error={check.error}>
          <span className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("input")}>
              Liste bearbeiten
            </Button>
          </span>
        </StorageErrorAlert>
      ) : shown !== null && plan !== null ? (
        <>
          {updating ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Spinner className="size-4" />
              {check.scryfall > 0 ? `Frage Scryfall nach ${check.scryfall === 1 ? "einem Druck" : `${check.scryfall} Drucken`} …` : "Aktualisiere den Prüfbericht …"}
            </p>
          ) : null}
          <ReportSummary report={shown.report} plan={plan} onEdit={() => setView("input")} onRecheck={() => void run(shown.text, choices)} />
          <OpenLines plan={plan} onLeaveOut={leaveOut} onChoose={choose} />
          <Card role="region" aria-labelledby="import-save-title">
            <CardHeader>
              <CardTitle id="import-save-title">{update ? "Deck ersetzen" : "Deck speichern"}</CardTitle>
              <CardDescription>
                Format {DECK_FORMAT_LABELS[plan.format]}
                {plan.format === "commander" ? " – Forge spielt das Deck als Commander-Partie" : ""}.{" "}
                {update
                  ? "Das Deck bekommt diese Karten und diese Liste; seine bisherigen Karten und seine bisherige Liste werden ersetzt."
                  : "Gespeichert wird nur auf diesem Gerät; die Liste bleibt unverändert beim Deck."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="deck-import-name">Name des Decks</FieldLabel>
                <Input id="deck-import-name" value={deckName} maxLength={200} autoComplete="off" placeholder="z. B. Izzet Delver" onChange={(event) => setName(event.currentTarget.value)} />
              </Field>
              {saveError !== null ? <StorageErrorAlert error={saveError} /> : null}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
              <Button
                size="lg"
                disabled={saveBlocked !== null || saving}
                onClick={() => (update ? setConfirming(true) : void save())}
                aria-describedby={saveBlocked !== null ? "deck-import-save-note" : undefined}
              >
                {saving ? <Spinner data-icon="inline-start" /> : update ? <RefreshCw data-icon="inline-start" aria-hidden /> : <Save data-icon="inline-start" aria-hidden />}
                {update ? "Deck ersetzen" : "Deck speichern"}
              </Button>
              {saveBlocked !== null ? (
                <p id="deck-import-save-note" className="basis-full text-sm text-muted-foreground">
                  {saveBlocked}
                </p>
              ) : null}
            </CardFooter>
          </Card>
          {update ? (
            <AlertDialog open={confirming} onOpenChange={setConfirming}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>„{update.name}“ ersetzen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Karten, Format und gespeicherte Liste des Decks werden durch diese Liste ersetzt. Zurück geht es danach nur mit einer Sicherung.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void save()}>Deck ersetzen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <DeckPreview report={shown.report} plan={plan} onChoose={choose} />
          <p className="text-sm text-muted-foreground">
            Ob ein Deck in einem Format erlaubt ist, entscheidet Forge – der Import prüft nur, ob jede Karte eindeutig ist und Forge sie kennt. Kartendaten und
            -bilder: Scryfall (siehe <TextLink to="/credits">Credits</TextLink>).
          </p>
        </>
      ) : null}
    </Page>
  )
}
