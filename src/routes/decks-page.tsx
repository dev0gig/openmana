/* Decks: the local deck library. Import and storage follow (IndexedDB, Arena import); until then it is honestly empty. */
import { Layers, Upload } from "lucide-react"
import { Page } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function DecksPage() {
  return (
    <Page title="Decks" description="Deine Decks – gespeichert nur auf diesem Gerät.">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Noch keine Decks</EmptyTitle>
          <EmptyDescription>Hier erscheinen deine importierten Arena-Decklisten.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="lg" disabled aria-describedby="decks-import-note">
            <Upload data-icon="inline-start" aria-hidden />
            Arena-Deck importieren
          </Button>
          <p id="decks-import-note" className="text-sm text-muted-foreground">
            Der Import folgt in Kürze.
          </p>
        </EmptyContent>
      </Empty>
    </Page>
  )
}
