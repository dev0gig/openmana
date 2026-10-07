// @vitest-environment node
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { generateNotices, packageDirectory } from "./notices.ts"

const roots: string[] = []
const hash = (s: string) => createHash("sha256").update(s).digest("hex")
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openmana-legal-"))
  roots.push(root)
  async function write(file: string, text: string) { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), text) }
  const policy = { publicRelease: { cleared: false, reason: "Oracle / source gate" }, engineInventorySha256: "",
    engineComponents: {} as Record<string, { license: string; texts: string[] }>, npmSupplements: {}, generatedComponents: [], cssComponents: [] }
  await write("LICENSE", "Test GPL text")
  await write("notices/license-files.json", JSON.stringify({ "gpl-3.0": { file: "LICENSE", sha256: hash("Test GPL text"), source: "Test source" } }))
  await write("SOURCE.md", "Test source / no public source offer")
  await write("src/index.css", "")
  for (const file of ["src/cloud/oryx-sdk.js", "assets/app-icon/PROVENANCE.md", "engine/patches/README.md"]) await write(file, "/* Test provenance */")
  await write("node_modules/library/package.json", JSON.stringify({ name: "library", version: "1.0.0", license: "MIT" }))
  await write("node_modules/library/LICENSE", "Copyright Test Author. MIT test text.")
  await write("node_modules/library/NOTICE", "Original NOTICE must survive")
  await write("node_modules/build-only/package.json", JSON.stringify({ name: "build-only", version: "1.0.0", license: "MIT" }))
  await write("node_modules/library/dist/index.js", "export const a = 1")
  await write("package-lock.json", JSON.stringify({ packages: { "node_modules/library": { version: "1.0.0" } } }))
  const savePolicy = () => write("notices/policy.json", JSON.stringify(policy))
  await savePolicy()
  const ids = [path.join(root, "node_modules/library/dist/index.js")]
  return { root, write, policy, savePolicy, ids }
}

afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))) })

describe("build-derived license notices", () => {
  it("retains license/copyright/NOTICE and excludes unrendered build tools", async () => {
    const f = await fixture()
    const result = await generateNotices(f.root, f.ids)
    expect(result.summary.components.map((c) => c.name)).toEqual(["library"])
    expect(result.text).toContain("Copyright Test Author")
    expect(result.text).toContain("Original NOTICE must survive")
    expect(result.summary.publicReleaseCleared).toBe(false)
  })
  it("finds the nearest nested package and handles query strings", async () => {
    const f = await fixture()
    await f.write("node_modules/library/node_modules/nested/package.json", "{}")
    expect(await packageDirectory(path.join(f.root, "node_modules/library/node_modules/nested/src/index.js?x"))).toBe(path.join(f.root, "node_modules/library/node_modules/nested"))
    expect(await packageDirectory("virtual:engine")).toBeUndefined()
  })
  it("rejects missing license text instead of silently dropping a component", async () => {
    const f = await fixture()
    await fs.rm(path.join(f.root, "node_modules/library/LICENSE"))
    await fs.rm(path.join(f.root, "node_modules/library/NOTICE"))
    await expect(generateNotices(f.root, f.ids)).rejects.toThrow("No license texts")
  })
  it("rejects package metadata differing from the lock", async () => {
    const f = await fixture()
    await f.write("package-lock.json", JSON.stringify({ packages: { "node_modules/library": { version: "2.0.0" } } }))
    await expect(generateNotices(f.root, f.ids)).rejects.toThrow("differs from lock")
  })
  it("a NOTICE alone cannot replace the complete license", async () => {
    const f = await fixture()
    await fs.rm(path.join(f.root, "node_modules/library/LICENSE"))
    await expect(generateNotices(f.root, f.ids)).rejects.toThrow("No license texts")
  })
  it("rejects changed original text", async () => {
    const f = await fixture()
    await f.write("LICENSE", "Changed GPL text")
    await expect(generateNotices(f.root, f.ids)).rejects.toThrow("Missing/changed license")
  })
  it("a new CSS/font import cannot evade the JS module inventory", async () => {
    const f = await fixture()
    await f.write("src/index.css", '@import "unreviewed-font";')
    await expect(generateNotices(f.root, f.ids)).rejects.toThrow("Unreviewed CSS/font import")
  })
  it("blocks a public build even when someone flips the unproven boolean", async () => {
    const f = await fixture()
    f.policy.publicRelease.cleared = true
    await f.savePolicy()
    vi.stubEnv("OPENMANA_PUBLIC_RELEASE", "1")
    await expect(generateNotices(f.root, f.ids)).rejects.toThrow("Public release gate remains closed")
  })
  it("rejects an engine manifest without matching reviewed inventory", async () => {
    const f = await fixture()
    await f.write("notices/engine-inventory.json", "{}")
    await expect(generateNotices(f.root, f.ids, path.join(f.root, "engine"))).rejects.toThrow("inventory changed")
  })
  it("rejects forbidden jupnp types in a hash-reviewed inventory", async () => {
    const f = await fixture()
    const manifest = "Test manifest"
    await f.write("engine/engine-manifest.json", manifest)
    const types = Array.from({ length: 1000 }, (_, i) => `forge.Test${i}`)
    types.push("org.jupnp.UpnpService")
    const inventory = JSON.stringify({ format: "openmana-notices-engine/1", manifestSha256: hash(manifest), typeCount: types.length,
      forbiddenTypes: [], components: { "forge:forge:test": types } })
    await f.write("notices/engine-inventory.json", inventory)
    f.policy.engineInventorySha256 = hash(inventory)
    await f.savePolicy()
    await expect(generateNotices(f.root, f.ids, path.join(f.root, "engine"))).rejects.toThrow("forbidden network/CDDL")
  })
  it("preserves a new Forge pin's copyright and binds it to its component", async () => {
    const f = await fixture()
    const forge = path.join(f.root, "engine/forge")
    await f.write("engine/forge/LICENSE", "Test GPL text")
    const header = "/* Copyright New Forge Author. GNU General Public License. */"
    await f.write("engine/forge/forge-game/src/main/java/forge/game/Game.java", `${header}\npackage forge.game;`)
    execFileSync("git", ["init", "--quiet", forge])
    execFileSync("git", ["-C", forge, "add", "."])
    execFileSync("git", ["-C", forge, "-c", "user.name=License test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "Fixture"])
    const pin = execFileSync("git", ["-C", forge, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
    const manifest = "Test candidate manifest"
    await f.write("engine/engine-manifest.json", manifest)
    const names = Array.from({ length: 1000 }, (_, i) => `forge.Test${i}`)
    const inventory = JSON.stringify({ format: "openmana-notices-engine/1", manifestSha256: hash(manifest), typeCount: names.length,
      forbiddenTypes: [], components: { [`forge:forge:${pin}`]: names } })
    await f.write("notices/engine-inventory.json", inventory)
    f.policy.engineInventorySha256 = hash(inventory)
    await f.savePolicy()
    const result = await generateNotices(f.root, f.ids, path.join(f.root, "engine"))
    const id = `forge-copyright@${pin}`
    expect(result.summary.components.find((c) => c.name === "forge:forge")?.texts).toContain(id)
    expect(result.summary.texts[id]?.sha256).toBe(hash(header))
    expect(result.text).toContain(header)
  })
})
