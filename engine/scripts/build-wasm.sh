#!/usr/bin/env bash
# Compiles the engine (patched Forge + bridge + Wasm entry point) to
# WebAssembly with GraalVM Web Image and writes the browser artefacts to
# engine/build/dist:
#
#   openmana-engine.js        launcher (post-processed, see postprocess-launcher.mjs)
#   openmana-engine.js.wasm   the module, Forge data embedded
#   forge-res.inventory.json  every embedded Forge file with size and SHA-256
#   engine-manifest.json      what went in and what came out (hashes, sizes)
#
# and in engine/build/report: the class-level SBOM of the module
# (engine-sbom.class-level.json) and the list of every class in it
# (image-classes.txt/.json, image-classes.mjs).
#
# The toolchain is GraalVM CE built from the pinned open sources
# (setup-toolchain.sh). Its native-image has no class-level SBOM
# (--enable-sbom is an Oracle GraalVM feature), so the build-time feature
# sbom/ReachableTypesFeature.java writes the image's reachable types after the
# analysis and sbom/inventory.py turns them into an SBOM of the same shape:
# each type attributed to the JDK or the GraalVM suite whose source file it
# comes from, Forge/OpenMana/library types left to the notices inventory.
#
# Flags follow ManaBrew's proven Web Image setup (docs/research/MANABREW_WASM.md
# §2) plus -H:+FatalUnsupportedNodes: an unsupported compiler node stops the
# build instead of silently becoming a no-op (research risk R6).
#
# Network play stays out of the module (prompt 04). Netty's jars bring their
# own native-image configuration, which registers Netty's channels for
# reflection and drags ~190 Netty classes into the image although no local
# game ever uses them: that configuration is excluded. The build then aborts
# if a type of a network library (Netty, jupnp: CDDL, see
# docs/research/LICENSES.md; Jetty, servlet) becomes reachable after all,
# with a trace in build/report/native-image-reports/; image-classes.mjs then
# checks the class names in the finished module a second time.
#
# Class initialisation: logging runs at run time (a logger baked into the
# image heap would keep Forge's configuration). Guava's futures stay at build
# time (ManaBrew blog: otherwise Guava picks an Unsafe-based helper that fails
# in the Wasm runtime).
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

# Build-time only: lists the reachable types (see the header). Never part of the module.
javac --add-modules org.graalvm.nativeimage -d "$wasm_work/sbom-feature" "$OM_ENGINE_DIR/scripts/sbom/ReachableTypesFeature.java"

# Resources embedded in the image: the Forge data bundle, and Forge's message
# bundles on the classpath root, where Web Image's resource bundle support
# finds them (Forge's Localizer asks for a bundle named after the language,
# e.g. "de-DE", always also "en-US"). Same files as in the bundle, same pin.
cp "$bundle" "$wasm_work/resources/openmana/forge-res.bin"
languages="$(node -p 'require(process.argv[1]).languages.join(",")' "$OM_ENGINE_DIR/resources.json")"
for language in ${languages//,/ }; do
    git -C "$OM_FORGE_SUBMODULE" show "$(om_forge_pinned_sha):forge-gui/res/languages/$language.properties" > "$wasm_work/bundles/$language.properties"
done

# Network play is not part of the engine: these types must never become
# reachable (the build aborts with a reachability trace if one does).
unreachable_types=('io.netty.*' 'org.jupnp.*' 'org.eclipse.jetty.*' 'javax.servlet.*')
printf '%s\n' "${unreachable_types[@]}" > "$OM_REPORT_DIR/image-unreachable-types.txt"

parallelism="${OPENMANA_NATIVE_IMAGE_PARALLELISM:-}"
extra=()
for type in "${unreachable_types[@]}"; do
    extra+=("-H:AbortOnTypeReachable=$type")
done
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
        -cp "$jar:$wasm_work/classes:$wasm_work/resources:$wasm_work/bundles:$wasm_work/sbom-feature" \
        -H:IncludeResources='openmana/forge-res\.bin' \
        -H:IncludeResources='openmana/engine-build\.properties' \
        -H:IncludeResources='openmana/engine-resources\.properties' \
        -H:IncludeResourceBundles="$languages" \
        -H:IncludeLocales="$languages" \
        -H:+ReportExceptionStackTraces \
        --initialize-at-run-time=org.tinylog,org.slf4j,forge,org.apache.commons.lang3 \
        --initialize-at-build-time=com.google.common.util.concurrent \
        -Djava.awt.headless=true \
        -H:ConfigurationFileDirectories="$OM_ENGINE_DIR/wasm/config/agent,$wasm_work/config/generated" \
        --exclude-config '.*openmana-engine-jvm\.jar' 'META-INF/native-image/io\.netty/.*' \
        --features=org.openmana.engine.sbom.ReachableTypesFeature \
        -J-Dopenmana.open.reachableTypes="$wasm_work/out/reachable-types.txt" \
        -J--add-exports=org.graalvm.nativeimage.builder/com.oracle.svm.hosted=ALL-UNNAMED \
        -J--add-exports=org.graalvm.nativeimage.pointsto/com.oracle.graal.pointsto.meta=ALL-UNNAMED \
        "${extra[@]}" \
        org.openmana.engine.wasm.WasmMain
) 2>&1 | tee "$OM_REPORT_DIR/native-image.log"
rc="${PIPESTATUS[0]}"
set -e
if [ -d "$wasm_work/out/reports" ]; then
    rm -rf "$OM_REPORT_DIR/native-image-reports"
    cp -r "$wasm_work/out/reports" "$OM_REPORT_DIR/native-image-reports"
fi
if [ "$rc" -ne 0 ] && grep -q 'types specified via -H:AbortOnTypeReachable' "$OM_REPORT_DIR/native-image.log"; then
    om_die "Netzwerk-Bibliothek im Modul erreichbar (siehe $OM_REPORT_DIR/native-image-reports/trace_types_*): Netzspiel muss draussen bleiben (Prompt 04)"
fi
[ "$rc" -eq 0 ] || om_die "native-image fehlgeschlagen (Exit $rc), siehe $OM_REPORT_DIR/native-image.log"

[ -f "$wasm_work/out/openmana-engine.js" ] || om_die "native-image hat keinen Launcher erzeugt"
[ -f "$wasm_work/out/openmana-engine.js.wasm" ] || om_die "native-image hat kein Wasm-Modul erzeugt"

node "$OM_ENGINE_DIR/scripts/postprocess-launcher.mjs" \
    "$wasm_work/out/openmana-engine.js" "$OM_DIST_DIR/openmana-engine.js"
cp "$wasm_work/out/openmana-engine.js.wasm" "$OM_DIST_DIR/openmana-engine.js.wasm"
# The .wat text is a debug by-product of several GB; it is not an artefact.
rm -f "$wasm_work/out/openmana-engine.js.wat"
[ -s "$wasm_work/out/reachable-types.txt" ] || om_die "ReachableTypesFeature hat keine Typenliste geschrieben"
cp "$wasm_work/out/reachable-types.txt" "$OM_REPORT_DIR/reachable-types.txt"
python3 -I "$OM_ENGINE_DIR/scripts/sbom/inventory.py" sbom "$wasm_work/out/reachable-types.txt" \
    "$OM_TOOLCHAIN_DIR/graal-source" "$(om_graalvm_home)" "$(om_lock 'lock.jdk.version')" \
    > "$OM_REPORT_DIR/engine-sbom.class-level.json" || om_die "Typen-Inventur (sbom/inventory.py) fehlgeschlagen"
node "$OM_ENGINE_DIR/scripts/image-classes.mjs" "$OM_REPORT_DIR/engine-sbom.class-level.json" "$OM_REPORT_DIR"
cp "$OM_BUILD_DIR/resources/forge-res.inventory.json" "$OM_DIST_DIR/forge-res.inventory.json"

node "$OM_ENGINE_DIR/scripts/write-manifest.mjs" "$OM_DIST_DIR" "$OM_REPORT_DIR" "$OM_BUILD_DIR/resources/forge-res.manifest.json"
om_log "Wasm-Build fertig: $OM_DIST_DIR"
