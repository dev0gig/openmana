/*
 * Settings: for now what this build and this device are. Preferences (AI
 * profile, card language, accessibility) come with their own step and are
 * not faked here.
 */
import { Info } from "lucide-react"
import { Link } from "react-router"
import { FactList, type Fact } from "@/components/fact-list"
import { Page } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buildInfo } from "@/app/build-info"
import { FeatureChecklist, useDeviceFeatures } from "@/engine/device-support"
import { engineAssets } from "@/engine/engine-assets"
import { formatMegabytes, shortCommit } from "@/engine/engine-labels"

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
    { label: "Forge-Stand", value: shortCommit(build.forgeCommit) },
    { label: "Patches für den Browser", value: String(build.patchCount) },
    { label: "Protokoll", value: `Version ${build.protocolVersion}` },
    { label: "GraalVM", value: build.graalvm },
    { label: "Engine gebaut", value: dateFormat.format(new Date(build.builtAt)) },
    { label: "Engine-Größe", value: `${formatMegabytes(build.downloadBytes)} (komprimiert ${formatMegabytes(build.downloadBrotliBytes)})` },
  ]
}

export function SettingsPage() {
  const features = useDeviceFeatures()
  return (
    <Page title="Einstellungen" description="Über diese Version und dieses Gerät.">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Über OpenMana</CardTitle>
            <CardDescription>Diese App-Version und die Forge-Engine, die sie mitbringt.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FactList facts={appFacts()} />
            <FactList facts={engineFacts()} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dieses Gerät</CardTitle>
            <CardDescription>
              {features.supported ? "Alles da, was die Forge-Engine braucht." : "Hier fehlt etwas, das die Forge-Engine braucht."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeatureChecklist features={features} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Spiel und Anzeige</CardTitle>
          <CardDescription>KI-Profil, Kartensprache und Barrierefreiheit lassen sich bald hier einstellen.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/credits">
              <Info data-icon="inline-start" aria-hidden />
              Credits und Lizenzen
            </Link>
          </Button>
        </CardContent>
      </Card>
    </Page>
  )
}
