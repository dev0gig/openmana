/*
 * Live check of a deployment (prompt 31, docs/DEPLOYMENT.md): a real Chrome on
 * the real address, nothing stubbed.
 *
 *   node scripts/deploy/live-check.ts [https://openmana.oryx.quest] [--out <report directory>]
 *
 * Checks: cross-origin isolation and SharedArrayBuffer; the card data install
 * from the deployment; two Arena lists imported; a complete game against
 * Forge's AI in the Forge WebAssembly engine, played through the table until
 * Forge names a result (keep, lands, spells Forge offers, attacks, blocks
 * declined, priority passed); Scryfall pictures under COEP; one engine worker
 * at a time; the legal documents naming the deployed commit. Writes
 * report.json and screenshots; exits non-zero on any failed check.
 */
import fs from "node:fs"
import path from "node:path"
import { chromium, type Locator, type Page } from "playwright-core"

const args = process.argv.slice(2)
const outIndex = args.indexOf("--out")
const out = path.resolve(outIndex >= 0 ? args[outIndex + 1]! : "reports/live")
const base = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--out") ?? "https://openmana.oryx.quest"
fs.mkdirSync(path.join(out, "screens"), { recursive: true })

const report: Record<string, unknown> = { base, startedAt: new Date().toISOString() }
const failures: string[] = []
function check(condition: unknown, message: string) { if (!condition) { failures.push(message); console.log(`  FAIL ${message}`) } }
const log = (message: string) => console.log(`[live] ${message}`)
const ARMED_AFTER_MS = 600

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
  const decision = page.getByRole("region", { name: "Entscheidung" })
  const answers = decision.getByRole("group", { name: "Antworten, die Forge anbietet" })
  const hand = page.getByRole("region", { name: "Deine Hand" })
  const result = page.getByRole("heading", { level: 2, name: /^(Gewonnen|Verloren|Unentschieden)$/ })
  const presses: Record<string, number> = {}
  const count = (name: string) => { presses[name] = (presses[name] ?? 0) + 1 }
  let bootMs: number | null = null
  let pictures: { loaded: number; broken: number } | null = null

  /** Presses an armed, enabled button of Forge's answers; true if one was found. */
  async function pressFirst(names: readonly (string | RegExp)[], scope: Locator = answers): Promise<boolean> {
    for (const name of names) {
      const button = scope.getByRole("button", { name, exact: typeof name === "string" })
      if ((await button.count()) && (await button.first().isEnabled())) {
        await page.waitForTimeout(ARMED_AFTER_MS)
        await button.first().click()
        count(String(name))
        return true
      }
    }
    return false
  }
  /** Opens a hand card's view and takes Forge's offer if its words match; closes it otherwise. */
  async function useFromHand(card: Locator, offer: RegExp): Promise<boolean> {
    await card.click()
    const view = page.getByRole("dialog")
    await view.waitFor()
    const button = view.getByRole("button", { name: offer })
    if ((await button.count()) === 1 && (await button.isEnabled())) {
      await page.waitForTimeout(ARMED_AFTER_MS)
      await button.click()
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 30_000 })
      return true
    }
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 30_000 })
    return false
  }

  let landThisTurn = ""
  for (let step = 0; step < 900 && Date.now() - started < 30 * 60_000; step++) {
    const waiting = decision.getByRole("heading", { name: "Forge wartet auf deine Entscheidung" })
    await Promise.race([waiting.waitFor({ timeout: 300_000 }), result.waitFor({ timeout: 300_000 })])
    if (await result.count()) break
    if (bootMs === null) { bootMs = Date.now() - started; await shot("first-decision") }
    const question = await decision.locator('[data-slot="game-decision"]').getAttribute("data-question")
    const kind = (((await decision.locator('[data-slot="game-decision-header"] p').first().textContent()) ?? "").split(" · ")[0] ?? "").trim()
    const turn = ((await page.getByRole("region", { name: "Spielstand" }).textContent()) ?? "").slice(0, 40)
    let acted = false
    if (kind === "Priorität") {
      const playable = hand.locator('button[data-slot="game-card"][aria-label$=", spielbar"]')
      if (landThisTurn !== turn) {
        for (let i = 0; i < (await playable.count()) && !acted; i++) if (await useFromHand(playable.nth(i), /^Spiele ein Land$/)) { acted = true; landThisTurn = turn; count("land") }
      }
      for (let i = 0; i < (await playable.count()) && !acted; i++) if (await useFromHand(playable.nth(i), /^(Wirke|Spiele|Beschwöre)/)) { acted = true; count("spell") }
      if (!acted) acted = await pressFirst(["Weiter", "Verrechnen lassen", "OK"])
    } else if (kind === "Auswahl" || kind === "Ziel wählen" || kind.startsWith("Ziel")) {
      // A target or a choice: the AI's side first (its seat or a marked card), else whatever Forge marks usable.
      const aiSeat = page.locator('[data-slot="game-player"][data-mark="usable"], button[data-slot="game-player"][data-mark="usable"]').first()
      const usable = page.locator('button[data-slot="game-card"][data-mark="usable"]').first()
      if (await aiSeat.count()) { await page.waitForTimeout(ARMED_AFTER_MS); await aiSeat.click(); count("target-player"); acted = true }
      else if (await usable.count()) { await page.waitForTimeout(ARMED_AFTER_MS); await usable.click(); count("choose-card"); acted = true }
      if (!acted) acted = await pressFirst(["OK", "Weiter", "Abbrechen"])
    } else {
      acted = await pressFirst(["Spielen", "Behalten", "Alle angreifen", /^Mit \d+ Kreaturen? angreifen$/, "Nicht angreifen", "Nicht blocken", "Blocks bestätigen", "Auto", "OK", "Weiter", "Ja", "Verrechnen lassen"])
    }
    // Revealed cards and other lists Forge only shows come with their own OK inside the decision.
    if (!acted) acted = await pressFirst(["OK", "Weiter"], decision)
    if (!acted) {
      // A question kind this check does not answer: Forge's first enabled button keeps the game going.
      const any = answers.getByRole("button")
      for (let i = 0; i < (await any.count()) && !acted; i++) if (await any.nth(i).isEnabled()) { await page.waitForTimeout(ARMED_AFTER_MS); await any.nth(i).click(); count(`other:${kind}`); acted = true }
    }
    if (!acted) { check(false, `no way on in "${kind}"`); await shot("stuck"); break }
    if (pictures === null && (presses["land"] ?? 0) >= 2) {
      pictures = await page.evaluate(() => {
        const images = [...document.querySelectorAll("img")].filter((img) => img.src.includes("scryfall.io"))
        return { loaded: images.filter((img) => img.complete && img.naturalWidth > 0).length, broken: images.filter((img) => img.complete && img.naturalWidth === 0).length }
      })
      await shot("table")
    }
    await page.waitForFunction((before) => {
      const current = document.querySelector('[data-slot="game-decision"]')?.getAttribute("data-question")
      return current !== before || !!document.querySelector("h2")?.textContent?.match(/^(Gewonnen|Verloren|Unentschieden)$/)
    }, question, { timeout: 300_000 }).catch(() => undefined)
  }
  const ended = (await result.count()) ? ((await result.first().textContent()) ?? "").trim() : null
  await shot("result")
  report["game"] = { bootMs, result: ended, ms: Date.now() - started, presses, pictures }
  check(ended !== null, `the game reached Forge's result (presses ${JSON.stringify(presses)})`)
  check((presses["land"] ?? 0) >= 1, "a land was played through the table")
  check(pictures !== null && pictures.loaded > 0 && pictures.broken === 0, `Scryfall pictures under COEP ${JSON.stringify(pictures)}`)
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
