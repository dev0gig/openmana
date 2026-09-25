#!/usr/bin/env bash
# The AI profile study of prompt 12 (JVM only, not part of build.sh or
# test-engine.sh): what Forge's AI profiles (res/ai/*.ai) change in how its AI
# plays. Plays the plan engine/fixtures/ai-profile-study.json - every deck as a
# mirror match, every non-default profile against Default in both seat orders
# per seed, Default against Default as the control - in parallel JVMs, then
# summarises win rates (with 95 % intervals and a paired sign test per seed)
# and what each profile did (attacks, blocks, spells, counterspells, mulligans).
#
#   bash engine/scripts/ai-profile-study.sh [plan.json]
#
# Needs the JVM build (build.sh or build-jvm.sh). Results:
# engine/build/report/ai-profiles/ (games.jsonl, summary.json, summary.md).
# OPENMANA_STUDY_SHARDS (default 4) JVMs run at once, each with up to 1.8 GB
# heap; the study with the default plan (2400 games) takes about 15 minutes on
# a 12-thread desktop CPU. Conclusions: docs/research/AI_PROFILES.md.
source "$(dirname "$0")/lib.sh"

om_require_node
om_use_toolchain
jar="$OM_BUILD_DIR/jvm/openmana-engine-jvm.jar"
bundle="$OM_BUILD_DIR/resources/forge-res.bin"
[ -f "$jar" ] && [ -f "$bundle" ] || om_die "Kein JVM-Build. Zuerst engine/scripts/build.sh (oder build-jvm.sh) ausfuehren."
plan="${1:-$OM_ENGINE_DIR/fixtures/ai-profile-study.json}"
[ -f "$plan" ] || om_die "Studienplan fehlt: $plan"
shards="${OPENMANA_STUDY_SHARDS:-4}"
out="$OM_REPORT_DIR/ai-profiles"
rm -rf "$out"
mkdir -p "$out"
# The JVMs read classes from the JAR while they run: a rebuild meanwhile must
# not change it under them.
cp "$jar" "$out/study.jar"

om_log "KI-Profil-Studie: $plan, $shards JVMs"
pids=()
for ((i = 0; i < shards; i++)); do
    java -Xmx1800m -cp "$out/study.jar" org.openmana.engine.jvm.JvmAiProfileStudyMain \
        --bundle "$bundle" --plan "$plan" --decks "$OM_ENGINE_DIR/fixtures/decks" \
        --shard "$i/$shards" --out "$out/games-$i.jsonl" > "$out/shard-$i.log" 2>&1 &
    pids+=("$!")
done
failed=0
for ((i = 0; i < shards; i++)); do
    wait "${pids[$i]}" || { failed=1; om_log "Shard $i fehlgeschlagen, siehe $out/shard-$i.log"; }
done
rm -f "$out/study.jar"
[ "$failed" -eq 0 ] || om_die "KI-Profil-Studie fehlgeschlagen."

cat "$out"/games-*.jsonl > "$out/games.jsonl"
node "$OM_ENGINE_DIR/scripts/ai-profile-summary.mjs" "$plan" "$out/games.jsonl" "$out/summary.json" > "$out/summary.md"
om_log "KI-Profil-Studie fertig: $out/summary.md"
