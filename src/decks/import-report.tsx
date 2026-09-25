/*
 * The import report: what the check found, what still needs a decision and
 * what will be saved. Everything shown comes from the resolver's report and
 * the plan (deck-plan.ts), so the preview is exactly the deck that the save
 * button writes. Nothing is left out silently: every open line is listed
 * with its number and text until the player decides, and lines the player
 * left out stay listed as left out.
 */
import { CircleCheck, CircleHelp, Pencil, RotateCcw, ScrollText, TriangleAlert, Undo2 } from "lucide-react"
import type { ReactNode } from "react"
import { usePreferences } from "@/app/preferences"
import { cardDisplay, type TextLanguage } from "@/cards/card-display"
import { FactList, type Fact } from "@/components/fact-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CardPicture } from "@/components/ui/card-picture"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { DECK_FORMAT_LABELS } from "@/storage/storage-labels"
import { CardChoiceDialog } from "./card-choice-dialog"
import { plannedCount, type DeckPlan, type ImportBlocker, type PlannedCard } from "./deck-plan"
import type { DeckImportReport, EntryReport } from "./deck-resolve"
import { blockerText, cardsLabel, isInformative, lineLabel, noteText, SECTION_LABELS } from "./deck-import-labels"

export type ChooseCard = (key: string, oracleId: string) => void
export type LeaveOut = (line: number, leaveOut: boolean) => void

/** A small card picture, or an icon where there is no Scryfall card to show. */
function Thumb({ entry }: { entry: Pick<EntryReport, "card" | "match"> }) {
  const { cardLanguage: language } = usePreferences()
  if (entry.card === null) {
    return (
      <ItemMedia variant="icon">
        <ScrollText aria-hidden />
      </ItemMedia>
    )
  }
  const display = cardDisplay(entry.card, { ...(entry.match ? { match: entry.match } : {}), language })
  return (
    <ItemMedia>
      <div className="w-10">
        <CardPicture src={display.picture?.urls.thumb ?? null} alt="" fallback={null} />
      </div>
    </ItemMedia>
  )
}

/** The card's name as the player reads it (German where there is one, or English), and the name Forge knows. */
function names(card: Pick<PlannedCard, "card" | "match" | "forgeName">, language: TextLanguage): { readonly shown: string; readonly other: string | null } {
  if (card.card === null) return { shown: card.forgeName, other: null }
  const display = cardDisplay(card.card, { ...(card.match ? { match: card.match } : {}), language })
  const shown = display.name.text
  return { shown, other: shown === card.forgeName ? null : card.forgeName }
}

function NoteList({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  )
}

/** Deck-wide observations the player should know before saving. */
function deckNotes(report: DeckImportReport, plan: DeckPlan, language: TextLanguage): string[] {
  const notes: string[] = []
  const inferred = report.entries.filter((entry) => entry.entry.inferred && entry.entry.section === "sideboard")
  if (inferred.length > 0) {
    notes.push(
      `Ohne Abschnittsnamen gelten nach Arenas Regel die Zeilen nach der ersten Leerzeile als Sideboard (${inferred.length === 1 ? lineLabel(inferred[0]!.entry.line) : `Zeilen ${inferred[0]!.entry.line}–${inferred.at(-1)!.entry.line}`}).`,
    )
  }
  for (const companion of plan.companions) {
    const name = names({ card: companion.entry.card, match: companion.entry.match, forgeName: companion.entry.forgeName! }, language).shown
    notes.push(
      companion.addedToSideboard
        ? `Gefährte „${name}“: Er stand nicht im Sideboard – OpenMana legt ihn dort ab, denn dort sucht Forge ihn zu Spielbeginn.`
        : `Gefährte „${name}“: Er liegt im Sideboard, wo Forge ihn zu Spielbeginn sucht.`,
    )
  }
  const unused = report.list.about.filter((line) => !(line.key.toLowerCase() === "name" && line.value === report.list.name))
  if (unused.length > 0) notes.push(`Nicht verwendete Angaben unter „About“: ${unused.map((line) => `„${[line.key, line.value].filter(Boolean).join(" ")}“`).join(", ")}.`)
  const leftOut = plan.leftOut.entries.length + plan.leftOut.problems.length
  if (leftOut > 0) {
    notes.push(
      `${leftOut === 1 ? "Eine Zeile ist" : `${leftOut} Zeilen sind`} weggelassen: nicht im Deck, aber weiter im gespeicherten Importtext.`,
    )
  }
  return notes
}

export function ReportSummary({ report, plan, onEdit, onRecheck }: { report: DeckImportReport; plan: DeckPlan; onEdit: () => void; onRecheck: () => void }) {
  const facts: Fact[] = [
    { label: "Format", value: DECK_FORMAT_LABELS[plan.format] },
    ...(plan.commander.length > 0 ? [{ label: SECTION_LABELS.commander, value: cardsLabel(plannedCount(plan.commander)) }] : []),
    { label: SECTION_LABELS.main, value: cardsLabel(plannedCount(plan.main)) },
    { label: SECTION_LABELS.sideboard, value: cardsLabel(plannedCount(plan.sideboard)) },
    { label: "Zeilen der Liste", value: report.list.lines.toLocaleString("de-DE") },
  ]
  const { cardLanguage } = usePreferences()
  const open = plan.blockers.length
  const notes = deckNotes(report, plan, cardLanguage)
  return (
    <Card role="region" aria-labelledby="import-summary-title">
      <CardHeader>
        <CardTitle id="import-summary-title">Prüfbericht</CardTitle>
        <CardDescription>Was OpenMana in der Liste erkannt hat – gespeichert wird genau das Deck unten.</CardDescription>
        <CardAction>
          <Button variant="outline" onClick={onEdit}>
            <Pencil data-icon="inline-start" aria-hidden />
            Liste bearbeiten
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div role="status">
          {open === 0 ? (
            <Alert>
              <CircleCheck aria-hidden />
              <AlertTitle>Alle Zeilen geklärt</AlertTitle>
              <AlertDescription>Das Deck kann gespeichert werden.</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden />
              <AlertTitle>{open === 1 ? "Eine Zeile ist noch zu klären" : `${open} Zeilen sind noch zu klären`}</AlertTitle>
              <AlertDescription>Erst danach lässt sich das Deck speichern. Nichts wird ohne deine Entscheidung weggelassen.</AlertDescription>
            </Alert>
          )}
        </div>
        {report.printError ? (
          <Alert>
            <CircleHelp aria-hidden />
            <AlertTitle>Scryfall war nicht erreichbar</AlertTitle>
            <AlertDescription>
              <span>Einige Zeilen ließen sich über Set und Sammlernummer nicht bestimmen. Mit Internetverbindung erneut prüfen.</span>
              <Button variant="outline" size="sm" className="mt-2" onClick={onRecheck}>
                <RotateCcw data-icon="inline-start" aria-hidden />
                Erneut prüfen
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        <FactList facts={facts} />
        <NoteList notes={notes} />
      </CardContent>
    </Card>
  )
}

/** Another card the player could pick that Forge can play (ambiguous names, variants, a name that is also another card's German name). */
function hasAlternatives(entry: EntryReport): boolean {
  return entry.candidates.some((candidate) => candidate.card.forgeNames.length > 0 && candidate.card.oracleId !== entry.card?.oracleId)
}

function blockerKey(blocker: ImportBlocker): string {
  return blocker.kind === "line" ? `line-${blocker.problem.line}` : blocker.kind === "entry" ? `entry-${blocker.entry.entry.line}` : blocker.kind
}

function OpenLine({ blocker, onLeaveOut, onChoose }: { blocker: ImportBlocker; onLeaveOut: LeaveOut; onChoose: ChooseCard }) {
  const { title, text } = blockerText(blocker)
  const line = blocker.kind === "line" ? blocker.problem.line : blocker.kind === "entry" ? blocker.entry.entry.line : null
  const written = blocker.kind === "line" ? blocker.problem.text : blocker.kind === "entry" ? blocker.entry.entry.text : null
  const entry = blocker.kind === "entry" ? blocker.entry : null
  return (
    <Item variant="outline" role="listitem">
      {entry?.card ? (
        <Thumb entry={entry} />
      ) : (
        <ItemMedia variant="icon">
          <TriangleAlert aria-hidden />
        </ItemMedia>
      )}
      <ItemContent>
        <ItemTitle>
          {title}
          {line !== null ? <Badge variant="outline">{lineLabel(line)}</Badge> : null}
        </ItemTitle>
        {written !== null ? <ItemDescription>„{written}“</ItemDescription> : null}
        <NoteList notes={[text, ...(entry?.notes.filter(isInformative).map(noteText) ?? [])]} />
      </ItemContent>
      {line !== null ? (
        <ItemActions className="flex-wrap">
          {entry !== null && hasAlternatives(entry) ? <CardChoiceDialog entry={entry} onChoose={(oracleId) => onChoose(entry.key, oracleId)} /> : null}
          <Button variant="outline" size="sm" onClick={() => onLeaveOut(line, true)} aria-label={`${lineLabel(line)} weglassen`}>
            Weglassen
          </Button>
        </ItemActions>
      ) : null}
    </Item>
  )
}

function LeftOutLine({ line, text, onLeaveOut }: { line: number; text: string; onLeaveOut: LeaveOut }) {
  return (
    <Item variant="muted" role="listitem">
      <ItemMedia variant="icon">
        <Undo2 aria-hidden />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          Weggelassen
          <Badge variant="outline">{lineLabel(line)}</Badge>
        </ItemTitle>
        <ItemDescription>„{text}“</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm" onClick={() => onLeaveOut(line, false)} aria-label={`${lineLabel(line)} wieder aufnehmen`}>
          Wieder aufnehmen
        </Button>
      </ItemActions>
    </Item>
  )
}

/** Lines that block saving, and lines the player left out. Nothing while every line is clear. */
export function OpenLines({ plan, onLeaveOut, onChoose }: { plan: DeckPlan; onLeaveOut: LeaveOut; onChoose: ChooseCard }) {
  const leftOut = [
    ...plan.leftOut.entries.map((entry) => ({ line: entry.entry.line, text: entry.entry.text })),
    ...plan.leftOut.problems.map((problem) => ({ line: problem.line, text: problem.text })),
  ].sort((a, b) => a.line - b.line)
  if (plan.blockers.length === 0 && leftOut.length === 0) return null
  return (
    <Card role="region" aria-labelledby="import-open-title">
      <CardHeader>
        <CardTitle id="import-open-title">Zu klären</CardTitle>
        <CardDescription>Korrigiere die Liste („Liste bearbeiten“), wähle die gemeinte Karte oder lass die Zeile bewusst weg.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup aria-label="Zeilen zu klären">
          {plan.blockers.map((blocker) => (
            <OpenLine key={blockerKey(blocker)} blocker={blocker} onLeaveOut={onLeaveOut} onChoose={onChoose} />
          ))}
          {leftOut.map((line) => (
            <LeftOutLine key={`left-${line.line}`} line={line.line} text={line.text} onLeaveOut={onLeaveOut} />
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}

function PlannedRow({ card, entries, onChoose }: { card: PlannedCard; entries: ReadonlyMap<number, EntryReport>; onChoose: ChooseCard }) {
  const { cardLanguage } = usePreferences()
  const { shown, other } = names(card, cardLanguage)
  const sources = card.lines.flatMap((line) => entries.get(line) ?? [])
  const notes = [...new Set(sources.flatMap((entry) => entry.notes.filter(isInformative).map(noteText)))]
  const choosable = sources.find(hasAlternatives)
  const detail = [other ? `Forge: ${other}` : null, card.set !== null ? `${card.set.toUpperCase()} ${card.collectorNumber}` : null].filter(Boolean).join(" · ")
  return (
    <Item variant="outline" size="sm" role="listitem">
      <Thumb entry={card} />
      <ItemContent>
        <ItemTitle>
          <span className="tabular-nums">{card.count} ×</span> {shown}
          {sources.some((entry) => entry.by === "choice") ? <Badge variant="secondary">gewählt</Badge> : null}
        </ItemTitle>
        {detail ? <ItemDescription>{detail}</ItemDescription> : null}
        <NoteList notes={notes} />
      </ItemContent>
      {choosable ? (
        <ItemActions>
          <CardChoiceDialog entry={choosable} onChoose={(oracleId) => onChoose(choosable.key, oracleId)} />
        </ItemActions>
      ) : null}
    </Item>
  )
}

function Section({ title, cards, entries, onChoose, children }: { title: string; cards: readonly PlannedCard[]; entries: ReadonlyMap<number, EntryReport>; onChoose: ChooseCard; children?: ReactNode }) {
  const id = `deck-section-${title.toLowerCase()}`
  return (
    <Card role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle id={id}>{title}</CardTitle>
        <CardDescription>{cardsLabel(plannedCount(cards))}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        <ItemGroup aria-label={title} className="gap-2">
          {cards.map((card) => (
            <PlannedRow key={`${card.forgeName}|${card.set}|${card.collectorNumber}`} card={card} entries={entries} onChoose={onChoose} />
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}

/** The deck as it will be saved, section by section. */
export function DeckPreview({ report, plan, onChoose }: { report: DeckImportReport; plan: DeckPlan; onChoose: ChooseCard }) {
  const entries = new Map(report.entries.map((entry) => [entry.entry.line, entry]))
  return (
    <>
      {plan.commander.length > 0 ? <Section title={SECTION_LABELS.commander} cards={plan.commander} entries={entries} onChoose={onChoose} /> : null}
      {plan.main.length > 0 ? <Section title={SECTION_LABELS.main} cards={plan.main} entries={entries} onChoose={onChoose} /> : null}
      {plan.sideboard.length > 0 ? <Section title={SECTION_LABELS.sideboard} cards={plan.sideboard} entries={entries} onChoose={onChoose} /> : null}
    </>
  )
}
