// @vitest-environment node
/*
 * Local-first rules (Bible §5, §15): the player's data lives in IndexedDB
 * (src/storage), never in localStorage or sessionStorage, and the storage
 * layer never talks to a network - no account, no cloud, no telemetry.
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const src = path.resolve(import.meta.dirname, "..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "test" || entry.name === "generated" ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })
}

describe("local-first", () => {
  it("no app code uses localStorage or sessionStorage as a store", () => {
    const offending = sourceFiles(src).filter((file) => /\b(localStorage|sessionStorage)\b/.test(readFileSync(file, "utf8")))
    expect(offending.map((file) => path.relative(src, file))).toEqual([])
  })

  it("the storage layer sends nothing anywhere", () => {
    const files = sourceFiles(path.join(src, "storage"))
    expect(files.length).toBeGreaterThan(10)
    const offending = files.filter((file) => /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(readFileSync(file, "utf8")))
    expect(offending.map((file) => path.relative(src, file))).toEqual([])
  })
})
