#!/usr/bin/env node
/*
 * Prompt 61's proof with the real engine: a Jumpstart game - two halves of
 * 20 put together into one deck of 40 on each side - is a constructed game
 * Forge starts and plays to its end. The same WebAssembly module and worker
 * host as in the browser, here in Node (worker_threads), started as the app
 * starts it (ENGINE_ARGS); the decks are joined by the app's own
 * jumpstartDeck and handed over by its engineDeck.
 *
 * The player's side is played by a simple rule, only through Forge's offers:
 * keep the hand, in the own main phases tap what Forge marks playable (a land
 * first), pay with Forge's own Auto button, take Forge's first target, attack
 * with everything Forge offers, never block, otherwise pass. It proves what
 * the prompt asks - drawing, lands, spells, the game's end - and fails on
 * anything Forge refuses, a technical abort or a game that does not end.
 *
 *   node scripts/readiness/jumpstart-engine.ts --dist <engine dist> [--seed 61] [--out report.json]
 */
import fs from "node:fs"
import path from "node:path"
import { EngineClient } from "../../engine/client/src/index.ts"
import { nodeWorkerPort } from "../../engine/client/src/node-worker-port.ts"
import type { Card, EngineMessage, GameState, MatchRequest, Question, VisibleCard } from "../../engine/protocol/src/index.ts"
import { deckMode, jumpstartDeck } from "../../src/decks/deck-mode.ts"
import { engineDeck, type DeckParts } from "../../src/game/engine-deck.ts"

function option(name: string, fallback: string | null): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : fallback
}

const distDir = path.resolve(option("--dist", "engine/build/dist")!)
const seed = Number(option("--seed", "61"))
const outFile = option("--out", null)

function half(name: string, cards: Record<string, number>): DeckParts & { format: "constructed" } {
  return { name, format: "constructed", main: Object.entries(cards).map(([card, count]) => ({ name: card, count })), sideboard: [], commander: [] }
}

/** Four halves of 20 from the engine tests' card pool (engine/fixtures/decks). */
const HALVES = {
  goblins: half("Goblins", { Mountain: 8, "Raging Goblin": 2, "Goblin Piker": 2, "Gray Ogre": 2, "Hill Giant": 2, Shock: 2, "Lightning Bolt": 2 }),
  elves: half("Elfen", { Forest: 8, "Llanowar Elves": 2, "Grizzly Bears": 2, "Centaur Courser": 2, "Giant Spider": 2, "Giant Growth": 2, "Trained Armodon": 2 }),
  fire: half("Feuer", { Mountain: 8, "Goblin Raider": 2, "Canyon Minotaur": 2, "Volcanic Hammer": 2, "Fire Elemental": 2, "Raging Goblin": 2, Shock: 2 }),
  wilds: half("Wildnis", { Forest: 8, "Runeclaw Bear": 2, "Kalonian Tusker": 2, "Rampant Growth": 2, "Craw Wurm": 2, "Grizzly Bears": 2, "Llanowar Elves": 2 }),
}

const failures: string[] = []
for (const deck of Object.values(HALVES)) if (deckMode(deck) !== "jumpstart") failures.push(`${deck.name} is no half (${deckMode(deck)})`)
const human = jumpstartDeck(HALVES.goblins, HALVES.elves)
const ai = jumpstartDeck(HALVES.fire, HALVES.wilds)
const count = (deck: DeckParts) => deck.main.reduce((sum, card) => sum + card.count, 0)
if (count(human) !== 40 || count(ai) !== 40) failures.push(`joined decks have ${count(human)} and ${count(ai)} cards`)

const request: MatchRequest = {
  seed,
  format: "constructed",
  human: { name: "Spieler", deck: engineDeck(human) },
  ai: { name: "Forge-KI", profile: "Default", deck: engineDeck(ai) },
}

const client = new EngineClient({
  createPort: nodeWorkerPort(),
  engineScriptUrl: path.join(distDir, "openmana-engine.js"),
  wasmUrl: path.join(distDir, "openmana-engine.js.wasm"),
  engineArgs: ["--card-loading=eager", "--language=de-DE"],
  requireIsolation: false,
})

const seen = { draws: 0, landsMine: 0, landsAi: 0, castsMine: 0, castsAi: 0, attacks: 0, turns: 0, rejected: [] as string[], inputs: 0 }
let startCards: readonly string[] = []
let lastHand = -1
/** Cards tapped in this turn whose tap did not move them (Forge took the tap without playing): not again. */
const tried = new Set<number>()
let triedTurn = -1
let end: unknown = null

function visible(card: Card): card is VisibleCard {
  return !("hidden" in card)
}

function me(state: GameState) {
  return state.players.find((player) => player.me)!
}

function answerBlocking(question: Question): void {
  switch (question.kind) {
    case "confirm":
      client.answer(question, { kind: "confirm", yes: question.suggested })
      return
    case "options":
      client.answer(question, { kind: "options", option: question.suggested ?? question.items[0]!.nr })
      return
    case "choose": {
      const choices = question.suggested && question.suggested.length >= question.min ? question.suggested : question.items.slice(0, Math.max(question.min, 1)).map((item) => item.nr)
      client.answer(question, { kind: "choose", choices })
      return
    }
    case "order":
      client.answer(question, { kind: "order", order: question.items.map((item) => item.nr) })
      return
    case "distribute": {
      // Everyone gets Forge's minimum, the rest goes in Forge's order up to Forge's maximum per item.
      const amounts = question.items.map(() => question.min)
      let rest = question.total - question.min * amounts.length
      for (let i = 0; i < amounts.length && rest > 0; i++) {
        const add = Math.min(rest, (question.maximums?.[i] ?? question.total) - amounts[i]!)
        amounts[i] = amounts[i]! + add
        rest -= add
      }
      client.answer(question, { kind: "distribute", amounts })
      return
    }
    default:
      failures.push(`unhandled blocking question ${question.kind}: ${question.text}`)
      client.concede()
  }
}

function act(): void {
  const state = client.state
  if (state === null || !state.running) return
  const blocking = client.blockingQuestion
  if (blocking !== null) return answerBlocking(blocking)
  const questions = [...client.openQuestions.values()]
  const select = questions.find((q) => q.kind === "select")
  if (select !== undefined && select.kind === "select") {
    if (select.items.length > 0) {
      client.answer(select, { kind: "select", choices: [select.items[0]!.nr] })
      return
    }
    const opponent = state.players.find((player) => !player.me && player.selectable)
    if (opponent !== undefined) {
      client.tapPlayer(opponent.id)
      return
    }
  }
  const buttons = questions.find((q) => q.kind === "buttons")
  if (buttons === undefined || buttons.kind !== "buttons") {
    if (questions.length > 0) failures.push(`unhandled questions: ${questions.map((q) => q.kind).join(", ")}`)
    return
  }
  const press = (nr: 1 | 2) => client.answer(buttons, { kind: "buttons", button: nr })
  const byMeaning = (meaning: string) => buttons.buttons.find((button) => button.meaning === meaning && button.enabled)
  switch (buttons.purpose) {
    case "mulligan":
      press(1)
      return
    case "payment":
      press(buttons.buttons[0]!.enabled ? 1 : 2)
      return
    case "attack": {
      const all = byMeaning("attackAll")
      if (all !== undefined && (state.attack?.defenders.length ?? 0) > 0 && !seenAttackThisTurn.has(state.turn)) {
        seenAttackThisTurn.add(state.turn)
        seen.attacks++
        press(all.nr)
        return
      }
      press(byMeaning("declare")?.nr ?? 1)
      return
    }
    case "attackDeclared":
      press(byMeaning("declare")?.nr ?? 1)
      return
    case "block":
      press(1)
      return
    case "priority": {
      if (state.turn !== triedTurn) {
        tried.clear()
        triedTurn = state.turn
      }
      const mine = me(state)
      const main = state.phase === "MAIN1" || state.phase === "MAIN2"
      if (state.activePlayer === mine.id && main && state.stack.length === 0) {
        const hand = mine.zones.hand.filter(visible).filter((card) => card.playable && !tried.has(card.id))
        const land = hand.find((card) => card.typeLine?.includes("Land"))
        const card = land ?? hand[0]
        if (card !== undefined) {
          tried.add(card.id)
          client.tapCard(card.id)
          return
        }
      }
      press(byMeaning("pass")?.nr ?? 1)
      return
    }
    default:
      press(1)
  }
}
const seenAttackThisTurn = new Set<number>()

let previous: GameState | null = null
const done = new Promise<void>((resolve) => {
  client.subscribe((event) => {
    if (event.kind !== "message") return
    const m: EngineMessage = event.message
    if (m.type === "engine.ready") client.startMatch(request)
    else if (m.type === "game.started") startCards = m.cardNames
    else if (m.type === "events") {
      for (const entry of m.entries) {
        if (entry.kind !== "STACK_ADD") continue
        if (entry.actor === "me") seen.castsMine++
        else if (entry.actor === "opponent") seen.castsAi++
      }
    } else if (m.type === "state") {
      const mine = me(m)
      if (previous !== null) {
        if (m.turn !== previous.turn) seen.turns = m.turn
        const lands = (state: GameState, ai: boolean) => state.players.find((player) => player.ai === ai)!.zones.battlefield.filter((card) => visible(card) && card.typeLine?.includes("Land")).length
        seen.landsMine += Math.max(0, lands(m, false) - lands(previous, false))
        seen.landsAi += Math.max(0, lands(m, true) - lands(previous, true))
        if (mine.library < me(previous).library) seen.draws += me(previous).library - mine.library
      }
      lastHand = mine.zones.hand.length
      previous = m
    } else if (m.type === "input.rejected" && m.reason !== "no-effect") seen.rejected.push(`${m.reason}: ${m.detail}`)
    else if (m.type === "engine.waiting") {
      seen.inputs++
      if (seen.inputs > 4000) {
        failures.push("more than 4000 inputs - the game does not end")
        client.concede()
        return
      }
      act()
    } else if (m.type === "engine.error") {
      failures.push(`engine.error ${m.code}: ${m.message}`)
      resolve()
    } else if (m.type === "game.end") {
      end = m
      resolve()
    } else if (m.type === "engine.abort") {
      failures.push(`technical abort (${m.reason}): ${m.message}`)
      resolve()
    }
  })
})
const timer = setTimeout(() => {
  failures.push("timeout after 600 s")
  client.abort("timeout")
}, 600_000)
const started = performance.now()
client.start()
await done
clearTimeout(timer)
client.dispose()

const result = end as { result?: string; turns?: number; reason?: string | null } | null
if (result === null) failures.push("no game.end")
if (seen.landsMine === 0 || seen.landsAi === 0) failures.push(`lands played: ${seen.landsMine} / ${seen.landsAi}`)
if (seen.castsMine === 0 || seen.castsAi === 0) failures.push(`spells and abilities on the stack: ${seen.castsMine} / ${seen.castsAi}`)
if (seen.draws === 0) failures.push("the player never drew")
if (seen.rejected.length > 0) failures.push(`Forge refused inputs: ${seen.rejected.join(" | ")}`)
const expectedNames = [...new Set([...human.main, ...ai.main].map((card) => card.name))].sort()
const missing = expectedNames.filter((name) => !startCards.includes(name))
if (missing.length > 0) failures.push(`game.started lacks ${missing.join(", ")}`)

const report = {
  ok: failures.length === 0,
  seed,
  format: request.format,
  human: { name: human.name, cards: count(human), entries: human.main },
  ai: { name: ai.name, cards: count(ai) },
  end: result,
  seen: { ...seen, handAtEnd: lastHand },
  ms: Math.round(performance.now() - started),
  failures,
}
if (outFile) fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, human: { name: human.name, cards: count(human) } }, null, 2))
process.exit(report.ok ? 0 : 1)
