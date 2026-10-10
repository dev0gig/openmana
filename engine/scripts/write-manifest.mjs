#!/usr/bin/env node
// Writes engine/build/dist/engine-manifest.json: which Forge, patches,
// resources and toolchain went into this engine build, what ended up in the
// module, and the size and SHA-256 of every artefact (raw, gzip -9,
// brotli 11). The sizes over the wire are what a browser actually downloads.
//
//   forge        pinned upstream commit and Forge's version code (e.g. 2.0.15)
//   patches      the patch queue (count, SHA-256 over all patches, names)
//   resources    the embedded Forge data: counts, sizes, SHA-256 of the bundle,
//                per directory, languages, what was left out, and the
//                complete inventory (forge-res.inventory.json: every file
//                with size and SHA-256) by name and SHA-256
//   toolchain    GraalVM CE (version and the pinned oracle/graal and mx
//                commits), labsjdk-ce, Binaryen, Maven (versions and archive
//                hashes from toolchain.lock.json), Node and the npm tools that
//                shape the worker bundle (package-lock.json)
//   image        what native-image found reachable, the classes in the module
//                (image-classes.mjs), the network libraries that are kept out
//                (reachability gate and class check), the classes of Forge's
//                network-play package that remain (interfaces and the "is this
//                process hosting?" check, no network code)
//   protocol     version and schema
//   artefacts    worker host, launcher, module, resource inventory
//
// Compressed sizes of an artefact whose SHA-256 did not change are taken over
// from the previous manifest (brotli 11 of the module alone takes minutes).
//
//   node write-manifest.mjs <dist-dir> <report-dir> [<resources-manifest.json>]

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { sourceIdentity } from "./update-policy.mjs";

const engineDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [distDir, reportDir, resourcesManifest] = process.argv.slice(2);

function fail(message) {
  console.error(`[openmana-engine] FEHLER: ${message}`);
  process.exit(1);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const lock = readJson(path.join(engineDir, "toolchain.lock.json"));
const sourceFile = path.join(reportDir, "source-inputs.json");
if (!fs.existsSync(sourceFile)) fail("source-inputs.json is missing; run a complete build.sh");
const sources = readJson(sourceFile);
if (sources.sha256 !== sourceIdentity().sha256) fail("engine sources changed during/after compilation; run a complete build.sh");
const forgeSource = readJson(path.join(reportDir, "forge-source.json"));
const resources = readJson(resourcesManifest ?? path.join(engineDir, "build", "resources", "forge-res.manifest.json"));
if (resources.forgeCommit !== forgeSource.forgeCommit) {
  fail(`the resource bundle comes from Forge ${resources.forgeCommit}, the engine from ${forgeSource.forgeCommit}`);
}

const manifestFile = path.join(distDir, "engine-manifest.json");
const previous = fs.existsSync(manifestFile) ? readJson(manifestFile).artefacts ?? {} : {};
const artefacts = {};
for (const name of ["engine-worker.js", "openmana-engine.js", "openmana-engine.js.wasm", "forge-res.inventory.json"]) {
  const file = path.join(distDir, name);
  if (!fs.existsSync(file)) {
    if (name === "engine-worker.js") continue;
    fail(`artefact ${name} is missing in ${distDir}`);
  }
  const data = fs.readFileSync(file);
  const digest = sha256(data);
  const known = previous[name]?.sha256 === digest ? previous[name] : null;
  artefacts[name] = {
    bytes: data.length,
    sha256: digest,
    gzip9Bytes: known ? known.gzip9Bytes : zlib.gzipSync(data, { level: 9 }).length,
    brotli11Bytes: known
      ? known.brotli11Bytes
      : zlib.brotliCompressSync(data, {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length },
        }).length,
  };
}
if (artefacts["forge-res.inventory.json"].sha256 !== resources.inventory.sha256) {
  fail("forge-res.inventory.json in dist is not the inventory of this resource bundle");
}

// What native-image says it compiled (build-wasm.sh tees its output here).
const nativeLog = fs.readFileSync(path.join(reportDir, "native-image.log"), "utf8");
const reachable = /([\d,]+) types,\s+([\d,]+) fields, and\s+([\d,]+) methods found reachable/.exec(nativeLog);
if (!reachable) fail("native-image.log has no 'found reachable' line; did the native-image output change?");
const number = (s) => Number(s.replaceAll(",", ""));
const gatesFile = path.join(reportDir, "image-unreachable-types.txt");
if (!fs.existsSync(gatesFile)) fail(`${gatesFile} is missing (written by build-wasm.sh)`);
const gates = fs.readFileSync(gatesFile, "utf8").split("\n").filter(Boolean);
if (gates.length === 0) fail("build-wasm.sh gated no network library; network play must stay out of the module");

// The classes in the module (image-classes.mjs, from native-image's class-level SBOM).
const imageClasses = readJson(path.join(reportDir, "image-classes.json"));
if (imageClasses.networkClasses.length > 0) {
  fail(`network-play classes are in the module: ${imageClasses.networkClasses.slice(0, 10).join(", ")}`);
}

const packageLock = readJson(path.join(engineDir, "package-lock.json"));
const npmVersion = (name) => packageLock.packages?.[`node_modules/${name}`]?.version ?? null;
const protocolSchema = readJson(path.join(engineDir, "protocol", "schema", "protocol.schema.json"));

const manifest = {
  format: "openmana-engine-manifest/2",
  builtAt: new Date().toISOString(),
  sources: { format: sources.format, sha256: sources.sha256, files: sources.files.length },
  forge: { repository: "https://github.com/Card-Forge/forge", commit: forgeSource.forgeCommit, versionCode: forgeSource.forgeVersionCode },
  patches: { count: forgeSource.patchCount, sha256: forgeSource.patchesSha256, files: forgeSource.patches },
  resources: {
    format: resources.format,
    forgeCommit: resources.forgeCommit,
    files: resources.files,
    contentBytes: resources.contentBytes,
    bundleBytes: resources.bundleBytes,
    sha256: resources.sha256,
    languages: resources.languages,
    directories: resources.directories,
    leftOut: resources.leftOut,
    inventory: resources.inventory,
  },
  toolchain: {
    graalvm: `GraalVM CE ${lock.graalvm.version} (oracle/graal@${lock.graalvm.commit.slice(0, 12)})`,
    graalvmJava: lock.graalvm.javaVersion,
    graalvmCommit: lock.graalvm.commit,
    mxCommit: lock.graalvm.mx.commit,
    jdk: lock.jdk.version,
    jdkSha256: lock.jdk.sha256,
    binaryen: lock.binaryen.version,
    binaryenSha256: lock.binaryen.sha256,
    maven: lock.maven.version,
    mavenSha512: lock.maven.sha512,
    node: process.versions.node,
    nodeSha256: lock.node.sha256,
    npmVersion: lock.node.npmVersion,
    lockSha256: sha256(fs.readFileSync(path.join(engineDir, "toolchain.lock.json"))),
    packageLockSha256: sha256(fs.readFileSync(path.join(engineDir, "package-lock.json"))),
    npm: {
      typescript: npmVersion("typescript"),
      esbuild: npmVersion("esbuild"),
      ajv: npmVersion("ajv"),
      "json-schema-to-typescript": npmVersion("json-schema-to-typescript"),
    },
  },
  image: {
    reachableTypes: number(reachable[1]),
    reachableFields: number(reachable[2]),
    reachableMethods: number(reachable[3]),
    classes: imageClasses.classes,
    networkPlay: {
      unreachableEnforced: gates,
      networkClassesInModule: imageClasses.networkClasses.length,
      forgeNetworkPlayClasses: imageClasses.forgeNetworkPlay,
    },
  },
  protocol: { version: protocolSchema.$defs.ProtocolVersion.const, schema: "engine/protocol/schema/protocol.schema.json", sha256: sha256(fs.readFileSync(path.join(engineDir, "protocol/schema/protocol.schema.json"))) },
  artefacts,
};
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
for (const [name, a] of Object.entries(artefacts)) {
  const mib = (n) => (n < 1048576 ? (n / 1024).toFixed(1) + " KiB" : (n / 1048576).toFixed(1) + " MiB");
  console.error(`[openmana-engine] ${name}: ${mib(a.bytes)} roh, ${mib(a.gzip9Bytes)} gzip -9, ${mib(a.brotli11Bytes)} brotli 11`);
}
console.error(`[openmana-engine] Modul: ${imageClasses.classes} Klassen, gesperrt: ${gates.join(", ")}`);
