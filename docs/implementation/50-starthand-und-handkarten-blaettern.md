# 50 — The start hand in full screen and browsing the hand

## Scope

The project owner's wish of 2026-10-12: before deciding "Behalten" or
"Mulligan", see the whole hand large and without cards over each other; open
one card large and swipe to the next or previous one. Central task
`dev0gig/dropzone/workflow/tasks/…/openmana-50-starthand-und-handkarten-blaettern.md`,
series *openmana-spielfluss* (48–52), step 3. No engine change; the local
candidate `engine/build/candidate-48` (protocol 10) is used unchanged.

**Forge stays the only authority.** The panel offers exactly Forge's buttons
of its start questions (`mulligan`, `mulliganBottom`) with Forge's words and
enabled state; the London mulligan's cards are marked by Forge's own
`card.tap` and shown by Forge's `highlighted`. Looking, browsing and
swiping send nothing.

## What Forge asks (the real engine, prompt 48's candidate)

Forge's London mulligan (`MulliganService`, `LondonMulligan.mulliganDraw`):
after each mulligan Forge draws seven new cards and **at once** asks for the
cards to put under the library - one per mulligan taken (`mulliganBottom`,
its OK off until the number is right, its second button "Auto") - and then asks
again whether to keep the smaller hand (`mulligan`). Each of Forge's button
updates is a new question id (the bridge withdraws and asks anew, also after
every tap during the choice). The end-to-end test plays exactly this order
with the real engine: keep-or-mulligan (7) → bottom (7, one) →
keep-or-mulligan (6) → bottom (7, two) → keep (5).

## The start hand (`StartHandView`, `src/game/start-hand-view.tsx`)

A shadcn `Dialog` in full screen built the shadcn way
(`src/components/ui/hand-spread.tsx`: `HandSpreadContent`, header, grid,
items, footer - no registry component; shadcn's overlay, popover tokens):

- **Title and words:** "Deine Starthand" (keep or mulligan) or "Karten unter
  die Bibliothek legen", how many cards (and how many are marked), Forge's
  prompt line as Forge sends it.
- **The cards:** the player's hand from every state in Forge's order, whole,
  side by side and below each other, never overlapping, as large as the room
  allows: `handSpreadFit` tries every number of columns and takes the widest
  card that lets all cards (and, in the choice, the button under each) fit
  the grid's room, at most 22 rem. Only where even the smallest readable card
  (88 px) would not fit does the grid scroll inside (a focus stop then); the
  footer stays in view. Measured, never by device: a phone upright 3 × 3
  (about 118 px), a phone turned one row of seven, a desktop 4 × 2. The
  pictures are `TablePicture`s with a fixed `sizes` of the grid's width -
  never `auto`, which gives its size up when the whole hand leaves at once
  (Chrome then starts and aborts a request per card).
- **A card:** keep or mulligan - a tap, Enter, a long press or right click
  opens it in the card view with the hand to browse (below); nothing else.
  The choice for the bottom: see "Auswahl klar, kein Flackern" below.
- **Answers:** exactly Forge's buttons (button 1 primary, button 2
  outline), Forge's enabled state with the reason ("„OK“ hat Forge gerade
  abgeschaltet."), the decision region's guards through the shared
  `useArming` (`decision-panel.tsx`): armed `ARMING_MS` after the panel
  opened, a new question, and after a card view over it closed (the press
  that closes such a view may land on a button here), a held key repeats
  nothing; nothing while Forge computes, during a concession or in a replay
  (`answerBlocked`'s words).
- **The London mulligan's choice:** a tap on the picture or the button
  under each card "Nach unten" / "Doch behalten" (`aria-pressed`; the full
  words "<Karte>: Unter die Bibliothek legen" from `cardUse`) - Forge's
  `card.tap`, the same tap as on the table; Forge's highlight is the card's
  "chosen" frame and the count; OK (once Forge enables it) confirms - one
  explicit press. The hand's own direct taps on the table are unchanged.
  Details and guards since 2026-10-14: below.
- **Closing** (X, Escape, the system's back through `CloseWatcher`) answers
  nothing: Forge's question stays in the decision region, where
  **"Starthand ansehen"** (beside the start questions only) opens the panel
  again. Presses outside the panel (a card view or a toast over it, also the
  late click of a touch that closes such a view) never close it; Escape and
  the back gesture belong to a card view over it.

### When it is open (`src/game/start-hand.ts`)

- The running game (`GamePage` passes `startHandOpens`) opens it by itself at
  each start question whose hand it has not shown - key: the step and the
  ids of the hand's cards (`startHandKey`), so a mulligan's new hand and the
  choice for the bottom open it, a tap during the choice does not reopen a
  closed panel. Not during a concession.
- After an answer from the panel it stays and says "Forge rechnet …" until
  the next start question shows its hand, and it stays across the moment
  between a withdrawn question and Forge's next one (`shown`) - a card view
  opened from it stays too.
- The game began (a turn, or any other question of Forge's): it closes, back
  to the normal table.
- A replay (and the tests' recorded scenes) opens it only through "Starthand
  ansehen", read only.

## Auswahl klar, kein Flackern (2026-10-14)

The project owner's decision after an analysis of the London choice: a tap
on the card's picture chooses it (like the table's direct step
`mulliganBottom`), a long press looks; the choice must not flicker and no
press may vanish silently.

- **What flickered.** After every tap Forge sends `question.withdrawn`, the
  state with the mark, a new question (new id) and the prompt line - each its
  own message and render (`engine-session.ts`; the recorded
  `src/test/fixtures/replay.json`, seq 11-14). In the gap without a start
  question the panel showed "Deine Starthand", dropped the count, the frames,
  every button and the 48 px under the cards (so `handSpreadFit` chose other
  cards and columns) and put a spinner in the footer; the footer's extra
  lines for "Forge rechnet gerade …" and a switched-off button changed its
  height too.
- **Held through the gap** (`holdBottom`, `answeredBottom`,
  `shownStartQuestion` in `src/game/start-hand.ts`): the last choice for the
  bottom stays shown while the hand's key (`startHandKey`) is the same - the
  title, count, Forge's words, frames, the buttons under the cards and their
  room, Forge's buttons (disabled) - marked `pending` (`data-start-pending` on
  the answers' group). Not after an answer from the panel (OK, Auto: Forge
  computes the next step, the panel says so) and not across another hand.
- **One status line** above Forge's buttons (`data-start-hand-status`,
  `role="status"`), always its own room (`min-h-4`, short words that fit one
  line on a small phone): "Forge rechnet … gleich geht es weiter." while
  Forge computes or in the gap, else the replay's or a concession's reason,
  else Forge's switched-off button; the buttons it concerns are described by
  it. No line comes or goes, so the footer keeps its height.
- **The buttons under the cards** keep their look while Forge computes
  (`aria-disabled`, no fading after every tap) - off for good (`disabled`)
  only in a replay. Forge's own buttons stay `disabled` while it computes
  (as in the decision region).
- **Arming.** The choice (picture and button) is armed once per step and
  hand and after a card view over the panel closed (`chooseKey`), never for
  each new question Forge asks after a tap: arming guards against the stray
  press of a *new* decision, and the next card's press is meant. The first
  press right after the step appeared is still dropped (the answer before
  could have been a double press). Forge's buttons keep re-arming for every
  question id (Decision Rules, unchanged).
- **Double tap.** A second press on the same card counts once only while
  Forge has not answered the first (same question id) and at most
  `ARMING_MS`: once Forge's new question shows the mark, taking the card back
  is a deliberate press and is sent at once. The panel therefore gets Forge's
  `onTapCard` directly (`game-table.tsx`), not the table's `tapCardNow`,
  whose fixed 500 ms per card would also drop a quick deliberate take-back.
- **Never silently.** A press while Forge computes (or in the gap) sends
  nothing and says why in one toast ("Die Karte wurde nicht gewählt", id
  `start-hand-choice`, the next replaces it); the page's own toast stays for
  a tap the session refuses.
- **"N von M".** Forge's `ButtonsQuestion` has no number for the step (no
  min/max; only the prompt line's words "Lege 1 Karte …"), so the count stays
  "N ausgewählt" - never a number read out of Forge's text.
- **Accessibility.** The picture is a toggle (`aria-pressed`, its name says
  what a tap and a long press do); Enter and Space choose, the context-menu
  key and Shift+F10 look (the `contextmenu` event, as on the table). The
  button under the card is the same choice with words. No gesture needs a
  path or a second finger (WCAG 2.5.1) and nothing is dragged (2.5.7). Open:
  looking needs a long press or right click on touch in this step (as at the
  table's direct steps); the card view can browse the whole hand once open.
- **Scripts.** The end-to-end real game looks at a card during the choice by
  a long press (touch) or a right click (mouse) and ignores the held choice
  (`data-start-pending`) when waiting for Forge's next question; the readiness
  player skips `aria-disabled` buttons. Not run here (the owner's order: only
  `tsc -b`, `oxlint`, `vitest run`).
- **Tests.** `start-hand.test.ts` (the hold), `start-hand-view.test.tsx` (a
  tap on the picture sends exactly one `card.tap`, a double tap once, the first
  press of the step dropped, no re-arming for Forge's next question, a quick
  deliberate take-back sent, a press in the gap gives a toast, the gap keeps
  title, count, frames, buttons and status line, another hand ends it, a long
  press and the context menu look and send nothing, a replay only looks).

## Browsing the hand in the card view (`card-view.tsx`, `card-view-model.ts`)

- Every card opened from the player's own hand - on the table (tap, long
  press, right click, keyboard) or in the start hand - gets the hand as its
  browse source (`handBrowse`: `{ kind: "zone", player: me, zone: "hand" }`),
  resolved from each state (`browseIds`), hidden cards left out.
- **Swipe** (`useSwipe`, `src/hooks/use-swipe.ts`) on the card: one finger
  to the left = the next card, to the right = the previous one, at least
  48 px and twice as far sideways as up or down. The card takes
  `touch-action: pan-y pinch-zoom`: vertical scrolling and reading with two
  fingers stay the browser's (it cancels the pointer - no swipe). No swipe:
  a second finger, a touch held still for `LONG_PRESS_MS`, a touch beginning
  within 24 px of the screen's left or right edge (the system's back
  gesture), the mouse. The click a browser may send after the release is
  swallowed (until the next press, at most 400 ms).
- **Buttons and keys:** "Vorige Karte" / "Nächste Karte" (the pressed button
  keeps the focus while the card changes), ArrowLeft / ArrowRight (a held
  key moves one card), and "3 von 7" (said once per card by a live region
  outside the card's contents). No wrapping: at the ends the button is off
  and swipes and keys stay on the card.
- **Never an input:** browsing changes only which id the view shows. Forge's
  offer (e.g. "Spiele ein Land") belongs to the card now shown and re-arms
  (`ARMING_MS`) - a swipe's release or a key can never play the card that
  slid in. A double-faced card turns only by its "Umdrehen" button.
- **A card that leaves the hand** while it is looked at (played, discarded)
  stays in view where it went ("Karte nicht mehr zu sehen" when hidden); the
  list says "Nicht mehr in deiner Hand · 6 Karten" and browses on from its
  former place (before it the card that stood before it, after it the one
  that moved up) - nothing is chosen for the player.
- Zones, piles and the stack browse the same way (their own words "Karten
  durchsehen"). The replay browses without Forge's offers.

## Tests (focused; the complete acceptance is prompt 52)

- `src/game/start-hand.test.ts` (start questions on the recorded "opening",
  keys, when it is open, the wait after an answer, the gap between
  questions), `src/components/ui/hand-spread.test.ts` (`handSpreadFit` at
  seven sizes, largest cards, scrolling, room for the buttons),
  `src/hooks/use-swipe.test.tsx` (direction, swallowed click, vertical,
  cancel, two fingers, long press, edge, mouse), `src/game/card-view-model.test.ts`
  (`browsePosition`, `handBrowse`).
- `src/game/start-hand-view.test.tsx` (the real table on the recorded
  mulligan: opens by itself, Forge's buttons armed, one answer, held keys,
  Forge's switched-off button, computing and conceding, closing answers
  nothing and "Starthand ansehen", a card opened and browsed with keys and
  buttons and the focus back on the card, re-arming after a card view,
  mulligans with new hands and the London choice built from Forge's
  messages, the gap between questions with a card view open, replay,
  only beside start questions), `src/game/card-view.test.tsx` (the hand
  browsed from the fan by swipes, re-armed play button, no swipe for
  vertical/short/mouse/edge, a card leaving the hand, replay),
  `src/game/game-page.test.tsx` (the real client: the panel opens by itself,
  its "Behalten" is one answer, it goes at the first priority; the other
  game tests close it first).
- End-to-end `npm run test:e2e -- --no-build --starthand-only` (Chrome,
  candidate engine): the recorded mulligan at the eight sizes and the
  foldable's three (cards whole, not overlapping, at least 88 px, buttons in
  view and 44 px on touch; the built London choice at four sizes; axe in each
  layout); gestures on a phone, a phone turned and a desktop (double tap,
  swipes, vertical, long press, two fingers, edge, keys, buttons, mouse drag,
  closing the view, re-armed "Behalten", Escape / X / `CloseWatcher`,
  "Starthand ansehen", a double-faced card); two real games (a thumb on a
  phone, mouse and keyboard on a desktop): the panel by itself, a card looked
  at and browsed, closed and reopened by a double press, two mulligans with
  Forge's two choices for the bottom (a card looked at in between, one taken
  back), keep, five cards on the table, a hand card browsed there, the
  replay's start hand only when asked and read only - every input counted in
  the game's recording.
- The existing end-to-end flows close the panel before they play on the
  table (`startHandAway`, in `waitForDecision` and `youAreAsked`); the
  readiness player already closes any dialog first. Their complete runs are
  part of prompt 52.

## Not done here

- Sorting the hand stays a later idea (series decision).
- The physical Fold 7 (back gesture, hinge) is not tested; Chrome's
  `CloseWatcher.requestClose()` and CSS sizes stand in.
