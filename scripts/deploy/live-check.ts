/*
 * Live check of a deployment (prompt 31, docs/DEPLOYMENT.md): a real Chrome on
 * the real address, nothing stubbed.
 *
 *   node scripts/deploy/live-check.ts [https://openmana.oryx.quest] [--out <report directory>] [--expect-commit <sha>]
 *
 * Checks: cross-origin isolation and SharedArrayBuffer; the card data install
 * from the deployment; two Arena lists imported; a complete game against
 * Forge's AI in the Forge WebAssembly engine, played through the table until
 * Forge names a result by the readiness player (scripts/readiness/player.ts:
 * lands, spells, targets, payments, attacks and blocks Forge offers, every
 * input taken by Forge); Scryfall pictures under COEP; one engine worker at a
 * time; the legal documents naming the deployed commit. Writes report.json and
 * screenshots; exits non-zero on any failed check.
 *
 * The game flow of prompts 49-51 (series openmana-spielfluss, prompt 52): the
 * settings start at Forge's tempo "Normal" without waiting after every action
 * (the app's default in a fresh profile); the live game then runs with "Nach
 * jeder Gegneraktion warten", so the AI's turn is shown on the stage and goes
 * on only by its own "Weiter" (the player presses nothing else there); the
 * start hand opens by itself in full screen, a card of it is opened and
 * swiped to the next one (Chrome's touch input), the start questions are
 * answered there; the strip shows Forge's land count. --expect-commit
 * compares the commit the notices name, and the service worker's version and
 * engine are reported to tell the new build from an old one.
 */
import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright-core"
import { playGame } from "../readiness/player.ts"

const args = process.argv.slice(2)
const outIndex = args.indexOf("--out")
const out = path.resolve(outIndex >= 0 ? args[outIndex + 1]! : "reports/live")
const expectIndex = args.indexOf("--expect-commit")
const expectCommit = expectIndex >= 0 ? args[expectIndex + 1]! : null
const base = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--out" && args[i - 1] !== "--expect-commit") ?? "https://openmana.oryx.quest"
fs.mkdirSync(path.join(out, "screens"), { recursive: true })

const report: Record<string, unknown> = { base, startedAt: new Date().toISOString() }
const failures: string[] = []
function check(condition: unknown, message: string) { if (!condition) { failures.push(message); console.log(`  FAIL ${message}`) } }
const log = (message: string) => console.log(`[live] ${message}`)

const DECKS: Record<string, string> = {
  "Live Izzet": ["Deck", "4 Delver of Secrets", "4 Lightning Bolt", "2 Fire // Ice", "3 Bonecrusher Giant", "1 Valki, God of Lies", "20 Island", "26 Mountain"].join("\n"),
  "Live Rot": ["Deck", "4 Lightning Bolt", "4 Bonecrusher Giant", "4 Shock", "4 Raging Goblin", "4 Goblin Guide", "4 Monastery Swiftspear", "4 Lava Spike", "4 Rift Bolt", "4 Skewer the Critics", "24 Mountain"].join("\n"),
}

const browser = await chromium.launch({ executablePath: process.env["OPENMANA_CHROME"] || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] })
report["browser"] = browser.version()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
let workers = 0, alive = 0, maxAlive = 0
page.on("worker", (worker) => { workers++; alive++; maxAlive = Math.max(maxAlive, alive); worker.on("close", () => { alive-- }) })
const scryfall = { ok: 0, failed: 0, failures: [] as string[] }
page.on("response", (response) => { if (new URL(response.url()).host === "cards.scryfall.io") { if (response.ok()) scryfall.ok++; else { scryfall.failed++; scryfall.failures.push(`${response.status()} ${response.url()}`) } } })
// A picture the browser dropped because its card left the screen (ERR_ABORTED - the stage's cards come and go) is no
// failure of Scryfall's (as in scripts/readiness/matches.ts).
page.on("requestfailed", (request) => { if (new URL(request.url()).host === "cards.scryfall.io" && !(request.failure()?.errorText ?? "").includes("ERR_ABORTED")) { scryfall.failed++; scryfall.failures.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`) } })
const errors: string[] = []
page.on("pageerror", (error) => errors.push(error.message))

async function shot(name: string) { await page.screenshot({ path: path.join(out, "screens", `${name}.png`) }).catch(() => undefined) }
async function overlaysGone() { await page.waitForFunction(() => !document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"]'), undefined, { timeout: 30_000 }) }

try {
  log(`${base} in Chrome ${browser.version()}`)
  await page.goto(base, { waitUntil: "networkidle" })
  const env = await page.evaluate(() => ({ isolated: globalThis.crossOriginIsolated, sab: typeof SharedArrayBuffer, title: document.title, ua: navigator.userAgent }))
  report["environment"] = env
  check(env.isolated === true && env.sab === "function", `cross-origin isolation ${JSON.stringify(env)}`)

  log("legal documents")
  const notices = await (await page.request.get(new URL("/legal/THIRD-PARTY-NOTICES.txt", base).href)).text()
  const commit = /github\.com\/dev0gig\/openmana\/tree\/([0-9a-f]{40})/.exec(notices)?.[1] ?? null
  report["sourceCommit"] = commit
  check(commit !== null && notices.includes("Öffentliche Version"), "notices name the deployed public source commit")
  if (expectCommit !== null) check(commit === expectCommit, `the notices name ${commit}, expected the pushed commit ${expectCommit}`)

  // Which build this is (the old one or the new): the service worker's shell version and the engine it caches.
  const sw = await (await page.request.get(new URL("/sw.js", base).href, { headers: { "cache-control": "no-cache" } })).text()
  const config = /^const CONFIG = (\{.*?\});$/m.exec(sw)?.[1]
  const parsed = config === undefined ? null : (JSON.parse(config) as { version: string; engineVersion: string; engine: { url: string }[] })
  const engineManifest = parsed?.engine.find((entry) => entry.url.endsWith("/engine-manifest.json"))?.url ?? null
  const manifest = engineManifest === null ? null : ((await (await page.request.get(new URL(engineManifest, base).href)).json()) as { protocol?: { version?: number } })
  report["build"] = { serviceWorkerVersion: parsed?.version ?? null, engineVersion: parsed?.engineVersion ?? null, engineManifest, protocol: manifest?.protocol?.version ?? null }
  check(parsed !== null && engineManifest !== null, "the service worker names its shell version and engine")

  // Prompt 49: a fresh profile starts at "Normal" without waiting after every action; the live game then waits for
  // "Weiter" on the stage (the setting is saved the moment it changes).
  await page.goto(new URL("/settings", base).href, { waitUntil: "networkidle" })
  const opponentTurn = page.getByRole("region", { name: "Gegnerzug" })
  const normal = opponentTurn.getByRole("radio", { name: /^Normal/ })
  const stepwise = opponentTurn.getByRole("switch", { name: "Nach jeder Gegneraktion warten" })
  await normal.waitFor()
  const defaults = { normal: await normal.getAttribute("aria-checked"), stepwise: await stepwise.getAttribute("aria-checked") }
  report["opponentTurnDefaults"] = defaults
  check(defaults.normal === "true" && defaults.stepwise === "false", `a fresh profile starts at Normal without waiting ${JSON.stringify(defaults)}`)
  await stepwise.click()
  for (let attempt = 0; attempt < 50 && (await stepwise.getAttribute("aria-checked")) !== "true"; attempt++) await page.waitForTimeout(100)
  check((await stepwise.getAttribute("aria-checked")) === "true", "waiting after every action switched on")
  await shot("settings-opponent-turn")

  log("card data and Arena decks")
  await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
  const imported: string[] = []
  for (const [name, list] of Object.entries(DECKS)) {
    await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
    await page.getByRole("link", { name: "Arena-Deck importieren" }).first().click()
    await page.getByRole("heading", { level: 1, name: "Arena-Deck importieren" }).waitFor()
    const needed = page.getByRole("region", { name: "Kartendaten nötig" })
    if (await needed.count()) {
      const started = Date.now()
      await needed.getByRole("button", { name: "Kartendaten einrichten" }).click()
      await needed.waitFor({ state: "detached", timeout: 300_000 })
      report["catalogInstallMs"] = Date.now() - started
    }
    await page.getByLabel("Liste im Arena-Format").fill(list)
    await page.getByRole("button", { name: "Liste prüfen" }).click()
    const summary = page.getByRole("region", { name: "Prüfbericht" })
    await summary.waitFor({ timeout: 60_000 })
    await summary.getByText("Alle Zeilen geklärt").waitFor({ timeout: 90_000 })
    await page.getByLabel("Name des Decks").fill(name)
    await page.getByRole("button", { name: "Deck speichern" }).click()
    await page.getByRole("heading", { level: 1, name: "Decks" }).waitFor()
    imported.push(name)
  }
  report["decks"] = imported

  log("a complete game against Forge's AI")
  await page.goto(new URL("/play", base).href, { waitUntil: "networkidle" })
  for (const [which, deck] of [["Dein Deck wählen", "Live Izzet"], ["Deck der KI wählen", "Live Rot"]] as const) {
    await page.getByRole("button", { name: which }).click()
    await page.getByRole("dialog", { name: which }).getByRole("button", { name: new RegExp(`^${deck}( gewählt)?$`) }).click()
    await overlaysGone()
  }
  const started = Date.now()
  await page.getByRole("button", { name: "Partie starten" }).first().click()
  await page.waitForURL(/\/play\/game$/)
  // The game itself: the readiness player (scripts/readiness/player.ts) plays it through the table - lands, spells,
  // targets, payments, attacks and blocks Forge offers - until Forge names the result.
  const forgeNotices: { at: number; text: string }[] = []
  // Prompt 50: a card of the start hand opened and swiped to the next one, as a thumb does (looking only).
  const swipeStartHand = async () => {
    const viewed = () => page.evaluate(() => ({ id: document.querySelector('[data-slot="card-view"]')?.getAttribute("data-card-view") ?? null, position: document.querySelector('[data-slot="card-view-position"]')?.textContent ?? null }))
    await page.locator('[data-slot="hand-spread"] [data-start-hand-card]').first().click()
    await page.locator('[data-slot="card-view"]').waitFor({ timeout: 10_000 })
    await page.waitForTimeout(600)
    const before = await viewed()
    const cdp = await context.newCDPSession(page)
    try {
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 })
      const box = await page.locator('[data-slot="card-lightbox-picture"]').boundingBox()
      if (box === null) throw new Error("the card view shows no card")
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 0 }] })
      for (let step = 1; step <= 10; step++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x - step * 14, y: from.y, id: 0 }] })
        await page.waitForTimeout(16)
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      await page.waitForTimeout(600)
    } finally {
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false }).catch(() => undefined)
      await cdp.detach().catch(() => undefined)
    }
    const after = await viewed()
    report["startHandSwipe"] = { before, after }
    check(/^1 von \d+$/.test(before.position ?? "") && /^2 von \d+$/.test(after.position ?? "") && after.id !== before.id, `a swipe in the start hand's card view moves to the next card ${JSON.stringify({ before, after })}`)
    await shot("live-start-hand-swipe")
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => document.querySelector('[data-slot="card-view"]') === null, undefined, { timeout: 10_000 }).catch(() => undefined)
  }
  const played = await playGame(page, {
    id: "live",
    seed: 31,
    touch: false,
    mulligan: false,
    maxMinutes: 30,
    stepwise: true,
    atStartHand: swipeStartHand,
    check: (condition, message) => {
      check(condition, message)
      return Boolean(condition)
    },
    shot,
    notices: forgeNotices,
  })
  report["game"] = {
    startMs: Date.now() - started,
    bootMs: played.bootMs,
    result: played.result,
    turns: played.turns,
    ms: played.ms,
    actions: played.actions,
    kinds: played.kinds,
    noEffect: played.noEffect,
    notices: forgeNotices.map((notice) => notice.text),
    pictures: played.pictures,
    observed: played.observed,
  }
  check(played.result !== null, `the game reached Forge's result (actions ${JSON.stringify(played.actions)})`)
  check((played.actions["land"] ?? 0) >= 1, "a land was played through the table")
  check(Object.keys(played.actions).some((name) => name.startsWith("cast:") || name.startsWith("respond:")), `a spell was cast through the table (actions ${JSON.stringify(played.actions)})`)
  check(played.pictures !== null && played.pictures.loaded > 0 && played.pictures.broken === 0, `Scryfall pictures under COEP ${JSON.stringify(played.pictures)}`)
  check(played.noEffect === 0, `every action changed the table (${played.noEffect} without effect)`)
  // Prompts 49-51 live: the AI's turn on the stage with cards, "Weiter" pressed there, the start hand opened by itself
  // and answered there, Forge's land count on the strip (the player checks these too; repeated here as the live gate).
  const observed = played.observed
  check(observed.steps > 0 && observed.withCards > 0, `the AI's turn was shown on the stage ${JSON.stringify(observed.kinds)}`)
  check(observed.stagePresses > 0, `"Weiter" on the stage moved the AI's turn on (${observed.stagePresses})`)
  check(observed.startHandOpened > 0 && observed.startHandAnswers > 0, `the start hand opened by itself and was answered there ${JSON.stringify({ opened: observed.startHandOpened, answers: observed.startHandAnswers })}`)
  check(observed.landChips.some((chip) => /^Länder \d+\/\d+/.test(chip)), `the strip showed Forge's land count ${JSON.stringify(observed.landChips)}`)
} catch (error) {
  failures.push(`aborted: ${(error as Error).message}`)
  await shot("aborted")
} finally {
  report["workers"] = { created: workers, maxAlive }
  report["scryfall"] = scryfall
  report["pageErrors"] = errors
  check(maxAlive <= 1, `at most one engine worker at a time (max ${maxAlive})`)
  check(scryfall.failed === 0, `Scryfall picture requests failed: ${scryfall.failed}`)
  check(errors.length === 0, `page errors: ${errors.join(" | ")}`)
  report["failures"] = failures
  report["finishedAt"] = new Date().toISOString()
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n")
  await browser.close()
  console.log(failures.length ? `LIVE CHECK FAILED (${failures.length}) - ${out}/report.json` : `LIVE CHECK OK - ${out}/report.json`)
  process.exitCode = failures.length ? 1 : 0
}
