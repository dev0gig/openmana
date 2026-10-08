/* Full regression acceptance. A focused/empty report is never full evidence.
 * Engine traces establish rules coverage; built UI scenes only test rendering.
 */
import assert from "node:assert/strict"
import { REQUIRED_COVERAGE } from "../../engine/wasm/spike/trace.ts"
import { loadFixtures, type Fixture } from "../../engine/wasm/test/fixtures.ts"

type Json = Record<string, unknown>
function object(value: unknown, label: string): Json {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${label}: missing object`)
  return value as Json
}
function array(value: unknown, label: string): unknown[] {
  assert(Array.isArray(value) && value.length > 0, `${label}: missing/empty evidence`)
  return value
}
function empty(value: unknown, label: string) {
  assert(Array.isArray(value) && value.length === 0, `${label}: missing or failed`)
}
function yes(value: unknown, label: string) { assert.equal(value, true, label) }

// Tests can explicitly use archived requirements to validate archived report
// shapes. The runner always uses the current fixtures and required coverage.
export function engineEvidence(value: unknown, manifestSha256: string, requirements: { fixtures: readonly Pick<Fixture, "name" | "wasm" | "covers" | "sameGameAs">[], coverage: readonly string[] } = { fixtures: loadFixtures(), coverage: REQUIRED_COVERAGE }) {
  const report = object(value, "engine")
  assert.equal(report["format"], "openmana-engine-tests/1")
  assert.equal(report["manifestSha256"], manifestSha256, "engine: different artifact set")
  assert.equal(report["failures"], 0)
  assert.equal(report["browserSkipped"], false, "engine: Chrome was skipped")
  const runs = object(report["runs"], "engine runs")
  for (const name of ["node-protocol", "node-divergence", "browser-negative", "browser-protocol-mismatch", "jvm-messages-schema", "jvm-cards-check", "jvm-traces"]) {
    yes(object(runs[name], name)["ok"], `${name}: failed`)
  }
  const traces = object(runs["jvm-traces"], "traces")
  empty(traces["problems"], "trace problems")
  const coverage = array(traces["fixtures"], "trace fixtures").map((v) => object(v, "fixture"))
  const fixtures = requirements.fixtures
  for (const fixture of fixtures) {
    const found = coverage.filter((v) => v["name"] === fixture.name)
    assert.equal(found.length, 1, `missing/duplicate fixture ${fixture.name}`)
    const actual = found[0]!
    empty(actual["problems"], fixture.name)
    assert((actual["inputs"] as number) > 0, `${fixture.name}: no input`)
    assert((actual["turns"] as number) > 0, `${fixture.name}: no turn`)
    assert(["win", "loss", "draw"].includes(actual["result"] as string), `${fixture.name}: not a complete game`)
    assert.equal(object(object(actual["stats"], "stats")["checkpoints"], "checkpoints")["end"], 1)
    for (const name of [`jvm-fixture-${fixture.name}`, ...fixture.wasm.node.map((f) => `node-replay-${f}-${fixture.name}`), ...fixture.wasm.browser.map((f) => `browser-replay-${f}-${fixture.name}`)]) {
      const result = object(runs[name], name)
      // JVM outputs a match summary; Node/Chrome replays explicitly attest equality.
      if (!name.startsWith("jvm-")) yes(result["ok"], `${name}: failed`)
    }
    if (!fixture.sameGameAs) {
      const observed = object(actual["coverage"], "coverage")
      for (const category of fixture.covers) assert((observed[category] as number) > 0, `${fixture.name}: missing ${category}`)
    }
  }
  for (const category of requirements.coverage) assert(coverage.some((v) => (object(v["coverage"], "coverage")[category] as number) > 0), `missing engine coverage ${category}`)
  return { runs: Object.keys(runs).length, fixtures: fixtures.length, requiredCoverage: [...requirements.coverage], completeResults: [...new Set(coverage.map((v) => v["result"]))] }
}

export const VIEWPORTS = ["small-phone", "phone", "phone-landscape", "fold-portrait", "fold-landscape", "tablet", "tablet-landscape", "desktop"] as const
const SCENES = ["opening", "main-phase", "stack", "blockers", "defend", "commander-late", "command-effects", "play-draw", "target", "target-player", "yes-no", "discard", "choose-mode", "scry", "ability", "damage", "opponent-turn", "respond", "respond-own", "target-both", "payment", "payment-pool", "payment-life", "cast-x", "attack", "attack-declared", "attack-planeswalker", "block-start", "block-multiple", "built:confirm", "built:input", "built:order", "built:block-order", "built:reveal", "built:choose-many", "built:select-outside", "built:arrange-anywhere", "built:distribute-limits"]

export function browserEvidence(appValue: unknown, pwaValue: unknown, requiredScenes: readonly string[] = SCENES) {
  const app = object(appValue, "app")
  const pwa = object(pwaValue, "PWA")
  assert.equal(app["scope"], undefined, "focused E2E is not a full regression")
  empty(app["failures"], "app failures")
  for (const name of ["devServer", "localData", "localDataQuota", "cardData", "deckImport", "deckLibrary", "preferences", "replay", "oryxCloud", "oryxWebIntegration"]) object(app[name], name)
  assert(array(app["surfaces"], "surfaces").length >= 96)
  assert.equal(array(app["responsive"], "responsive").length, VIEWPORTS.length)
  assert.equal(array(app["engine"], "engine boots").length, 2)
  assert.equal(object(app["withoutIsolation"], "isolation failure")["isolated"], false)
  const game = object(app["gameSession"], "real game session")
  for (const entry of [game, object(game["phone"], "phone game")]) {
    object(entry["played"], "real card play")
    yes(object(entry["liveRecordingReplay"], "live replay")["noInput"], "replay sent input")
    assert((object(entry["finishedRecording"], "finished recording")["entries"] as number) > 0)
  }
  const table = object(app["gameTable"], "table")
  for (const viewport of VIEWPORTS) {
    const scenes = object(table[viewport], viewport)
    for (const scene of requiredScenes) object(scenes[scene], `${viewport}/${scene}`)
    object(scenes["interaction"], `${viewport}/interaction`)
    object(scenes["history"], `${viewport}/history`)
  }
  let workerChecks = 0
  let axeChecks = 0
  function walk(value: unknown, where: string) {
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if (key === "maxAtOnce" || key === "maximumConcurrentWorkers") { assert.equal(child, 1, `${where}: concurrent engine workers`); workerChecks++ }
      if (/axe/i.test(key) || key === "violations") {
        if (typeof child === "number") { assert.equal(child, 0, `${where}/${key}: accessibility violations`); axeChecks++ }
        else if (Array.isArray(child)) { empty(child, `${where}/${key}`); axeChecks++ }
      }
      walk(child, `${where}/${key}`)
    }
  }
  walk(app, "app")
  walk(pwa, "pwa")
  assert(workerChecks >= 11, "missing max1 worker evidence")
  assert(axeChecks >= 600, "missing accessibility evidence")
  assert.equal(pwa["result"], "passed")
  empty(pwa["pageErrors"], "PWA errors")
  const offline = object(pwa["offlineGame"], "offline game")
  for (const name of ["cacheCleared", "networkOffline", "actualServerStopped"]) yes(offline[name], `offline: ${name}`)
  assert.equal(offline["workerStarts"], 1)
  assert.equal(offline["serverRequestsDuringOffline"], 0)
  for (const name of ["corrupt", "interrupt", "eviction"]) assert.equal(object(pwa[name], name)["ready"], false)
  yes(object(pwa["corrupt"], "corrupt")["equalLengthHashCorruption"], "missing SHA failure")
  const update = object(pwa["update"], "update")
  for (const name of ["originalTranscriptUnchanged", "closingOneTabKeptOldVersion", "endedRecordingRetained", "actualFinishedRecording", "originalForgeOutcome"]) yes(update[name], `update: ${name}`)
  for (const name of ["versionUnchanged", "originalTranscriptUnchanged"]) yes(object(pwa["failedShellUpdate"], "failed update")[name], `failed update: ${name}`)
  for (const name of ["visibleFailure", "noPublishedShell", "retrySucceeded", "userDataRetained"]) yes(object(pwa["initialInstallFailure"], "initial failure")[name], `initial failure: ${name}`)
  return { viewports: VIEWPORTS.length, workerChecks, axeChecks, physicalAndroidAcceptance: "on-device game inside ORYX waived by the project owner on 2026-10-08, not tested (docs/READINESS.md)" }
}
