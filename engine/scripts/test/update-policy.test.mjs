import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkForge, fileDigest, git, inspectUpdate, sourceIdentity } from "../update-policy.mjs";
import { ARTIFACTS, validateEvidence, verifyArtifacts } from "../engine-lock.mjs";

function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openmana-update-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, data) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), typeof data === "string" ? data : JSON.stringify(data));
  };
  git(root, "init", "-q");
  git(root, "config", "user.name", "Update test");
  git(root, "config", "user.email", "test@openmana.invalid");
  git(root, "config", "advice.addEmbeddedRepo", "false");
  write(".gitmodules", '[submodule "engine/forge"]\npath = engine/forge\nurl = https://github.com/Card-Forge/forge.git\n');
  write("engine/protocol/schema/protocol.schema.json", { $defs: { ProtocolVersion: { const: 7 } } });
  write("engine/bridge/input.java", "old bridge");
  write("engine/toolchain.lock.json", { version: "pinned" });
  write("src/ui.ts", "unchanged UI");
  write("engine/forge/pom.xml", "fixture upstream");
  const upstream = path.join(root, "engine/forge");
  git(upstream, "init", "-q");
  git(upstream, "config", "user.name", "Upstream fixture");
  git(upstream, "config", "user.email", "fixture@openmana.invalid");
  git(upstream, "remote", "add", "origin", "https://github.com/Card-Forge/forge.git");
  git(upstream, "add", "."); git(upstream, "commit", "-qm", "upstream fixture");
  git(root, "add", "--", ".gitmodules", "src", "engine/bridge", "engine/protocol", "engine/toolchain.lock.json");
  git(root, "update-index", "--add", "--cacheinfo", `160000,${git(upstream, "rev-parse", "HEAD")},engine/forge`);
  git(root, "commit", "-qm", "baseline");
  return { root, write, base: git(root, "rev-parse", "HEAD") };
}

test("scope covers committed, staged, unstaged and untracked engine edits", (t) => {
  const { root, write, base } = repository(t);
  write("engine/bridge/input.java", "committed bridge");
  git(root, "add", "."); git(root, "commit", "-qm", "engine update");
  write("engine/staged.json", "staged"); git(root, "add", "engine/staged.json");
  write("engine/bridge/input.java", "unstaged bridge");
  write("engine/new.json", "untracked");
  assert.deepEqual(inspectUpdate(root, base).changed, ["engine/bridge/input.java", "engine/new.json", "engine/staged.json"]);
});

test("Forge check rejects dirty/untracked source and a checkout different from the staged pin", (t) => {
  const { root, write } = repository(t);
  checkForge(root);
  write("engine/forge/untracked-card.txt", "must not enter the catalog");
  assert.throws(() => checkForge(root), /clean, including untracked/);
  fs.unlinkSync(path.join(root, "engine/forge/untracked-card.txt"));
  git(root, "update-index", "--cacheinfo", `160000,${"b".repeat(40)},engine/forge`);
  assert.throws(() => checkForge(root), /differs from the staged gitlink/);
});

test("UI edits, outside deletions, untracked files and moves cannot evade scope", (t) => {
  const { root, write, base } = repository(t);
  write("src/ui.ts", "changed UI");
  assert.throws(() => inspectUpdate(root, base), /Forbidden paths: src\/ui.ts/);
  git(root, "checkout", "--", "src/ui.ts");
  git(root, "mv", "src/ui.ts", "engine/moved.ts");
  assert.throws(() => inspectUpdate(root, base), /src\/ui.ts/);
  git(root, "mv", "engine/moved.ts", "src/ui.ts");
  write("src/new.ts", "untracked UI");
  assert.throws(() => inspectUpdate(root, base), /src\/new.ts/);
});

test("protocol adaptation requires version increment, reason and exact outside paths", (t) => {
  const { root, write, base } = repository(t);
  const schema = "engine/protocol/schema/protocol.schema.json";
  write(schema, { $defs: { ProtocolVersion: { const: 7 } }, changed: true });
  assert.throws(() => inspectUpdate(root, base, { protocolReason: "needed" }), /increase ProtocolVersion/);
  write(schema, { $defs: { ProtocolVersion: { const: 8 } } });
  assert.throws(() => inspectUpdate(root, base), /supply --protocol-reason/);
  write("src/ui.ts", "adapted client");
  assert.throws(() => inspectUpdate(root, base, { protocolReason: "needed" }), /Forbidden/);
  assert.equal(inspectUpdate(root, base, { protocolReason: "new engine field", adaptationPaths: ["src/ui.ts"] }).protocol.after, 8);
  assert.throws(() => inspectUpdate(root, base, { protocolReason: "needed", adaptationPaths: ["src/*"] }), /exact changed file/);
});

test("exceptions without protocol adaptation and mixed toolchain updates are rejected", (t) => {
  const { root, write, base } = repository(t);
  write("src/ui.ts", "unrelated");
  assert.throws(() => inspectUpdate(root, base, { protocolReason: "excuse", adaptationPaths: ["src/ui.ts"] }), /explicitly versioned/);
  git(root, "checkout", "--", "src/ui.ts");
  write("engine/toolchain.lock.json", { version: "other" });
  assert.throws(() => inspectUpdate(root, base), /separate maintenance PR/);
});

test("input identity binds file names, bytes and pin, survives commits and excludes its output lock", (t) => {
  const { root, write } = repository(t);
  const before = sourceIdentity(root).sha256;
  write("engine/engine.lock.json", { verification: true });
  write("engine/README.md", "maintainer documentation");
  assert.equal(sourceIdentity(root).sha256, before);
  write("engine/patches/0001.patch", "patch content");
  const changed = sourceIdentity(root).sha256;
  assert.notEqual(changed, before);
  git(root, "add", "."); git(root, "commit", "-qm", "changes");
  assert.equal(sourceIdentity(root).sha256, changed);
  git(root, "update-index", "--cacheinfo", `160000,${"b".repeat(40)},engine/forge`);
  assert.notEqual(sourceIdentity(root).sha256, changed);
});

test("artifact verification catches equal-length corruption and mixed resource provenance", (t) => {
  const { root, write } = repository(t);
  const artefacts = {};
  for (const name of ARTIFACTS) { write(name, "verified"); artefacts[name] = fileDigest(path.join(root, name)); }
  const manifest = { format: "openmana-engine-manifest/2", forge: { commit: "a" }, resources: { forgeCommit: "a", inventory: { sha256: artefacts["forge-res.inventory.json"].sha256 } }, artefacts };
  write("engine-manifest.json", manifest);
  verifyArtifacts(root);
  write("openmana-engine.js.wasm", "tampered");
  assert.throws(() => verifyArtifacts(root), /Artifact mismatch/);
  write("openmana-engine.js.wasm", "verified");
  manifest.resources.forgeCommit = "b";
  write("engine-manifest.json", manifest);
  assert.throws(() => verifyArtifacts(root), /Resource\/engine Forge mismatch/);
});

test("a partial or failed validation cannot produce green evidence", (t) => {
  const { root, write } = repository(t);
  write("pipeline.json", { status: "failed", steps: [] });
  assert.throws(() => validateEvidence(root), /has not passed/);
  write("pipeline.json", { status: "passed", steps: [] });
  assert.throws(() => validateEvidence(root), /Missing\/failed pipeline step/);
});

test("browser server and Node helper resolve the isolated candidate build", async (t) => {
  const { root, write } = repository(t);
  write("dist/engine-worker.js", "candidate worker");
  write("harness/spike.js", "candidate harness");
  // A child avoids changing this test process's environment/module cache.
  const helper = new URL("../../wasm/test/node-engine.ts", import.meta.url).href;
  const server = new URL("../../wasm/test/serve.mjs", import.meta.url).href;
  const script = `import assert from 'node:assert/strict'; import { ENGINE_BUILD_DIR } from ${JSON.stringify(helper)}; import { startServer } from ${JSON.stringify(server)}; assert.equal(ENGINE_BUILD_DIR, process.env.OPENMANA_ENGINE_BUILD_DIR); const s = await startServer({port: 0}); try { const url='http://127.0.0.1:'+s.address().port; assert.equal(await (await fetch(url+'/engine/engine-worker.js')).text(), 'candidate worker'); assert.equal(await (await fetch(url+'/harness/spike.js')).text(), 'candidate harness'); } finally { await new Promise(r => s.close(r)); }`;
  execFileSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, OPENMANA_ENGINE_BUILD_DIR: root }, timeout: 15000 });
});

test("Node AI/card entry points load the candidate launcher instead of the default build", (t) => {
  const { root, write } = repository(t);
  write("dist/openmana-engine.js", 'throw new Error("candidate-launcher-marker");');
  for (const name of ["node-ai.ts", "node-cards.ts"]) {
    const entry = new URL(`../../wasm/test/${name}`, import.meta.url);
    const result = spawnSync(process.execPath, [entry.pathname], { env: { ...process.env, OPENMANA_ENGINE_BUILD_DIR: root }, encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.match(report.failures.join("\n"), /candidate-launcher-marker/);
  }
});
