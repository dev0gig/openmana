// @vitest-environment node
/*
 * The hard separation of Bible §2: the UI talks to Forge only through the
 * OpenMana protocol. Code in src/ may import from engine/ exclusively via the
 * aliases for engine/protocol and engine/client (vite/aliases.ts) - never the
 * worker host, the bridge, Forge or a relative path into engine/.
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const src = path.resolve(import.meta.dirname, "..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

const SPECIFIER = /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["']/g
const ALLOWED_ENGINE = /^@openmana\/engine-(client|protocol)(\/[\w./-]+)?$/

function specifiers(file: string): string[] {
  const text = readFileSync(file, "utf8")
  return [...text.matchAll(SPECIFIER)].map((m) => m[1] ?? m[2] ?? m[3] ?? "")
}

describe("UI -> engine boundary", () => {
  const files = sourceFiles(src)

  it("finds the app's sources", () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it("imports from engine/ only through the protocol and client aliases", () => {
    const engineDir = path.join(path.dirname(src), "engine")
    const offending: string[] = []
    for (const file of files) {
      for (const specifier of specifiers(file)) {
        if (specifier.startsWith("@openmana/")) {
          if (!ALLOWED_ENGINE.test(specifier) || specifier.includes("..")) offending.push(`${path.relative(src, file)}: ${specifier}`)
          continue
        }
        // "@/..." is the app's own src/; relative and absolute paths must stay out of engine/.
        const target = specifier.startsWith("@/")
          ? path.join(src, specifier.slice(2))
          : specifier.startsWith(".") || path.isAbsolute(specifier)
            ? path.resolve(path.dirname(file), specifier)
            : null
        if (target !== null && (target === engineDir || target.startsWith(engineDir + path.sep))) {
          offending.push(`${path.relative(src, file)}: ${specifier}`)
        }
      }
    }
    expect(offending).toEqual([])
  })

  it("never names the worker host, the bridge or Forge", () => {
    const offending = files.filter((file) => /engine\/(wasm|bridge|forge)|forge\.(game|ai|gui)\./.test(readFileSync(file, "utf8")))
    expect(offending.map((file) => path.relative(src, file))).toEqual([])
  })

  it("reads the build-time modules in one place each", () => {
    const readers = (id: string) => files.filter((file) => specifiers(file).includes(id)).map((file) => path.relative(src, file))
    expect(readers("virtual:openmana-engine")).toEqual(["engine/engine-assets.ts"])
    expect(readers("virtual:openmana-build")).toEqual(["app/build-info.ts"])
  })
})
