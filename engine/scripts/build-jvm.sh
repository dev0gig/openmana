#!/usr/bin/env bash
# Maven build of the patched Forge modules plus the bridge, with the pinned
# GraalVM JDK. Runs the bridge's JVM tests (a full Forge AI game from the
# resource bundle) and produces the fat JAR that native-image compiles.
#
# Forge's own tests are compiled but not run: the -Dtest pattern selects only
# OpenMana's tests (research: skip Forge tests deliberately, not via -DskipTests).
source "$(dirname "$0")/lib.sh"

om_require_node
om_use_toolchain
[ -f "$OM_WORK_DIR/pom.xml" ] || om_die "Kein Arbeitsbaum. Zuerst engine/scripts/prepare-forge.sh ausfuehren."
bundle="$OM_BUILD_DIR/resources/forge-res.bin"
[ -f "$bundle" ] || om_die "Kein Ressourcen-Bundle. Zuerst engine/scripts/pack-resources.mjs ausfuehren (build.sh macht beides)."

# Which Forge data this engine embeds: the engine reports it at start
# (EngineBuild.resourcesSha256) and checks the file count of the bundle it
# unpacks against it. The bundle must come from the pinned Forge commit.
node -e '
const [manifestFile, out, pinned] = process.argv.slice(1);
const m = JSON.parse(require("fs").readFileSync(manifestFile, "utf8"));
if (m.forgeCommit !== pinned) { console.error(`[openmana-engine] FEHLER: Ressourcen-Bundle stammt von Forge ${m.forgeCommit}, gepinnt ist ${pinned}. build.sh neu ausfuehren.`); process.exit(1); }
require("fs").writeFileSync(out, `resources.sha256=${m.sha256}\nresources.files=${m.files}\nresources.languages=${m.languages.join(",")}\n`);
' "$OM_BUILD_DIR/resources/forge-res.manifest.json" "$OM_WORK_DIR/bridge/src/main/resources/openmana/engine-resources.properties" "$(om_forge_pinned_sha)"

mkdir -p "$OM_REPORT_DIR"
set +e
node "$OM_ENGINE_DIR/scripts/measure.mjs" maven "$OM_REPORT_DIR/measure.jsonl" -- \
mvn -B -ntp -f "$OM_WORK_DIR/pom.xml" -pl bridge -am clean package \
    -Dtest='org/openmana/**/*Test' -Dsurefire.failIfNoSpecifiedTests=false \
    -Dopenmana.resourceBundle="$bundle" \
    -Dopenmana.protocolSchema="$OM_ENGINE_DIR/protocol/schema/protocol.schema.json" \
    2>&1 | tee "$OM_REPORT_DIR/maven.log"
rc="${PIPESTATUS[0]}"
set -e
[ "$rc" -eq 0 ] || om_die "Maven-Build fehlgeschlagen (Exit $rc), siehe $OM_REPORT_DIR/maven.log"

jar="$OM_WORK_DIR/bridge/target/openmana-engine-bridge-0.1.0-SNAPSHOT-jar-with-dependencies.jar"
[ -f "$jar" ] || om_die "Fat-JAR fehlt: $jar"
mkdir -p "$OM_BUILD_DIR/jvm"
cp "$jar" "$OM_BUILD_DIR/jvm/openmana-engine-jvm.jar"
om_log "JVM-Build fertig: $OM_BUILD_DIR/jvm/openmana-engine-jvm.jar"
