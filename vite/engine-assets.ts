/*
 * The Forge engine inside the web app.
 *
 * The engine is built separately (engine/scripts/build.sh, ~6 min, GraalVM
 * Web Image) into engine/build/dist. This plugin takes exactly those
 * artefacts, verifies them against their manifest (size and SHA-256 of every
 * runtime file, protocol version = the app's) and serves them
 * content-addressed under engine/<id>/:
 *
 *   dev server   streams them from engine/build/dist (with the isolation headers)
 *   vite build   copies them into dist/engine/<id>/ and verifies the copy
 *   the app      imports virtual:openmana-engine: their URLs plus build facts
 *
 * A build without a verified engine fails loudly. OPENMANA_ENGINE=omit builds
 * without one on purpose (UI-only checks); the app then says that this build
 * has no engine. The dev server starts without an engine too and the app
 * shows why. Nothing here knows about Forge beyond its manifest - and the AI
 * profiles in its data inventory: the app describes them to the player
 * (src/game/ai-profile-table.ts, prompt 12), so an engine whose profiles are
 * not exactly the verified files stops the build until someone verifies them.
 */
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import type { Plugin } from "vite"
import { PROTOCOL_VERSION } from "../engine/protocol/src/generated/constants.ts"
import type { EngineAssets, EngineBuildFacts } from "../src/engine/engine-assets-types.ts"
import { AI_PROFILE_TABLE } from "../src/game/ai-profile-table.ts"
import { ISOLATION_HEADERS } from "./isolation-headers.ts"

export const ENGINE_MODULE_ID = "virtual:openmana-engine"
const RESOLVED_ENGINE_MODULE_ID = `\0${ENGINE_MODULE_ID}`

export const MANIFEST_FILE = "engine-manifest.json"
export const MANIFEST_FORMAT = "openmana-engine-manifest/2"
/** What the worker loads: the worker host, GraalVM's launcher and the module. */
export const RUNTIME_FILES = ["engine-worker.js", "openmana-engine.js", "openmana-engine.js.wasm"] as const
/** Everything served under engine/<id>/: the runtime files and the manifest (diagnostics). */
export const SERVED_FILES: readonly string[] = [...RUNTIME_FILES, MANIFEST_FILE]
/** Every file of Forge's data in the engine, with size and SHA-256 (listed in the manifest; not served). */
export const INVENTORY_FILE = "forge-res.inventory.json"
const INVENTORY_FORMAT = "openmana-resource-inventory/1"

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json; charset=utf-8",
}

export class EngineAssetsError extends Error {
  override name = "EngineAssetsError"
}

export interface VerifiedEngine {
  readonly dir: string
  readonly id: string
  readonly build: EngineBuildFacts
}

export type EngineMode = "required" | "omit"

export interface EngineAssetsOptions {
  /** Directory with the engine artefacts (engine/build/dist). */
  readonly dir: string
  readonly mode: EngineMode
}

/** OPENMANA_ENGINE: unset or "required" (default), or "omit". Anything else is a mistake. */
export function engineModeFromEnv(value: string | undefined): EngineMode {
  if (value === undefined || value === "" || value === "required") return "required"
  if (value === "omit") return "omit"
  throw new EngineAssetsError(`OPENMANA_ENGINE must be "required" or "omit", not ${JSON.stringify(value)}`)
}

/**
 * Reads engine-manifest.json in `dir` and checks every runtime file against
 * it. Throws EngineAssetsError with the first problem.
 */
export async function verifyEngine(dir: string): Promise<VerifiedEngine> {
  const manifestPath = path.join(dir, MANIFEST_FILE)
  let text: string
  try {
    text = await fs.readFile(manifestPath, "utf8")
  } catch (e) {
    throw new EngineAssetsError(
      `no engine build in ${dir} (${errorCode(e)} reading ${MANIFEST_FILE}); build it with: bash engine/scripts/build.sh`,
    )
  }
  let manifest: Record<string, unknown>
  try {
    manifest = record(JSON.parse(text), MANIFEST_FILE)
  } catch (e) {
    throw new EngineAssetsError(`${manifestPath} is not a readable engine manifest: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (manifest["format"] !== MANIFEST_FORMAT) {
    throw new EngineAssetsError(`${manifestPath}: format ${JSON.stringify(manifest["format"])}, expected ${MANIFEST_FORMAT}`)
  }
  const protocolVersion = integer(record(manifest["protocol"], "protocol")["version"], "protocol.version")
  if (protocolVersion !== PROTOCOL_VERSION) {
    throw new EngineAssetsError(
      `the engine in ${dir} speaks protocol ${protocolVersion}, the app speaks protocol ${PROTOCOL_VERSION}: rebuild the engine (bash engine/scripts/build.sh)`,
    )
  }
  const artefacts = record(manifest["artefacts"], "artefacts")
  let downloadBytes = 0
  let downloadBrotliBytes = 0
  const digests: string[] = []
  for (const name of RUNTIME_FILES) {
    const entry = record(artefacts[name], `artefacts.${name}`)
    const bytes = integer(entry["bytes"], `artefacts.${name}.bytes`)
    const sha256 = hex64(entry["sha256"], `artefacts.${name}.sha256`)
    const file = path.join(dir, name)
    let size: number
    try {
      size = (await fs.stat(file)).size
    } catch (e) {
      throw new EngineAssetsError(`${file} is missing (${errorCode(e)}), the manifest lists it`)
    }
    if (size !== bytes) {
      throw new EngineAssetsError(`${file} has ${size} bytes, the manifest says ${bytes}: incomplete or foreign engine build`)
    }
    const actual = await sha256File(file)
    if (actual !== sha256) {
      throw new EngineAssetsError(`${file} has SHA-256 ${actual}, the manifest says ${sha256}: incomplete or foreign engine build`)
    }
    downloadBytes += bytes
    downloadBrotliBytes += integer(entry["brotli11Bytes"], `artefacts.${name}.brotli11Bytes`)
    digests.push(`${name} ${sha256}\n`)
  }
  const forge = record(manifest["forge"], "forge")
  const build: EngineBuildFacts = {
    manifestSha256: createHash("sha256").update(text).digest("hex"),
    builtAt: string(manifest["builtAt"], "builtAt"),
    forgeRepository: string(forge["repository"], "forge.repository"),
    forgeCommit: string(forge["commit"], "forge.commit"),
    forgeVersionCode: string(forge["versionCode"], "forge.versionCode"),
    patchCount: integer(record(manifest["patches"], "patches")["count"], "patches.count"),
    protocolVersion,
    graalvm: string(record(manifest["toolchain"], "toolchain")["graalvm"], "toolchain.graalvm"),
    downloadBytes,
    downloadBrotliBytes,
    wasmBytes: integer(record(artefacts["openmana-engine.js.wasm"], "artefacts.openmana-engine.js.wasm")["bytes"], "wasm bytes"),
  }
  const id = createHash("sha256").update(digests.join("")).digest("hex").slice(0, 16)
  return { dir, id, build }
}

/** An AI profile in the engine's data: Forge's name (res/ai/<name>.ai) and the file's SHA-256. */
export interface EngineAiProfile {
  readonly name: string
  readonly sha256: string
}

/**
 * Forge's AI profiles in the engine build in `dir`, from its data inventory
 * (checked against the manifest first), sorted by name.
 */
export async function readEngineAiProfiles(dir: string): Promise<EngineAiProfile[]> {
  const manifest = record(JSON.parse(await fs.readFile(path.join(dir, MANIFEST_FILE), "utf8")), MANIFEST_FILE)
  const entry = record(record(manifest["artefacts"], "artefacts")[INVENTORY_FILE], `artefacts.${INVENTORY_FILE}`)
  const file = path.join(dir, INVENTORY_FILE)
  let actual: string
  try {
    actual = await sha256File(file)
  } catch (e) {
    throw new EngineAssetsError(`${file} is missing (${errorCode(e)}), the manifest lists it`)
  }
  if (actual !== hex64(entry["sha256"], `artefacts.${INVENTORY_FILE}.sha256`)) {
    throw new EngineAssetsError(`${file} has SHA-256 ${actual}, the manifest says ${String(entry["sha256"])}: incomplete or foreign engine build`)
  }
  let inventory: Record<string, unknown>
  try {
    inventory = record(JSON.parse(await fs.readFile(file, "utf8")), INVENTORY_FILE)
  } catch (e) {
    throw new EngineAssetsError(`${file} is not a readable inventory: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (inventory["format"] !== INVENTORY_FORMAT) {
    throw new EngineAssetsError(`${file}: format ${JSON.stringify(inventory["format"])}, expected ${INVENTORY_FORMAT}`)
  }
  const columns = inventory["columns"]
  if (!Array.isArray(columns) || columns.join() !== "path,bytes,sha256" || !Array.isArray(inventory["files"])) {
    throw new EngineAssetsError(`${file}: expected the columns path, bytes, sha256 and a list of files`)
  }
  const profiles: EngineAiProfile[] = []
  for (const row of inventory["files"] as unknown[]) {
    if (!Array.isArray(row) || typeof row[0] !== "string") throw new EngineAssetsError(`${file}: a file entry is not [path, bytes, sha256]`)
    const match = /^res\/ai\/([^/]+)\.ai$/.exec(row[0])
    if (match) profiles.push({ name: match[1]!, sha256: hex64(row[2], `${INVENTORY_FILE} ${row[0]}`) })
  }
  return profiles.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/**
 * The app describes Forge's AI profiles to the player (src/game/ai-profile-table.ts);
 * those descriptions were verified against particular files. Throws unless
 * the engine carries exactly the verified profiles, byte for byte.
 */
export function checkAiProfiles(found: readonly EngineAiProfile[], verified: readonly EngineAiProfile[] = AI_PROFILE_TABLE): void {
  const problems: string[] = []
  for (const profile of found) {
    const known = verified.find((v) => v.name === profile.name)
    if (!known) problems.push(`${profile.name} is new`)
    else if (known.sha256 !== profile.sha256) problems.push(`${profile.name} changed (SHA-256 ${profile.sha256}, verified ${known.sha256})`)
  }
  for (const known of verified) {
    if (!found.some((profile) => profile.name === known.name)) problems.push(`${known.name} is gone`)
  }
  if (problems.length > 0) {
    throw new EngineAssetsError(
      `the engine's Forge AI profiles are not the verified ones: ${problems.join("; ")}. Verify what they do ` +
        "(docs/research/AI_PROFILES.md, bash engine/scripts/ai-profile-study.sh) and update src/game/ai-profile-table.ts",
    )
  }
}

/** The module the app imports: where the engine is served, or why there is none. */
export function describeEngine(engine: VerifiedEngine | null, base: string, unavailable: { reason: "missing" | "omitted"; detail: string }): EngineAssets {
  if (!engine) {
    return { available: false, ...unavailable }
  }
  const dir = `${base}engine/${engine.id}/`
  return {
    available: true,
    id: engine.id,
    workerUrl: `${dir}engine-worker.js`,
    launcherUrl: `${dir}openmana-engine.js`,
    wasmUrl: `${dir}openmana-engine.js.wasm`,
    manifestUrl: `${dir}${MANIFEST_FILE}`,
    build: engine.build,
  }
}

export function engineAssets(options: EngineAssetsOptions): Plugin {
  let engine: VerifiedEngine | null = null
  let assets: EngineAssets | null = null
  let isPreview = false

  return {
    name: "openmana:engine-assets",

    config(_config, env) {
      isPreview = env.isPreview === true
    },

    async configResolved(config) {
      // `vite preview` serves dist/, which already contains the verified copy.
      if (isPreview) return
      if (options.mode === "omit") {
        assets = describeEngine(null, config.base, { reason: "omitted", detail: "built with OPENMANA_ENGINE=omit" })
        config.logger.warn("[openmana] OPENMANA_ENGINE=omit: this build contains no Forge engine")
        return
      }
      try {
        const verified = await verifyEngine(options.dir)
        checkAiProfiles(await readEngineAiProfiles(options.dir))
        engine = verified
      } catch (e) {
        // A production build must never ship without its engine.
        if (config.command === "build" || !(e instanceof EngineAssetsError)) throw e
        assets = describeEngine(null, config.base, { reason: "missing", detail: e.message })
        config.logger.warn(`[openmana] no engine for the dev server: ${e.message}`)
        return
      }
      assets = describeEngine(engine, config.base, { reason: "missing", detail: "" })
      config.logger.info(
        `[openmana] engine ${engine.id}: Forge ${engine.build.forgeCommit.slice(0, 10)}, protocol ${engine.build.protocolVersion}, ${formatMiB(engine.build.downloadBytes)} MiB`,
      )
    },

    resolveId(id) {
      return id === ENGINE_MODULE_ID ? RESOLVED_ENGINE_MODULE_ID : null
    },

    load(id) {
      if (id !== RESOLVED_ENGINE_MODULE_ID) return null
      if (!assets) throw new EngineAssetsError("virtual:openmana-engine was loaded before the engine was checked")
      return `export const ENGINE_ASSETS = ${JSON.stringify(assets)};\n`
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const verified = engine
        if (!verified || !req.url) return next()
        const prefix = `${server.config.base}engine/${verified.id}/`
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
        if (!pathname.startsWith(prefix)) return next()
        const name = pathname.slice(prefix.length)
        if (!SERVED_FILES.includes(name)) {
          res.writeHead(404, { ...ISOLATION_HEADERS, "Content-Type": "text/plain; charset=utf-8" })
          res.end("not an engine file")
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
      if (!engine) return
      if (!output.dir) throw new EngineAssetsError("the engine can only be copied into an output directory (build.outDir)")
      const target = path.join(output.dir, "engine", engine.id)
      await fs.mkdir(target, { recursive: true })
      for (const name of SERVED_FILES) {
        await fs.copyFile(path.join(engine.dir, name), path.join(target, name))
      }
      // The deployment must carry exactly the verified bytes.
      const copy = await verifyEngine(target)
      if (copy.id !== engine.id) {
        throw new EngineAssetsError(`the copy in ${target} is engine ${copy.id}, not ${engine.id}`)
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

function formatMiB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}

function errorCode(e: unknown): string {
  return e instanceof Error && "code" in e ? String(e.code) : String(e)
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new EngineAssetsError(`engine manifest: ${where} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, where: string): string {
  if (typeof value !== "string" || value === "") {
    throw new EngineAssetsError(`engine manifest: ${where} must be a non-empty string`)
  }
  return value
}

function integer(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new EngineAssetsError(`engine manifest: ${where} must be a non-negative integer`)
  }
  return value
}

function hex64(value: unknown, where: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new EngineAssetsError(`engine manifest: ${where} must be a SHA-256 in hex`)
  }
  return value
}
