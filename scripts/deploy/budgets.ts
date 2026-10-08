/*
 * Performance budgets of a production build (prompt 31, docs/DEPLOYMENT.md):
 *
 *   node scripts/deploy/budgets.ts [dist]
 *
 * What a first visit must download before the start page shows - the entry
 * script with every chunk it imports statically, and the start stylesheet -
 * gzip-compressed as served; and the sizes of the engine module and the card
 * catalog, which load only on demand (playing, installing the card data).
 * A build over budget fails: growth has to be a decision, not an accident.
 */
import fs from "node:fs/promises"
import path from "node:path"
import { gzipSync } from "node:zlib"
import { fileURLToPath } from "node:url"

/** Budgets in bytes; measured on 2026-10-08 (start JS 260 kB in 12 chunks, CSS 23 kB gzip; engine 79 MB; catalog 10.9 MB) plus headroom. */
export const BUDGETS = {
  startScriptGzip: 300_000,
  startStyleGzip: 32_000,
  engineWasm: 90_000_000,
  cardCatalog: 13_000_000,
} as const

const gzipSize = (data: Uint8Array) => gzipSync(data, { level: 9 }).byteLength

/** Static imports of an emitted chunk ("./x.js"); dynamic import() stays out - it loads on demand. */
export function staticImports(code: string): string[] {
  const found = new Set<string>()
  for (const match of code.matchAll(/(?:^|[;}\s])import\s*(?:[\w$*{}\s,]+from\s*)?["'](\.\/[^"']+\.js)["']/g)) found.add(match[1]!)
  return [...found]
}

export async function measure(dist: string) {
  const html = await fs.readFile(path.join(dist, "index.html"), "utf8")
  const entries = [...html.matchAll(/<script[^>]+src="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]!)
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/(assets\/[^"]+\.css)"/g)].map((m) => m[1]!)
  if (!entries.length || !styles.length) throw new Error("index.html names no entry script or stylesheet")
  const seen = new Set<string>()
  let startScriptGzip = 0
  const queue = [...entries]
  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    const data = await fs.readFile(path.join(dist, file))
    startScriptGzip += gzipSize(data)
    for (const name of staticImports(data.toString("utf8"))) queue.push(path.posix.join(path.posix.dirname(file), name))
  }
  let startStyleGzip = 0
  for (const file of styles) startStyleGzip += gzipSize(await fs.readFile(path.join(dist, file)))
  const sizeOf = async (dir: string, name: string) => {
    const ids = await fs.readdir(path.join(dist, dir))
    if (ids.length !== 1) throw new Error(`Expected exactly one content-addressed ${dir}/ directory, found ${ids.length}`)
    return (await fs.stat(path.join(dist, dir, ids[0]!, name))).size
  }
  return {
    startScripts: [...seen],
    startScriptGzip,
    startStyleGzip,
    engineWasm: await sizeOf("engine", "openmana-engine.js.wasm"),
    cardCatalog: await sizeOf("cards", "card-catalog.jsonl.gz"),
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = path.resolve(process.argv[2] ?? "dist")
  const result = await measure(dist)
  const over = (Object.keys(BUDGETS) as (keyof typeof BUDGETS)[]).filter((key) => result[key] > BUDGETS[key])
  for (const key of Object.keys(BUDGETS) as (keyof typeof BUDGETS)[]) {
    console.log(`[openmana] budget ${key}: ${result[key].toLocaleString("en")} / ${BUDGETS[key].toLocaleString("en")} bytes${over.includes(key) ? "  OVER" : ""}`)
  }
  if (over.length) throw new Error(`Over budget: ${over.join(", ")}`)
}
