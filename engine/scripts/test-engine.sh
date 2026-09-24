#!/usr/bin/env bash
# Engine spike tests against the artefacts of build.sh:
#
#   1. JVM reference: the AI smoke game (prompt 01), fresh process per game;
#      and two human-vs-AI games (prompt 02) played by the scripted human,
#      whose inputs are recorded as transcripts
#   2. Wasm in Node (worker_threads): the AI games (game log hash must equal
#      the JVM) and the transcripts replayed through the SharedArrayBuffer
#      input channel (the game must end exactly as on the JVM)
#   3. Wasm in Chrome (Dedicated Worker, COOP/COEP): the same
#   4. Chrome without COOP/COEP: the page must fail visibly and fast
#
# AI scenarios: seed 42 (lazy and eager card loading) and seed 7 (lazy).
# Human scenarios (the games of HumanMatchTest): seeds 3 and 11 played to the
# end, seed 5 with a player that never attacks and blocks, and seed 3 again
# with the player conceding in turn 3.
# Results: engine/build/report/test-report.json and one JSON file per run;
# the transcripts in engine/build/report/transcripts/.
# Exit code != 0 if anything fails. Set OPENMANA_SKIP_BROWSER=1 to leave out
# the Chrome runs (e.g. on a machine without Chrome).
source "$(dirname "$0")/lib.sh"

om_require_node
om_use_toolchain
jar="$OM_BUILD_DIR/jvm/openmana-engine-jvm.jar"
bundle="$OM_BUILD_DIR/resources/forge-res.bin"
[ -f "$jar" ] && [ -f "$OM_DIST_DIR/openmana-engine.js.wasm" ] || om_die "Keine Build-Artefakte. Zuerst engine/scripts/build.sh ausfuehren."
[ -d "$OM_ENGINE_DIR/wasm/node_modules/playwright-core" ] || (cd "$OM_ENGINE_DIR/wasm" && npm ci --no-audit --no-fund)

runs="$OM_REPORT_DIR/runs"
transcripts="$OM_REPORT_DIR/transcripts"
rm -rf "$runs" "$transcripts"
mkdir -p "$runs" "$transcripts"
failures=0
# name:seed[:options of JvmHumanMatchMain, comma-separated]
HUMAN_SCENARIOS="3:3 11:11 5-defend:5:--defending 3-concede:3:--concede-in-turn,3"

jvm_run() {
    local seed="$1" mode="$2" out="$runs/jvm-$2-$1.json"
    node "$OM_ENGINE_DIR/scripts/measure.mjs" "jvm-$mode-$seed" "$runs/measure.jsonl" -- \
        java -jar "$jar" --bundle "$bundle" --seed "$seed" --card-loading "$mode" \
        > "$runs/jvm-$mode-$seed.log" 2>&1 || { om_log "JVM-Lauf $mode/$seed fehlgeschlagen"; failures=$((failures + 1)); return; }
    grep '^OPENMANA-RESULT:' "$runs/jvm-$mode-$seed.log" | sed 's/^OPENMANA-RESULT://' > "$out"
}

# Human vs AI on the JVM with the scripted human; writes the input transcript.
jvm_human_run() {
    local name="$1" seed="$2" options="${3:-}" extra=()
    [ -n "$options" ] && IFS=, read -r -a extra <<< "$options"
    node "$OM_ENGINE_DIR/scripts/measure.mjs" "jvm-human-$name" "$runs/measure.jsonl" -- \
        java -cp "$jar" org.openmana.engine.jvm.JvmHumanMatchMain --bundle "$bundle" --seed "$seed" "${extra[@]}" \
        --out "$transcripts/human-$name.json" \
        > "$runs/jvm-human-$name.log" 2>&1 || { om_log "JVM-Mensch-Partie $name fehlgeschlagen"; failures=$((failures + 1)); return; }
    grep '^OPENMANA-RESULT:' "$runs/jvm-human-$name.log" | sed 's/^OPENMANA-RESULT://' > "$runs/jvm-human-$name.json"
}

# Replays a transcript in Wasm: node-replay.mjs (Node) or browser-smoke.mjs --transcript (Chrome).
replay_run() {
    local where="$1" name="$2" script
    [ -f "$transcripts/human-$name.json" ] || { om_log "$where-Wiederholung $name: keine Aufzeichnung"; failures=$((failures + 1)); return; }
    if [ "$where" = node ]; then script="node-replay.mjs"; else script="browser-smoke.mjs"; fi
    node "$OM_ENGINE_DIR/wasm/test/$script" --transcript "$transcripts/human-$name.json" \
        --out "$runs/$where-replay-$name.json" > "$runs/$where-replay-$name.log" 2>&1 \
        || { om_log "$where-Wiederholung $name fehlgeschlagen (siehe $runs/$where-replay-$name.log)"; failures=$((failures + 1)); }
}

human_names() {
    local scenario
    for scenario in $HUMAN_SCENARIOS; do echo "${scenario%%:*}"; done
}

jvm_sha() {
    node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.logSha256)' "$runs/jvm-$1-$2.json"
}

wasm_run() {
    local where="$1" seed="$2" mode="$3" expected
    expected="$(jvm_sha "$mode" "$seed")"
    node "$OM_ENGINE_DIR/wasm/test/$where-smoke.mjs" --seed "$seed" --card-loading "$mode" \
        --expect-log-sha256 "$expected" --out "$runs/$where-$mode-$seed.json" \
        > "$runs/$where-$mode-$seed.log" 2>&1 \
        || { om_log "$where-Lauf $mode/$seed fehlgeschlagen (siehe $runs/$where-$mode-$seed.log)"; failures=$((failures + 1)); }
}

om_log "1/4 JVM-Referenz"
jvm_run 42 lazy
jvm_run 42 eager
jvm_run 7 lazy
[ "$(jvm_sha lazy 42)" = "$(jvm_sha eager 42)" ] || { om_log "JVM: lazy und eager spielen verschiedene Partien"; failures=$((failures + 1)); }
for scenario in $HUMAN_SCENARIOS; do
    IFS=: read -r name seed options <<< "$scenario"
    jvm_human_run "$name" "$seed" "$options"
done

om_log "2/4 Wasm in Node"
wasm_run node 42 lazy
wasm_run node 42 eager
wasm_run node 7 lazy
for name in $(human_names); do replay_run node "$name"; done

if [ "${OPENMANA_SKIP_BROWSER:-0}" != "1" ]; then
    om_log "3/4 Wasm in Chrome"
    wasm_run browser 42 lazy
    wasm_run browser 42 eager
    wasm_run browser 7 lazy
    for name in $(human_names); do replay_run browser "$name"; done
    om_log "4/4 Chrome ohne COOP/COEP"
    node "$OM_ENGINE_DIR/wasm/test/browser-smoke.mjs" --negative --out "$runs/browser-negative.json" \
        > "$runs/browser-negative.log" 2>&1 || { om_log "Negativtest fehlgeschlagen"; failures=$((failures + 1)); }
else
    om_log "Chrome-Laeufe uebersprungen (OPENMANA_SKIP_BROWSER=1)"
fi

# Forge logs through tinylog. If tinylog cannot find its writers (as with an
# unmerged META-INF/services file), Forge's own error messages vanish.
if grep -l 'LOGGER ERROR' "$runs"/*.log >/dev/null 2>&1; then
    om_log "tinylog meldet Fehler (Forge-Logausgaben gehen verloren): $(grep -l 'LOGGER ERROR' "$runs"/*.log | tr '\n' ' ')"
    failures=$((failures + 1))
fi

node -e '
const fs = require("fs"); const path = require("path");
const dir = process.argv[1];
const runs = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) runs[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const measure = fs.existsSync(dir + "/measure.jsonl") ? fs.readFileSync(dir + "/measure.jsonl", "utf8").trim().split("\n").map(JSON.parse) : [];
fs.writeFileSync(path.join(dir, "..", "test-report.json"), JSON.stringify({ failures: +process.argv[2], runs, jvmProcesses: measure }, null, 2) + "\n");
' "$runs" "$failures"

[ "$failures" -eq 0 ] || om_die "$failures Engine-Test(s) fehlgeschlagen, Details in $runs"
om_log "Alle Engine-Tests bestanden. Bericht: $OM_REPORT_DIR/test-report.json"
