# 46 — Playing hand cards by drag and drop

## Scope and authority

The project owner's wish after the table redesign (2026-10-12: "Ich kann die
Karte nicht per Drag and Drop aufs Spielfeld ziehen … Drag and Drop fühlt
sich viel intuitiver an"); central task
`dev0gig/dropzone/workflow/tasks/…/openmana-46-karten-per-drag-and-drop.md`,
the shared rules of the table series (`reports/2026-10-10-openmana-spieltisch-regeln.md`
in Dropzone). A card of the player's own hand is played by dragging it out of
the hand onto the battlefield and letting it go - for the usual case instead
of "tap → card view → button". The project rule "no drag and drop" had been
lifted the same day (`AGENTS.md`, `docs/design/SPIELTISCH.md` §4.10).

Nothing about what a card does changes: Forge decides whether it is a land,
a creature or an instant, and every tap is still Forge's `card.tap` sent by
the page (`GameTable.onTapCard` → `EngineSession.tapCard`). No engine,
bridge, protocol, storage, recording or replay change. Tap, long press,
right click, the mouse's click and the keyboard stay as they were; cards on
the battlefield are not dragged (attacking by dragging is not part of this
task).

## What was built

- **The gesture** (`useFanPress`, `src/hooks/use-card-press.ts` - the hand's
  existing gesture hook, extended by its option `drag`; no second gesture
  system):
  - Touch and pen: a finger that leaves the hand clearly **upwards** drags
    the **lifted** card - more than `DRAG_START_PX` = 24 px up and more up
    than sideways, measured from an anchor: the lowest point since the lifted
    card rose, at the x where it rose. So a thumb may swipe to a card and
    then pull it up. A sideways swipe still only lifts (release: nothing), a
    long press still only looks (a press that looked never drags), a tap
    without moving is still the primary activation.
  - Mouse: pressed with the main button on a card and moved beyond the
    existing 10 px slop (any direction) drags the card it pressed; a click
    without moving stays the card's own (the card view or the direct tap as
    before), hovering still lifts, the right click still looks. The native
    picture drag of the browser is prevented (`dragstart`), the mouse is
    captured while it drags.
  - A drag starts with `drag.start` (the hand may say no: then the press
    goes on as a swipe), reports every move and ends with `drag.end(point)` -
    or `drag.end(null)` when cancelled: **Escape** (listened to while
    dragging), a **second finger**, the browser's **pointercancel**, or the
    hand going away. Whatever ends a drag, nothing else comes of the press:
    no tap, no look, the browser's click after it is swallowed. Two fingers
    on the hand without a drag cancel likewise.
- **The card's picture** (`HandDrag`, `src/game/table/table-motion.tsx` -
  the one file of the table that animates):
  - A copy of the card's face (the travelling ghosts' `scrubbed`: no ids, no
    slots, no names, the picture's loaded source only) at a lifted full
    card's size (`HandFan.drag` in `hand-fan.ts`: 1.12 × a full card, also
    when the hand's cards rest smaller or in a row), upright, in the motion's
    layer (`aria-hidden`, no pointer events, above the board). It follows the
    pointer by its `transform` only, held at 70 % of its height (it stands
    above a thumb, the thumb does not cover it) and kept whole inside the
    board.
  - The card itself stays in the hand, faint (`data-dragging`, opacity
    0.35); the board carries `data-hand-drag` (no text selection, a
    grabbing cursor).
  - The drop surface is measured at every move by the picture's middle: both
    battlefields together with the centre line between them (their union
    box) and the middle region (Zauberchronik / stack and combat).
  - `glow(on)`: `data-hand-drop="over"` on the board - in `table.css` the
    three regions' `::after` (an inset `--primary` ring and glow, behind the
    regions' cards: the regions are isolated while a card is dragged and the
    layer has `z-index: -1`, so nothing lies on a picture) goes from opacity
    0 to 1.
  - `back(rest)`: the picture glides to the card's resting place in the hand
    (`travelFrames`, 220 ms, `MOTION_MS.back`), then the card shows again.
  - `drop(card)`: the picture waits where it was let go and is noted as the
    board's drop. The motion of Forge's next state (`TableMotion`) starts
    the travel of that card - hand → Zauberchronik, hand → battlefield, or a
    departure - **from the drop** instead of from the hand (`fromDrop`: the
    place and the picture's size of the drop) and removes the waiting
    picture: one picture, not a second one from the hand. Without such a
    state within `DROP_WAIT_MS` (1.5 s) the picture fades
    (`dropFadeFrames`) and the card shows in the hand again.
  - Under less motion (`motionReducedNow()`, also where the browser cannot
    animate) it jumps: the picture is gone at once, nothing is noted; the
    following picture still follows the pointer (a direct manipulation, no
    animation).
- **What a drop does** (`cardDrop`, `src/game/card-use.ts`, pure): the drop
  plays the card only where Forge marks it `playable` (the gold frame) and
  offers its tap, outside the steps whose taps choose (`directTaps`: an open
  selection, payment, attack, block, the London mulligan's bottom cards) and
  only when a tap can be sent (`tapBlocked`: Forge waits, no blocking
  question, no concession on its way). Its result `{ play, reason }`:
  `reason` is `tapBlocked`'s words for a playable card that cannot be played
  now, and null for every other card - Forge sends no reason for a card it
  does not mark, so none is made up.
- **The hand** (`FannedHand`, `src/game/game-table.tsx`) wires both: the
  drag begins only where the page sends taps (a replay drags nothing) and
  for a visible card; while it moves the glow follows `cardDrop` of the
  latest state; let go over the surface, `CardControls.play` sends exactly
  one `onTapCard` - again through `cardDrop` and the table's double-tap guard
  (`lastTap`, `ARMING_MS`: the card view's and the direct taps' guard) -, and
  the picture waits for the travel. Otherwise the picture glides back and,
  for a playable card that cannot be played now, the reason shows as a toast
  at the top (`sonner`, one at a time). A card that leaves the hand while it
  is dragged (a new state) takes its picture with it. Forge's further
  questions after a played card (targets, costs, X, modes) come in the
  decision region as after a tap.
- **Words for beginners** (`PLAY_HINT`, `src/game/priority-labels.ts`): the
  player's own priority with an empty stack says "Zieh eine gold umrandete
  Karte aufs Feld oder tippe sie an – oder gib weiter." instead of "Du kannst
  jetzt eine Karte spielen – oder weitergeben." Only words; the AI's turn
  and a non-empty stack keep their sentences.

## Decisions

Made in the unattended run (changeable; also in `STATUS.md`):

- **Threshold 24 px, measured from the lowest point since the lifted card
  rose** (the task's guide value). Measuring from the press's start would
  make "swipe to a card, then pull it up" need more up than the whole swipe
  went sideways.
- **The mouse drags in any direction** beyond the slop (the task: "Drücken
  und über den bestehenden Toleranzweg hinaus ziehen"); a click without
  moving stays the card's.
- **What "playable" means for a drop:** Forge's `playable` with its tap,
  outside the steps whose taps choose (`directTaps`). A gold card named by a
  selection or chosen for the mulligan's bottom is tapped, not dragged; in a
  drop nothing happens there.
- **The reason shown:** for a playable card that cannot be played now the
  table's existing reason words (`tapBlocked` - the card view shows the
  same), as a toast; for a card Forge does not mark, nothing.
- **The drop surface by the picture's middle**, not the finger: the picture
  stands above the thumb; the battlefields' union includes the centre line
  in `quadrat`/`breit`, so the glow does not flicker between them. The
  strips ("Du", "Forge-KI") are not part of it (the task names the
  battlefields and the middle).
- **The picture at a lifted full card's size**, upright, held at 70 % of its
  height; the card in the hand faint (opacity 0.35) while dragged.
- **Waiting for the travel 1.5 s**, then fading - so a drop never shows two
  pictures and never leaves one behind.
- **The beginner's words only in the player's own turn** with an empty stack
  (the sentence that offered playing a card before); shorter variants were
  measured against the small phone's action bar (`decisionFits`).
- **Two fingers cancel any press on the hand** (before: the second finger
  started a new press) - the task's "ein zweiter Finger" as a way out.

## Measurements

- **A real game at 4× CPU, 412 × 915, production build** (readiness
  `phone --cpu-throttle 4`, touch; the player dragged 8 of its 13 plays):
  14 turns, 197 long tasks, **none over 200 ms (longest 130 ms)**, longest
  frame 266 ms (4 screenshots left out); the motion's own work at most
  33.3 ms in 96 states; 38 motions at 41 fps. Prompt 45 measured 150 ms.
- **Dragging on the dev server at 4× CPU, 412 × 915** (end-to-end
  `handDrag`, React's development build): one long task, 81 ms.
- **The picture's size** at the end-to-end sizes (a lifted full card):
  90 × 126 px on the small phone, 112 × 157 on the phone, 84 × 117 on the
  phone turned, 123-154 px wide on the foldable's and the tablet's sizes,
  142 × 198 on the desktop - always whole inside the window.

## Evidence

- Unit tests: `src/hooks/use-card-press.test.tsx` (new, 12: up → drag,
  sideways → lift only, below the threshold or more sideways → nothing, a
  swipe then up, long press → look and never drag, a drag ends the long
  press, pointercancel, Escape, a second finger, the hand saying no, the
  mouse beyond its slop, its click, Escape and the right button);
  `src/game/card-interaction.test.tsx` (11 on recorded scenes: a playable land
  dropped - the glow, the picture without ids, the faint card, exactly one
  tap -; the AI's battlefield and the middle, a second drop counted once; an
  instant at the AI's spell; back into the hand, the strip, the decision;
  not playable - no glow, no tap, no words; a concession, Forge computing,
  a blocking question - no tap, the reason shown; a selection; Escape, a
  second finger, pointercancel; the mouse; a replay; the card leaving while
  dragged); `src/game/card-use.test.ts` (`cardDrop`, 4);
  `src/game/table/table-motion.test.tsx` (4: the travel of the next state
  starts at the drop and takes the waiting picture over, the fade without
  a state, the glide back in transform/opacity, less motion);
  `hand-fan.test.ts` (the drag size); `src/app/motion.test.ts` (the new
  keyframe builder). Vitest: 90 files, 1232 tests.
- End-to-end (`scripts/e2e/run.ts`): `handDrag` on the recorded scene
  "respond" at the eight sizes and the foldable's three - glow over your
  battlefield, the AI's battlefield and the middle, the picture whole and at
  a full card's size, the card faint in the hand, exactly one tap, no view,
  back into the hand and Escape (mouse) / a second finger (touch) send
  nothing (`--table-only`: "Table E2E OK"). `dragInRealGame` in two real
  games with the real engine - mouse on the desktop, Chrome's touch input on
  the phone: a playable card taken back into the hand and a cancelled drag
  send nothing (the recording's player messages unchanged), Shock without
  mana dropped sends nothing and shows no words, a Mountain dragged onto the
  battlefield lies there, Shock dragged onto the battlefield sends exactly
  one input and Forge asks "Auswahl erforderlich · Schock" ("Select any
  target"); the AI's seat chosen, the spell resolves (life 20 → 18)
  (`--drag-only`, new focused mode: "E2E OK").
- Readiness (production build, `scripts/readiness/matches.ts`): `phone`
  (touch, 4× CPU) and `rakdos` (desktop, mouse) - all checks passed, the
  player dragged 8 and 9 times, no action without effect, no notice.
- Pictures of the drag (every size, both real games): Seafile
  `/repo/openmana/design/spieltisch-umsetzung/46/` (never committed).
- `OPENMANA_ENGINE_DIR=engine/build/publish-35d/dist
  OPENMANA_CARDS_DIR=engine/build/publish-35d/catalog npm run check`:
  schemas, `tsc -b`, oxlint, Vitest (90 files, 1232 tests), "E2E OK" with
  `failures: []` (including `handDrag` at all sizes and `dragInRealGame` on
  the desktop and the phone: AI life 20 → 18 in both), PWA suite `passed`;
  `browserEvidence` accepts the reports (8 viewports, 802 axe checks, 11
  worker checks). Engine verified (`engine-lock.mjs verify`: Forge
  `ed0333fe…`, manifest `a9b4c26b…`). The first full runs were ended by the
  host's `earlyoom` (swap full by another session's emulator and Gradle) and
  then showed one failure outside this task: the settings on a phone have
  five option rows more since the table background became selectable
  (2026-10-12), the check still expected eight - it now counts the
  background group in (`preferencesPhone`).
