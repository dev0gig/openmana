import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { settle, SUPPORTED, testEngine, testSetup } from "@/test/game-fixtures"
import { PwaCard } from "./pwa-card"
import * as lifecycle from "./lifecycle"

const ready = { status: "ready", offlineEngine: false, downloading: false, updateWaiting: false, installAvailable: false, error: null } as const
describe("PWA lifecycle controls", () => {
  it("does not promise offline play merely because an unsupported browser still has cached bytes", () => {
    vi.spyOn(lifecycle, "getPwaSnapshot").mockReturnValue({ ...ready, offlineEngine: true })
    const engine = testEngine({ features: { ...SUPPORTED, wasmGc: false, supported: false, missing: ["WebAssembly Garbage Collection"] } })
    render(<EngineSessionProvider session={engine.session}><PwaCard /></EngineSessionProvider>)
    expect(screen.getByText(/App und Forge sind gespeichert, aber die Engine/)).toBeInTheDocument()
    expect(screen.queryByText(/kannst du ohne Netz spielen/)).not.toBeInTheDocument()
  })
  it("leaves a running real session question untouched and disables its extra download", async () => {
    vi.spyOn(lifecycle, "getPwaSnapshot").mockReturnValue(ready)
    const engine = testEngine()
    engine.session.start()
    await settle()
    engine.worker().boot()
    engine.session.startMatch(testSetup())
    engine.worker().startGame()
    const before = engine.session.getSnapshot()
    render(<EngineSessionProvider session={engine.session}><PwaCard /></EngineSessionProvider>)
    expect(screen.getByRole("button", { name: /Forge für offline laden/ })).toBeDisabled()
    expect(screen.getByText(/Eine Partie läuft/)).toBeInTheDocument()
    expect(engine.session.getSnapshot()).toBe(before)
    expect(screen.getByText(/Verwerfen im Hintergrund/)).toBeInTheDocument()
    expect(screen.getByText(/keine Fortsetzung/)).toBeInTheDocument()
  })
  it("requests persistence only after the player asks and distinguishes refusal", async () => {
    const persist = vi.spyOn(lifecycle, "requestPersistentStorage").mockResolvedValue(false)
    render(<EngineSessionProvider><PwaCard /></EngineSessionProvider>)
    expect(persist).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Dauerhaften Speicher anfragen" }))
    expect(await screen.findByRole("status")).toHaveTextContent("abgelehnt")
    expect(persist).toHaveBeenCalledTimes(1)
  })
  it("explains a waiting update across all tabs without offering forced activation", () => {
    vi.spyOn(lifecycle, "getPwaSnapshot").mockReturnValue({ ...ready, updateWaiting: true })
    render(<EngineSessionProvider><PwaCard /></EngineSessionProvider>)
    expect(screen.getByText("Neue Version bereit")).toBeInTheDocument()
    expect(screen.getByText(/schließe alle OpenMana-Tabs/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Neu laden|Aktivieren/ })).not.toBeInTheDocument()
  })
})
