# 44 — Motion: travelling cards, tapping, damage, life, stack and phases

## Scope and authority

Ninth prompt of the table redesign series 36–45 (project owner, 2026-10-10;
rules in `docs/design/SPIELTISCH.md` §8, which this prompt fills in as
"Built"). The table comes alive - inspired by Arena, in OpenMana's own style:
cards move visibly from place to place, tapping turns, damage and life totals
react, phase changes and the stack resolving are felt - **without ever
delaying an input or a state**. Pure presentation: no engine, bridge,
protocol, storage, recording or replay-format change; no text, history entry
or rule comes from it. The mockup (`docs/design/spieltisch-vorlage/`) is
static apart from its continuous decoration; the motion of state changes has
no model there.

## What was built

- **One component** moves the table in code: `TableMotion`
  (`src/game/table/table-motion.tsx`, a class component - it needs
  `getSnapshotBeforeUpdate` -, the last part of `GameBoard`, in game and
  replay). The pure rules and every keyframe are in
  `src/game/table/motion-plan.ts`. Web Animations of `transform` and
  `opacity` only.
- **Timing per state:**
  1. Before React changes the page: everything still moving is cancelled
     (pictures jump to their places, ghosts go), then - unless less motion is
     asked for, `animate` is false or the browser has no Web Animations - the
     old places are read (every card face of the table, the Zauberchronik
     entries, the phases' gold marker).
  2. At the next animation frame (before it is painted, after React's own
     follow-up render of the same moment - a decision that grows takes room
     right after the state): the new places are read in one go, then the
     ghosts are added and the animations start.
  3. A state that comes before that frame skips the motion of the one
     before; a further state during the motion stops it (step 1). Nothing is
     queued, nothing waits, nothing is sent.
- **Identity** only by the `data-card` id (a Zauberchronik card's
  `data-stack-card`; a battlefield pile carries all its ids in the new
  attribute `data-pile-cards`, so a card joining or leaving a pile travels
  there). Forge keeps the id across zones - measured in the engine's test
  transcripts (publish-35d, 15 games): battlefield → graveyard 52 times with
  the same id, hand → battlefield 82, stack → graveyard 19, stack →
  battlefield 7; only a token disappeared (it ceases to exist). While a spell
  is paid for, Forge shows its card in no zone: it leaves the hand and
  appears on the stack a few states later - the card's last place is
  remembered for 15 s and it travels from there.
- **Travel** (the card is a new element - another region or row): a ghost, a
  copy of the old face (its loaded picture source, synchronously decoded;
  a picture still loading is left out - a ghost never asks the network; an
  arriving card without a loaded picture travels as OpenMana's back), with
  every id, slot, name and the plaque removed, in the layer
  `data-slot="table-motion"` (z-index 45, above the arrows, no pointer
  events, `aria-hidden`), glides 340 ms from the old place to the new one -
  scaled by the long sides, turned with the fanned hand. The card itself is
  at its new place at once, invisible until the ghost arrives and clickable
  all the time. At most 16 ghosts per state.
- **Shift** (the same element moved: neighbours came or went, the decision
  region grew, an attacker moved forward - "Angreifer rücken vor"): the
  card's parts (chip line and face) move from where they were back to rest in
  260 ms; the button itself - the control - never moves, its moving parts
  take no pointer (`table-motion-moving`).
- **Turn:** when Forge's `tapped` changes the picture turns a quarter (to the
  right when tapped), 240 ms.
- **Arrival** without an old place: a card in the player's hand comes from the
  library pile, a card of the opponent from the opponent's hand (or
  medallion); other cards grow into their place.
- **Departure:** to the graveyard or exile pile of its player only when Forge
  shows the same id there now (shrinking and fading into it); otherwise it
  fades where it was.
- **Effects from Forge's log** (the entries since the last state; they come
  before the state they explain). Only kinds Forge sends - counted in the
  transcripts: `DAMAGE` 339 (336 with a card: the damage's source),
  `STACK_ADD` 202, `STACK_RESOLVE` 208; `TURN`, `COMBAT`, `LAND`, `LIFE`,
  `ZONE_CHANGE`, `MULLIGAN`, `GAME_OUTCOME`, `MATCH_RESULTS`, `DISCARD` exist
  too and are ignored:
  - `DAMAGE` with a card: that card (if on the table) flashes red - a glow
    layer around the picture (`[data-slot="game-card-face"]::before`, only its
    opacity animates, nothing on the picture).
  - A battlefield card whose Forge damage grew shakes (added to its other
    motion) and flashes.
  - `STACK_ADD`: the new Zauberchronik entry glides in (without it: fades in).
  - `STACK_RESOLVE`: a gone entry dissolves (grows and fades; without it:
    fades). A permanent that resolves travels on as its own ghost.
- **Life:** when Forge's life total changes, the number pulses and the
  medallion's new ring of light (`.table-medallion-flash`) flashes red for a
  loss, green for a gain - new token `--table-heal` `oklch(0.78 0.16 150)`
  (3:1 on leather, wood frame, panel and plaque, `design-tokens.test.ts`).
  Forge's `LIFE` entry names nobody in structured form, so the number's change
  is what moves.
- **Phases:** the gold marker (the current step in the Phasen-Tafel, the
  current phase in the compact line) glides from the old place to the new one.
- **Priority:** a new priority question of Forge's (its id) makes the main
  button's gloss (`::after`) sweep across once.
- **Arrows** (prompt 43) do not draw while cards travel and draw again at the
  end of the motion (`openmana:table-motion-end`).
- **Less motion:** `motionReducedNow()` (new in `src/app/motion.ts`: the
  device's query or `<html data-reduced-motion>`) is asked before anything is
  read; `watchReducedMotion()` stops what runs when either changes. CSS's
  `animation: none` would not stop Web Animations - the component asks itself.
- **Replay:** `GameTable` has a new prop `animate` (default true); the replay
  page passes false when a move went over more than one step ("Ende", "Zum
  Schritt", "Anfang" from far).

## Tests

- `src/game/table/motion-plan.test.ts` (10): the recorded run passes the
  protocol's checks; Forge keeps ids hand → battlefield and battlefield →
  graveyard; **a move only for the same id** (another id at the same place is
  an arrival and a departure); shift, turn; the ghost's keyframes; every
  keyframe only transform/opacity and briefly; log entries since the last
  state (none when the log was cut back); damage sources and damaged cards,
  life loss/gain, stack changes, whose a card is.
- `src/game/table/table-motion.test.tsx` (14): the real `GameTable` on the
  recorded run with stand-in boxes and a recording `element.animate`: a drawn
  card travels from the library, the card itself never moves; a land travels
  onto its pile without hiding it; **a click during a travel hits the card**
  (its card view opens); **no motion under less motion** (the setting and the
  device), switching it on stops what runs; a replay jump changes at once;
  **a further state cancels** every animation and ghost and tells the arrows;
  a state before the frame skips the motion; at the end the ghosts go; spell
  cast (entry glides, source flashes, damaged card shakes with `composite:
  "add"`), resolution (dissolve, two cards to the graveyard), life loss
  (red), tapping and untapping.
- `src/app/motion.test.ts`: only `table-motion.tsx` calls `element.animate`;
  it imports `motionReducedNow` and `watchReducedMotion` and asks less motion
  first; every `.animate(` takes a builder of `motion-plan.ts` (no keyframes
  written in place); `MOTION_PROPERTIES` is transform and opacity.
- `src/app/design-tokens.test.ts`: `--table-heal` mapped and 3:1.
- The recorded run: `src/test/table-sequence.ts` with
  `src/test/fixtures/table-sequence.json` - 25 consecutive real states of the
  test game human-3-de (turn 6 to 8: a draw, a land, an attack with combat
  damage and life loss, the AI's land and creature, untap, a spell with
  damage, its resolution, the Goblin in the graveyard), recorded unedited by
  `scripts/record-table-sequence.ts` (`--transcripts
  engine/build/publish-35d/report/transcripts --manifest
  engine/build/publish-35d/dist/engine-manifest.json`). The harness shows it
  with `?sequence=first-attack[&step=N]`, `window.__openmanaShowStep(n)`.
- End-to-end `tableMotion` (section 12): the whole run at 412 × 915 - what
  each state moved (`data-last`), only transform/opacity, no leftovers; a
  click on the travelling card's new place (motion slowed 10× through the
  DevTools animation domain) hits it and opens the card view; a further state
  cancels; two states before a frame run one motion; less motion (device and
  setting) moves nothing; the image sequence (20× slower: three pictures and
  one at rest per moment, phone and desktop); the cost with 4× CPU with and
  without motion. `tableArrows` and the replay checks wait for the motion
  (`motionSettled`); the replay checks that stepping animates (two steps) and
  jumping to the end does not.
- Readiness: `scripts/readiness/matches.ts --cpu-throttle <rate>` measures a
  real game's long tasks, long frames (with the scripts and rendering of the
  slowest), the motion's work and the frame rate while the motion runs,
  leaving out the test's own screenshots; `--less-motion` plays it with the
  player's setting. The readiness player presses a hand card that a lifted
  neighbour covers whole (the keyboard's focus lifts a card after its view
  closed with Escape) on its resting place, as a thumb does
  (`restingPoint`, forced past Playwright's hit check - the hand picks by
  resting places); found by the first runs under less motion.

## Measurements

- **End-to-end `tableMotion`** (dev server, Chrome 153, 412 × 915): the 24
  changes of the recorded run moved 14 travels, 113 shifts, 5 turns, 19
  phase glides, 2 shimmers, 3 flashes, 1 shake, 1 life loss, 1 entry gliding
  in, 1 dissolving, 2 cards into the graveyard, 1 card fading; every
  animation transform/opacity only, nothing left after the motion. A tap on
  the travelling card's new place hit it (card view opened during the
  motion); a further state cancelled 7 of 7 running animations and removed
  the ghost; two states before a frame ran one motion; device and setting
  less motion: 0 animations, 0 ghosts.
- **Cost on the dev server, 4× CPU** (`npm run check`, run 7): long tasks
  with motion longest 97 ms (longest frame 124 ms), without motion longest
  90 ms (frame 98 ms); the motion's own work per state 1.4-23.7 ms; frame
  rate while cards travel 41.5 fps at the slowest, median 58.6 fps.
- **A real game, production build, 4× CPU, 412 × 915** (readiness `phone`,
  `--cpu-throttle 4`, three games with motion): **no long task over 200 ms**
  - longest 169 ms (16 turns), 152 ms (15 turns), 159 ms (22 turns); the
  motion's own work at most 46 ms per state; 49 / 46 / 91 motions at 42.9 /
  40.4 / 42.2 fps on average while something moved (the slowest single
  motion 5.5-8.6 fps: one that met a burst of the engine's messages). The
  same game under less motion (`--less-motion`, three games): longest 207,
  189 and 176 ms - the 4× slowed engine messages and React render set the
  pace, not the motion. The test's turn screenshots are left out (their
  capture is a 220-270 ms painting frame with or without motion; reported).
- **Readiness, all seven games** (production build, unthrottled): all checks
  passed (see the task's report for the run).

## Deviations and assumptions

- The mockup has no state-change motion; the timings (travel 340 ms, shift
  260 ms, tap 240 ms, flash 460 ms) and the eases are this prompt's choice.
- A card shifting within its row moves only its picture and chips - the
  mockup's `.karte` moved the whole card with a CSS transition, which would
  move the click target.
- The damage flash follows Forge's `DAMAGE` entry's card, which is the
  damage's **source**; the damaged card shakes because its Forge damage grew
  (a value shown, like the life total).
- Arrivals with no remembered place come from the library (the player's hand)
  or the opponent's hand; an arriving picture not yet loaded travels as the
  card back.
- Cards in the decision region (questions' rows) and in Sheets do not travel.
- Stepping backwards in the replay animates too (one step is "stepping").
