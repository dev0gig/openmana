/*
 * A local engine development candidate (prompt 48, series openmana-spielfluss
 * 48-52): a complete engine build (engine/scripts/build.sh into its own
 * OPENMANA_ENGINE_BUILD_DIR) plus its card catalog (npm run cards:build --
 * --out <dir>/catalog), which prompts 49-51 use before prompt 52's complete
 * acceptance promotes a lock.
 *
 *   node scripts/engine-candidate.mjs <build dir>
 *
 * Checks what binds it and writes nothing: every artefact against its
 * manifest, the manifest against the current engine sources (a source change
 * makes the candidate stale - build a new one), the Forge pin, the protocol
 * version and schema hash, its own passed JVM tests and complete build report,
 * and its catalog's Forge revision. It replaces the lock check only locally;
 * it is never a lock, a release or a publication build (those keep
 * engine/scripts/engine-lock.mjs verify and the update pipeline). Use the
 * candidate with OPENMANA_ENGINE_DIR=<dir>/dist OPENMANA_CARDS_DIR=<dir>/catalog.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ARTIFACTS, verifyArtifacts } from "../engine/scripts/engine-lock.mjs"
import { checkForge, fileDigest, readJson, repoDir, sourceIdentity } from "../engine/scripts/update-policy.mjs"

/** The candidate's facts; throws, naming the problem, if anything does not bind. */
export function verifyCandidate(dir, root = repoDir) {
  const dist = path.join(dir, "dist")
  const manifest = verifyArtifacts(dist)
  const manifestDigest = fileDigest(path.join(dist, "engine-manifest.json"))
  const sources = sourceIdentity(root)
  if (manifest.sources?.sha256 !== sources.sha256) throw new Error("the candidate does not match the current engine sources: build a new candidate")
  if (checkForge(root) !== manifest.forge.commit) throw new Error("the candidate was built from another Forge pin")
  const schemaFile = path.join(root, "engine/protocol/schema/protocol.schema.json")
  const schema = readJson(schemaFile)
  if (manifest.protocol.version !== schema.$defs.ProtocolVersion.const || manifest.protocol.sha256 !== fileDigest(schemaFile).sha256)
    throw new Error("the candidate speaks another protocol than the sources")
  const jvm = readJson(path.join(dir, "report/jvm-tests.json"))
  if (jvm.format !== "openmana-jvm-tests/1" || !(jvm.tests > 0) || jvm.errors !== 0 || jvm.failures !== 0 || jvm.skipped !== 0)
    throw new Error("the candidate's JVM test evidence is missing, failed or skipped")
  const build = readJson(path.join(dir, "report/build-report.json"))
  if (JSON.stringify(build.manifest) !== JSON.stringify(manifest) || build.steps.some((s) => s.exitCode !== 0) || build.steps.length !== 6)
    throw new Error("the build report does not describe this complete candidate")
  const catalogManifest = path.join(dir, "catalog/card-catalog-manifest.json")
  const catalog = readJson(catalogManifest)
  if (catalog.forge.commit !== manifest.forge.commit) throw new Error("the candidate's catalog was built for another Forge revision")
  return {
    dir: path.resolve(dir),
    manifestSha256: manifestDigest.sha256,
    sourcesSha256: sources.sha256,
    forge: manifest.forge.commit,
    protocol: manifest.protocol.version,
    jvmTests: jvm.tests,
    catalog: { id: catalog.id, file: catalog.file, manifestSha256: fileDigest(catalogManifest).sha256 },
    artefacts: Object.fromEntries(ARTIFACTS.map((name) => [name, manifest.artefacts[name].sha256])),
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]
  if (!dir) {
    console.error("usage: node scripts/engine-candidate.mjs <engine build dir>")
    process.exit(2)
  }
  console.log(JSON.stringify(verifyCandidate(path.resolve(dir)), null, 2))
}
