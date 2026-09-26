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
 * Operating the cards (prompt 14): the table's taps go to a recorder the
 * test reads (window.__openmanaTaps, the card ids in order) instead of an
 * engine - so the test proves which card a click, a double click, a long
 * press, a swipe or a key would tap, and that looking taps none.
 *
 * Answering Forge (prompt 15): the table's answers go to a recorder too
 * (window.__openmanaAnswers: question id and answer, in order). `built=`
 * puts a question the recorded games do not reach (src/test/built-questions.ts,
 * marked as built) on the scene's state.
 *
 * Not part of the app: only the test's dev server serves it,
 * /scripts/e2e/table-harness.html?scene=<name>[&built=<question>][&language=en][&waiting=0].
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
import { questionCards } from "@/game/decision-model"
import { visibleCards } from "@/game/table-model"
import { StorageProvider } from "@/storage/storage-context"
import type { AnswerBody, Question } from "@openmana/engine-protocol"
import { BUILT_QUESTIONS, builtQuestion, type BuiltQuestionName } from "./built-questions"
import { tableScene, type TableScene, type TableSceneName } from "./table-scenes"

declare global {
  interface Window {
    /** The cards the table tapped, in order (read by the end-to-end test). */
    __openmanaTaps?: number[]
    /** The answers the table gave, in order: [question id, answer] (read by the end-to-end test). */
    __openmanaAnswers?: [number, AnswerBody][]
  }
}

function recordTap(id: number): void {
  window.__openmanaTaps = [...(window.__openmanaTaps ?? []), id]
}

function recordAnswer(question: number, body: AnswerBody): void {
  window.__openmanaAnswers = [...(window.__openmanaAnswers ?? []), [question, body]]
}

function SceneTable({ scene, questions, prompt, language, waiting }: { scene: TableScene; questions: readonly Question[]; prompt: string | null; language: "de" | "en"; waiting: boolean }) {
  const cards = useMemo(() => [...visibleCards(scene.state).values(), ...questionCards(questions)], [scene, questions])
  const pictures = useTableCards(cards, language)
  return (
    // A main landmark around the table, as in the app (SidebarInset).
    <main className="h-dvh" data-harness="table">
      <GameTable
        state={scene.state}
        questions={questions}
        prompt={prompt}
        waiting={waiting && questions.length > 0}
        onTapCard={recordTap}
        onAnswer={recordAnswer}
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
  const builtName = params.get("built")
  const built = builtName !== null && (BUILT_QUESTIONS as readonly string[]).includes(builtName) ? builtQuestion(builtName as BuiltQuestionName, scene) : null
  const language = params.get("language") === "en" ? "en" : "de"
  const waiting = params.get("waiting") !== "0"
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
  return <SceneTable scene={scene} questions={built?.questions ?? scene.questions} prompt={built === null ? scene.prompt : built.prompt} language={language} waiting={waiting} />
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
