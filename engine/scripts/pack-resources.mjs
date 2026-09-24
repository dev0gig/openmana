#!/usr/bin/env node
// Packs the Forge data listed in engine/resources.json from the pinned Forge
// commit into one bundle (format OMRB0001, read by ResourceBundleReader.java)
// and writes what went in:
//
//   forge-res.bin              the bundle (original paths below forge-gui/: res/...)
//   forge-res.inventory.json   every file: path, bytes, SHA-256 (sorted by path)
//   forge-res.manifest.json    counts, sizes, SHA-256 of bundle and inventory,
//                              per directory, languages, what was left out
//
//   node engine/scripts/pack-resources.mjs <forge-commit> <out-dir>
//
// Files come from `git archive` of the pinned commit, not from the working
// tree, so the bundle is exactly what the pin says. Entries are sorted by
// path, which makes the bundle byte-for-byte reproducible.
//
// Fails loudly when resources.json and the pin disagree: an included or left
// out path that does not exist, an entry of forge-gui/res that resources.json
// does not mention (a Forge update brought something new: decide), or
// language files that do not match the configured languages.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const engineDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [commit, outDir] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/.test(commit ?? "") || !outDir) {
  console.error("usage: pack-resources.mjs <40-char forge commit> <out-dir>");
  process.exit(2);
}

function fail(message) {
  console.error(`[openmana-engine] FEHLER: ${message}`);
  process.exit(1);
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const git = (...args) => execFileSync("git", ["-C", path.join(engineDir, "forge"), ...args], { encoding: "utf8", maxBuffer: 1 << 26 });

const config = JSON.parse(fs.readFileSync(path.join(engineDir, "resources.json"), "utf8"));
const prefix = config.sourcePrefix;
const includes = config.include.map((e) => e.path);
const leftOut = config.leftOut.map((e) => e.path);
for (const entry of [...config.include, ...config.leftOut]) {
  if (typeof entry.path !== "string" || !entry.path.startsWith(`${prefix}res/`) || typeof entry.reason !== "string" || !entry.reason.trim()) {
    fail(`resources.json: every entry needs a path below ${prefix}res/ and a reason: ${JSON.stringify(entry)}`);
  }
}

// Every path of resources.json must exist at the pin (a stale entry would hide a change).
const existing = new Set(git("ls-tree", "-r", "-t", "--name-only", commit, "--", `${prefix}res/`).split("\n").filter(Boolean));
for (const p of [...includes, ...leftOut]) {
  if (!existing.has(p)) {
    fail(`resources.json names ${p}, but Forge ${commit.slice(0, 12)} has no such file or directory`);
  }
}
// Every top-level entry of res/ must be decided on.
const topLevel = git("ls-tree", "--name-only", commit, `${prefix}res/`).split("\n").filter(Boolean);
const covered = (entry) => includes.some((p) => p === entry || p.startsWith(`${entry}/`)) || leftOut.includes(entry);
const undecided = topLevel.filter((entry) => !covered(entry));
if (undecided.length > 0) {
  fail(`Forge ${commit.slice(0, 12)} has ${undecided.join(", ")} in ${prefix}res/, which resources.json neither includes nor leaves out (with a reason). Decide and document it.`);
}
// Language files must match the configured languages exactly.
const languageFiles = includes.filter((p) => p.startsWith(`${prefix}res/languages/`)).map((p) => path.posix.basename(p)).sort();
const expectedLanguageFiles = config.languages.flatMap((l) => (l === "en-US" ? [`${l}.properties`] : [`${l}.properties`, `cardnames-${l}.txt`])).sort();
if (!config.languages.includes("en-US") || JSON.stringify(languageFiles) !== JSON.stringify(expectedLanguageFiles)) {
  fail(`resources.json: languages ${JSON.stringify(config.languages)} need exactly ${expectedLanguageFiles.join(", ")} (en-US always), included are ${languageFiles.join(", ")}`);
}

const staging = fs.mkdtempSync(path.join(os.tmpdir(), "openmana-res-"));
try {
  const tar = execFileSync("git", ["-C", path.join(engineDir, "forge"), "archive", "--format=tar", commit, ...includes], {
    maxBuffer: 1 << 30,
  });
  execFileSync("tar", ["-x", "-C", staging], { input: tar, maxBuffer: 1 << 30 });

  const files = [];
  const walk = (abs) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = path.join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
      else throw new Error(`unexpected entry in Forge resources: ${child}`);
    }
  };
  walk(path.join(staging, prefix));
  const entries = files
    .map((abs) => ({ abs, rel: path.relative(path.join(staging, prefix), abs).split(path.sep).join("/") }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const chunks = [];
  const header = Buffer.alloc(12);
  header.write("OMRB0001", 0, "ascii");
  header.writeUInt32BE(entries.length, 8);
  chunks.push(header);
  const inventory = [];
  const perDir = {};
  let totalBytes = 0;
  for (const { abs, rel } of entries) {
    const pathBytes = Buffer.from(rel, "utf8");
    if (pathBytes.length > 0xffff) throw new Error(`path too long: ${rel}`);
    const content = fs.readFileSync(abs);
    const lengths = Buffer.alloc(2);
    lengths.writeUInt16BE(pathBytes.length, 0);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(content.length, 0);
    chunks.push(lengths, pathBytes, size, content);
    totalBytes += content.length;
    const fileSha = sha256(content);
    inventory.push([rel, content.length, fileSha]);
    const dir = rel.split("/").slice(0, 2).join("/");
    perDir[dir] ??= { files: 0, bytes: 0, hash: createHash("sha256") };
    perDir[dir].files += 1;
    perDir[dir].bytes += content.length;
    perDir[dir].hash.update(`${rel}\t${content.length}\t${fileSha}\n`);
  }
  const bundle = Buffer.concat(chunks);
  const directories = Object.fromEntries(
    Object.entries(perDir).map(([dir, d]) => [dir, { files: d.files, bytes: d.bytes, sha256: d.hash.digest("hex") }]),
  );

  fs.mkdirSync(outDir, { recursive: true });
  const bundlePath = path.join(outDir, "forge-res.bin");
  fs.writeFileSync(bundlePath, bundle);
  const inventoryText =
    JSON.stringify({ format: "openmana-resource-inventory/1", forgeCommit: commit, columns: ["path", "bytes", "sha256"], files: inventory })
      .replace(/\],\[/g, "],\n[") + "\n";
  fs.writeFileSync(path.join(outDir, "forge-res.inventory.json"), inventoryText);
  const manifest = {
    format: "OMRB0001",
    forgeCommit: commit,
    files: entries.length,
    contentBytes: totalBytes,
    bundleBytes: bundle.length,
    sha256: sha256(bundle),
    inventory: { file: "forge-res.inventory.json", files: inventory.length, sha256: sha256(inventoryText) },
    languages: config.languages,
    directories,
    // Entries of res/ that are not (completely) in the bundle; reasons in resources.json.
    leftOut: leftOut.map((p) => p.slice(prefix.length)),
  };
  fs.writeFileSync(path.join(outDir, "forge-res.manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.error(
    `[openmana-engine] Ressourcen: ${entries.length} Dateien, ${(totalBytes / 1048576).toFixed(1)} MiB, Sprachen ${config.languages.join(", ")} -> ${bundlePath}`,
  );
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
