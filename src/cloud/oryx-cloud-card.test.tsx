/*
 * The settings card "ORYX-Cloud": not there where the cloud is absent or
 * inactive (locally, in tests, previews); the SDK's status line; "Mit ORYX
 * verbinden" for a guest (it leaves for ORYX's consent page), "Verbindung auf
 * diesem Gerät trennen" when connected; problems in place. The real SDK
 * against the stand-in cloud (src/test/oryx-fixtures.ts).
 */
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, describe, expect, it } from "vitest"
import { routes } from "@/app/router"
import { Toaster } from "@/components/ui/sonner"
import { SCHEMA_VERSION } from "@/storage/generated/constants"
import { StorageSession } from "@/storage/storage-session"
import { connectedStorage, connectingSession, fakeOryxCloud, LOCAL_ADDRESS, TEST_CODE, testOryx, type FakeOryxCloud, type MemoryStorage } from "@/test/oryx-fixtures"
import { APP, deck } from "@/test/storage-fixtures"
import { CloudProvider } from "./cloud-context"
import { CloudSync, COLLECTION_SLOT } from "./cloud-sync"
import { OryxCloudCard } from "./oryx-cloud-card"

const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

async function cloudSync(
  cloud: FakeOryxCloud,
  options: { readonly href?: string; readonly storage?: MemoryStorage; readonly session?: MemoryStorage; readonly linked?: boolean } = {},
) {
  const { oryx, replaced } = testOryx(cloud, options)
  const sync = new CloudSync(oryx, { address: () => options.href ?? "https://openmana.vercel.app/settings" })
  await sync.start()
  if (options.linked) {
    const session = new StorageSession({ app: APP })
    session.open()
    cleanups.push(sync.attach(session), () => session.close())
  }
  return { sync, replaced }
}

function renderCard(sync: CloudSync | null) {
  return render(
    <>
      {sync ? (
        <CloudProvider cloud={sync}>
          <OryxCloudCard />
        </CloudProvider>
      ) : (
        <OryxCloudCard />
      )}
      <Toaster />
    </>,
  )
}

const region = () => screen.getByRole("region", { name: "ORYX-Cloud" })

describe("ORYX-Cloud card", () => {
  it("is not there without a cloud, nor where the cloud is inactive", async () => {
    const withoutCloud = renderCard(null)
    expect(screen.queryByRole("region", { name: "ORYX-Cloud" })).not.toBeInTheDocument()
    expect(screen.queryByText(/ORYX/)).not.toBeInTheDocument()
    withoutCloud.unmount()
    const { sync } = await cloudSync(fakeOryxCloud(), { href: LOCAL_ADDRESS })
    renderCard(sync)
    expect(screen.queryByRole("region", { name: "ORYX-Cloud" })).not.toBeInTheDocument()
    expect(screen.queryByText(/ORYX/)).not.toBeInTheDocument()
  })

  it("a guest: the status line, what is synced and what stays, and connecting (leaves for ORYX's consent page)", async () => {
    const cloud = fakeOryxCloud()
    const { sync, replaced } = await cloudSync(cloud)
    renderCard(sync)
    expect(within(region()).getByText("ORYX-Cloud: nicht verbunden")).toBeInTheDocument()
    expect(within(region()).getByText("Nicht verbunden")).toBeInTheDocument()
    expect(within(region()).getByText(/Abgeglichen werden deine Decks, das KI-Profil und die Deckwahl/)).toBeInTheDocument()
    expect(within(region()).getByText(/Nur auf diesem Gerät bleiben Kartensprache, „Bewegungen reduzieren“, Partien, Kartendaten und die Engine/)).toBeInTheDocument()
    expect(within(region()).queryByRole("button", { name: "Verbindung auf diesem Gerät trennen" })).not.toBeInTheDocument()
    const connect = within(region()).getByRole("button", { name: "Mit ORYX verbinden" })
    // The large shadcn button: 48 px on touch screens (44 px rule).
    expect(connect).toHaveAttribute("data-size", "lg")
    await userEvent.click(connect)
    await waitFor(() => expect(replaced).toHaveLength(1))
    expect(replaced[0]).toMatch(/^https:\/\/fellumrfugohnnvtxxye\.supabase\.co\/auth\/v1\/oauth\/authorize\?/)
  })

  it("connecting that cannot start says so in place", async () => {
    const cloud = fakeOryxCloud()
    cloud.clientId = null
    const { sync } = await cloudSync(cloud)
    renderCard(sync)
    await userEvent.click(within(region()).getByRole("button", { name: "Mit ORYX verbinden" }))
    expect(await within(region()).findByText("Verbinden ist gerade nicht möglich")).toBeInTheDocument()
    expect(within(region()).getByRole("button", { name: "Mit ORYX verbinden" })).toBeEnabled()
  })

  it("connected: the status line after the start's pull, and disconnecting on this device", async () => {
    const cloud = fakeOryxCloud()
    const { sync } = await cloudSync(cloud, { storage: connectedStorage(), linked: true })
    renderCard(sync)
    expect(within(region()).getByText("Verbunden")).toBeInTheDocument()
    await waitFor(() => expect(sync.getSnapshot().pull.state).toBe("done"))
    expect(within(region()).getByText(/^ORYX-Cloud: verbunden/)).toBeInTheDocument()
    const disconnect = within(region()).getByRole("button", { name: "Verbindung auf diesem Gerät trennen" })
    expect(disconnect).toHaveAttribute("data-size", "lg")
    await userEvent.click(disconnect)
    expect(await screen.findByText("Verbindung auf diesem Gerät getrennt")).toBeInTheDocument()
    await waitFor(() => expect(within(region()).getByText("ORYX-Cloud: nicht verbunden")).toBeInTheDocument())
    expect(within(region()).getByRole("button", { name: "Mit ORYX verbinden" })).toBeInTheDocument()
  })

  it("a collection of a newer OpenMana in the cloud: said, with a way on", async () => {
    const cloud = fakeOryxCloud()
    cloud.rows.set(COLLECTION_SLOT, {
      revision: 3,
      save_version: SCHEMA_VERSION + 1,
      save_data: { schemaVersion: SCHEMA_VERSION + 1, decks: [], deckTombstones: [], settings: [] },
      data_hash: "newer",
      summary: null,
      playtime_ms: null,
      device_label: null,
      updated_at: "2026-09-25T10:00:00.000Z",
      deleted_at: null,
    })
    const { sync } = await cloudSync(cloud, { storage: connectedStorage(), linked: true })
    renderCard(sync)
    expect(await within(region()).findByText("In der ORYX-Cloud liegt ein Stand einer neueren OpenMana-Version")).toBeInTheDocument()
    expect(within(region()).getByRole("button", { name: "Neu laden" })).toBeInTheDocument()
  })

  it("a cloud collection that fails its check: said, nothing changed here", async () => {
    const cloud = fakeOryxCloud()
    cloud.rows.set(COLLECTION_SLOT, {
      revision: 3,
      save_version: SCHEMA_VERSION,
      save_data: { schemaVersion: SCHEMA_VERSION, decks: [{ id: "kaputt" }], deckTombstones: [], settings: [] },
      data_hash: "broken",
      summary: null,
      playtime_ms: null,
      device_label: null,
      updated_at: "2026-09-25T10:00:00.000Z",
      deleted_at: null,
    })
    const { sync } = await cloudSync(cloud, { storage: connectedStorage(), linked: true })
    renderCard(sync)
    expect(await within(region()).findByText("Der Stand aus der ORYX-Cloud ließ sich nicht übernehmen")).toBeInTheDocument()
    expect(within(region()).getByText(/Auf diesem Gerät hat sich nichts geändert/)).toBeInTheDocument()
  })
})

describe("in the app", () => {
  it.each([
    [`?code=${TEST_CODE}&state=s1`, "Mit ORYX verbunden", /Deine Decks werden jetzt zwischen deinen Geräten abgeglichen/],
    ["?error=access_denied&state=s1", "Nicht mit ORYX verbunden", /Du hast die Verbindung nicht erlaubt/],
    ["?code=abgelaufen&state=s1", "Verbinden mit ORYX hat nicht geklappt", /Versuche es in den Einstellungen erneut/],
  ])("coming back from ORYX's consent page (%s) is said once, on the start page", async (query, title, description) => {
    const href = `https://openmana.vercel.app/${query}`
    const { sync } = await cloudSync(fakeOryxCloud(), { href, session: connectingSession("s1") })
    render(
      <CloudProvider cloud={sync}>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />
      </CloudProvider>,
    )
    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.getByText(description)).toBeInTheDocument()
    expect(screen.getAllByText(title)).toHaveLength(1)
  })

  it("the app shell links the cloud to the local database: the start's pull runs, and its decks show up without a reload", async () => {
    const cloud = fakeOryxCloud()
    const decks = [deck({ name: "Aus der Cloud A" }), deck({ name: "Aus der Cloud B" })].sort((a, b) => (a.id < b.id ? -1 : 1))
    cloud.rows.set(COLLECTION_SLOT, {
      revision: 2,
      save_version: SCHEMA_VERSION,
      save_data: { schemaVersion: SCHEMA_VERSION, decks, deckTombstones: [], settings: [] },
      data_hash: "from-another-device",
      summary: { Decks: 2 },
      playtime_ms: null,
      device_label: "Android · ORYX-App",
      updated_at: "2026-09-25T10:00:00.000Z",
      deleted_at: null,
    })
    const { sync } = await cloudSync(cloud, { storage: connectedStorage() })
    const router = createMemoryRouter(routes, { initialEntries: ["/settings"] })
    render(
      <CloudProvider cloud={sync}>
        <RouterProvider router={router} />
      </CloudProvider>,
    )
    // Below "Daten auf diesem Gerät".
    const localData = await screen.findByRole("region", { name: "Daten auf diesem Gerät" })
    expect(localData.compareDocumentPosition(region()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(sync.getSnapshot().pull).toEqual({ state: "done", result: "pulled" }))
    // The local data card reads the database again by itself (the storage session announced the write).
    await waitFor(() => expect(within(localData).getByText("Decks").nextElementSibling).toHaveTextContent("2"))
  })
})
