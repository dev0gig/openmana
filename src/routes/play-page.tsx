/*
 * Play: prepare a game against Forge's AI. The engine can be loaded for real
 * (EnginePanel); a game needs a deck from the local library and the game
 * session (prompt 11), so starting stays disabled until then and says why.
 * No sample decks, no simulated table.
 */
import { Bot, Layers, Swords } from "lucide-react"
import { Link } from "react-router"
import { Page } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { EnginePanel } from "@/engine/engine-panel"
import { countDecks } from "@/storage/decks"
import { useStorageQuery } from "@/storage/storage-context"

export function PlayPage() {
  const decks = useStorageQuery(["decks"], countDecks)
  const deckText =
    decks.status === "loading"
      ? "Lese die Decks auf diesem Gerät …"
      : decks.status === "error"
        ? "Die Decks auf diesem Gerät lassen sich gerade nicht lesen."
        : decks.data === 0
          ? "Noch kein Deck auf diesem Gerät."
          : `${decks.data === 1 ? "1 Deck" : `${decks.data} Decks`} auf diesem Gerät – die Deckwahl folgt.`
  const startNote = decks.status === "ready" && decks.data > 0 ? "Das Starten einer Partie folgt in Kürze." : "Dafür fehlt noch ein Deck."
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
                  <ItemDescription>{deckText}</ItemDescription>
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
              {startNote}
            </span>
          </CardFooter>
        </Card>
        <EnginePanel />
      </div>
    </Page>
  )
}
