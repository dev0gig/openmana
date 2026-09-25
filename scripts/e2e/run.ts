/*
 * End-to-end test of the web app: the production build in real Chrome, with
 * the real Forge engine. No stand-ins.
 *
 *   npm run test:e2e                 build, then test
 *   npm run test:e2e -- --no-build   test the existing dist/
 *
 * Environment: OPENMANA_CHROME (default: Playwright's Chrome for Testing, as
 * the engine tests use). Report and screenshots: reports/e2e/.
 *
 *  1. HTTP: every response of `vite preview` carries the isolation headers,
 *     deep links fall back to the app, the engine is served with the right
 *     types; the dev server serves the engine the same way, and the engine
 *     boots through it.
 *  2. Every surface at phone, tablet and desktop size: renders, is
 *     cross-origin isolated, no console errors or failed requests, no
 *     horizontal overflow, the right navigation for the size, no serious
 *     accessibility violations (axe-core), a screenshot.
 *  3. The engine: nothing of it is loaded before the player asks; "Engine
 *     laden" boots the real engine to engine.ready (phone and desktop); it
 *     can be stopped again.
 *  4. PWA: Chrome reads the manifest without errors and reports no
 *     installability errors.
 *  5. Without COOP/COEP the app says the browser cannot run the engine and
 *     never downloads it.
 *  6. Local data in Chrome's real IndexedDB: a fresh database, loading a
 *     backup (merge), data surviving a reload, saving a backup (download)
 *     and loading it into a second, empty browser profile (same records),
 *     refused files, damaged records found and removed, another tab
 *     upgrading the database, site data cleared while open; and quota
 *     awareness with DevTools' quota override (localDataQuota).
 *  7. Card data: the card catalog is served like the engine (preview and dev
 *     server), nothing of it or of Scryfall is loaded before the player
 *     asks; installing it from the settings into the real IndexedDB (as the
 *     preview server sends it, unpacked by the browser, and as Vercel would,
 *     gzip), stopping and resuming, a damaged download refused; looking cards
 *     up with real pictures from Scryfall under COEP (German, the back of a
 *     double-faced card, English only, no Scryfall data, pictures offline);
 *     an image without CORS mode is blocked (why card-picture.tsx sets it);
 *     phone layout; axe-core.
 *  8. Deck import: from the decks page, the card data set up on the import
 *     page, then real Arena lists - English (every kind of card, Arena's set
 *     codes, a companion, resolved without asking Scryfall), German (German
 *     names, an ambiguous old translation chosen by the player, a printing
 *     that decides through Scryfall's real API, a French name identified by
 *     its printing, a card Forge does not know left out), a Commander list
 *     opened as a text file - checked, saved, found again after a reload and
 *     read back from IndexedDB; phone layout and axe-core. Then every saved
 *     deck is handed to the real Forge engine (WebAssembly in Node): Forge
 *     accepts every name, the game starts with exactly these cards and ends
 *     when the player concedes.
 */
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import type { AddressInfo } from "node:net"
import path from "node:path"
import { gunzipSync, gzipSync } from "node:zlib"
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright-core"
import { build, createServer, preview } from "vite"
import { SCHEMA_VERSION } from "../../src/storage/generated/constants.ts"
import { ISOLATION_HEADERS } from "../../vite/isolation-headers.ts"
import { playDeck, type StoredDeck } from "./engine-decks.ts"

const root = path.resolve(import.meta.dirname, "../..")
const dist = path.join(root, "dist")
const reportDir = path.join(root, "reports", "e2e")
const require = createRequire(import.meta.url)

interface Viewport {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly touch: boolean
  readonly scale: number
}

// Phone: Galaxy-class portrait (also the folded Fold7). Tablet: an unfolded
// foldable or tablet in portrait, touch. Desktop: mouse and keyboard.
const VIEWPORTS: readonly Viewport[] = [
  { name: "phone", width: 412, height: 915, touch: true, scale: 2.625 },
  { name: "tablet", width: 884, height: 1104, touch: true, scale: 2 },
  { name: "desktop", width: 1440, height: 900, touch: false, scale: 1 },
]

const ROUTES = [
  { path: "/", title: "OpenMana", heading: "OpenMana" },
  { path: "/decks", title: "Decks · OpenMana", heading: "Decks" },
  { path: "/decks/import", title: "Arena-Deck importieren · OpenMana", heading: "Arena-Deck importieren" },
  { path: "/play", title: "Spielen · OpenMana", heading: "Spielen" },
  { path: "/matches", title: "Partien · OpenMana", heading: "Partien" },
  { path: "/settings", title: "Einstellungen · OpenMana", heading: "Einstellungen" },
  { path: "/credits", title: "Credits · OpenMana", heading: "Credits" },
] as const

const failures: string[] = []
const report: Record<string, unknown> = { startedAt: new Date().toISOString() }

function check(condition: unknown, message: string): void {
  if (!condition) {
    failures.push(message)
    console.log(`  FAIL ${message}`)
  }
}

function log(message: string): void {
  console.log(message)
}

// ── 1. HTTP ───────────────────────────────────────────────────────────────

async function checkHeaders(base: string, label: string, pathname: string, expectType?: RegExp): Promise<Response> {
  const response = await fetch(new URL(pathname, base))
  check(response.status === 200, `${label} ${pathname}: status ${response.status}`)
  for (const [key, value] of Object.entries(ISOLATION_HEADERS)) {
    check(response.headers.get(key) === value, `${label} ${pathname}: ${key} = ${response.headers.get(key)}`)
  }
  if (expectType) {
    check(expectType.test(response.headers.get("content-type") ?? ""), `${label} ${pathname}: content-type ${response.headers.get("content-type")}`)
  }
  return response
}

function engineId(): string {
  const ids = fs.readdirSync(path.join(dist, "engine"))
  if (ids.length !== 1) throw new Error(`dist/engine should hold exactly one engine, found ${ids.join(", ") || "none"}`)
  return ids[0]!
}

interface CatalogManifest {
  readonly id: string
  readonly file: { readonly bytes: number; readonly uncompressedBytes: number; readonly lines: number }
  readonly source: { readonly updatedAt: string }
  readonly forge: { readonly forgeOnly: number }
  readonly counts: { readonly cards: number; readonly germanText: number; readonly germanImage: number; readonly sets: number; readonly forgeOnly: number }
}

/** The card catalog the build copied into dist/cards/<id>/. */
function catalogManifest(): CatalogManifest {
  const ids = fs.readdirSync(path.join(dist, "cards"))
  if (ids.length !== 1) throw new Error(`dist/cards should hold exactly one card catalog, found ${ids.join(", ") || "none"}`)
  return JSON.parse(fs.readFileSync(path.join(dist, "cards", ids[0]!, "card-catalog-manifest.json"), "utf8")) as CatalogManifest
}

/**
 * The catalog file as a server sends it: the preview server (sirv) marks the
 * .gz file Content-Encoding: gzip (then every client unpacks it), the dev
 * server and Vercel send it as application/gzip.
 */
async function checkCatalogFile(base: string, label: string, catalog: CatalogManifest): Promise<string | null> {
  const response = await checkHeaders(base, label, `/cards/${catalog.id}/card-catalog.jsonl.gz`)
  const encoding = response.headers.get("content-encoding")
  const bytes = (await response.arrayBuffer()).byteLength
  const expected = encoding === "gzip" ? catalog.file.uncompressedBytes : catalog.file.bytes
  check(bytes === expected, `${label} card catalog: ${bytes} bytes, expected ${expected} (Content-Encoding ${encoding})`)
  await (await checkHeaders(base, label, `/cards/${catalog.id}/card-catalog-manifest.json`, /^application\/json/)).arrayBuffer()
  return encoding
}

async function httpChecks(base: string, id: string): Promise<void> {
  log("HTTP (vite preview)")
  for (const pathname of ["/", "/play", "/credits", "/does-not-exist"]) {
    const response = await checkHeaders(base, "preview", pathname, /^text\/html/)
    check((await response.text()).includes('<div id="root">'), `preview ${pathname}: not the app's index.html`)
  }
  await (await checkHeaders(base, "preview", "/manifest.webmanifest", /^application\/manifest\+json/)).arrayBuffer()
  await (await checkHeaders(base, "preview", "/icons/icon-192.png", /^image\/png/)).arrayBuffer()
  const files: Record<string, RegExp> = {
    "engine-worker.js": /^text\/javascript/,
    "openmana-engine.js": /^text\/javascript/,
    "openmana-engine.js.wasm": /^application\/wasm/,
    "engine-manifest.json": /^application\/json/,
  }
  for (const [file, type] of Object.entries(files)) {
    const response = await checkHeaders(base, "preview", `/engine/${id}/${file}`, type)
    const bytes = (await response.arrayBuffer()).byteLength
    check(bytes === fs.statSync(path.join(dist, "engine", id, file)).size, `preview engine ${file}: ${bytes} bytes served`)
  }
  report["catalogPreviewEncoding"] = await checkCatalogFile(base, "preview", catalogManifest())
}

async function devServerChecks(browser: Browser, id: string): Promise<void> {
  log("HTTP and engine boot (vite dev server)")
  const server = await createServer({ root, configFile: path.join(root, "vite.config.ts"), logLevel: "warn", server: { host: "127.0.0.1", port: 0 } })
  await server.listen()
  try {
    const address = server.httpServer?.address() as AddressInfo
    const base = `http://127.0.0.1:${address.port}/`
    await (await checkHeaders(base, "dev", "/", /^text\/html/)).text()
    for (const file of ["engine-worker.js", "openmana-engine.js", "openmana-engine.js.wasm", "engine-manifest.json"]) {
      const response = await checkHeaders(base, "dev", `/engine/${id}/${file}`)
      const bytes = (await response.arrayBuffer()).byteLength
      check(bytes === fs.statSync(path.join(dist, "engine", id, file)).size, `dev engine ${file}: ${bytes} bytes served`)
    }
    const missing = await fetch(new URL(`/engine/${id}/secret.txt`, base))
    check(missing.status === 404, `dev: unknown engine file answered ${missing.status}`)
    check(missing.headers.get("Cross-Origin-Embedder-Policy") === "require-corp", "dev: 404 without isolation headers")
    await missing.arrayBuffer()
    const catalog = catalogManifest()
    const encoding = await checkCatalogFile(base, "dev", catalog)
    check(encoding === null, `dev: the card catalog is sent with Content-Encoding ${encoding}`)
    const unknownCard = await fetch(new URL(`/cards/${catalog.id}/secret.txt`, base))
    check(unknownCard.status === 404, `dev: unknown card catalog file answered ${unknownCard.status}`)
    await unknownCard.arrayBuffer()
    report["devServer"] = await engine(browser, base, id, VIEWPORTS[2]!, "dev")
  } finally {
    await server.close()
  }
}

// ── 2.-4. Browser ─────────────────────────────────────────────────────────

interface PageLog {
  /** Problems of the app itself: console errors and warnings of the page, page errors, failed requests. */
  errors: string[]
  /** What the engine worker printed (Forge's own log). Recorded, judged by the engine's own messages instead. */
  engineLog: string[]
  requests: string[]
  /** Every host the page requested something from. */
  hosts: Set<string>
}

function watch(page: Page): PageLog {
  const pageLog: PageLog = { errors: [], engineLog: [], requests: [], hosts: new Set() }
  page.on("console", (message) => {
    if (message.worker()) {
      pageLog.engineLog.push(`[${message.type()}] ${message.text()}`)
    } else if (message.type() === "error" || message.type() === "warning") {
      pageLog.errors.push(`[console.${message.type()}] ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => pageLog.errors.push(`[pageerror] ${error.message}`))
  page.on("requestfailed", (request) => pageLog.errors.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText ?? ""}`))
  page.on("response", (response) => {
    if (response.status() >= 400) pageLog.errors.push(`[http ${response.status()}] ${response.url()}`)
  })
  page.on("request", (request) => {
    const url = new URL(request.url())
    pageLog.requests.push(url.pathname)
    pageLog.hosts.add(url.host)
  })
  return pageLog
}

async function newContext(browser: Browser, viewport: Viewport): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.scale,
    isMobile: viewport.touch,
    hasTouch: viewport.touch,
    locale: "de-DE",
  })
}

interface AxeResult {
  violations: { id: string; impact: string | null; help: string; nodes: { target: string[] }[] }[]
}

async function accessibility(page: Page, label: string): Promise<number> {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") })
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<unknown> } }).axe
    return (await axe.run(document, { resultTypes: ["violations"] })) as AxeResult
  })
  for (const violation of result.violations) {
    const where = violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")
    if (violation.impact === "serious" || violation.impact === "critical") {
      check(false, `${label}: accessibility (${violation.impact}) ${violation.id}: ${violation.help} at ${where}`)
    } else {
      log(`  note ${label}: accessibility (${violation.impact}) ${violation.id}: ${violation.help} at ${where}`)
    }
  }
  return result.violations.length
}

/**
 * Two pictures per state: the first screen as the player sees it, and the
 * whole page (sticky bars then sit where the first screen ended).
 */
async function screenshots(page: Page, name: string): Promise<string[]> {
  await page.evaluate(() => window.scrollTo(0, 0))
  const first = path.join(reportDir, "screens", `${name}.png`)
  const full = path.join(reportDir, "screens", "full", `${name}.png`)
  await page.screenshot({ path: first })
  await page.screenshot({ path: full, fullPage: true })
  return [first, full].map((file) => path.relative(root, file))
}

async function surfaces(browser: Browser, base: string, id: string): Promise<void> {
  const results: unknown[] = []
  for (const viewport of VIEWPORTS) {
    log(`Surfaces at ${viewport.name} (${viewport.width}x${viewport.height}${viewport.touch ? ", touch" : ""})`)
    const context = await newContext(browser, viewport)
    const page = await context.newPage()
    const pageLog = watch(page)
    for (const route of ROUTES) {
      const label = `${viewport.name} ${route.path}`
      await page.goto(new URL(route.path, base).href, { waitUntil: "networkidle" })
      await page.getByRole("heading", { level: 1, name: route.heading }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      const state = await page.evaluate(() => ({
        isolated: globalThis.crossOriginIsolated,
        title: document.title,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        coarse: matchMedia("(pointer: coarse)").matches,
      }))
      check(state.isolated === true, `${label}: crossOriginIsolated is ${state.isolated}`)
      check(state.title === route.title, `${label}: title "${state.title}"`)
      check(state.overflow <= 0, `${label}: ${state.overflow}px horizontal overflow`)
      const tabBar = page.getByRole("navigation", { name: "Hauptnavigation" })
      const sidebarStart = page.locator('[data-slot="sidebar"] a', { hasText: "Start" })
      if (viewport.width < 768) {
        check(await tabBar.isVisible(), `${label}: tab bar hidden on a phone`)
        check(!(await sidebarStart.isVisible()), `${label}: sidebar visible on a phone`)
      } else {
        check(!(await tabBar.isVisible()), `${label}: tab bar visible on a large screen`)
        check(await sidebarStart.isVisible(), `${label}: sidebar hidden on a large screen`)
      }
      const violations = await accessibility(page, label)
      const shots = await screenshots(page, `${viewport.name}${route.path === "/" ? "-home" : route.path.replace(/\//g, "-")}`)
      results.push({ viewport: viewport.name, route: route.path, ...state, violations, screenshots: shots })
    }
    check(!pageLog.requests.some((p) => p.startsWith(`/engine/${id}/`)), `${viewport.name}: engine files requested without being asked`)
    check(!pageLog.requests.some((p) => p.startsWith("/cards/")), `${viewport.name}: card catalog requested without being asked`)
    check(pageLog.hosts.size === 1, `${viewport.name}: requests to other hosts without being asked: ${[...pageLog.hosts].join(", ")}`)
    for (const error of pageLog.errors) check(false, `${viewport.name}: ${error}`)
    await context.close()
  }
  report["surfaces"] = results
}

/**
 * Boots the real engine from the play page. `mode` says how the app is served:
 * preview (production chunks under /assets/) or dev (modules one by one).
 */
async function engine(browser: Browser, base: string, id: string, viewport: Viewport, mode: "preview" | "dev" = "preview"): Promise<Record<string, unknown>> {
  const label = mode === "dev" ? `dev ${viewport.name}` : viewport.name
  const artefacts = `/engine/${id}/`
  const isClientModule = (p: string) => (mode === "dev" ? p.startsWith("/engine/client/") : p.startsWith("/assets/") && p.endsWith(".js"))
  log(`Engine boot: ${label}`)
  const context = await newContext(browser, viewport)
  const page = await context.newPage()
  const pageLog = watch(page)
  await page.goto(new URL("/play", base).href, { waitUntil: "networkidle" })
  const panel = page.getByRole("region", { name: "Forge-Engine" })
  await panel.getByText("Nicht geladen").waitFor()
  const before = [...pageLog.requests]
  check(!before.some((p) => p.startsWith(artefacts)), `${label}: engine requested before "Engine laden"`)
  const scriptsBefore = new Set(before.filter(isClientModule))
  if (mode === "dev") check(scriptsBefore.size === 0, `${label}: engine client modules loaded before "Engine laden"`)
  const started = Date.now()
  await panel.getByRole("button", { name: "Engine laden" }).click()
  await panel.getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
  const wallMs = Date.now() - started
  const facts = await panel.locator("dl > div").evaluateAll((rows) => Object.fromEntries(rows.map((row) => [row.querySelector("dt")?.textContent ?? "", row.querySelector("dd")?.textContent ?? ""])))
  check(facts["Protokoll"] === "Version 3", `${label}: protocol fact ${facts["Protokoll"]}`)
  check(/^\d+(\.\d+)+ \([0-9a-f]{10}\)$/.test(facts["Forge"] ?? ""), `${label}: Forge fact ${facts["Forge"]}`)
  const engineRequests = pageLog.requests.filter((p) => p.startsWith(artefacts))
  for (const file of ["engine-worker.js", "openmana-engine.js", "openmana-engine.js.wasm"]) {
    check(engineRequests.some((p) => p.endsWith(`/${file}`)), `${label}: ${file} never requested`)
  }
  const lazyScripts = [...new Set(pageLog.requests.filter((p) => isClientModule(p) && !scriptsBefore.has(p)))]
  check(lazyScripts.length > 0, `${label}: the engine client was not loaded on demand`)
  const steps = await panel.getByRole("list", { name: "Startschritte der Engine" }).locator("li").evaluateAll((items) =>
    items.map((item) => ({ state: item.getAttribute("data-state"), text: item.textContent ?? "" })),
  )
  check(steps.length === 4 && steps.every((step) => step.state === "done"), `${label}: boot steps ${JSON.stringify(steps)}`)
  await panel.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(reportDir, "screens", `${label}-play-engine-ready.png`) })
  await page.screenshot({ path: path.join(reportDir, "screens", "full", `${label}-play-engine-ready.png`), fullPage: true })
  await panel.getByRole("button", { name: "Engine beenden" }).click()
  await panel.getByText("Nicht geladen").waitFor()
  for (const error of pageLog.errors) check(false, `${label} engine: ${error}`)
  await context.close()
  return { viewport: viewport.name, label, wallMs, facts, steps, engineRequests, lazyScripts, engineLog: pageLog.engineLog }
}

async function pwa(base: string, executablePath: string): Promise<void> {
  log("PWA manifest and installability")
  // Chrome does not judge installability in incognito contexts: use a real (temporary) profile.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "openmana-e2e-profile-"))
  const context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] })
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(base, { waitUntil: "networkidle" })
    const cdp = await context.newCDPSession(page)
    const manifest = (await cdp.send("Page.getAppManifest")) as { url: string; errors: { message: string }[] }
    check(manifest.url.endsWith("/manifest.webmanifest"), `manifest url ${manifest.url}`)
    check(manifest.errors.length === 0, `manifest errors: ${manifest.errors.map((e) => e.message).join("; ")}`)
    const installability = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: { errorId: string }[] }
    check(installability.installabilityErrors.length === 0, `installability errors: ${installability.installabilityErrors.map((e) => e.errorId).join(", ")}`)
    report["pwa"] = { manifestUrl: manifest.url, manifestErrors: manifest.errors, installabilityErrors: installability.installabilityErrors }
  } finally {
    await context.close()
    fs.rmSync(profile, { recursive: true, force: true })
  }
}

// ── 5. Without cross-origin isolation ─────────────────────────────────────

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".json": "application/json", ".wasm": "application/wasm" }

/** dist/ without COOP/COEP, with the SPA fallback. */
function plainServer(): Promise<http.Server> {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname)
    let file = path.join(dist, pathname)
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html")
    response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" })
    fs.createReadStream(file).pipe(response)
  })
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)))
}

async function withoutIsolation(browser: Browser): Promise<void> {
  log("Without cross-origin isolation")
  const server = await plainServer()
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  const context = await newContext(browser, VIEWPORTS[2]!)
  const page = await context.newPage()
  const pageLog = watch(page)
  try {
    await page.goto(base, { waitUntil: "networkidle" })
    await page.getByText("Dieser Browser kann die Forge-Engine nicht ausführen.").waitFor()
    await page.goto(new URL("/play", base).href, { waitUntil: "networkidle" })
    const panel = page.getByRole("region", { name: "Forge-Engine" })
    await panel.getByText("Nicht unterstützt").waitFor()
    check(await panel.getByText(/Cross-Origin-Isolation/).first().isVisible(), "no isolation: the missing isolation is not named")
    check((await panel.getByRole("button", { name: "Engine laden" }).count()) === 0, "no isolation: the engine is still offered")
    check(!pageLog.requests.some((p) => p.startsWith(`/engine/${engineId()}/`)), "no isolation: engine files were downloaded")
    await screenshots(page, "desktop-play-no-isolation")
    report["withoutIsolation"] = { isolated: await page.evaluate(() => globalThis.crossOriginIsolated) }
  } finally {
    await context.close()
    server.close()
  }
}

// ── 6. Local data (IndexedDB) ──────────────────────────────────────────────

interface SampleBackup {
  readonly bytes: Buffer
  readonly deckNames: readonly string[]
}

/**
 * A backup in the documented format (docs/implementation/07-indexeddb-storage.md):
 * gzip-compressed JSON Lines with header, records and end line. Sample data only.
 */
function sampleBackup(decks: number, prefix = "Muster-Deck"): SampleBackup {
  const now = new Date().toISOString()
  const deckRecords = Array.from({ length: decks }, (_, i) => ({
    id: randomUUID(),
    name: `${prefix} ${i + 1}`,
    format: "constructed",
    main: [
      { count: 20, name: "Mountain" },
      { count: 4, name: "Lightning Strike", set: "M19", collectorNumber: "152" },
    ],
    sideboard: [{ count: 2, name: "Shock" }],
    commander: [],
    source: { kind: "arena", text: "Deck\n20 Mountain\n4 Lightning Strike (M19) 152\n\nSideboard\n2 Shock", importedAt: now },
    createdAt: now,
    updatedAt: now,
  }))
  const forgeDeck = { name: `${prefix} 1`, main: [{ card: "Mountain", count: 20 }], sideboard: [], commander: [] }
  const matchId = randomUUID()
  const match = {
    id: matchId,
    status: "finished",
    format: "constructed",
    startedAt: now,
    endedAt: now,
    seed: 42,
    app: { version: "0.1.0", commit: null },
    engine: { id: "0c82db80023ac0cc", protocol: 3, forgeVersion: "2.0.15", forgeCommit: "e".repeat(40), buildCommit: "b".repeat(40), sourcesModified: false },
    human: { name: "Spieler", deckId: deckRecords[0]?.id ?? null, deck: forgeDeck },
    ai: { name: "Forge-KI", profile: "Default", deckId: null, deck: { ...forgeDeck, name: "KI-Deck" } },
    end: { result: "win", reason: "AllOpponentsLost", turns: 9, conceded: false },
  }
  const log = [0, 1].map((seq) => ({ matchId, seq, at: seq * 250, from: seq === 0 ? "engine" : "player", message: { type: seq === 0 ? "game.state" : "answer" } }))
  const settings = [{ key: "e2e.sample", value: { checked: true }, updatedAt: now }]
  const lines = [
    { type: "header", format: "openmana-backup", formatVersion: 1, schemaVersion: 1, createdAt: now, app: { version: "0.1.0", commit: null }, stores: ["decks", "settings", "matches", "matchLog"] },
    ...deckRecords.map((record) => ({ type: "record", store: "decks", record })),
    ...settings.map((record) => ({ type: "record", store: "settings", record })),
    { type: "record", store: "matches", record: match },
    ...log.map((record) => ({ type: "record", store: "matchLog", record })),
    { type: "end", counts: { decks: decks, settings: 1, matches: 1, matchLog: 2 }, records: decks + 4 },
  ]
  return { bytes: gzipSync(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`), deckNames: deckRecords.map((d) => d.name) }
}

/** Every record of the app's database, read past the app (the browser's own IndexedDB). */
function dumpDatabase(page: Page): Promise<Record<string, unknown[]>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("openmana")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const out: Record<string, unknown[]> = {}
    for (const name of Array.from(db.objectStoreNames)) {
      out[name] = await new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll()
        request.onsuccess = () => resolve(request.result as unknown[])
        request.onerror = () => reject(request.error)
      })
    }
    db.close()
    return out
  })
}

async function cardFacts(card: Locator): Promise<Record<string, string>> {
  return card
    .locator("dl > div")
    .evaluateAll((rows) => Object.fromEntries(rows.map((row) => [row.querySelector("dt")?.textContent ?? "", row.querySelector("dd")?.textContent ?? ""])))
}

async function openLocalData(page: Page, base: string): Promise<Locator> {
  await page.goto(new URL("/settings", base).href, { waitUntil: "networkidle" })
  const card = page.getByRole("region", { name: "Daten auf diesem Gerät" })
  await card.getByText("Bereit", { exact: true }).waitFor()
  await card.locator("dl").waitFor()
  return card
}

async function chooseBackup(card: Locator, name: string, bytes: Buffer): Promise<void> {
  await card.locator('input[type="file"]').setInputFiles({ name, mimeType: "application/gzip", buffer: bytes })
}

async function localData(browser: Browser, base: string): Promise<void> {
  log("Local data (IndexedDB)")
  const origin = new URL(base).origin
  const results: Record<string, unknown> = {}
  const context = await newContext(browser, VIEWPORTS[2]!)
  const page = await context.newPage()
  const pageLog = watch(page)
  const cdp = await context.newCDPSession(page)
  try {
    // A fresh browser profile: an empty database of schema version 1.
    let card = await openLocalData(page, base)
    const fresh = await cardFacts(card)
    check(fresh["Decks"] === "0" && fresh["Partien"] === "0", `local data: fresh database not empty ${JSON.stringify(fresh)}`)
    check((fresh["Datenbank"] ?? "").startsWith(`Version ${SCHEMA_VERSION}, angelegt am `), `local data: database fact ${fresh["Datenbank"]}`)
    check(fresh["Belegt"] !== "unbekannt" && fresh["Noch frei"] !== "unbekannt", `local data: space unknown ${JSON.stringify(fresh)}`)
    const databases = await page.evaluate(async () => ({ databases: await indexedDB.databases(), localStorage: localStorage.length }))
    check(databases.databases.some((db) => db.name === "openmana" && db.version === SCHEMA_VERSION), `local data: IndexedDB databases ${JSON.stringify(databases.databases)}`)
    check(databases.localStorage === 0, `local data: localStorage holds ${databases.localStorage} entries`)
    results["fresh"] = { facts: fresh, databases }

    // Load a backup: the dialog says what is in it and what changes; merge.
    const sample = sampleBackup(2)
    await chooseBackup(card, "openmana-sicherung-e2e.jsonl.gz", sample.bytes)
    const dialog = page.getByRole("dialog", { name: "Sicherung laden" })
    await dialog.getByText("2 neu").first().waitFor()
    results["importDialogAxe"] = await accessibility(page, "local data: import dialog")
    await page.screenshot({ path: path.join(reportDir, "screens", "desktop-settings-import-dialog.png") })
    await dialog.getByRole("button", { name: "Zusammenführen", exact: true }).click()
    await page.getByText("Sicherung geladen").waitFor()
    await dialog.waitFor({ state: "detached" })
    await card.locator("dd", { hasText: /^2$/ }).first().waitFor()
    const loaded = await cardFacts(card)
    check(loaded["Decks"] === "2" && loaded["Partien"] === "1" && loaded["Einstellungen"] === "1", `local data: after import ${JSON.stringify(loaded)}`)

    // The data survives a reload and the pages list it.
    await page.reload({ waitUntil: "networkidle" })
    await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
    const list = page.getByRole("list", { name: "Gespeicherte Decks" })
    await list.waitFor()
    const titles = await list.locator("[data-slot=item-title]").allTextContents()
    check(JSON.stringify(titles) === JSON.stringify(sample.deckNames), `local data: decks page lists ${JSON.stringify(titles)}`)
    await screenshots(page, "desktop-decks-with-data")
    await page.goto(new URL("/matches", base).href, { waitUntil: "networkidle" })
    await page.getByRole("list", { name: "Gespeicherte Partien" }).getByText(`${sample.deckNames[0]} gegen Forge-KI`).waitFor()
    await page.goto(new URL("/play", base).href, { waitUntil: "networkidle" })
    await page.getByText("2 Decks auf diesem Gerät – die Deckwahl folgt.").waitFor()
    results["decksAfterReload"] = titles

    // Save a backup: a real download in the documented format.
    card = await openLocalData(page, base)
    const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Sicherung speichern" }).click()])
    const saved = path.join(reportDir, "backup.jsonl.gz")
    await download.saveAs(saved)
    check(/^openmana-sicherung-\d{4}-\d{2}-\d{2}-\d{4}\.jsonl\.gz$/.test(download.suggestedFilename()), `local data: download name ${download.suggestedFilename()}`)
    const exported = gunzipSync(fs.readFileSync(saved)).toString("utf8").trimEnd().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
    const end = exported.at(-1) as { type?: string; counts?: Record<string, number> } | undefined
    check(exported[0]?.["type"] === "header" && exported[0]?.["schemaVersion"] === SCHEMA_VERSION, `local data: exported header ${JSON.stringify(exported[0])}`)
    check(end?.type === "end" && JSON.stringify(end.counts) === JSON.stringify({ decks: 2, settings: 1, matches: 1, matchLog: 2 }), `local data: exported end ${JSON.stringify(end)}`)
    await page.getByText("Sicherung erstellt").waitFor()
    await card.getByText("Letzte Sicherung").waitFor()
    check((await cardFacts(card))["Letzte Sicherung"] !== "noch keine", "local data: last backup not noted")
    const before = await dumpDatabase(page)
    results["export"] = { file: download.suggestedFilename(), bytes: fs.statSync(saved).size, lines: exported.length }

    // Load it into a second, empty browser profile: the very same records.
    const second = await newContext(browser, VIEWPORTS[0]!)
    const phone = await second.newPage()
    const phoneLog = watch(phone)
    const phoneCard = await openLocalData(phone, base)
    await chooseBackup(phoneCard, download.suggestedFilename(), fs.readFileSync(saved))
    const phoneDialog = phone.getByRole("dialog", { name: "Sicherung laden" })
    await phoneDialog.getByText("2 neu").first().waitFor()
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(overflow <= 0, `local data: import dialog overflows the phone by ${overflow}px`)
    results["phoneImportDialogAxe"] = await accessibility(phone, "local data: import dialog (phone)")
    await phone.screenshot({ path: path.join(reportDir, "screens", "phone-settings-import-dialog.png") })
    await phoneDialog.getByRole("button", { name: "Zusammenführen", exact: true }).click()
    await phone.getByText("Sicherung geladen").waitFor()
    const after = await dumpDatabase(phone)
    for (const store of ["decks", "settings", "matches", "matchLog"]) {
      const sort = (records: unknown[] | undefined) => JSON.stringify([...(records ?? [])].map((r) => JSON.stringify(r)).sort())
      check(sort(before[store]) === sort(after[store]), `local data: ${store} differs after the round trip`)
    }
    for (const error of phoneLog.errors) check(false, `local data (second profile): ${error}`)
    await second.close()

    // Files that are no (complete) backup are refused and change nothing.
    card = await openLocalData(page, base)
    await card.locator('input[type="file"]').setInputFiles({ name: "deck.txt", mimeType: "text/plain", buffer: Buffer.from("Deck\n4 Mountain\n") })
    await card.getByText("Diese Datei ist keine gültige OpenMana-Sicherung").waitFor()
    const whole = fs.readFileSync(saved)
    await chooseBackup(card, "abgeschnitten.jsonl.gz", whole.subarray(0, whole.length - 16))
    await card.getByText(/the file is damaged or incomplete \(it cannot be decompressed or decoded\)/).waitFor()
    check((await page.getByRole("dialog").count()) === 0, "local data: a refused file opened the import dialog")
    check(JSON.stringify(await dumpDatabase(page)) === JSON.stringify({ ...before, meta: (await dumpDatabase(page))["meta"] }), "local data: a refused file changed the data")

    // A damaged record is shown as damaged, found by the check and removed on confirmation.
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("openmana")
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("decks", "readwrite")
        transaction.objectStore("decks").put({ id: "e2e-damaged", name: "" })
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      db.close()
    })
    await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
    await page.getByRole("list", { name: "Gespeicherte Decks" }).getByText("beschädigt", { exact: true }).waitFor()
    card = await openLocalData(page, base)
    await card.getByRole("button", { name: "Daten prüfen" }).click()
    await card.getByText(/^1 Eintrag ist beschädigt/).waitFor()
    results["integrityAxe"] = await accessibility(page, "local data: integrity report")
    await screenshots(page, "desktop-settings-integrity")
    await card.getByRole("button", { name: "Beschädigte Einträge entfernen" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Endgültig entfernen" }).click()
    await card.getByText(/^Alles in Ordnung/).waitFor()
    check(((await dumpDatabase(page))["decks"] ?? []).length === 2, "local data: removal deleted more than the damaged record")

    // What Chrome reports by default (a static figure, see localDataQuota).
    results["defaultEstimate"] = await page.evaluate(async () => navigator.storage.estimate())

    // Another tab opens a newer database version: this tab lets go and says so; a reload refuses the newer data.
    const other = await context.newPage()
    await other.goto(new URL("/manifest.webmanifest", base).href)
    await other.evaluate(
      (newer) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("openmana", newer)
          request.onsuccess = () => {
            request.result.close()
            resolve()
          }
          request.onerror = () => reject(request.error)
        }),
      SCHEMA_VERSION + 1,
    )
    await card.getByText("OpenMana wurde in einem anderen Tab aktualisiert").waitFor()
    await page.getByText("Bitte lade die Seite neu.").waitFor()
    await card.getByRole("button", { name: "Neu laden" }).click()
    await card.getByText("Die lokalen Daten stammen von einer neueren OpenMana-Version").waitFor()
    await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
    await page.getByText("Die lokalen Daten stammen von einer neueren OpenMana-Version").waitFor()
    check((await page.getByText("Noch keine Decks").count()) === 0, "local data: an unreadable database is shown as empty")
    await screenshots(page, "desktop-decks-version-too-new")
    await other.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase("openmana")
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        }),
    )
    await other.close()

    // Site data cleared while the app is open: the browser closes the connection, the app says so.
    card = await openLocalData(page, base)
    await cdp.send("Storage.clearDataForOrigin", { origin, storageTypes: "indexeddb" })
    await card.getByText("Der Browser hat die lokale Datenbank geschlossen").waitFor()
    await card.getByRole("button", { name: "Neu laden" }).click()
    await card.getByText("Bereit", { exact: true }).waitFor()
    check((await cardFacts(card))["Decks"] === "0", "local data: data left after clearing site data")

    for (const error of pageLog.errors) check(false, `local data: ${error}`)
    results["requests"] = pageLog.requests.filter((p) => !p.startsWith("/assets/") && !p.startsWith("/engine/")).length
  } finally {
    await context.close()
  }
  report["localData"] = results
}

/**
 * Quota awareness against Chrome's StorageManager. By default Chrome reports
 * a static quota (usage + a fixed amount, against fingerprinting) and ignores
 * DevTools' quota override in navigator.storage.estimate(); with that feature
 * off, the override (DevTools' "simulate custom storage quota") is what the
 * page sees. The app must warn about little space and refuse an import that
 * does not fit - before writing anything.
 *
 * Measured with Chrome 153: IndexedDB still commits beyond the overridden
 * quota, so the browser's own QuotaExceededError cannot be provoked this way;
 * the report records it, and unit tests inject that error instead.
 */
async function localDataQuota(executablePath: string, base: string): Promise<void> {
  log("Local data: storage quota (DevTools override)")
  const origin = new URL(base).origin
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-features=StaticStorageQuota,IncognitoStaticStorageQuota"],
  })
  const context = await newContext(browser, VIEWPORTS[2]!)
  const page = await context.newPage()
  const pageLog = watch(page)
  const cdp = await context.newCDPSession(page)
  try {
    let card = await openLocalData(page, base)
    const usage = await page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0)
    await cdp.send("Storage.overrideQuotaForOrigin", { origin, quotaSize: usage + 32 * 1024 })
    card = await openLocalData(page, base)
    await card.getByText("Wenig Speicher frei").waitFor()
    const facts = await cardFacts(card)
    check(/^\d+(,\d)? KB$/.test(facts["Noch frei"] ?? ""), `quota: free space shown as ${facts["Noch frei"]}`)
    const big = sampleBackup(400, "Großes Deck")
    await chooseBackup(card, "gross.jsonl.gz", big.bytes)
    const dialog = page.getByRole("dialog", { name: "Sicherung laden" })
    await dialog.getByText("Dafür ist nicht genug Speicher frei").waitFor()
    check(await dialog.getByRole("button", { name: "Zusammenführen", exact: true }).isDisabled(), "quota: an import that does not fit can still be started")
    await screenshots(page, "desktop-settings-import-no-space")
    await dialog.getByRole("button", { name: "Abbrechen" }).click()
    const decks = await dumpDatabase(page)
    check((decks["decks"] ?? []).length === 0, "quota: something was written although the import was refused")
    // Does IndexedDB itself enforce the overridden quota? (Recorded, not required.)
    const enforced = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("openmana-quota-probe", 1)
        request.onupgradeneeded = () => request.result.createObjectStore("probe")
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const outcome = await new Promise<string>((resolve) => {
        const transaction = db.transaction("probe", "readwrite")
        transaction.objectStore("probe").put(crypto.getRandomValues(new Uint8Array(65_536)).join(","), 1)
        transaction.oncomplete = () => resolve("committed")
        transaction.onabort = () => resolve(`aborted: ${transaction.error?.name ?? "?"}`)
      })
      db.close()
      indexedDB.deleteDatabase("openmana-quota-probe")
      return outcome
    })
    report["localDataQuota"] = { overrideQuota: usage + 32 * 1024, facts, probeWriteBeyondQuota: enforced }
    await cdp.send("Storage.overrideQuotaForOrigin", { origin })
    for (const error of pageLog.errors) check(false, `quota: ${error}`)
  } finally {
    await context.close()
    await browser.close()
  }
}

// ── 7. Card data (catalog, lookup, Scryfall pictures) ──────────────────────

interface StoredCatalog {
  readonly counts: Record<string, number>
  readonly entry: { status?: string; version?: string; records?: number } | null
}

/** What the page's IndexedDB holds of the catalog, counted in the page (no records leave it). */
function storedCatalog(page: Page): Promise<StoredCatalog> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("openmana")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const count = (store: string) =>
      new Promise<number>((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).count()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    const counts: Record<string, number> = {}
    for (const store of ["scryfallCards", "scryfallSets", "forgeOnlyCards", "scryfallPrints"]) counts[store] = await count(store)
    const entry = await new Promise<StoredCatalog["entry"]>((resolve, reject) => {
      const request = db.transaction("cacheIndex").objectStore("cacheIndex").get("card-catalog")
      request.onsuccess = () => resolve((request.result as StoredCatalog["entry"]) ?? null)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return { counts, entry }
  })
}

async function openCardData(page: Page, base: string): Promise<Locator> {
  await page.goto(new URL("/settings", base).href, { waitUntil: "networkidle" })
  const card = page.getByRole("region", { name: "Kartendaten" })
  await card.locator("dl").waitFor()
  return card
}

/** Installs the catalog from the settings card; returns the wall time until "Bereit". */
async function installFromSettings(card: Locator, label: string): Promise<number> {
  const started = Date.now()
  await card.getByRole("button", { name: /Kartendaten einrichten|Erneut einrichten/ }).click()
  await card.getByText("Bereit", { exact: true }).waitFor({ timeout: 300_000 })
  const wallMs = Date.now() - started
  log(`  ${label}: installed in ${(wallMs / 1000).toFixed(1)} s`)
  return wallMs
}

async function lookUp(page: Page, name: string, choose: string): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: "Karte nachschlagen" })
  if (!(await dialog.isVisible())) {
    await page.getByRole("region", { name: "Kartendaten" }).getByRole("button", { name: "Karte nachschlagen" }).click()
    await dialog.waitFor()
  }
  const back = dialog.getByRole("button", { name: "Zur Trefferliste" })
  if (await back.isVisible()) await back.click()
  await dialog.getByLabel("Kartenname").fill(name)
  await dialog.getByRole("group", { name: "Gefundene Karten" }).getByRole("button", { name: choose, exact: true }).click()
  await dialog.getByRole("button", { name: "Zur Trefferliste" }).waitFor()
  return dialog
}

/** Waits until the dialog's main picture has loaded or failed; returns its state and URL. */
async function pictureOf(dialog: Locator): Promise<{ state: string | null; src: string | null; naturalWidth: number }> {
  const frame = dialog.locator("[data-slot=card-picture]").first()
  await frame.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const done = () => ["loaded", "failed", "missing"].includes(element.getAttribute("data-state") ?? "")
        if (done()) return resolve()
        const observer = new MutationObserver(() => {
          if (done()) {
            observer.disconnect()
            resolve()
          }
        })
        observer.observe(element, { attributes: true })
      }),
  )
  return frame.evaluate(async (element) => {
    const img = element.querySelector("img")
    // Loaded is not yet painted: wait until the picture is decoded (for the screenshots).
    if (element.getAttribute("data-state") === "loaded") await img?.decode().catch(() => undefined)
    return { state: element.getAttribute("data-state"), src: img?.getAttribute("src") ?? null, naturalWidth: img?.naturalWidth ?? 0 }
  })
}

async function cardData(browser: Browser, base: string): Promise<void> {
  log("Card data (catalog, lookup, Scryfall pictures)")
  const catalog = catalogManifest()
  const catalogPath = `/cards/${catalog.id}/card-catalog.jsonl.gz`
  const results: Record<string, unknown> = { catalog: catalog.id, bytes: catalog.file.bytes, uncompressedBytes: catalog.file.uncompressedBytes }
  const context = await newContext(browser, VIEWPORTS[2]!)
  const page = await context.newPage()
  const pageLog = watch(page)
  const scryfall: { url: string; status: number }[] = []
  page.on("response", (response) => {
    if (new URL(response.url()).host === "cards.scryfall.io") scryfall.push({ url: response.url(), status: response.status() })
  })
  try {
    // What the build brings; nothing is downloaded before the player asks.
    let card = await openCardData(page, base)
    await card.getByText("Nicht eingerichtet", { exact: true }).waitFor()
    const facts = await cardFacts(card)
    check(facts["Karten"] === catalog.counts.cards.toLocaleString("de-DE"), `card data: cards fact ${facts["Karten"]}`)
    check(facts["davon mit deutschem Text"] === catalog.counts.germanText.toLocaleString("de-DE"), `card data: German text fact ${facts["davon mit deutschem Text"]}`)
    check(facts["Auf diesem Gerät"] === "nicht eingerichtet", `card data: device fact ${facts["Auf diesem Gerät"]}`)
    check(!pageLog.requests.some((p) => p.startsWith("/cards/")), "card data: catalog downloaded before the player asked")
    results["factsBefore"] = facts
    results["settingsAxe"] = await accessibility(page, "card data: settings")

    // Install it (the preview server sends the file Content-Encoding: gzip: the browser unpacks it).
    const installMs = await installFromSettings(card, "preview (unpacked by the browser)")
    const stored = await storedCatalog(page)
    check(stored.counts["scryfallCards"] === catalog.counts.cards, `card data: ${stored.counts["scryfallCards"]} cards stored, ${catalog.counts.cards} expected`)
    check(stored.counts["scryfallSets"] === catalog.counts.sets, `card data: ${stored.counts["scryfallSets"]} sets stored`)
    check(stored.counts["forgeOnlyCards"] === catalog.counts.forgeOnly, `card data: ${stored.counts["forgeOnlyCards"]} Forge-only cards stored`)
    check(stored.entry?.status === "complete" && stored.entry.version === catalog.id, `card data: cache entry ${JSON.stringify(stored.entry)}`)
    check(pageLog.requests.filter((p) => p === catalogPath).length === 1, "card data: the catalog was not downloaded exactly once")
    check(await page.evaluate(() => globalThis.crossOriginIsolated), "card data: not cross-origin isolated after installing")
    results["install"] = { wallMs: installMs, stored, estimate: await page.evaluate(async () => navigator.storage.estimate()) }
    await screenshots(page, "desktop-settings-card-data-ready")

    // A German card with its German picture, straight from Scryfall under COEP.
    let dialog = await lookUp(page, "Blitzschlag", "Blitzschlag")
    const bolt = await pictureOf(dialog)
    check(bolt.state === "loaded" && bolt.naturalWidth > 0, `card data: Blitzschlag picture ${JSON.stringify(bolt)}`)
    check(bolt.src?.startsWith("https://cards.scryfall.io/display/front/") === true, `card data: picture URL ${bolt.src}`)
    await dialog.getByText("Spontanzauber").first().waitFor()
    await dialog.getByText("Lightning Bolt", { exact: true }).waitFor()
    results["dialogAxe"] = await accessibility(page, "card data: card details")
    await page.screenshot({ path: path.join(reportDir, "screens", "desktop-card-lookup-blitzschlag.png") })

    // The back of a double-faced card.
    dialog = await lookUp(page, "Geheimnisstöberer", "Geheimnisstöberer // Insekten-Scheußlichkeit")
    const front = await pictureOf(dialog)
    await dialog.getByRole("button", { name: "Rückseite zeigen" }).click()
    await dialog.getByRole("img", { name: "Kartenbild: Insekten-Scheußlichkeit" }).waitFor()
    const backSide = await pictureOf(dialog)
    check(front.state === "loaded" && front.src?.includes("/front/") === true, `card data: Delver front ${JSON.stringify(front)}`)
    check(backSide.state === "loaded" && backSide.src?.includes("/back/") === true, `card data: Delver back ${JSON.stringify(backSide)}`)
    await page.screenshot({ path: path.join(reportDir, "screens", "desktop-card-lookup-dfc-back.png") })

    // No German printing: English, and it says so.
    dialog = await lookUp(page, "Akki Lavarunner", "Akki Lavarunner // Tok-Tok, Volcano Born")
    await dialog.getByText("Keine deutsche Fassung – englisch").waitFor()
    check((await pictureOf(dialog)).state === "loaded", "card data: Akki Lavarunner picture did not load")

    // A card Forge knows without Scryfall data, and an unknown name.
    await dialog.getByRole("button", { name: "Zur Trefferliste" }).click()
    await dialog.getByLabel("Kartenname").fill("Drake Stone")
    await dialog.getByText("Keine Scryfall-Daten zu dieser Karte").waitFor()
    await dialog.getByLabel("Kartenname").fill("Zzyzx Unbekannt")
    await dialog.getByText("Keine Karte gefunden").waitFor()

    // Phone size: the dialog fits, and passes axe.
    await page.setViewportSize({ width: VIEWPORTS[0]!.width, height: VIEWPORTS[0]!.height })
    dialog = await lookUp(page, "Knochenmalmer", "Knochenmalmer-Riese // Stampfen")
    await pictureOf(dialog)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(overflow <= 0, `card data: the lookup dialog overflows the phone by ${overflow}px`)
    results["phoneDialogAxe"] = await accessibility(page, "card data: card details (phone)")
    await page.screenshot({ path: path.join(reportDir, "screens", "phone-card-lookup-adventure.png") })
    await page.setViewportSize({ width: VIEWPORTS[2]!.width, height: VIEWPORTS[2]!.height })

    // Why card-picture.tsx loads in CORS mode: without it, COEP blocks Scryfall's pictures.
    // From here until the pictures are reachable again, blocked pictures are on purpose.
    const blockedFrom = pageLog.errors.length
    const blocked = await page.evaluate(async (src) => {
      const load = (cors: boolean) =>
        new Promise<string>((resolve) => {
          const img = new Image()
          if (cors) img.crossOrigin = "anonymous"
          img.onload = () => resolve("loaded")
          img.onerror = () => resolve("blocked")
          img.src = `${src}${src.includes("?") ? "&" : "?"}probe=${cors ? "cors" : "no-cors"}`
        })
      return { withCors: await load(true), withoutCors: await load(false) }
    }, bolt.src ?? "")
    check(blocked.withCors === "loaded" && blocked.withoutCors === "blocked", `card data: COEP probe ${JSON.stringify(blocked)}`)
    results["coepProbe"] = blocked

    // Pictures unreachable (offline, blocked): the card's text takes their place.
    await context.route("https://cards.scryfall.io/**", (route) => route.abort("internetdisconnected"))
    dialog = await lookUp(page, "Wald", "Wald")
    const offline = await pictureOf(dialog)
    check(offline.state === "failed", `card data: offline picture state ${offline.state}`)
    await dialog.getByText("Das Bild konnte nicht geladen werden.").waitFor()
    await page.screenshot({ path: path.join(reportDir, "screens", "desktop-card-lookup-offline.png") })
    await context.unroute("https://cards.scryfall.io/**")
    await page.keyboard.press("Escape")
    // Chrome names no URL in its console message for a blocked resource: what was blocked on purpose is
    // told apart by when it happened and by its error (the COEP probe, the unreachable picture server).
    const onPurpose = pageLog.errors.splice(blockedFrom)
    const isBlockedPicture = (error: string) =>
      /net::ERR_BLOCKED_BY_RESPONSE\.NotSameOriginAfterDefaultedToSameOriginByCoep|net::ERR_INTERNET_DISCONNECTED/.test(error) ||
      error.startsWith("[requestfailed] https://cards.scryfall.io/")
    for (const error of onPurpose.filter((e) => !isBlockedPicture(e))) check(false, `card data (pictures blocked on purpose): ${error}`)
    check(onPurpose.some((e) => e.includes("NotSameOriginAfterDefaultedToSameOriginByCoep")), "card data: the COEP probe did not show up as blocked")
    results["blockedOnPurpose"] = onPurpose.length

    // The catalog stays on the device.
    card = await openCardData(page, base)
    await card.getByText("Bereit", { exact: true }).waitFor()
    check((await storedCatalog(page)).counts["scryfallCards"] === catalog.counts.cards, "card data: catalog gone after a reload")

    // "Daten prüfen" checks every record, the catalog's too: how long that takes.
    const local = await openLocalData(page, base)
    check((await cardFacts(local))["Kartendaten (Scryfall)"] === `${catalog.counts.cards.toLocaleString("de-DE")} Karten`, "card data: local data card does not count the catalog")
    const checkStarted = Date.now()
    await local.getByRole("button", { name: "Daten prüfen" }).click()
    await local.getByText(/^Alles in Ordnung/).waitFor({ timeout: 120_000 })
    results["integrityCheckMs"] = Date.now() - checkStarted

    // Every other problem of the page is one.
    for (const error of pageLog.errors) check(false, `card data: ${error}`)
    results["scryfallResponses"] = scryfall.length
    check(scryfall.every((response) => response.status === 200), `card data: Scryfall answered ${JSON.stringify(scryfall.filter((r) => r.status !== 200))}`)
    check([...pageLog.hosts].every((host) => host === new URL(base).host || host === "cards.scryfall.io"), `card data: requests to ${[...pageLog.hosts].join(", ")}`)
  } finally {
    await context.close()
  }

  // As Vercel sends it (application/gzip, unpacked by the app), stopped once, then resumed.
  const gzipContext = await newContext(browser, VIEWPORTS[2]!)
  const gzipPage = await gzipContext.newPage()
  const gzipLog = watch(gzipPage)
  const catalogFile = fs.readFileSync(path.join(dist, "cards", catalog.id, "card-catalog.jsonl.gz"))
  try {
    await gzipContext.route(`**${catalogPath}`, (route) =>
      route.fulfill({ status: 200, headers: { ...ISOLATION_HEADERS, "Content-Type": "application/gzip", "Cache-Control": "no-cache" }, body: catalogFile }),
    )
    const card = await openCardData(gzipPage, base)
    await card.getByRole("button", { name: "Kartendaten einrichten" }).click()
    await card.getByRole("button", { name: "Abbrechen" }).click()
    await card.getByText("Das Einrichten der Kartendaten wurde abgebrochen").waitFor()
    await card.getByText("Unvollständig", { exact: true }).waitFor()
    await screenshots(gzipPage, "desktop-settings-card-data-aborted")
    results["gzipInstall"] = { wallMs: await installFromSettings(card, "gzip (as Vercel sends it)") }
    check((await storedCatalog(gzipPage)).counts["scryfallCards"] === catalog.counts.cards, "card data (gzip): not every card stored")

    // A damaged download is refused; nothing counts as installed.
    const damaged = Buffer.from(catalogFile)
    damaged[Math.floor(damaged.length / 2)] = (damaged[Math.floor(damaged.length / 2)] ?? 0) ^ 0xff
    await gzipContext.unroute(`**${catalogPath}`)
    await gzipContext.route(`**${catalogPath}`, (route) => route.fulfill({ status: 200, headers: { ...ISOLATION_HEADERS, "Content-Type": "application/gzip" }, body: damaged }))
    await gzipPage.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("openmana")
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("cacheIndex", "readwrite")
        transaction.objectStore("cacheIndex").delete("card-catalog")
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      db.close()
    })
    const again = await openCardData(gzipPage, base)
    await again.getByRole("button", { name: "Kartendaten einrichten" }).click()
    await again.getByText("Die heruntergeladenen Kartendaten sind fehlerhaft").waitFor({ timeout: 120_000 })
    check((await storedCatalog(gzipPage)).entry?.status === "partial", "card data: a damaged catalog counts as installed")
    await screenshots(gzipPage, "desktop-settings-card-data-damaged")
    for (const error of gzipLog.errors) check(false, `card data (gzip): ${error}`)
  } finally {
    await gzipContext.close()
  }
  report["cardData"] = results
}

// ── 8. Deck import (Arena lists, real catalog, real Scryfall, real Forge) ──

/** An English Arena export: every kind of card, Arena's own set code (DAR = Scryfall's DOM), a companion also in the sideboard. */
const ENGLISH_LIST = [
  "About",
  "Name E2E Izzet",
  "",
  "Companion",
  "1 Lurrus of the Dream-Den (IKO) 226",
  "",
  "Deck",
  "4 Delver of Secrets (MID) 47",
  "4 Lightning Bolt (M11) 149",
  "2 Fire // Ice (MH2) 290",
  "3 Bonecrusher Giant (ELD) 115",
  "1 Valki, God of Lies (KHM) 114",
  "1 Hansk, Slayer Zealot (SLX) 22",
  "1 A-Luminarch Aspirant (ZNR) 24",
  "1 Rampant Growth (M10) 201",
  "20 Island (DAR) 254",
  "23 Mountain",
  "",
  "Sideboard",
  "1 Lurrus of the Dream-Den (IKO) 226",
  "2 Shock (M21) 159",
  "",
].join("\n")

/**
 * A German list: "Zwang" is the old German name of Duress and of Coercion
 * (the player chooses), "Wucherndes Wachstum" that of Rampant Growth and
 * Overgrowth (the printing decides, asked of Scryfall), "Foudre" is French
 * (the printing identifies it), Gale is an Alchemy card the pinned Forge
 * does not have (left out).
 */
const GERMAN_LIST = [
  "Deck",
  "4 Blitzschlag (M11) 149",
  "2 Foudre (M11) 149",
  "2 Zwang",
  "2 Wucherndes Wachstum (M10) 201",
  "4 Geheimnisstöberer (MID) 47",
  "1 Gale, Primeval Conduit (HBG) 6g",
  "46 Wald",
  "",
  "Sideboard",
  "2 Schock",
  "",
].join("\n")

/** A Brawl export (commander), opened as a text file with Windows line ends. */
const COMMANDER_LIST = ["About", "Name E2E Brawl", "", "Commander", "1 Valki, Gott der Lügen (KHM) 114", "", "Deck", "1 Blitzschlag", "1 Fire // Ice", "57 Gebirge", ""].join("\r\n")

/** A deck as the browser's IndexedDB holds it (the fields this test reads). */
interface SavedCard {
  readonly count: number
  readonly name: string
  readonly set?: string
  readonly collectorNumber?: string
  readonly oracleId?: string
}
interface SavedDeck extends StoredDeck {
  readonly source: { readonly text: string }
  readonly main: readonly SavedCard[]
}

const checkTimes: Record<string, number> = {}

/** Pastes and checks a list; records how long the check took until the report was final. */
async function checkList(page: Page, text: string, label: string): Promise<Locator> {
  await page.getByLabel("Liste im Arena-Format").fill(text)
  const started = Date.now()
  await page.getByRole("button", { name: "Liste prüfen" }).click()
  const summary = page.getByRole("region", { name: "Prüfbericht" })
  await summary.waitFor({ timeout: 60_000 })
  // Final once no update runs any more.
  await page.getByText(/^(Prüfe die Liste|Aktualisiere den Prüfbericht|Frage Scryfall)/).waitFor({ state: "detached", timeout: 60_000 })
  checkTimes[label] = Date.now() - started
  return summary
}

async function rowText(section: Locator, name: string): Promise<string> {
  return (await section.locator('[data-slot="item"]', { hasText: name }).first().textContent()) ?? ""
}

async function saveImported(page: Page, name: string | null): Promise<void> {
  if (name !== null) await page.getByLabel("Name des Decks").fill(name)
  await page.getByRole("button", { name: "Deck speichern" }).click()
  await page.getByRole("heading", { level: 1, name: "Decks" }).waitFor()
}

async function deckImport(browser: Browser, base: string, id: string): Promise<void> {
  log("Deck import (Arena lists, real catalog, real Scryfall, real Forge)")
  const results: Record<string, unknown> = {}
  const context = await newContext(browser, VIEWPORTS[2]!)
  const page = await context.newPage()
  const pageLog = watch(page)
  const api: { url: string; status: number; method: string }[] = []
  page.on("response", (response) => {
    if (new URL(response.url()).host === "api.scryfall.com") api.push({ url: response.url(), status: response.status(), method: response.request().method() })
  })
  let decks: SavedDeck[] = []
  try {
    // From the decks page; the card data are set up right on the import page.
    await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
    await page.getByRole("link", { name: "Arena-Deck importieren" }).first().click()
    await page.getByRole("heading", { level: 1, name: "Arena-Deck importieren" }).waitFor()
    const needed = page.getByRole("region", { name: "Kartendaten nötig" })
    await needed.waitFor()
    await page.getByLabel("Liste im Arena-Format").fill("4 Lightning Bolt")
    check(await page.getByRole("button", { name: "Liste prüfen" }).isDisabled(), "deck import: checking possible without card data")
    const installStarted = Date.now()
    await needed.getByRole("button", { name: "Kartendaten einrichten" }).click()
    await needed.waitFor({ state: "detached", timeout: 300_000 })
    results["catalogInstallMs"] = Date.now() - installStarted

    // 1. English: every line resolves through the catalog alone - Scryfall's API is not asked.
    let summary = await checkList(page, ENGLISH_LIST, "english (catalog only)")
    await summary.getByText("Alle Zeilen geklärt").waitFor()
    check((await page.getByLabel("Name des Decks").inputValue()) === "E2E Izzet", "deck import: the list's name was not taken")
    const englishFacts = await cardFacts(summary)
    check(englishFacts["Hauptdeck"] === "60 Karten" && englishFacts["Sideboard"] === "3 Karten", `deck import (English): counts ${JSON.stringify(englishFacts)}`)
    await summary.getByText("Gefährte „Lurrus aus der Traumhöhle“: Er liegt im Sideboard, wo Forge ihn zu Spielbeginn sucht.").waitFor()
    let main = page.getByRole("region", { name: "Hauptdeck" })
    const englishRows = {
      delver: await rowText(main, "Geheimnisstöberer"),
      bolt: await rowText(main, "Blitzschlag"),
      hansk: await rowText(main, "Hansk"),
      island: await rowText(main, "Insel"),
      rebalanced: await rowText(main, "A-Luminarch Aspirant"),
      growth: await rowText(main, "Wucherndes Wachstum"),
    }
    check(englishRows.delver.includes("Forge: Delver of Secrets") && englishRows.delver.includes("MID 47"), `deck import: Delver row ${englishRows.delver}`)
    check(englishRows.hansk.includes("Forge: Daryl, Hunter of Walkers"), `deck import: Hansk row ${englishRows.hansk}`)
    check(englishRows.island.includes("DOM 254"), `deck import: Arena's DAR not mapped to DOM: ${englishRows.island}`)
    check(englishRows.rebalanced.includes("ZNR 24"), `deck import: rebalanced row ${englishRows.rebalanced}`)
    check(englishRows.growth.includes("Forge: Rampant Growth"), `deck import: Rampant Growth row ${englishRows.growth}`)
    results["englishRows"] = englishRows
    check(api.length === 0, `deck import (English): Scryfall's API asked ${api.length} times`)
    results["englishAxe"] = await accessibility(page, "deck import: report (English)")
    await screenshots(page, "desktop-deck-import-report-english")
    await saveImported(page, null)
    await page.getByText("Deck „E2E Izzet“ gespeichert").waitFor()

    // 2. German: open lines, a choice, a printing asked of Scryfall, a line left out.
    await page.goto(new URL("/decks/import", base).href, { waitUntil: "networkidle" })
    summary = await checkList(page, GERMAN_LIST, "german (2 printings asked of Scryfall)")
    await summary.getByText("2 Zeilen sind noch zu klären").waitFor()
    check(await page.getByRole("button", { name: "Deck speichern" }).isDisabled(), "deck import: saving possible with open lines")
    const open = page.getByRole("region", { name: "Zu klären" })
    const openItems = await open.locator('[data-slot="item"]').allTextContents()
    check(
      openItems.length === 2 && openItems[0]!.includes("Zeile 4") && openItems[0]!.includes("Mehrdeutig") && openItems[1]!.includes("Zeile 7") && openItems[1]!.includes("Forge kennt diese Karte nicht"),
      `deck import: open lines ${JSON.stringify(openItems)}`,
    )
    main = page.getByRole("region", { name: "Hauptdeck" })
    const germanRows = { bolt: await rowText(main, "Blitzschlag"), growth: await rowText(main, "Wucherndes Wachstum") }
    check(germanRows.bolt.startsWith("6 ×"), `deck import: Blitzschlag and Foudre not added up: ${germanRows.bolt}`)
    check(germanRows.bolt.includes("Über Set und Sammlernummer erkannt"), `deck import: Foudre not identified by its printing: ${germanRows.bolt}`)
    check(germanRows.growth.includes("Forge: Rampant Growth") && germanRows.growth.includes("Set und Sammlernummer haben entschieden"), `deck import: Wucherndes Wachstum ${germanRows.growth}`)
    results["germanRows"] = germanRows
    results["germanOpenAxe"] = await accessibility(page, "deck import: report with open lines")
    await screenshots(page, "desktop-deck-import-report-german-open")

    // Phone: the report fits and passes axe.
    await page.setViewportSize({ width: VIEWPORTS[0]!.width, height: VIEWPORTS[0]!.height })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(overflow <= 0, `deck import: the report overflows the phone by ${overflow}px`)
    results["phoneAxe"] = await accessibility(page, "deck import: report (phone)")
    await screenshots(page, "phone-deck-import-report-german-open")
    await page.setViewportSize({ width: VIEWPORTS[2]!.width, height: VIEWPORTS[2]!.height })

    // "Zwang": the player chooses Duress.
    await open.getByRole("button", { name: "Karte wählen: Zeile 4" }).click()
    const dialog = page.getByRole("dialog", { name: "Welche Karte ist gemeint?" })
    await dialog.waitFor()
    const candidates = await dialog.getByRole("group", { name: "Karten zur Auswahl" }).getByRole("button").allTextContents()
    check(
      candidates.length === 2 && candidates.some((c) => c.includes("Forge: Duress")) && candidates.some((c) => c.includes("Forge: Coercion")),
      `deck import: candidates ${JSON.stringify(candidates)}`,
    )
    results["dialogAxe"] = await accessibility(page, "deck import: choosing a card")
    await page.screenshot({ path: path.join(reportDir, "screens", "desktop-deck-import-choose.png") })
    await dialog.getByRole("button").filter({ hasText: "Forge: Duress" }).click()
    await summary.getByText("Eine Zeile ist noch zu klären").waitFor()
    // Gale: the player leaves the line out.
    await open.getByRole("button", { name: "Zeile 7 weglassen" }).click()
    await summary.getByText("Alle Zeilen geklärt").waitFor()
    await page.getByText("Das Deck braucht einen Namen.").waitFor()
    check(await page.getByRole("button", { name: "Deck speichern" }).isDisabled(), "deck import: saving possible without a name")
    await saveImported(page, "E2E Deutsch")

    // 3. A Commander list opened as a text file: checked at once.
    await page.goto(new URL("/decks/import", base).href, { waitUntil: "networkidle" })
    await page.getByText("Füge zuerst eine Liste ein.").waitFor()
    await page.locator('input[type="file"]').setInputFiles({ name: "brawl.txt", mimeType: "text/plain", buffer: Buffer.from(`﻿${COMMANDER_LIST}`, "utf8") })
    summary = page.getByRole("region", { name: "Prüfbericht" })
    await summary.getByText("Alle Zeilen geklärt").waitFor({ timeout: 60_000 })
    check((await rowText(page.getByRole("region", { name: "Kommandeur" }), "Valki")).includes("Forge: Valki, God of Lies"), "deck import: commander row")
    await page.getByText(/Forge spielt das Deck als Commander-Partie/).waitFor()
    await saveImported(page, null)

    // Found again after a reload, and in IndexedDB as saved.
    await page.reload({ waitUntil: "networkidle" })
    const listed = await page.getByRole("list", { name: "Gespeicherte Decks" }).locator('[data-slot="item-title"]').allTextContents()
    await screenshots(page, "desktop-decks-after-import")
    results["checkMs"] = checkTimes
    check(["E2E Brawl", "E2E Deutsch", "E2E Izzet"].every((name) => listed.includes(name)), `deck import: decks listed ${JSON.stringify(listed)}`)
    decks = ((await dumpDatabase(page))["decks"] ?? []) as SavedDeck[]
    const byName = new Map(decks.map((deck) => [deck.name, deck]))
    const izzet = byName.get("E2E Izzet")
    const german = byName.get("E2E Deutsch")
    const brawl = byName.get("E2E Brawl")
    check(izzet?.source.text === ENGLISH_LIST, "deck import: the English list was not kept unchanged")
    check(izzet?.main.some((c) => c.name === "Island" && c.set === "dom" && c.collectorNumber === "254") === true, "deck import: Island (DAR) 254 not stored as dom 254")
    check(izzet?.main.some((c) => c.name === "A-Luminarch Aspirant" && c.oracleId === undefined) === true, "deck import: rebalanced card")
    check(JSON.stringify(izzet?.sideboard.map((c) => [c.count, c.name])) === JSON.stringify([[1, "Lurrus of the Dream-Den"], [2, "Shock"]]), `deck import: English sideboard ${JSON.stringify(izzet?.sideboard)}`)
    check(
      JSON.stringify(german?.main.map((c) => [c.count, c.name])) === JSON.stringify([[6, "Lightning Bolt"], [2, "Duress"], [2, "Rampant Growth"], [4, "Delver of Secrets"], [46, "Forest"]]),
      `deck import: German main ${JSON.stringify(german?.main)}`,
    )
    check(german?.source.text === GERMAN_LIST, "deck import: the German list (with the left-out line) was not kept")
    check(brawl?.format === "commander" && JSON.stringify(brawl.commander.map((c) => c.name)) === JSON.stringify(["Valki, God of Lies"]), `deck import: Brawl ${JSON.stringify(brawl?.commander)}`)
    results["stored"] = decks.map((deck) => ({ name: deck.name, format: deck.format, main: deck.main.length, sideboard: deck.sideboard.length, commander: deck.commander.length }))

    // Scryfall's API: only for the German list's two printings (and their German versions), each answered.
    results["scryfallApi"] = api
    const collections = api.filter((r) => r.url.endsWith("/cards/collection")).length
    check(collections === 1, `deck import: /cards/collection asked ${collections} times`)
    check(api.every((r) => r.status === 200 || (r.status === 404 && /\/cards\/[^/]+\/[^/]+\/de$/.test(r.url))), `deck import: Scryfall answered ${JSON.stringify(api)}`)
    // A 404 for a German version that does not exist is Scryfall's answer "none", not an error of the app.
    for (const error of pageLog.errors.filter((e) => !/api\.scryfall\.com\/cards\/[^/\s]+\/[^/\s]+\/de/.test(e) || !/404/.test(e))) check(false, `deck import: ${error}`)
    check([...pageLog.hosts].every((host) => [new URL(base).host, "cards.scryfall.io", "api.scryfall.com"].includes(host)), `deck import: requests to ${[...pageLog.hosts].join(", ")}`)
  } finally {
    await context.close()
  }

  // 4. Every saved deck in the real Forge engine (the module the build serves).
  const engineDir = path.join(dist, "engine", id)
  const played = []
  for (const deck of decks) {
    log(`  engine: ${deck.name} (${deck.format})`)
    const result = await playDeck(engineDir, deck)
    played.push(result)
    for (const problem of result.problems) check(false, `deck import: Forge and "${deck.name}": ${problem}`)
  }
  check(played.length === 3, `deck import: ${played.length} decks played in the engine`)
  results["engine"] = played
  report["deckImport"] = results
}

// ── Run ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  fs.rmSync(reportDir, { recursive: true, force: true })
  fs.mkdirSync(path.join(reportDir, "screens", "full"), { recursive: true })
  if (!process.argv.includes("--no-build")) {
    log("Build")
    await build({ root, configFile: path.join(root, "vite.config.ts"), logLevel: "warn" })
  }
  const id = engineId()
  report["engineId"] = id
  const server = await preview({ root, configFile: path.join(root, "vite.config.ts"), logLevel: "warn", preview: { host: "127.0.0.1", port: 0 } })
  const base = server.resolvedUrls?.local[0]
  if (!base) throw new Error("vite preview did not report its URL")
  const executablePath = process.env["OPENMANA_CHROME"] || chromium.executablePath()
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] })
  report["browser"] = `${path.basename(executablePath)} ${browser.version()}`
  log(`Chrome ${browser.version()}, app at ${base}`)
  try {
    await httpChecks(base, id)
    await devServerChecks(browser, id)
    await surfaces(browser, base, id)
    report["engine"] = [await engine(browser, base, id, VIEWPORTS[2]!), await engine(browser, base, id, VIEWPORTS[0]!)]
    await localData(browser, base)
    await localDataQuota(executablePath, base)
    await cardData(browser, base)
    await deckImport(browser, base, id)
    await pwa(base, executablePath)
    await withoutIsolation(browser)
  } finally {
    await browser.close()
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()))
  }
  report["failures"] = failures
  fs.writeFileSync(path.join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`)
  log(`\n${failures.length === 0 ? "E2E OK" : `E2E FAILED (${failures.length})`} – report: ${path.relative(root, path.join(reportDir, "report.json"))}`)
  process.exitCode = failures.length === 0 ? 0 : 1
}

await main()
