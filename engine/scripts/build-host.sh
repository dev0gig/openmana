#!/usr/bin/env bash
# The TypeScript side of the engine: protocol (schema, generated types and
# validators, input queue), client, worker host. Fast (seconds), so build.sh
# runs it first and a broken contract fails before the ~5 min Forge build.
#
#   1. npm ci if node_modules is missing or older than package-lock.json
#   2. generated protocol files must match the schema (a schema change
#      without `npm run generate` fails here)
#   3. tsc --noEmit (strict)
#   4. unit tests: protocol, client, worker host (node:test)
#   5. bundles: build/dist/engine-worker.js (browser worker host, part of the
#      engine artefacts) and build/harness/spike.js (diagnostics page)
#   6. if a complete engine build exists (same Forge data as build/resources):
#      refresh engine-manifest.json (worker entry)
source "$(dirname "$0")/lib.sh"

om_require_node_typescript
cd "$OM_ENGINE_DIR"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    om_log "npm ci (engine/package-lock.json)"
    npm ci --no-audit --no-fund
fi
om_log "Protokoll: erzeugte Dateien gegen das Schema pruefen"
npm run --silent check:generated
om_log "TypeScript pruefen (strict)"
npm run --silent typecheck
om_log "Unit-Tests: Protokoll, Client, Worker-Host"
mkdir -p "$OM_REPORT_DIR"
node --test --test-reporter=spec --test-reporter-destination=stdout \
    --test-reporter=junit --test-reporter-destination="$OM_REPORT_DIR/unit-tests.xml" \
    "protocol/test/**/*.test.ts" "client/test/**/*.test.ts" "wasm/test/**/*.test.ts" \
    2>&1 | tee "$OM_REPORT_DIR/unit-tests.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || om_die "Unit-Tests fehlgeschlagen, siehe $OM_REPORT_DIR/unit-tests.log"
node scripts/bundle-host.mjs
if [ -f "$OM_DIST_DIR/openmana-engine.js.wasm" ] && [ -f "$OM_REPORT_DIR/image-classes.json" ] \
    && [ -f "$OM_REPORT_DIR/forge-source.json" ] && [ -f "$OM_REPORT_DIR/native-image.log" ] \
    && cmp -s "$OM_DIST_DIR/forge-res.inventory.json" "$OM_BUILD_DIR/resources/forge-res.inventory.json"; then
    node scripts/write-manifest.mjs "$OM_DIST_DIR" "$OM_REPORT_DIR" "$OM_BUILD_DIR/resources/forge-res.manifest.json"
elif [ -f "$OM_DIST_DIR/openmana-engine.js.wasm" ]; then
    om_log "engine-manifest.json nicht aufgefrischt: build/dist stammt aus einem anderen Build (build.sh baut alles neu)"
fi
om_log "Host/Protokoll fertig"
