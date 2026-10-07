import { useState, useSyncExternalStore } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useEngineSession } from "@/engine/engine-session-context"
import { matchInProgress } from "@/engine/engine-session"
import { engineAssets } from "@/engine/engine-assets"
import { formatMegabytes } from "@/engine/engine-labels"
import { checkPwaUpdate, downloadOfflineEngine, getPwaSnapshot, installPwa, requestPersistentStorage, retryPwa, subscribePwa } from "./lifecycle"

export function PwaCard() {
  const pwa = useSyncExternalStore(subscribePwa, getPwaSnapshot)
  const { snapshot } = useEngineSession()
  const playing = matchInProgress(snapshot.match)
  const supported = snapshot.engine.status !== "unsupported" && snapshot.engine.status !== "unavailable"
  const [persistence, setPersistence] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  async function persist() {
    setRequesting(true)
    const result = await requestPersistentStorage()
    setPersistence(result === true ? "Der Browser hat dauerhaften Speicher zugesagt. Sichere deine Decks und Partien trotzdem als Datei." : result === false ? "Der Browser hat die Anfrage abgelehnt. Lokale Daten können bei Platzmangel gelöscht werden; sichere sie als Datei." : "Dieser Browser kann dauerhaften Speicher gerade nicht zusagen. Sichere deine Daten als Datei.")
    setRequesting(false)
  }
  return (
    <Card role="region" aria-labelledby="pwa-title">
      <CardHeader>
        <CardTitle id="pwa-title">Installation und Offline-Speicher</CardTitle>
        <CardDescription>OpenMana als App und auf diesem Gerät behalten.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p aria-live="polite" className="text-sm">
          {pwa.status === "disabled" ? "Offline-Speicher ist hier nicht verfügbar. Er braucht die fertige App in einem unterstützten, isolierten HTTPS-Browser." : pwa.status === "starting" ? "Die App wird für dieses Gerät gespeichert …" : pwa.status === "failed" ? "Die App konnte nicht für offline gespeichert werden." : pwa.downloading ? "Forge wird heruntergeladen und vollständig geprüft …" : pwa.offlineEngine ? supported ? "App und Forge sind vollständig für offline gespeichert. Mit bereits gespeicherten Decks kannst du ohne Netz spielen." : "App und Forge sind gespeichert, aber die Engine kann in diesem Browser oder Build nicht starten." : "Die App ist gespeichert. Für Spiele ohne Netz musst du Forge noch herunterladen."}
        </p>
        <p className="text-sm text-muted-foreground">Zum Suchen und Importieren ohne Netz müssen die Kartendaten zuvor geladen sein; zum Spielen die Decks gespeichert. Kartenbilder und ORYX-Cloud brauchen Netz; fehlende Bilder zeigen den Kartentext. Der Browser kann Speicher löschen. Die Offline-Bereitschaft wird beim Öffnen und Zurückkehren geprüft.</p>
        <p className="text-sm text-muted-foreground">Eine laufende Partie lebt im offenen Tab. Neuladen, Schließen oder Verwerfen im Hintergrund kann sie beenden. Die Aufzeichnung ist eine Wiedergabe, keine Fortsetzung.</p>
        <p className="text-sm text-muted-foreground">Zum Installieren nutze das Installationsmenü deines Browsers, falls angeboten. Auf iOS: Teilen → Zum Home-Bildschirm. Die Installation allein garantiert keine Forge-Unterstützung.</p>
        {playing ? <p id="pwa-playing" className="text-sm">Eine Partie läuft. Zusätzliche große Downloads warten bis danach.</p> : null}
        {!supported ? <p id="pwa-unsupported" className="text-sm">Die Forge-Engine kann in diesem Browser oder Build nicht starten. Der Gerätecheck erklärt, was fehlt.</p> : null}
        {pwa.updateWaiting ? <Alert><AlertTitle>Neue Version bereit</AlertTitle><AlertDescription>Die laufende Version bleibt erhalten. Beende deine Partien, schließe alle OpenMana-Tabs und App-Fenster und öffne OpenMana erneut. Erst dann wird die neue Version aktiviert; sie wird nie mitten in einer Partie erzwungen.</AlertDescription></Alert> : null}
        {pwa.error ? <Alert variant="destructive"><AlertTitle>Offline-Speicher oder Updateprüfung fehlgeschlagen</AlertTitle><AlertDescription>{pwa.error}</AlertDescription></Alert> : null}
        {persistence ? <p role="status" className="text-sm">{persistence}</p> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        {pwa.status === "failed" ? <Button disabled={playing} onClick={retryPwa}>Offline-Speicher erneut versuchen</Button> : null}
        {pwa.installAvailable ? <Button onClick={() => void installPwa()}>OpenMana installieren</Button> : null}
        <Button disabled={pwa.status !== "ready" || pwa.downloading || pwa.offlineEngine || playing || !supported} aria-describedby={playing ? "pwa-playing" : !supported ? "pwa-unsupported" : undefined} onClick={() => void downloadOfflineEngine()}>
          {pwa.downloading ? "Download wird geprüft …" : pwa.offlineEngine ? "Forge offline gespeichert" : `Forge für offline laden${engineAssets.available ? ` (${formatMegabytes(engineAssets.build.downloadBytes)})` : ""}`}
        </Button>
        <Button variant="outline" disabled={pwa.status !== "ready"} onClick={() => void checkPwaUpdate()}>Nach Updates suchen</Button>
        <Button variant="outline" disabled={requesting} onClick={() => void persist()}>Dauerhaften Speicher anfragen</Button>
      </CardFooter>
    </Card>
  )
}
