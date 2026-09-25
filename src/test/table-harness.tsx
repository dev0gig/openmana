/*
 * The game table harness of the end-to-end test (prompt 13; scripts/e2e/run.ts,
 * section 12): the real table (GameTable) with the real card catalog lookup
 * (useTableCards, the catalog installed into this browser's IndexedDB like
 * the app installs it) shows one recorded real scene
 * (src/test/table-scenes.ts) - so the table's layout is checked in real
 * Chrome at every size with the full battlefields of real games, which the
 * live game of the end-to-end test cannot reach yet (answering Forge comes
 * with prompts 14-19). Nothing here acts or simulates: it only renders a
 * state Forge sent.
 *
 * Not part of the app: only the test's dev server serves it,
 * /scripts/e2e/table-harness.html?scene=<name>[&language=en].
 */
import { Menu } from "lucide-react"
import { StrictMode, useEffect, useMemo } from "react"
import { createRoot } from "react-dom/client"
import "@/index.css"
import { CardCatalogProvider, useCardCatalog } from "@/cards/card-catalog-context"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GameTable } from "@/game/game-table"
import { useTableCards } from "@/game/table-cards"
import { visibleCards } from "@/game/table-model"
import { StorageProvider } from "@/storage/storage-context"
import { tableScene, type TableScene, type TableSceneName } from "./table-scenes"

function SceneTable({ scene, language }: { scene: TableScene; language: "de" | "en" }) {
  const cards = useMemo(() => [...visibleCards(scene.state).values()], [scene])
  const pictures = useTableCards(cards, language)
  return (
    // A main landmark around the table, as in the app (SidebarInset).
    <main className="h-dvh" data-harness="table">
      <GameTable
        state={scene.state}
        questions={scene.questions}
        prompt={scene.prompt}
        waiting={scene.questions.length > 0}
        aiProfile={scene.game.aiProfile}
        pictures={pictures}
        menu={
          <Button variant="ghost" size="icon-lg" aria-label="Menü">
            <Menu aria-hidden />
          </Button>
        }
      />
    </main>
  )
}

function Harness() {
  const params = new URLSearchParams(window.location.search)
  const scene = tableScene((params.get("scene") ?? "opening") as TableSceneName)
  const language = params.get("language") === "en" ? "en" : "de"
  const catalog = useCardCatalog()
  const { status, install } = catalog
  useEffect(() => {
    if (status === "missing" || status === "partial" || status === "outdated") void install()
  }, [status, install])
  if (status !== "ready") {
    return (
      <p data-harness="catalog" data-status={status}>
        Kartendaten: {status} {catalog.error ? `– ${catalog.error.message}` : ""}
      </p>
    )
  }
  return <SceneTable scene={scene} language={language} />
}

const container = document.getElementById("root")
if (!container) throw new Error("the harness page has no #root element")
createRoot(container).render(
  <StrictMode>
    <StorageProvider>
      <CardCatalogProvider>
        <TooltipProvider>
          <Harness />
        </TooltipProvider>
      </CardCatalogProvider>
    </StorageProvider>
  </StrictMode>,
)
