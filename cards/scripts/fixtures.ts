/*
 * A small real card catalog for tests: built with the real catalog builder
 * from the fixtures in cards/fixtures (46 Scryfall card objects, a few Forge
 * scripts). Returns the catalog, its file (gzip and text) and the CardAssets
 * description the build would give the app. Node code without the app's "@/"
 * paths, so the catalog build's tests and the app's tests (through
 * src/test/catalog-fixtures.ts) share it.
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { gzipSync } from "node:zlib"
import type { CardAssetsAvailable } from "../../src/cards/card-assets-types.ts"
import type { ScryfallCard } from "../../src/cards/scryfall/generated/records.ts"
import { CATALOG_FORMAT_VERSION, SCHEMA_VERSION } from "../../src/storage/generated/constants.ts"
import type { CardRecord, CatalogHeader } from "../../src/storage/generated/records.ts"
import { catalogLines, readUnmatched } from "./build-catalog.ts"
import { CatalogBuilder, type Catalog } from "./catalog.ts"
import { readForgeCardDatabase } from "./forge-cards.ts"
import { readSets } from "./scryfall-bulk.ts"

export const FIXTURES = path.resolve(import.meta.dirname, "../fixtures")

export function fixtureCards(): ScryfallCard[] {
  return fs
    .readFileSync(path.join(FIXTURES, "scryfall-all-cards.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as ScryfallCard)
}

export function buildFixtureCatalog(cards: readonly ScryfallCard[] = fixtureCards()): Catalog {
  const builder = new CatalogBuilder()
  for (const card of cards) builder.add(card)
  return builder.build({
    forge: readForgeCardDatabase(path.join(FIXTURES, "forge-res")),
    sets: readSets(path.join(FIXTURES, "scryfall-sets.json")),
    unmatched: readUnmatched(path.join(FIXTURES, "forge-unmatched.json")),
  })
}

export interface FixtureCatalogFile {
  readonly catalog: Catalog
  readonly header: CatalogHeader
  readonly lines: readonly string[]
  readonly text: string
  readonly gzip: Uint8Array
  readonly assets: CardAssetsAvailable
}

const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex")

/** The fixture catalog as the build would write it, with lines optionally changed by `edit` (to damage it). */
export function fixtureCatalogFile(edit?: (lines: string[]) => string[]): FixtureCatalogFile {
  const catalog = buildFixtureCatalog()
  const header: CatalogHeader = {
    type: "header",
    format: "openmana-card-catalog",
    formatVersion: CATALOG_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    source: {
      provider: "scryfall",
      bulkType: "all_cards",
      updatedAt: "2026-09-24T21:18:09.156Z",
      uri: "https://data.scryfall.io/all-cards/all-cards-20260924211809.jsonl.gz",
      bytes: 1,
      sha256: "0".repeat(64),
      setsUri: "https://api.scryfall.com/sets",
      setsSha256: "0".repeat(64),
    },
    forge: { repository: "https://github.com/Card-Forge/forge", commit: "0".repeat(40), cards: 13, matched: 11, forgeOnly: catalog.forgeOnly.length },
    counts: {
      cards: catalog.cards.length,
      germanText: catalog.cards.filter((card) => card.de !== null).length,
      germanImage: catalog.cards.filter((card) => card.prints.de !== null).length,
      sets: catalog.sets.length,
      forgeOnly: catalog.forgeOnly.length,
    },
  }
  const original = catalogLines(catalog, header)
  const lines = edit ? edit([...original]) : original
  const text = `${lines.join("\n")}\n`
  const gzip = new Uint8Array(gzipSync(text))
  const id = sha(gzip).slice(0, 16)
  return {
    catalog,
    header,
    lines,
    text,
    gzip,
    assets: {
      available: true,
      id,
      url: `/cards/${id}/card-catalog.jsonl.gz`,
      bytes: gzip.byteLength,
      sha256: sha(gzip),
      uncompressedBytes: Buffer.byteLength(text),
      uncompressedSha256: sha(text),
      lines: lines.length,
      schemaVersion: SCHEMA_VERSION,
      source: { updatedAt: header.source.updatedAt, uri: header.source.uri },
      forge: { commit: header.forge.commit, cards: header.forge.cards, matched: header.forge.matched, forgeOnly: header.forge.forgeOnly },
      counts: header.counts,
      builtAt: "2026-09-25T00:00:00.000Z",
    },
  }
}

/** The fixture catalog's card of this English name (throws if there is none). */
export function fixtureCard(name: string, catalog: Catalog = buildFixtureCatalog()): CardRecord {
  const card = catalog.cards.find((candidate) => candidate.name === name)
  if (!card) throw new Error(`no fixture card ${name}`)
  return card
}

/** A fetch that serves `body` for `url` (and 404 for anything else), counting calls. */
export function serveFile(
  url: string,
  body: Uint8Array | string,
  init: { readonly status?: number; readonly chunk?: number; readonly headers?: Readonly<Record<string, string>> } = {},
) {
  const calls: string[] = []
  const fetchStub = async (input: RequestInfo | URL): Promise<Response> => {
    const requested = String(input)
    calls.push(requested)
    if (requested !== url) return new Response("not found", { status: 404 })
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body
    const size = init.chunk ?? bytes.byteLength
    let offset = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.byteLength) {
          controller.close()
          return
        }
        controller.enqueue(bytes.slice(offset, offset + size))
        offset += size
      },
    })
    return new Response(stream, { status: init.status ?? 200, headers: init.headers ?? {} })
  }
  return { fetch: fetchStub as typeof fetch, calls }
}
