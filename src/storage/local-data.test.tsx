/*
 * The local data as the player meets it: the settings card (state, space,
 * backup out and in, check), and the pages that list stored data - always
 * what the database really holds, failures included.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IDBObjectStore } from "fake-indexeddb"
import { openDB } from "idb"
import { createMemoryRouter, RouterProvider } from "react-router"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { routes } from "@/app/router"
import { backupEnd, backupFile, backupHeader, deck, match, openTestDatabase, putRaw, readRaw } from "@/test/storage-fixtures"
import { saveDeck } from "./decks"
import { SCHEMA_VERSION } from "./generated/constants"

// jsdom has no object URLs; a download is observed at its link instead.
const createObjectURL = vi.fn((_blob: Blob) => "blob:openmana-test")
beforeAll(() => {
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = () => undefined
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

async function localDataCard() {
  const card = await screen.findByRole("region", { name: "Daten auf diesem Gerät" })
  await within(card).findByText("Bereit")
  return card
}

function facts(card: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    Array.from(card.querySelectorAll("dl > div")).map((row) => [row.querySelector("dt")?.textContent ?? "", row.querySelector("dd")?.textContent ?? ""]),
  )
}

function fileInput(card: HTMLElement): HTMLInputElement {
  return within(card).getByLabelText("Sicherungsdatei wählen", { selector: "input" })
}

describe("settings: data on this device", () => {
  it("shows what the database holds and how much room there is", async () => {
    const db = await openTestDatabase()
    await saveDeck(db, deck())
    db.close()
    renderAt("/settings")
    const card = await localDataCard()
    await waitFor(() => expect(facts(card)["Decks"]).toBe("1"))
    expect(facts(card)).toMatchObject({
      Partien: "0",
      Einstellungen: "0",
      "Kartendaten (Scryfall)": "noch keine",
      "Letzte Sicherung": "noch keine",
      Datenbank: expect.stringMatching(new RegExp(`^Version ${SCHEMA_VERSION}, angelegt am `)),
    })
  })

  it("saves a backup file and notes it", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    renderAt("/settings")
    const card = await localDataCard()
    await userEvent.click(within(card).getByRole("button", { name: "Sicherung speichern" }))
    expect(await screen.findByText("Sicherung erstellt")).toBeInTheDocument()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toMatch(/^openmana-sicherung-\d{4}-\d{2}-\d{2}-\d{4}\.jsonl\.gz$/)
    await waitFor(() => expect(facts(card)["Letzte Sicherung"]).not.toBe("noch keine"))
  })

  it("still hands out the backup file when noting it fails (full storage), and says so", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    renderAt("/settings")
    const card = await localDataCard()
    // The browser refuses the note in meta/backup, as a full storage would.
    const originalPut = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if ((value as { key?: unknown }).key === "backup") throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
      return originalPut.call(this, value, key)
    })
    await userEvent.click(within(card).getByRole("button", { name: "Sicherung speichern" }))
    expect(await within(card).findByText("Der Speicher für OpenMana in diesem Browser ist voll")).toBeInTheDocument()
    expect(within(card).getByText(/Die Sicherung wurde trotzdem erstellt und heruntergeladen/)).toBeInTheDocument()
    expect(click).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(facts(card)["Letzte Sicherung"]).toBe("noch keine")
  })

  it("loads a backup: shows its content, merges on the player's word, the decks page lists it", async () => {
    const first = deck({ name: "Aus der Sicherung" })
    const second = deck({ name: "Noch eins" })
    const file = await backupFile(
      [backupHeader(), { type: "record", store: "decks", record: first }, { type: "record", store: "decks", record: second }, backupEnd({ decks: 2 })],
      { gzip: true, name: "openmana-sicherung-2026-09-24-1200.jsonl.gz" },
    )
    const router = renderAt("/settings")
    const card = await localDataCard()
    fireEvent.change(fileInput(card), { target: { files: [file] } })
    const dialog = await screen.findByRole("dialog", { name: "Sicherung laden" })
    expect(within(dialog).getByText(/openmana-sicherung-2026-09-24-1200\.jsonl\.gz – erstellt am/)).toBeInTheDocument()
    expect(within(dialog).getByRole("region", { name: "In der Sicherung" })).toBeInTheDocument()
    const changes = within(dialog).getByRole("region", { name: "Das ändert sich auf diesem Gerät" })
    await within(changes).findByText("2 neu")
    await userEvent.click(within(dialog).getByRole("button", { name: "Zusammenführen" }))
    expect(await screen.findByText("Sicherung geladen")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(facts(card)["Decks"]).toBe("2"))

    await act(async () => {
      await router.navigate("/decks")
    })
    const list = await screen.findByRole("list", { name: "Gespeicherte Decks" })
    expect(within(list).getAllByRole("listitem").map((item) => item.querySelector("[data-slot=item-title]")?.textContent)).toEqual([
      "Aus der Sicherung",
      "Noch eins",
    ])
    expect(within(list).getAllByText("Constructed · 24 Karten · Sideboard 2")).toHaveLength(2)
  })

  it("replacing says what it deletes, on its button too", async () => {
    const db = await openTestDatabase()
    await saveDeck(db, deck({ name: "Hier" }))
    db.close()
    const file = await backupFile([backupHeader(), { type: "record", store: "decks", record: deck({ name: "Dort" }) }, backupEnd({ decks: 1 })])
    renderAt("/settings")
    const card = await localDataCard()
    fireEvent.change(fileInput(card), { target: { files: [file] } })
    const dialog = await screen.findByRole("dialog", { name: "Sicherung laden" })
    await userEvent.click(within(dialog).getByRole("radio", { name: /Ersetzen/ }))
    await within(dialog).findByText("1 statt 1")
    await userEvent.click(within(dialog).getByRole("button", { name: "Lokale Daten ersetzen" }))
    await screen.findByText("Sicherung geladen")
    // The dialog closes only after the import has been committed.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect((await readRaw("decks")).map((d) => (d as { name: string }).name)).toEqual(["Dort"])
  })

  it("refuses a file that is no backup, and changes nothing", async () => {
    renderAt("/settings")
    const card = await localDataCard()
    fireEvent.change(fileInput(card), { target: { files: [new File(["Deck\n4 Mountain\n"], "deck.txt")] } })
    expect(await within(card).findByText("Diese Datei ist keine gültige OpenMana-Sicherung")).toBeInTheDocument()
    expect(within(card).getByText(/this is not an OpenMana backup/)).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("checks every record and removes damaged ones only after confirmation", async () => {
    const db = await openTestDatabase()
    await saveDeck(db, deck())
    db.close()
    await putRaw("decks", { id: "broken", name: "" })
    renderAt("/settings")
    const card = await localDataCard()
    await userEvent.click(within(card).getByRole("button", { name: "Daten prüfen" }))
    expect(await within(card).findByText(/^1 Eintrag ist beschädigt/)).toBeInTheDocument()
    await userEvent.click(within(card).getByRole("button", { name: "Beschädigte Einträge entfernen" }))
    const confirm = await screen.findByRole("alertdialog", { name: "1 beschädigten Eintrag entfernen?" })
    await userEvent.click(within(confirm).getByRole("button", { name: "Endgültig entfernen" }))
    expect(await within(card).findByText(/^Alles in Ordnung/)).toBeInTheDocument()
    expect(await readRaw("decks")).toHaveLength(1)
  })

  it("a database of a newer OpenMana: says so, offers reload, pages do not pretend to be empty", async () => {
    const newer = await openDB("openmana", 5)
    newer.close()
    const router = renderAt("/settings")
    const card = await screen.findByRole("region", { name: "Daten auf diesem Gerät" })
    expect(await within(card).findByText("Die lokalen Daten stammen von einer neueren OpenMana-Version")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Neu laden" })).toBeInTheDocument()
    expect(within(card).queryByRole("button", { name: "Lokale Daten zurücksetzen" })).not.toBeInTheDocument()
    await act(async () => {
      await router.navigate("/decks")
    })
    expect(await screen.findByText("Die lokalen Daten stammen von einer neueren OpenMana-Version")).toBeInTheDocument()
    expect(screen.queryByText("Noch keine Decks")).not.toBeInTheDocument()
  })

  it("a damaged database can be reset after confirmation", async () => {
    const damaged = await openDB("openmana", SCHEMA_VERSION, { upgrade: (db) => db.createObjectStore("decks") })
    damaged.close()
    renderAt("/settings")
    const card = await screen.findByRole("region", { name: "Daten auf diesem Gerät" })
    expect(await within(card).findByText("Die lokale Datenbank ist beschädigt")).toBeInTheDocument()
    await userEvent.click(within(card).getByRole("button", { name: "Lokale Daten zurücksetzen" }))
    const confirm = await screen.findByRole("alertdialog", { name: "Lokale Daten zurücksetzen?" })
    await userEvent.click(within(confirm).getByRole("button", { name: "Endgültig zurücksetzen" }))
    await localDataCard()
  })

  it("losing the connection to another tab shows up at once", async () => {
    renderAt("/settings")
    const card = await localDataCard()
    const newer = await openDB("openmana", SCHEMA_VERSION + 1)
    expect(await within(card).findByText("OpenMana wurde in einem anderen Tab aktualisiert")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Neu laden" })).toBeInTheDocument()
    expect(await screen.findByText("Bitte lade die Seite neu.")).toBeInTheDocument()
    newer.close()
  })
})

describe("pages list what is stored", () => {
  it("decks: valid ones by name, a damaged one as damaged", async () => {
    const db = await openTestDatabase()
    await saveDeck(db, deck({ name: "Zebra", format: "commander", commander: [{ count: 1, name: "Talrand, Sky Summoner" }] }))
    db.close()
    await putRaw("decks", { id: "broken", name: "" })
    renderAt("/decks")
    const list = await screen.findByRole("list", { name: "Gespeicherte Decks" })
    expect(within(list).getByText("Zebra")).toBeInTheDocument()
    expect(within(list).getByText("Commander · 24 Karten · Kommandeur 1 · Sideboard 2")).toBeInTheDocument()
    expect(within(list).getByText(/^Geändert am \d{2}\.\d{2}\.\d{4}/)).toBeInTheDocument()
    // Without card data: the name Forge knows.
    expect(within(list).getByText("Kommandeur: Talrand, Sky Summoner")).toBeInTheDocument()
    expect(within(list).getByText("beschädigt")).toBeInTheDocument()
    expect(screen.getByText("1 Deck")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Arena-Deck importieren/ })).toHaveAttribute("href", "/decks/import")
  })

  it("matches: newest first with result and turns", async () => {
    const db = await openTestDatabase()
    db.close()
    await putRaw(
      "matches",
      match({ startedAt: "2026-09-20T18:00:00.000Z", end: { result: "loss", reason: "Concede", turns: 1, conceded: true } }),
      match({ startedAt: "2026-09-22T18:00:00.000Z" }),
    )
    renderAt("/matches")
    const list = await screen.findByRole("list", { name: "Gespeicherte Partien" })
    const descriptions = within(list)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("[data-slot=item-description]")?.textContent ?? "")
    expect(descriptions[0]).toMatch(/22\.09\.2026.* · Sieg · 9 Züge$/)
    expect(descriptions[1]).toMatch(/20\.09\.2026.* · Niederlage · 1 Zug$/)
    expect(within(list).getAllByText("Muster-Deck gegen Forge-KI")).toHaveLength(2)
  })

  it("play: the stored decks to choose from, starting still says why it is not possible", async () => {
    const db = await openTestDatabase()
    await saveDeck(db, deck())
    await saveDeck(db, deck())
    db.close()
    renderAt("/play")
    expect(await screen.findByText("Noch kein Deck gewählt.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dein Deck wählen" })).toBeEnabled()
    expect(screen.getByRole("button", { name: /Partie starten/ })).toBeDisabled()
    expect(screen.getByText("Wähle zuerst dein Deck.")).toBeInTheDocument()
  })
})
