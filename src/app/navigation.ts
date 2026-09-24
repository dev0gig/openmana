/*
 * The app's surfaces, in one place: the sidebar (tablet/desktop), the
 * phone's tab bar and the router read this list.
 *
 * Phone: the tab bar holds the four surfaces of the repeated path (start,
 * decks, play, matches); settings sit behind the gear in the top bar and
 * credits behind settings, because rarely used things stay out of the way
 * (Anvil lesson). Tablet/desktop: the sidebar lists all six.
 */
import { History, House, Info, Layers, Settings, Swords, type LucideIcon } from "lucide-react"

export interface Destination {
  readonly path: string
  readonly label: string
  readonly icon: LucideIcon
  /** main: tab bar and upper sidebar group; more: lower sidebar group. */
  readonly group: "main" | "more"
}

export const DESTINATIONS: readonly Destination[] = [
  { path: "/", label: "Start", icon: House, group: "main" },
  { path: "/decks", label: "Decks", icon: Layers, group: "main" },
  { path: "/play", label: "Spielen", icon: Swords, group: "main" },
  { path: "/matches", label: "Partien", icon: History, group: "main" },
  { path: "/settings", label: "Einstellungen", icon: Settings, group: "more" },
  { path: "/credits", label: "Credits", icon: Info, group: "more" },
]

export const MAIN_DESTINATIONS = DESTINATIONS.filter((d) => d.group === "main")
export const MORE_DESTINATIONS = DESTINATIONS.filter((d) => d.group === "more")

/** "/" matches only itself, every other destination also its sub-paths. */
export function isActive(destination: Destination, pathname: string): boolean {
  if (destination.path === "/") return pathname === "/"
  return pathname === destination.path || pathname.startsWith(`${destination.path}/`)
}
