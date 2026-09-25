/*
 * Routes: one per surface (navigation.ts), all inside the app shell. Page
 * errors render inside the shell, so navigation stays usable. Pages that are
 * not needed at the start load on demand (route-based code splitting), so
 * they do not weigh on it: the deck import with its parser and report, a
 * deck's details, importing a deck's list again, and the game (/play/game,
 * under "Spielen" in the navigation).
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
          {
            // A static segment ranks before a dynamic one: /decks/import stays the import.
            path: "decks/:deckId",
            HydrateFallback: PageLoading,
            lazy: async () => ({ Component: (await import("@/decks/deck-details-page")).DeckDetailsPage }),
          },
          {
            path: "decks/:deckId/import",
            HydrateFallback: PageLoading,
            lazy: async () => ({ Component: (await import("@/decks/deck-update-page")).DeckUpdatePage }),
          },
          { path: "play", element: <PlayPage /> },
          {
            path: "play/game",
            HydrateFallback: PageLoading,
            lazy: async () => ({ Component: (await import("@/game/game-page")).GamePage }),
          },
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
