/*
 * Less motion (prompt 12, Bible §17 "reduced-motion support").
 *
 * OpenMana moves only through the shadcn components' own transitions (and,
 * from the game table on, what those prompts add). All of it stops when the
 * device asks for less motion (prefers-reduced-motion, e.g. Android's "remove
 * animations") - or when the player asks for it here, without changing the
 * whole device. The setting can only add a reduction, never overrule the
 * device.
 *
 * How it works: the shadcn components carry the motion-reduce: variant on
 * every animation and transition (src/components/ui, checked by
 * src/app/motion.test.ts), and src/index.css defines that variant as "the
 * device asks for it OR <html data-reduced-motion> is set"; the preferences
 * (src/app/preferences.tsx) set the attribute. Code that moves things itself
 * asks useReducedMotion().
 */
import { useSyncExternalStore } from "react"
import { defineSetting } from "@/storage/settings"

/** system: follow the device; reduce: always less motion. */
export type MotionPreference = "system" | "reduce"

export const MOTION = defineSetting<MotionPreference>("display.motion", "system", (value): value is MotionPreference => value === "system" || value === "reduce")

/** Set on <html> while the player asks for less motion (src/index.css: the motion-reduce variant). */
export const REDUCED_MOTION_ATTRIBUTE = "data-reduced-motion"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function deviceAsks(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches
}

/** The device asks for less motion (prefers-reduced-motion: reduce), kept current. */
export function useDeviceReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, deviceAsks, () => false)
}

/** Less motion now: the device asks for it, or the player does. */
export function reducedMotion(preference: MotionPreference, device: boolean): boolean {
  return device || preference === "reduce"
}
