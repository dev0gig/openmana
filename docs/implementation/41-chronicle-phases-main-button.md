# 41 — Zauberchronik, Phasen-Tafel, main button and action bar

## Scope and authority

Sixth prompt of the table redesign series 36–45 (project owner, 2026-10-10;
rules in `docs/design/SPIELTISCH.md` §4.11–4.14, mockup
`docs/design/spieltisch-vorlage/`: `.tafel`, `.chronik*`, `.phasen*`,
`.schritt*`, `.weiter`, `.aktionsleiste`, `.phasen-kompakt` in `tisch.css`,
`PHASEN` in `vorlage.js`). Stack and combat become the **Zauberchronik**, the
decision region becomes the **Phasen-Tafel** (quadrat, breit) or the **action
bar** (hoch) with the turn's phases, and the one button that moves the round
on becomes the large golden **main button**. Only room, arrangement and look
change: `DecisionPanel` answers every question exactly as before (the same
`SendButton`, `ARMING_MS`, confirmations, `data-meaning`, words), the stack
and combat show Forge's facts as before, the table never acts by itself. No
engine, bridge, protocol, storage, recording or replay change; the replay
shows the same table without input.

## What was built

- **Panel** (`TablePanel`, `TablePanelHead`, `TablePanelTitle`,
  `TablePanelCount`, `TablePanelSub` - `src/game/table/table-panel.tsx`,
  `table.css` `.table-panel*`): the mockup's `.tafel` - the panel tone at
  94 % darkening downwards, a gold hairline, inner and drop shadow, the two
  corner ornaments as a CSS mask filled with `--primary`, Cinzel titles in
  `--table-gold-light`. The regions `center` and `decision` are clear now (the
  desk and the board show around the panels); in hoch the decision region is
  the action bar band (panel tone mixed with black, the gold line above).
- **Zauberchronik** (`Chronicle`, `src/game/table/chronicle.tsx`, region
  "Stapel und Kampf"): heading "Zauberchronik" (screen readers also hear
  "· N Einträge") with the count; the stack as an ordered list in Forge's
  order, top first (`data-top`: gold rim and glow, "oben, wird als Nächstes
  verrechnet" for screen readers). Each entry: its card as a small
  `GameCardButton` with the whole picture (a hidden one OpenMana's back) that
  opens the card view on a tap, a long press or a right click (`useCardPress`
  - looking only, never sending; `data-stack-card`, the red target mark and
  `data-stack-target` as before), its name (`chronicle-name`), a line with
  the controller's dot (`data-controller`: `--table-mana` yours,
  `--table-danger` the Forge-KI's) and the words "Ziel: X · Zauberspruch ·
  von dir" (`chronicle-facts`), Forge's description in two lines
  (`chronicle-text`), its number (oldest 1, the top the highest). Every fact
  is also in the entry's `title`. Combat below under "Kampf" / "Blocks · noch
  nicht bestätigt": one line per attacker (`data-combat-attacker`)
  "Angreifer → Ziel · ungeblockt / geblockt von …" - the arrow is a picture
  (`aria-hidden`), screen readers get `attackLine` ("greift Forge-KI an");
  `defenderName()` (`table-labels.ts`) names the defender; alike unblocked
  attackers share a line ("13 × Goblin Token"); "Blockziel" is a chip while
  blockers are declared. `combatLines` moved here from `game-table.tsx`.
  Empty: title, "0" and "Der Stapel ist leer, niemand kämpft." In hoch the
  panel is a bar between the battlefields - title and count side by side,
  the entries side by side scrolling sideways, Forge's description and the
  combat heading only for screen readers, one cut line per attacker (the
  whole line in its title); an empty chronicle there is a gold line (its
  words for screen readers). Beside an expanded decision in quadrat a slim
  panel; in a low breit window a slim panel in the side column.
- **Phasen-Tafel** (`PhasePanel`, `src/game/table/phase-panel.tsx`):
  `phaseGroups()` (`turn-model.ts`) gives the five phases with Forge's step
  deciding each state - over, now, to come - and the steps of each; the
  first-strike damage step only while Forge is in it (Forge skips it without
  first or double strike). Short step names `STEP_SHORT_LABELS`
  (`priority-labels.ts`), the full names (`PHASE_LABELS`) as titles. Panel
  form: "Phasen" and "Zug N", the five phases with lucide symbols, only the
  current one unfolded on a gold line - past steps muted, the current one a
  gold pill with a diamond (a main phase is its own step: the phase's line is
  the gold pill). The panel is the decision region's content (`DecisionPanel
  form="panel"`, `GameDecision` with `table-panel`): alerts, phases, Forge's
  question with its parts, the answers' bar, the hint below it; at the end of
  its column in quadrat, in its middle in breit (the mockup's), as tall as it
  needs and scrolling inside the region. Folded (`data-folded`, whenever the
  region is `tall` or `expanded`; always in a low breit window): one line of
  the five symbols and "Phase · Schritt".
- **Action bar** (hoch, `form="bar"`): `useTableLayout()` places the compact
  phases (`PhasePanel place="bar"`) into the answers' bar - left the five
  symbols and "Phase · Schritt", right the answers in reverse order so the
  main button is at the right end (thumb); what does not fit wraps below it.
  Without an answer the bar shows the phases alone (`LeadBar`).
- **Answers' bar** (`GameDecisionBar`, `src/components/ui/game-decision.tsx`,
  slot `game-decision-bar`): every group of Forge's answers
  (`AnswerActions`, the group's role and name unchanged) stands in it; the bar
  sticks to the region's bottom (the actions inside it no longer do), with
  `env(safe-area-inset-bottom)` below. The hint that explains the main button
  (`PASS_NOTES`, `declareNote`, `BLOCK_CONFIRM_NOTE`) stays its description
  and comes first in the page; the panel shows it below the buttons (CSS
  `order`, centred), the action bar and a low window above them.
- **Main button** (`SendButton main`, `data-main`, class
  `table-main-button`; `isMainButton()`): Forge's pass ("Weiter" /
  "Verrechnen lassen"), the declaration ("Nicht angreifen" / "Mit N
  Kreaturen angreifen"), the blocks ("Nicht blocken" / "Blocks bestätigen"),
  Forge's first button of the mulligan's steps ("Behalten"; the cards for
  the bottom) and Forge's own OK of an attack. At most one per decision. Gold
  gradient from `--table-gold-light` over `--primary` to `--primary` mixed
  with `--table-gold-dark`, Cinzel, `--primary-foreground`, its height
  following its words; a gloss (`::after`, `table-gloss`, `transform` only,
  4.5 s) that stops under less motion and on a button that is off. The other
  buttons of the region (also the "Zug beenden …" trigger) are second: the
  panel's dark tone, a gold hairline, Forge's first button with a stronger
  gold rim.
- **Header:** the `PhaseTrack` left it (and `src/components/ui/phase-track.tsx`
  is removed - `PhasePanel` carries its slots); the help button keeps the turn
  line and Forge's step in words.

## Decisions

- **Screen readers:** the phases stay `aria-hidden`. The header's help button
  says the turn and Forge's step ("Zug 7 · Dein Zug", "Angreifer
  deklarieren"), the decision region announces Forge's questions; the phases
  are their picture. Reading them too would repeat both.
- **Main button:** only pass and the confirmations of attack, block and the
  mulligan's choice (task). The mulligan's choice is Forge's first button
  ("Behalten" while keeping or mulliganing, OK while choosing the cards for
  the bottom); Forge's own OK of an attack (`attackDeclared` without a
  declaration in progress, recorded scene `blockers`) is the attack's
  confirmation too.
- **Anchors:** `phase-track`, `phase-track-group`, `phase-track-step`,
  `data-phase`, `data-state` moved with the phases into the decision region;
  `data-stack-item`, `data-stack-card`, `data-stack-target`,
  `data-combat-attacker`, `data-meaning`, the group "Antworten, die Forge
  anbietet", `game-decision-header` and `game-decision-actions` stay.
  Consumers changed: the end-to-end test reads the track in the decision
  region (real game); unit tests (`priority.test.tsx`, `game-page.test.tsx`,
  `game-table.test.tsx`); the readiness player reads `data-phase` page-wide
  and needed no change; the live check uses the readiness player.

## Deliberate deviations from the mockup

- Phase names stay Magic's German ones ("Anfangsphase", "Kampfphase",
  "Endphase"; the mockup: "Anfang", "Kampf", "Ende") - only short step names
  were to be added.
- Forge's question with its parts stands on the Phasen-Tafel between the
  phases and the main button (the mockup has no question); the panel keeps
  the decision column's width of prompt 38 (≥ 15 rem).
- The header keeps the turn line and the step in words (screen readers).
- A chronicle entry's line names targets, kind and owner (Forge's facts, not
  the example words "Von dir gewirkt"), Forge's description is a third line;
  the combat lines are not in the mockup; an empty chronicle in hoch is a
  gold line.
- In the action bar the main button's words are 1 rem and Forge's second
  button stands left of it (a phone 412 px wide keeps phases, "Zug beenden …"
  and "Weiter" in one row; a small phone wraps the second button below).
- No `backdrop-filter` on the panels (cost per frame): 94 % panel tone.

## Measurements

- **End-to-end `panelFacts`** (`npm run check`): 418 scene checks at the
  eight sizes and the foldable's three - 114 as the action bar (hoch), 304 as
  the Phasen-Tafel (234 of them folded: every question that needs the room,
  and every scene in a low breit window), 143 with a main button (exactly the
  recorded scenes of pass, attack, block and mulligan), every chronicle in
  Forge's stack order with its cards.
- **Battlefields** (smallest per size over all scenes): small phone 81 px,
  phone 125, phone turned 121, Fold closed 154, Fold open 279 / turned 241,
  fold-portrait 223, fold-landscape 163, tablet 347, tablet turned 247,
  desktop 252. The hoch chronicle with combat lines takes 56 px
  (`commander-late` on a small phone: 82 px per battlefield).
- **Action bar** on a phone 412 px wide: phases (123 px), "Zug beenden …"
  and "Weiter" in one row, the bar 65 px high; on a small phone (360 px) the
  second button wraps below the main button.
- **Performance** (Chrome, 4x CPU throttling, 412 x 915, 20 state changes of
  the recorded game; `npm run check`): longest task with the table 64 ms,
  longest animation frame 115 ms (rendering 53 ms) - below the 200 ms
  budget; the surface drawn only for the 20 size changes (2.4-4.8 ms), never
  for the 5 new states of one size. The earlier runs measured 85 ms / 118 ms
  and 99 ms / 124 ms.
- **Motion:** the gloss runs (`table-gloss` on `::after`) and stops under the
  device's and the player's less motion (end-to-end, table surface).

## Evidence

- `npx tsc -b`, `npx oxlint`: exit 0.
- Vitest: 81 files, 1117 tests passed (new: `phaseGroups`; the main button
  per scene; action bar and Phasen-Tafel forms; folding; the chronicle's
  heading, entries, facts and combat lines; a stack card's long press looks
  only; the main button's gold contrast).
- `OPENMANA_ENGINE_DIR=engine/build/publish-35d/dist
  OPENMANA_CARDS_DIR=engine/build/publish-35d/catalog npm run check`: exit 0
  (schemas, tsc, oxlint, Vitest, "E2E OK" with `failures: []`, PWA suite);
  `browserEvidence` accepts the reports (8 viewports, 792 axe checks, 11
  worker checks). Engine verified (`engine-lock.mjs verify`: Forge
  `ed0333fe…`, manifest `a9b4c26b…`).
- `node scripts/readiness/matches.ts --serve dist`: control, commander,
  phone, grixis and fold passed in both full runs, walkers in the first; in
  both full runs the rakdos game hung in the known Forge/bridge case
  "Kolaghans Befehl" (prompt 38: a player target Forge's unique-target check
  refuses is let through by the bridge and swallowed - different turns and
  hands each time, outside the table series), and the second run lost one
  Scryfall picture request (network) in walkers. A third run of
  `--games rakdos,walkers`: "all checks passed".
- Image comparison with the mockup: Seafile
  `/repo/openmana/design/spieltisch-umsetzung/41/` (91 files: the scenes
  `main-phase`, `respond-own`, `stack`, `attack-declared`, `commander-late`,
  `block-multiple`, `opening` and `built-choose-many` - priorities, two
  stack entries, combat, blocks, the mulligan, a question that needs room - at
  the eight sizes and the foldable's three, from the end-to-end run; plus the
  mockup at 412 x 915, 870 x 960 and 1440 x 900; never committed).
- Earlier runs: the first `npm run check` found the first live decision's
  words starting with the phases (the test read the region's whole text) -
  the test now leaves the `aria-hidden` phases out; one run was stopped from
  outside during the game session (most likely earlyoom: the swap was full
  from a parallel emulator run), one by a harness page that did not load in
  300 s at Fold open (load); a look at the screenshots found the current main
  phase's words light on gold (a rule's specificity) and dim gold mixed
  through pink (oklch hue) - fixed; the next run found the decision 2-3 px
  wider than its region at fold-portrait (`scry`, `payment-pool`) - the
  Phasen-Tafel keeps 0.25 rem at the sides in quadrat and long button labels
  wrap.
