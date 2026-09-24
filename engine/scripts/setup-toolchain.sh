#!/usr/bin/env bash
# Downloads, verifies and unpacks the pinned build toolchain
# (engine/toolchain.lock.json) into $OPENMANA_TOOLCHAIN_DIR
# (default: ~/.cache/openmana/toolchain). Archives stay in downloads/ so the
# exact bytes can be archived; Oracle replaces its GraalVM releases monthly.
#
# Idempotent: already unpacked tools are only re-verified.
source "$(dirname "$0")/lib.sh"

om_require_node
om_require_cmd curl "curl wird zum Herunterladen gebraucht."
om_require_cmd tar "tar wird zum Entpacken gebraucht."
om_require_cmd sha256sum "coreutils (sha256sum) fehlt."
om_require_cmd sha512sum "coreutils (sha512sum) fehlt."

[ "$(uname -s)-$(uname -m)" = "Linux-x86_64" ] || om_die "Der Toolchain-Pin gilt nur fuer linux-x64, dieser Rechner ist $(uname -s)-$(uname -m)."

downloads="$OM_TOOLCHAIN_DIR/downloads"
mkdir -p "$downloads"

# fetch_verified <tool> <hash-kind sha256|sha512>
fetch_verified() {
    local tool="$1" kind="$2"
    local archive url expected size file actual
    archive="$(om_lock "lock.$tool.archive")"
    url="$(om_lock "lock.$tool.url")"
    expected="$(om_lock "lock.$tool.$kind")"
    size="$(om_lock "lock.$tool.size")"
    file="$downloads/$archive"
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

unpack() {
    local tool="$1" archive home
    archive="$(om_lock "lock.$tool.archive")"
    home="$(om_lock "lock.$tool.home")"
    if [ ! -d "$OM_TOOLCHAIN_DIR/$home" ]; then
        om_log "entpacke $archive"
        tar -xzf "$downloads/$archive" -C "$OM_TOOLCHAIN_DIR"
    fi
    [ -d "$OM_TOOLCHAIN_DIR/$home" ] || om_die "$archive enthaelt nicht das erwartete Verzeichnis $home"
}

fetch_verified graalvm sha256
fetch_verified binaryen sha256
fetch_verified maven sha512
unpack graalvm
unpack binaryen
unpack maven

graal="$(om_graalvm_home)"
for rel in $(om_lock 'lock.graalvm.requiredFiles.join(" ")'); do
    [ -f "$graal/$rel" ] || om_die "GraalVM ohne Web Image: $rel fehlt"
done
grep -q "GRAALVM_VERSION=\"$(om_lock 'lock.graalvm.version')\"" "$graal/release" \
    || om_die "GraalVM-Version in $graal/release passt nicht zum Pin"

om_use_toolchain
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
om_log "  GraalVM  $(om_lock 'lock.graalvm.version') (Java $(java -version 2>&1 | head -1 | sed 's/.*version "\([^"]*\)".*/\1/'))"
om_log "  Binaryen $wasm_as_version"
om_log "  Maven    $mvn_version"
om_log "  Node     $(node --version)"
