// @vitest-environment node
/* Mutate reduced historical report samples to prove that missing coverage and
 * green-looking partial runs cannot earn full acceptance. No engine stand-in
 * here is claimed as a gameplay test; the full runner boots real Forge.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { engineEvidence, browserEvidence } from "./evidence.ts"
import { REQUIRED_COVERAGE } from "../../engine/wasm/spike/trace.ts"
import { loadFixtures } from "../../engine/wasm/test/fixtures.ts"

type Sample = Record<string, any> // report mutation deliberately exercises invalid shapes
const sample = (name: string): Sample => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures", `${name}.json`), "utf8"))
const archived = sample("task29-requirements") as unknown as NonNullable<Parameters<typeof engineEvidence>[2]> & { scenes: string[] }
const manifest = sample("engine")["manifestSha256"] as string

describe("full regression evidence", () => {
  it("refuses historical reports as evidence for the new parity requirements", () => {
    // Since prompt 48 a complete run also has the observation scenarios; without them its fixtures (lands; parity-trample of prompt 30) are still missing.
    expect(() => engineEvidence(sample("engine"), manifest)).toThrow(/node-observe/)
    expect(() => engineEvidence(sample("engine"), manifest, { fixtures: loadFixtures(), coverage: REQUIRED_COVERAGE })).toThrow(/missing\/duplicate fixture (lands|parity-trample)/)
    expect(() => browserEvidence(sample("app"), sample("pwa"))).toThrow(/arrange-anywhere/)
  })
  it("accepts the complete historical report shapes, without calling them a new run", () => {
    expect(engineEvidence(sample("engine"), manifest, archived)).toMatchObject({ fixtures: 14, completeResults: ["loss", "win"] })
    // The historical reports predate the foldable's sizes (prompt 38); a new run must have them.
    expect(() => browserEvidence(sample("app"), sample("pwa"), archived.scenes, undefined, false)).toThrow(/foldable/)
    // They also predate the card view in full screen (prompt 47); a new run must have it at every size.
    expect(() => browserEvidence(sample("app"), sample("pwa"), archived.scenes, [])).toThrow(/interaction\/viewer/)
    expect(browserEvidence(sample("app"), sample("pwa"), archived.scenes, [], false)).toMatchObject({ viewports: 8, workerChecks: 11 })
  })
  it.each([
    ["skipped Chrome", (r: Sample) => { r["browserSkipped"] = true }],
    ["focused run", (r: Sample) => { r["focused"] = ["lands"] }],
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
    expect(() => engineEvidence(r, manifest, archived)).toThrow()
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
    expect(() => browserEvidence(r, sample("pwa"), archived.scenes, [], false)).toThrow()
  })
  it("rejects a run without a scene at one of the foldable's sizes", () => {
    const r = sample("app")
    const scenes = Object.fromEntries(archived.scenes.map((scene) => [scene, {}]))
    r["gameTable"]["folds"] = { "fold-closed": scenes, "fold-open": scenes, "fold-open-turned": { ...scenes } }
    expect(browserEvidence(r, sample("pwa"), archived.scenes, undefined, false)).toMatchObject({ viewports: 8 })
    delete r["gameTable"]["folds"]["fold-open-turned"]["built:input"]
    expect(() => browserEvidence(r, sample("pwa"), archived.scenes, undefined, false)).toThrow(/fold-open-turned\/built:input/)
  })
  it("rejects a run without the card view in full screen at a size (prompt 47)", () => {
    const r = sample("app")
    const scenes = Object.fromEntries(archived.scenes.map((scene) => [scene, {}]))
    r["gameTable"]["folds"] = { "fold-closed": { ...scenes, viewer: {} }, "fold-open": { ...scenes, viewer: {} }, "fold-open-turned": { ...scenes, viewer: {} } }
    for (const viewport of Object.keys(r["gameTable"]).filter((key) => key !== "folds")) r["gameTable"][viewport]["interaction"]["viewer"] = {}
    expect(browserEvidence(r, sample("pwa"), archived.scenes)).toMatchObject({ viewports: 8 })
    delete r["gameTable"]["folds"]["fold-open"]["viewer"]
    expect(() => browserEvidence(r, sample("pwa"), archived.scenes)).toThrow(/fold-open\/viewer/)
    r["gameTable"]["folds"]["fold-open"]["viewer"] = {}
    delete r["gameTable"]["phone"]["interaction"]["viewer"]
    expect(() => browserEvidence(r, sample("pwa"), archived.scenes)).toThrow(/phone\/interaction\/viewer/)
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
    expect(() => browserEvidence(sample("app"), r, archived.scenes, [], false)).toThrow()
  })
})
