// @vitest-environment node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { expect, it } from "vitest"

const root = path.resolve(import.meta.dirname, "../..")
function run(args: string[], extra: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ["scripts/regression/run.ts", ...args], {
    cwd: root, encoding: "utf8", timeout: 20_000,
    env: { ...process.env, OPENMANA_SKIP_BROWSER: "0", OPENMANA_ENGINE: "0", OPENMANA_CARDS: "0", ...extra },
  })
}

it("refuses a browser skip before any expensive work", () => {
  const result = run([], { OPENMANA_SKIP_BROWSER: "1" })
  expect(result.status).toBe(1)
  expect(result.stderr).toContain("Full regression refuses OPENMANA_SKIP_BROWSER=1")
  expect(result.stdout).not.toContain("[regression] engine-lock")
})

it("refuses focused/no-build flags instead of silently reducing the suite", () => {
  const result = run(["--no-build", "--zones-only"])
  expect(result.status).toBe(1)
  expect(result.stderr).toContain("Usage:")
})

it("preserves an existing report directory including failed evidence", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "om-regression-test-"))
  try {
    const marker = path.join(out, "report.json")
    const previous = '{"status":"failed","error":"original failure"}\n'
    fs.writeFileSync(marker, previous)
    const result = run(["--out", out], { OPENMANA_ENGINE_BUILD_DIR: "/not-used", OPENMANA_CARDS_DIR: "/not-used" })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("EEXIST")
    expect(fs.readFileSync(marker, "utf8")).toBe(previous)
    expect(fs.readdirSync(out)).toEqual(["report.json"])
  } finally { fs.rmSync(out, { recursive: true, force: true }) }
})
