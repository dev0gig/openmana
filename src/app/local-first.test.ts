// @vitest-environment node
/*
 * Local-first rules (Bible §5, §15): the player's data lives in IndexedDB
 * (src/storage), never in localStorage or sessionStorage, and the storage
 * layer never talks to a network - no account, no telemetry. The optional
 * ORYX cloud (src/cloud) talks to the network only through the ORYX SDK.
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const src = path.resolve(import.meta.dirname, "..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "test" || entry.name === "generated" ? [] : sourceFiles(full)
    return /\.(ts|tsx|js)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })
}

/**
 * The one exception: the ORYX SDK, an unchanged copy of oryx-games/shared
 * (src/cloud/oryx-sdk.test.ts), keeps its own connection in Web Storage - its
 * OAuth tokens, the sync state of the slot, this installation's id, and a copy
 * of the collection before a download merges into it. The player's data stays
 * in IndexedDB; OpenMana's own code never uses Web Storage.
 */
const VENDORED_SDK = path.join("cloud", "oryx-sdk.js")

describe("local-first", () => {
  it("no app code uses localStorage or sessionStorage as a store (only the vendored ORYX SDK, for its connection)", () => {
    const files = sourceFiles(src)
    expect(files.map((file) => path.relative(src, file))).toContain(VENDORED_SDK)
    const offending = files.filter((file) => /\b(localStorage|sessionStorage)\b/.test(readFileSync(file, "utf8")))
    expect(offending.map((file) => path.relative(src, file))).toEqual([VENDORED_SDK])
  })

  it("the storage layer sends nothing anywhere", () => {
    const files = sourceFiles(path.join(src, "storage"))
    expect(files.length).toBeGreaterThan(10)
    const offending = files.filter((file) => /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(readFileSync(file, "utf8")))
    expect(offending.map((file) => path.relative(src, file))).toEqual([])
  })

  it("the ORYX cloud is reached only through the SDK: OpenMana's cloud code sends nothing itself", () => {
    const files = sourceFiles(path.join(src, "cloud")).filter((file) => path.relative(src, file) !== VENDORED_SDK)
    expect(files.length).toBeGreaterThan(2)
    const offending = files.filter((file) => /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(readFileSync(file, "utf8")))
    expect(offending.map((file) => path.relative(src, file))).toEqual([])
  })
})
