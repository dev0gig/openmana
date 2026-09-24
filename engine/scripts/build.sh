#!/usr/bin/env bash
# Complete, clean engine build from the pinned sources:
#
#   1. setup-toolchain.sh     pinned GraalVM / Binaryen / Maven, verified
#   2. build-host.sh          protocol schema check, TypeScript, unit tests, worker bundle
#   3. prepare-forge.sh       Forge work tree from the submodule pin + patch queue
#   4. pack-resources.mjs     Forge data bundle from the same pin
#   5. build-jvm.sh           Maven build, bridge JVM tests (real Forge games)
#   6. build-wasm.sh          GraalVM Web Image -> engine/build/dist
#
# Step timings and peak memory go to engine/build/report/ (build-report.json).
source "$(dirname "$0")/lib.sh"

om_require_node_typescript
rm -rf "$OM_REPORT_DIR"
mkdir -p "$OM_REPORT_DIR"
scripts="$OM_ENGINE_DIR/scripts"

om_timed setup-toolchain bash "$scripts/setup-toolchain.sh"
om_timed build-host bash "$scripts/build-host.sh"
om_timed prepare-forge bash "$scripts/prepare-forge.sh"
om_timed pack-resources node "$scripts/pack-resources.mjs" "$(om_forge_pinned_sha)" "$OM_BUILD_DIR/resources"
om_timed build-jvm bash "$scripts/build-jvm.sh"
om_timed build-wasm bash "$scripts/build-wasm.sh"

node -e '
const fs = require("fs");
const dir = process.argv[1];
const lines = (f) => fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
const steps = lines(dir + "/steps.jsonl");
const report = {
  machine: { cpus: require("os").cpus().length, cpuModel: require("os").cpus()[0].model, memGiB: +(require("os").totalmem() / 2 ** 30).toFixed(1) },
  totalSeconds: +steps.reduce((sum, s) => sum + s.seconds, 0).toFixed(1),
  steps,
  measured: lines(dir + "/measure.jsonl"),
  manifest: JSON.parse(fs.readFileSync(process.argv[2], "utf8")),
};
fs.writeFileSync(dir + "/build-report.json", JSON.stringify(report, null, 2) + "\n");
console.error("[openmana-engine] Build komplett in " + report.totalSeconds + " s, Bericht: " + dir + "/build-report.json");
' "$OM_REPORT_DIR" "$OM_DIST_DIR/engine-manifest.json"
