// @vitest-environment node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { prepareEngineInputs } from "./assets.ts"

it("carries compiler metadata for the reused WASM without carrying prior passing test reports", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "om-regression-assets-"))
  const original = path.join(temporary, "original")
  const own = path.join(temporary, "own")
  const metadata = '{"compilerSBOM":"original WASM attribution"}\n'
  try {
    for (const name of ["dist", "resources", "harness", "report"]) fs.mkdirSync(path.join(original, name), { recursive: true })
    fs.writeFileSync(path.join(original, "dist/runtime.wasm"), "original artifact")
    fs.writeFileSync(path.join(original, "report/engine-sbom.class-level.json"), metadata)
    fs.writeFileSync(path.join(original, "report/test-report.json"), '{"failures":0}')
    prepareEngineInputs(original, own)
    expect(fs.readFileSync(path.join(own, "dist/runtime.wasm"), "utf8")).toBe("original artifact")
    expect(fs.readFileSync(path.join(own, "report/engine-sbom.class-level.json"), "utf8")).toBe(metadata)
    expect(fs.readdirSync(path.join(own, "report"))).toEqual(["engine-sbom.class-level.json"])
    expect(fs.readFileSync(path.join(original, "report/test-report.json"), "utf8")).toBe('{"failures":0}')
    fs.rmSync(path.join(original, "report/engine-sbom.class-level.json"))
    expect(() => prepareEngineInputs(original, path.join(temporary, "missing-metadata"))).toThrow(/ENOENT/)
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
})
