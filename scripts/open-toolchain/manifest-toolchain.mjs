#!/usr/bin/env node
// Replaces the toolchain facts in an engine manifest of an OPEN build
// (scripts/open-toolchain/build-engine.sh). engine/scripts/write-manifest.mjs
// always copies engine/toolchain.lock.json (Oracle GraalVM) into the manifest;
// for the open build that would name a toolchain that was not used. Everything
// else in the manifest (sources, Forge, resources, image, artefact hashes)
// stays as write-manifest.mjs wrote it.
//
//   node manifest-toolchain.mjs <dist>/engine-manifest.json <report-dir>
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [manifestFile, reportDir] = process.argv.slice(2);
if (!manifestFile || !reportDir) throw new Error("Usage: manifest-toolchain.mjs <engine-manifest.json> <report-dir>");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const lockBytes = fs.readFileSync(path.join(here, "toolchain.open.lock.json"));
const open = JSON.parse(lockBytes);
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
if (manifest.format !== "openmana-engine-manifest/2") throw new Error("Unsupported engine manifest");

// The builder must have reported the Community vendor (build-wasm.sh tees its output here).
const log = fs.readFileSync(path.join(reportDir, "native-image.log"), "utf8");
const vendor = /vendor version: ([^\n]+)/.exec(log)?.[1]?.trim();
if (!vendor || !vendor.startsWith("GraalVM CE ")) throw new Error(`native-image.log does not report GraalVM CE (vendor version: ${vendor})`);

const standard = manifest.toolchain;
manifest.toolchain = {
  variant: "open",
  graalvm: `${vendor} (source build oracle/graal@${open.graal.commit.slice(0, 12)})`,
  graalvmJava: open.jdk.version,
  graalSource: { repository: open.graal.repository, tag: open.graal.tag, commit: open.graal.commit },
  mx: { tag: open.mx.tag, commit: open.mx.commit },
  jdk: { archive: open.jdk.archive, sha256: open.jdk.sha256, license: open.jdk.license },
  binaryen: standard.binaryen,
  binaryenSha256: standard.binaryenSha256,
  maven: standard.maven,
  mavenSha512: standard.mavenSha512,
  node: standard.node,
  nodeSha256: standard.nodeSha256,
  npmVersion: standard.npmVersion,
  openLockSha256: sha256(lockBytes),
  packageLockSha256: standard.packageLockSha256,
  npm: standard.npm,
};
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
console.error(`[open-toolchain] Manifest: Toolchain ${manifest.toolchain.graalvm}`);
