/*
 * Credits (Bible §14): software OpenMana incorporates, data providers,
 * inspiration and reference, how generative AI made OpenMana, the icon. Kinds
 * are kept apart. Build-generated legal assets are local/offline available;
 * the public source is the exact commit of this build. The engine toolchain
 * (GraalVM Community Edition from open sources) and the remaining JVMCI
 * license note are published openly (docs/PUBLICATION.md, SOURCE.md).
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
import { buildInfo } from "@/app/build-info"

/** The public repository; a build names its exact commit there (SOURCE.md). */
export const SOURCE_REPOSITORY = "https://github.com/dev0gig/openmana"
const sourceHref = buildInfo.commit ? `${SOURCE_REPOSITORY}/tree/${buildInfo.commit}` : SOURCE_REPOSITORY

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
            <li>
              <Button variant="outline" asChild>
                <a href={sourceHref} target="_blank" rel="noreferrer">
                  Quelltext dieser Version auf GitHub
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Der komplette Quelltext ist öffentlich{buildInfo.commit ? ` (diese Version: ${shortCommit(buildInfo.commit)})` : ""}; zu jeder
            Engine-Version gibt es dort ein Quellarchiv samt Forge-Quellstand. Die Engine entsteht mit GraalVM Community Edition
            aus offenem Quelltext, ohne Oracle-Lizenzteile. Offen benannt bleibt ein kleiner Rest: 13 Typen der
            Java-Compilerschnittstelle (JVMCI) aus dem OpenJDK stehen unter GPLv2 ohne Classpath-Ausnahme; die Einzelheiten stehen
            im Quelltext-Dokument.
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
          <CreditEntry name="GraalVM Community Edition (Web Image)" href="https://github.com/oracle/graal" license="GPL-2.0 mit Classpath Exception, UPL-1.0">
            Übersetzt Forge nach WebAssembly; aus dem offenen Quelltext gebaut, zusammen mit dem OpenJDK (labsjdk-ce). Teile der
            Laufzeit und der Java-Klassenbibliothek stecken im Engine-Modul.
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
            <CardTitle>Entwickelt mit generativer KI</CardTitle>
            <CardDescription>Idee und Leitung: dev0gig. Ausgearbeitet und programmiert mit KI.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">
              OpenMana wurde mit umfassender Unterstützung durch generative künstliche Intelligenz entwickelt: Programmcode,
              Tests, Recherche, Dokumentation, Oberflächentexte und das App-Icon. Die Idee, die Richtung und jede Freigabe stammen
              vom Projektbesitzer. Nicht von KI stammen die Magic-Regeln und die Gegner-KI (Forge) sowie Kartentexte und Kartenbilder
              (Scryfall, Wizards of the Coast).
            </p>
            <CreditEntry name="OpenAI ChatGPT und Codex">Programmcode, Recherche, Dokumentation und das App-Icon.</CreditEntry>
            <CreditEntry name="Anthropic Claude">Programmcode, Recherche und Dokumentation.</CreditEntry>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>App-Icon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Das Icon hat der Projektbesitzer selbst mit ChatGPT (OpenAI) erzeugt; zuerst war es das Icon von Anvil, dem Vorgänger
            von OpenMana. Es wird mit OpenMana unter dessen Lizenz weitergegeben.
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
