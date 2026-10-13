# 51 — Land plays and refused actions, said plainly

## Scope

The project owner's wish of 2026-10-12: see how many lands one has played
this turn, and understand why an action one wants is not possible now. Two
lands lying on the battlefield do not mean both were played in the same turn.
Central task `dev0gig/dropzone/workflow/tasks/…/openmana-51-laender-und-aktionshinweise.md`,
series *openmana-spielfluss* (48–52), step 4. No engine change; the local
candidate `engine/build/candidate-48` (protocol 10) is used unchanged.

There was **no confirmed rule error with lands** (series clarification
2026-10-13): Forge refused the second land of the video correctly; the AI's
turn was only hard to see (prompt 49). This prompt adds no Magic rule to the
app. **Forge stays the only authority:** every number and every reason comes
from Forge's land facts of prompt 48 (`Player.landsPlayed`, `landsAllowed`,
`landsUnlimited`; `VisibleCard.landRefusal` from Forge's own check
`Player.landPlayRefusal`, Forge patch 0010), never from the cards on the
battlefield, a card's type or text.

## The player's land plays on the strip (`LandPlays` in `game-table.tsx`)

A chip on the player's own strip, beside the hand's count
(`data-strip-fact="lands"`, `landPlayFact` in `src/game/land-labels.ts`):

| Moment | Chip | Sentence (title, screen readers) |
|---|---|---|
| Before the first turn (the start questions) | none | – |
| The player's turn | "Länder 0/1", "Länder 1/1" – Forge's `landsPlayed`/`landsAllowed` (an effect such as Exploration: "1/2", "2/2") | "In diesem Zug hast du 1 von 1 Land gespielt, die Forge dir erlaubt." + when used up the limit's reason |
| Forge's `landsUnlimited` | "Länder 2 · unbegrenzt" | "… Forge erlaubt dir gerade beliebig viele." |
| The AI's turn | "Kein Land im KI-Zug" | "Im Zug der Forge-KI bietet Forge dir kein Land zum Spielen an – deine Länder spielst du in deinem eigenen Zug." |

- The count is Forge's count of land **plays** this turn: a land put onto the
  battlefield by an effect (Rampant Growth) does not change it, the next own
  turn starts at 0 although lands lie on the battlefield, and the first and
  second main phase share it - all Forge's, the chip only shows the numbers.
- In the AI's turn Forge counts the AI's turn and its own check refuses a
  land play first with `notYourTurn` (CR 305.3, the first check of
  `landPlayRefusal`), so the chip says that instead of "0/1", which would look
  available.
- `data-lands-turn` (`mine`/`opponent`) and `data-lands-used` carry the state
  for tests; the visible words are `aria-hidden`, the sentence is the chip's
  `title` and its screen-reader text.
- Replays show the recorded numbers (they are the state).

## Why not (`cardRefusal` in `src/game/card-use.ts`)

One answer for the card view, a failed drag and the strip:

- **`forge`** – Forge's own reason: why it would not let the player play a
  land of their hand now (`landRefusal`, words in `LAND_REFUSAL_WORDS`:
  "Länder spielst du nur in deinem eigenen Zug.", "Ein Land spielst du nur in
  deiner Hauptphase, wenn der Stapel leer ist.", "Die Karte gehört nicht dir …",
  "Von hier aus erlaubt Forge dir nicht …", "Ein Effekt verbietet dir gerade …",
  "Dein Land für diesen Zug ist bereits gespielt." / with more than one
  allowed "Deine Länder für diesen Zug sind bereits gespielt."), and – reused,
  unchanged – why it would not declare a creature an attacker (prompt 18,
  `ATTACK_REFUSAL_WORDS`);
- **`table`** – Forge offers the tap but none can be sent now (`tapBlocked`:
  Forge computes, a blocking question waits, a concession is on its way);
- **`unknown`** – a card of the player's hand Forge offers nothing for and
  names no reason for: honestly "Forge bietet diese Aktion gerade nicht an."
  (on a drop) / "Mit dieser Karte bietet Forge gerade nichts an." (in the card
  view). No missing mana, wrong target or card effect is ever claimed.
- Null where nothing is refused, for the opponent's cards and cards outside
  the hand (looked at only), and for the hand before the game begins: the
  start questions only look (Forge already sends `notYourTurn` on the opening
  hand; saying it there would only confuse).
- The land facts reach it through the table's moment
  (`TableMoment.lands = momentLands(state)`: the game begun, Forge's limit for
  the plural words) - without them a land's reason is not used: unknown stays
  unknown. Forge's `playable` marker wins over its land check (it knows
  permissions the check does not see); a card it marks is offered its tap.

### In the card view (`card-view.tsx`)

Where Forge offers no tap, a **refusal note** stands where the button would be
(`data-slot="card-view-refusal"`, `data-refusal` = Forge's land reason or the
source): under the card (stacked) or under the keyword boxes, never on the
card, in the view's text colour on the darkening. It follows every state like
the offer (a land played meanwhile turns the button into the note; the next
turn brings the button back, armed afresh) and every card browsed (prompt 50),
and never pops anything up. The table's own reasons stay under the disabled
button as before. In a replay (no taps) nothing is shown; the screen-reader
description names Forge's reason ("Forge ließ das Land nicht spielen: …").
A spell Forge names its action for but does not mark playable (Grizzly Bears
without mana: "cast spell") keeps Forge's offer as an unmarked button as
before - Forge's words, Forge refuses it if pressed (`input.rejected`).

### On a failed drag (`cardDrop`, `game-table.tsx`)

A hand card dropped on the battlefield that Forge does not play now: nothing is
sent, the card glides back, and one toast (`id: "hand-drop"`, the next drop
replaces it) says why - read **from the moment of the drop**, never from the
one the drag began in: the table's reason, Forge's land reason, or that Forge
does not offer this action (also in a step whose taps choose: a selection,
payment, attack, block, the mulligan's bottom). Before prompt 51 a card Forge
did not mark said nothing. Looking, lifting, swiping over the hand, cancelling
or dragging back over the hand show nothing.

### What stays

- Forge's check remains the only check: the chip and the notes are no
  substitute. A tap Forge does not take still comes back as `input.rejected`
  and shows as Forge's notice (unchanged).
- All guards stay: the card view's arming and repeated keys, the table's
  double-tap guard for drops, `tapBlocked`, the observation hold's refusal,
  replay read-only, inspection of every card (also unplayable ones), browsing
  the hand.
- The decision region's words are unchanged (no new line there: the
  battlefields keep their 80 px on a small phone); the strip's chip carries
  the limit's sentence instead.

## Tests (focused; the complete acceptance is prompt 52)

- **Real land plays:** `scripts/record-land-plays.ts` takes nine moments of
  the fixture game `lands` of the candidate's focused engine run (green lands,
  Exploration, Rampant Growth against red; transcripts in
  `engine/build/candidate-48/report/transcripts`) into
  `src/test/fixtures/land-plays.json` (`src/test/land-plays.ts`): before the
  start, the AI's turn, the first land (0/1), the land played (1/1, the others
  `limit`), Forge's `timing`, the next own turn (the refused land playable
  again), Exploration (1/2 with a land playable, 2/2) and Rampant Growth's land
  (one land more on the battlefield, Forge's count unchanged). Each is the
  first moment matching its rule, decided from structured messages only.
- `src/game/land-labels.test.ts` (the chip's words on those moments,
  `landsUnlimited` built from a real one and marked so, every reason's words),
  `src/game/card-use.test.ts` (`cardRefusal` and `cardDrop`: first land
  played, second refused, next turn allowed, Exploration, `notYourTurn`,
  `timing`, unknown, before the start, without land facts, the table's
  reason, the attack's reason, the opponent's cards),
  `src/game/land-hints.test.tsx` (the strip on the real moments and in a
  replay, the card view's note, browsing, a state change with the view open
  and re-arming, replay and start questions, the drop's toast once, swiping
  without toasts, a state change during the drag in both directions), and the
  adapted `card-interaction.test.tsx` and `attack.test.tsx`.
- **Chrome** (`npm run test:e2e -- --no-build --lands-only`): the recorded
  scenes `main-phase`, `cast-x`, `respond`, `opening` in the real table at the
  eight sizes and the foldable's three (the chip, the strip not spilling, the
  battlefields' room, axe at four sizes); on a phone, a phone turned, the
  foldable closed and a desktop the card view's note (long press, right
  click, Enter), browsing, axe, and refused drops; two real games with the
  candidate engine (phone touch, desktop mouse), Forge's auto-pass "Immer
  fragen": the first land 0/1 → 1/1, the second refused in the card view and
  on a drop with nothing sent, Exploration 1/2 → 2/2 with the plural words, a
  spell Forge does not offer, the second main phase sharing the limit, the AI's
  turn, Forge's `timing`, the next own turn.

## Not done here

- The complete `npm run check`, the full engine, regression and readiness runs
  (series rule, prompt 52).
- No reason for refused actions other than lands and attackers: Forge has no
  shared check that names them reliably (prompt 48); they stay "Forge bietet
  diese Aktion gerade nicht an."
- No new line in the decision region and no chip on single hand cards.
