# 43 — Target, attack and block arrows

## Scope and authority

Eighth prompt of the table redesign series 36–45 (project owner, 2026-10-10;
rules in `docs/design/SPIELTISCH.md` §4.15, mockup
`docs/design/spieltisch-vorlage/`: `pfeil()` in `vorlage.js`, `.pfeile`,
`.pfeil-glut`, `.pfeil-linie` in `tisch.css`, the markers `#pfeilspitze` and
`#pfeilspitze-angriff` in `index.html`). Arrows over the board show what
points at what: red from a Zauberchronik entry to each of its targets, amber
from an attacker to whom it attacks, mana blue from a blocker to its
attacker. They are pure presentation of facts that already stand in words
(the chronicle's entries and combat lines, the "Ziel" chip, the cards' and
medallions' names): hidden from screen readers, no pointer events, nothing
derived from Forge's data. No engine, bridge, protocol, storage, recording or
replay change; the replay shows the same arrows.

## What was built

- **Which arrows** (`arrowRelations`, `src/game/table/arrows.ts`, pure):
  from Forge's structured state only.
  - Target arrows: every stack item's `targets` (a card or a player), from
    its chronicle entry (`data-stack-item`). The top entry's arrows are
    **strong** (glowing, flowing), the lower entries' **muted** (thinner,
    fainter, still).
  - Attack arrows: every `combat` entry with a defender, from the attacker
    to the defending player (the medallion) or card (planeswalker, battle).
    Forge reports declared attackers in `combat` while they are still being
    declared (`attack-declared`), so the arrows show the declaration as it
    grows; `attack.defender` alone (whom a creature tapped now would attack)
    is no relation and draws nothing.
  - Block arrows: every blocker in `combat` to its attacker - also Forge's
    planned blockers while blockers are declared (`block-multiple`).
  - A card target in a graveyard or exile (`locateCard`) points at that pile
    on its player's strip (`data-zone-pile` "Friedhof" / "Exil").
- **Where** (`layoutArrows`, pure): on the boxes the page measured, in board
  coordinates.
  - The end: the four sides of the end's box (a card's face - picture and
    frame -, a medallion, a pile) at five places each (middle, 30 %/70 %,
    12 %/88 %); the head's tip lies 3 px off the side and points straight at
    it. Each place is scored: a head on a card face costs most (100 per px²),
    then outside the board, on another arrow's head (20), on a chip (2), a
    side turned away from the start (up to 80), a place off the side's
    middle (up to 7.6). The best place wins - so a head never lies on a
    card picture where any free place exists, and arrows to the same end
    spread around it.
  - The line: a cubic curve from the side of the start that faces the end's
    tip (where the line from the start's centre to the tip leaves its box,
    2 px out) to the head's base; its last control point lies straight out
    of the end's side, so it arrives at a right angle and the head stays
    outside the box. Several arrows of a kind bend alternately and a little
    more each (10 %, 15 %, 20 % … of their length, at most 80 px), the first
    towards the board's middle - they do not lie on each other.
  - Heads: strong 12 × 11 px, muted 9 × 8 px; strong arrows place their heads
    first.
- **Out of sight:** an arrow is drawn only between two things the player
  sees. The page measures each start and end as what is visible of it - its
  box cut by every clipping ancestor (a scrolling row, a region, the board)
  -, and less than 8 px either way is out of sight. A card scrolled out of
  its row (the fourteen attackers of `commander-late` on a phone), a
  chronicle entry scrolled out of its bar or a chronicle that steps aside (a
  low `breit` window with an expanded question) get **no arrow** until they
  are in view again; the chronicle's words and the card's chips say it in
  the meantime. Decided over "an arrow to the row's edge": at a row's edge
  the head would lie on the last visible card - against "no head on a card
  picture".
- **Drawing** (`TableArrows`, `src/game/table/table-arrows.tsx`, the last
  part of `GameBoard` in `game-table.tsx`, so also in the replay):
  - One wrapper `data-slot="table-arrows"` over the board (`table.css`:
    absolute, `z-index: 40`, `pointer-events: none`, `contain: strict`,
    `aria-hidden`), six SVG layers, each sized to the arrows' bounds: the
    muted arrows (still), the strong arrows' glow (blurred as a layer,
    pulsing in opacity 0.6–1, 1.4 s), their dashed line three times - phases
    a third of a dash apart that take turns in opacity (0.9 s, the mockup's
    `fliessen`), so the dashes seem to run from start to end - and the heads
    (still, on top). Only opacity moves (§8); under less motion - the
    device's or the player's - the first phase stands alone, the glow stays
    at 0.85.
  - Measured and drawn in one animation frame for: a new state (the
    relations or the cards under them), a size change of the board or a
    region (`ResizeObserver` - the window, the decision opening or closing),
    a scroll anywhere in the board (capture phase - a row, the chronicle)
    and the end of a transition (an attacker moved forward, a hand card
    lifted). Nothing is measured while there is no arrow. Each drawing is
    one User Timing measure `openmana:table-arrows`; the DOM is only written
    when the drawing changed.
  - Colours from the tokens: `--table-danger` (target), `--table-attack`
    (attack), `--table-mana` (block - the proposal of §4.9, taken in prompt
    40 for blocking cards); heads filled with a dark rim. No new token.
  - Anchors: `data-arrows` (how many are drawn) and `data-draws` on the
    wrapper; per arrow a `g[data-arrow]` (kind) with `data-from` / `data-to`
    (`stack:N`, `card:N`, `player:N`, `pile:<seat>:<zone>`), `data-strong`,
    `data-side` and `data-end` (the tip, board coordinates).
- **Built scene** (`src/test/built-scenes.ts`): the recorded scenes stop just
  short of an attacker of a planeswalker. `attack-planeswalker-declared` is
  Forge's next state after `attack-planeswalker` in the same game (the
  attackers fixture; transcript of engine build publish-35d, messages
  585 → 589, whose state 585 equals the recorded one but for `seq`): Giant
  Spider (17) attacking Garruk (68), its action "Karte aus dem Kampf
  entfernen", Forge's question 590. Exactly these changes are applied; it is
  marked as built in the harness (`?scene=attack-planeswalker-declared`),
  the unit tests and the end-to-end test (`BUILT_STATES`).

## Tests

- `src/game/table/arrows.test.ts` (node): the relations of the recorded
  scenes `stack`, `respond-own`, `blockers`, `block-multiple`,
  `attack-declared`, `attack`, `attack-planeswalker`, `main-phase`, `opening`
  and the built planeswalker attack, plus built variations (a muted lower
  entry, a target in a graveyard); the layout on a table built from those
  scenes (phone and desktop): every head 3 px beside its end, on no card,
  inside the board, arriving at a right angle; the start on its box's edge;
  several attackers to one player with different curves and heads apart; a
  start or end out of sight draws nothing; a tight row sends the head above
  or below; the board's edge; chips avoided.
- `src/game/table/table-arrows.test.tsx` (jsdom, the page's boxes answered
  by region and order): the wrapper over the board, hidden, nothing to reach,
  no SVG animation; one head per relation (combat with blockers, a stack
  target, the planeswalker), the layers' paths (glow and three phases per
  strong arrow); the replay alike; a state without relations empties every
  layer; a card out of sight gets none and gets one after a scroll; a new
  size draws again; the observers are let go.
- End-to-end, section 12 (`scripts/e2e/run.ts`):
  - `arrowFacts` in every scene - the 29 recorded ones, the built
    planeswalker attack and the nine built questions - at the eight sizes
    and the foldable's three: exactly one arrow per relation of the original
    envelopes (read independently of `arrows.ts`) whose start and end the
    player sees, none other; each tip in the window and off its end's box;
    no head on a card picture; the layer hidden, without pointer events, a
    point on a line hits what lies under it.
  - `tableArrows`: `blockers` at the eleven sizes in one page (drawn again
    for every size, every arrow checked again, the ends different); new
    states on the same page (`damage` with its expanding distribution,
    `stack`, `main-phase` - no arrows -, `blockers`); the flow and the pulse
    running and none under less motion (device and setting), then the first
    phase alone; `commander-late` at 360 × 740 with its attackers' row
    scrolled to its end: the arrows follow the attackers in view.
  - The cost of 20 state changes (`tableSurface`, 4× CPU, 412 × 915) now
    also lists the arrows' drawings (scenes with a stack target among them),
    each below 50 ms.

## Measurements

From the verified `npm run check` (engine and catalog of publish-35d):

- `arrowFacts`: 429 scene pages (39 scenes × 11 sizes), 424 arrows checked -
  every tip in the window and off its end, no head on a card picture; 38
  relations out of sight (the attackers of `commander-late` scrolled out of
  their row on phones and in a low window), none drawn for them. Sides the
  heads took: below 180, above 89, right 78, left 77.
- `tableArrows`: `blockers` drawn again at all 11 sizes with 11 different
  sets of ends; `commander-late` at 360 × 740 before / after scrolling the
  attackers' row: arrows from 205, 207–209, 211–214 → 100, 214, 216–220;
  four animations (three flow phases, the glow's pulse), none under less
  motion.
- Cost (4× CPU, 412 × 915, 20 state changes): the arrows drawn 19 times,
  0–3.8 ms each (their own work after the layout the frame needs anyway);
  longest task with the table 71 ms, longest frame 119 ms (below 200 ms).

## Deviations from the mockup

- The end is chosen among four sides and five places (the mockup: beside
  the card on the side facing the chronicle, or below the attacked card or
  medallion); attack arrows end where the head is free (often below the
  medallion, around it when many attack).
- Solid token colours (the mockup: gradients from orange-gold to red and
  light amber to amber); the heads are drawn paths with a dark rim (the
  mockup: SVG markers).
- The flow cross-fades three dash phases in opacity (the mockup animated
  `stroke-dashoffset`, which §8 does not allow); the glow is a blurred layer
  that pulses, not a blur per path.
- Lines may cross card pictures (as in the mockup), heads never; muted
  arrows for the lower stack entries (the mockup shows one arrow).
- Block arrows and arrows to planeswalkers, piles and the AI's medallion
  from below are new (the mockup has a target and attacks only).
