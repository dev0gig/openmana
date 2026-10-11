# 42 — The hand as a fan: lifting by mouse and thumb, long press

## Scope and authority

Seventh prompt of the table redesign series 36–45 (project owner, 2026-10-10;
rules in `docs/design/SPIELTISCH.md` §4.10, mockup
`docs/design/spieltisch-vorlage/`: `.hand`, `.hand-karte`, `.gehoben` in
`tisch.css` and the thumb logic at the end of `vorlage.js`). The player's hand
becomes a **fan**: overlapping cards, turned and on an arc, the card under the
mouse, under a thumb swiping over the hand or with the keyboard's focus rises
whole above the hand. This replaces the Anvil lesson "never fanned" (prompt
13) deliberately (project owner's decision 5). Only the look and the gestures
of the hand change: what a card does (`card-use.ts`), when a tap plays at once
(`DIRECT_STEPS`), the card view and every guard (`ARMING_MS`, `tapBlocked`,
the double tap, the click after a long press, repeated keys) are unchanged; no
drag and drop onto the battlefield. No engine, bridge, protocol, storage,
recording or replay change; the replay shows the same fan without input (a tap
looks).

## What was built

- **Geometry** (`handFan`, `restingCardAt` - `src/game/table/hand-fan.ts`,
  pure, `hand-fan.test.ts`): from the hand's measured content box and its
  number of cards.
  - A full card is 1.1 times as tall as the hand (at most 11.5 rem wide, the
    mockup's `--hw`) and sinks 9 % of its height below the hand's lower edge.
  - The cards overlap so all fit into the width: at least 14 % (the mockup's
    `-0.14 × --hw`), more with many cards, the outer cards' turn kept clear
    of the hand's sides. Every card keeps at least **24 px** of its own
    (`MIN_STRIP`, WCAG 2.5.8); where that leaves no room the cards get
    smaller, down to 32 px wide (`MIN_CARD`) - on a 360 px phone that is up
    to 13 cards, on a 412 px phone 15.
  - Turn and arc as the mockup's: card d places from the middle turns
    d × min(3.2°, 24°/n) and drops d² × min(1.1 %, 8 %/n) of its height,
    around its bottom centre.
  - Lifted: upright, **1.12 times a full card** - also when the fan made the
    cards smaller (then the scale is larger) -, its lower edge 0.4 rem above
    the hand's, so it stands whole above the hand, over the strips; the row
    clips only downwards (`clip-path`).
  - More cards than even small ones fit: a row (`data-fan="row"`) that
    scrolls sideways like the battlefield rows (`touch-action: pan-x`), cards
    that fit the hand's height and rise inside it, 24 px (or half a card) of
    each in view - never unreachable.
  - `restingCardAt`: the card whose own part of its **resting place** - from
    its left edge to the next card's, the last card all of it - lies under a
    pointer; beside the hand the nearest end. Resting places are layout boxes
    (`offsetLeft`), untouched by the lift and the turn, so the choice never
    jumps while the lifted card moves.
- **The hand** (`Hand` / `FannedHand` in `src/game/game-table.tsx`): still
  the toolbar "Deine Hand: N Karten" (`GameCardRow controls`, class
  `table-hand`, `data-fan`), one `GameCardRowItem` per card with
  `data-hand-card` (the card's id, a hidden card's place) and `data-lifted`
  on the lifted one; the geometry as custom properties (`--hand-card-w/-h`,
  `--hand-overlap`, `--hand-sink`, `--hand-lift-scale`, `--hand-lift-y` on the
  row, `--rot`/`--drop` per card). Measured with the new
  `useElementSize` (`src/hooks/use-element-size.ts`, content box,
  ResizeObserver, once before the first paint) - a new size or a new number
  of cards computes it again, a new state of the same hand does not. The
  lifted card belongs to the hand it was lifted in: a card played or drawn
  starts with nothing lifted.
- **Gestures** (`useFanPress`, `src/hooks/use-card-press.ts` - extended, not
  duplicated: the long press's timer, the slop and the click after a release
  are shared with `useCardPress`):
  - **Touch and pen** belong to the row: laying a finger on the hand lifts
    the card whose resting place lies under it; once the finger moves farther
    than the slop (10 px) it is a **swipe** - the card under the finger rises
    as it moves (by resting places), the long press is off. Release without a
    swipe: the browser's click is swallowed in the capture phase and the
    **lifted card's** primary activation runs instead (wherever the click
    lands - the card under the finger is the one that rose). Release after a
    swipe: **nothing** (also its click is swallowed). A long press without a
    swipe (500 ms, or Chrome's own contextmenu - once) **looks** at the lifted
    card. The row has `touch-action: none`: in the hand the swipe replaces
    sideways scrolling; the battlefield rows still scroll.
  - **Mouse**: hovering lifts the card under the pointer (by resting places;
    while it is over the lifted card - which covers its neighbours' strips -
    that one stays), leaving the hand drops it. Its clicks and right clicks
    stay each card's own (`useCardPress`'s `onClick`/`onContextMenu`; a card
    of the fan takes no pointer handlers of its own: `TableCard fan`).
  - **Keyboard**: unchanged toolbar (one Tab stop, arrows, Home, End, Enter
    looks or taps as before, the context-menu key looks); the focused card
    rises (`:focus-visible`).
  - `cardActions` (`game-table.tsx`) is the one place a card's use, primary
    activation and look come from - for `TableCard` and for the row.
- **Look** (`table.css`, "The hand"): the cards stand on the hand's lower
  edge (`align-items: flex-end`, a negative bottom margin of the sink),
  `transform-origin` at the bottom centre, `translateY(--drop) rotate(--rot)`
  at rest, `translateY(--hand-lift-y) scale(--hand-lift-scale)` lifted, a
  0.18 s `transform` transition (off under less motion by the stylesheet's two
  blocks); card corners 4.8 % of the width and a drop shadow; Forge's marks as
  before (usable: the gold frame with its glow). While a card stands out of
  it, the hand's region lies above the others (`z-index: 1`, the mockup's
  `.hand:has(.gehoben)`).
- **The board no longer scrolls** (`GameBoard`: `overflow-clip` instead of
  `overflow-hidden`): a resting card of the fan reaches below the board's
  edge, and focusing it (the toolbar's arrow keys) scrolled the whole table
  by its sink (38 px at the desktop, found by the end-to-end test); a board
  that clips is no scroll container. `handGestures` checks the board stays
  at `scrollTop` 0.
- **Hand height** (`GameBoard`): the mockup's in `quadrat`
  (`clamp(7rem, 17dvh, 11rem)`) and `breit` (`clamp(6.5rem, 18dvh, 12.5rem)`);
  `hoch` and a low `breit` window keep `clamp(6rem, 14dvh, 9rem)` (the small
  phone's battlefields keep their 80 px).
- **The AI's revealed cards** stay a toolbar of cards as before
  (`OpponentHand`), now with the table's card corners and shadow
  (`table-hand-revealed`).
- **Test harness** (`src/test/table-harness.tsx`): `hand=N` builds a hand of
  N cards from the scene's own hand cards under new ids - a presentation
  boundary the recorded games do not reach (at most seven cards), never a
  claim of Forge's.

## Decisions

- **Resting place = the card's own strip**, not its centre: with heavy
  overlap the nearest centre lies one or two cards to the left of the card
  the finger is on; the strip from a card's left edge to the next card's is
  exactly what the player sees of it at rest (and what the mouse hits), so a
  finger and the mouse choose the same card.
- **The tap acts on the lifted card**, not on the click's target: after the
  lift the lifted card covers its neighbours, but the browser's click is hit
  tested where the finger lifted - the row takes the click (capture phase)
  and acts on the card that rose, so a tap never hits a neighbour.
- **The lifted card's size is a full card's** (1.12 × the size the hand's
  height gives), also when many cards made the fan smaller - the player
  always reads the card.
- **Too many cards → a scrolling row** (from 14 cards on a 360 px phone):
  24 px per card at the least, never unreachable; there the swipe scrolls as
  in the battlefield rows, a tap or a long press works as everywhere.
- **Hand heights** as the mockup's beside the side columns (`quadrat`,
  `breit`); `hoch` and the low window unchanged (battlefields).
- **Mouse** lifts only over a card (not over the hand's empty sides); touch
  picks the nearest card also beside the fan (the mockup's).

## Deliberate deviations from the mockup

- The mockup lifts with CSS `:hover` and picks a touch by the cards' centres;
  the table lifts in code for both, by the cards' own strips (see Decisions),
  and keeps the lifted card under a mouse that moves over it.
- The mockup has no limit for many cards (its cards would overlap to
  slivers); the table keeps 24 px per card, makes cards smaller and only then
  scrolls.
- Hand height in `hoch` and the low window as before (mockup `hoch`:
  `clamp(6.5rem, 15vh, 10rem)`), because the small phone's battlefields need
  the room (80 px with a commander's seats and fourteen attackers).
- The cards' outline and glow follow Forge's marks (`data-mark`) as on the
  battlefields, not the mockup's `.spielbar` outline.

## Measurements

See the central report of the DMM run for the numbers of this machine
(Dropzone `workflow/reports/openmana-20261010T104711Z-42.md`): fan geometry
at every size (`handFacts`), the gestures (`handGestures`), the
performance at a change of turn.

## Evidence

- `npx tsc -b`, `npx oxlint`: exit 0.
- Vitest: new `src/game/table/hand-fan.test.ts` (sizes, overlap, turn and
  arc, smaller cards with many, the row, one card, 2-30 cards on the smallest
  phone, `restingCardAt`) and in `src/game/card-interaction.test.tsx` the fan's
  gestures on the real scene `discard` (a finger lifts, a swipe lifts the card
  under the finger, release after a swipe does nothing, a tap is the lifted
  card's - also when the click lands on a neighbour - and counts once, a long
  press looks once with and without Chrome's contextmenu, a swipe held still
  does nothing, the mouse lifts and keeps the lifted card, a new hand starts
  with nothing lifted, a replay's tap looks); the keyboard and every former
  interaction test unchanged and green.
- End-to-end (`scripts/e2e/run.ts`, section 12): `handFacts` in every scene
  at the eight sizes and the foldable's three (the toolbar's name, 24 px of
  each card its own and hit there, no sideways scrolling in the fan, every
  card inside the hand and the window, sinking below the edge, nothing lifted
  at rest); `handGestures` with a built hand of 12 cards at the eight sizes
  and the foldable's three (mouse: hover lifts, moving on lifts the next,
  leaving drops, a click opens the lifted card's view, keyboard focus lifts;
  touch: a finger lifts, a swipe lifts the card under it, release after the
  swipe does nothing, a tap opens the lifted card's view, a long press looks,
  a swipe held still does nothing; the lifted card stands whole above the
  hand, inside the window, on top), with screenshots at rest and lifted.
  The battlefield rows' swipe test (a full row scrolls) is unchanged. The
  live game, the readiness player and the live check press a card of the
  hand where it is its own (`cardPoint`, `scripts/readiness/player.ts`).
