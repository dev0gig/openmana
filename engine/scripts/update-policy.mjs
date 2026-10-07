// Shared source identity and review boundaries for the Forge update pipeline.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
export const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trimEnd();
const paths = (text) => text.split("\0").filter(Boolean);
export const fileDigest = (file) => {
  const bytes = fs.readFileSync(file);
  return { bytes: bytes.length, sha256: sha256(bytes) };
};

export function forgePin(root = repoDir) {
  const line = git(root, "ls-files", "--stage", "--", "engine/forge");
  const match = /^160000 ([a-f0-9]{40}) 0\tengine\/forge$/.exec(line);
  if (!match) throw new Error("engine/forge must have one full, unconflicted gitlink in the index");
  return match[1];
}

export function checkForge(root = repoDir) {
  const pin = forgePin(root);
  const dir = path.join(root, "engine/forge");
  if (git(dir, "rev-parse", "HEAD") !== pin) throw new Error("Forge checkout differs from the staged gitlink; stage the intended full upstream SHA");
  if (git(dir, "status", "--porcelain", "--untracked-files=all")) throw new Error("Forge checkout must be clean, including untracked files; use engine/patches");
  for (const url of [git(root, "config", "-f", ".gitmodules", "--get", "submodule.engine/forge.url"), git(dir, "remote", "get-url", "origin")]) {
    if (url.replace(/\.git$/, "") !== "https://github.com/Card-Forge/forge") throw new Error("Forge must use https://github.com/Card-Forge/forge upstream");
  }
  return pin;
}

// Content identity survives a local commit. Documentation and the output lock
// do not compile into the engine; including the latter would be circular.
export function sourceIdentity(root = repoDir) {
  const files = [...new Set(paths(git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "engine", ".gitmodules")))].sort();
  const entries = [];
  for (const name of files) {
    if (name === "engine/forge" || name === "engine/engine.lock.json" || name.endsWith(".md")) continue;
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue; // an intentional deletion is part of the new input set
    const stat = fs.lstatSync(file);
    if (!stat.isFile()) throw new Error(`Build input is not a regular file: ${name}`);
    entries.push({ path: name, executable: Boolean(stat.mode & 0o111), ...fileDigest(file) });
  }
  const forgeCommit = forgePin(root);
  return { format: "openmana-engine-inputs/1", forgeCommit, sha256: sha256(JSON.stringify({ forgeCommit, entries })), files: entries };
}

export function inspectUpdate(root, baseRef, { protocolReason = "", adaptationPaths = [] } = {}) {
  const base = git(root, "rev-parse", "--verify", `${baseRef}^{commit}`);
  // --no-renames keeps BOTH sides of a move visible. Diff against the worktree
  // includes committed, staged and unstaged changes; add untracked files too.
  const changed = [...new Set([
    ...paths(git(root, "diff", "--name-only", "--no-renames", "-z", base, "--")),
    ...paths(git(root, "ls-files", "--others", "--exclude-standard", "-z")),
  ])].sort();
  const schemaPath = "engine/protocol/schema/protocol.schema.json";
  const oldSchema = JSON.parse(git(root, "show", `${base}:${schemaPath}`));
  const newSchema = readJson(path.join(root, schemaPath));
  const schemaChanged = JSON.stringify(oldSchema) !== JSON.stringify(newSchema);
  const before = oldSchema.$defs.ProtocolVersion.const;
  const after = newSchema.$defs.ProtocolVersion.const;
  if (schemaChanged && (!protocolReason.trim() || !Number.isInteger(after) || after <= before)) {
    throw new Error("Protocol schema changed: supply --protocol-reason and increase ProtocolVersion before adapting clients");
  }
  if (adaptationPaths.length && (!schemaChanged || !protocolReason.trim())) throw new Error("Outside-engine exceptions require an explicitly versioned protocol adaptation and its reason");
  for (const name of adaptationPaths) {
    if (!changed.includes(name) || name.startsWith("engine/") || name.includes("..") || path.isAbsolute(name) || /[*?\[\]]/.test(name)) {
      throw new Error(`Adaptation exception must name an exact changed file outside engine/: ${name}`);
    }
  }
  const forbidden = changed.filter((name) => !name.startsWith("engine/") && !adaptationPaths.includes(name));
  if (forbidden.length) throw new Error(`Forge updates may change only engine/**. Forbidden paths: ${forbidden.join(", ")}`);
  if (changed.includes("engine/toolchain.lock.json")) throw new Error("Toolchain changes need a separate maintenance PR; do not mix them into a Forge update");
  return { base, changed, protocol: { before, after, changed: schemaChanged, reason: protocolReason, adaptationPaths } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "sources") throw new Error("Usage: node engine/scripts/update-policy.mjs sources");
  process.stdout.write(JSON.stringify(sourceIdentity(), null, 2) + "\n");
}
