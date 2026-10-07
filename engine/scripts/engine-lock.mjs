// A lock is promoted by validate-forge-update.mjs only after all mandatory
// steps succeed. Verification is also available independently before reuse.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkForge, fileDigest, readJson, repoDir, sourceIdentity } from "./update-policy.mjs";

export const ARTIFACTS = ["engine-worker.js", "openmana-engine.js", "openmana-engine.js.wasm", "forge-res.inventory.json"];
export const REQUIRED_STEPS = ["engine-dependencies", "app-dependencies", "build", "engine-tests", "catalog", "app-check"];

export function verifyArtifacts(dist) {
  const manifest = readJson(path.join(dist, "engine-manifest.json"));
  if (manifest.format !== "openmana-engine-manifest/2") throw new Error("Unsupported engine manifest");
  for (const name of ARTIFACTS) {
    const actual = fileDigest(path.join(dist, name));
    const expected = manifest.artefacts[name];
    if (!expected || actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) throw new Error(`Artifact mismatch: ${name}`);
  }
  if (manifest.resources.forgeCommit !== manifest.forge.commit) throw new Error("Resource/engine Forge mismatch");
  if (manifest.resources.inventory.sha256 !== manifest.artefacts["forge-res.inventory.json"].sha256) throw new Error("Resource inventory mismatch");
  return manifest;
}

export function validateEvidence(dir) {
  const pipeline = readJson(path.join(dir, "pipeline.json"));
  if (pipeline.status !== "passed") throw new Error("Pipeline has not passed");
  for (const name of REQUIRED_STEPS) {
    const found = pipeline.steps.filter((step) => step.name === name);
    if (found.length !== 1 || found[0].exitCode !== 0) throw new Error(`Missing/failed pipeline step: ${name}`);
    if (fileDigest(path.join(dir, found[0].log)).sha256 !== found[0].logSha256) throw new Error(`Changed step log: ${name}`);
  }
  const dist = path.join(dir, "dist");
  const manifest = verifyArtifacts(dist);
  const manifestDigest = fileDigest(path.join(dist, "engine-manifest.json"));
  const build = readJson(path.join(dir, "report/build-report.json"));
  if (JSON.stringify(build.manifest) !== JSON.stringify(manifest) || build.steps.some((s) => s.exitCode !== 0) || build.steps.length !== 6) throw new Error("Build report does not describe this complete engine");
  const sources = readJson(path.join(dir, "report/source-inputs.json"));
  if (sources.sha256 !== manifest.sources?.sha256 || sources.sha256 !== pipeline.engineInputsSha256) throw new Error("Build/test source identity mismatch");
  const tests = readJson(path.join(dir, "report/test-report.json"));
  if (tests.format !== "openmana-engine-tests/1" || tests.failures !== 0 || tests.browserSkipped !== false || tests.manifestSha256 !== manifestDigest.sha256) throw new Error("Engine tests missing, skipped, failed or from another build");
  const runs = Object.keys(tests.runs);
  for (const name of ["jvm-traces", "jvm-messages-schema", "jvm-cards-check", "node-protocol", "node-divergence", "browser-negative", "browser-protocol-mismatch"]) {
    if (!Object.hasOwn(tests.runs, name)) throw new Error(`Missing engine evidence: ${name}`);
  }
  for (const prefix of ["jvm-fixture-", "node-replay-", "browser-replay-"]) {
    if (!runs.some((name) => name.startsWith(prefix))) throw new Error(`Missing engine evidence: ${prefix}`);
  }
  const catalog = readJson(path.join(dir, "catalog/card-catalog-manifest.json"));
  if (catalog.forge.commit !== manifest.forge.commit) throw new Error("Catalog was not rebuilt against this Forge revision");
  return { pipeline, manifest, manifestDigest, tests, runs, sources };
}

export function promoteLock(dir, root = repoDir) {
  const { pipeline, manifest, manifestDigest, runs, sources } = validateEvidence(dir);
  if (sourceIdentity(root).sha256 !== sources.sha256 || checkForge(root) !== manifest.forge.commit) throw new Error("Sources changed after verification; lock not updated");
  const lock = {
    format: "openmana-engine-lock/1",
    forge: manifest.forge,
    sources: manifest.sources,
    patches: manifest.patches,
    protocol: manifest.protocol,
    toolchain: manifest.toolchain,
    manifest: { file: "engine-manifest.json", ...manifestDigest },
    artefacts: Object.fromEntries(ARTIFACTS.map((name) => [name, { bytes: manifest.artefacts[name].bytes, sha256: manifest.artefacts[name].sha256 }])),
    verification: {
      base: pipeline.policy.base,
      protocol: pipeline.policy.protocol,
      engineRuns: runs.length,
      browserRuns: runs.filter((name) => name.startsWith("browser-")).length,
      browserSkipped: false,
      reports: Object.fromEntries(["pipeline.json", "report/build-report.json", "report/test-report.json", "report/source-inputs.json", "report/unit-tests.xml", "catalog/card-catalog-manifest.json"].map((name) => [name, fileDigest(path.join(dir, name))])),
    },
  };
  const file = path.join(root, "engine/engine.lock.json");
  fs.writeFileSync(path.join(dir, "engine.lock.json"), JSON.stringify(lock, null, 2) + "\n");
  // The old lock remains intact on every failure; rename publishes the whole
  // new record at once. No Git, release or deployment action occurs here.
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(lock, null, 2) + "\n", { flag: "wx" });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return lock;
}

export function verifyLock(dist, root = repoDir) {
  const lock = readJson(path.join(root, "engine/engine.lock.json"));
  const manifest = verifyArtifacts(dist);
  if (lock.format !== "openmana-engine-lock/1" || lock.manifest.sha256 !== fileDigest(path.join(dist, "engine-manifest.json")).sha256) throw new Error("Engine manifest differs from engine.lock.json");
  if (lock.sources.sha256 !== sourceIdentity(root).sha256 || lock.forge.commit !== checkForge(root)) throw new Error("Locked engine does not match current sources");
  for (const name of ARTIFACTS) {
    if (lock.artefacts[name].sha256 !== manifest.artefacts[name].sha256 || lock.artefacts[name].bytes !== manifest.artefacts[name].bytes) throw new Error(`Lock mismatch: ${name}`);
  }
  return lock;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, dist] = process.argv.slice(2);
  if (command !== "verify" || !dist) throw new Error("Usage: node engine/scripts/engine-lock.mjs verify <dist-dir>");
  const lock = verifyLock(path.resolve(dist));
  console.log(`Verified Forge ${lock.forge.commit}; manifest ${lock.manifest.sha256}`);
}
