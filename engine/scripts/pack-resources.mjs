#!/usr/bin/env node
// Packs the Forge data listed in engine/resources.json from the pinned Forge
// commit into one bundle (format OMRB0001, read by ResourceBundleReader.java)
// plus a manifest with counts, sizes and SHA-256.
//
//   node engine/scripts/pack-resources.mjs <forge-commit> <out-dir>
//
// Files come from `git archive` of the pinned commit, not from the working
// tree, so the bundle is exactly what the pin says. Entries are sorted by
// path, which makes the bundle byte-for-byte reproducible.

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

const config = JSON.parse(fs.readFileSync(path.join(engineDir, "resources.json"), "utf8"));
const staging = fs.mkdtempSync(path.join(os.tmpdir(), "openmana-res-"));
try {
  const tar = execFileSync("git", ["-C", path.join(engineDir, "forge"), "archive", "--format=tar", commit, ...config.include], {
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
  walk(path.join(staging, config.sourcePrefix));
  const entries = files
    .map((abs) => ({ abs, rel: path.relative(path.join(staging, config.sourcePrefix), abs).split(path.sep).join("/") }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  for (const include of config.include) {
    const rel = include.slice(config.sourcePrefix.length);
    if (!entries.some((e) => e.rel === rel || e.rel.startsWith(rel + "/"))) {
      throw new Error(`resources.json lists ${include}, but the Forge commit has no such files`);
    }
  }

  const chunks = [];
  const header = Buffer.alloc(12);
  header.write("OMRB0001", 0, "ascii");
  header.writeUInt32BE(entries.length, 8);
  chunks.push(header);
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
    const dir = rel.split("/").slice(0, 2).join("/");
    perDir[dir] ??= { files: 0, bytes: 0 };
    perDir[dir].files += 1;
    perDir[dir].bytes += content.length;
  }
  const bundle = Buffer.concat(chunks);

  fs.mkdirSync(outDir, { recursive: true });
  const bundlePath = path.join(outDir, "forge-res.bin");
  fs.writeFileSync(bundlePath, bundle);
  const manifest = {
    format: "OMRB0001",
    forgeCommit: commit,
    files: entries.length,
    contentBytes: totalBytes,
    bundleBytes: bundle.length,
    sha256: createHash("sha256").update(bundle).digest("hex"),
    directories: perDir,
  };
  fs.writeFileSync(path.join(outDir, "forge-res.manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.error(`[openmana-engine] Ressourcen: ${entries.length} Dateien, ${(totalBytes / 1048576).toFixed(1)} MiB -> ${bundlePath}`);
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
