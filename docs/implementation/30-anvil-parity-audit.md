# Prompt 30 — Anvil parity audit and remediation

Implemented 2026-10-08, on the existing Forge pin
`ed0333fecb1fea0671b3e50cadc1da4f71db5798`. The explicit single-task request
was executed with the required actual session model `gpt-6-astra`, reasoning
`max`. No other queue task was started.

## Scope and result

[ANVIL_PARITY.md](../ANVIL_PARITY.md) is the comparison against the Anvil
repository, its protocol/audit, the OpenMana Bible and Anvil lessons. It maps
deck/start/AI, every decision family, priority/activation, mulligan, payments,
targets, combat, zones, history, end/error/settings and safety behavior to
source and separately labelled game/callback/browser evidence.

The audit repaired missing defender combat damage, lost Forge assignment
bounds/postponement, generic distribution caps and integer-sum overflow, free
library positions, delayed reveals, input cancellation/allowed values/repeated
Enter, and changed-color display including colorless. Protocol 8 carries the
missing structured fields. Forge patch `0009` shares its existing desktop
combat-assignment policy with the headless bridge; the UI only validates
numbers/flags and does not implement Magic rules.

The generic callback tests cover paths that the natural games do not reach.
The new `parity-trample` game reaches real combat assignment to the defending
player and Forge's prerequisite checks. The scripted player uses only the
question's bounds. Coverage is counted only after accepted assignments;
rejected answers and postponement cannot supply those markers.

## Validation and provenance

The complete fresh update pipeline in `engine/build/parity-30-accepted/`
passed all seven steps on 2026-10-08 and promoted `engine/engine.lock.json`
locally. The independent audit in `reports/parity-30/final-audit.json` passed.

| Check | Final result |
| --- | --- |
| Fresh JVM bridge tests | 85 passed; no errors, failures or skips |
| Engine unit tests | 96 passed; no errors, failures or skips |
| JVM/Node/Chrome engine suite | 82 results, including 23 Chrome results; 15 fixtures and all 45 required observed paths; no failure or browser skip |
| App schema, typecheck, lint, unit tests and production build | Passed; 948 tests in 77 files |
| Full Chrome app suite | 96 route checks, 152 populated states, 38 scenes × 8 sizes = 304 scene checks, plus interactions/history/decision checks |
| Accessibility and worker lifecycle | 678 zero-violation measurements including PWA; 11 strict max1-worker measurements |
| Production PWA suite | Passed: cache-cleared/server-stopped offline Forge, verified cache bytes, corrupt/interrupted downloads, waiting/failed updates, preserved recording, eviction and failed initial install |

The real `parity-trample` fixture finished with a win after 22 turns, 85 inputs
and 368 trace checkpoints. It observed 3 accepted defender assignments and 7
accepted assignments with Forge's lethal-damage prerequisites; no fixture
problem was reported. These are actual game paths, separate from the generic
callback tests and constructed UI scenes.

The final manifest SHA-256 is
`a6d2368d9c4e06b229228c4581311b4f649cd92a7d815cdc1ccb57c3936bf629`.
The engine source identity is
`b03f87ff9c782eb03b773cee3943d902e4baccc34ad770273ff473d935d688eb`;
the app input identity is
`06e4224e35808b4dc1fb0532137963d799193226dde0bb6735324ddb26b1b8ba`.
The audit checks original step logs/JVM XMLs, the lock and every engine artifact,
current source identities and current semantic coverage requirements. It also
matches the served browser bytes, all four live/finished recording manifest
hashes and the PWA cache paths to this final build. The browser asset ID is
`be4ccff6eab6c827`.

- `reports/parity-30/baseline.json`: runtime gate and source revisions.
- `reports/parity-30/`: focused checks, original failed attempts and fresh JVM
  transcripts used to re-record protocol-8 table/replay fixtures.
- `engine/build/parity-30-scenes/`: preliminary compiler/artifact provenance
  for the recorded fixtures, not the final accepted lock.
- `engine/build/parity-30-final/`: first complete engine build; all 82 engine
  results and catalog passed, then app lint rejected the form key handler.
  Previous lock retained; original failed pipeline preserved.
- `engine/build/parity-30-verified/`: second complete engine build; all engine,
  catalog, unit and browser checks except the three replay-retention cases
  passed. The new fixture date exposed a fixed-date test assumption described
  below. This failed run did not promote the lock or run the PWA suite.
- `engine/build/parity-30-accepted/`: successful clean complete validation;
  exact command in `reports/parity-30/accepted-command.json`, original output
  in `reports/parity-30/accepted-pipeline.log`.
- `reports/parity-30/final-browser/`: preserved complete app/PWA reports and
  screenshots from the accepted pipeline.

Fresh recordings replace the protocol-7 UI fixtures. No old message is
relabeled as protocol 8. The replay fixture remains a deliberately assembled
portable header/time envelope around original JVM engine messages, without
player-input interleaving; real browser MatchRecorder captures are checked
separately by the full suite. Archived acceptance-validator samples retain
their old measurements and explicit old requirements; tests prove that they
cannot pass today's additional parity requirements.

`reports/parity-30/final-fixture-provenance.json` independently compares all
29 recorded scenes with a second recording from the first pipeline's JVM build
(whose complete engine suite passed): all
game/decision/history/presentation data matches. Only original message indices
and state sequence numbers differ (38 fields), as the bridge coalesces state
updates on its existing 120-ms clock. The initial strict byte/content comparison
exposed those counters; the subsequent comparison excludes only those named
fields. Original recordings and build metadata remain untouched.

The full validation uses `engine/scripts/validate-forge-update.mjs` against
base `5f86ff3d8aa8509881d708890405ff4510d1f53f`, with an explicit protocol-8
adaptation reason and each changed outside-engine file named exactly. It
extracts a fresh pinned toolchain, compiles fresh JVM/WASM, runs all declared
JVM/Node/Chrome games, rebuilds the catalog from the preserved verified bulk
data and runs the entire app/PWA check before promoting the local lock.
No skip/focused flag is used for acceptance.

## Self-review and decisions

- Compared the Forge desktop and human-controller call paths, not just the
  old Anvil protocol labels. Extracted combat constraints into Forge itself;
  retained null-key defender mapping and explicit postpone semantics.
- Checked hidden-card omission, current identity resolution, sideboard/format
  scope, safety arming, input withdrawal and neutral failure/end behavior.
- Corrected additional issues found during review: integer overflow, numeric
  option text preservation, contextual help, colorless changes, and the new
  callback suite's dependency on another test class initializing Forge.
- The real browser probe caught a valid input draft being submitted in addition
  to cancellation: the new cancel control now explicitly has `type="button"`.
  Component tests cover both empty and valid drafts; Chrome checks exactly one
  null answer. All three changed dialogs passed the focused eight-size layout,
  axe and answer probe (24 constructed cases). The probe initially applied
  the 44-px form-control rule to existing card thumbnails; its measurement was
  aligned with the repository's separate card/control rules. The canonical
  full-suite layout thresholds were not weakened.
- The first full pipeline stopped at app lint after its complete engine and
  catalog steps passed. The repeated-Enter handler belongs on the interactive
  input field, not the form; this was corrected without disabling the rule.
  Typecheck, lint and all 948 app tests then passed. A focused full-table run
  first lost its execution context to a navigation within the first phone
  viewport; that failed output is preserved. Its standalone serial rerun
  passed all 304 scene/viewport checks and every existing interaction without
  retry/suppression logic. The navigation cause was not conclusively established.
  No source edits or parallel unit tests were performed during that rerun.
- The second full pipeline completed all 304 table checks and all other app
  browser sections, but failed the replay-retention case in its three sizes.
  The freshly recorded fixture's header was dated October 8; the test still
  created its supposedly newer copy on October 7. Retention correctly kept
  the newer original. The copy now derives both dates from the fixture.
  Review also found that Playwright treated the old asynchronous predicate as
  truthy without polling its resolved result. A bounded database poll now
  requires the exact retained header, followed by an exact transcript check
  that also rejects missing messages. Typecheck/lint and all three focused
  replay cases passed. The original failed app report and screenshots remain
  in `reports/parity-30/verified-browser-failed/`; no failure was suppressed.
  The separately run PWA preflight also passed before the next complete
  pipeline. Focused/preflight reports remain separately labelled and did not
  replace any step of final acceptance.
- The React component review confirmed keyed question resets, local draft
  state, explicit input cancellation, keyboard guards and labelled controls;
  no additional component change was needed.
- Fresh Commander recordings exposed a scene-selector ambiguity: an attack
  trigger's new tokens increased the permanent count before the phase changed.
  The recorder now selects the intended declaration with every creature
  attacking, directly from the original stream; no state is edited to fit a
  test. The new patch has the queue's format, provenance and dated source notices.
- Kept old failed logs. Early Java test API mismatches and stale protocol-7
  scene validation failures were corrected. A preliminary WASM compile with
  a 3-GiB heap exhausted that heap; the retry uses the previous proven 6-GiB,
  two-thread compiler configuration and a task-owned temporary 4-GiB swap
  reserve. After final acceptance, that reserve was disabled and removed;
  `reports/parity-30/swap-after.txt` confirms the preexisting `/swapfile`
  remains. The pipeline removed its own browser temporary directory. Other
  processes and preexisting swap were preserved.
- Built UI scenes and callback invocations are labelled as such. Representative
  full games prove their declared paths, not every Magic card. Intentional
  scope differences follow the Bible; no new feature deferral was invented to
  hide a found gameplay defect.

## Remaining gates

Physical Android/ORYX acceptance remains explicitly deferred by the project owner to
Prompt31 and must be checked in Prompt32. It is **not performed or passed**.
Keep the device checklist in [28](28-oryx-web-android.md), the legal/source/icon
gates from 27, cloud activation requirements and explicit publication hold.
Snapshot replay cannot restore a discarded live Forge match. No push,
deployment, redeploy, individual APK or visual-polish project is part of 30.
