/*
 * Credits (Bible §14): software OpenMana incorporates, data providers,
 * inspiration and reference, AI assistance, the temporary icon. Kinds are
 * kept apart. Build-generated legal assets are local/offline available; the
 * open GraalVM license
 * question stays open here too (docs/research/LICENSES.md).
 *
 * Scryfall (prompt 08) is named as the source of card data and pictures -
 * without its logo and without implying that Scryfall endorses OpenMana, as
 * Scryfall's terms require; the card data and pictures themselves belong to
 * Wizards of the Coast (Fan Content Policy).
 */
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { Page } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cardAssets } from "@/cards/card-assets"
import { formatDate } from "@/cards/card-labels"
import { engineAssets } from "@/engine/engine-assets"
import { shortCommit } from "@/engine/engine-labels"
import { Button } from "@/components/ui/button"

function CreditEntry({ name, href, license, children }: { name: string; href?: string; license?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
            {name}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        ) : (
          <span className="font-medium">{name}</span>
        )}
        {license ? <Badge variant="outline">{license}</Badge> : null}
      </div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

const LIBRARIES: readonly { name: string; license: string }[] = [
  { name: "React", license: "MIT" },
  { name: "React Router", license: "MIT" },
  { name: "Radix UI", license: "MIT" },
  { name: "shadcn/ui", license: "MIT" },
  { name: "Tailwind CSS", license: "MIT" },
  { name: "tw-animate-css", license: "MIT" },
  { name: "class-variance-authority", license: "Apache-2.0" },
  { name: "cn", license: "MIT" },
  { name: "Lucide", license: "ISC" },
  { name: "Sonner", license: "MIT" },
  { name: "idb", license: "ISC" },
  { name: "Schrift Inter", license: "OFL-1.1" },
  { name: "Schrift Cinzel", license: "OFL-1.1" },
]

export function CreditsPage() {
  return (
    <Page title="Credits" description="Wer und was OpenMana möglich macht.">
      <Card>
        <CardHeader>
          <CardTitle>Open Source und Lizenzen</CardTitle>
          <CardDescription>Copyright © 2026 dev0gig und die OpenMana-Mitwirkenden.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            OpenMana-Code und Forge-Engine stehen unter GPL-3.0-or-later. Du darfst den Code nach den Bedingungen
            dieser Lizenz verwenden, ändern und weitergeben. Fremde Bestandteile behalten ihre eigenen Lizenzen.
            Kartenbilder und Marken sind davon ausgenommen.
          </p>
          <p className="text-sm text-muted-foreground">
            Ohne Gewährleistung, soweit gesetzlich zulässig. Die Einzelheiten stehen im vollständigen Lizenztext.
          </p>
          <ul className="flex flex-col gap-3" aria-label="Lizenztexte und Quelltext">
            <li><Button variant="outline" asChild><a href="/legal/LICENSE.txt">GPL-Lizenztext</a></Button></li>
            <li><Button variant="outline" asChild><a href="/legal/THIRD-PARTY-NOTICES.txt">Alle Drittanbieter-Lizenzen und Hinweise</a></Button></li>
            <li><Button variant="outline" asChild><a href="/legal/SOURCE.txt">Quelltext und Veröffentlichungsstand</a></Button></li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Noch keine öffentliche Veröffentlichung: Die Weitergabe der GraalVM-Laufzeit ist nicht abschließend geklärt.
            Ein öffentlich zugänglicher Quellstand für diese Version steht noch aus.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Enthaltene Software</CardTitle>
          <CardDescription>Was in OpenMana steckt und mit jeder Version ausgeliefert wird.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <CreditEntry name="Forge – die Card-Forge-Community" href="https://github.com/Card-Forge/forge" license="GPL-3.0-or-later">
            Die Regel-Engine von OpenMana: alle Magic-Regeln, jedes Kartenskript und die KI. OpenMana ändert daran nichts außer
            einer kleinen Patch-Reihe für den Betrieb im Browser.
            {engineAssets.available ? ` Enthaltener Forge-Stand: ${shortCommit(engineAssets.build.forgeCommit)}.` : null}
          </CreditEntry>
          <CreditEntry name="Oracle GraalVM Web Image" href="https://www.graalvm.org/">
            Übersetzt Forge nach WebAssembly; Teile seiner Laufzeit stecken im Engine-Modul. Unter welchen Bedingungen diese
            Teile öffentlich weitergegeben werden dürfen, ist noch nicht abschließend geklärt.
          </CreditEntry>
          <Separator />
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Bibliotheken und Schriften der App</p>
            <ul className="flex flex-wrap gap-2" aria-label="Bibliotheken und Schriften">
              {LIBRARIES.map((library) => (
                <li key={library.name}>
                  <Badge variant="secondary">
                    {library.name} · {library.license}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Die vollständigen Lizenztexte, Copyrights und Hinweise der enthaltenen Bestandteile findest du oben
              unter „Alle Drittanbieter-Lizenzen und Hinweise“.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kartendaten und Kartenbilder</CardTitle>
          <CardDescription>Woher Kartennamen, Kartentexte und Kartenbilder kommen.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <CreditEntry name="Scryfall" href="https://scryfall.com">
            Deutsche und englische Kartennamen, Kartentexte, Set-Angaben und Kartenbilder stammen von Scryfall
            {cardAssets.available ? ` (Stand ${formatDate(cardAssets.source.updatedAt)})` : ""}. OpenMana nutzt sie nur zur Anzeige und zum
            Nachschlagen; welche Karten es gibt und was sie tun, entscheidet allein Forge. Scryfall steht in keiner Verbindung zu OpenMana und hat
            OpenMana weder geprüft noch empfohlen.
          </CreditEntry>
          <CreditEntry name="Wizards of the Coast – Fan Content Policy" href="https://company.wizards.com/fancontentpolicy">
            Die Karteninformationen und Kartenbilder, einschließlich der Manasymbole, sind urheberrechtlich geschützt von Wizards of the Coast LLC.
            OpenMana nutzt sie als inoffizieller Fan-Inhalt im Rahmen der Fan Content Policy. Jedes Kartenbild nennt seine Künstlerin oder seinen
            Künstler; OpenMana zeigt die Bilder immer vollständig und unverändert.
          </CreditEntry>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vorbild und Referenz</CardTitle>
          </CardHeader>
          <CardContent>
            <CreditEntry name="ManaBrew" href="https://github.com/witchesofthehill/manabrew">
              Hat gezeigt, dass Forge als WebAssembly im Browser laufen kann, und war die technische Vorlage für OpenManas Engine.
              Drei Forge-Patches für den Betrieb auf einem einzigen Thread stammen aus ManaBrews Forge-Fork (GPL-3.0-or-later).
              Die übrige OpenMana-Anwendung übernimmt keinen Code aus ManaBrews AGPL-Hauptrepository.
            </CreditEntry>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Entwickelt mit KI-Unterstützung</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <CreditEntry name="OpenAI ChatGPT">Unterstützung bei Entwicklung und Gestaltung.</CreditEntry>
            <CreditEntry name="Anthropic Claude">Unterstützung bei der Entwicklung.</CreditEntry>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>App-Icon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Das vorläufige Icon stammt unverändert aus Anvil, dem Vorgänger von OpenMana.
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        OpenMana ist ein inoffizielles Fanprojekt und steht in keiner Verbindung zu Wizards of the Coast. Magic: The Gathering
        ist eine Marke von Wizards of the Coast LLC.
      </p>
    </Page>
  )
}
