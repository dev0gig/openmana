/*
 * The card catalog inside the web app.
 *
 * The catalog is built separately (npm run cards:build, cards/scripts/) into
 * cards/build/dist. This plugin takes exactly that file, verifies it against
 * its manifest (size and SHA-256, the local data schema version the records
 * follow = the app's, and - when the engine is there too - the same Forge
 * commit the engine was built from) and serves it content-addressed under
 * cards/<id>/:
 *
 *   dev server   streams it from cards/build/dist (with the isolation headers)
 *   vite build   copies it into dist/cards/<id>/ and verifies the copy
 *   the app      imports virtual:openmana-cards: its URL plus the manifest's facts
 *
 * A build without a verified catalog fails loudly. OPENMANA_CARDS=omit builds
 * without one on purpose (UI-only checks); the app then says that this build
 * has no card data. The dev server starts without a catalog too and the app
 * shows why.
 */
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import type { Plugin } from "vite"
import type { CardAssets } from "../src/cards/card-assets-types.ts"
import { SCHEMA_VERSION } from "../src/storage/generated/constants.ts"
import { ISOLATION_HEADERS } from "./isolation-headers.ts"

export const CARDS_MODULE_ID = "virtual:openmana-cards"
const RESOLVED_CARDS_MODULE_ID = `\0${CARDS_MODULE_ID}`

export const CATALOG_FILE = "card-catalog.jsonl.gz"
export const CATALOG_MANIFEST_FILE = "card-catalog-manifest.json"
export const CATALOG_MANIFEST_FORMAT = "openmana-card-catalog-manifest/1"
/** Served under cards/<id>/: the catalog and its manifest (diagnostics). */
export const SERVED_CARD_FILES: readonly string[] = [CATALOG_FILE, CATALOG_MANIFEST_FILE]

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".gz": "application/gzip",
  ".json": "application/json; charset=utf-8",
}

export class CardAssetsError extends Error {
  override name = "CardAssetsError"
}

export interface VerifiedCatalog {
  readonly dir: string
  readonly assets: Omit<Extract<CardAssets, { available: true }>, "url">
}

export type CardsMode = "required" | "omit"

export interface CardAssetsOptions {
  /** Directory with the catalog (cards/build/dist). */
  readonly dir: string
  readonly mode: CardsMode
  /** The engine's manifest: if it is there, the catalog must have been matched against the same Forge commit. */
  readonly engineManifest?: string
}

/** OPENMANA_CARDS: unset or "required" (default), or "omit". Anything else is a mistake. */
export function cardsModeFromEnv(value: string | undefined): CardsMode {
  if (value === undefined || value === "" || value === "required") return "required"
  if (value === "omit") return "omit"
  throw new CardAssetsError(`OPENMANA_CARDS must be "required" or "omit", not ${JSON.stringify(value)}`)
}

/**
 * Reads the catalog manifest in `dir` and checks the catalog file against
 * it. Throws CardAssetsError with the first problem.
 */
export async function verifyCatalog(dir: string, engineManifest?: string): Promise<VerifiedCatalog> {
  const manifestPath = path.join(dir, CATALOG_MANIFEST_FILE)
  let text: string
  try {
    text = await fs.readFile(manifestPath, "utf8")
  } catch (e) {
    throw new CardAssetsError(`no card catalog in ${dir} (${errorCode(e)} reading ${CATALOG_MANIFEST_FILE}); build it with: npm run cards:build`)
  }
  let manifest: Record<string, unknown>
  try {
    manifest = record(JSON.parse(text), CATALOG_MANIFEST_FILE)
  } catch (e) {
    throw new CardAssetsError(`${manifestPath} is not a readable card catalog manifest: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (manifest["format"] !== CATALOG_MANIFEST_FORMAT) {
    throw new CardAssetsError(`${manifestPath}: format ${JSON.stringify(manifest["format"])}, expected ${CATALOG_MANIFEST_FORMAT}`)
  }
  const schemaVersion = integer(manifest["schemaVersion"], "schemaVersion")
  if (schemaVersion !== SCHEMA_VERSION) {
    throw new CardAssetsError(
      `the card catalog in ${dir} has records of local data schema ${schemaVersion}, the app uses schema ${SCHEMA_VERSION}: rebuild it (npm run cards:build)`,
    )
  }
  const file = record(manifest["file"], "file")
  if (file["name"] !== CATALOG_FILE) throw new CardAssetsError(`${manifestPath}: file.name must be ${CATALOG_FILE}`)
  const bytes = integer(file["bytes"], "file.bytes")
  const sha256 = hex64(file["sha256"], "file.sha256")
  const id = string(manifest["id"], "id")
  if (id !== sha256.slice(0, 16)) throw new CardAssetsError(`${manifestPath}: id ${id} is not the start of the file's SHA-256`)
  const catalogPath = path.join(dir, CATALOG_FILE)
  let size: number
  try {
    size = (await fs.stat(catalogPath)).size
  } catch (e) {
    throw new CardAssetsError(`${catalogPath} is missing (${errorCode(e)}), the manifest lists it`)
  }
  if (size !== bytes) throw new CardAssetsError(`${catalogPath} has ${size} bytes, the manifest says ${bytes}: incomplete or foreign catalog`)
  const actual = await sha256File(catalogPath)
  if (actual !== sha256) throw new CardAssetsError(`${catalogPath} has SHA-256 ${actual}, the manifest says ${sha256}: incomplete or foreign catalog`)

  const forge = record(manifest["forge"], "forge")
  const forgeCommit = string(forge["commit"], "forge.commit")
  if (engineManifest !== undefined) {
    const engineForge = await engineForgeCommit(engineManifest)
    if (engineForge !== null && engineForge !== forgeCommit) {
      throw new CardAssetsError(
        `the card catalog was matched against Forge ${forgeCommit.slice(0, 10)}, the engine is built from Forge ${engineForge.slice(0, 10)}: rebuild the catalog (npm run cards:build)`,
      )
    }
  }
  const source = record(manifest["source"], "source")
  const counts = record(manifest["counts"], "counts")
  return {
    dir,
    assets: {
      available: true,
      id,
      bytes,
      sha256,
      uncompressedBytes: integer(file["uncompressedBytes"], "file.uncompressedBytes"),
      uncompressedSha256: hex64(file["uncompressedSha256"], "file.uncompressedSha256"),
      lines: integer(file["lines"], "file.lines"),
      schemaVersion,
      source: { updatedAt: string(source["updatedAt"], "source.updatedAt"), uri: string(source["uri"], "source.uri") },
      forge: {
        commit: forgeCommit,
        cards: integer(forge["cards"], "forge.cards"),
        matched: integer(forge["matched"], "forge.matched"),
        forgeOnly: integer(forge["forgeOnly"], "forge.forgeOnly"),
      },
      counts: {
        cards: integer(counts["cards"], "counts.cards"),
        germanText: integer(counts["germanText"], "counts.germanText"),
        germanImage: integer(counts["germanImage"], "counts.germanImage"),
        sets: integer(counts["sets"], "counts.sets"),
        forgeOnly: integer(counts["forgeOnly"], "counts.forgeOnly"),
      },
      builtAt: string(manifest["builtAt"], "builtAt"),
    },
  }
}

/** The Forge commit of an engine build, or null if there is no (readable) engine manifest. */
async function engineForgeCommit(file: string): Promise<string | null> {
  try {
    const manifest = JSON.parse(await fs.readFile(file, "utf8")) as { forge?: { commit?: unknown } }
    return typeof manifest.forge?.commit === "string" ? manifest.forge.commit : null
  } catch {
    return null
  }
}

/** The module the app imports: where the catalog is served, or why there is none. */
export function describeCards(catalog: VerifiedCatalog | null, base: string, unavailable: { reason: "missing" | "omitted"; detail: string }): CardAssets {
  if (!catalog) return { available: false, ...unavailable }
  return { ...catalog.assets, url: `${base}cards/${catalog.assets.id}/${CATALOG_FILE}` }
}

export function cardAssets(options: CardAssetsOptions): Plugin {
  let catalog: VerifiedCatalog | null = null
  let assets: CardAssets | null = null
  let isPreview = false

  return {
    name: "openmana:card-assets",

    config(_config, env) {
      isPreview = env.isPreview === true
    },

    async configResolved(config) {
      // `vite preview` serves dist/, which already contains the verified copy.
      if (isPreview) return
      if (options.mode === "omit") {
        assets = describeCards(null, config.base, { reason: "omitted", detail: "built with OPENMANA_CARDS=omit" })
        config.logger.warn("[openmana] OPENMANA_CARDS=omit: this build contains no card catalog")
        return
      }
      try {
        catalog = await verifyCatalog(options.dir, options.engineManifest)
      } catch (e) {
        // A production build must never ship without its card data.
        if (config.command === "build" || !(e instanceof CardAssetsError)) throw e
        assets = describeCards(null, config.base, { reason: "missing", detail: e.message })
        config.logger.warn(`[openmana] no card catalog for the dev server: ${e.message}`)
        return
      }
      assets = describeCards(catalog, config.base, { reason: "missing", detail: "" })
      const { counts, source } = catalog.assets
      config.logger.info(
        `[openmana] card catalog ${catalog.assets.id}: ${counts.cards} cards (${counts.germanText} with German text), Scryfall ${source.updatedAt.slice(0, 10)}, ${(catalog.assets.bytes / 1024 / 1024).toFixed(1)} MiB`,
      )
    },

    resolveId(id) {
      return id === CARDS_MODULE_ID ? RESOLVED_CARDS_MODULE_ID : null
    },

    load(id) {
      if (id !== RESOLVED_CARDS_MODULE_ID) return null
      if (!assets) throw new CardAssetsError("virtual:openmana-cards was loaded before the card catalog was checked")
      return `export const CARD_ASSETS = ${JSON.stringify(assets)};\n`
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const verified = catalog
        if (!verified || !req.url) return next()
        const prefix = `${server.config.base}cards/${verified.assets.id}/`
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
        if (!pathname.startsWith(prefix)) return next()
        const name = pathname.slice(prefix.length)
        if (!SERVED_CARD_FILES.includes(name)) {
          res.writeHead(404, { ...ISOLATION_HEADERS, "Content-Type": "text/plain; charset=utf-8" })
          res.end("not a card catalog file")
          return
        }
        const file = path.join(verified.dir, name)
        fs.stat(file).then(
          (stat) => {
            res.writeHead(200, {
              ...ISOLATION_HEADERS,
              "Content-Type": CONTENT_TYPES[path.extname(name)] ?? "application/octet-stream",
              "Content-Length": String(stat.size),
              "Cache-Control": "no-cache",
            })
            createReadStream(file).pipe(res)
          },
          (e: unknown) => next(e),
        )
      })
    },

    async writeBundle(output) {
      if (!catalog) return
      if (!output.dir) throw new CardAssetsError("the card catalog can only be copied into an output directory (build.outDir)")
      const target = path.join(output.dir, "cards", catalog.assets.id)
      await fs.mkdir(target, { recursive: true })
      for (const name of SERVED_CARD_FILES) {
        await fs.copyFile(path.join(catalog.dir, name), path.join(target, name))
      }
      // The deployment must carry exactly the verified bytes.
      const copy = await verifyCatalog(target)
      if (copy.assets.id !== catalog.assets.id) {
        throw new CardAssetsError(`the copy in ${target} is catalog ${copy.assets.id}, not ${catalog.assets.id}`)
      }
    },
  }
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk as Buffer)
  }
  return hash.digest("hex")
}

function errorCode(e: unknown): string {
  return e instanceof Error && "code" in e ? String(e.code) : String(e)
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CardAssetsError(`card catalog manifest: ${where} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, where: string): string {
  if (typeof value !== "string" || value === "") {
    throw new CardAssetsError(`card catalog manifest: ${where} must be a non-empty string`)
  }
  return value
}

function integer(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new CardAssetsError(`card catalog manifest: ${where} must be a non-negative integer`)
  }
  return value
}

function hex64(value: unknown, where: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new CardAssetsError(`card catalog manifest: ${where} must be a SHA-256 in hex`)
  }
  return value
}
