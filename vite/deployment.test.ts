// @vitest-environment node
/*
 * Vercel serves OpenMana the way the dev and preview servers do: with the
 * cross-origin isolation headers on every route (without them the engine
 * cannot start), immutable caching only for content-addressed files, and the
 * SPA fallback for the app's own routes but never for engine, card catalog or
 * asset files.
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
  it("builds the public app from the repository root with the released, verified engine and catalog", () => {
    expect(vercel).toMatchObject({ framework: "vite", installCommand: "npm ci", outputDirectory: "dist",
      buildCommand: "node scripts/deploy/fetch-artifacts.ts && OPENMANA_PUBLIC_RELEASE=1 OPENMANA_ENGINE_DIR=.artifacts/engine OPENMANA_CARDS_DIR=.artifacts/cards npm run build && node scripts/deploy/budgets.ts" })
  })

  it("deploys exactly the engine engine/engine.lock.json locks, from OpenMana's public releases", async () => {
    const { checkAgainstLock } = await import("../scripts/deploy/fetch-artifacts.ts")
    const artifacts = JSON.parse(readFileSync(path.join(root, "deploy/artifacts.json"), "utf8"))
    const lock = JSON.parse(readFileSync(path.join(root, "engine/engine.lock.json"), "utf8"))
    expect(() => checkAgainstLock(artifacts, lock)).not.toThrow()
    expect(artifacts.release.baseUrl).toBe(`https://github.com/dev0gig/openmana/releases/download/${artifacts.release.tag}/`)
    expect(Object.keys(artifacts.cards).sort()).toEqual(["card-catalog-manifest.json", "card-catalog.jsonl.gz"])
    const tampered = structuredClone(artifacts)
    tampered.engine["openmana-engine.js.wasm"].sha256 = "0".repeat(64)
    expect(() => checkAgainstLock(tampered, lock)).toThrow("not the locked engine file")
  })

  it("counts a chunk's static imports for the start budget, never its on-demand imports", async () => {
    const { staticImports } = await import("../scripts/deploy/budgets.ts")
    const code = 'import{a as e}from"./react-x.js";import"./side-y.js";const t=()=>import("./later-z.js");export{e}'
    expect(staticImports(code)).toEqual(["./react-x.js", "./side-y.js"])
  })

  it("sends no content sniffing and a restrained referrer on every route", () => {
    for (const pathname of ["/", "/play", "/assets/index-abc.js", "/engine/0123456789abcdef/openmana-engine.js.wasm"]) {
      expect(headersFor(pathname)).toMatchObject({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" })
    }
  })

  it.each(["/", "/index.html", "/play", "/decks", "/manifest.webmanifest", "/.well-known/assetlinks.json", "/icons/icon-192.png", "/assets/index-abc.js", "/engine/0123456789abcdef/openmana-engine.js.wasm", "/cards/0123456789abcdef/card-catalog.jsonl.gz"])(
    "%s carries the isolation headers",
    (pathname) => {
      expect(headersFor(pathname)).toMatchObject(ISOLATION_HEADERS)
    },
  )

  it("caches only content-addressed files forever", () => {
    expect(headersFor("/sw.js")["Cache-Control"]).toBe("no-cache")
    expect(headersFor("/sw.js")).toMatchObject(ISOLATION_HEADERS)
    expect(headersFor("/assets/index-abc.js")["Cache-Control"]).toBe("public, max-age=31536000, immutable")
    expect(headersFor("/engine/0123456789abcdef/openmana-engine.js.wasm")["Cache-Control"]).toBe("public, max-age=31536000, immutable")
    expect(headersFor("/cards/0123456789abcdef/card-catalog.jsonl.gz")["Cache-Control"]).toBe("public, max-age=31536000, immutable")
    for (const pathname of ["/", "/index.html", "/play", "/manifest.webmanifest", "/icons/icon-192.png", "/favicon.ico"]) {
      expect(headersFor(pathname)).not.toHaveProperty("Cache-Control")
    }
  })

  it("falls back to the app for its routes, never for engine, card catalog or asset files", () => {
    expect(vercel.rewrites).toHaveLength(1)
    const [rewrite] = vercel.rewrites
    expect(rewrite!.destination).toBe("/index.html")
    for (const pathname of ["/", "/play", "/decks", "/settings", "/credits", "/matches", "/unknown/deep/link"]) {
      expect(matches(rewrite!.source, pathname), pathname).toBe(true)
    }
    for (const pathname of ["/sw.js", "/manifest.webmanifest", "/favicon.ico", "/apple-touch-icon.png", "/engine/0123456789abcdef/missing.js", "/cards/0123456789abcdef/missing.gz", "/assets/missing.js", "/icons/missing.png", "/legal/LICENSE.txt", "/legal/SOURCE.txt", "/legal/THIRD-PARTY-NOTICES.txt", "/legal/missing.txt", "/.well-known/assetlinks.json", "/.well-known/missing", "/.well-known/missing.json"]) {
      expect(matches(rewrite!.source, pathname), pathname).toBe(false)
    }
  })
  it("serves ORYX trust metadata as revalidated JSON with isolation", () => {
    expect(headersFor("/.well-known/assetlinks.json")).toMatchObject({ ...ISOLATION_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-cache" })
    const links = JSON.parse(readFileSync(path.join(root, "public/.well-known/assetlinks.json"), "utf8"))
    expect(links).toEqual([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "net.tsnet.oryx",
        // Confirmed against ORYX ab3b8c7 and the existing signed 0.2.4 APK.
        sha256_cert_fingerprints: ["EB:25:B0:E8:DD:00:04:BD:6A:BB:7F:C0:FF:52:DF:FE:B2:B4:8D:76:D2:27:F2:5F:D8:16:C1:94:91:46:3F:AA"],
      },
    }])
  })
  it("serves legal document navigation as UTF-8 text with isolation", () => {
    for (const pathname of ["/legal/LICENSE.txt", "/legal/SOURCE.txt", "/legal/THIRD-PARTY-NOTICES.txt"]) {
      expect(headersFor(pathname)).toMatchObject({ ...ISOLATION_HEADERS, "Content-Type": "text/plain; charset=utf-8" })
    }
    expect(headersFor("/legal/components.json")).not.toHaveProperty("Content-Type")
  })
})

describe("vite.config.ts", () => {
  it("dev server and preview send the same isolation headers as Vercel", () => {
    expect(viteConfig.server?.headers).toEqual(ISOLATION_HEADERS)
    expect(viteConfig.preview?.headers).toEqual(ISOLATION_HEADERS)
  })
})

describe("dev server file watching", () => {
  it("watches the app, engine/protocol and engine/client, but not Forge, builds, the card catalog build or reports", async () => {
    const { unwatchedPaths } = await import("./watch.ts")
    const ignored = unwatchedPaths(root)
    for (const watched of ["src/engine/engine-session.ts", "src/app/router.tsx", "src/cards/names.ts", "engine", "engine/protocol", "engine/protocol/src/index.ts", "engine/client/src/engine-client.ts", "vite.config.ts", "index.html"]) {
      expect(ignored(path.join(root, watched)), watched).toBe(false)
    }
    for (const unwatched of ["engine/forge", "engine/forge/forge-gui/res/cardsfolder/a/abc.txt", "engine/build/dist/openmana-engine.js.wasm", "engine/bridge/src", "engine/wasm/host/worker-host.ts", "engine/node_modules/ajv", "dist/index.html", "reports/e2e/report.json", "cards/build/cache/all-cards-1.jsonl.gz", "cards/build/dist/card-catalog.jsonl.gz"]) {
      expect(ignored(path.join(root, unwatched)), unwatched).toBe(true)
    }
  })
})
