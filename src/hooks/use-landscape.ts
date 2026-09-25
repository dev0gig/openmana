/*
 * Whether the screen is in landscape (wider than high), kept current - the
 * same test as Tailwind's landscape: variant, for what CSS alone cannot place
 * (prompt 14: the card view comes from the bottom in portrait, from the side
 * in landscape). false where there is no screen (tests in jsdom).
 */
import { useSyncExternalStore } from "react"

const QUERY = "(orientation: landscape)"

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function landscape(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches
}

export function useLandscape(): boolean {
  return useSyncExternalStore(subscribe, landscape, () => false)
}
