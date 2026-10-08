/*
 * Production build inputs (prompt 31): the verified Forge engine and the card
 * catalog are not in Git (79 MB WebAssembly, 11 MB catalog). They are
 * published once as assets of a GitHub release and named, with size and
 * SHA-256, in deploy/artifacts.json. A deployment (Vercel) fetches exactly
 * those bytes before `npm run build`:
 *
 *   node scripts/deploy/fetch-artifacts.ts [--from <local directory>] [--out <directory>]
 *
 * Every file is checked by size and SHA-256 against deploy/artifacts.json; the
 * engine additionally against engine/engine.lock.json and its own manifest,
 * the catalog against the engine's Forge commit. Any difference fails the
 * build - there is no fallback to another engine and no unverified byte.
 * `--from` takes the same files from a local directory (release preparation,
 * the clean-checkout rehearsal); the checks are the same.
 */
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export interface ArtifactFile { readonly bytes: number; readonly sha256: string }
export interface ArtifactsManifest {
  readonly format: "openmana-deploy-artifacts/1"
  readonly release: { readonly tag: string; readonly baseUrl: string }
  readonly engine: Readonly<Record<string, ArtifactFile>>
  readonly cards: Readonly<Record<string, ArtifactFile>>
}
interface EngineLock {
  readonly forge: { readonly commit: string }
  readonly manifest: ArtifactFile & { readonly file: string }
  readonly artefacts: Readonly<Record<string, ArtifactFile>>
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex")
const readJson = async <T>(file: string) => JSON.parse(await fs.readFile(file, "utf8")) as T

/** The deploy manifest must name exactly the engine engine/engine.lock.json locks (checked again in vite/deployment.test.ts). */
export function checkAgainstLock(manifest: ArtifactsManifest, lock: EngineLock): void {
  const expected: Record<string, ArtifactFile> = { [lock.manifest.file]: { bytes: lock.manifest.bytes, sha256: lock.manifest.sha256 } }
  for (const [name, file] of Object.entries(lock.artefacts)) expected[name] = { bytes: file.bytes, sha256: file.sha256 }
  const names = Object.keys(manifest.engine).sort()
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(expected).sort())) throw new Error(`deploy/artifacts.json engine files ${names.join(", ")} differ from engine/engine.lock.json`)
  for (const name of names) {
    const a = manifest.engine[name]!, b = expected[name]!
    if (a.bytes !== b.bytes || a.sha256 !== b.sha256) throw new Error(`deploy/artifacts.json: ${name} is not the locked engine file`)
  }
  if (manifest.format !== "openmana-deploy-artifacts/1") throw new Error("Unsupported deploy/artifacts.json format")
  if (!manifest.release.baseUrl.startsWith("https://github.com/dev0gig/openmana/releases/download/")) throw new Error("Artifacts must come from OpenMana's public GitHub releases")
}

async function fetchFile(source: { readonly from?: string; readonly baseUrl: string }, name: string): Promise<Uint8Array> {
  if (source.from) return new Uint8Array(await fs.readFile(path.join(source.from, name)))
  const url = `${source.baseUrl}${encodeURIComponent(name)}`
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      if (attempt >= 3) throw new Error(`Could not download ${url}: ${(error as Error).message}`)
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
    }
  }
}

async function place(source: { readonly from?: string; readonly baseUrl: string }, files: Readonly<Record<string, ArtifactFile>>, dir: string) {
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
  for (const [name, expected] of Object.entries(files)) {
    if (name.includes("/") || name.includes("..")) throw new Error(`Invalid artifact name ${name}`)
    const data = await fetchFile(source, name)
    if (data.byteLength !== expected.bytes || sha256(data) !== expected.sha256) {
      throw new Error(`${name}: ${data.byteLength} bytes, SHA-256 ${sha256(data)} - expected ${expected.bytes} bytes, ${expected.sha256}`)
    }
    await fs.writeFile(path.join(dir, name), data)
  }
}

export async function fetchArtifacts(options: { readonly from?: string; readonly out: string }) {
  const manifest = await readJson<ArtifactsManifest>(path.join(root, "deploy/artifacts.json"))
  const lock = await readJson<EngineLock>(path.join(root, "engine/engine.lock.json"))
  checkAgainstLock(manifest, lock)
  const source = { baseUrl: manifest.release.baseUrl, ...(options.from ? { from: path.resolve(options.from) } : {}) }
  const engineDir = path.join(options.out, "engine"), cardsDir = path.join(options.out, "cards")
  await place(source, manifest.engine, engineDir)
  await place(source, manifest.cards, cardsDir)
  // The engine's own manifest names the same bytes and the same Forge (as engine-lock.mjs verify does, without a Forge checkout).
  const engine = await readJson<{ forge: { commit: string }; artefacts: Record<string, ArtifactFile> }>(path.join(engineDir, lock.manifest.file))
  for (const [name, file] of Object.entries(lock.artefacts)) {
    if (engine.artefacts[name]?.sha256 !== file.sha256 || engine.artefacts[name]?.bytes !== file.bytes) throw new Error(`Engine manifest does not name the locked ${name}`)
  }
  if (engine.forge.commit !== lock.forge.commit) throw new Error("Engine manifest names another Forge revision than the lock")
  const catalog = await readJson<{ forge: { commit: string } }>(path.join(cardsDir, "card-catalog-manifest.json"))
  if (catalog.forge.commit !== lock.forge.commit) throw new Error("The card catalog was built against another Forge revision")
  return { engineDir, cardsDir, tag: manifest.release.tag, forge: lock.forge.commit }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const from = option("--from")
  const result = await fetchArtifacts({ ...(from ? { from } : {}), out: path.resolve(option("--out") ?? path.join(root, ".artifacts")) })
  console.log(`[openmana] release ${result.tag}: engine (Forge ${result.forge.slice(0, 10)}) and card catalog verified → ${path.relative(root, path.dirname(result.engineDir)) || "."}`)
}
