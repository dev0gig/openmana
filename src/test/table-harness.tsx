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
 * Targets and payment (prompt 17): the players it taps and the floating mana
 * it pays with go to recorders as well (window.__openmanaPlayerTaps: player
 * ids; window.__openmanaMana: colours).
 *
 * The surface (prompt 37): window.__openmanaShowScene(name) puts another
 * recorded scene's state on the table (a fresh copy, as a new state of Forge
 * would be) - the test measures what 20 such changes cost and that the table
 * surface is not drawn again for them.
 *
 * The arrows (prompt 43): `scene=attack-planeswalker-declared` is Forge's
 * next state after the recorded "attack-planeswalker", rebuilt from its own
 * messages (src/test/built-scenes.ts, marked as built) - an attacker of a
 * planeswalker, which the recorded scenes stop just short of.
 *
 * The motion (prompt 44): `sequence=first-attack` shows Forge's consecutive
 * states of a recorded game (src/test/table-sequence.ts) instead of a scene,
 * from `step=N`; window.__openmanaShowStep(n) puts step n on the table as the
 * next state - the test watches cards travel, turn, attack and leave.
 *
 * The toasts (prompt 51): the app shell's Toaster, so a refused drop's reason
 * shows as in the app.
 *
 * The table's background (prompt 53): the app's own provider chain
 * (StorageProvider → EngineSessionProvider → PreferencesProvider, as in
 * src/app/app-shell.tsx; the engine is never started) reads the setting
 * display.tableBackground from this browser's IndexedDB, as the app does -
 * so without a stored choice the table shows the arena, the default.
 * `background=<choice>` stores that choice first (arena, table, colors,
 * planeswalker, grid; custom with a tiny picture of its own) and the table
 * shows it; window.__openmanaChooseBackground(choice) stores another one
 * while the page stays - the test compares the same scene over the arena
 * and over the drawn table.
 *
 * Not part of the app: only the test's dev server serves it,
 * /scripts/e2e/table-harness.html?scene=<name>[&built=<question>][&presentation=dfc|fallback|keywords][&hand=<cards>][&starthand=1|bottom][&language=en][&waiting=0][&background=<choice>]
 * or ?sequence=first-attack[&step=<n>].
 */
import { Menu } from "lucide-react"
import { StrictMode, useEffect, useMemo, useState, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import "@/index.css"
import { PreferencesProvider } from "@/app/preferences"
import { CardCatalogProvider, useCardCatalog } from "@/cards/card-catalog-context"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { GameTable } from "@/game/game-table"
import { useTableCards } from "@/game/table-cards"
import { questionCards } from "@/game/decision-model"
import { TABLE_BACKGROUND, TABLE_BACKGROUND_IMAGE, type TableBackgroundChoice } from "@/game/table/table-background"
import { visibleCards } from "@/game/table-model"
import { StorageProvider, useStorage } from "@/storage/storage-context"
import { useSaveSetting } from "@/storage/use-save-setting"
import type { AnswerBody, CardKeyword, ManaColor, Question, VisibleCard } from "@openmana/engine-protocol"
import keywordForms from "./fixtures/keyword-forms.json"
import { BUILT_QUESTIONS, builtQuestion, type BuiltQuestionName } from "./built-questions"
import { builtTableScene, isBuiltTableScene } from "./built-scenes"
import { tableScene, type TableScene, type TableSceneName } from "./table-scenes"
import { sequenceMoment, TABLE_SEQUENCE } from "./table-sequence"

declare global {
  interface Window {
    /** The cards the table tapped, in order (read by the end-to-end test). */
    __openmanaTaps?: number[]
    /** The answers the table gave, in order: [question id, answer] (read by the end-to-end test). */
    __openmanaAnswers?: [number, AnswerBody][]
    /** The players the table tapped, in order (prompt 17). */
    __openmanaPlayerTaps?: number[]
    /** The floating mana the table paid with, in order (prompt 17). */
    __openmanaMana?: ManaColor[]
    /** Shows another recorded scene's state (prompt 37: state changes for the surface's measurement). */
    __openmanaShowScene?: (name: TableSceneName) => void
    /** Shows step n of the recorded sequence as the next state (prompt 44: the motion). */
    __openmanaShowStep?: (step: number) => void
    /** Stores another table background (prompt 53); the table follows through the app's own preferences. */
    __openmanaChooseBackground?: (choice: TableBackgroundChoice) => Promise<boolean>
  }
}

const BACKGROUNDS: readonly TableBackgroundChoice[] = ["arena", "table", "colors", "planeswalker", "grid", "custom"]

/** A tiny picture of the player's own (one WebP pixel) for background=custom. */
const OWN_PICTURE = "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA="

/**
 * The table's background as the test asks for it (background=<choice>): stored
 * in this browser's database before the table shows, through the same write
 * the Settings page uses; without the query nothing is stored and the app's
 * default applies.
 */
function BackgroundChoice({ choice, children }: { choice: TableBackgroundChoice | null; children: ReactNode }) {
  const { snapshot } = useStorage()
  const save = useSaveSetting()
  const [stored, setStored] = useState(choice === null)
  const ready = snapshot.status === "ready"
  useEffect(() => {
    if (!ready) return
    window.__openmanaChooseBackground = async (next) => {
      if (next === "custom" && !(await save(TABLE_BACKGROUND_IMAGE, OWN_PICTURE))) return false
      return save(TABLE_BACKGROUND, next)
    }
    return () => {
      delete window.__openmanaChooseBackground
    }
  }, [ready, save])
  useEffect(() => {
    if (stored || !ready || choice === null) return
    let active = true
    void window.__openmanaChooseBackground?.(choice).then((done) => {
      if (active && done) setStored(true)
    })
    return () => {
      active = false
    }
  }, [stored, ready, choice])
  if (!stored) return <p data-harness="background" data-status={ready ? "storing" : "waiting"}>Spieltisch-Hintergrund: {choice}</p>
  return children
}

function recordTap(id: number): void {
  window.__openmanaTaps = [...(window.__openmanaTaps ?? []), id]
}

function recordAnswer(question: number, body: AnswerBody): void {
  window.__openmanaAnswers = [...(window.__openmanaAnswers ?? []), [question, body]]
}

function recordPlayerTap(id: number): void {
  window.__openmanaPlayerTaps = [...(window.__openmanaPlayerTaps ?? []), id]
}

function recordMana(color: ManaColor): void {
  window.__openmanaMana = [...(window.__openmanaMana ?? []), color]
}

function SceneTable({ scene, questions, prompt, language, waiting, startHand = false }: { scene: TableScene; questions: readonly Question[]; prompt: string | null; language: "de" | "en"; waiting: boolean; startHand?: boolean }) {
  const cards = useMemo(() => [...visibleCards(scene.state).values(), ...questionCards(questions)], [scene, questions])
  const pictures = useTableCards(cards, language)
  return (
    // A main landmark around the table, as in the app (SidebarInset).
    <main className="h-dvh" data-harness="table">
      <GameTable
        state={scene.state}
        history={scene.history}
        questions={questions}
        prompt={prompt}
        waiting={waiting && questions.length > 0}
        onTapCard={recordTap}
        onAnswer={recordAnswer}
        onTapPlayer={recordPlayerTap}
        onUseMana={recordMana}
        startHandOpens={startHand}
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

/** Forge's real keyword objects (scripts/record-keyword-forms.ts) by keyword and title. */
function forgeKeyword(keyword: string, title: string): CardKeyword {
  const found = (keywordForms.forms as readonly (CardKeyword & { readonly card: string; readonly count: number })[]).find((form) => form.keyword === keyword && form.title === title)
  if (found === undefined) throw new Error(`no recorded Forge keyword ${keyword} "${title}"`)
  const { card: _card, count: _count, ...protocol } = found
  return protocol
}

/**
 * Built presentation (prompt 47, presentation=keywords): the card view with several keywords. The recorded games
 * show one keyword per card; here the respond scene's Geborstener Blitz (id 26, Forge's offer kept) becomes the
 * catalog's Serra Angel with Forge's real keyword objects - its own Flying and Vigilance, and Protection from red
 * and Ward (pay 2 life) as an effect might give them; the last is a form OpenMana says only in general.
 */
function keywordScene(recorded: TableScene): TableScene {
  const state = structuredClone(recorded.state)
  const me = state.players.find((p) => p.me)!
  me.zones.hand = me.zones.hand.map((card) => !("hidden" in card) && card.id === 26 ? {
    ...card,
    key: "Serra Angel",
    name: "Serra-Engel",
    typeLine: "Kreatur — Engel",
    cost: "{3}{W}{W}",
    power: 4,
    toughness: 4,
    text: "Fliegend\nWachsamkeit",
    keywords: [forgeKeyword("FLYING", "Flying"), forgeKeyword("VIGILANCE", "Vigilance"), forgeKeyword("PROTECTION", "Protection from from red"), forgeKeyword("WARD", "Ward—Pay 2 life.")],
  } : card)
  return { ...recorded, state }
}

/** Built catalog presentation case, separate from the unchanged recorded scenes. */
function presentationScene(recorded: TableScene, presentation: string | null): TableScene {
  if (presentation === "keywords") return keywordScene(recorded)
  if (presentation !== "dfc" && presentation !== "fallback") return recorded
  const state = structuredClone(recorded.state)
  const me = state.players.find((p) => p.me)!
  me.zones.hand = me.zones.hand.map((card, index) => index === 0 && !("hidden" in card) ? { ...card, key: presentation === "dfc" ? "Delver of Secrets" : "Akki Lavarunner", name: presentation === "dfc" ? "Geheimnisstöberer" : "Akki Lavarunner", text: null } : card)
  return { ...recorded, state }
}

/**
 * The start hand (prompt 50, starthand=1|bottom): the panel opens by itself
 * as in the running game (startHandOpens). `bottom` is built: Forge's London
 * mulligan question for the bottom (OK and Auto as Forge labels them, OK on)
 * on the scene's state, the first two hand cards marked as Forge marks chosen
 * ones (highlighted) - never a claim of Forge's.
 */
function bottomScene(recorded: TableScene): TableScene {
  const state = structuredClone(recorded.state)
  const me = state.players.find((p) => p.me)!
  me.zones.hand = me.zones.hand.map((card, index) => (index < 2 && !("hidden" in card) ? { ...card, highlighted: true as const } : card))
  const questions: Question[] = [{ type: "question", kind: "buttons", id: 900, blocking: false, text: "", purpose: "mulliganBottom", buttons: [{ nr: 1, label: "OK", enabled: true }, { nr: 2, label: "Auto", enabled: true }] }]
  return { ...recorded, state, questions, prompt: null }
}

/**
 * Built hand size (prompt 42, the fan with many cards): the scene's own hand
 * cards repeated under new ids up to `count` cards - a presentation boundary
 * the recorded games do not reach (at most seven cards), never a claim of
 * Forge's. Marked by the query (hand=N).
 */
function handScene(scene: TableScene, count: number): TableScene {
  if (!Number.isInteger(count) || count <= 0) return scene
  const state = structuredClone(scene.state)
  const me = state.players.find((p) => p.me)
  const own = me?.zones.hand.filter((card): card is VisibleCard => !("hidden" in card)) ?? []
  if (me === undefined || own.length === 0) return scene
  let next = Math.max(...visibleCards(state).keys()) + 1000
  me.zones.hand = Array.from({ length: count }, (_, index) => (index < own.length ? own[index]! : { ...own[index % own.length]!, id: next++ }))
  return { ...scene, state }
}

/** The recorded sequence's step as a scene of the harness (prompt 44): Forge's state, questions, prompt line and log up to it. */
function sequenceScene(step: number): TableScene {
  const moment = sequenceMoment(step)
  return {
    name: "main-phase",
    description: `${TABLE_SEQUENCE.description} Step ${step}.`,
    fixture: TABLE_SEQUENCE.fixture,
    message: TABLE_SEQUENCE.steps[step]!.message,
    game: TABLE_SEQUENCE.game,
    state: moment.state,
    questions: moment.questions,
    prompt: moment.prompt,
    history: moment.history,
    notices: [],
  }
}

/** A recorded scene (scene=…), or the recorded sequence (sequence=first-attack, prompt 44). */
function Harness() {
  const params = new URLSearchParams(window.location.search)
  if (params.get("sequence") === TABLE_SEQUENCE.name) return <SequenceHarness first={Number(params.get("step") ?? 0) || 0} language={params.get("language") === "en" ? "en" : "de"} />
  return <SceneHarness />
}

function SceneHarness() {
  const params = new URLSearchParams(window.location.search)
  const sceneName = params.get("scene") ?? "opening"
  // A moment rebuilt from Forge's next messages (src/test/built-scenes.ts, prompt 43), or a recorded one.
  const recorded = isBuiltTableScene(sceneName) ? builtTableScene(sceneName) : tableScene(sceneName as TableSceneName)
  // Explicitly built presentation boundary: real catalog DFC, no claim of a Forge transform.
  const presentation = params.get("presentation")
  const handSize = params.get("hand")
  const startHand = params.get("starthand")
  const [scene, setScene] = useState(() => {
    const shown = handScene(presentationScene(recorded, presentation), handSize === null ? 0 : Number(handSize))
    return startHand === "bottom" ? bottomScene(shown) : shown
  })
  useEffect(() => {
    window.__openmanaShowScene = (name) => setScene(structuredClone(tableScene(name)))
    return () => {
      delete window.__openmanaShowScene
    }
  }, [])
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
  return <SceneTable scene={scene} questions={built?.questions ?? scene.questions} prompt={built === null ? scene.prompt : built.prompt} language={language} waiting={waiting} startHand={startHand === "1" || startHand === "bottom"} />
}

/** The recorded sequence (prompt 44): one step at a time, the next one by window.__openmanaShowStep. */
function SequenceHarness({ first, language }: { first: number; language: "de" | "en" }) {
  const [step, setStep] = useState(first)
  const scene = useMemo(() => sequenceScene(step), [step])
  useEffect(() => {
    window.__openmanaShowStep = (next) => setStep(next)
    return () => {
      delete window.__openmanaShowStep
    }
  }, [])
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
  return <SceneTable scene={scene} questions={scene.questions} prompt={scene.prompt} language={language} waiting />
}

const container = document.getElementById("root")
if (!container) throw new Error("the harness page has no #root element")
const background = new URLSearchParams(window.location.search).get("background")
createRoot(container).render(
  <StrictMode>
    <StorageProvider>
      {/* The app's own chain for the preferences (prompt 53, as src/app/app-shell.tsx): the engine session only exists, nothing boots. */}
      <EngineSessionProvider>
        <PreferencesProvider>
          <BackgroundChoice choice={BACKGROUNDS.find((choice) => choice === background) ?? null}>
            <CardCatalogProvider>
              <TooltipProvider>
                <Harness />
                {/* The app's toasts (prompt 51: a refused drop says why), as the app shell shows them. */}
                <Toaster />
              </TooltipProvider>
            </CardCatalogProvider>
          </BackgroundChoice>
        </PreferencesProvider>
      </EngineSessionProvider>
    </StorageProvider>
  </StrictMode>,
)
