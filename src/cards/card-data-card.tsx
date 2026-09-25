/*
 * "Kartendaten" (settings): the card catalog this version brings (Scryfall
 * date, how many cards, how many in German, Forge cards without Scryfall
 * data), what this device holds of it, and installing it - with progress,
 * stoppable, every failure shown. Card lookup opens from here.
 */
import { CircleStop, Download, Library, RotateCcw } from "lucide-react"
import { FactList, type Fact } from "@/components/fact-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { formatBytes, formatCount, formatDateTime } from "@/storage/storage-labels"
import { useCardCatalog, type CardCatalogState, type CatalogStatus } from "./card-catalog-context"
import { CardDataErrorAlert } from "./card-error-alert"
import { formatDate } from "./card-labels"
import { CardLookupDialog } from "./card-lookup-dialog"

const STATUS_BADGES: Readonly<Record<CatalogStatus, { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" }>> = {
  unavailable: { label: "Nicht enthalten", variant: "outline" },
  loading: { label: "Prüft", variant: "secondary" },
  "storage-error": { label: "Fehler", variant: "destructive" },
  missing: { label: "Nicht eingerichtet", variant: "outline" },
  partial: { label: "Unvollständig", variant: "outline" },
  outdated: { label: "Veraltet", variant: "secondary" },
  ready: { label: "Bereit", variant: "default" },
  installing: { label: "Wird eingerichtet", variant: "secondary" },
}

function onDevice(state: CardCatalogState): string {
  switch (state.status) {
    case "ready":
    case "outdated":
      return state.installed ? `eingerichtet am ${formatDateTime(state.installed.storedAt)}${state.status === "outdated" ? " (ältere Fassung)" : ""}` : "eingerichtet"
    case "missing":
      return "nicht eingerichtet"
    case "partial":
      return "unvollständig"
    case "installing":
      return "wird eingerichtet"
    case "loading":
      return "wird geprüft"
    case "storage-error":
      return "nicht lesbar"
    case "unavailable":
      return "–"
  }
}

function catalogFacts(state: CardCatalogState): Fact[] {
  const { assets } = state
  const device: Fact = { label: "Auf diesem Gerät", value: onDevice(state) }
  if (!assets.available) return [device]
  return [
    { label: "Scryfall-Stand", value: formatDate(assets.source.updatedAt) },
    { label: "Karten", value: formatCount(assets.counts.cards) },
    { label: "davon mit deutschem Text", value: formatCount(assets.counts.germanText) },
    { label: "davon mit deutschem Bild", value: formatCount(assets.counts.germanImage) },
    { label: "Forge-Karten ohne Scryfall-Daten", value: formatCount(assets.forge.forgeOnly) },
    { label: "Download", value: formatBytes(assets.bytes) },
    device,
  ]
}

function InstallProgressView({ state }: { state: CardCatalogState }) {
  const progress = state.progress
  const percent = progress === null || progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)
  const text =
    progress === null
      ? "Verbinde …"
      : progress.phase === "download"
        ? `Lade ${formatBytes(progress.done)} von ${formatBytes(progress.total)} …`
        : `Speichere ${formatCount(progress.done)} von ${formatCount(progress.total)} Einträgen …`
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <Progress value={percent} aria-label={progress?.phase === "store" ? "Kartendaten speichern" : "Kartendaten laden"} />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {text}
      </p>
    </div>
  )
}

function InstallButton({ state }: { state: CardCatalogState }) {
  const label = state.status === "outdated" ? "Kartendaten aktualisieren" : state.error !== null || state.status === "partial" ? "Erneut einrichten" : "Kartendaten einrichten"
  return (
    <Button size="lg" onClick={() => void state.install()}>
      {state.status === "partial" || state.error !== null ? <RotateCcw data-icon="inline-start" aria-hidden /> : <Download data-icon="inline-start" aria-hidden />}
      {label}
    </Button>
  )
}

export function CardDataCard() {
  const state = useCardCatalog()
  const badge = STATUS_BADGES[state.status]
  const canInstall = state.assets.available && ["missing", "partial", "outdated"].includes(state.status)
  return (
    <Card role="region" aria-labelledby="card-data-title">
      <CardHeader>
        <CardTitle id="card-data-title" className="flex items-center gap-2">
          <Library aria-hidden className="size-5 text-primary" />
          Kartendaten
        </CardTitle>
        <CardDescription>Deutsche Kartennamen, -texte und -bilder von Scryfall – nur zur Anzeige; die Regeln kennt allein Forge.</CardDescription>
        <CardAction>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Prüfe die Kartendaten auf diesem Gerät …
          </p>
        ) : (
          <FactList facts={catalogFacts(state)} />
        )}
        {state.status === "installing" ? <InstallProgressView state={state} /> : null}
        {!state.assets.available && state.status === "unavailable" ? (
          <Alert>
            <AlertTitle>Diese Version enthält keine Kartendaten</AlertTitle>
            <AlertDescription>Karten erscheinen dann mit Forges eigenen englischen Texten und ohne Bilder.</AlertDescription>
          </Alert>
        ) : null}
        {state.status === "partial" && state.error === null ? (
          <Alert>
            <AlertTitle>Die Kartendaten sind unvollständig</AlertTitle>
            <AlertDescription>Das Einrichten wurde unterbrochen oder läuft gerade in einem anderen Tab. „Erneut einrichten“ wartet auf den anderen Tab und lädt sonst neu.</AlertDescription>
          </Alert>
        ) : null}
        {state.status === "outdated" ? (
          <Alert>
            <AlertTitle>Neuere Kartendaten verfügbar</AlertTitle>
            <AlertDescription>Bis zur Aktualisierung zeigt OpenMana die bisherigen Kartendaten an.</AlertDescription>
          </Alert>
        ) : null}
        {state.error !== null ? <CardDataErrorAlert error={state.error} /> : null}
        <p className="text-sm text-muted-foreground">
          Die Kartendaten kommen einmal mit dieser OpenMana-Version und bleiben auf dem Gerät. Kartenbilder lädt der Browser erst, wenn eine Karte
          angezeigt wird, direkt von Scryfall, und behält sie im Zwischenspeicher. Einzelne Drucke, die ein Deck nennt, fragt OpenMana bei Bedarf bei
          Scryfall nach und merkt sie sich 30 Tage.
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        {state.status === "installing" ? (
          <Button size="lg" variant="outline" onClick={state.cancel}>
            <CircleStop data-icon="inline-start" aria-hidden />
            Abbrechen
          </Button>
        ) : canInstall ? (
          <InstallButton state={state} />
        ) : null}
        <CardLookupDialog />
      </CardFooter>
    </Card>
  )
}
