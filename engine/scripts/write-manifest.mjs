#!/usr/bin/env node
// Writes engine/build/dist/engine-manifest.json: which Forge, patches,
// resources and toolchain went into this engine build, and the size and
// SHA-256 of every artefact (raw, gzip -9, brotli 11). The sizes over the
// wire are what a browser actually downloads.
//
//   node write-manifest.mjs <dist-dir> <report-dir> [<resources-manifest.json>]

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const engineDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [distDir, reportDir, resourcesManifest] = process.argv.slice(2);

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const lock = readJson(path.join(engineDir, "toolchain.lock.json"));
const forgeSource = readJson(path.join(reportDir, "forge-source.json"));
const resources = readJson(resourcesManifest ?? path.join(engineDir, "build", "resources", "forge-res.manifest.json"));

const artefacts = {};
for (const name of ["openmana-engine.js", "openmana-engine.js.wasm"]) {
  const data = fs.readFileSync(path.join(distDir, name));
  artefacts[name] = {
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    gzip9Bytes: zlib.gzipSync(data, { level: 9 }).length,
    brotli11Bytes: zlib.brotliCompressSync(data, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length },
    }).length,
  };
}

const manifest = {
  format: "openmana-engine-manifest/1",
  builtAt: new Date().toISOString(),
  forge: { repository: "https://github.com/Card-Forge/forge", commit: forgeSource.forgeCommit },
  patches: { count: forgeSource.patchCount, sha256: forgeSource.patchesSha256, files: forgeSource.patches },
  resources: {
    format: resources.format,
    files: resources.files,
    contentBytes: resources.contentBytes,
    sha256: resources.sha256,
  },
  toolchain: {
    graalvm: lock.graalvm.version,
    graalvmSha256: lock.graalvm.sha256,
    binaryen: lock.binaryen.version,
    maven: lock.maven.version,
    node: process.versions.node,
  },
  artefacts,
};
fs.writeFileSync(path.join(distDir, "engine-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
for (const [name, a] of Object.entries(artefacts)) {
  const mib = (n) => (n < 1048576 ? (n / 1024).toFixed(1) + " KiB" : (n / 1048576).toFixed(1) + " MiB");
  console.error(`[openmana-engine] ${name}: ${mib(a.bytes)} roh, ${mib(a.gzip9Bytes)} gzip -9, ${mib(a.brotli11Bytes)} brotli 11`);
}
