#!/usr/bin/env bash
# Complete engine build with the OPEN toolchain (Prompt 34 feasibility trial).
# The same steps and the same unchanged engine scripts as
# engine/scripts/build.sh, with one difference: step 1 is
# scripts/open-toolchain/setup.sh instead of engine/scripts/setup-toolchain.sh.
#
#   1. setup-open-toolchain   GraalVM CE + Web Image from source on labsjdk-ce,
#                             Binaryen/Maven/Node unpacked fresh from the
#                             archives of the standard pin (checked)
#   2.-6. build-host, prepare-forge, pack-resources, build-jvm, build-wasm
#         exactly as engine/scripts/build.sh runs them
#
# Needs OPENMANA_ENGINE_BUILD_DIR: a NEW directory under engine/build (the
# default engine/build itself is refused, so no standard build is overwritten).
#
# How the unchanged engine scripts find the open toolchain: lib.sh looks for
# the tool homes named in engine/toolchain.lock.json under
# $OPENMANA_TOOLCHAIN_DIR. This script points OPENMANA_TOOLCHAIN_DIR at
# <build>/toolchain, where the GraalVM home entry is a symlink to the open
# GraalVM CE home; the other three are unpacked there. No Oracle archive is
# copied, read or unpacked. write-manifest.mjs copies the toolchain facts of
# engine/toolchain.lock.json into the manifest; afterwards they are replaced by
# the open pins (manifest-toolchain.mjs), so the manifest names what was used.
set -euo pipefail

[ -n "${OPENMANA_ENGINE_BUILD_DIR:-}" ] || { echo "[open-toolchain] FEHLER: OPENMANA_ENGINE_BUILD_DIR (neues Verzeichnis unter engine/build) fehlt" >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
export OPENMANA_TOOLCHAIN_DIR="$(realpath -m "$OPENMANA_ENGINE_BUILD_DIR")/toolchain"
source "$here/../../engine/scripts/lib.sh"
[ "$OM_BUILD_DIR" != "$(realpath -m "$OM_ENGINE_DIR/build")" ] || om_die "Der offene Build braucht ein eigenes Verzeichnis unter engine/build"
case "$OM_BUILD_DIR/" in "$(realpath -m "$OM_ENGINE_DIR/build")"/*) ;; *) om_die "OPENMANA_ENGINE_BUILD_DIR muss unter engine/build liegen" ;; esac

om_require_node_typescript
rm -rf "$OM_REPORT_DIR"
mkdir -p "$OM_REPORT_DIR"
scripts="$OM_ENGINE_DIR/scripts"
standard_downloads="${OPENMANA_STANDARD_TOOLCHAIN_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/openmana/toolchain}/downloads"

setup_open_toolchain() {
    local home tool archive file
    home="$(bash "$here/setup.sh" | tail -1)"
    mkdir -p "$OM_TOOLCHAIN_DIR"
    ln -sfn "$home" "$(om_graalvm_home)"
    for tool in binaryen maven node; do
        archive="$(om_lock "lock.$tool.archive")"
        file="$standard_downloads/$archive"
        [ -f "$file" ] || om_die "$archive fehlt in $standard_downloads (engine/scripts/setup-toolchain.sh laedt es)"
        [ "$(stat -c %s "$file")" = "$(om_lock "lock.$tool.size")" ] || om_die "$archive hat die falsche Groesse"
        if [ "$tool" = maven ]; then
            [ "$(sha512sum "$file" | awk '{print $1}')" = "$(om_lock 'lock.maven.sha512')" ] || om_die "$archive: SHA-512 stimmt nicht"
        else
            [ "$(sha256sum "$file" | awk '{print $1}')" = "$(om_lock "lock.$tool.sha256")" ] || om_die "$archive: SHA-256 stimmt nicht"
        fi
        rm -rf "$OM_TOOLCHAIN_DIR/$(om_lock "lock.$tool.home")"
        tar -xf "$file" -C "$OM_TOOLCHAIN_DIR"
    done
    om_use_toolchain
    {
        echo "open GraalVM home: $home"
        cat "$home/release"
        echo
        cat "$home/lib/svm/tools/svm-wasm/native-image.properties"
        java -version 2>&1
        native-image --version 2>&1
        wasm-as --version
        mvn -v 2>&1 | head -1
        node --version
    } > "$OM_REPORT_DIR/open-toolchain.txt"
    om_log "offene Toolchain: $(java -version 2>&1 | sed -n 2p)"
}

om_timed setup-open-toolchain setup_open_toolchain
om_use_toolchain
node "$scripts/update-policy.mjs" sources > "$OM_REPORT_DIR/source-inputs.json"
om_timed build-host bash "$scripts/build-host.sh"
om_timed prepare-forge bash "$scripts/prepare-forge.sh"
om_timed pack-resources node "$scripts/pack-resources.mjs" "$(om_forge_pinned_sha)" "$OM_BUILD_DIR/resources"
om_timed build-jvm bash "$scripts/build-jvm.sh"
om_timed build-wasm bash "$scripts/build-wasm.sh"
node "$here/manifest-toolchain.mjs" "$OM_DIST_DIR/engine-manifest.json" "$OM_REPORT_DIR"

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
console.error("[open-toolchain] Build komplett in " + report.totalSeconds + " s, Bericht: " + dir + "/build-report.json");
' "$OM_REPORT_DIR" "$OM_DIST_DIR/engine-manifest.json"
