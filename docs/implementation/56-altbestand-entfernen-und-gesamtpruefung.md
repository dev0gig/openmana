# 56 — The old backgrounds removed and the whole accepted

Prompt 56 of the series *stoneboard* (53–56, Dropzone
`workflow/OPENMANA-STONEBOARD-MASTERPLAN.md`, run `stoneboard-20261014-1617`,
Claude Fable 5.1 with effort `high`), step 4 of 4 and the series' acceptance:
everything that was a table background before the arena is gone, stored data
of older versions load cleanly, and the complete check and the readiness
games ran once on the finished whole. Only local commits; no push, no
release, no deployment, no notification.

## Part A — what went

Before (commit `d4b2af1`, the end of prompt 55): `dist/assets` of the
prompt-52 build held 68 files (6 of them the `.webp` pictures, 238 684 bytes
in the sources); local data schema version 5; the drawn table, three
pictures, the player's own picture and the setting `display.tableBackground`
with `display.tableBackgroundImage`.

Removed, with the inventory of prompt 53 as the list and a search over the
repository as the check:

- **Code**: `src/game/table/surface-drawing.ts`, `table-surface.tsx`
  (`TableSurface`, `DrawnSurface`, `PictureSurface`, `SURFACE_DRAW_MEASURE`),
  `table-background.ts`, `table-background-options.tsx`,
  `src/game/table/backgrounds/*.webp` (6), `assets/table-backgrounds/`
  (PROVENANCE.md and two HTML sources). `game-table.tsx` renders
  `ArenaSurface` where `TableSurface` stood (first in the board; the arena
  keeps `data-slot="table-surface"` and `data-background="arena"` as the
  tests' marker). `src/app/preferences.tsx` lost `tableBackground` and
  `tableBackgroundImage`; `src/routes/settings-page.tsx` lost the card
  "Spieltisch" and the two setting names; `src/routes/credits-page.tsx` lost
  the card "Spieltisch-Bilder"; `vite/notices.ts` lost the provenance entry and
  the credit sentence (`THIRD-PARTY-NOTICES.md` regenerated accordingly).
- **CSS and tokens**: the surface rules of `table.css` (`[data-slot="table-surface"]`
  with `background: var(--table-wood)` and `contain: strict`, `.table-surface-desk`,
  `-board`, `-ring`, `-picture`); the arena's `background: none` override;
  `--table-wood` and `--table-wood-frame` (with their Tailwind mappings) in
  `src/index.css` - `--table-leather` stays (the card back in `table-art.tsx`
  uses it); the main button's ring shadow, which mixed `--table-wood`, now
  mixes `--table-panel` (the panel it sits on).
- **Tests**: `table-surface.test.tsx`, `table-surface-picture.test.tsx`,
  `table-background.test.ts`; the "Spieltisch" tests of `settings-page.test.tsx`
  (one test now proves the card and the radio group are gone); the wood pairs
  of `design-tokens.test.ts`; `arena-surface.test.tsx` without the
  preferences stub.
- **Harness and end-to-end**: `background=<choice>`, `BackgroundChoice`,
  `window.__openmanaChooseBackground` in `src/test/table-harness.tsx` (the
  provider chain stays); in `scripts/e2e/run.ts` `surfaceFacts` and
  `tableSurface` (the drawn table's 11-size and cost checks) are gone -
  `arenaFacts` runs in every scene, the new `arenaCost` keeps the cost
  measurement (20 state changes at 4x CPU with and without the arena, the
  arrows' draws, the main button's gloss under less motion) -,
  `chooseBackground`, the comparison against the drawn table (the hidden
  arena remains the baseline) and the stored-choice checks.
- **Docs**: `docs/design/SPIELTISCH.md` §4.1 and §4.1a reduced to history
  notes, §4.1b, §5 (token rows), §10, §13; `docs/DESIGN_SYSTEM.md` (the table's
  row, the component table, the token list); `docs/BIBLE.md`; `AGENTS.md`
  (the table paragraph); `STATUS.md`. The mockup `docs/design/spieltisch-vorlage/`
  stays as the reference of the pieces that remain (medallions, panels, card
  back); `docs/implementation/36`–`39` stay as history.

## Stored data

Schema version **6** (`src/storage/schema/local-data.schema.json`, generated
constants and records regenerated): migration 6 (`src/storage/migrations.ts`)
deletes the two retired keys from the `settings` store in the version-change
transaction and changes nothing else; `RETIRED_SETTINGS` in
`src/storage/settings.ts` names them. A backup that carries them is read past
(`readBackup`: counted as read, never taken over - old backups stay
importable, their other settings come in); the cloud collection never held
`display.*`. Tests: `migrations.test.ts` ("version 6: the table's background
is retired": a version-5 database with the two settings, three others and a
deck → the two gone, the rest kept, history 1–6; the list names exactly the
two), `backup.test.ts` ("retired settings": a backup of version 5 and one of
this version, both with the two settings next to two others → only the two
others are read, nothing skipped). The card catalog carries the schema
version and was rebuilt from the cached bulk data
(`npm run cards:build -- --bulk cards/build/cache/all-cards-20260924211809.jsonl.gz`:
catalog `4ca084bf5aa3bdfc`, 36 156 cards, the same data as before).

## Proof search

`grep` over the repository (without `node_modules`, `.git`, `reports`,
`dist`) for `tableBackground`, `TableBackground`, `table-background`,
`Holztisch`, `Farbenrad`, `Chip-Raster`, `surface-drawing`,
`table-backgrounds`, `TableSurface`, `DrawnSurface`, `PictureSurface`,
`farbrad`, `planeswalker-hoch`, `raster-hoch`, `--table-wood`: hits only in
`docs/implementation/` (history), the state entries of `SPIELTISCH.md` and
`STATUS.md` and their "removed" notes, the mockup `docs/design/spieltisch-vorlage/`
(the design reference, kept on purpose), and - by necessity - the retired
keys themselves in `src/storage/settings.ts`, `migrations.ts` and their tests,
plus the test that proves the Settings card is gone. No `.webp`, no
provenance, no credit, no option, no token, no CSS rule, no harness switch
remains in product code, schema, assets or notices.

## After

`dist/assets` of the new build (`OPENMANA_ENGINE_DIR=engine/build/publish-52h/dist npm run build`):
62 files, no `.webp`, 9 397 847 bytes (the six pictures, 238 684 bytes, are
the difference besides the hashed bundles). `THIRD-PARTY-NOTICES.md` without
the pictures' provenance and credit.

The arena after the removal, rendered at M5 in opening, main-phase, respond,
attack-declared, commander-late, an expanded decision and hands of 7 and 20:
the same picture as in prompt 55 - regions and cards 0 px against the hidden
arena, cells on their regions, no scroll, no animation, the same decoration
shown and hidden, the same (by design) hand cards over the hand's runes with
seven cards. Pixel comparison of the screenshots with prompt 55's and 54's
(`ImageChops.difference`): ZH opening mean 0.006 (no pixel over 8), D opening
mean 0.026 (0.003 % over 8, a card's corner), D main-phase mean 0.063
(0.14 % over 8, inside the hand card), OQ commander-late 2.8 % over 8 - all
inside card pictures that were still loading when the screenshot was taken,
nothing on the arena. Contact sheets in Seafile
`/repo/openmana/design/svg-arena/56/` (`56-kontaktbogen-M5-main-phase-final.png`,
`56-kontaktbogen-M5-szenen-final.png`, `56-kontaktbogen-haende-final.png`,
four single pictures). Reduced motion: `arenaFacts` and `arenaSurface` prove
0 animations in the arena plain and under both settings (prompt 55); the
main button's gloss stops under both (`arenaCost`).

## Part B — the complete check

- **`npm run check`** (`OPENMANA_ENGINE_DIR=engine/build/publish-52h/dist`, the
  locked protocol-10 engine; run twice, the second with the replay fixture at
  schema 6): schema/generation OK, `tsc -b` OK, oxlint OK, **Vitest 108 files,
  1 411 tests green**, end-to-end **red at 8 checks**, of which
  - 3 × `game table (…, target-both): the decision's buttons outside the
    window` - foreign, since `267174a` (see "Found, not changed");
  - 2 × `game failures: [requestfailed] …/engine-manifest.json net::ERR_ABORTED`
    - foreign, since `d980ca3` ("Veraltete App-Version erkennen", 2026-10-14
    13:08): after the forced engine abort of that section the app now sends a
    HEAD request for its engine's manifest, which the test's next navigation
    aborts and the section's error list counts;
  - 1 × `preferences (phone): option rows … (0 table backgrounds …)` - the
    test still expected the removed background group; fixed in `run.ts`
    (0 groups, 8 + 7 rows) after the run;
  - 2 × `[requestfailed] https://cards.scryfall.io/… net::ERR_ABORTED` in
    `game table (desktop)` and `zones (desktop)` - a card picture aborted by
    the next navigation; `--zones-only` run again right after: green (as in
    prompt 55). The first run had the 3 `replay …: download differs` of the
    fixture's old schema version besides, fixed before the second run.
  Every check of the arena, the table scenes at all sizes with axe and the
  keyboard tour, the harness's gestures, the local data, the card data, the
  deck import and library, the real games (desktop, phone), the ORYX section
  and the layout classes passed. Because `npm run check` stops at the
  end-to-end failure, the **PWA suite** ran by itself
  (`node scripts/e2e/pwa.ts --no-build`): green (complete SHA-verified engine
  download, offline deep reload with a real Forge game, legal documents,
  failed and verified updates, eviction recheck, incomplete install).
- **Readiness games** on the new `dist` (`scripts/readiness/matches.ts --serve dist`):
  `--games phone --cpu-throttle 4`: the game played to the end (lost, 15
  turns, 190 s), **343 long tasks, none over 200 ms (longest 200 ms)**,
  longest frame 272 ms, motion work ≤ 38 ms in 232 states, 90 motions at
  47.8 fps - all checks passed; `--games phone,commander --table-memory`:
  listeners 397–417 early / 404–414 late (bound 471–479), nodes 766–955 /
  702–889 (bound 1 114–1 194), heap 9.0–11.9 MiB, one endless animation (the
  main button's gloss, as in prompt 52) - all checks passed;
  `--games phone --cpu-throttle 4 --less-motion`: 386 long tasks, 23 over
  200 ms (longest 335 ms; none of the table's motion, which is off), 0 motions
  - all checks passed. Prompt 52 with the drawn table: 329 long tasks, none
  over 200 (longest 196), motion ≤ 20.3 ms, 107 motions at 50.9 fps, heap
  9.2–12.2 MiB, one endless animation - the same order.
- **Performance against the drawn table** (`~/arena-work/perf.mjs` outside
  the repos: harness main-phase, 412×915, 4x CPU, warm-up and three
  repetitions of the twenty state changes; the drawn table recorded at the
  end of prompt 55, before the removal):

  | | DOM in the surface | `svg` | filters at runtime | `feTurbulence` | wall ms | long tasks | longest ms | over 200 | frame p95 | render p95 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | drawn table (prompt 55) | 184 | 3 | 7 SVG filters | 3 | 13 595 | 54 | 988 | 61 | 802 | 157 |
  | arena (prompt 56) | 36 | 12 | 10 `drop-shadow` | 0 | 12 943 | 49 | 848 | 58 | 745 | 140 |
  | no surface | - | - | - | - | 12 746 | 49 | 700 | 54 | 696 | 119 |

  The arena costs less than the drawn table on every measure and a little
  over no surface at all (page DOM 355 instead of 503 elements). The absolute
  numbers of this script are higher than the end-to-end test's own (its
  `arenaCost` measures the same changes with its own timing); only the
  comparison counts.
- **Keyboard, touch, drag, zones, card view, replay**: the table section of
  the end-to-end run (keyboard tour, the hand's gestures with the recorders,
  the drag in two real games, zones, the card view, the replay library) ran
  within `npm run check` and passed except for the foreign checks named.

## Found, not changed: the decision's target group below the window (outside the series)

`game table (small-phone | fold-portrait | fold-landscape, target-both): the
decision's buttons outside the window` fails `npm run check` since commit
`267174a` ("Spieltisch: Karte beim Zielen und Bezahlen groß zeigen", another
session, 2026-10-14 14:47, after prompt 52's last green check). Measured in
this prompt: in `target-both` the player-target group (`GameDecisionActions`,
"Wen greifst du an?"-style group of the targets) lies at 745–789 px in a
740 px window (360×740), at 790–886 in 829 (690×829) and 722–818 in 690
(829×690); the decision region scrolls (467 px of content in 266 px). The
cause is by design of that commit: beside the large card
(`GameDecisionSpotlight`) the actions group is `static`
("in-data-[slot=game-decision-spotlight-content]:static" in
`src/components/ui/game-decision.tsx`) and scrolls with the content while only
the bar (OK/Abbrechen) sticks; the end-to-end check `decisionInteractions`
expects the group in view (prompts 15/41: "the answer buttons stick to its
bottom"). Pixel-identical with and without the arena and on `f9f12d5` with the
series' changes stashed (prompt 53). The series neither changes that
component's design nor weakens the test: the decision - a smaller card or a
sticky group beside it - belongs to its author or the project owner. Until
then the complete check stays red at these three checks.

## After the push (2026-10-15): the released catalog

The project owner released the push; Vercel's first production build of
`cdef0f8` failed: its build fetches the card catalog from the release
`engine-p10-908fbcabd35e`, and that catalog still carried schema version 5
(`CardAssetsError: … records of local data schema 5, the app uses schema 6`,
reproduced locally with the same commands as `vercel.json`). With the owner's
go the catalog built above (`4ca084bf5aa3bdfc`, the same Scryfall bulk and
Forge revision) replaced the three `card-catalog*` assets of that release
(`gh release upload --clobber`), `deploy/artifacts.json` names its bytes and
SHA-256, and the Vercel build command ran clean locally (fetch, build,
budgets; `vite/deployment.test.ts` green). The engine assets are untouched.

## Physical device

Not performed: no Fold 7 or ORYX access in this run. Emulation in Chrome 153
only; nothing here claims Android readiness.
