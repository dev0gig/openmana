/* Sequential full regression, using a verified existing WASM build. No WASM compiler,
 * lock promotion, network deployment, or mutation of locked engine evidence.
 */
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import { engineEvidence, browserEvidence } from "./evidence.ts"
import { prepareEngineInputs } from "./assets.ts"

const root = path.resolve(import.meta.dirname, "../..")
const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf8"))
const digest = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== "--out")) throw new Error("Usage: npm run test:regression -- [--out <new report directory>]")
for (const name of ["OPENMANA_SKIP_BROWSER", "OPENMANA_ENGINE", "OPENMANA_CARDS"]) {
  if (process.env[name] && process.env[name] !== "0") throw new Error(`Full regression refuses ${name}=${process.env[name]}`)
}
const selected = process.env["OPENMANA_ENGINE_BUILD_DIR"]
const catalog = process.env["OPENMANA_CARDS_DIR"]
if (!selected || !catalog) throw new Error("Select the verified build with OPENMANA_ENGINE_BUILD_DIR and its matching OPENMANA_CARDS_DIR; see docs/QUALITY.md")
const original = path.resolve(selected)
const out = path.resolve(args[1] ?? path.join(root, "reports/regression", new Date().toISOString().replace(/[:.]/g, "-")))
// Never overwrite a prior result (including failed runs).
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.mkdirSync(out)
// Like the update pipeline (engine/scripts/validate-forge-update.mjs): short and disk-backed. Chrome's profiles live
// under TMPDIR, and in a RAM-backed /tmp (tmpfs) Chrome failed to store the 79 MB engine in CacheStorage
// ("Cache.put() encountered a network error", Prompt 32), which the PWA suite then reports as a failed download.
const scratch = fs.mkdtempSync("/var/tmp/om29-")
const engine = path.join(out, "engine")
const env = { ...process.env, TMPDIR: scratch, OPENMANA_ENGINE_BUILD_DIR: engine, OPENMANA_ENGINE_DIR: path.join(engine, "dist"), OPENMANA_CARDS_DIR: path.resolve(catalog), VITEST_MAX_WORKERS: process.env["VITEST_MAX_WORKERS"] ?? "1" }
const result: { format: string; status: string; startedAt: string; finishedAt?: string; engineBuild: string; catalog: string; steps: { name: string; command: string[]; exitCode: number | null; signal: string | null; log: string; logSha256: string }[]; coverage?: unknown; error?: string } = { format: "openmana-regression/1", status: "running", startedAt: new Date().toISOString(), engineBuild: original, catalog: env.OPENMANA_CARDS_DIR, steps: [] }
const save = () => fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(result, null, 2) + "\n")
async function step(name: string, command: string[], cwd = root) {
  console.log(`[regression] ${name}: ${command.join(" ")}`)
  const log = path.join(out, `${name}.log`)
  const fd = fs.openSync(log, "wx")
  let code: number | null = null
  let signal: string | null = null
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command[0]!, command.slice(1), { cwd, env, stdio: ["ignore", fd, fd] })
      child.once("error", reject)
      child.once("exit", (rc, sig) => { code = rc; signal = sig; resolve() })
    })
  } finally {
    fs.closeSync(fd)
    result.steps.push({ name, command, exitCode: code, signal, log: path.basename(log), logSha256: digest(log) })
    save()
  }
  if (code !== 0 || signal) throw new Error(`${name} failed (${code ?? signal}); inspect ${log}`)
  console.log(`[regression] ${name}: passed`)
}
function archive(source: string, target: string) {
  if (fs.existsSync(source)) fs.cpSync(source, target, { recursive: true })
}
try {
  await step("engine-lock", [process.execPath, "engine/scripts/engine-lock.mjs", "verify", path.join(original, "dist")])
  await step("build-provenance", [process.execPath, "--input-type=module", "-e", 'import {validateEvidence} from "./engine/scripts/engine-lock.mjs"; validateEvidence(process.argv[1]); console.log("Original build/JVM/source/report evidence verified; reused, not rerun");', original])
  // Reuse verified WASM/resources; create a fresh JVM from current pinned
  // sources instead of trusting a previous mutable Maven working tree.
  prepareEngineInputs(original, engine)
  const manifestSha256 = digest(path.join(engine, "dist/engine-manifest.json"))
  await step("engine-generated", ["npm", "run", "check:generated"], path.join(root, "engine"))
  await step("engine-typecheck", ["npm", "run", "typecheck"], path.join(root, "engine"))
  await step("engine-unit", ["npm", "run", "test:unit"], path.join(root, "engine"))
  await step("jvm-sources", ["bash", "engine/scripts/prepare-forge.sh"])
  await step("jvm-unit", ["bash", "engine/scripts/build-jvm.sh"])
  await step("engine-games", ["bash", "engine/scripts/test-engine.sh"])
  const engineCoverage = engineEvidence(read(path.join(engine, "report/test-report.json")), manifestSha256)
  await step("app-check", ["npm", "run", "check"])
  archive(path.join(root, "reports/e2e"), path.join(out, "app/e2e"))
  archive(path.join(root, "reports/pwa"), path.join(out, "app/pwa"))
  const browserCoverage = browserEvidence(read(path.join(out, "app/e2e/report.json")), read(path.join(out, "app/pwa/report.json")))
  await step("engine-lock-after", [process.execPath, "engine/scripts/engine-lock.mjs", "verify", path.join(original, "dist")])
  if (digest(path.join(engine, "dist/engine-manifest.json")) !== manifestSha256) throw new Error("Engine changed during regression")
  result.coverage = { engine: engineCoverage, browser: browserCoverage, evidence: "Current real JVM/Node/Chrome games and complete app/PWA suite; built UI boundaries remain distinct from Forge traces." }
  result.status = "passed"
} catch (error) {
  result.status = "failed"
  result.error = String(error)
  console.error(result.error)
  process.exitCode = 1
} finally {
  result.finishedAt = new Date().toISOString()
  save()
  fs.rmSync(scratch, { recursive: true, force: true })
  // Keep test reports/JVM XMLs and every failure, release only own copied artifacts.
  for (const name of ["dist", "jvm", "resources", "harness", "work"]) fs.rmSync(path.join(engine, name), { recursive: true, force: true })
  console.log(`[regression] ${result.status}: ${out}/report.json`)
}
