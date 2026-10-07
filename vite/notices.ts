/* License texts follow actual rendered modules, not the whole npm classpath.
 * The reviewed Java inventory is bound to the selected engine manifest. This
 * adds legal assets before the PWA hashes its shell; dev serves the last build's
 * notices and the current repository license/source instructions. */
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { Plugin } from "vite"
import type { EngineMode } from "./engine-assets.ts"
import { ISOLATION_HEADERS } from "./isolation-headers.ts"

interface LicenseFile { file: string; sha256: string; source: string }
interface Policy {
  engineInventorySha256: string
  publicRelease: { cleared: boolean; reason: string }
  engineComponents: Record<string, { license: string; texts: string[] }>
  npmSupplements: Record<string, string[]>
  generatedComponents: string[]
  cssComponents: string[]
}
interface EngineOverrides {
  engineComponents: Policy["engineComponents"]
  licenseFiles: Record<string, LicenseFile>
  unattributedDependencies: string[]
}
interface Inventory {
  format: string
  manifestSha256: string
  sbomSha256: string
  fatJarSha256: string
  typeCount: number
  forbiddenTypes: string[]
  components: Record<string, string[]>
}
interface Component { name: string; version: string; license: string; origin: string; texts: string[]; types?: number }
const digest = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex")
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await fs.readFile(file, "utf8")) as T
const runFile = promisify(execFile)

/** Nearest package to a rendered module; nested versions stay distinct. */
export async function packageDirectory(id: string): Promise<string | undefined> {
  const file = id.replace(/^\0/, "").split("?")[0]!
  if (!file.includes(`${path.sep}node_modules${path.sep}`)) return undefined
  let dir = path.dirname(file)
  for (;;) {
    try { await fs.access(path.join(dir, "package.json")); return dir } catch { /* keep walking */ }
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error(`No package metadata for rendered module ${id}`)
    dir = parent
  }
}

export async function generateNotices(root: string, moduleIds: readonly string[], engineDir?: string) {
  const policy = await readJson<Policy>(path.join(root, "notices/policy.json"))
  if (process.env["OPENMANA_PUBLIC_RELEASE"] === "1") {
    // This task supplies notices, not evidence clearing Oracle/source release.
    // A boolean alone is deliberately insufficient to authorize publication.
    throw new Error(`Public release gate remains closed: ${policy.publicRelease.reason}`)
  }
  const catalog = await readJson<Record<string, LicenseFile>>(path.join(root, "notices/license-files.json"))
  let overrides: EngineOverrides = { engineComponents: {}, licenseFiles: {}, unattributedDependencies: [] }
  try {
    const documentation = await fs.readFile(path.join(root, "engine/NOTICES.md"), "utf8")
    const json = /```json\n([\s\S]*?)\n```/.exec(documentation)?.[1]
    if (!json) throw new Error("Missing engine license override block")
    overrides = JSON.parse(json) as EngineOverrides
    for (const [id, item] of Object.entries(overrides.licenseFiles)) {
      if (!item.file.startsWith("engine/") || item.file.includes("..") || !item.file.endsWith(".md")) throw new Error(`Engine notice must stay in engine/**: ${id}`)
      if (catalog[id]) throw new Error(`Duplicate license text ID: ${id}`)
      catalog[id] = item
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const texts = new Map<string, { source: string; content: string }>()
  const components: Component[] = []
  async function catalogText(id: string) {
    const item = catalog[id]
    if (!item) throw new Error(`Missing reviewed license: ${id}`)
    const content = await fs.readFile(path.join(root, item.file), "utf8")
    if (!content.trim() || digest(content) !== item.sha256) throw new Error(`Missing/changed license text: ${id}`)
    texts.set(id, { source: item.source, content })
    return id
  }
  const directories = new Map<string, string>()
  for (const id of moduleIds) {
    const dir = await packageDirectory(id)
    if (dir) directories.set(dir, "JavaScript bundle")
  }
  // CSS/fonts and generated Ajv code do not appear as npm JS modules. Track
  // their real source imports explicitly; metadata alone never means shipped.
  const css = await fs.readFile(path.join(root, "src/index.css"), "utf8")
  const cssPackages = new Set([...css.matchAll(/^\s*@import\s+["']([^"']+)["']/gm)].map((match) => {
    const parts = match[1]!.split("/")
    return parts[0]!.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!
  }))
  if (cssPackages.size !== policy.cssComponents.length || [...cssPackages].some((name) => !policy.cssComponents.includes(name))) {
    throw new Error("Unreviewed CSS/font import; update its license provenance")
  }
  for (const name of policy.cssComponents) {
    if (!css.includes(`@import "${name}`)) throw new Error(`CSS provenance changed: ${name}`)
    directories.set(path.join(root, "node_modules", name), "CSS / font assets")
  }
  const hasValidators = moduleIds.some((id) => id.includes("/generated/validators.js")) || Boolean(engineDir)
  if (hasValidators) for (const name of policy.generatedComponents) {
    directories.set(path.join(root, "node_modules", name), "Generated standalone validators (app / engine worker)")
  }
  const lock = await readJson<{ packages: Record<string, { version: string }> }>(path.join(root, "package-lock.json"))
  for (const [dir, origin] of [...directories].sort(([a], [b]) => a.localeCompare(b))) {
    const pkg = await readJson<{ name: string; version: string; license: string }>(path.join(dir, "package.json"))
    if (!pkg.name || !pkg.version || !["MIT", "Apache-2.0", "ISC", "0BSD", "OFL-1.1"].includes(pkg.license)) throw new Error(`Unreviewed npm license in ${dir}`)
    const relative = path.relative(root, dir).split(path.sep).join("/")
    if (lock.packages[relative]?.version !== pkg.version) throw new Error(`Installed package differs from lock: ${relative}`)
    const ids: string[] = []
    let hasLicense = false
    for (const name of (await fs.readdir(dir)).sort()) {
      if (!/^(license|notice|copying|copyrightnotice)(\..*)?$/i.test(name)) continue
      const file = path.join(dir, name)
      if (!(await fs.stat(file)).isFile()) continue
      const content = await fs.readFile(file, "utf8")
      if (!content.trim()) throw new Error(`Empty npm notice: ${file}`)
      const id = `${pkg.name}@${pkg.version}/${name}`
      ids.push(id)
      if (/^(license|copying)(\..*)?$/i.test(name)) hasLicense = true
      texts.set(id, { source: `${relative}/${name}`, content })
    }
    const supplements = policy.npmSupplements[`${pkg.name}@${pkg.version}`] ?? []
    for (const id of supplements) ids.push(await catalogText(id))
    if (!hasLicense && !supplements.length) throw new Error(`No license texts for shipped npm component ${pkg.name}@${pkg.version}`)
    components.push({ name: pkg.name, version: pkg.version, license: pkg.license, origin, texts: ids })
  }
  let inventory: Inventory | undefined
  if (engineDir) {
    const inventoryBytes = await fs.readFile(path.join(root, "notices/engine-inventory.json"))
    if (digest(inventoryBytes) !== policy.engineInventorySha256) throw new Error("Engine inventory changed without license review")
    inventory = await readJson<Inventory>(path.join(root, "notices/engine-inventory.json"))
    const manifest = await fs.readFile(path.join(engineDir, "engine-manifest.json"))
    if (digest(manifest) !== inventory.manifestSha256) {
      // New isolated Forge candidates have their own full build evidence. This
      // does not modify the reviewed snapshot or app sources during the pipeline.
      const build = path.dirname(path.resolve(engineDir))
      const output = path.join(build, "report/notices-inventory.json")
      await runFile("python3", [path.join(root, "scripts/notices/engine-inventory.py"), build, "--out", output])
      inventory = await readJson<Inventory>(output)
    }
    if (inventory.format !== "openmana-notices-engine/1" || digest(manifest) !== inventory.manifestSha256 || inventory.typeCount < 1000) {
      throw new Error("Engine notices do not match the selected artifact; regenerate/review its inventory")
    }
    const types = Object.values(inventory.components).flat()
    if (new Set(types).size !== inventory.typeCount || types.length !== inventory.typeCount || inventory.forbiddenTypes.length || types.some((t) => /^(org\.jupnp|io\.netty|org\.eclipse\.jetty|javax\.servlet)\./.test(t))) {
      throw new Error("Invalid or forbidden network/CDDL engine inventory")
    }
    for (const [coordinate, names] of Object.entries(inventory.components).sort(([a], [b]) => a.localeCompare(b))) {
      let entry = overrides.engineComponents[coordinate] ?? policy.engineComponents[coordinate]
      const candidateTexts: string[] = []
      if (!entry && coordinate.startsWith("forge:forge:")) {
        // Forge-only pin updates keep licensing documentation inside engine/**.
        // Its original LICENSE must still match the reviewed GPL text.
        const forgeLicense = await fs.readFile(path.join(root, "engine/forge/LICENSE"))
        if (digest(forgeLicense) === catalog["gpl-3.0"]?.sha256) {
          const pin = coordinate.slice(coordinate.lastIndexOf(":") + 1)
          const { stdout } = await runFile("git", ["-C", path.join(root, "engine/forge"), "rev-parse", "HEAD"])
          if (stdout.trim() !== pin) throw new Error("Forge copyright source does not match the candidate pin")
          // Use this candidate's copyright header, not an older pin's notice.
          const game = await fs.readFile(path.join(root, "engine/forge/forge-game/src/main/java/forge/game/Game.java"), "utf8")
          const header = game.slice(0, game.indexOf("*/") + 2)
          if (!header.includes("Copyright") || !header.includes("GNU General Public License")) throw new Error("Forge copyright/license header needs review")
          const id = `forge-copyright@${pin}`
          texts.set(id, { source: `engine/forge/forge-game/src/main/java/forge/game/Game.java at ${coordinate}`, content: header })
          candidateTexts.push(id)
          entry = { license: "GPL-3.0-or-later", texts: ["gpl-3.0"] }
        }
      }
      if (!entry || /CDDL/.test(entry.license) || !entry.texts.length) throw new Error(`Unreviewed shipped engine component: ${coordinate}`)
      const pos = coordinate.lastIndexOf(":")
      components.push({ name: coordinate.slice(0, pos), version: coordinate.slice(pos + 1), license: entry.license,
        origin: "WASM types / original dependency bytes", types: names.length, texts: [...await Promise.all(entry.texts.map(catalogText)), ...candidateTexts] })
    }
  }
  // Vendor copies and own-source provenance: preserved headers and source
  // pointers, not invented npm dependencies or copied ManaBrew AGPL code.
  const vendor = ["src/cloud/oryx-sdk.js", "assets/app-icon/PROVENANCE.md", "engine/patches/README.md"]
  for (const file of vendor) {
    const content = await fs.readFile(path.join(root, file), "utf8")
    texts.set(file, { source: file, content: file.endsWith(".js") ? content.slice(0, content.indexOf("*/") + 2) : content })
  }
  await catalogText("gpl-3.0")
  const summary = { format: "openmana-third-party-notices/1", publicReleaseCleared: false,
    engineManifestSha256: inventory?.manifestSha256 ?? null, typeCount: inventory?.typeCount ?? 0,
    sbomSha256: inventory?.sbomSha256 ?? null, fatJarSha256: inventory?.fatJarSha256 ?? null,
    components, texts: Object.fromEntries([...texts].sort(([a], [b]) => a.localeCompare(b)).map(([id, item]) => [id, { source: item.source, sha256: digest(item.content) }])) }
  const source = await fs.readFile(path.join(root, "SOURCE.md"), "utf8")
  const gpl = await fs.readFile(path.join(root, "LICENSE"), "utf8")
  if (digest(gpl) !== catalog["gpl-3.0"]?.sha256) throw new Error("Repository GPL text differs from reviewed license")
  const lines = ["# THIRD-PARTY-NOTICES", "", "Erzeugt aus den tatsächlich enthaltenen App-Modulen, CSS/Fonts, Generatorcode und der geprüften WASM-Typinventur.",
    "Keine öffentliche Freigabe: Oracle GraalVM/GFTC und öffentlich zugänglicher Corresponding Source bleiben offen. Siehe SOURCE.md.",
    "Originaltexte bleiben unverändert und in ihrer Originalsprache erhalten. Der vollständige Oracle-Distributionsanhang ist vorsorgliche Dokumentation; er ist keine Liste eingebauter Komponenten.", "",
    `Engine-Manifest SHA-256: ${summary.engineManifestSha256 ?? "keine Engine enthalten"}`, `WASM-Typen: ${summary.typeCount}`, "", "## Enthaltene Komponenten", "",
    "| Komponente | Version | Lizenz | Herkunft |", "|---|---|---|---|",
    ...components.map((c) => `| ${c.name} | ${c.version} | ${c.license} | ${c.origin}${c.types ? ` (${c.types} Typen)` : ""} |`), "",
    "## Credits und Herkunft", "", "Forge/Card-Forge: Regeln, Kartenskripte, KI (GPL-3.0-or-later). ManaBrew: technische Referenz; drei GPL-Patches aus seinem Forge-Fork (khaliostr, JacopoMadaluni). Kein ManaBrew-Hauptrepo-/AGPL-Code übernommen.",
    "Scryfall: Kartendaten und -bilder. Wizards of the Coast: Kartenrechte/Marken, inoffizieller Fan-Inhalt. OpenAI ChatGPT und Anthropic Claude: KI-Unterstützung. ORYX-SDK und vorläufiges Anvil-Icon: Quellen des Projektbesitzers.", "", "## Quellen und Freigabegate", "", source,
    "## Lizenztexte und erhaltene Originalhinweise", ""]
  for (const [id, item] of [...texts].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${id}`, "", `Quelle: ${item.source}`, `SHA-256: ${digest(item.content)}`, "", "````", item.content, "````", "")
  }
  return { text: lines.join("\n"), summary, source, gpl }
}

export function notices(options: { engineDir: string; engineMode: EngineMode }): Plugin {
  let root = ""
  return {
    name: "openmana:notices",
    enforce: "post",
    configResolved(config) { root = config.root },
    async generateBundle(_options, bundle) {
      const ids = new Set<string>()
      for (const file of Object.values(bundle)) if (file.type === "chunk") for (const [id, info] of Object.entries(file.modules)) {
        if (info.renderedLength > 0) ids.add(id)
      }
      const generated = await generateNotices(root, [...ids], options.engineMode === "required" ? options.engineDir : undefined)
      for (const [fileName, content] of Object.entries({ "legal/LICENSE.txt": generated.gpl, "legal/SOURCE.txt": generated.source,
        "legal/THIRD-PARTY-NOTICES.txt": generated.text, "legal/components.json": JSON.stringify(generated.summary, null, 2) + "\n" })) {
        this.emitFile({ type: "asset", fileName, source: content })
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const file = ({ "/legal/LICENSE.txt": "LICENSE", "/legal/SOURCE.txt": "SOURCE.md",
          "/legal/THIRD-PARTY-NOTICES.txt": "dist/legal/THIRD-PARTY-NOTICES.txt" } as Record<string, string>)[req.url?.split("?")[0] ?? ""]
        if (!file) { next(); return }
        for (const [key, value] of Object.entries(ISOLATION_HEADERS)) res.setHeader(key, value)
        try { const content = await fs.readFile(path.join(root, file)); res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.end(content) }
        catch { res.statusCode = 404; res.end("Legal document has not been generated; build OpenMana first.") }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0] ?? ""
        if (!["/legal/LICENSE.txt", "/legal/SOURCE.txt", "/legal/THIRD-PARTY-NOTICES.txt"].includes(pathname)) { next(); return }
        // Static preview's default text/plain has no charset. Native document
        // navigation can then decode German copyrights as Windows-1252.
        for (const [key, value] of Object.entries(ISOLATION_HEADERS)) res.setHeader(key, value)
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        try { res.end(await fs.readFile(path.resolve(root, server.config.build.outDir, pathname.slice(1)))) }
        catch { res.statusCode = 404; res.end("Legal document has not been generated; build OpenMana first.") }
      })
    },
  }
}
