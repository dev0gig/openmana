// @vitest-environment node
/*
 * Particular printings: fetched once, kept 30 days (also "there is no German
 * version"), stale answers still used when Scryfall cannot be reached.
 */
import { describe, expect, it } from "vitest"
import { fixtureCards } from "@/test/catalog-fixtures"
import { openTestDatabase, readRaw } from "@/test/storage-fixtures"
import { CardDataError } from "./errors"
import { ensurePrints, printKey, PRINT_MAX_AGE } from "./prints"
import type { ScryfallCard } from "./scryfall/generated/records"
import type { PrintIdentifier, ScryfallClient } from "./scryfall-client"

const cards = fixtureCards()
const find = (set: string, number: string, lang: string) => cards.find((c) => c.set === set && c.collector_number === number && c.lang === lang)!

/** A stand-in for the API client that answers from the fixture cards and counts requests. */
function fakeClient(options: { offline?: boolean } = {}) {
  const requests: string[] = []
  const client = {
    async collection(identifiers: readonly PrintIdentifier[]) {
      requests.push(`collection ${identifiers.map((i) => `${i.set}/${i.collector_number}`).join(",")}`)
      if (options.offline) throw new CardDataError("scryfall-unreachable", "offline")
      const found: ScryfallCard[] = []
      let notFound = 0
      for (const identifier of identifiers) {
        const card = cards.find((c) => c.set === identifier.set && c.collector_number === identifier.collector_number && c.lang === "en")
        if (card) found.push(card)
        else notFound++
      }
      return { cards: found, notFound }
    },
    async cardByPrint(set: string, number: string, lang?: string) {
      requests.push(`card ${set}/${number}/${lang}`)
      if (options.offline) throw new CardDataError("scryfall-unreachable", "offline")
      return cards.find((c) => c.set === set && c.collector_number === number && c.lang === (lang ?? "en")) ?? null
    },
  }
  return { client: client as unknown as ScryfallClient, requests }
}

const at = (iso: string) => () => new Date(iso)

describe("particular printings", () => {
  it("fetches the printing and its German version once, then answers from the database", async () => {
    const db = await openTestDatabase()
    const { client, requests } = fakeClient()
    const { prints, error } = await ensurePrints(db, client, [{ set: "ELD", collectorNumber: "115" }], { now: at("2026-09-25T10:00:00.000Z") })
    expect(error).toBeNull()
    const giant = prints.get("eld|115")!
    expect(giant.original).toMatchObject({ set: "eld", collectorNumber: "115", lang: "en", name: "Bonecrusher Giant // Stomp" })
    expect(giant.german).toMatchObject({ set: "eld", collectorNumber: "115", lang: "de", fetchedAt: "2026-09-25T10:00:00.000Z" })
    expect(giant.german?.printed?.map((face) => face.name)).toEqual(["Knochenmalmer-Riese", "Stampfen"])
    expect(requests).toEqual(["collection eld/115", "card eld/115/de"])
    const again = await ensurePrints(db, client, [{ set: "eld", collectorNumber: "115" }], { now: at("2026-10-20T10:00:00.000Z") })
    expect(requests).toHaveLength(2)
    expect(again.prints.get("eld|115")?.german?.id).toBe(find("eld", "115", "de").id)
    db.close()
  })

  it("an English printing with a German version: both, each stored", async () => {
    const db = await openTestDatabase()
    const { client } = fakeClient()
    const { prints } = await ensurePrints(db, client, [{ set: "isd", collectorNumber: "51" }], { now: at("2026-09-25T10:00:00.000Z") })
    const delver = prints.get("isd|51")!
    expect([delver.original?.lang, delver.german?.lang]).toEqual(["en", "de"])
    expect(delver.original?.imageSides).toBe(2)
    expect(await readRaw("scryfallPrints")).toHaveLength(2)
    db.close()
  })

  it("remembers that there is no German version, and that a printing does not exist", async () => {
    const db = await openTestDatabase()
    const { client, requests } = fakeClient()
    const keys = [
      { set: "m11", collectorNumber: "149" },
      { set: "xyz", collectorNumber: "1" },
    ]
    const first = await ensurePrints(db, client, keys, { now: at("2026-09-25T10:00:00.000Z") })
    expect(first.prints.get("m11|149")).toMatchObject({ original: { lang: "en", set: "m11" }, german: null })
    expect(first.prints.get("xyz|1")).toEqual({ original: null, german: null })
    // No German request for a printing that does not exist.
    expect(requests).toEqual(["collection m11/149,xyz/1", "card m11/149/de"])
    const cached = (await readRaw("cacheIndex")) as { key: string }[]
    expect(cached.map((entry) => entry.key).sort()).toEqual(["print:de:m11|149", "print:default:xyz|1"])
    await ensurePrints(db, client, keys, { now: at("2026-10-01T10:00:00.000Z") })
    expect(requests).toHaveLength(2)
    db.close()
  })

  it("asks again after 30 days", async () => {
    const db = await openTestDatabase()
    const { client, requests } = fakeClient()
    await ensurePrints(db, client, [{ set: "m11", collectorNumber: "149" }], { now: at("2026-09-25T10:00:00.000Z") })
    const later = new Date(Date.parse("2026-09-25T10:00:00.000Z") + PRINT_MAX_AGE + 1)
    await ensurePrints(db, client, [{ set: "m11", collectorNumber: "149" }], { now: () => later })
    expect(requests).toHaveLength(4)
    db.close()
  })

  it("without Scryfall: what the database has (even old) and the error; nothing guessed", async () => {
    const db = await openTestDatabase()
    await ensurePrints(db, fakeClient().client, [{ set: "m11", collectorNumber: "149" }], { now: at("2026-01-01T10:00:00.000Z") })
    const offline = fakeClient({ offline: true })
    const result = await ensurePrints(db, offline.client, [{ set: "m11", collectorNumber: "149" }, { set: "isd", collectorNumber: "51" }], { now: at("2026-09-25T10:00:00.000Z") })
    expect(result.error?.code).toBe("scryfall-unreachable")
    expect(result.prints.get("m11|149")?.original?.set).toBe("m11")
    expect(result.prints.get("isd|51")).toEqual({ original: null, german: null })
    db.close()
  })

  it("keys ignore the case of set codes", () => {
    expect(printKey({ set: "M19", collectorNumber: "152" })).toBe("m19|152")
  })
})
