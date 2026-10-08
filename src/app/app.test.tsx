import { PROTOCOL_VERSION, type FeatureReport } from "@openmana/engine-protocol"
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { EnginePanel } from "@/engine/engine-panel"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { READY, settle, SUPPORTED, testEngine } from "@/test/game-fixtures"
import { DESTINATIONS, MAIN_DESTINATIONS } from "./navigation"
import { routes } from "./router"

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const TITLES: Record<string, string> = {
  "/": "OpenMana",
  "/decks": "Decks",
  "/play": "Spielen",
  "/matches": "Partien",
  "/settings": "Einstellungen",
  "/credits": "Credits",
}

describe("surfaces", () => {
  it.each(["/", "/?launcher=oryx"])("%s offers the explicit ORYX return on Start", async (path) => {
    const assign = vi.fn()
    const router = renderAt(path)
    const button = await screen.findByRole("button", { name: "Zurück zu ORYX" })
    vi.stubGlobal("location", { assign })
    try {
      await userEvent.click(button)
      expect(assign).toHaveBeenCalledExactlyOnceWith("https://oryx.quest/")
      // External navigation is delegated to the browser; no internal route or cloud action.
      expect(router.state.location.pathname).toBe("/")
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each(DESTINATIONS.map((d) => d.path))("%s renders inside the app frame", async (path) => {
    renderAt(path)
    expect(await screen.findByRole("heading", { level: 1, name: TITLES[path] ?? path })).toBeInTheDocument()
    // Phone tab bar: the four surfaces of the repeated path.
    const tabBar = screen.getByRole("navigation", { name: "Hauptnavigation" })
    expect(within(tabBar).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(MAIN_DESTINATIONS.map((d) => d.path))
  })

  it("marks the current surface in the tab bar", async () => {
    renderAt("/decks")
    const tabBar = await screen.findByRole("navigation", { name: "Hauptnavigation" })
    expect(within(tabBar).getByRole("link", { name: "Decks" })).toHaveAttribute("aria-current", "page")
    expect(within(tabBar).getByRole("link", { name: "Start" })).not.toHaveAttribute("aria-current")
  })

  it("navigates between surfaces", async () => {
    const router = renderAt("/")
    await userEvent.click(within(screen.getByRole("navigation", { name: "Hauptnavigation" })).getByRole("link", { name: "Partien" }))
    expect(router.state.location.pathname).toBe("/matches")
    expect(await screen.findByRole("heading", { level: 1, name: "Partien" })).toBeInTheDocument()
  })

  it("reaches settings from the top bar and credits from settings", async () => {
    const router = renderAt("/")
    await userEvent.click(screen.getAllByRole("link", { name: "Einstellungen" })[0]!)
    expect(router.state.location.pathname).toBe("/settings")
    await userEvent.click(await screen.findByRole("link", { name: "Credits und Lizenzen" }))
    expect(router.state.location.pathname).toBe("/credits")
  })

  it("shows unknown paths as not found inside the frame", async () => {
    renderAt("/does-not-exist")
    expect(await screen.findByRole("heading", { level: 1, name: "Nicht gefunden" })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Hauptnavigation" })).toBeInTheDocument()
  })
})

describe("no invented data", () => {
  it("decks: empty library, the way to import a deck", async () => {
    renderAt("/decks")
    expect(await screen.findByText("Noch keine Decks")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Arena-Deck importieren/ })).toHaveAttribute("href", "/decks/import")
  })

  it("matches: no recorded games", async () => {
    renderAt("/matches")
    expect(await screen.findByText("Noch keine Partien")).toBeInTheDocument()
  })

  it("play: a game cannot start without a deck", async () => {
    renderAt("/play")
    expect(await screen.findByRole("button", { name: /Partie starten/ })).toBeDisabled()
    expect(await screen.findByText("Noch kein Deck auf diesem Gerät.")).toBeInTheDocument()
  })

  it("credits: separates software, reference and AI assistance", async () => {
    renderAt("/credits")
    for (const name of ["Forge – die Card-Forge-Community", "ManaBrew", "OpenAI ChatGPT und Codex", "Anthropic Claude", "Oracle GraalVM Web Image"]) {
      expect(await screen.findByText(name)).toBeInTheDocument()
    }
    expect(screen.getByText(/noch nicht abschließend juristisch geklärt/)).toBeInTheDocument()
    expect(screen.getByText(/mit ChatGPT \(OpenAI\) erzeugt/)).toBeInTheDocument()
    expect(screen.queryByText(/Patri[c]k/)).toBeNull()
  })

  it("credits: links the public source of this very build", async () => {
    renderAt("/credits")
    const link = await screen.findByRole("link", { name: "Quelltext dieser Version auf GitHub" })
    expect(link.getAttribute("href")).toMatch(/^https:\/\/github\.com\/dev0gig\/openmana(\/tree\/[0-9a-f]{40})?$/)
    expect(screen.getByText(/Der komplette Quelltext ist öffentlich/)).toBeInTheDocument()
  })
})

// ── The engine panel, driven by the real client over a scripted worker ─────

function renderPanel(features: FeatureReport = SUPPORTED) {
  const engine = testEngine({ features })
  render(
    <EngineSessionProvider session={engine.session}>
      <EnginePanel />
    </EngineSessionProvider>,
  )
  return engine
}

describe("engine panel", () => {
  it("loads the engine on request and shows what the engine reports", async () => {
    const engine = renderPanel()
    expect(screen.getByText("Nicht geladen")).toBeInTheDocument()
    expect(screen.getByText(/lädt „Spielen“ die Engine von selbst vor/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Engine laden" }))
    expect(screen.getByText("Lädt")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Startschritte der Engine" })).toBeInTheDocument()
    await settle()
    const worker = engine.worker()
    act(() => worker.send({ type: "engine.boot", phase: "wasm-fetch-compile", t: 5 }))
    expect(screen.getByText("Engine herunterladen und übersetzen").closest("li")).toHaveAttribute("data-state", "active")
    act(() => worker.send(READY))
    expect(screen.getByText("Bereit")).toBeInTheDocument()
    expect(screen.getByText("2.0.15 (ed0333fecb)")).toBeInTheDocument()
    expect(screen.getByText(`Version ${PROTOCOL_VERSION}`)).toBeInTheDocument()
    // Forge's own words and the cards in them (prompt 12: the card language), and the AI profiles Forge loaded.
    expect(screen.getAllByText("Deutsch")).toHaveLength(2)
    expect(screen.getByText("Karten in Forges Texten")).toBeInTheDocument()
    expect(screen.getByText("Vorsichtig, Standard, Experimentell, Waghalsig")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Engine beenden" }))
    expect(screen.getByText("Nicht geladen")).toBeInTheDocument()
    expect(worker.terminated).toBe(true)
  })

  it("explains an abort and offers another try", async () => {
    const engine = renderPanel()
    await userEvent.click(screen.getByRole("button", { name: "Engine laden" }))
    await settle()
    act(() => engine.worker().send({ type: "engine.abort", reason: "boot-failed", origin: "engine", message: "java.lang.OutOfMemoryError", stage: "java-main" }))
    expect(screen.getByText("Abgebrochen")).toBeInTheDocument()
    expect(screen.getByText("Die Engine konnte nicht starten")).toBeInTheDocument()
    expect(screen.getByText("java.lang.OutOfMemoryError")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeEnabled()
  })

  it("does not offer to load the engine in an unsupported browser", () => {
    renderPanel({ ...SUPPORTED, crossOriginIsolated: false, missing: ["Cross-Origin-Isolation (COOP/COEP-Header)"], supported: false })
    expect(screen.getByText("Nicht unterstützt")).toBeInTheDocument()
    expect(screen.getByText(/Es fehlt: Cross-Origin-Isolation/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Engine laden" })).not.toBeInTheDocument()
  })
})
