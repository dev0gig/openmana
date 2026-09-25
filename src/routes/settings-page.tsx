/*
 * Settings: the player's preferences (prompt 12) - the AI profile, the card
 * language, less motion - each saved at once; what this build and this
 * device are, with the diagnostics report; the data kept on the device
 * (backups, check) and the card data (Scryfall). The preferences are chosen
 * here once, never on the way to a game (Anvil lesson).
 */
import { Info, TriangleAlert } from "lucide-react"
import { Link } from "react-router"
import { buildInfo } from "@/app/build-info"
import { DiagnosticsDialog } from "@/app/diagnostics-dialog"
import { MotionOptions } from "@/app/motion-options"
import { usePreferences } from "@/app/preferences"
import { CardDataCard } from "@/cards/card-data-card"
import { CardLanguageOptions } from "@/cards/card-language-options"
import { FactList, type Fact } from "@/components/fact-list"
import { Page } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FeatureChecklist, useDeviceFeatures } from "@/engine/device-support"
import { engineAssets } from "@/engine/engine-assets"
import { formatMegabytes, shortCommit } from "@/engine/engine-labels"
import { AiProfileOptions } from "@/game/ai-profile-options"
import { LocalDataCard } from "@/storage/local-data-card"

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" })

function appFacts(): Fact[] {
  const commit = buildInfo.commit
    ? `${shortCommit(buildInfo.commit)}${buildInfo.modified ? " (mit lokalen Änderungen)" : ""}`
    : "unbekannt"
  return [
    { label: "App-Version", value: buildInfo.version },
    { label: "App-Stand", value: commit },
    ...(buildInfo.commitDate ? [{ label: "Stand vom", value: dateFormat.format(new Date(buildInfo.commitDate)) }] : []),
  ]
}

function engineFacts(): Fact[] {
  if (!engineAssets.available) {
    return [{ label: "Forge-Engine", value: engineAssets.reason === "omitted" ? "in diesem Build nicht enthalten" : "nicht gefunden" }]
  }
  const { build } = engineAssets
  return [
    { label: "Forge-Version", value: build.forgeVersionCode },
    { label: "Forge-Stand", value: shortCommit(build.forgeCommit) },
    { label: "Patches für den Browser", value: String(build.patchCount) },
    { label: "Protokoll", value: `Version ${build.protocolVersion}` },
    { label: "GraalVM", value: build.graalvm },
    { label: "Engine gebaut", value: dateFormat.format(new Date(build.builtAt)) },
    { label: "Engine-Größe", value: `${formatMegabytes(build.downloadBytes)} (komprimiert ${formatMegabytes(build.downloadBrotliBytes)})` },
  ]
}

/** Settings whose stored value failed its check (their default is in use) - said, never silently replaced. */
const SETTING_NAMES: Readonly<Record<string, string>> = {
  "ai.profile": "KI-Profil",
  "display.cardLanguage": "Kartensprache",
  "display.motion": "Bewegungen reduzieren",
}

function InvalidPreferences() {
  const { invalid, status } = usePreferences()
  if (status === "error") {
    return (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertTitle>Die Einstellungen lassen sich gerade nicht lesen</AlertTitle>
        <AlertDescription>Bis dahin gelten die Vorgaben. Mehr dazu unten unter „Daten auf diesem Gerät“.</AlertDescription>
      </Alert>
    )
  }
  if (invalid.length === 0) return null
  return (
    <Alert>
      <TriangleAlert aria-hidden />
      <AlertTitle>{invalid.length === 1 ? "Eine gespeicherte Einstellung war ungültig" : "Gespeicherte Einstellungen waren ungültig"}</AlertTitle>
      <AlertDescription>
        {invalid.map((key) => SETTING_NAMES[key] ?? key).join(", ")}: Es gilt die Vorgabe, bis du neu wählst.
      </AlertDescription>
    </Alert>
  )
}

export function SettingsPage() {
  const features = useDeviceFeatures()
  return (
    <Page title="Einstellungen" description="Dein Gegner, die Anzeige, diese Version und die Daten auf diesem Gerät.">
      <InvalidPreferences />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card id="ai-profile" role="region" aria-labelledby="settings-ai-title">
          <CardHeader>
            <CardTitle id="settings-ai-title">Gegner</CardTitle>
            <CardDescription>Wie die Forge-KI spielt – ihr Profil gilt ab der nächsten Partie.</CardDescription>
          </CardHeader>
          <CardContent>
            <AiProfileOptions />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card role="region" aria-labelledby="settings-cards-title">
            <CardHeader>
              <CardTitle id="settings-cards-title">Kartensprache</CardTitle>
              <CardDescription>In welcher Sprache du Karten siehst.</CardDescription>
            </CardHeader>
            <CardContent>
              <CardLanguageOptions />
            </CardContent>
          </Card>
          <Card role="region" aria-labelledby="settings-a11y-title">
            <CardHeader>
              <CardTitle id="settings-a11y-title">Barrierefreiheit</CardTitle>
              <CardDescription>Wie viel sich auf dem Bildschirm bewegt. OpenMana folgt dabei immer deinem Gerät.</CardDescription>
            </CardHeader>
            <CardContent>
              <MotionOptions />
            </CardContent>
          </Card>
        </div>
        <Card role="region" aria-labelledby="settings-about-title">
          <CardHeader>
            <CardTitle id="settings-about-title">Über OpenMana</CardTitle>
            <CardDescription>Diese App-Version und die Forge-Engine, die sie mitbringt.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FactList facts={appFacts()} />
            <FactList facts={engineFacts()} />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <DiagnosticsDialog />
            <Button asChild variant="outline">
              <Link to="/credits">
                <Info data-icon="inline-start" aria-hidden />
                Credits und Lizenzen
              </Link>
            </Button>
          </CardFooter>
        </Card>
        <Card role="region" aria-labelledby="settings-device-title">
          <CardHeader>
            <CardTitle id="settings-device-title">Dieses Gerät</CardTitle>
            <CardDescription>
              {features.supported ? "Alles da, was die Forge-Engine braucht." : "Hier fehlt etwas, das die Forge-Engine braucht."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeatureChecklist features={features} />
          </CardContent>
        </Card>
      </div>
      <LocalDataCard />
      <CardDataCard />
    </Page>
  )
}
