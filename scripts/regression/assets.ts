import fs from "node:fs"
import path from "node:path"

/** Reuse runtime/compiler metadata, never earlier passing test evidence.
 * Maven/engine/app test outputs are produced anew in the caller's directory.
 */
export function prepareEngineInputs(original: string, ownBuild: string) {
  for (const name of ["dist", "resources", "harness"]) fs.cpSync(path.join(original, name), path.join(ownBuild, name), { recursive: true })
  fs.mkdirSync(path.join(ownBuild, "report"), { recursive: true })
  // Notices follow the reused WASM image's compiler attribution, not just the
  // new JVM classpath. Missing metadata is an explicit preflight failure.
  fs.copyFileSync(path.join(original, "report/engine-sbom.class-level.json"), path.join(ownBuild, "report/engine-sbom.class-level.json"))
}
