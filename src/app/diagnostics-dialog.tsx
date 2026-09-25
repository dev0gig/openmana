/*
 * The diagnostics report in Settings (prompt 12, diagnostics.ts): shown in a
 * dialog, copied with one tap - or selected by hand where the browser does
 * not allow copying. Nothing is sent anywhere.
 */
import { ClipboardCopy, FileText } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { useCardCatalog } from "@/cards/card-catalog-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { engineAssets } from "@/engine/engine-assets"
import { useEngineSession } from "@/engine/engine-session-context"
import { SCHEMA_VERSION } from "@/storage/generated/constants"
import { useStorage } from "@/storage/storage-context"
import { buildInfo } from "./build-info"
import { browserFacts, diagnosticsReport } from "./diagnostics"
import { useDeviceReducedMotion } from "./motion"
import { usePreferences } from "./preferences"

/** The report as of now (re-made each time the dialog opens: the engine may have started meanwhile). */
function useReport(): () => string {
  const { snapshot: engine } = useEngineSession()
  const catalog = useCardCatalog()
  const { snapshot: storage } = useStorage()
  const preferences = usePreferences()
  const device = useDeviceReducedMotion()
  return () =>
    diagnosticsReport({
      now: new Date(),
      app: buildInfo,
      engineAssets,
      engine: engine.engine,
      cards: { assets: catalog.assets, status: catalog.status, installedVersion: catalog.installed?.version ?? null },
      database: { schemaVersion: SCHEMA_VERSION, status: storage.status },
      preferences: { aiProfile: preferences.aiProfile, cardLanguage: preferences.cardLanguage, motion: preferences.motion, deviceReducedMotion: device },
      browser: browserFacts(),
    })
}

export function DiagnosticsDialog() {
  const id = useId()
  const make = useReport()
  const [report, setReport] = useState("")
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      toast.success("Diagnose kopiert", { id: "diagnostics-copy" })
    } catch {
      toast.error("Kopieren ist hier nicht erlaubt", { id: "diagnostics-copy", description: "Markiere den Text im Feld und kopiere ihn selbst." })
    }
  }
  return (
    <Dialog onOpenChange={(open) => (open ? setReport(make()) : undefined)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText data-icon="inline-start" aria-hidden />
          Diagnose anzeigen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Diagnose</DialogTitle>
          <DialogDescription id={`${id}-description`}>
            Alle Versionen und Zustände auf einen Blick – zum Kopieren, etwa für eine Fehlermeldung. OpenMana sendet davon nichts.
          </DialogDescription>
        </DialogHeader>
        <Textarea value={report} readOnly aria-label="Diagnose" aria-describedby={`${id}-description`} className="max-h-96" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Schließen</Button>
          </DialogClose>
          <Button onClick={() => void copy()}>
            <ClipboardCopy data-icon="inline-start" aria-hidden />
            Kopieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
