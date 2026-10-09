#!/usr/bin/env bash
# Builds the OPEN engine toolchain (Prompt 34 feasibility trial) from the pins
# in scripts/open-toolchain/toolchain.open.lock.json into
# $OPENMANA_OPEN_TOOLCHAIN_DIR (default: ~/.cache/openmana/open-toolchain):
#
#   labsjdk-ce (OpenJDK + JVMCI, GPLv2 + Classpath Exception), downloaded and checked
#   oracle/graal at the pinned commit and mx at the pinned commit, cloned
#   GraalVM CE with Native Image and Web Image (svm-wasm), built with `mx build`
#
# No Oracle GraalVM package is involved, not even for bootstrapping: mx runs on
# the labsjdk and compiles the GraalVM sources itself. At the end the GraalVM
# home is checked: Community vendor, no closed (enterprise) JAR anywhere, the
# Wasm builder's module path without an enterprise JAR. mx creates empty
# modules for targets of qualified exports that are not part of the build
# (e.g. com.oracle.svm.extraimage_enterprise); those must contain nothing but
# module-info, which is checked too.
#
# Prints the GraalVM home on the last line. Idempotent: a finished build is
# only re-checked (mx build is then a quick no-op).
#
# The standard toolchain (engine/toolchain.lock.json, engine/scripts/setup-toolchain.sh)
# is neither read nor changed. Needs ~3 GiB RAM, gcc and zlib headers, python3.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
lock="$here/toolchain.open.lock.json"
ot="${OPENMANA_OPEN_TOOLCHAIN_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/openmana/open-toolchain}"

log() { printf '[open-toolchain] %s\n' "$*" >&2; }
die() { printf '[open-toolchain] FEHLER: %s\n' "$*" >&2; exit 1; }
pin() { node -e 'const l = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const v = (0, eval)("(l) => l." + process.argv[2])(l); if (v == null) { console.error("missing pin " + process.argv[2]); process.exit(1); } process.stdout.write(String(v));' "$lock" "$1"; }

for cmd in node curl tar git sha256sum python3 gcc; do
    command -v "$cmd" >/dev/null 2>&1 || die "Werkzeug '$cmd' fehlt"
done
[ -f /usr/include/zlib.h ] || die "zlib-Header fehlen (zlib1g-dev)"
[ "$(uname -s)-$(uname -m)" = "Linux-x86_64" ] || die "Der Pin gilt nur fuer linux-x64"
mkdir -p "$ot/downloads"

# 1. labsjdk-ce
archive="$(pin jdk.archive)"
file="$ot/downloads/$archive"
if [ ! -f "$file" ]; then
    log "lade $(pin jdk.url)"
    curl -fL --retry 3 -o "$file.part" "$(pin jdk.url)"
    mv "$file.part" "$file"
fi
[ "$(stat -c %s "$file")" = "$(pin jdk.size)" ] || die "$archive hat die falsche Groesse"
[ "$(sha256sum "$file" | awk '{print $1}')" = "$(pin jdk.sha256)" ] || die "$archive: SHA-256 stimmt nicht"
jdk="$ot/$(pin jdk.home)"
[ -d "$jdk" ] || tar -xzf "$file" -C "$ot"
[ -x "$jdk/bin/java" ] || die "$archive enthaelt nicht $jdk"
grep -q '^IMPLEMENTOR="GraalVM Community"$' "$jdk/release" || die "JDK ist kein Community-Build"
if grep -rIl -i -E 'no-fee terms|graalvm free terms' "$jdk/legal" >/dev/null; then die "JDK nennt Oracle NFTC/GFTC in legal/"; fi
[ "$(sha256sum "$jdk"/legal/*/LICENSE | awk '{print $1}' | sort -u)" = "$(pin jdk.legalLicenseSha256)" ] \
    || die "legal/*/LICENSE des JDK weicht vom geprueften GPLv2+CPE-Text ab"
log "JDK geprueft: $(pin jdk.version) (GPLv2 + Classpath Exception)"

# 2. Sources at the pinned commits
checkout() {
    local dir="$1" repo="$2" tag="$3" commit="$4"
    [ -d "$dir/.git" ] || git clone -q --depth 1 --branch "$tag" "$repo" "$dir"
    [ "$(git -C "$dir" rev-parse HEAD)" = "$commit" ] || die "$dir steht nicht auf $commit"
    [ -z "$(git -C "$dir" status --porcelain --untracked-files=no)" ] || die "$dir hat lokale Aenderungen"
}
checkout "$ot/graal" "$(pin graal.repository)" "$(pin graal.tag)" "$(pin graal.commit)"
checkout "$ot/mx" "$(pin mx.repository)" "$(pin mx.tag)" "$(pin mx.commit)"

# 3. GraalVM CE with Web Image from these sources
export JAVA_HOME="$jdk" MX_CACHE_DIR="$ot/mx-cache" MX_PYTHON=python3
export PATH="$ot/mx:$jdk/bin:$PATH"
unset JAVA_TOOL_OPTIONS || true
suite="$ot/graal/$(pin graal.suite)"
dist="$(pin graal.distribution)"
[ "$(cd "$suite" && mx graalvm-dist-name 2>/dev/null | tail -1)" = "$dist" ] || die "mx waehlt eine andere GraalVM-Distribution als $dist"
log "mx build --dependencies $dist (beim ersten Mal einige Minuten)"
(cd "$suite" && mx -c "${OPENMANA_OPEN_TOOLCHAIN_CPUS:-2}" build --dependencies "$dist") >&2
home="$ot/graal/$(pin graal.homeRelative)"
[ "$(cd "$suite" && mx graalvm-home 2>/dev/null | tail -1)" = "$home" ] || die "GraalVM-Home weicht vom Pin ab"

# 4. Check the result: open only
[ -x "$home/bin/native-image" ] || die "native-image fehlt in $home"
[ -f "$home/lib/svm/tools/svm-wasm/builder/svm-wasm.jar" ] || die "Web Image (svm-wasm) fehlt in $home"
grep -q '^IMPLEMENTOR="GraalVM Community"$' "$home/release" || die "GraalVM-Home ist kein Community-Build"
grep -q '^GRAALVM_VERSION="25.4.4.1.1"$' "$home/release" || die "GraalVM-Version passt nicht"
grep -q "web-image:$(pin graal.commit)" "$home/release" || die "Web Image stammt nicht vom gepinnten Commit"
modulepath="$(grep '^ImageBuilderModulePath' "$home/lib/svm/tools/svm-wasm/native-image.properties")"
case "$modulepath" in *enterprise*) die "Wasm-Builder laedt ein Enterprise-JAR: $modulepath" ;; esac
closed="$(find "$home" -iname '*enterprise*' ! -name '*.jmod')"
[ -z "$closed" ] || die "geschlossene Teile im GraalVM-Home: $closed"
for jmod in "$home"/jmods/*enterprise*.jmod; do
    [ -e "$jmod" ] || continue
    [ "$("$home/bin/jmod" list "$jmod" | sort | tr '\n' ' ')" = "classes/module-info.class classes/module-info.java " ] \
        || die "$(basename "$jmod") ist kein leeres Platzhaltermodul"
done
log "GraalVM CE geprueft: $(sed -n 's/^JAVA_RUNTIME_VERSION=//p' "$home/release"), Wasm-Builder: $modulepath"
printf '%s\n' "$home"
