// @vitest-environment node
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { gzipSync } from "node:zlib"
import type { ResolvedConfig } from "vite"
import { afterEach, describe, expect, it } from "vitest"
import { SCHEMA_VERSION } from "../src/storage/generated/constants.ts"
import {
  CARDS_MODULE_ID,
  CardAssetsError,
  cardAssets,
  cardsModeFromEnv,
  CATALOG_FILE,
  CATALOG_MANIFEST_FILE,
  describeCards,
  SERVED_CARD_FILES,
  verifyCatalog,
} from "./card-assets.ts"

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex")
const FORGE = "ed0333fecb1fea0671b3e50cadc1da4f71db5798"

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openmana-cards-test-"))
  dirs.push(dir)
  return dir
}

/** A small catalog build: a gzip file and a manifest describing it (content is not parsed here). */
async function fakeCatalog(edit: (manifest: Record<string, any>) => void = () => undefined, content = '{"type":"header"}\n{"type":"end"}\n'): Promise<string> {
  const dir = await tempDir()
  const gzip = gzipSync(content)
  await fs.writeFile(path.join(dir, CATALOG_FILE), gzip)
  const hash = sha256(gzip)
  const manifest: Record<string, any> = {
    format: "openmana-card-catalog-manifest/1",
    id: hash.slice(0, 16),
    file: { name: CATALOG_FILE, bytes: gzip.length, sha256: hash, uncompressedBytes: Buffer.byteLength(content), uncompressedSha256: sha256(content), lines: 2 },
    formatVersion: 1,
    schemaVersion: SCHEMA_VERSION,
    source: { provider: "scryfall", bulkType: "all_cards", updatedAt: "2026-09-24T21:18:09.156Z", uri: "https://data.scryfall.io/all-cards/x.jsonl.gz" },
    forge: { repository: "https://github.com/Card-Forge/forge", commit: FORGE, cards: 10, matched: 9, forgeOnly: 1 },
    counts: { cards: 5, germanText: 4, germanImage: 3, sets: 2, forgeOnly: 1 },
    builtAt: "2026-09-25T00:00:00.000Z",
  }
  edit(manifest)
  await fs.writeFile(path.join(dir, CATALOG_MANIFEST_FILE), JSON.stringify(manifest, null, 1))
  return dir
}

async function engineManifest(commit: string): Promise<string> {
  const file = path.join(await tempDir(), "engine-manifest.json")
  await fs.writeFile(file, JSON.stringify({ forge: { commit } }))
  return file
}

describe("verifyCatalog", () => {
  it("accepts a complete catalog; its address is the start of its SHA-256", async () => {
    const dir = await fakeCatalog()
    const catalog = await verifyCatalog(dir)
    const gzip = await fs.readFile(path.join(dir, CATALOG_FILE))
    expect(catalog.assets).toMatchObject({
      available: true,
      id: sha256(gzip).slice(0, 16),
      bytes: gzip.length,
      schemaVersion: SCHEMA_VERSION,
      source: { updatedAt: "2026-09-24T21:18:09.156Z" },
      forge: { commit: FORGE, cards: 10, matched: 9, forgeOnly: 1 },
      counts: { cards: 5, germanText: 4, germanImage: 3, sets: 2, forgeOnly: 1 },
    })
  })

  it("fails loudly without a catalog build", async () => {
    await expect(verifyCatalog(await tempDir())).rejects.toThrow(/no card catalog .* npm run cards:build/)
  })

  it("fails loudly on a file that does not match the manifest", async () => {
    const dir = await fakeCatalog()
    await fs.appendFile(path.join(dir, CATALOG_FILE), "x")
    await expect(verifyCatalog(dir)).rejects.toThrow(/has \d+ bytes, the manifest says \d+/)
    const other = await fakeCatalog()
    const gzip = await fs.readFile(path.join(other, CATALOG_FILE))
    gzip[gzip.length - 1] = (gzip[gzip.length - 1] ?? 0) ^ 0xff
    await fs.writeFile(path.join(other, CATALOG_FILE), gzip)
    await expect(verifyCatalog(other)).rejects.toThrow(/has SHA-256 [0-9a-f]{64}, the manifest says/)
    await fs.rm(path.join(other, CATALOG_FILE))
    await expect(verifyCatalog(other)).rejects.toThrow(/is missing/)
  })

  it("refuses a catalog of another local data schema, and a wrong id", async () => {
    await expect(verifyCatalog(await fakeCatalog((m) => (m["schemaVersion"] = SCHEMA_VERSION + 1)))).rejects.toThrow(`schema ${SCHEMA_VERSION + 1}, the app uses schema ${SCHEMA_VERSION}`)
    await expect(verifyCatalog(await fakeCatalog((m) => (m["id"] = "0000000000000000")))).rejects.toThrow(/is not the start of the file's SHA-256/)
    await expect(verifyCatalog(await fakeCatalog((m) => (m["format"] = "x")))).rejects.toThrow(/format/)
    await expect(verifyCatalog(await fakeCatalog((m) => delete m["counts"]))).rejects.toThrow(/counts must be an object/)
  })

  it("refuses a catalog matched against another Forge than the engine's", async () => {
    const dir = await fakeCatalog()
    await expect(verifyCatalog(dir, await engineManifest(FORGE))).resolves.toBeTruthy()
    await expect(verifyCatalog(dir, await engineManifest("1".repeat(40)))).rejects.toThrow(/matched against Forge ed0333fecb, the engine is built from Forge 1111111111/)
    // No (readable) engine: nothing to compare with.
    await expect(verifyCatalog(dir, "/nonexistent/engine-manifest.json")).resolves.toBeTruthy()
  })
})

describe("card module for the app", () => {
  it("serves the catalog content-addressed below the base URL", async () => {
    const catalog = await verifyCatalog(await fakeCatalog())
    expect(describeCards(catalog, "/", { reason: "missing", detail: "" })).toMatchObject({ available: true, url: `/cards/${catalog.assets.id}/${CATALOG_FILE}` })
    expect(describeCards(catalog, "/openmana/", { reason: "missing", detail: "" })).toMatchObject({ url: `/openmana/cards/${catalog.assets.id}/${CATALOG_FILE}` })
    expect(describeCards(null, "/", { reason: "omitted", detail: "x" })).toEqual({ available: false, reason: "omitted", detail: "x" })
    expect(SERVED_CARD_FILES).toEqual([CATALOG_FILE, CATALOG_MANIFEST_FILE])
  })

  it("reads OPENMANA_CARDS strictly", () => {
    expect(cardsModeFromEnv(undefined)).toBe("required")
    expect(cardsModeFromEnv("")).toBe("required")
    expect(cardsModeFromEnv("omit")).toBe("omit")
    expect(() => cardsModeFromEnv("none")).toThrow(CardAssetsError)
  })
})

describe("cardAssets plugin", () => {
  const logger = { info: () => undefined, warn: () => undefined }

  async function resolve(options: { dir: string; mode: "required" | "omit" }, command: "build" | "serve") {
    const plugin = cardAssets(options)
    ;(plugin.config as (c: object, e: object) => void)({}, { command, mode: "production" })
    await (plugin.configResolved as (c: ResolvedConfig) => Promise<void>)({ base: "/", command, logger } as unknown as ResolvedConfig)
    const resolved = (plugin.resolveId as (id: string) => string | null)(CARDS_MODULE_ID)
    return resolved ? ((plugin.load as (id: string) => string | null)(resolved) ?? "") : ""
  }

  it("a production build without a verified catalog fails", async () => {
    await expect(resolve({ dir: await tempDir(), mode: "required" }, "build")).rejects.toThrow(CardAssetsError)
  })

  it("the dev server starts without a catalog and the app learns why", async () => {
    const code = await resolve({ dir: await tempDir(), mode: "required" }, "serve")
    expect(code).toContain('"available":false')
    expect(code).toContain('"reason":"missing"')
  })

  it("OPENMANA_CARDS=omit builds without card data on purpose", async () => {
    expect(await resolve({ dir: "/nonexistent", mode: "omit" }, "build")).toContain('"reason":"omitted"')
  })

  it("a verified catalog becomes the app's card module, and exactly its files are copied", async () => {
    const dir = await fakeCatalog()
    const catalog = await verifyCatalog(dir)
    expect(await resolve({ dir, mode: "required" }, "build")).toBe(`export const CARD_ASSETS = ${JSON.stringify(describeCards(catalog, "/", { reason: "missing", detail: "" }))};\n`)
    const out = await tempDir()
    const plugin = cardAssets({ dir, mode: "required" })
    ;(plugin.config as (c: object, e: object) => void)({}, { command: "build", mode: "production" })
    await (plugin.configResolved as (c: ResolvedConfig) => Promise<void>)({ base: "/", command: "build", logger } as unknown as ResolvedConfig)
    await (plugin.writeBundle as (o: { dir: string }) => Promise<void>)({ dir: out })
    expect((await fs.readdir(path.join(out, "cards", catalog.assets.id))).sort()).toEqual([...SERVED_CARD_FILES].sort())
    expect((await verifyCatalog(path.join(out, "cards", catalog.assets.id))).assets.id).toBe(catalog.assets.id)
  })
})
