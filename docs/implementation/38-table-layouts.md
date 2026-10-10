# 38 — Three table layouts by aspect ratio

## Scope and authority

Third prompt of the table redesign series 36–45 (project owner, 2026-10-10;
rules in `docs/design/SPIELTISCH.md`, mockup `docs/design/spieltisch-vorlage/`,
grid plans in its `tisch.css`). The eight regions of the game table - in a
running game and in the replay, which uses the same `GameTable` - are
arranged by the **table layout** of the window's aspect ratio (`hoch`,
`quadrat`, `breit`, plus `short` for a low window) instead of by
orientation, and the Sheets choose their side by it. Only the arrangement
changes, and as much style as the new arrangement needs; cards, strips, hand
and chronicle keep their look (prompts 39–42). Forge remains the sole
authority; no engine, bridge, protocol, storage, recording or replay change.

## What was built

- **`GameBoard`** (`src/components/ui/game-board.tsx`): one grid plan per
  layout through the variants `hoch:`/`quadrat:`/`breit:` (prompt 36) and
  `short:`. The classes without a variant are `hoch`, which is also the
  fallback of a browser that answers none of the three range queries.
  - `hoch` (< 3:4): one column - header · opponent · opponent's battlefield ·
    stack and combat (a bar) · your battlefield · you · hand · **decision**
    (the action bar at the very bottom, growing upwards).
  - `quadrat` (3:4–13:10): header across; columns
    `minmax(0,1fr) clamp(15rem,30vw,20rem)`; left the strips, the
    battlefields with a 1.5 rem centre line row between them, the hand; right
    `center` next to the opponent's half and `decision` from the centre line
    down. While `expanded` the decision takes the column from the opponent's
    battlefield down and `center` keeps a strip next to the opponent
    (`clamp(3rem,10dvh,5rem)`, scrolls).
  - `breit` (> 13:10): header across; columns
    `clamp(12rem,20vw,18rem) minmax(0,1fr) clamp(15rem,22vw,18rem)`; left
    `center`, right `decision`, both from the header to the bottom; the
    middle holds the strips, battlefields, the centre line row and the hand.
  - `breit` + `short` (≤ 32 rem high, a phone turned sideways): the side
    column of prompts 13–24 (`minmax(0,1fr) minmax(15rem,24rem)`, opponent
    next to the header, stack and combat, the decision, you next to the
    hand); an expanded decision takes both middle rows, stack and combat are
    hidden.
  - Region classes per layout: caps of the stack bar and the action bar only
    in `hoch` (`hoch:group-data-[decision=…]`), full column height beside the
    battlefields (`max-h-none`), lines between the columns.
- **Growth** (`compact | tall | expanded`, measured as before by
  `decisionNeedsRoom` and `GameTable`'s one overflow measurement per set of
  questions): `hoch` as before (28 % / 36 % of the height, the stack bar
  shrinks when expanded); `quadrat` reacts to `expanded` only; `breit` needs
  nothing (its column is full height); `breit` + `short` as before. The rules
  are in `SPIELTISCH.md` §3.3.
- **Page order** (`game-table.tsx`): the hand now comes before the decision,
  the order of `hoch` - the reading and focus order of every layout.
- **Sheets** (`card-sheet.tsx`, `zone-sheet.tsx`, `history-sheet.tsx`,
  `help-sheet.tsx`): `useTableSheetSide()` (`src/game/table/use-table-layout.ts`,
  pure `tableSheetSide` in `table-layout.ts`): from the bottom in `hoch`,
  from the right in `quadrat` and `breit`. Their content's side-dependent
  classes (`landscape:` before) follow the Sheet's own `data-side`
  (`in-data-[side=right]:`), so content and side always agree. Focus return
  is unchanged. `src/hooks/use-landscape.ts` is gone (no user left).
- **Header and empty stack** (`game-table.tsx`): `landscape:text-sm` →
  `quadrat:`/`breit:`; the empty stack is a line in `hoch` and its words in a
  column.
- **Surface** (`src/game/table/surface-drawing.ts`): `playingArea` also
  returns `middle`, the middle of the gap between the battlefields (the
  centre line row, or the stack bar in `hoch`); `surfaceLayout` centres the
  circle, the centre line and the emblem there (kept to the board's middle
  half; radius limited to 88 % of the distance to the nearer end, which is
  the old `44 %` of the height on a symmetric board). Before, they lay on
  the board's centre - up to 16 px off the gap when the opponent's strip
  wraps to two lines. `layoutKey` includes the centre, so a moved middle
  redraws the board (still only when a size changes).

## Two rows per battlefield

`TWO_ROWS_MIN_HEIGHT` stays 176 px. Measured in the new grid (scene
`main-phase`): `hoch` 164 px (360 × 740, one row each) to 283 px (480 ×
1040); `quadrat` 206–404 px; `breit` 311 px (1440 × 900); `breit` + `short`
130 px (one row). Two rows from 176 px leave cards of about 80 px; the
creatures' row lies next to the middle (`nearRow`). The end-to-end test now
checks it for every scene and size.

## Tests

- `src/components/ui/game-board.test.tsx` (new): the four plans read from
  the classes - all eight regions as rectangles, the template as large as
  the grid, each layout's arrangement, the expanded plans, the growth
  classes, and no `portrait:`/`landscape:` left.
- `src/game/table/table-layout.test.tsx`: `tableSheetSide` and
  `useTableSheetSide()` following the screen (Fold closed → open → turned).
- `src/game/table/table-surface.test.tsx`: `playingArea().middle`, the circle
  on the line between battlefields of different strip heights, the key.
- `src/game/game-table.test.tsx`: the regions' anchors and page order.
- End-to-end (`scripts/e2e/run.ts`, section 12):
  - `checkTableFits` now also calls `checkTableArrangement`: every region
    where its layout (from `tableLayoutOf`, the same decision as the CSS)
    puts it, the expanded plans, and two rows above 176 px with the
    creatures next to the middle - for every scene at the eight sizes, in the
    live game, the live resize and the replay. The "aside" rule asks for
    `breit` + `short` instead of "wider than high".
  - `tableFoldSizes` (new): every recorded and built scene at 480 × 1040,
    870 × 960 and 960 × 870 (touch): fits, arrangement, pictures, card
    targets, the decision's controls, axe-core, a screenshot.
  - The card view's side by `tableSheetSide(tableLayoutOf(…))`; the open
    card view is resized through Fold closed, open, turned and back.
  - `liveResizeCheck` resizes the live game through the eight sizes **and**
    the foldable's three: the engine's transcript and the open question stay
    byte-identical, no new Worker.
- `scripts/regression/evidence.ts`: the complete regression requires the
  foldable's sizes with every scene (`FOLD_SIZES`); its unit test proves a
  missing one is refused.

## Deliberate deviations from the mockup

- The decision column is at least 15 rem (mockup 11.5–14 rem in `quadrat`,
  13.5–16.5 rem in `breit`): Forge's questions need the room.
- In `breit` both side columns run from the header to the bottom and the hand
  stands between them (the mockup's hand row spans all three columns under
  the panels).
- `breit` + `short` keeps the arrangement of prompts 13–24 (the task: "wie
  heute"); three columns would leave a phone turned sideways about 100 px
  per battlefield instead of 130.
- Strip and hand heights stay as before (`auto`; hand
  `clamp(6rem,14dvh,9rem)`) until prompts 39 and 42.
- No `env(safe-area-inset-bottom)` on the action bar: the viewport has no
  `viewport-fit=cover`, so the inset is 0.
- The root font size does not change per layout (as `SPIELTISCH.md` §3 says).

## Readiness player

`scripts/readiness/player.ts` taps a card again only after `ARMED_AFTER_MS`
when it tapped the same card just before (`tapCard`). The table counts a
second tap on the same card within `ARMING_MS` once - its double-tap guard,
unchanged -, and the player had chosen a card in a selection and tapped it
for its view 160 ms later: the view never opened and the Fold game aborted
(found in this prompt's runs, measured with pointer and dialog logs; the
arrangement had nothing to do with it). A person cannot tap that fast on
purpose; the guard stays as it is.

## Verification

- `npm run check` with the engine of prompt 35 (`OPENMANA_ENGINE_DIR` /
  `OPENMANA_CARDS_DIR` on `engine/build/publish-35d/…`): exit 0 - schemas,
  `tsc -b`, oxlint, Vitest 80 files / 1081 tests, end-to-end "E2E OK"
  (`failures: []`, 791 axe entries without a violation, the table at the
  eight sizes and the foldable's three in every scene, the live resize
  through eleven sizes), PWA suite.
- `browserEvidence` of `scripts/regression/evidence.ts` accepts that report
  with the foldable's sizes required (792 axe checks).
- Performance (end-to-end, 412 × 915, 4× CPU throttling, 20 state changes):
  no long task with or without the surface; longest frame 75 ms (58 ms
  without the surface), the board drawn 20 times in 2.3–3.8 ms for 20 size
  changes, the desk never; five new states of one size draw nothing.
- Readiness games (`scripts/readiness/matches.ts --serve dist`): after the
  player fix all seven games passed ("all checks passed", exit 0, among them
  the Fold game at 829 × 690, now `quadrat`); the run before it hung once in
  the engine case below.
- Image comparison: Seafile `/repo/openmana/design/spieltisch-umsetzung/38/`
  (scenes `main-phase`, `commander-late`, `attack-declared`,
  `built:choose-many` at the eight sizes and the foldable's three, and the
  card view at the eight sizes).

## Found, not changed (engine)

A readiness game once hung in a selection of Kolaghans Befehl: its damage
mode asked for "any target" while the discard mode already targeted the AI
("Parent Targeted: [Forge-KI]"); the AI's seat was offered (`selectable`),
but tapping it changed nothing and was not refused as `no-effect`. Forge's
`InputSelectTargets.onPlayerSelected` only shows a message there, while the
bridge's `RunningInput.takesPlayer` let the tap through. Engine and bridge
are outside this prompt (no engine change in the table series); the same
flow passed in the other runs. A dedicated engine task should align
`takesPlayer` with the unique-target check.

## Limits

Chrome emulation only; the physical Fold (closed, open, turned) and ORYX are
checked by the project owner after the series and a push.
