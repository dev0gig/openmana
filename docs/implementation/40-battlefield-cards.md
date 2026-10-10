# 40 — Cards on the battlefield: value plaque, fact chips, piles, marks, row sizes

## Scope and authority

Fifth prompt of the table redesign series 36–45 (project owner, 2026-10-10;
rules in `docs/design/SPIELTISCH.md` §4.7–4.9, mockup
`docs/design/spieltisch-vorlage/`: `.reihe`, `.karte*`, `.werte`,
`.stapel-zahl` in `tisch.css`, `karte()` and `reihe()` in `vorlage.js`). The
cards on both battlefields - in a running game and in the replay, which uses
the same `GameTable` - take the table's look. Only presentation changes:
every value is Forge's as Forge sends it (power, toughness, loyalty, damage,
counters, combat, marks), nothing is computed, compared or invented; the
pile logic of `table-model.ts`, the card view and every guard (`ARMING_MS`,
`tapBlocked`, the double-tap and repeated-key guards) are unchanged. No
engine, bridge, protocol, storage, recording or replay change.

## What was built

- **Value plaque** (`ValuePlaque`, `src/game/table/card-parts.tsx`, slot
  `game-card-plaque`): `plaqueValue()` (`table-labels.ts`) gives Forge's
  power/toughness as `"${power}/${toughness}"` or, when Forge sends none, the
  loyalty (with lucide's shield in `--table-mana` and a mana-blue rim); a card
  with both shows its power and its loyalty as a chip. The plaque is the one
  thing on a card picture: `GameCard`'s new `plaque` slot puts it into the
  card's face, outside the turned picture, so it stays upright. `table.css`
  places it on the printed value box - right `1px + 3 %`, bottom
  `1px + 4.3 %` of the picture's box (CardPicture's 1 px border included),
  so the artist and copyright line below the box stays free; on a tapped card
  at the turned box's place (left 6 %, bottom 10 % - the copyright edge is
  then the left 4.3 %). Cinzel, `--foreground` on a `--table-plaque`
  gradient with a gold rim, `clamp(9px, 13 % of the card width, 0.95rem)`.
  The face is a size container (`table-card`): the plaque shows from a card
  width of 44 px; below it the values are only in the card's title, its name
  for screen readers and the card view. It is `aria-hidden` (the card's name
  says the values). Forge's `VisibleCard` has no printed values, so nothing
  is highlighted as changed.
- **Fact chips** (`CardChip`, class `table-card-chip`): the caption strip
  below the picture is gone; `GameCardCaption` (slot `game-card-caption`,
  its `title` keeps every fact as before) is now the chip line **above** the
  picture, the card's first part (0.875 rem). Chips: the pile's "×N" (gold
  Cinzel), "Ziel" (crosshair, danger rim), "Quelle", Forge's refusal reason
  (circle-slash and `ATTACK_REFUSAL_WORDS` short), the block step's words
  (with the shield while blocking) or the blocking shield, the attacking
  swords (amber), the summoning-sickness hourglass, then `chipFacts()` -
  damage (danger rim), counters, a changed colour, "verdeckt", "ausgephast".
  Before, a refusal or the block step's words replaced the facts in the strip;
  now all of them are chips. The line never widens the card and is cut at its
  end; hidden cards ("verdeckt") and the command zone's cards ("Kommandozone",
  crown) use chips too.
- **Piles:** `GameCard`'s new `pile` draws up to two `game-card-layer` plates
  (panel tone, gold hairline) behind the front card inside `game-card-pile`,
  offset 0.12 card widths each to the left; "×N" is the first chip.
- **Tapped:** the quarter turn stays; the face is now as wide as the card is
  tall (a landscape place, no square place); nothing is darkened.
- **Marks** (`table.css`, `[data-slot="game-card-face"][data-mark]`;
  `GameCard`'s base classes give the frame's colour): usable a `--primary`
  frame with a glow (no longer dashed), chosen a `--foreground` frame plus a
  second ring (thicker) and a light glow, a stack target a `--table-danger`
  frame with a glow layer (`::after`) whose opacity pulses
  (`table-target-pulse`, still under less motion). Attacking and blocking by
  Forge's combat facts (`data-combat` on the card, new anchor), only where no
  mark of Forge's applies: attacking `--table-attack`, blocking
  `--table-mana`. An attacker moves 0.375 rem towards its opponent
  (`translate`, into the row's padding on that side). The decision region's
  words for usable cards say "gold umrandet" (were "gold gestrichelt";
  `attack-labels.ts`, `decision-panel.tsx`).
- **Row sizes** (`Field` in `game-table.tsx`: class `table-field-row`, inline
  `--u`/`--c` from `rowSize()`): `table.css` makes each battlefield row a
  size container and gives its cards one width,
  `--kw = min((height - chip line - 2 px - 4 px frame) × 63/88,
  max(2.75rem, (width - 4 px × c - gap × (c - 1)) / u), 9.5rem)`; a card's
  face is `--kw + 4 px` wide (the frame's room), a tapped one `--kh + 4 px`.
  `u` adds 1 per card, 88/63 per tapped card, 0.12 per pile card drawn
  behind; attachments count as cards (`GameCardGroup` keeps them with their
  host, now on a plate of the panel tone instead of a dashed frame that took
  room). Only when the cards are at 44 px does a row scroll sideways, as
  before. The line between a battlefield's two rows is gone (prompt 37 had
  kept it until now). The picture's corners follow the card (4.8 % of its
  width) inside these rows.
- **Tests:** `src/game/table/card-parts.test.tsx` (new: plaque, chip,
  `cardUnits`, `pileLayers`, `rowSize`), `table-labels.test.ts`
  (`plaqueValue`, `chipFacts`), `game-table.test.tsx` (pile chip "×6" and its
  two cards behind, the row's `--u`/`--c`, no separator; plaque and chips of
  a damaged target; loyalty plaque; a counter chip; `data-combat`),
  `attack.test.tsx`, `decision-panel.test.tsx` ("gold umrandet"). End-to-end
  section 12: `cardFaces` in every scene at the eight sizes and the
  foldable's three - every card inside its row (also an attacker moved
  forward and its chips), chips above the picture, a pile's "×N" and its
  cards behind, the plaque inside the picture on the value box (untapped:
  right ≤ 3 % + 2 px, bottom between 4 % and 4.3 % + 2 px; tapped: left
  5–6 %, bottom 9–10 %), shown from 44 px and hidden below, one card width
  per row and sideways scrolling only at the minimum. `SCENE_MARKS` and the
  exact `data-stack-target` check are unchanged and green.
- **Consumers of anchors:** none had to change. `game-card-caption` keeps
  every fact in its `title` (the end-to-end counts read "N Karten" there, the
  live game finds the commander by "Kommandozone"); `data-mark`,
  `data-tapped`, `data-card`, `data-stack-target` are unchanged; the
  readiness player and the live check never read a card's facts.

## Deliberate deviations from the mockup

- Chips above the picture are not in the mockup (it shows no facts besides
  the plaque and the pile's count); the task asks for them.
- A pile's cards behind are plates in the panel tone, not more copies of the
  picture (no extra picture loads), at most two (a pile of 20 lands would
  otherwise be three cards wide); its count is a chip above it, not on its
  corner.
- Both rows of a battlefield are equally high (mockup: creatures 58 %) - the
  two-row threshold measured in prompt 38 builds on it; cards are centred in
  their row (mockup: at its bottom).
- The row's lower bound is 44 px for every pointer (the mockup: 2.9–3.3 rem),
  the plaque's and a finger's size; the upper bound is the mockup's 9.5 rem.

## Measurements

- **Cards** (end-to-end `cardFaces`, 418 scene checks at the eight sizes and
  the foldable's three): 2519 battlefield cards, 1316 plaques shown and
  checked on the value box, 37 hidden on cards narrower than 44 px. The
  smallest card width per size: 44 px wherever a row is full (it scrolls
  from there, e.g. 14 attackers on a phone), 45.3 px tablet turned, 51 px
  desktop; the small phone (360 x 740) is limited by its rows' height: 41.7 px
  in `commander-late` and down to 32.2 px with an expanded question - there
  the values are only in title, name and card view, as specified. Desktop
  `main-phase`: 77 px wide cards in rows of 137 px.
- **Performance** (Chrome, 4x CPU throttling, 412 x 915, 20 state changes of
  the recorded game; `npm run check`): longest task with the table 80 ms,
  longest animation frame 149 ms (rendering 68 ms) - below the 200 ms
  budget; the surface drawn only for the 20 size changes (1.2-5.4 ms), never
  for the 5 new states of one size. The earlier `--table-only` runs measured
  74 ms / 135 ms and 69 ms / 127 ms.

## Evidence

- `npx tsc -b`, `npx oxlint`: exit 0.
- Vitest: 81 files, 1097 tests passed.
- `OPENMANA_ENGINE_DIR=engine/build/publish-35d/dist
  OPENMANA_CARDS_DIR=engine/build/publish-35d/catalog npm run check`: exit 0
  (schemas, tsc, oxlint, Vitest, "E2E OK" with `failures: []`, PWA suite);
  `browserEvidence` accepts the reports (8 viewports, 792 axe checks, 11
  worker checks). Engine verified (`engine-lock.mjs verify`: Forge
  `ed0333fe…`, manifest `a9b4c26b…`).
- `node scripts/readiness/matches.ts --serve dist`: "all checks passed", 7
  games (rakdos, control, commander, phone, walkers, grixis, fold) played
  through the real table; the known Forge case "Kolaghans Befehl" (prompt 38)
  did not occur.
- Image comparison with the mockup: Seafile
  `/repo/openmana/design/spieltisch-umsetzung/40/` (88 screenshots: scenes
  `main-phase`, `commander-late`, `attack-declared`, `attack-planeswalker`,
  `defend`, `stack`, `blockers`, `target` at the eight sizes and the
  foldable's three, plus close-ups of single cards at 3x: a normal card, a
  tapped attacker, a planeswalker, an old-frame card - "Grauer Oger" with
  "Illus. Dan Frazier" left free -, a target with damage, blockers, and the
  sheet `nahaufnahme-plaketten-desktop.png`; never committed). Cards without
  a picture (the goblin and beast tokens) keep plaque and chips readable.
- Earlier runs: the first `npm run check` stopped at one unit test whose
  expected words were escaped (`\(gold gestrichelt\)`, not replaced by the
  first edit) - fixed. Two `--table-only` runs were stopped from outside:
  once by SIGTERM (most likely earlyoom - the swap was full from a parallel
  emulator run; `--prefer node`), once by `net::ERR_NETWORK_CHANGED` while
  a scene loaded (a network change on the machine); neither had printed a
  single failure up to then. A first look in the browser found the row class
  `table-row` to be Tailwind's `display: table-row` (tailwind-merge dropped
  `flex`) - renamed to `table-field-row`; and the plaque hidden on tapped
  cards of exactly 44 px (threshold 61.5 px against 61.46) - set to 61.4 px.
