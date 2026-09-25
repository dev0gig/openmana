/*
 * Settings (prompt 12): the preferences are chosen here once - the AI
 * profile (Forge's verified profiles, "Zufällig", no difficulty claims), the
 * card language, less motion - and saved at once; the diagnostics report
 * shows every version and can be copied; a damaged stored preference is
 * named. The whole app frame is rendered (router, local database, engine
 * session, preferences), with fake-indexeddb.
 */
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, describe, expect, it } from "vitest"
import { routes } from "@/app/router"
import { MOTION, REDUCED_MOTION_ATTRIBUTE } from "@/app/motion"
import { CARD_LANGUAGE } from "@/cards/card-language"
import { AI_PROFILE } from "@/game/ai-profiles"
import { readSetting, type SettingDefinition } from "@/storage/settings"
import { openTestDatabase, putRaw, setting } from "@/test/storage-fixtures"

afterEach(() => {
  document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE)
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

async function stored<T>(definition: SettingDefinition<T>): Promise<T | undefined> {
  const db = await openTestDatabase()
  try {
    const value = await readSetting(db, definition)
    return value.stored ? value.value : undefined
  } finally {
    db.close()
  }
}

const radio = (group: string, name: RegExp) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name })

describe("settings: the AI profile", () => {
  it("offers Forge's four verified profiles and random, the default chosen, and says there are no difficulty levels", async () => {
    renderAt("/settings")
    await waitFor(() => expect(radio("KI-Profil", /Standard \(Vorgabe\)/)).toBeEnabled())
    const group = screen.getByRole("radiogroup", { name: "KI-Profil" })
    expect(within(group).getAllByRole("radio").map((r) => r.getAttribute("aria-labelledby") && document.getElementById(r.getAttribute("aria-labelledby")!)?.textContent)).toEqual([
      "Standard (Vorgabe)",
      "Vorsichtig",
      "Waghalsig",
      "Experimentell",
      "Zufällig",
    ])
    expect(radio("KI-Profil", /Standard/)).toBeChecked()
    // Described by how it plays, never by a difficulty.
    expect(radio("KI-Profil", /Waghalsig/)).toHaveAccessibleDescription(/Spielt auf Angriff/)
    expect(screen.getByText(/Forge kennt keine Schwierigkeitsstufen/)).toBeInTheDocument()
    expect(screen.getByText(/In 2 400 Testpartien KI gegen KI gewann keines messbar öfter oder seltener/)).toBeInTheDocument()
  })

  it("saves a choice at once and keeps it", async () => {
    renderAt("/settings")
    await waitFor(() => expect(radio("KI-Profil", /Waghalsig/)).toBeEnabled())
    await userEvent.click(radio("KI-Profil", /Waghalsig/))
    await waitFor(async () => expect(await stored(AI_PROFILE)).toEqual({ kind: "profile", name: "Reckless" }))
    await waitFor(() => expect(radio("KI-Profil", /Waghalsig/)).toBeChecked())
    await userEvent.click(radio("KI-Profil", /Zufällig/))
    await waitFor(async () => expect(await stored(AI_PROFILE)).toEqual({ kind: "random" }))
  })

  it("names a stored profile this version does not have, and chooses none", async () => {
    ;(await openTestDatabase()).close()
    await putRaw("settings", setting("ai.profile", { kind: "profile", name: "Aggressive" }))
    renderAt("/settings")
    expect(await screen.findByText("Das gewählte KI-Profil gibt es nicht mehr")).toBeInTheDocument()
    expect(within(screen.getByRole("radiogroup", { name: "KI-Profil" })).getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(0)
  })
})

describe("settings: the card language", () => {
  it("German by default; English is saved at once", async () => {
    renderAt("/settings")
    await waitFor(() => expect(radio("Kartensprache", /Englisch/)).toBeEnabled())
    expect(radio("Kartensprache", /Deutsch \(Vorgabe\)/)).toBeChecked()
    expect(radio("Kartensprache", /Englisch/)).toHaveAccessibleDescription(/seine eigenen Sätze bleiben deutsch/)
    await userEvent.click(radio("Kartensprache", /Englisch/))
    await waitFor(async () => expect(await stored(CARD_LANGUAGE)).toBe("en"))
  })
})

describe("settings: less motion", () => {
  it("the switch reduces motion app-wide at once and is saved", async () => {
    renderAt("/settings")
    const toggle = await screen.findByRole("switch", { name: "Bewegungen reduzieren" })
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).not.toBeChecked()
    expect(document.documentElement.hasAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe(false)
    await userEvent.click(toggle)
    await waitFor(() => expect(document.documentElement.hasAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe(true))
    expect(await stored(MOTION)).toBe("reduce")
    await userEvent.click(toggle)
    await waitFor(() => expect(document.documentElement.hasAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe(false))
    expect(await stored(MOTION)).toBe("system")
  })

  it("a damaged stored preference is named; its default applies", async () => {
    ;(await openTestDatabase()).close()
    await putRaw("settings", setting("display.motion", "always"))
    renderAt("/settings")
    expect(await screen.findByText("Eine gespeicherte Einstellung war ungültig")).toBeInTheDocument()
    expect(screen.getByText(/Bewegungen reduzieren: Es gilt die Vorgabe/)).toBeInTheDocument()
  })
})

describe("settings: this version", () => {
  it("names Forge's version and shows the diagnostics report to copy", async () => {
    const user = userEvent.setup()
    renderAt("/settings")
    expect(await screen.findByText("Forge-Version")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Diagnose anzeigen" }))
    const dialog = await screen.findByRole("dialog", { name: "Diagnose" })
    const text = within(dialog).getByRole("textbox", { name: "Diagnose" })
    expect((text as HTMLTextAreaElement).value).toMatch(/^OpenMana – Diagnose\n/)
    expect((text as HTMLTextAreaElement).value).toContain("[Forge-Engine dieser Version]\nKennung: 0123456789abcdef")
    expect((text as HTMLTextAreaElement).value).toContain("KI-Profil: Standard (Default)")
    expect(text).toHaveAttribute("readonly")
    await user.click(within(dialog).getByRole("button", { name: "Kopieren" }))
    expect(await navigator.clipboard.readText()).toBe((text as HTMLTextAreaElement).value)
    expect(await screen.findByText("Diagnose kopiert")).toBeInTheDocument()
  })
})
