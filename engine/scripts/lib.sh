# Shared helpers for the OpenMana engine scripts. Source it, do not run it.
#
# Every script fails loudly: a missing tool, a wrong checksum, a patch that no
# longer applies or an unexpected launcher layout stops the build with a
# message that names the problem. Nothing falls back silently.

set -euo pipefail

OM_ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OM_REPO_DIR="$(cd "$OM_ENGINE_DIR/.." && pwd)"
OM_BUILD_DIR="${OPENMANA_ENGINE_BUILD_DIR:-$OM_ENGINE_DIR/build}"
OM_BUILD_DIR="$(realpath -m "$OM_BUILD_DIR")"
export OPENMANA_ENGINE_BUILD_DIR="$OM_BUILD_DIR"
OM_TOOLCHAIN_DIR="${OPENMANA_TOOLCHAIN_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/openmana/toolchain}"
OM_LOCK_FILE="$OM_ENGINE_DIR/toolchain.lock.json"
OM_FORGE_SUBMODULE="$OM_ENGINE_DIR/forge"
OM_WORK_DIR="$OM_BUILD_DIR/work"
OM_DIST_DIR="$OM_BUILD_DIR/dist"
OM_REPORT_DIR="$OM_BUILD_DIR/report"

om_log() { printf '[openmana-engine] %s\n' "$*" >&2; }

om_die() {
    printf '[openmana-engine] FEHLER: %s\n' "$*" >&2
    exit 1
}

om_require_cmd() {
    command -v "$1" >/dev/null 2>&1 || om_die "Werkzeug '$1' fehlt. $2"
}

# Node is needed for every build step that reads JSON, so check it first.
om_require_node() {
    om_require_cmd node "Node >= 22 installieren (siehe engine/toolchain.lock.json)."
    local major
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 22 ] || om_die "Node $(node --version) ist zu alt, gebraucht wird >= 22."
}

# The engine's TypeScript (protocol, client, worker host, tests) runs directly
# in Node through type stripping, which Node 22 has since 22.18.
om_require_node_typescript() {
    om_require_node
    node -e 'process.exit(process.features.typescript ? 0 : 1)' 2>/dev/null \
        || om_die "Node $(node --version) fuehrt kein TypeScript aus; gebraucht wird Node >= 22.18."
}

# om_lock <js-expression over `lock`>, e.g. om_lock 'lock.graalvm.version'
om_lock() {
    node -e 'const lock = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const v = (0, eval)("(lock) => " + process.argv[2])(lock); if (v === undefined || v === null) { console.error("missing lock value: " + process.argv[2]); process.exit(1); } process.stdout.write(String(v));' "$OM_LOCK_FILE" "$1"
}

om_graalvm_home() { printf '%s/%s' "$OM_TOOLCHAIN_DIR" "$(om_lock 'lock.graalvm.home')"; }
om_binaryen_home() { printf '%s/%s' "$OM_TOOLCHAIN_DIR" "$(om_lock 'lock.binaryen.home')"; }
om_maven_home() { printf '%s/%s' "$OM_TOOLCHAIN_DIR" "$(om_lock 'lock.maven.home')"; }
om_node_home() { printf '%s/%s' "$OM_TOOLCHAIN_DIR" "$(om_lock 'lock.node.home')"; }

# Put the pinned toolchain first on PATH. Refuses to continue if it is not set
# up, so a build can never silently pick up a different JDK or wasm-as.
om_use_toolchain() {
    local graal binaryen maven node_home
    graal="$(om_graalvm_home)"
    binaryen="$(om_binaryen_home)"
    maven="$(om_maven_home)"
    node_home="$(om_node_home)"
    [ -x "$graal/bin/native-image" ] || om_die "GraalVM fehlt unter $graal. Zuerst engine/scripts/setup-toolchain.sh ausfuehren."
    [ -f "$graal/lib/svm/tools/svm-wasm/builder/svm-wasm.jar" ] || om_die "Diese GraalVM hat kein Web Image (svm-wasm fehlt): $graal"
    [ -x "$binaryen/bin/wasm-as" ] || om_die "Binaryen fehlt unter $binaryen. Zuerst engine/scripts/setup-toolchain.sh ausfuehren."
    [ -x "$maven/bin/mvn" ] || om_die "Maven fehlt unter $maven. Zuerst engine/scripts/setup-toolchain.sh ausfuehren."
    [ -x "$node_home/bin/node" ] || om_die "Gepinntes Node fehlt unter $node_home. Zuerst engine/scripts/setup-toolchain.sh ausfuehren."
    export JAVA_HOME="$graal"
    export PATH="$graal/bin:$binaryen/bin:$maven/bin:$node_home/bin:$PATH"
    unset JAVA_TOOL_OPTIONS || true
}

# The Forge pin is the gitlink of the engine/forge submodule (read from the
# index, so a staged pin change is what gets built). The checkout must match it
# exactly and be clean, otherwise the build would not be what the repository
# says it is.
om_forge_pinned_sha() {
    git -C "$OM_REPO_DIR" ls-files -s engine/forge | awk '$1 == "160000" {print $2}'
}

om_check_forge_checkout() {
    [ -f "$OM_FORGE_SUBMODULE/pom.xml" ] || om_die "Forge-Submodule fehlt. Ausfuehren: git submodule update --init --depth 1 engine/forge"
    local pinned actual
    pinned="$(om_forge_pinned_sha)"
    actual="$(git -C "$OM_FORGE_SUBMODULE" rev-parse HEAD)"
    [ -n "$pinned" ] || om_die "Kein Forge-Pin (gitlink engine/forge) im Git-Index gefunden."
    [ "$pinned" = "$actual" ] || om_die "engine/forge steht auf $actual, gepinnt ist $pinned. Ausfuehren: git submodule update engine/forge"
    if [ -n "$(git -C "$OM_FORGE_SUBMODULE" status --porcelain --untracked-files=all)" ]; then
        om_die "engine/forge hat lokale Aenderungen. Der Build nimmt nur den gepinnten, unveraenderten Stand (Patches kommen aus engine/patches)."
    fi
}

# Records one timed step into report/steps.jsonl (seconds, exit code).
om_timed() {
    local name="$1"; shift
    mkdir -p "$OM_REPORT_DIR"
    local start end rc
    start="$(date +%s.%N)"
    set +e
    "$@"
    rc=$?
    set -e
    end="$(date +%s.%N)"
    node -e 'const [n, s, e, rc] = process.argv.slice(1); require("fs").appendFileSync(process.argv[5], JSON.stringify({ step: n, seconds: +(e - s).toFixed(2), exitCode: +rc, at: new Date().toISOString() }) + "\n");' \
        "$name" "$start" "$end" "$rc" "$OM_REPORT_DIR/steps.jsonl"
    [ "$rc" -eq 0 ] || om_die "Schritt '$name' ist fehlgeschlagen (Exit $rc)."
}
