/*
 * The readiness player (prompt 32, docs/READINESS.md): plays a complete game
 * against Forge's AI through the real game table, as a player would - only
 * where the table offers something, never past it:
 *
 *  - lands and spells through the card view's main button (Forge's own action
 *    words), abilities of the player's permanents Forge marks (once a turn),
 *    answers with an instant Forge offers while the AI's spell is on the stack;
 *  - targets and choices Forge marks (the AI's seat and cards first), cards to
 *    discard, cards for the bottom of the London mulligan;
 *  - payments: Forge's Auto, now and then a land Forge marks tapped by hand,
 *    floating mana, life for Phyrexian mana;
 *  - attackers and blockers Forge marks (also Alpha Strike, another defender,
 *    another block target), Forge's buttons;
 *  - every other kind of question through its own controls (choices, options,
 *    a list Forge shows, numbers, order, arrangement, distribution).
 *
 * The policy is deterministic per seed - not an AI of its own, it plays to
 * exercise the paths, not to win. Every send waits until the button is armed
 * (ARMING_MS). After every action the table must change (Forge took it); six
 * times the same table, no way on, or no question for ten minutes fail the
 * game. Used by scripts/readiness/matches.ts and scripts/deploy/live-check.ts.
 */
import type { Locator, Page } from "playwright-core"

/** Forge's send buttons and the card view's button ignore presses for 500 ms after they appear (ARMING_MS). */
export const ARMED_AFTER_MS = 650

export interface PlayOptions {
  /** Names the game in failures and screenshots. */
  readonly id: string
  /** The policy's random source (choices repeat with it). */
  readonly seed: number
  /** Taps instead of clicks (a touch screen). */
  readonly touch: boolean
  /** Take one mulligan (London: then cards to the bottom). */
  readonly mulligan: boolean
  readonly maxMinutes: number
  /** Records a failed expectation in the caller's report; returns the condition. */
  readonly check: (condition: unknown, message: string) => boolean
  /** Saves a screenshot under this name. */
  readonly shot: (name: string) => Promise<void>
  /** Forge's notices seen during the game (toasts), appended here. */
  readonly notices: { at: number; text: string }[]
  /** Measures what the page with its running engine takes in memory (bytes), once from turn 5; optional. */
  readonly measureMemory?: () => Promise<number | null>
}

export interface PlayResult extends GameStats {
  /** Forge's result as the table shows it ("Gewonnen", "Verloren", "Unentschieden"), null if none was reached. */
  readonly result: string | null
  /** The highest turn the table showed while Forge asked. */
  readonly turns: number
  readonly ms: number
  readonly bootMs: number | null
  readonly pictures: { readonly loaded: number; readonly broken: number } | null
  readonly languages: Record<string, unknown> | null
  /** The highest value `measureMemory` reported with the engine running (sampled every five turns from turn 5), bytes; null without it. */
  readonly memoryInGame: number | null
}

/** A small deterministic random source per game (mulberry32): the policy's choices repeat with the seed. */
export function randomSource(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface CardInfo {
  readonly id: number
  readonly label: string
  readonly mark: string | null
}

export interface TableView {
  readonly question: string | null
  readonly line: string
  readonly kind: string
  readonly text: string
  readonly answers: readonly { readonly name: string; readonly enabled: boolean; readonly meaning: string | null }[]
  readonly buttons: readonly { readonly name: string; readonly enabled: boolean }[]
  readonly phase: string | null
  readonly owner: string
  readonly turn: number
  readonly hand: readonly CardInfo[]
  readonly mine: readonly CardInfo[]
  readonly theirs: readonly CardInfo[]
  readonly players: readonly { readonly id: number; readonly label: string; readonly mark: string | null; readonly choice: boolean }[]
  readonly offTable: readonly CardInfo[]
  readonly radios: number
  readonly checkboxes: number
  readonly dialog: boolean
}

export function readTable(page: Page): Promise<TableView> {
  return page.evaluate(() => {
    const decision = document.querySelector('section[aria-label="Entscheidung"]')
    const content = decision?.querySelector('[data-slot="game-decision"]') ?? null
    const header = decision?.querySelectorAll('[data-slot="game-decision-header"] p') ?? []
    const line = (header[0]?.textContent ?? "").trim()
    const cards = (selector: string) =>
      [...document.querySelectorAll<HTMLElement>(selector)].map((element) => ({ id: Number(element.dataset["card"]), label: element.getAttribute("aria-label") ?? "", mark: element.dataset["mark"] ?? null }))
    const headerText = document.querySelector('section[aria-label="Spielstand"]')?.textContent ?? ""
    const group = decision?.querySelector('[role="group"][aria-label="Antworten, die Forge anbietet"]')
    return {
      question: content?.getAttribute("data-question") ?? null,
      line,
      kind: (line.split(" · ")[0] ?? "").trim(),
      text: (header[1]?.textContent ?? "").trim(),
      answers: [...(group?.querySelectorAll("button") ?? [])].map((button) => ({ name: (button.textContent ?? "").trim(), enabled: !(button as HTMLButtonElement).disabled, meaning: button.getAttribute("data-meaning") })),
      buttons: [...(decision?.querySelectorAll('[data-slot="game-decision-actions"] button') ?? [])].map((button) => ({ name: (button.getAttribute("aria-label") ?? button.textContent ?? "").trim(), enabled: !(button as HTMLButtonElement).disabled })),
      phase: document.querySelector('[data-slot="phase-track"]')?.getAttribute("data-phase") ?? null,
      owner: headerText.includes("Du bist am Zug") ? "me" : headerText.includes("Forge-KI am Zug") ? "ai" : "none",
      turn: Number(/Zug (\d+)/.exec(headerText)?.[1] ?? 0),
      hand: cards('section[aria-label="Deine Hand"] button[data-slot="game-card"][data-card]'),
      mine: cards('section[aria-label="Dein Spielfeld"] button[data-slot="game-card"][data-card]'),
      theirs: cards('section[aria-label="Spielfeld der Forge-KI"] button[data-slot="game-card"][data-card]'),
      players: [
        ...[...document.querySelectorAll<HTMLElement>('button[data-slot="game-player"][data-player]')].map((element) => ({ id: Number(element.dataset["player"]), label: element.getAttribute("aria-label") ?? "", mark: element.dataset["mark"] ?? null, choice: false })),
        ...[...(decision?.querySelectorAll<HTMLElement>("[data-player-choice]") ?? [])].map((element) => ({ id: Number(element.dataset["playerChoice"]), label: element.getAttribute("aria-label") ?? "", mark: element.dataset["mark"] ?? null, choice: true })),
      ],
      offTable: [...(decision?.querySelectorAll<HTMLElement>('[role="toolbar"][aria-label="Wählbare Karten, die nicht auf dem Tisch liegen"] button[data-item]') ?? [])].map((element) => ({ id: Number(element.dataset["item"]), label: element.getAttribute("aria-label") ?? "", mark: element.dataset["mark"] ?? null })),
      radios: decision?.querySelectorAll('[role="radio"]').length ?? 0,
      checkboxes: decision?.querySelectorAll('[role="checkbox"]').length ?? 0,
      dialog: document.querySelector('[role="dialog"],[role="alertdialog"]') !== null,
    }
  })
}

/** What changes when Forge takes an input: the decision, the marks, the zones, a notice. */
function fingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const decision = document.querySelector('section[aria-label="Entscheidung"]')
    const marks = [...document.querySelectorAll<HTMLElement>("[data-mark]")].map((element) => `${element.dataset["card"] ?? element.dataset["player"] ?? element.dataset["playerChoice"] ?? ""}:${element.dataset["mark"]}`).join(",")
    const tapped = [...document.querySelectorAll<HTMLElement>('[data-slot="game-card"][data-tapped="true"]')].length
    const regions = ["Deine Hand", "Dein Spielfeld", "Spielfeld der Forge-KI", "Stapel und Kampf", "Du", "Forge-KI", "Spielstand"].map((name) => document.querySelector(`section[aria-label="${name}"]`)?.textContent?.length ?? 0).join("/")
    return `${decision?.querySelector('[data-slot="game-decision"]')?.getAttribute("data-question")}|${decision?.textContent}|${marks}|${tapped}|${regions}|${document.querySelectorAll("[data-sonner-toast]").length}`
  })
}

export interface GameStats {
  kinds: Record<string, number>
  actions: Record<string, number>
  unanswered: string[]
  noEffect: number
}

export const RESULT = /^(Gewonnen|Verloren|Unentschieden)$/

export async function playGame(page: Page, game: PlayOptions): Promise<PlayResult> {
  const { check } = game
  const random = randomSource(game.seed)
  const touch = game.touch
  const decision = page.getByRole("region", { name: "Entscheidung" })
  const result = page.getByRole("heading", { level: 2, name: RESULT })
  const stats: GameStats = { kinds: {}, actions: {}, unanswered: [], noEffect: 0 }
  const count = (name: string) => {
    stats.actions[name] = (stats.actions[name] ?? 0) + 1
  }
  const activate = async (locator: Locator) => {
    if (touch) await locator.tap()
    else await locator.click()
  }
  const cardButton = (id: number) => page.locator(`button[data-slot="game-card"][data-card="${id}"]`).first()

  /** Presses a send button of the decision once armed. */
  const press = async (locator: Locator, name: string) => {
    await page.waitForTimeout(ARMED_AFTER_MS)
    await activate(locator)
    count(name)
  }
  const answerButton = (predicate: (button: TableView["answers"][number]) => boolean, view: TableView): Locator | null => {
    const index = view.answers.findIndex((button) => button.enabled && predicate(button))
    return index < 0 ? null : decision.getByRole("group", { name: "Antworten, die Forge anbietet" }).getByRole("button").nth(index)
  }
  const decisionButton = (name: string | RegExp) => decision.locator('[data-slot="game-decision-actions"]').getByRole("button", { name, exact: typeof name === "string" })

  /**
   * Opens a card's view (looking is safe) and presses its main button if its words pass `want`; closes the view
   * otherwise. Returns the words pressed, or null.
   */
  const throughView = async (id: number, want: (words: string) => boolean): Promise<string | null> => {
    await activate(cardButton(id))
    const view = page.getByRole("dialog")
    await view.waitFor({ timeout: 10_000 })
    const buttons = view.locator('[data-slot="sheet-footer"] button')
    let chosen: Locator | null = null
    let words: string | null = null
    for (let index = 0; index < (await buttons.count()); index++) {
      const text = ((await buttons.nth(index).textContent()) ?? "").trim()
      if (text !== "Schließen" && (await buttons.nth(index).isEnabled()) && want(text)) {
        chosen = buttons.nth(index)
        words = text
        break
      }
    }
    if (chosen === null) {
      await page.keyboard.press("Escape")
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 10_000 }).catch(() => undefined)
      return null
    }
    await page.waitForTimeout(ARMED_AFTER_MS)
    await activate(chosen)
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 10_000 }).catch(() => undefined)
    return words
  }

  // Bookkeeping of the policy (never of the game: Forge's state is read anew every step).
  const landTurns = new Set<number>()
  const tried = new Set<string>()
  let mulliganTaken = !game.mulligan
  let attackAllUsed = false
  let defenderSwitched = false
  const attackDecided = new Map<number, boolean>()
  let attackTurn = -1
  let blocksThisCombat = 0
  let blockTurn = -1
  const blockTargetsVisited = new Set<number>()
  let paymentTurns = 0
  const selectTaps = new Map<string, number>()
  let lastFingerprint = ""
  let sameCount = 0
  const started = Date.now()
  let bootMs: number | null = null
  let ended: string | null = null
  let pictures: { loaded: number; broken: number } | null = null
  let maxTurn = 0
  let lastShotTurn = 0
  let languages: Record<string, unknown> | null = null
  let memoryInGame: number | null = null
  let nextMemoryTurn = 5

  for (let step = 0; step < 4000; step++) {
    if (Date.now() - started > game.maxMinutes * 60_000) {
      check(false, `${game.id}: no result after ${game.maxMinutes} min (turn ${maxTurn})`)
      break
    }
    // Forge waits for the player: the header says so ("Du bist dran", engine.waiting) and a question is open. A question
    // shown while Forge still computes (its answer on the way) is not one to act on.
    const state = await page
      .waitForFunction(
        () => {
          const h2 = [...document.querySelectorAll("h2")].map((heading) => (heading.textContent ?? "").trim())
          if (h2.some((text) => /^(Gewonnen|Verloren|Unentschieden)$/.test(text))) return "ended"
          const waiting = [...(document.querySelector('section[aria-label="Spielstand"]')?.querySelectorAll('[data-slot="badge"]') ?? [])].some((badge) => (badge.textContent ?? "").trim() === "Du bist dran")
          return waiting && h2.includes("Forge wartet auf deine Entscheidung") ? "asked" : false
        },
        undefined,
        { timeout: 600_000, polling: 100 },
      )
      .then((handle) => handle.jsonValue() as Promise<string>, () => "silent")
    if (state === "ended") {
      ended = ((await result.first().textContent()) ?? "").trim()
      break
    }
    if (state !== "asked") {
      check(false, `${game.id}: Forge neither asked nor ended the game within 10 min (turn ${maxTurn})`)
      await game.shot(`${game.id}-silent`)
      break
    }
    if (bootMs === null) {
      bootMs = Date.now() - started
      await game.shot(`${game.id}-first-decision`)
    }
    // A view left open (a card that left the table meanwhile …) is closed first: looking never answers.
    if (await page.locator('[role="dialog"],[role="alertdialog"]').count()) {
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    }
    const view = await readTable(page)
    maxTurn = Math.max(maxTurn, view.turn)
    if (view.turn >= lastShotTurn + 5) {
      lastShotTurn = view.turn
      await game.shot(`${game.id}-turn-${view.turn}`)
    }
    if (pictures === null && view.turn >= 3) {
      pictures = await page.evaluate(() => {
        const images = [...document.querySelectorAll("img")].filter((img) => img.src.includes("scryfall.io"))
        return { loaded: images.filter((img) => img.complete && img.naturalWidth > 0).length, broken: images.filter((img) => img.complete && img.naturalWidth === 0).length }
      })
    }
    if (languages === null && view.turn >= 5 && view.kind === "Priorität") {
      languages = await cardLanguages(page).catch((error: Error) => ({ error: error.message }))
    }
    // Memory grows with the game: sampled every five turns, the highest value counts.
    if (game.measureMemory !== undefined && view.turn >= nextMemoryTurn && view.kind === "Priorität") {
      nextMemoryTurn = (Math.floor(view.turn / 5) + 1) * 5
      const bytes = await game.measureMemory().catch(() => null)
      if (bytes !== null && (memoryInGame === null || bytes > memoryInGame)) memoryInGame = bytes
    }
    stats.kinds[view.kind] = (stats.kinds[view.kind] ?? 0) + 1
    const before = await fingerprint(page)
    if (before === lastFingerprint) sameCount++
    else sameCount = 0
    lastFingerprint = before
    if (sameCount >= 6) {
      check(false, `${game.id}: the table did not change after six actions in "${view.line}" (${view.text})`)
      await game.shot(`${game.id}-stuck`)
      break
    }

    const acted = await (async (): Promise<boolean> => {
      const usableIn = (cards: readonly CardInfo[]) => cards.filter((card) => card.mark === "usable")
      switch (view.kind) {
        case "Entscheidung": {
          const play = answerButton((button) => button.name === "Spielen", view)
          if (play !== null) {
            await press(play, "play-first")
            return true
          }
          const first = answerButton(() => true, view)
          if (first !== null) {
            await press(first, `buttons:${view.answers.find((button) => button.enabled)?.name}`)
            return true
          }
          return false
        }
        case "Mulligan": {
          if (!mulliganTaken) {
            const mulligan = answerButton((button) => button.name === "Mulligan", view)
            if (mulligan !== null) {
              mulliganTaken = true
              await press(mulligan, "mulligan")
              return true
            }
          }
          const keep = answerButton((button) => button.name === "Behalten", view)
          if (keep !== null) {
            await press(keep, "keep")
            return true
          }
          return false
        }
        case "Karten unter die Bibliothek legen": {
          // The player's own choice (a tap on a hand card), then Forge's OK - never Forge's Auto.
          const ok = answerButton((button) => button.name === "OK", view)
          if (ok !== null) {
            await press(ok, "mulligan-bottom-done")
            return true
          }
          const card = view.hand.find((candidate) => candidate.mark !== "selected")
          if (card !== undefined) {
            await activate(cardButton(card.id))
            count("mulligan-bottom-card")
            return true
          }
          return false
        }
        case "Priorität":
          return priority(view)
        case "Kosten bezahlen":
          return payment(view)
        case "Angreifer wählen":
        case "Angriff bestätigen":
          return attack(view)
        case "Blocker wählen":
          return block(view)
        case "Auswahl":
          return view.radios > 0 || view.checkboxes > 0 || (await decision.getByRole("toolbar", { name: "Karten zur Wahl" }).count()) ? choose(view) : select(view)
        case "Ja oder Nein": {
          const yes = answerButton(() => true, view)
          if (yes === null) return false
          await press(yes, "confirm")
          return true
        }
        case "Eine Möglichkeit wählen":
          return options(view)
        case "Eingabe":
          return input()
        case "Reihenfolge festlegen":
          return confirmList("order", async () => {
            const add = decision.getByRole("button", { name: / hinzufügen$/ }).first()
            if ((await add.count()) && (await add.isEnabled())) await activate(add)
          })
        case "Karten anordnen":
          return confirmList("arrange", async () => {
            const fields = decision.getByRole("textbox", { name: /^Position von / })
            for (let index = 0; index < (await fields.count()); index++) await fields.nth(index).fill(String(index + 1))
          })
        case "Verteilen":
          return confirmList("distribute", async () => {
            const more = decision.getByRole("button", { name: / einen mehr$/ })
            for (let index = 0; index < (await more.count()); index++) {
              if (await more.nth(index).isEnabled()) {
                await activate(more.nth(index))
                return
              }
            }
          })
        default: {
          const first = view.buttons.find((button) => button.enabled && button.name !== "Zurücksetzen")
          stats.unanswered.push(view.line)
          if (first === undefined) return false
          await press(decisionButton(first.name).first(), `other:${view.kind}`)
          return true
        }
      }

      async function priority(current: TableView): Promise<boolean> {
        const pass = answerButton((button) => button.meaning === "pass", current)
        const myTurn = current.owner === "me"
        const main = current.phase === "MAIN1" || current.phase === "MAIN2"
        const stackEmpty = current.answers.some((button) => button.meaning === "pass" && button.name === "Weiter")
        const answering = current.text.includes("Du kannst darauf antworten")
        const playable = usableIn(current.hand)
        const key = (card: CardInfo) => `${current.turn}:${current.phase}:${current.text.slice(0, 40)}:${card.id}`
        if (myTurn && main && stackEmpty) {
          if (!landTurns.has(current.turn)) {
            for (const card of playable) {
              if (tried.has(`land:${key(card)}`)) continue
              tried.add(`land:${key(card)}`)
              const words = await throughView(card.id, (text) => text === "Spiele ein Land")
              if (words !== null) {
                landTurns.add(current.turn)
                count("land")
                return true
              }
            }
          }
          for (const card of playable) {
            if (tried.has(key(card))) continue
            tried.add(key(card))
            const words = await throughView(card.id, (text) => text !== "Spiele ein Land")
            if (words !== null) {
              count(`cast:${words}`)
              return true
            }
          }
          // Abilities of the player's permanents Forge marks (planeswalkers, activated abilities) - once a turn each.
          for (const card of usableIn(current.mine)) {
            const once = `ability:${current.turn}:${card.id}`
            if (tried.has(once) || random() < 0.3) continue
            tried.add(once)
            const words = await throughView(card.id, (text) => !/^(Spiele ein Land)$/.test(text))
            if (words !== null) {
              count(`ability:${words}`)
              return true
            }
          }
        } else if (answering && playable.length > 0 && random() < 0.7) {
          // An answer to the AI's spell or ability: an instant Forge offers now.
          for (const card of playable) {
            if (tried.has(key(card))) continue
            tried.add(key(card))
            const words = await throughView(card.id, (text) => text !== "Spiele ein Land")
            if (words !== null) {
              count(`respond:${words}`)
              return true
            }
          }
        }
        if (pass === null) return false
        await press(pass, stackEmpty ? "pass" : "resolve")
        return true
      }

      async function payment(current: TableView): Promise<boolean> {
        paymentTurns++
        // Now and then by hand: a land Forge marks on the player's battlefield, floating mana, life for Phyrexian mana.
        const sources = usableIn(current.mine)
        if (paymentTurns % 3 === 0 && sources.length > 0) {
          await activate(cardButton(sources[0]!.id))
          count("pay:source")
          return true
        }
        const pool = decision.locator("[data-mana]")
        if ((await pool.count()) && (await pool.first().isEnabled())) {
          await activate(pool.first())
          count("pay:pool")
          return true
        }
        const life = current.players.find((player) => player.choice && player.mark === "usable")
        if (life !== undefined && random() < 0.5) {
          await activate(decision.locator(`[data-player-choice="${life.id}"]`))
          count("pay:life")
          return true
        }
        const auto = answerButton((button) => button.name !== "Abbrechen", current)
        if (auto !== null) {
          await press(auto, `pay:${current.answers.find((button) => button.enabled && button.name !== "Abbrechen")?.name}`)
          return true
        }
        if (sources.length > 0) {
          await activate(cardButton(sources[0]!.id))
          count("pay:source")
          return true
        }
        const cancel = answerButton((button) => button.name === "Abbrechen", current)
        if (cancel === null) return false
        await press(cancel, "pay:cancel")
        return true
      }

      async function attack(current: TableView): Promise<boolean> {
        if (attackTurn !== current.turn) {
          attackTurn = current.turn
          attackDecided.clear()
        }
        if (!attackAllUsed && current.turn >= 6) {
          const all = answerButton((button) => button.meaning === "attackAll", current)
          if (all !== null) {
            attackAllUsed = true
            await press(all, "attack:all")
            return true
          }
        }
        const defender = decision.getByRole("group", { name: "Wen greifst du an?" }).locator("button[data-defender]")
        if (!defenderSwitched && (await defender.count()) && random() < 0.5) {
          defenderSwitched = true
          await activate(defender.first())
          count("attack:defender")
          return true
        }
        for (const card of current.mine) {
          if (card.mark !== "usable" || !card.label.includes("kann angreifen")) continue
          if (!attackDecided.has(card.id)) attackDecided.set(card.id, random() < 0.75)
          if (attackDecided.get(card.id) === true) {
            attackDecided.set(card.id, false)
            await activate(cardButton(card.id))
            count("attack:creature")
            return true
          }
        }
        const declare = answerButton((button) => button.meaning === "declare", current) ?? answerButton(() => true, current)
        if (declare === null) return false
        await press(declare, `attack:${(current.answers.find((button) => button.enabled && button.meaning === "declare") ?? current.answers.find((button) => button.enabled))?.name.replace(/\d+/, "n")}`)
        return true
      }

      async function block(current: TableView): Promise<boolean> {
        if (blockTurn !== current.turn) {
          blockTurn = current.turn
          blocksThisCombat = 0
          blockTargetsVisited.clear()
        }
        const blocker = current.mine.find((card) => card.mark === "usable" && card.label.includes("kann diesen Angreifer blocken"))
        if (blocker !== undefined && blocksThisCombat < 2 && random() < 0.6) {
          blocksThisCombat++
          await activate(cardButton(blocker.id))
          count("block:assign")
          return true
        }
        const other = current.theirs.find((card) => card.mark === "usable" && card.label.includes("Blocker zuweisen") && !blockTargetsVisited.has(card.id))
        if (other !== undefined && blocksThisCombat < 2) {
          blockTargetsVisited.add(other.id)
          await activate(cardButton(other.id))
          count("block:target")
          return true
        }
        const confirm = answerButton(() => true, current)
        if (confirm === null) return false
        await press(confirm, `block:${current.answers.find((button) => button.enabled)?.name}`)
        return true
      }

      async function select(current: TableView): Promise<boolean> {
        const taps = selectTaps.get(current.question ?? "") ?? 0
        selectTaps.set(current.question ?? "", taps + 1)
        const ok = answerButton((button) => button.name !== "Abbrechen" && button.name !== "Cancel", current)
        if (taps < 6) {
          // Targets of the AI's first (its seat, then its cards), else the player's own, else what Forge offers elsewhere.
          const aiPlayer = current.players.find((player) => player.mark === "usable" && /Forge-KI/.test(player.label))
          const choices: (() => Promise<void>)[] = []
          if (aiPlayer !== undefined) choices.push(async () => activate(aiPlayer.choice ? decision.locator(`[data-player-choice="${aiPlayer.id}"]`) : page.locator(`button[data-slot="game-player"][data-player="${aiPlayer.id}"]`).first()))
          for (const card of usableIn(current.theirs)) choices.push(async () => activate(cardButton(card.id)))
          for (const card of usableIn(current.mine)) choices.push(async () => activate(cardButton(card.id)))
          for (const card of usableIn(current.hand)) choices.push(async () => activate(cardButton(card.id)))
          for (const card of usableIn(current.offTable)) choices.push(async () => activate(decision.locator(`button[data-item="${card.id}"]`).first()))
          const me = current.players.find((player) => player.mark === "usable" && !/Forge-KI/.test(player.label))
          if (me !== undefined) choices.push(async () => activate(me.choice ? decision.locator(`[data-player-choice="${me.id}"]`) : page.locator(`button[data-slot="game-player"][data-player="${me.id}"]`).first()))
          if (choices.length > 0 && (ok === null || taps === 0)) {
            await choices[0]!()
            count(aiPlayer !== undefined ? "select:ai-player" : "select:card")
            return true
          }
        }
        if (ok !== null) {
          await press(ok, `select:${current.answers.find((button) => button.enabled && button.name !== "Abbrechen")?.name}`)
          return true
        }
        const cancel = answerButton((button) => button.name === "Abbrechen", current)
        if (cancel === null) return false
        await press(cancel, "select:cancel")
        return true
      }

      async function choose(current: TableView): Promise<boolean> {
        const confirm = decisionButton(/^(Bestätigen|Nichts wählen)$/).first()
        if ((await confirm.count()) && (await confirm.isEnabled())) {
          const words = ((await confirm.textContent()) ?? "").trim()
          if (words === "Bestätigen" || current.radios + current.checkboxes === 0) {
            await press(confirm, `choose:${words}`)
            return true
          }
        }
        const radio = decision.getByRole("radio").first()
        if (current.radios > 0) {
          await activate(radio)
          count("choose:radio")
          return true
        }
        const box = decision.locator('[role="checkbox"]:not([disabled]):not([data-state="checked"])').first()
        if ((await box.count()) && (await box.isEnabled())) {
          await activate(box)
          count("choose:checkbox")
          return true
        }
        const card = decision.getByRole("toolbar", { name: "Karten zur Wahl" }).locator('button:not([data-mark="selected"])').first()
        if (await card.count()) {
          await activate(card)
          count("choose:card")
          return true
        }
        if ((await confirm.count()) && (await confirm.isEnabled())) {
          await press(confirm, "choose:nothing")
          return true
        }
        return false
      }

      async function options(current: TableView): Promise<boolean> {
        const confirm = decisionButton("Bestätigen").first()
        if ((await confirm.count()) && (await confirm.isEnabled())) {
          await press(confirm, "options:confirm")
          return true
        }
        if (current.radios > 0) {
          await activate(decision.getByRole("radio").first())
          count("options:radio")
          return true
        }
        const card = decision.getByRole("toolbar", { name: "Möglichkeiten" }).getByRole("button").first()
        if (await card.count()) {
          await activate(card)
          count("options:card")
          return true
        }
        // A list Forge only shows: its one button.
        const first = current.buttons.find((button) => button.enabled)
        if (first === undefined) return false
        await press(decisionButton(first.name).first(), "options:acknowledge")
        return true
      }

      async function input(): Promise<boolean> {
        const offered = decision.getByRole("group", { name: "Forges angebotene Werte" }).getByRole("button")
        if (await offered.count()) await activate(offered.last())
        const field = decision.getByRole("textbox").first()
        if ((await field.inputValue()) === "") await field.fill("1")
        const confirm = decisionButton("Bestätigen").first()
        if (await confirm.isEnabled()) {
          await press(confirm, "input")
          return true
        }
        const cancel = decisionButton("Abbrechen").first()
        if ((await cancel.count()) && (await cancel.isEnabled())) {
          await press(cancel, "input:cancel")
          return true
        }
        return false
      }

      async function confirmList(name: string, fix: () => Promise<void>): Promise<boolean> {
        const confirm = decisionButton("Bestätigen").first()
        for (let attempt = 0; attempt < 40 && !(await confirm.isEnabled()); attempt++) await fix()
        if (!(await confirm.isEnabled())) return false
        await press(confirm, name)
        return true
      }
    })()

    if (!acted) {
      check(false, `${game.id}: no way on in "${view.line}" (${view.text}; buttons ${JSON.stringify(view.answers)})`)
      await game.shot(`${game.id}-no-way`)
      break
    }
    // Forge takes the input: the table changes (a new question, marks, zones) or the game ends.
    const changed = await page
      .waitForFunction(
        async (previous) => {
          if (document.querySelector("h2") && /^(Gewonnen|Verloren|Unentschieden)$/.test(document.querySelector("h2")?.textContent ?? "")) return true
          const decision = document.querySelector('section[aria-label="Entscheidung"]')
          const marks = [...document.querySelectorAll<HTMLElement>("[data-mark]")].map((element) => `${element.dataset["card"] ?? element.dataset["player"] ?? element.dataset["playerChoice"] ?? ""}:${element.dataset["mark"]}`).join(",")
          const tapped = [...document.querySelectorAll<HTMLElement>('[data-slot="game-card"][data-tapped="true"]')].length
          const regions = ["Deine Hand", "Dein Spielfeld", "Spielfeld der Forge-KI", "Stapel und Kampf", "Du", "Forge-KI", "Spielstand"].map((name) => document.querySelector(`section[aria-label="${name}"]`)?.textContent?.length ?? 0).join("/")
          const now = `${decision?.querySelector('[data-slot="game-decision"]')?.getAttribute("data-question")}|${decision?.textContent}|${marks}|${tapped}|${regions}|${document.querySelectorAll("[data-sonner-toast]").length}`
          return now !== previous
        },
        before,
        { timeout: 30_000, polling: 100 },
      )
      .then(() => true, () => false)
    if (!changed) stats.noEffect++
    // Forge's notices (toasts): input.rejected and Forge's own messages - recorded with their words.
    for (const text of await page.locator("[data-sonner-toast]").allTextContents()) {
      if (!game.notices.some((notice) => notice.text === text && Date.now() - notice.at < 15_000)) game.notices.push({ at: Date.now(), text })
    }
  }
  await game.shot(`${game.id}-result`)
  return { result: ended, turns: maxTurn, ms: Date.now() - started, bootMs, pictures, languages, memoryInGame, ...stats }
}

// ── DE→EN: what the card view says about the catalog's languages ──────────

/**
 * Looks at cards of the hands and battlefields (a right click or long press: safe, sends nothing) and collects what
 * the card view says about languages: the name shown, the picture's language (fact "Kartenbild"), the catalog text's
 * language where the view shows the catalog face (cards Forge sends no rules text for), Forge's own rules text.
 */
export async function cardLanguages(page: Page, limit = 16): Promise<Record<string, unknown>> {
  const cards = page.locator(
    'section[aria-label="Deine Hand"] button[data-slot="game-card"][data-card], section[aria-label="Dein Spielfeld"] button[data-slot="game-card"][data-card], section[aria-label="Spielfeld der Forge-KI"] button[data-slot="game-card"][data-card]',
  )
  const seen: { name: string; picture: string | null; catalogText: string | null; forgeText: string | null }[] = []
  const total = Math.min(await cards.count(), limit)
  for (let index = 0; index < total; index++) {
    await cards.nth(index).click({ button: "right" })
    const view = page.getByRole("dialog")
    if (!(await view.waitFor({ timeout: 5000 }).then(() => true, () => false))) continue
    const facts = await view.locator("dl > div").evaluateAll((rows) => Object.fromEntries(rows.map((row) => [(row.querySelector("dt")?.textContent ?? "").trim(), (row.querySelector("dd")?.textContent ?? "").trim()])))
    const content = (await view.textContent()) ?? ""
    const name = ((await view.getByRole("heading").first().textContent()) ?? "").trim()
    const forgeText = await view.locator("p.whitespace-pre-line").first().textContent().catch(() => null)
    seen.push({ name, picture: facts["Kartenbild"] ?? null, catalogText: /Katalogtext: ([^.]+)\./.exec(content)?.[1] ?? null, forgeText: forgeText === null ? null : forgeText.trim().slice(0, 80) })
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { timeout: 10_000 }).catch(() => undefined)
  }
  return { looked: seen.length, cards: seen }
}
