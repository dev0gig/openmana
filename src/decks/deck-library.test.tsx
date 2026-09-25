/*
 * The deck library as the player meets it, on decks imported for real
 * against the small test catalog: the list (search, format, order - in the
 * address), a deck's details, renaming, duplicating, deleting (confirmed),
 * exporting (clipboard and file), importing a deck's list again (confirmed,
 * the earlier choices kept), and choosing the decks for a game. Every
 * change is read back from the local database. Scryfall's API is a
 * stand-in (fetch) answering with real card objects of the test fixtures.
 */
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { routes } from "@/app/router"
import { getDeck, listDecks, saveDeck } from "@/storage/decks"
import type { DeckRecord } from "@/storage/generated/records"
import { readSetting, writeSetting } from "@/storage/settings"
import { fixtureCards, installFixtureCatalog } from "@/test/catalog-fixtures"
import { deckList, importedDeck } from "@/test/deck-fixtures"
import { openTestDatabase, putRaw } from "@/test/storage-fixtures"
import { arenaList } from "./arena-export"
import { AI_DECK, HUMAN_DECK } from "./deck-selection"
import { resolveDeckList } from "./deck-resolve"
import { parseArenaDeckList } from "./arena-list"

/** The start button's note once both decks are set, in jsdom (no WebAssembly GC, no cross-origin isolation). */
const ENGINE_NOTE = "Dieser Browser kann die Forge-Engine nicht ausführen."

const IZZET_ID = "10000000-0000-4000-8000-000000000001"
const BRAWL_ID = "10000000-0000-4000-8000-000000000002"
const MONO_ID = "10000000-0000-4000-8000-000000000003"

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

let api: ReturnType<typeof scryfallApi>

async function setUp(options: { readonly catalog?: boolean; readonly decks?: readonly ((db: Awaited<ReturnType<typeof openTestDatabase>>) => Promise<DeckRecord>)[] } = {}) {
  const db = await openTestDatabase()
  if (options.catalog ?? true) await installFixtureCatalog(db)
  const saved: DeckRecord[] = []
  for (const make of options.decks ?? []) {
    const deck = await make(db)
    await saveDeck(db, deck)
    saved.push(deck)
  }
  db.close()
  return saved
}

const izzet = (db: Awaited<ReturnType<typeof openTestDatabase>>) => importedDeck(db, deckList("arena-constructed.txt"), { id: IZZET_ID, now: "2026-09-20T10:00:00.000Z" })
const brawl = (db: Awaited<ReturnType<typeof openTestDatabase>>) => importedDeck(db, deckList("arena-brawl.txt"), { id: BRAWL_ID, now: "2026-09-22T10:00:00.000Z" })
const mono = (db: Awaited<ReturnType<typeof openTestDatabase>>) => importedDeck(db, "About\nName Mono-Grün\n\nDeck\n24 Forest (NEO) 292\n4 Lightning Bolt", { id: MONO_ID, now: "2026-09-21T10:00:00.000Z" })

beforeEach(() => {
  api = scryfallApi()
  vi.stubGlobal("fetch", api.fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

async function stored(id: string) {
  const db = await openTestDatabase()
  const lookup = await getDeck(db, id)
  db.close()
  return lookup
}

async function storedDecks() {
  const db = await openTestDatabase()
  const decks = await listDecks(db)
  db.close()
  return decks.records
}

/** The texts of the list's decks: title and description. */
async function listed() {
  const list = await screen.findByRole("list", { name: "Gespeicherte Decks" })
  return within(list)
    .getAllByRole("link")
    .map((link) => link.querySelector("[data-slot=item-title]")?.textContent)
}

async function openMenuItem(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("button", { name: "Mehr" }))
  await user.click(await screen.findByRole("menuitem", { name }))
}

describe("the list", () => {
  it("every deck with format, counts and how German its cards are", async () => {
    await setUp({ decks: [izzet, brawl] })
    renderAt("/decks")
    expect(await listed()).toEqual(["Izzet Delver", "Valki Brawl"])
    const list = screen.getByRole("list", { name: "Gespeicherte Decks" })
    const [first, second] = within(list).getAllByRole("link")
    expect(first).toHaveAttribute("href", `/decks/${IZZET_ID}`)
    expect(within(first!).getByText("Constructed · 38 Karten · Sideboard 3")).toBeInTheDocument()
    expect(within(first!).getByText("5 Karten nicht ganz deutsch")).toBeInTheDocument()
    expect(within(second!).getByText("Commander · 30 Karten · Kommandeur 1")).toBeInTheDocument()
    expect(within(second!).getByText("Kommandeur: Valki, Gott der Lügen")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("2 Decks")
  })

  it("search by any card name and filter by format - in the address; nothing found is said, and undone", async () => {
    const user = userEvent.setup()
    await setUp({ decks: [izzet, brawl] })
    const router = renderAt("/decks")
    await listed()
    await user.type(screen.getByRole("searchbox", { name: "Suchen" }), "Knochenmalmer")
    await waitFor(async () => expect(await listed()).toEqual(["Izzet Delver"]))
    expect(screen.getByRole("status")).toHaveTextContent("1 von 2 Decks")
    expect(router.state.location.search).toBe("?q=Knochenmalmer")

    await user.clear(screen.getByRole("searchbox", { name: "Suchen" }))
    await user.click(screen.getByRole("radio", { name: "Commander" }))
    await waitFor(async () => expect(await listed()).toEqual(["Valki Brawl"]))
    expect(router.state.location.search).toBe("?format=commander")

    await user.type(screen.getByRole("searchbox", { name: "Suchen" }), "Delver")
    expect(await screen.findByText("Kein Deck passt")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Suche zurücksetzen" }))
    await waitFor(async () => expect(await listed()).toEqual(["Izzet Delver", "Valki Brawl"]))
    expect(router.state.location.search).toBe("")
  })

  it("the order comes from the address", async () => {
    await setUp({ decks: [izzet, brawl, mono] })
    renderAt("/decks?sort=created")
    expect(await listed()).toEqual(["Valki Brawl", "Mono-Grün", "Izzet Delver"])
  })

  it("without card data: the names Forge knows, and the card data can be set up right there", async () => {
    await setUp({ catalog: false, decks: [() => Promise.resolve(deckWithoutCatalog())] })
    renderAt("/decks")
    expect(await listed()).toEqual(["Ohne Katalog"])
    expect(screen.getByText("Ohne Kartendaten: englische Namen, keine Bilder")).toBeInTheDocument()
    expect(screen.getByText("Kommandeur: Valki, God of Lies")).toBeInTheDocument()
    expect(screen.queryByText(/nicht ganz deutsch/)).toBeNull()
  })
})

function deckWithoutCatalog(): DeckRecord {
  return {
    id: IZZET_ID,
    name: "Ohne Katalog",
    format: "commander",
    main: [{ count: 99, name: "Forest" }],
    sideboard: [],
    commander: [{ count: 1, name: "Valki, God of Lies" }],
    source: { kind: "arena", text: "Commander\n1 Valki, God of Lies\n\nDeck\n99 Forest", importedAt: "2026-09-20T10:00:00.000Z" },
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  }
}

describe("a deck's details", () => {
  it("parts card by card, overview and language; a card opens its full view; Scryfall only for printings the catalog lacks", async () => {
    const user = userEvent.setup()
    await setUp({ decks: [izzet] })
    renderAt(`/decks/${IZZET_ID}`)
    expect(await screen.findByRole("heading", { level: 1, name: "Izzet Delver" })).toBeInTheDocument()
    const main = screen.getByRole("region", { name: "Hauptdeck" })
    const rows = within(main)
      .getAllByRole("button")
      .map((row) => row.textContent)
    expect(rows[0]).toContain("4 × Geheimnisstöberer")
    expect(rows[0]).toContain("Forge: Delver of Secrets · MID 47")
    expect(rows[5]).toContain("Hansk, Slayer Zealotenglisch")
    expect(rows[7]).toContain("A-Canopy Tacticiannur Forge")
    const language = screen.getByRole("region", { name: "Kartensprache" })
    expect(within(language).getByText("5 von 10 Karten nicht ganz deutsch")).toBeInTheDocument()
    expect(within(language).getByText("A-Canopy Tactician, Drake Stone")).toBeInTheDocument()
    const overview = screen.getByRole("region", { name: "Überblick" })
    expect(within(overview).getByText("38 Karten")).toBeInTheDocument()

    await user.click(within(main).getByRole("button", { name: /Knochenmalmer-Riese/ }))
    const dialog = await screen.findByRole("dialog", { name: "3 × Knochenmalmer-Riese" })
    expect(within(dialog).getByText("Hauptdeck · Forge: Bonecrusher Giant · ELD 115")).toBeInTheDocument()
    expect(within(dialog).getByRole("img", { name: /Kartenbild/ })).toBeInTheDocument()

    // Only ELD 115 and 2X2 361 are not among the catalog's printings of their cards.
    await waitFor(() => expect(screen.queryByText(/Lade die Bilder/)).toBeNull())
    const collection = api.calls.filter((url) => url.endsWith("/cards/collection"))
    expect(collection).toHaveLength(1)
    expect(api.calls.filter((url) => !url.endsWith("/cards/collection")).sort()).toEqual(["https://api.scryfall.com/cards/2x2/361/de", "https://api.scryfall.com/cards/eld/115/de"])
  })

  it("a deck that is gone", async () => {
    await setUp()
    renderAt("/decks/00000000-0000-4000-8000-ffffffffffff")
    expect(await screen.findByRole("heading", { level: 1, name: "Deck nicht gefunden" })).toBeInTheDocument()
    expect(screen.getByText("Dieses Deck gibt es nicht (mehr)")).toBeInTheDocument()
  })

  it("a damaged deck is not shown as a deck", async () => {
    await setUp()
    await putRaw("decks", { id: MONO_ID, name: "" })
    renderAt(`/decks/${MONO_ID}`)
    expect(await screen.findByRole("heading", { level: 1, name: "Beschädigtes Deck" })).toBeInTheDocument()
  })
})

describe("what can be done with a deck", () => {
  it("rename: the new name everywhere; an empty name is not possible", async () => {
    const user = userEvent.setup()
    const [saved] = await setUp({ decks: [izzet, brawl] })
    renderAt(`/decks/${IZZET_ID}`)
    await openMenuItem(user, "Umbenennen")
    const dialog = await screen.findByRole("dialog", { name: "Deck umbenennen" })
    const input = within(dialog).getByLabelText("Name des Decks")
    await user.clear(input)
    expect(within(dialog).getByText("Das Deck braucht einen Namen.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Speichern" })).toBeDisabled()
    await user.type(input, "Valki Brawl")
    expect(within(dialog).getByText("Ein anderes Deck heißt schon so.")).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, "Izzet Tempo{Enter}")
    expect(await screen.findByRole("heading", { level: 1, name: "Izzet Tempo" })).toBeInTheDocument()
    const lookup = await stored(IZZET_ID)
    expect(lookup.status === "found" && lookup.deck).toMatchObject({ ...saved, name: "Izzet Tempo", updatedAt: expect.not.stringMatching(saved!.updatedAt) })
  })

  it("duplicate: a copy with its own id opens, the original stays", async () => {
    const user = userEvent.setup()
    const [saved] = await setUp({ decks: [izzet] })
    const router = renderAt(`/decks/${IZZET_ID}`)
    await screen.findByRole("heading", { level: 1, name: "Izzet Delver" })
    await openMenuItem(user, "Duplizieren")
    expect(await screen.findByRole("heading", { level: 1, name: "Izzet Delver (Kopie)" })).toBeInTheDocument()
    const decks = await storedDecks()
    const copy = decks.find((deck) => deck.name === "Izzet Delver (Kopie)")!
    expect(router.state.location.pathname).toBe(`/decks/${copy.id}`)
    expect(copy.id).not.toBe(IZZET_ID)
    expect({ ...copy, id: IZZET_ID, name: saved!.name, createdAt: saved!.createdAt, updatedAt: saved!.updatedAt }).toEqual(saved)
    expect(decks).toHaveLength(2)
  })

  it("delete: only after confirming, then back to the list", async () => {
    const user = userEvent.setup()
    await setUp({ decks: [izzet, brawl] })
    const router = renderAt(`/decks/${IZZET_ID}`)
    await screen.findByRole("heading", { level: 1, name: "Izzet Delver" })
    await openMenuItem(user, "Löschen")
    const confirm = await screen.findByRole("alertdialog", { name: "„Izzet Delver“ löschen?" })
    await user.click(within(confirm).getByRole("button", { name: "Abbrechen" }))
    expect((await stored(IZZET_ID)).status).toBe("found")
    await openMenuItem(user, "Löschen")
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Endgültig löschen" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/decks"))
    expect(await listed()).toEqual(["Valki Brawl"])
    expect((await stored(IZZET_ID)).status).toBe("missing")
  })

  it("export: the list with Forge's names or the imported one, copied or saved as a text file", async () => {
    const user = userEvent.setup()
    const [saved] = await setUp({ decks: [izzet] })
    const files: { name: string; blob: Blob }[] = []
    let blob: Blob | null = null
    vi.spyOn(URL, "createObjectURL").mockImplementation((object) => {
      blob = object as Blob
      return "blob:test"
    })
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      files.push({ name: this.download, blob: blob! })
    })
    renderAt(`/decks/${IZZET_ID}`)
    await screen.findByRole("heading", { level: 1, name: "Izzet Delver" })
    await openMenuItem(user, "Exportieren")
    const dialog = await screen.findByRole("dialog", { name: "Deck exportieren" })
    const text = within(dialog).getByLabelText("Deckliste")
    const expected = arenaList(saved!, new Map())
    // The test catalog knows no Arena codes that differ from Scryfall's.
    expect(text).toHaveValue(expected)
    await user.click(within(dialog).getByRole("button", { name: "Kopieren" }))
    expect(await navigator.clipboard.readText()).toBe(expected)
    await user.click(within(dialog).getByRole("radio", { name: "Importierte Liste, unverändert" }))
    expect(text).toHaveValue(saved!.source.text)
    await user.click(within(dialog).getByRole("button", { name: "Als Textdatei speichern" }))
    expect(files.map((file) => file.name)).toEqual(["Izzet Delver (Original).txt"])
    expect(await files[0]!.blob.text()).toBe(saved!.source.text)
  })

  it("play it, or let the AI play it: the choice for the next game", async () => {
    const user = userEvent.setup()
    await setUp({ decks: [izzet, mono] })
    const router = renderAt(`/decks/${MONO_ID}`)
    await screen.findByRole("heading", { level: 1, name: "Mono-Grün" })
    await openMenuItem(user, "Als Deck der KI wählen")
    expect(await screen.findByText("Die KI spielt jetzt „Mono-Grün“")).toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "Zu den Decks" }))
    await user.click(await screen.findByRole("link", { name: /Izzet Delver/ }))
    await user.click(await screen.findByRole("button", { name: "Mit diesem Deck spielen" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/play"))
    expect(await screen.findByText("Izzet Delver – Constructed · 38 Karten · Sideboard 3")).toBeInTheDocument()
    expect(screen.getByText("Mono-Grün – Constructed · 28 Karten")).toBeInTheDocument()
    // Both decks are set: only the engine is left, which jsdom cannot run (the start itself: src/game/game-page.test.tsx).
    expect(screen.getByRole("button", { name: /Partie starten/ })).toHaveAccessibleDescription(ENGINE_NOTE)
    const db = await openTestDatabase()
    expect((await readSetting(db, HUMAN_DECK)).value).toBe(IZZET_ID)
    expect((await readSetting(db, AI_DECK)).value).toEqual({ kind: "deck", deckId: MONO_ID })
    db.close()
  })
})

describe("importing a deck's list again", () => {
  it("starts from the saved list and name; replacing is confirmed; the deck keeps its id and creation", async () => {
    const user = userEvent.setup()
    const [saved] = await setUp({ decks: [izzet] })
    const router = renderAt(`/decks/${IZZET_ID}`)
    await screen.findByRole("heading", { level: 1, name: "Izzet Delver" })
    await openMenuItem(user, "Erneut importieren")
    // The page shows its heading while it reads the deck; the list comes with the deck.
    const input = await screen.findByLabelText("Liste im Arena-Format")
    expect(screen.getByRole("heading", { level: 1, name: "Deck neu importieren" })).toBeInTheDocument()
    expect(input).toHaveValue(saved!.source.text)
    const changed = saved!.source.text.replace("20 Forest (NEO) 292", "19 Forest (NEO) 292\n1 Akki Lavarunner (CHK) 153")
    await user.clear(input)
    await user.click(input)
    await user.paste(changed)
    await user.click(screen.getByRole("button", { name: /Liste prüfen/ }))
    await screen.findByText("Alle Zeilen geklärt")
    expect(screen.getByLabelText("Name des Decks")).toHaveValue("Izzet Delver")
    await user.click(screen.getByRole("button", { name: "Deck ersetzen" }))
    const confirm = await screen.findByRole("alertdialog", { name: "„Izzet Delver“ ersetzen?" })
    await user.click(within(confirm).getByRole("button", { name: "Deck ersetzen" }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/decks/${IZZET_ID}`))
    const lookup = await stored(IZZET_ID)
    expect(lookup.status).toBe("found")
    const replaced = lookup.status === "found" ? lookup.deck : null
    expect(replaced?.createdAt).toBe(saved!.createdAt)
    expect(replaced?.source.text).toBe(changed)
    expect(replaced?.main.find((card) => card.name === "Forest")?.count).toBe(19)
    expect(replaced?.main.some((card) => card.name === "Akki Lavarunner")).toBe(true)
    expect(await storedDecks()).toHaveLength(1)
  })

  it("a name several cards fit is the card the deck already has, as the player chose it before", async () => {
    const user = userEvent.setup()
    const text = "Deck\n1 Joven and Chandler\n20 Forest"
    await setUp({
      decks: [
        async (db) => {
          const report = await resolveDeckList(db, parseArenaDeckList(text))
          const playtest = report.entries[0]!.candidates.find((candidate) => candidate.card.forgeNames[0] === "P-Joven and Chandler")!
          return importedDeck(db, text, { id: MONO_ID, name: "Joven", choices: new Map([[report.entries[0]!.key, playtest.card.oracleId]]) })
        },
      ],
    })
    renderAt(`/decks/${MONO_ID}/import`)
    await user.click(await screen.findByRole("button", { name: /Liste prüfen/ }))
    await screen.findByText("Alle Zeilen geklärt")
    const main = screen.getByRole("region", { name: "Hauptdeck" })
    expect(within(main).getByText("Wie bisher im Deck – der Name passt auch zu anderen Karten.")).toBeInTheDocument()
    expect(within(main).getByText(/Forge: P-Joven and Chandler/)).toBeInTheDocument()
  })
})

describe("choosing the decks for a game", () => {
  it("the player's deck, then the AI's: random from the fitting decks, one of them, or a mirror match", async () => {
    const user = userEvent.setup()
    await setUp({ decks: [izzet, brawl, mono] })
    renderAt("/play")
    expect(await screen.findByText("Noch kein Deck gewählt.")).toBeInTheDocument()
    expect(screen.getByText("Zufällig, für jede Partie neu gezogen.")).toBeInTheDocument()
    expect(screen.getByText("Wähle zuerst dein Deck.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Dein Deck wählen" }))
    let dialog = await screen.findByRole("dialog", { name: "Dein Deck wählen" })
    await user.click(within(dialog).getByRole("button", { name: "Izzet Delver" }))
    expect(await screen.findByText("Izzet Delver – Constructed · 38 Karten · Sideboard 3")).toBeInTheDocument()
    expect(screen.getByText("Zufällig – dein einziges anderes Constructed-Deck.")).toBeInTheDocument()
    // Both decks are set: only the engine is left, which jsdom cannot run (the start itself: src/game/game-page.test.tsx).
    expect(screen.getByRole("button", { name: /Partie starten/ })).toHaveAccessibleDescription(ENGINE_NOTE)
    expect(screen.getByRole("button", { name: /Partie starten/ })).toBeDisabled()

    // The AI's choice: decks of another format are disabled and say why.
    await user.click(screen.getByRole("button", { name: "Deck der KI wählen" }))
    dialog = await screen.findByRole("dialog", { name: "Deck der KI wählen" })
    expect(within(dialog).getByRole("button", { name: "Valki Brawl" })).toBeDisabled()
    expect(within(dialog).getByText(/anderes Format als dein Deck \(Constructed\)/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Mono-Grün" }))
    expect(await screen.findByText("Mono-Grün – Constructed · 28 Karten")).toBeInTheDocument()

    // A Commander deck for the player: the AI's Constructed deck no longer fits, and random has nothing to draw.
    await user.click(screen.getByRole("button", { name: "Dein Deck wählen" }))
    dialog = await screen.findByRole("dialog", { name: "Dein Deck wählen" })
    await user.click(within(dialog).getByRole("button", { name: "Valki Brawl" }))
    expect(await screen.findByText("Das Deck der KI hat ein anderes Format als deins – wähle ein passendes.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Deck der KI wählen" }))
    dialog = await screen.findByRole("dialog", { name: "Deck der KI wählen" })
    expect(within(dialog).getByRole("button", { name: "Zufällig" })).toBeDisabled()
    expect(within(dialog).getByText("Nicht möglich: Es gibt kein zweites Commander-Deck.")).toBeInTheDocument()
    // The player's own deck for the AI: a mirror match.
    await user.click(within(dialog).getByRole("button", { name: "Valki Brawl" }))
    await waitFor(() => expect(screen.getByRole("button", { name: /Partie starten/ })).toHaveAccessibleDescription(ENGINE_NOTE))
  })

  it("a chosen deck that was deleted is said so, not replaced", async () => {
    await setUp({ decks: [izzet] })
    const db = await openTestDatabase()
    await writeSetting(db, HUMAN_DECK, "00000000-0000-4000-8000-ffffffffffff")
    db.close()
    renderAt("/play")
    expect(await screen.findByText("Das gewählte Deck gibt es nicht mehr.")).toBeInTheDocument()
    expect(screen.getByText("Dein gewähltes Deck gibt es nicht mehr – wähle ein anderes.")).toBeInTheDocument()
  })
})
