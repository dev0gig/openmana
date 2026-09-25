import type { EngineClientListener } from "@openmana/engine-client"
import { checkEngineMessage, type EngineMessage, type FeatureReport } from "@openmana/engine-protocol"
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router"
import { describe, expect, it } from "vitest"
import { EnginePanel } from "@/engine/engine-panel"
import { EngineSession, type SessionClient } from "@/engine/engine-session"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { ENGINE_ASSETS } from "@/test/virtual-engine"
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
    for (const name of ["Forge – die Card-Forge-Community", "ManaBrew", "OpenAI ChatGPT", "Anthropic Claude", "Oracle GraalVM Web Image"]) {
      expect(await screen.findByText(name)).toBeInTheDocument()
    }
    expect(screen.getByText(/noch nicht abschließend geklärt/)).toBeInTheDocument()
  })
})

// ── The engine panel, driven by a session with a fake client ────────────────

class FakeClient implements SessionClient {
  readonly listeners = new Set<EngineClientListener>()
  start(): void {}
  subscribe(listener: EngineClientListener): () => boolean {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  dispose(): void {}
  emit(message: EngineMessage): void {
    const checked = checkEngineMessage(message)
    act(() => {
      for (const listener of Array.from(this.listeners)) listener({ kind: "message", message: checked })
    })
  }
}

const SUPPORTED: FeatureReport = {
  webAssembly: true,
  wasmGc: true,
  wasmExnref: true,
  wasmTypedFunctionReferences: true,
  crossOriginIsolated: true,
  sharedArrayBuffer: true,
  atomicsWait: true,
  worker: true,
  missing: [],
  supported: true,
}

function renderPanel(features: FeatureReport = SUPPORTED) {
  const clients: FakeClient[] = []
  const session = new EngineSession({
    assets: ENGINE_ASSETS,
    detectFeatures: () => features,
    loadClient: async () => () => {
      const client = new FakeClient()
      clients.push(client)
      return client
    },
    baseUrl: "https://openmana.test/",
  })
  render(
    <EngineSessionProvider session={session}>
      <EnginePanel />
    </EngineSessionProvider>,
  )
  return { session, clients }
}

describe("engine panel", () => {
  it("loads the engine on request and shows what the engine reports", async () => {
    const { clients } = renderPanel()
    expect(screen.getByText("Nicht geladen")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Engine laden" }))
    expect(screen.getByText("Lädt")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Startschritte der Engine" })).toBeInTheDocument()
    const client = clients[0]!
    client.emit({ type: "engine.boot", phase: "wasm-fetch-compile", t: 5 })
    expect(screen.getByText("Engine herunterladen und übersetzen").closest("li")).toHaveAttribute("data-state", "active")
    client.emit({
      type: "engine.ready",
      protocol: 3,
      engine: {
        forgeVersion: "2.0.07-SNAPSHOT",
        forgeCommit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798",
        forgeVersionCode: "2.0.07",
        patchCount: 6,
        patchesSha256: "d434f05792db3addec2bcc386318a7cdb5e0e3f4f1394d5490a73d28d3238ad7",
        openmanaCommit: "0ddfbc3000000000000000000000000000000000",
        engineSourcesModified: false,
        synchronous: true,
        resourcesSha256: "7e8aebee24e13111188a163cd5f7162ded2411728a85c6abc9ac2f5d5a0e6053",
      },
      boot: { resourceFiles: 36905, resourceBytes: 44327452, unpackMillis: 900, forgeInitMillis: 2000, cardLoading: "eager", language: "en-US" },
      t: 4000,
    })
    expect(screen.getByText("Bereit")).toBeInTheDocument()
    expect(screen.getByText("2.0.07 (ed0333fecb)")).toBeInTheDocument()
    expect(screen.getByText("Version 3")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Engine beenden" }))
    expect(screen.getByText("Nicht geladen")).toBeInTheDocument()
  })

  it("explains an abort and offers another try", async () => {
    const { clients } = renderPanel()
    await userEvent.click(screen.getByRole("button", { name: "Engine laden" }))
    clients[0]!.emit({ type: "engine.abort", reason: "boot-failed", origin: "engine", message: "java.lang.OutOfMemoryError", stage: "java-main" })
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
