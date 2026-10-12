/*
 * End-to-end test of the web app: the production build in real Chrome, with
 * the real Forge engine. No stand-ins.
 *
 *   npm run test:e2e                 build, then test
 *   npm run test:e2e -- --no-build   test the existing dist/
 *   npm run test:oryx -- --no-build   ORYX web navigation and stored records; desktop/touch emulation only
 *   npm run test:e2e -- --no-build --responsive-only all routes/overlays at eight sizes, normal real Play prewarm
 *   npm run test:e2e -- --no-build --replay-only  imported recorded snapshots, library/file/retention checks
 *   npm run test:e2e -- --no-build --table-only   complete table checks at all eight sizes, no fresh engine boot
 *   npm run test:e2e -- --no-build --drag-only    playing by dragging in two real games (mouse, touch; prompt 46)
 *   npm run test:e2e -- --no-build --help-only    contextual help on recorded/built scenes, no engine boot
 *   npm run test:e2e -- --no-build --history-only recorded Forge history and current sources only
 *   npm run test:e2e -- --no-build --zones-only   visible zones, piles and DFC inspection only
 *   npm run test:e2e -- --no-build --combat-only  small, sequential table checks; no engine boot or full suite
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
 *     every state. Playing by dragging (prompt 46, dragInRealGame): in fresh
 *     games with the mouse (desktop) and a thumb (phone) a land and Shock
 *     are dragged onto the battlefield - the land is played, Shock is cast
 *     and Forge asks for its target -, while a card taken back, a cancelled
 *     drag and a card Forge does not mark playable send nothing.
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
 *     real table at eight sizes (tableHarness), each with axe-core. The
 *     table's layout classes (prompt 36): at those sizes, the foldable's
 *     three and the borders 3:4 and 13:10, useTableLayout(), the CSS
 *     variants hoch:/quadrat:/breit: and the browser's media queries name
 *     the layout docs/design/SPIELTISCH.md gives the size.
 * 13. The ORYX cloud on OpenMana's real address (Playwright serves the build
 *     as https://openmana.oryx.quest; the ORYX cloud is a stand-in): a guest
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
import { chromium, type Browser, type BrowserContext, type CDPSession, type ConsoleMessage, type Locator, type Page, type Request, type Route } from "playwright-core"
// The real ORYX cloud and *.vercel.app resolve to nowhere in every browser this run starts: requests sent while a page
// is left (keepalive) bypass page.route and would otherwise reach Supabase (2026-09-26, refused there with 401).
const NO_REAL_CLOUD = "--host-resolver-rules=MAP fellumrfugohnnvtxxye.supabase.co 0.0.0.0, MAP *.vercel.app 0.0.0.0, MAP oryx.quest 0.0.0.0, MAP *.oryx.quest 0.0.0.0"
import { build, createServer, preview } from "vite"
import { PROTOCOL_VERSION } from "../../engine/protocol/src/generated/constants.ts"
import { SCHEMA_VERSION } from "../../src/storage/generated/constants.ts"
import { TABLE_LAYOUT_QUERIES, TABLE_LAYOUTS, tableLayoutOf, type TableLayout } from "../../src/game/table/table-layout.ts"
import { ISOLATION_HEADERS } from "../../vite/isolation-headers.ts"
import { playDeck, type StoredDeck } from "./engine-decks.ts"
import { battlefieldPoint, cardPoint, dragCard, readTable } from "../readiness/player.ts"

const root = path.resolve(import.meta.dirname, "../..")
const dist = path.join(root, "dist")
const responsiveOnly = process.argv.includes("--responsive-only")
const oryxOnly = process.argv.includes("--oryx-only")
const replayOnly = process.argv.includes("--replay-only")
const combatOnly = process.argv.includes("--combat-only")
const zonesOnly = process.argv.includes("--zones-only")
const historyOnly = process.argv.includes("--history-only")
const helpOnly = process.argv.includes("--help-only")
const tableOnly = process.argv.includes("--table-only")
const dragOnly = process.argv.includes("--drag-only")
const focusedTable = combatOnly || zonesOnly || historyOnly || helpOnly
const reportDir = path.join(root, "reports", oryxOnly ? "oryx-e2e" : responsiveOnly ? "responsive-e2e" : replayOnly ? "replay-e2e" : tableOnly ? "table-e2e" : dragOnly ? "drag-e2e" : helpOnly ? "help-e2e" : combatOnly ? "combat-e2e" : zonesOnly ? "zones-e2e" : historyOnly ? "history-e2e" : "e2e")
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

// CSS viewports only, not a claim about physical Fold hardware or its hinge.
const RESPONSIVE_VIEWPORTS: readonly Viewport[] = [
  { name: "small-phone", width: 360, height: 740, touch: true, scale: 3 },
  VIEWPORTS[0]!,
  { name: "phone-landscape", width: 915, height: 412, touch: true, scale: 2.625 },
  { name: "fold-portrait", width: 690, height: 829, touch: true, scale: 2 },
  { name: "fold-landscape", width: 829, height: 690, touch: true, scale: 2 },
  VIEWPORTS[1]!,
  { name: "tablet-landscape", width: 1104, height: 884, touch: true, scale: 2 },
  VIEWPORTS[2]!,
]

/**
 * The foldable (prompt 38, docs/design/SPIELTISCH.md §3): closed (hoch), open upright and open turned (both quadrat) -
 * besides the eight sizes the table's layout is checked at these in every scene (tableFoldSizes), the live game is
 * resized through them (liveResizeCheck), and an open card view follows them.
 */
const FOLD_VIEWPORTS: readonly Viewport[] = [
  { name: "fold-closed", width: 480, height: 1040, touch: true, scale: 2.25 },
  { name: "fold-open", width: 870, height: 960, touch: true, scale: 2.25 },
  { name: "fold-open-turned", width: 960, height: 870, touch: true, scale: 2.25 },
]

const ROUTES = [
  { path: "/", title: "OpenMana", heading: "OpenMana" },
  { path: "/decks", title: "Decks · OpenMana", heading: "Decks" },
  { path: "/decks/import", title: "Arena-Deck importieren · OpenMana", heading: "Arena-Deck importieren" },
  // A deck that is not there: the details page says so (loaded on demand, like the import).
  { path: "/decks/00000000-0000-4000-8000-000000000000", title: "Deck nicht gefunden · OpenMana", heading: "Deck nicht gefunden" },
  { path: "/decks/00000000-0000-4000-8000-000000000000/import", title: "Deck nicht gefunden · OpenMana", heading: "Deck nicht gefunden" },
  { path: "/play", title: "Spielen · OpenMana", heading: "Spielen" },
  // The game page without a game (a reload ends one): it says so.
  { path: "/play/game", title: "Partie · OpenMana", heading: "Partie" },
  { path: "/matches", title: "Partien · OpenMana", heading: "Partien" },
  { path: "/settings", title: "Einstellungen · OpenMana", heading: "Einstellungen" },
  { path: "/credits", title: "Credits · OpenMana", heading: "Credits" },
  { path: "/matches/missing", title: "Wiedergabe · OpenMana", heading: "Wiedergabe" },
  { path: "/missing", title: "Nicht gefunden · OpenMana", heading: "Nicht gefunden" },
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

async function checkAssetLinks(base: string, label: string): Promise<void> {
  const response = await checkHeaders(base, label, "/.well-known/assetlinks.json", /^application\/json/)
  check(!response.redirected, `${label}: ORYX asset links redirected`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const expected = fs.readFileSync(path.join(root, "public/.well-known/assetlinks.json"))
  check(bytes.equals(expected), `${label}: exact ORYX statement bytes, no SPA fallback`)
  report[`assetLinks${label}`] = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), redirected: response.redirected, type: response.headers.get("content-type") }
}

async function httpChecks(base: string, id: string): Promise<void> {
  log("HTTP (vite preview)")
  for (const pathname of ["/", "/play", "/credits", "/does-not-exist"]) {
    const response = await checkHeaders(base, "preview", pathname, /^text\/html/)
    check((await response.text()).includes('<div id="root">'), `preview ${pathname}: not the app's index.html`)
  }
  await checkAssetLinks(base, "preview")
  await (await checkHeaders(base, "preview", "/manifest.webmanifest", /^application\/manifest\+json/)).arrayBuffer()
  await (await checkHeaders(base, "preview", "/icons/icon-192.png", /^image\/png/)).arrayBuffer()
  const legalFiles = { "/legal/LICENSE.txt": "GNU GENERAL PUBLIC LICENSE", "/legal/SOURCE.txt": "https://github.com/dev0gig/openmana",
    "/legal/THIRD-PARTY-NOTICES.txt": "GraalVM Community Edition aus offenem Quelltext" }
  for (const [pathname, required] of Object.entries(legalFiles)) {
    const text = await (await checkHeaders(base, "preview", pathname, /^text\/plain; charset=utf-8/)).text()
    check(text.includes(required), `${pathname}: original legal document is served`)
    check(text === fs.readFileSync(path.join(dist, pathname.slice(1)), "utf8"), `${pathname}: complete bytes, no SPA fallback`)
  }
  report["legalDocuments"] = Object.keys(legalFiles)
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

/**
 * The dev server's first page after a changed config - a new engine build
 * changes it (its id) - makes Vite bundle the dependencies anew and reload the
 * page once that is done, possibly seconds later (prompt 16: it reloaded the
 * engine check midway and lost its boot). A first visit lets that happen:
 * it waits until the page has not been navigated for QUIET_MS.
 */
async function warmUp(browser: Browser, base: string): Promise<{ readonly navigations: number; readonly ms: number }> {
  const QUIET_MS = 5000
  const started = Date.now()
  const context = await newContext(browser, VIEWPORTS[2]!)
  const page = await context.newPage()
  let navigations = 0
  let last = Date.now()
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return
    navigations++
    last = Date.now()
  })
  await page.goto(new URL("/play", base).href, { waitUntil: "networkidle" })
  while (Date.now() - last < QUIET_MS && Date.now() - started < 120_000) await page.waitForTimeout(500)
  await context.close()
  return { navigations, ms: Date.now() - started }
}

async function devServerChecks(browser: Browser, id: string): Promise<void> {
  log("HTTP and engine boot (vite dev server)")
  const server = await createServer({ root, configFile: path.join(root, "vite.config.ts"), logLevel: "warn", server: { host: "127.0.0.1", port: 0 } })
  await server.listen()
  try {
    const address = server.httpServer?.address() as AddressInfo
    const base = `http://127.0.0.1:${address.port}/`
    await (await checkHeaders(base, "dev", "/", /^text\/html/)).text()
    await checkAssetLinks(base, "dev")
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
    report["devServerWarmUp"] = await warmUp(browser, base)
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
  // Colours in the middle of a transition are not what the player reads: a badge or button changing its variant when
  // Forge starts waiting (transition-all; prompt 16: "Du bist dran" and "Weiter" caught blending into gold failed the
  // contrast check). Wait for running animations and transitions to end first - not for endless ones (spinners keep
  // turning), at most 3 s.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]),
  )
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
  const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches)
  await page.evaluate(() => window.scrollTo(0, 0))
  const first = path.join(reportDir, "screens", `${name}.png`)
  const full = path.join(reportDir, "screens", "full", `${name}.png`)
  await page.screenshot({ path: first })
  await page.screenshot({ path: full, fullPage: true })
  // Chrome's full-page capture can reset touch emulation. Restore the original
  // pointer mode so the next surface still tests the intended coarse controls.
  if (coarse) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 })
    await cdp.detach()
  }
  return [first, full].map((file) => path.relative(root, file))
}

async function surfaces(executablePath: string, base: string, id: string): Promise<void> {
  const results: unknown[] = []
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    log(`Surfaces at ${viewport.name} (${viewport.width}x${viewport.height}${viewport.touch ? ", touch" : ""})`)
    const surfaceBrowser = await launchBrowser(executablePath)
    const context = await newContext(surfaceBrowser, viewport)
    const pageLogs: PageLog[] = []
    try {
      for (const route of ROUTES) {
        // Own page per route: repeated high-DPR full-page captures must not
        // accumulate renderer resources. Keep every page's request/error stream.
        const page = await context.newPage()
        const pageLog = watch(page)
        pageLogs.push(pageLog)
        try {
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
          check(state.coarse === viewport.touch, `${label}: pointer mode differs from viewport emulation`)
          if (route.path === "/credits") {
            for (const name of ["GPL-Lizenztext", "Alle Drittanbieter-Lizenzen und Hinweise", "Quelltext und Veröffentlichungsstand"]) {
              const link = page.getByRole("link", { name, exact: true })
              check((await link.getAttribute("href"))?.startsWith("/legal/") === true, `${label}: ${name} local legal link`)
              if (viewport.touch) {
                const rect = await link.boundingBox()
                check(Boolean(rect && rect.width >= 44 && rect.height >= 44), `${label}: ${name} touch target`)
              }
            }
            const source = page.getByRole("link", { name: "Quelltext dieser Version auf GitHub", exact: true })
            check(/^https:\/\/github\.com\/dev0gig\/openmana(\/tree\/[0-9a-f]{40})?$/.test((await source.getAttribute("href")) ?? ""), `${label}: public source link`)
            check(await page.getByText(/aus offenem Quelltext, ohne Oracle-Lizenzteile/).first().isVisible(), `${label}: open toolchain and JVMCI note visible`)
          }
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
        } finally {
          await page.close()
        }
      }
      const requests = pageLogs.flatMap((entry) => entry.requests)
      const hosts = new Set(pageLogs.flatMap((entry) => [...entry.hosts]))
      check(!requests.some((p) => p.startsWith(`/engine/${id}/`)), `${viewport.name}: engine files requested without being asked`)
      check(!requests.some((p) => p.startsWith("/cards/")), `${viewport.name}: card catalog requested without being asked`)
      check(hosts.size === 1, `${viewport.name}: requests to other hosts without being asked: ${[...hosts].join(", ")}`)
      for (const error of pageLogs.flatMap((entry) => entry.errors)) check(false, `${viewport.name}: ${error}`)
    } finally {
      await context.close()
      await surfaceBrowser.close()
    }
  }
  report["surfaces"] = results
}

/** Prompt 24: populated routes/overlays through the real UI. Play keeps its normal real-engine prewarm. */
async function responsiveSurfaces(executablePath: string, base: string): Promise<unknown[]> {
  const results: unknown[] = []
  const fixture = JSON.parse(fs.readFileSync(path.join(root, "src/test/fixtures/replay.json"), "utf8"))
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    log(`Responsive populated surfaces (${viewport.name})`)
    const surfaceBrowser = await launchBrowser(executablePath)
    const context = await newContext(surfaceBrowser, viewport)
    const page = await context.newPage()
    const pageLog = watch(page)
    const workers = countWorkers(page)
    const states: unknown[] = []
    const audit = async (name: string, overlay = false) => {
      await page.evaluate(() => document.fonts.ready)
      const geometry = await page.evaluate(() => ({
        width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth,
        pageHeight: document.documentElement.scrollHeight,
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map((node) => {
          const r = node.getBoundingClientRect()
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, overflow: node.scrollWidth - node.clientWidth }
        }),
        // Off-screen vertical content is expected on library/settings pages; horizontal clipping is not.
        wide: [...document.querySelectorAll('main h1, main [data-slot="item"], main [data-slot="action-bar"]')].filter((node) => node.getBoundingClientRect().right > innerWidth + 1).map((node) => ({ slot: node.getAttribute("data-slot"), text: node.textContent?.slice(0, 100) })),
      }))
      check(geometry.overflow <= 0 && geometry.wide.length === 0, `${viewport.name} ${name}: horizontal overflow ${JSON.stringify(geometry)}`)
      check(geometry.width === viewport.width && geometry.height === viewport.height, `${viewport.name} ${name}: layout viewport widened by content ${geometry.width}×${geometry.height}`)
      check(await page.evaluate(() => matchMedia("(pointer: coarse)").matches) === viewport.touch, `${viewport.name} ${name}: wrong pointer mode`)
      if (overlay) for (const box of geometry.dialogs) check(box.left >= 0 && box.right <= geometry.width + 1 && box.top >= 0 && box.bottom <= geometry.height + 1 && box.overflow <= 1, `${viewport.name} ${name}: dialog outside viewport ${JSON.stringify(box)}`)
      const controls = await page.locator('button[data-slot="button"], input:not([type="file"]), [data-slot="select-trigger"]').evaluateAll((nodes) => nodes.map((node) => ({ name: node.getAttribute("aria-label") ?? node.textContent?.trim(), height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width })).filter((box) => box.height > 0 && box.width > 0))
      if (viewport.touch) for (const box of controls) check(box.height >= 44 && box.width >= 44, `${viewport.name} ${name}: touch control under 44 px ${JSON.stringify(box)}`)
      let actionBar: unknown = null
      if (!overlay && viewport.width < 768 && await page.locator('[data-slot="action-bar"]').count() > 0) {
        const bar = page.locator('[data-slot="action-bar"]')
        const button = bar.locator('button, a').first()
        await button.scrollIntoViewIfNeeded()
        actionBar = await button.evaluate((node) => {
          const r = node.getBoundingClientRect()
          return { top: r.top, bottom: r.bottom, reachable: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }
        })
        const box = actionBar as { top: number; bottom: number; reachable: boolean }
        check(box.top >= 0 && box.bottom <= viewport.height && box.reachable, `${viewport.name} ${name}: primary action unreachable ${JSON.stringify(box)}`)
      }
      const axe = await accessibility(page, `responsive ${viewport.name} ${name}`)
      if (!overlay) await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(reportDir, "screens", `responsive-${viewport.name}-${name}.png`) })
      states.push({ name, geometry, controls, actionBar, axe })
    }
    try {
      const now = new Date().toISOString()
      const longName = "Langdeck".repeat(14)
      const decks = [longName, "Responsive Beispieldeck"].map((name) => ({ id: randomUUID(), name, format: "constructed", main: [{ count: 60, name: "Mountain" }], sideboard: [], commander: [], source: { kind: "arena", text: "Deck\n60 Mountain", importedAt: now }, createdAt: now, updatedAt: now }))
      await loadDecks(page, base, decks)
      await page.goto(new URL("/matches", base).href, { waitUntil: "networkidle" })
      await page.getByLabel("Wiedergabedatei").setInputFiles({ name: "recorded.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture.replay)) })
      await page.getByText("Wiedergabe geladen", { exact: true }).waitFor()
      for (const [name, route] of [["home", "/"], ["library", "/decks"], ["deck", `/decks/${decks[0]!.id}`], ["update", `/decks/${decks[0]!.id}/import`], ["import", "/decks/import"], ["play", "/play"], ["matches", "/matches"], ["settings", "/settings"]]) {
        await page.goto(new URL(route!, base).href, { waitUntil: "networkidle" })
        await page.locator("main h1").waitFor()
        if (name === "play") await chooseDeck(page, "Dein Deck wählen", "Responsive Beispieldeck")
        await audit(name!)
        if (name === "import" || name === "update") {
          const input = page.getByLabel("Liste im Arena-Format")
          await input.fill("Deck\n" + Array.from({ length: 60 }, () => "1 Mountain").join("\n"))
          await audit(`${name}-long-list`)
        }
      }
      await page.goto(new URL(`/decks/${decks[0]!.id}`, base).href, { waitUntil: "networkidle" })
      await deckMenu(page, "Umbenennen")
      const rename = page.getByRole("dialog")
      await animationsDone(rename)
      await audit("rename", true)
      const inputHeight = await layoutHeight(rename.getByLabel("Name des Decks"))
      if (viewport.touch) check(inputHeight >= 44, `${viewport.name}: rename input only ${inputHeight}px`)
      await page.keyboard.press("Escape")
      await overlaysGone(page)
      await deckMenu(page, "Löschen")
      await animationsDone(page.getByRole("alertdialog"))
      await audit("delete-confirm", true)
      await page.keyboard.press("Escape")
      await overlaysGone(page)
      await page.goto(new URL("/play", base).href, { waitUntil: "networkidle" })
      await page.getByRole("button", { name: "Dein Deck wählen" }).click()
      await animationsDone(page.getByRole("dialog"))
      await audit("deck-picker", true)
      await page.keyboard.press("Escape")
      await overlaysGone(page)
      const cardData = await openCardData(page, base)
      await installFromSettings(cardData, `responsive ${viewport.name}`)
      await lookUp(page, "Gebirge", "Gebirge")
      await animationsDone(page.getByRole("dialog"))
      await audit("catalog-card", true)
      await page.keyboard.press("Escape")
      await overlaysGone(page)
      await page.getByRole("button", { name: "Diagnose anzeigen" }).click()
      await animationsDone(page.getByRole("dialog"))
      await audit("diagnostics", true)
      await page.keyboard.press("Escape")
      await overlaysGone(page)
      for (const [name, route] of [["import", "/decks/import"], ["update", `/decks/${decks[0]!.id}/import`]]) {
        await page.goto(new URL(route!, base).href, { waitUntil: "networkidle" })
        await checkList(page, "Deck\n60 Mountain\n1 Does not exist responsive test", `responsive ${viewport.name} ${name}`)
        await audit(`${name}-report`)
      }
      const workersBeforeReplay = workers.created()
      await page.goto(new URL(`/matches/${fixture.replay.match.id}`, base).href, { waitUntil: "networkidle" })
      await page.locator('[data-slot="game-board"]').waitFor()
      const replayLayout = await checkTableFits(page, `responsive replay ${viewport.name}`)
      await audit("replay")
      await page.getByRole("button", { name: "Wiedergabemenü" }).click()
      await animationsDone(page.getByRole("dialog"))
      await audit("replay-menu", true)
      check(workers.max() <= 1, `${viewport.name}: more than one engine at once during normal Play prewarming`)
      check(workers.created() === workersBeforeReplay, `${viewport.name}: replay booted an engine`)
      check((await dumpDatabase(page, ["matches"]))["matches"]?.length === 1, `${viewport.name}: inspection started/recorded a game`)
      results.push({ viewport, states, inputHeight, replayLayout, engineWorkers: workers.created(), maximumConcurrentWorkers: workers.max(), replayWorkers: workers.created() - workersBeforeReplay, provenance: fixture.provenance })
      for (const error of pageLog.errors) check(false, `responsive ${viewport.name}: ${error}`)
    } finally {
      await context.close()
      await surfaceBrowser.close()
    }
  }
  return results
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
function dumpDatabase(page: Page, stores?: readonly string[]): Promise<Record<string, unknown[]>> {
  return page.evaluate(async (stores) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("openmana")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const out: Record<string, unknown[]> = {}
    for (const name of stores ?? Array.from(db.objectStoreNames)) {
      out[name] = await new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll()
        request.onsuccess = () => resolve(request.result as unknown[])
        request.onerror = () => reject(request.error)
      })
    }
    db.close()
    return out
  }, stores)
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
    // The counts follow the reopened database a moment after "Bereit" (on a busy machine a noticeable one): wait for them.
    await card
      .locator("dl > div", { hasText: "Decks" })
      .locator("dd", { hasText: /^0$/ })
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined)
    check((await cardFacts(card))["Decks"] === "0", `local data: data left after clearing site data (${JSON.stringify(await cardFacts(card))})`)

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
function countWorkers(page: Page): { readonly max: () => number; readonly alive: () => number; readonly created: () => number; readonly trace: () => readonly Record<string, unknown>[] } {
  const alive = new Set<unknown>()
  const trace: Record<string, unknown>[] = []
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) trace.push({ event: "navigation", at: Date.now(), url: frame.url(), reportedAlive: alive.size }) })
  let max = 0
  let created = 0
  page.on("worker", (worker) => {
    alive.add(worker)
    created++
    max = Math.max(max, alive.size)
    const number = created
    trace.push({ event: "created", at: Date.now(), number, url: worker.url(), document: page.url(), reportedAlive: alive.size })
    worker.on("close", () => { alive.delete(worker); trace.push({ event: "closed", at: Date.now(), number, reportedAlive: alive.size }) })
  })
  return { max: () => max, alive: () => alive.size, created: () => created, trace: () => trace }
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
 * app's frame is gone (the table's own menu leads around the app), every
 * region lies inside the window with room to show something - and where the
 * table layout of the window's aspect ratio puts it (prompt 38,
 * checkTableArrangement). Returns the regions' boxes and the arrangement.
 */
async function checkTableFits(page: Page, label: string): Promise<Record<string, unknown>> {
  const layout = await page.evaluate(() => {
    const areas = Object.fromEntries(
      [...document.querySelectorAll('[data-slot="game-board-area"]')].map((area) => {
        const box = area.getBoundingClientRect()
        return [(area as HTMLElement).dataset["area"] ?? "?", { top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height) }]
      }),
    )
    // The rows of each battlefield, top to bottom (prompt 38: two rows from TWO_ROWS_MIN_HEIGHT, creatures next to the middle).
    const rows = Object.fromEntries(
      ["opponent-field", "field"].map((name) => [
        name,
        [...document.querySelectorAll(`[data-area="${name}"] [data-slot="game-card-row"]`)].map((row) => ({ label: row.getAttribute("aria-label") ?? "", top: Math.round(row.getBoundingClientRect().top) })).sort((a, b) => a.top - b.top).map((row) => row.label),
      ]),
    )
    return {
      window: { width: window.innerWidth, height: window.innerHeight },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      frame: {
        tabBar: document.querySelectorAll('nav[aria-label="Hauptnavigation"]').length,
        sidebar: document.querySelectorAll('[data-slot="sidebar"]').length,
      },
      decision: document.querySelector('[data-slot="game-board"]')?.getAttribute("data-decision") ?? null,
      areas,
      rows,
    }
  })
  const { window: view, scroll, frame, areas } = layout
  check(scroll.width <= view.width && scroll.height <= view.height, `${label}: the page scrolls (${scroll.width}×${scroll.height} in ${view.width}×${view.height})`)
  check(frame.tabBar === 0 && frame.sidebar === 0, `${label}: the app's frame is still there ${JSON.stringify(frame)}`)
  const names = ["header", "opponent", "opponent-field", "center", "field", "me", "decision", "hand"]
  check(names.every((name) => name in areas), `${label}: regions ${Object.keys(areas).join(", ")}`)
  // In a low breit window a decision that needs room takes the stack's place (prompt 15): stack and combat step aside.
  const expanded = layout.decision === "expanded"
  const aside = expanded && tableLayoutOf(view.width, view.height) === "breit" && view.height <= SHORT_HEIGHT
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
  const least = expanded ? 64 : 80
  check(opponentField !== undefined && field !== undefined && Math.min(opponentField.height, field.height) >= least, `${label}: battlefields ${opponentField?.height}/${field?.height}px high`)
  check((areas["hand"]?.height ?? 0) >= 80, `${label}: the hand ${areas["hand"]?.height}px high`)
  const arrangement = checkTableArrangement(label, view, areas, layout.decision, layout.rows)
  return { ...layout, arrangement }
}

/** The short: variant (src/index.css: at most 32rem high) in CSS pixels. */
const SHORT_HEIGHT = 512
/** The battlefield's height from which it shows two rows (TWO_ROWS_MIN_HEIGHT in src/game/game-table.tsx). */
const TWO_ROWS_MIN_HEIGHT = 176

type AreaBox = { readonly top: number; readonly left: number; readonly width: number; readonly height: number }

/**
 * The regions where the table layout of the window puts them (prompt 38,
 * docs/design/SPIELTISCH.md §3; layout from tableLayoutOf, the same decision
 * as the CSS variants): hoch one column with the decision at the very bottom;
 * quadrat the battlefields' column with the hand and a right column -
 * Zauberchronik next to the opponent, decision below (from the opponent's
 * battlefield down while expanded); breit a column on each side of the
 * battlefields; breit in a low window the side column of prompts 13-24. And
 * every battlefield shows two rows from TWO_ROWS_MIN_HEIGHT, its creatures
 * next to the middle, one row below.
 */
function checkTableArrangement(label: string, view: { readonly width: number; readonly height: number }, areas: Record<string, AreaBox>, decision: string | null, rows: Record<string, string[]>): Record<string, unknown> {
  const layout = tableLayoutOf(view.width, view.height)
  const short = view.height <= SHORT_HEIGHT
  const name = layout === "breit" && short ? "breit-short" : layout
  const a = (area: string) => areas[area]!
  const bottom = (area: string) => a(area).top + a(area).height
  const right = (area: string) => a(area).left + a(area).width
  const near = (x: number, y: number) => Math.abs(x - y) <= 1
  const failures: string[] = []
  const expect = (ok: boolean, what: string) => {
    if (!ok) failures.push(what)
  }
  /** These regions lie one below the other in this order (each starts where the one before ends, or below). */
  const stacked = (...order: string[]) => {
    for (let i = 1; i < order.length; i++) expect(a(order[i]!).top >= bottom(order[i - 1]!) - 1, `${order[i]} below ${order[i - 1]}`)
  }
  /** These regions share one column (same left edge and width). */
  const column = (...members: string[]) => {
    for (const member of members.slice(1)) expect(near(a(member).left, a(members[0]!).left) && near(a(member).width, a(members[0]!).width), `${member} in the column of ${members[0]}`)
  }
  expect(a("header").top === 0, "header at the top")
  if (layout === "hoch") {
    for (const area of Object.keys(areas)) expect(near(a(area).left, 0) && near(a(area).width, view.width), `${area} across the window`)
    stacked("header", "opponent", "opponent-field", "center", "field", "me", "hand", "decision")
    expect(near(bottom("decision"), view.height), "the decision at the very bottom")
  } else if (layout === "quadrat") {
    expect(near(a("header").width, view.width), "header across the window")
    column("opponent-field", "opponent", "field", "me", "hand")
    expect(near(a("opponent-field").left, 0), "the battlefields on the left")
    stacked("header", "opponent", "opponent-field", "field", "me", "hand")
    expect(near(bottom("hand"), view.height), "the hand at the bottom")
    column("center", "decision")
    expect(near(a("center").left, right("opponent-field")) && near(right("center"), view.width), "stack and combat in the right column")
    expect(near(a("center").top, a("opponent").top), "stack and combat next to the opponent")
    stacked("center", "decision")
    expect(near(bottom("decision"), view.height), "the decision down to the bottom")
    if (decision === "expanded") expect(near(a("decision").top, a("opponent-field").top), "an expanded decision from the opponent's battlefield down")
    else expect(a("decision").top >= bottom("opponent-field") - 1 && a("decision").top <= a("field").top + 1, "the decision from the centre line down")
  } else if (!short) {
    expect(near(a("header").width, view.width), "header across the window")
    column("opponent-field", "opponent", "field", "me", "hand")
    stacked("header", "opponent", "opponent-field", "field", "me", "hand")
    expect(near(bottom("hand"), view.height), "the hand at the bottom")
    expect(near(a("center").left, 0) && near(right("center"), a("opponent-field").left), "stack and combat in the left column")
    expect(near(a("decision").left, right("opponent-field")) && near(right("decision"), view.width), "the decision in the right column")
    for (const side of ["center", "decision"]) expect(near(a(side).top, bottom("header")) && near(bottom(side), view.height), `${side} from the header to the bottom`)
  } else {
    column("opponent-field", "header", "field", "hand")
    expect(near(a("opponent-field").left, 0), "the battlefields on the left")
    stacked("header", "opponent-field", "field", "hand")
    expect(near(bottom("hand"), view.height), "the hand at the bottom")
    const side = right("opponent-field")
    for (const area of ["opponent", "decision", "me", ...(a("center").height > 0 ? ["center"] : [])]) expect(near(a(area).left, side) && near(right(area), view.width), `${area} in the side column`)
    expect(near(a("opponent").top, 0) && near(bottom("me"), view.height), "the opponent next to the header, you next to the hand")
    if (decision === "expanded") expect(near(a("decision").top, a("opponent-field").top) && near(bottom("decision"), a("me").top), "an expanded decision takes both middle rows")
    else stacked("opponent", "center", "decision", "me")
  }
  // Two rows from TWO_ROWS_MIN_HEIGHT (a pixel's leeway at the threshold), the creatures' row next to the middle.
  for (const [area, labels] of Object.entries(rows)) {
    if (labels.length === 0) continue
    const height = a(area).height
    if (Math.abs(height - TWO_ROWS_MIN_HEIGHT) <= 1) continue
    if (height > TWO_ROWS_MIN_HEIGHT) {
      expect(labels.length === 2, `${area} (${height}px) shows two rows ${JSON.stringify(labels)}`)
      const creatures = labels.findIndex((row) => row.startsWith("Kreaturen"))
      expect(creatures === (area === "field" ? 0 : 1), `${area}: the creatures' row next to the middle ${JSON.stringify(labels)}`)
    } else expect(labels.length === 1, `${area} (${height}px) shows one row ${JSON.stringify(labels)}`)
  }
  check(failures.length === 0, `${label}: not the ${name} layout - ${failures.join("; ")} ${JSON.stringify(areas)}`)
  return { layout: name, decision, rows }
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
  // The region's words without the phases (prompt 41: a picture, aria-hidden - on the Phasen-Tafel above the question).
  const text = await decision.evaluate((region) => {
    const words = region.cloneNode(true) as Element
    for (const phases of words.querySelectorAll('[data-slot="phase-panel"]')) phases.remove()
    return words.textContent ?? ""
  })
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

/** Resize only presents: compare the original persisted stream, pending question and Worker identity. */
async function liveResizeCheck(page: Page, label: string): Promise<Record<string, unknown>> {
  await waitForDecision(page)
  await page.waitForTimeout(150) // allow the recorder's existing 100 ms batch to flush
  const before = (await dumpDatabase(page, ["matchLog"]))["matchLog"]
  const question = await page.locator('[data-slot="game-decision"]').getAttribute("data-question")
  check(question !== null && before?.some((entry) => (entry as { message?: { type?: string } }).message?.type === "state"), `${label}: no pending question/original recorded state to compare`)
  const workerRequests: string[] = []
  const request = (r: Request) => { if (r.url().endsWith("/engine-worker.js")) workerRequests.push(r.url()) }
  page.on("request", request)
  const original = page.viewportSize()!
  const layouts: unknown[] = []
  try {
    // The eight sizes and the foldable closed, opened and turned (prompt 38): only the arrangement changes.
    for (const viewport of [...RESPONSIVE_VIEWPORTS, ...FOLD_VIEWPORTS]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.waitForTimeout(100)
      const layout = await checkTableFits(page, `${label} resize ${viewport.name}`)
      check(await page.locator('[data-slot="game-decision"]').getAttribute("data-question") === question, `${label}: resize changed the pending question`)
      const after = (await dumpDatabase(page, ["matchLog"]))["matchLog"]
      check(JSON.stringify(after) === JSON.stringify(before), `${label}: resize changed original engine state/log/input`)
      await page.screenshot({ path: path.join(reportDir, "screens", `resize-${label}-${viewport.name}.png`) })
      layouts.push({ viewport: viewport.name, layout, unchangedTranscript: JSON.stringify(after) === JSON.stringify(before) })
    }
    check(workerRequests.length === 0, `${label}: resize requested another Worker`)
    return { question, logEntries: before?.length, workerRequests, layouts, evidence: "Full original matchLog messages and accepted inputs byte-compared at every resize while Forge waits; no new Worker request." }
  } finally {
    page.off("request", request)
    await page.setViewportSize(original)
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
  // Where the card is its own: in the fanned hand the next card covers part of it (prompt 42).
  const position = await cardPoint(card)
  if (touch) await card.tap(position === undefined ? {} : { position })
  else await card.click(position === undefined ? {} : { position })
  const view = page.getByRole("dialog")
  await view.waitFor()
  await animationsDone(view)
  const title = (await view.getByRole("heading").first().textContent()) ?? ""
  const offer = (await view.getByRole("region", { name: "Was Forge anbietet" }).textContent()) ?? ""
  const buttons = await view.getByRole("button").allTextContents()
  // Prompt 47: the view in full screen - Forge's offer is a button under the card (none here), turning a double-faced card one more.
  const offerButtons = await view.locator('[data-slot="card-view-offer"]').getByRole("button").count()
  const turnButtons = await view.getByRole("button", { name: /^Umdrehen/ }).count()
  const picture = await view.locator('[data-slot="card-picture"]').getAttribute("data-state")
  check(name.startsWith(title) && title.length > 0, `${label}: the card view's title "${title}" for "${name}"`)
  check(offer === "Mit dieser Karte bietet Forge gerade nichts an." && offerButtons === 0 && buttons.length === 1 + turnButtons, `${label}: in the first decision only close and inspection controls are offered ("${offer}", buttons ${buttons.join("|")})`)
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
 * Forge's priority passed with its OK ("Weiter" since prompt 16, which also
 * checks the priority's words and the header's track of the turn's steps in
 * the real game) - attacks and blocks declined, a card
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
  // A card of the fanned hand is pressed where no other card covers it (prompt 42, cardPoint).
  const activateCard = async (locator: Locator) => {
    const position = await cardPoint(locator)
    if (touch) await locator.tap(position === undefined ? {} : { position })
    else await locator.click(position === undefined ? {} : { position })
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
  let track: string | null = null
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
        await activateCard(card)
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
      if (land === null) await press("Weiter", question)
    } else if (kind === "Angreifer wählen" || kind === "Angriff bestätigen" || kind === "Blocker wählen") {
      await press("OK", question)
    } else if (kind === "Auswahl") {
      // Forge asks for cards of the hand (discarding down to the hand size): one at a time, Forge ends it.
      await activateCard(hand.locator('button[data-slot="game-card"][data-mark="usable"]').first())
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
    // Prompt 16: the priority in words, not Forge's status line; the header's track shows Forge's step.
    const words = ((await decision.locator('[data-slot="game-decision-header"] p').nth(1).textContent()) ?? "").trim()
    // Since prompt 46 the player's own priority with an empty stack names the gestures and ends "– oder gib weiter."
    check(!words.startsWith("Priorität:") && /oder (?:weitergeben|gib weiter)\.$/.test(words), `${label}: the priority says "${words}"`)
    // Prompt 41: the track moved from the header into the decision region (Phasen-Tafel / action bar); the header keeps the words.
    track = await decision.locator('[data-slot="phase-track"]').getAttribute("data-phase")
    const current = await decision.locator('[data-slot="phase-track-step"][data-state="current"]').getAttribute("title")
    const line = ((await tableHeader(page).getByRole("button", { name: "Hilfe am Spieltisch", exact: true }).locator("span[id][title]").textContent()) ?? "").trim()
    check(track !== null && current !== null && line.endsWith(current), `${label}: the header's track (${track}, ${current}) and words (${line}) disagree`)
    await press("Weiter", question)
  }
  if (touch) for (const height of heights) check(height >= 44, `${label}: one of Forge's buttons ${height}px high`)
  check((await page.locator("[data-sonner-toast]").count()) === 0, `${label}: a notice appeared while playing (${(await page.locator("[data-sonner-toast]").allTextContents()).join(" | ")})`)
  // Prompt 21: real Forge events reach the session's history, with structured actor/source.
  await page.getByRole("button", { name: "Spielverlauf ansehen", exact: true }).click()
  const history = page.getByRole("dialog", { name: "Spielverlauf", exact: true })
  await history.waitFor()
  const liveEntries = await history.locator("[data-history-entry]").count()
  check(liveEntries > 0, `${label}: the real engine supplied no history`)
  check(await history.locator('[data-history-kind="LAND"][data-history-actor="me"]').count() > 0, `${label}: the player's real land event has no structured actor`)
  const historyAxe = await accessibility(page, `${label}: live Forge history`)
  await history.getByRole("button", { name: "Schließen", exact: true }).click()
  await history.waitFor({ state: "hidden" })
  return { liveHistory: { entries: liveEntries, axe: historyAxe }, first, presses, land, permanentsBefore: landFrom, permanentsAfter: permanents, track, buttonHeights: [Math.min(...heights), Math.max(...heights)], ms: Date.now() - started }
}

/** Verify the final committed traffic and Forge result of a real browser game. */
async function finishedRecordingCheck(page: Page, label: string): Promise<Record<string, unknown>> {
  await page.waitForTimeout(300)
  const data = await dumpDatabase(page)
  const headers = (data["matches"] ?? []) as { id: string; status: string; end: unknown; endedAt: string | null }[]
  const header = headers.find((v) => v.status === "finished")
  check(header !== undefined && header.end !== null && header.endedAt !== null, `${label}: final result was not committed`)
  const log = (data["matchLog"] ?? []).filter((v) => (v as { matchId: string }).matchId === header?.id) as { seq: number; from: string; message: { type: string } }[]
  check(log.every((e, i) => e.seq === i), `${label}: gap in original reception order`)
  for (const type of ["engine.ready", "match.start", "game.started", "state", "question", "concede", "events", "game.end", "match.finished"]) check(log.some((v) => v.message.type === type), `${label}: recording missing ${type}`)
  return { header, entries: log.length, inputs: log.filter((e) => e.from === "player").length, types: [...new Set(log.map((e) => e.message.type))] }
}

async function liveReplayCheck(page: Page, label: string): Promise<Record<string, unknown>> {
  await tableHeader(page).getByText("Du bist dran", { exact: true }).waitFor({ timeout: 180_000 })
  await waitForDecision(page)
  await page.waitForTimeout(300) // flush the last received batch before comparing the read-only inspection
  const before = await dumpDatabase(page)
  const header = (before["matches"] ?? []).find((v) => (v as { status: string }).status === "running") as { id: string; seed: number; engine: { manifestSha256?: string }; human: { deck: unknown }; ai: { deck: unknown } } | undefined
  check(header !== undefined, `${label}: live game was not recorded`)
  if (!header) return { missing: true }
  check(/^[0-9a-f]{64}$/.test(header.engine.manifestSha256 ?? ""), `${label}: exact manifest hash not recorded`)
  const original = (before["matchLog"] ?? []).filter((v) => (v as { matchId: string }).matchId === header.id)
  check(original.some((v) => (v as { message: { type: string } }).message.type === "state") && original.some((v) => (v as { message: { type: string } }).message.type === "question"), `${label}: states or questions missing`)
  const menu = await openTableMenu(page)
  await menu.getByRole("link", { name: "Partien", exact: true }).click()
  await page.getByRole("list", { name: "Gespeicherte Partien" }).getByRole("link", { name: "Ansehen", exact: true }).first().click()
  await page.getByRole("heading", { level: 1, name: "Wiedergabe", exact: true }).waitFor()
  await page.getByRole("button", { name: "Nächster Schritt" }).click()
  const axe = await accessibility(page, `${label}: live match replay`)
  const after = await dumpDatabase(page)
  check(JSON.stringify((after["matchLog"] ?? []).filter((v) => (v as { matchId: string }).matchId === header.id)) === JSON.stringify(original), `${label}: replay sent an input or changed the running recording`)
  await page.getByRole("button", { name: "Wiedergabemenü" }).click()
  await page.getByRole("dialog", { name: "Wiedergabe", exact: true }).getByRole("link", { name: "Zurück zu Partien" }).click()
  await page.getByRole("link", { name: "Spielen", exact: true }).first().click()
  await page.getByRole("button", { name: "Zur laufenden Partie" }).first().click()
  await waitForDecision(page)
  return { matchId: header.id, entries: original.length, seed: header.seed, manifestSha256: header.engine.manifestSha256, axe, noInput: true }
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
  results["help"] = await helpInteractions(page, "live-desktop", VIEWPORTS[2]!, true)
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
  results["resizeInvariance"] = await liveResizeCheck(page, "live-desktop")

  // 3. Around the app and back through the table's menu: the game keeps running in the session, the app's frame is back outside it.
  const menu = await openTableMenu(page)
  results["menuAxe"] = await accessibility(page, "game: the table's menu")
  await menu.getByRole("link", { name: "Decks" }).click()
  await page.getByRole("heading", { level: 1, name: "Decks" }).waitFor()
  check((await page.locator('[data-slot="sidebar"]').count()) > 0, "game: the app's frame did not come back outside the game")
  // The explicit launcher exit on Start must retain the provider's protection of a running match.
  await page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Start", exact: true }).click()
  const leaveQuestion = page.waitForEvent("dialog", { timeout: 10_000 })
  const leaving = page.getByRole("button", { name: "Zurück zu ORYX", exact: true }).click()
  const question = await leaveQuestion
  results["oryxLeaveDialog"] = question.type()
  check(question.type() === "beforeunload", `game: ORYX exit did not protect the running match (${question.type()})`)
  await question.dismiss()
  await leaving
  check(new URL(page.url()).origin === new URL(base).origin, "game: cancelling ORYX exit left OpenMana")
  await page.locator('[data-slot="sidebar"] a', { hasText: "Spielen" }).click()
  await page.getByText("Eine Partie läuft", { exact: true }).waitFor()
  check(((await enginePanel(page).locator('[data-slot="badge"]').first().textContent()) ?? "") === "Spielt", "game: the engine panel does not say it plays")
  await page.getByRole("button", { name: "Zur laufenden Partie" }).first().click()
  await waitForDecision(page)
  await checkTableFits(page, "game table (back from the app)")

  results["liveRecordingReplay"] = await liveReplayCheck(page, "game desktop")

  // 4. Conceding needs a confirmation; the result in one word; the spent engine goes, a fresh one is prewarmed.
  const conceded = await concedeGame(page, "game: confirm conceding")
  results["concedeAxe"] = conceded.axe
  const resultText = (await conceded.result.textContent()) ?? ""
  check(resultText.includes("Du hast aufgegeben.") && resultText.includes("Du (E2E Brawl)40 Lebenspunkte"), `game: result "${resultText}"`)
  results["resultAxe"] = await accessibility(page, "game: result")
  await screenshots(page, "desktop-game-result")
  results["finishedRecording"] = await finishedRecordingCheck(page, "game desktop")
  await conceded.result.getByRole("button", { name: "Spielverlauf ansehen" }).click()
  const finishedHistory = page.getByRole("dialog", { name: "Spielverlauf", exact: true })
  await finishedHistory.waitFor()
  const finishedEntries = await finishedHistory.locator("[data-history-entry]").count()
  check(finishedEntries > 0 && await finishedHistory.locator('[data-history-kind="GAME_OUTCOME"]').count() > 0, "game: the finished match lost its Forge outcome history")
  results["finishedHistory"] = { entries: finishedEntries, axe: await accessibility(page, "game: finished history") }
  await finishedHistory.getByRole("button", { name: "Schließen", exact: true }).click()
  await finishedHistory.waitFor({ state: "hidden" })
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
  // Forge plays on after the last press: measure once it waits for the player again (the table stands still).
  await tableHeader(page).getByText("Du bist dran", { exact: true }).waitFor({ timeout: 180_000 })
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
  results["workers"] = { created: workers.created(), maxAtOnce: workers.max(), trace: workers.trace() }
  for (const error of pageLog.errors.slice(errorsBefore)) check(false, `game: ${error}`)

  // 7.-8. Failures in a fresh profile: a boot that fails, and a deck Forge refuses.
  results["failures"] = await gameFailures(browser, base, id, decks)
  // 9. A phone with touch.
  results["phone"] = await gamePhone(browser, base, decks)
  // 10. Playing by dragging (prompt 46): a land and a spell with a target, with the mouse and with a thumb.
  results["drag"] = { desktop: await dragInRealGame(browser, base, VIEWPORTS[2]!), phone: await dragInRealGame(browser, base, VIEWPORTS[0]!) }
  return results
}

/** The decks of dragInRealGame (prompt 46): lands and Shock - a spell with a target -, against an AI that only plays lands. */
function dragDecks(): readonly unknown[] {
  const now = new Date().toISOString()
  const deck = (name: string, main: readonly { readonly count: number; readonly name: string }[]) => ({
    id: randomUUID(),
    name,
    format: "constructed",
    main,
    sideboard: [],
    commander: [],
    source: { kind: "arena", text: `Deck\n${main.map((entry) => `${entry.count} ${entry.name}`).join("\n")}`, importedAt: now },
    createdAt: now,
    updatedAt: now,
  })
  return [
    deck("E2E Ziehen", [
      { count: 24, name: "Mountain" },
      { count: 36, name: "Shock" },
    ]),
    deck("E2E Ziehen Gegner", [{ count: 60, name: "Mountain" }]),
  ]
}

/**
 * Playing by dragging in a real game with the real engine (prompt 46) - with the mouse on a desktop, with a thumb
 * (Chrome's touch input) on a phone: in the player's main phase a playable card taken back into the hand and one
 * cancelled (Escape, a second finger) send nothing; a land dragged onto the battlefield is played (it lies there); a
 * card Forge does not mark playable (Shock without mana, a Mountain after the land of the turn) sends nothing; Shock dragged onto the
 * battlefield is cast and Forge asks for its target - answered with the AI's seat, the spell resolves (the AI's life
 * total falls). Every input counted in the game's recording (the player's messages).
 */
async function dragInRealGame(browser: Browser, base: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const label = `game (${viewport.name}, dragging)`
  const touch = viewport.touch
  const context = await newContext(browser, viewport)
  const page = await context.newPage()
  const pageLog = watch(page)
  const started = Date.now()
  const results: Record<string, unknown> = {}
  try {
    await loadDecks(page, base, dragDecks())
    await page.goto(new URL("/play", base).href, { waitUntil: "domcontentloaded" })
    await chooseDeck(page, "Dein Deck wählen", "E2E Ziehen")
    await chooseDeck(page, "Deck der KI wählen", "E2E Ziehen Gegner")
    await enginePanel(page).getByText("Bereit", { exact: true }).waitFor({ timeout: 180_000 })
    results["startMs"] = await startAndWait(page)
    const decision = page.getByRole("region", { name: "Entscheidung" })
    const answers = decision.getByRole("group", { name: "Antworten, die Forge anbietet" })
    const card = (id: number) => page.locator(`[data-area="hand"] button[data-slot="game-card"][data-card="${id}"]`)
    /** The player's messages in the game's recording so far. */
    const inputs = async () => ((await dumpDatabase(page, ["matchLog"]))["matchLog"] ?? []).filter((entry) => (entry as { from: string }).from === "player").length
    const activate = async (locator: Locator) => (touch ? locator.tap() : locator.click())
    const press = async (name: string) => {
      const button = answers.getByRole("button", { name, exact: true })
      await button.waitFor()
      await page.waitForTimeout(ARMED_AFTER_MS)
      await activate(button)
    }
    /** Forge waits for the player again with a decision other than `question`. */
    const nextQuestion = (question: string | null) => page.waitForFunction((before) => document.querySelector('[data-slot="game-decision"]')?.getAttribute("data-question") !== before, question, { timeout: 120_000 })
    const named = (label: string, names: readonly string[]) => names.some((name) => label.startsWith(name))
    const steps: string[] = []
    let cancels: Record<string, unknown> | null = null
    let land: Record<string, unknown> | null = null
    let unplayable: Record<string, unknown> | null = null
    let spell: Record<string, unknown> | null = null
    let casting = false
    let aiLife: number | null = null
    for (let step = 0; step < 120 && aiLife === null && Date.now() - started < 420_000; step++) {
      await tableHeader(page).getByText("Du bist dran", { exact: true }).waitFor({ timeout: 180_000 })
      await waitForDecision(page)
      await page.waitForTimeout(150)
      const view = await readTable(page)
      steps.push(view.kind)
      if (view.kind === "Entscheidung") {
        await press(view.answers.some((button) => button.name === "Spielen") ? "Spielen" : view.answers.find((button) => button.enabled)!.name)
      } else if (view.kind === "Mulligan") {
        await press("Behalten")
      } else if (view.kind === "Priorität") {
        const field = await battlefieldPoint(page)
        const stackEmpty = view.answers.some((button) => button.meaning === "pass" && button.name === "Weiter")
        const mine = view.owner === "me" && (view.phase === "MAIN1" || view.phase === "MAIN2") && stackEmpty
        const playable = view.hand.filter((each) => each.mark === "usable")
        const shock = playable.find((each) => named(each.label, ["Schock", "Shock"]))
        if (casting && !stackEmpty) {
          await press("Verrechnen lassen")
          continue
        }
        if (casting) {
          // Shock resolved: the AI's life total fell.
          const life = (await tableFacts(page)).ai.life
          aiLife = life
          check(life < 20, `${label}: after Shock the AI has ${life} life`)
          break
        }
        if (mine && cancels === null && playable.length > 0) {
          // Taken back into the hand, and cancelled (Escape / a second finger): nothing is sent, nothing opens.
          const before = await inputs()
          const target = card(playable[0]!.id)
          await dragCard(page, target, field, touch, "hand")
          await page.waitForTimeout(600)
          await dragCard(page, target, field, touch, touch ? "finger" : "escape")
          await page.waitForTimeout(600)
          const after = await inputs()
          const question = await decision.locator('[data-slot="game-decision"]').getAttribute("data-question")
          cancels = { card: playable[0]!.label, before, after, question: question === view.question, dialogs: await page.getByRole("dialog").count() }
          check(after === before && question === view.question && (await page.getByRole("dialog").count()) === 0, `${label}: taking a card back or cancelling the drag sent or opened something ${JSON.stringify(cancels)}`)
          continue
        }
        const stuck = view.hand.find((each) => each.mark !== "usable")
        if (mine && unplayable === null && stuck !== undefined) {
          // A card Forge does not mark playable (Shock without mana, a Mountain after the land of the turn): dropped, nothing is sent, no words made up.
          const before = await inputs()
          await dragCard(page, card(stuck.id), field, touch)
          await page.waitForTimeout(800)
          const after = await inputs()
          const notices = await page.locator("[data-sonner-toast]").count()
          unplayable = { card: stuck.label, before, after, notices, inHand: (await card(stuck.id).count()) === 1 }
          check(after === before && notices === 0 && (await card(stuck.id).count()) === 1, `${label}: dropping a card Forge does not mark playable ${JSON.stringify(unplayable)}`)
          continue
        }
        const landCard = playable.find((each) => named(each.label, ["Gebirge", "Mountain"]))
        if (mine && land === null && landCard !== undefined) {
          await dragCard(page, card(landCard.id), field, touch)
          await page.waitForFunction((id) => document.querySelector(`section[aria-label="Dein Spielfeld"] [data-card="${id}"], section[aria-label="Dein Spielfeld"] [data-pile-cards~="${id}"]`) !== null, String(landCard.id), { timeout: 60_000 })
          land = { card: landCard.label, turn: view.turn }
          continue
        }
        if (mine && land !== null && shock !== undefined) {
          // Shock dragged onto the battlefield: cast - Forge asks for its target.
          const before = await inputs()
          await dragCard(page, card(shock.id), field, touch)
          await nextQuestion(view.question)
          await waitForDecision(page)
          const asked = await readTable(page)
          const target = page.locator('[data-area="opponent"] button[data-slot="game-player"][data-mark="usable"]')
          check(asked.kind === "Auswahl" && (await target.count()) === 1, `${label}: after Shock Forge asks "${asked.line}" (${asked.text}), the AI's seat ${await target.count()}`)
          spell = { card: shock.label, asked: asked.line, text: asked.text, inputs: (await inputs()) - before }
          check((await inputs()) - before === 1, `${label}: dropping Shock sent ${(await inputs()) - before} inputs`)
          casting = true
          if ((await target.count()) === 1) {
            await page.waitForTimeout(ARMED_AFTER_MS)
            await activate(target)
          }
          continue
        }
        await press(stackEmpty ? "Weiter" : "Verrechnen lassen")
      } else if (view.kind === "Auswahl") {
        // The target chosen: Forge's OK, where it asks for one; a card of the hand to discard otherwise.
        const ok = view.answers.find((button) => button.enabled && button.name === "OK")
        if (ok !== undefined) await press("OK")
        else if (!casting) await activate(page.locator('[data-area="hand"] button[data-slot="game-card"][data-mark="usable"]').first())
        else {
          const target = page.locator('[data-area="opponent"] button[data-slot="game-player"][data-mark="usable"]')
          await page.waitForTimeout(ARMED_AFTER_MS)
          await activate(target)
        }
        await page.waitForTimeout(ARMED_AFTER_MS)
      } else if (view.kind === "Kosten bezahlen") {
        await press(view.answers.find((button) => button.enabled && button.name !== "Abbrechen")!.name)
      } else if (view.kind === "Angreifer wählen" || view.kind === "Angriff bestätigen" || view.kind === "Blocker wählen") {
        await press("OK")
      } else {
        check(false, `${label}: an unexpected decision "${view.kind}" (${view.line} ${view.text})`)
        break
      }
    }
    check(cancels !== null && land !== null && unplayable !== null && spell !== null && aiLife !== null, `${label}: not everything was dragged ${JSON.stringify({ cancels, land, unplayable, spell, aiLife, steps })}`)
    await page.screenshot({ path: path.join(reportDir, "screens", `${viewport.name}-game-dragged.png`) })
    await concedeGame(page)
    for (const error of pageLog.errors) check(false, `${label}: ${error}`)
    return { cancels, land, unplayable, spell, aiLife, steps: steps.length, ms: Date.now() - started }
  } finally {
    await context.close()
  }
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
    // The heading mounts before IndexedDB has restored the selected decks and their start note.
    await page.getByText("Forge ist bereit.", { exact: true }).waitFor()
    const afterRefusal = await startNote(page)
    check(afterRefusal === "Forge ist bereit.", `game failures: after the refusal "${afterRefusal}"`)
    await chooseDeck(page, "Dein Deck wählen", "E2E Deutsch")
    await startAndWait(page)
    check(engineWorkerRequests(pageLog, id) === workerScripts, "game failures: the refused game's engine was not used for the next game")
    await concedeGame(page)
    results["workers"] = { created: workers.created(), maxAtOnce: workers.max(), trace: workers.trace() }
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
    results["help"] = await helpInteractions(page, "live-phone", VIEWPORTS[0]!, true)
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
    results["resizeInvariance"] = await liveResizeCheck(page, "live-phone")
    results["played"] = await playRealGame(page, "game (phone, playing)", true)
    results["liveRecordingReplay"] = await liveReplayCheck(page, "game phone")
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
    results["finishedRecording"] = await finishedRecordingCheck(page, "game phone")
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
    // Prompt 39: the profile is a chip of the AI's strip (data-strip-fact="profile"), no longer a badge.
    const aiBadges = await page.getByRole("region", { name: "Forge-KI" }).locator('[data-strip-fact="profile"]').allTextContents()
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
    const drawnBadges = await page.getByRole("region", { name: "Forge-KI" }).locator('[data-strip-fact="profile"]').allTextContents()
    results["drawnBadges"] = drawnBadges
    check(/^(Standard|Vorsichtig|Waghalsig|Experimentell) \(zufällig\)$/.test(drawnBadges[0] ?? ""), `preferences: the drawn profile ${JSON.stringify(drawnBadges)}`)
    await concedeGame(page)
    results["workers"] = { created: workers.created(), maxAtOnce: workers.max(), trace: workers.trace() }
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
      `Protokoll: Version ${PROTOCOL_VERSION}`,
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
    // The eight rows of prompt 12, plus the table's background (2026-10-12: the drawn table, the built-in pictures, the player's own).
    const backgrounds = await page.getByRole("radiogroup", { name: "Spieltisch-Hintergrund" }).getByRole("radio").count()
    check(backgrounds >= 2 && heights.length === 8 + backgrounds && heights.every((height) => height >= 44), `preferences (phone): option rows ${JSON.stringify(heights)} (${backgrounds} table backgrounds)`)
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
  // Priority, stack and phases (prompt 16): the player's priority in the AI's turn, with the AI's spell on top, with the player's answer on top of it.
  "opponent-turn",
  "respond",
  "respond-own",
  // Targets and payment (prompt 17): players Forge takes, two targets, the payment with the pool and with life, X while casting.
  "target-both",
  "payment",
  "payment-pool",
  "payment-life",
  "cast-x",
  // Declaring attackers (prompt 18): Forge's reasons why creatures stay back, declared attackers, a planeswalker as the defender.
  "attack",
  "attack-declared",
  "attack-planeswalker",
  "block-start",
  "block-multiple",
  // Prompt 43: Forge's next state after attack-planeswalker - its creature attacks the planeswalker -, rebuilt from Forge's
  // own messages (src/test/built-scenes.ts, marked as built; BUILT_STATES below): an attack arrow that ends at a card.
  "attack-planeswalker-declared",
] as const

/** Forge's questions the recorded games do not reach, built after the schema on the recorded "main-phase" state (src/test/built-questions.ts) - marked as built. */
const BUILT_SCENES = ["confirm", "input", "order", "block-order", "reveal", "choose-many", "select-outside", "arrange-anywhere", "distribute-limits"] as const

/** The sizes at which every kind of question is also answered (decisionInteractions); the layout is checked at all. */
const DECISION_VIEWPORTS: readonly string[] = ["small-phone", "phone-landscape", "desktop"]

/** The sizes the table must fit: phones upright and turned, a small phone, an unfolded foldable upright, a tablet turned, a desktop. */
const TABLE_VIEWPORTS: readonly Viewport[] = [
  VIEWPORTS[0]!,
  { name: "phone-landscape", width: 915, height: 412, touch: true, scale: 2.625 },
  { name: "small-phone", width: 360, height: 740, touch: true, scale: 3 },
  VIEWPORTS[1]!,
  { name: "tablet-landscape", width: 1104, height: 884, touch: true, scale: 2 },
  RESPONSIVE_VIEWPORTS[3]!,
  RESPONSIVE_VIEWPORTS[4]!,
  VIEWPORTS[2]!,
]

/**
 * The table's layout by aspect ratio (prompt 36, docs/design/SPIELTISCH.md §3): the eight sizes above, the foldable
 * (closed, open upright, open turned) and the borders - 3:4 and 13:10 themselves are quadrat, a pixel beyond is not.
 */
const TABLE_LAYOUT_SIZES: readonly (readonly [string, number, number, TableLayout])[] = [
  ["small-phone", 360, 740, "hoch"],
  ["phone", 412, 915, "hoch"],
  ["phone-landscape", 915, 412, "breit"],
  ["fold-portrait", 690, 829, "quadrat"],
  ["fold-landscape", 829, 690, "quadrat"],
  ["tablet", 884, 1104, "quadrat"],
  ["tablet-landscape", 1104, 884, "quadrat"],
  ["desktop", 1440, 900, "breit"],
  ["fold-closed", 480, 1040, "hoch"],
  ["fold-open", 870, 960, "quadrat"],
  ["fold-open-turned", 960, 870, "quadrat"],
  ["border-3:4-minus", 299, 400, "hoch"],
  ["border-3:4", 300, 400, "quadrat"],
  ["border-13:10", 1300, 1000, "quadrat"],
  ["border-13:10-plus", 1301, 1000, "breit"],
]

/**
 * Forge's marks in the recorded scenes (prompt 14): the playable land, the attacker blockers go to, Krenko who can still
 * attack; since prompt 16 the answers the player holds in the AI's turn (four red instants, two once it answered); since
 * prompt 17 the players Forge takes or highlights (their seats).
 */
const SCENE_MARKS: Partial<Record<(typeof TABLE_SCENES)[number], { readonly usable: number; readonly selected: number; readonly players?: number }>> = {
  opening: { usable: 0, selected: 0 },
  "main-phase": { usable: 1, selected: 0 },
  defend: { usable: 0, selected: 2 },
  "block-start": { usable: 3, selected: 1 },
  "block-multiple": { usable: 0, selected: 3 },
  // Prompt 18: Krenko and the 13 goblins attack (chosen, "greift an" - combat keeps them out of piles); Forge highlights the player attacked.
  "commander-late": { usable: 0, selected: 14, players: 1 },
  "opponent-turn": { usable: 4, selected: 0 },
  respond: { usable: 4, selected: 0 },
  "respond-own": { usable: 2, selected: 0 },
  // Prompt 17: the creatures Dismember may target; both players for Shock; creatures and players for Magma Jet; the mana
  // source Forge marks; none while floating mana pays; the sources and the player's life for Phyrexian mana.
  target: { usable: 5, selected: 0 },
  "target-player": { usable: 0, selected: 0, players: 2 },
  "target-both": { usable: 2, selected: 0, players: 2 },
  payment: { usable: 1, selected: 0 },
  "payment-pool": { usable: 0, selected: 0 },
  "payment-life": { usable: 2, selected: 0, players: 1 },
  // Prompt 18: the one creature Forge would declare (three stay back with its reasons), the player attacked; then declared;
  // a planeswalker attacked with the creature ready, another planeswalker and the opponent a tap away.
  attack: { usable: 1, selected: 0, players: 1 },
  "attack-declared": { usable: 0, selected: 1, players: 1 },
  "attack-planeswalker": { usable: 2, selected: 1, players: 1 },
}

/**
 * The cards as touch and click targets (prompt 14): every card the player
 * may see is a button of its row; the smallest keeps WCAG 2.2's minimum
 * target size (2.5.8: 24 × 24 px). Cards are sized by their rows, so they
 * stay below the 44 px of buttons on small phones - a mis-tap only opens the
 * card view, and the steps that tap at once take a tap back.
 */
async function cardTargets(page: Page, label: string): Promise<{ readonly count: number; readonly smallest: { readonly width: number; readonly height: number } | null }> {
  // Only cards on screen are targets: a region the layout sets aside (stack and combat beside a big question in a low
  // landscape window, prompt 15) takes its cards - since prompt 16 also those of the stack - out of the page.
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('button[data-slot="game-card"]')]
      .filter((card) => card.checkVisibility())
      .map((card) => {
        const box = card.getBoundingClientRect()
        return { width: Math.round(box.width), height: Math.round(box.height) }
      }),
  )
  if (boxes.length === 0) return { count: 0, smallest: null }
  const smallest = { width: Math.min(...boxes.map((box) => box.width)), height: Math.min(...boxes.map((box) => box.height)) }
  check(smallest.width >= 24 && smallest.height >= 24, `${label}: a card target of ${smallest.width}×${smallest.height}px`)
  return { count: boxes.length, smallest }
}

/** A fanned hand's own strip of a card at least this wide (px, src/game/table/hand-fan.ts MIN_STRIP: WCAG 2.5.8's 24 px), less rounding. */
const HAND_MIN_STRIP = 23.5

/**
 * The player's hand as a fan (prompt 42, docs/design/SPIELTISCH.md §4.10) at one size: every card keeps at least 24 px
 * of its own (from its left edge to the next card's), and that strip is the card under a pointer there; in the fan
 * (data-fan="fan") the cards fit the hand's width - no sideways scrolling, every card inside the hand's region and the
 * window - and sink below the hand's lower edge, none rises at rest; only a row of more cards than fit (data-fan="row")
 * scrolls, its cards inside the hand. The toolbar keeps its name "Deine Hand: N Karten".
 */
async function handFacts(page: Page, label: string): Promise<Record<string, unknown> | null> {
  const info = await page.evaluate(() => {
    const region = document.querySelector('[data-slot="game-board-area"][data-area="hand"]')
    const row = region?.querySelector<HTMLElement>(".table-hand") ?? null
    if (region === null || row === null) return null
    const area = region.getBoundingClientRect()
    const origin = row.getBoundingClientRect().left + row.clientLeft - row.scrollLeft
    const items = [...row.querySelectorAll<HTMLElement>(":scope > [data-hand-card]")]
    return {
      mode: row.dataset["fan"] ?? null,
      name: row.getAttribute("aria-label"),
      area: { left: area.left, right: area.right, top: area.top, bottom: area.bottom },
      window: { width: innerWidth, height: innerHeight },
      scrolls: row.scrollWidth > row.clientWidth + 1,
      lifted: items.filter((item) => item.hasAttribute("data-lifted")).length,
      cards: items.map((item, index) => {
        const box = item.getBoundingClientRect()
        const next = items[index + 1]
        const left = origin + item.offsetLeft
        const right = next === undefined ? left + item.offsetWidth : origin + next.offsetLeft
        // The middle of the card's own strip, low on the card (above the hand's lower edge): the card itself is hit there.
        const y = Math.min(box.top + box.height * 0.6, area.bottom - 4)
        const hit = document.elementFromPoint((left + right) / 2, y)
        return { strip: Math.round((right - left) * 10) / 10, left: box.left, right: box.right, top: box.top, bottom: box.bottom, own: hit !== null && item.contains(hit) }
      }),
    }
  })
  if (info === null) return null
  const count = info.cards.length
  check(info.name === `Deine Hand: ${count === 1 ? "1 Karte" : `${count} Karten`}`, `${label}: the hand's toolbar is named "${info.name}"`)
  check(info.lifted === 0, `${label}: a card of the hand is lifted at rest`)
  const narrowest = Math.min(...info.cards.map((card) => card.strip))
  check(narrowest >= HAND_MIN_STRIP, `${label}: a card of the hand keeps only ${narrowest}px of its own`)
  const hidden = info.cards.filter((card) => !card.own && card.left >= 0 && card.right <= info.window.width).length
  check(hidden === 0, `${label}: ${hidden} cards of the hand are not hit on their own strip`)
  if (info.mode === "fan") {
    check(!info.scrolls, `${label}: the fanned hand scrolls sideways`)
    check(info.cards.every((card) => card.left >= info.area.left - 1 && card.right <= info.area.right + 1 && card.left >= -1 && card.right <= info.window.width + 1), `${label}: a card of the fan leaves the hand sideways ${JSON.stringify(info.cards.map((card) => [Math.round(card.left), Math.round(card.right)]))} in ${JSON.stringify(info.area)}`)
    check(info.cards.every((card) => card.bottom > info.area.bottom && card.top >= info.area.top - 4), `${label}: the fan's cards do not stand on the hand's edge ${JSON.stringify(info.cards.map((card) => [Math.round(card.top), Math.round(card.bottom)]))} in ${JSON.stringify(info.area)}`)
  } else {
    check(info.mode === "row" && info.cards.every((card) => card.top >= info.area.top - 1 && card.bottom <= info.area.bottom + 1), `${label}: the hand's row (${info.mode}) leaves the hand`)
  }
  return { mode: info.mode, cards: count, narrowest, scrolls: info.scrolls }
}

/**
 * The cards on the battlefields (prompt 40, docs/design/SPIELTISCH.md §4.7-4.8) at one size: every card keeps to its
 * row - its chips above the picture, never on it, and an attacker moved towards its opponent too -, a pile says "×N"
 * above it and draws the cards behind its front card, Forge's values lie on the plaque on the printed value box
 * (bottom right; turned: bottom left, upright) clear of the artist and copyright line, shown from a card width of 44 px
 * and hidden below; the cards of a row share one width, and a row scrolls sideways only once its cards are at the
 * minimum of 44 px (or smaller, where the row's height allows no more).
 */
async function cardFaces(page: Page, label: string): Promise<Record<string, unknown>> {
  const rows = await page.evaluate(() => {
    const box = (element: Element) => {
      const r = element.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
    }
    return [...document.querySelectorAll('[data-slot="game-board-area"] .table-field-row')]
      .filter((row) => row.checkVisibility())
      .map((row) => ({
        label: row.getAttribute("aria-label") ?? "",
        box: box(row),
        scrolls: row.scrollWidth > row.clientWidth + 1,
        cards: [...row.querySelectorAll('[data-slot="game-card"]')].map((card) => {
          const caption = card.querySelector('[data-slot="game-card-caption"]')
          const plaque = card.querySelector('[data-slot="game-card-plaque"]')
          return {
            id: card.getAttribute("data-card") ?? "hidden",
            tapped: card.getAttribute("data-tapped") === "true",
            card: box(card),
            picture: box(card.querySelector('[data-slot="game-card-picture"]')!),
            caption: caption === null ? null : box(caption),
            chips: caption?.textContent ?? "",
            pile: Number(/(\d+) Karten/.exec(caption?.getAttribute("title") ?? "")?.[1] ?? 1),
            layers: card.querySelectorAll('[data-slot="game-card-layer"]').length,
            plaque: plaque === null ? null : { shown: plaque.checkVisibility(), ...box(plaque) },
          }
        }),
      }))
  })
  let plaques = 0
  let hidden = 0
  let smallest = Number.POSITIVE_INFINITY
  for (const row of rows) {
    const widths: number[] = []
    for (const card of row.cards) {
      const where = `${label}: ${row.label}, card ${card.id}`
      const picture = card.picture
      // The card's width: a tapped card lies turned, its picture's box is as tall as the card is wide.
      const width = card.tapped ? picture.height : picture.width
      widths.push(width)
      check(card.card.top >= row.box.top - 1 && card.card.bottom <= row.box.bottom + 1, `${where}: leaves its row ${JSON.stringify({ card: card.card, row: row.box })}`)
      check(card.caption === null || card.caption.bottom <= picture.top + 1, `${where}: the chips lie on the picture ${JSON.stringify({ caption: card.caption, picture })}`)
      if (card.pile > 1) check(card.chips.startsWith(`×${card.pile}`) && card.layers === Math.min(card.pile, 3) - 1, `${where}: a pile of ${card.pile} shows "${card.chips}" and ${card.layers} cards behind`)
      if (card.plaque === null) continue
      const plaque = card.plaque
      if (width >= 44.5) check(plaque.shown, `${where}: no plaque on a card ${width.toFixed(1)}px wide`)
      if (width < 43.5) check(!plaque.shown, `${where}: a plaque on a card only ${width.toFixed(1)}px wide`)
      if (!plaque.shown) {
        hidden++
        continue
      }
      plaques++
      check(plaque.left >= picture.left - 0.5 && plaque.right <= picture.right + 0.5 && plaque.top >= picture.top - 0.5 && plaque.bottom <= picture.bottom + 0.5, `${where}: the plaque leaves the picture ${JSON.stringify({ plaque, picture })}`)
      const fromRight = picture.right - plaque.right
      const fromLeft = plaque.left - picture.left
      const fromBottom = picture.bottom - plaque.bottom
      if (!card.tapped) {
        // On the printed value box at the bottom right; below it the artist and copyright line (the bottom 4 %) stays free.
        check(fromRight <= 0.03 * picture.width + 2 && fromBottom >= 0.04 * picture.height && fromBottom <= 0.043 * picture.height + 2, `${where}: the plaque is not on the value box ${JSON.stringify({ fromRight, fromBottom, picture })}`)
      } else {
        // Turned: the box lies at the bottom left, upright; the copyright edge (now the left 4.3 %) stays free.
        check(fromLeft >= 0.05 * picture.width && fromLeft <= 0.06 * picture.width + 2 && fromBottom >= 0.09 * picture.height && fromBottom <= 0.1 * picture.height + 2, `${where}: the plaque is not on the turned value box ${JSON.stringify({ fromLeft, fromBottom, picture })}`)
      }
    }
    if (widths.length === 0) continue
    const least = Math.min(...widths)
    smallest = Math.min(smallest, least)
    check(Math.max(...widths) - least <= 1, `${label}: ${row.label}: cards of different widths ${JSON.stringify(widths)}`)
    check(!row.scrolls || least <= 44.5, `${label}: ${row.label} scrolls sideways with cards ${least.toFixed(1)}px wide`)
  }
  return { rows: rows.length, cards: rows.reduce((sum, row) => sum + row.cards.length, 0), plaques, hidden, smallest: Number.isFinite(smallest) ? Math.round(smallest * 10) / 10 : null }
}

/**
 * The strips and the header of prompt 39 at one size: each player is a life medallion (the ring drawn, Forge's life in
 * `[title="Lebenspunkte"] .tabular-nums`), the zones are piles and counters; every one of them - and the header's zone,
 * history and help buttons - is at least 44 px on a touch screen, inside the window and inside its strip, and no strip
 * spills sideways.
 */
async function stripFacts(page: Page, label: string, touch: boolean): Promise<Record<string, unknown>> {
  const facts = await page.evaluate(() => {
    const box = (element: Element) => {
      const r = element.getBoundingClientRect()
      return { width: Math.round(r.width), height: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }
    }
    const sides = ["Forge-KI", "Du"].map((name) => {
      const region = document.querySelector(`section[aria-label="${name}"]`)
      const medallion = region?.querySelector('[data-slot="game-player"].table-medallion') ?? null
      const strip = region?.querySelector(".table-strip") ?? null
      return {
        name,
        region: region === null ? null : box(region),
        medallion: medallion === null ? null : { ...box(medallion), life: medallion.querySelector('[title="Lebenspunkte"] .tabular-nums')?.textContent ?? null, ring: medallion.querySelector('use[href="#table-art-medallion"]') !== null },
        library: region?.querySelector('[data-zone-pile="Bibliothek"]') !== null,
        piles: [...(region?.querySelectorAll("button[data-zone-pile]") ?? [])].map((pile) => ({ zone: pile.getAttribute("data-zone-pile"), ...box(pile) })),
        spills: strip === null ? true : strip.scrollWidth > strip.clientWidth + 1,
      }
    })
    const header = document.querySelector('section[aria-label="Spielstand"]')
    const buttons = ["Zonen ansehen", "Spielverlauf ansehen", "Hilfe am Spieltisch"].map((name) => {
      const button = header?.querySelector(`button[aria-label="${name}"]`)
      return { name, ...(button ? box(button) : { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 }) }
    })
    return { sides, buttons, symbols: document.querySelectorAll("#table-art-back, #table-art-medallion, #table-art-emblem").length, view: { width: innerWidth, height: innerHeight } }
  })
  const inside = (b: { left: number; right: number; top: number; bottom: number }) => b.left >= -1 && b.top >= -1 && b.right <= facts.view.width + 1 && b.bottom <= facts.view.height + 1
  check(facts.symbols === 3, `${label}: the table's drawn pieces are defined ${facts.symbols} times (expected once each)`)
  for (const side of facts.sides) {
    const where = `${label}: ${side.name}`
    check(side.medallion !== null && side.medallion.ring && side.medallion.life !== null && /^-?\d+$/.test(side.medallion.life.trim()), `${where}: no life medallion ${JSON.stringify(side.medallion)}`)
    check(side.library, `${where}: no library pile`)
    check(!side.spills, `${where}: the strip spills sideways`)
    for (const control of [...(side.medallion === null ? [] : [{ zone: "medallion", ...side.medallion }]), ...side.piles]) {
      check(inside(control), `${where}: ${control.zone} outside the window ${JSON.stringify(control)}`)
      if (side.region !== null) check(control.left >= side.region.left - 1 && control.right <= side.region.right + 1, `${where}: ${control.zone} outside its strip ${JSON.stringify(control)}`)
      // At least 44 px on a touch screen, at least the 24 px of WCAG 2.5.8 everywhere.
      const least = touch ? 44 : 24
      check(control.width >= least && control.height >= least, `${where}: ${control.zone} only ${control.width}×${control.height}px`)
    }
  }
  for (const button of facts.buttons) {
    check(button.width > 0 && inside(button), `${label}: header button ${button.name} missing or outside ${JSON.stringify(button)}`)
    if (touch) check(button.width >= 44 && button.height >= 44, `${label}: header button ${button.name} only ${button.width}×${button.height}px`)
  }
  return facts
}

/** What the end-to-end test reads of a scene's state: the stack, combat and the players' zones (the original envelopes). */
interface SceneState {
  readonly stack: readonly { readonly id: number; readonly targets: readonly { readonly kind: "card" | "player"; readonly id: number }[] }[]
  readonly combat: readonly { readonly attacker: number; readonly defender: number | null; readonly defenderKind: "player" | "card" | null; readonly blockers: readonly number[] }[]
  readonly players: readonly { readonly me: boolean; readonly zones: Readonly<Record<"graveyard" | "exile", readonly { readonly id?: number }[]>> }[]
}

/**
 * Scenes rebuilt from Forge's next messages (src/test/built-scenes.ts, prompt 43): the recorded scene they start from
 * and Forge's combat of the next state (the attackers game, transcript of publish-35d, message 589).
 */
const BUILT_STATES: Readonly<Record<string, { readonly base: string; readonly combat: SceneState["combat"] }>> = {
  "attack-planeswalker-declared": { base: "attack-planeswalker", combat: [{ attacker: 17, defender: 68, defenderKind: "card", blockers: [] }] },
}

/** The state of a scene the harness shows: the original recording, or a rebuilt one's base with Forge's next combat. */
function sceneState(scene: string): SceneState {
  const recorded = JSON.parse(fs.readFileSync(path.join(root, "src/test/fixtures/table-scenes.json"), "utf8")) as { scenes: { name: string; state: SceneState }[] }
  const built = BUILT_STATES[scene]
  const state = recorded.scenes.find((record) => record.name === (built?.base ?? scene))!.state
  return built === undefined ? state : { ...state, combat: built.combat }
}

/** Forge's stack of a recorded scene, top first (the original recording, never the table's words). */
function recordedStackIds(scene: string): number[] {
  return sceneState(scene).stack.map((item) => item.id)
}

/** Recorded scenes whose decision has a main button (prompt 41): the player's priority (pass) and the confirmations of attack, block and the mulligan. */
const SCENE_MAIN_BUTTON: ReadonlySet<string> = new Set(["opening", "main-phase", "blockers", "defend", "commander-late", "opponent-turn", "respond", "respond-own", "attack", "attack-declared", "attack-planeswalker", "block-start", "block-multiple", "attack-planeswalker-declared"])

/**
 * Prompt 41 (docs/design/SPIELTISCH.md §4.11-4.14): the Zauberchronik and the Phasen-Tafel in every scene and size.
 * One phase track, in the decision region: in hoch the action bar with the compact phases beside the answers and the
 * main button right of them in the same row; beside the battlefields the Phasen-Tafel with the phases above Forge's
 * question. The main button - pass and the confirmations of attack, block and the mulligan, never another - is golden
 * Cinzel and lies in the window. The chronicle shows one entry per stack item in Forge's order (top first, highlighted),
 * each with its card or back; in hoch side by side, beside the battlefields one below the other.
 */
async function panelFacts(page: Page, label: string, scene: string | null, stack: readonly number[] | null): Promise<Record<string, unknown>> {
  const facts = await page.evaluate(() => {
    const box = (element: Element) => {
      const r = element.getBoundingClientRect()
      return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }
    }
    const decision = document.querySelector('[data-area="decision"]')!
    const panel = decision.querySelector<HTMLElement>('[data-slot="phase-panel"]')
    const header = decision.querySelector('[data-slot="game-decision-header"]')
    const center = document.querySelector('[data-area="center"]')!
    return {
      view: { width: innerWidth, height: innerHeight },
      tracks: document.querySelectorAll('[data-slot="phase-track"]').length,
      inDecision: decision.querySelector('[data-slot="phase-track"]') !== null,
      place: panel?.dataset["place"] ?? null,
      folded: panel?.dataset["folded"] === "true",
      inBar: panel?.closest('[data-slot="game-decision-bar"]') != null,
      hidden: panel?.getAttribute("aria-hidden") ?? null,
      panel: panel === null ? null : box(panel),
      header: header === null ? null : box(header),
      main: [...decision.querySelectorAll<HTMLElement>("[data-main]")].map((button) => ({
        text: (button.textContent ?? "").trim(),
        meaning: button.dataset["meaning"] ?? null,
        group: button.closest('[role="group"]')?.getAttribute("aria-label") ?? null,
        gold: getComputedStyle(button).backgroundImage.includes("gradient"),
        cinzel: getComputedStyle(button).fontFamily.includes("Cinzel"),
        ...box(button),
      })),
      entries: [...center.querySelectorAll<HTMLElement>("[data-stack-item]")].map((entry) => ({
        id: Number(entry.dataset["stackItem"]),
        highlighted: entry.hasAttribute("data-top"),
        card: entry.querySelector('[data-stack-card], [data-slot="game-card-back"]') !== null,
        ...box(entry),
      })),
      chronicle: center.querySelector('[data-slot="table-panel"]') !== null,
    }
  })
  const layout = tableLayoutOf(facts.view.width, facts.view.height)
  const hoch = layout === "hoch"
  check(facts.tracks === 1 && facts.inDecision && facts.hidden === "true", `${label}: the phases are not one picture in the decision region ${JSON.stringify(facts)}`)
  check(facts.place === (hoch ? "bar" : "panel") && facts.inBar === hoch, `${label}: the phases are not in the ${hoch ? "action bar" : "Phasen-Tafel"} ${JSON.stringify({ place: facts.place, inBar: facts.inBar })}`)
  check(facts.chronicle, `${label}: no Zauberchronik panel`)
  if (scene !== null) check(facts.main.length === (SCENE_MAIN_BUTTON.has(scene) ? 1 : 0), `${label}: ${facts.main.length} main buttons ${JSON.stringify(facts.main)}`)
  check(facts.main.length <= 1, `${label}: more than one main button ${JSON.stringify(facts.main)}`)
  for (const main of facts.main) {
    check(main.group === "Antworten, die Forge anbietet" && (main.meaning === null || main.meaning === "pass" || main.meaning === "declare"), `${label}: the main button is not Forge's pass or confirmation ${JSON.stringify(main)}`)
    check(main.gold && main.cinzel, `${label}: the main button is not golden Cinzel ${JSON.stringify(main)}`)
    check(main.top >= 0 && main.left >= 0 && main.bottom <= facts.view.height + 1 && main.right <= facts.view.width + 1, `${label}: the main button outside the window ${JSON.stringify(main)}`)
    if (hoch && facts.panel !== null) check(main.left >= facts.panel.right - 1 && main.top < facts.panel.bottom && main.bottom > facts.panel.top, `${label}: the main button is not right of the compact phases ${JSON.stringify({ main, phases: facts.panel })}`)
  }
  if (!hoch && facts.panel !== null && facts.header !== null) check(facts.panel.bottom <= facts.header.top + 1, `${label}: the phases are not above Forge's question ${JSON.stringify({ phases: facts.panel, question: facts.header })}`)
  if (stack !== null) check(JSON.stringify(facts.entries.map((entry) => entry.id)) === JSON.stringify(stack), `${label}: the chronicle's entries ${JSON.stringify(facts.entries.map((entry) => entry.id))}, Forge's stack ${JSON.stringify(stack)}`)
  check(facts.entries.every((entry, index) => entry.card && entry.highlighted === (index === 0)), `${label}: a chronicle entry without its card or the top not first ${JSON.stringify(facts.entries)}`)
  for (let index = 1; index < facts.entries.length; index++) {
    const [before, entry] = [facts.entries[index - 1]!, facts.entries[index]!]
    check(hoch ? entry.left >= before.right - 1 && Math.abs(entry.top - before.top) <= 1 : entry.top >= before.bottom - 1, `${label}: the chronicle's entries are not ${hoch ? "side by side" : "one below the other"} ${JSON.stringify(facts.entries)}`)
  }
  return { place: facts.place, folded: facts.folded, main: facts.main.map((main) => main.text), entries: facts.entries.length }
}

/** One arrow Forge's state asks for (prompt 43): its kind, start and end as the arrows name them (`stack:N`, `card:N`, `player:N`). */
interface ExpectedArrow {
  readonly kind: "target" | "attack" | "block"
  readonly from: string
  readonly to: string
  /** A card target in a graveyard or exile: the pile it points at instead (`pile:<seat>:<zone>`). */
  readonly pile: string | null
}

/** The arrows of a scene, read from the original envelopes - independent of the table's own code (arrows.ts). */
function expectedArrows(state: SceneState): ExpectedArrow[] {
  const pileOf = (id: number): string | null => {
    for (const player of state.players) for (const zone of ["graveyard", "exile"] as const) if (player.zones[zone].some((card) => card.id === id)) return `pile:${player.me ? "me" : "opponent"}:${zone}`
    return null
  }
  const arrows: ExpectedArrow[] = []
  for (const item of state.stack) for (const target of item.targets) arrows.push({ kind: "target", from: `stack:${item.id}`, to: `${target.kind}:${target.id}`, pile: target.kind === "card" ? pileOf(target.id) : null })
  for (const entry of state.combat) if (entry.defender !== null && entry.defenderKind !== null) arrows.push({ kind: "attack", from: `card:${entry.attacker}`, to: `${entry.defenderKind}:${entry.defender}`, pile: null })
  for (const entry of state.combat) for (const blocker of entry.blockers) arrows.push({ kind: "block", from: `card:${blocker}`, to: `card:${entry.attacker}`, pile: null })
  return arrows
}

/**
 * Prompt 43 (docs/design/SPIELTISCH.md §4.15): the arrows of a scene as the page shows them. One arrow per relation of
 * Forge's state - a stack entry's targets, attackers to whom they attack, blockers to their attackers - whose start
 * and end the player sees (a card scrolled out of its row gets none; a target in a graveyard or exile points at its
 * pile); none other. Each arrow's tip lies in the window, beside its end - never on the end's box -, and no head lies
 * on a card picture. The arrows are hidden from screen readers and take no pointer events: a point on a line hits
 * what lies under it.
 */
/** The scenes whose whole table is walked with the keyboard (prompt 45): the main button, the stack, medallions as controls, a crowded commander table. */
const KEYBOARD_SCENES: readonly string[] = ["main-phase", "stack", "target-player", "commander-late"]

/** The regions in the page's (and focus) order - hoch's, the same in every layout (prompt 38). */
const FOCUS_ORDER = ["header", "opponent", "opponent-field", "center", "field", "me", "hand", "decision"] as const

/**
 * The whole table with the keyboard and its names for screen readers (prompt 45, docs/design/SPIELTISCH.md §6): Tab from
 * the page's start walks every region in the focus order (a card row is one stop), every stop shows its focus and has a
 * name, Tab leaves the table at its end, and nothing is tapped or answered on the way. The names: each medallion says
 * who and the life total with "Lebenspunkte", each zone pile what it opens and how many cards, each card and each
 * Zauberchronik entry its name ("… ansehen"), the main button its words.
 */
async function tableKeyboardTour(page: Page, label: string): Promise<Record<string, unknown>> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const stops: { area: string; name: string; shown: boolean }[] = []
  let left = false
  try {
    for (let step = 0; step < 80; step++) {
      await page.keyboard.press("Tab")
      const at = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null
        if (element === null || element === document.body || !element.closest('[data-slot="game-board"]')) return null
        const style = getComputedStyle(element)
        return {
          area: element.closest('[data-slot="game-board-area"]')?.getAttribute("data-area") ?? "board",
          shown: element.matches(":focus-visible") && (style.outlineStyle !== "none" || style.boxShadow !== "none"),
        }
      })
      if (at === null) {
        left = true
        break
      }
      // The accessible name as the browser computes it (role "name" in Playwright's ARIA snapshot).
      const snapshot = (await page.locator(":focus").ariaSnapshot()).split("\n")[0] ?? ""
      const name = /^- \S+ "(.*?)"(?::|$)/.exec(snapshot.replace(/^- '(.*)'(:.*)?$/, "- $1"))?.[1] ?? ""
      stops.push({ ...at, name })
    }
    check(left, `${label}: Tab did not leave the table after ${stops.length} stops`)
    const order = stops.map((stop) => FOCUS_ORDER.indexOf(stop.area as (typeof FOCUS_ORDER)[number]))
    check(order.every((index, at) => index >= 0 && (at === 0 || index >= order[at - 1]!)), `${label}: focus order ${JSON.stringify(stops.map((stop) => stop.area))}`)
    const nameless = stops.filter((stop) => stop.name.trim() === "")
    check(nameless.length === 0, `${label}: focus stops without a name ${JSON.stringify(nameless)}`)
    const hidden = stops.filter((stop) => !stop.shown)
    check(hidden.length === 0, `${label}: focus not shown at ${JSON.stringify(hidden)}`)
    // Every region with something to focus on the screen is reached (a region that steps aside, e.g. an empty
    // Zauberchronik in a low window, has nothing to reach).
    const focusable = await page.evaluate(() => {
      const shown = (element: Element) => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.height > 0 && element.checkVisibility({ visibilityProperty: true })
      }
      return [...document.querySelectorAll<HTMLElement>('[data-slot="game-board-area"]')]
        .filter((area) => [area, ...area.querySelectorAll("button:not([disabled]), a[href], [tabindex]")].some((element) => element.matches("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])") && shown(element)))
        .map((area) => area.getAttribute("data-area"))
    })
    const missed = focusable.filter((area) => !stops.some((stop) => stop.area === area))
    check(missed.length === 0, `${label}: the keyboard never reaches ${missed.join(", ")}`)
    check((await harnessTaps(page)).length === 0 && (await harnessAnswers(page)).length === 0 && (await harnessPlayerTaps(page)).length === 0, `${label}: walking with Tab sent an input`)
  } finally {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  }
  // The names of the table's parts.
  const medallions = await Promise.all((await page.locator('[data-slot="game-player"][data-player]').all()).map(async (medallion) => (await medallion.ariaSnapshot()).replace(/\s+/g, " ")))
  check(medallions.length >= 2 && medallions.every((text) => /\d+ Lebenspunkte/.test(text) && /Forge-KI|Du\b/.test(text)), `${label}: medallion names ${JSON.stringify(medallions)}`)
  const names = await page.evaluate(() => {
    const named = (element: Element) => (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim()
    return {
      piles: [...document.querySelectorAll('button[data-zone-pile]')].map(named),
      cards: [...document.querySelectorAll('button[data-slot="game-card"]')].map(named),
      chronicle: [...document.querySelectorAll("button[data-stack-card]")].map(named),
      main: [...document.querySelectorAll("[data-main]")].map((button) => ({ name: named(button), text: (button.textContent ?? "").replace(/\s+/g, " ").trim() })),
    }
  })
  check(names.piles.length > 0 && names.piles.every((name) => /ansehen: \d+ Karten?\b/.test(name)), `${label}: zone pile names ${JSON.stringify(names.piles)}`)
  check(names.cards.every((name) => name.length > 0), `${label}: a card without a name`)
  check(names.chronicle.every((name) => name.endsWith(" ansehen")), `${label}: Zauberchronik names ${JSON.stringify(names.chronicle)}`)
  check(names.main.every(({ name, text }) => name.length > 0 && name.includes(text)), `${label}: main button names ${JSON.stringify(names.main)}`)
  return { stops: stops.length, areas: [...new Set(stops.map((stop) => stop.area))], names: stops.map((stop) => `${stop.area}: ${stop.name}`), medallions, piles: names.piles, cards: names.cards.length, chronicle: names.chronicle, main: names.main }
}

async function arrowFacts(page: Page, label: string, scene: string): Promise<Record<string, unknown>> {
  const expected = expectedArrows(sceneState(scene))
  // A fresh drawing on the final layout: a scroll on the board asks for one (the hand's fan and the pictures may settle after the first).
  await page.evaluate(() => new Promise<void>((resolve) => {
    document.querySelector('[data-slot="game-board"]')?.dispatchEvent(new Event("scroll"))
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  const facts = await page.evaluate((wanted) => {
    const board = document.querySelector<HTMLElement>('[data-slot="game-board"]')!
    const wrapper = board.querySelector<HTMLElement>(':scope > [data-slot="table-arrows"]')
    const origin = board.getBoundingClientRect()
    const clipping = new Set(["hidden", "clip", "auto", "scroll"])
    type Box = { left: number; top: number; right: number; bottom: number }
    const cut = (a: Box, b: Box): Box | null => {
      const r = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) }
      return r.right > r.left && r.bottom > r.top ? r : null
    }
    // What the player sees of an element: its box cut by every clipping ancestor and the board.
    const seen = (element: Element | null | undefined): Box | null => {
      if (!element) return null
      let box: Box | null = element.getBoundingClientRect()
      for (let a = element.parentElement; a !== null && a !== board && box !== null; a = a.parentElement) {
        const style = getComputedStyle(a)
        if (clipping.has(style.overflowX) || clipping.has(style.overflowY)) box = cut(box, a.getBoundingClientRect())
      }
      box = box === null ? null : cut(box, origin)
      return box !== null && box.right - box.left >= 8 && box.bottom - box.top >= 8 ? box : null
    }
    const onTable = (element: Element) => element.closest('[data-area="decision"]') === null
    const find = (key: string): Element | null => {
      const [kind, id, zone] = key.split(":")
      if (kind === "stack") return board.querySelector(`[data-area="center"] [data-stack-item="${id}"]`)
      if (kind === "player") return [...board.querySelectorAll(`[data-slot="game-player"][data-player="${id}"]`)].find(onTable) ?? null
      if (kind === "pile") return board.querySelector(`[data-area="${id === "me" ? "me" : "opponent"}"] [data-zone-pile="${zone === "graveyard" ? "Friedhof" : "Exil"}"]`)
      return [...board.querySelectorAll(`[data-card="${id}"], [data-stack-card="${id}"]`)].find(onTable)?.querySelector('[data-slot="game-card-face"]') ?? null
    }
    const pictures = [...board.querySelectorAll('[data-slot="card-picture"], [data-slot="game-card-back"]')].map(seen).filter((box): box is Box => box !== null)
    const area = (a: Box, b: Box) => {
      const r = cut(a, b)
      return r === null ? 0 : (r.right - r.left) * (r.bottom - r.top)
    }
    const drawn = [...(wrapper?.querySelectorAll<SVGGElement>("[data-arrow]") ?? [])].map((g) => {
      const [x, y] = (g.dataset["end"] ?? "").split(" ").map(Number) as [number, number]
      const head = g.querySelector("path")!.getBoundingClientRect()
      const box = { left: head.left, top: head.top, right: head.right, bottom: head.bottom }
      const end = seen(find(g.dataset["to"] ?? ""))
      return {
        key: `${g.dataset["arrow"]} ${g.dataset["from"]}>${g.dataset["to"]}`,
        side: g.dataset["side"] ?? null,
        tip: { x: origin.left + x, y: origin.top + y },
        onEnd: end === null ? null : area(box, end),
        tipInEnd: end !== null && origin.left + x > end.left && origin.left + x < end.right && origin.top + y > end.top && origin.top + y < end.bottom,
        onPictures: pictures.filter((picture) => area(box, picture) > 1).length,
      }
    })
    const relations = wanted.map((arrow) => {
      const to = arrow.pile !== null && find(arrow.to) === null ? arrow.pile : arrow.to
      return { key: `${arrow.kind} ${arrow.from}>${to}`, visible: seen(find(arrow.from)) !== null && seen(find(to)) !== null }
    })
    // A point on a strong line: what the page hits there is never the arrows' layer.
    const line = wrapper?.querySelector<SVGPathElement>('svg[data-layer-name="flow-0"] path') ?? null
    const middle = line === null ? null : line.getPointAtLength(line.getTotalLength() / 2)
    const hit = middle === null ? null : document.elementFromPoint(origin.left + middle.x, origin.top + middle.y)
    return {
      view: { width: innerWidth, height: innerHeight },
      wrapper: wrapper === null ? null : { hidden: wrapper.getAttribute("aria-hidden"), pointer: getComputedStyle(wrapper).pointerEvents, count: Number(wrapper.dataset["arrows"] ?? 0) },
      drawn,
      relations,
      hitsArrows: hit === null ? null : wrapper?.contains(hit) ?? false,
    }
  }, expected)
  check(facts.wrapper !== null && facts.wrapper.hidden === "true" && facts.wrapper.pointer === "none", `${label}: the arrows are not a hidden layer without pointer events ${JSON.stringify(facts.wrapper)}`)
  const drawnKeys = facts.drawn.map((arrow) => arrow.key)
  const wanted = facts.relations.filter((relation) => relation.visible).map((relation) => relation.key)
  check(JSON.stringify([...drawnKeys].sort()) === JSON.stringify([...new Set(wanted)].sort()), `${label}: arrows ${JSON.stringify(drawnKeys)}, Forge's visible relations ${JSON.stringify(wanted)} (out of sight: ${JSON.stringify(facts.relations.filter((relation) => !relation.visible).map((relation) => relation.key))})`)
  for (const arrow of facts.drawn) {
    check(arrow.tip.x >= 0 && arrow.tip.y >= 0 && arrow.tip.x <= facts.view.width && arrow.tip.y <= facts.view.height, `${label}: the tip of ${arrow.key} outside the window ${JSON.stringify(arrow.tip)}`)
    check(arrow.onEnd !== null && arrow.onEnd <= 0.5 && !arrow.tipInEnd, `${label}: the head of ${arrow.key} lies on what it points at ${JSON.stringify(arrow)}`)
    check(arrow.onPictures === 0, `${label}: the head of ${arrow.key} lies on ${arrow.onPictures} card picture(s) ${JSON.stringify(arrow)}`)
  }
  if (facts.hitsArrows !== null) check(!facts.hitsArrows, `${label}: a point on an arrow hits the arrows' layer`)
  const sides: Record<string, number> = {}
  for (const arrow of facts.drawn) sides[arrow.side ?? "?"] = (sides[arrow.side ?? "?"] ?? 0) + 1
  return { expected: expected.length, drawn: facts.drawn.length, outOfSight: facts.relations.filter((relation) => !relation.visible).map((relation) => relation.key), sides }
}

/**
 * Prompt 39: a tap on a strip's pile or counter opens the zone view of that player and zone - looking only (nothing
 * reaches the harness's recorders) - and the focus returns to it.
 */
async function pileInteractions(parent: Page, base: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const label = `piles (${viewport.name})`
  const results: Record<string, unknown> = {}
  for (const [scene, region, zone, title] of [
    ["main-phase", "Forge-KI", "Friedhof", "Friedhof der Forge-KI"],
    ["main-phase", "Du", "Exil", "Dein Exil"],
    ["command-effects", "Du", "Kommandozone", "Deine Kommandozone"],
  ] as const) {
    const page = await parent.context().newPage()
    const pageLog = watch(page)
    try {
      await openScene(page, base, scene)
      const pile = page.getByRole("region", { name: region, exact: true }).locator(`button[data-zone-pile="${zone}"]`)
      if (viewport.touch) await pile.tap()
      else await pile.click()
      const view = page.getByRole("dialog", { name: title, exact: true })
      await view.waitFor()
      await accessibility(page, `${label}: ${title}`)
      await view.getByRole("button", { name: "Schließen", exact: true }).click()
      await view.waitFor({ state: "hidden" })
      check(await pile.evaluate((node) => document.activeElement === node), `${label}: focus not back on the ${zone} pile`)
      check((await harnessTaps(page)).length === 0 && (await harnessAnswers(page)).length === 0 && (await harnessPlayerTaps(page)).length === 0, `${label}: looking at ${title} sent an input`)
      results[`${region}:${zone}`] = true
      for (const error of pageLog.errors) check(false, `${label}: ${error}`)
    } finally {
      await page.close()
    }
  }
  return results
}

/** The cards the harness's table tapped so far (window.__openmanaTaps). */
function harnessTaps(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { __openmanaTaps?: number[] }).__openmanaTaps ?? [])
}

/** The players the harness's table tapped (prompt 17). */
function harnessPlayerTaps(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { __openmanaPlayerTaps?: number[] }).__openmanaPlayerTaps ?? [])
}

/** The floating mana the harness's table paid with (prompt 17). */
function harnessMana(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __openmanaMana?: string[] }).__openmanaMana ?? [])
}

async function openScene(page: Page, base: string, scene: string, query = ""): Promise<void> {
  const errors: string[] = []
  const onError = (error: Error) => { errors.push(error.message) }
  const onConsole = (message: ConsoleMessage) => { if (message.type() === "error") errors.push(message.text()) }
  page.on("pageerror", onError)
  page.on("console", onConsole)
  try {
    await page.goto(new URL(`/scripts/e2e/table-harness.html?scene=${scene}${query}`, base).href, { waitUntil: "domcontentloaded" })
    await page.locator('[data-harness="table"]').waitFor({ timeout: 300_000 })
  } catch (error) {
    const state = await Promise.race([
      page.evaluate(() => ({ title: document.title, harness: [...document.querySelectorAll("[data-harness]")].map((node) => ({ kind: node.getAttribute("data-harness"), status: node.getAttribute("data-status"), text: node.textContent?.slice(0, 900) })), body: document.body.textContent?.slice(0, 900) })).catch(() => "Page unavailable"),
      new Promise<string>((resolve) => setTimeout(() => resolve("Page did not respond to diagnostics"), 2000)),
    ])
    throw new Error(`Table scene failed: ${JSON.stringify({ url: page.url(), errors, state })}`, { cause: error })
  } finally {
    page.off("pageerror", onError)
    page.off("console", onConsole)
  }
}

/** The built hand of handGestures (src/test/table-harness.tsx hand=N): more cards than the recorded games reach. */
const FAN_CARDS = 12

/**
 * The fanned hand in real Chrome (prompt 42, docs/design/SPIELTISCH.md §4.10), on the scene "opening" with a built hand of
 * FAN_CARDS cards (the mulligan: a card's primary activation looks at it):
 *  - mouse: hovering lifts the card under it - whole, above the hand's edge, on top of its neighbours, inside the window -,
 *    the next card's strip lifts that one, leaving the hand drops it, a click is the lifted card's (its view opens and
 *    gives the focus back to it); the keyboard's focus lifts the focused card;
 *  - touch: a finger laid on a card's strip lifts it, swiping lifts the card under the finger by the cards' resting
 *    places, and releasing after the swipe does nothing (no view, no tap); a tap without moving is the lifted card's
 *    primary activation, a long press without a swipe looks at it, a swipe and then a hold does nothing.
 * Screenshots of the hand at rest and with a lifted card (the image comparison of prompt 42). Nothing is ever tapped.
 */
async function handGestures(page: Page, label: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const hand = page.getByRole("toolbar", { name: `Deine Hand: ${FAN_CARDS} Karten` })
  await hand.waitFor()
  const region = (await page.locator('[data-slot="game-board-area"][data-area="hand"]').boundingBox())!
  const strips = await hand.evaluate((row) => {
    const box = row.getBoundingClientRect()
    const origin = box.left + row.clientLeft - row.scrollLeft
    const items = [...row.querySelectorAll<HTMLElement>(":scope > [data-hand-card]")]
    return items.map((item, index) => {
      const next = items[index + 1]
      const left = origin + item.offsetLeft
      const right = next === undefined ? left + item.offsetWidth : origin + next.offsetLeft
      return { key: item.dataset["handCard"] ?? "", x: (left + right) / 2, y: box.top + box.height * 0.6 }
    })
  })
  const mode = await hand.getAttribute("data-fan")
  const lifted = () => page.evaluate(() => document.querySelector(".table-hand > [data-lifted]")?.getAttribute("data-hand-card") ?? null)
  const waitLifted = (key: string | null) => page.waitForFunction((expected) => (document.querySelector(".table-hand > [data-lifted]")?.getAttribute("data-hand-card") ?? null) === expected, key, { timeout: 2000 }).catch(() => undefined)
  const shot = (name: string) => page.screenshot({ path: path.join(reportDir, "screens", `table-${viewport.name}-hand-${FAN_CARDS}${name}.png`) })
  /** The lifted card stands whole above the hand's edge, inside the window, on top of the others at its middle. */
  const standsOut = async (item: Locator, key: string) => {
    await animationsDone(hand)
    const box = (await item.boundingBox())!
    const top = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest("[data-hand-card]")?.getAttribute("data-hand-card") ?? null, [box.x + box.width / 2, box.y + box.height * 0.25])
    // The table itself never moves for it (a focused card reaching out of the board must not scroll the board).
    const still = await page.evaluate(() => document.querySelector('[data-slot="game-board"]')?.scrollTop === 0)
    const fits = still && box.y >= -1 && box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= region.y + region.height + 1
    // A fan's lifted card rises above the hand; a row's (too many cards) rises inside it.
    const rises = mode === "row" ? box.y >= region.y - 1 : box.y < region.y
    check(fits && rises && top === key, `${label}: the lifted card ${key} ${JSON.stringify({ box, region, top, mode, still })}`)
    return { top: Math.round(box.y - region.y), height: Math.round(box.height), width: Math.round(box.width) }
  }
  const view = page.getByRole("dialog")
  const results: Record<string, unknown> = { mode, strips: strips.length }
  check(strips.length === FAN_CARDS, `${label}: the built hand shows ${strips.length} cards`)
  await shot("")
  const [a, b, c, d] = [strips[2]!, strips[5]!, strips[8]!, strips[9]!]
  if (!viewport.touch) {
    await page.mouse.move(a.x, a.y)
    await waitLifted(a.key)
    check((await lifted()) === a.key, `${label}: hovering card ${a.key} lifted ${await lifted()}`)
    results["hover"] = await standsOut(hand.locator(`[data-hand-card="${a.key}"]`), a.key)
    await shot("-lifted")
    await page.mouse.move(b.x, b.y)
    await waitLifted(b.key)
    check((await lifted()) === b.key, `${label}: moving on to card ${b.key} lifted ${await lifted()}`)
    await page.mouse.move(region.x + region.width / 2, Math.max(1, region.y - 140))
    await waitLifted(null)
    check((await lifted()) === null, `${label}: leaving the hand left ${await lifted()} lifted`)
    // A click is the card's under the mouse - the lifted one: its view opens (the mulligan: looking) and gives the focus back to it.
    await page.mouse.move(c.x, c.y)
    await waitLifted(c.key)
    await page.mouse.down()
    await page.mouse.up()
    await view.waitFor()
    await closeCardView(page)
    const focused = await page.evaluate(() => document.activeElement?.closest("[data-hand-card]")?.getAttribute("data-hand-card") ?? null)
    check(focused === c.key, `${label}: the click on card ${c.key} opened the view of ${focused}`)
    // The keyboard's focus lifts the focused card (the arrow keys move it).
    await page.keyboard.press("ArrowRight")
    await page.waitForFunction((key) => document.activeElement?.closest("[data-hand-card]")?.getAttribute("data-hand-card") === key, d.key, { timeout: 2000 }).catch(() => undefined)
    await page.mouse.move(region.x + region.width / 2, Math.max(1, region.y - 140))
    results["focus"] = await standsOut(hand.locator(`[data-hand-card="${d.key}"]`), d.key)
  } else {
    const cdp = await page.context().newCDPSession(page)
    const send = (type: "touchStart" | "touchMove" | "touchEnd", point?: { readonly x: number; readonly y: number }) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point === undefined ? [] : [{ x: point.x, y: point.y }] })
    const swipe = async (from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }) => {
      for (let step = 1; step <= 10; step++) {
        await send("touchMove", { x: from.x + ((to.x - from.x) * step) / 10, y: from.y })
        await page.waitForTimeout(16)
      }
    }
    try {
      // A finger on card a lifts it; swiping to card c lifts c (by the resting places); release after the swipe: nothing.
      await send("touchStart", a)
      await waitLifted(a.key)
      check((await lifted()) === a.key, `${label}: a finger on card ${a.key} lifted ${await lifted()}`)
      await swipe(a, c)
      await waitLifted(c.key)
      check((await lifted()) === c.key, `${label}: swiping to card ${c.key} lifted ${await lifted()}`)
      results["swipe"] = await standsOut(hand.locator(`[data-hand-card="${c.key}"]`), c.key)
      await shot("-lifted")
      await send("touchEnd")
      await page.waitForTimeout(500)
      check((await view.count()) === 0 && (await harnessTaps(page)).length === 0 && (await lifted()) === null, `${label}: releasing after a swipe looked, tapped or kept a card lifted`)
      // A tap without moving: the lifted card's primary activation (the mulligan: its view), its focus given back to it.
      await send("touchStart", b)
      await page.waitForTimeout(60)
      await send("touchEnd")
      await view.waitFor()
      await closeCardView(page)
      const tapped = await page.evaluate(() => document.activeElement?.closest("[data-hand-card]")?.getAttribute("data-hand-card") ?? null)
      check(tapped === b.key, `${label}: tapping card ${b.key} opened the view of ${tapped}`)
      // A long press without a swipe looks at the lifted card.
      await send("touchStart", d)
      await page.waitForTimeout(900)
      await send("touchEnd")
      await view.waitFor()
      await closeCardView(page)
      const pressed = await page.evaluate(() => document.activeElement?.closest("[data-hand-card]")?.getAttribute("data-hand-card") ?? null)
      check(pressed === d.key, `${label}: a long press on card ${d.key} opened the view of ${pressed}`)
      // A swipe, then holding still: nothing.
      await page.waitForTimeout(ARMED_AFTER_MS)
      await send("touchStart", a)
      await swipe(a, b)
      await page.waitForTimeout(900)
      await send("touchEnd")
      await page.waitForTimeout(500)
      check((await view.count()) === 0, `${label}: a swipe held still opened a view`)
    } finally {
      await cdp.detach()
    }
  }
  check((await harnessTaps(page)).length === 0, `${label}: the hand's gestures tapped ${JSON.stringify(await harnessTaps(page))}`)
  return results
}

/**
 * Dragging hand cards onto the battlefield in real Chrome (prompt 46), on the recorded scene "respond" (the AI's spell on
 * the stack, four instants Forge marks playable), with the harness recording taps:
 *  - a playable card pressed where it is its own, moved up out of the hand (a thumb through Chrome's touch input, or the
 *    mouse pressed and moved) and over your battlefield: the battlefields glow (`data-hand-drop`), the card's picture
 *    stands whole inside the window at a full card's size, the card itself stays faint in the hand; let go there, the
 *    harness records exactly one tap - and no card view opens;
 *  - the AI's battlefield and the middle are reachable too (they glow), and a card taken back into the hand, Escape
 *    (mouse) or a second finger (touch) send nothing;
 *  - on the phone (412 × 915) the drag's long tasks with 4× CPU throttling, read on the dev server (the budget is checked
 *    on the production build: readiness `phone --cpu-throttle 4`).
 * A screenshot of the drag over the battlefield at every size.
 */
async function handDrag(page: Page, label: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const playable = page.locator('[data-area="hand"] button[data-slot="game-card"][data-mark="usable"]')
  await playable.first().waitFor()
  const ids = (await playable.evaluateAll((cards) => cards.map((card) => card.getAttribute("data-card") ?? ""))).filter((id) => id !== "")
  check(ids.length >= 3, `${label}: the scene shows ${ids.length} playable hand cards`)
  const centre = async (area: string) => {
    const box = await page.locator(`[data-slot="game-board-area"][data-area="${area}"]`).boundingBox()
    return box === null || box.width < 1 || box.height < 1 ? null : { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const startOf = async (id: string) => {
    const card = page.locator(`[data-area="hand"] button[data-card="${id}"]`)
    const box = (await card.boundingBox())!
    const own = await cardPoint(card)
    return own === undefined ? { x: box.x + box.width / 2, y: box.y + box.height * 0.6 } : { x: box.x + own.x, y: box.y + own.y }
  }
  const cdp = viewport.touch ? await page.context().newCDPSession(page) : null
  const touchPoints = (points: readonly { readonly x: number; readonly y: number }[]) => points.map((point, id) => ({ x: point.x, y: point.y, id }))
  const pointer = {
    down: async (at: { readonly x: number; readonly y: number }) => {
      if (cdp !== null) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPoints([at]) })
      else {
        await page.mouse.move(at.x, at.y)
        await page.mouse.down()
      }
    },
    move: async (from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }, steps = 10) => {
      for (let step = 1; step <= steps; step++) {
        const at = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps }
        if (cdp !== null) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touchPoints([at]) })
        else await page.mouse.move(at.x, at.y)
        await page.waitForTimeout(16)
      }
    },
    up: async () => {
      if (cdp !== null) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      else await page.mouse.up()
    },
  }
  /** Pressed on card `id`, up out of the hand: the point it was lifted to. */
  const lift = async (id: string) => {
    const start = await startOf(id)
    await pointer.down(start)
    await page.waitForTimeout(40)
    const up = { x: start.x, y: start.y - 48 }
    await pointer.move(start, up, 4)
    return { start, up }
  }
  const glow = () => page.evaluate(() => document.querySelector('[data-slot="game-board"]')?.getAttribute("data-hand-drop") ?? null)
  const picture = () =>
    page.evaluate(() => {
      const ghost = document.querySelector<HTMLElement>('[data-slot="table-motion"] .table-hand-drag')
      if (ghost === null) return null
      const box = ghost.getBoundingClientRect()
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height, named: ghost.querySelector("[data-card], [data-slot], [id], [aria-label]") !== null, hidden: ghost.closest('[aria-hidden="true"]') !== null }
    })
  const results: Record<string, unknown> = {}
  try {
    // 1. Over your battlefield: the glow, the whole picture, the card faint in the hand; let go: one tap.
    const field = (await centre("field"))!
    const throttled = viewport.name === "phone" && viewport.width === 412 && viewport.height === 915
    let perf: CDPSession | null = null
    if (throttled) {
      perf = await page.context().newCDPSession(page)
      await perf.send("Emulation.setCPUThrottlingRate", { rate: 4 })
      await page.evaluate(() => {
        const tasks: number[] = []
        ;(window as unknown as { __openmanaLongTasks: number[] }).__openmanaLongTasks = tasks
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) tasks.push(entry.duration)
        }).observe({ type: "longtask" })
      })
    }
    const first = ids[0]!
    const { up } = await lift(first)
    await pointer.move(up, field)
    const over = await glow()
    const shown = await picture()
    const faint = await page.locator(`[data-hand-card="${first}"]`).getAttribute("data-dragging")
    const fullCard = await page.evaluate(() => {
      const hand = document.querySelector<HTMLElement>(".table-hand")
      return hand === null ? 0 : Number.parseFloat(getComputedStyle(hand).getPropertyValue("--hand-card-w")) || 0
    })
    check(over === "over", `${label}: over your battlefield the board says ${over}`)
    check(
      shown !== null && !shown.named && shown.hidden && shown.left >= -1 && shown.top >= -1 && shown.right <= viewport.width + 1 && shown.bottom <= viewport.height + 1 && shown.width >= Math.max(44, fullCard - 1),
      `${label}: the dragged card's picture ${JSON.stringify({ shown, fullCard })}`,
    )
    check(faint !== null, `${label}: the dragged card is not faint in the hand`)
    await page.screenshot({ path: path.join(reportDir, "screens", `table-${viewport.name}-drag.png`) })
    await pointer.up()
    await page.waitForTimeout(400)
    if (perf !== null) {
      const tasks = await page.evaluate(() => (window as unknown as { __openmanaLongTasks?: number[] }).__openmanaLongTasks ?? [])
      await perf.send("Emulation.setCPUThrottlingRate", { rate: 1 })
      await perf.detach()
      // On the dev server (React's development build) this is a reading, as the motion's and the surface's here; the
      // budget - no long task over 200 ms - is checked on the production build in a real game (readiness
      // `phone --cpu-throttle 4`, whose player drags in some of its turns).
      results["throttle"] = { rate: 4, server: "dev", longTasks: tasks.map(Math.round), longestMs: Math.round(Math.max(0, ...tasks)) }
      log(`    dragging at 4x CPU, 412x915 (dev server): long tasks ${JSON.stringify(tasks.map(Math.round))}`)
    }
    const taps = await harnessTaps(page)
    check(JSON.stringify(taps) === JSON.stringify([Number(first)]), `${label}: dropping card ${first} on the battlefield tapped ${JSON.stringify(taps)}`)
    check((await page.getByRole("dialog").count()) === 0, `${label}: the drop opened a view`)
    await page.waitForFunction(() => document.querySelector('[data-slot="game-board"]')?.hasAttribute("data-hand-drag") === false, undefined, { timeout: 3000 }).catch(() => undefined)
    results["drop"] = { card: first, glow: over, picture: shown, taps }

    // 2. The AI's battlefield and the middle glow too; taken back into the hand, nothing is sent.
    const second = ids[1]!
    const reach: Record<string, string | null> = {}
    const back = await lift(second)
    let at = back.up
    for (const area of ["opponent-field", "center"]) {
      const target = await centre(area)
      if (target === null) {
        reach[area] = "hidden"
        continue
      }
      await pointer.move(at, target)
      at = target
      reach[area] = await glow()
      check(reach[area] === "over", `${label}: over ${area} the board says ${reach[area]}`)
    }
    await pointer.move(at, back.start)
    reach["hand"] = await glow()
    check(reach["hand"] === null, `${label}: back over the hand the board still glows`)
    await pointer.up()
    await page.waitForTimeout(400)
    check((await harnessTaps(page)).length === 1, `${label}: a card taken back into the hand tapped ${JSON.stringify(await harnessTaps(page))}`)
    results["reach"] = reach

    // 3. Escape (mouse) or a second finger (touch) while over the battlefield: nothing is sent.
    const third = ids[2]!
    const cancelled = await lift(third)
    await pointer.move(cancelled.up, field)
    if (cdp !== null) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPoints([field, cancelled.start]) })
      await page.waitForTimeout(60)
    } else await page.keyboard.press("Escape")
    const afterCancel = { glow: await glow(), picture: await picture() }
    await pointer.up()
    await page.waitForTimeout(400)
    check(afterCancel.glow === null && (await harnessTaps(page)).length === 1 && (await page.getByRole("dialog").count()) === 0, `${label}: ${cdp !== null ? "a second finger" : "Escape"} while dragging ${JSON.stringify({ afterCancel, taps: await harnessTaps(page) })}`)
    results["cancel"] = { by: cdp !== null ? "second finger" : "Escape", ...afterCancel }
  } finally {
    await cdp?.detach()
  }
  return results
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

/** The card view's arrangement on a screen of this size (prompt 47): the card on top in hoch, beside its boxes in quadrat and breit. */
function cardViewArrangement(width: number, height: number): "stacked" | "beside" {
  return tableLayoutOf(width, height) === "hoch" ? "stacked" : "beside"
}

/** The card view's picture before prompt 47 (a Sheet): 8 rem wide, 11 rem from 640 px. The full screen view is never smaller. */
function cardViewBefore(width: number): number {
  return width >= 640 ? 176 : 128
}

interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5
const inside = (a: Rect, width: number, height: number) => a.x >= -0.5 && a.y >= -0.5 && a.x + a.width <= width + 0.5 && a.y + a.height <= height + 0.5

/**
 * The open card view in full screen (prompt 47), measured: the darkening over the whole screen, the card whole and
 * at least as large as the Sheet's picture was, in the card's proportions; the boxes beside it (quadrat, breit) or
 * below it (hoch), readable, never on the card; Forge's button under the card or the boxes, never on the card, on
 * screen; the close button on screen and off the card.
 */
async function cardViewFacts(page: Page, label: string, viewport: { readonly width: number; readonly height: number }, expect: { readonly boxes: readonly string[]; readonly offer: boolean }): Promise<Record<string, unknown>> {
  const view = page.locator('[data-slot="card-view"]')
  await view.waitFor()
  await animationsDone(view)
  await page.waitForFunction(() => {
    const picture = document.querySelector('[data-slot="card-view"] [data-slot="card-picture"]')
    return picture !== null && picture.getAttribute("data-state") !== "loading"
  }, undefined, { timeout: 30_000 }).catch(() => undefined)
  const facts = await page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (element === null) return null
      const r = element.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const stage = document.querySelector<HTMLElement>('[data-slot="card-lightbox-stage"]')
    const picture = document.querySelector('[data-slot="card-lightbox-picture"]')
    const list = document.querySelector<HTMLElement>('[data-slot="card-lightbox-boxes"]')
    return {
      arrangement: stage?.dataset["arrangement"] ?? null,
      stageScroll: stage === null ? null : { top: stage.scrollTop, client: stage.clientHeight, total: stage.scrollHeight },
      overlay: rect(document.querySelector('[data-slot="card-lightbox-overlay"]')),
      picture: rect(picture),
      pictureState: picture?.querySelector('[data-slot="card-picture"]')?.getAttribute("data-state") ?? null,
      source: picture?.querySelector("img")?.currentSrc ?? null,
      aside: rect(document.querySelector('[data-slot="card-lightbox-aside"]')),
      boxes: [...document.querySelectorAll('[data-slot="keyword-box"]')].map((box) => ({
        ...rect(box)!,
        name: box.querySelector('[data-slot="card-title"]')?.textContent ?? "",
        lang: box.getAttribute("lang"),
        font: parseFloat(getComputedStyle(box.querySelector('[data-slot="card-description"]') ?? box).fontSize),
      })),
      listScroll: list === null ? null : { top: list.scrollTop, client: list.clientHeight, total: list.scrollHeight },
      offer: rect(document.querySelector('[data-slot="card-view-offer"] button')),
      close: rect(document.querySelector('[data-slot="card-lightbox-close"]')),
      focused: document.activeElement?.getAttribute("role") ?? null,
    }
  })
  const { width, height } = viewport
  const expected = cardViewArrangement(width, height)
  check(facts.arrangement === expected, `${label}: card view arranged "${facts.arrangement}", expected "${expected}"`)
  check(facts.overlay !== null && facts.overlay.x <= 0.5 && facts.overlay.y <= 0.5 && facts.overlay.width >= width - 0.5 && facts.overlay.height >= height - 0.5, `${label}: the darkening does not cover the whole table ${JSON.stringify(facts.overlay)}`)
  const picture = facts.picture
  check(picture !== null && inside(picture, width, height), `${label}: the card is not whole on screen ${JSON.stringify(picture)}`)
  check(picture !== null && Math.abs(picture.height - (picture.width * 88) / 63) <= 2, `${label}: the card is not in its proportions ${JSON.stringify(picture)}`)
  check(picture !== null && picture.width >= cardViewBefore(width), `${label}: the card ${picture?.width}px wide, smaller than the Sheet's ${cardViewBefore(width)}px`)
  check(facts.pictureState === "loaded" || facts.pictureState === "missing", `${label}: the card's picture ${facts.pictureState}`)
  check(facts.focused === "dialog", `${label}: the card view does not hold the focus itself (${facts.focused})`)
  check(facts.boxes.map((box) => box.name).join("|") === expect.boxes.join("|"), `${label}: keyword boxes ${JSON.stringify(facts.boxes.map((box) => box.name))}, expected ${JSON.stringify(expect.boxes)}`)
  for (const box of facts.boxes) {
    check(box.font >= 12, `${label}: the box "${box.name}" in ${box.font}px`)
    check(box.x >= -0.5 && box.x + box.width <= width + 0.5, `${label}: the box "${box.name}" off the screen's width ${JSON.stringify(box)}`)
    check(picture === null || !overlaps(box, picture), `${label}: the box "${box.name}" lies on the card`)
    if (expected === "beside") check(picture === null || box.x >= picture.x + picture.width - 0.5, `${label}: the box "${box.name}" not beside the card`)
    else check(picture === null || box.y >= picture.y + picture.height - 0.5, `${label}: the box "${box.name}" not below the card`)
  }
  // Beside the card the boxes scroll in their column; below it the view scrolls - either way every box can be reached.
  if (expected === "beside" && facts.boxes.length > 0 && facts.listScroll !== null && facts.listScroll.total <= facts.listScroll.client + 1) {
    for (const box of facts.boxes) check(box.y >= -0.5 && box.y + box.height <= height + 0.5, `${label}: the box "${box.name}" off the screen and its column does not scroll`)
  }
  check(expect.offer === (facts.offer !== null), `${label}: Forge's button ${facts.offer === null ? "missing" : "shown"}`)
  if (facts.offer !== null) {
    check(inside(facts.offer, width, height), `${label}: Forge's button off the screen ${JSON.stringify(facts.offer)}`)
    check(picture === null || !overlaps(facts.offer, picture), `${label}: Forge's button lies on the card`)
    if (expected === "stacked") check(picture === null || facts.offer.y >= picture.y + picture.height - 0.5, `${label}: Forge's button not under the card`)
  }
  check(facts.close !== null && inside(facts.close, width, height) && (picture === null || !overlaps(facts.close, picture)), `${label}: the close button ${JSON.stringify(facts.close)}`)
  return { arrangement: facts.arrangement, card: picture === null ? null : { width: Math.round(picture.width), height: Math.round(picture.height), before: cardViewBefore(width) }, source: facts.source, boxes: facts.boxes.map((box) => box.name), offer: facts.offer !== null }
}

/** Waits until no dialog is open (the card view closed). */
async function viewClosed(page: Page): Promise<boolean> {
  return page.waitForFunction(() => document.querySelector('[role="dialog"]') === null, undefined, { timeout: 5000 }).then(() => true, () => false)
}

/**
 * The card view in full screen in real Chrome (prompt 47), on recorded scenes with Forge's real keywords:
 *  - respond: Geborstener Blitz (Forge: Kicker {4}) opened by a long press (touch) or a right click (mouse) - one box
 *    "Bonus {4}" and Forge's button; its picture, axe; the button pressed right after the view appeared taps nothing
 *    (the double tap's guard), pressed later it plays the card (exactly one tap) and closes the view;
 *  - respond: Schock (no keyword) - no boxes; closed with Escape;
 *  - a card with several keywords (built: Forge's real keyword forms on a creature card, presentation=keywords),
 *    one of them a form OpenMana says only in general (Forge's words beside it, marked English) - measured, axe;
 *    a press on the darkened table right after it opened does not close it, a later one does;
 *  - the close button (X) closes and the focus returns to the card.
 * Each layout: whole card, at least as large as before, boxes beside or below, never on the card (cardViewFacts).
 */
async function cardViewer(open: (scene: string, query?: string) => Promise<Page>, label: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  const shot = async (page: Page, name: string) => page.screenshot({ path: path.join(reportDir, "screens", `card-view-${viewport.name}-${name}.png`) })

  // A real card with Forge's keyword and Forge's offer: looked at by a long press or a right click.
  let page = await open("respond")
  const blast = page.locator('button[data-card="26"]')
  const position = await cardPoint(blast)
  if (viewport.touch) await touch(page, blast, { holdMs: 900 })
  else await blast.click({ button: "right", ...(position === undefined ? {} : { position }) })
  results["keyword"] = await cardViewFacts(page, `${label}: Geborstener Blitz`, viewport, { boxes: ["Bonus {4}"], offer: true })
  results["keywordAxe"] = await accessibility(page, `${label}: card view with a keyword`)
  await shot(page, "keyword")
  check((await harnessTaps(page)).length === 0, `${label}: looking at Geborstener Blitz tapped it`)
  // The offer: armed - pressed right after the view appeared it taps nothing, later exactly once, and the view closes.
  await page.keyboard.press("Escape")
  check(await viewClosed(page), `${label}: Escape did not close the card view`)
  await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('button[data-card="26"]')!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    ;[...document.querySelectorAll<HTMLButtonElement>('[data-slot="card-view-offer"] button')].find((button) => button.textContent === "Einen Zauberspruch sprechen")!.click()
  })
  check((await harnessTaps(page)).length === 0, `${label}: the card view's button tapped right after it appeared`)
  await page.waitForTimeout(ARMED_AFTER_MS)
  const offer = page.locator('[data-slot="card-view-offer"]').getByRole("button", { name: "Einen Zauberspruch sprechen", exact: true })
  if (viewport.touch) await offer.tap()
  else await offer.click()
  check(await viewClosed(page), `${label}: the card view stayed open after Forge's button`)
  const played = await harnessTaps(page)
  check(played.join() === "26", `${label}: Forge's button tapped ${JSON.stringify(played)}`)
  results["played"] = played
  await page.close()

  // A card without keywords: no boxes, no line about them; Escape closes.
  page = await open("respond")
  const shock = page.locator('button[data-card="29"]')
  const shockAt = await cardPoint(shock)
  if (viewport.touch) await touch(page, shock, { holdMs: 900 })
  else await shock.click({ button: "right", ...(shockAt === undefined ? {} : { position: shockAt }) })
  results["plain"] = await cardViewFacts(page, `${label}: Schock`, viewport, { boxes: [], offer: true })
  check(!((await page.locator('[data-slot="card-view"]').textContent()) ?? "").includes("Schlüsselw"), `${label}: a card without keywords speaks of keywords`)
  await shot(page, "plain")
  await page.keyboard.press("Escape")
  check(await viewClosed(page), `${label}: Escape did not close the card view`)
  check((await harnessTaps(page)).length === 0, `${label}: looking at Schock tapped it`)
  await page.close()

  // Several keywords (built from Forge's real keyword forms): measured; the darkening closes it, not the double tap's second press.
  page = await open("respond", "&presentation=keywords")
  const angel = page.locator('button[data-card="26"]')
  const angelAt = await cardPoint(angel)
  if (viewport.touch) await touch(page, angel, { holdMs: 900 })
  else await angel.click({ button: "right", ...(angelAt === undefined ? {} : { position: angelAt }) })
  results["keywords"] = await cardViewFacts(page, `${label}: several keywords (built)`, viewport, { boxes: ["Fliegend", "Wachsamkeit", "Schutz vor Rot", "Abwehr"], offer: true })
  results["keywordsAxe"] = await accessibility(page, `${label}: card view with several keywords (built)`)
  const english = await page.locator('[data-slot="keyword-box"] [lang="en"]').allTextContents()
  check(english.join("|") === "Ward—Pay 2 life.", `${label}: Forge's own words beside the general explanation ${JSON.stringify(english)}`)
  await shot(page, "keywords")
  // A free point of the darkening: left of the card, half way down (the stage keeps 16 px there).
  const free = { x: 6, y: Math.round(viewport.height / 2) }
  await page.keyboard.press("Escape")
  await viewClosed(page)
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('button[data-card="26"]')!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })))
  await page.locator('[data-slot="card-view"]').waitFor()
  if (viewport.touch) await page.touchscreen.tap(free.x, free.y)
  else await page.mouse.click(free.x, free.y)
  check((await page.getByRole("dialog").count()) === 1, `${label}: the double tap's second press on the darkening closed the view`)
  await page.waitForTimeout(ARMED_AFTER_MS)
  if (viewport.touch) await page.touchscreen.tap(free.x, free.y)
  else await page.mouse.click(free.x, free.y)
  check(await viewClosed(page), `${label}: a press on the darkened table did not close the card view`)
  // The close button, and the focus back on the card.
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('button[data-card="26"]')!.focus())
  await page.keyboard.press("Enter")
  await page.locator('[data-slot="card-view"]').waitFor()
  const close = page.locator('[data-slot="card-lightbox-close"]')
  const closeHeight = await layoutHeight(close)
  if (viewport.touch) check(closeHeight >= 44, `${label}: the close button ${closeHeight}px high`)
  if (viewport.touch) await close.tap()
  else await close.click()
  check(await viewClosed(page), `${label}: the close button did not close the card view`)
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-card") === "26", undefined, { timeout: 2000 }).catch(() => undefined)
  check((await page.evaluate(() => document.activeElement?.getAttribute("data-card"))) === "26", `${label}: the focus did not return to the card`)
  check((await harnessTaps(page)).length === 0, `${label}: looking at the built card tapped it`)
  results["closing"] = { escape: true, darkening: true, closeButton: true, closeHeight, backGesture: "CloseWatcher - checked in the unit test (card-view.test.tsx); Chrome on a desktop has no back gesture" }
  await page.close()
  return results
}

async function closeCardView(page: Page): Promise<void> {
  await page.keyboard.press("Escape")
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null)
}

/** Prompt 23: actual help Sheet, scroll/footer, focus and no accepted game input. */
async function helpInteractions(page: Page, label: string, viewport: Viewport, live = false): Promise<Record<string, unknown>> {
  const beforeQuestion = await page.locator('[data-slot="game-decision"]').getAttribute("data-question")
  const before = live ? (await dumpDatabase(page))["matchLog"] : null
  const trigger = page.getByRole("button", { name: "Hilfe am Spieltisch", exact: true })
  await trigger.click()
  const sheet = page.getByRole("dialog", { name: "Hilfe am Spieltisch", exact: true })
  await sheet.waitFor()
  check(await sheet.getByText("Aktuelle Entscheidung", { exact: true }).count() === 1, `${label}: contextual decision missing`)
  const region = sheet.getByRole("region", { name: "Spielhilfe" })
  const text = await region.textContent()
  for (const term of ["Priorität", "Stapel", "Ziel und Quelle", "Getappt", "Einsatzverzögerung", "Mulligan", "Mana und Kosten"]) check(await sheet.getByText(term, { exact: true }).count() === 1, `${label}: missing terminology ${term}`)
  const axe = await accessibility(page, `${label}: help`)
  await page.screenshot({ path: path.join(reportDir, "screens", `help-context-${label.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`) })
  const close = sheet.getByRole("button", { name: "Schließen", exact: true })
  const box = await close.boundingBox()
  check(box !== null && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${label}: help footer outside screen`)
  await region.evaluate((node) => { node.scrollTop = node.scrollHeight })
  const scroll = await region.evaluate((node) => ({ top: node.scrollTop, height: node.clientHeight, total: node.scrollHeight }))
  check(scroll.total <= scroll.height || scroll.top > 0, `${label}: help cannot scroll`)
  await page.screenshot({ path: path.join(reportDir, "screens", `help-${label.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`) })
  await close.click()
  await sheet.waitFor({ state: "hidden" })
  check(await trigger.evaluate((node) => document.activeElement === node), `${label}: help focus not restored`)
  check(await page.locator('[data-slot="game-decision"]').getAttribute("data-question") === beforeQuestion, `${label}: help changed the pending question`)
  const touchTarget = await layoutHeight(trigger)
  if (viewport.touch) check(touchTarget >= 44, `${label}: help trigger only ${touchTarget}px`)
  let noInput: boolean
  if (live) {
    const after = (await dumpDatabase(page))["matchLog"]
    noInput = JSON.stringify(before) === JSON.stringify(after)
  } else {
    noInput = await page.evaluate(() => {
      const recorder = window as unknown as { __openmanaTaps?: unknown[]; __openmanaAnswers?: unknown[]; __openmanaPlayerTaps?: unknown[]; __openmanaMana?: unknown[] }
      return [recorder.__openmanaTaps, recorder.__openmanaAnswers, recorder.__openmanaPlayerTaps, recorder.__openmanaMana].every((values) => values === undefined || values.length === 0)
    })
  }
  check(noInput, `${label}: help sent game input`)
  return { context: text, beforeQuestion, noInput, live, axe, scroll, touchTarget, footer: box }
}

/** Real recorded Forge logs, checked byte-for-byte, with current source inspection. */
async function historyInteractions(parent: Page, base: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const page = await parent.context().newPage()
  const pageLog = watch(page)
  try {
    const label = `history (${viewport.name})`
    await page.goto(new URL("/scripts/e2e/table-harness.html?scene=main-phase", base).href, { waitUntil: "domcontentloaded" })
    await page.locator('[data-harness="table"]').waitFor({ timeout: 300_000 })
    const trigger = page.getByRole("button", { name: "Spielverlauf ansehen" })
    await trigger.click()
    const sheet = page.getByRole("dialog", { name: "Spielverlauf", exact: true })
    await sheet.waitFor()
    const recording = JSON.parse(fs.readFileSync(path.join(root, "src/test/fixtures/table-scenes.json"), "utf8")) as { scenes: { name: string; history: { text: string | null; actor?: string; kind: string; card?: number }[] }[] }
    const expected = recording.scenes.find((scene) => scene.name === "main-phase")!.history
    check(expected.length > 20, `${label}: a real long log was not recorded`)
    const rows = sheet.locator("[data-history-entry]")
    const texts = await rows.locator('[data-slot="item-description"]').allTextContents()
    check(JSON.stringify(texts) === JSON.stringify(expected.map((entry) => entry.text === null || entry.text.trim() === "" ? "Forge liefert für diesen Eintrag keinen Text." : entry.text)), `${label}: the full chronological Forge texts differ`)
    const titleTexts = await rows.locator('[data-slot="item-title"]').allTextContents()
    check(titleTexts.every((text, i) => text.startsWith(expected[i]!.actor === "me" ? "Du" : expected[i]!.actor === "opponent" ? "Forge-KI" : "Nicht zugeordnet")), `${label}: actors differ from structured log data`)
    const axe = await accessibility(page, label)
    const jump = sheet.getByRole("button", { name: "Neueste Einträge" })
    await jump.click()
    const close = sheet.getByRole("button", { name: "Schließen", exact: true })
    const box = await close.boundingBox()
    check(box !== null && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${label}: close button outside the screen`)
    const scroll = await sheet.locator("[data-history-scroll]").evaluate((node) => ({ top: node.scrollTop, height: node.clientHeight, total: node.scrollHeight }))
    check(scroll.top > 0 && scroll.total > scroll.height, `${label}: the long log did not scroll to latest entries`)
    await page.screenshot({ path: path.join(reportDir, "screens", `history-${viewport.name}.png`) })
    const source = sheet.locator("[data-history-card]").first()
    check(await source.count() === 1, `${label}: no resolvable source card`)
    const sourceName = await source.textContent()
    await source.click()
    const card = page.getByRole("dialog").last()
    await card.waitFor()
    check(await card.getByRole("button", { name: /Spiele|Aktiviere/ }).count() === 0, `${label}: history inspection offers game input`)
    const cardAxe = await accessibility(page, `${label}: source card`)
    await card.getByRole("button", { name: "Schließen", exact: true }).click()
    await sheet.waitFor()
    check(await source.evaluate((node) => node === document.activeElement), `${label}: source focus not restored`)
    const inputs = await page.evaluate(() => { const recorder = window as unknown as { __openmanaTaps?: unknown[]; __openmanaAnswers?: unknown[]; __openmanaPlayerTaps?: unknown[]; __openmanaMana?: unknown[] }; return { taps: recorder.__openmanaTaps ?? [], answers: recorder.__openmanaAnswers ?? [], players: recorder.__openmanaPlayerTaps ?? [], mana: recorder.__openmanaMana ?? [] } })
    check(Object.values(inputs).every((values) => values.length === 0), `${label}: history inspection sent input ${JSON.stringify(inputs)}`)
    await close.click()
    await sheet.waitFor({ state: "hidden" })
    check(await trigger.evaluate((node) => node === document.activeElement), `${label}: trigger focus not restored`)
    const touchTarget = await layoutHeight(trigger)
    if (viewport.touch) check(touchTarget >= 44, `${label}: history trigger is only ${touchTarget}px high`)
    return { entries: expected.length, rawTextsEqual: true, sourceName, scroll, axe, cardAxe, inputs, touchTarget }
  } finally {
    for (const error of pageLog.errors) check(false, `history (${viewport.name}): ${error}`)
    await page.close()
  }
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
async function tableInteractions(parent: Page, base: string, viewport: Viewport): Promise<Record<string, unknown>> {
  let page = await parent.context().newPage()
  let sceneLog: PageLog | null = null
  const sceneErrors = () => { for (const error of sceneLog?.errors ?? []) check(false, `game table (${viewport.name}): ${error}`) }
  const scene = async (name: string, query = "") => {
    sceneErrors()
    await page.close()
    page = await parent.context().newPage()
    sceneLog = watch(page)
    await openScene(page, base, name, query)
  }
  try {
    const label = `game table (${viewport.name})`
    const results: Record<string, unknown> = {}
    // The card view in full screen follows the table layout (prompt 47): the card on top in hoch, beside its boxes in quadrat and breit.
    const arrangement = cardViewArrangement(viewport.width, viewport.height)

    // Priority: look first, the view's button taps - armed.
    await scene("main-phase")
    const land = page.locator('button[data-card="25"]')
    if (viewport.touch) await land.tap()
    else await land.click()
    const view = page.getByRole("dialog", { name: "Gebirge" })
    await view.waitFor()
    const side = await page.locator('[data-slot="card-lightbox-stage"]').getAttribute("data-arrangement")
    check(side === arrangement, `${label}: the card view arranged "${side}", expected "${arrangement}"`)
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

    // A fold/rotation with an open viewer keeps the current ID and focus,
    // and only arranges the view anew. Inspection never becomes a card tap.
    await scene("main-phase")
    await page.locator('button[data-card="25"]').click()
    await page.getByRole("dialog", { name: "Gebirge" }).waitFor()
    const resized: unknown[] = []
    // The foldable closed and opened (prompt 38: bottom in hoch, right in quadrat), then turned, then back.
    for (const size of [FOLD_VIEWPORTS[0]!, FOLD_VIEWPORTS[1]!, RESPONSIVE_VIEWPORTS[4]!, viewport]) {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.waitForTimeout(100)
      const sheet = page.getByRole("dialog", { name: "Gebirge" })
      await animationsDone(sheet)
      const side = await sheet.locator('[data-slot="card-lightbox-stage"]').getAttribute("data-arrangement")
      check(side === cardViewArrangement(size.width, size.height), `${label}: resized card view arranged "${side}"`)
      const card = await sheet.locator('[data-slot="card-lightbox-picture"]').boundingBox()
      check(card !== null && inside(card, size.width, size.height) && card.width >= cardViewBefore(size.width), `${label}: resized card view's card ${JSON.stringify(card)}`)
      check(await sheet.evaluate((node) => node.contains(document.activeElement)), `${label}: resized viewer lost focus`)
      const close = sheet.getByRole("button", { name: "Schließen", exact: true })
      const box = await close.boundingBox()
      check(box !== null && box.y >= 0 && box.y + box.height <= size.height + 1, `${label}: resized viewer footer outside viewport`)
      check((await harnessTaps(page)).length === 0 && (await harnessAnswers(page)).length === 0, `${label}: viewer resize sent game input`)
      resized.push({ size: size.name, side, footer: box })
    }
    await closeCardView(page)
    check(await page.locator('button[data-card="25"]').evaluate((node) => document.activeElement === node), `${label}: resized viewer did not restore card focus`)
    results["viewerResize"] = resized

    // The stack (prompt 16): a card on it opens the card view - where it is, how far from the top -, to look at, never to tap.
    await scene("respond-own")
    const lower = page.locator("[data-stack-item]").nth(1).locator("button[data-stack-card]")
    const lowerName = ((await lower.getAttribute("aria-label")) ?? "").replace(/ ansehen$/, "")
    if (viewport.touch) await lower.tap()
    else await lower.click()
    const stackView = page.getByRole("dialog", { name: lowerName })
    await stackView.waitFor()
    const onStack = ((await stackView.getByRole("region", { name: "Auf dem Stapel" }).textContent()) ?? "").trim()
    check(onStack.startsWith("Auf dem Stapel: Zauberspruch von der Forge-KI – 1 Eintrag liegt darüber."), `${label}: the stack card's view says "${onStack}"`)
    const stackButtons = await stackView.getByRole("button").allTextContents()
    check(stackButtons.join() === "Schließen", `${label}: the view of a card on the stack offers ${JSON.stringify(stackButtons)}`)
    await animationsDone(stackView)
    results["stackViewAxe"] = await accessibility(page, `${label}: card view of a card on the stack`)
    await closeCardView(page)
    check((await harnessTaps(page)).length === 0 && (await harnessAnswers(page)).length === 0, `${label}: looking at a card on the stack sent something`)
    const stackCard = await layoutHeight(lower)
    results["stack"] = { card: lowerName, view: onStack, height: stackCard }

    // The card view in full screen (prompt 47): real keywords, Forge's button, several keywords (built), every way to close.
    results["viewer"] = await cardViewer(async (name, query = "") => {
      sceneErrors()
      sceneLog = null
      const viewerPage = await parent.context().newPage()
      sceneLog = watch(viewerPage)
      await openScene(viewerPage, base, name, query)
      return viewerPage
    }, `${label}, card view`, viewport)

    // Blocking: a tap acts at once (a double one once); a right click or long press looks.
    await scene("defend")
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
      await scene("commander-late")
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
      await scene("opening")
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

    // The fanned hand (prompt 42): lifting by mouse, thumb and keyboard; a tap is the lifted card's, a swipe nothing, a long press looks.
    await scene("opening", `&hand=${FAN_CARDS}`)
    results["hand"] = { facts: await handFacts(page, `${label}, hand of ${FAN_CARDS}`), gestures: await handGestures(page, `${label}, hand of ${FAN_CARDS}`, viewport) }
    // Dragging hand cards onto the battlefield (prompt 46).
    await scene("respond")
    results["drag"] = await handDrag(page, `${label}, dragging`, viewport)
    return results
  } finally {
    sceneErrors()
    await page.close()
  }
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
      smallestWidth: buttons.length === 0 ? null : Math.min(...buttons.map((element) => target(element).offsetWidth)),
      window: { width: window.innerWidth, height: window.innerHeight },
    }
  })
  if (info === null) return null
  if (info.actions !== null) check(info.actions.top >= 0 && info.actions.bottom <= info.window.height + 1, `${label}: the decision's buttons outside the window ${JSON.stringify(info.actions)}`)
  check(info.scroll.width <= info.scroll.clientWidth + 1, `${label}: the decision is wider than its region ${JSON.stringify(info.scroll)}`)
  if (viewport.touch && info.smallest !== null) check(info.smallest >= 44, `${label}: a control of the decision ${info.smallest}px high`)
  if (viewport.touch && info.smallestWidth !== null) check(info.smallestWidth >= 44, `${label}: a control of the decision ${info.smallestWidth}px wide`)
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
  let decision = page.getByRole("region", { name: "Entscheidung" })
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
  const context = page.context()
  let sceneLog: PageLog | null = null
  const sceneErrors = () => { for (const error of sceneLog?.errors ?? []) check(false, `${label}: ${error}`) }
  const scene = async (name: string, built?: string) => {
    // Like the layout scenes, each decision uses a fresh page. Repeated Vite
    // module loads in one renderer can fail with ERR_INSUFFICIENT_RESOURCES.
    sceneErrors()
    await page.close()
    page = await context.newPage()
    sceneLog = watch(page)
    decision = page.getByRole("region", { name: "Entscheidung" })
    await openScene(page, base, name, built ? `&built=${built}` : "")
  }
  const button = (name: string) => decision.getByRole("button", { name, exact: true })

  try {
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

    await scene("main-phase", "input")
    await armed(button("Abbrechen"))
    await expectLast("input cancelled (built)", { kind: "input", value: null })

    await scene("main-phase", "arrange-anywhere")
    const positions = decision.getByRole("textbox", { name: /^Position von / })
    await positions.nth(0).fill("8")
    await positions.nth(1).fill("8")
    check(await button("Bestätigen").isDisabled(), `${label}: duplicate library slots accepted`)
    await positions.nth(1).fill("2")
    await armed(button("Bestätigen"))
    await expectLast("arbitrary library positions (built)", { kind: "arrange", top: [], bottom: [], positions: [8, 2] })

    await scene("main-phase", "distribute-limits")
    await activate(button("Bei Verteidiger einen mehr"))
    check(await button("Bestätigen").isDisabled(), `${label}: unmet distribution prerequisite accepted`)
    await activate(button("Bei Blocker einen mehr"))
    await activate(button("Bei Blocker einen mehr"))
    check(await button("Bei Blocker einen mehr").isDisabled(), `${label}: distribution cap ignored`)
    await armed(button("Bestätigen"))
    await expectLast("distribution limits (built)", { kind: "distribute", amounts: [2, 1] })

    await scene("main-phase", "distribute-limits")
    await armed(button("Später zuweisen"))
    await expectLast("postpone combat assignment (built)", { kind: "distribute", amounts: [], skip: true })

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

    // Targets and payment (prompt 17): the players Forge takes - in the region and on their seat -, floating mana, life for mana; each at once, a double tap once.
    const playerTaps = async (name: string, element: Locator, times = 1) => {
      const id = Number(await element.getAttribute("data-player-choice") ?? await element.getAttribute("data-player"))
      for (let i = 0; i < times; i++) await activate(element)
      await page.waitForFunction(() => ((window as unknown as { __openmanaPlayerTaps?: unknown[] }).__openmanaPlayerTaps ?? []).length > 0, null, { timeout: 5000 }).catch(() => undefined)
      const taps = await harnessPlayerTaps(page)
      check(taps.length === 1 && taps[0] === id, `${label}: ${name} tapped ${JSON.stringify(taps)}, expected [${id}]`)
      check((await harnessAnswers(page)).length === 0 && (await harnessTaps(page)).length === 0, `${label}: ${name} sent an answer or a card tap`)
      results[name] = taps
    }
    await scene("target-player")
    await playerTaps("a player as target (region)", decision.locator("[data-player-choice]").first())
    await scene("target-both")
    await playerTaps("a player as target (seat, double tap once)", page.locator('button[data-slot="game-player"][data-player]').first(), 2)
    await scene("payment-life")
    await playerTaps("life for Phyrexian mana", decision.locator("[data-player-choice]").first())
    await scene("payment-pool")
    const pool = decision.locator("[data-mana]").first()
    const color = await pool.getAttribute("data-mana")
    await activate(pool)
    await page.waitForFunction(() => ((window as unknown as { __openmanaMana?: unknown[] }).__openmanaMana ?? []).length > 0, null, { timeout: 5000 }).catch(() => undefined)
    const mana = await harnessMana(page)
    check(mana.length === 1 && mana[0] === color, `${label}: floating mana paid ${JSON.stringify(mana)}, expected [${color}]`)
    results["floating mana"] = mana

    // Declaring attackers (prompt 18): Forge's buttons by meaning; another defender in the region is Forge's player.tap at once.
    await scene("attack")
    await armed(button("Alle angreifen"))
    await expectLast("attack: Alpha Strike", { kind: "buttons", button: 2 })
    await scene("attack-declared")
    await armed(button("Alle zurück"))
    await expectLast("attack: Call Back", { kind: "buttons", button: 2 })
    await scene("attack-planeswalker")
    const other = decision.locator('button[data-defender^="player:"]').first()
    const defender = Number((await other.getAttribute("data-defender"))?.split(":")[1])
    await activate(other)
    await page.waitForFunction(() => ((window as unknown as { __openmanaPlayerTaps?: unknown[] }).__openmanaPlayerTaps ?? []).length > 0, null, { timeout: 5000 }).catch(() => undefined)
    const defenderTaps = await harnessPlayerTaps(page)
    check(defenderTaps.length === 1 && defenderTaps[0] === defender, `${label}: the other defender tapped ${JSON.stringify(defenderTaps)}, expected [${defender}]`)
    check((await harnessAnswers(page)).length === 0, `${label}: switching the defender answered`)
    results["attack: switch the defender"] = defenderTaps

    // The player's priority (prompt 16): Forge's OK in words for what passing does, End Turn only after asking.
    await scene("main-phase")
    await armed(button("Weiter"))
    await expectLast("priority: pass", { kind: "buttons", button: 1 })

    await scene("respond")
    await armed(button("Verrechnen lassen"))
    await expectLast("priority: let the AI's spell resolve", { kind: "buttons", button: 1 })

    await scene("main-phase")
    await activate(button("Zug beenden …"))
    const endTurn = page.getByRole("alertdialog", { name: "Zug beenden?" })
    await endTurn.waitFor()
    await animationsDone(endTurn)
    results["endTurnAxe"] = await accessibility(page, `${label}: End Turn asks`)
    await activate(endTurn.getByRole("button", { name: "Weiterspielen" }))
    await endTurn.waitFor({ state: "detached" })
    check((await harnessAnswers(page)).length === 0, `${label}: playing on after End Turn answered ${JSON.stringify(await harnessAnswers(page))}`)
    await activate(button("Zug beenden …"))
    await activate(page.getByRole("alertdialog", { name: "Zug beenden?" }).getByRole("button", { name: "Zug beenden", exact: true }))
    await expectLast("priority: end the turn (asked first)", { kind: "buttons", button: 2 })
    check((await harnessTaps(page)).length === 0, `${label}: answering tapped a card`)
    results["blocks"] = await blockInteractions(page, base, viewport)
    results["zones"] = await zoneInteractions(page, base, viewport)
    return results
  } finally {
    sceneErrors()
    await page.close()
  }
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
async function tableHarness(executablePath: string): Promise<Record<string, unknown>> {
  log("Game table (recorded real scenes in the real table, every size)")
  const server = await createServer({ root, configFile: path.join(root, "vite.config.ts"), logLevel: "warn", server: { host: "127.0.0.1", port: 0 } })
  await server.listen()
  const base = server.resolvedUrls?.local[0]
  if (!base) throw new Error("the dev server did not report its URL")
  const results: Record<string, unknown> = {}
  try {
    results["layouts"] = await tableLayoutClasses(executablePath, base)
    if (!focusedTable) results["surface"] = await tableSurface(executablePath, base)
    if (!focusedTable) results["arrows"] = await tableArrows(executablePath, base)
    if (!focusedTable) results["motion"] = await tableMotion(executablePath, base)
    if (!focusedTable) results["folds"] = await tableFoldSizes(executablePath, base)
    for (const viewport of focusedTable ? TABLE_VIEWPORTS.filter((v) => DECISION_VIEWPORTS.includes(v.name)) : TABLE_VIEWPORTS) {
      log(`  ${viewport.name} (${viewport.width}x${viewport.height}${viewport.touch ? ", touch" : ""})`)
      // Bound Chromium's lifetime per viewport: closing pages/contexts alone did
      // not prevent ERR_INSUFFICIENT_RESOURCES after hundreds of dev-module loads.
      // Every scene, interaction and request-error assertion still runs.
      const tableBrowser = await launchBrowser(executablePath)
      const context = await newContext(tableBrowser, viewport)
      const scenes: Record<string, unknown> = {}
      try {
        const selectedScenes = helpOnly ? TABLE_SCENES.filter((scene) => ["opening", "main-phase", "stack", "target", "attack-declared", "block-multiple"].includes(scene)) : historyOnly ? TABLE_SCENES.filter((scene) => ["opening", "main-phase", "stack", "commander-late"].includes(scene)) : zonesOnly ? TABLE_SCENES.filter((scene) => ["opening", "main-phase", "command-effects", "commander-late", "stack", "block-multiple"].includes(scene)) : combatOnly ? TABLE_SCENES.filter((scene) => ["defend", "block-start", "block-multiple", "blockers", "damage", "attack-declared"].includes(scene)) : TABLE_SCENES
        const selectedBuilt = helpOnly ? BUILT_SCENES.filter((built) => ["choose-many", "confirm", "input", "order"].includes(built)) : historyOnly ? [] : zonesOnly ? [] : combatOnly ? BUILT_SCENES.filter((built) => built === "block-order") : BUILT_SCENES
        const runs = [...selectedScenes.map((scene) => ({ scene: scene as string, built: null as string | null })), ...selectedBuilt.map((built) => ({ scene: built === "block-order" ? "block-multiple" : "main-phase", built: built as string | null }))]
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
          // Every card keeps to its row's height; a row with more cards than room scrolls sideways. The fanned hand's cards
          // sink below its edge and rise above it (handFacts checks them).
          const rows = await page.evaluate(() =>
            [...document.querySelectorAll('[data-slot="game-board-area"] ul:not(.table-hand)')].map((row) => {
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
          const faces = await cardFaces(page, label)
          const hand = await handFacts(page, label)
          const marks = await page.evaluate(() => ({
            usable: document.querySelectorAll('button[data-slot="game-card"][data-mark="usable"]').length,
            selected: document.querySelectorAll('button[data-slot="game-card"][data-mark="selected"]').length,
            // Players Forge takes (prompt 17): their seats on the table (the region repeats them).
            players: document.querySelectorAll('[data-slot="game-player"][data-player][data-mark="usable"], [data-slot="game-player"][data-player][data-mark="selected"]').length,
            targets: document.querySelectorAll('[data-stack-target="true"]').length,
          }))
          const expected = built === null ? SCENE_MARKS[scene as (typeof TABLE_SCENES)[number]] : undefined
          if (expected) {
            check(
              marks.usable === expected.usable && marks.selected === expected.selected && marks.players === (expected.players ?? 0),
              `${label}: marks ${JSON.stringify(marks)}, expected ${JSON.stringify(expected)}`,
            )
          }
          // Independent check against the original recorded target envelopes, never display text.
          if (built === null) {
            const targetRefs = sceneState(scene).stack.flatMap((item) => item.targets)
            const targetCheck = await page.evaluate((refs) => {
              const cards = [...document.querySelectorAll<HTMLElement>('[data-card], [data-stack-card]')]
              const players = [...document.querySelectorAll<HTMLElement>('[data-slot="game-player"][data-player]')]
              const mismatches: string[] = []
              for (const [kind, nodes] of [["card", cards], ["player", players]] as const) for (const node of nodes) {
                const id = Number(kind === "card" ? node.dataset["card"] ?? node.dataset["stackCard"] : node.dataset["player"])
                const expected = refs.some((ref) => ref.kind === kind && ref.id === id)
                if ((node.dataset["stackTarget"] === "true") !== expected) mismatches.push(`${kind}:${id}`)
              }
              return mismatches
            }, targetRefs)
            check(targetCheck.length === 0, `${label}: exact stack target markings differ ${JSON.stringify(targetCheck)}`)
          }
          const surface = await surfaceFacts(page, label)
          const strips = await stripFacts(page, label, viewport.touch)
          const panels = await panelFacts(page, label, built === null ? scene : null, built === null ? recordedStackIds(scene) : null)
          const decision = await decisionFits(page, label, viewport)
          const arrows = await arrowFacts(page, label, scene)
          const keyboard = built === null && KEYBOARD_SCENES.includes(scene) ? await tableKeyboardTour(page, label) : null
          const axe = await accessibility(page, label)
          await page.screenshot({ path: path.join(reportDir, "screens", `table-${viewport.name}-${built === null ? scene : `built-${built}`}.png`) })
          const help = helpOnly || ["main-phase", "stack", "built:choose-many", "built:confirm"].includes(name) ? await helpInteractions(page, `${viewport.name}-${name}`, viewport) : null
          scenes[name] = { help, areas: layout["areas"], arrangement: layout["arrangement"], pictures, rows, menu, cards, faces, hand, marks, decision, surface, strips, panels, arrows, keyboard, axe }
          for (const error of pageLog.errors) check(false, `${label}: ${error}`)
          await page.close()
        }
        const page = await context.newPage()
        const pageLog = watch(page)
        scenes["interaction"] = helpOnly ? { scope: "Help interactions checked for every selected recorded/built scene above" } : historyOnly ? await historyInteractions(page, base, viewport) : zonesOnly ? await zoneInteractions(page, base, viewport) : combatOnly ? await blockInteractions(page, base, viewport) : await tableInteractions(page, base, viewport)
        if (!focusedTable) scenes["history"] = await historyInteractions(page, base, viewport)
        if (!focusedTable || zonesOnly) scenes["piles"] = await pileInteractions(page, base, viewport)
        await page.close()
        // Answering every kind (prompt 15) where it is tightest and on the desktop: a small phone, a phone turned, a mouse.
        if (!focusedTable && DECISION_VIEWPORTS.includes(viewport.name)) {
          const answers = await context.newPage()
          const answersLog = watch(answers)
          scenes["decisions"] = await decisionInteractions(answers, base, viewport)
          for (const error of answersLog.errors) check(false, `game decisions (${viewport.name}): ${error}`)
          await answers.close()
        }
        for (const error of pageLog.errors) check(false, `game table (${viewport.name}): ${error}`)
      } finally {
        await context.close()
        await tableBrowser.close()
      }
      results[viewport.name] = scenes
    }
  } finally {
    await server.close()
  }
  return results
}

/**
 * The table's layout classes in real Chrome (prompt 36): the probe page (scripts/e2e/table-layout-probe.html) shows what
 * useTableLayout() answers and carries hoch:order-1 quadrat:order-2 breit:order-3 - so the stylesheet Tailwind compiled
 * names the applied variant. At every size of TABLE_LAYOUT_SIZES the hook, the CSS variant, the browser's own media
 * queries (exactly one matches) and tableLayoutOf() agree with the layout the specification gives the size.
 */
async function tableLayoutClasses(executablePath: string, base: string): Promise<Record<string, unknown>> {
  log("  table layout classes (hoch / quadrat / breit)")
  const probeBrowser = await launchBrowser(executablePath)
  const results: Record<string, unknown> = {}
  try {
    const context = await newContext(probeBrowser, VIEWPORTS[2]!)
    const page = await context.newPage()
    const pageLog = watch(page)
    // The first page of a fresh dev server: Vite pre-bundles the dependencies first, which can take longer than
    // Playwright's 30 s on a busy machine (the table pages wait up to 300 s for the same reason).
    await page.goto(new URL("/scripts/e2e/table-layout-probe.html", base).href, { waitUntil: "domcontentloaded", timeout: 300_000 })
    const probe = page.locator('[data-harness="table-layout"]')
    await probe.waitFor({ timeout: 60_000 })
    const order: Readonly<Record<string, TableLayout>> = { "1": "hoch", "2": "quadrat", "3": "breit" }
    for (const viewport of TABLE_VIEWPORTS) check(TABLE_LAYOUT_SIZES.some(([name, width, height]) => name === viewport.name && width === viewport.width && height === viewport.height), `table layout sizes miss the table size ${viewport.name}`)
    for (const [name, width, height, expected] of TABLE_LAYOUT_SIZES) {
      await page.setViewportSize({ width, height })
      // The hook answers on the media queries' change event, a moment after the resize.
      await page.waitForFunction((layout) => document.querySelector('[data-harness="table-layout"]')?.getAttribute("data-layout") === layout, expected, { timeout: 5_000 }).catch(() => undefined)
      const seen = await page.evaluate(
        ({ layouts, queries }) => {
          const element = document.querySelector('[data-harness="table-layout"]')!
          return {
            window: [window.innerWidth, window.innerHeight],
            hook: element.getAttribute("data-layout"),
            order: getComputedStyle(element).order,
            media: layouts.filter((layout) => window.matchMedia(queries[layout]).matches),
          }
        },
        { layouts: TABLE_LAYOUTS, queries: TABLE_LAYOUT_QUERIES },
      )
      const css = order[seen.order] ?? `order ${seen.order}`
      check(
        seen.window[0] === width && seen.window[1] === height && tableLayoutOf(width, height) === expected && seen.hook === expected && css === expected && seen.media.length === 1 && seen.media[0] === expected,
        `table layout at ${name} (${width}x${height}): expected ${expected}, saw ${JSON.stringify({ ...seen, css, code: tableLayoutOf(width, height) })}`,
      )
      results[name] = { width, height, layout: expected, hook: seen.hook, css, media: seen.media }
    }
    for (const error of pageLog.errors) check(false, `table layout classes: ${error}`)
    await context.close()
  } finally {
    await probeBrowser.close()
  }
  return results
}

/**
 * The table surface (prompt 37, docs/design/SPIELTISCH.md §4.1) as the page shows it: first in the board behind the
 * regions, hidden from screen readers, no pointer events (what a pointer hits on the board is never the surface), the
 * desk drawn 1:1 over the board, the board inside the window, its circle round and the rune ring a square around it.
 */
async function surfaceFacts(page: Page, label: string): Promise<Record<string, unknown>> {
  const facts = await page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>('[data-slot="game-board"] > [data-slot="table-surface"]')
    if (surface === null) return null
    const board = surface.parentElement!
    const area = board.getBoundingClientRect()
    const desk = surface.querySelector<SVGSVGElement>('[data-surface="desk"]')!.getBoundingClientRect()
    const ring = surface.querySelector<HTMLElement>('[data-surface="ring"]')!
    const circle = surface.querySelector('[data-surface="circle"]')?.getBoundingClientRect() ?? null
    const key = (surface.dataset["board"] ?? "").split(" ").map(Number)
    const drawn = key.length >= 6 ? { left: area.left + key[2]!, top: area.top + key[3]!, width: key[4]!, height: key[5]! } : null
    const points = drawn === null ? [] : [[0.5, 0.5], [0.08, 0.08], [0.92, 0.92], [0.5, 0.25], [0.5, 0.75], [0.15, 0.5]].map(([x, y]) => document.elementFromPoint(drawn.left + drawn.width * x!, drawn.top + drawn.height * y!))
    const style = getComputedStyle(surface)
    return {
      first: [...board.children].find((child) => child.tagName !== "TITLE") === surface,
      ariaHidden: surface.getAttribute("aria-hidden"),
      pointerEvents: style.pointerEvents,
      window: [window.innerWidth, window.innerHeight],
      boardSize: [Math.round(area.width), Math.round(area.height)],
      viewBox: surface.querySelector('[data-surface="desk"]')!.getAttribute("viewBox"),
      desk: [desk.width, desk.height],
      drawn,
      circle: circle === null ? null : { width: circle.width, height: circle.height, x: circle.left + circle.width / 2, y: circle.top + circle.height / 2 },
      ring: ring.hidden ? null : { width: ring.offsetWidth, height: ring.offsetHeight, x: area.left + ring.offsetLeft + ring.offsetWidth / 2, y: area.top + ring.offsetTop + ring.offsetHeight / 2 },
      surfaceHit: points.filter((element) => element !== null && surface.contains(element)).length,
      points: points.length,
    }
  })
  check(facts !== null, `${label}: no table surface in the board`)
  if (facts === null) return {}
  const [width, height] = facts.window as [number, number]
  check(facts.first && facts.ariaHidden === "true" && facts.pointerEvents === "none" && facts.surfaceHit === 0, `${label}: the surface is not decoration behind the regions ${JSON.stringify(facts)}`)
  check(facts.viewBox === `0 0 ${facts.boardSize[0]} ${facts.boardSize[1]}` && Math.abs(facts.desk[0]! - facts.boardSize[0]!) <= 1 && Math.abs(facts.desk[1]! - facts.boardSize[1]!) <= 1, `${label}: the desk is not drawn 1:1 over the board ${JSON.stringify(facts)}`)
  check(facts.drawn !== null, `${label}: no board drawn`)
  if (facts.drawn !== null) {
    const { left, top, width: w, height: h } = facts.drawn
    check(left >= 0 && top >= 0 && left + w <= width && top + h <= height, `${label}: the board leaves the window ${JSON.stringify(facts.drawn)}`)
  }
  if (facts.circle !== null) {
    check(Math.abs(facts.circle.width - facts.circle.height) <= 1, `${label}: the circle is not round ${JSON.stringify(facts.circle)}`)
    check(facts.ring !== null && facts.ring.width === facts.ring.height && Math.abs(facts.ring.x - facts.circle.x) <= 1 && Math.abs(facts.ring.y - facts.circle.y) <= 1, `${label}: the rune ring is not a square around the circle ${JSON.stringify(facts)}`)
  }
  return facts
}

/** The recorded game human-3-de in its order: the moments the surface measurement switches between (prompt 37). */
const SURFACE_GAME = ["opening", "target-player", "target-both", "stack", "scry", "yes-no", "choose-mode", "main-phase"] as const

/**
 * The table surface beyond single scenes (prompt 37): round and inside the window at every test size including the
 * foldable's (11 sizes), the ring standing still (since 2026-10-12 also without less motion), and the cost of 20 state changes in Chrome with 4x CPU throttling at 412 x 915: no new drawing of the
 * surface while its sizes stay, each drawing far below 200 ms, and the long tasks with and without the surface (paint
 * included) side by side as the measurement.
 */
async function tableSurface(executablePath: string, base: string): Promise<Record<string, unknown>> {
  log("  table surface (sizes, motion, cost of state changes)")
  const surfaceBrowser = await launchBrowser(executablePath)
  const results: Record<string, unknown> = {}
  try {
    const context = await newContext(surfaceBrowser, VIEWPORTS[0]!)
    const page = await context.newPage()
    const pageLog = watch(page)
    await page.goto(new URL("/scripts/e2e/table-harness.html?scene=main-phase", base).href, { waitUntil: "domcontentloaded", timeout: 300_000 })
    await page.locator('[data-harness="table"]').waitFor({ timeout: 300_000 })
    const sizes: Record<string, unknown> = {}
    for (const [name, width, height] of TABLE_LAYOUT_SIZES.filter(([size]) => !size.startsWith("border"))) {
      await page.setViewportSize({ width, height })
      await page.waitForFunction((prefix) => document.querySelector<HTMLElement>('[data-slot="table-surface"]')?.dataset["board"]?.startsWith(prefix) === true, `${width} ${height} `, { timeout: 10_000 }).catch(() => undefined)
      sizes[name] = await surfaceFacts(page, `table surface (${name} ${width}x${height})`)
    }
    results["sizes"] = sizes
    check(Object.keys(sizes).length === 11, `table surface: ${Object.keys(sizes).length} sizes checked, expected 11`)
    await page.setViewportSize({ width: VIEWPORTS[0]!.width, height: VIEWPORTS[0]!.height })

    // Motion: the ring stands still (project owner, 2026-10-12: its turning and glimmering made the table restless) - nothing of the surface moves, with or without less motion.
    const motion = () => page.evaluate(() => document.getAnimations().filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest('[data-slot="table-surface"]')).map((animation) => ({ name: (animation as CSSAnimation).animationName, duration: animation.effect?.getTiming().duration, state: animation.playState })))
    const moving = await motion()
    check(moving.length === 0, `table surface: something of the surface moves ${JSON.stringify(moving)}`)
    await page.emulateMedia({ reducedMotion: "reduce" })
    const reducedDevice = await motion()
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.evaluate(() => document.documentElement.setAttribute("data-reduced-motion", ""))
    const reducedSetting = await motion()
    await page.evaluate(() => document.documentElement.removeAttribute("data-reduced-motion"))
    check(reducedDevice.length === 0 && reducedSetting.length === 0, `table surface: the ring moves under less motion ${JSON.stringify({ reducedDevice, reducedSetting })}`)
    // Prompt 41: the main button's gloss sweeps across ("Weiter" in main-phase) and stops under less motion, the device's and the player's.
    const gloss = () => page.evaluate(() => document.getAnimations().filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest(".table-main-button")).map((animation) => ({ name: (animation as CSSAnimation).animationName, pseudo: (animation.effect as KeyframeEffect).pseudoElement, state: animation.playState })))
    const glossing = await gloss()
    check(glossing.some((animation) => animation.name === "table-gloss" && animation.pseudo === "::after" && animation.state === "running"), `table surface: the main button has no gloss ${JSON.stringify(glossing)}`)
    await page.emulateMedia({ reducedMotion: "reduce" })
    const glossDevice = await gloss()
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.evaluate(() => document.documentElement.setAttribute("data-reduced-motion", ""))
    const glossSetting = await gloss()
    await page.evaluate(() => document.documentElement.removeAttribute("data-reduced-motion"))
    check(glossDevice.length === 0 && glossSetting.length === 0, `table surface: the main button's gloss moves under less motion ${JSON.stringify({ glossDevice, glossSetting })}`)
    results["motion"] = { moving, reducedDevice, reducedSetting, gloss: { glossing, glossDevice, glossSetting } }

    // Cost: 20 state changes of one recorded game, 4x CPU throttling, the phone's size.
    const step = (name: string) => page.evaluate((scene) => new Promise<string>((resolve) => {
      (window as unknown as { __openmanaShowScene: (name: string) => void }).__openmanaShowScene(scene)
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => resolve(document.querySelector<HTMLElement>('[data-slot="table-surface"]')?.dataset["board"] ?? ""), 50)))
    }), name)
    for (const name of SURFACE_GAME) await step(name)
    const cdp = await context.newCDPSession(page)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
    const run = async (surface: boolean) => {
      await page.evaluate((shown) => {
        document.querySelector<HTMLElement>('[data-slot="table-surface"]')!.style.display = shown ? "" : "none"
        const w = window as unknown as { __longTasks: number[]; __frames: number[][]; __surfaceDraws: number[]; __arrowDraws: number[]; __observer?: PerformanceObserver; __deskDrawing: Element | null }
        // The desk's drawing before the changes: the screen keeps its size, so the very same drawing must stay.
        w.__deskDrawing = document.querySelector('[data-slot="table-surface"] [data-surface="desk"]')!.firstElementChild
        w.__observer?.disconnect()
        w.__longTasks = []
        w.__frames = []
        w.__surfaceDraws = []
        w.__arrowDraws = []
        w.__observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "longtask") w.__longTasks.push(entry.duration)
            // A long animation frame: its whole length and its rendering part (style, layout, paint).
            else if (entry.entryType === "long-animation-frame") {
              const frame = entry as PerformanceEntry & { renderStart: number; styleAndLayoutStart: number }
              w.__frames.push([entry.duration, frame.renderStart > 0 ? entry.startTime + entry.duration - frame.renderStart : 0])
            } else if (entry.name === "openmana:table-surface") w.__surfaceDraws.push(entry.duration)
            // Prompt 43: each drawing of the arrows (scenes with a stack target among the 20 changes).
            else if (entry.name === "openmana:table-arrows") w.__arrowDraws.push(entry.duration)
          }
        })
        w.__observer.observe({ entryTypes: ["longtask", "long-animation-frame", "measure"] })
      }, surface)
      const keys: string[] = []
      for (let i = 0; i < 20; i++) keys.push(await step(SURFACE_GAME[i % SURFACE_GAME.length]!))
      await page.waitForTimeout(500)
      const measured = await page.evaluate(() => {
        const w = window as unknown as { __longTasks: number[]; __frames: number[][]; __surfaceDraws: number[]; __arrowDraws: number[]; __deskDrawing: Element | null }
        const deskKept = w.__deskDrawing !== null && document.querySelector('[data-slot="table-surface"] [data-surface="desk"]')!.firstElementChild === w.__deskDrawing
        return { longTasks: w.__longTasks.map(Math.round), frames: w.__frames.map(([duration, render]) => [Math.round(duration!), Math.round(render!)]), surfaceDraws: w.__surfaceDraws.map((duration) => Math.round(duration * 10) / 10), arrowDraws: w.__arrowDraws.map((duration) => Math.round(duration * 10) / 10), deskKept }
      })
      const sizeChanges = keys.filter((key, i) => key !== (i === 0 ? keys[keys.length - 1] : keys[i - 1])).length
      return {
        ...measured,
        longest: Math.max(0, ...measured.longTasks),
        over200: measured.longTasks.filter((duration) => duration > 200).length,
        longestFrame: Math.max(0, ...measured.frames.map(([duration]) => duration!)),
        longestRender: Math.max(0, ...measured.frames.map(([, render]) => render!)),
        boards: [...new Set(keys)],
        sizeChanges,
      }
    }
    const withSurface = await run(true)
    const withoutSurface = await run(false)
    // A new state of the same moment (a fresh copy, as Forge sends one) five times: the sizes stay, nothing is drawn.
    await page.evaluate(() => { document.querySelector<HTMLElement>('[data-slot="table-surface"]')!.style.display = "" })
    await step("main-phase")
    const before = await page.evaluate(() => (window as unknown as { __surfaceDraws: number[] }).__surfaceDraws.length)
    const repeatedKeys: string[] = []
    for (let i = 0; i < 5; i++) repeatedKeys.push(await step("main-phase"))
    await page.waitForTimeout(300)
    const repeatedDraws = (await page.evaluate(() => (window as unknown as { __surfaceDraws: number[] }).__surfaceDraws.length)) - before
    check(new Set(repeatedKeys).size === 1 && repeatedDraws === 0, `table surface: drawn ${repeatedDraws} times for five new states of the same size ${JSON.stringify(repeatedKeys)}`)
    await page.evaluate(() => { document.querySelector<HTMLElement>('[data-slot="table-surface"]')!.style.display = "" })
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 })
    await cdp.detach()
    // Drawn again only for a new board size (the 20 changes return to their start), each drawing well below a long task.
    check(withSurface.surfaceDraws.length <= withSurface.sizeChanges, `table surface: drawn ${withSurface.surfaceDraws.length} times for ${withSurface.sizeChanges} size changes`)
    check(withSurface.surfaceDraws.every((duration) => duration < 200), `table surface: a drawing took ${Math.max(...withSurface.surfaceDraws)} ms`)
    // Prompt 43: the arrows are measured and drawn once per state that has some, each drawing far below a long task.
    check(withSurface.arrowDraws.length > 0 && withSurface.arrowDraws.every((duration) => duration < 50), `table arrows: drawings ${JSON.stringify(withSurface.arrowDraws)} ms (none, or one of 50 ms or more)`)
    // The board follows the playing area; the desk's full-screen grain is never recomputed while the screen keeps its size.
    check(withSurface.deskKept, "table surface: the desk was drawn again although the screen kept its size")
    log(`    20 state changes, 4x CPU, 412x915: long tasks with surface ${JSON.stringify(withSurface.longTasks)} (longest ${withSurface.longest} ms, longest frame ${withSurface.longestFrame} ms, rendering ${withSurface.longestRender} ms), without ${JSON.stringify(withoutSurface.longTasks)} (longest ${withoutSurface.longest} ms, frame ${withoutSurface.longestFrame} ms, rendering ${withoutSurface.longestRender} ms); surface drawn ${withSurface.surfaceDraws.length}x ${JSON.stringify(withSurface.surfaceDraws)} ms for ${withSurface.sizeChanges} size changes (${withSurface.boards.length} board sizes, desk kept: ${withSurface.deskKept}); 5 new states of one size: drawn ${repeatedDraws}x; arrows drawn ${withSurface.arrowDraws.length}x ${JSON.stringify(withSurface.arrowDraws)} ms`)
    results["performance"] = { viewport: "412x915", throttling: 4, changes: 20, scenes: SURFACE_GAME, withSurface, withoutSurface, repeated: { states: 5, draws: repeatedDraws } }
    // Pictures a state change took off the table stop loading (aborted); every other request failure counts.
    for (const error of pageLog.errors) if (!/^\[requestfailed\] https:\/\/cards\.scryfall\.io\/.* net::ERR_ABORTED$/.test(error)) check(false, `table surface: ${error}`)
    await context.close()
  } finally {
    await surfaceBrowser.close()
  }
  return results
}

/**
 * The arrows beyond single scenes (prompt 43, docs/design/SPIELTISCH.md §4.15): they move with the table - at every
 * test size including the foldable's (11 sizes) a scene with combat and blockers is drawn again, every arrow beside its
 * end in the new layout -, with a new state (another scene, a decision that opens and closes) and with a row scrolled
 * sideways (the 14 attackers on a small phone); and they flow and pulse only without less motion - the device's and the
 * player's -, the first phase then standing still.
 */
async function tableArrows(executablePath: string, base: string): Promise<Record<string, unknown>> {
  log("  table arrows (sizes, state changes, scrolling, motion)")
  const arrowBrowser = await launchBrowser(executablePath)
  const results: Record<string, unknown> = {}
  try {
    const context = await newContext(arrowBrowser, VIEWPORTS[2]!)
    const page = await context.newPage()
    const pageLog = watch(page)
    await openScene(page, base, "blockers")
    const draws = () => page.evaluate(() => Number(document.querySelector<HTMLElement>('[data-slot="table-arrows"]')?.dataset["draws"] ?? 0))
    const ends = () => page.evaluate(() => [...document.querySelectorAll<SVGGElement>("[data-arrow]")].map((g) => `${g.dataset["from"]}>${g.dataset["to"]}@${g.dataset["end"]}`))
    // Every size: drawn again, the arrows' ends follow the layout.
    const sizes: Record<string, unknown> = {}
    const seenEnds = new Set<string>()
    for (const [name, width, height] of TABLE_LAYOUT_SIZES.filter(([size]) => !size.startsWith("border"))) {
      const before = await draws()
      await page.setViewportSize({ width, height })
      await page.waitForFunction((count) => Number(document.querySelector<HTMLElement>('[data-slot="table-arrows"]')?.dataset["draws"] ?? 0) > count, before, { timeout: 10_000 }).catch(() => undefined)
      const after = await draws()
      check(after > before, `table arrows (${name}): not drawn again for the new size`)
      sizes[name] = await arrowFacts(page, `table arrows (${name} ${width}x${height}, blockers)`, "blockers")
      seenEnds.add(JSON.stringify(await ends()))
    }
    check(seenEnds.size >= 8, `table arrows: the ends did not follow the sizes (${seenEnds.size} different layouts of 11)`)
    results["sizes"] = sizes
    await page.setViewportSize({ width: VIEWPORTS[2]!.width, height: VIEWPORTS[2]!.height })

    // New states: Forge's next scenes on the same page - combat with a distribution (the decision expands), a stack, nothing, combat again.
    const states: Record<string, unknown> = {}
    for (const scene of ["damage", "stack", "main-phase", "blockers"] as const) {
      const before = await draws()
      await page.evaluate((name) => (window as unknown as { __openmanaShowScene: (name: string) => void }).__openmanaShowScene(name), scene)
      await page.waitForFunction((count) => Number(document.querySelector<HTMLElement>('[data-slot="table-arrows"]')?.dataset["draws"] ?? 0) > count, before, { timeout: 10_000 }).catch(() => undefined)
      // Prompt 44: the cards of the new state travel to their places first; the arrows are drawn again when they arrived.
      await motionSettled(page)
      states[scene] = await arrowFacts(page, `table arrows (new state ${scene})`, scene)
    }
    results["states"] = states

    // Motion: three flow phases taking turns and the glow's pulse, all on the arrows' own layers (opacity only, table.css).
    const motion = () => page.evaluate(() => document.getAnimations().filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest('[data-slot="table-arrows"]')).map((animation) => ({ name: (animation as CSSAnimation).animationName, layer: ((animation.effect as KeyframeEffect).target as Element).getAttribute("data-layer-name"), state: animation.playState })))
    const opacities = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll<SVGSVGElement>('[data-slot="table-arrows"] svg')].map((svg) => [svg.getAttribute("data-layer-name"), getComputedStyle(svg).opacity])))
    const moving = await motion()
    check(["flow-0", "flow-1", "flow-2"].every((layer) => moving.some((animation) => animation.name === "table-arrow-flow" && animation.layer === layer && animation.state === "running")) && moving.some((animation) => animation.name === "table-arrow-pulse" && animation.layer === "glow"), `table arrows: they do not flow and pulse ${JSON.stringify(moving)}`)
    await page.emulateMedia({ reducedMotion: "reduce" })
    const reducedDevice = await motion()
    const stillDevice = await opacities()
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.evaluate(() => document.documentElement.setAttribute("data-reduced-motion", ""))
    const reducedSetting = await motion()
    const stillSetting = await opacities()
    await page.evaluate(() => document.documentElement.removeAttribute("data-reduced-motion"))
    check(reducedDevice.length === 0 && reducedSetting.length === 0, `table arrows: they move under less motion ${JSON.stringify({ reducedDevice, reducedSetting })}`)
    for (const still of [stillDevice, stillSetting]) check(still["flow-0"] === "1" && still["flow-1"] === "0" && still["flow-2"] === "0", `table arrows: under less motion not one standing line ${JSON.stringify(still)}`)
    results["motion"] = { moving, reducedDevice, reducedSetting, stillDevice, stillSetting }
    for (const error of pageLog.errors) if (!/^\[requestfailed\] https:\/\/cards\.scryfall\.io\/.* net::ERR_ABORTED$/.test(error)) check(false, `table arrows: ${error}`)
    await page.close()

    // Scrolling: 14 attackers on a small phone - the row scrolls; the arrows follow the attackers in view.
    const small = await context.newPage()
    const smallLog = watch(small)
    await small.setViewportSize({ width: 360, height: 740 })
    await openScene(small, base, "commander-late")
    const first = await arrowFacts(small, "table arrows (small phone, commander-late)", "commander-late")
    const startsBefore = await small.evaluate(() => [...document.querySelectorAll<SVGGElement>("[data-arrow]")].map((g) => g.dataset["from"]).join(","))
    const scrolled = await small.evaluate(() => {
      const rows = [...document.querySelectorAll<HTMLElement>('[data-area="field"] [data-slot="game-card-row"]')].filter((row) => row.scrollWidth > row.clientWidth + 1)
      const row = rows[0]
      if (row === undefined) return false
      const count = Number(document.querySelector<HTMLElement>('[data-slot="table-arrows"]')!.dataset["draws"] ?? 0)
      row.scrollLeft = row.scrollWidth
      return count
    })
    check(scrolled !== false, "table arrows (small phone, commander-late): no attackers' row scrolls")
    if (scrolled !== false) await small.waitForFunction((count) => Number(document.querySelector<HTMLElement>('[data-slot="table-arrows"]')?.dataset["draws"] ?? 0) > count, scrolled, { timeout: 10_000 }).catch(() => undefined)
    const second = await arrowFacts(small, "table arrows (small phone, commander-late, scrolled)", "commander-late")
    const startsAfter = await small.evaluate(() => [...document.querySelectorAll<SVGGElement>("[data-arrow]")].map((g) => g.dataset["from"]).join(","))
    check(startsBefore !== startsAfter, `table arrows (small phone, commander-late): the arrows did not follow the scrolled row (${startsBefore})`)
    results["scroll"] = { before: first, after: second, startsBefore, startsAfter }
    for (const error of smallLog.errors) if (!/^\[requestfailed\] https:\/\/cards\.scryfall\.io\/.* net::ERR_ABORTED$/.test(error)) check(false, `table arrows (scroll): ${error}`)
    log(`    ${Object.keys(sizes).length} sizes redrawn, ${seenEnds.size} different layouts of the ends; states ${Object.keys(states).join(", ")}; scrolled row: ${startsBefore} → ${startsAfter}; motion ${moving.length} animations, none under less motion`)
    await context.close()
  } finally {
    await arrowBrowser.close()
  }
  return results
}

/** The table's motion has settled (prompt 44): nothing of it moves - before reading places a travelling card would blur. */
async function motionSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('[data-slot="table-motion"][data-moving]') === null, undefined, { timeout: 5_000 }).catch(() => undefined)
}

/** The recorded run of consecutive real states (prompt 44, src/test/table-sequence.ts): how many steps it has. */
function motionSequenceSteps(): number {
  return (JSON.parse(fs.readFileSync(path.join(root, "src/test/fixtures/table-sequence.json"), "utf8")) as { steps: unknown[] }).steps.length
}

/**
 * Moments of the recorded run whose motion the image sequence shows (prompt 44): a draw, a land onto its pile,
 * combat damage and life, the AI's creature, a spell cast with damage, its resolution - found in Forge's states by
 * what happens (as src/test/table-sequence.ts SEQUENCE_STEPS), never by number: the bridge coalesces states within
 * 120 ms, so a new recording of the same game can have more or fewer of them (prompt 47).
 */
function motionShots(): readonly number[] {
  interface Card { readonly id?: number; readonly tapped?: boolean }
  interface Step { readonly state: { readonly players: readonly { readonly me: boolean; readonly life: number; readonly zones: Record<string, readonly Card[]> }[]; readonly stack: readonly { readonly card: Card | null }[] }; readonly events: readonly { readonly kind: string }[] }
  const steps = (JSON.parse(fs.readFileSync(path.join(root, "src/test/fixtures/table-sequence.json"), "utf8")) as { steps: Step[] }).steps
  const zoneOf = (index: number, id: number) => {
    const state = steps[index]!.state
    for (const player of state.players) for (const [zone, cards] of Object.entries(player.zones)) if (cards.some((card) => card.id === id)) return `${player.me ? "me" : "ai"}:${zone}`
    return state.stack.some((item) => item.card?.id === id) ? "stack" : null
  }
  const aiLife = (index: number) => steps[index]!.state.players.find((player) => !player.me)!.life
  const first = (from: number, test: (index: number) => boolean) => {
    for (let index = Math.max(1, from); index < steps.length; index++) if (test(index)) return index
    throw new Error("the recorded motion sequence lacks a moment of its image sequence")
  }
  const draw = first(1, (i) => zoneOf(i, 27) === "me:hand" && zoneOf(i - 1, 27) !== "me:hand")
  const land = first(1, (i) => zoneOf(i - 1, 33) === "me:hand" && zoneOf(i, 33) === "me:battlefield")
  const lifeLoss = first(1, (i) => aiLife(i) < aiLife(i - 1))
  const aiCreature = first(lifeLoss + 1, (i) => steps[i]!.events.some((event) => event.kind === "STACK_RESOLVE"))
  const onStack = first(aiCreature + 1, (i) => zoneOf(i, 14) === "stack" && zoneOf(i - 1, 14) !== "stack")
  const dies = first(onStack, (i) => zoneOf(i, 55) === "me:graveyard" && zoneOf(i - 1, 55) !== "me:graveyard")
  return [draw, land, lifeLoss, aiCreature, onStack, dies]
}

/**
 * The table's motion (prompt 44, docs/design/SPIELTISCH.md §8) in real Chrome on Forge's consecutive real states (the
 * harness' `sequence=first-attack`): at the phone's size every change of state moves what Forge changed - cards
 * travelling (library → hand, hand → battlefield, stack → graveyard, battlefield → graveyard), turning, shifting,
 * damage, life, the Zauberchronik's entries, the phases' gold, the main button's shimmer - with Web Animations of
 * transform and opacity only. A click during a travel hits the card at its new place (the card view opens); a further
 * state cancels what runs, a state before the motion started skips it; under less motion - the device's and the
 * player's - nothing moves. With 4x CPU throttling at 412 x 915 the whole run causes no long task over 200 ms; the
 * frame rate during the motions and the motion's own work are the measurement. The image sequence (slowed down 20x)
 * goes into the report's screens for the comparison in Seafile.
 */
async function tableMotion(executablePath: string, base: string): Promise<Record<string, unknown>> {
  log("  table motion (travels, turns, effects, clicks, stops, less motion, cost)")
  const motionBrowser = await launchBrowser(executablePath)
  const results: Record<string, unknown> = {}
  const steps = motionSequenceSteps()
  const open = async (page: Page, step: number) => {
    await page.goto(new URL(`/scripts/e2e/table-harness.html?sequence=first-attack&step=${step}`, base).href, { waitUntil: "domcontentloaded", timeout: 300_000 })
    await page.locator('[data-harness="table"]').waitFor({ timeout: 300_000 })
    // The pictures of the first state loaded (the ghosts copy them): no placeholder left, every picture loaded or failed.
    await page
      .waitForFunction(() => {
        const board = document.querySelector('[data-slot="game-board"]')
        return board !== null && board.querySelector('[data-slot="skeleton"]') === null && [...board.querySelectorAll('[data-slot="card-picture"]')].every((picture) => picture.getAttribute("data-state") !== "loading")
      }, undefined, { timeout: 30_000 })
      .catch(() => undefined)
  }
  /** Shows a step and waits for the frame the motion reads the new layout in; what that state started. */
  const show = (page: Page, step: number) =>
    page.evaluate(
      (n) =>
        new Promise<{ last: string; states: number; moving: boolean; animations: { properties: string[]; target: string }[] }>((resolve) => {
          const layer = () => document.querySelector<HTMLElement>('[data-slot="table-motion"]')!
          ;(window as unknown as { __openmanaShowStep: (n: number) => void }).__openmanaShowStep(n)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const own = document.getAnimations().filter((animation) => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition))
              resolve({
                last: layer().dataset["last"] ?? "",
                states: Number(layer().dataset["states"] ?? 0),
                moving: layer().hasAttribute("data-moving"),
                animations: own.map((animation) => {
                  const effect = animation.effect as KeyframeEffect
                  const properties = [...new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key))))]
                  const target = effect.target as Element | null
                  return { properties, target: `${target?.className ?? ""}${effect.pseudoElement ?? ""}`.slice(0, 60) }
                }),
              })
            }),
          )
        }),
      step,
    )
  try {
    const context = await newContext(motionBrowser, VIEWPORTS[0]!)
    const page = await context.newPage()
    const pageLog = watch(page)

    // 1. The whole run: what each state moved, and only transform and opacity.
    await open(page, 0)
    const kinds: Record<string, number> = {}
    const perStep: Record<string, string> = {}
    for (let step = 1; step < steps; step++) {
      const moved = await show(page, step)
      perStep[step] = moved.last
      for (const part of moved.last.match(/[a-z-]+ \d+/g) ?? []) {
        const [name, count] = part.split(" ")
        kinds[name!] = (kinds[name!] ?? 0) + Number(count)
      }
      for (const animation of moved.animations) check(animation.properties.every((property) => property === "transform" || property === "opacity"), `table motion (step ${step}): ${animation.target} animates ${animation.properties.join(", ")}`)
      await motionSettled(page)
      const leftovers = await page.evaluate(() => document.querySelectorAll(".table-motion-ghost, .table-motion-moving").length)
      check(leftovers === 0, `table motion (step ${step}): ${leftovers} ghosts or moving parts left after the motion`)
    }
    for (const [kind, least] of Object.entries({ travel: 4, shift: 3, turn: 2, "to-pile": 2, dissolve: 1, "entry-glide": 1, flash: 1, shake: 1, "life-loss": 1, phase: 3, shimmer: 1 })) check((kinds[kind] ?? 0) >= least, `table motion: ${kinds[kind] ?? 0} × ${kind} over the run, expected at least ${least} ${JSON.stringify(kinds)}`)
    results["run"] = { steps: steps - 1, kinds, perStep }

    // 2. A click while the drawn card travels (the motion slowed down 10x): it hits the card at its new place, the card view opens.
    const cdp = await context.newCDPSession(page)
    await cdp.send("Animation.enable")
    await open(page, 0)
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 })
    await show(page, 1)
    const target = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('[data-area="hand"] [data-card="27"]')!
      const box = card.getBoundingClientRect()
      const x = box.left + box.width / 2
      const y = box.top + box.height * 0.6
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-card]")?.dataset["card"] ?? null
      return { x, y, hit, moving: document.querySelector('[data-slot="table-motion"]')!.hasAttribute("data-moving"), ghosts: document.querySelectorAll(".table-motion-ghost").length }
    })
    check(target.moving && target.ghosts > 0, `table motion: the drawn card does not travel ${JSON.stringify(target)}`)
    check(target.hit === "27", `table motion: a point on the travelling card's new place hits ${target.hit} ${JSON.stringify(target)}`)
    await page.mouse.click(target.x, target.y)
    const viewed = await page.getByRole("dialog").waitFor({ timeout: 5_000 }).then(() => true, () => false)
    const stillMoving = await page.evaluate(() => document.querySelector('[data-slot="table-motion"]')!.hasAttribute("data-moving"))
    check(viewed, "table motion: a click on the travelling card did not open its card view")
    results["click"] = { ...target, viewed, duringMotion: stillMoving }
    await page.keyboard.press("Escape")
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 })
    await motionSettled(page)

    // 3. A further state stops what runs; a state before the motion started skips it.
    await open(page, 0)
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 })
    const stopped = await page.evaluate(
      () =>
        new Promise<{ running: number; cancelled: number; ghostsAfter: number }>((resolve) => {
          const go = (window as unknown as { __openmanaShowStep: (n: number) => void }).__openmanaShowStep
          go(1)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const first = document.getAnimations().filter((animation) => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition) && animation.playState === "running")
              go(2)
              // The next frame: the new state is on the table (React renders it first), its own motion not yet started.
              requestAnimationFrame(() => resolve({ running: first.length, cancelled: first.filter((animation) => animation.playState === "idle").length, ghostsAfter: document.querySelectorAll(".table-motion-ghost").length }))
            }),
          )
        }),
    )
    check(stopped.running > 0 && stopped.cancelled === stopped.running && stopped.ghostsAfter === 0, `table motion: a further state did not stop what ran ${JSON.stringify(stopped)}`)
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 })
    await motionSettled(page)
    const skipped = await page.evaluate(
      () =>
        new Promise<{ before: number; after: number }>((resolve) => {
          const layer = document.querySelector<HTMLElement>('[data-slot="table-motion"]')!
          const before = Number(layer.dataset["states"] ?? 0)
          const go = (window as unknown as { __openmanaShowStep: (n: number) => void }).__openmanaShowStep
          go(3)
          // The next state before the frame the motion reads in: only one motion runs.
          setTimeout(() => go(4), 0)
          setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve({ before, after: Number(layer.dataset["states"] ?? 0) }))), 0)
        }),
    )
    check(skipped.after - skipped.before === 1, `table motion: two states before one frame ran ${skipped.after - skipped.before} motions ${JSON.stringify(skipped)}`)
    results["stop"] = { stopped, skipped }
    await motionSettled(page)

    // 4. Less motion - the device's, then the player's: nothing moves, nothing is copied.
    const still = async (step: number) => {
      const moved = await show(page, step)
      const ghosts = await page.evaluate(() => document.querySelectorAll(".table-motion-ghost").length)
      return { animations: moved.animations.length, ghosts, moving: moved.moving }
    }
    await open(page, 0)
    await page.emulateMedia({ reducedMotion: "reduce" })
    const device = await still(1)
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.evaluate(() => document.documentElement.setAttribute("data-reduced-motion", ""))
    const setting = await still(2)
    await page.evaluate(() => document.documentElement.removeAttribute("data-reduced-motion"))
    for (const [who, facts] of Object.entries({ device, setting })) check(facts.animations === 0 && facts.ghosts === 0 && !facts.moving, `table motion: it moves under less motion (${who}) ${JSON.stringify(facts)}`)
    results["lessMotion"] = { device, setting }

    // 5. The image sequence: the key moments, slowed down 20x, three pictures each and one at rest (phone; a few on the desktop).
    const shots: string[] = []
    const sequence = async (shotPage: Page, session: typeof cdp, size: string, moments: readonly number[]) => {
      for (const step of moments) {
        await open(shotPage, step - 1)
        await session.send("Animation.setPlaybackRate", { playbackRate: 0.05 })
        await show(shotPage, step)
        for (const [index, wait] of [0, 1500, 1500].entries()) {
          if (wait > 0) await shotPage.waitForTimeout(wait)
          const name = `motion-${size}-step${String(step).padStart(2, "0")}-${index + 1}.png`
          await shotPage.screenshot({ path: path.join(reportDir, "screens", name) })
          shots.push(name)
        }
        await session.send("Animation.setPlaybackRate", { playbackRate: 1 })
        await motionSettled(shotPage)
        const name = `motion-${size}-step${String(step).padStart(2, "0")}-4-rest.png`
        await shotPage.screenshot({ path: path.join(reportDir, "screens", name) })
        shots.push(name)
      }
    }
    await sequence(page, cdp, "phone", motionShots())
    results["shots"] = shots

    // 6. Cost: the whole run with 4x CPU throttling at 412 x 915, with the motion and under less motion (the same states,
    // nothing moving) side by side - long tasks, long frames, the motion's own work, the frame rate while it moves. On the
    // dev server React renders in its slow development mode; the run without motion is the comparison, the motion's own
    // work the part it adds (the production build in a real game: scripts/readiness/matches.ts --cpu-throttle 4).
    const costRun = async (reduced: boolean) => {
      await open(page, 0)
      if (reduced) await page.evaluate(() => document.documentElement.setAttribute("data-reduced-motion", ""))
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
      await page.evaluate(() => {
        const w = window as unknown as { __longTasks: number[]; __frames: number[]; __motionWork: number[]; __observer?: PerformanceObserver }
        w.__longTasks = []
        w.__frames = []
        w.__motionWork = []
        w.__observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "longtask") w.__longTasks.push(entry.duration)
            else if (entry.entryType === "long-animation-frame") w.__frames.push(entry.duration)
            else if (entry.name === "openmana:table-motion") w.__motionWork.push(entry.duration)
          }
        })
        w.__observer.observe({ entryTypes: ["longtask", "long-animation-frame", "measure"] })
      })
      const rates: { step: number; fps: number; last: string }[] = []
      for (let step = 1; step < steps; step++) {
        const rate = await page.evaluate(
          (n) =>
            new Promise<{ fps: number; last: string }>((resolve) => {
              ;(window as unknown as { __openmanaShowStep: (n: number) => void }).__openmanaShowStep(n)
              const start = performance.now()
              let frames = 0
              const tick = (now: number) => {
                frames++
                if (now - start < 400) requestAnimationFrame(tick)
                else resolve({ fps: Math.round((frames / ((now - start) / 1000)) * 10) / 10, last: document.querySelector<HTMLElement>('[data-slot="table-motion"]')!.dataset["last"] ?? "" })
              }
              requestAnimationFrame(tick)
            }),
          step,
        )
        rates.push({ step, ...rate })
        await motionSettled(page)
      }
      await page.waitForTimeout(500)
      const measured = await page.evaluate(() => {
        const w = window as unknown as { __longTasks: number[]; __frames: number[]; __motionWork: number[]; __observer?: PerformanceObserver }
        w.__observer?.disconnect()
        document.documentElement.removeAttribute("data-reduced-motion")
        return { longTasks: w.__longTasks.map(Math.round), frames: w.__frames.map(Math.round), motionWork: w.__motionWork.map((duration) => Math.round(duration * 10) / 10) }
      })
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 })
      const travelling = rates.filter((rate) => /travel|to-pile/.test(rate.last))
      const fps = travelling.map((rate) => rate.fps).sort((a, b) => a - b)
      return {
        ...measured,
        longest: Math.max(0, ...measured.longTasks),
        over200: measured.longTasks.filter((duration) => duration > 200).length,
        longestFrame: Math.max(0, ...measured.frames),
        longestMotionWork: Math.max(0, ...measured.motionWork),
        fpsWhileTravelling: { min: fps[0] ?? null, median: fps[Math.floor(fps.length / 2)] ?? null, steps: travelling.map((rate) => [rate.step, rate.fps]) },
        fpsAll: rates.map((rate) => [rate.step, rate.fps]),
      }
    }
    const withMotion = await costRun(false)
    const withoutMotion = await costRun(true)
    check(withMotion.motionWork.length > 0 && withMotion.longestMotionWork < 50, `table motion: the motion's own work took ${withMotion.longestMotionWork} ms for a state (4x CPU, ${withMotion.motionWork.length} states)`)
    check(withoutMotion.motionWork.length === 0, "table motion: the motion worked under less motion")
    results["performance"] = { viewport: "412x915", throttling: 4, changes: steps - 1, withMotion, withoutMotion }
    log(`    run: ${JSON.stringify(kinds)}; click during a travel hits ${target.hit} (card view ${viewed}); stop ${JSON.stringify(stopped)}, skip ${JSON.stringify(skipped)}; less motion ${JSON.stringify({ device, setting })}; 4x CPU 412x915 (dev server): long tasks with motion ${JSON.stringify(withMotion.longTasks)} (longest ${withMotion.longest} ms, frame ${withMotion.longestFrame} ms), without ${JSON.stringify(withoutMotion.longTasks)} (longest ${withoutMotion.longest} ms, frame ${withoutMotion.longestFrame} ms); motion work ${JSON.stringify(withMotion.motionWork)} ms; fps while travelling min ${withMotion.fpsWhileTravelling.min} median ${withMotion.fpsWhileTravelling.median} (without motion: ${withoutMotion.fpsWhileTravelling.min}/${withoutMotion.fpsWhileTravelling.median}); ${shots.length} pictures`)
    for (const error of pageLog.errors) if (!/^\[requestfailed\] https:\/\/cards\.scryfall\.io\/.* net::ERR_ABORTED$/.test(error)) check(false, `table motion: ${error}`)
    await cdp.detach()
    await context.close()

    // The desktop (breit): the moments of the spell, its resolution and the land.
    const desktop = await newContext(motionBrowser, VIEWPORTS[2]!)
    const wide = await desktop.newPage()
    const wideLog = watch(wide)
    const wideCdp = await desktop.newCDPSession(wide)
    await wideCdp.send("Animation.enable")
    const before = shots.length
    const [, landShot, , , castShot, resolveShot] = motionShots()
    await sequence(wide, wideCdp, "desktop", [landShot!, castShot!, resolveShot!])
    results["shotsDesktop"] = shots.slice(before)
    for (const error of wideLog.errors) if (!/^\[requestfailed\] https:\/\/cards\.scryfall\.io\/.* net::ERR_ABORTED$/.test(error)) check(false, `table motion (desktop): ${error}`)
    await wideCdp.detach()
    await desktop.close()
  } finally {
    await motionBrowser.close()
  }
  return results
}

/**
 * The foldable's sizes (prompt 38, FOLD_VIEWPORTS): closed, open upright and open turned, every recorded and built
 * scene in the real table as at the eight sizes - the page never scrolls, every region where its layout puts it
 * (checkTableFits), pictures, card targets, the decision's controls touch-sized, axe-core. The screenshots are the
 * image comparison's pictures of the foldable.
 */
async function tableFoldSizes(executablePath: string, base: string): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  for (const viewport of FOLD_VIEWPORTS) {
    log(`  ${viewport.name} (${viewport.width}x${viewport.height}, touch): every scene`)
    const foldBrowser = await launchBrowser(executablePath)
    const context = await newContext(foldBrowser, viewport)
    const scenes: Record<string, unknown> = {}
    try {
      const runs = [...TABLE_SCENES.map((scene) => ({ scene: scene as string, built: null as string | null })), ...BUILT_SCENES.map((built) => ({ scene: built === "block-order" ? "block-multiple" : "main-phase", built: built as string | null }))]
      for (const { scene, built } of runs) {
        const name = built === null ? scene : `built:${built}`
        const label = `game table (${viewport.name}, ${name})`
        // A fresh page per scene, as at the eight sizes.
        const page = await context.newPage()
        const pageLog = watch(page)
        await page.goto(new URL(`/scripts/e2e/table-harness.html?scene=${scene}${built === null ? "" : `&built=${built}`}`, base).href, { waitUntil: "domcontentloaded", timeout: 300_000 })
        await page.locator('[data-harness="table"]').waitFor({ timeout: 300_000 })
        const layout = await checkTableFits(page, label)
        const pictures = await tablePictures(page, label)
        const cards = await cardTargets(page, label)
        const faces = await cardFaces(page, label)
        const hand = await handFacts(page, label)
        const strips = await stripFacts(page, label, viewport.touch)
        const panels = await panelFacts(page, label, built === null ? scene : null, built === null ? recordedStackIds(scene) : null)
        const decision = await decisionFits(page, label, viewport)
        const arrows = await arrowFacts(page, label, scene)
        const keyboard = built === null && KEYBOARD_SCENES.includes(scene) ? await tableKeyboardTour(page, label) : null
        const axe = await accessibility(page, label)
        await page.screenshot({ path: path.join(reportDir, "screens", `table-${viewport.name}-${built === null ? scene : `built-${built}`}.png`) })
        scenes[name] = { areas: layout["areas"], arrangement: layout["arrangement"], pictures, cards, faces, hand, strips, panels, decision, arrows, keyboard, axe }
        for (const error of pageLog.errors) check(false, `${label}: ${error}`)
        await page.close()
      }
      // The fanned hand with many cards and a thumb (prompt 42), also on the foldable.
      const page = await context.newPage()
      const pageLog = watch(page)
      await openScene(page, base, "opening", `&hand=${FAN_CARDS}`)
      const fanLabel = `game table (${viewport.name}, hand of ${FAN_CARDS})`
      scenes["hand"] = { facts: await handFacts(page, fanLabel), gestures: await handGestures(page, fanLabel, viewport) }
      for (const error of pageLog.errors) check(false, `${fanLabel}: ${error}`)
      await page.close()
      // Dragging hand cards onto the battlefield (prompt 46), also on the foldable.
      const dragPage = await context.newPage()
      const dragLog = watch(dragPage)
      await openScene(dragPage, base, "respond")
      const dragLabel = `game table (${viewport.name}, dragging)`
      scenes["drag"] = await handDrag(dragPage, dragLabel, viewport)
      for (const error of dragLog.errors) check(false, `${dragLabel}: ${error}`)
      await dragPage.close()
      // The card view in full screen (prompt 47), also on the foldable.
      const viewerLabel = `game table (${viewport.name}), card view`
      const viewerLogs: PageLog[] = []
      scenes["viewer"] = await cardViewer(async (name, query = "") => {
        const viewerPage = await context.newPage()
        viewerLogs.push(watch(viewerPage))
        await openScene(viewerPage, base, name, query)
        return viewerPage
      }, viewerLabel, viewport)
      for (const viewerLog of viewerLogs) for (const error of viewerLog.errors) check(false, `${viewerLabel}: ${error}`)
    } finally {
      await context.close()
      await foldBrowser.close()
    }
    results[viewport.name] = scenes
  }
  return results
}

/** Small protocol/UI checks. Inputs go to the harness recorder, not a simulated engine. */
async function blockInteractions(parent: Page, base: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const label = `blocking (${viewport.name})`
  let page = await parent.context().newPage()
  let sceneLog: PageLog | null = null
  const results: Record<string, unknown> = {}
  const activate = async (locator: Locator) => viewport.touch ? locator.tap() : locator.click()
  let decision = page.getByRole("region", { name: "Entscheidung" })
  const confirm = async (name: string) => {
    await page.waitForTimeout(ARMED_AFTER_MS)
    await activate(decision.getByRole("button", { name, exact: true }))
  }
  // Isolate each dev-module navigation just like decision/layout scenes.
  // Parent stays open; each owned page keeps its request/error assertions.
  const sceneErrors = () => { for (const error of sceneLog?.errors ?? []) check(false, `${label}: ${error}`) }
  const scene = async (name: string, query = "") => {
    sceneErrors()
    await page.close()
    page = await parent.context().newPage()
    sceneLog = watch(page)
    decision = page.getByRole("region", { name: "Entscheidung" })
    await openScene(page, base, name, query)
  }
  try {
    await scene("block-start")
    check((await harnessAnswers(page)).length === 0, `${label}: answered on render`)
    // The board uses named regions; getByRole avoids a CSS dependency on the region's internal key.
    const blocker = page.getByRole("region", { name: "Dein Spielfeld" }).locator('button[data-card][data-mark="usable"]').first()
    const id = Number(await blocker.getAttribute("data-card"))
    await activate(blocker)
    await activate(blocker)
    const taps = await harnessTaps(page)
    check(taps.length === 1 && taps[0] === id, `${label}: double tap ${JSON.stringify(taps)}, expected [${id}]`)
    const other = page.getByRole("region", { name: "Spielfeld der Forge-KI" }).locator('button[data-card][data-mark="usable"]').first()
    const target = Number(await other.getAttribute("data-card"))
    await activate(other)
    check(JSON.stringify(await harnessTaps(page)) === JSON.stringify([id, target]), `${label}: attacker switch sends the wrong card`)
    check((await harnessAnswers(page)).length === 0, `${label}: assigning a block answered confirmation`)
    results["assign/switch/double-tap"] = await harnessTaps(page)
    await confirm("Nicht blocken")
    check(JSON.stringify((await harnessAnswers(page))[0]?.[1]) === JSON.stringify({ kind: "buttons", button: 1 }), `${label}: no-block confirmation`)

    await scene("block-multiple")
    const selected = page.getByRole("region", { name: "Dein Spielfeld" }).locator('button[data-card][data-mark="selected"]').first()
    const selectedId = Number(await selected.getAttribute("data-card"))
    if (viewport.touch) await touch(page, selected, { holdMs: ARMED_AFTER_MS })
    else await selected.click({ button: "right" })
    await page.getByRole("dialog").waitFor()
    check((await harnessTaps(page)).length === 0 && (await harnessAnswers(page)).length === 0, `${label}: inspecting a blocker sent input`)
    await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click()
    await activate(selected)
    check(JSON.stringify(await harnessTaps(page)) === JSON.stringify([selectedId]), `${label}: remove-assignment tap`)
    await confirm("Blocks bestätigen")
    check(JSON.stringify((await harnessAnswers(page))[0]?.[1]) === JSON.stringify({ kind: "buttons", button: 1 }), `${label}: double-block confirmation`)
    results["double-block"] = { taps: await harnessTaps(page), answers: await harnessAnswers(page) }

    await scene("block-multiple", "&built=block-order")
    check(await decision.getByRole("button", { name: "Blocks bestätigen", exact: true }).count() === 0, `${label}: block controls under blocking order request`)
    await activate(decision.getByRole("button", { name: /nach unten$/ }).first())
    await confirm("Bestätigen")
    check(JSON.stringify((await harnessAnswers(page))[0]?.[1]) === JSON.stringify({ kind: "order", order: [2, 1] }), `${label}: block order (built)`)
    results["block-order (built)"] = await harnessAnswers(page)

    await scene("damage")
    await activate(decision.getByRole("button", { name: "Bei Canyon Minotaur einen mehr", exact: true }))
    await activate(decision.getByRole("button", { name: "Bei Raging Goblin einen mehr", exact: true }))
    await confirm("Bestätigen")
    check(JSON.stringify((await harnessAnswers(page))[0]?.[1]) === JSON.stringify({ kind: "distribute", amounts: [1, 1] }), `${label}: real combat damage request`)
    results["damage"] = await harnessAnswers(page)
    return results
  } finally {
    sceneErrors()
    await page.close()
  }
}

/** Zone/card inspection in real Chrome; DFC substitution is explicitly built, inputs recorded only. */
async function zoneInteractions(parent: Page, base: string, viewport: Viewport): Promise<Record<string, unknown>> {
  const label = `zones (${viewport.name})`
  let page = await parent.context().newPage()
  let sceneLog: PageLog | null = null
  const results: Record<string, unknown> = {}
  const activate = async (locator: Locator) => viewport.touch ? locator.tap() : locator.click()
  let view = page.getByRole("dialog")
  const safe = async () => check((await harnessTaps(page)).length === 0 && (await harnessAnswers(page)).length === 0, `${label}: inspection sent an input`)
  const inspect = async (zone: string) => {
    await activate(page.getByRole("button", { name: "Zonen ansehen", exact: true }))
    await activate(view.getByRole("button", { name: zone, exact: true }))
    await view.waitFor()
    await accessibility(page, `${label}: ${zone}`)
    const card = view.locator("button[data-card]").first()
    if (await card.count() > 0) {
      await activate(card)
      await view.getByRole("button", { name: "Schließen", exact: true }).waitFor()
      const next = view.getByRole("button", { name: "Nächste Karte", exact: true })
      if (await next.count() > 0 && await next.isEnabled()) await activate(next)
      await accessibility(page, `${label}: card from ${zone}`)
      const close = view.getByRole("button", { name: "Schließen", exact: true })
      const box = await close.boundingBox()
      check(box !== null && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${label}: close button outside viewport`)
      await safe()
      await activate(close)
      await view.waitFor()
    }
    await activate(view.getByRole("button", { name: "Schließen", exact: true }))
    await view.waitFor({ state: "hidden" })
  }
  // Isolate each dev-module navigation just like decision/layout scenes.
  // Parent stays open; each owned page keeps its request/error assertions.
  const sceneErrors = () => { for (const error of sceneLog?.errors ?? []) check(false, `${label}: ${error}`) }
  const scene = async (name: string, query = "") => {
    sceneErrors()
    await page.close()
    page = await parent.context().newPage()
    sceneLog = watch(page)
    view = page.getByRole("dialog")
    await openScene(page, base, name, query)
  }
  try {
    await scene("main-phase")
    await inspect("Dein Friedhof: 6 Karten ansehen")
    await inspect("Friedhof der Forge-KI: 2 Karten ansehen")
    await inspect("Dein Exil: 0 Karten ansehen")
    results["graveyards/empty"] = true
    await scene("command-effects")
    await inspect("Dein Exil: 1 Karten ansehen")
    await inspect("Deine Kommandozone: 2 Karten ansehen")
    results["exile/command"] = true
    await scene("stack")
    await inspect("Karten auf dem Stapel: 1 Einträge ansehen")
    results["stack"] = true
    await scene("commander-late")
    // Forge's real battlefield piles: choose one whose caption counts at least two.
    const pileIds = await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('button[data-card]')].filter((b) => /, \d+ Karten(?:,|$)/.test(b.getAttribute("aria-label") ?? "")).map((b) => b.dataset["card"]))
    if (pileIds.length > 0) {
      const target = page.locator(`button[data-card="${pileIds[0]}"]`)
      if (viewport.touch) await touch(page, target, { holdMs: ARMED_AFTER_MS })
      else await target.click({ button: "right" })
      await view.waitFor()
      await activate(view.getByRole("button", { name: "Nächste Karte", exact: true }))
      await safe()
      await activate(view.getByRole("button", { name: "Schließen", exact: true }))
    } else check(false, `${label}: recorded battlefield has no pile to browse`)
    results["pile"] = true
    for (const presentation of ["dfc", "fallback"]) {
      await scene("main-phase", `&presentation=${presentation}`)
      const hand = page.getByRole("region", { name: "Deine Hand", exact: true })
      await activate(hand.locator("button[data-card]").first())
      await view.waitFor()
      // One button turns the card (prompt 47); what is shown is the other side's picture or text.
      const turn = view.getByRole("button", { name: /^Umdrehen/ })
      await turn.waitFor()
      await activate(turn)
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] img')].every((img) => (img as HTMLImageElement).complete))
      await safe()
      await accessibility(page, `${label}: ${presentation} (built)`)
      const action = view.getByRole("button", { name: "Spiele ein Land", exact: true })
      const box = await action.boundingBox()
      check(box !== null && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${label}: viewer action outside viewport`)
      const description = await view.evaluate((node) => document.getElementById(node.getAttribute("aria-describedby") ?? "")?.textContent ?? "")
      check(description.includes("Du siehst die Kartenseite"), `${label}: second face not shown ("${description.slice(0, 120)}")`)
      if (presentation === "dfc") check((await view.locator("img").first().getAttribute("src"))?.includes("/back/") === true, `${label}: DFC back picture`)
      if (presentation === "fallback") check(description.includes("englisch, kein deutscher Text verfügbar"), `${label}: English fallback not marked`)
      await page.screenshot({ path: path.join(reportDir, "screens", `viewer-${viewport.name}-${presentation}.png`) })
      await activate(view.getByRole("button", { name: "Schließen", exact: true }))
      results[`${presentation} (built)`] = true
    }
    return results
  } finally {
    sceneErrors()
    await page.close()
  }
}

// ── 13. The ORYX cloud on OpenMana's real address ─────────────────────────

const REAL_ORIGIN = "https://openmana.oryx.quest"
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
 * request to https://openmana.oryx.quest from the running preview (with its
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


/** Prompt 22: recorded original Forge transcript in a deliberately assembled portable envelope. */
async function replayLibrary(browser: Browser, base: string): Promise<Record<string, unknown>> {
  log("Replay library (recorded Forge snapshots, JSON round trip, manual navigation, retention, confirmed deletion)")
  const fixture = JSON.parse(fs.readFileSync(path.join(root, "src/test/fixtures/replay.json"), "utf8"))
  const result: Record<string, unknown> = { provenance: fixture.provenance }
  const bytes = Buffer.from(JSON.stringify(fixture.replay))
  for (const viewport of TABLE_VIEWPORTS.filter((v) => ["small-phone", "phone-landscape", "desktop"].includes(v.name))) {
    const context = await newContext(browser, viewport)
    const page = await context.newPage()
    const pageLog = watch(page)
    const workers = countWorkers(page)
    try {
      await page.goto(new URL("/matches", base).href, { waitUntil: "networkidle" })
      await page.getByText("Noch keine Partien", { exact: true }).waitFor()
      const file = page.getByLabel("Wiedergabedatei")
      await file.setInputFiles({ name: "recorded-forge.json", mimeType: "application/json", buffer: bytes })
      await page.getByText("Wiedergabe geladen", { exact: true }).waitFor()
      const list = page.getByRole("list", { name: "Gespeicherte Partien" })
      await list.waitFor()
      const before = await dumpDatabase(page)
      check(JSON.stringify(before["matches"]) === JSON.stringify([fixture.replay.match]), `replay ${viewport.name}: imported header changed`)
      check(JSON.stringify(before["matchLog"]) === JSON.stringify(fixture.replay.log), `replay ${viewport.name}: imported original messages changed`)
      const initialGeometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > innerWidth+1).map((e) => ({ slot: e.getAttribute("data-slot"), tag: e.tagName, box: e.getBoundingClientRect().toJSON() })) }))
      log(`Replay ${viewport.name}: ${JSON.stringify(initialGeometry)}`)
      log(`Replay ${viewport.name}: original transcript imported; downloading JSON`)
      let downloadedReplay: Awaited<ReturnType<typeof downloaded>>
      try { downloadedReplay = await downloaded(page, () => list.getByRole("button", { name: "JSON speichern" }).click({ timeout: 10000 })) }
      catch (error) { await page.screenshot({ path: path.join(reportDir, "screens", `replay-download-error-${viewport.name}.png`) }); log(`Replay geometry: ${JSON.stringify(await list.getByRole("button", { name: "JSON speichern" }).evaluate((b) => { const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return { box: r.toJSON(), hit: hit?.outerHTML, disabled: (b as HTMLButtonElement).disabled, scrollY, scrollHeight: document.documentElement.scrollHeight, height: innerHeight } }))}`); log(`Replay download error: ${(await page.locator("main").textContent()) ?? ""}; ${pageLog.errors.join(" | ")}`); throw error }
      check(JSON.stringify(JSON.parse(downloadedReplay.text)) === JSON.stringify(fixture.replay), `replay ${viewport.name}: download differs`)
      await file.setInputFiles({ name: "duplicate.json", mimeType: "application/json", buffer: bytes })
      await page.getByText("Diese Partie ist schon gespeichert", { exact: true }).waitFor()
      await list.getByRole("button", { name: "Löschen", exact: true }).click()
      await page.getByRole("alertdialog").getByRole("button", { name: "Behalten" }).click()
      check((await dumpDatabase(page))["matches"]?.length === 1, `replay ${viewport.name}: cancellation removed a recording`)
      const libraryAxe = await accessibility(page, `replay ${viewport.name}: library`)
      const libraryOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      check(libraryOverflow <= 0, `replay ${viewport.name}: library overflow ${libraryOverflow}`)
      await page.waitForFunction(() => document.querySelector("[data-sonner-toast]") === null, undefined, { timeout: 10_000 })
      await page.screenshot({ path: path.join(reportDir, "screens", `replay-library-${viewport.name}.png`) })
      await list.getByRole("link", { name: "Ansehen", exact: true }).click()
      await page.getByRole("heading", { level: 1, name: "Wiedergabe", exact: true }).waitFor()
      // Prompt 44: stepping animates (the motion runs for each step), jumping over several steps does not.
      const motionStates = () => page.evaluate(() => Number(document.querySelector<HTMLElement>('[data-slot="table-motion"]')?.dataset["states"] ?? 0))
      const statesBefore = await motionStates()
      await page.getByRole("button", { name: "Nächster Schritt" }).click()
      check(await page.getByRole("button", { name: "Vorheriger Schritt" }).isEnabled(), `replay ${viewport.name}: did not advance`)
      await page.waitForFunction((count) => Number(document.querySelector<HTMLElement>('[data-slot="table-motion"]')?.dataset["states"] ?? 0) > count, statesBefore, { timeout: 5_000 }).catch(() => undefined)
      await motionSettled(page)
      await page.getByRole("button", { name: "Vorheriger Schritt" }).click()
      check(await page.getByRole("button", { name: "Vorheriger Schritt" }).isDisabled(), `replay ${viewport.name}: did not rewind`)
      await page.waitForFunction((count) => Number(document.querySelector<HTMLElement>('[data-slot="table-motion"]')?.dataset["states"] ?? 0) > count + 1, statesBefore, { timeout: 5_000 }).catch(() => undefined)
      const stepped = (await motionStates()) - statesBefore
      check(stepped === 2, `replay ${viewport.name}: stepping forward and back animated ${stepped} of 2 steps`)
      await motionSettled(page)
      const firstFacts = await tableFacts(page)
      const replayAxe = await accessibility(page, `replay ${viewport.name}: table`)
      const tableLayout = await checkTableFits(page, `replay ${viewport.name}`)
      check((await page.getByText("Forge rechnet", { exact: true }).count()) === 0, `replay ${viewport.name}: live-engine status shown`)
      await page.screenshot({ path: path.join(reportDir, "screens", `replay-table-${viewport.name}.png`) })
      await page.getByRole("button", { name: "Wiedergabemenü" }).click()
      const menu = page.getByRole("dialog", { name: "Wiedergabe", exact: true })
      const statesBeforeJump = await motionStates()
      await menu.getByRole("button", { name: "Ende", exact: true }).click()
      const menuAxe = await accessibility(page, `replay ${viewport.name}: menu`)
      check((await motionStates()) === statesBeforeJump, `replay ${viewport.name}: jumping to the end animated`)
      await page.keyboard.press("Escape")
      check(await page.getByRole("button", { name: "Nächster Schritt" }).isDisabled(), `replay ${viewport.name}: end step not reached`)
      const lastFacts = await tableFacts(page)
      await page.getByRole("button", { name: "Spielverlauf ansehen", exact: true }).click()
      const history = page.getByRole("dialog", { name: "Spielverlauf", exact: true })
      const expectedEvents = fixture.replay.log.flatMap((e: { message: { type: string; entries?: unknown[] } }) => e.message.type === "events" ? e.message.entries ?? [] : [])
      check(await history.locator("[data-history-entry]").count() === expectedEvents.length, `replay ${viewport.name}: incomplete history`)
      await history.getByRole("button", { name: "Schließen", exact: true }).click()
      check(JSON.stringify((await dumpDatabase(page))["matchLog"]) === JSON.stringify(before["matchLog"]), `replay ${viewport.name}: replay wrote game inputs`)
      check(workers.created() === 0 && !pageLog.requests.some((p) => p.startsWith("/engine/")), `replay ${viewport.name}: replay booted or fetched an engine`)
      await page.getByRole("button", { name: "Wiedergabemenü" }).click()
      await menu.getByRole("link", { name: "Zurück zu Partien" }).click()
      await page.getByRole("heading", { level: 1, name: "Partien", exact: true }).waitFor()
      await file.setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"format":"bad"}') })
      await page.getByRole("alert").filter({ hasText: "Die Partiedaten ließen sich nicht verarbeiten" }).waitFor()
      check(JSON.stringify((await dumpDatabase(page))["matchLog"]) === JSON.stringify(before["matchLog"]), `replay ${viewport.name}: malformed import changed records`)
      await page.getByLabel("Beendete Partien behalten (1–1000)").fill("1")
      await page.getByRole("button", { name: "Aufbewahrung ändern" }).click()
      await page.getByRole("alertdialog").getByRole("button", { name: "Ändern und ältere entfernen" }).click()
      const second = structuredClone(fixture.replay)
      second.match.id = "00000000-0000-4000-8000-000000000023"
      // Keep this recording newer even after the original fixture is re-recorded.
      second.match.startedAt = new Date(Date.parse(fixture.replay.match.startedAt) + 3_600_000).toISOString()
      second.match.endedAt = new Date(Date.parse(fixture.replay.match.endedAt) + 3_600_000).toISOString()
      second.log.forEach((e: { matchId: string }) => { e.matchId = second.match.id })
      await file.setInputFiles({ name: "second.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(second)) })
      // waitForFunction treats a returned Promise as truthy; poll the resolved DB snapshot instead.
      const retentionDeadline = Date.now() + 10_000
      let retained: Record<string, unknown[]>
      while (true) {
        retained = await dumpDatabase(page, ["matches", "matchLog"])
        if (JSON.stringify(retained["matches"]) === JSON.stringify([second.match])) break
        if (Date.now() >= retentionDeadline) throw new Error(`replay ${viewport.name}: retention did not keep the newer recording`)
        await page.waitForTimeout(100)
      }
      log(`Replay ${viewport.name}: retention log ids ${JSON.stringify([...new Set((retained["matchLog"] ?? []).map((e) => (e as { matchId: string }).matchId))])}`)
      check(JSON.stringify(retained["matchLog"]) === JSON.stringify(second.log), `replay ${viewport.name}: retention lost or left foreign messages`)
      await page.getByRole("button", { name: "Alle Partien löschen" }).click()
      await page.getByRole("alertdialog").getByRole("button", { name: "Endgültig entfernen" }).click()
      await page.getByText("Noch keine Partien", { exact: true }).waitFor()
      check((await dumpDatabase(page))["matchLog"]?.length === 0, `replay ${viewport.name}: clear left messages`)
      await page.reload({ waitUntil: "networkidle" })
      await page.getByText("Noch keine Partien", { exact: true }).waitFor()
      result[viewport.name] = { libraryAxe, replayAxe, menuAxe, libraryOverflow, tableLayout, firstFacts, lastFacts, entries: fixture.replay.log.length, events: expectedEvents.length, engineWorkers: workers.created(), portableRoundTrip: true, retention: true, confirmedClear: true }
      for (const error of pageLog.errors) check(false, `replay ${viewport.name}: ${error}`)
    } finally { await context.close() }
  }
  return result
}
/** Prompt 28: real browser web navigation; the ORYX landing page is a stand-in.
 * This never claims DAL verification by Android or a physical TWA run. */
async function oryxNavigation(browser: Browser, base: string): Promise<void> {
  log("ORYX web integration (same-tab return, real IndexedDB; stand-in launcher, no Android device)")
  const launcher = "https://oryx.quest/"
  const fixture = JSON.parse(fs.readFileSync(path.join(root, "src/test/fixtures/replay.json"), "utf8"))
  const config = JSON.parse(/^const CONFIG = (.+);\n/.exec(fs.readFileSync(path.join(dist, "sw.js"), "utf8"))![1]!) as { shell: { url: string }[] }
  check(!config.shell.some((entry) => entry.url.startsWith("/.well-known/")), "ORYX: origin trust statements entered the app cache")
  const results: unknown[] = []
  for (const viewport of [RESPONSIVE_VIEWPORTS[0]!, VIEWPORTS[2]!]) {
    const context = await newContext(browser, viewport)
    const page = await context.newPage()
    const pageLog = watch(page)
    const workers = countWorkers(page)
    try {
      // The stand-in only models an explicit link in the same browsing context.
      // Its live ORYX implementation, browser provider and TWA are not under test.
      await context.route(`${launcher}**`, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: `<html lang="de"><title>ORYX-Testseite</title><body><h1>ORYX-Testseite</h1><a href="${base}">OpenMana öffnen</a></body></html>` }))
      log(`ORYX web ${viewport.name}: import local records, direct start and browser Back`)
      const sample = sampleBackup(1, "ORYX-Lokal")
      const card = await openLocalData(page, base)
      await chooseBackup(card, "oryx-local.jsonl.gz", sample.bytes)
      await page.getByRole("dialog", { name: "Sicherung laden" }).getByRole("button", { name: "Zusammenführen", exact: true }).click()
      await page.getByText("Sicherung geladen", { exact: true }).waitFor()
      await page.goto(new URL("/matches", base).href, { waitUntil: "networkidle" })
      await page.getByLabel("Wiedergabedatei").setInputFiles({ name: "recorded-forge.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture.replay)) })
      await page.getByRole("list", { name: "Gespeicherte Partien" }).getByRole("link", { name: "Ansehen", exact: true }).first().waitFor()
      await page.getByText("Wiedergabe geladen", { exact: true }).waitFor()
      const before = await dumpDatabase(page, ["decks", "settings", "matches", "matchLog"])
      check(before["matches"]?.length === 2, "ORYX: backup and recorded Forge replay were not imported")
      // Direct start requires no launcher query marker. Internal browser Back
      // still belongs to the platform rather than a rewritten history stack.
      await page.goto(base, { waitUntil: "networkidle" })
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 60_000 })
      await page.locator('[aria-labelledby="home-title"]').getByRole("link", { name: "Decks", exact: true }).click()
      await page.getByRole("heading", { name: "Decks", exact: true }).waitFor()
      await page.goBack()
      await page.getByRole("heading", { name: "OpenMana", exact: true }).waitFor()
      const back = page.getByRole("button", { name: "Zurück zu ORYX", exact: true })
      if (viewport.touch) check((await back.boundingBox())!.height >= 44, "ORYX: return target smaller than 44 px")
      log(`ORYX web ${viewport.name}: return to stand-in launcher and reopen`)
      const navigation = page.waitForURL(launcher)
      if (viewport.touch) await back.tap()
      else await back.click()
      await navigation
      await page.getByRole("heading", { name: "ORYX-Testseite" }).waitFor()
      check(context.pages().length === 1, "ORYX: return opened another tab")
      await page.getByRole("link", { name: "OpenMana öffnen", exact: true }).click()
      await page.waitForURL(base)
      await page.getByRole("heading", { name: "OpenMana", exact: true }).waitFor()
      const after = await dumpDatabase(page, ["decks", "settings", "matches", "matchLog"])
      check(JSON.stringify(after) === JSON.stringify(before), "ORYX: navigation changed existing local records")
      check(workers.created() === 0, "ORYX: browsing local data started Forge")
      // Even in a controlled PWA, DAL metadata comes from the current HTTP
      // server rather than a cached trust statement or SPA document.
      log(`ORYX web ${viewport.name}: network trust endpoint and preserved replay`)
      const endpoint = new URL("/.well-known/assetlinks.json", base).href
      const responsePromise = page.waitForResponse(endpoint)
      const trust = await page.evaluate(async (url) => {
        const response = await fetch(url)
        return { status: response.status, type: response.headers.get("content-type"), redirected: response.redirected, text: await response.text() }
      }, endpoint)
      const response = await responsePromise
      check(trust.status === 200 && !trust.redirected && trust.type?.startsWith("application/json"), "ORYX: DAL status/type/redirect")
      check(trust.text === fs.readFileSync(path.join(root, "public/.well-known/assetlinks.json"), "utf8"), "ORYX: DAL bytes changed in PWA")
      check(!response.fromServiceWorker(), "ORYX: DAL request was intercepted by the app worker")
      await page.goto(new URL(`/matches/${fixture.replay.match.id}`, base).href)
      await page.getByRole("heading", { name: "Wiedergabe", exact: true }).waitFor()
      await page.getByRole("button", { name: "Nächster Schritt", exact: true }).click()
      check(JSON.stringify(await dumpDatabase(page, ["decks", "settings", "matches", "matchLog"])) === JSON.stringify(before), "ORYX: saved replay changed on inspection")
      const axe = await accessibility(page, `ORYX stored replay ${viewport.name}`)
      await screenshots(page, `oryx-saved-replay-${viewport.name}`)
      for (const error of pageLog.errors) check(false, `ORYX web ${viewport.name}: ${error}`)
      results.push({ viewport: viewport.name, launcher, launcherStandIn: true, sameTab: true, internalBack: true, originalLocalRecordsUnchanged: true, savedForgeReplayViewed: true, engineWorkers: workers.created(), assetLinksNetworkOnly: !response.fromServiceWorker(), assetLinks: trust, axe })
    } finally { await context.close() }
  }
  report["oryxWebIntegration"] = { evidence: "Desktop Chrome with CSS/touch emulation, a stand-in launcher and actual IndexedDB. No physical Android/TWA acceptance.", deviceAcceptance: "pending", results }
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
  const browser = await launchBrowser(executablePath)
  report["browser"] = `${path.basename(executablePath)} ${browser.version()}`
  log(`Chrome ${browser.version()}, app at ${base}`)
  try {
    if (oryxOnly) {
      await checkAssetLinks(base, "preview")
      await oryxNavigation(browser, base)
    } else if (responsiveOnly) {
      report["scope"] = "Every application route, empty/populated states and overlays at eight emulated viewports, retaining normal real Play prewarming. Real Forge resize invariance is checked in the full suite separately."
      report["responsive"] = await responsiveSurfaces(executablePath, base)
      await surfaces(executablePath, base, id)
    } else if (replayOnly) {
      report["replay"] = await replayLibrary(browser, base)
    } else if (dragOnly) {
      report["scope"] = "Playing by dragging in two real games with the real engine (mouse on a desktop, a thumb on a phone); no complete application suite."
      report["drag"] = { desktop: await dragInRealGame(browser, base, VIEWPORTS[2]!), phone: await dragInRealGame(browser, base, VIEWPORTS[0]!) }
    } else if (focusedTable || tableOnly) {
      report["scope"] = tableOnly ? `All ${(TABLE_SCENES.length + BUILT_SCENES.length) * TABLE_VIEWPORTS.length} recorded/built scene/viewport checks and every original table/history/decision/combat/zone interaction; no fresh engine boot or complete application suite.` : helpOnly ? "Recorded Forge scenes and explicitly built question families; help, target markings, three viewports; no engine boot or full application suite." : historyOnly ? "Recorded real Forge log entries and current card inspection, three viewports; no engine boot or full application suite." : zonesOnly ? "Recorded Forge zones and explicitly built DFC presentation, three viewports, one page at a time; no engine boot or complete application regression suite." : "Recorded Forge combat scenes and one built order request, three viewports, one page at a time; no engine boot or complete application regression suite."
      await browser.close()
      report["gameTable"] = await tableHarness(executablePath)
    } else {
      await httpChecks(base, id)
      await devServerChecks(browser, id)
      await surfaces(executablePath, base, id)
      report["responsive"] = await responsiveSurfaces(executablePath, base)
      report["engine"] = [await engine(browser, base, id, VIEWPORTS[2]!), await engine(browser, base, id, VIEWPORTS[0]!)]
      report["replay"] = await replayLibrary(browser, base)
      await localData(browser, base)
      await localDataQuota(executablePath, base)
      await cardData(browser, base)
      await deckImport(browser, base, id)
      await pwa(base, executablePath)
      await withoutIsolation(browser)
      await oryxCloud(browser, base)
      await oryxNavigation(browser, base)
      await browser.close()
      report["gameTable"] = await tableHarness(executablePath)
    }
  } finally {
    await browser.close()
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()))
  }
  report["failures"] = failures
  fs.writeFileSync(path.join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`)
  log(`\n${responsiveOnly ? "Responsive " : tableOnly ? "Table " : helpOnly ? "Help " : combatOnly ? "Combat " : zonesOnly ? "Zones " : historyOnly ? "History " : ""}${failures.length === 0 ? "E2E OK" : `E2E FAILED (${failures.length})`} – report: ${path.relative(root, path.join(reportDir, "report.json"))}`)
  process.exitCode = failures.length === 0 ? 0 : 1
}

/** Same browser configuration for application checks and each bounded table run. */
function launchBrowser(executablePath: string): Promise<Browser> {
  return chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu", NO_REAL_CLOUD] })
}

await main()
