/*
 * The decks the import saved, handed to the real Forge engine: the same
 * WebAssembly module and worker host as in the browser, here in Node
 * (worker_threads), started like the engine tests start it. Forge must accept
 * every card name (no deck-rejected), start the game with exactly those
 * cards and end it when the player concedes. This checks the import's
 * "names Forge knows" against Forge itself, not against the card catalog.
 *
 * The game session proper (how the app hands a deck to Forge) is prompt 11;
 * the mapping here is the protocol's Deck, field for field.
 */
import path from "node:path"
import { EngineClient } from "../../engine/client/src/index.ts"
import { nodeWorkerPort } from "../../engine/client/src/node-worker-port.ts"
import type { Deck, EngineMessage, MatchRequest } from "../../engine/protocol/src/index.ts"

/** What of a stored deck the engine needs (a DeckRecord as the browser's IndexedDB holds it). */
export interface StoredDeck {
  readonly name: string
  readonly format: "constructed" | "commander"
  readonly main: readonly { readonly count: number; readonly name: string }[]
  readonly sideboard: readonly { readonly count: number; readonly name: string }[]
  readonly commander: readonly { readonly count: number; readonly name: string }[]
}

export interface EngineDeckResult {
  readonly deck: string
  readonly format: string
  readonly problems: readonly string[]
  /** Distinct card names of the deck, as the engine reported them back in game.started. */
  readonly cardNames: readonly string[]
  readonly bootMs: number | null
  readonly startMs: number | null
  readonly totalMs: number
}

function engineDeck(deck: StoredDeck): Deck {
  const entries = (cards: StoredDeck["main"]) => cards.map((card) => ({ card: card.name, count: card.count }))
  const [first, ...rest] = entries(deck.main)
  if (!first) throw new Error(`deck ${deck.name} has no main deck`)
  return { name: deck.name, main: [first, ...rest], sideboard: entries(deck.sideboard), commander: entries(deck.commander) }
}

/** Starts one game with `deck` for both seats, concedes at the first decision, and reports what happened. */
export async function playDeck(distDir: string, deck: StoredDeck, timeoutMs = 240_000): Promise<EngineDeckResult> {
  const started = performance.now()
  const problems: string[] = []
  let bootMs: number | null = null
  let startMs: number | null = null
  let cardNames: readonly string[] = []
  const client = new EngineClient({
    createPort: nodeWorkerPort(),
    engineScriptUrl: path.join(distDir, "openmana-engine.js"),
    wasmUrl: path.join(distDir, "openmana-engine.js.wasm"),
    engineArgs: ["--card-loading=eager", "--language=en-US"],
    requireIsolation: false,
  })
  const request: MatchRequest = {
    seed: 9,
    format: deck.format,
    human: { name: "Spieler", deck: engineDeck(deck) },
    ai: { name: "Forge-KI", profile: "Default", deck: engineDeck(deck) },
  }
  const expected = [...new Set([...deck.main, ...deck.sideboard, ...deck.commander].map((card) => card.name))].sort()
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      problems.push(`no result after ${timeoutMs / 1000} s (status ${client.status})`)
      resolve()
    }, timeoutMs)
    let conceded = false
    const finish = () => {
      clearTimeout(timer)
      resolve()
    }
    client.subscribe((event) => {
      if (event.kind !== "message") return
      const message: EngineMessage = event.message
      switch (message.type) {
        case "engine.ready":
          bootMs = Math.round(performance.now() - started)
          client.startMatch(request)
          break
        case "engine.error":
          problems.push(`engine.error ${message.code}: ${message.message}${message.report ? ` ${JSON.stringify(message.report)}` : ""}`)
          finish()
          break
        case "engine.abort":
          problems.push(`engine.abort ${message.reason}: ${message.message}`)
          finish()
          break
        case "game.started":
          startMs = Math.round(performance.now() - started) - (bootMs ?? 0)
          cardNames = [...message.cardNames].sort()
          if (message.format !== deck.format) problems.push(`game.started format ${message.format}, deck ${deck.format}`)
          break
        case "question":
        case "engine.waiting":
          // The first decision (the mulligan): the game runs; concede.
          if (!conceded) {
            conceded = true
            client.concede()
          }
          break
        case "game.end":
          if (!message.conceded) problems.push(`game.end without concession: ${JSON.stringify(message)}`)
          break
        case "match.finished":
          finish()
          break
        default:
          break
      }
    })
    client.start()
  })
  client.dispose()
  const missing = expected.filter((name) => !cardNames.includes(name))
  if (cardNames.length > 0 && missing.length > 0) problems.push(`the engine's game lacks ${missing.join(", ")}`)
  if (cardNames.length === 0 && problems.length === 0) problems.push("the game never started")
  return { deck: deck.name, format: deck.format, problems, cardNames, bootMs, startMs, totalMs: Math.round(performance.now() - started) }
}
