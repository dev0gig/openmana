#!/usr/bin/env node
// Bundles the TypeScript that runs in the browser (esbuild):
//
//   build/dist/engine-worker.js   the Dedicated Worker host (classic script: it loads the
//                                 GraalVM launcher with importScripts), part of the engine
//                                 artefacts next to openmana-engine.js(.wasm)
//   build/harness/spike.js        the engine's diagnostics page (test tooling, not shipped)
//
// Node runs the same TypeScript sources directly (node-engine-worker.ts), so
// Node and Chrome execute the same worker host code.
//
//   node engine/scripts/bundle-host.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const engineDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const common = { bundle: true, platform: "browser", target: "es2022", format: "iife", logLevel: "warning", charset: "utf8" };

await esbuild.build({
  ...common,
  entryPoints: [path.join(engineDir, "wasm", "host", "engine-worker.ts")],
  outfile: path.join(engineDir, "build", "dist", "engine-worker.js"),
  minify: true,
  sourcemap: "linked",
  legalComments: "none",
  banner: { js: "/* OpenMana engine worker host (engine/wasm/host), GPL-3.0-or-later. Built by engine/scripts/bundle-host.mjs. */" },
});
await esbuild.build({
  ...common,
  entryPoints: [path.join(engineDir, "wasm", "spike", "page.ts")],
  outfile: path.join(engineDir, "build", "harness", "spike.js"),
  sourcemap: "inline",
});
console.error("[openmana-engine] Bundles: build/dist/engine-worker.js, build/harness/spike.js");
