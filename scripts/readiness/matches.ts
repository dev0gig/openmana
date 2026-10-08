/*
 * Readiness matches (prompt 32, docs/READINESS.md): complete games against
 * Forge's AI through the real user interface, in real Chrome with the real
 * Forge WebAssembly engine - nothing stubbed, nothing sent past the table.
 *
 *   node scripts/readiness/matches.ts --serve <built dist> --out <new report dir> [--games a,b] [--keep-going]
 *   node scripts/readiness/matches.ts --base https://openmana.oryx.quest --out <dir> --games live
 *
 * With --serve the build is served by `vite preview` (the repository's
 * configuration: isolation headers, engine and catalog checked again); select
 * the build's engine and catalog with OPENMANA_ENGINE_DIR/OPENMANA_CARDS_DIR as
 * for the build. The browser profile lives in <out>/profile.
 *
 * The flow, as a player would take it:
 *  1. The card data installed from the import page; Arena lists pasted,
 *     checked and saved; every saved deck read back from IndexedDB
 *     (name, list kept unchanged, card count, format).
 *  2. The browser closed and opened again with the same profile: the decks
 *     are still there (Bible §19.3).
 *  3. Per game: the decks and Forge's AI profile chosen on the play page (the
 *     card language in the settings), the game started, then played to Forge's
 *     result. The player acts only where the table offers it: lands and
 *     spells through the card view's button (Forge's action words), targets
 *     and choices Forge marks, payments (Forge's Auto, a land tapped by hand,
 *     floating mana, life), attackers and blockers Forge marks, Forge's
 *     buttons; every other kind of question through its own controls. The
 *     policy is deterministic per game (a seed), not an AI of its own; it
 *     plays to exercise the paths, not to win.
 *  4. After the game: Forge's history (actors and kinds), the original
 *     recording in IndexedDB (finished header with Forge's result, gap-free
 *     reception order, the message types of a whole game, the player's
 *     inputs), the snapshot replay stepped to its end without sending
 *     anything, and the recording's portable JSON loaded into a second,
 *     fresh browser profile and replayed there.
 *
 * Watched all the time: page errors, Forge's notices (input.rejected among
 * them), at most one engine worker at a time, Scryfall pictures under COEP,
 * a player action Forge did not take (the table unchanged afterwards, or
 * input.rejected in the recording).
 * Writes <out>/report.json and screenshots; exits non-zero on any failure.
 */
import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { chromium, type BrowserContext, type Page } from "playwright-core"
import { playGame, type PlayResult } from "./player.ts"

// ── Arguments ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function option(name: string): string | null {
  const index = args.indexOf(name)
  return index >= 0 ? (args[index + 1] ?? null) : null
}
const root = path.resolve(import.meta.dirname, "../..")
const outArg = option("--out")
if (outArg === null) throw new Error("--out <new report directory> is required")
const out = path.resolve(outArg)
if (fs.existsSync(out)) throw new Error(`${out} exists; every run gets a new report directory`)
fs.mkdirSync(path.join(out, "screens"), { recursive: true })
const serveDir = option("--serve")
const baseArg = option("--base")
if ((serveDir === null) === (baseArg === null)) throw new Error("give exactly one of --serve <dist> or --base <url>")
const keepGoing = args.includes("--keep-going")
const onlyGames = option("--games")?.split(",").map((name) => name.trim()).filter(Boolean) ?? null

// ── Report ─────────────────────────────────────────────────────────────────

const report: Record<string, unknown> = { startedAt: new Date().toISOString(), args }
const failures: string[] = []
function check(condition: unknown, message: string): boolean {
  if (!condition) {
    failures.push(message)
    console.log(`  FAIL ${message}`)
  }
  return Boolean(condition)
}
const log = (message: string) => console.log(`[readiness ${new Date().toISOString().slice(11, 19)}] ${message}`)
function writeReport(): void {
  report["failures"] = failures
  report["finishedAt"] = new Date().toISOString()
  fs.writeFileSync(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`)
}

// ── Decks (Arena format, as a player pastes them) ──────────────────────────

interface DeckSpec {
  readonly name: string
  readonly list: string
  readonly format: "constructed" | "commander"
  readonly cards: number
}

const lines = (...entries: string[]) => entries.join("\n")

const DECKS: Readonly<Record<string, DeckSpec>> = {
  rakdos: {
    name: "Prüfung Rakdos Ziele",
    format: "constructed",
    cards: 60,
    // Targets on players and creatures, two targets, divided damage, modes, X, kicker, Phyrexian life, floating mana,
    // a sacrifice as cost.
    list: lines("Deck", "12 Mountain", "12 Swamp", "4 Raging Goblin", "3 Goblin Piker", "3 Hill Giant", "4 Dark Ritual", "4 Gitaxian Probe", "3 Dismember", "4 Arc Trail", "2 Forked Bolt", "3 Kolaghan's Command", "2 Blaze", "2 Village Rites", "2 Burst Lightning"),
  },
  gw: {
    name: "Prüfung Grün-Weiß",
    format: "constructed",
    cards: 60,
    list: lines("Deck", "12 Forest", "12 Plains", "4 Llanowar Elves", "4 Centaur Courser", "4 Watchwolf", "4 Loxodon Smiter", "4 Serra Angel", "4 Thragtusk", "4 Giant Growth", "2 Blossoming Defense", "4 Swords to Plowshares", "2 Ajani Goldmane"),
  },
  ub: {
    name: "Prüfung Blau-Schwarz Kontrolle",
    format: "constructed",
    cards: 60,
    // Answers on the AI's turn (counterspells, removal at instant speed), scry, cards put back in any order and a
    // "you may shuffle" (Ponder), a big trigger.
    list: lines("Deck", "13 Island", "11 Swamp", "4 Spectral Sailor", "4 Brineborn Cutthroat", "4 Vampire Nighthawk", "2 Frost Titan", "3 Opt", "4 Counterspell", "4 Mana Leak", "3 Essence Scatter", "2 Ponder", "4 Doom Blade", "2 Hero's Downfall"),
  },
  redAggro: {
    name: "Prüfung Rot Aggro",
    format: "constructed",
    cards: 60,
    list: lines("Deck", "20 Mountain", "4 Goblin Guide", "4 Monastery Swiftspear", "4 Ember Hauler", "4 Keldon Raider", "4 Hellrider", "4 Lightning Bolt", "4 Shock", "4 Lightning Strike", "4 Searing Spear", "4 Brute Force"),
  },
  greenMixed: {
    name: "Prüfung Grün Deutsch-Englisch",
    format: "constructed",
    cards: 60,
    // German names (Wald, Riesenwuchs, Llanowarelfen …) and cards Scryfall has no German text for (Barbary Apes,
    // Hornet Cobra, Zodiac Tiger) or no German picture for (Wyluli Wolf, Krosan Wayfarer, Aurochs): the DE→EN fallback.
    list: lines(
      "Deck",
      "22 Wald",
      "4 Llanowarelfen",
      "4 Barbary Apes",
      "4 Hornet Cobra",
      "4 Zodiac Tiger",
      "4 Wyluli Wolf",
      "2 Krosan Wayfarer",
      "4 Aurochs",
      "4 Riesenwuchs",
      "4 Wucherndes Wachstum (M10) 201",
      "4 Giant Spider",
    ),
  },
  grixis: {
    name: "Prüfung Grixis",
    format: "constructed",
    cards: 60,
    // Scry (Opt, Magma Jet), cards back in any order and "you may shuffle" (Ponder), a "you may" trigger (Gravedigger),
    // X spells (Blaze, Fireball: X and damage divided), Phyrexian mana (Gitaxian Probe, Phyrexian Rager's life loss).
    list: lines("Deck", "8 Island", "8 Mountain", "8 Swamp", "4 Opt", "4 Magma Jet", "4 Ponder", "4 Gravedigger", "3 Blaze", "3 Fireball", "4 Lightning Bolt", "4 Hill Giant", "3 Phyrexian Rager", "3 Gitaxian Probe"),
  },
  greenAttackers: {
    name: "Prüfung Grün Angreifer",
    format: "constructed",
    cards: 60,
    list: lines("Deck", "20 Forest", "4 Llanowar Elves", "4 Wall of Wood", "4 Grizzly Bears", "4 Runeclaw Bear", "4 Centaur Courser", "4 Kalonian Tusker", "4 Trained Armodon", "4 Giant Spider", "4 Giant Growth", "4 Rampant Growth"),
  },
  greenWalkers: {
    name: "Prüfung Grün Planeswalker",
    format: "constructed",
    cards: 60,
    list: lines("Deck", "22 Forest", "4 Llanowar Elves", "4 Garruk Wildspeaker", "4 Nissa, Voice of Zendikar", "4 Grizzly Bears", "4 Centaur Courser", "4 Giant Spider", "4 Kalonian Tusker", "4 Rampant Growth", "2 Craw Wurm", "4 Wall of Wood"),
  },
  red: {
    name: "Prüfung Rot",
    format: "constructed",
    cards: 60,
    list: lines("Deck", "22 Mountain", "4 Raging Goblin", "4 Goblin Raider", "4 Goblin Piker", "4 Gray Ogre", "4 Hill Giant", "4 Canyon Minotaur", "2 Fire Elemental", "4 Shock", "4 Lightning Bolt", "4 Volcanic Hammer"),
  },
  krenko: {
    name: "Prüfung Commander Krenko",
    format: "commander",
    cards: 100,
    list: lines(
      "Commander",
      "1 Krenko, Tin Street Kingpin",
      "",
      "Deck",
      "1 Lightning Bolt", "1 Shock", "1 Magma Jet", "1 Volcanic Hammer", "1 Raging Goblin", "1 Goblin Piker", "1 Goblin Raider", "1 Gray Ogre", "1 Hill Giant",
      "1 Canyon Minotaur", "1 Goblin Guide", "1 Monastery Swiftspear", "1 Ember Hauler", "1 Keldon Raider", "1 Hellrider", "1 Lightning Strike", "1 Searing Spear",
      "1 Brute Force", "1 Fire Elemental", "1 Burst Lightning", "1 Fiery Impulse", "1 Arc Trail", "1 Abrade", "1 Faithless Looting", "1 Goblin Arsonist",
      "1 Bonecrusher Giant", "1 Fiery Confluence", "1 Skewer the Critics", "1 Lava Spike", "1 Rift Bolt",
      "69 Mountain",
    ),
  },
  fynn: {
    name: "Prüfung Commander Fynn",
    format: "commander",
    cards: 100,
    list: lines(
      "Commander",
      "1 Fynn, the Fangbearer",
      "",
      "Deck",
      "1 Llanowar Elves", "1 Grizzly Bears", "1 Runeclaw Bear", "1 Kalonian Tusker", "1 Centaur Courser", "1 Trained Armodon", "1 Giant Spider", "1 Craw Wurm",
      "1 Giant Growth", "1 Rampant Growth", "1 Wall of Wood", "1 Garruk Wildspeaker", "1 Nissa, Voice of Zendikar", "1 Colossal Dreadmaw", "1 Primal Huntbeast",
      "1 Garruk's Companion", "1 Nessian Courser", "1 Elvish Mystic", "1 Cultivate", "1 Kodama's Reach", "1 Thragtusk", "1 Blossoming Defense",
      "1 Titanic Growth", "1 Prey Upon", "1 Plummet",
      "74 Forest",
    ),
  },
}

// ── Games ──────────────────────────────────────────────────────────────────

interface GameSpec {
  readonly id: string
  readonly title: string
  readonly human: keyof typeof DECKS
  readonly ai: keyof typeof DECKS
  /** The AI profile's German name as the play page lists it, or "Zufällig". */
  readonly profile: string
  readonly cardLanguage: "Deutsch" | "Englisch"
  readonly viewport: { readonly width: number; readonly height: number; readonly touch: boolean }
  readonly seed: number
  /** Take one mulligan (London: then cards to the bottom). */
  readonly mulligan: boolean
  readonly maxMinutes: number
}

const DESKTOP = { width: 1440, height: 900, touch: false }
const PHONE = { width: 412, height: 915, touch: true }
const FOLD_LANDSCAPE = { width: 829, height: 690, touch: true }

const GAMES: readonly GameSpec[] = [
  { id: "rakdos", title: "Rakdos-Ziele gegen Grün-Weiß (Standard)", human: "rakdos", ai: "gw", profile: "Standard", cardLanguage: "Deutsch", viewport: DESKTOP, seed: 1, mulligan: true, maxMinutes: 45 },
  { id: "control", title: "Blau-Schwarz-Kontrolle gegen Rot-Aggro (Waghalsig)", human: "ub", ai: "redAggro", profile: "Waghalsig", cardLanguage: "Englisch", viewport: DESKTOP, seed: 2, mulligan: false, maxMinutes: 45 },
  { id: "commander", title: "Commander Krenko gegen Fynn (Vorsichtig), lange Partie", human: "krenko", ai: "fynn", profile: "Vorsichtig", cardLanguage: "Deutsch", viewport: DESKTOP, seed: 3, mulligan: false, maxMinutes: 90 },
  { id: "phone", title: "Grün Deutsch/Englisch gegen Rot (Experimentell), Handy mit Touch", human: "greenMixed", ai: "red", profile: "Experimentell", cardLanguage: "Deutsch", viewport: PHONE, seed: 4, mulligan: false, maxMinutes: 45 },
  { id: "walkers", title: "Grüne Angreifer gegen Planeswalker (Standard)", human: "greenAttackers", ai: "greenWalkers", profile: "Standard", cardLanguage: "Deutsch", viewport: DESKTOP, seed: 6, mulligan: false, maxMinutes: 45 },
  { id: "grixis", title: "Grixis gegen Grün-Weiß (Standard): Vorschau, X-Zauber, Kann-Fähigkeiten", human: "grixis", ai: "gw", profile: "Standard", cardLanguage: "Deutsch", viewport: DESKTOP, seed: 8, mulligan: false, maxMinutes: 45 },
  { id: "fold", title: "Planeswalker gegen Rakdos-Ziele (Zufällig), Foldable quer mit Touch", human: "greenWalkers", ai: "rakdos", profile: "Zufällig", cardLanguage: "Deutsch", viewport: FOLD_LANDSCAPE, seed: 7, mulligan: true, maxMinutes: 45 },
  { id: "live", title: "Live: Rakdos-Ziele gegen Rot (Zufällig)", human: "rakdos", ai: "red", profile: "Zufällig", cardLanguage: "Deutsch", viewport: DESKTOP, seed: 5, mulligan: false, maxMinutes: 45 },
]


// ── Browser ────────────────────────────────────────────────────────────────

const executablePath = process.env["OPENMANA_CHROME"] || chromium.executablePath()
const profileDir = path.join(out, "profile")

interface Watch {
  /** Every host a request went to (no Odin, no Tailscale: Bible §19.1). */
  readonly hosts: Set<string>
  readonly errors: string[]
  readonly notices: { readonly at: number; readonly text: string }[]
  workers: { created: number; alive: number; max: number }
  readonly scryfall: { ok: number; failed: number }
}

function watch(page: Page, into: Watch): void {
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.protocol === "http:" || url.protocol === "https:") into.hosts.add(url.host)
  })
  page.on("pageerror", (error) => into.errors.push(error.message))
  page.on("worker", (worker) => {
    into.workers.created++
    into.workers.alive++
    into.workers.max = Math.max(into.workers.max, into.workers.alive)
    worker.on("close", () => {
      into.workers.alive--
    })
  })
  page.on("response", (response) => {
    if (new URL(response.url()).host === "cards.scryfall.io") {
      if (response.ok()) into.scryfall.ok++
      else into.scryfall.failed++
    }
  })
  page.on("requestfailed", (request) => {
    // A picture the browser dropped because the card left the screen (ERR_ABORTED) is no failure of Scryfall's.
    if (new URL(request.url()).host === "cards.scryfall.io" && !(request.failure()?.errorText ?? "").includes("ERR_ABORTED")) into.scryfall.failed++
  })
}

function newWatch(): Watch {
  return { hosts: new Set(), errors: [], notices: [], workers: { created: 0, alive: 0, max: 0 }, scryfall: { ok: 0, failed: 0 } }
}

async function openProfile(viewport: GameSpec["viewport"], dir = profileDir): Promise<BrowserContext> {
  return chromium.launchPersistentContext(dir, {
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    isMobile: viewport.touch,
    deviceScaleFactor: viewport.touch ? 2.625 : 1,
    acceptDownloads: true,
  })
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(out, "screens", `${name}.png`) }).catch(() => undefined)
}

async function overlaysGone(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"]'), undefined, { timeout: 30_000 })
}

/** Every record of these stores of the app's database, read past the app (the browser's own IndexedDB). */
function dumpDatabase(page: Page, stores: readonly string[]): Promise<Record<string, unknown[]>> {
  return page.evaluate(async (names) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("openmana")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const result: Record<string, unknown[]> = {}
    for (const name of names) {
      if (!db.objectStoreNames.contains(name)) continue
      result[name] = await new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll()
        request.onsuccess = () => resolve(request.result as unknown[])
        request.onerror = () => reject(request.error)
      })
    }
    db.close()
    return result
  }, stores)
}

// ── 1. Card data and decks ─────────────────────────────────────────────────

interface StoredDeck {
  readonly id: string
  readonly name: string
  readonly format: string
  readonly source: { readonly text: string }
  readonly main: readonly { readonly count: number; readonly name: string }[]
  readonly sideboard?: readonly { readonly count: number; readonly name: string }[]
  readonly commander?: readonly { readonly count: number; readonly name: string }[]
}

async function importDecks(page: Page, base: string, names: readonly (keyof typeof DECKS)[]): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  for (const key of names) {
    const spec = DECKS[key]!
    await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
    await page.getByRole("link", { name: "Arena-Deck importieren" }).first().click()
    await page.getByRole("heading", { level: 1, name: "Arena-Deck importieren" }).waitFor()
    const needed = page.getByRole("region", { name: "Kartendaten nötig" })
    if (await needed.count()) {
      const started = Date.now()
      await needed.getByRole("button", { name: "Kartendaten einrichten" }).click()
      await needed.waitFor({ state: "detached", timeout: 300_000 })
      report["catalogInstallMs"] = Date.now() - started
      log(`card data installed in ${Date.now() - started} ms`)
    }
    const started = Date.now()
    await page.getByLabel("Liste im Arena-Format").fill(spec.list)
    await page.getByRole("button", { name: "Liste prüfen" }).click()
    const summary = page.getByRole("region", { name: "Prüfbericht" })
    await summary.waitFor({ timeout: 60_000 })
    const settled = await summary.getByText("Alle Zeilen geklärt").waitFor({ timeout: 120_000 }).then(() => true, () => false)
    if (!check(settled, `import ${spec.name}: not every line resolved (${((await summary.textContent()) ?? "").slice(0, 300)})`)) {
      await shot(page, `import-${key}`)
      continue
    }
    await page.getByLabel("Name des Decks").fill(spec.name)
    await page.getByRole("button", { name: "Deck speichern" }).click()
    await page.getByRole("heading", { level: 1, name: "Decks" }).waitFor()
    results[key] = { ms: Date.now() - started }
  }
  // Read back from IndexedDB: the list unchanged, every card counted, the format.
  const decks = ((await dumpDatabase(page, ["decks"]))["decks"] ?? []) as StoredDeck[]
  for (const key of names) {
    const spec = DECKS[key]!
    const deck = decks.find((candidate) => candidate.name === spec.name)
    if (!check(deck !== undefined, `IndexedDB has no deck "${spec.name}"`)) continue
    const count = [...deck!.main, ...(deck!.commander ?? [])].reduce((sum, entry) => sum + entry.count, 0)
    check(deck!.source.text === spec.list, `${spec.name}: the imported list is not kept unchanged`)
    check(count === spec.cards, `${spec.name}: ${count} cards stored, the list has ${spec.cards}`)
    check(deck!.format === spec.format, `${spec.name}: format ${deck!.format}, expected ${spec.format}`)
    results[key] = { ...(results[key] as object), id: deck!.id, stored: count, format: deck!.format, entries: deck!.main.length, names: deck!.main.map((entry) => entry.name).slice(0, 40) }
  }
  return results
}

// ── 2. Choosing for a game ─────────────────────────────────────────────────

async function chooseForGame(page: Page, base: string, game: GameSpec): Promise<void> {
  // The card language is a setting (chosen once, not in the start path).
  await page.goto(new URL("/settings", base).href, { waitUntil: "networkidle" })
  const languages = page.getByRole("radiogroup", { name: "Kartensprache" })
  const language = languages.getByRole("radio", { name: new RegExp(`^${game.cardLanguage}`) })
  await language.waitFor()
  if ((await language.getAttribute("aria-checked")) !== "true") await language.click()
  for (let attempt = 0; attempt < 50 && (await language.getAttribute("aria-checked")) !== "true"; attempt++) await page.waitForTimeout(100)
  check((await language.getAttribute("aria-checked")) === "true", `${game.id}: card language ${game.cardLanguage} not chosen`)

  await page.goto(new URL("/play", base).href, { waitUntil: "networkidle" })
  for (const [which, deck] of [["Dein Deck wählen", DECKS[game.human]!.name], ["Deck der KI wählen", DECKS[game.ai]!.name]] as const) {
    await page.getByRole("button", { name: which }).click()
    await page.getByRole("dialog", { name: which }).getByRole("button", { name: new RegExp(`^${deck}( gewählt)?$`) }).click()
    await overlaysGone(page)
  }
  await page.getByRole("button", { name: "KI-Profil ändern" }).click()
  const dialog = page.getByRole("dialog", { name: "KI-Profil wählen" })
  const radio = dialog.getByRole("radiogroup", { name: "KI-Profil" }).getByRole("radio", { name: new RegExp(`^${game.profile}`) }).first()
  await radio.click()
  for (let attempt = 0; attempt < 50 && (await radio.getAttribute("aria-checked")) !== "true"; attempt++) await page.waitForTimeout(100)
  check((await radio.getAttribute("aria-checked")) === "true", `${game.id}: AI profile ${game.profile} not chosen`)
  await dialog.getByRole("button", { name: "Fertig" }).click()
  await overlaysGone(page)
}


// ── 4. After the game: history, recording, replay ──────────────────────────

interface MatchHeader {
  readonly id: string
  readonly status: string
  readonly end: { readonly result?: string; readonly winner?: unknown; readonly turn?: number } | null
  readonly endedAt: string | null
  readonly seed: number
  readonly engine: { readonly manifestSha256?: string }
  readonly human: { readonly deck: { readonly name: string } }
  readonly ai: { readonly profile?: string; readonly name: string }
}

async function afterGame(page: Page, base: string, game: GameSpec, played: PlayResult): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  // Forge's history of the finished game is still in the session.
  const historyButton = page.getByRole("button", { name: "Spielverlauf ansehen", exact: true })
  if (await historyButton.count()) {
    await historyButton.first().click()
    const history = page.getByRole("dialog", { name: "Spielverlauf", exact: true })
    await history.waitFor()
    const history_ = await history.locator("[data-history-entry]").evaluateAll((entries) => {
      const byActor: Record<string, Record<string, number>> = {}
      for (const entry of entries as HTMLElement[]) {
        const actor = entry.dataset["historyActor"] ?? "unassigned"
        const kind = entry.dataset["historyKind"] ?? "?"
        byActor[actor] ??= {}
        byActor[actor][kind] = (byActor[actor][kind] ?? 0) + 1
      }
      return { entries: entries.length, byActor }
    })
    results["history"] = history_
    // Forge's AI played: its own lands and spells in Forge's log (structured actor, not words).
    const ai = history_.byActor["opponent"] ?? {}
    check((ai["LAND"] ?? 0) > 0 && (ai["STACK_ADD"] ?? 0) > 0, `${game.id}: Forge's log shows no land or spell of the AI (${JSON.stringify(ai)})`)
    await page.keyboard.press("Escape")
    await overlaysGone(page).catch(() => undefined)
  } else {
    results["history"] = "no history button after the game"
  }
  // The original recording.
  await page.waitForTimeout(500)
  const data = await dumpDatabase(page, ["matches", "matchLog"])
  const headers = (data["matches"] ?? []) as MatchHeader[]
  const header = headers.filter((candidate) => candidate.human.deck.name === DECKS[game.human]!.name).sort((a, b) => (a.endedAt ?? "").localeCompare(b.endedAt ?? "")).at(-1)
  if (!check(header !== undefined, `${game.id}: no recording`)) return results
  const log = ((data["matchLog"] ?? []) as { matchId: string; seq: number; from: string; message: { type: string } }[]).filter((entry) => entry.matchId === header!.id).sort((a, b) => a.seq - b.seq)
  check(header!.status === "finished", `${game.id}: recording status ${header!.status}`)
  check(header!.end !== null && header!.endedAt !== null, `${game.id}: the recording has no end`)
  check(log.every((entry, index) => entry.seq === index), `${game.id}: gap in the recording's reception order`)
  const types = [...new Set(log.map((entry) => entry.message.type))]
  for (const type of ["engine.ready", "match.start", "game.started", "state", "question", "events", "game.end", "match.finished"]) check(types.includes(type), `${game.id}: recording has no ${type}`)
  const rejected = log.filter((entry) => entry.message.type === "input.rejected").length
  check(rejected === 0, `${game.id}: Forge refused ${rejected} of the player's inputs (input.rejected in the recording)`)
  check(/^[0-9a-f]{64}$/.test(header!.engine.manifestSha256 ?? ""), `${game.id}: the engine manifest's SHA-256 is not recorded`)
  const shown = { Gewonnen: "win", Verloren: "loss", Unentschieden: "draw" }[String(played["result"])] ?? null
  check(shown !== null && header!.end?.result === shown, `${game.id}: the table said ${String(played["result"])}, the recording says ${String(header!.end?.result)}`)
  results["recording"] = { id: header!.id, status: header!.status, end: header!.end, seed: header!.seed, manifestSha256: header!.engine.manifestSha256, entries: log.length, inputs: log.filter((entry) => entry.from === "player").length, types }
  // The snapshot replay: to its end, sending nothing.
  await page.goto(new URL(`/matches/${header!.id}`, base).href, { waitUntil: "networkidle" })
  await page.getByRole("heading", { level: 1, name: "Wiedergabe" }).waitFor()
  const status = page.getByRole("status").filter({ hasText: /^Schritt \d+ von \d+$/ }).first()
  await status.waitFor()
  const first = ((await status.textContent()) ?? "").trim()
  await page.getByRole("button", { name: "Nächster Schritt" }).click()
  await page.getByRole("button", { name: "Wiedergabemenü" }).click()
  const menu = page.getByRole("dialog", { name: "Wiedergabe", exact: true })
  await menu.getByRole("button", { name: "Ende", exact: true }).click()
  await page.keyboard.press("Escape")
  await overlaysGone(page).catch(() => undefined)
  const last = ((await status.textContent()) ?? "").trim()
  const total = Number(/von (\d+)/.exec(first)?.[1] ?? 0)
  check(total > 1 && last === `Schritt ${total} von ${total}`, `${game.id}: the replay did not reach its end (${first} → ${last})`)
  const endTurn = Number(/Zug (\d+)/.exec((await page.getByRole("region", { name: "Spielstand" }).textContent()) ?? "")?.[1] ?? 0)
  check(endTurn >= Number(played["turns"]), `${game.id}: the replay's last state is turn ${endTurn}, the game reached turn ${String(played["turns"])}`)
  await shot(page, `${game.id}-replay-end`)
  const afterReplay = ((await dumpDatabase(page, ["matchLog"]))["matchLog"] ?? []).filter((entry) => (entry as { matchId: string }).matchId === header!.id)
  check(afterReplay.length === log.length, `${game.id}: the replay changed the recording (${log.length} → ${afterReplay.length})`)
  results["replay"] = { steps: total, endTurn }
  return results
}

/** The recording's portable JSON (Partien → JSON speichern), loaded into a second, empty profile and replayed there. */
async function portableReplay(page: Page, base: string, matchId: string): Promise<Record<string, unknown>> {
  await page.goto(new URL("/matches", base).href, { waitUntil: "networkidle" })
  const item = page.getByRole("list", { name: "Gespeicherte Partien" }).getByRole("listitem").filter({ has: page.locator(`a[href="/matches/${matchId}"]`) })
  const [download] = await Promise.all([page.waitForEvent("download"), item.getByRole("button", { name: "JSON speichern" }).click()])
  const file = path.join(out, `replay-${matchId}.json`)
  await download.saveAs(file)
  const bytes = fs.statSync(file).size
  const other = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] })
  try {
    const context = await other.newContext({ viewport: { width: 1440, height: 900 } })
    const fresh = await context.newPage()
    const errors: string[] = []
    fresh.on("pageerror", (error) => errors.push(error.message))
    await fresh.goto(new URL("/matches", base).href, { waitUntil: "networkidle" })
    await fresh.getByLabel("Wiedergabedatei").setInputFiles(file)
    const list = fresh.getByRole("list", { name: "Gespeicherte Partien" })
    await list.waitFor({ timeout: 60_000 })
    await list.getByRole("link", { name: "Ansehen" }).first().click()
    await fresh.getByRole("heading", { level: 1, name: "Wiedergabe" }).waitFor()
    const status = fresh.getByRole("status").filter({ hasText: /^Schritt \d+ von \d+$/ }).first()
    await status.waitFor()
    await fresh.getByRole("button", { name: "Wiedergabemenü" }).click()
    await fresh.getByRole("dialog", { name: "Wiedergabe", exact: true }).getByRole("button", { name: "Ende", exact: true }).click()
    await fresh.keyboard.press("Escape")
    const last = ((await status.textContent()) ?? "").trim()
    const [, at, of] = /Schritt (\d+) von (\d+)/.exec(last) ?? []
    check(at !== undefined && at === of, `portable replay: not at its end in the fresh profile (${last})`)
    check(errors.length === 0, `portable replay: page errors ${errors.join(" | ")}`)
    await shot(fresh, "portable-replay-end")
    return { file: path.basename(file), bytes, last }
  } finally {
    await other.close()
  }
}


// ── PWA, credits, memory ───────────────────────────────────────────────────

/** Chrome's own installability check in this real profile (not incognito), the manifest Chrome read, the service worker. */
async function pwaChecks(context: BrowserContext, page: Page): Promise<Record<string, unknown>> {
  const cdp = await context.newCDPSession(page)
  const manifest = (await cdp.send("Page.getAppManifest")) as { url: string; errors: { message: string }[] }
  const installability = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: { errorId: string }[] }
  // `ready` resolves with an active worker that may still be activating (it checks every byte of the shell first).
  const worker = await page.evaluate(async () => {
    const timeout = <T,>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))
    const ready = await Promise.race([navigator.serviceWorker.ready, timeout(60_000, null)])
    if (ready === null || ready.active === null) return null
    const active = ready.active
    if (active.state !== "activated") {
      await Promise.race([new Promise<void>((resolve) => active.addEventListener("statechange", () => active.state === "activated" && resolve())), timeout(120_000, undefined)])
    }
    return { scope: ready.scope, state: active.state }
  })
  check(manifest.errors.length === 0, `PWA: manifest errors ${JSON.stringify(manifest.errors)}`)
  check(installability.installabilityErrors.length === 0, `PWA: Chrome reports installability errors ${JSON.stringify(installability.installabilityErrors)}`)
  check(worker !== null && worker.state === "activated", `PWA: no active service worker (${JSON.stringify(worker)})`)
  await cdp.detach()
  return { manifestUrl: manifest.url, manifestErrors: manifest.errors, installabilityErrors: installability.installabilityErrors, serviceWorker: worker }
}

/** The credits name who made OpenMana possible and link the legal documents, which are served. */
async function creditsChecks(page: Page, base: string): Promise<Record<string, unknown>> {
  await page.goto(new URL("/credits", base).href, { waitUntil: "networkidle" })
  const text = (await page.locator("main").textContent()) ?? ""
  const named = ["Forge", "ManaBrew", "Scryfall", "OpenAI", "ChatGPT", "Anthropic", "Claude"].filter((name) => text.includes(name))
  check(named.length === 7, `credits name only ${named.join(", ")}`)
  const documents: Record<string, number> = {}
  for (const href of await page.locator('main a[href^="/legal/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))) {
    const response = await page.request.get(new URL(href, base).href)
    documents[href] = response.status()
    check(response.ok() && (await response.text()).length > 1000, `legal document ${href}: HTTP ${response.status()}`)
  }
  check(Object.keys(documents).length >= 3, `credits link ${Object.keys(documents).length} legal documents`)
  return { named, documents }
}

/**
 * What this browser profile's renderer processes take in memory now (resident set, Linux): the page and its
 * dedicated engine worker run there. Chrome's measureUserAgentSpecificMemory leaves the worker's heap out (it
 * reported 13 MB with Forge running), so the operating system's figure is used.
 */
function rendererMemory(): Promise<number | null> {
  return new Promise((resolve) => {
    execFile("ps", ["-eo", "rss=,args="], { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error) return resolve(null)
      let kib = 0
      for (const line of stdout.split("\n")) {
        const match = /^\s*(\d+)\s+(.*)$/.exec(line)
        if (match && match[2]!.includes(`--user-data-dir=${profileDir}`) && match[2]!.includes("--type=renderer")) kib += Number(match[1])
      }
      resolve(kib === 0 ? null : kib * 1024)
    })
  })
}

// ── Main ───────────────────────────────────────────────────────────────────

async function startServer(): Promise<{ base: string; close: () => Promise<void> }> {
  if (baseArg !== null) return { base: baseArg, close: async () => undefined }
  const { preview } = await import("vite")
  const server = await preview({ root, configFile: path.join(root, "vite.config.ts"), logLevel: "warn", build: { outDir: path.resolve(serveDir!) }, preview: { host: "127.0.0.1", port: 0 } })
  const base = server.resolvedUrls?.local[0]
  if (!base) throw new Error("vite preview did not report its URL")
  return { base, close: async () => { await server.close() } }
}

const server = await startServer()
const base = server.base
report["base"] = base
const selected = GAMES.filter((game) => (onlyGames === null ? game.id !== "live" : onlyGames.includes(game.id)))
report["games"] = {}
const gameReports = report["games"] as Record<string, unknown>
let exitCode = 0
try {
  log(`app at ${base}, Chrome at ${executablePath}`)
  // 1. Card data and decks.
  const needed = [...new Set(selected.flatMap((game) => [game.human, game.ai]))]
  let context = await openProfile(DESKTOP)
  let page = context.pages()[0] ?? (await context.newPage())
  const firstWatch = newWatch()
  watch(page, firstWatch)
  await page.goto(base, { waitUntil: "networkidle" })
  report["environment"] = await page.evaluate(() => ({ isolated: globalThis.crossOriginIsolated, sab: typeof SharedArrayBuffer, ua: navigator.userAgent }))
  report["browser"] = context.browser()?.version() ?? null
  check((report["environment"] as { isolated: boolean }).isolated === true, "the page is not cross-origin isolated")
  report["pwa"] = await pwaChecks(context, page)
  report["credits"] = await creditsChecks(page, base)
  report["decks"] = await importDecks(page, base, needed)
  await context.close()
  // 2. The same browser opened again: the decks are still there.
  context = await openProfile(DESKTOP)
  page = context.pages()[0] ?? (await context.newPage())
  await page.goto(new URL("/decks", base).href, { waitUntil: "networkidle" })
  const listed = await page.locator("main").textContent()
  const missing = needed.filter((key) => !(listed ?? "").includes(DECKS[key]!.name))
  check(missing.length === 0, `after reopening the browser the decks page misses ${missing.join(", ")}`)
  report["reopened"] = { decks: needed.length - missing.length, missing }
  await context.close()

  // 3./4. The games.
  for (const game of selected) {
    log(`game ${game.id}: ${game.title}`)
    const gameWatch = newWatch()
    const entry: Record<string, unknown> = { title: game.title, profile: game.profile, cardLanguage: game.cardLanguage, viewport: game.viewport }
    gameReports[game.id] = entry
    context = await openProfile(game.viewport)
    page = context.pages()[0] ?? (await context.newPage())
    watch(page, gameWatch)
    try {
      await chooseForGame(page, base, game)
      const startedAt = Date.now()
      await page.getByRole("button", { name: "Partie starten" }).first().click()
      await page.waitForURL(/\/play\/game$/)
      // The AI profile Forge confirmed (the table's opponent bar names it).
      await page.getByRole("heading", { name: "Forge wartet auf deine Entscheidung" }).waitFor({ timeout: 300_000 })
      const opponent = page.getByRole("region", { name: "Forge-KI", exact: true })
      const confirmed = ((await opponent.locator('[data-slot="badge"]').first().textContent()) ?? "").trim()
      entry["confirmedProfile"] = confirmed
      check(game.profile === "Zufällig" ? confirmed.endsWith(" (zufällig)") : confirmed === game.profile, `${game.id}: the table names AI profile "${confirmed}", chosen was ${game.profile}`)
      entry["startMs"] = Date.now() - startedAt
      const played = await playGame(page, {
        id: game.id,
        seed: game.seed,
        touch: game.viewport.touch,
        mulligan: game.mulligan,
        maxMinutes: game.maxMinutes,
        check,
        shot: (name) => shot(page, name),
        notices: gameWatch.notices,
        measureMemory: rendererMemory,
      })
      Object.assign(entry, played)
      check(played.result !== null, `${game.id}: the game did not reach Forge's result`)
      check(played.noEffect === 0, `${game.id}: ${played.noEffect} actions left the table unchanged`)
      Object.assign(entry, await afterGame(page, base, game, played))
      if (game.id === "commander" || (selected.length === 1 && entry["recording"])) {
        const recording = entry["recording"] as { id: string } | undefined
        if (recording) entry["portable"] = await portableReplay(page, base, recording.id)
      }
    } catch (error) {
      check(false, `${game.id}: aborted: ${(error as Error).message.split("\n")[0]}`)
      await shot(page, `${game.id}-aborted`)
      if (!keepGoing) throw error
    } finally {
      entry["hosts"] = [...gameWatch.hosts].sort()
      entry["pageErrors"] = gameWatch.errors
      entry["notices"] = gameWatch.notices.map((notice) => notice.text)
      entry["workers"] = gameWatch.workers
      entry["scryfall"] = gameWatch.scryfall
      check(gameWatch.errors.length === 0, `${game.id}: page errors ${gameWatch.errors.join(" | ")}`)
      check(gameWatch.workers.max <= 1, `${game.id}: ${gameWatch.workers.max} engine workers at once`)
      check(gameWatch.scryfall.failed === 0, `${game.id}: ${gameWatch.scryfall.failed} Scryfall picture requests failed`)
      writeReport()
      await context.close().catch(() => undefined)
    }
  }
} catch (error) {
  failures.push(`aborted: ${(error as Error).stack ?? String(error)}`)
} finally {
  writeReport()
  await server.close()
  exitCode = failures.length === 0 ? 0 : 1
  log(failures.length === 0 ? "all checks passed" : `${failures.length} failure(s):\n  ${failures.join("\n  ")}`)
}
process.exit(exitCode)
