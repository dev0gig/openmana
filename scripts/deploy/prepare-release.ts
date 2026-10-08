/*
 * Prepares an engine release (prompt 31, docs/DEPLOYMENT.md): the verified
 * engine build and its card catalog become the assets of one GitHub release,
 * and deploy/artifacts.json names them with size and SHA-256.
 *
 *   node scripts/deploy/prepare-release.ts --engine <build>/dist --cards <build>/catalog --out <directory>
 *
 * The engine must be the one engine/engine.lock.json locks (run
 * `node engine/scripts/engine-lock.mjs verify <build>/dist` first); the
 * catalog must belong to the same Forge revision. Nothing is uploaded here:
 * the release itself is created by hand with `gh release create` (see
 * docs/DEPLOYMENT.md), together with the source archive of the tagged commit.
 */
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { checkAgainstLock, type ArtifactFile, type ArtifactsManifest } from "./fetch-artifacts.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const ENGINE_FILES = ["engine-manifest.json", "engine-worker.js", "openmana-engine.js", "openmana-engine.js.wasm", "forge-res.inventory.json"]
const CARD_FILES = ["card-catalog.jsonl.gz", "card-catalog-manifest.json"]
/** Published with the release for transparency, not needed by the build. */
const EXTRA_FILES: Readonly<Record<string, readonly string[]>> = { engine: ["engine-worker.js.map"], cards: ["card-catalog-report.json"] }

const args = process.argv.slice(2)
const option = (name: string) => { const i = args.indexOf(name); const value = i >= 0 ? args[i + 1] : undefined; if (!value) throw new Error(`Missing ${name}`); return path.resolve(value) }
const engineDir = option("--engine"), cardsDir = option("--cards"), out = option("--out")

async function describe(dir: string, names: readonly string[]) {
  const files: Record<string, ArtifactFile> = {}
  for (const name of names) {
    const data = await fs.readFile(path.join(dir, name))
    files[name] = { bytes: data.byteLength, sha256: createHash("sha256").update(data).digest("hex") }
  }
  return files
}

const lock = JSON.parse(await fs.readFile(path.join(root, "engine/engine.lock.json"), "utf8")) as { forge: { commit: string }; protocol: { version: number }; manifest: ArtifactFile & { file: string }; artefacts: Record<string, ArtifactFile> }
const tag = `engine-p${lock.protocol.version}-${lock.manifest.sha256.slice(0, 12)}`
const manifest: ArtifactsManifest = {
  format: "openmana-deploy-artifacts/1",
  release: { tag, baseUrl: `https://github.com/dev0gig/openmana/releases/download/${tag}/` },
  engine: await describe(engineDir, ENGINE_FILES),
  cards: await describe(cardsDir, CARD_FILES),
}
checkAgainstLock(manifest, lock)
const catalog = JSON.parse(await fs.readFile(path.join(cardsDir, "card-catalog-manifest.json"), "utf8")) as { forge: { commit: string } }
if (catalog.forge.commit !== lock.forge.commit) throw new Error("The card catalog belongs to another Forge revision")

await fs.mkdir(out, { recursive: true })
for (const [dir, names] of [[engineDir, [...ENGINE_FILES, ...EXTRA_FILES["engine"]!]], [cardsDir, [...CARD_FILES, ...EXTRA_FILES["cards"]!]]] as const) {
  for (const name of names) await fs.copyFile(path.join(dir, name), path.join(out, name))
}
await fs.copyFile(path.join(root, "engine/engine.lock.json"), path.join(out, "engine.lock.json"))
await fs.writeFile(path.join(root, "deploy/artifacts.json"), JSON.stringify(manifest, null, 2) + "\n")
console.log(`[openmana] release ${tag}: ${Object.keys(manifest.engine).length + Object.keys(manifest.cards).length} build files + extras in ${out}; deploy/artifacts.json written`)
