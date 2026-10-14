# 54 — Arena dressed after the template: swings, centre line, runes, tendrils, light dust, island of light

Prompt 54 of the series *stoneboard* (53–56, Dropzone
`workflow/OPENMANA-STONEBOARD-MASTERPLAN.md`, run `stoneboard-20261014-1617`,
Claude Fable 5.1 with effort `high`), step 2 of 4: the arena of prompt 53
completed with the six remaining parts of the binding template
(`workflow/OPENMANA-ARENA-VORLAGE.html`, "G+"), iterated against the template's
screenshots with real cards. Only local commits; no push, no deployment.

## What changed

- **`src/game/table/arena-surface.tsx`**: the pieces grow from four to five
  (`ARENA_PIECES` = ground, opponent, field, hand, dust). New drawings as
  CSS custom properties in `ARENA_STYLE`: `--table-arena-hand-swing` (the
  template's two curves, `viewBox 0 0 1000 120`, `preserveAspectRatio='none'`),
  `--table-arena-opponent-swing` (one curve bending down),
  `--table-arena-dust` (the template's 70 points, `DUST_POINTS`, in a
  1600 × 1000 box with `xMidYMid slice`). `ARENA_RUNES`: the twelve glyph
  paths of the drawn table's rune ring, copied (`surface-drawing.ts` goes in
  prompt 56). Children: four `svg[data-arena-rune]` in the opponent's cell,
  six in the hand's cell, two `svg[data-arena-tendril="left|right"]` in the
  hand's cell - all `focusable="false"`, absolutely positioned, placed in
  percent of their cell. Exports: `ArenaSurface`, `ARENA_PIECES`,
  `ARENA_STYLE`, `ARENA_RUNES`.
- **`src/game/table/table.css`**: the opponent's cell with its warm glow
  (`radial-gradient` at `50% -10%`) and the swing as `::before`
  (`center / 100% 100%`), `container-type: inline-size` and a container query
  that hides its runes below 36 rem; the playing-area cell with the island of
  light (`radial-gradient(ellipse 62% 58% at 50% 50%, #ffffff07, transparent 72%)`)
  and the centre line as `::before` (`left/right 4%`, `top 50%`, 1 px,
  `linear-gradient(90deg, transparent, #c9a24a99 15%, #e8c877 50%, #c9a24a99 85%, transparent)`,
  `box-shadow: 0 0 6px #c9a24a66`, opacity 0.55); the hand's cell with its glow
  from below and the swing as `::before`; `.table-arena-dust` (`1 / -1`,
  `center / cover`, opacity 0.9); `.table-arena-rune` (gold `#e2bd62` at 0.55,
  stroke 1.1, round caps, `filter: var(--table-arena-glow, drop-shadow(0 0 2px #c9a24a66))`);
  `.table-arena-tendril` (`bottom: 6%`, `width: clamp(70px, 9vw, 120px)`,
  stroke at 0.5, `left: 1.5%` / `right: 1.5%` mirrored with `scaleX(-1)`).
- **Tests**: `arena-surface.test.tsx` (five pieces, no words, only runes and
  tendrils as children, 4 + 6 runes, two tendrils, every drawing unfocusable;
  the swings and the dust in the style, 70 points, 12 glyphs);
  `scripts/e2e/run.ts` `arenaFacts` (five pieces, 10 runes, 2 tendrils,
  unfocusable; the stored-choice check counts five pieces).
- **Docs**: `docs/design/SPIELTISCH.md` §4.1b "Built (prompt 54)" and the
  state; `STATUS.md`.

Untouched: `game-board.tsx`, `game-table.tsx`, `hand-fan.ts`, cards, gestures,
`surface-drawing.ts`, the setting, dependencies. Nothing moves; no raster
picture; no filter on a card or an ancestor.

## Iteration against the template (pictures in Seafile `/repo/openmana/design/svg-arena/54/`)

Each part was built, rendered at M5 (ZH 480×1040, ZQ 1040×480, OH 870×960,
OQ 960×870 at DPR 2.25; D 1440×900 at DPR 1) in `main-phase`, `commander-late`
and `main-phase` with `built=choose-many` (expanded decision), measured and
compared with `vorlage-*.png`.

1. **Swings, centre line, tendrils, dust, island** at the template's values:
   right at the first render - the hand's swing rises to the middle under the
   fanned card, the twin below it, the warm glow at the bottom; the opponent's
   swing passes behind the chips and the medallion; the centre line lies on
   the row between the battlefields in every layout (at ZH under the stack
   bar, as the drawn table's emblem did); the dust is faint at the edges, the
   island has no visible edge (checked at D: the brightest ground pixel in
   the playing area `37/44/56` fades to `27/35/48` without a step).
2. **Runes - first render at the template's positions** (opponent 12 %, 17 %,
   81 %, 86 %; hand 9 %, 14 %, 19 %, 79 %, 84 %, 89 %): the hand's six runes and
   both tendrils touch nothing in the three scenes at any M5 size. The
   opponent's four runes collide at **every** size: the real strip carries its
   chips ("Hand", "Standard", …) at the left end and the zone piles
   (Bibliothek, Friedhof, Exil) at the right end, where the template's mock
   strip was empty (8 collisions at ZH, 6 at D, …).
3. **Second render**: the opponent's runes moved to 31 %/36 % and 64 %/69 %
   (on the swing's descent and ascent, between the chip group, the medallion
   and the piles) and hidden below a cell width of 36 rem (container query on
   the cell: ZH's 480 px strip and ZQ's 384 px side strip show none). One
   collision left: at OH the rune at 69 % (x = 420) touches the pile group
   that starts at 419.
4. **Control render**: 34 %/39 % and 61 %/66 % (symmetric around the medallion):
   **0 collisions** of runes and tendrils with cards, chips, piles, medallions,
   captions or buttons at all 15 M5 × scene combinations. Contact sheets
   `54-kontaktbogen-M5-main-phase-kontrollrender.png` and
   `54-kontaktbogen-M5-commander-late-und-entscheidung.png`, single pictures
   `54-arena-<size>-<scene>.png`.
5. **Null-filter version** (`--table-arena-glow: none` on the surface,
   `54-arena-<size>-main-phase-nullfilter.png`): the arena stands without the
   runes' glow - the difference is a two-pixel halo on ten 10-px glyphs.

Budget: 36 DOM elements in the arena (5 pieces, 10 runes with one path each,
2 tendrils with four paths each; ≤ 60), 12 `svg`, **10 filters at runtime**
(the runes' `drop-shadow`; none on the tendrils, the tiles are backgrounds
rendered once), 0 raster pictures, 0 animations.

Geometry (prompt 53's contract, `render.mjs` at M5 × {main-phase,
expanded decision}): every region and card at the same place over the arena,
the drawn table and with the arena hidden - **0 px**; the cells on their
regions; no scroll; 0 surface hits; 0 focusable elements in the arena.
`container-type: inline-size` on the opponent's cell does not disturb the
subgrid (measured).

## Decisions

- **The opponent's runes do not sit at the swing's ends** as in the template
  but at 34/39 % and 61/66 %, and not at all on strips narrower than 36 rem:
  the template's criterion "touch no chips" and its positions contradict each
  other on the real strip; the places between the chip groups and the
  medallion keep the runes on the swing. The hand's runes and tendrils keep the
  template's positions.
- **Hands of seven and twenty cards** (measured besides the prompt's scenes,
  for prompt 55): the fan covers the ends of the hand cell at every M5 size,
  so the hand's runes and tendrils lie under the outer cards (as in the
  template's own picture with seven cards). An empty hand touches nothing.
  Prompt 55 decides the reduction (the plan's §7); a CSS-only way without
  measuring: `[data-slot="game-board"]:has([data-area="hand"] …)` on a count
  the hand already renders, or a container query on the hand cell's width.
- **The glow stays** (10 tiny `drop-shadow`s on the runes); the null-filter
  version is proven and one custom property away.
- **The dust is a fifth piece**, not the ground's `::after` (that is the
  cracks); the template's accidental override is thereby undone.

## Tests

- `npx tsc -b`, `oxlint` (src/game/table, scripts/e2e): clean.
- Vitest, targeted: `arena-surface.test.tsx`, `table-surface.test.tsx`,
  `table-surface-picture.test.tsx`, `motion.test.ts`, `design-tokens.test.ts`,
  `settings-page.test.tsx` - 6 files, 146 tests green.
- End-to-end `OPENMANA_TABLE_ONLY=arena npm run test:e2e -- --no-build --table-only`:
  green (11 sizes, geometry 0 px, 20 state changes, stored choices).
- End-to-end `npm run test:e2e -- --no-build --table-only` (the whole table
  section; `arenaFacts` now runs in every scene at every size): every check
  of the arena (also in all 45 scenes × 8 sizes), the drawn table, the arrows,
  the motion and the foldable's sizes green; the same **3 scene checks red as
  in prompt 53** (`target-both`, the decision's buttons below the window at
  360×740, 690×829, 829×690 - predates the series, see
  `53-arena-grundlage-und-integration.md` "Found, not changed").
- Not run (series rule, plan §6): `npm run check`, readiness games, PWA
  suite - once in prompt 56.

## Handoff to prompt 55

- Reduction where room is short: the hand's runes and tendrils under a wide
  fan (seven cards and more at every M5 size), the opponent's runes already
  hidden below 36 rem; `short:` windows (ZQ) keep the hand's swing and the
  tendrils (checked at 1040×480 with one card: free). Do it on the
  decoration pieces only (container query or `:has()` on the board), never
  on the real grid.
- `prefers-reduced-motion` and the app's setting: nothing moves today
  (0 animations in the arena, checked by `arenaFacts`); the optional
  breathing of the warm light is a `transform`/`opacity`-only animation on
  the opponent's glow at most, and must be off under both.
- Harness: `background=arena`, `hand=N`, `built=choose-many`;
  `OPENMANA_TABLE_ONLY=arena` for the arena part alone;
  `~/arena-work/render54.mjs` (outside the repos) measured the collisions.
