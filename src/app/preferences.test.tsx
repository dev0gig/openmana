/*
 * The player's preferences (prompt 12): read from the local database, kept
 * current after a change, applied app-wide (less motion on <html>, the card
 * language for the engine's next boot), a damaged stored value named and
 * replaced by the default - and the defaults outside the provider.
 */
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { CARD_LANGUAGE } from "@/cards/card-language"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { AI_PROFILE } from "@/game/ai-profiles"
import { writeSetting } from "@/storage/settings"
import { StorageProvider } from "@/storage/storage-context"
import { useSaveSetting } from "@/storage/use-save-setting"
import { settle, testEngine, type TestEngine } from "@/test/game-fixtures"
import { openTestDatabase, putRaw, setting } from "@/test/storage-fixtures"
import { MOTION, REDUCED_MOTION_ATTRIBUTE } from "./motion"
import { PreferencesProvider, usePreferences } from "./preferences"

afterEach(() => {
  document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE)
})

function Values() {
  const preferences = usePreferences()
  return (
    <div>
      <p>Status: {preferences.status}</p>
      <p>Profil: {preferences.aiProfile.kind === "random" ? "zufällig" : preferences.aiProfile.name}</p>
      <p>Karten: {preferences.cardLanguage}</p>
      <p>Bewegung: {preferences.motion}</p>
      <p>Ungültig: {preferences.invalid.join(",") || "–"}</p>
    </div>
  )
}

function Probe() {
  const save = useSaveSetting()
  return (
    <>
      <Values />
      <button type="button" onClick={() => void save(CARD_LANGUAGE, "de")}>
        Deutsch
      </button>
    </>
  )
}

function renderProbe(engine: TestEngine) {
  render(
    <StorageProvider>
      <EngineSessionProvider session={engine.session}>
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>
      </EngineSessionProvider>
    </StorageProvider>,
  )
}

describe("PreferencesProvider", () => {
  it("reads the stored preferences and applies them: less motion on <html>, the card language for the engine", async () => {
    const db = await openTestDatabase()
    await writeSetting(db, AI_PROFILE, { kind: "random" })
    await writeSetting(db, CARD_LANGUAGE, "en")
    await writeSetting(db, MOTION, "reduce")
    db.close()
    const engine = testEngine()
    renderProbe(engine)
    expect(await screen.findByText("Status: ready")).toBeInTheDocument()
    expect(screen.getByText("Profil: zufällig")).toBeInTheDocument()
    expect(screen.getByText("Karten: en")).toBeInTheDocument()
    expect(screen.getByText("Bewegung: reduce")).toBeInTheDocument()
    // Applied by effects right after the values show - waited for, not assumed:
    // under load the check ran before React's passive effects (5 of 24 loaded runs, 2026-09-26).
    await waitFor(() => expect(document.documentElement.hasAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe(true))
    await waitFor(() => expect(engine.session.bootOptions).toEqual({ cardLanguage: "en-US" }))

    // A change is read again and applied at once.
    await userEvent.click(screen.getByRole("button", { name: "Deutsch" }))
    expect(await screen.findByText("Karten: de")).toBeInTheDocument()
    await waitFor(() => expect(engine.session.bootOptions).toEqual({ cardLanguage: "de-DE" }))
  })

  it("replaces an engine prewarmed before the preferences were read, if they differ", async () => {
    const db = await openTestDatabase()
    await writeSetting(db, CARD_LANGUAGE, "en")
    db.close()
    const engine = testEngine()
    engine.session.prewarm()
    await settle()
    expect(engine.workers).toHaveLength(1)
    renderProbe(engine)
    expect(await screen.findByText("Karten: en")).toBeInTheDocument()
    await act(settle)
    await waitFor(() => expect(engine.workers).toHaveLength(2))
    expect(engine.workers[0]!.terminated).toBe(true)
    const start = engine.worker().commands.find((command) => command.type === "engine.start")
    expect(start?.type === "engine.start" && start.args).toContain("--card-language=en-US")
  })

  it("names a damaged stored value and uses the default; the device decides motion by default", async () => {
    ;(await openTestDatabase()).close()
    await putRaw("settings", setting("display.cardLanguage", "fr"), setting("ai.profile", "Reckless"))
    const engine = testEngine()
    renderProbe(engine)
    expect(await screen.findByText("Status: ready")).toBeInTheDocument()
    expect(screen.getByText("Karten: de")).toBeInTheDocument()
    expect(screen.getByText("Profil: Default")).toBeInTheDocument()
    expect(screen.getByText("Ungültig: ai.profile,display.cardLanguage")).toBeInTheDocument()
    expect(screen.getByText("Bewegung: system")).toBeInTheDocument()
    expect(document.documentElement.hasAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe(false)
    expect(engine.session.bootOptions).toEqual({ cardLanguage: "de-DE" })
  })

  it("outside the provider every preference is its default", () => {
    render(<Values />)
    expect(screen.getByText("Status: ready")).toBeInTheDocument()
    expect(screen.getByText("Profil: Default")).toBeInTheDocument()
    expect(screen.getByText("Karten: de")).toBeInTheDocument()
    expect(screen.getByText("Bewegung: system")).toBeInTheDocument()
  })
})
