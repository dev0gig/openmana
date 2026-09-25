/*
 * The game session as the player meets it: the play page prewarms the
 * engine, "Partie starten" hands the chosen decks to Forge and leads to the
 * game page, which shows every state - waiting for the engine, Forge building
 * the game, the running game on the game table (prompt 13) with its menu,
 * the result, a refusal with Forge's report, a technical abort, a silent
 * engine - and offers a way on from each. The engine is the real EngineClient over a
 * scripted worker (src/test/game-fixtures.ts); the decks come from the
 * local database.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router"
import { afterEach, describe, expect, it } from "vitest"
import { DESTINATIONS } from "@/app/navigation"
import { PreferencesProvider } from "@/app/preferences"
import { CardCatalogProvider } from "@/cards/card-catalog-context"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AI_DECK, HUMAN_DECK } from "@/decks/deck-selection"
import { AI_PROFILE, type AiProfileChoice } from "./ai-profiles"
import { AI_PROFILE_TABLE } from "./ai-profile-table"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { PlayPage } from "@/routes/play-page"
import { saveDeck } from "@/storage/decks"
import type { DeckRecord } from "@/storage/generated/records"
import { writeSetting } from "@/storage/settings"
import { StorageProvider } from "@/storage/storage-context"
import { MULLIGAN_PROMPT, settle, SUPPORTED, testEngine, type TestEngine } from "@/test/game-fixtures"
import { deck, openTestDatabase } from "@/test/storage-fixtures"
import { GamePage } from "./game-page"

const RED = deck({ id: "10000000-0000-4000-8000-00000000000a", name: "Rot", main: [{ count: 24, name: "Mountain" }, { count: 36, name: "Shock" }], sideboard: [] })
const GREEN = deck({ id: "10000000-0000-4000-8000-00000000000b", name: "Grün", main: [{ count: 24, name: "Forest" }, { count: 36, name: "Grizzly Bears" }], sideboard: [] })

async function store(decks: readonly DeckRecord[], human: string | null = RED.id, profile: AiProfileChoice | null = null): Promise<void> {
  const db = await openTestDatabase()
  for (const record of decks) await saveDeck(db, record)
  if (human !== null) await writeSetting(db, HUMAN_DECK, human)
  await writeSetting(db, AI_DECK, { kind: "random" })
  if (profile !== null) await writeSetting(db, AI_PROFILE, profile)
  db.close()
}

function Frame({ engine }: { engine: TestEngine }) {
  return (
    <StorageProvider>
      <CardCatalogProvider>
        <EngineSessionProvider session={engine.session}>
          <PreferencesProvider>
            <TooltipProvider>
              <Outlet />
              <Toaster />
            </TooltipProvider>
          </PreferencesProvider>
        </EngineSessionProvider>
      </CardCatalogProvider>
    </StorageProvider>
  )
}

function renderAt(path: string, engine: TestEngine) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Frame engine={engine} />,
        children: [
          { path: "play", element: <PlayPage /> },
          { path: "play/game", element: <GamePage /> },
          { path: "decks/:deckId", element: <h1>Deckseite</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const startButton = () => screen.getAllByRole("button", { name: /Partie starten|Zur laufenden Partie/ })[0]!

afterEach(() => {
  // The window's size is shared by all tests of the file.
  window.innerWidth = 1024
})

describe("the play page", () => {
  it("prewarms the engine when a deck is there, and starts a game with the chosen decks", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    const engine = testEngine()
    const router = renderAt("/play", engine)
    await screen.findByText(/^Rot – Constructed/)
    // Prewarmed without a click.
    await waitFor(() => expect(engine.workers).toHaveLength(1))
    expect(engine.session.getSnapshot().engine.status).toBe("booting")
    expect(within(screen.getByRole("region", { name: "Forge-Engine" })).getByText("Lädt")).toBeInTheDocument()
    expect(startButton()).toBeEnabled()
    expect(screen.getAllByText("Forge lädt noch – die Partie beginnt, sobald Forge bereit ist.")[0]).toBeInTheDocument()

    await user.click(startButton())
    expect(router.state.location.pathname).toBe("/play/game")
    expect(await screen.findByRole("region", { name: "Partie wird vorbereitet" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Startschritte der Engine" })).toBeInTheDocument()
    expect(screen.getByText("Grün (zufällig gezogen)")).toBeInTheDocument()

    act(() => engine.worker().boot())
    const [start] = engine.worker().matchStarts()
    expect(start?.match.format).toBe("constructed")
    expect(start?.match.human).toEqual({ name: "Spieler", deck: { name: "Rot", main: [{ card: "Mountain", count: 24 }, { card: "Shock", count: 36 }] } })
    expect(start?.match.ai).toEqual({ name: "Forge-KI", profile: "Default", deck: { name: "Grün", main: [{ card: "Forest", count: 24 }, { card: "Grizzly Bears", count: 36 }] } })
    expect(Number.isSafeInteger(start?.match.seed)).toBe(true)
    expect(await screen.findByRole("region", { name: "Forge baut die Partie auf" })).toBeInTheDocument()
    expect(engine.workers).toHaveLength(1)
  })

  it("prewarms as soon as decks are there, and names the deck choice before anything else", async () => {
    await store([RED, GREEN], null)
    const engine = testEngine()
    renderAt("/play", engine)
    expect(await screen.findByText("Noch kein Deck gewählt.")).toBeInTheDocument()
    await waitFor(() => expect(engine.workers).toHaveLength(1))
    expect(startButton()).toBeDisabled()
    expect(startButton()).toHaveAccessibleDescription("Wähle zuerst dein Deck.")
    act(() => engine.worker().boot())
    expect(startButton()).toHaveAccessibleDescription("Wähle zuerst dein Deck.")
  })

  it("does not load the engine without a deck to play", async () => {
    const engine = testEngine()
    renderAt("/play", engine)
    expect(await screen.findByText("Noch kein Deck auf diesem Gerät.")).toBeInTheDocument()
    await settle()
    expect(engine.workers).toHaveLength(0)
    expect(startButton()).toBeDisabled()
    expect(screen.getAllByText("Dafür fehlt noch ein Deck.")[0]).toBeInTheDocument()
  })

  it("says why a game cannot start in a browser that cannot run the engine", async () => {
    await store([RED, GREEN])
    const engine = testEngine({ features: { ...SUPPORTED, wasmExnref: false, missing: ["WebAssembly Exception Handling (exnref)"], supported: false } })
    renderAt("/play", engine)
    await screen.findByText(/^Rot – Constructed/)
    await settle()
    expect(engine.workers).toHaveLength(0)
    expect(startButton()).toBeDisabled()
    expect(screen.getAllByText("Dieser Browser kann die Forge-Engine nicht ausführen.")[0]).toBeInTheDocument()
  })

  it("leads back to a running game instead of starting a second one", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    const engine = await runningGame()
    const router = renderAt("/play", engine)
    expect(await screen.findByText("Eine Partie läuft")).toBeInTheDocument()
    const panel = screen.getByRole("region", { name: "Forge-Engine" })
    expect(within(panel).getByText("Spielt")).toBeInTheDocument()
    expect(within(panel).queryByRole("button", { name: "Engine beenden" })).not.toBeInTheDocument()
    expect(within(panel).getByRole("link", { name: "Zur Partie" })).toHaveAttribute("href", "/play/game")
    await user.click(screen.getByRole("button", { name: "Zur laufenden Partie" }))
    expect(router.state.location.pathname).toBe("/play/game")
    expect(await screen.findByRole("region", { name: "Deine Hand" })).toBeInTheDocument()
    expect(engine.worker().matchStarts()).toHaveLength(1)
  })
})

describe("the play page: the AI profile (prompt 12)", () => {
  it("shows the stored profile, hands it to Forge, and the game names it", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN], RED.id, { kind: "profile", name: "Reckless" })
    const engine = testEngine()
    renderAt("/play", engine)
    expect(await screen.findByText(/^Profil Waghalsig – Spielt auf Angriff/)).toBeInTheDocument()
    await waitFor(() => expect(startButton()).toBeEnabled())
    await user.click(startButton())
    act(() => engine.worker().boot())
    expect(engine.worker().matchStarts()[0]?.match.ai.profile).toBe("Reckless")
    expect(await screen.findByText("Waghalsig")).toBeInTheDocument()
  })

  it("changes the profile in a dialog, saved at once - no step before the start", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    renderAt("/play", testEngine())
    expect(await screen.findByText(/^Profil Standard – Forges Vorgabe/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "KI-Profil ändern" }))
    const dialog = await screen.findByRole("dialog", { name: "KI-Profil wählen" })
    await waitFor(() => expect(within(dialog).getByRole("radio", { name: /Vorsichtig/ })).toBeEnabled())
    await user.click(within(dialog).getByRole("radio", { name: /Vorsichtig/ }))
    await user.click(within(dialog).getByRole("button", { name: "Fertig" }))
    expect(await screen.findByText(/^Profil Vorsichtig – Spielt zurückhaltender/)).toBeInTheDocument()
  })

  it("random: a profile is drawn for the game, and the game says it was drawn", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN], RED.id, { kind: "random" })
    const engine = testEngine()
    renderAt("/play", engine)
    expect(await screen.findByText(/^Profil Zufällig – Für jede Partie wird eines der 4 Profile neu gezogen/)).toBeInTheDocument()
    await waitFor(() => expect(startButton()).toBeEnabled())
    await user.click(startButton())
    act(() => engine.worker().boot())
    const profile = engine.worker().matchStarts()[0]?.match.ai.profile
    const drawn = AI_PROFILE_TABLE.find((info) => info.name === profile)
    expect(drawn).toBeDefined()
    expect(await screen.findByText(`${drawn!.label} (zufällig gezogen)`)).toBeInTheDocument()
  })

  it("a stored profile this version does not have: no start, and why", async () => {
    await store([RED, GREEN], RED.id, { kind: "profile", name: "Aggressive" })
    renderAt("/play", testEngine())
    expect(await screen.findByText("Profil Das gewählte Profil „Aggressive“ gibt es in dieser Version nicht mehr.")).toBeInTheDocument()
    await waitFor(() => expect(startButton()).toHaveAccessibleDescription("Das gewählte KI-Profil „Aggressive“ gibt es in dieser Version nicht mehr – wähle ein anderes."))
    expect(startButton()).toBeDisabled()
  })
})

/** A ready engine running a game up to Forge's mulligan question. */
async function runningGame(): Promise<TestEngine> {
  const engine = testEngine()
  engine.session.start()
  await settle()
  engine.worker().boot()
  const decks = { red: RED, green: GREEN }
  engine.session.startMatch({
    request: {
      seed: 1,
      format: "constructed",
      human: { name: "Spieler", deck: { name: decks.red.name, main: [{ card: "Mountain", count: 24 }, { card: "Shock", count: 36 }] } },
      ai: { name: "Forge-KI", profile: "Default", deck: { name: decks.green.name, main: [{ card: "Forest", count: 24 }, { card: "Grizzly Bears", count: 36 }] } },
    },
    human: { deckId: RED.id, deckName: RED.name },
    ai: { deckId: GREEN.id, deckName: GREEN.name, drawn: true, profileDrawn: false },
  })
  engine.worker().startGame()
  return engine
}

describe("the game page", () => {
  it("without a game: says so, and that a reload ends a running game", async () => {
    const user = userEvent.setup()
    const engine = testEngine()
    const router = renderAt("/play/game", engine)
    expect(await screen.findByText("Gerade läuft keine Partie")).toBeInTheDocument()
    expect(screen.getByText(/Eine laufende Partie endet, wenn du die Seite neu lädst oder schließt/)).toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "Zur Deckwahl" }))
    expect(router.state.location.pathname).toBe("/play")
  })

  it("a running game: the table with Forge's state and decision, conceding from the menu only after confirming, the result in one word, a fresh engine for the next game", { timeout: 20_000 }, async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    const engine = await runningGame()
    renderAt("/play/game", engine)
    const header = await screen.findByRole("region", { name: "Spielstand" })
    expect(screen.getByRole("heading", { level: 1, name: "Partie" })).toBeInTheDocument()
    expect(within(header).getByText("Vor dem ersten Zug")).toBeInTheDocument()
    expect(within(header).getByText("Du bist dran")).toBeInTheDocument()
    const opponent = screen.getByRole("region", { name: "Forge-KI" })
    expect(within(opponent).getByText("Standard")).toBeInTheDocument()
    expect(within(opponent).getByTitle("Lebenspunkte")).toHaveTextContent("20")
    expect(within(opponent).getByRole("list", { name: "Hand der Forge-KI: 7 Karten" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Du" })).getByTitle("Lebenspunkte")).toHaveTextContent("20")
    // Forge's cards by Forge's names (no card data on this device).
    const hand = screen.getByRole("list", { name: "Deine Hand: 7 Karten" })
    expect(within(hand).getAllByText("Mountain")).toHaveLength(4)
    expect(within(hand).getAllByText("Shock")).toHaveLength(3)
    const decision = screen.getByRole("region", { name: "Entscheidung" })
    // Forge's own words (Testing Library collapses its double space).
    expect(within(decision).getByText(MULLIGAN_PROMPT.replace(/\s+/g, " "))).toBeInTheDocument()
    expect(within(within(decision).getByLabelText("Antworten, die Forge anbietet")).getAllByText(/./).map((b) => b.textContent)).toEqual(["Behalten", "Mulligan"])

    // Leaving the page asks first while the game runs.
    const leave = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(leave)
    expect(leave.defaultPrevented).toBe(true)

    // The menu: the game, Forge's notices, the way around the app (the game keeps running), conceding.
    await user.click(within(header).getByRole("button", { name: "Menü" }))
    let menu = await screen.findByRole("dialog", { name: "Partie" })
    expect(within(menu).getByText("Die Partie läuft weiter, wenn du eine andere Seite öffnest. Neu laden oder Schließen beendet sie.")).toBeInTheDocument()
    expect(within(menu).getByText("Grün (zufällig gezogen)")).toBeInTheDocument()
    expect(within(menu).getByText("In dieser Partie hat Forge noch nichts gemeldet.")).toBeInTheDocument()
    expect(within(within(menu).getByRole("navigation", { name: "OpenMana" })).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(DESTINATIONS.map((d) => d.path))

    // Conceding needs a second, explicit step; "Weiterspielen" sends nothing.
    await user.click(within(menu).getByRole("button", { name: "Aufgeben" }))
    let dialog = await screen.findByRole("alertdialog", { name: "Partie aufgeben?" })
    expect(within(dialog).getByText("Die Forge-KI gewinnt die Partie. Das lässt sich nicht rückgängig machen.")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Weiterspielen" }))
    expect(engine.worker().inputs()).toEqual([])
    await user.click(within(screen.getByRole("region", { name: "Spielstand" })).getByRole("button", { name: "Menü" }))
    menu = await screen.findByRole("dialog", { name: "Partie" })
    await user.click(within(menu).getByRole("button", { name: "Aufgeben" }))
    dialog = await screen.findByRole("alertdialog", { name: "Partie aufgeben?" })
    await user.click(within(dialog).getByRole("button", { name: "Aufgeben" }))
    expect(engine.worker().inputs()).toEqual([{ type: "concede", seq: 1 }])
    expect(await within(screen.getByRole("region", { name: "Spielstand" })).findByText("Gibt auf …")).toBeInTheDocument()

    act(() => engine.worker().concedeAccepted())
    expect(await screen.findByRole("heading", { level: 2, name: "Verloren" })).toBeInTheDocument()
    const result = screen.getByRole("region", { name: "Verloren" })
    expect(within(result).getByText("Du hast aufgegeben.")).toBeInTheDocument()
    expect(within(result).getByText("Du (Rot)")).toBeInTheDocument()
    expect(within(result).getByText("Forge-KI (Grün)")).toBeInTheDocument()
    expect(within(result).getByText(/^0 Züge · /)).toBeInTheDocument()
    const after = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)

    // The finished game's engine is spent: the next one is prewarmed while the result shows.
    expect(engine.workers[0]!.terminated).toBe(true)
    await waitFor(() => expect(engine.workers).toHaveLength(2))
    await user.click(within(result).getByRole("button", { name: "Neue Partie" }))
    expect(await screen.findByRole("region", { name: "Partie wird vorbereitet" })).toBeInTheDocument()
    act(() => engine.worker().boot())
    expect(engine.worker().matchStarts()).toHaveLength(1)
    expect(engine.workers).toHaveLength(2)
  })

  it("a refused start: Forge's report, the deck to fix, and the same engine for the next try", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    const engine = testEngine()
    engine.session.start()
    await settle()
    engine.worker().boot()
    const router = renderAt("/play", engine)
    await screen.findByText(/^Rot – Constructed/)
    await user.click(startButton())
    act(() =>
      engine.worker().send({
        type: "engine.error",
        code: "deck-rejected",
        message: "Forge does not know 2 card(s) of deck 'Rot': [\"Nope\", \"Nada\"]",
        report: { deck: "Rot", unknownCards: ["Nope", "Nada"] },
      }),
    )
    const refused = await screen.findByRole("region", { name: "Die Partie hat nicht begonnen" })
    expect(within(refused).getByText("Forge kann ein Deck so nicht spielen")).toBeInTheDocument()
    expect(within(refused).getByText("Forge kennt 2 Karten aus „Rot“ nicht: Nope, Nada.")).toBeInTheDocument()
    expect(within(refused).getByText("Forge does not know 2 card(s) of deck 'Rot': [\"Nope\", \"Nada\"]")).toBeInTheDocument()
    expect(within(refused).getByRole("link", { name: "Deck ansehen" })).toHaveAttribute("href", `/decks/${RED.id}`)
    await user.click(within(refused).getByRole("link", { name: "Zur Deckwahl" }))
    expect(router.state.location.pathname).toBe("/play")
    expect(await screen.findAllByText("Forge ist bereit.")).not.toHaveLength(0)
    await user.click(startButton())
    expect(engine.workers).toHaveLength(1)
    expect(engine.worker().matchStarts()).toHaveLength(2)
  })

  it("a technical abort during the game: why, no result, a new game on a fresh engine", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    const engine = await runningGame()
    renderAt("/play/game", engine)
    await screen.findByRole("region", { name: "Deine Hand" })
    act(() => engine.worker().crash("Uncaught RuntimeError: unreachable"))
    const aborted = await screen.findByRole("region", { name: "Partie abgebrochen" })
    expect(within(aborted).getByText("Der Engine-Worker ist abgestürzt")).toBeInTheDocument()
    expect(within(aborted).getByText("Uncaught RuntimeError: unreachable")).toBeInTheDocument()
    expect(within(aborted).getByText("Die Engine ist ausgefallen; die Partie endete ohne Ergebnis.")).toBeInTheDocument()
    expect(within(aborted).getByText("Zuletzt: Vor dem ersten Zug.")).toBeInTheDocument()
    // Also as a toast, for a player on another page.
    expect(await screen.findByText("Der Engine-Worker ist abgestürzt", { selector: "[data-title]" })).toBeInTheDocument()
    await user.click(within(aborted).getByRole("button", { name: "Neue Partie" }))
    await settle()
    expect(engine.workers).toHaveLength(2)
    expect(await screen.findByRole("region", { name: "Partie wird vorbereitet" })).toBeInTheDocument()
  })

  it("an engine that fails to boot for a game: the game could not start, never a frozen page", async () => {
    await store([RED, GREEN])
    const engine = testEngine()
    const user = userEvent.setup()
    renderAt("/play", engine)
    await screen.findByText(/^Rot – Constructed/)
    await waitFor(() => expect(engine.workers).toHaveLength(1))
    await user.click(startButton())
    act(() => engine.worker().send({ type: "engine.abort", reason: "boot-failed", origin: "engine", message: "the Wasm module could not be instantiated: CompileError", stage: "instantiate" }))
    const failed = await screen.findByRole("region", { name: "Die Partie konnte nicht starten" })
    expect(within(failed).getByText("Die Engine konnte nicht starten")).toBeInTheDocument()
    expect(within(failed).getByText("Die Engine ist ausgefallen, bevor die Partie begann.")).toBeInTheDocument()
    // Trying again fails the same way: its toast replaces the last one instead of stacking behind it.
    await user.click(within(failed).getByRole("button", { name: "Neue Partie" }))
    await waitFor(() => expect(engine.workers).toHaveLength(2))
    act(() => engine.worker().send({ type: "engine.abort", reason: "boot-failed", origin: "engine", message: "the Wasm module could not be instantiated: CompileError", stage: "instantiate" }))
    expect(await screen.findByRole("region", { name: "Die Partie konnte nicht starten" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText("Die Engine konnte nicht starten", { selector: "[data-title]" })).toHaveLength(1))
  })

  it("a silent engine: the warning, and ending the game without a result after confirming", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    const engine = await runningGame()
    engine.session.concede()
    renderAt("/play/game", engine)
    await screen.findByRole("region", { name: "Deine Hand" })
    act(() => engine.timers.advance(30_000))
    expect(await screen.findByText("Die Engine reagiert seit 30,0 s nicht")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Partie beenden" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Partie ohne Ergebnis beenden?" })
    await user.click(within(dialog).getByRole("button", { name: "Partie beenden" }))
    const aborted = await screen.findByRole("region", { name: "Partie abgebrochen" })
    expect(within(aborted).getByText("Die Engine wurde beendet")).toBeInTheDocument()
    expect(engine.worker().terminated).toBe(true)
  })

  it("waiting for the engine can be cancelled; the engine keeps loading", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    const engine = testEngine()
    const router = renderAt("/play", engine)
    await screen.findByText(/^Rot – Constructed/)
    await user.click(startButton())
    const waiting = await screen.findByRole("region", { name: "Partie wird vorbereitet" })
    await user.click(within(waiting).getByRole("button", { name: "Abbrechen" }))
    expect(router.state.location.pathname).toBe("/play")
    expect(engine.session.getSnapshot()).toMatchObject({ engine: { status: "booting" }, match: null })
  })

  it("Forge's notices during a game: a toast at the top as they come, all of them in the menu", async () => {
    const user = userEvent.setup()
    await store([RED, GREEN])
    const engine = await runningGame()
    renderAt("/play/game", engine)
    await screen.findByRole("region", { name: "Deine Hand" })
    act(() => engine.worker().send({ type: "message", kind: "notice", title: "Forge-KI", text: "Forge-KI zeigt dir eine Karte." }))
    const toast = await screen.findByText("Forge-KI: Forge-KI zeigt dir eine Karte.", { selector: "[data-title]" })
    expect(toast.closest("[data-sonner-toast]")).toHaveAttribute("data-y-position", "top")
    act(() => engine.worker().send({ type: "message", kind: "error", text: "Die Karte kann so nicht gespielt werden." }))
    expect(await screen.findByText("Die Karte kann so nicht gespielt werden.", { selector: "[data-title]" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Menü, 2 Meldungen von Forge" }))
    const menu = await screen.findByRole("dialog", { name: "Partie" })
    const notices = within(within(menu).getByRole("region", { name: "Meldungen von Forge" })).getAllByRole("listitem")
    expect(notices.map((item) => item.textContent)).toEqual(["Forge-KI: Forge-KI zeigt dir eine Karte.", "Die Karte kann so nicht gespielt werden."])
    expect(notices[1]).toHaveClass("text-destructive")
  })

  it("on a phone the next game's button stays in the action bar", async () => {
    window.innerWidth = 400
    await store([RED, GREEN])
    const engine = await runningGame()
    engine.session.concede()
    engine.worker().concedeAccepted()
    renderAt("/play/game", engine)
    const bar = await screen.findByRole("region", { name: "Neue Partie" })
    expect(within(bar).getByRole("button", { name: "Neue Partie" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Verloren" })).queryByRole("button", { name: "Neue Partie" })).not.toBeInTheDocument()
  })
})
