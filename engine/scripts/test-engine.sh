#!/usr/bin/env bash
# Engine spike tests against the artefacts of build.sh:
#
#   1. JVM reference: the smoke game on the JVM, fresh process per game
#   2. Wasm in Node (worker_threads): same seeds, game log hash must equal the JVM
#   3. Wasm in Chrome (Dedicated Worker, COOP/COEP): same check
#   4. Chrome without COOP/COEP: the page must fail visibly and fast
#
# Scenarios: seed 42 (lazy and eager card loading) and seed 7 (lazy).
# Results: engine/build/report/test-report.json and one JSON file per run.
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
rm -rf "$runs"
mkdir -p "$runs"
failures=0

jvm_run() {
    local seed="$1" mode="$2" out="$runs/jvm-$2-$1.json"
    node "$OM_ENGINE_DIR/scripts/measure.mjs" "jvm-$mode-$seed" "$runs/measure.jsonl" -- \
        java -jar "$jar" --bundle "$bundle" --seed "$seed" --card-loading "$mode" \
        > "$runs/jvm-$mode-$seed.log" 2>&1 || { om_log "JVM-Lauf $mode/$seed fehlgeschlagen"; failures=$((failures + 1)); return; }
    grep '^OPENMANA-RESULT:' "$runs/jvm-$mode-$seed.log" | sed 's/^OPENMANA-RESULT://' > "$out"
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

om_log "2/4 Wasm in Node"
wasm_run node 42 lazy
wasm_run node 42 eager
wasm_run node 7 lazy

if [ "${OPENMANA_SKIP_BROWSER:-0}" != "1" ]; then
    om_log "3/4 Wasm in Chrome"
    wasm_run browser 42 lazy
    wasm_run browser 42 eager
    wasm_run browser 7 lazy
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
