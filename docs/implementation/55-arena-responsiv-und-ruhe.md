# 55 — Arena responsive and still: M5/E matrix, reduction, reduced motion

Prompt 55 of the series *stoneboard* (53–56, Dropzone
`workflow/OPENMANA-STONEBOARD-MASTERPLAN.md`, run `stoneboard-20261014-1617`,
Claude Fable 5.1 with effort `high`), step 3 of 4: the arena of prompts 53–54
checked at every target size and in every scene, reduced where room is short,
and proven still. Only local commits; no push, no deployment.

## What changed

- **`src/game/table/table.css`**: the hand cell gets `container-type: size`
  and a query `@container (width < 30rem) or (height < 7rem)` that hides its
  runes and tendrils (the swing and the glow stay); a board rule
  `:has(.table-hand[data-fan="row"])` hides them when the hand scrolls as a
  row (hand-fan.ts "row"); the opponent cell's query rises from 36 rem to
  **48 rem** (its runes only on strips of 768 px and more - tablets turned,
  desktops). Every query sits on a decoration piece; the board's grid is
  untouched.
- **`src/game/table/arena-surface.tsx`**: six of the seventy dust points
  moved to the edges of the 1600 × 1000 box (840/776 → 1540/300, 950/826 →
  60/420, 937/812 → 1560/860, 581/704 → 520/704, 966/743 → 1100/743,
  594/737 → 520/737): with the board 480 px wide (and 360-412) the drawing's
  middle band covers it and those lay behind the hand's cards. Comments on
  the opponent's runes.
- **Tests**: `arena-surface.test.tsx` (the reduction rules in table.css: the
  queries on the cells, never on the board; what they hide; the swings never
  hidden); `scripts/e2e/run.ts` `arenaSurface` checks 21 sizes (the 11 of
  prompt 53, the four layout borders, 1024×768, 1280×720, 1920×1080,
  2560×1080, the short grid's border 1301×512/513), the reduction at seven
  sizes (what shows, the swings stay), and that nothing of the arena moves -
  by itself, under the device's `prefers-reduced-motion` and under the
  player's setting.
- **Docs**: `docs/design/SPIELTISCH.md` §4.1b "Built (prompt 55)" and the
  state; `STATUS.md`.

Untouched: `game-board.tsx`, `hand-fan.ts`, `use-card-press.ts`,
`card-use.ts`, guards, cards, gestures, the setting. No motion added (see
Decisions). No dependency.

## The matrix (pictures in Seafile `/repo/openmana/design/svg-arena/55/`)

Measured with `~/arena-work/render55.mjs` (outside the repos): for every
size and scene the same scene over the arena, over the drawn table and with
the arena hidden - regions and cards compared -, the five cells against their
regions, document scroll, what the reduction shows, collisions of visible
runes and tendrils with cards, chips, piles, medallions, captions and
buttons, animations in the arena.

**M5** (ZH 480×1040, ZQ 1040×480, OH 870×960, OQ 960×870 at DPR 2.25 and
again at DPR 1; D 1440×900) × opening (seven cards in hand), respond (stack),
attack-declared, commander-late, main-phase with an expanded decision
(`built=choose-many`), and main-phase with hands of 0, 1, 7 and 20 cards
(20 = stress hand, the harness's `hand=20`):

| Finding | Result |
|---|---|
| Regions and cards vs drawn table / vs no surface | **0 px** in every one of the 25 + 15 + 20 combinations |
| Cells on their regions, no document scroll | yes, everywhere |
| Animations in the arena | 0, everywhere |
| Hand runes and tendrils shown | ZH, OH, OQ, D: yes; ZQ (hand 96 px high): hidden |
| Opponent runes shown | D only (strip 864 px); ZH 480, ZQ 384, OH 609, OQ 672: hidden |
| Visible runes/tendrils touching chips, piles, medallions, captions, buttons | none |
| Visible hand runes/tendrils under hand cards | with 0 and 1 card none; with 7 cards (opening, respond, hand=7) and 20 cards the fan's outer cards lie over them at every size that shows them |

**E** (360×740, 412×915, 690×829, 829×690, 884×1104, 1104×884, 915×412,
1440×900, 1024×768, 1280×720, 1920×1080, 2560×1080, the borders 299/300×400
and 1300/1301×1000, the short border 1301×512/513; mobile sizes at their
device scale) × the same five scenes: the same picture - 0 px everywhere,
cells right, no scroll, no animation, no collision of visible decoration
with chips, piles or buttons; the hand's decoration hidden at 360×740
(hand 104 px high, 360 wide), 915×412 and 1301×512 (short grid); the
opponent's runes shown at 1104×884 (strip 784), 1440×900, 1920×1080,
2560×1080 and 1300×1000 (quadrat, strip 980), hidden elsewhere; with seven
cards in hand the outer cards lie over the hand's runes and tendrils wherever
they show.

Light dust at 480 px: after moving six points, **no dust point lies behind a
hand card** at 480×1040 with one or seven cards, nor at 412×915 and 360×740
with seven (before: one point with one card, three with seven at 480).

Contact sheets: `55-kontaktbogen-M5-opening-volle-hand.png` (opening at M5
and respond at D), `55-kontaktbogen-M5-attack-respond.png`,
`55-kontaktbogen-haende-reduktion.png` (hands of 0, 7, 20 at ZH, 7 at ZQ
with the hand's decoration hidden, 20 at OQ and D); single pictures of ZH,
ZQ and D opening and the seven-card hands at ZH and ZQ.

## Decisions

- **The hand's runes and tendrils stay under a fanned hand** (seven cards and
  more): the template's own picture shows seven cards over them; they are
  decoration behind the cards, cover nothing and are nearly invisible
  between fanned cards. Hiding them by card count would need a signal the
  arena must not measure; the `row` mode of the fan (a hand too full to fan)
  is such a signal and hides them, but the recorded and built hands up to 20
  cards still fan. Reduction therefore by room only: a hand cell under 30 rem
  wide or 7 rem high.
- **The opponent's runes only from 48 rem**: at 609-672 px (the foldable
  open, a tablet upright) the chip group of "opening", "respond" and
  "attack-declared" reaches the places that were free in the three scenes of
  prompt 54. Less decoration where room is short (plan §7).
- **No breathing of the warm light**: the plan allows a static arena; a
  10-second opacity animation would have to be proven harmless at 4x CPU in
  412×915 and stopped under two settings for a barely perceptible gain.
  Nothing moves, which is what the project owner asked for in the first
  place (the drawn table's ring was stilled for being restless).
- **DPR**: the mobile sizes were measured at their device scale (2.25, 2.625,
  3, 2) and at DPR 1; the layout is the same (CSS px), the drawings render
  sharp at both (SVG backgrounds).

## Tests

- `npx tsc -b`, `oxlint` (src/game/table, scripts/e2e): clean.
- Vitest, targeted: `arena-surface.test.tsx` (now 7 tests), `motion.test.ts`,
  `table-surface.test.tsx`, `table-surface-picture.test.tsx` - 32 tests green.
- End-to-end `OPENMANA_TABLE_ONLY=arena npm run test:e2e -- --no-build --table-only`:
  green - 21 sizes, reduction at 7 sizes, 0 animations (plain, device,
  setting), geometry 0 px, 20 state changes, stored choices.
- End-to-end `npm run test:e2e -- --no-build --table-only` (the whole table
  section: every scene at eight sizes with axe-core, the keyboard tour, the
  hand's gestures with the harness's recorders - inspection, scrolling and
  looking send no input -, the foldable's sizes, arrows, motion): every
  check of the arena (in all 45 scenes × 8 sizes), the drawn table, the
  arrows, the motion, the foldable's sizes, the keyboard tour, the gestures
  and axe green; the same **3 scene checks red as in prompt 53** (`target-both`,
  predates the series); one `zones (desktop)` check red because a Scryfall
  picture request was aborted when the zone sheet closed (network timing) -
  `--zones-only` run again right after: green.
- Not run (series rule, plan §6): `npm run check`, readiness games, PWA
  suite - once in prompt 56.

## Handoff to prompt 56

- Remove the drawn table, the pictures, the player's own picture and the
  setting as listed in `53-arena-grundlage-und-integration.md` ("Inventory");
  then the arena is `TableSurface` itself (or `TableSurface` goes and
  `game-table.tsx` renders `ArenaSurface`), `data-background` may stay as a
  marker for the tests or go with them. `arenaSurface` in `run.ts`: drop the
  comparison against the drawn table (keep the hidden-arena comparison),
  the stored-choice part and `chooseBackground`; `tableSurface` goes with
  the drawn table. The harness's `background=` and provider chain: the
  provider chain may stay (it is the app's), `background=` goes.
- The pre-existing finding of prompt 53 (`target-both`, the decision's
  buttons below the window at three sizes) will fail `npm run check`; it is
  not the series' doing but must be green for the complete check - fix it
  there or have its author fix it first.
