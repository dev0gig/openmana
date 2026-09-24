#!/usr/bin/env bash
# Compiles the engine (patched Forge + bridge + Wasm entry point) to
# WebAssembly with GraalVM Web Image and writes the browser artefacts to
# engine/build/dist:
#
#   openmana-engine.js        launcher (post-processed, see postprocess-launcher.mjs)
#   openmana-engine.js.wasm   the module, Forge data embedded
#   engine-manifest.json      what went in and what came out (hashes, sizes)
#
# Flags follow ManaBrew's proven Web Image setup (docs/research/MANABREW_WASM.md
# §2) plus -H:+FatalUnsupportedNodes: an unsupported compiler node stops the
# build instead of silently becoming a no-op (research risk R6).
#
# Class initialisation: Netty's own native-image.properties ask for
# build-time initialisation of io.netty, which would bake an SLF4J/tinylog
# logger into the image heap; logging and Netty are therefore forced to run
# time. Guava's futures stay at build time (ManaBrew blog: otherwise Guava
# picks an Unsafe-based helper that fails in the Wasm runtime).
source "$(dirname "$0")/lib.sh"

om_require_node
om_use_toolchain

jar="$OM_BUILD_DIR/jvm/openmana-engine-jvm.jar"
bundle="$OM_BUILD_DIR/resources/forge-res.bin"
[ -f "$jar" ] || om_die "Fat-JAR fehlt ($jar). Zuerst engine/scripts/build-jvm.sh ausfuehren."
[ -f "$bundle" ] || om_die "Ressourcen-Bundle fehlt ($bundle)."

wasm_work="$OM_BUILD_DIR/wasm-work"
rm -rf "$wasm_work"
mkdir -p "$wasm_work/classes" "$wasm_work/resources/openmana" "$wasm_work/bundles" "$wasm_work/config/generated" "$wasm_work/out" "$OM_DIST_DIR" "$OM_REPORT_DIR"

om_log "javac -parameters (Wasm-Einstieg)"
# -parameters is mandatory: Web Image binds @JS snippet arguments by name.
javac -parameters --add-modules org.graalvm.webimage.api \
    -cp "$jar" -d "$wasm_work/classes" \
    $(find "$OM_ENGINE_DIR/wasm/java" -name '*.java')

node "$OM_ENGINE_DIR/scripts/gen-reflection-config.mjs" "$jar" "$wasm_work/config/generated"

# Resources embedded in the image: the Forge data bundle, and Forge's English
# message bundle on the classpath root, where Web Image's resource bundle
# support finds it (Forge's Localizer asks for bundle "en-US").
cp "$bundle" "$wasm_work/resources/openmana/forge-res.bin"
git -C "$OM_FORGE_SUBMODULE" show "$(om_forge_pinned_sha):forge-gui/res/languages/en-US.properties" > "$wasm_work/bundles/en-US.properties"

parallelism="${OPENMANA_NATIVE_IMAGE_PARALLELISM:-}"
extra=()
[ -n "$parallelism" ] && extra+=("--parallelism=$parallelism")
[ -n "${OPENMANA_NATIVE_IMAGE_XMX:-}" ] && extra+=("-J-Xmx$OPENMANA_NATIVE_IMAGE_XMX")
# Diagnosis only: function names in the Wasm module, so a Java exception in the
# browser shows readable frames instead of wasm-function[N]. Larger module; not
# for release builds.
[ "${OPENMANA_WASM_DEBUG_NAMES:-0}" = "1" ] && extra+=("-H:+DebugNames")

om_log "native-image --tool:svm-wasm (dauert einige Minuten)"
set +e
(
    cd "$wasm_work/out"
    node "$OM_ENGINE_DIR/scripts/measure.mjs" native-image "$OM_REPORT_DIR/measure.jsonl" -- \
    native-image \
        --tool:svm-wasm \
        -H:+UnlockExperimentalVMOptions \
        -H:+FatalUnsupportedNodes \
        -H:WasmComments=NONE \
        -o openmana-engine \
        -cp "$jar:$wasm_work/classes:$wasm_work/resources:$wasm_work/bundles" \
        -H:IncludeResources='openmana/forge-res\.bin' \
        -H:IncludeResources='openmana/engine-build\.properties' \
        -H:IncludeResourceBundles=en-US \
        -H:+ReportExceptionStackTraces \
        --initialize-at-run-time=org.tinylog,org.slf4j,io.netty,forge,org.apache.commons.lang3 \
        --initialize-at-build-time=com.google.common.util.concurrent \
        -Djava.awt.headless=true \
        -H:ConfigurationFileDirectories="$OM_ENGINE_DIR/wasm/config/agent,$wasm_work/config/generated" \
        "${extra[@]}" \
        org.openmana.engine.wasm.WasmMain
) 2>&1 | tee "$OM_REPORT_DIR/native-image.log"
rc="${PIPESTATUS[0]}"
set -e
[ "$rc" -eq 0 ] || om_die "native-image fehlgeschlagen (Exit $rc), siehe $OM_REPORT_DIR/native-image.log"

[ -f "$wasm_work/out/openmana-engine.js" ] || om_die "native-image hat keinen Launcher erzeugt"
[ -f "$wasm_work/out/openmana-engine.js.wasm" ] || om_die "native-image hat kein Wasm-Modul erzeugt"

node "$OM_ENGINE_DIR/scripts/postprocess-launcher.mjs" \
    "$wasm_work/out/openmana-engine.js" "$OM_DIST_DIR/openmana-engine.js"
cp "$wasm_work/out/openmana-engine.js.wasm" "$OM_DIST_DIR/openmana-engine.js.wasm"
# The .wat text is a debug by-product of several GB; it is not an artefact.
rm -f "$wasm_work/out/openmana-engine.js.wat"

node "$OM_ENGINE_DIR/scripts/write-manifest.mjs" "$OM_DIST_DIR" "$OM_REPORT_DIR" "$OM_BUILD_DIR/resources/forge-res.manifest.json"
om_log "Wasm-Build fertig: $OM_DIST_DIR"
