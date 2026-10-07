# 24 — Responsive phone/fold/tablet/desktop pass

## Scope and authority

Presentation uses the existing shadcn components, design tokens and CSS viewport/orientation queries. Forge remains the sole authority. No engine, bridge, protocol, storage schema, recording format, automatic answer or card/mechanic rule is added or changed. Resize changes layout only.

## Findings and corrections

- A long, unbroken user deck name widened the mobile layout viewport and could make the primary action bar unclickable. Page headings now wrap anywhere; their content column and Item content can shrink. Item titles stay bounded by their row. The full name remains in the accessible content and deck heading.
- Every Button size (including small/import actions and dialog close icons) and Input is at least 44 px on coarse pointers. The app's brand link also has a 44 px target. Fine-pointer sizes remain compact. Table card targets retain the existing 24 px minimum and safe inspection guards.
- AlertDialog confirmations now scroll inside a bounded screen rather than running off a low landscape screen. Dialog and Sheet content wrap long user text; every Sheet is bounded by the dynamic viewport. Existing sticky viewer/help/history/decision footers remain in place.
- The board's eight regions, equal battlefield allocation, sideways card rows and portrait/landscape orientation remain the existing design. No engine input, arming, gesture, confirmation, withdrawal or replay guard changes.

## Coverage

The application audit uses these CSS viewports: 360×740, 412×915, 915×412, 690×829, 829×690, 884×1104, 1104×884 and 1440×900. The 690×829 / 829×690 sizes are representative fold-like emulation, not a physical Fold/hinge claim.

`npm run test:e2e -- --no-build --responsive-only` checks every route's empty/unavailable surface plus populated home/library/deck/details/import/update/play/matches/settings/replay, long names and 60-line input, rename/delete/deck-choice dialogs, real installed-catalog card lookup, diagnostics and unresolved import reports. It checks horizontal overflow, actual mobile layout viewport width, navigation, 44 px control dimensions, primary-action reachability, dialog bounds, axe and screenshots. All data enters through real backup/replay/import UI. Play retains its normal real Forge prewarm; the audit starts no game, preserves a maximum of one engine per page and proves replay creates none. The replay fixture contains recorded Forge messages inside explicitly assembled portable metadata.

The complete table suite expands the original six sizes with both Fold sizes: all 36 recorded/built scenes at eight viewports, with original marks/card/decision/combat/zones/history/gesture/keyboard guards intact. Open-viewer resize checks preserve card ID, focus, orientation, reachable footer and zero harness input, then restore focus to the card. Decision dimensions are checked at all eight sizes; exhaustive answer interactions retain the original small-phone, phone-landscape and desktop sizes. Recorded/built table flows are not new live engine games.

The full app suite additionally checks a fresh desktop and phone Forge game. Each waiting game is resized through all eight sizes, comparing the complete original persisted matchLog (engine messages/full states and accepted player inputs) at every step and the pending question; no new Worker may be requested. Existing Worker count guards remain strict. Manual replay remains read-only.

## Verification and operational limits

Final command results and persistent screenshots/logs are recorded in the central Dropzone report. Browser lifetimes are bounded per application/table viewport; empty routes use one owned page per route, retaining all page error/request streams. This avoids accumulating high-DPR capture/renderer resources without skipping assertions or screenshots. Full-page capture restores Chrome's original coarse pointer mode before a subsequent inspection.

Only the new match/header and resize inspections use a scoped IndexedDB read (matches or the complete matchLog); the original comprehensive database checks still read all stores. Reading the entire installed catalog for a single match-count check caused a 512 MiB diagnostic run to exhaust its Node heap. Extended browser/full checks use 2048 MiB; focused component tests and builds use 512 MiB, Vitest one worker.

Verified Prompt 23/22/21 engine artifacts are reused byte-for-byte (eleven SHA-256 comparisons, manifest verification by the production build). No unchanged engine is rebuilt, and no new JVM/WASM parity run is claimed. Screens/touch/mouse/keyboard tests run in real Chrome with emulated dimensions, not physical hardware. No deployment, push, native hinge, physical-device or real ORYX-cloud claim is made.

The first complete run finished every application/table flow with exactly two findings in the new non-empty transcript precondition: it checked `game.state`, while the unchanged protocol calls original snapshots `state`. Both real games had question `1` and ten original records, and every resize retained their transcript. The additional type comparison was corrected to `state`; the whole check was repeated with frozen sources. This failed attempt is preserved separately and is not counted as a passing check.

Two unchanged repeat runs then crashed Chrome’s renderer during the high-DPR Settings full-page capture. No kernel/cgroup OOM kill or earlyoom kill was observed. Debug recorded GPU shared-image errors; the RAM-backed `/tmp` was 98% full with only 236 MiB free. The complete check was repeated with only its own temporary Node/Playwright/Chrome I/O moved to a dedicated local NVMe `TMPDIR`, preserving every screenshot/assertion and all foreign temporary files. This is a concrete resource finding, not proof of the sole crash cause. Persistent debug/failed-run evidence is linked in the central report.

## Final results (2026-10-07)

The complete check passed with unchanged frozen source hashes: schemas, TypeScript, oxlint, 866/866 tests in 69 files, production build and the complete real-Chrome application/table suite. The separate final build passed with a 512 MiB Node heap. An independent report audit passed: 96 empty/unavailable route checks, 152 populated state/overlay checks, 288 recorded/built table scene checks, 24 open-viewer resizes and 16 fresh live Forge resizes; 658 axe measurements with zero violations and the original strict max-one-Worker lifecycle guards. Coarse decision widths and heights are at least 44 px.

Final screenshots inspected directly include the small-phone long-name deck/action bar, low-landscape confirmation, fold-landscape table and fresh live-phone resize. The existing compact phase text may truncate in narrow headers; accessible descriptions and full help retain it. Table cards, hand and decisions stay visible, with region scrolling where needed.

Persistent full report, screenshots, source hashes, failure history and resource evidence: `~/.local/state/dmm/openmana-21-25-20261007T042732Z/24/`. Central German completion report: `dev0gig/dropzone/workflow/reports/openmana-21-25-20261007T042732Z-24.md` in the isolated DMM worktree. Changes and reports are committed only locally; Prompt 25 is not executed by this worker.

After every owned test/browser/build process ended, the worker checked RAM reserve, disabled and removed exactly its own 4 GiB swap and removed both unused owned TMPDIRs after empty `lsof` checks. Original `/swapfile` stayed active. A separate Fundament worker’s 6 GiB temporary swap appeared during cleanup and was preserved untouched. USBMedia and foreign active work remained untouched. See `swap-cleanup-before.json` and `swap-cleanup.json` in the evidence directory.
