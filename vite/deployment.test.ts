// @vitest-environment node
/*
 * Vercel serves OpenMana the way the dev and preview servers do: with the
 * cross-origin isolation headers on every route (without them the engine
 * cannot start), immutable caching only for content-addressed files, and the
 * SPA fallback for the app's own routes but never for engine or asset files.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import viteConfig from "../vite.config.ts"
import { ISOLATION_HEADERS } from "./isolation-headers.ts"

const root = path.resolve(import.meta.dirname, "..")

interface VercelConfig {
  framework: string
  installCommand: string
  buildCommand: string
  outputDirectory: string
  headers: { source: string; headers: { key: string; value: string }[] }[]
  rewrites: { source: string; destination: string }[]
}

const vercel = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")) as VercelConfig

/** Vercel's path patterns in the simple form used here: "/(regex)" matches the whole path. */
function matches(source: string, pathname: string): boolean {
  return new RegExp(`^${source}$`).test(pathname)
}

function headersFor(pathname: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rule of vercel.headers) {
    if (!matches(rule.source, pathname)) continue
    for (const { key, value } of rule.headers) {
      expect(result, `${key} set twice for ${pathname}`).not.toHaveProperty(key)
      result[key] = value
    }
  }
  return result
}

describe("vercel.json", () => {
  it("builds the Vite app from the repository root", () => {
    expect(vercel).toMatchObject({ framework: "vite", installCommand: "npm ci", buildCommand: "npm run build", outputDirectory: "dist" })
  })

  it.each(["/", "/index.html", "/play", "/decks", "/manifest.webmanifest", "/icons/icon-192.png", "/assets/index-abc.js", "/engine/0123456789abcdef/openmana-engine.js.wasm"])(
    "%s carries the isolation headers",
    (pathname) => {
      expect(headersFor(pathname)).toMatchObject(ISOLATION_HEADERS)
    },
  )

  it("caches only content-addressed files forever", () => {
    expect(headersFor("/assets/index-abc.js")["Cache-Control"]).toBe("public, max-age=31536000, immutable")
    expect(headersFor("/engine/0123456789abcdef/openmana-engine.js.wasm")["Cache-Control"]).toBe("public, max-age=31536000, immutable")
    for (const pathname of ["/", "/index.html", "/play", "/manifest.webmanifest", "/icons/icon-192.png", "/favicon.ico"]) {
      expect(headersFor(pathname)).not.toHaveProperty("Cache-Control")
    }
  })

  it("falls back to the app for its routes, never for engine or asset files", () => {
    expect(vercel.rewrites).toHaveLength(1)
    const [rewrite] = vercel.rewrites
    expect(rewrite!.destination).toBe("/index.html")
    for (const pathname of ["/", "/play", "/decks", "/settings", "/credits", "/matches", "/unknown/deep/link"]) {
      expect(matches(rewrite!.source, pathname), pathname).toBe(true)
    }
    for (const pathname of ["/engine/0123456789abcdef/missing.js", "/assets/missing.js", "/icons/missing.png"]) {
      expect(matches(rewrite!.source, pathname), pathname).toBe(false)
    }
  })
})

describe("vite.config.ts", () => {
  it("dev server and preview send the same isolation headers as Vercel", () => {
    expect(viteConfig.server?.headers).toEqual(ISOLATION_HEADERS)
    expect(viteConfig.preview?.headers).toEqual(ISOLATION_HEADERS)
  })
})

describe("dev server file watching", () => {
  it("watches the app, engine/protocol and engine/client, but not Forge, builds or reports", async () => {
    const { unwatchedPaths } = await import("./watch.ts")
    const ignored = unwatchedPaths(root)
    for (const watched of ["src/engine/engine-session.ts", "src/app/router.tsx", "engine", "engine/protocol", "engine/protocol/src/index.ts", "engine/client/src/engine-client.ts", "vite.config.ts", "index.html"]) {
      expect(ignored(path.join(root, watched)), watched).toBe(false)
    }
    for (const unwatched of ["engine/forge", "engine/forge/forge-gui/res/cardsfolder/a/abc.txt", "engine/build/dist/openmana-engine.js.wasm", "engine/bridge/src", "engine/wasm/host/worker-host.ts", "engine/node_modules/ajv", "dist/index.html", "reports/e2e/report.json"]) {
      expect(ignored(path.join(root, unwatched)), unwatched).toBe(true)
    }
  })
})
