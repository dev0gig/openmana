/*
 * Scryfall's API, only for what the card catalog does not carry: particular
 * printings a deck names by set and collector number. Names, texts and the
 * default pictures come from the catalog (bulk data): "If you need to
 * rapidly look up card names … or resolve a large number of card images,
 * you must use the bulk data files" (Scryfall).
 *
 * Scryfall's rules (https://scryfall.com/docs/api and /docs/api/rate-limits,
 * checked 2026-09-25), enforced here and nowhere else:
 * - An Accept header on every request; the browser's own User-Agent stays
 *   intact ("keep the browser's User-Agent intact").
 * - /cards/search, /cards/named, /cards/random, /cards/collection: at most 2
 *   requests per second (500 ms apart); every other method 10 per second
 *   (100 ms apart). Requests of one kind wait for each other.
 * - HTTP 429 limits access for 30 seconds and must never be ignored: after
 *   one, this client sends nothing for 30 seconds and says so instead of
 *   retrying.
 * - What was fetched is kept at least 24 hours (prints.ts).
 * CORS: api.scryfall.com answers with Access-Control-Allow-Origin: * (the
 * browser sends Origin itself); under the app's COEP a fetch in CORS mode is
 * what it needs.
 */
import type { ScryfallCard } from "./scryfall/generated/records"
import { validateScryfallCard, validateScryfallError, validateScryfallList } from "./scryfall/generated/validators.js"
import { CardDataError } from "./errors"

export const SCRYFALL_API = "https://api.scryfall.com"
export const ACCEPT = "application/json;q=0.9,*/*;q=0.8"

/** Minimum time between two requests of a kind (Scryfall's hard limits). */
export const INTERVALS = { strict: 500, general: 100 } as const
/** How long Scryfall limits access after HTTP 429. */
export const RATE_LIMIT_PAUSE = 30_000
/** Identifiers per /cards/collection request (Scryfall's maximum). */
export const COLLECTION_MAX = 75

type Lane = keyof typeof INTERVALS

export interface ScryfallClientOptions {
  readonly fetch?: typeof fetch
  readonly now?: () => number
  readonly sleep?: (ms: number) => Promise<void>
}

export interface PrintIdentifier {
  readonly set: string
  readonly collector_number: string
}

function problem(errors: readonly { instancePath: string; message?: string }[] | null | undefined): string {
  return (errors ?? [])
    .slice(0, 3)
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`)
    .join("; ")
}

export class ScryfallClient {
  readonly #fetch: typeof fetch
  readonly #now: () => number
  readonly #sleep: (ms: number) => Promise<void>
  readonly #next: Record<Lane, number> = { strict: 0, general: 0 }
  readonly #queue: Record<Lane, Promise<void>> = { strict: Promise.resolve(), general: Promise.resolve() }
  #pausedUntil = 0

  constructor(options: ScryfallClientOptions = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.#now = options.now ?? (() => Date.now())
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  /** Until when Scryfall's 429 pause lasts (0: none). */
  get pausedUntil(): number {
    return this.#pausedUntil
  }

  /** Waits for this lane's turn (requests of a lane go one after another). */
  async #turn(lane: Lane): Promise<void> {
    const previous = this.#queue[lane]
    let release!: () => void
    this.#queue[lane] = new Promise((resolve) => (release = resolve))
    await previous
    try {
      const wait = this.#next[lane] - this.#now()
      if (wait > 0) await this.#sleep(wait)
      this.#next[lane] = this.#now() + INTERVALS[lane]
    } finally {
      release()
    }
  }

  #checkPause(): void {
    if (this.#now() < this.#pausedUntil) {
      throw new CardDataError("scryfall-rate-limited", "Scryfall asked OpenMana to pause (HTTP 429)", {
        detail: `paused until ${new Date(this.#pausedUntil).toISOString()}`,
      })
    }
  }

  async #request(lane: Lane, path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
    this.#checkPause()
    await this.#turn(lane)
    // A 429 may have come in while this request waited for its turn.
    this.#checkPause()
    let response: Response
    try {
      response = await this.#fetch(`${SCRYFALL_API}${path}`, { ...init, headers: { Accept: ACCEPT, ...init.headers } })
    } catch (error) {
      throw new CardDataError("scryfall-unreachable", "Scryfall is not reachable", { cause: error, detail: String(error) })
    }
    if (response.status === 429) {
      this.#pausedUntil = this.#now() + RATE_LIMIT_PAUSE
      throw new CardDataError("scryfall-rate-limited", "Scryfall asked OpenMana to pause (HTTP 429)", { detail: `${path}: HTTP 429` })
    }
    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      throw new CardDataError("scryfall-format", `Scryfall answered ${path} with something that is not JSON (HTTP ${response.status})`, { cause: error })
    }
    return { status: response.status, body }
  }

  #failed(path: string, status: number, body: unknown): CardDataError {
    const details = validateScryfallError(body) ? `${body.code}: ${body.details}` : `HTTP ${status}`
    return new CardDataError("scryfall-unreachable", `Scryfall answered ${path} with an error`, { detail: details })
  }

  #card(path: string, value: unknown): ScryfallCard {
    if (!validateScryfallCard(value)) {
      throw new CardDataError("scryfall-format", `Scryfall's card from ${path} has an unexpected form`, { detail: problem(validateScryfallCard.errors) })
    }
    return value
  }

  /** One printing by set and collector number, in a language; null if Scryfall has none (404). General lane. */
  async cardByPrint(set: string, collectorNumber: string, lang?: string): Promise<ScryfallCard | null> {
    const path = `/cards/${encodeURIComponent(set.toLowerCase())}/${encodeURIComponent(collectorNumber)}${lang ? `/${encodeURIComponent(lang)}` : ""}`
    const { status, body } = await this.#request("general", path)
    if (status === 404) return null
    if (status !== 200) throw this.#failed(path, status, body)
    return this.#card(path, body)
  }

  /**
   * Printings by set and collector number (Scryfall's default language of
   * each: English, or its only one), up to 75 per request. Strict lane.
   */
  async collection(identifiers: readonly PrintIdentifier[]): Promise<{ readonly cards: readonly ScryfallCard[]; readonly notFound: number }> {
    const cards: ScryfallCard[] = []
    let notFound = 0
    for (let i = 0; i < identifiers.length; i += COLLECTION_MAX) {
      const chunk = identifiers.slice(i, i + COLLECTION_MAX)
      const path = "/cards/collection"
      const { status, body } = await this.#request("strict", path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk }),
      })
      if (status !== 200) throw this.#failed(path, status, body)
      if (!validateScryfallList(body)) {
        throw new CardDataError("scryfall-format", "Scryfall's collection answer has an unexpected form", { detail: problem(validateScryfallList.errors) })
      }
      for (const item of body.data) cards.push(this.#card(path, item))
      notFound += body.not_found?.length ?? 0
    }
    return { cards, notFound }
  }
}
