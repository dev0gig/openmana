/*
 * Card data as the player meets it: the settings card (what the build
 * brings, what the device holds, installing with progress and failures),
 * looking a card up (German and English, turning a double-faced card, the
 * picture loading or failing, Forge-only and unknown names) and the credits.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import { routes } from "@/app/router"
import { StorageProvider } from "@/storage/storage-context"
import { fixtureCatalogFile, installFixtureCatalog, serveFile } from "@/test/catalog-fixtures"
import { openTestDatabase } from "@/test/storage-fixtures"
import { CardCatalogProvider } from "./card-catalog-context"
import { CardDataCard } from "./card-data-card"

const file = fixtureCatalogFile()

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

async function cardDataCard() {
  const card = await screen.findByRole("region", { name: "Kartendaten" })
  await waitFor(() => expect(within(card).queryByText("Prüft")).not.toBeInTheDocument())
  return card
}

function facts(card: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    Array.from(card.querySelectorAll("dl > div")).map((row) => [row.querySelector("dt")?.textContent ?? "", row.querySelector("dd")?.textContent ?? ""]),
  )
}

async function openLookup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Karte nachschlagen" }))
  return screen.findByRole("dialog", { name: "Karte nachschlagen" })
}

describe("settings: card data", () => {
  it("says what this version brings and that nothing is installed yet", async () => {
    renderAt("/settings")
    const card = await cardDataCard()
    expect(within(card).getByText("Nicht eingerichtet")).toBeInTheDocument()
    expect(facts(card)).toMatchObject({
      "Scryfall-Stand": "24.09.2026",
      Karten: String(file.catalog.cards.length),
      "davon mit deutschem Text": String(file.assets.counts.germanText),
      "Forge-Karten ohne Scryfall-Daten": String(file.assets.forge.forgeOnly),
      "Auf diesem Gerät": "nicht eingerichtet",
    })
    expect(within(card).getByRole("button", { name: "Kartendaten einrichten" })).toBeInTheDocument()
  })

  it("installs the catalog on request, with progress, and is then ready", async () => {
    const served = serveFile(file.assets.url, file.gzip, { chunk: 2048 })
    vi.stubGlobal("fetch", served.fetch)
    const user = userEvent.setup()
    renderAt("/settings")
    const card = await cardDataCard()
    await user.click(within(card).getByRole("button", { name: "Kartendaten einrichten" }))
    expect(await screen.findByText("Kartendaten eingerichtet")).toBeInTheDocument()
    await within(card).findByText("Bereit")
    expect(facts(card)["Auf diesem Gerät"]).toMatch(/^eingerichtet am /)
    expect(served.calls).toEqual([file.assets.url])
    expect(within(card).queryByRole("button", { name: "Kartendaten einrichten" })).not.toBeInTheDocument()
  })

  it("a failed download is shown with what to do, and can be retried", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 503 })))
    const user = userEvent.setup()
    renderAt("/settings")
    const card = await cardDataCard()
    await user.click(within(card).getByRole("button", { name: "Kartendaten einrichten" }))
    expect(await within(card).findByText("Die Kartendaten ließen sich nicht herunterladen")).toBeInTheDocument()
    expect(within(card).getByText(/HTTP 503/)).toBeInTheDocument()
    expect(within(card).getByText("Unvollständig")).toBeInTheDocument()
    vi.stubGlobal("fetch", serveFile(file.assets.url, file.gzip).fetch)
    await user.click(within(card).getByRole("button", { name: "Erneut einrichten" }))
    await within(card).findByText("Bereit")
    expect(within(card).queryByText("Die Kartendaten ließen sich nicht herunterladen")).not.toBeInTheDocument()
  })

  it("a build without card data says so and offers nothing to install", async () => {
    render(
      <StorageProvider>
        <CardCatalogProvider assets={{ available: false, reason: "omitted", detail: "built with OPENMANA_CARDS=omit" }}>
          <CardDataCard />
        </CardCatalogProvider>
      </StorageProvider>,
    )
    const card = await screen.findByRole("region", { name: "Kartendaten" })
    expect(await within(card).findByText("Diese Version enthält keine Kartendaten")).toBeInTheDocument()
    expect(within(card).getByText("Nicht enthalten")).toBeInTheDocument()
    expect(within(card).queryByRole("button", { name: /einrichten/ })).not.toBeInTheDocument()
  })
})

describe("looking a card up", () => {
  async function installed() {
    const db = await openTestDatabase()
    await installFixtureCatalog(db)
    db.close()
  }

  it("before the card data is installed it says so", async () => {
    const user = userEvent.setup()
    renderAt("/settings")
    await cardDataCard()
    const dialog = await openLookup(user)
    expect(within(dialog).getByText("Die Kartendaten sind noch nicht eingerichtet")).toBeInTheDocument()
  })

  it("finds a card by its German name and shows it German, the English name below", async () => {
    await installed()
    const user = userEvent.setup()
    renderAt("/settings")
    await within(await cardDataCard()).findByText("Bereit")
    const dialog = await openLookup(user)
    await user.type(within(dialog).getByLabelText("Kartenname"), "blitz")
    const results = await within(dialog).findByRole("group", { name: "Gefundene Karten" })
    await user.click(within(results).getByRole("button", { name: "Blitzschlag" }))
    expect(within(dialog).getByText("Blitzschlag", { selector: "p" })).toBeInTheDocument()
    expect(within(dialog).getByText("Lightning Bolt")).toBeInTheDocument()
    expect(within(dialog).getByText("Spontanzauber")).toBeInTheDocument()
    expect(within(dialog).getByText("Deutsch")).toBeInTheDocument()
    const picture = within(dialog).getByRole("img", { name: "Kartenbild: Blitzschlag" })
    expect(picture).toHaveAttribute("crossorigin", "anonymous")
    expect(picture).toHaveAttribute("referrerpolicy", "no-referrer")
    expect(picture.getAttribute("src")).toMatch(/^https:\/\/cards\.scryfall\.io\/display\/front\/.+\.webp\?\d+$/)
    const frame = picture.closest("[data-slot=card-picture]")!
    expect(frame).toHaveAttribute("data-state", "loading")
    fireEvent.load(picture)
    expect(frame).toHaveAttribute("data-state", "loaded")
  })

  it("a picture that cannot load gives way to the card's text", async () => {
    await installed()
    const user = userEvent.setup()
    renderAt("/settings")
    await within(await cardDataCard()).findByText("Bereit")
    const dialog = await openLookup(user)
    await user.type(within(dialog).getByLabelText("Kartenname"), "Lightning Bolt")
    await user.click(await within(dialog).findByRole("button", { name: "Blitzschlag" }))
    fireEvent.error(within(dialog).getByRole("img", { name: "Kartenbild: Blitzschlag" }))
    expect(within(dialog).getByText("Das Bild konnte nicht geladen werden.")).toBeInTheDocument()
    expect(within(dialog).queryByRole("img", { name: "Kartenbild: Blitzschlag" })).not.toBeInTheDocument()
  })

  it("turns a double-faced card", async () => {
    await installed()
    const user = userEvent.setup()
    renderAt("/settings")
    await within(await cardDataCard()).findByText("Bereit")
    const dialog = await openLookup(user)
    await user.type(within(dialog).getByLabelText("Kartenname"), "Geheimnis")
    await user.click(await within(dialog).findByRole("button", { name: "Geheimnisstöberer // Insekten-Scheußlichkeit" }))
    expect(within(dialog).getByRole("img", { name: "Kartenbild: Geheimnisstöberer // Insekten-Scheußlichkeit" }).getAttribute("src")).toContain("/front/")
    await user.click(within(dialog).getByRole("button", { name: "Rückseite zeigen" }))
    const back = within(dialog).getByRole("img", { name: "Kartenbild: Insekten-Scheußlichkeit" })
    expect(back.getAttribute("src")).toContain("/back/")
    expect(within(dialog).getByRole("button", { name: "Vorderseite zeigen" })).toBeInTheDocument()
  })

  it("says when there is no German version, and when Scryfall has no data or no card fits", async () => {
    await installed()
    const user = userEvent.setup()
    renderAt("/settings")
    await within(await cardDataCard()).findByText("Bereit")
    const dialog = await openLookup(user)
    const input = within(dialog).getByLabelText("Kartenname")
    await user.type(input, "Akki")
    await user.click(await within(dialog).findByRole("button", { name: "Akki Lavarunner // Tok-Tok, Volcano Born" }))
    expect(within(dialog).getByText("Keine deutsche Fassung – englisch")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Zur Trefferliste" }))
    await user.clear(within(dialog).getByLabelText("Kartenname"))
    await user.type(within(dialog).getByLabelText("Kartenname"), "Drake Stone")
    expect(await within(dialog).findByText("Keine Scryfall-Daten zu dieser Karte")).toBeInTheDocument()
    await user.clear(within(dialog).getByLabelText("Kartenname"))
    await user.type(within(dialog).getByLabelText("Kartenname"), "Zzyzx")
    expect(await within(dialog).findByText("Keine Karte gefunden")).toBeInTheDocument()
  })
})

describe("credits", () => {
  it("name Scryfall as the source of card data and pictures, and Wizards of the Coast as their owner", async () => {
    renderAt("/credits")
    expect(await screen.findByRole("link", { name: /^Scryfall/ })).toHaveAttribute("href", "https://scryfall.com")
    expect(screen.getByText(/Scryfall steht in keiner Verbindung zu OpenMana/)).toBeInTheDocument()
    expect(screen.getByText(/Stand 24\.09\.2026/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Fan Content Policy/ })).toHaveAttribute("href", "https://company.wizards.com/fancontentpolicy")
  })
})
