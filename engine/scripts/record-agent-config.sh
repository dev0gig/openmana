#!/usr/bin/env bash
# Re-records engine/wasm/config/agent/reachability-metadata.json with GraalVM's
# tracing agent: runs the JVM smoke game (both card loading modes, two seeds)
# and freezes what the non-Forge libraries access reflectively (JAXP, tinylog
# service loading, Guava, JDK resources). Forge's own classes are registered
# generatively at build time (gen-reflection-config.mjs), independent of this.
#
# Run after dependency or Forge updates, then review the diff before committing.
# Needs a JVM build first (build.sh or build-jvm.sh).
source "$(dirname "$0")/lib.sh"

om_require_node
om_use_toolchain
jar="$OM_BUILD_DIR/jvm/openmana-engine-jvm.jar"
bundle="$OM_BUILD_DIR/resources/forge-res.bin"
[ -f "$jar" ] && [ -f "$bundle" ] || om_die "JVM-Build fehlt. Zuerst engine/scripts/build.sh ausfuehren."

out="$OM_BUILD_DIR/agent-config"
rm -rf "$out"
for mode in lazy eager; do
    for seed in 42 7; do
        java -agentlib:native-image-agent=config-merge-dir="$out" -jar "$jar" \
            --bundle "$bundle" --seed "$seed" --card-loading "$mode" > "$out.log" 2>&1 \
            || om_die "Agent-Lauf $mode/$seed fehlgeschlagen, siehe $out.log"
    done
done
cp "$out/reachability-metadata.json" "$OM_ENGINE_DIR/wasm/config/agent/reachability-metadata.json"
om_log "Metadaten aktualisiert. Diff pruefen: git diff engine/wasm/config/agent"
