// @vitest-environment node
/* Mutate reduced historical report samples to prove that missing coverage and
 * green-looking partial runs cannot earn full acceptance. No engine stand-in
 * here is claimed as a gameplay test; the full runner boots real Forge.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { engineEvidence, browserEvidence } from "./evidence.ts"

type Sample = Record<string, any> // report mutation deliberately exercises invalid shapes
const sample = (name: string): Sample => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures", `${name}.json`), "utf8"))
const manifest = sample("engine")["manifestSha256"] as string

describe("full regression evidence", () => {
  it("accepts the complete historical report shapes, without calling them a new run", () => {
    expect(engineEvidence(sample("engine"), manifest)).toMatchObject({ fixtures: 14, completeResults: ["loss", "win"] })
    expect(browserEvidence(sample("app"), sample("pwa"))).toMatchObject({ viewports: 8, workerChecks: 11 })
  })
  it.each([
    ["skipped Chrome", (r: Sample) => { r["browserSkipped"] = true }],
    ["foreign build", (r: Sample) => { r["manifestSha256"] = "foreign" }],
    ["failed game", (r: Sample) => { r["failures"] = 1 }],
    ["missing JVM fixture", (r: Sample) => { delete r["runs"]["jvm-fixture-commander"] }],
    ["missing Node feeding", (r: Sample) => { delete r["runs"]["node-replay-eager-commander"] }],
    ["missing Chrome complete game", (r: Sample) => { delete r["runs"]["browser-replay-lazy-commander"] }],
    ["failed Chrome replay", (r: Sample) => { r["runs"]["browser-replay-lazy-commander"]["ok"] = false }],
    ["missing trace coverage", (r: Sample) => { for (const f of r["runs"]["jvm-traces"]["fixtures"]) delete f["coverage"]["block-double"] }],
    ["unfinished game", (r: Sample) => { r["runs"]["jvm-traces"]["fixtures"][0]["stats"]["checkpoints"]["end"] = 0 }],
    ["lost failure-path check", (r: Sample) => { delete r["runs"]["node-protocol"] }],
    ["trace divergence hidden", (r: Sample) => { r["runs"]["node-divergence"]["ok"] = false }],
  ] as const)("rejects engine: %s", (_, mutate) => {
    const r = sample("engine"); mutate(r)
    expect(() => engineEvidence(r, manifest)).toThrow()
  })
  it.each([
    ["focused UI run", (r: Sample) => { r["scope"] = "table-only" }],
    ["missing real Forge session", (r: Sample) => { delete r["gameSession"] }],
    ["missing narrow zone scene", (r: Sample) => { delete r["gameTable"]["small-phone"]["target"] }],
    ["missing decision family", (r: Sample) => { delete r["gameTable"]["desktop"]["built:input"] }],
    ["two concurrent workers", (r: Sample) => { r["gameSession"]["workers"]["maxAtOnce"] = 2 }],
    ["unmeasured worker lifecycle", (r: Sample) => { delete r["gameSession"]["workers"]["maxAtOnce"] }],
    ["accessibility violation", (r: Sample) => { r["surfaces"][0]["violations"] = 1 }],
    ["replay input leakage", (r: Sample) => { r["gameSession"]["liveRecordingReplay"]["noInput"] = false }],
  ] as const)("rejects app: %s", (_, mutate) => {
    const r = sample("app"); mutate(r)
    expect(() => browserEvidence(r, sample("pwa"))).toThrow()
  })
  it.each([
    ["missing offline run", (r: Sample) => { delete r["offlineGame"] }],
    ["server still running", (r: Sample) => { r["offlineGame"]["actualServerStopped"] = false }],
    ["HTTP cache masks offline", (r: Sample) => { r["offlineGame"]["cacheCleared"] = false }],
    ["offline server traffic", (r: Sample) => { r["offlineGame"]["serverRequestsDuringOffline"] = 1 }],
    ["corrupt engine accepted", (r: Sample) => { r["corrupt"]["ready"] = true }],
    ["forced update changes live match", (r: Sample) => { r["update"]["originalTranscriptUnchanged"] = false }],
    ["lost original terminal recording", (r: Sample) => { r["update"]["originalForgeOutcome"] = false }],
    ["installation failure swallowed", (r: Sample) => { r["initialInstallFailure"]["visibleFailure"] = false }],
  ] as const)("rejects PWA: %s", (_, mutate) => {
    const r = sample("pwa"); mutate(r)
    expect(() => browserEvidence(sample("app"), r)).toThrow()
  })
})
