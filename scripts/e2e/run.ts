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
 *     awareness with DevTools' quota override (localDataQuota). Off
 *     OpenMana's real address the ORYX cloud stays inactive: no settings
 *     card, nothing in Web Storage.
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
 *  9. Deck library, on the imported decks: the list (search by a German card
 *     name, format, order - kept in the address across a reload), a deck's
 *     details (parts, language, pictures of the named printings through
 *     Scryfall's real API, a card's full view), rename, export (clipboard and
 *     real downloads; the list imported again gives the same deck without a
 *     question to Scryfall), duplicate, import a deck's list again (the
 *     earlier choice kept, confirmed, same id), delete (confirmed; its
 *     deletion mark for the ORYX cloud merge in IndexedDB), choosing
 *     the decks for a game (random, another format, a mirror match, kept
 *     after a reload), axe-core; on a phone with touch the action bars above
 *     the tab bar and 44 px targets. The decks as they end up are the ones
 *     handed to the engine (8).
 * 10. Game session, on these decks in the browser with the real engine:
 *     opening "Spielen" prewarms the engine without a click; a Commander game
 *     and a Constructed game against a random deck start and show Forge's
 *     state and first decision (German); the game keeps running while the
 *     player moves around the app; conceding asks first and ends in
 *     "Verloren"; the spent engine goes and a fresh one is prewarmed; never
 *     two engines at once; reloading asks first and ends the game. In a fresh
 *     profile: an engine download that fails (the prewarm and the start show
 *     why, a retry plays), a deck with a card Forge does not know (Forge's
 *     report; the same engine plays the next game). On a phone: no overflow,
 *     touch sizes, the result's action bar above the tab bar. axe-core on
 *     every state.
 * 11. Preferences (prompt 12), in a fresh profile with these decks: the AI
 *     profile (Forge's four verified profiles and random, saved at once)
 *     reaches Forge - the running game shows the profile Forge confirmed;
 *     random draws one per game; the card language English shows the cards
 *     in English and boots the engine with English cards in Forge's texts
 *     (the real engine reports it), switching back replaces the warm engine
 *     (never two at once); dialogs animate by default and not with the
 *     setting, nor on a device that asks for less motion; the diagnostics
 *     report names every version and is copied as shown; on a phone every
 *     option is a 44 px target. axe-core on every state.
 * 12. The game table (prompt 13): the live games of 10 on the table - the
 *     whole screen without the app's frame, every region in view, the page
 *     never scrolls, the player's hand face up with real pictures, the AI's
 *     hand only as backs, the commander in the command zone, the table's menu
 *     around the app and back, conceding from the menu; resizing the window
 *     and turning the phone re-lay the table without touching the game. And
 *     recorded real states of the engine's test games (full battlefields,
 *     piles, a stack, blockers, fourteen attackers, the command zone) in the
 *     real table at six sizes (tableHarness), each with axe-core.
 * 13. The ORYX cloud on OpenMana's real address (Playwright serves the build
 *     as https://openmana.vercel.app; the ORYX cloud is a stand-in): a guest
 *     sees the card and sends nothing; connecting leaves for the consent page
 *     with PKCE; coming back exchanges the code, cleans the address, says
 *     so and merges this device's decks with the cloud's; a changed AI profile goes
 *     up, a setting of the device never, recorded matches never;
 *     disconnecting keeps the data. On a 360 px phone the card fits. axe-core.
 */
import { createRequire } from "node:module"
import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import type { AddressInfo } from "node:net"
import path from "node:path"
import { gunzipSync, gzipSync } from "node:zlib"
import { chromium, type Browser, type BrowserContext, type Locator, type Page, type Route } from "playwright-core"
// The real ORYX cloud and *.vercel.app resolve to nowhere in every browser this run starts: requests sent while a page
// is left (keepalive) bypass page.route and would otherwise reach Supabase (2026-09-26, refused there with 401).
const NO_REAL_CLOUD = "--host-resolver-rules=MAP fellumrfugohnnvtxxye.supabase.co 0.0.0.0, MAP *.vercel.app 0.0.0.0"
import { build, createServer, preview } from "vite"
import { PROTOCOL_VERSION } from "../../engine/protocol/src/generated/constants.ts"
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
  // A deck that is not there: the details page says so (loaded on demand, like the import).
  { path: "/decks/00000000-0000-4000-8000-000000000000", title: "Deck nicht gefunden · OpenMana", heading: "Deck nicht gefunden" },
  { path: "/play", title: "Spielen · OpenMana", heading: "Spielen" },
  // The game page without a game (a reload ends one): it says so.
  { path: "/play/game", title: "Partie · OpenMana", heading: "Partie" },
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
      // Where it came from: "Failed to load resource" alone does not say which resource.
      const where = message.location().url
      pageLog.errors.push(`[console.${message.type()}] ${message.text()}${where ? ` (${where})` : ""}`)
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
  check(facts["Protokoll"] === `Version ${PROTOCOL_VERSION}`, `${label}: protocol fact ${facts["Protokoll"]}`)
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
  const context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu", NO_REAL_CLOUD] })
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
    // Off OpenMana's real address the ORYX cloud is inactive: no card, no request, nothing stored (the SDK wrote no key above).
    check((await page.getByRole("region", { name: "ORYX-Cloud" }).count()) === 0, "local data: the ORYX-Cloud card shows off OpenMana's real address")
    check((await page.evaluate(() => sessionStorage.length)) === 0, "local data: sessionStorage is not empty")
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
    await page.getByText("Noch kein Deck gewählt.").waitFor()
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
    args: ["--no-sandbox", "--disable-gpu", "--disable-features=StaticStorageQuota,IncognitoStaticStorageQuota", NO_REAL_CLOUD],
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

    // 9. The library, on these decks; the engine then plays the decks as they end up.
    report["deckLibrary"] = await deckLibrary(browser, context, page, pageLog, base, api)
    decks = ((await dumpDatabase(page))["decks"] ?? []) as SavedDeck[]

    // 10. Games against Forge's AI with these decks, in the browser.
    report["gameSession"] = await gameSession(browser, page, pageLog, base, id, decks)
    // 11. The player's preferences with these decks and the real engine.
    report["preferences"] = await preferences(browser, base, id, decks)
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
  // The three imported decks (one renamed) and the copy whose list was imported again (9).
  check(played.length === 4, `deck import: ${played.length} decks played in the engine`)
  results["engine"] = played
  report["deckImport"] = results
}

// ── 9. Deck library (list, details, actions, export, import again, deck choice) ──

interface LibraryDeck extends SavedDeck {
  readonly id: string
  readonly createdAt: string
  readonly sideboard: readonly SavedCard[]
  readonly companion?: readonly SavedCard[]
}

/** The decks the library lists, in order (titles). */
async function libraryTitles(page: Page): Promise<string[]> {
  return page.getByRole("list", { name: "Gespeicherte Decks" }).getByRole("link").locator('[data-slot="item-title"]').allTextContents()
}

/** Waits until the library lists exactly these decks (the list follows the address and the database). */
async function expectTitles(page: Page, expected: readonly string[], label: string): Promise<void> {
  const deadline = Date.now() + 10_000
  let titles: string[] = []
  while (Date.now() < deadline) {
    titles = await libraryTitles(page)
    if (JSON.stringify(titles) === JSON.stringify(expected)) return
    await page.waitForTimeout(100)
  }
  check(false, `deck library (${label}): listed ${JSON.stringify(titles)}, expected ${JSON.stringify(expected)}`)
}

/** Until no dialog or menu is left: Radix keeps them for their closing animation (axe would see a closing one). */
async function overlaysGone(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]') === null)
}

/** An element's layout height (offsetHeight): what it takes on screen, unlike its box during a zoom animation. */
async function layoutHeight(locator: Locator): Promise<number> {
  return locator.evaluate((element) => (element as HTMLElement).offsetHeight)
}

async function deckMenu(page: Page, item: string): Promise<void> {
  await page.getByRole("button", { name: "Mehr" }).click()
  await page.getByRole("menuitem", { name: item }).click()
  // The menu fades out while what it opened appears (Radix keeps it in the DOM, half transparent):
  // checks that follow (axe's contrast above all) must see the page without it.
  await page.waitForFunction(() => document.querySelector('[role="menu"]') === null)
}

async function libraryDecks(page: Page): Promise<Map<string, LibraryDeck>> {
  const decks = ((await dumpDatabase(page))["decks"] ?? []) as LibraryDeck[]
  return new Map(decks.map((deck) => [deck.name, deck]))
}

/** A deck's cards as the engine gets them (and the printing), to compare decks. */
const cardsOf = (cards: readonly SavedCard[] | undefined) => JSON.stringify((cards ?? []).map((card) => [card.count, card.name, card.set ?? null, card.collectorNumber ?? null]))

/** Text of a download. */
async function downloaded(page: Page, click: () => Promise<void>): Promise<{ readonly name: string; readonly text: string }> {
  const [download] = await Promise.all([page.waitForEvent("download"), click()])
  const file = path.join(reportDir, download.suggestedFilename())
  await download.saveAs(file)
  return { name: download.suggestedFilename(), text: fs.readFileSync(file, "utf8") }
}

/** Scrolls through the page (pictures load lazily), then waits until no card picture in `scope` is still loading; how many loaded and failed. */
async function settlePictures(page: Page, scope: Locator): Promise<{ readonly loaded: number; readonly failed: number; readonly loading: number }> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    window.scrollTo(0, 0)
  })
  const deadline = Date.now() + 30_000
  let states: string[] = []
  while (Date.now() < deadline) {
    states = await scope.locator('[data-slot="card-picture"]').evaluateAll((pictures) => pictures.map((picture) => picture.getAttribute("data-state") ?? ""))
    if (!states.includes("loading")) break
    await page.waitForTimeout(200)
  }
  return { loaded: states.filter((s) => s === "loaded").length, failed: states.filter((s) => s === "failed").length, loading: states.filter((s) => s === "loading").length }
}

/** A backup of these decks in the documented format (to take them into another browser profile). */
function decksBackup(decks: readonly unknown[]): Buffer {
  const now = new Date().toISOString()
  const lines = [
    { type: "header", format: "openmana-backup", formatVersion: 1, schemaVersion: SCHEMA_VERSION, createdAt: now, app: { version: "0.1.0", commit: null }, stores: ["decks", "settings", "matches", "matchLog"] },
    ...decks.map((record) => ({ type: "record", store: "decks", record })),
    { type: "end", counts: { decks: decks.length, settings: 0, matches: 0, matchLog: 0 }, records: decks.length },
  ]
  return gzipSync(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`)
}

async function deckLibrary(browser: Browser, context: BrowserContext, page: Page, pageLog: PageLog, base: string, api: readonly { url: string; status: number; method: string }[]): Promise<Record<string, unknown>> {
  log("Deck library (list, details, actions, export, import again, deck choice)")
  const results: Record<string, unknown> = {}
  const errorsBefore = pageLog.errors.length
  const apiBefore = api.length

  // 1. The list: every deck with format, counts, commander and companion.
  await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
  await expectTitles(page, ["E2E Brawl", "E2E Deutsch", "E2E Izzet"], "all")
  const list = page.getByRole("list", { name: "Gespeicherte Decks" })
  const row = async (name: string) => (await list.getByRole("link").filter({ has: page.getByText(name, { exact: true }) }).textContent()) ?? ""
  const rows = { izzet: await row("E2E Izzet"), brawl: await row("E2E Brawl"), german: await row("E2E Deutsch") }
  check(rows.izzet.includes("Constructed · 60 Karten · Sideboard 3") && rows.izzet.includes("Gefährte: Lurrus aus der Traumhöhle"), `deck library: Izzet row ${rows.izzet}`)
  check(rows.brawl.includes("Commander · 59 Karten · Kommandeur 1") && rows.brawl.includes("Kommandeur: Valki, Gott der Lügen"), `deck library: Brawl row ${rows.brawl}`)
  check(rows.german.includes("Constructed · 60 Karten · Sideboard 2"), `deck library: German row ${rows.german}`)
  results["rows"] = rows

  // Search by a card's German name; the query is in the address and survives a reload.
  await page.getByRole("searchbox", { name: "Suchen" }).fill("Zwang")
  await expectTitles(page, ["E2E Deutsch"], "search Zwang")
  check(new URL(page.url()).search === "?q=Zwang", `deck library: address ${page.url()}`)
  await page.reload({ waitUntil: "networkidle" })
  await expectTitles(page, ["E2E Deutsch"], "search after reload")
  check((await page.getByRole("searchbox", { name: "Suchen" }).inputValue()) === "Zwang", "deck library: search lost on reload")
  await page.getByText("1 von 3 Decks").waitFor()
  await page.getByRole("searchbox", { name: "Suchen" }).fill("")
  await page.getByRole("radio", { name: "Commander" }).click()
  await expectTitles(page, ["E2E Brawl"], "format Commander")
  await page.getByRole("radio", { name: "Alle" }).click()
  await expectTitles(page, ["E2E Brawl", "E2E Deutsch", "E2E Izzet"], "format all")
  results["listAxe"] = await accessibility(page, "deck library: list")
  await screenshots(page, "desktop-deck-library")

  // 2. A deck's details: parts, language, the pictures of the named printings (Scryfall's real API).
  await list.getByRole("link").filter({ has: page.getByText("E2E Izzet", { exact: true }) }).click()
  await page.getByRole("heading", { level: 1, name: "E2E Izzet" }).waitFor()
  await page.getByText(/^Lade (das Bild|die Bilder)/).waitFor({ state: "detached", timeout: 60_000 })
  const main = page.getByRole("region", { name: "Hauptdeck" })
  const companion = page.getByRole("region", { name: "Gefährte" })
  check((await main.textContent())?.includes("60 Karten") === true, "deck library: main deck not 60 cards")
  check((await companion.textContent())?.includes("Lurrus aus der Traumhöhle") === true, "deck library: companion not shown")
  check((await page.getByRole("region", { name: "Sideboard" }).textContent())?.includes("3 Karten") === true, "deck library: sideboard not 3 cards")
  const language = (await page.getByRole("region", { name: "Kartensprache" }).textContent()) ?? ""
  check(/\d+ von \d+ Karten nicht ganz deutsch/.test(language) && language.includes("A-Luminarch Aspirant"), `deck library: language ${language}`)
  const pictures = await settlePictures(page, page.locator("main"))
  check(pictures.loaded >= 12 && pictures.failed === 0, `deck library: pictures ${JSON.stringify(pictures)}`)
  const printCalls = api.slice(apiBefore)
  check(printCalls.filter((call) => call.url.endsWith("/cards/collection")).length <= 1, `deck library: /cards/collection asked ${printCalls.length} times`)
  check(printCalls.every((call) => call.status === 200 || (call.status === 404 && /\/cards\/[^/]+\/[^/]+\/de$/.test(call.url))), `deck library: Scryfall answered ${JSON.stringify(printCalls)}`)
  results["details"] = { pictures, scryfallApi: printCalls, language }
  // A card's full view.
  await main.getByRole("button", { name: /Geheimnisstöberer/ }).click()
  const cardDialog = page.getByRole("dialog", { name: "4 × Geheimnisstöberer" })
  await cardDialog.waitFor()
  check((await settlePictures(page, cardDialog)).loaded === 1, "deck library: the card view shows no picture")
  results["cardAxe"] = await accessibility(page, "deck library: card view")
  await page.keyboard.press("Escape")
  await overlaysGone(page)
  results["detailsAxe"] = await accessibility(page, "deck library: details")
  await screenshots(page, "desktop-deck-details")

  // 3. Rename.
  await deckMenu(page, "Umbenennen")
  const renameDialog = page.getByRole("dialog", { name: "Deck umbenennen" })
  await renameDialog.getByLabel("Name des Decks").fill("E2E Izzet Tempo")
  await renameDialog.getByRole("button", { name: "Speichern" }).click()
  await page.getByRole("heading", { level: 1, name: "E2E Izzet Tempo" }).waitFor()

  // 4. Export: copy and real downloads, both lists.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(base).origin })
  await deckMenu(page, "Exportieren")
  const exportDialog = page.getByRole("dialog", { name: "Deck exportieren" })
  await exportDialog.waitFor()
  const listText = exportDialog.getByLabel("Deckliste")
  const normalized = await listText.inputValue()
  check(normalized.startsWith("About\nName E2E Izzet Tempo\n\nCompanion\n1 Lurrus of the Dream-Den (IKO) 226\n\nDeck\n4 Delver of Secrets (MID) 47\n"), `deck library: export starts ${JSON.stringify(normalized.slice(0, 160))}`)
  check(normalized.includes("\n20 Island (DAR) 254\n") && normalized.includes("\n1 Daryl, Hunter of Walkers") && normalized.includes("\n\nSideboard\n1 Lurrus of the Dream-Den (IKO) 226\n"), `deck library: export ${JSON.stringify(normalized)}`)
  results["exportAxe"] = await accessibility(page, "deck library: export")
  await page.screenshot({ path: path.join(reportDir, "screens", "desktop-deck-export.png") })
  await exportDialog.getByRole("button", { name: "Kopieren" }).click()
  await page.getByText("Liste kopiert").waitFor()
  check((await page.evaluate(() => navigator.clipboard.readText())) === normalized, "deck library: clipboard differs from the list")
  const normalizedFile = await downloaded(page, () => exportDialog.getByRole("button", { name: "Als Textdatei speichern" }).click())
  check(normalizedFile.name === "E2E Izzet Tempo.txt" && normalizedFile.text === normalized, `deck library: download ${normalizedFile.name}`)
  await exportDialog.getByRole("radio", { name: "Importierte Liste, unverändert" }).click()
  check((await listText.inputValue()) === ENGLISH_LIST, "deck library: the imported list is not shown unchanged")
  const originalFile = await downloaded(page, () => exportDialog.getByRole("button", { name: "Als Textdatei speichern" }).click())
  check(originalFile.name === "E2E Izzet Tempo (Original).txt" && originalFile.text === ENGLISH_LIST, `deck library: original download ${originalFile.name}`)
  await page.keyboard.press("Escape")
  results["export"] = { files: [normalizedFile.name, originalFile.name], normalizedLines: normalized.split("\n").length }

  // The exported list imported again: the same deck, every line clear, no question to Scryfall.
  const apiBeforeRoundTrip = api.length
  await page.goto(new URL("/decks/import", base).href, { waitUntil: "networkidle" })
  const roundTrip = await checkList(page, normalized, "export imported again")
  await roundTrip.getByText("Alle Zeilen geklärt").waitFor()
  check(api.length === apiBeforeRoundTrip, "deck library: importing the exported list asked Scryfall")
  await saveImported(page, "E2E Rundreise")
  let stored = await libraryDecks(page)
  const tempo = stored.get("E2E Izzet Tempo")
  const again = stored.get("E2E Rundreise")
  for (const part of ["main", "sideboard", "companion"] as const) {
    check(cardsOf(again?.[part]) === cardsOf(tempo?.[part]), `deck library: round trip ${part} ${cardsOf(again?.[part])} vs ${cardsOf(tempo?.[part])}`)
  }
  check(tempo?.companion?.length === 1, `deck library: the companion was not kept: ${JSON.stringify(tempo?.companion)}`)

  // 5. Duplicate.
  await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
  await list.getByRole("link").filter({ has: page.getByText("E2E Deutsch", { exact: true }) }).click()
  await page.getByRole("heading", { level: 1, name: "E2E Deutsch" }).waitFor()
  await deckMenu(page, "Duplizieren")
  await page.getByRole("heading", { level: 1, name: "E2E Deutsch (Kopie)" }).waitFor()
  stored = await libraryDecks(page)
  const original = stored.get("E2E Deutsch")
  const copy = stored.get("E2E Deutsch (Kopie)")
  check(copy !== undefined && copy.id !== original?.id && page.url().endsWith(`/decks/${copy.id}`), `deck library: copy ${copy?.id} at ${page.url()}`)
  check(cardsOf(copy?.main) === cardsOf(original?.main) && copy?.source.text === GERMAN_LIST, "deck library: the copy differs from its original")

  // 6. Import the copy's list again: "Zwang" as before, one line left out, confirmed; same id and creation.
  const apiBeforeUpdate = api.length
  await deckMenu(page, "Erneut importieren")
  await page.getByRole("heading", { level: 1, name: "Deck neu importieren" }).waitFor()
  const input = page.getByLabel("Liste im Arena-Format")
  check((await input.inputValue()) === GERMAN_LIST, "deck library: the import does not start from the saved list")
  const edited = GERMAN_LIST.replace("46 Wald", "44 Wald\n2 Insel")
  let summary = await checkList(page, edited, "import again")
  await summary.getByText("Eine Zeile ist noch zu klären").waitFor()
  const duress = await rowText(page.getByRole("region", { name: "Hauptdeck" }), "Zwang")
  check(duress.includes("Forge: Duress") && duress.includes("Wie bisher im Deck"), `deck library: Zwang not decided as before: ${duress}`)
  await page.getByRole("region", { name: "Zu klären" }).getByRole("button", { name: "Zeile 7 weglassen" }).click()
  summary = page.getByRole("region", { name: "Prüfbericht" })
  await summary.getByText("Alle Zeilen geklärt").waitFor()
  check((await page.getByLabel("Name des Decks").inputValue()) === "E2E Deutsch (Kopie)", "deck library: the deck's name is not kept")
  await page.getByRole("button", { name: "Deck ersetzen" }).click()
  const confirmReplace = page.getByRole("alertdialog", { name: "„E2E Deutsch (Kopie)“ ersetzen?" })
  await confirmReplace.waitFor()
  results["replaceAxe"] = await accessibility(page, "deck library: confirm replacing")
  await confirmReplace.getByRole("button", { name: "Deck ersetzen" }).click()
  await page.getByRole("heading", { level: 1, name: "E2E Deutsch (Kopie)" }).waitFor()
  check(api.length === apiBeforeUpdate, `deck library: importing again asked Scryfall ${api.length - apiBeforeUpdate} times (the printings are kept 30 days)`)
  stored = await libraryDecks(page)
  const replaced = stored.get("E2E Deutsch (Kopie)")
  check(replaced?.id === copy?.id && replaced?.createdAt === copy?.createdAt && replaced?.source.text === edited, "deck library: the replaced deck lost its id, creation or list")
  check(
    cardsOf(replaced?.main) === JSON.stringify([[6, "Lightning Bolt", "m11", "149"], [2, "Duress", null, null], [2, "Rampant Growth", "m10", "201"], [4, "Delver of Secrets", "mid", "47"], [44, "Forest", null, null], [2, "Island", null, null]]),
    `deck library: replaced main ${cardsOf(replaced?.main)}`,
  )

  // 7. Delete, after confirming.
  const deletedId = stored.get("E2E Rundreise")?.id
  await page.goto(new URL(`/decks/${deletedId}`, base).href, { waitUntil: "networkidle" })
  await page.getByRole("heading", { level: 1, name: "E2E Rundreise" }).waitFor()
  await deckMenu(page, "Löschen")
  const confirmDelete = page.getByRole("alertdialog", { name: "„E2E Rundreise“ löschen?" })
  await confirmDelete.waitFor()
  results["deleteAxe"] = await accessibility(page, "deck library: confirm deleting")
  await confirmDelete.getByRole("button", { name: "Endgültig löschen" }).click()
  await page.getByRole("heading", { level: 1, name: "Decks" }).waitFor()
  await expectTitles(page, ["E2E Brawl", "E2E Deutsch", "E2E Deutsch (Kopie)", "E2E Izzet Tempo"], "after deleting")
  check(!(await libraryDecks(page)).has("E2E Rundreise"), "deck library: the deleted deck is still stored")
  // The deletion leaves its mark in the same transaction (the ORYX cloud merge must not bring the deck back).
  const marks = ((await dumpDatabase(page))["deckTombstones"] ?? []) as { id?: string; deletedAt?: string }[]
  check(marks.length === 1 && marks[0]?.id === deletedId && /^\d{4}-\d{2}-\d{2}T/.test(marks[0]?.deletedAt ?? ""), `deck library: deletion marks ${JSON.stringify(marks)}`)
  results["deletionMarks"] = marks
  // Order by the last change: the deck imported again, then the renamed one.
  await page.getByRole("combobox", { name: "Sortieren" }).click()
  await page.getByRole("option", { name: "Zuletzt geändert" }).click()
  await expectTitles(page, ["E2E Deutsch (Kopie)", "E2E Izzet Tempo", "E2E Brawl", "E2E Deutsch"], "sorted by change")
  check(new URL(page.url()).search === "?sort=updated", `deck library: sort not in the address ${page.url()}`)

  // 8. Choosing the decks for a game (the page prewarms the engine: decks are there).
  await page.goto(new URL("/play", base).href, { waitUntil: "networkidle" })
  await page.getByText("Noch kein Deck gewählt.").waitFor()
  await page.getByRole("button", { name: "Dein Deck wählen" }).click()
  await page.getByRole("dialog", { name: "Dein Deck wählen" }).getByRole("button", { name: "E2E Izzet Tempo" }).click()
  await page.getByText("E2E Izzet Tempo – Constructed · 60 Karten · Sideboard 3").waitFor()
  await page.getByText("Zufällig aus 2 Constructed-Decks, jede Partie neu.").waitFor()
  const startGame = page.getByRole("button", { name: "Partie starten" }).first()
  check(await startGame.isEnabled(), "deck library: both decks are set, but a game cannot start")
  check(ENGINE_NOTES.includes(await startNote(page)), `deck library: start note "${await startNote(page)}"`)
  // Leave the page only with the prewarmed engine ready (a reload would cut its download short).
  await enginePanel(page).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
  await page.getByRole("button", { name: "Deck der KI wählen" }).click()
  const aiDialog = page.getByRole("dialog", { name: "Deck der KI wählen" })
  check(await aiDialog.getByRole("button", { name: "E2E Brawl" }).isDisabled(), "deck library: a Commander deck can be chosen against a Constructed deck")
  results["aiDialogAxe"] = await accessibility(page, "deck library: the AI's deck")
  await page.screenshot({ path: path.join(reportDir, "screens", "desktop-play-ai-deck.png") })
  await aiDialog.getByRole("button", { name: "E2E Deutsch", exact: true }).click()
  await page.getByText("E2E Deutsch – Constructed · 60 Karten · Sideboard 2").waitFor()
  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("E2E Izzet Tempo – Constructed · 60 Karten · Sideboard 3").waitFor()
  await page.getByText("E2E Deutsch – Constructed · 60 Karten · Sideboard 2").waitFor()
  // A Commander deck: the AI's Constructed deck no longer fits; random has nothing to draw; a mirror match does.
  await page.getByRole("button", { name: "Dein Deck wählen" }).click()
  await page.getByRole("dialog", { name: "Dein Deck wählen" }).getByRole("button", { name: "E2E Brawl" }).click()
  await page.getByText("Das Deck der KI hat ein anderes Format als deins – wähle ein passendes.").waitFor()
  await page.getByRole("button", { name: "Deck der KI wählen" }).click()
  check(await aiDialog.getByRole("button", { name: "Zufällig" }).isDisabled(), "deck library: random offered without a second Commander deck")
    await aiDialog.getByRole("button", { name: "E2E Brawl" }).click()
  await page.getByText(/^E2E Brawl – Commander/).first().waitFor()
  await page.waitForFunction(() => document.getElementById("play-start-note")?.textContent?.startsWith("Forge"))
  check(await startGame.isEnabled(), "deck library: a mirror match cannot start")
  results["playAxe"] = await accessibility(page, "deck library: play")
  await screenshots(page, "desktop-play-decks")
  const settings = ((await dumpDatabase(page))["settings"] ?? []) as { key: string; value: unknown }[]
  const brawlId = (await libraryDecks(page)).get("E2E Brawl")?.id
  check(
    JSON.stringify(settings.filter((setting) => setting.key.startsWith("play.")).map((setting) => [setting.key, setting.value]).sort()) ===
      JSON.stringify([["play.aiDeck", { kind: "deck", deckId: brawlId }], ["play.humanDeck", brawlId]]),
    `deck library: stored choice ${JSON.stringify(settings)}`,
  )
  results["timings"] = checkTimes

  // 9. A phone with touch, in its own profile (the decks through a backup, no card data): action bars and touch sizes.
  const phoneDecks = ((await dumpDatabase(page))["decks"] ?? []) as LibraryDeck[]
  const phone = await newContext(browser, VIEWPORTS[0]!)
  const phonePage = await phone.newPage()
  const phoneLog = watch(phonePage)
  try {
    const card = await openLocalData(phonePage, base)
    await chooseBackup(card, "decks.jsonl.gz", decksBackup(phoneDecks))
    const dialog = phonePage.getByRole("dialog", { name: "Sicherung laden" })
    await dialog.getByRole("button", { name: "Zusammenführen", exact: true }).click()
    await phonePage.getByText("Sicherung geladen").waitFor()
    const tempoId = phoneDecks.find((deck) => deck.name === "E2E Izzet Tempo")?.id
    await phonePage.goto(new URL(`/decks/${tempoId}`, base).href, { waitUntil: "networkidle" })
    await phonePage.getByRole("heading", { level: 1, name: "E2E Izzet Tempo" }).waitFor()
    await phonePage.getByText("Ohne Kartendaten: englische Namen, keine Bilder").waitFor()
    const bar = phonePage.getByRole("region", { name: "Deck-Aktionen" })
    const tabBar = phonePage.getByRole("navigation", { name: "Hauptnavigation" })
    const placement: unknown[] = []
    for (const top of [0, 700]) {
      await phonePage.evaluate((y) => window.scrollTo(0, y), top)
      await phonePage.waitForTimeout(100)
      const [barBox, tabBox] = [await bar.boundingBox(), await tabBar.boundingBox()]
      placement.push({ top, bar: barBox, tabBar: tabBox })
      check(barBox !== null && tabBox !== null && barBox.y >= 0 && Math.abs(barBox.y + barBox.height - tabBox.y) <= 1, `deck library (phone): action bar not above the tab bar at ${top}px: ${JSON.stringify(placement.at(-1))}`)
    }
    const playHeight = await layoutHeight(bar.getByRole("button", { name: "Mit diesem Deck spielen" }))
    const moreHeight = await layoutHeight(bar.getByRole("button", { name: "Mehr" }))
    check(playHeight >= 44 && moreHeight >= 44, `deck library (phone): action bar buttons ${playHeight}/${moreHeight}px high`)
    await bar.getByRole("button", { name: "Mehr" }).click()
    const itemHeight = await layoutHeight(phonePage.getByRole("menuitem", { name: "Umbenennen" }))
    check(itemHeight >= 44, `deck library (phone): menu entry ${itemHeight}px high`)
    await phonePage.keyboard.press("Escape")
    await overlaysGone(phonePage)
    const overflow = await phonePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(overflow <= 0, `deck library (phone): details overflow by ${overflow}px`)
    results["phoneDetailsAxe"] = await accessibility(phonePage, "deck library (phone): details")
    await phonePage.evaluate(() => window.scrollTo(0, 700))
    await phonePage.screenshot({ path: path.join(reportDir, "screens", "phone-deck-details.png") })
    // Play from the details: the deck is chosen on the play page, whose start stays at the bottom too.
    await bar.getByRole("button", { name: "Mit diesem Deck spielen" }).click()
    await phonePage.getByRole("heading", { level: 1, name: "Spielen" }).waitFor()
    await phonePage.getByText(/^E2E Izzet Tempo – Constructed · 60 Karten/).waitFor()
    const startBar = phonePage.getByRole("region", { name: "Partie starten" })
    const [startBox, tabBox] = [await startBar.boundingBox(), await tabBar.boundingBox()]
    check(startBox !== null && tabBox !== null && Math.abs(startBox.y + startBox.height - tabBox.y) <= 1, `deck library (phone): start bar ${JSON.stringify(startBox)} tab bar ${JSON.stringify(tabBox)}`)
    results["phonePlayAxe"] = await accessibility(phonePage, "deck library (phone): play")
    await phonePage.screenshot({ path: path.join(reportDir, "screens", "phone-play-decks.png") })
    // The phone prewarms the engine too; leave only once it is ready (see 8).
    await enginePanel(phonePage).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
    await phonePage.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
    await expectTitles(phonePage, ["E2E Brawl", "E2E Deutsch", "E2E Deutsch (Kopie)", "E2E Izzet Tempo"], "phone")
    const listOverflow = await phonePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(listOverflow <= 0, `deck library (phone): list overflows by ${listOverflow}px`)
    results["phoneListAxe"] = await accessibility(phonePage, "deck library (phone): list")
    await screenshots(phonePage, "phone-deck-library")
    results["phone"] = { placement, playButton: playHeight, moreButton: moreHeight, menuEntry: itemHeight }
    for (const error of phoneLog.errors) check(false, `deck library (phone): ${error}`)
  } finally {
    await phone.close()
  }

  // No errors of the app; a 404 for a German version that does not exist is Scryfall's answer "none".
  for (const error of pageLog.errors.slice(errorsBefore).filter((e) => !/api\.scryfall\.com\/cards\/[^/\s]+\/[^/\s]+\/de/.test(e) || !/404/.test(e))) check(false, `deck library: ${error}`)
  results["scryfallApi"] = api.slice(apiBefore)
  return results
}

// ── 10. Game session (the real engine in the browser) ─────────────────────

/** The start button's note when a game can start (engine ready, booting or about to boot). */
const ENGINE_NOTES = ["Forge ist bereit.", "Forge lädt noch – die Partie beginnt, sobald Forge bereit ist.", "Forge startet dafür (einige Sekunden)."]

function enginePanel(page: Page): Locator {
  return page.getByRole("region", { name: "Forge-Engine" })
}

async function startNote(page: Page): Promise<string> {
  return (await page.locator("#play-start-note").first().textContent()) ?? ""
}

/** Engine workers alive at the same time in a page, from now on: never more than one (one engine, about 1 GB). */
function countWorkers(page: Page): { readonly max: () => number; readonly alive: () => number; readonly created: () => number } {
  const alive = new Set<unknown>()
  let max = 0
  let created = 0
  page.on("worker", (worker) => {
    alive.add(worker)
    created++
    max = Math.max(max, alive.size)
    worker.on("close", () => alive.delete(worker))
  })
  return { max: () => max, alive: () => alive.size, created: () => created }
}

/** Picks a deck in one of the two choice dialogs (an option's name is the deck's, plus "gewählt" if it is the current one). */
async function chooseDeck(page: Page, which: "Dein Deck wählen" | "Deck der KI wählen", deck: string): Promise<void> {
  await page.getByRole("button", { name: which }).click()
  const name = new RegExp(`^${deck.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( gewählt)?$`)
  await page.getByRole("dialog", { name: which }).getByRole("button", { name }).click()
  await overlaysGone(page)
}

/** The running game's table (prompt 13): its header region, where the menu is. */
function tableHeader(page: Page): Locator {
  return page.getByRole("region", { name: "Spielstand" })
}

/** What the table shows of one player: life, zone sizes, the cards on the battlefield and in the hand. */
interface SideFacts {
  readonly life: number
  readonly hand: number
  readonly library: number
  readonly graveyard: number
  readonly exile: number
  /** The command zone's size (0 when the table shows none). */
  readonly command: number
  /** Cards on the battlefield (piles counted by their size), without the command zone. */
  readonly permanents: number
  /** The hand's cards as the table draws them: faces and backs. */
  readonly handFaces: number
  readonly handBacks: number
}

/** Reads the table's facts of both players from its regions (the player's bar "Du", the opponent's "Forge-KI"). */
async function tableFacts(page: Page): Promise<{ readonly me: SideFacts; readonly ai: SideFacts }> {
  return page.evaluate(() => {
    const region = (name: string) => document.querySelector(`section[aria-label="${name}"]`)
    const number = (element: Element | null | undefined) => {
      const match = /(-?\d+)\s*$/.exec(element?.textContent ?? "")
      return match ? Number(match[1]) : Number.NaN
    }
    const side = (bar: Element | null, field: Element | null, hand: Element | null) => {
      const count = (label: string) => (bar?.querySelector(`[title="${label}"]`) ? number(bar.querySelector(`[title="${label}"]`)) : 0)
      // A card is a figure (hidden) or a button (a card the player may see, prompt 14); its caption carries its facts.
      const figures = [...(field?.querySelectorAll('[data-slot="game-card"]') ?? [])]
      const caption = (figure: Element) => figure.querySelector('[data-slot="game-card-caption"]')?.getAttribute("title") ?? ""
      const permanents = figures.filter((figure) => !caption(figure).endsWith("Kommandozone")).reduce((sum, figure) => sum + (Number(/(\d+) Karten/.exec(caption(figure))?.[1] ?? 1) || 1), 0)
      return {
        life: number(bar?.querySelector('[title="Lebenspunkte"]')?.querySelector(".tabular-nums")),
        hand: count("Hand"),
        library: count("Bibliothek"),
        graveyard: count("Friedhof"),
        exile: count("Exil"),
        command: count("Kommandozone"),
        permanents,
        handFaces: hand?.querySelectorAll('[data-slot="game-card"]').length ?? 0,
        handBacks: hand?.querySelectorAll('[data-slot="game-card-back"]').length ?? 0,
      }
    }
    const opponentBar = region("Forge-KI")
    return {
      me: side(region("Du"), region("Dein Spielfeld"), region("Deine Hand")),
      ai: side(opponentBar, region("Spielfeld der Forge-KI"), opponentBar?.querySelector('ul[aria-label^="Hand der Forge-KI"]') ?? null),
    }
  })
}

/**
 * The table fits the screen (Bible §6): the page itself never scrolls, the
 * app's frame is gone (the table's own menu leads around the app), and every
 * region lies inside the window with room to show something. Returns the
 * regions' boxes.
 */
async function checkTableFits(page: Page, label: string): Promise<Record<string, unknown>> {
  const layout = await page.evaluate(() => {
    const areas = Object.fromEntries(
      [...document.querySelectorAll('[data-slot="game-board-area"]')].map((area) => {
        const box = area.getBoundingClientRect()
        return [(area as HTMLElement).dataset["area"] ?? "?", { top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height) }]
      }),
    )
    return {
      window: { width: window.innerWidth, height: window.innerHeight },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      frame: {
        tabBar: document.querySelectorAll('nav[aria-label="Hauptnavigation"]').length,
        sidebar: document.querySelectorAll('[data-slot="sidebar"]').length,
      },
      areas,
    }
  })
  const { window: view, scroll, frame, areas } = layout
  check(scroll.width <= view.width && scroll.height <= view.height, `${label}: the page scrolls (${scroll.width}×${scroll.height} in ${view.width}×${view.height})`)
  check(frame.tabBar === 0 && frame.sidebar === 0, `${label}: the app's frame is still there ${JSON.stringify(frame)}`)
  const names = ["header", "opponent", "opponent-field", "center", "field", "me", "decision", "hand"]
  check(names.every((name) => name in areas), `${label}: regions ${Object.keys(areas).join(", ")}`)
  // In a low landscape window a decision that needs room takes the stack's place (prompt 15): stack and combat step aside.
  const board = await page.locator('[data-slot="game-board"]').getAttribute("data-decision")
  const aside = board === "expanded" && view.width > view.height && view.height <= 512
  for (const [name, box] of Object.entries(areas)) {
    if (aside && name === "center") {
      check(box.height === 0, `${label}: stack and combat did not step aside for the decision ${JSON.stringify(box)}`)
      continue
    }
    check(box.top >= 0 && box.left >= 0 && box.top + box.height <= view.height + 1 && box.left + box.width <= view.width + 1, `${label}: region ${name} outside the window ${JSON.stringify(box)}`)
  }
  // Both battlefields get room for cards, the same in each half; the hand is there. A decision that needs room
  // (prompt 15: GameBoard decision="expanded") leaves them at least a row of cards.
  const opponentField = areas["opponent-field"]
  const field = areas["field"]
  const expanded = (await page.locator('[data-slot="game-board"]').getAttribute("data-decision")) === "expanded"
  const least = expanded ? 64 : 80
  check(opponentField !== undefined && field !== undefined && Math.min(opponentField.height, field.height) >= least, `${label}: battlefields ${opponentField?.height}/${field?.height}px high`)
  check((areas["hand"]?.height ?? 0) >= 80, `${label}: the hand ${areas["hand"]?.height}px high`)
  return layout
}

/**
 * The card pictures of the table: none failed, and every picture on screen
 * has loaded (pictures in a row's hidden part load when it is scrolled to).
 */
async function tablePictures(page: Page, label: string): Promise<{ readonly loaded: number; readonly lazy: number; readonly failed: number; readonly text: number }> {
  const deadline = Date.now() + 30_000
  let states = { loaded: 0, lazy: 0, failed: 0, text: 0, loadingOnScreen: 0 }
  while (Date.now() < deadline) {
    states = await page.evaluate(() => {
      const out = { loaded: 0, lazy: 0, failed: 0, text: 0, loadingOnScreen: 0 }
      for (const picture of document.querySelectorAll('[data-slot="card-picture"]')) {
        const state = picture.getAttribute("data-state")
        const box = picture.getBoundingClientRect()
        const row = picture.closest("ul")?.getBoundingClientRect()
        const onScreen = box.right > 0 && box.left < window.innerWidth && (row === undefined || (box.right > row.left && box.left < row.right))
        if (state === "loaded") out.loaded++
        else if (state === "failed") out.failed++
        else if (state === "missing") out.text++
        else if (onScreen) out.loadingOnScreen++
        else out.lazy++
      }
      return out
    })
    if (states.loadingOnScreen === 0) break
    await page.waitForTimeout(200)
  }
  check(states.failed === 0, `${label}: ${states.failed} card pictures failed`)
  check(states.loadingOnScreen === 0, `${label}: ${states.loadingOnScreen} card pictures on screen still loading`)
  return { loaded: states.loaded, lazy: states.lazy, failed: states.failed, text: states.text }
}

/**
 * Forge's first decision of a game, as the coin toss decides: the player won it
 * (play or draw, before the opening hands) or the AI did (the mulligan).
 */
const FIRST_DECISIONS: Readonly<Record<string, { readonly answers: string; readonly hand: number }>> = {
  "SpielenZiehen": { answers: "SpielenZiehen", hand: 0 },
  "BehaltenMulligan": { answers: "BehaltenMulligan", hand: 7 },
}

/**
 * Checks the running game's first decision and both players on the table
 * against what Forge must show before anyone has played: the decision with
 * Forge's own German words and answers, the life total, no card anywhere but
 * hand, library and (Commander) the command zone, hand + library = the deck;
 * the player's hand face up, the AI's only as backs.
 */
async function checkFirstDecision(page: Page, label: string, expect: { readonly life: number; readonly cards: number; readonly command: number }): Promise<Record<string, unknown>> {
  const decision = page.getByRole("region", { name: "Entscheidung" })
  const text = (await decision.textContent()) ?? ""
  const answers = (await decision.getByLabel("Antworten, die Forge anbietet").textContent()) ?? ""
  const first = FIRST_DECISIONS[answers]
  check(first !== undefined, `${label}: the first decision offers "${answers}" (${text})`)
  check(text.startsWith("Forge wartet auf deine Entscheidung") && /\?/.test(text), `${label}: the first decision "${text}"`)
  const facts = await tableFacts(page)
  for (const [who, side] of Object.entries(facts)) {
    check(
      side.life === expect.life &&
        (first === undefined || side.hand === first.hand) &&
        side.hand + side.library === expect.cards &&
        side.permanents === 0 &&
        side.graveyard === 0 &&
        side.exile === 0 &&
        side.command === expect.command,
      `${label}: ${who} ${JSON.stringify(side)}`,
    )
  }
  // The player's hand face up, the AI's hand only as backs: Forge hides it (mayView), and so does the table.
  check(facts.me.handFaces === facts.me.hand && facts.me.handBacks === 0, `${label}: the player's hand ${JSON.stringify(facts.me)}`)
  check(facts.ai.handBacks === facts.ai.hand && facts.ai.handFaces === 0, `${label}: the AI's hand ${JSON.stringify(facts.ai)}`)
  const aiHandPictures = await page.locator('ul[aria-label^="Hand der Forge-KI"] img').count()
  check(aiHandPictures === 0, `${label}: ${aiHandPictures} pictures in the AI's hidden hand`)
  return { decision: text, answers, players: facts }
}

/** Waits until Forge asks the player on the running game's table; if it does not, says what the page shows instead (a refusal, an abort, a silent engine …). */
async function waitForDecision(page: Page): Promise<void> {
  try {
    await page.getByRole("region", { name: "Entscheidung" }).getByRole("heading", { name: "Forge wartet auf deine Entscheidung" }).waitFor({ timeout: 180_000 })
  } catch (error) {
    const shown = ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 800)
    await page.screenshot({ path: path.join(reportDir, "screens", "no-decision.png") }).catch(() => undefined)
    throw new Error(`no decision of Forge's within 180 s at ${page.url()}; the page shows: ${shown}`, { cause: error })
  }
}

/** Starts a game from the play page and waits for Forge's first decision; returns the milliseconds from the click. */
async function startAndWait(page: Page): Promise<number> {
  const started = Date.now()
  await page.getByRole("button", { name: "Partie starten" }).first().click()
  await page.waitForURL(/\/play\/game$/)
  await waitForDecision(page)
  return Date.now() - started
}

/**
 * Waits until the element's animations (and those inside it) have ended: a
 * dialog fading in is half transparent, and axe would measure the contrast of
 * that moment.
 */
async function animationsDone(locator: Locator): Promise<void> {
  await locator.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))))
}

/** Opens the table's menu (the way around the app, Forge's notices, conceding). */
async function openTableMenu(page: Page): Promise<Locator> {
  await tableHeader(page).getByRole("button", { name: /^Menü/ }).click()
  const menu = page.getByRole("dialog", { name: "Partie" })
  await menu.waitFor()
  await animationsDone(menu)
  return menu
}

/** Concedes from the table's menu after confirming; returns the result region. */
async function concedeGame(page: Page, axeLabel?: string): Promise<{ readonly result: Locator; readonly axe: number | null }> {
  const menu = await openTableMenu(page)
  await menu.getByRole("button", { name: "Aufgeben" }).click()
  const dialog = page.getByRole("alertdialog", { name: "Partie aufgeben?" })
  await dialog.waitFor()
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null)
  await animationsDone(dialog)
  const axe = axeLabel ? await accessibility(page, axeLabel) : null
  await dialog.getByRole("button", { name: "Aufgeben" }).click()
  await page.getByRole("heading", { level: 2, name: "Verloren" }).waitFor({ timeout: 60_000 })
  await overlaysGone(page)
  return { result: page.getByRole("region", { name: "Verloren" }), axe }
}

async function loadDecks(page: Page, base: string, decks: readonly unknown[]): Promise<void> {
  const card = await openLocalData(page, base)
  await chooseBackup(card, "decks.jsonl.gz", decksBackup(decks))
  await page.getByRole("dialog", { name: "Sicherung laden" }).getByRole("button", { name: "Zusammenführen", exact: true }).click()
  await page.getByText("Sicherung geladen").waitFor()
}

function engineWorkerRequests(pageLog: PageLog, id: string): number {
  return pageLog.requests.filter((p) => p === `/engine/${id}/engine-worker.js`).length
}

/**
 * Looking at a card in the real game sends nothing (prompt 14): the player's
 * commander or first hand card opens its card view - Forge's name and place,
 * the large picture, and in the first decision (play/draw or the mulligan)
 * nothing Forge offers for it -; closing it leaves Forge waiting as before,
 * without a notice. The view is checked with axe, its buttons for touch size.
 */
async function lookInRealGame(page: Page, label: string, touch = false): Promise<Record<string, unknown>> {
  const decisionBefore = (await page.getByRole("region", { name: "Entscheidung" }).textContent()) ?? ""
  const cards = page.locator('section[aria-label="Dein Spielfeld"] button[data-slot="game-card"], section[aria-label="Deine Hand"] button[data-slot="game-card"]')
  if ((await cards.count()) === 0) {
    // The player won the coin toss: Forge asks "play or draw" before the opening hands - no card of the player yet (a Commander game has its commander).
    check(decisionBefore.includes("SpielenZiehen"), `${label}: no card of the player to look at, and not before the opening hands ("${decisionBefore}")`)
    return { skipped: "no card before the opening hands (play or draw)" }
  }
  const card = cards.first()
  const name = (await card.getAttribute("aria-label")) ?? ""
  check((await card.getAttribute("aria-haspopup")) === "dialog", `${label}: the card "${name}" does not open its view`)
  if (touch) await card.tap()
  else await card.click()
  const view = page.getByRole("dialog")
  await view.waitFor()
  await animationsDone(view)
  const title = (await view.getByRole("heading").first().textContent()) ?? ""
  const offer = (await view.getByRole("region", { name: "Was Forge anbietet" }).textContent()) ?? ""
  const buttons = await view.getByRole("button").allTextContents()
  const picture = await view.locator('[data-slot="card-picture"]').getAttribute("data-state")
  check(name.startsWith(title) && title.length > 0, `${label}: the card view's title "${title}" for "${name}"`)
  check(offer === "Mit dieser Karte bietet Forge gerade nichts an." && buttons.join("|") === "Schließen", `${label}: in the first decision Forge offers nothing for the card ("${offer}", buttons ${buttons.join("|")})`)
  check(picture === "loaded" || picture === "missing", `${label}: the card view's picture ${picture}`)
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("role"))
  check(focused === "dialog", `${label}: the card view does not hold the focus itself (${focused})`)
  const axe = await accessibility(page, `${label}: card view`)
  await page.screenshot({ path: path.join(reportDir, "screens", `${label.replace(/[^a-z]+/gi, "-").toLowerCase()}card-view.png`) })
  const close = view.getByRole("button", { name: "Schließen" })
  const closeHeight = await layoutHeight(close)
  if (touch) check(closeHeight >= 44, `${label}: the card view's "Schließen" ${closeHeight}px high`)
  if (touch) await close.tap()
  else await close.click()
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null)
  // Nothing was sent: Forge still waits for the same decision, and no notice came.
  await page.getByRole("region", { name: "Spielstand" }).getByText("Du bist dran", { exact: true }).waitFor()
  const decisionAfter = (await page.getByRole("region", { name: "Entscheidung" }).textContent()) ?? ""
  check(decisionAfter === decisionBefore, `${label}: the decision changed after looking at a card`)
  check((await page.locator("[data-sonner-toast]").count()) === 0, `${label}: a notice appeared after looking at a card`)
  return { card: name, title, offer, picture, axe, closeHeight }
}

/** The decision region's buttons are armed this long after they appear (src/game/card-sheet.tsx ARMING_MS), plus a margin. */
const ARMED_AFTER_MS = 600

/** Forge's words for playing a land (the tap Forge offers for a land in the player's main phase; read by the test only). */
const PLAY_LAND = "Spiele ein Land"

/**
 * Answering Forge in the real game (prompt 15), only through the table: the
 * first decision with Forge's own buttons (play first, then keep the hand),
 * Forge's priority passed with its "OK" - attacks and blocks declined, a card
 * discarded when Forge asks - until a land of the player's hand can be
 * played, the land played through its card view (Forge's card.tap), and the
 * priority passed on once more. Every press waits until the buttons are
 * armed, and each one must be taken by Forge: the decision changes (Forge's
 * next question) - a refusal would leave it and fail the test. Nothing is
 * answered by the app itself: between the presses the decision stays as it is.
 */
async function playRealGame(page: Page, label: string, touch = false): Promise<Record<string, unknown>> {
  const started = Date.now()
  const decision = page.getByRole("region", { name: "Entscheidung" })
  const content = decision.locator('[data-slot="game-decision"]')
  const answers = decision.getByRole("group", { name: "Antworten, die Forge anbietet" })
  const hand = page.getByRole("region", { name: "Deine Hand" })
  const presses: string[] = []
  const heights: number[] = []
  const activate = async (locator: Locator) => {
    if (touch) await locator.tap()
    else await locator.click()
  }
  /** Waits until Forge waits for the player with a decision; returns its kind (the first line of the decision) and its question. */
  const next = async (): Promise<{ readonly kind: string; readonly question: string | null }> => {
    await tableHeader(page).getByText("Du bist dran", { exact: true }).waitFor({ timeout: 180_000 })
    await waitForDecision(page)
    // The first line is the kind, then - after " · " - the asking card's name, if Forge names one.
    const line = ((await decision.locator('[data-slot="game-decision-header"] p').first().textContent()) ?? "").trim()
    return { kind: line.split(" · ")[0]!.trim(), question: await content.getAttribute("data-question") }
  }
  /** Presses one of Forge's buttons once armed; Forge must take it (its question goes). */
  const press = async (name: string, question: string | null) => {
    const button = answers.getByRole("button", { name, exact: true })
    await button.waitFor()
    heights.push(await layoutHeight(button))
    await page.waitForTimeout(ARMED_AFTER_MS)
    await activate(button)
    presses.push(name)
    await page.waitForFunction((before) => document.querySelector('[data-slot="game-decision"]')?.getAttribute("data-question") !== before, question, { timeout: 180_000 })
  }
  const first = ((await answers.textContent()) ?? "").trim()
  let land: string | null = null
  let landFrom: number | null = null
  for (let step = 0; step < 120 && land === null && Date.now() - started < 360_000; step++) {
    const { kind, question } = await next()
    if (kind === "Entscheidung") {
      // Play or draw (the player won the coin toss): play first.
      const labels = await answers.getByRole("button").allTextContents()
      await press(labels.includes("Spielen") ? "Spielen" : labels.includes("Nein") ? "Nein" : labels[0]!, question)
    } else if (kind === "Mulligan") {
      await press("Behalten", question)
    } else if (kind === "Priorität") {
      // A land of the hand Forge offers to play: through its card view. None: pass.
      const playable = hand.locator('button[data-slot="game-card"][aria-label$=", spielbar"]')
      for (let index = 0; index < (await playable.count()) && land === null; index++) {
        const card = playable.nth(index)
        const name = (await card.getAttribute("aria-label")) ?? ""
        await activate(card)
        const view = page.getByRole("dialog")
        await view.waitFor()
        const offer = view.getByRole("button", { name: PLAY_LAND, exact: true })
        if ((await offer.count()) === 1) {
          landFrom = (await tableFacts(page)).me.permanents
          await page.waitForTimeout(ARMED_AFTER_MS)
          await activate(offer)
          await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null)
          land = name
        } else {
          await closeCardView(page)
        }
      }
      if (land === null) await press("OK", question)
    } else if (kind === "Angreifer wählen" || kind === "Angriff bestätigen" || kind === "Blocker wählen") {
      await press("OK", question)
    } else if (kind === "Auswahl") {
      // Forge asks for cards of the hand (discarding down to the hand size): one at a time, Forge ends it.
      await activate(hand.locator('button[data-slot="game-card"][data-mark="usable"]').first())
      presses.push("Handkarte wählen")
      await page.waitForTimeout(ARMED_AFTER_MS)
    } else {
      check(false, `${label}: an unexpected decision "${kind}" (${(await decision.textContent()) ?? ""})`)
      break
    }
  }
  check(land !== null, `${label}: no land became playable (${presses.length} presses: ${presses.join(", ")})`)
  let permanents: number | null = null
  if (land !== null) {
    // Forge played it: one more permanent on the player's battlefield, then the priority is passed on.
    await page.waitForFunction(
      (before) => {
        const field = document.querySelector('section[aria-label="Dein Spielfeld"]')
        const count = [...(field?.querySelectorAll('[data-slot="game-card"]') ?? [])].reduce((sum, figure) => {
          const caption = figure.querySelector('[data-slot="game-card-caption"]')?.getAttribute("title") ?? ""
          return caption.endsWith("Kommandozone") ? sum : sum + (Number(/(\d+) Karten/.exec(caption)?.[1] ?? 1) || 1)
        }, 0)
        return count > (before ?? 0)
      },
      landFrom,
      { timeout: 60_000 },
    )
    permanents = (await tableFacts(page)).me.permanents
    const { kind, question } = await next()
    check(kind === "Priorität", `${label}: after the land Forge asks "${kind}"`)
    await press("OK", question)
  }
  if (touch) for (const height of heights) check(height >= 44, `${label}: one of Forge's buttons ${height}px high`)
  check((await page.locator("[data-sonner-toast]").count()) === 0, `${label}: a notice appeared while playing (${(await page.locator("[data-sonner-toast]").allTextContents()).join(" | ")})`)
  return { first, presses, land, permanentsBefore: landFrom, permanentsAfter: permanents, buttonHeights: [Math.min(...heights), Math.max(...heights)], ms: Date.now() - started }
}

async function gameSession(browser: Browser, page: Page, pageLog: PageLog, base: string, id: string, decks: readonly SavedDeck[]): Promise<Record<string, unknown>> {
  log("Game session (prewarm, start, running game, concede, result, reload, refusal, failed boot, phone)")
  const results: Record<string, unknown> = {}
  const errorsBefore = pageLog.errors.length
  const workers = countWorkers(page)

  // 1. Opening "Spielen" with decks prewarms the engine - no click (the choice from 9 is the Commander mirror).
  const opened = Date.now()
  await page.goto(new URL("/play", base).href, { waitUntil: "domcontentloaded" })
  await enginePanel(page).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
  results["prewarmMs"] = Date.now() - opened
  check((await startNote(page)) === "Forge ist bereit.", `game: start note with a ready engine "${await startNote(page)}"`)
  const readyFacts = await enginePanel(page).locator("dl > div").evaluateAll((rows) => Object.fromEntries(rows.map((row) => [row.querySelector("dt")?.textContent ?? "", row.querySelector("dd")?.textContent ?? ""])))
  check(readyFacts["Sprache von Forge"] === "Deutsch" && readyFacts["Karten"] === "vollständig geladen", `game: engine facts ${JSON.stringify(readyFacts)}`)

  // 2. A Commander game (the mirror match chosen in 9: 59 cards and the commander): Forge's state and its first decision, in German,
  // on the game table (prompt 13): the whole screen, every region in view, the commander in the command zone with its picture.
  results["startCommanderMs"] = await startAndWait(page)
  results["commander"] = await checkFirstDecision(page, "game (Commander)", { life: 40, cards: 59, command: 1 })
  const table: Record<string, unknown> = { desktop: await checkTableFits(page, "game table (desktop)") }
  results["table"] = table
  results["tablePictures"] = await tablePictures(page, "game table (desktop)")
  const commanders = await page.locator('section[aria-label="Dein Spielfeld"] [data-slot="game-card"]').evaluateAll((figures) =>
    figures
      .filter((figure) => (figure.querySelector('[data-slot="game-card-caption"]')?.getAttribute("title") ?? "").endsWith("Kommandozone"))
      .map((figure) => ({ state: figure.querySelector('[data-slot="card-picture"]')?.getAttribute("data-state"), alt: figure.querySelector("img")?.getAttribute("alt") ?? null })),
  )
  results["commanderInCommandZone"] = commanders
  check(commanders.length === 1 && commanders[0]?.state === "loaded" && commanders[0].alt !== null, `game table: the commander in the command zone ${JSON.stringify(commanders)}`)
  results["playingAxe"] = await accessibility(page, "game: running")
  await page.screenshot({ path: path.join(reportDir, "screens", "desktop-game-table.png") })
  const look = await lookInRealGame(page, "game (desktop)")
  results["look"] = look
  check(!("skipped" in look), "game (desktop): the commander in the command zone could not be looked at")

  // The table follows the window without touching the game: a portrait window, a landscape one, back.
  await page.setViewportSize({ width: 884, height: 1104 })
  table["portraitWindow"] = await checkTableFits(page, "game table (portrait window)")
  await page.screenshot({ path: path.join(reportDir, "screens", "portrait-window-game-table.png") })
  await page.setViewportSize({ width: 1104, height: 884 })
  table["landscapeWindow"] = await checkTableFits(page, "game table (landscape window)")
  await page.setViewportSize({ width: VIEWPORTS[2]!.width, height: VIEWPORTS[2]!.height })
  await waitForDecision(page)
  check(workers.created() === 1, `game table: resizing the window changed the engine (${workers.created()} workers)`)

  // 3. Around the app and back through the table's menu: the game keeps running in the session, the app's frame is back outside it.
  const menu = await openTableMenu(page)
  results["menuAxe"] = await accessibility(page, "game: the table's menu")
  await menu.getByRole("link", { name: "Decks" }).click()
  await page.getByRole("heading", { level: 1, name: "Decks" }).waitFor()
  check((await page.locator('[data-slot="sidebar"]').count()) > 0, "game: the app's frame did not come back outside the game")
  await page.locator('[data-slot="sidebar"] a', { hasText: "Spielen" }).click()
  await page.getByText("Eine Partie läuft", { exact: true }).waitFor()
  check(((await enginePanel(page).locator('[data-slot="badge"]').first().textContent()) ?? "") === "Spielt", "game: the engine panel does not say it plays")
  await page.getByRole("button", { name: "Zur laufenden Partie" }).first().click()
  await waitForDecision(page)
  await checkTableFits(page, "game table (back from the app)")

  // 4. Conceding needs a confirmation; the result in one word; the spent engine goes, a fresh one is prewarmed.
  const conceded = await concedeGame(page, "game: confirm conceding")
  results["concedeAxe"] = conceded.axe
  const resultText = (await conceded.result.textContent()) ?? ""
  check(resultText.includes("Du hast aufgegeben.") && resultText.includes("Du (E2E Brawl)40 Lebenspunkte"), `game: result "${resultText}"`)
  results["resultAxe"] = await accessibility(page, "game: result")
  await screenshots(page, "desktop-game-result")
  const deadline = Date.now() + 180_000
  while (workers.created() < 2 && Date.now() < deadline) await page.waitForTimeout(100)
  check(workers.created() === 2, `game: the next engine was not prewarmed after the result (${workers.created()} workers)`)

  // 5. A Constructed game against a random deck, drawn for this game.
  await conceded.result.getByRole("link", { name: "Zur Deckwahl" }).click()
  await page.getByRole("heading", { level: 1, name: "Spielen" }).waitFor()
  await chooseDeck(page, "Dein Deck wählen", "E2E Izzet Tempo")
  await chooseDeck(page, "Deck der KI wählen", "Zufällig")
  await page.getByText("Zufällig aus 2 Constructed-Decks, jede Partie neu.").waitFor()
  await enginePanel(page).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
  results["startConstructedMs"] = await startAndWait(page)
  results["constructed"] = await checkFirstDecision(page, "game (Constructed)", { life: 20, cards: 60, command: 0 })
  const matchup = await openTableMenu(page)
  const aiDeck = ((await matchup.locator("dl > div", { hasText: "Deck der Forge-KI" }).locator("dd").textContent()) ?? "").trim()
  await page.keyboard.press("Escape")
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null)
  results["drawnAiDeck"] = aiDeck
  check(["E2E Deutsch (zufällig gezogen)", "E2E Deutsch (Kopie) (zufällig gezogen)"].includes(aiDeck), `game: the AI's random deck "${aiDeck}"`)
  // Answering Forge (prompt 15): keep, pass, play a land, pass - in the real game.
  results["played"] = await playRealGame(page, "game (Constructed, playing)")
  results["playedAxe"] = await accessibility(page, "game (Constructed, playing)")
  await page.screenshot({ path: path.join(reportDir, "screens", "desktop-game-played.png") })

  // 6. Reloading ends the game: the browser asks first, afterwards the page says there is none.
  let dialogType: string | null = null
  page.once("dialog", (dialog) => {
    dialogType = dialog.type()
    void dialog.accept()
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.getByText("Gerade läuft keine Partie").waitFor()
  results["reloadDialog"] = dialogType
  check(dialogType === "beforeunload", `game: reloading during a game did not ask first (${dialogType})`)
  check(workers.max() <= 1, `game: ${workers.max()} engines at the same time`)
  results["workers"] = { created: workers.created(), maxAtOnce: workers.max() }
  for (const error of pageLog.errors.slice(errorsBefore)) check(false, `game: ${error}`)

  // 7.-8. Failures in a fresh profile: a boot that fails, and a deck Forge refuses.
  results["failures"] = await gameFailures(browser, base, id, decks)
  // 9. A phone with touch.
  results["phone"] = await gamePhone(browser, base, decks)
  return results
}

/** A failed engine boot never looks frozen and can be retried; a deck Forge refuses is reported, and the same engine plays the next game. */
async function gameFailures(browser: Browser, base: string, id: string, decks: readonly SavedDeck[]): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  const context = await newContext(browser, VIEWPORTS[2]!)
  const page = await context.newPage()
  const pageLog = watch(page)
  const workers = countWorkers(page)
  const now = new Date().toISOString()
  const unknown = {
    id: randomUUID(),
    name: "E2E Unbekannt",
    format: "constructed",
    main: [
      { count: 56, name: "Mountain" },
      { count: 4, name: "No Such Card Of E2E" },
    ],
    sideboard: [],
    commander: [],
    source: { kind: "arena", text: "Deck\n56 Mountain\n4 No Such Card Of E2E", importedAt: now },
    createdAt: now,
    updatedAt: now,
  }
  const wasm = `/engine/${id}/openmana-engine.js.wasm`
  try {
    await loadDecks(page, base, [...decks, unknown])
    // 7. The engine module cannot be downloaded (a server error).
    await context.route(`**${wasm}`, (route) => route.fulfill({ status: 500, contentType: "text/plain", body: "E2E: engine download refused" }))
    await page.goto(new URL("/play", base).href, { waitUntil: "domcontentloaded" })
    await chooseDeck(page, "Dein Deck wählen", "E2E Izzet Tempo")
    // Not "random": that could draw the deck Forge refuses (8).
    await chooseDeck(page, "Deck der KI wählen", "E2E Deutsch")
    await enginePanel(page).getByText("Abgebrochen", { exact: true }).waitFor({ timeout: 180_000 })
    const panelText = (await enginePanel(page).textContent()) ?? ""
    results["prewarmFailed"] = panelText
    check(panelText.includes("Die Engine konnte nicht starten"), `game failures: engine panel "${panelText}"`)
    check((await startNote(page)) === "Forge wird dafür neu gestartet (einige Sekunden).", `game failures: start note "${await startNote(page)}"`)
    await page.getByRole("button", { name: "Partie starten" }).first().click()
    await page.waitForURL(/\/play\/game$/)
    const failed = page.getByRole("region", { name: "Die Partie konnte nicht starten" })
    await failed.waitFor({ timeout: 180_000 })
    const failedText = (await failed.textContent()) ?? ""
    results["startFailed"] = failedText
    check(failedText.includes("Die Engine konnte nicht starten"), `game failures: failed start "${failedText}"`)
    results["failedAxe"] = await accessibility(page, "game failures: failed start")
    await screenshots(page, "desktop-game-failed-start")
    // Once the module is there again, a new game starts.
    await context.unroute(`**${wasm}`)
    const retried = Date.now()
    await failed.getByRole("button", { name: "Neue Partie" }).click()
    await waitForDecision(page)
    results["retryStartMs"] = Date.now() - retried
    const { result } = await concedeGame(page)
    await result.getByRole("link", { name: "Zur Deckwahl" }).click()

    // 8. A deck with a card Forge does not know: Forge's report, and the same engine for the next game.
    await page.getByRole("heading", { level: 1, name: "Spielen" }).waitFor()
    await chooseDeck(page, "Dein Deck wählen", "E2E Unbekannt")
    await chooseDeck(page, "Deck der KI wählen", "E2E Izzet Tempo")
    await enginePanel(page).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
    const workerScripts = engineWorkerRequests(pageLog, id)
    await page.getByRole("button", { name: "Partie starten" }).first().click()
    const refused = page.getByRole("region", { name: "Die Partie hat nicht begonnen" })
    await refused.waitFor({ timeout: 60_000 })
    const refusedText = (await refused.textContent()) ?? ""
    results["refused"] = refusedText
    check(refusedText.includes("Forge kennt eine Karte aus „E2E Unbekannt“ nicht: No Such Card Of E2E."), `game failures: refusal "${refusedText}"`)
    check((await refused.getByRole("link", { name: "Deck ansehen" }).getAttribute("href")) === `/decks/${unknown.id}`, "game failures: the refused deck is not linked")
    results["refusedAxe"] = await accessibility(page, "game failures: refused")
    await screenshots(page, "desktop-game-refused")
    await refused.getByRole("link", { name: "Zur Deckwahl" }).click()
    await page.getByRole("heading", { level: 1, name: "Spielen" }).waitFor()
    check((await startNote(page)) === "Forge ist bereit.", `game failures: after the refusal "${await startNote(page)}"`)
    await chooseDeck(page, "Dein Deck wählen", "E2E Deutsch")
    await startAndWait(page)
    check(engineWorkerRequests(pageLog, id) === workerScripts, "game failures: the refused game's engine was not used for the next game")
    await concedeGame(page)
    results["workers"] = { created: workers.created(), maxAtOnce: workers.max() }
    check(workers.max() <= 1, `game failures: ${workers.max()} engines at the same time`)
    // The server error of 7 was the test's; anything else is a failure.
    for (const error of pageLog.errors.filter((e) => !(e.includes(wasm) && /\[http 500\]|Failed to load resource/.test(e)))) check(false, `game failures: ${error}`)
    results["engineLog"] = pageLog.engineLog.filter((line) => !line.includes("was not assigned to any set")).slice(0, 20)
  } finally {
    await context.close()
  }
  return results
}

/** The game on a phone with touch: no overflow, touch sizes, the result's action bar above the tab bar. */
async function gamePhone(browser: Browser, base: string, decks: readonly SavedDeck[]): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  const context = await newContext(browser, VIEWPORTS[0]!)
  const page = await context.newPage()
  const pageLog = watch(page)
  try {
    await loadDecks(page, base, decks)
    // The card data too, so the table shows the cards' pictures (without it: Forge's words for each card).
    results["catalogInstallMs"] = await installFromSettings(await openCardData(page, base), "game (phone): card data")
    await page.goto(new URL("/play", base).href, { waitUntil: "domcontentloaded" })
    await chooseDeck(page, "Dein Deck wählen", "E2E Izzet Tempo")
    await enginePanel(page).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
    results["startMs"] = await startAndWait(page)
    // The table on the phone: the whole screen (no tab bar), every region in view, a 44 px menu button.
    results["table"] = await checkTableFits(page, "game table (phone)")
    results["tablePictures"] = await tablePictures(page, "game table (phone)")
    const menuHeight = await layoutHeight(tableHeader(page).getByRole("button", { name: /^Menü/ }))
    check(menuHeight >= 44, `game table (phone): the menu button ${menuHeight}px high`)
    results["playingAxe"] = await accessibility(page, "game (phone): running")
    // Only the first screen here: Playwright's full-page screenshot resets the touch
    // emulation (pointer: coarse is false afterwards), which would shrink what is measured next.
    await page.screenshot({ path: path.join(reportDir, "screens", "phone-game-table.png") })
    // A hand card looked at by a tap: the view comes from below, sends nothing (prompt 14).
    results["look"] = await lookInRealGame(page, "game (phone)", true)
    // Turned sideways and back: the table follows, the game goes on untouched.
    await page.setViewportSize({ width: VIEWPORTS[0]!.height, height: VIEWPORTS[0]!.width })
    results["tableLandscape"] = await checkTableFits(page, "game table (phone, landscape)")
    results["landscapeAxe"] = await accessibility(page, "game (phone, landscape): running")
    await page.screenshot({ path: path.join(reportDir, "screens", "phone-landscape-game-table.png") })
    await page.setViewportSize({ width: VIEWPORTS[0]!.width, height: VIEWPORTS[0]!.height })
    await waitForDecision(page)
    // Answering Forge by touch (prompt 15): keep, pass, play a land, pass; Forge's buttons 44 px or more.
    results["played"] = await playRealGame(page, "game (phone, playing)", true)
    await page.screenshot({ path: path.join(reportDir, "screens", "phone-game-played.png") })
    const { result } = await concedeGame(page)
    const bar = page.getByRole("region", { name: "Neue Partie" })
    const tabBar = page.getByRole("navigation", { name: "Hauptnavigation" })
    const [barBox, tabBox] = [await bar.boundingBox(), await tabBar.boundingBox()]
    check(barBox !== null && tabBox !== null && Math.abs(barBox.y + barBox.height - tabBox.y) <= 1, `game (phone): action bar ${JSON.stringify(barBox)} tab bar ${JSON.stringify(tabBox)}`)
    const againHeight = await layoutHeight(bar.getByRole("button", { name: "Neue Partie" }))
    check(againHeight >= 44, `game (phone): "Neue Partie" ${againHeight}px high`)
    check((await result.getByRole("button", { name: "Neue Partie" }).count()) === 0, "game (phone): the next game's button twice")
    const resultOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(resultOverflow <= 0, `game (phone): result overflows by ${resultOverflow}px`)
    results["resultAxe"] = await accessibility(page, "game (phone): result")
    await screenshots(page, "phone-game-result")
    results["sizes"] = { menu: menuHeight, again: againHeight, bar: barBox, tabBar: tabBox }
    for (const error of pageLog.errors) check(false, `game (phone): ${error}`)
  } finally {
    await context.close()
  }
  return results
}

// ── 11. Preferences (AI profile, card language, less motion, diagnostics) ──

/** The settings store as the page keeps it (key → value). */
function storedSettings(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("openmana")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const records = await new Promise<{ key: string; value: unknown }[]>((resolve, reject) => {
      const request = db.transaction("settings").objectStore("settings").getAll()
      request.onsuccess = () => resolve(request.result as { key: string; value: unknown }[])
      request.onerror = () => reject(request.error)
    })
    db.close()
    return Object.fromEntries(records.map((record) => [record.key, record.value]))
  })
}

/** Label → value of the engine panel's facts (once it is ready). */
async function engineFacts(page: Page): Promise<Record<string, string>> {
  return enginePanel(page)
    .locator("dl > div")
    .evaluateAll((rows) => Object.fromEntries(rows.map((row) => [row.querySelector("dt")?.textContent ?? "", row.querySelector("dd")?.textContent ?? ""])))
}

/** The names of a radio group's options, as the player hears them (their titles). */
async function radioNames(group: Locator): Promise<string[]> {
  return group.getByRole("radio").evaluateAll((radios) => radios.map((radio) => document.getElementById(radio.getAttribute("aria-labelledby") ?? "")?.textContent ?? ""))
}

/** Waits until a setting is stored with this value (the page saves at once, asynchronously). */
async function settingStored(page: Page, key: string, value: unknown, label: string): Promise<void> {
  const deadline = Date.now() + 10_000
  let stored: unknown
  while (Date.now() < deadline) {
    stored = (await storedSettings(page))[key]
    if (JSON.stringify(stored) === JSON.stringify(value)) return
    await page.waitForTimeout(100)
  }
  check(false, `${label}: ${key} stored as ${JSON.stringify(stored)}, expected ${JSON.stringify(value)}`)
}

/** The animation a freshly opened dialog plays (tw-animate-css: "enter"; none with less motion). */
async function dialogAnimation(page: Page, open: () => Promise<void>, dialogName: string): Promise<string> {
  await open()
  const dialog = page.getByRole("dialog", { name: dialogName })
  await dialog.waitFor()
  const animation = await dialog.evaluate((element) => getComputedStyle(element).animationName)
  await page.keyboard.press("Escape")
  await overlaysGone(page)
  return animation
}

async function preferences(browser: Browser, base: string, id: string, decks: readonly SavedDeck[]): Promise<Record<string, unknown>> {
  log("Preferences (AI profile, card language, less motion, diagnostics)")
  const results: Record<string, unknown> = {}
  const context = await newContext(browser, VIEWPORTS[2]!)
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(base).origin })
  const page = await context.newPage()
  const pageLog = watch(page)
  const workers = countWorkers(page)
  try {
    await loadDecks(page, base, decks)
    await installFromSettings(await openCardData(page, base), "preferences")

    // 1. Settings: Forge's four verified profiles and random; the choices are saved at once.
    await page.goto(new URL("/settings", base).href, { waitUntil: "domcontentloaded" })
    const profiles = page.getByRole("radiogroup", { name: "KI-Profil" })
    await profiles.getByRole("radio").first().waitFor()
    results["profiles"] = await radioNames(profiles)
    check(JSON.stringify(results["profiles"]) === JSON.stringify(["Standard (Vorgabe)", "Vorsichtig", "Waghalsig", "Experimentell", "Zufällig"]), `preferences: profiles ${JSON.stringify(results["profiles"])}`)
    check((await page.getByText(/Forge kennt keine Schwierigkeitsstufen/).count()) === 1, "preferences: the note that Forge has no difficulty levels is missing")
    await profiles.getByRole("radio", { name: /^Waghalsig/ }).click()
    await settingStored(page, "ai.profile", { kind: "profile", name: "Reckless" }, "preferences")
    await page.getByRole("radiogroup", { name: "Kartensprache" }).getByRole("radio", { name: /^Englisch/ }).click()
    await settingStored(page, "display.cardLanguage", "en", "preferences")
    results["settingsAxe"] = await accessibility(page, "preferences: settings")
    await screenshots(page, "desktop-settings")

    // 2. The card language in the app: the deck list names the commander in English now.
    await page.goto(new URL("/decks", base).href, { waitUntil: "domcontentloaded" })
    const brawl = page.getByRole("list", { name: "Gespeicherte Decks" }).getByRole("link", { name: /E2E Brawl/ })
    await brawl.waitFor()
    const brawlText = (await brawl.textContent()) ?? ""
    results["englishDeck"] = brawlText
    check(brawlText.includes("Kommandeur: Valki, God of Lies") && !brawlText.includes("nicht ganz deutsch"), `preferences: English deck row "${brawlText}"`)

    // 3. Play: the profile is shown (no step before the start), the engine boots with English cards.
    await page.goto(new URL("/play", base).href, { waitUntil: "domcontentloaded" })
    await chooseDeck(page, "Dein Deck wählen", "E2E Izzet Tempo")
    await chooseDeck(page, "Deck der KI wählen", "E2E Deutsch")
    await page.getByText(/^Profil Waghalsig – Spielt auf Angriff/).waitFor()
    await enginePanel(page).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
    const english = await engineFacts(page)
    results["englishEngine"] = english
    check(
      english["Sprache von Forge"] === "Deutsch" && english["Karten in Forges Texten"] === "Englisch" && english["KI-Profile"] === "Vorsichtig, Standard, Experimentell, Waghalsig",
      `preferences: engine facts ${JSON.stringify(english)}`,
    )

    // 4. A game: Forge confirms the profile it plays (game.started), shown on the AI's side.
    results["startMs"] = await startAndWait(page)
    const aiBadges = await page.getByRole("region", { name: "Forge-KI" }).locator('[data-slot="badge"]').allTextContents()
    results["aiBadges"] = aiBadges
    check(aiBadges[0] === "Waghalsig", `preferences: the AI's profile on the table ${JSON.stringify(aiBadges)}`)
    results["playingAxe"] = await accessibility(page, "preferences: running game")
    await concedeGame(page)

    // 5. German cards again while the next engine is warm: it is replaced by one with German cards - never two at once.
    await page.goto(new URL("/settings", base).href, { waitUntil: "domcontentloaded" })
    await page.getByRole("radiogroup", { name: "Kartensprache" }).getByRole("radio", { name: /^Deutsch/ }).click()
    await settingStored(page, "display.cardLanguage", "de", "preferences")
    await page.goto(new URL("/play", base).href, { waitUntil: "domcontentloaded" })
    await enginePanel(page).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
    const german = await engineFacts(page)
    results["germanEngine"] = german
    check(german["Karten in Forges Texten"] === "Deutsch", `preferences: after switching back ${JSON.stringify(german)}`)

    // 6. Random: a profile is drawn for the game, and the game says so.
    await page.getByRole("button", { name: "KI-Profil ändern" }).click()
    const dialog = page.getByRole("dialog", { name: "KI-Profil wählen" })
    await dialog.getByRole("radio", { name: /^Zufällig/ }).click()
    await settingStored(page, "ai.profile", { kind: "random" }, "preferences")
    results["profileDialogAxe"] = await accessibility(page, "preferences: profile dialog")
    await dialog.getByRole("button", { name: "Fertig" }).click()
    await overlaysGone(page)
    await startAndWait(page)
    const drawnBadges = await page.getByRole("region", { name: "Forge-KI" }).locator('[data-slot="badge"]').allTextContents()
    results["drawnBadges"] = drawnBadges
    check(/^(Standard|Vorsichtig|Waghalsig|Experimentell) \(zufällig\)$/.test(drawnBadges[0] ?? ""), `preferences: the drawn profile ${JSON.stringify(drawnBadges)}`)
    await concedeGame(page)
    results["workers"] = { created: workers.created(), maxAtOnce: workers.max() }
    check(workers.max() <= 1, `preferences: ${workers.max()} engines at the same time`)

    // 7. Less motion: the dialogs animate by default; not with the setting.
    await page.goto(new URL("/play", base).href, { waitUntil: "domcontentloaded" })
    const openProfiles = () => page.getByRole("button", { name: "KI-Profil ändern" }).click()
    const animated = await dialogAnimation(page, openProfiles, "KI-Profil wählen")
    await page.goto(new URL("/settings", base).href, { waitUntil: "domcontentloaded" })
    await page.getByRole("switch", { name: "Bewegungen reduzieren" }).click()
    await settingStored(page, "display.motion", "reduce", "preferences")
    // The page reads the stored setting back and then marks <html>.
    const marked = await page
      .waitForFunction(() => document.documentElement.hasAttribute("data-reduced-motion"), undefined, { timeout: 10_000 })
      .then(() => true, () => false)
    check(marked, "preferences: <html data-reduced-motion> missing")
    await page.goto(new URL("/play", base).href, { waitUntil: "domcontentloaded" })
    const reduced = await dialogAnimation(page, openProfiles, "KI-Profil wählen")
    results["motion"] = { byDefault: animated, withTheSetting: reduced }
    check(animated === "enter" && reduced === "none", `preferences: dialog animation ${JSON.stringify(results["motion"])}`)

    // 8. Diagnostics: every version, copied as it is shown.
    await page.goto(new URL("/settings", base).href, { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Diagnose anzeigen" }).click()
    const diagnostics = page.getByRole("dialog", { name: "Diagnose" })
    const text = await diagnostics.getByRole("textbox", { name: "Diagnose" }).inputValue()
    results["diagnostics"] = text
    for (const line of [
      "[App]",
      `Kennung: ${id}`,
      "Forge: 2.0.15, Stand ed0333fecb1fea0671b3e50cadc1da4f71db5798",
      "Protokoll: Version 4",
      "KI-Profil: zufällig (jede Partie neu)",
      "Kartensprache: Deutsch",
      "Bewegungen reduzieren: immer (Gerät wünscht es: nein)",
      "Isoliert (COOP/COEP): ja",
    ]) {
      check(text.includes(line), `preferences: the diagnostics lack "${line}"`)
    }
    results["diagnosticsAxe"] = await accessibility(page, "preferences: diagnostics")
    await diagnostics.getByRole("button", { name: "Kopieren" }).click()
    await page.getByText("Diagnose kopiert").waitFor()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    check(copied === text, "preferences: the copied diagnostics differ from the shown ones")
    for (const error of pageLog.errors) check(false, `preferences: ${error}`)
  } finally {
    await context.close()
  }
  results["deviceMotion"] = await deviceMotion(browser, base)
  results["phone"] = await preferencesPhone(browser, base)
  return results
}

/** A device that asks for less motion: OpenMana follows it without the setting, and says so. */
async function deviceMotion(browser: Browser, base: string): Promise<Record<string, unknown>> {
  const viewport = VIEWPORTS[2]!
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: "de-DE", reducedMotion: "reduce" })
  const page = await context.newPage()
  const pageLog = watch(page)
  try {
    await page.goto(new URL("/settings", base).href, { waitUntil: "domcontentloaded" })
    const said = page.getByText(/Dein Gerät wünscht weniger Bewegung/)
    await said.waitFor()
    const toggle = page.getByRole("switch", { name: "Bewegungen reduzieren" })
    check(!(await toggle.isChecked()), "device motion: the switch is on without the player")
    const animation = await dialogAnimation(page, () => page.getByRole("button", { name: "Diagnose anzeigen" }).click(), "Diagnose")
    check(animation === "none", `device motion: the dialog animates (${animation})`)
    for (const error of pageLog.errors) check(false, `device motion: ${error}`)
    return { animation }
  } finally {
    await context.close()
  }
}

/** The settings on a phone with touch: every option a large enough target, nothing overflows. */
async function preferencesPhone(browser: Browser, base: string): Promise<Record<string, unknown>> {
  const context = await newContext(browser, VIEWPORTS[0]!)
  const page = await context.newPage()
  const pageLog = watch(page)
  try {
    await page.goto(new URL("/settings", base).href, { waitUntil: "domcontentloaded" })
    await page.getByRole("radiogroup", { name: "KI-Profil" }).getByRole("radio").first().waitFor()
    // Measured before any full-page screenshot (it resets the touch emulation).
    const rows = page.locator('[data-slot="field-label"]:has([role="radio"], [role="switch"])')
    const heights: number[] = []
    for (let i = 0; i < (await rows.count()); i++) heights.push(await layoutHeight(rows.nth(i)))
    check(heights.length === 8 && heights.every((height) => height >= 44), `preferences (phone): option rows ${JSON.stringify(heights)}`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(overflow <= 0, `preferences (phone): overflow ${overflow}px`)
    const axe = await accessibility(page, "preferences (phone): settings")
    await screenshots(page, "phone-settings")
    for (const error of pageLog.errors) check(false, `preferences (phone): ${error}`)
    return { heights, overflow, axe }
  } finally {
    await context.close()
  }
}

// ── 12. Game table (recorded real scenes in the real table, every size) ────

/** The recorded real scenes (src/test/table-scenes.ts, scripts/record-table-scenes.ts); since prompt 15 also one per kind of Forge's decisions the recorded games reach. */
const TABLE_SCENES = [
  "opening",
  "main-phase",
  "stack",
  "blockers",
  "defend",
  "commander-late",
  "command-effects",
  "play-draw",
  "target",
  "target-player",
  "yes-no",
  "discard",
  "choose-mode",
  "scry",
  "ability",
  "damage",
] as const

/** Forge's questions the recorded games do not reach, built after the schema on the recorded "main-phase" state (src/test/built-questions.ts) - marked as built. */
const BUILT_SCENES = ["confirm", "input", "order", "reveal", "choose-many", "select-outside"] as const

/** The sizes at which every kind of question is also answered (decisionInteractions); the layout is checked at all. */
const DECISION_VIEWPORTS: readonly string[] = ["small-phone", "phone-landscape", "desktop"]

/** The sizes the table must fit: phones upright and turned, a small phone, an unfolded foldable upright, a tablet turned, a desktop. */
const TABLE_VIEWPORTS: readonly Viewport[] = [
  VIEWPORTS[0]!,
  { name: "phone-landscape", width: 915, height: 412, touch: true, scale: 2.625 },
  { name: "small-phone", width: 360, height: 740, touch: true, scale: 3 },
  VIEWPORTS[1]!,
  { name: "tablet-landscape", width: 1104, height: 884, touch: true, scale: 2 },
  VIEWPORTS[2]!,
]

/** Forge's marks in the recorded scenes (prompt 14): the playable land, the attacker blockers go to, Krenko who can still attack. */
const SCENE_MARKS: Partial<Record<(typeof TABLE_SCENES)[number], { readonly usable: number; readonly selected: number }>> = {
  opening: { usable: 0, selected: 0 },
  "main-phase": { usable: 1, selected: 0 },
  defend: { usable: 0, selected: 1 },
  "commander-late": { usable: 1, selected: 0 },
}

/**
 * The cards as touch and click targets (prompt 14): every card the player
 * may see is a button of its row; the smallest keeps WCAG 2.2's minimum
 * target size (2.5.8: 24 × 24 px). Cards are sized by their rows, so they
 * stay below the 44 px of buttons on small phones - a mis-tap only opens the
 * card view, and the steps that tap at once take a tap back.
 */
async function cardTargets(page: Page, label: string): Promise<{ readonly count: number; readonly smallest: { readonly width: number; readonly height: number } | null }> {
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('button[data-slot="game-card"]')].map((card) => {
      const box = card.getBoundingClientRect()
      return { width: Math.round(box.width), height: Math.round(box.height) }
    }),
  )
  if (boxes.length === 0) return { count: 0, smallest: null }
  const smallest = { width: Math.min(...boxes.map((box) => box.width)), height: Math.min(...boxes.map((box) => box.height)) }
  check(smallest.width >= 24 && smallest.height >= 24, `${label}: a card target of ${smallest.width}×${smallest.height}px`)
  return { count: boxes.length, smallest }
}

/** The cards the harness's table tapped so far (window.__openmanaTaps). */
function harnessTaps(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { __openmanaTaps?: number[] }).__openmanaTaps ?? [])
}

async function openScene(page: Page, base: string, scene: string, query = ""): Promise<void> {
  await page.goto(new URL(`/scripts/e2e/table-harness.html?scene=${scene}${query}`, base).href, { waitUntil: "domcontentloaded" })
  await page.locator('[data-harness="table"]').waitFor({ timeout: 300_000 })
}

/** A touch at the middle of an element, held (a long press) or moved sideways (a swipe), through Chrome's own touch input. */
async function touch(page: Page, element: Locator, gesture: { readonly holdMs?: number; readonly moveX?: number }): Promise<void> {
  const box = await element.boundingBox()
  if (box === null) throw new Error("the element has no box")
  const cdp = await page.context().newCDPSession(page)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
  if (gesture.moveX !== undefined) {
    for (let step = 1; step <= 10; step++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (gesture.moveX * step) / 10, y }] })
      await page.waitForTimeout(16)
    }
  }
  if (gesture.holdMs !== undefined) await page.waitForTimeout(gesture.holdMs)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await cdp.detach()
}

async function closeCardView(page: Page): Promise<void> {
  await page.keyboard.press("Escape")
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null)
}

/**
 * Operating the cards in real Chrome (prompt 14), on recorded scenes in the
 * real table, with the harness recording what would be tapped:
 *  - priority (main-phase): the playable land opens its card view (no tap),
 *    on the side the screen's orientation gives it; a press on the view's
 *    button right after it appeared (a double tap's second touch) taps
 *    nothing, a later one taps the land; a double click on a card opens its
 *    view and keeps it open, tapping nothing;
 *  - blocking (defend): a click taps the blocker at once - a double click
 *    once -, a right click or a long press looks instead;
 *  - a full row on a phone (commander-late): a swipe scrolls it and neither
 *    looks nor taps;
 *  - the keyboard (desktop): arrow keys, End and Home within the hand, Enter
 *    looks, Escape returns to the card.
 */
async function tableInteractions(page: Page, base: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const label = `game table (${viewport.name})`
  const results: Record<string, unknown> = {}
  const landscape = viewport.width > viewport.height

  // Priority: look first, the view's button taps - armed.
  await openScene(page, base, "main-phase")
  const land = page.locator('button[data-card="25"]')
  if (viewport.touch) await land.tap()
  else await land.click()
  const view = page.getByRole("dialog", { name: "Gebirge" })
  await view.waitFor()
  const side = await page.locator('[data-slot="sheet-content"]').getAttribute("data-side")
  check(side === (landscape ? "right" : "bottom"), `${label}: the card view comes from "${side}"`)
  check((await harnessTaps(page)).length === 0, `${label}: looking at the land tapped it`)
  await animationsDone(view)
  results["viewAxe"] = await accessibility(page, `${label}: card view`)
  await page.screenshot({ path: path.join(reportDir, "screens", `table-${viewport.name}-card-view.png`) })
  const tapHeight = await layoutHeight(view.getByRole("button", { name: "Spiele ein Land" }))
  if (viewport.touch) check(tapHeight >= 44, `${label}: the card view's tap button ${tapHeight}px high`)
  await closeCardView(page)
  // A double tap's second touch lands on the button that just appeared: it must not tap.
  await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('button[data-card="25"]')!.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    ;[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((button) => button.textContent === "Spiele ein Land")!.click()
  })
  check((await harnessTaps(page)).length === 0, `${label}: the view's button tapped right after it appeared`)
  await page.waitForTimeout(600)
  await view.getByRole("button", { name: "Spiele ein Land" }).click()
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null)
  const armedTaps = await harnessTaps(page)
  check(armedTaps.join() === "25", `${label}: the armed button tapped ${JSON.stringify(armedTaps)}`)
  if (!viewport.touch) {
    await land.dblclick()
    await view.waitFor()
    await page.waitForTimeout(300)
    check(await view.isVisible(), `${label}: a double click on a card closed its view again`)
    check((await harnessTaps(page)).join() === "25", `${label}: a double click on a card tapped it`)
    await closeCardView(page)
  }
  results["priority"] = { side, tapHeight, taps: armedTaps }

  // Blocking: a tap acts at once (a double one once); a right click or long press looks.
  await openScene(page, base, "defend")
  const blocker = page.locator('button[data-card="58"]')
  if (viewport.touch) await blocker.tap()
  else await blocker.click()
  await page.waitForTimeout(100)
  check((await harnessTaps(page)).join() === "58" && (await page.getByRole("dialog").count()) === 0, `${label}: a tap on the blocker ${JSON.stringify(await harnessTaps(page))}`)
  await page.waitForTimeout(600)
  if (!viewport.touch) {
    await blocker.dblclick()
    await page.waitForTimeout(100)
    check((await harnessTaps(page)).join() === "58,58", `${label}: a double click on the blocker ${JSON.stringify(await harnessTaps(page))}`)
    await blocker.click({ button: "right" })
  } else {
    await touch(page, blocker, { holdMs: 900 })
  }
  await page.getByRole("dialog").waitFor()
  const blockTaps = await harnessTaps(page)
  check(blockTaps.length === (viewport.touch ? 1 : 2), `${label}: looking at the blocker (${viewport.touch ? "long press" : "right click"}) tapped it ${JSON.stringify(blockTaps)}`)
  await closeCardView(page)
  results["block"] = { taps: blockTaps }

  // A swipe along a full row (a phone with fourteen attackers): the row scrolls, nothing is looked at or tapped.
  if (viewport.touch && viewport.width < 768) {
    await openScene(page, base, "commander-late")
    const row = page.getByRole("toolbar", { name: /^Kreaturen von dir|^Bleibende Karten von dir/ })
    const before = await row.evaluate((element) => element.scrollLeft)
    await touch(page, row.locator('button[data-slot="game-card"]').nth(1), { moveX: -160 })
    await page.waitForTimeout(400)
    const after = await row.evaluate((element) => element.scrollLeft)
    check(after > before, `${label}: the swipe did not scroll the row (${before} → ${after})`)
    check((await page.getByRole("dialog").count()) === 0 && (await harnessTaps(page)).length === 0, `${label}: the swipe looked or tapped`)
    results["swipe"] = { before, after }
  }

  // The keyboard: one stop per row, the arrow keys inside it, Enter looks, Escape returns.
  if (!viewport.touch) {
    await openScene(page, base, "opening")
    const hand = page.getByRole("toolbar", { name: "Deine Hand: 7 Karten" })
    const cards = hand.getByRole("button")
    await cards.first().focus()
    const focusedCard = () => page.evaluate(() => document.activeElement?.getAttribute("data-card") ?? null)
    const ids = await cards.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-card")))
    // Radix moves the focus a tick after the key: wait for the card expected, then read where it is.
    const press = async (key: string, expected: string | null | undefined) => {
      await page.keyboard.press(key)
      await page.waitForFunction((id) => document.activeElement?.getAttribute("data-card") === id, expected ?? null, { timeout: 2000 }).catch(() => undefined)
      return focusedCard()
    }
    const second = await press("ArrowRight", ids[1])
    const last = await press("End", ids[6])
    const first = await press("Home", ids[0])
    check(second === ids[1] && last === ids[6] && first === ids[0], `${label}: arrow keys in the hand ${JSON.stringify({ second, last, first, ids })}`)
    await page.keyboard.press("Enter")
    await page.getByRole("dialog").waitFor()
    const inView = await page.evaluate(() => document.activeElement?.getAttribute("role"))
    await closeCardView(page)
    await page.waitForFunction((id) => document.activeElement?.getAttribute("data-card") === id, ids[0] ?? null, { timeout: 2000 }).catch(() => undefined)
    const back = await focusedCard()
    check(inView === "dialog" && back === ids[0], `${label}: Enter looks (${inView}), Escape returns (${back})`)
    await page.keyboard.press("Tab")
    const next = await page.evaluate(() => document.activeElement?.closest('[data-slot="game-card-row"]')?.getAttribute("aria-label") ?? document.activeElement?.tagName ?? null)
    check(next !== "Deine Hand: 7 Karten", `${label}: Tab stayed in the hand (${next})`)
    check((await harnessTaps(page)).length === 0, `${label}: the keyboard tapped a card`)
    results["keyboard"] = { second, last, first, inView, back, afterTab: next }
  }
  return results
}

/** The answers the harness's table gave so far (window.__openmanaAnswers: question id and answer). */
function harnessAnswers(page: Page): Promise<[number, Record<string, unknown>][]> {
  return page.evaluate(() => (window as unknown as { __openmanaAnswers?: [number, Record<string, unknown>][] }).__openmanaAnswers ?? [])
}

/**
 * Forge's decision on the table (prompt 15): its answer buttons lie in the
 * window (they stick to the bottom of the region while a list scrolls above
 * them), every button of the decision is touch-sized on a touch screen,
 * nothing leaves the region sideways.
 */
async function decisionFits(page: Page, label: string, viewport: Viewport): Promise<Record<string, unknown> | null> {
  const info = await page.evaluate(() => {
    const region = document.querySelector<HTMLElement>('[data-area="decision"]')
    if (region === null) return null
    const box = (element: Element | null | undefined) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right) }
    }
    const buttons = [...region.querySelectorAll<HTMLElement>('button[data-slot="button"], [role="radio"], [role="checkbox"]')]
    // A radio or checkbox is operated through its whole choice card (its label).
    const target = (element: HTMLElement) => (element.getAttribute("role") === "radio" || element.getAttribute("role") === "checkbox" ? (element.closest("label") ?? element) : element)
    return {
      board: document.querySelector('[data-slot="game-board"]')?.getAttribute("data-decision") ?? null,
      region: box(region),
      scroll: { width: region.scrollWidth, clientWidth: region.clientWidth, height: region.scrollHeight, clientHeight: region.clientHeight },
      actions: box(region.querySelector('[data-slot="game-decision-actions"]')),
      smallest: buttons.length === 0 ? null : Math.min(...buttons.map((element) => target(element).offsetHeight)),
      window: { width: window.innerWidth, height: window.innerHeight },
    }
  })
  if (info === null) return null
  if (info.actions !== null) check(info.actions.top >= 0 && info.actions.bottom <= info.window.height + 1, `${label}: the decision's buttons outside the window ${JSON.stringify(info.actions)}`)
  check(info.scroll.width <= info.scroll.clientWidth + 1, `${label}: the decision is wider than its region ${JSON.stringify(info.scroll)}`)
  if (viewport.touch && info.smallest !== null) check(info.smallest >= 44, `${label}: a control of the decision ${info.smallest}px high`)
  return info
}

/**
 * Answering every kind of Forge's questions in real Chrome (prompt 15), on
 * the recorded scenes and the built ones, with the harness recording each
 * answer: the controls a player uses (Forge's buttons, radios, checkboxes,
 * arrows, plus/minus, a number typed, a card of a selection), each press
 * after the buttons armed; the answer must be exactly the protocol's.
 */
async function decisionInteractions(page: Page, base: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const label = `game decisions (${viewport.name})`
  const decision = page.getByRole("region", { name: "Entscheidung" })
  const activate = async (locator: Locator) => {
    if (viewport.touch) await locator.tap()
    else await locator.click()
  }
  const armed = async (locator: Locator) => {
    await page.waitForTimeout(ARMED_AFTER_MS)
    await activate(locator)
  }
  const results: Record<string, unknown> = {}
  const expectLast = async (name: string, expected: Record<string, unknown>) => {
    await page.waitForFunction((count) => ((window as unknown as { __openmanaAnswers?: unknown[] }).__openmanaAnswers ?? []).length >= count, 1, { timeout: 5000 }).catch(() => undefined)
    const answers = await harnessAnswers(page)
    const body = answers.at(-1)?.[1] ?? null
    check(answers.length === 1 && JSON.stringify(body) === JSON.stringify(expected), `${label}: ${name} answered ${JSON.stringify(answers)}, expected ${JSON.stringify(expected)}`)
    results[name] = body
  }
  const scene = async (name: string, built?: string) => openScene(page, base, name, built ? `&built=${built}` : "")
  const button = (name: string) => decision.getByRole("button", { name, exact: true })

  await scene("opening")
  await armed(button("Behalten"))
  await expectLast("mulligan", { kind: "buttons", button: 1 })

  await scene("play-draw")
  await armed(button("Draw"))
  await expectLast("play or draw", { kind: "buttons", button: 2 })

  await scene("target")
  await armed(button("Abbrechen"))
  await expectLast("target: cancel", { kind: "buttons", button: 2 })

  await scene("choose-mode")
  await activate(decision.getByRole("radio").nth(1))
  await armed(button("Bestätigen"))
  await expectLast("mode", { kind: "choose", choices: [2] })

  await scene("scry")
  await activate(button("Nach unten (Goblin-Brandstifter)"))
  await armed(button("Bestätigen"))
  await expectLast("scry", { kind: "arrange", top: [2], bottom: [1] })

  await scene("ability")
  await activate(decision.getByRole("radio").nth(1))
  await armed(button("Bestätigen"))
  await expectLast("ability", { kind: "options", option: 2 })

  await scene("damage")
  await activate(button("Bei Canyon Minotaur einen mehr"))
  await activate(button("Bei Raging Goblin einen mehr"))
  await armed(button("Bestätigen"))
  await expectLast("combat damage", { kind: "distribute", amounts: [1, 1] })

  await scene("main-phase", "confirm")
  await armed(button("Nein"))
  await expectLast("confirm (built)", { kind: "confirm", yes: false })

  await scene("main-phase", "input")
  const field = decision.getByRole("textbox", { name: "Deine Zahl" })
  await field.fill("3")
  await page.waitForTimeout(ARMED_AFTER_MS)
  await field.press("Enter")
  await expectLast("input (built)", { kind: "input", value: "3" })

  await scene("main-phase", "order")
  const third = (await decision.getByRole("region", { name: "Reihenfolge" }).getByRole("listitem").nth(2).locator('[data-slot="item-title"]').textContent())?.replace(/^3\. /, "").trim() ?? ""
  await activate(button(`${third} nach oben`))
  await armed(button("Bestätigen"))
  await expectLast("order (built)", { kind: "order", order: [1, 3, 2] })

  await scene("main-phase", "reveal")
  await armed(button("OK"))
  await expectLast("reveal (built)", { kind: "options", option: 1 })

  await scene("main-phase", "choose-many")
  await activate(decision.getByRole("checkbox", { name: "Blau" }))
  await activate(decision.getByRole("checkbox", { name: "Rot" }))
  await armed(button("Bestätigen"))
  await expectLast("several choices (built)", { kind: "choose", choices: [2, 4] })

  await scene("main-phase", "select-outside")
  await activate(decision.getByRole("toolbar", { name: "Wählbare Karten, die nicht auf dem Tisch liegen" }).getByRole("button").first())
  await expectLast("a card outside the table (built)", { kind: "select", choices: [1] })
  check((await harnessTaps(page)).length === 0, `${label}: answering tapped a card`)
  return results
}

/**
 * The live games of 10 can only reach Forge's first decision (answering
 * Forge comes with prompts 14-19), so their battlefields are empty. The
 * table's layout with full battlefields - piles, tapped cards, a stack,
 * blockers, fourteen attackers, the command zone - is checked here: the real
 * table code (GameTable, the real card lookup and catalog) shows recorded
 * real states of the engine's test games in real Chrome, served by the dev
 * server (scripts/e2e/table-harness.html, src/test/table-harness.tsx), at
 * every size: the page never scrolls, every region is in view, cards keep
 * to their row (a full row scrolls sideways), pictures load, touch targets,
 * axe-core.
 */
async function tableHarness(browser: Browser): Promise<Record<string, unknown>> {
  log("Game table (recorded real scenes in the real table, every size)")
  const server = await createServer({ root, configFile: path.join(root, "vite.config.ts"), logLevel: "warn", server: { host: "127.0.0.1", port: 0 } })
  await server.listen()
  const base = server.resolvedUrls?.local[0]
  if (!base) throw new Error("the dev server did not report its URL")
  const results: Record<string, unknown> = {}
  try {
    for (const viewport of TABLE_VIEWPORTS) {
      log(`  ${viewport.name} (${viewport.width}x${viewport.height}${viewport.touch ? ", touch" : ""})`)
      const context = await newContext(browser, viewport)
      const scenes: Record<string, unknown> = {}
      try {
        const runs = [...TABLE_SCENES.map((scene) => ({ scene: scene as string, built: null as string | null })), ...BUILT_SCENES.map((built) => ({ scene: "main-phase", built: built as string | null }))]
        for (const { scene, built } of runs) {
          const name = built === null ? scene : `built:${built}`
          const label = `game table (${viewport.name}, ${name})`
          // A fresh page per scene (the profile keeps the catalog): the dev server's many modules, loaded dozens of times in one page, exhausted Chrome on a busy machine.
          const page = await context.newPage()
          const pageLog = watch(page)
          await page.goto(new URL(`/scripts/e2e/table-harness.html?scene=${scene}${built === null ? "" : `&built=${built}`}`, base).href, { waitUntil: "domcontentloaded" })
          // The first scene of a browser profile installs the card catalog, as the app does.
          await page.locator('[data-harness="table"]').waitFor({ timeout: 300_000 })
          const layout = await checkTableFits(page, label)
          const pictures = await tablePictures(page, label)
          // Every card keeps to its row's height; a row with more cards than room scrolls sideways.
          const rows = await page.evaluate(() =>
            [...document.querySelectorAll('[data-slot="game-board-area"] ul')].map((row) => {
              const box = row.getBoundingClientRect()
              const cards = [...row.querySelectorAll('[data-slot="game-card"]')].map((figure) => figure.getBoundingClientRect())
              return {
                label: row.getAttribute("aria-label"),
                height: Math.round(box.height),
                cardHeight: cards.length > 0 ? Math.round(Math.min(...cards.map((card) => card.height))) : null,
                inside: cards.every((card) => card.top >= box.top - 1 && card.bottom <= box.bottom + 1),
                scrolls: row.scrollWidth > row.clientWidth + 1,
              }
            }),
          )
          for (const row of rows) check(row.inside, `${label}: cards leave their row ${JSON.stringify(row)}`)
          if (scene === "commander-late" && viewport.width < 768) check(rows.some((row) => row.scrolls), `${label}: no row scrolls sideways with 14 attackers on a phone`)
          const menu = viewport.touch ? await layoutHeight(page.getByRole("button", { name: "Menü" })) : null
          if (menu !== null) check(menu >= 44, `${label}: the menu button ${menu}px high`)
          const cards = await cardTargets(page, label)
          const marks = await page.evaluate(() => ({
            usable: document.querySelectorAll('button[data-mark="usable"]').length,
            selected: document.querySelectorAll('button[data-mark="selected"]').length,
          }))
          const expected = built === null ? SCENE_MARKS[scene as (typeof TABLE_SCENES)[number]] : undefined
          if (expected) check(marks.usable === expected.usable && marks.selected === expected.selected, `${label}: marks ${JSON.stringify(marks)}, expected ${JSON.stringify(expected)}`)
          const decision = await decisionFits(page, label, viewport)
          const axe = await accessibility(page, label)
          await page.screenshot({ path: path.join(reportDir, "screens", `table-${viewport.name}-${built === null ? scene : `built-${built}`}.png`) })
          scenes[name] = { areas: layout["areas"], pictures, rows, menu, cards, marks, decision, axe }
          for (const error of pageLog.errors) check(false, `${label}: ${error}`)
          await page.close()
        }
        const page = await context.newPage()
        const pageLog = watch(page)
        scenes["interaction"] = await tableInteractions(page, base, viewport)
        await page.close()
        // Answering every kind (prompt 15) where it is tightest and on the desktop: a small phone, a phone turned, a mouse.
        if (DECISION_VIEWPORTS.includes(viewport.name)) {
          const answers = await context.newPage()
          const answersLog = watch(answers)
          scenes["decisions"] = await decisionInteractions(answers, base, viewport)
          for (const error of answersLog.errors) check(false, `game decisions (${viewport.name}): ${error}`)
          await answers.close()
        }
        for (const error of pageLog.errors) check(false, `game table (${viewport.name}): ${error}`)
      } finally {
        await context.close()
      }
      results[viewport.name] = scenes
    }
  } finally {
    await server.close()
  }
  return results
}

// ── 13. The ORYX cloud on OpenMana's real address ─────────────────────────

const REAL_ORIGIN = "https://openmana.vercel.app"
const SUPABASE = "https://fellumrfugohnnvtxxye.supabase.co"
const STAND_IN_CLIENT = "00000000-0000-4000-8000-00000000c11e"

interface StandInRow {
  revision: number
  save_version: number
  save_data: unknown
  data_hash: string
  summary: unknown
  playtime_ms: number | null
  device_label: string | null
  updated_at: string
  deleted_at: string | null
}

/**
 * A stand-in for the ORYX cloud as the SDK reaches it - Supabase's OAuth
 * endpoints (the consent page only remembers the PKCE challenge; the token
 * exchange checks the verifier against it), the games table, the client
 * config, cloud_saves and oryx_put_save with its revision check - answered
 * with Supabase's CORS headers, so Chrome applies COEP to them as to the real
 * one. Nothing reaches the real ORYX.
 */
function standInCloud(): {
  readonly rows: Map<string, StandInRow>
  readonly calls: string[]
  readonly uploads: Record<string, unknown>[]
  /** The access token the stand-in hands out (a device that connected before keeps it). */
  readonly token: string
  handle(route: Route): Promise<void>
} {
  const rows = new Map<string, StandInRow>()
  const calls: string[] = []
  const uploads: Record<string, unknown>[] = []
  let challenge: string | null = null
  const token = ["{\"alg\":\"ES256\"}", JSON.stringify({ sub: "00000000-0000-4000-8000-0000000000a1", email: "spieler@example.invalid", exp: Math.floor(Date.now() / 1000) + 3600 }), "sig"]
    .map((part, i) => (i < 2 ? Buffer.from(part).toString("base64url") : part))
    .join(".")
  const cors = {
    "access-control-allow-origin": REAL_ORIGIN,
    "access-control-allow-headers": "apikey, authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    vary: "Origin",
  }
  async function handle(route: Route): Promise<void> {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors })
    calls.push(`${request.method()} ${url.pathname}`)
    const json = (status: number, body: unknown) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) })
    if (url.pathname === "/auth/v1/oauth/authorize") {
      challenge = url.searchParams.get("code_challenge")
      return route.fulfill({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: "<!doctype html><title>ORYX</title><p>Zustimmung (Stand-in)</p>" })
    }
    // The browser asks the consent page's site for its icon.
    if (url.pathname === "/favicon.ico") return route.fulfill({ status: 204 })
    if (url.pathname === "/rest/v1/games") return json(200, [{ oauth_client_id: STAND_IN_CLIENT, active: true }])
    if (url.pathname === "/auth/v1/oauth/token") {
      const form = new URLSearchParams(request.postData() ?? "")
      const verified = createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url") === challenge
      if (form.get("grant_type") !== "authorization_code" || form.get("code") !== "e2e-code" || form.get("client_id") !== STAND_IN_CLIENT || !verified) {
        return json(400, { error: "invalid_grant" })
      }
      return json(200, { access_token: token, refresh_token: "e2e-refresh", expires_in: 3600, token_type: "bearer" })
    }
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, headers: cors })
    if (request.headers()["authorization"] !== `Bearer ${token}`) return json(401, { message: "JWT expired" })
    if (url.pathname === "/rest/v1/rpc/oryx_client_config") return json(200, { ok: true, sync_enabled: true, max_slots: 2, max_save_bytes: 1_048_576 })
    if (url.pathname === "/rest/v1/rpc/oryx_add_playtime") return json(200, { ok: true })
    // Since ORYX SDK 1.1.0 the play time is reported as a device's total.
    if (url.pathname === "/rest/v1/rpc/oryx_report_playtime") return json(200, { ok: true })
    if (url.pathname === "/rest/v1/cloud_saves") {
      const row = rows.get((url.searchParams.get("slot") ?? "").replace(/^eq\./, ""))
      return json(200, row ? [row] : [])
    }
    if (url.pathname === "/rest/v1/rpc/oryx_put_save") {
      const body = request.postDataJSON() as Record<string, unknown>
      const slot = String(body["p_slot"])
      const row = rows.get(slot)
      if ((row?.revision ?? 0) !== body["p_base_revision"]) return json(200, { ok: false, error: "conflict", revision: row?.revision ?? 0 })
      const next: StandInRow = {
        revision: (row?.revision ?? 0) + 1,
        save_version: Number(body["p_save_version"]),
        save_data: body["p_data"],
        data_hash: String(body["p_data_hash"]),
        summary: body["p_summary"] ?? null,
        playtime_ms: null,
        device_label: typeof body["p_device_label"] === "string" ? body["p_device_label"] : null,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }
      rows.set(slot, next)
      uploads.push(body["p_data"] as Record<string, unknown>)
      return json(200, { ok: true, revision: next.revision })
    }
    return json(404, { message: `not in the stand-in: ${request.method()} ${url.pathname}` })
  }
  return { rows, calls, uploads, token, handle }
}

/**
 * The build as OpenMana's real address serves it: Playwright answers every
 * request to https://openmana.vercel.app from the running preview (with its
 * COOP/COEP headers), so the ORYX SDK is active exactly as on the real site.
 */
async function servedAsReal(context: BrowserContext, base: string): Promise<void> {
  await context.route(`${REAL_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: new URL(`${url.pathname}${url.search}`, base).href })
    await route.fulfill({ response })
  })
}

async function oryxCloud(browser: Browser, base: string): Promise<void> {
  log("ORYX cloud (OpenMana's real address, a stand-in ORYX cloud)")
  const results: Record<string, unknown> = {}
  const cloud = standInCloud()
  // A collection another device of the player saved: one deck and the AI profile.
  const fromThere = sampleBackup(1, "Aus der Cloud")
  const cloudDeck = (gunzipSync(fromThere.bytes).toString("utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>).find((line) => line["store"] === "decks")?.["record"]) as Record<string, unknown>
  cloud.rows.set("collection", {
    revision: 4,
    save_version: SCHEMA_VERSION,
    save_data: { schemaVersion: SCHEMA_VERSION, decks: [cloudDeck], deckTombstones: [], settings: [{ key: "ai.profile", value: { kind: "random" }, updatedAt: "2026-09-01T10:00:00.000Z" }] },
    data_hash: "from-another-device",
    summary: { Decks: 1 },
    playtime_ms: null,
    device_label: "Android · ORYX-App",
    updated_at: "2026-09-25T10:00:00.000Z",
    deleted_at: null,
  })
  const narrow: Viewport = { name: "narrow phone", width: 360, height: 780, touch: true, scale: 3 }
  for (const viewport of [VIEWPORTS[0]!, narrow]) {
    const context = await newContext(browser, viewport)
    await servedAsReal(context, base)
    await context.route(`${SUPABASE}/**`, (route) => cloud.handle(route))
    const page = await context.newPage()
    const pageLog = watch(page)
    try {
      if (viewport === narrow) {
        // A narrow phone: the card of a guest fits, and its button stays a touch target.
        await page.goto(`${REAL_ORIGIN}/settings`, { waitUntil: "networkidle" })
        const card = page.getByRole("region", { name: "ORYX-Cloud" })
        await card.getByText("ORYX-Cloud: nicht verbunden").waitFor()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        const button = await card.getByRole("button", { name: "Mit ORYX verbinden" }).boundingBox()
        const cardBox = await card.boundingBox()
        check(overflow <= 0, `oryx: the settings page overflows a 360 px phone by ${overflow}px`)
        check(button !== null && cardBox !== null && button.x + button.width <= cardBox.x + cardBox.width, `oryx: the connect button runs out of its card at 360 px ${JSON.stringify({ button, cardBox })}`)
        check((button?.height ?? 0) >= 44, `oryx: the connect button is ${button?.height}px high`)
        await card.scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(reportDir, "screens", "narrow-phone-settings-oryx-guest.png") })
        // The same phone as a device that connected before: the longer button fits as well.
        await page.evaluate(
          (access) =>
            localStorage.setItem(
              "oryx.openmana.auth",
              JSON.stringify({ access, refresh: "e2e-refresh", expiresAt: Date.now() + 3_600_000, user: { id: "00000000-0000-4000-8000-0000000000a1", email: "spieler@example.invalid" } }),
            ),
          cloud.token,
        )
        await page.reload({ waitUntil: "networkidle" })
        const disconnect = card.getByRole("button", { name: "Verbindung auf diesem Gerät trennen" })
        await disconnect.waitFor()
        await card.getByText(/^ORYX-Cloud: verbunden/).waitFor()
        const connectedOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        const disconnectBox = await disconnect.boundingBox()
        const connectedCard = await card.boundingBox()
        check(connectedOverflow <= 0, `oryx: the connected card overflows a 360 px phone by ${connectedOverflow}px`)
        check(
          disconnectBox !== null && connectedCard !== null && disconnectBox.x + disconnectBox.width <= connectedCard.x + connectedCard.width,
          `oryx: the disconnect button runs out of its card at 360 px ${JSON.stringify({ disconnectBox, connectedCard })}`,
        )
        check((disconnectBox?.height ?? 0) >= 44, `oryx: the disconnect button is ${disconnectBox?.height}px high`)
        await card.scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(reportDir, "screens", "narrow-phone-settings-oryx-connected.png") })
        results["narrow"] = { overflow, button, connectedOverflow, disconnect: disconnectBox }
        for (const error of pageLog.errors) check(false, `oryx (narrow phone): ${error}`)
        continue
      }

      // 1. A guest with a deck of their own: the card, and not one request to the cloud.
      await page.goto(`${REAL_ORIGIN}/settings`, { waitUntil: "networkidle" })
      const local = await openLocalData(page, REAL_ORIGIN)
      const ownDecks = sampleBackup(1, "Nur hier")
      await chooseBackup(local, "eigene-decks.jsonl.gz", ownDecks.bytes)
      await page.getByRole("dialog", { name: "Sicherung laden" }).getByRole("button", { name: "Zusammenführen", exact: true }).click()
      await page.getByText("Sicherung geladen").waitFor()
      const card = page.getByRole("region", { name: "ORYX-Cloud" })
      await card.getByText("ORYX-Cloud: nicht verbunden").waitFor()
      check(await card.getByText("Nicht verbunden", { exact: true }).isVisible(), "oryx: the guest badge is missing")
      check(cloud.calls.length === 0, `oryx: a guest already talked to the cloud: ${JSON.stringify(cloud.calls)}`)
      check(await page.evaluate(() => globalThis.crossOriginIsolated), "oryx: the page on the real address is not cross-origin isolated")
      const connect = card.getByRole("button", { name: "Mit ORYX verbinden" })
      check(((await connect.boundingBox())?.height ?? 0) >= 44, "oryx: the connect button is smaller than 44 px")
      results["guestAxe"] = await accessibility(page, "oryx: settings (guest)")
      await card.scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(reportDir, "screens", "phone-settings-oryx-guest.png") })

      // 2. Connecting leaves for ORYX's consent page (a redirect, no popup: COOP), with PKCE.
      await connect.click()
      await page.waitForURL((url) => url.href.startsWith(`${SUPABASE}/auth/v1/oauth/authorize`))
      const authorize = new URL(page.url())
      check(authorize.searchParams.get("client_id") === STAND_IN_CLIENT, `oryx: client ${authorize.searchParams.get("client_id")}`)
      check(authorize.searchParams.get("redirect_uri") === `${REAL_ORIGIN}/`, `oryx: redirect ${authorize.searchParams.get("redirect_uri")}`)
      check(authorize.searchParams.get("code_challenge_method") === "S256" && (authorize.searchParams.get("code_challenge") ?? "").length >= 43, "oryx: no PKCE challenge")
      const state = authorize.searchParams.get("state") ?? ""

      // 3. ORYX sends the player back to OpenMana's address (its start page): the code is exchanged (verifier
      //    checked), code and state leave the address, the player is told, and the start's pull merges.
      await page.goto(`${REAL_ORIGIN}/?code=e2e-code&state=${encodeURIComponent(state)}`, { waitUntil: "networkidle" })
      await page.getByText("Mit ORYX verbunden").waitFor()
      check(page.url() === `${REAL_ORIGIN}/`, `oryx: the address after connecting is ${page.url()}`)
      await page.screenshot({ path: path.join(reportDir, "screens", "phone-start-oryx-connected.png") })
      await expectUpload(cloud, 1, "the start's merge")
      const merged = cloud.uploads[0] as { decks?: { name?: string }[]; settings?: { key?: string }[]; matches?: unknown }
      check(JSON.stringify((merged.decks ?? []).map((d) => d.name).sort()) === JSON.stringify(["Aus der Cloud 1", "Nur hier 1"]), `oryx: merged decks ${JSON.stringify(merged.decks?.map((d) => d.name))}`)
      check(JSON.stringify((merged.settings ?? []).map((s) => s.key)) === JSON.stringify(["ai.profile", "e2e.sample"]), `oryx: merged settings ${JSON.stringify(merged.settings?.map((s) => s.key))}`)
      check(!("matches" in merged), "oryx: recorded matches went to the cloud")
      const stored = await dumpDatabase(page)
      check(JSON.stringify(((stored["decks"] ?? []) as { name: string }[]).map((d) => d.name).sort()) === JSON.stringify(["Aus der Cloud 1", "Nur hier 1"]), "oryx: the merged decks are not on the device")
      // To the settings through the app (no reload): the card says connected.
      await page.getByRole("link", { name: "Einstellungen" }).first().click()
      await page.getByRole("heading", { level: 1, name: "Einstellungen" }).waitFor()
      await card.getByText("Verbunden", { exact: true }).waitFor()
      await card.getByText(/^ORYX-Cloud: verbunden/).waitFor()
      const connectedOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      check(connectedOverflow <= 0, `oryx: the connected settings page overflows the phone by ${connectedOverflow}px`)
      const disconnectHeight = (await card.getByRole("button", { name: "Verbindung auf diesem Gerät trennen" }).boundingBox())?.height ?? 0
      check(disconnectHeight >= 44, `oryx: the disconnect button is ${disconnectHeight}px high`)
      results["connectedAxe"] = await accessibility(page, "oryx: settings (connected)")
      await card.scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(reportDir, "screens", "phone-settings-oryx-connected.png") })

      // 4. The player's changes go up (collected: the SDK waits 15 s); settings of the device never.
      await page.getByRole("switch", { name: "Bewegungen reduzieren" }).click()
      await page.getByRole("radiogroup", { name: "KI-Profil" }).getByRole("radio", { name: /^Waghalsig/ }).click()
      await expectUpload(cloud, 2, "a changed AI profile", 40_000)
      const changed = cloud.uploads[1] as { settings?: { key?: string; value?: unknown }[] }
      const profile = (changed.settings ?? []).find((s) => s.key === "ai.profile")?.value
      check(JSON.stringify(profile) === JSON.stringify({ kind: "profile", name: "Reckless" }), `oryx: uploaded profile ${JSON.stringify(profile)}`)
      check(!(changed.settings ?? []).some((s) => s.key?.startsWith("display.")), `oryx: a setting of the device went to the cloud ${JSON.stringify(changed.settings)}`)
      check(cloud.rows.get("collection")?.save_version === SCHEMA_VERSION, "oryx: the collection's version is not the schema version")

      // 5. Disconnecting on this device: the data stays, the connection is forgotten.
      await card.getByRole("button", { name: "Verbindung auf diesem Gerät trennen" }).click()
      await page.getByText("Verbindung auf diesem Gerät getrennt").waitFor()
      await card.getByRole("button", { name: "Mit ORYX verbinden" }).waitFor()
      check((await page.evaluate(() => localStorage.getItem("oryx.openmana.auth"))) === null, "oryx: the tokens stayed after disconnecting")
      check(((await dumpDatabase(page))["decks"] ?? []).length === 2, "oryx: disconnecting changed the decks")
      results["calls"] = cloud.calls
      results["uploads"] = cloud.uploads.length
      for (const error of pageLog.errors) check(false, `oryx: ${error}`)
    } finally {
      await context.close()
    }
  }
  report["oryxCloud"] = results
}

/** Waits until the stand-in cloud holds `count` uploads (the SDK collects changes up to 15 s). */
async function expectUpload(cloud: { readonly uploads: readonly unknown[] }, count: number, label: string, timeoutMs = 15_000): Promise<void> {
  const until = Date.now() + timeoutMs
  while (cloud.uploads.length < count && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 100))
  check(cloud.uploads.length === count, `oryx: ${label}: ${cloud.uploads.length} uploads, expected ${count}`)
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
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu", NO_REAL_CLOUD] })
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
    await oryxCloud(browser, base)
    report["gameTable"] = await tableHarness(browser)
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
