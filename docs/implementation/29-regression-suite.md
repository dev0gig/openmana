# Prompt 29 — Full regression and E2E suite

Implemented 2026-10-07/08. Local automated acceptance only; publication remains
held and physical Android/ORYX acceptance remains explicitly deferred.

## Implementation and acceptance

The existing subsystem tests already covered storage, Scryfall, Arena import,
transport, Forge decisions/combat/targets/zones, recording/replay and PWA.
The missing acceptance entry was a single command combining fresh JVM tests,
all real JVM/Node/Chrome differential games and the complete application/PWA
check, with explicit rejection of partial or skipped evidence.

`npm run test:regression` now provides that entry in `scripts/regression/`.
It verifies the current lock and the original build's source/report provenance,
copies only checked runtime/resources/harness/compiler attribution into its
own directory, prepares fresh pinned/patched Forge and bridge sources, builds
and tests the JVM, then runs every configured differential feeding and the
entire `npm run check`. It records real exit codes, signals, log hashes and
coverage. Original locked artifacts and reports are preserved; passing reports
cannot be copied into a new run. Existing output directories are refused,
including failed ones. Normal completion removes only this run's scratch and
copied/compiled artifacts, preserving logs, traces, JVM XML and screenshots.

The acceptance gate binds results to the manifest and requires every declared
fixture/feeding, all 43 observed trace paths, terminal game checkpoints, the
full browser sections, all 36 recorded/built table scenes at eight viewports,
max1 worker measurements and zero accessibility violations. PWA evidence must
prove HTTP-cache clearing, disabled network and an actually stopped server,
corruption/interruption/eviction refusal and unchanged original recordings
through waiting/failed updates. Focused, omitted-asset or skipped-browser runs
fail. Existing engine refusal/divergence/time-budget failures remain failures.

Forty new tests exercise acceptance report mutations, independent browser
capability losses (including GC/exnref/typed references), refusal before worker
creation, CLI skip/focus refusal, failed-report preservation and correct
compiler metadata copying. Historical reduced report samples are labelled as
validator-test inputs only. Capability tests use controlled scopes; they are
not physical-browser claims. No product, Forge rule, bridge or protocol code
was changed.

See [QUALITY.md](../QUALITY.md) for the executable commands, full coverage
matrix, dependencies and limits. Conservative scope choice: consolidate and
verify the rigorous existing suites, preserve locked WASM evidence, build a
fresh JVM and keep constructed UI boundaries distinct from actual Forge games.

## Current execution evidence

The complete command and all results are retained locally under
`reports/regression-29/full/`; focused tests, runtime confirmation, source
freeze and independent audit are under `reports/regression-29/`.

```bash
OPENMANA_ENGINE_BUILD_DIR=engine/build/update-26-20261007-final \
OPENMANA_TOOLCHAIN_DIR="$PWD/engine/build/update-26-20261007-final/toolchain" \
OPENMANA_CARDS_DIR=engine/build/update-26-20261007-final/catalog \
NODE_OPTIONS=--max-old-space-size=2048 \
JDK_JAVA_OPTIONS=-Xmx512m MAVEN_OPTS=-Xmx768m \
npm run test:regression -- --out reports/regression-29/full
```

The complete run passed (exit 0, `report.json` status `passed`):

| Verification | Current result | Evidence under `reports/regression-29/` |
| --- | --- | --- |
| Runtime/lock/provenance | Codex `gpt-6.1-sol` / `high`; before/after lock valid | `runtime.json`, `full/engine-lock*.log`, `full/build-provenance.log` |
| Generated engine contract/typecheck/unit | Passed, 95/95 tests; no skips | `full/engine-generated.log`, `full/engine-typecheck.log`, `full/engine-unit.log` |
| Fresh pinned Forge/bridge JVM | Maven clean package, 76/76; no failures/errors/skips | `full/jvm-sources.log`, `full/jvm-unit.log`, `full/engine/report/jvm-tests.json` and XML |
| Complete engine differential suite | 78/78 outputs: 25 JVM, 31 Node, 22 Chrome; 14 fixtures, all 43 paths, wins/losses, Chrome not skipped | `full/engine-games.log`, `full/engine/report/test-report.json`, original traces/runs |
| App/schema/type/lint/unit/build | Passed; 938/938 tests in 77 files, production build with checked real assets and notices | `full/app-check.log` |
| Full Chrome app suite | 96 route checks, 152 populated states, 288 scene/viewport checks plus interaction/history, real games/recording/replay | `full/app/e2e/report.json`, 817 screenshots |
| Full PWA Chrome suite | Passed, no page errors; actual offline Forge with one worker and zero server requests, corrupt/interrupt/eviction/update/install failures | `full/app/pwa/report.json`, `full/app-check.log` |
| Independent final report/source audit | 558 unchanged technical inputs; all 10 phase log hashes; final 36-scene gate; 661 zero-violation axe measurements including PWA, 11 max1 worker values; own artifacts/scratch removed | `audit.json`, `checked-source-hashes.json` |
| New focused regression tests | 40/40 in four files | `focused.log` |

Chrome was 153.0.8010.12. Natural complete games include Commander (17 turns,
85 scripted inputs), stack response (13 turns), terminal losses and concessions;
Node/Chrome replays matched their newly produced JVM traces. Expected altered
traces fail at the altered location; their negative-test wrapper passed.
App recordings came from actual fresh Chrome/Forge sessions, and the PWA
update preserved the actual original terminal recording. These are not claims
based on the historical acceptance-validator samples.

The original Prompt26 WASM was reused, **not rebuilt**. Its original compiler,
source, JVM and test reports were independently validated before use; fresh
JVM, Node, Chrome and application results in this run are separate evidence.
Forge remains `ed0333fecb1fea0671b3e50cadc1da4f71db5798`, protocol 7,
manifest SHA-256
`dd33caca4339210f51f87d60a115a70e1b4a5e6934c08404cca5950896314d2c`.

Self-review caught missing compiler attribution in the first isolated runtime
copy before the application build. The identical original SBOM was supplied
in the running directory (SHA-256
`5f6a2f4295eab0f5c53612ef3f536b0da2d63ff63404261073602e6e88dc663a`),
with provenance in `reports/regression-29/sbom-provenance.json`.
The final runner copies it automatically, covered by `assets.test.ts`.
This changed no engine bytes or test outcomes; the full production build used
the checked metadata. All final technical sources were frozen before the
complete app check. The final audit checks that freeze and applies the final
stricter 36-scene gate independently to the current reports; gameplay is not
repeated merely for an orchestration helper refactor.

## Review and remaining gates

Self-review checks the complete source/test/documentation diff, report/sample
provenance, fail-closed acceptance, source freeze, lock/build evidence and
cleanup. Representative complete games establish the tested trace paths,
not all Magic cards or Anvil parity. Recorded scenes and explicitly built
confirm/input/order/reveal/multi-select boundaries test UI behavior without
claiming real game coverage. Scryfall requests are real; ORYX cloud and launcher
services are controlled stand-ins. CSS/touch viewports are emulated devices.

The project owner's 2026-10-07 deferral remains authoritative: physical Android/ORYX
acceptance has **not been performed or passed**. Complete the concrete device
checklist in [implementation 28](28-oryx-web-android.md) before closing central
Prompt31; Prompt32 must inspect it. Preserve the markers in `STATUS.md`,
`AGENTS.md` and central31/32. Legal/source/icon gates from27 and explicit
publication authorization are also still required. No push, deployment,
redeploy, separate APK, emulator change or swap change occurred. Prompt30 was
not started and retains its Astra/max model gate.
