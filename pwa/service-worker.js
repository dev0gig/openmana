/* CONFIG and cache-runtime.js are inlined by vite/pwa.ts after all artifacts
 * are copied. Never skip waiting: ALL old tabs must close before activation. */
const shellName = `openmana-shell-${CONFIG.version}`
const engineName = `openmana-engine-${CONFIG.engineVersion}`
const marker = new URL("/__openmana_complete__", self.location.origin).href
const shellUrls = new Set(CONFIG.shell.map((entry) => new URL(entry.url, self.location.origin).href))
const engineUrls = new Set(CONFIG.engine.map((entry) => new URL(entry.url, self.location.origin).href))
let engineDownload = null

self.addEventListener("install", (event) => {
  event.waitUntil(completeCache(caches, shellName, CONFIG.shell, marker, CONFIG.headers))
})
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Activation occurs only after every predecessor client has gone.
    for (const name of await caches.keys()) {
      if ((name.startsWith("openmana-shell-") && name !== shellName) ||
          (name.startsWith("openmana-engine-") && name !== engineName)) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})

async function engineReady() {
  if (CONFIG.engine.length === 0) return false
  if (!await caches.has(engineName)) return false
  const cache = await caches.open(engineName)
  return Boolean(await cache.match(marker)) && (await Promise.all(CONFIG.engine.map((entry) => cache.match(entry.url)))).every(Boolean)
}

self.addEventListener("message", (event) => {
  const port = event.ports[0]
  if (!port || !["status", "download-engine"].includes(event.data?.type)) return
  event.waitUntil((async () => {
    try {
      if (event.data.type === "download-engine") {
        if (!CONFIG.engine.length) throw new Error("This build has no engine")
        if (event.data.manifestUrl !== CONFIG.engine.find((entry) => entry.url.endsWith("/engine-manifest.json"))?.url) throw new Error("App and offline engine versions differ; close all OpenMana tabs and reopen")
        engineDownload ??= completeCache(caches, engineName, CONFIG.engine, marker, CONFIG.headers).finally(() => { engineDownload = null })
        await engineDownload
      }
      port.postMessage({ ready: await engineReady(), version: CONFIG.version, engineVersion: CONFIG.engineVersion, engineManifest: CONFIG.engine.find((entry) => entry.url.endsWith("/engine-manifest.json"))?.url ?? null })
    } catch (error) {
      port.postMessage({ error: error instanceof Error ? error.message : String(error) })
    }
  })())
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname === "/sw.js") return
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cached = await (await caches.open(shellName)).match("/index.html")
      return cached ? isolated(cached, CONFIG.headers) : fetch(request)
    })())
  } else if (shellUrls.has(request.url)) {
    event.respondWith((async () => (await (await caches.open(shellName)).match(request)) ?? fetch(request))())
  } else if (engineUrls.has(request.url)) {
    event.respondWith((async () => {
      if (await engineReady()) {
        const cached = await (await caches.open(engineName)).match(request)
        if (cached) return isolated(cached, CONFIG.headers)
      }
      return fetch(request)
    })())
  }
})
