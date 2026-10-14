/*
 * Is this app version's engine still on the server? The engine lives in a
 * folder named after its hash (engine/<hash>/); a deployment serves only its
 * own engine. An old app shell kept by the service worker (it waits until
 * every old tab is closed) then asks for an engine that no longer exists and
 * the boot fails with HTTP 404. After an engine abort the app asks the server
 * once for its own engine manifest - a structured answer (the HTTP status),
 * never the abort's prose - so the advice can name the real cure: close all
 * tabs, the new version takes over.
 */
import { useSyncExternalStore } from "react"
import { engineAssets } from "./engine-assets"

export type EngineRelease = "unknown" | "served" | "gone"

let release: EngineRelease = "unknown"
let checking: Promise<EngineRelease> | null = null
const listeners = new Set<() => void>()
const set = (value: EngineRelease) => {
  release = value
  for (const listener of listeners) listener()
}

export const getEngineRelease = () => release
export const subscribeEngineRelease = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const useEngineRelease = () => useSyncExternalStore(subscribeEngineRelease, getEngineRelease)

/**
 * HEAD bypasses the service worker (it answers GET only) and always reaches
 * the server. 404/410 means gone; any other answer or no network leaves the
 * question open - an offline player must not be told the app is outdated.
 */
export function checkEngineRelease(fetcher: typeof fetch = fetch): Promise<EngineRelease> {
  if (!engineAssets.available) return Promise.resolve(release)
  const url = engineAssets.manifestUrl
  checking ??= fetcher(url, { method: "HEAD", cache: "no-store" })
    .then((response) => (response.status === 404 || response.status === 410 ? "gone" : response.ok ? "served" : "unknown") as EngineRelease)
    .catch(() => "unknown" as EngineRelease)
    .then((value) => { set(value); return value })
    .finally(() => { checking = null })
  return checking
}
