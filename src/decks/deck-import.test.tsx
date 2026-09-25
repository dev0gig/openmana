/*
 * The deck import as the player meets it: the way in from the decks page,
 * the card catalog set up right there, pasting and checking a list, the
 * report (open lines with number and text, choosing among cards of one name,
 * leaving a line out and taking it back), naming and saving - and the deck
 * in the local database exactly as the preview showed it. Scryfall's API is a
 * stand-in (fetch) answering with real card objects of the test fixtures.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import { routes } from "@/app/router"
import { listDecks } from "@/storage/decks"
import { fixtureCard, fixtureCards, fixtureCatalogFile, installFixtureCatalog, serveFile } from "@/test/catalog-fixtures"
import { openTestDatabase } from "@/test/storage-fixtures"

const file = fixtureCatalogFile()

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

async function withCatalog(): Promise<void> {
  const db = await openTestDatabase()
  await installFixtureCatalog(db)
  db.close()
}

async function storedDecks() {
  const db = await openTestDatabase()
  const decks = await listDecks(db)
  db.close()
  return decks.records
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

/** Scryfall's API as a stand-in: /cards/collection answers with the fixture printings asked for, everything else 404. */
function scryfallApi() {
  const cards = fixtureCards()
  const calls: string[] = []
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    if (url.endsWith("/cards/collection")) {
      const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: { set: string; collector_number: string }[] }
      const data = identifiers.flatMap((id) => cards.filter((c) => c.set === id.set && c.collector_number === id.collector_number && c.lang === "en"))
      return json({ object: "list", data, not_found: [] })
    }
    return json({ object: "error", status: 404, code: "not_found", details: "No card found" }, 404)
  })
  return { fetch: fetchStub as unknown as typeof fetch, calls }
}

async function openImport(user: ReturnType<typeof userEvent.setup>, text: string) {
  renderAt("/decks/import")
  const input = await screen.findByLabelText("Liste im Arena-Format")
  // Card data and database ready: only the list is missing.
  await screen.findByText("Füge zuerst eine Liste ein.")
  await user.click(input)
  // Paste, as a player would (typing would read "{" and "[" as key names).
  await user.paste(text)
  await user.click(screen.getByRole("button", { name: /Liste prüfen/ }))
  return screen.findByRole("region", { name: "Prüfbericht" })
}

describe("the way in", () => {
  it("the decks page leads to the import", async () => {
    const user = userEvent.setup()
    renderAt("/decks")
    await user.click(await screen.findByRole("link", { name: /Arena-Deck importieren/ }))
    expect(await screen.findByRole("heading", { level: 1, name: "Arena-Deck importieren" })).toBeInTheDocument()
  })

  it("without card data it offers to set them up, and checks only afterwards", async () => {
    vi.stubGlobal("fetch", serveFile(file.assets.url, file.gzip).fetch)
    const user = userEvent.setup()
    renderAt("/decks/import")
    const needed = await screen.findByRole("region", { name: "Kartendaten nötig" })
    await user.type(screen.getByLabelText("Liste im Arena-Format"), "4 Lightning Bolt")
    expect(screen.getByRole("button", { name: /Liste prüfen/ })).toBeDisabled()
    expect(screen.getByText("Erst die Kartendaten einrichten.")).toBeInTheDocument()
    await user.click(within(needed).getByRole("button", { name: "Kartendaten einrichten" }))
    await waitFor(() => expect(screen.queryByRole("region", { name: "Kartendaten nötig" })).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: /Liste prüfen/ })).toBeEnabled()
  })
})

describe("checking, deciding and saving", () => {
  it("an Arena export in English: all clear, the name from the list, saved as shown", async () => {
    await withCatalog()
    const user = userEvent.setup()
    const text = "About\nName Izzet Test\n\nDeck\n4 Delver of Secrets (MID) 47\n4 Lightning Bolt (M11) 149\n20 Forest (NEO) 292\n\nSideboard\n2 Fire // Ice\n"
    const summary = await openImport(user, text)
    expect(within(summary).getByText("Alle Zeilen geklärt")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Zu klären" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Name des Decks")).toHaveValue("Izzet Test")
    // The preview in German: German names where the catalog has them, the Forge name below.
    const main = screen.getByRole("region", { name: "Hauptdeck" })
    expect(within(main).getByText("28 Karten")).toBeInTheDocument()
    expect(within(main).getByText("Geheimnisstöberer")).toBeInTheDocument()
    expect(within(main).getByText("Forge: Delver of Secrets · MID 47")).toBeInTheDocument()
    // No German printing of Fire // Ice with text in the test catalog: its English name.
    expect(within(screen.getByRole("region", { name: "Sideboard" })).getByText("Fire // Ice")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Deck speichern/ }))
    expect(await screen.findByRole("heading", { level: 1, name: "Decks" })).toBeInTheDocument()
    expect(await screen.findByText("Deck „Izzet Test“ gespeichert")).toBeInTheDocument()
    const [deck, ...more] = await storedDecks()
    expect(more).toEqual([])
    expect(deck).toMatchObject({
      name: "Izzet Test",
      format: "constructed",
      main: [
        { count: 4, name: "Delver of Secrets", set: "mid", collectorNumber: "47", oracleId: fixtureCard("Delver of Secrets // Insectile Aberration").oracleId },
        { count: 4, name: "Lightning Bolt", set: "m11", collectorNumber: "149" },
        { count: 20, name: "Forest", set: "neo", collectorNumber: "292" },
      ],
      sideboard: [{ count: 2, name: "Fire // Ice" }],
      commander: [],
      source: { kind: "arena", text },
    })
  })

  it("open lines block saving until each is decided: choose, leave out, take back", async () => {
    await withCatalog()
    const user = userEvent.setup()
    const text = "Deck\n4 Blitzschlag\nfour Forest\n20 Wald\n\nSideboard\n1 Joven and Chandler\n2 Streitlustiges Tanzpaar\n"
    await openImport(user, text)
    expect(screen.getByText("3 Zeilen sind noch zu klären")).toBeInTheDocument()
    const save = screen.getByRole("button", { name: /Deck speichern/ })
    expect(save).toBeDisabled()
    expect(screen.getByText("Noch 3 Zeilen zu klären.")).toBeInTheDocument()
    const open = screen.getByRole("region", { name: "Zu klären" })
    const items = () => Array.from(open.querySelectorAll<HTMLElement>('[data-slot="item"]'))
    expect(items().map((item) => within(item).getByText(/^Zeile \d+$/).textContent)).toEqual(["Zeile 3", "Zeile 7", "Zeile 8"])
    expect(within(items()[0]!).getByText("„four Forest“")).toBeInTheDocument()
    expect(within(items()[0]!).getByText("Zeile nicht erkannt")).toBeInTheDocument()
    expect(within(items()[1]!).getByText("Mehrdeutig")).toBeInTheDocument()
    expect(within(items()[2]!).getByText("Forge kennt diese Karte nicht")).toBeInTheDocument()

    // Choose among the two cards named "Joven and Chandler".
    await user.click(within(open).getByRole("button", { name: "Karte wählen: Zeile 7" }))
    const dialog = await screen.findByRole("dialog", { name: "Welche Karte ist gemeint?" })
    const candidates = within(dialog).getAllByRole("button").filter((button) => button.textContent?.includes("Forge:"))
    expect(candidates).toHaveLength(2)
    await user.click(candidates.find((button) => button.textContent?.includes("Forge: P-Joven and Chandler"))!)
    await waitFor(() => expect(screen.getByText("2 Zeilen sind noch zu klären")).toBeInTheDocument())

    // Leave the two others out; take one back and leave it out again.
    await user.click(within(open).getByRole("button", { name: "Zeile 3 weglassen" }))
    await user.click(within(open).getByRole("button", { name: "Zeile 8 weglassen" }))
    expect(screen.getByText("Alle Zeilen geklärt")).toBeInTheDocument()
    await user.click(within(open).getByRole("button", { name: "Zeile 8 wieder aufnehmen" }))
    expect(screen.getByText("Eine Zeile ist noch zu klären")).toBeInTheDocument()
    await user.click(within(open).getByRole("button", { name: "Zeile 8 weglassen" }))
    expect(screen.getByText(/2 Zeilen sind weggelassen/)).toBeInTheDocument()

    // A name is still missing.
    expect(save).toBeDisabled()
    expect(screen.getByText("Das Deck braucht einen Namen.")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Name des Decks"), "Rot-Grün")
    expect(save).toBeEnabled()
    await user.click(save)
    await screen.findByRole("heading", { level: 1, name: "Decks" })
    const [deck] = await storedDecks()
    expect(deck?.main.map((c) => [c.count, c.name])).toEqual([
      [4, "Lightning Bolt"],
      [20, "Forest"],
    ])
    expect(deck?.sideboard.map((c) => [c.count, c.name])).toEqual([[1, "P-Joven and Chandler"]])
    // The list is kept as it was checked, left-out lines included.
    expect(deck?.source.text).toBe(text)
  })

  it("a Commander (Brawl) export: the commander, the format", async () => {
    await withCatalog()
    const user = userEvent.setup()
    await openImport(user, "Commander\n1 Valki, Gott der Lügen (KHM) 114\n\nDeck\n1 Lightning Bolt\n28 Forest")
    expect(screen.getByRole("region", { name: "Kommandeur" })).toBeInTheDocument()
    expect(screen.getByText(/Forge spielt das Deck als Commander-Partie/)).toBeInTheDocument()
    await user.type(screen.getByLabelText("Name des Decks"), "Valki")
    await user.click(screen.getByRole("button", { name: /Deck speichern/ }))
    await screen.findByRole("heading", { level: 1, name: "Decks" })
    const [deck] = await storedDecks()
    expect(deck).toMatchObject({ format: "commander", commander: [{ count: 1, name: "Valki, God of Lies", set: "khm", collectorNumber: "114" }] })
  })

  it("a name in another language: identified through its printing at Scryfall", async () => {
    await withCatalog()
    const api = scryfallApi()
    vi.stubGlobal("fetch", api.fetch)
    const user = userEvent.setup()
    await openImport(user, "4 Foudre (M11) 149\n20 Forest")
    expect(screen.getByText("Alle Zeilen geklärt")).toBeInTheDocument()
    const main = screen.getByRole("region", { name: "Hauptdeck" })
    expect(within(main).getByText("Blitzschlag")).toBeInTheDocument()
    expect(within(main).getByText("Über Set und Sammlernummer erkannt (bei Scryfall nachgefragt).")).toBeInTheDocument()
    expect(api.calls.filter((url) => url.endsWith("/cards/collection"))).toHaveLength(1)
  })

  it("Scryfall unreachable: the line stays open and says why; checking again once it is back", async () => {
    await withCatalog()
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))))
    const user = userEvent.setup()
    await openImport(user, "4 Foudre (M11) 150\n20 Forest")
    expect(screen.getByText("Scryfall war nicht erreichbar")).toBeInTheDocument()
    const open = screen.getByRole("region", { name: "Zu klären" })
    expect(within(open).getByText(/Scryfall war nicht erreichbar; über Set und Sammlernummer/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Deck speichern/ })).toBeDisabled()
    // Back online: the printing (as the stand-in knows it) resolves the line.
    const bolt = fixtureCards().find((c) => c.set === "m11")!
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/cards/collection") ? json({ object: "list", data: [{ ...bolt, collector_number: "150" }], not_found: [] }) : json({ object: "error", status: 404, code: "not_found", details: "-" }, 404),
      ),
    )
    await user.click(screen.getByRole("button", { name: "Erneut prüfen" }))
    await waitFor(() => expect(screen.getByText("Alle Zeilen geklärt")).toBeInTheDocument())
  })

  it("a text file opens and is checked at once; a file that is not text is refused", async () => {
    await withCatalog()
    renderAt("/decks/import")
    await waitFor(() => expect(screen.getByRole("button", { name: /Textdatei öffnen/ })).toBeEnabled())
    const picker = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(picker, { target: { files: [new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], "bild.jpg")] } })
    expect(await screen.findByText("Die Datei lässt sich nicht lesen")).toBeInTheDocument()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    fireEvent.change(picker, { target: { files: [new File([bom, "Deck\r\n4 Lightning Bolt\r\n20 Forest\r\n"], "deck.txt", { type: "text/plain" })] } })
    expect(await screen.findByRole("region", { name: "Prüfbericht" })).toBeInTheDocument()
    expect(screen.getByText("Alle Zeilen geklärt")).toBeInTheDocument()
  })

  it("editing the list goes back to the text, and a new check replaces the report", async () => {
    await withCatalog()
    const user = userEvent.setup()
    await openImport(user, "4 Lightning Bolt\nfour Forest")
    expect(screen.getByText("Eine Zeile ist noch zu klären")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Liste bearbeiten" }))
    const input = screen.getByLabelText("Liste im Arena-Format")
    expect(input).toHaveValue("4 Lightning Bolt\nfour Forest")
    await user.clear(input)
    await user.click(input)
    await user.paste("4 Lightning Bolt\n20 Forest")
    await user.click(screen.getByRole("button", { name: /Liste prüfen/ }))
    await waitFor(() => expect(screen.getByText("Alle Zeilen geklärt")).toBeInTheDocument())
  })
})
