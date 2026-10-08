/*
 * Live check of a deployment (prompt 31, docs/DEPLOYMENT.md): a real Chrome on
 * the real address, nothing stubbed.
 *
 *   node scripts/deploy/live-check.ts [https://openmana.oryx.quest] [--out <report directory>]
 *
 * Checks: cross-origin isolation and SharedArrayBuffer; the card data install
 * from the deployment; two Arena lists imported; a complete game against
 * Forge's AI in the Forge WebAssembly engine, played through the table until
 * Forge names a result by the readiness player (scripts/readiness/player.ts:
 * lands, spells, targets, payments, attacks and blocks Forge offers, every
 * input taken by Forge); Scryfall pictures under COEP; one engine worker at a
 * time; the legal documents naming the deployed commit. Writes report.json and
 * screenshots; exits non-zero on any failed check.
 */
import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright-core"
import { playGame } from "../readiness/player.ts"

const args = process.argv.slice(2)
const outIndex = args.indexOf("--out")
const out = path.resolve(outIndex >= 0 ? args[outIndex + 1]! : "reports/live")
const base = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--out") ?? "https://openmana.oryx.quest"
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
const scryfall = { ok: 0, failed: 0 }
page.on("response", (response) => { if (new URL(response.url()).host === "cards.scryfall.io") { if (response.ok()) scryfall.ok++; else scryfall.failed++ } })
page.on("requestfailed", (request) => { if (new URL(request.url()).host === "cards.scryfall.io") scryfall.failed++ })
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
  const played = await playGame(page, {
    id: "live",
    seed: 31,
    touch: false,
    mulligan: false,
    maxMinutes: 30,
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
  }
  check(played.result !== null, `the game reached Forge's result (actions ${JSON.stringify(played.actions)})`)
  check((played.actions["land"] ?? 0) >= 1, "a land was played through the table")
  check(Object.keys(played.actions).some((name) => name.startsWith("cast:") || name.startsWith("respond:")), `a spell was cast through the table (actions ${JSON.stringify(played.actions)})`)
  check(played.pictures !== null && played.pictures.loaded > 0 && played.pictures.broken === 0, `Scryfall pictures under COEP ${JSON.stringify(played.pictures)}`)
  check(played.noEffect === 0, `every action changed the table (${played.noEffect} without effect)`)
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
