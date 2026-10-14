# 53 — Arena foundation: shadow grid, ground and the new default

Prompt 53 of the series *stoneboard* (53–56, Dropzone
`workflow/OPENMANA-STONEBOARD-MASTERPLAN.md`, run `stoneboard-20261014-1617`,
Claude Fable 5.1 with effort `high`), step 1 of 4: the arena laid under the
board as a subgrid of its grid, with the ground of the binding template, and
made the table's default background. The old backgrounds stay choosable until
prompt 56 removes them. Only local commits; no push, no deployment.

## What changed

- **`src/game/table/arena-surface.tsx`** (new): `ArenaSurface`, a memoised
  component without props. Markup: `div[data-slot="table-surface"][data-background="arena"][aria-hidden]`
  with four empty children `data-arena="ground" | "opponent" | "field" | "hand"`.
  The grain and the cracks of the ground are two SVG tiles as data: URLs
  (`ARENA_STYLE`: `--table-arena-grain`, 260 px, `feTurbulence` fractal noise
  tinted `.55/.6/.7`; `--table-arena-cracks`, 900×700 px, five dark lines and
  three light edges). Exports: `ArenaSurface`, `ARENA_PIECES`, `ARENA_STYLE`.
- **`src/game/table/table.css`**: the arena's rules under
  `[data-slot="game-board"] > [data-slot="table-surface"][data-background="arena"]`:
  `grid-column: 1 / -1; grid-row: 1 / -1; display: grid; grid-template-columns: subgrid;
  grid-template-rows: subgrid; z-index: 0; pointer-events: none; min-width/min-height: 0;
  overflow: hidden; background: none; contain: none`; every child
  `min-width/min-height: 0; position: relative; overflow: hidden`; the ground
  `1 / -1` on both axes with the template's four gradients (stone
  `#1c2330 → #0f1520`, vignette to `#05070c`, warm `#d9913a55` at the top,
  cool `#3f7fd455` at the bottom), its `::before` the grain (`soft-light`,
  0.4) and its `::after` the cracks (0.35); the cells `grid-area: opponent`,
  `opponent-field-start / field-end` × `field-start / field-end`, `grid-area: hand`.
  No tokens were needed (`--table-arena-*` only as the two tile properties the
  component sets); the colour literals are the template's.
- **`src/game/table/table-background.ts`**: `TableBackgroundChoice` gains
  `"arena"` (first in `CHOICES`), the setting `display.tableBackground` defaults
  to `"arena"`, `TableBackground` gains `{ kind: "arena" }` and
  `tableBackground("arena", …)` returns it. Everything else unchanged
  (`"custom"` without a picture is still the drawn table).
- **`src/game/table/table-surface.tsx`**: `TableSurface` renders
  `ArenaSurface` for `kind === "arena"`, otherwise as before (drawn table,
  picture). `PictureSurface`'s type excludes the arena.
- **`src/game/table/table-background-options.tsx`**: option "Arena (Vorgabe)"
  first; "Holztisch (Vorgabe)" is now "Holztisch"; `CHOICES` map knows `arena`.
- **`src/test/table-harness.tsx`**: the app's provider chain
  `StorageProvider → EngineSessionProvider → PreferencesProvider` (as
  `src/app/app-shell.tsx`; the engine session only exists, nothing boots - no
  request to `/engine/<id>/` or a `.wasm` file in the harness, checked);
  `background=<choice>` stores the choice through `useSaveSetting` before the
  table shows (`custom` with a one-pixel WebP), `window.__openmanaChooseBackground(choice)`
  stores another while the page stays.
- **`scripts/e2e/run.ts`**: `tableSurface` (the drawn table's checks) opens the
  harness with `background=table`; new `arenaSurface` (see Tests);
  `OPENMANA_TABLE_ONLY=<part>` runs one part of the table section while working
  on it.
- **Tests**: `arena-surface.test.tsx` (new), `table-background.test.ts`,
  `table-surface.test.tsx` (chooses the drawn table through a `usePreferences`
  stub, otherwise unchanged), `table-surface-picture.test.tsx` (the default is
  the arena, the drawn table when chosen), `settings-page.test.tsx` (the new
  order and default; choosing the drawn table and the arena again).
- **Docs**: `docs/design/SPIELTISCH.md` §4.1b (new), §10, §13; `STATUS.md`;
  `AGENTS.md` (table rules).

Untouched: `game-board.tsx` and `game-table.tsx` (the arena is a grid child at
`TableSurface`'s place - first in the board after `<title>` - with no
structural change), `surface-drawing.ts`, cards, gestures, engine, protocol,
dependencies.

## The shadow grid: what was measured

The template (Dropzone `workflow/OPENMANA-ARENA-VORLAGE.html`) was rendered at
the five sizes of the visual acceptance (M5: ZH 480×1040, ZQ 1040×480,
OH 870×960, OQ 960×870 at DPR 2.25, D 1440×900 at DPR 1) and compared with its
Seafile screenshots; the ground's parts (gradients, grain, cracks, opacities)
were taken over as they are.

**First render (arena, contain: paint):** the cells did not lie on their
regions - at ZH the ground measured 240×520 px in the board's corner and the
three cells 240×520 px at (240, 520): Chrome had dropped the subgrid
(`grid-template-columns: none`) and laid the arena out as a 2×2 grid of its
own. Probed in the page: `contain: paint`, `layout` and `strict` all do that;
`contain: none` (with `overflow: hidden` or `clip`) keeps
`grid-template-columns: subgrid`. The general surface rule sets
`contain: strict`, so the arena's rule undoes it. Geometry of the regions and
cards was unchanged either way (the broken arena had no size of its own).

**Control render (contain: none), M5, main-phase and `built=choose-many`
(expanded decision):**

| Size | Ground | Opponent cell = strip | Hand cell = hand | Field cell = both battlefields | Regions/cards vs drawn table | vs no surface |
|---|---|---|---|---|---|---|
| ZH 480×1040 | 480×1040 | (0, 53, 480×46.45) | (0, 716, 480×144) | (0, 99.45, 480×570.09) | 0 px | 0 px |
| ZQ 1040×480 (breit, short) | 1040×480 | (656, 0, 384×57) | (0, 384, 656×96) | (0, 57, 656×327) | 0 px | 0 px |
| OH 870×960 | 870×960 | (0, 57, 609×70.91) | (0, 796.81, 609×163.19) | (0, 127.91, 609×598) | 0 px | 0 px |
| OQ 960×870 | 960×870 | (0, 57, 672×70.91) | (0, 722.11, 672×147.89) | (0, 127.91, 672×523.3) | 0 px | 0 px |
| D 1440×900 | 1440×900 | (288, 53, 864×74.27) | (288, 738, 864×162) | (288, 127.27, 864×536.47) | 0 px | 0 px |

With the expanded decision at ZH the hand cell follows the hand to
(0, 521.61) and the field cell shrinks to 375.7 px - the subgrid follows the
board's `data-decision` areas without any code. No document scroll at any
size; 0 hits of the surface at eight sample points over the board; 0
focusable or readable elements in it; no engine request; no console error.

The colour of the ground against the template's screenshot at D (mean of
12×12 px): identical where the ground is bare - e.g. (300, 560) `22/30/44`
and (1000, 600) `21/29/43` in both -, different only where the template shows
parts of prompt 54 (the brighter island at the centre, the hand's glow) or a
card. Pictures: Seafile `/repo/openmana/design/svg-arena/53/`
(`53-kontaktbogen-grund-M5-kontrollrender.png`, `53-arena-<size>-main-phase[-choose-many].png`,
`53-holztisch-D-main-phase-vergleich.png`).

## Decisions

- **Cracks are built** although the approved "G+" screenshots show none: the
  template's light-dust rule overrides its cracks rule (`.ground::after`
  declared twice), while the plan (§1) and this prompt name the cracks as a
  part of the ground and the first approved preview "G" showed them. They are
  their own layer at the template's 0.35 - barely visible over dark stone. If
  the project owner wants them gone, one rule goes.
- **Colour literals, no tokens:** the template's values are the reference
  and the arena is the table's own CSS (allowed by `docs/DESIGN_SYSTEM.md` §9);
  tokens would have added a layer without a consumer.
- **"custom" without a picture still shows the drawn table** and "Eigenes
  Bild entfernen" still returns to "table", as before: the old behaviour and
  its tests stay untouched until prompt 56 removes all of it.
- **No containment on the arena** (measured, see above); the drawn table
  keeps its `contain: strict`.
- **Harness:** the background comes through the app's real provider chain and
  a stored setting, not through a flag in the product; the drawn table's
  end-to-end checks choose it with `background=table`.

## Tests

- `npx tsc -b`, `oxlint` (src, scripts/e2e): clean.
- Vitest, targeted: `src/game`, `src/app`, `src/routes`, `src/storage/settings`
  - 54 files, 807 tests green (among them the 5 new arena tests, the
  background, surface, picture, settings, motion, design-token and layout
  tests).
- End-to-end `npm run test:e2e -- --no-build --table-only` (the table section:
  layout classes, the drawn table's surface checks with `background=table`,
  the new `arenaSurface`, arrows, motion, the foldable's sizes, every recorded
  and built scene at the eight sizes with axe-core and the keyboard tour):
  every check of the arena, the drawn table, the arrows, the motion and the
  foldable's sizes green; of the scene checks (45 scenes × 8 sizes with axe)
  **3 fail for a reason that predates this prompt** (see "Found, not
  changed"); everything else green. Runs: the parts once in full, the scenes
  once by themselves (`OPENMANA_TABLE_ONLY=scenes`), then the whole section
  once more for the record (`reports/table-e2e/report.json`, local).
- `arenaSurface` checks: the arena without a stored choice and after a
  reload; at the 11 sizes of `TABLE_LAYOUT_SIZES` first in the board, hidden,
  no pointer, subgrid without containment, ground = board, cells = regions
  within 1 px, no scroll, nothing animated; twenty new states with a
  MutationObserver on the arena (0 records, same element); the geometry
  contract at M5 × {main-phase, expanded decision} against the drawn table
  and the hidden arena (≤ 1 px, same decision room, same number of focusable
  elements); the drawn table chosen and kept across a reload, the player's
  own picture, the arena again.
- Not run (series rule, plan §6): the complete `npm run check`, the readiness
  games, the PWA suite - once in prompt 56.

## Found, not changed

`game table (small-phone | fold-portrait | fold-landscape, target-both): the
decision's buttons outside the window` - in the recorded scene `target-both`
(Forge asks for a target with both players offered) the decision region's
action row lies below the window's edge at 360×740 (745–789 px), 690×829
(790–886 px) and 829×690 (722–818 px); the region scrolls (467 px of content
in 265 px) and the end-to-end test expects the actions in view. Measured
pixel-identical with the arena, with the drawn table (`background=table`)
and on the base commit `f9f12d5` with this prompt's changes stashed, so it
is not the arena's doing: it comes from one of the nine commits after the
last green `npm run check` of prompt 52 (`aec7e89`), most likely
`267174a` "Spieltisch: Karte beim Zielen und Bezahlen groß zeigen" (the
targeting scene shows the card large in the decision). Outside this series;
left as it is and reported in Dropzone - prompt 56's complete check will meet
it, so it should be fixed by then (by its author or in 56).

## Inventory of the old backgrounds (for prompt 56)

Everything that goes when the arena is the only surface:

- Drawn table: `src/game/table/surface-drawing.ts`, `DrawnSurface` and
  `SURFACE_DRAW_MEASURE` in `table-surface.tsx`, the rules
  `.table-surface-desk/-board/-ring` and the surface's `background: var(--table-wood)`/`contain: strict`
  in `table.css`, tokens `--table-wood`, `--table-wood-frame`, `--table-leather`
  in `src/index.css` (check other consumers: `table.css` chips, `design-tokens.test.ts`),
  tests `table-surface.test.tsx`, the drawn-table parts of
  `table-surface-picture.test.tsx`, end-to-end `surfaceFacts`, `tableSurface`
  (the 11-size and perf checks of the drawn table - keep the state-change
  measurement for the arena), the `openmana:table-surface` measure read by the
  test; mockup references in `docs/design/spieltisch-vorlage/` (history, keep)
  and `docs/implementation/37-table-surface.md` (history, keep).
- Pictures: `src/game/table/backgrounds/*.webp` (6 files), `BUILT_IN_BACKGROUNDS`,
  `PictureSurface`, `.table-surface-picture` in `table.css`,
  `assets/table-backgrounds/` (PROVENANCE.md and two HTML sources), its entry in
  `vite/notices.ts` (vendor list) and `vite/notices.test.ts`,
  `THIRD-PARTY-NOTICES.md`, the credits text in `src/routes/credits-page.tsx`
  ("Die Bilder „Farbenrad“, „Planeswalker“ und „Chip-Raster“ …"), test
  `table-surface-picture.test.tsx`; the PWA precache lists the hashed `.webp`
  assets automatically (nothing to edit beyond deleting them).
- The player's own picture: `prepareBackgroundImage`, `storedSize`, `MAX_SIDE`,
  `MAX_URL`, `BackgroundImageError`, `TABLE_BACKGROUND_IMAGE` in
  `table-background.ts`; the file picker, "Eigenes Bild auswählen/entfernen",
  `useSaveSetting` flow and the note in `table-background-options.tsx`; the
  label `display.tableBackgroundImage` in `settings-page.tsx` (line 67).
- The setting: `TABLE_BACKGROUND`/`TABLE_BACKGROUND_IMAGE`, `tableBackground`,
  `TableBackgroundChoice` in `table-background.ts`; `tableBackground` and
  `tableBackgroundImage` in `Preferences`, `DEFAULT_PREFERENCES`,
  `readPreferences` (`src/app/preferences.tsx`); the labels `display.tableBackground*`
  in `settings-page.tsx` (lines 66–67) and the "Spieltisch" card there
  (lines 138–142) with `TableBackgroundOptions`; `settings-page.test.tsx`
  (the "Spieltisch" tests); stored values in players' databases: keys
  `display.tableBackground` and `display.tableBackgroundImage` must be
  migrated or dropped by a migration (`src/storage/migrations.ts`) and
  tolerated in old backups (`local-data.schema.json` describes `display.*`
  only generally; the collection excludes `display.*`, so the cloud is not
  affected).
- Harness and tests: `background=`, `BackgroundChoice`, `BACKGROUNDS`,
  `OWN_PICTURE`, `__openmanaChooseBackground` in `table-harness.tsx`; in
  `run.ts` `chooseBackground`, the `background=table` of `tableSurface`, the
  stored-choice part of `arenaSurface` and its comparison against the drawn
  table (compare against the hidden arena only); `table-background.test.ts`.
- Docs and rules: `AGENTS.md` (table rules: the picture paragraph),
  `docs/DESIGN_SYSTEM.md` (mentions), `docs/design/SPIELTISCH.md` §4.1 and
  §4.1a (history: mark as replaced), §10, `STATUS.md` (prompt 37 and the
  picture entries), `docs/ANVIL_PARITY.md` (mention), `docs/implementation/38-table-layouts.md`
  (history, keep).

## Handoff to prompt 54

- The cells `opponent`, `field`, `hand` are placed (see the table above) and
  empty; dress them with backgrounds and absolutely positioned children only -
  nothing with a size of its own, no `contain`. The field cell spans both
  battlefields and the centre line (`1.5rem` row in quadrat/breit, the
  `center` bar's row in hoch); the centre line goes at 50 % of that cell only
  where the row between the battlefields is the middle - in hoch the `center`
  region (stack and combat) lies between them, so check where the line falls
  there before drawing it.
- The light dust belongs over the whole board: as a child of `ground` or a
  fifth piece `1 / -1` - not in the ground's `::after`, which is the cracks.
- The template's runes use the same paths as `RUNES` in `surface-drawing.ts`
  (not exported); copy them into `arena-surface.tsx`, since
  `surface-drawing.ts` goes in prompt 56.
- The harness: `background=arena|table|…`, `window.__openmanaChooseBackground`;
  the arena part of the end-to-end test alone: `OPENMANA_TABLE_ONLY=arena npm run test:e2e -- --no-build --table-only`.
- The analysis report of 2026-10-12 in Dropzone (`reports/2026-10-12-openmana-svg-arena-analyse.md`)
  describes the pre-subgrid plan; its integration points (TableSurface as
  dispatcher, the setting, the harness without PreferencesProvider) are as
  described, the harness now has the provider chain.
