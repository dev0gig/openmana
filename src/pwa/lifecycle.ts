/* One registration per page. No reload, navigation, skipWaiting or game input.
 * New versions wait for every old client to close, including other tabs/TWA. */
import { engineAssets } from "@/engine/engine-assets"

export interface PwaSnapshot {
  readonly status: "disabled" | "starting" | "ready" | "failed"
  readonly offlineEngine: boolean
  readonly downloading: boolean
  readonly updateWaiting: boolean
  readonly error: string | null
  readonly installAvailable: boolean
}
interface InstallEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
interface WorkerReply { ready?: boolean; error?: string; engineManifest?: string | null }
const manifestUrl = engineAssets.available ? engineAssets.manifestUrl : null
let snapshot: PwaSnapshot = { status: "disabled", offlineEngine: false, downloading: false, updateWaiting: false, error: null, installAvailable: false }
let registration: ServiceWorkerRegistration | null = null
let installEvent: InstallEvent | null = null
let started = false
const watchedRegistrations = new WeakSet<ServiceWorkerRegistration>()
const watchedWorkers = new WeakSet<ServiceWorker>()
const listeners = new Set<() => void>()
export const getPwaSnapshot = () => snapshot
export const subscribePwa = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
function patch(change: Partial<PwaSnapshot>) {
  snapshot = { ...snapshot, ...change }
  for (const listener of listeners) listener()
}

function ask(worker: ServiceWorker, type: "status" | "download-engine"): Promise<WorkerReply> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    // A multi-megabyte verified download needs more time than a status query.
    const timer = window.setTimeout(() => { channel.port1.close(); reject(new Error("Keine Antwort vom Offline-Speicher. Prüfe die Verbindung und versuche es erneut.")) }, type === "status" ? 15_000 : 10 * 60_000)
    channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
      clearTimeout(timer)
      channel.port1.close()
      if (event.data.error) reject(new Error(type === "download-engine" ? "Forge konnte nicht vollständig geladen und geprüft werden. Prüfe Verbindung und freien Speicher, dann versuche es erneut. Nach einem App-Update schließe zuvor alle OpenMana-Tabs und öffne die App erneut." : "Der Zustand des Offline-Speichers konnte nicht geprüft werden. Versuche es erneut."))
      else resolve(event.data)
    }
    worker.postMessage({ type, manifestUrl }, [channel.port2])
  })
}

async function readStatus() {
  const worker = navigator.serviceWorker.controller
  if (!worker) return
  try {
    const result = await ask(worker, "status")
    patch({ status: "ready", offlineEngine: result.ready === true && result.engineManifest === manifestUrl, updateWaiting: Boolean(registration?.waiting), error: null })
  } catch { patch({ offlineEngine: false, error: "Der Zustand des Offline-Speichers konnte nicht geprüft werden. Versuche es erneut." }) }
}

export function startPwa(): void {
  if (started) return
  started = true
  if (import.meta.env.OPENMANA_PWA_BUILD !== true || !globalThis.crossOriginIsolated || !("serviceWorker" in navigator)) return
  patch({ status: "starting" })
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    installEvent = event as InstallEvent
    patch({ installAvailable: true })
  })
  window.addEventListener("appinstalled", () => { installEvent = null; patch({ installAvailable: false }) })
  navigator.serviceWorker.addEventListener("controllerchange", () => { void readStatus() })
  // Re-check eviction and updates after returning from the background.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { void readStatus(); void checkPwaUpdate() }
  })
  registerWorker()
}

function registerWorker(): void {
  patch({ status: "starting", error: null })
  void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(async (value) => {
    registration = value
    const changed = () => { patch({ updateWaiting: Boolean(value.waiting) }); void readStatus() }
    const watchInstall = () => {
      const worker = value.installing
      if (!worker || watchedWorkers.has(worker)) return
      watchedWorkers.add(worker)
      worker?.addEventListener("statechange", () => {
        if (worker.state === "redundant") {
          patch({ status: navigator.serviceWorker.controller ? "ready" : "failed", error: navigator.serviceWorker.controller ? "Die neue App-Version konnte nicht vollständig geladen und geprüft werden. Die vorhandene Version bleibt erhalten; versuche es bei stabiler Verbindung erneut." : "Die App konnte nicht vollständig geladen und geprüft werden. Offline-Speicher wurde nicht eingerichtet; versuche es bei stabiler Verbindung erneut." })
        } else changed()
      })
    }
    if (!watchedRegistrations.has(value)) {
      watchedRegistrations.add(value)
      value.addEventListener("updatefound", watchInstall)
    }
    watchInstall()
    changed()
    await navigator.serviceWorker.ready
    await readStatus()
  }).catch(() => patch({ status: "failed", error: "Der Offline-Speicher konnte nicht eingerichtet werden. Prüfe die Verbindung und den verfügbaren Speicher, dann versuche es erneut." }))
}

export function retryPwa(): void {
  if (snapshot.status === "failed") registerWorker()
}

export async function downloadOfflineEngine(): Promise<void> {
  const worker = navigator.serviceWorker?.controller
  if (!worker || snapshot.downloading || !manifestUrl) return
  patch({ downloading: true, error: null })
  try {
    const reply = await ask(worker, "download-engine")
    patch({ offlineEngine: reply.ready === true && reply.engineManifest === manifestUrl })
  } catch { patch({ offlineEngine: false, error: "Forge konnte nicht vollständig geladen und geprüft werden. Prüfe Verbindung und freien Speicher, dann versuche es erneut. Nach einem App-Update schließe zuvor alle OpenMana-Tabs und öffne die App erneut." }) }
  finally { patch({ downloading: false }) }
}
export async function checkPwaUpdate(): Promise<void> {
  if (!registration) return
  try { await registration.update(); patch({ updateWaiting: Boolean(registration.waiting), error: null }) }
  catch { patch({ error: "Updateprüfung fehlgeschlagen. Offline bleibt die vorhandene Version verfügbar." }) }
}
export async function installPwa(): Promise<void> {
  const event = installEvent
  if (!event) return
  installEvent = null
  patch({ installAvailable: false })
  try { await event.prompt(); await event.userChoice }
  catch { patch({ error: "Die Installation konnte nicht geöffnet werden. Nutze das Installationsmenü deines Browsers." }) }
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  try { return typeof navigator.storage?.persist === "function" ? await navigator.storage.persist() : null }
  catch { return null }
}
