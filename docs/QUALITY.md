# Regression quality

`npm run test:regression` is the complete, sequential acceptance entry. It
requires the current artifact lock and its original successful build evidence,
then runs new tests on the selected Forge revision. No deployment is needed.
`npm run check` remains the complete application check, but alone does not run
the JVM/Node/Chrome engine differential suite.

## Complete command

From the repository root, with Node >=22.18, installed app/engine dependencies,
Chrome for Testing and the pinned engine toolchain:

```bash
OPENMANA_ENGINE_BUILD_DIR=engine/build/parity-30-accepted \
OPENMANA_TOOLCHAIN_DIR="$PWD/engine/build/parity-30-accepted/toolchain" \
OPENMANA_CARDS_DIR=engine/build/parity-30-accepted/catalog \
NODE_OPTIONS=--max-old-space-size=2048 \
JDK_JAVA_OPTIONS=-Xmx512m MAVEN_OPTS=-Xmx768m \
npm run test:regression -- --out reports/regression/my-new-run
```

Choose the current locked build and its matching catalog, not an arbitrary old
directory. The example is the accepted protocol-8 Prompt30 build. Missing artifacts,
changed source inputs or a catalog with the wrong Forge/schema version fail.
Use `engine/UPDATING.md` for an actual engine update; this command does not
change a pin, rebuild WASM or promote a lock. `OPENMANA_CHROME` may select the
real Chrome executable. Without `--out`, a new timestamped directory is used.

The runner verifies the build's provenance, copies verified WASM/resources into
its own directory, prepares fresh pinned/patched Forge and bridge sources,
builds/tests the JVM bridge, runs engine generation/typecheck/unit tests and
all differential scenarios, then runs the entire `npm run check` (schema,
typecheck, lint, unit/component tests, production build, full Chrome app suite,
full production PWA suite). Each phase is awaited before the next starts.
The original locked reports and artifacts are preserved. Temporary browser
files and this run's copied/compiled artifacts are removed on normal success
or failure; raw logs, traces, original JVM XMLs and screenshots remain.

Run one complete acceptance at a time in a checkout: the existing app/PWA
tests use shared `dist/` and `reports/e2e/`, `reports/pwa/` outputs. The full
runner archives those browser outputs into its own report directory. A prior
report directory is never overwritten, even if it failed. An interruption is
not a passing result; inspect the last completed phase and start a fresh run.

Success requires exit 0 and `report.json` status `passed`. Each phase records
its real command, exit/signal and log SHA-256. Final coverage binds engine
results to the manifest hash, demands every declared JVM fixture and every
declared Node/Chrome feeding, observed mandatory trace coverage, terminal game
checkpoints, the complete browser sections, all eight viewports, max1 workers,
zero accessibility violations and actual server-stopped/cache-cleared offline
evidence. Browser skips, omitted assets and focused/no-build flags cannot
earn full acceptance. Engine rejection, protocol divergence, timed-out Forge
available-action checks and unsupported behavior fail rather than fall back.

## Coverage matrix

| Area | Automated tests and real integration | Failure/boundary coverage |
| --- | --- | --- |
| IndexedDB and backups | `src/storage/*.test.*`; full Chrome local-data, second-profile backup round trip/reload | Atomic rollback, migrations/newer schemas, quota, corruption, invalid backup, cross-tab upgrade, cleared data; quota override limits documented |
| Scryfall/catalog/pictures | `src/cards/*.test.*`, `cards/**/*.test.ts`; real catalog install and API/images under COEP | SHA/size failure, interruption, rate limit/429 pause, ambiguous identities, DE→EN, DFC back, missing/CORS/offline pictures; catalog never decides rules |
| Arena and deck library | `src/decks/*.test.*`; English/German/Commander file/paste imports, library and real Forge validation of saved names | Unresolved lines, ambiguous translation, bad syntax, no silent omission, unknown Forge card, deletion races/tombstones, explicit replacement |
| Protocol/queue/worker | `engine/protocol/test`, `engine/client/test`, `engine/wasm/test/worker-host.test.ts`; actual Node/Chrome transport | Version/schema/sequence mismatch, stale/withdrawn questions, disabled input, bounded SAB wrap/full queue, ready timeout/stall, worker abort |
| Forge bridge/JVM/WASM | Fresh Maven bridge tests; `engine/scripts/test-engine.sh` on JVM, Node and Chrome; every declared feeding | Trace equality entry by entry, altered-trace negative tests, invalid deck then real retry, engine logging, no timed-out APINA; all scripts and layouts probed |
| Complete games/AI/formats | Fifteen trace fixtures; Constructed natural wins/losses, legal 100-card Commander win/tax/return/damage, concession; AI-vs-AI fixed seeds | Each fixture's promised coverage must actually occur; German/lazy variants match the same trace; incomplete game/absent replay fails |
| Decisions | JVM `AnswersTest`/`DecisionParityTest`/`ProtocolContractTest`, `decision-model`/`decision-panel` tests, full eight-size table checks | Buttons, yes/no, confirm, options, multi-choice, select, numeric/text input, order, arrange and distribution; bounds, arming, withdrawn/live questions, blocking |
| Priority/stack/targets/payment | `priority`, card interaction/view/use tests; `priority-respond`, `stack-response`, `targets-payment` real games/scenes | Response on opponent's turn, stack targets/order/resolution, nested X/kicker/sacrifice, card/player/multi-target, floating mana/life/manual/automatic costs; no UI legality inference |
| Attack/block/combat | `attack`/`block` tests; `attackers`, `blocks-multi`, `blocks-double`, `parity-trample` real games and table interactions | Selected defender/planeswalker, Alpha Strike/Call Back, sick/tapped/restricted attackers, per-attacker blockers, double block, order and damage distribution |
| Zones/full viewer | `card-view`, table/catalog tests; full table zones/DFC/piles at mobile and desktop sizes | Hidden identities stay hidden; current IDs/question sources, withdrawn cards, safe navigation, catalog-only side inspection, live rearming, replay read-only |
| Session/recording/history/replay | `engine-session`, `recording`, `history` tests; real Chrome playing/conceding sessions and original recordings; portable JSON round trip | Refused start/retry, max1 lifecycle, accepted input envelopes, terminal original Forge result, storage failures, retention/conflicts/corrupt/old protocol; replay sends no input |
| PWA/offline/update | `vite/pwa`, `src/pwa` tests; `scripts/e2e/pwa.ts`, actual CacheStorage/IndexedDB/Forge | Equal-length corrupted bytes, interrupted download, failed shell/initial install, retry, native waiting update while real game/question lives, data/recording retained, eviction; HTTP cache cleared, network off and server stopped |
| Browser features | Engine feature/client tests; `scripts/regression/browser-features.test.ts`; real Chrome positive and missing-isolation negative | Each required capability including GC/exnref/typed refs independently absent; no worker/download before unsupported-browser abort; no UA whitelist |
| Responsive/accessibility/ORYX web | Complete Chrome route/populated-state/table suite across eight CSS viewports, keyboard/touch/arming; ORYX navigation/local data/network DAL | No axe violations, 44px coarse targets and bounded table; live resize does not change original transcript; direct start, same-tab return/Back and retained records |
| Acceptance itself | `scripts/regression/evidence.test.ts`, `run.test.ts`, `assets.test.ts` | Mutated reports reject missing games/coverage/families, foreign builds, skipped Chrome, partial UI, concurrent workers, replay input, masked offline and lost recording; prior failures retained |

The engine trace contract currently requires 45 observed paths. Fifteen
fixtures include three language/loading variants; these are not fifteen
independent mechanics or proof of every Magic card. UI tests cover all generic
decision families; confirm/input/order/reveal/choose-many/select-outside and
block-order, arrange-anywhere and distribute-limits scenes are explicitly constructed boundaries where the recorded
games do not supply them. Constructed scenes never count as real Forge traces.
The eight viewports are CSS/touch emulation, including fold-like dimensions,
not physical devices. ORYX cloud/launcher test services are controlled stand-ins.

`scripts/regression/fixtures/*.json` are reduced historical engine26/browser28
report samples for acceptance-validator mutation tests. Their original
measurements are preserved, together with the explicit historical requirements
used to check their report shapes. Tests reject those samples against current
parity requirements. They are never used by the full runner as evidence
of the current execution. Unit tests use fake IndexedDB/workers where labelled;
the separate real suites establish the integration behavior.

## Focused developer checks

```bash
VITEST_MAX_WORKERS=1 npm test -- scripts/regression src/storage src/cards src/decks
npm --prefix engine run check:generated
npm --prefix engine run typecheck
npm --prefix engine run test:unit
npm run test:e2e -- --no-build --zones-only
npm run test:e2e -- --no-build --combat-only
npm run test:e2e -- --no-build --replay-only
npm run test:oryx -- --no-build
npm run test:pwa -- --no-build
```

Select verified `OPENMANA_ENGINE_DIR`/`OPENMANA_CARDS_DIR` for browser commands
as documented in `engine/UPDATING.md`. Focused commands do not replace a full
regression. Network Scryfall checks need API/image availability; failed live
requests are not silently converted into passing stand-in results.

## Publication gates remain open

The project owner explicitly deferred physical Android/ORYX acceptance until authorized
publication (2026-10-07). It is **not performed or passed**. Complete the real
device/trust/provider/Forge/data/navigation/touch/background/offline checklist
in `docs/implementation/28-oryx-web-android.md` before closing central Prompt31;
Prompt32 must inspect that evidence. A successful local automated regression
does not release this gate, the legal/source/icon gates from Prompt27, or the
publication hold. No push, deployment, redeploy or independent APK is part of
this suite. Recording/replay cannot recover a discarded live match.
