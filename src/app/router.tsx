/*
 * Routes: one per surface (navigation.ts), all inside the app shell. Page
 * errors render inside the shell, so navigation stays usable. Pages used
 * rarely load on demand (route-based code splitting), so they do not weigh
 * on the start: the deck import with its parser and report.
 */
import { createBrowserRouter, type RouteObject } from "react-router"
import { CreditsPage } from "@/routes/credits-page"
import { DecksPage } from "@/routes/decks-page"
import { HomePage } from "@/routes/home-page"
import { MatchesPage } from "@/routes/matches-page"
import { NotFoundPage } from "@/routes/not-found-page"
import { PageLoading } from "@/routes/page-loading"
import { PlayPage } from "@/routes/play-page"
import { RouteError } from "@/routes/route-error"
import { SettingsPage } from "@/routes/settings-page"
import { AppShell } from "./app-shell"

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "decks", element: <DecksPage /> },
          {
            path: "decks/import",
            // The stand-in while the page's code loads must not be lazy itself.
            HydrateFallback: PageLoading,
            lazy: async () => ({ Component: (await import("@/decks/deck-import-page")).DeckImportPage }),
          },
          { path: "play", element: <PlayPage /> },
          { path: "matches", element: <MatchesPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "credits", element: <CreditsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(routes)
}
