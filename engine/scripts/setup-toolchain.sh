#!/usr/bin/env bash
# Sets up the pinned build toolchain (engine/toolchain.lock.json) in
# $OPENMANA_TOOLCHAIN_DIR (default: ~/.cache/openmana/toolchain):
#
#   Binaryen, Maven, Node   downloaded, checked (size + hash) and unpacked there
#   GraalVM CE + Web Image  built from the pinned open sources: labsjdk-ce
#                           (downloaded and checked), oracle/graal and mx at their
#                           pinned commits, `mx build`; then linked in as
#                           $OPENMANA_TOOLCHAIN_DIR/<lock.graalvm.home>
#
# No Oracle GraalVM package is used, not even for bootstrapping (Prompt 35,
# docs/research/OPEN_WEB_IMAGE_BUILD_2026-10-09.md). The source build lives in
# $OPENMANA_GRAAL_SOURCE_DIR (default: ~/.cache/openmana/open-toolchain), once
# per pin: a fresh build takes minutes and ~8 GB, so a validation run reuses it.
# It is checked on every call: pinned commits, clean checkouts, Community
# vendor, no closed (enterprise) JAR, the Wasm builder's module path without
# an enterprise JAR. mx creates empty modules for targets of qualified exports
# that are not built (e.g. com.oracle.svm.extraimage_enterprise); they must
# contain nothing but module-info.
#
# Needs gcc, zlib headers and python3 (for mx), ~3 GiB RAM for the first build.
# Idempotent: unpacked tools and a finished source build are only re-checked.
source "$(dirname "$0")/lib.sh"

om_require_node
om_require_cmd curl "curl wird zum Herunterladen gebraucht."
om_require_cmd tar "tar wird zum Entpacken gebraucht."
om_require_cmd git "git wird fuer die GraalVM-Quellen gebraucht."
om_require_cmd sha256sum "coreutils (sha256sum) fehlt."
om_require_cmd sha512sum "coreutils (sha512sum) fehlt."
om_require_cmd python3 "python3 wird von mx gebraucht."
om_require_cmd gcc "gcc wird zum Bauen von GraalVM gebraucht."
[ -f /usr/include/zlib.h ] || om_die "zlib-Header fehlen (Debian/Ubuntu: zlib1g-dev)."

[ "$(uname -s)-$(uname -m)" = "Linux-x86_64" ] || om_die "Der Toolchain-Pin gilt nur fuer linux-x64, dieser Rechner ist $(uname -s)-$(uname -m)."

downloads="$OM_TOOLCHAIN_DIR/downloads"
mkdir -p "$downloads"

# fetch_verified <tool> <hash-kind sha256|sha512> [<download dir>]
fetch_verified() {
    local tool="$1" kind="$2" dir="${3:-$downloads}"
    local archive url expected size file actual
    archive="$(om_lock "lock.$tool.archive")"
    url="$(om_lock "lock.$tool.url")"
    expected="$(om_lock "lock.$tool.$kind")"
    size="$(om_lock "lock.$tool.size")"
    file="$dir/$archive"
    mkdir -p "$dir"
    if [ ! -f "$file" ]; then
        om_log "lade $tool: $url"
        curl -fL --retry 3 -o "$file.part" "$url" || om_die "Download von $tool fehlgeschlagen: $url"
        mv "$file.part" "$file"
    fi
    actual="$(stat -c %s "$file")"
    [ "$actual" = "$size" ] || om_die "$archive hat $actual Bytes, erwartet $size. Datei loeschen und neu laden."
    actual="$("${kind}sum" "$file" | awk '{print $1}')"
    [ "$actual" = "$expected" ] || om_die "$archive: $kind stimmt nicht (ist $actual, erwartet $expected)."
    om_log "$tool: $archive geprueft ($kind ok)"
}

# unpack <tool> [<archive dir>] [<target dir>]
unpack() {
    local tool="$1" dir="${2:-$downloads}" target="${3:-$OM_TOOLCHAIN_DIR}" archive home
    archive="$(om_lock "lock.$tool.archive")"
    home="$(om_lock "lock.$tool.home")"
    if [ ! -d "$target/$home" ]; then
        om_log "entpacke $archive"
        tar -xf "$dir/$archive" -C "$target"
    fi
    [ -d "$target/$home" ] || om_die "$archive enthaelt nicht das erwartete Verzeichnis $home"
}

fetch_verified binaryen sha256
fetch_verified maven sha512
fetch_verified node sha256
unpack binaryen
unpack maven
unpack node

# GraalVM CE with Web Image from source.
source_dir="${OPENMANA_GRAAL_SOURCE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/openmana/open-toolchain}"
mkdir -p "$source_dir"
fetch_verified jdk sha256 "$source_dir/downloads"
unpack jdk "$source_dir/downloads" "$source_dir"
jdk="$source_dir/$(om_lock 'lock.jdk.home')"
grep -q '^IMPLEMENTOR="GraalVM Community"$' "$jdk/release" || om_die "labsjdk ist kein Community-Build: $jdk"
if grep -rIl -i -E 'no-fee terms|graalvm free terms' "$jdk/legal" >/dev/null; then om_die "labsjdk nennt Oracle NFTC/GFTC in legal/"; fi
[ "$(sha256sum "$jdk"/legal/*/LICENSE | awk '{print $1}' | sort -u)" = "$(om_lock 'lock.jdk.legalLicenseSha256')" ] \
    || om_die "legal/*/LICENSE des labsjdk weicht vom geprueften GPLv2+CPE-Text ab"

checkout() {
    local dir="$1" repo="$2" tag="$3" commit="$4"
    [ -d "$dir/.git" ] || git clone -q --depth 1 --branch "$tag" "$repo" "$dir"
    [ "$(git -C "$dir" rev-parse HEAD)" = "$commit" ] || om_die "$dir steht nicht auf $commit"
    [ -z "$(git -C "$dir" status --porcelain --untracked-files=no)" ] || om_die "$dir hat lokale Aenderungen"
}
checkout "$source_dir/graal" "$(om_lock 'lock.graalvm.repository')" "$(om_lock 'lock.graalvm.tag')" "$(om_lock 'lock.graalvm.commit')"
checkout "$source_dir/mx" "$(om_lock 'lock.graalvm.mx.repository')" "$(om_lock 'lock.graalvm.mx.tag')" "$(om_lock 'lock.graalvm.mx.commit')"

suite="$source_dir/graal/$(om_lock 'lock.graalvm.suite')"
dist="$(om_lock 'lock.graalvm.distributionName')"
graal_built="$source_dir/graal/$(om_lock 'lock.graalvm.homeRelative')"
(
    export JAVA_HOME="$jdk" MX_CACHE_DIR="$source_dir/mx-cache" MX_PYTHON=python3
    export PATH="$source_dir/mx:$jdk/bin:$PATH"
    unset JAVA_TOOL_OPTIONS || true
    cd "$suite"
    [ "$(mx graalvm-dist-name 2>/dev/null | tail -1)" = "$dist" ] || om_die "mx waehlt eine andere GraalVM-Distribution als $dist"
    om_log "GraalVM CE + Web Image: mx build --dependencies $dist (beim ersten Mal einige Minuten)"
    mx -c "${OPENMANA_GRAAL_BUILD_CPUS:-2}" build --dependencies "$dist" >&2
    [ "$(mx graalvm-home 2>/dev/null | tail -1)" = "$graal_built" ] || om_die "GraalVM-Home weicht vom Pin ab"
) || exit 1

for rel in $(om_lock 'lock.graalvm.requiredFiles.join(" ")'); do
    [ -f "$graal_built/$rel" ] || om_die "GraalVM ohne Web Image: $rel fehlt"
done
grep -q '^IMPLEMENTOR="GraalVM Community"$' "$graal_built/release" || om_die "GraalVM-Home ist kein Community-Build"
grep -q "GRAALVM_VERSION=\"$(om_lock 'lock.graalvm.version')\"" "$graal_built/release" || om_die "GraalVM-Version in release passt nicht zum Pin"
grep -q "web-image:$(om_lock 'lock.graalvm.commit')" "$graal_built/release" || om_die "Web Image stammt nicht vom gepinnten Commit"
modulepath="$(grep '^ImageBuilderModulePath' "$graal_built/lib/svm/tools/svm-wasm/native-image.properties")"
case "$modulepath" in *enterprise*) om_die "Wasm-Builder laedt ein Enterprise-JAR: $modulepath" ;; esac
closed="$(find "$graal_built" -iname '*enterprise*' ! -name '*.jmod')"
[ -z "$closed" ] || om_die "geschlossene Teile im GraalVM-Home: $closed"
for jmod in "$graal_built"/jmods/*enterprise*.jmod; do
    [ -e "$jmod" ] || continue
    [ "$("$graal_built/bin/jmod" list "$jmod" | sort | tr '\n' ' ')" = "classes/module-info.class classes/module-info.java " ] \
        || om_die "$(basename "$jmod") ist kein leeres Platzhaltermodul"
done
ln -sfn "$graal_built" "$(om_graalvm_home)"
# The GraalVM sources at the pinned commit: build-wasm.sh attributes the
# module's types to them (engine/scripts/sbom/inventory.py).
ln -sfn "$source_dir/graal" "$OM_TOOLCHAIN_DIR/graal-source"

om_use_toolchain
[ "$(node -p 'process.versions.node')" = "$(om_lock 'lock.node.version')" ] || om_die "Node-Version weicht vom Pin ab"
[ "$(npm --version)" = "$(om_lock 'lock.node.npmVersion')" ] || om_die "npm-Version weicht vom Pin ab"
wasm_as_version="$(wasm-as --version)"
case "$wasm_as_version" in
    *"version $(om_lock 'lock.binaryen.version')"*) ;;
    *) om_die "wasm-as meldet '$wasm_as_version', erwartet Version $(om_lock 'lock.binaryen.version')" ;;
esac
mvn_version="$(mvn -v 2>/dev/null | head -1)"
case "$mvn_version" in
    *"Apache Maven $(om_lock 'lock.maven.version') "*) ;;
    *) om_die "mvn meldet '$mvn_version', erwartet $(om_lock 'lock.maven.version')" ;;
esac

om_log "Toolchain bereit in $OM_TOOLCHAIN_DIR"
om_log "  GraalVM  CE $(om_lock 'lock.graalvm.version') aus oracle/graal@$(om_lock 'lock.graalvm.commit') (Java $(java -version 2>&1 | head -1 | sed 's/.*version "\([^"]*\)".*/\1/'))"
om_log "  Wasm-Builder: $modulepath"
om_log "  Binaryen $wasm_as_version"
om_log "  Maven    $mvn_version"
om_log "  Node     $(node --version)"
