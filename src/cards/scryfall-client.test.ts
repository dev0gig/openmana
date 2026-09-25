// @vitest-environment node
/*
 * The Scryfall API client keeps Scryfall's rules: Accept header, 500 ms
 * between collection requests, 100 ms between the others, a 30-second pause
 * after HTTP 429 without retrying, answers checked against the schema.
 */
import { describe, expect, it } from "vitest"
import { fixtureCards } from "@/test/catalog-fixtures"
import { CardDataError } from "./errors"
import { ACCEPT, RATE_LIMIT_PAUSE, ScryfallClient } from "./scryfall-client"

interface Call {
  readonly at: number
  readonly url: string
  readonly init: RequestInit | undefined
}

/** A client on a fake clock: sleeping moves the clock; `answer` decides each response. */
function setup(answer: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) {
  let now = 1_000_000
  const calls: Call[] = []
  const client = new ScryfallClient({
    now: () => now,
    sleep: async (ms) => {
      now += ms
    },
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ at: now, url: String(input), init })
      return answer(String(input), init)
    }) as typeof fetch,
  })
  return { client, calls, advance: (ms: number) => (now += ms), now: () => now }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

async function rejection(promise: Promise<unknown>): Promise<CardDataError> {
  const outcome = await promise.then(
    () => null,
    (error: unknown) => error,
  )
  if (!(outcome instanceof CardDataError)) throw new Error(`expected a CardDataError, got ${String(outcome)}`)
  return outcome
}

const [bolt] = fixtureCards()

describe("requests", () => {
  it("send an Accept header and leave the User-Agent to the browser", async () => {
    const { client, calls } = setup(() => json(bolt))
    await client.cardByPrint("TLE", "32", "de")
    expect(calls[0]!.url).toBe("https://api.scryfall.com/cards/tle/32/de")
    const headers = calls[0]!.init?.headers as Record<string, string>
    expect(headers["Accept"]).toBe(ACCEPT)
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("user-agent")
  })

  it("keep Scryfall's limits: 500 ms between collection requests, 100 ms between the others", async () => {
    const { client, calls, now } = setup((url) => (url.endsWith("/cards/collection") ? json({ object: "list", data: [], not_found: [] }) : json(bolt)))
    // Three at once wait for each other: two gaps of 100 ms on the (fake) clock.
    const start = now()
    await Promise.all([client.cardByPrint("m11", "149"), client.cardByPrint("m11", "150"), client.cardByPrint("m11", "151")])
    expect(now() - start).toBeGreaterThanOrEqual(200)
    expect(calls.map((call) => call.url.split("/").at(-1))).toEqual(["149", "150", "151"])
    const before = calls.length
    await client.cardByPrint("m11", "152")
    await client.cardByPrint("m11", "153")
    const [first, second] = calls.slice(before)
    expect(second!.at - first!.at).toBeGreaterThanOrEqual(100)
    const identifiers = Array.from({ length: 160 }, (_, i) => ({ set: "m11", collector_number: String(i + 1) }))
    await client.collection(identifiers)
    const strict = calls.filter((call) => call.url.endsWith("/cards/collection"))
    expect(strict).toHaveLength(3) // 75 + 75 + 10
    expect(strict[1]!.at - strict[0]!.at).toBeGreaterThanOrEqual(500)
    expect(strict[2]!.at - strict[1]!.at).toBeGreaterThanOrEqual(500)
    expect(JSON.parse(String(strict[0]!.init?.body)).identifiers).toHaveLength(75)
    const headers = (strict[0]!.init?.headers ?? {}) as Record<string, string>
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("after HTTP 429 nothing is sent for 30 seconds, and nothing is retried", async () => {
    let status = 429
    const { client, calls, advance } = setup(() => (status === 429 ? json({ object: "error", status: 429, code: "rate_limited", details: "slow down" }, 429) : json(bolt)))
    expect((await rejection(client.cardByPrint("m11", "149"))).code).toBe("scryfall-rate-limited")
    status = 200
    expect((await rejection(client.cardByPrint("m11", "149"))).code).toBe("scryfall-rate-limited")
    expect(calls).toHaveLength(1)
    advance(RATE_LIMIT_PAUSE)
    await client.cardByPrint("m11", "149")
    expect(calls).toHaveLength(2)
  })
})

describe("answers", () => {
  it("404 for one printing means: Scryfall has none", async () => {
    const { client } = setup(() => json({ object: "error", status: 404, code: "not_found", details: "No card found" }, 404))
    expect(await client.cardByPrint("m11", "999", "de")).toBeNull()
  })

  it("other errors, offline and foreign answers are named", async () => {
    const failing = setup(() => json({ object: "error", status: 500, code: "internal", details: "boom" }, 500))
    const error = await rejection(failing.client.cardByPrint("m11", "149"))
    expect([error.code, error.detail]).toEqual(["scryfall-unreachable", "internal: boom"])
    const offline = setup(() => Promise.reject(new TypeError("Failed to fetch")))
    expect((await rejection(offline.client.cardByPrint("m11", "149"))).code).toBe("scryfall-unreachable")
    const foreign = setup(() => json({ object: "card", id: "not-a-uuid" }))
    expect((await rejection(foreign.client.cardByPrint("m11", "149"))).code).toBe("scryfall-format")
    const notJson = setup(() => new Response("<html>", { status: 200 }))
    expect((await rejection(notJson.client.cardByPrint("m11", "149"))).code).toBe("scryfall-format")
  })

  it("collection returns the cards and counts what Scryfall did not find", async () => {
    const { client } = setup(() => json({ object: "list", data: [bolt], not_found: [{ set: "xyz", collector_number: "1" }] }))
    const result = await client.collection([{ set: "m11", collector_number: "149" }, { set: "xyz", collector_number: "1" }])
    expect(result.cards.map((card) => card.id)).toEqual([bolt!.id])
    expect(result.notFound).toBe(1)
  })
})
