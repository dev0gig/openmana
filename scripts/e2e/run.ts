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
 */
import { createRequire } from "node:module"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import type { AddressInfo } from "node:net"
import path from "node:path"
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core"
import { build, createServer, preview } from "vite"
import { ISOLATION_HEADERS } from "../../vite/isolation-headers.ts"

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
}

function watch(page: Page): PageLog {
  const pageLog: PageLog = { errors: [], engineLog: [], requests: [] }
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
  page.on("request", (request) => pageLog.requests.push(new URL(request.url()).pathname))
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
