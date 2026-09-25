/*
 * "ORYX-Cloud" (settings, next to "Daten auf diesem Gerät"): whether this
 * device is connected to the player's ORYX account, the SDK's status line,
 * what is synced and what stays here, connecting and disconnecting, and every
 * problem of the start's pull in place. Not shown where the cloud is inactive
 * (off OpenMana's real address: locally, in tests, previews) or absent.
 */
import { Cloud, Link2, RotateCcw, TriangleAlert, Unlink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useNow } from "@/hooks/use-now"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useCloudSync } from "./cloud-context"
import type { CloudSnapshot } from "./cloud-sync"
import type { OryxStatus } from "./oryx-sdk.js"

const STATUS_BADGES: Readonly<Record<Exclude<OryxStatus, "inactive">, { readonly label: string; readonly variant: "default" | "secondary" | "destructive" }>> = {
  guest: { label: "Nicht verbunden", variant: "secondary" },
  connected: { label: "Verbunden", variant: "default" },
  offline: { label: "Offline", variant: "secondary" },
  disabled: { label: "Ausgeschaltet", variant: "secondary" },
  error: { label: "Nicht erreichbar", variant: "destructive" },
}

function reload(): void {
  window.location.reload()
}

/** What the start's pull or the last step ran into, in place (Bible §16: nothing fails silently). */
function Problem({ snapshot }: { snapshot: CloudSnapshot }) {
  const { failure, pull } = snapshot
  if (failure?.kind === "connect") {
    return (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Verbinden ist gerade nicht möglich</AlertTitle>
        <AlertDescription>ORYX ist nicht erreichbar oder kennt OpenMana noch nicht. Deine Daten bleiben auf diesem Gerät.</AlertDescription>
      </Alert>
    )
  }
  if (failure?.kind === "cloud-invalid") {
    return (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Der Stand aus der ORYX-Cloud ließ sich nicht übernehmen</AlertTitle>
        <AlertDescription>
          <span>Er hat nicht das erwartete Format. Auf diesem Gerät hat sich nichts geändert.</span>
          <code className="mt-2 block text-xs break-words">{failure.error.message}</code>
        </AlertDescription>
      </Alert>
    )
  }
  if (failure?.kind === "local") {
    return (
      <StorageErrorAlert error={failure.error}>
        <span className="mt-1 block">Der Stand aus der ORYX-Cloud wurde nicht übernommen; auf diesem Gerät hat sich nichts geändert.</span>
      </StorageErrorAlert>
    )
  }
  if (pull.state !== "done") return null
  if (pull.result === "too_large") {
    return (
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertTitle>Zu groß für die ORYX-Cloud</AlertTitle>
        <AlertDescription>
          Deine Decks sind zusammen größer, als die ORYX-Cloud für OpenMana annimmt. Sie bleiben vollständig auf diesem Gerät – sichere sie mit
          „Sicherung speichern“.
        </AlertDescription>
      </Alert>
    )
  }
  if (pull.result === "newer-version") {
    return (
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertTitle>In der ORYX-Cloud liegt ein Stand einer neueren OpenMana-Version</AlertTitle>
        <AlertDescription>
          <span>Lade die Seite neu, um die neueste Version zu bekommen und ihn zu übernehmen. Bis dahin bleibt er dort und hier alles, wie es ist.</span>
          <Button size="lg" variant="outline" className="mt-3" onClick={reload}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            Neu laden
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  return null
}

export function OryxCloudCard() {
  const sync = useCloudSync()
  // Re-render now and then: the status line says how long ago the last upload was.
  useNow(sync !== null, 30_000)
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null)
  if (sync === null || sync.snapshot.status === "inactive") return null
  const { cloud, snapshot } = sync
  const line = cloud.describe()
  const badge = STATUS_BADGES[snapshot.status as Exclude<OryxStatus, "inactive">]
  const connected = snapshot.status !== "guest"

  async function connect() {
    setBusy("connect")
    // On success the page leaves for ORYX's consent page and comes back connected.
    if (!(await cloud.connect())) setBusy(null)
  }

  async function disconnect() {
    setBusy("disconnect")
    try {
      await cloud.disconnect()
      toast.success("Verbindung auf diesem Gerät getrennt", { description: "Deine Decks bleiben hier; in der ORYX-Cloud bleibt der zuletzt gesicherte Stand." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card role="region" aria-labelledby="oryx-cloud-title">
      <CardHeader>
        <CardTitle id="oryx-cloud-title" className="flex items-center gap-2">
          <Cloud aria-hidden className="size-5 text-primary" />
          ORYX-Cloud
        </CardTitle>
        <CardDescription>
          Sichert deine Decks in deinem ORYX-Konto und gleicht sie zwischen deinen Geräten ab. Die Daten auf diesem Gerät bleiben die Grundlage.
        </CardDescription>
        <CardAction>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div aria-live="polite" className="flex flex-col gap-4">
          {line === "" ? null : <p className="text-sm">{line}</p>}
          {snapshot.pull.state === "running" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" aria-hidden />
              Gleiche mit der ORYX-Cloud ab …
            </p>
          ) : null}
          <Problem snapshot={snapshot} />
        </div>
        <p className="text-sm text-muted-foreground">
          Abgeglichen werden deine Decks, das KI-Profil und die Deckwahl zum Spielen; ein gelöschtes Deck merkt sich OpenMana 90 Tage, damit es nicht
          von einem anderen Gerät zurückkommt. Hat sich ein Deck auf zwei Geräten geändert, gilt die neuere Änderung. Nur auf diesem Gerät bleiben
          Kartensprache, „Bewegungen reduzieren“, Partien, Kartendaten und die Engine. Verbunden erfährt ORYX außerdem, wie lange du spielst – es
          zeigt dir deine Spielzeit.
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        {connected ? (
          <Button size="lg" variant="outline" disabled={busy !== null} onClick={() => void disconnect()}>
            {busy === "disconnect" ? <Spinner data-icon="inline-start" aria-hidden /> : <Unlink data-icon="inline-start" aria-hidden />}
            Verbindung auf diesem Gerät trennen
          </Button>
        ) : (
          <Button size="lg" disabled={busy !== null} onClick={() => void connect()}>
            {busy === "connect" ? <Spinner data-icon="inline-start" aria-hidden /> : <Link2 data-icon="inline-start" aria-hidden />}
            Mit ORYX verbinden
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
