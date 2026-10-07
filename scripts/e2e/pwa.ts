/* Actual production SW, real CacheStorage/IndexedDB and Forge WASM in Chrome.
 * The isolated test server corrupts/intercepts bytes only in explicit failure
 * cases, then serves the real build for offline play and live update checks. */
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import type { AddressInfo } from "node:net"
import os from "node:os"
import path from "node:path"
import { gzipSync } from "node:zlib"
import { createRequire } from "node:module"
import { chromium, type Page } from "playwright-core"
import { build } from "vite"
import { SCHEMA_VERSION } from "../../src/storage/generated/constants.ts"
import { ISOLATION_HEADERS } from "../../vite/isolation-headers.ts"

const root = path.resolve(import.meta.dirname, "../..")
const dist = path.join(root, "dist")
const out = path.join(root, "reports/pwa")
const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex")
function corrupt(bytes: Buffer) { const changed = Buffer.from(bytes); changed[0] = changed[0]! ^ 1; return changed }
const require = createRequire(import.meta.url)
type Entry = { url: string; bytes: number; sha256: string }
type Config = { version: string; engineVersion: string; shell: Entry[]; engine: Entry[] }
const results: Record<string, unknown> = {}
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".wasm": "application/wasm", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json" }

function fixtureBackup() {
  const now = "2026-10-07T08:00:00.000Z"
  const id = randomUUID()
  // Explicit fixture deck, 60 real Forge-known names, passed to actual Forge.
  const record = { id, name: "Offline-Prüfdeck", format: "constructed", main: [{ count: 24, name: "Mountain" }, { count: 36, name: "Raging Goblin" }], sideboard: [], commander: [], source: { kind: "arena", text: "Deck\n24 Mountain\n36 Raging Goblin", importedAt: now }, createdAt: now, updatedAt: now }
  const settings = [
    { key: "play.humanDeck", value: id, updatedAt: now },
    { key: "play.aiDeck", value: { kind: "deck", deckId: id }, updatedAt: now },
  ]
  const lines = [
    { type: "header", format: "openmana-backup", formatVersion: 1, schemaVersion: SCHEMA_VERSION, createdAt: now, app: { version: "0.1.0", commit: null }, stores: ["decks", "settings", "matches", "matchLog"] },
    { type: "record", store: "decks", record }, ...settings.map((record) => ({ type: "record", store: "settings", record })),
    { type: "end", counts: { decks: 1, settings: 2, matches: 0, matchLog: 0 }, records: 3 },
  ]
  return gzipSync(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`)
}
async function userData(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("openmana"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const names = ["decks", "settings", "matches", "matchLog"]
    const tx = db.transaction(names)
    const values = await Promise.all(names.map((name) => new Promise<unknown[]>((resolve, reject) => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })))
    db.close()
    return Object.fromEntries(names.map((name, i) => [name, values[i]]))
  })
}
async function swStatus(page: Page) {
  return page.evaluate(async () => {
    const channel = new MessageChannel()
    return new Promise<{ ready: boolean; version: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("SW status timed out")), 15_000)
      channel.port1.onmessage = (event) => { clearTimeout(timer); channel.port1.close(); resolve(event.data) }
      navigator.serviceWorker.controller!.postMessage({ type: "status" }, [channel.port2])
    })
  })
}

async function main() {
  fs.mkdirSync(out, { recursive: true })
  if (!process.argv.includes("--no-build")) await build({ root })
  const originalSw = fs.readFileSync(path.join(dist, "sw.js"), "utf8")
  const config = JSON.parse(/^const CONFIG = (.+);\n/.exec(originalSw)![1]!) as Config
  const originalHtml = fs.readFileSync(path.join(dist, "index.html"))
  const updatedHtml = Buffer.from(originalHtml.toString().replace("</head>", '<meta name="pwa-e2e-update" content="verified" /></head>'))
  const next = { ...config, version: hash(config.version + "e2e-update"), shell: config.shell.map((entry) => entry.url === "/index.html" ? { url: entry.url, bytes: updatedHtml.length, sha256: hash(updatedHtml) } : entry) }
  let mode: "normal" | "corrupt" | "interrupt" | "initial-bad" | "bad-update" | "update" = "normal"
  const requests: string[] = []
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname
    requests.push(pathname)
    if (pathname === "/sw.js") {
      response.writeHead(200, { ...ISOLATION_HEADERS, "Content-Type": "text/javascript", "Cache-Control": "no-cache" })
      response.end(mode === "update" || mode === "bad-update" ? originalSw.replace(/^const CONFIG = .+;\n/, `const CONFIG = ${JSON.stringify(next)};\n`) : originalSw)
      return
    }
    let file = path.resolve(dist, `.${pathname}`)
    if (!file.startsWith(dist + path.sep)) file = path.join(dist, "index.html")
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html")
    response.writeHead(200, { ...ISOLATION_HEADERS, "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" })
    // Keep lengths equal: rejection must prove the hash check, not just size.
    if (mode === "initial-bad" && pathname === "/index.html") { response.end(corrupt(originalHtml)); return }
    if (mode === "corrupt" && pathname.endsWith("/engine-worker.js")) { response.end(corrupt(fs.readFileSync(file))); return }
    if (mode === "interrupt" && pathname.endsWith(".wasm")) {
      response.write(Buffer.alloc(100_000))
      setTimeout(() => response.destroy(), 20)
      return
    }
    if (file === path.join(dist, "index.html") && (mode === "update" || mode === "bad-update")) { response.end(mode === "bad-update" ? corrupt(updatedHtml) : updatedHtml); return }
    fs.createReadStream(file).pipe(response)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as AddressInfo).port
  const base = `http://127.0.0.1:${port}`
  const executablePath = process.env["OPENMANA_CHROME"] ?? chromium.executablePath()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ompwa-"))
  const context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, viewport: { width: 1440, height: 900 }, args: ["--no-sandbox", "--disable-gpu", "--host-resolver-rules=MAP *.vercel.app 0.0.0.0"] })
  // Observe actual worker replies without changing message contents or ports.
  await context.addInitScript(() => {
    const NativeChannel = window.MessageChannel
    const replies: unknown[] = []
    Object.assign(window, { __openmanaPwaReplies: replies })
    window.MessageChannel = class extends NativeChannel {
      constructor() {
        super()
        this.port1.addEventListener("message", (event) => {
          if (event.data && typeof event.data === "object" && ("ready" in event.data || "error" in event.data)) replies.push(event.data)
        })
      }
    }
  })
  const errors: string[] = []
  const preloadMismatches: string[] = []
  function watchPreload(page: Page) {
    page.on("console", (message) => { if (message.text().includes("cross-world service worker resource mismatch")) preloadMismatches.push(message.text()) })
  }
  context.on("page", (page) => { page.on("pageerror", (error) => errors.push(error.message)); watchPreload(page) })
  try {
    results["browser"] = context.browser()!.version()
    const page = context.pages()[0]!
    watchPreload(page)
    let workerStarts = 0
    page.on("worker", () => { workerStarts++ })
    page.on("pageerror", (error) => errors.push(error.message))
    console.log("PWA: initial shell, manifest, no eager engine")
    await page.goto(`${base}/settings`, { waitUntil: "networkidle" })
    assert.equal(await page.locator('link[rel="modulepreload"]').count(), 0, "module preloads can straddle first-visit service worker control")
    const card = page.getByRole("region", { name: "Installation und Offline-Speicher" })
    await card.getByText(/Die App ist gespeichert/).waitFor({ timeout: 60_000 })
    assert(!requests.some((url) => url.startsWith("/engine/")), "engine downloaded before explicit request")
    assert.equal((await swStatus(page)).ready, false)
    const cdp = await context.newCDPSession(page)
    const install = await cdp.send("Page.getInstallabilityErrors")
    assert.deepEqual(install.installabilityErrors, [])
    results["installability"] = install
    // User action, actual browser result (denial/approval both truthful).
    await card.getByRole("button", { name: "Dauerhaften Speicher anfragen" }).click()
    await card.getByRole("status").waitFor()
    results["persistence"] = await card.getByRole("status").textContent()
    console.log("PWA: corrupt and interrupted Forge download rollback")
    for (const failure of ["corrupt", "interrupt"] as const) {
      mode = failure
      await card.getByRole("button", { name: /Forge für offline laden/ }).click()
      await card.getByText("Offline-Speicher oder Updateprüfung fehlgeschlagen").waitFor({ timeout: 120_000 })
      assert.equal((await swStatus(page)).ready, false)
      assert(!(await page.evaluate(() => caches.keys())).some((name) => name.startsWith("openmana-engine-")), `${failure}: partial engine cache survived`)
      results[failure] = { ready: false, equalLengthHashCorruption: failure === "corrupt", error: await card.locator('[role="alert"]').textContent() }
    }
    mode = "normal"
    console.log("PWA: complete SHA-verified real engine download")
    await card.getByRole("button", { name: /Forge für offline laden/ }).click()
    try {
      await card.getByText(/App und Forge sind vollständig|Offline-Speicher oder Updateprüfung fehlgeschlagen/).waitFor({ timeout: 180_000 })
      assert(await card.getByText(/App und Forge sind vollständig/).isVisible(), "Real engine download reported failure")
    } catch (error) {
      results["downloadFailureDiagnostics"] = { text: await card.textContent(), requests: requests.slice(-20), errors,
        replies: await page.evaluate(() => (window as unknown as { __openmanaPwaReplies: unknown[] }).__openmanaPwaReplies),
        caches: await page.evaluate(async () => Promise.all((await caches.keys()).map(async (name) => ({ name, urls: (await (await caches.open(name)).keys()).map((request) => request.url) })))) }
      console.log("PWA download diagnostics", JSON.stringify(results["downloadFailureDiagnostics"]))
      throw error
    }
    assert.equal((await swStatus(page)).ready, true)
    results["engineCache"] = await page.evaluate(async () => {
      const name = (await caches.keys()).find((name) => name.startsWith("openmana-engine-"))!
      return { name, urls: (await (await caches.open(name)).keys()).map((request) => request.url) }
    })
    const backup = fixtureBackup()
    await page.locator('input[aria-label="Sicherungsdatei wählen"]').setInputFiles({ name: "offline-deck.jsonl.gz", mimeType: "application/gzip", buffer: backup })
    await page.getByRole("dialog").getByRole("button", { name: "Zusammenführen" }).click()
    await page.getByText("Sicherung geladen", { exact: true }).waitFor()
    const beforeOffline = await userData(page)
    console.log("PWA: HTTP cache cleared, browser network disabled, deep reload, real Forge game")
    await cdp.send("Network.clearBrowserCache")
    await context.setOffline(true)
    // Browser-level SW update fetches can bypass a page's emulated offline
    // setting. Also remove the actual server listener: no network bytes exist.
    await new Promise<void>((resolve) => server.close(() => resolve()))
    const requestsBeforeOffline = requests.length
    await page.goto(`${base}/settings`)
    await card.getByText(/App und Forge sind vollständig/).waitFor()
    assert.equal(await page.evaluate(() => crossOriginIsolated && typeof SharedArrayBuffer === "function"), true)
    assert.deepEqual(await userData(page), beforeOffline)
    const offlineHeaders = await page.evaluate(async () => {
      const cache = await caches.open((await caches.keys()).find((name) => name.startsWith("openmana-engine-"))!)
      const file = (await cache.keys()).find((request) => request.url.endsWith(".wasm"))!
      const response = await fetch(file.url)
      return { coop: response.headers.get("Cross-Origin-Opener-Policy"), coep: response.headers.get("Cross-Origin-Embedder-Policy"), type: response.headers.get("Content-Type") }
    })
    assert.deepEqual(offlineHeaders, { coop: "same-origin", coep: "require-corp", type: "application/wasm" })
    console.log("PWA: Credits and complete legal documents with the actual server stopped")
    await page.goto(`${base}/credits`)
    await page.getByRole("heading", { name: "Credits", exact: true }).waitFor()
    const offlineLegal = await page.evaluate(async () => {
      const results = []
      for (const url of ["/legal/LICENSE.txt", "/legal/SOURCE.txt", "/legal/THIRD-PARTY-NOTICES.txt"]) {
        const response = await fetch(url)
        const bytes = await response.arrayBuffer()
        const digest = await crypto.subtle.digest("SHA-256", bytes)
        results.push({ url, status: response.status, type: response.headers.get("Content-Type"), bytes: bytes.byteLength,
          sha256: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("") })
      }
      return results
    })
    for (const item of offlineLegal) {
      assert.equal(item.status, 200)
      assert(item.type?.startsWith("text/plain"))
      assert.equal(item.sha256, hash(fs.readFileSync(path.join(dist, item.url.slice(1)))))
    }
    for (const [name, file] of [["GPL-Lizenztext", "LICENSE.txt"], ["Alle Drittanbieter-Lizenzen und Hinweise", "THIRD-PARTY-NOTICES.txt"], ["Quelltext und Veröffentlichungsstand", "SOURCE.txt"]]) {
      await page.goto(`${base}/credits`)
      await page.getByRole("link", { name: name!, exact: true }).click()
      await page.waitForURL(`${base}/legal/${file}`)
      // Chrome normalizes CRLF in its plain-text DOM; the fetch hashes above
      // independently retain the exact original bytes.
      const expected = fs.readFileSync(path.join(dist, "legal", file!), "utf8").replaceAll("\r\n", "\n")
      await page.waitForFunction((length) => document.querySelector("pre")?.textContent?.length === length, expected.length)
      assert.equal(await page.locator("pre").textContent(), expected)
    }
    results["offlineLegal"] = { documents: offlineLegal, actualServerStopped: true, allDocumentLinksOpened: true }
    await page.goto(`${base}/play`)
    await page.getByRole("button", { name: "Partie starten" }).first().click()
    await page.waitForURL(/\/play\/game$/)
    await page.locator('[data-slot="game-decision"][data-question]').waitFor({ timeout: 240_000 })
    await page.waitForTimeout(200)
    const liveBefore = await userData(page)
    assert(liveBefore["matchLog"]?.some((row) => (row as { message: { type: string } }).message.type === "state"), "no actual Forge state")
    const question = await page.locator('[data-slot="game-decision"]').getAttribute("data-question")
    assert.equal(workerStarts, 1, "offline game must use exactly one actual engine Worker")
    assert.equal(requests.length, requestsBeforeOffline, "offline game reached the server")
    await page.screenshot({ path: path.join(out, "offline-real-forge.png") })
    results["offlineGame"] = { question, headers: offlineHeaders, logEntries: liveBefore["matchLog"]?.length, cacheCleared: true, networkOffline: true, actualServerStopped: true, workerStarts, serverRequestsDuringOffline: requests.length - requestsBeforeOffline }
    console.log("PWA: failed shell update and verified waiting update with a live match in another tab")
    await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve))
    await context.setOffline(false)
    const second = await context.newPage()
    await second.goto(`${base}/settings`, { waitUntil: "networkidle" })
    const secondCard = second.getByRole("region", { name: "Installation und Offline-Speicher" })
    await secondCard.getByText(/App und Forge sind vollständig/).waitFor()
    const oldStatus = await swStatus(page)
    mode = "bad-update"
    await secondCard.getByRole("button", { name: "Nach Updates suchen" }).click()
    await secondCard.getByText(/Die neue App-Version konnte nicht vollständig/).waitFor({ timeout: 60_000 })
    assert.equal((await swStatus(page)).version, oldStatus.version)
    assert.deepEqual(await userData(page), liveBefore)
    assert.equal(workerStarts, 1, "update started another engine Worker")
    results["failedShellUpdate"] = { versionUnchanged: true, originalTranscriptUnchanged: true }
    mode = "update"
    await secondCard.getByRole("button", { name: "Nach Updates suchen" }).click()
    await secondCard.getByText("Neue Version bereit").waitFor({ timeout: 60_000 })
    assert.equal((await swStatus(page)).version, oldStatus.version)
    assert.equal(await page.locator('[data-slot="game-decision"]').getAttribute("data-question"), question)
    assert.deepEqual(await userData(page), liveBefore)
    assert.equal(workerStarts, 1, "closing another tab replaced the engine Worker")
    await second.setViewportSize({ width: 360, height: 740 })
    await secondCard.scrollIntoViewIfNeeded()
    await second.screenshot({ path: path.join(out, "phone-update-waiting.png"), fullPage: true })
    await second.addScriptTag({ path: require.resolve("axe-core/axe.min.js") })
    const axe = await second.evaluate(async () => {
      const result = await (globalThis as unknown as { axe: { run(options: unknown): Promise<{ violations: unknown[] }> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })
      return result.violations
    })
    assert.deepEqual(axe, [])
    assert.equal(await second.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await second.close()
    // Closing just one tab cannot replace the controller of the live game.
    assert.equal((await swStatus(page)).version, oldStatus.version)
    assert.deepEqual(await userData(page), liveBefore)
    // End the real game via the app's existing confirmed action.
    await page.getByRole("button", { name: /^Menü/ }).click()
    const menu = page.getByRole("dialog", { name: "Partie" })
    await menu.getByRole("button", { name: "Aufgeben", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Aufgeben", exact: true }).click()
    await page.getByText("Verloren", { exact: true }).waitFor({ timeout: 60_000 })
    await page.waitForTimeout(200)
    const ended = await userData(page)
    assert(ended["matches"]?.some((row) => (row as { status: string }).status === "finished"), "actual finished recording missing")
    assert(ended["matchLog"]?.some((row) => (row as { message: { type: string } }).message.type === "game.end"), "original Forge outcome missing")
    await page.close()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const reopened = await context.newPage()
    await reopened.goto(`${base}/settings`, { waitUntil: "networkidle" })
    await reopened.waitForFunction(() => navigator.serviceWorker.controller !== null)
    assert.equal((await swStatus(reopened)).version, next.version)
    assert.deepEqual(await userData(reopened), ended)
    assert(!(await reopened.evaluate(() => caches.keys())).includes(`openmana-shell-${config.version}`), "old shell not cleaned after all clients closed")
    // Same engine version reuses verified bytes, no mandatory second download.
    assert.equal((await swStatus(reopened)).ready, true)
    results["update"] = { oldVersion: oldStatus.version, newVersion: next.version, unchangedQuestion: question, originalTranscriptUnchanged: true, closingOneTabKeptOldVersion: true, endedRecordingRetained: true, actualFinishedRecording: true, originalForgeOutcome: true, axeViolations: axe }
    console.log("PWA: eviction readiness recheck and offline absence")
    await reopened.evaluate(async () => { for (const name of await caches.keys()) if (name.startsWith("openmana-engine-")) await caches.delete(name) })
    await reopened.reload({ waitUntil: "networkidle" })
    await reopened.getByText(/Für Spiele ohne Netz musst du Forge noch herunterladen/).waitFor()
    assert.equal((await swStatus(reopened)).ready, false)
    assert.deepEqual(await userData(reopened), ended)
    results["eviction"] = { ready: false, userDataRetained: true }
    console.log("PWA: incomplete initial install stays failed and publishes no shell")
    mode = "initial-bad"
    const fresh = await context.browser()!.newContext()
    try {
      const initial = await fresh.newPage()
      await initial.goto(`${base}/settings`, { waitUntil: "networkidle" })
      const failedCard = initial.getByRole("region", { name: "Installation und Offline-Speicher" })
      await failedCard.getByText("Die App konnte nicht für offline gespeichert werden.").waitFor({ timeout: 60_000 })
      assert.equal(await initial.evaluate(() => navigator.serviceWorker.controller === null), true)
      assert(!(await initial.evaluate(() => caches.keys())).some((name) => name.startsWith("openmana-shell-")))
      const beforeRetry = await userData(initial)
      mode = "normal"
      await failedCard.getByRole("button", { name: "Offline-Speicher erneut versuchen" }).click()
      await failedCard.getByText(/Die App ist gespeichert/).waitFor({ timeout: 60_000 })
      assert.equal(await initial.evaluate(() => navigator.serviceWorker.controller !== null), true)
      assert.deepEqual(await userData(initial), beforeRetry)
      results["initialInstallFailure"] = { noController: true, noPublishedShell: true, visibleFailure: true, retrySucceeded: true, userDataRetained: true }
    } finally { await fresh.close() }
    assert.deepEqual(errors, [])
    assert.deepEqual(preloadMismatches, [])
    results["modulePreload"] = { disabled: true, crossWorldMismatches: preloadMismatches }
    results["pageErrors"] = errors
    results["result"] = "passed"
  } finally {
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(results, null, 2))
    await context.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    fs.rmSync(profile, { recursive: true, force: true })
  }
}
await main()
