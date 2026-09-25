/*
 * The whole screen for a page (prompt 13): while a page asks for it (the
 * running game), the app shell shows no sidebar, no top bar and no tab bar,
 * and the page fills the screen; leaving the page gives the frame back.
 */
import { render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { describe, expect, it } from "vitest"
import { AppShell } from "./app-shell"
import { useImmersive } from "./immersive"

function FullScreen() {
  useImmersive(true)
  return <h1>Spieltisch</h1>
}

function Framed() {
  return <h1>Seite</h1>
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <Framed /> },
          { path: "table", element: <FullScreen /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** What of the app's frame is there (the brand link is in the top bar and in the sidebar). */
const frame = () => ({
  tabBar: screen.queryAllByRole("navigation", { name: "Hauptnavigation" }).length,
  brandLinks: screen.queryAllByRole("link", { name: "OpenMana – Start" }).length,
  sidebar: document.querySelectorAll('[data-slot="sidebar"]').length,
})

describe("immersive pages", () => {
  it("a page that asks for the whole screen gets it: no sidebar, no top bar, no tab bar", async () => {
    renderAt("/table")
    const heading = await screen.findByRole("heading", { level: 1, name: "Spieltisch" })
    expect(frame()).toEqual({ tabBar: 0, brandLinks: 0, sidebar: 0 })
    expect(heading.parentElement).toHaveClass("h-dvh", "overflow-hidden")
  })

  it("leaving that page gives the frame back", async () => {
    const router = renderAt("/table")
    await screen.findByRole("heading", { level: 1, name: "Spieltisch" })
    await router.navigate("/")
    await screen.findByRole("heading", { level: 1, name: "Seite" })
    await waitFor(() => expect(frame().tabBar).toBe(1))
    expect(frame().brandLinks).toBeGreaterThan(0)
    expect(frame().sidebar).toBeGreaterThan(0)
  })

  it("other pages keep the frame", async () => {
    renderAt("/")
    await screen.findByRole("heading", { level: 1, name: "Seite" })
    expect(frame().tabBar).toBe(1)
    expect(frame().brandLinks).toBeGreaterThan(0)
  })
})
