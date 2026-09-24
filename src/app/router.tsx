/*
 * Routes: one per surface (navigation.ts), all inside the app shell. Page
 * errors render inside the shell, so navigation stays usable.
 */
import { createBrowserRouter, type RouteObject } from "react-router"
import { CreditsPage } from "@/routes/credits-page"
import { DecksPage } from "@/routes/decks-page"
import { HomePage } from "@/routes/home-page"
import { MatchesPage } from "@/routes/matches-page"
import { NotFoundPage } from "@/routes/not-found-page"
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
