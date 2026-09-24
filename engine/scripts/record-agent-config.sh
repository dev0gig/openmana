#!/usr/bin/env bash
# Re-records engine/wasm/config/agent/reachability-metadata.json with GraalVM's
# tracing agent and freezes what the non-Forge libraries access reflectively
# (JAXP, tinylog service loading, Guava, JDK resources). The runs cover the
# engine's paths: the JVM smoke game (both card loading modes, two seeds), a
# human-vs-AI game with the scripted human, and the card probe in German
# (every card, token and edition, the named-creation effects, Forge's German
# messages).
#
# Forge's own classes are registered generatively at build time
# (gen-reflection-config.mjs: every constructor, every EventBus subscriber),
# so they are dropped from the recording. If the agent saw Forge access
# anything else reflectively, the recording fails: the generator must learn
# it, or the Wasm engine would miss it silently.
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
agent="-agentlib:native-image-agent=config-merge-dir=$out"
for mode in lazy eager; do
    for seed in 42 7; do
        java "$agent" -jar "$jar" --bundle "$bundle" --seed "$seed" --card-loading "$mode" > "$out.log" 2>&1 \
            || om_die "Agent-Lauf $mode/$seed fehlgeschlagen, siehe $out.log"
    done
done
java "$agent" -cp "$jar" org.openmana.engine.jvm.JvmHumanMatchMain --bundle "$bundle" --seed 3 \
    --out "$OM_BUILD_DIR/agent-config-human.json" > "$out.log" 2>&1 \
    || om_die "Agent-Lauf Mensch-Partie fehlgeschlagen, siehe $out.log"
java "$agent" -cp "$jar" org.openmana.engine.jvm.JvmCardProbeMain --bundle "$bundle" --card-loading lazy --language de-DE \
    > "$out.log" 2>&1 || om_die "Agent-Lauf Kartenpruefung fehlgeschlagen, siehe $out.log"
rm -f "$OM_BUILD_DIR/agent-config-human.json"
# Forge's EventBus subscribers, registered at build time like the constructors.
java "$OM_ENGINE_DIR/scripts/ListSubscribers.java" "$jar" forge/gamemodes/net/ > "$out/subscribers.jsonl" \
    || om_die "ListSubscribers.java fehlgeschlagen"

node -e '
const fs = require("fs");
const [recorded, target, subscribersFile] = process.argv.slice(1);
const metadata = JSON.parse(fs.readFileSync(recorded, "utf8"));
const subscribers = new Set(fs.readFileSync(subscribersFile, "utf8").split("\n").filter(Boolean).map((l) => { const s = JSON.parse(l); return `${s.type}#${s.name}`; }));
const unexpected = [];
for (const [kind, entries] of Object.entries(metadata)) {
  if (!Array.isArray(entries)) continue;
  metadata[kind] = entries.filter((entry) => {
    const type = typeof entry.type === "string" ? entry.type : "";
    if (!type.startsWith("forge.")) return true;
    // Covered generatively: all declared constructors, EventBus subscribers.
    const extra = Object.keys(entry).filter((k) => !["type", "methods"].includes(k));
    const methods = (entry.methods ?? []).filter((m) => m.name !== "<init>" && !subscribers.has(`${type}#${m.name}`));
    // Network play is left out of the module on purpose (gen-reflection-config.mjs); a local game must not reach it.
    if (kind !== "reflection" || extra.length > 0 || methods.length > 0 || type.startsWith("forge.gamemodes.net.")) {
      unexpected.push(`${kind}: ${JSON.stringify(entry)}`);
    }
    return false;
  });
}
if (unexpected.length > 0) {
  console.error("[openmana-engine] FEHLER: Forge greift reflektiv auf mehr zu, als gen-reflection-config.mjs registriert:\n  " + unexpected.join("\n  "));
  process.exit(1);
}
fs.writeFileSync(target, JSON.stringify(metadata, null, 2) + "\n");
' "$out/reachability-metadata.json" "$OM_ENGINE_DIR/wasm/config/agent/reachability-metadata.json" "$out/subscribers.jsonl"
om_log "Metadaten aktualisiert (ohne Forge-Klassen). Diff pruefen: git diff engine/wasm/config/agent"
