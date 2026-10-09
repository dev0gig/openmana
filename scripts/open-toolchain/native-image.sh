#!/usr/bin/env bash
# `native-image` of the OPEN engine build (scripts/open-toolchain/build-engine.sh
# puts it first on PATH; engine/scripts/build-wasm.sh calls it unchanged).
#
# One flag adjustment, only for the open toolchain:
#
#   --enable-sbom=export,class-level is removed. The class-level SBOM is an
#   Oracle GraalVM feature; GraalVM CE rejects the option (it is taken as the
#   main class name). In its place feature/ReachableTypesFeature.java writes
#   the image's reachable types after the analysis, and inventory.py sbom turns
#   them into <image>.sbom.json in the same shape, which build-wasm.sh,
#   image-classes.mjs (network class check) and the notices inventory read.
#
# Everything else - -H:+FatalUnsupportedNodes, the -H:AbortOnTypeReachable
# network gates, resources, class initialisation, configuration - is passed on
# exactly as build-wasm.sh gives it. Calls without --enable-sbom (e.g.
# --version) go straight to GraalVM CE's native-image.
set -euo pipefail

: "${OPENMANA_OPEN_GRAALVM_HOME:?set by scripts/open-toolchain/build-engine.sh}"
: "${OPENMANA_OPEN_TOOLCHAIN_DIR:?set by scripts/open-toolchain/build-engine.sh}"
: "${OPENMANA_OPEN_FEATURE_DIR:?set by scripts/open-toolchain/build-engine.sh}"
here="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
real="$OPENMANA_OPEN_GRAALVM_HOME/bin/native-image"

sbom=""
args=()
next_is_cp=0
for arg in "$@"; do
    if [ "$next_is_cp" = 1 ]; then
        arg="$arg:$OPENMANA_OPEN_FEATURE_DIR"
        next_is_cp=0
    fi
    case "$arg" in
        --enable-sbom=*) sbom="$arg"; continue ;;
        -cp|--class-path|-classpath) next_is_cp=1 ;;
    esac
    args+=("$arg")
done
[ -n "$sbom" ] || exec "$real" "$@"

image=""
for ((i = 0; i < ${#args[@]}; i++)); do
    [ "${args[$i]}" = "-o" ] && image="${args[$((i + 1))]}"
done
[ -n "$image" ] || { echo "[open-toolchain] FEHLER: native-image ohne -o <name>; die Ersatz-SBOM braucht den Namen" >&2; exit 2; }
main="${args[-1]}"
unset 'args[-1]'
types="$PWD/$image.reachable-types.txt"
rm -f "$types"

echo "[open-toolchain] native-image (GraalVM CE): '$sbom' entfernt (nur Oracle GraalVM), Typenliste ueber ReachableTypesFeature" >&2
"$real" "${args[@]}" \
    --features=org.openmana.opentoolchain.ReachableTypesFeature \
    -J-Dopenmana.open.reachableTypes="$types" \
    -J--add-exports=org.graalvm.nativeimage.builder/com.oracle.svm.hosted=ALL-UNNAMED \
    -J--add-exports=org.graalvm.nativeimage.pointsto/com.oracle.graal.pointsto.meta=ALL-UNNAMED \
    "$main"

[ -s "$types" ] || { echo "[open-toolchain] FEHLER: ReachableTypesFeature hat keine Typenliste geschrieben" >&2; exit 2; }
python3 -I "$here/inventory.py" sbom "$types" "$OPENMANA_OPEN_TOOLCHAIN_DIR/graal" \
    "$OPENMANA_OPEN_TOOLCHAIN_DIR/$(node -p 'require(process.argv[1]).jdk.home' "$here/toolchain.open.lock.json")" \
    "$(node -p 'require(process.argv[1]).jdk.version' "$here/toolchain.open.lock.json")" > "$PWD/$image.sbom.json"
echo "[open-toolchain] Ersatz-SBOM: $PWD/$image.sbom.json ($(wc -l < "$types") erreichbare Typen)" >&2
