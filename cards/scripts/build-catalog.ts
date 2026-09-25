/*
 * Builds the card catalog the app installs into IndexedDB:
 *
 *   npm run cards:build                 current Scryfall data (downloaded once, then cached)
 *   npm run cards:build -- --offline    the newest data already in the cache
 *   npm run cards:build -- --bulk <all-cards-….jsonl.gz>   a particular bulk file from the cache
 *
 * Inputs: Scryfall's all_cards bulk file and set list (cards/build/cache/),
 * Forge's card database from the engine's pinned checkout (engine/forge),
 * cards/forge-unmatched.json. Outputs in cards/build/dist/:
 *
 *   card-catalog.jsonl.gz           header, sets, cards, Forge-only cards, end line
 *   card-catalog-manifest.json      id, size, SHA-256, source, Forge commit, counts
 *   card-catalog-report.json        how Forge's cards were matched, what has no Scryfall data
 *
 * Every line is checked against the local data schema before it is written.
 * The same inputs give the same catalog (same SHA-256, same id); only the
 * manifest's builtAt differs. The Vite build takes the catalog only if the
 * manifest matches (vite/card-assets.ts).
 */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { gzipSync } from "node:zlib"
import type { ScryfallBulkData } from "../../src/cards/scryfall/generated/records.ts"
import { CATALOG_FORMAT_VERSION, SCHEMA_VERSION } from "../../src/storage/generated/constants.ts"
import type { CatalogEnd, CatalogHeader, CatalogLine } from "../../src/storage/generated/records.ts"
import { validateCatalogEnd, validateCatalogHeader, validateCatalogLine } from "../../src/storage/generated/catalog/validators.js"
import { CatalogBuilder, CatalogError, type Catalog, type UnmatchedException } from "./catalog.ts"
import { readForgeCardDatabase } from "./forge-cards.ts"
import { cachedBulkFile, cachedSetsFile, fetchBulkEntry, readBulkCards, readSets, type CachedFile } from "./scryfall-bulk.ts"

const root = path.resolve(import.meta.dirname, "../..")
export const CATALOG_FILE = "card-catalog.jsonl.gz"
export const MANIFEST_FILE = "card-catalog-manifest.json"
export const REPORT_FILE = "card-catalog-report.json"
export const MANIFEST_FORMAT = "openmana-card-catalog-manifest/1"

interface Options {
  readonly offline: boolean
  readonly bulk: string | null
  readonly out: string
  readonly cache: string
  readonly forgeRes: string
  readonly forgeDir: string
  readonly unmatched: string
}

function parseArgs(argv: readonly string[]): Options {
  const value = (flag: string): string | null => {
    const i = argv.indexOf(flag)
    if (i < 0) return null
    const next = argv[i + 1]
    if (next === undefined || next.startsWith("--")) throw new Error(`${flag} needs a value`)
    return next
  }
  const forgeDir = path.resolve(value("--forge") ?? path.join(root, "engine/forge"))
  return {
    offline: argv.includes("--offline"),
    bulk: value("--bulk"),
    out: path.resolve(value("--out") ?? path.join(root, "cards/build/dist")),
    cache: path.resolve(value("--cache") ?? path.join(root, "cards/build/cache")),
    forgeDir,
    forgeRes: path.join(forgeDir, "forge-gui/res"),
    unmatched: path.join(root, "cards/forge-unmatched.json"),
  }
}

function log(message: string): void {
  console.error(`[cards] ${message}`)
}

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim()
}

/** The Forge checkout the engine is built from: its commit, and no local changes. */
function forgeCheckout(dir: string): { readonly repository: string; readonly commit: string } {
  const commit = git(dir, "rev-parse", "HEAD")
  if (git(dir, "status", "--porcelain") !== "") throw new Error(`${dir} has local changes; the catalog must match a pinned Forge commit`)
  const repository = git(dir, "remote", "get-url", "origin").replace(/\.git$/, "")
  return { repository, commit }
}

export function readUnmatched(file: string): UnmatchedException[] {
  const body = JSON.parse(fs.readFileSync(file, "utf8")) as { cards?: unknown }
  if (!Array.isArray(body.cards)) throw new Error(`${file}: expected {"cards": [{"name", "note"}, …]}`)
  return body.cards.map((entry: unknown, i) => {
    const { name, note } = (entry ?? {}) as { name?: unknown; note?: unknown }
    if (typeof name !== "string" || name.trim() === "" || typeof note !== "string" || note.trim() === "") {
      throw new Error(`${file}: entry ${i} needs a name and a note`)
    }
    return { name, note }
  })
}

/** Where the bulk entry of a cached bulk file is kept (Scryfall's facts about it). */
function entryFile(bulkFile: string): string {
  return `${bulkFile}.entry.json`
}

async function scryfallInputs(options: Options, appVersion: string): Promise<{ readonly entry: ScryfallBulkData; readonly bulk: CachedFile; readonly sets: CachedFile }> {
  let entry: ScryfallBulkData
  if (options.bulk !== null || options.offline) {
    if (options.bulk === null && !fs.existsSync(options.cache)) throw new Error(`no Scryfall cache in ${options.cache}; run without --offline once`)
    const bulkFile =
      options.bulk ??
      fs
        .readdirSync(options.cache)
        .filter((name) => name.startsWith("all-cards-") && name.endsWith(".jsonl.gz"))
        .sort()
        .map((name) => path.join(options.cache, name))
        .at(-1)
    if (bulkFile === undefined) throw new Error(`no all_cards bulk file in ${options.cache}; run without --offline once`)
    entry = JSON.parse(fs.readFileSync(entryFile(path.resolve(bulkFile)), "utf8")) as ScryfallBulkData
  } else {
    entry = await fetchBulkEntry(appVersion)
  }
  const bulk = await cachedBulkFile(entry, options.cache, appVersion, log)
  fs.writeFileSync(entryFile(bulk.file), `${JSON.stringify(entry, null, 2)}\n`)
  // One set list per bulk file date: the same bulk file always gets the same set list.
  const sets = await cachedSetsFile(options.cache, appVersion, new Date(entry.updated_at).toISOString().slice(0, 10))
  return { entry, bulk, sets }
}

function assertLine(valid: boolean, errors: readonly { instancePath: string; message?: string }[] | null | undefined, what: string): void {
  if (!valid) {
    const detail = (errors ?? []).slice(0, 3).map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`)
    throw new CatalogError(`${what} does not match the local data schema: ${detail.join("; ")}`)
  }
}

/** The catalog file's lines (checked against the schema), in file order. */
export function catalogLines(catalog: Catalog, header: CatalogHeader): string[] {
  assertLine(validateCatalogHeader(header), validateCatalogHeader.errors, "the header")
  const lines = [JSON.stringify(header)]
  const counts: CatalogEnd["counts"] = { card: 0, set: 0, "forge-only": 0 }
  const push = (line: CatalogLine) => {
    const what = `the ${line.type} line ${JSON.stringify(line.record).slice(0, 120)}`
    assertLine(validateCatalogLine(line), validateCatalogLine.errors, what)
    lines.push(JSON.stringify(line))
    counts[line.type]++
  }
  for (const record of catalog.sets) push({ type: "set", record })
  for (const record of catalog.cards) push({ type: "card", record })
  for (const record of catalog.forgeOnly) push({ type: "forge-only", record })
  const end: CatalogEnd = { type: "end", counts, records: lines.length - 1 }
  assertLine(validateCatalogEnd(end), validateCatalogEnd.errors, "the end line")
  lines.push(JSON.stringify(end))
  return lines
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const appVersion = (JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version: string }).version
  const started = Date.now()

  const forge = forgeCheckout(options.forgeDir)
  const database = readForgeCardDatabase(options.forgeRes)
  log(`Forge ${forge.commit.slice(0, 10)}: ${database.cards.length} card scripts, ${database.editions.length} editions`)

  const { entry, bulk, sets } = await scryfallInputs(options, appVersion)
  log(`Scryfall all_cards of ${entry.updated_at} (${bulk.file}, SHA-256 ${bulk.sha256.slice(0, 12)}…)`)

  const builder = new CatalogBuilder()
  let count = 0
  for await (const card of readBulkCards(bulk.file)) {
    builder.add(card)
    if (++count % 100_000 === 0) log(`… ${count} printings read`)
  }
  log(`${count} printings read`)
  const catalog = builder.build({ forge: database, sets: readSets(sets.file), unmatched: readUnmatched(options.unmatched) })

  const counts = {
    cards: catalog.cards.length,
    germanText: catalog.cards.filter((card) => card.de !== null).length,
    germanImage: catalog.cards.filter((card) => card.prints.de !== null).length,
    sets: catalog.sets.length,
    forgeOnly: catalog.forgeOnly.length,
  }
  const matched = Object.values(catalog.report.matched).reduce((sum, n) => sum + n, 0)
  const header: CatalogHeader = {
    type: "header",
    format: "openmana-card-catalog",
    formatVersion: CATALOG_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    source: {
      provider: "scryfall",
      bulkType: "all_cards",
      updatedAt: new Date(entry.updated_at).toISOString(),
      uri: entry.jsonl_download_uri,
      bytes: bulk.bytes,
      sha256: bulk.sha256,
      setsUri: "https://api.scryfall.com/sets",
      setsSha256: sets.sha256,
    },
    forge: { repository: forge.repository, commit: forge.commit, cards: database.cards.length, matched, forgeOnly: catalog.report.forgeOnly.length },
    counts,
  }
  const text = `${catalogLines(catalog, header).join("\n")}\n`
  const compressed = gzipSync(text, { level: 9 })
  const sha256 = createHash("sha256").update(compressed).digest("hex")
  const uncompressedSha256 = createHash("sha256").update(text).digest("hex")

  fs.mkdirSync(options.out, { recursive: true })
  const target = path.join(options.out, CATALOG_FILE)
  fs.writeFileSync(`${target}.part`, compressed)
  fs.renameSync(`${target}.part`, target)
  const manifest = {
    format: MANIFEST_FORMAT,
    id: sha256.slice(0, 16),
    file: {
      name: CATALOG_FILE,
      bytes: compressed.length,
      sha256,
      uncompressedBytes: Buffer.byteLength(text),
      uncompressedSha256,
      lines: counts.cards + counts.sets + counts.forgeOnly + 2,
    },
    formatVersion: CATALOG_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    source: header.source,
    forge: header.forge,
    counts,
    builtAt: new Date().toISOString(),
    builder: { app: appVersion, node: process.version },
  }
  fs.writeFileSync(path.join(options.out, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`)
  fs.writeFileSync(path.join(options.out, REPORT_FILE), `${JSON.stringify({ catalog: manifest.id, counts, ...catalog.report }, null, 2)}\n`)

  const r = catalog.report
  log(`catalog ${manifest.id}: ${counts.cards} cards (German text ${counts.germanText}, German picture ${counts.germanImage}), ${counts.sets} sets`)
  log(
    `Forge: ${matched} of ${database.cards.length} scripts matched (name ${r.matched.name}, face ${r.matched.face}, alias ${r.matched.alias}, edition ${r.matched.edition}), ${r.ambiguous.length} ambiguous, ${r.forgeOnly.length} without Scryfall data; with German text ${r.forgeGermanText}, German picture ${r.forgeGermanImage}`,
  )
  log(`${(compressed.length / 1024 / 1024).toFixed(1)} MiB gzip (${(Buffer.byteLength(text) / 1024 / 1024).toFixed(1)} MiB), ${((Date.now() - started) / 1000).toFixed(0)} s → ${path.relative(root, options.out)}`)
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    console.error(`[cards] ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
