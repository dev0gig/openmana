/* Produce a content-addressed shell and independently pinned engine cache.
 * closeBundle runs after engine/card writeBundle copy/verification. */
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import type { Plugin } from "vite"
import { ISOLATION_HEADERS } from "./isolation-headers.ts"

interface Entry { url: string; bytes: number; sha256: string }
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")

export function pwa(): Plugin {
  let outDir = ""
  let root = ""
  let build = false
  return {
    name: "openmana:pwa",
    config(_config, env) {
      // build() can leave NODE_ENV=production in a process that later starts
      // a dev server (the complete E2E runner does this). PROD alone is unsafe.
      return { define: { "import.meta.env.OPENMANA_PWA_BUILD": String(env.command === "build") } }
    },
    configResolved(config) {
      root = config.root
      outDir = path.resolve(root, config.build.outDir)
      build = config.command === "build"
      if (config.base !== "/") throw new Error("OpenMana PWA requires base /")
    },
    async closeBundle() {
      if (!build) return
      const shell: Entry[] = []
      const engine: Entry[] = []
      async function walk(relative = "") {
        for (const item of await fs.readdir(path.join(outDir, relative), { withFileTypes: true })) {
          const name = path.posix.join(relative, item.name)
          if (item.isDirectory()) { if (name !== "cards" && name !== ".well-known") await walk(name); continue }
          if (name.endsWith(".map") || name === "sw.js") continue
          const bytes = await fs.readFile(path.join(outDir, name))
          const entry = { url: `/${name}`, bytes: bytes.length, sha256: digest(bytes) }
          ;(name.startsWith("engine/") ? engine : shell).push(entry)
        }
      }
      await walk()
      shell.sort((a, b) => a.url.localeCompare(b.url))
      engine.sort((a, b) => a.url.localeCompare(b.url))
      const runtime = (await fs.readFile(path.join(root, "pwa/cache-runtime.js"), "utf8")).replaceAll("export ", "")
      const worker = await fs.readFile(path.join(root, "pwa/service-worker.js"), "utf8")
      // Worker/headers changes also isolate staging from an active shell cache.
      const config = { shell, engine, version: digest(JSON.stringify(shell) + runtime + worker + JSON.stringify(ISOLATION_HEADERS)), engineVersion: digest(JSON.stringify(engine)), headers: ISOLATION_HEADERS }
      await fs.writeFile(path.join(outDir, "sw.js"), `const CONFIG = ${JSON.stringify(config)};\n${runtime}\n${worker}`)
    },
  }
}
