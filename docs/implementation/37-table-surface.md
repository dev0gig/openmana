# 37 — Table surface: wooden desk with the board set into it

## Scope and authority

Second prompt of the table redesign series 36–45 (project owner, 2026-10-10;
rules in `docs/design/SPIELTISCH.md`, mockup `docs/design/spieltisch-vorlage/`,
variant "Holztisch" in `arkan.js`). The game table - in a running game **and**
in the replay, which uses the same `GameTable` - gets its surface: a dark
wooden desk over the whole screen and the board set into it. The regions stay
where they were (prompt 38 moves them); cards, hand and decisions are
unchanged. Forge remains the sole authority; no engine, bridge, protocol,
storage, recording or replay change. No pictures: everything is SVG and CSS.

## What was built

- **`TableSurface`** (`src/game/table/table-surface.tsx`): the first child of
  `GameBoard` in `game-table.tsx`, behind every region (`absolute inset-0`,
  `z-index: 0`; the regions are `relative` and come later). Decoration only:
  `aria-hidden="true"`, `pointer-events: none`, nothing focusable, no text.
  No props and `memo`: a new game state never renders it again.
  - It measures the game board and the four regions the playing area is made
    of (`opponent`, `opponent-field`, `field`, `me`) with one
    `ResizeObserver` and draws only what a changed size concerns:
    - the **desk** (`data-surface="desk"`, an SVG 1:1 over the board: wood
      grain, plank joints, vignette) only when the **screen's** size changes
      (`deskKey`);
    - the **board** (`data-surface="board"`, an SVG placed at the board's
      corner, its shadow reaching out of it) and the **rune ring**
      (`data-surface="ring"`) only when the **playing area's** size or place
      changes (`layoutKey`, published as `data-board`).
    - So a decision region that grows with a question redraws the board, but
      never recomputes the desk's full-screen wood grain.
  - Each drawing is one User Timing measure `openmana:table-surface`
    (the end-to-end test reads it).
  - Desk, board and ring each have their own ids (`useId` + `d`/`b`/`r`):
    the frame repeats the desk's grain filter.
- **`surface-drawing.ts`**: pure functions from sizes to markup, nothing
  measured, nothing from the game.
  - `playingArea(regions)`: the battlefields' column; a strip counts only
    where it stands in that column (overlaps at least half its width).
    Until prompt 38 the landscape strips stand beside the battlefields, so
    there the board spans the battlefields alone.
  - `surfaceLayout(width, height, area)`: as `arkan()`/`brett()` - 6 px from
    the screen's sides, 2 px inside the area's ends, frame
    `clamp(10, 2.2 % of the shorter side, 18)`, radius
    `min(46 % width, 44 % height)`, no circle below 48 px, nothing below
    40 px; whole pixels, so equal sizes give equal keys.
  - `deskMarkup`, `boardMarkup`, `ringMarkup`: the mockup's geometry - wood
    grain and plank joints, vignette; board shadow, carved frame with grain,
    brass inlay line, leather with fine grain, inner gold line, circle light,
    three grooves (real `<circle>`s, so they stay round), 16 spokes,
    16-pointed star, centre line with diamonds, emblem with its glow, brass
    corner plates with rivets; the rune ring with the mockup's own glyphs (no
    real script), one every 24 px.
  - Colours only from tokens (`--table-wood`, `--table-wood-frame`,
    `--table-leather`, `--table-gold-light`, `--table-gold-dark`,
    `--table-mana`, `--primary`, `--foreground`, `--background`); depth is
    black or a token mixed with black. The grain filters take their colour
    from a token through `feFlood` (the mockup's colour matrices work in
    linear light, so its grain is lighter than its numbers read: wood grain
    = `--table-wood-frame` half mixed with `--table-gold-light`, leather
    grain = `--foreground` at 14 %).
- **`table.css`** is now imported (by `TableSurface`).
  - Layers: desk and board each `will-change: transform` (rasterised once per
    size), the ring a third layer.
  - Motion: `table-ring-turn` (360 s per turn, `transform`) on the ring,
    `table-ring-glimmer` (opacity 0.75–1, 4 s, as the mockup's `glimmen`) on
    its SVG; 0.85 still. Both stop under the device's
    `prefers-reduced-motion` and the player's `data-reduced-motion` (the two
    blocks from prompt 36).
  - Regions: the header a panel band with a gold hairline; strips,
    stack/combat and decision on `--table-panel` at 90 %; region lines
    `--table-gold-line`; non-empty caption strips under card pictures on the
    same panel tone. In `game-table.tsx` the battlefields' words ("Keine
    Kreaturen", "Keine weiteren Karten", empty fields) sit on the panel tone
    too (`BOARD_TEXT`). The hand lies on the desk itself.
- Test hooks: `window.__openmanaShowScene(name)` in the table harness
  (`src/test/table-harness.tsx`, test only) puts another recorded scene's state
  on the table as a fresh copy, for the state-change measurement.

## Deliberate deviations from the mockup

- The strips cover the board's top and bottom frame with their panel tone
  (they carry text until prompt 39 makes them medallions).
- In landscape the board spans the battlefields only (the strips stand beside
  them until prompt 38).
- The emblem does not glimmer; only the ring moves.
- The battlefields' row separators stay visible across the board until
  prompt 40.
- The emblem lies under the stack bar in `hoch` while the stack has items
  (as SPIELTISCH.md §3.1 intends).

## Tests

- `src/game/table/table-surface.test.tsx` (new): where the board lies
  (upright, strips beside the battlefields, no battlefield), margins and
  roundness, keys; the markup (one noise filter on the desk, two on the
  board, own ids per piece, tokens only, no colour literal, no SMIL, four
  corner plates, the circle round around the board's centre, the rune count);
  the component in the real `GameTable` on recorded scenes: first in the
  board, `aria-hidden`, no pointer events, nothing focusable; desk 1:1, board
  at its place, ring square; no duplicate ids; **no drawing for new game
  states or unchanged sizes**, a new board but the same desk when only the
  playing area changes, a new desk when the screen turns; nothing without a
  battlefield; the observer disconnects on unmount.
- `src/app/design-tokens.test.ts`: text tokens on the panel tone (90 %) over
  the brightest decoration (light gold), the wood frame, the leather and the
  wood reach 4.5:1; muted text straight on the desk reaches 4.5:1.
- `src/app/motion.test.ts`: unchanged rules, now with real motion in
  `table.css` (only transform/opacity, both less-motion blocks).
- End-to-end section 12 (`scripts/e2e/run.ts`):
  - every scene at every size: the surface first in the board, hidden, no
    pointer events, nothing hit by a pointer, the desk 1:1, the board inside
    the window, the circle round, the ring a square around it; axe as before;
  - `tableSurface`: the 11 sizes (8 e2e + Fold 480×1040, 870×960, 960×870)
    round and inside; the ring turning (360 s) and glimmering, and standing
    still under the device's and the player's less motion; 20 state changes
    of one recorded game in Chrome with 4× CPU throttling at 412×915, with and
    without the surface (long tasks, long animation frames and their
    rendering part), the desk kept through all 20, drawings only for new
    sizes, five new states of one size drawing nothing.

## Measurement

Chrome 153 with 4× CPU throttling at 412×915, 20 state changes of the
recorded game human-3-de (end-to-end section 12, `npm run check` of
2026-10-10):

| | with surface | without surface |
|---|---|---|
| long tasks (> 50 ms) | none | none |
| longest animation frame | 71 ms | 54 ms |
| its rendering part | 38 ms | 18 ms |

- The 20 changes gave 20 new playing-area sizes (7 different boards): the board
  was drawn 20 times at 2.6-4.1 ms of script each; the desk was **never**
  redrawn. Five new states of one size: no drawing at all.
- So no long task over 200 ms is caused by the surface; the separate
  `--table-only` run measured the same (longest frame 74 against 59 ms,
  rendering 28 against 28 ms).

## Limits

- Emulated Chrome only; the Fold and ORYX are checked by the project owner
  after the series.
- The board's size follows the regions until prompt 38 arranges them by the
  three layouts.
