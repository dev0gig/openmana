/*
 * Play: prepare a game against Forge's AI. The engine can be loaded for real
 * (EnginePanel); a game needs a deck, which the deck import will provide, so
 * starting stays disabled until then. No sample decks, no simulated table.
 */
import { Bot, Layers, Swords } from "lucide-react"
import { Link } from "react-router"
import { Page } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { EnginePanel } from "@/engine/engine-panel"

export function PlayPage() {
  return (
    <Page title="Spielen" description="Du gegen die Forge-KI. Forge entscheidet alle Regeln, OpenMana zeigt sie dir.">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Partie vorbereiten</CardTitle>
            <CardDescription>Dein Deck gegen die Forge-KI.</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup>
              <Item variant="outline" role="listitem">
                <ItemMedia variant="icon">
                  <Layers aria-hidden />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Dein Deck</ItemTitle>
                  <ItemDescription>Noch kein Deck auf diesem Gerät.</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button asChild variant="outline">
                    <Link to="/decks">Zu den Decks</Link>
                  </Button>
                </ItemActions>
              </Item>
              <Item variant="outline" role="listitem">
                <ItemMedia variant="icon">
                  <Bot aria-hidden />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Gegner: Forge-KI</ItemTitle>
                  <ItemDescription>Die Wahl des KI-Profils folgt.</ItemDescription>
                </ItemContent>
              </Item>
            </ItemGroup>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-3">
            <Button size="lg" disabled aria-describedby="play-start-note">
              <Swords data-icon="inline-start" aria-hidden />
              Partie starten
            </Button>
            <span id="play-start-note" className="text-sm text-muted-foreground">
              Dafür fehlt noch ein Deck.
            </span>
          </CardFooter>
        </Card>
        <EnginePanel />
      </div>
    </Page>
  )
}
