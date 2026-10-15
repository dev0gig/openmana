/*
 * Start: what OpenMana is, whether this device can run Forge, where to go next.
 * Menu style "Reich" (prompt 59, the template's start page): the large emblem
 * in its glow beside the wordmark, the ornament line under it, the steps
 * numbered in gold rings.
 */
import { CircleCheck, Layers, OctagonAlert, Swords } from "lucide-react"
import { Link } from "react-router"
import { Brand } from "@/components/brand"
import { TextLink } from "@/components/text-link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { OrnamentDivider } from "@/components/ui/ornament"
import { useDeviceFeatures } from "@/engine/device-support"

const STEPS = [
  { title: "Deck importieren", description: "Eine Arena-Deckliste einfügen – sie bleibt auf diesem Gerät.", ready: true },
  { title: "Gegner wählen", description: "Die Forge-KI spielt eines deiner Decks – von dir gewählt oder zufällig –, im Stil eines ihrer Profile.", ready: true },
  { title: "Spielen", description: "Forge entscheidet jede Regel; OpenMana zeigt dir, was möglich ist.", ready: true },
] as const

export function HomePage() {
  const features = useDeviceFeatures()
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 md:px-8 md:py-10">
      <title>OpenMana</title>
      <section className="flex flex-col gap-5" aria-labelledby="home-title">
        <h1 id="home-title" className="sr-only">
          OpenMana
        </h1>
        <div className="flex flex-col gap-3">
          <Brand size="hero" />
          <OrnamentDivider />
        </div>
        <p className="max-w-prose text-lg text-muted-foreground">
          Magic: The Gathering gegen die Forge-KI – direkt in deinem Browser, ohne Server und ohne Konto.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/play">
              <Swords data-icon="inline-start" aria-hidden />
              Spielen
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/decks">
              <Layers data-icon="inline-start" aria-hidden />
              Decks
            </Link>
          </Button>
          <Button size="lg" variant="outline" onClick={() => location.assign("https://oryx.quest/")}>
            Zurück zu ORYX
          </Button>
        </div>
      </section>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>So geht es los</CardTitle>
            <CardDescription>Drei Schritte bis zur ersten Partie.</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup>
              {STEPS.map((step, index) => (
                <Item key={step.title} variant="muted" size="sm" role="listitem">
                  <ItemMedia variant="number" aria-hidden>
                    {index + 1}
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {step.title}
                      {step.ready ? null : <Badge variant="outline">folgt</Badge>}
                    </ItemTitle>
                    <ItemDescription>{step.description}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dieses Gerät</CardTitle>
            <CardDescription>Forge rechnet lokal, deine Daten bleiben hier.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {features.supported ? (
              <Item variant="muted" size="sm">
                <ItemMedia variant="icon">
                  <CircleCheck aria-hidden />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Dieser Browser kann die Forge-Engine ausführen.</ItemTitle>
                </ItemContent>
              </Item>
            ) : (
              <Alert variant="destructive">
                <OctagonAlert aria-hidden />
                <AlertTitle>Dieser Browser kann die Forge-Engine nicht ausführen.</AlertTitle>
                <AlertDescription>Es fehlt: {features.missing.join(", ")}.</AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">
              OpenMana braucht kein Konto und sendet keine Nutzungsdaten. Details zur Technik stehen in den{" "}
              <TextLink to="/settings">Einstellungen</TextLink>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
