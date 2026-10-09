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
//   node scripts/open-toolchain/validate.mjs --out engine/build/<new dir> [--bulk <cached bulk.jsonl.gz>] [--provisional-notices]
//
// The app build only ships an engine whose components have a reviewed entry in
// notices/policy.json; the open toolchain's components ("open:...") have none,
// so the app build stops at that license gate - on purpose: a new toolchain
// needs a license review (separate task). Step notices-gate records exactly
// that stop. With --provisional-notices the full app check then runs with a
// TEMPORARY, clearly marked override in engine/NOTICES.md and license texts
// taken from the open sources (engine/OPEN34-PROVISIONAL-*.md). Both are
// Markdown (outside the engine and app source identities), are restored/deleted
// right after the step and never committed. This is a functional test of the
// app with the open engine, not a license review.
//
// Writes <out>/pipeline.json (format openmana-open-toolchain/1) and step logs.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appIdentity, checkForge, fileDigest, readJson, repoDir, sha256, sourceIdentity } from "../../engine/scripts/update-policy.mjs";
import { verifyArtifacts } from "../../engine/scripts/engine-lock.mjs";

const args = process.argv.slice(2);
let out, bulk;
let provisionalNotices = false;
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (flag === "--provisional-notices") { provisionalNotices = true; continue; }
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

async function run(name, command, commandArgs, cwd = repoDir, { expectFailure = null } = {}) {
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
  if (expectFailure) {
    const text = fs.readFileSync(path.join(out, log), "utf8");
    step.expectedFailure = expectFailure.source;
    step.expectedFailureSeen = step.exitCode !== 0 && expectFailure.test(text);
    save();
    if (!step.expectedFailureSeen) throw new Error(`${name}: expected failure ${expectFailure} did not happen; see ${path.join(out, log)}`);
    return;
  }
  if (step.exitCode !== 0) throw new Error(`${name} failed; see ${path.join(out, log)}`);
}

// Temporary license override for the functional app check (see header).
const OPEN_TOOLCHAIN = path.join(process.env.OPENMANA_OPEN_TOOLCHAIN_DIR || path.join(process.env.XDG_CACHE_HOME || path.join(process.env.HOME, ".cache"), "openmana/open-toolchain"));
async function withProvisionalNotices(action) {
  const notices = path.join(engine, "NOTICES.md");
  const original = fs.readFileSync(notices, "utf8");
  const openLock = readJson(path.join(repoDir, "scripts/open-toolchain/toolchain.open.lock.json"));
  const sources = {
    "open34-provisional-jdk-gpl2-cpe": [path.join(OPEN_TOOLCHAIN, openLock.jdk.home, "legal/java.base/LICENSE"), `labsjdk-ce ${openLock.jdk.version} legal/java.base/LICENSE`],
    "open34-provisional-graal-gpl2-cpe": [path.join(OPEN_TOOLCHAIN, "graal/substratevm/LICENSE"), `oracle/graal@${openLock.graal.commit} substratevm/LICENSE`],
    "open34-provisional-graal-upl": [path.join(OPEN_TOOLCHAIN, "graal/sdk/LICENSE.md"), `oracle/graal@${openLock.graal.commit} sdk/LICENSE.md`],
  };
  const licenseFiles = {};
  const written = [];
  for (const [id, [file, source]] of Object.entries(sources)) {
    const target = path.join(engine, `OPEN34-PROVISIONAL-${id}.md`);
    const content = fs.readFileSync(file, "utf8");
    fs.writeFileSync(target, content, { flag: "wx" });
    written.push(target);
    licenseFiles[id] = { file: path.relative(repoDir, target), sha256: sha256(content), source: `PROVISIONAL, Prompt 34 functional test only, not reviewed: ${source}` };
  }
  const label = (license) => `PROVISIONAL (Prompt 34 functional test, not reviewed): ${license}`;
  const commit = openLock.graal.commit;
  const engineComponents = {
    [`open:labsjdk-ce:${openLock.jdk.version}`]: { license: label("GPL-2.0-only WITH Classpath-exception-2.0, parts Apache-2.0; JVMCI GPL-2.0-only"), texts: ["open34-provisional-jdk-gpl2-cpe"] },
    [`open:graalvm-ce-compiler:${commit}`]: { license: label("GPL-2.0-only WITH Classpath-exception-2.0"), texts: ["open34-provisional-graal-gpl2-cpe"] },
    [`open:graalvm-ce-substratevm:${commit}`]: { license: label("GPL-2.0-only WITH Classpath-exception-2.0"), texts: ["open34-provisional-graal-gpl2-cpe"] },
    [`open:graalvm-ce-web-image:${commit}`]: { license: label("GPL-2.0-only WITH Classpath-exception-2.0"), texts: ["open34-provisional-graal-gpl2-cpe"] },
    [`open:graalvm-ce-espresso-shared:${commit}`]: { license: label("GPL-2.0-only WITH Classpath-exception-2.0"), texts: ["open34-provisional-graal-gpl2-cpe"] },
    [`open:graalvm-ce-sdk:${commit}`]: { license: label("UPL-1.0"), texts: ["open34-provisional-graal-upl"] },
    [`open:graalvm-ce-shaded-google:${commit}`]: { license: label("Apache-2.0 (shaded Guava, Jimfs)"), texts: ["guava", "jimfs"] },
  };
  const block = /```json\n[\s\S]*?\n```/;
  const current = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(original)[1]);
  const merged = { ...current, engineComponents: { ...current.engineComponents, ...engineComponents }, licenseFiles: { ...current.licenseFiles, ...licenseFiles } };
  try {
    fs.writeFileSync(notices, original.replace(block, "```json\n" + JSON.stringify(merged, null, 2) + "\n```"));
    report.provisionalNotices = { components: Object.keys(engineComponents), licenseFiles };
    save();
    await action();
  } finally {
    fs.writeFileSync(notices, original);
    for (const file of written) fs.rmSync(file, { force: true });
  }
  if (fs.readFileSync(notices, "utf8") !== original || written.some((file) => fs.existsSync(file))) throw new Error("Provisional notices could not be restored");
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
  // The license gate must stop the unchanged app build for the open engine.
  await run("notices-gate", "npx", ["vite", "build", "--outDir", path.join(temporaryDir, "notices-gate")], repoDir, { expectFailure: /Unreviewed shipped engine component: open:/ });
  if (provisionalNotices) await withProvisionalNotices(() => run("app-check", "npm", ["run", "check"]));
  else await run("app-check", "npm", ["run", "check"]);
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
