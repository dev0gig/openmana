// @vitest-environment node
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { ResolvedConfig } from "vite"
import { afterEach, describe, expect, it } from "vitest"
import { PROTOCOL_VERSION } from "../engine/protocol/src/generated/constants.ts"
import { AI_PROFILE_TABLE } from "../src/game/ai-profile-table.ts"
import {
  checkAiProfiles,
  describeEngine,
  ENGINE_MODULE_ID,
  EngineAssetsError,
  engineAssets,
  engineModeFromEnv,
  INVENTORY_FILE,
  MANIFEST_FILE,
  readEngineAiProfiles,
  RUNTIME_FILES,
  SERVED_FILES,
  verifyEngine,
} from "./engine-assets.ts"

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

const sha256 = (data: string) => createHash("sha256").update(data).digest("hex")

/** Forge's data inventory of a fake engine: a card script and the AI profiles (by default exactly the verified ones). */
function inventory(profiles: readonly { name: string; sha256: string }[] = AI_PROFILE_TABLE): string {
  const files = [
    ...profiles.map((profile) => [`res/ai/${profile.name}.ai`, 100, profile.sha256]),
    ["res/cardsfolder/a/ajani_goldmane.txt", 50, "a".repeat(64)],
  ]
  return JSON.stringify({ format: "openmana-resource-inventory/1", forgeCommit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798", columns: ["path", "bytes", "sha256"], files })
}

/** A small engine build: three runtime files, the data inventory and a manifest of format 2 describing them. */
async function fakeEngine(edit: (manifest: Record<string, any>) => void = () => undefined, inventoryText = inventory()): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openmana-engine-test-"))
  dirs.push(dir)
  const artefacts: Record<string, unknown> = {}
  for (const name of RUNTIME_FILES) {
    const content = `// ${name}\n`
    await fs.writeFile(path.join(dir, name), content)
    artefacts[name] = { bytes: Buffer.byteLength(content), sha256: sha256(content), gzip9Bytes: 10, brotli11Bytes: 7 }
  }
  await fs.writeFile(path.join(dir, INVENTORY_FILE), inventoryText)
  artefacts[INVENTORY_FILE] = { bytes: Buffer.byteLength(inventoryText), sha256: sha256(inventoryText), gzip9Bytes: 10, brotli11Bytes: 7 }
  const manifest: Record<string, any> = {
    format: "openmana-engine-manifest/2",
    builtAt: "2026-09-24T19:34:25.845Z",
    forge: { repository: "https://github.com/Card-Forge/forge", commit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798", versionCode: "2.0.15" },
    patches: { count: 6, sha256: "d434f05792db3addec2bcc386318a7cdb5e0e3f4f1394d5490a73d28d3238ad7", files: [] },
    toolchain: { graalvm: "25.4.4.1.1" },
    protocol: { version: PROTOCOL_VERSION, schema: "engine/protocol/schema/protocol.schema.json" },
    artefacts,
  }
  edit(manifest)
  await fs.writeFile(path.join(dir, MANIFEST_FILE), JSON.stringify(manifest, null, 1))
  return dir
}

describe("verifyEngine", () => {
  it("accepts a complete build and derives a content address", async () => {
    const dir = await fakeEngine()
    const engine = await verifyEngine(dir)
    expect(engine.id).toMatch(/^[0-9a-f]{16}$/)
    expect(engine.build).toEqual({
      builtAt: "2026-09-24T19:34:25.845Z",
      forgeRepository: "https://github.com/Card-Forge/forge",
      forgeCommit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798",
      forgeVersionCode: "2.0.15",
      patchCount: 6,
      protocolVersion: PROTOCOL_VERSION,
      graalvm: "25.4.4.1.1",
      downloadBytes: RUNTIME_FILES.reduce((sum, name) => sum + Buffer.byteLength(`// ${name}\n`), 0),
      downloadBrotliBytes: 21,
      wasmBytes: Buffer.byteLength("// openmana-engine.js.wasm\n"),
    })
    // Same files, same address; another file content, another address.
    expect((await verifyEngine(await fakeEngine())).id).toBe(engine.id)
    const other = await fakeEngine()
    const wasm = path.join(other, "openmana-engine.js.wasm")
    await fs.writeFile(wasm, "// other\n")
    const manifest = JSON.parse(await fs.readFile(path.join(other, MANIFEST_FILE), "utf8"))
    manifest.artefacts["openmana-engine.js.wasm"] = { bytes: 9, sha256: sha256("// other\n"), brotli11Bytes: 7 }
    await fs.writeFile(path.join(other, MANIFEST_FILE), JSON.stringify(manifest))
    expect((await verifyEngine(other)).id).not.toBe(engine.id)
  })

  it("fails loudly without an engine build", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openmana-engine-test-"))
    dirs.push(dir)
    await expect(verifyEngine(dir)).rejects.toThrow(/no engine build .* bash engine\/scripts\/build\.sh/)
  })

  it("fails loudly on a file that does not match the manifest", async () => {
    const dir = await fakeEngine()
    await fs.appendFile(path.join(dir, "openmana-engine.js.wasm"), "x")
    await expect(verifyEngine(dir)).rejects.toThrow(/has \d+ bytes, the manifest says \d+/)
    const same = await fakeEngine()
    await fs.writeFile(path.join(same, "openmana-engine.js"), "// openmana-engine.jX\n")
    await expect(verifyEngine(same)).rejects.toThrow(/has SHA-256 [0-9a-f]{64}, the manifest says/)
  })

  it("fails loudly on a missing runtime file", async () => {
    const dir = await fakeEngine()
    await fs.rm(path.join(dir, "engine-worker.js"))
    await expect(verifyEngine(dir)).rejects.toThrow(/engine-worker\.js is missing/)
  })

  it("refuses an engine that speaks another protocol", async () => {
    const dir = await fakeEngine((m) => {
      m["protocol"].version = PROTOCOL_VERSION + 1
    })
    await expect(verifyEngine(dir)).rejects.toThrow(`speaks protocol ${PROTOCOL_VERSION + 1}, the app speaks protocol ${PROTOCOL_VERSION}`)
  })

  it("refuses unknown manifest formats and incomplete manifests", async () => {
    await expect(verifyEngine(await fakeEngine((m) => (m["format"] = "openmana-engine-manifest/1")))).rejects.toThrow(/format/)
    await expect(verifyEngine(await fakeEngine((m) => delete m["artefacts"]["engine-worker.js"]))).rejects.toThrow(/artefacts\.engine-worker\.js must be an object/)
    await expect(verifyEngine(await fakeEngine((m) => (m["forge"].commit = "")))).rejects.toThrow(/forge\.commit/)
    await expect(verifyEngine(await fakeEngine((m) => (m["artefacts"]["openmana-engine.js"].sha256 = "XYZ")))).rejects.toThrow(/SHA-256 in hex/)
  })
})

describe("Forge's AI profiles in the engine (prompt 12)", () => {
  it("reads them from the checked data inventory, sorted by name", async () => {
    const profiles = await readEngineAiProfiles(await fakeEngine())
    expect(profiles.map((profile) => profile.name)).toEqual(["Cautious", "Default", "Experimental", "Reckless"])
    expect(profiles).toEqual([...AI_PROFILE_TABLE].map(({ name, sha256 }) => ({ name, sha256 })).sort((a, b) => a.name.localeCompare(b.name)))
  })

  it("refuses an inventory that does not match the manifest", async () => {
    const dir = await fakeEngine()
    await fs.appendFile(path.join(dir, INVENTORY_FILE), " ")
    await expect(readEngineAiProfiles(dir)).rejects.toThrow(/forge-res\.inventory\.json has SHA-256 [0-9a-f]{64}, the manifest says/)
  })

  it("accepts exactly the verified profiles and names every difference", () => {
    const verified = AI_PROFILE_TABLE.map(({ name, sha256 }) => ({ name, sha256 }))
    expect(() => checkAiProfiles(verified)).not.toThrow()
    const changed = verified.map((profile) => (profile.name === "Reckless" ? { ...profile, sha256: "b".repeat(64) } : profile))
    expect(() => checkAiProfiles(changed)).toThrow(/Reckless changed .*update src\/game\/ai-profile-table\.ts/)
    expect(() => checkAiProfiles([...verified, { name: "Aggressive", sha256: "c".repeat(64) }])).toThrow(/Aggressive is new/)
    expect(() => checkAiProfiles(verified.filter((profile) => profile.name !== "Cautious"))).toThrow(/Cautious is gone/)
  })
})

describe("engine module for the app", () => {
  it("serves the engine content-addressed below the base URL", async () => {
    const engine = await verifyEngine(await fakeEngine())
    const assets = describeEngine(engine, "/", { reason: "missing", detail: "" })
    expect(assets).toMatchObject({
      available: true,
      id: engine.id,
      workerUrl: `/engine/${engine.id}/engine-worker.js`,
      launcherUrl: `/engine/${engine.id}/openmana-engine.js`,
      wasmUrl: `/engine/${engine.id}/openmana-engine.js.wasm`,
      manifestUrl: `/engine/${engine.id}/engine-manifest.json`,
    })
    expect(describeEngine(engine, "/openmana/", { reason: "missing", detail: "" })).toMatchObject({ workerUrl: `/openmana/engine/${engine.id}/engine-worker.js` })
    expect(describeEngine(null, "/", { reason: "omitted", detail: "x" })).toEqual({ available: false, reason: "omitted", detail: "x" })
    expect(SERVED_FILES).toEqual([...RUNTIME_FILES, MANIFEST_FILE])
  })

  it("reads OPENMANA_ENGINE strictly", () => {
    expect(engineModeFromEnv(undefined)).toBe("required")
    expect(engineModeFromEnv("")).toBe("required")
    expect(engineModeFromEnv("required")).toBe("required")
    expect(engineModeFromEnv("omit")).toBe("omit")
    expect(() => engineModeFromEnv("none")).toThrow(EngineAssetsError)
  })
})

describe("engineAssets plugin", () => {
  const logger = { info: () => undefined, warn: () => undefined }

  async function resolve(options: { dir: string; mode: "required" | "omit" }, command: "build" | "serve") {
    const plugin = engineAssets(options)
    ;(plugin.config as (c: object, e: object) => void)({}, { command, mode: "production" })
    await (plugin.configResolved as (c: ResolvedConfig) => Promise<void>)({ base: "/", command, logger } as unknown as ResolvedConfig)
    const resolved = (plugin.resolveId as (id: string) => string | null)(ENGINE_MODULE_ID)
    return resolved ? ((plugin.load as (id: string) => string | null)(resolved) ?? "") : ""
  }

  it("a production build without a verified engine fails", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "openmana-engine-test-"))
    dirs.push(empty)
    await expect(resolve({ dir: empty, mode: "required" }, "build")).rejects.toThrow(EngineAssetsError)
  })

  it("the dev server starts without an engine and the app learns why", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "openmana-engine-test-"))
    dirs.push(empty)
    const code = await resolve({ dir: empty, mode: "required" }, "serve")
    expect(code).toContain('"available":false')
    expect(code).toContain('"reason":"missing"')
  })

  it("OPENMANA_ENGINE=omit builds without an engine on purpose", async () => {
    const code = await resolve({ dir: "/nonexistent", mode: "omit" }, "build")
    expect(code).toContain('"reason":"omitted"')
  })

  it("an engine whose AI profiles are not the verified ones stops the build and is not served by the dev server", async () => {
    const dir = await fakeEngine(undefined, inventory(AI_PROFILE_TABLE.map((profile) => (profile.name === "Default" ? { ...profile, sha256: "d".repeat(64) } : profile))))
    await expect(resolve({ dir, mode: "required" }, "build")).rejects.toThrow(/Default changed/)
    const code = await resolve({ dir, mode: "required" }, "serve")
    expect(code).toContain('"available":false')
    expect(code).toContain("Default changed")
  })

  it("a verified engine becomes the app's engine module", async () => {
    const dir = await fakeEngine()
    const engine = await verifyEngine(dir)
    const code = await resolve({ dir, mode: "required" }, "build")
    expect(code).toBe(`export const ENGINE_ASSETS = ${JSON.stringify(describeEngine(engine, "/", { reason: "missing", detail: "" }))};\n`)
  })

  it("copies exactly the verified files into the build output", async () => {
    const dir = await fakeEngine()
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "openmana-dist-test-"))
    dirs.push(out)
    const plugin = engineAssets({ dir, mode: "required" })
    ;(plugin.config as (c: object, e: object) => void)({}, { command: "build", mode: "production" })
    await (plugin.configResolved as (c: ResolvedConfig) => Promise<void>)({ base: "/", command: "build", logger } as unknown as ResolvedConfig)
    await (plugin.writeBundle as (o: { dir: string }) => Promise<void>)({ dir: out })
    const engine = await verifyEngine(dir)
    expect((await fs.readdir(path.join(out, "engine", engine.id))).sort()).toEqual([...SERVED_FILES].sort())
    expect((await verifyEngine(path.join(out, "engine", engine.id))).id).toBe(engine.id)
  })
})
