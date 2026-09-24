#!/usr/bin/env bash
# Engine tests against the artefacts of build.sh (the unit tests of protocol,
# client and worker host and the JVM bridge tests already ran in build.sh):
#
#   1. JVM reference: the AI smoke game, fresh process per game; five
#      human-vs-AI games played by the scripted human, whose inputs are
#      recorded as transcripts and whose every message is checked against the
#      protocol schema (validate-messages.ts); the card probe (lazy, eager,
#      German), compared with each other (check-card-probes.ts)
#   2. Wasm in Node (worker_threads, the same worker host as the browser):
#      the AI games (game log hash must equal the JVM); every transcript
#      replayed through the EngineClient and the SharedArrayBuffer input
#      queue, once lazily (client and engine must judge every input alike) and
#      once eagerly with a 256-byte queue (wrap-around, full queue); the game
#      must end exactly as on the JVM; the protocol's failure paths against
#      the real engine (node-protocol.ts); the card probe, equal to the JVM's
#   3. Wasm in Chrome (Dedicated Worker, COOP/COEP): the same games and card
#      probes through the diagnostics page, plus a protocol version mismatch
#   4. Chrome without COOP/COEP: the page must fail visibly and fast
#
# AI scenarios: seed 42 (lazy and eager card loading, and in German) and
# seed 7 (lazy). Human scenarios (the games of HumanMatchTest): seeds 3 and 11
# played to the end, seed 5 with a player that never attacks and blocks, seed 3
# again with the player conceding in turn 3, and seed 3 in German (it must be
# the same game as in English: the language changes Forge's texts, not the
# game).
# Results: engine/build/report/test-report.json and one JSON file per run;
# transcripts and message logs in engine/build/report/transcripts/.
# Exit code != 0 if anything fails. Set OPENMANA_SKIP_BROWSER=1 to leave out
# the Chrome runs (e.g. on a machine without Chrome).
source "$(dirname "$0")/lib.sh"

om_require_node_typescript
om_use_toolchain
jar="$OM_BUILD_DIR/jvm/openmana-engine-jvm.jar"
bundle="$OM_BUILD_DIR/resources/forge-res.bin"
[ -f "$jar" ] && [ -f "$OM_DIST_DIR/openmana-engine.js.wasm" ] || om_die "Keine Build-Artefakte. Zuerst engine/scripts/build.sh ausfuehren."
[ -f "$OM_DIST_DIR/engine-worker.js" ] && [ -f "$OM_BUILD_DIR/harness/spike.js" ] || om_die "Kein Worker-Bundle. Zuerst engine/scripts/build-host.sh (oder build.sh) ausfuehren."
[ -d "$OM_ENGINE_DIR/node_modules/playwright-core" ] || (cd "$OM_ENGINE_DIR" && npm ci --no-audit --no-fund)

runs="$OM_REPORT_DIR/runs"
transcripts="$OM_REPORT_DIR/transcripts"
rm -rf "$runs" "$transcripts"
mkdir -p "$runs" "$transcripts"
failures=0
tests="$OM_ENGINE_DIR/wasm/test"
# name:seed[:options of JvmHumanMatchMain, comma-separated]
HUMAN_SCENARIOS="3:3 11:11 5-defend:5:--defending 3-concede:3:--concede-in-turn,3 3-de:3:--language,de-DE"

# Suffix of run names for a language other than English: jvm-lazy-42-de-DE.
lang_suffix() {
    [ "${1:-en-US}" = "en-US" ] || printf -- '-%s' "$1"
}

jvm_run() {
    local seed="$1" mode="$2" language="${3:-en-US}" name
    name="jvm-$mode-$seed$(lang_suffix "$language")"
    node "$OM_ENGINE_DIR/scripts/measure.mjs" "$name" "$runs/measure.jsonl" -- \
        java -jar "$jar" --bundle "$bundle" --seed "$seed" --card-loading "$mode" --language "$language" \
        > "$runs/$name.log" 2>&1 || { om_log "JVM-Lauf $mode/$seed/$language fehlgeschlagen"; failures=$((failures + 1)); return; }
    grep '^OPENMANA-RESULT:' "$runs/$name.log" | sed 's/^OPENMANA-RESULT://' > "$runs/$name.json"
}

# The card probe (bridge CardProbe) on the JVM: the reference for the Wasm probes.
jvm_cards_run() {
    local mode="$1" language="${2:-en-US}" name
    name="jvm-cards-$mode$(lang_suffix "$language")"
    node "$OM_ENGINE_DIR/scripts/measure.mjs" "$name" "$runs/measure.jsonl" -- \
        java -cp "$jar" org.openmana.engine.jvm.JvmCardProbeMain --bundle "$bundle" --card-loading "$mode" --language "$language" \
        > "$runs/$name.log" 2>&1 || { om_log "JVM-Kartenpruefung $mode/$language fehlgeschlagen"; failures=$((failures + 1)); return; }
    grep '^OPENMANA-RESULT:' "$runs/$name.log" | sed 's/^OPENMANA-RESULT://' > "$runs/$name.json"
}

# Human vs AI on the JVM with the scripted human; writes the input transcript
# and every message the bridge emitted.
jvm_human_run() {
    local name="$1" seed="$2" options="${3:-}" extra=()
    [ -n "$options" ] && IFS=, read -r -a extra <<< "$options"
    node "$OM_ENGINE_DIR/scripts/measure.mjs" "jvm-human-$name" "$runs/measure.jsonl" -- \
        java -cp "$jar" org.openmana.engine.jvm.JvmHumanMatchMain --bundle "$bundle" --seed "$seed" "${extra[@]}" \
        --out "$transcripts/human-$name.json" --messages "$transcripts/human-$name.messages.jsonl" \
        > "$runs/jvm-human-$name.log" 2>&1 || { om_log "JVM-Mensch-Partie $name fehlgeschlagen"; failures=$((failures + 1)); return; }
    grep '^OPENMANA-RESULT:' "$runs/jvm-human-$name.log" | sed 's/^OPENMANA-RESULT://' > "$runs/jvm-human-$name.json"
}

# Replays a transcript in Wasm: node-replay.ts (Node) or browser-smoke.mjs --transcript (Chrome).
replay_run() {
    local where="$1" name="$2" feeding="$3" language="${4:-en-US}" script
    [ -f "$transcripts/human-$name.json" ] || { om_log "$where-Wiederholung $name: keine Aufzeichnung"; failures=$((failures + 1)); return; }
    if [ "$where" = node ]; then script="node-replay.ts"; else script="browser-smoke.mjs"; fi
    node "$tests/$script" --transcript "$transcripts/human-$name.json" --feeding "$feeding" --language "$language" \
        --out "$runs/$where-replay-$feeding-$name.json" > "$runs/$where-replay-$feeding-$name.log" 2>&1 \
        || { om_log "$where-Wiederholung $name ($feeding) fehlgeschlagen (siehe $runs/$where-replay-$feeding-$name.log)"; failures=$((failures + 1)); }
}

# The English human scenarios (the German one is replayed on its own below).
human_names() {
    local scenario
    for scenario in $HUMAN_SCENARIOS; do
        case "$scenario" in *--language*) ;; *) echo "${scenario%%:*}" ;; esac
    done
}

jvm_sha() {
    node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.logSha256)' "$runs/jvm-$1-$2$(lang_suffix "${3:-en-US}").json"
}

wasm_ai_run() {
    local where="$1" seed="$2" mode="$3" language="${4:-en-US}" expected script name
    expected="$(jvm_sha "$mode" "$seed" "$language")"
    name="$where-ai-$mode-$seed$(lang_suffix "$language")"
    if [ "$where" = node ]; then script="node-ai.ts"; else script="browser-smoke.mjs"; fi
    node "$tests/$script" --seed "$seed" --card-loading "$mode" --language "$language" \
        --expect-log-sha256 "$expected" --out "$runs/$name.json" \
        > "$runs/$name.log" 2>&1 \
        || { om_log "$where-KI-Partie $mode/$seed/$language fehlgeschlagen (siehe $runs/$name.log)"; failures=$((failures + 1)); }
}

# The card probe in Wasm (node-cards.ts or browser-smoke.mjs --cards); must equal the JVM probe.
wasm_cards_run() {
    local where="$1" mode="$2" language="${3:-en-US}" name expect
    name="$where-cards-$mode$(lang_suffix "$language")"
    expect="$runs/jvm-cards-$mode$(lang_suffix "$language").json"
    [ -s "$expect" ] || { om_log "$where-Kartenpruefung $mode/$language: keine JVM-Referenz"; failures=$((failures + 1)); return; }
    if [ "$where" = node ]; then
        node "$tests/node-cards.ts" --card-loading "$mode" --language "$language" --expect "$expect" --out "$runs/$name.json" > "$runs/$name.log" 2>&1
    else
        node "$tests/browser-smoke.mjs" --cards --card-loading "$mode" --language "$language" --expect "$expect" --out "$runs/$name.json" > "$runs/$name.log" 2>&1
    fi || { om_log "$where-Kartenpruefung $mode/$language fehlgeschlagen (siehe $runs/$name.log)"; failures=$((failures + 1)); }
}

# The same game in another language: same turns, result and board, other texts.
same_game_other_language() {
    local english="$1" other="$2" label="$3"
    node -e '
const fs = require("fs");
const [a, b] = process.argv.slice(1).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
// AI runs print {boot, result}; human runs print the match summary itself (whose "result" is win/loss/draw).
const unwrap = (r) => (r.result !== null && typeof r.result === "object" ? r.result : r);
const ra = unwrap(a), rb = unwrap(b);
const shape = (r) => JSON.stringify({ turns: r.turns, winner: r.winner, result: r.result ?? null, draw: r.draw ?? null, inputs: r.inputs ?? null, logEntries: r.logEntries,
  players: (r.players ?? []).map((p) => ({ life: p.life, library: p.library, hand: p.hand, battlefield: p.battlefield, graveyard: p.graveyard })) });
if (shape(ra) !== shape(rb)) { console.error("not the same game: " + shape(ra) + " / " + shape(rb)); process.exit(1); }
if (ra.logSha256 === rb.logSha256) { console.error("the game log did not change with the language: " + ra.logSha256); process.exit(1); }
' "$english" "$other" > "$runs/same-game-$label.log" 2>&1 \
        || { om_log "Sprache aendert die Partie ($label, siehe $runs/same-game-$label.log)"; failures=$((failures + 1)); }
}

om_log "1/4 JVM-Referenz"
jvm_run 42 lazy
jvm_run 42 eager
jvm_run 7 lazy
jvm_run 42 lazy de-DE
[ "$(jvm_sha lazy 42)" = "$(jvm_sha eager 42)" ] || { om_log "JVM: lazy und eager spielen verschiedene Partien"; failures=$((failures + 1)); }
same_game_other_language "$runs/jvm-lazy-42.json" "$runs/jvm-lazy-42-de-DE.json" ai-42
for scenario in $HUMAN_SCENARIOS; do
    IFS=: read -r name seed options <<< "$scenario"
    jvm_human_run "$name" "$seed" "$options"
done
same_game_other_language "$runs/jvm-human-3.json" "$runs/jvm-human-3-de.json" human-3
node "$tests/validate-messages.ts" "$transcripts"/*.messages.jsonl --out "$runs/jvm-messages-schema.json" \
    > "$runs/jvm-messages-schema.log" 2>&1 \
    || { om_log "JVM-Nachrichten verletzen das Protokoll (siehe $runs/jvm-messages-schema.json)"; failures=$((failures + 1)); }
jvm_cards_run lazy
jvm_cards_run eager
jvm_cards_run lazy de-DE
node "$tests/check-card-probes.ts" --lazy "$runs/jvm-cards-lazy.json" --eager "$runs/jvm-cards-eager.json" \
    --german "$runs/jvm-cards-lazy-de-DE.json" --out "$runs/jvm-cards-check.json" > "$runs/jvm-cards-check.log" 2>&1 \
    || { om_log "JVM-Kartenpruefungen passen nicht zusammen (siehe $runs/jvm-cards-check.json)"; failures=$((failures + 1)); }

om_log "2/4 Wasm in Node"
wasm_ai_run node 42 lazy
wasm_ai_run node 42 eager
wasm_ai_run node 7 lazy
wasm_ai_run node 42 lazy de-DE
for name in $(human_names); do replay_run node "$name" lazy; done
for name in $(human_names); do replay_run node "$name" eager; done
replay_run node 3-de lazy de-DE
wasm_cards_run node lazy
wasm_cards_run node eager
wasm_cards_run node lazy de-DE
node "$tests/node-protocol.ts" --transcript "$transcripts/human-3-concede.json" --out "$runs/node-protocol.json" \
    > "$runs/node-protocol.log" 2>&1 || { om_log "Protokoll-Szenarien in Node fehlgeschlagen (siehe $runs/node-protocol.log)"; failures=$((failures + 1)); }

if [ "${OPENMANA_SKIP_BROWSER:-0}" != "1" ]; then
    om_log "3/4 Wasm in Chrome"
    wasm_ai_run browser 42 lazy
    wasm_ai_run browser 42 eager
    wasm_ai_run browser 7 lazy
    wasm_ai_run browser 42 lazy de-DE
    for name in $(human_names); do replay_run browser "$name" lazy; done
    for name in 3 11; do replay_run browser "$name" eager; done
    wasm_cards_run browser lazy
    wasm_cards_run browser eager
    node "$tests/browser-smoke.mjs" --announce-protocol 999 --out "$runs/browser-protocol-mismatch.json" \
        > "$runs/browser-protocol-mismatch.log" 2>&1 || { om_log "Versionskonflikt im Browser nicht laut abgewiesen"; failures=$((failures + 1)); }
    om_log "4/4 Chrome ohne COOP/COEP"
    node "$tests/browser-smoke.mjs" --negative --out "$runs/browser-negative.json" \
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
