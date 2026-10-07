#!/usr/bin/env node
// Maintainer/CI entry point. Never changes the Forge pin, patches, UI or Git
// state; never publishes. Each invocation gets a NEW disposable build tree.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkForge, fileDigest, git, inspectUpdate, readJson, repoDir, sha256, sourceIdentity } from "./update-policy.mjs";
import { promoteLock, verifyArtifacts } from "./engine-lock.mjs";

const args = process.argv.slice(2);
let base, out, bulk;
let protocolReason = "";
const adaptationPaths = [];
let checkOnly = false;
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (flag === "--check-only") { checkOnly = true; continue; }
  if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing value for ${flag}`);
  const value = args[++i];
  if (flag === "--base") base = value;
  else if (flag === "--out") out = path.resolve(value);
  else if (flag === "--bulk") bulk = path.resolve(value);
  else if (flag === "--protocol-reason") protocolReason = value;
  else if (flag === "--adaptation-path") adaptationPaths.push(value);
  else throw new Error(`Unknown option: ${flag}`);
}
if (!base) throw new Error("Usage: node engine/scripts/validate-forge-update.mjs --base <review-base-commit> [--check-only] [--bulk <cached-bulk.jsonl.gz>] [--out <new-engine/build/directory>] [--protocol-reason <reason> --adaptation-path <exact-file>]");
const policy = inspectUpdate(repoDir, base, { protocolReason, adaptationPaths });
const forge = checkForge();
if (checkOnly) {
  console.log(JSON.stringify({ forge, ...policy }, null, 2));
  process.exit(0);
}
const engine = path.join(repoDir, "engine");
const toolchain = readJson(path.join(engine, "toolchain.lock.json"));
if (process.versions.node !== toolchain.node.version) throw new Error(`Run the pipeline with pinned Node ${toolchain.node.version} (current ${process.versions.node})`);
if (execFileSync("npm", ["--version"], { encoding: "utf8" }).trim() !== toolchain.node.npmVersion) throw new Error(`Use pinned npm ${toolchain.node.npmVersion}`);
if (process.env.OPENMANA_SKIP_BROWSER === "1") throw new Error("A Forge update requires browser tests; remove OPENMANA_SKIP_BROWSER");

fs.mkdirSync(path.join(engine, "build"), { recursive: true });
const buildRoot = fs.realpathSync(path.join(engine, "build"));
if (out) {
  if (!out.startsWith(buildRoot + path.sep) || fs.existsSync(out)) throw new Error("--out must be a new directory inside engine/build; existing builds are preserved");
  fs.mkdirSync(out, { recursive: true });
  if (!fs.realpathSync(out).startsWith(buildRoot + path.sep)) throw new Error("Output escapes engine/build through a symlink");
} else {
  out = fs.mkdtempSync(path.join(buildRoot, "update-"));
}
const logDir = path.join(out, "logs");
fs.mkdirSync(logDir);
fs.mkdirSync(path.join(out, "tmp"));
const input = sourceIdentity();
// Keep the app (including test/build tooling and local-data schema) unchanged
// during validation. No engine source or UI edit can pass on stale evidence.
function appIdentity() {
  return sha256(JSON.stringify(git(repoDir, "ls-files", "-z").split("\0")
    .filter((p) => p && !p.startsWith("engine/") && !p.endsWith(".md"))
    .sort().map((p) => [p, fileDigest(path.join(repoDir, p))])));
}
const appInputsSha256 = appIdentity();
const report = { format: "openmana-forge-update/1", status: "running", startedAt: new Date().toISOString(), commit: git(repoDir, "rev-parse", "HEAD"), forge, policy, engineInputsSha256: input.sha256, appInputsSha256, steps: [] };
const reportFile = path.join(out, "pipeline.json");
const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
save();
console.log(`[forge-update] Output: ${out}`);

// Reuse download bytes only. Extract a fresh toolchain, npm dependencies,
// Forge/bridge classes, resources, harness and WASM in this validation run.
const cachedTools = process.env.OPENMANA_TOOLCHAIN_DIR || path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "openmana/toolchain");
const freshTools = path.join(out, "toolchain");
fs.mkdirSync(path.join(freshTools, "downloads"), { recursive: true });
for (const tool of [toolchain.graalvm, toolchain.binaryen, toolchain.maven, toolchain.node]) {
  const cached = path.join(cachedTools, "downloads", tool.archive);
  if (fs.existsSync(cached)) fs.copyFileSync(cached, path.join(freshTools, "downloads", tool.archive), fs.constants.COPYFILE_FICLONE);
}
const env = {
  ...process.env,
  TMPDIR: path.join(out, "tmp"),
  OPENMANA_ENGINE_BUILD_DIR: out,
  OPENMANA_TOOLCHAIN_DIR: freshTools,
  OPENMANA_ENGINE_DIR: path.join(out, "dist"),
  OPENMANA_CARDS_DIR: path.join(out, "catalog"),
  OPENMANA_ENGINE: "required", OPENMANA_CARDS: "required", OPENMANA_SKIP_BROWSER: "0",
  OPENMANA_WASM_DEBUG_NAMES: "0",
  VITEST_MAX_WORKERS: "1",
};

async function run(name, command, commandArgs, cwd = repoDir, extraEnv = {}) {
  const log = `logs/${name}.log`;
  const fd = fs.openSync(path.join(out, log), "wx");
  const step = { name, command: [command, ...commandArgs], log, startedAt: new Date().toISOString(), exitCode: null };
  report.steps.push(step);
  save();
  console.log(`[forge-update] ${name} (log: ${log})`);
  const started = Date.now();
  try {
    step.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(command, commandArgs, { cwd, env: { ...env, ...extraEnv }, stdio: ["ignore", fd, fd] });
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
  await run("build", "bash", ["engine/scripts/build.sh"]);
  const manifest = verifyArtifacts(path.join(out, "dist"));
  if (manifest.sources.sha256 !== input.sha256 || manifest.forge.commit !== forge) throw new Error("Built engine differs from the selected inputs");
  await run("engine-tests", "bash", ["engine/scripts/test-engine.sh"]);
  await run("catalog", "npm", ["run", "cards:build", "--", ...(bulk ? ["--bulk", bulk] : []), "--out", path.join(out, "catalog")]);
  await run("app-check", "npm", ["run", "check"]);
  if (appIdentity() !== appInputsSha256 || sourceIdentity().sha256 !== input.sha256) throw new Error("Sources changed during validation");
  report.policy = inspectUpdate(repoDir, policy.base, { protocolReason, adaptationPaths });
  report.status = "passed";
  report.finishedAt = new Date().toISOString();
  save();
  const lock = promoteLock(out);
  console.log(`[forge-update] PASSED: ${lock.verification.engineRuns} engine results, ${lock.verification.browserRuns} browser results; catalog and full app check passed. engine/engine.lock.json updated locally.`);
} catch (error) {
  report.status = "failed";
  report.error = String(error);
  report.finishedAt = new Date().toISOString();
  save();
  console.error(`[forge-update] FAILED: ${error.message}. Previous lock retained. Evidence: ${out}`);
  process.exitCode = 1;
}
