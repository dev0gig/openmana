#!/usr/bin/env node
// Full check of an engine built with the OPEN toolchain (Prompt 34 feasibility
// trial): the same mandatory steps as engine/scripts/validate-forge-update.mjs,
// with scripts/open-toolchain/build-engine.sh as the build step.
//
// Differences to the Forge update pipeline, on purpose:
//   - no review-base path check (nothing is updated; Forge pin and engine
//     sources must stay exactly what engine/engine.lock.json locks),
//   - engine/engine.lock.json is NEVER promoted or written: the open build is a
//     candidate for a separate, explicitly approved switch, not production.
//
//   node scripts/open-toolchain/validate.mjs --out engine/build/<new dir> [--bulk <cached bulk.jsonl.gz>]
//
// Writes <out>/pipeline.json (format openmana-open-toolchain/1) and step logs.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appIdentity, checkForge, fileDigest, readJson, repoDir, sourceIdentity } from "../../engine/scripts/update-policy.mjs";
import { verifyArtifacts } from "../../engine/scripts/engine-lock.mjs";

const args = process.argv.slice(2);
let out, bulk;
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing value for ${flag}`);
  const value = args[++i];
  if (flag === "--out") out = path.resolve(value);
  else if (flag === "--bulk") bulk = path.resolve(value);
  else throw new Error(`Unknown option: ${flag}`);
}
if (!out) throw new Error("Usage: node scripts/open-toolchain/validate.mjs --out <new engine/build directory> [--bulk <cached-bulk.jsonl.gz>]");
const engine = path.join(repoDir, "engine");
const toolchain = readJson(path.join(engine, "toolchain.lock.json"));
if (process.versions.node !== toolchain.node.version) throw new Error(`Run with pinned Node ${toolchain.node.version} (current ${process.versions.node})`);
if (execFileSync("npm", ["--version"], { encoding: "utf8" }).trim() !== toolchain.node.npmVersion) throw new Error(`Use pinned npm ${toolchain.node.npmVersion}`);
if (process.env.OPENMANA_SKIP_BROWSER === "1") throw new Error("The open build check requires browser tests; remove OPENMANA_SKIP_BROWSER");

const lock = readJson(path.join(engine, "engine.lock.json"));
const forge = checkForge();
const input = sourceIdentity();
if (forge !== lock.forge.commit || input.sha256 !== lock.sources.sha256) {
  throw new Error("Engine sources or Forge pin differ from engine/engine.lock.json; the open build must compile exactly the locked inputs");
}
const lockBefore = fileDigest(path.join(engine, "engine.lock.json")).sha256;
const buildRoot = fs.realpathSync(path.join(engine, "build"));
if (!out.startsWith(buildRoot + path.sep) || fs.existsSync(out)) throw new Error("--out must be a new directory inside engine/build; existing builds are preserved");
fs.mkdirSync(path.join(out, "logs"), { recursive: true });
if (!fs.realpathSync(out).startsWith(buildRoot + path.sep)) throw new Error("Output escapes engine/build through a symlink");

// Chrome creates a Unix-domain socket under TMPDIR (108-byte path limit).
const temporaryDir = fs.mkdtempSync("/var/tmp/om-");
const appInputsSha256 = appIdentity();
const report = { format: "openmana-open-toolchain/1", status: "running", startedAt: new Date().toISOString(), commit: execFileSync("git", ["-C", repoDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), forge, engineInputsSha256: input.sha256, appInputsSha256, lockSha256: lockBefore, temporaryDir, steps: [] };
const reportFile = path.join(out, "pipeline.json");
const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
save();
console.log(`[open-toolchain] Output: ${out}`);

const env = {
  ...process.env,
  TMPDIR: temporaryDir,
  OPENMANA_ENGINE_BUILD_DIR: out,
  OPENMANA_ENGINE_DIR: path.join(out, "dist"),
  OPENMANA_CARDS_DIR: path.join(out, "catalog"),
  OPENMANA_ENGINE: "required", OPENMANA_CARDS: "required", OPENMANA_SKIP_BROWSER: "0",
  OPENMANA_WASM_DEBUG_NAMES: "0",
  VITEST_MAX_WORKERS: "1",
};

async function run(name, command, commandArgs, cwd = repoDir) {
  const log = `logs/${name}.log`;
  const fd = fs.openSync(path.join(out, log), "wx");
  const step = { name, command: [command, ...commandArgs], log, startedAt: new Date().toISOString(), exitCode: null };
  report.steps.push(step);
  save();
  console.log(`[open-toolchain] ${name} (log: ${log})`);
  const started = Date.now();
  try {
    step.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(command, commandArgs, { cwd, env, stdio: ["ignore", fd, fd] });
      child.once("error", reject);
      child.once("exit", (code, signal) => { step.signal = signal; resolve(code ?? 1); });
    });
  } finally {
    fs.closeSync(fd);
    step.seconds = (Date.now() - started) / 1000;
    step.logSha256 = fileDigest(path.join(out, log)).sha256;
    save();
  }
  if (step.exitCode !== 0) throw new Error(`${name} failed; see ${path.join(out, log)}`);
}

try {
  await run("engine-dependencies", "npm", ["ci", "--no-audit", "--no-fund"], engine);
  await run("app-dependencies", "npm", ["ci", "--no-audit", "--no-fund"]);
  await run("browser-preflight", process.execPath, ["engine/scripts/browser-preflight.mjs"]);
  await run("build", "bash", ["scripts/open-toolchain/build-engine.sh"]);
  const manifest = verifyArtifacts(path.join(out, "dist"));
  if (manifest.sources.sha256 !== input.sha256 || manifest.forge.commit !== forge || manifest.toolchain.variant !== "open") throw new Error("Built engine differs from the selected inputs or is not an open build");
  await run("engine-tests", "bash", ["engine/scripts/test-engine.sh"]);
  await run("catalog", "npm", ["run", "cards:build", "--", ...(bulk ? ["--bulk", bulk] : []), "--out", path.join(out, "catalog")]);
  await run("app-check", "npm", ["run", "check"]);
  if (appIdentity() !== appInputsSha256 || sourceIdentity().sha256 !== input.sha256) throw new Error("Sources changed during validation");
  if (fileDigest(path.join(engine, "engine.lock.json")).sha256 !== lockBefore) throw new Error("engine/engine.lock.json changed during validation");
  report.status = "passed";
  console.log("[open-toolchain] PASSED: open build, engine tests, catalog and full app check. engine/engine.lock.json unchanged.");
} catch (error) {
  report.status = "failed";
  report.error = String(error);
  console.error(`[open-toolchain] FAILED: ${error.message}. Evidence: ${out}`);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  save();
  fs.rmSync(temporaryDir, { recursive: true, force: true });
}
