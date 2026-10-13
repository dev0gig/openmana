/*
 * The opponent's tempo in Settings and the table's menu (prompt 49): each
 * choice saved at once into the local database and read back.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { PreferencesProvider, usePreferences } from "@/app/preferences"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { readSetting } from "@/storage/settings"
import { StorageProvider } from "@/storage/storage-context"
import { testEngine } from "@/test/game-fixtures"
import { openTestDatabase } from "@/test/storage-fixtures"
import { AUTO_PASS, OPPONENT_STEPWISE, OPPONENT_TEMPO } from "./opponent-tempo"
import { AutoPassOptions, OpponentTempoOptions } from "./opponent-tempo-options"

function Shown() {
  const { opponentTempo, opponentStepwise, autoPass } = usePreferences()
  return <p>Gewählt: {`${opponentTempo}/${String(opponentStepwise)}/${autoPass}`}</p>
}

describe("OpponentTempoOptions and AutoPassOptions", () => {
  it("save each choice at once; the preferences follow", async () => {
    const user = userEvent.setup()
    const engine = testEngine()
    render(
      <StorageProvider>
        <EngineSessionProvider session={engine.session}>
          <PreferencesProvider>
            <OpponentTempoOptions />
            <AutoPassOptions />
            <Shown />
          </PreferencesProvider>
        </EngineSessionProvider>
      </StorageProvider>,
    )
    expect(await screen.findByText("Gewählt: normal/false/noActions")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("radio", { name: "Langsam" })).toBeEnabled())
    expect(screen.getByRole("radio", { name: "Normal (Vorgabe)" })).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("radio", { name: "Langsam" }))
    expect(await screen.findByText("Gewählt: slow/false/noActions")).toBeInTheDocument()
    await user.click(screen.getByRole("switch", { name: "Nach jeder Gegneraktion warten" }))
    expect(await screen.findByText("Gewählt: slow/true/noActions")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Immer fragen" }))
    expect(await screen.findByText("Gewählt: slow/true/never")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Normal (Vorgabe)" }))
    expect(await screen.findByText("Gewählt: normal/true/never")).toBeInTheDocument()
    const db = await openTestDatabase()
    expect((await readSetting(db, OPPONENT_TEMPO)).value).toBe("normal")
    expect((await readSetting(db, OPPONENT_STEPWISE)).value).toBe(true)
    expect((await readSetting(db, AUTO_PASS)).value).toBe("never")
    db.close()
  })
})
