#!/usr/bin/env node
// Writes engine/build/dist/engine-manifest.json: which Forge, patches,
// resources and toolchain went into this engine build, and the size and
// SHA-256 of every artefact (raw, gzip -9, brotli 11). The sizes over the
// wire are what a browser actually downloads. Artefacts: the launcher, the
// module and the worker host bundle (engine-worker.js, if built). Compressed
// sizes of an artefact whose SHA-256 did not change are taken over from the
// previous manifest (brotli 11 of the module alone takes minutes).
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

const manifestFile = path.join(distDir, "engine-manifest.json");
const previous = fs.existsSync(manifestFile) ? readJson(manifestFile).artefacts ?? {} : {};
const artefacts = {};
for (const name of ["engine-worker.js", "openmana-engine.js", "openmana-engine.js.wasm"]) {
  const file = path.join(distDir, name);
  if (!fs.existsSync(file)) {
    if (name === "engine-worker.js") continue;
    throw new Error(`artefact ${name} is missing in ${distDir}`);
  }
  const data = fs.readFileSync(file);
  const sha256 = createHash("sha256").update(data).digest("hex");
  const known = previous[name]?.sha256 === sha256 ? previous[name] : null;
  artefacts[name] = {
    bytes: data.length,
    sha256,
    gzip9Bytes: known ? known.gzip9Bytes : zlib.gzipSync(data, { level: 9 }).length,
    brotli11Bytes: known
      ? known.brotli11Bytes
      : zlib.brotliCompressSync(data, {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length },
        }).length,
  };
}
const protocolSchema = readJson(path.join(engineDir, "protocol", "schema", "protocol.schema.json"));

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
  protocol: { version: protocolSchema.$defs.ProtocolVersion.const, schema: "engine/protocol/schema/protocol.schema.json" },
  artefacts,
};
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
for (const [name, a] of Object.entries(artefacts)) {
  const mib = (n) => (n < 1048576 ? (n / 1024).toFixed(1) + " KiB" : (n / 1048576).toFixed(1) + " MiB");
  console.error(`[openmana-engine] ${name}: ${mib(a.bytes)} roh, ${mib(a.gzip9Bytes)} gzip -9, ${mib(a.brotli11Bytes)} brotli 11`);
}
