# 49 — Following the opponent's turn and the game's tempo

## Scope

The project owner's wish of 2026-10-12 ("ich möchte Züge vom Gegner auch sehen,
was er setzt und so"; tempo and "Weiter" confirmed), central task
`dev0gig/dropzone/workflow/tasks/…/openmana-49-gegnerzug-und-spieltempo.md`,
series *openmana-spielfluss* (48–52), step 2. The video of 2026-10-12 showed
no rule error: the AI's turn and Forge's automatic passing ran so fast that
two lands of the player looked like one turn. This prompt makes the AI's turn
visible on the table, on the engine contract of prompt 48
(`48-observation-contract.md`, protocol 10). No engine change; the local
candidate `engine/build/candidate-48` is used unchanged.

**Forge stays the only authority.** The table shows what Forge reports
(`ObservedAction`s from Forge's events), at the points where Forge waits to be
looked at (`Observation.hold`). Releasing such a point passes no priority,
answers nothing and chooses nothing; Forge's auto-pass is Forge's own
setting. No Magic rule in React, no narration from state differences or
Forge's prose.

## What the player sees

### The stage (`OpponentStage`, `src/game/table/opponent-stage.tsx`)

The app starts every game with `MatchSettings.observation = "hold"`
(`src/game/game-start.ts` → `planGame` → `matchSetup`), so the engine holds
every observation that contains an action of the AI, a turn's beginning or
end, or combat damage, at a stable point before the AI decides again. While it
holds, the stage lies over the player's own half of the table - the stack bar
and the player's battlefield in `hoch`, the centre line and the battlefield
beside the side columns (`quadrat`, `breit`), the battlefield in a low `breit`
window - placed by the grid's area lines (`table.css`). The opponent's
battlefield (where the land or creature arrives), both strips, the hand, the
header and the decision region stay in view.

On the stage, one step after the other (`observationSteps`,
`src/game/observation-model.ts`):

| action | words (examples from real games) | cards shown large |
|---|---|---|
| turn (with the turn's end folded in) | "Zugwechsel · Zug 2 · Die Forge-KI ist am Zug"; at the player's turn the summary of the AI's last turn | none |
| turn's end alone | "Zug 1 endet" | none |
| land | "Die Forge-KI spielt ein Land: Wald" | the land |
| cast / activate / trigger | "Die Forge-KI wirkt Llanowarelfen", "… aktiviert eine Fähigkeit von …", "Eine Fähigkeit von … wird ausgelöst"; targets "Ziel: dich" | the spell / the source |
| attack | "Die Forge-KI greift mit 2 Kreaturen an"; per attacker "Grizzlybären greift dich an" | up to three attackers |
| block | "Deine Blocker" / "Du blockst nicht"; "X blockt Y", "Y wird nicht geblockt" | up to three blockers |
| resolve | "Llanowarelfen wird verrechnet", "… ohne Wirkung verrechnet – kein Ziel ist mehr gültig"; results: "Llanowarelfen kommt auf das Spielfeld der Forge-KI.", "Geborstener Blitz fügt der Forge-KI 2 Schadenspunkte zu.", "Forge-KI: 20 → 18 Lebenspunkte." | the spell / the source |
| combat damage | "Kampfschaden"; "Du: 20 → 17 Lebenspunkte." | none |

Players by the state's `me` ("Du", "die Forge-KI"), cards by Forge's names in
the player's card language, a hidden card as OpenMana's back - never a
guessed identity. The cards are `TablePicture`s (catalog pictures, Forge's
words without card data), whole and never cropped: as tall as the stage
allows, all together at most 55 % of its width, at most 17 rem wide (a size
container, `cqh`/`cqw`). No text lies on a picture; the words stand beside
it, scroll inside when they need more room, and "Weiter" below them always
stays in view (a low stage sets the turn's words in one line). Above the words
the step's place ("Aktion 2 von 3", "Zugwechsel"), below them what happens
next ("Geht von selbst weiter (Normal).", "Wartet auf „Weiter“ – Forge hält so
lange an.", "Angehalten, solange OpenMana im Hintergrund ist.", "Forge spielt
weiter …"). A thin gold line runs down the step's time (a transform; still
under less motion).

The stage is no dialog: nothing is trapped, the header, the menu and the hand
stay usable, and the engine asks no question while it holds. The header's
badge says "Gegnerzug" instead of "Du bist dran" (the engine waits, but for
looking), the decision region "Forge hält an – sieh dir die Aktion der Forge-KI
an." with the mode's note.

### Tempo and "Weiter" (`useObservationPlayback`, `src/game/observation-playback.ts`)

- **Langsam / Normal / Schnell** (`display.opponentTempo`, default Normal):
  each step stays 3.2 s / 1.7 s / 0.8 s, a step with several result lines a
  little longer (+0.7 / 0.4 / 0.15 s per further line, at most four). After
  the last step of a held observation the app releases exactly that
  observation (`EngineSession.releaseObservation`) - once. A change of tempo
  applies to the step on screen (its time starts again).
- **"Nach jeder Gegneraktion warten"** (`display.opponentStepwise`, default
  off): the stage waits however long the player looks; "Weiter" moves exactly
  one step, the last one releases. "Weiter" is also there while the tempo
  runs, to go on sooner.
- Against moving on twice: "Weiter" ignores presses for `ARMING_MS` after a
  step appeared (a double tap's second tap, a step arriving under the finger)
  and drops a held key's repeated keydowns. After the release it is gone.
- A tab in the background (`visibilitychange`): the step's time stops, the
  engine keeps holding; back in front the step starts afresh. Nothing catches
  up, nothing is lost. Leaving the game page (the game keeps running in the
  session) likewise keeps the engine at the step until the table is back.
- A resize, unfolding or turning only re-lays the table: the held step stays
  (no release, the same step key).
- Less motion: the stage's entrance, the line and the band do not move; the
  words, the cards and "Weiter" are unchanged.

Measured in Chrome on the real engine (end-to-end `--opponent-only`, median
time between two steps): see the report table below. Normal leaves time to
read a one-line step and see the card; Fast is still followable for known
decks; Slow suits reading results calmly.

### Changes of turn

A turn's beginning that the engine holds is a step of the stage ("Zugwechsel",
the number in gold, whose turn). The player's own turn usually begins
without holding: Forge asks the player at once. Then a band
(`TurnBand`) lies across the centre line for one step's time - "Zug 5 · Du
bist am Zug" and what the AI did in its turn - and lets every touch through
(`pointer-events: none`, `aria-hidden`; the header says the turn in words). So
the AI's turn never passes unseen between two turns of the player, and two
lands of the player always stand in two announced turns.

### What the AI did last

`EngineSession.opponentTurn` keeps the AI's lands, spells, abilities and
attacks of its latest turn (`foldOpponentTurn`): replaced when the AI's next
turn begins, at most 40 actions, never recorded or stored - not a second
history. Shown as one sentence at the player's turn beginning (stage or band)
and in the menu ("Die Forge-KI in Zug 4: Wald gespielt · Grizzlybären gewirkt
· mit einer Kreatur angegriffen."); the details are Forge's log
("Spielverlauf ansehen").

### Interruption by a real decision

When Forge asks the player about something of the AI's that can be answered
- a spell, an ability or a trigger on the stack, an attack - the stage is
gone (a question never waits behind a held observation), the decision
region's controls are there at once, and a line above them says "Unterbrechung:
Die Forge-KI wirkt Grizzlybären – Du kannst jetzt reagieren – oder
weitergeben." It goes when the player has answered.

### Forge's auto-pass

`display.autoPass` (`noActions` = APINA, the default; `noActionsRespectInterrupts`;
`never`) goes into `match.start` and, during a game, through `settings.change`
whenever the saved choice differs from what Forge confirmed last
(`settings.applied`), once per choice. While Forge plays on by itself the
decision region says so with the current setting ("Forge gibt deine Priorität
von selbst weiter, solange du nichts tun kannst. Ändern: Menü → Gegnerzug.").
No timer of the app passes anything.

### Settings

Settings → "Gegnerzug" and the table's menu → "Gegnerzug": the three tempos
with descriptions, the switch, Forge's auto-pass with descriptions (shadcn
`RadioGroup`, `Switch`, `Field`), saved at once
(`src/game/opponent-tempo-options.tsx`). The three keys are under `display.*`:
this device only, never in the ORYX cloud's collection (`isDeviceSetting`),
in backups like every setting. New setting keys need no schema change and no
migration (`SettingRecord.value` is checked by the setting's definition); a
damaged value is named and its default used.

### Replay

`ReplayFrame.observation` carries a recorded observation from its own entry
to the next state or question; the replay shows the same stage read-only
("Aufgezeichnete Aktion", "Aktion 1 von 2 · Aufzeichnung", "Forge hielt hier
zum Ansehen an."), stepped by hand ("Vorherige/Nächste Aktion"), never
releasing anything. Protocol-9 recordings have no observations and replay
unchanged.

## Code

- `src/game/opponent-tempo.ts` (settings, durations, words),
  `opponent-tempo-options.tsx` (Settings and menu),
  `observation-model.ts` (steps, presentation, summary),
  `observation-playback.ts` (stepping, release, visibility),
  `opponent-turn.tsx` (the page's hook: stage, band, interruption, auto-pass),
  `table/opponent-stage.tsx` and `table.css` (stage and band),
  `game-table.tsx` / `decision-panel.tsx` (`stage`, `turnBand`, `observing`,
  `autoPass`), `game-page.tsx` (wiring, menu section), `match-setup.ts` /
  `game-start.ts` (the game's settings), `src/engine/engine-session.ts`
  (`opponentTurn`, `foldOpponentTurn`), `engine-session-context.tsx`
  (`releaseObservation`, `changeSettings`), `src/matches/replay.ts` /
  `replay-page.tsx`, `src/app/preferences.tsx`, `src/routes/settings-page.tsx`.
- Real observations for the tests: `scripts/record-observations.ts` →
  `src/test/fixtures/observations.json` (13 moments of the candidate's
  focused fixtures `priority-respond-observe` and `lands`, never edited).
- End-to-end: `npm run test:e2e -- --no-build --opponent-only`
  (`opponentTurnInRealGame`).

## Verification (targeted, series rule)

See the central report for the exact commands and results. In short:
typecheck, oxlint, the candidate check, the Vitest files of the changed
areas (`src/app`, `src/game`, `src/engine`, `src/matches`, the settings page,
the collection, the board), and `--opponent-only` in Chrome with the
candidate engine: two real games (a phone with touch and touch emulation, a
desktop with mouse and keyboard and the card data installed) - the AI's land,
spell, resolution and attack on the stage at Normal, Schnell and Langsam
switched during the game; stepwise with a 4 s look, a double tap / double
click and a held Enter key each moving exactly one step and sending only
`observation.release`; a real decision interrupting (the AI's spell on the
stack, answered with Shock); the player's lands in distinct announced turns;
the held stage at the eight sizes and the foldable's three (whole inside the
board, cards whole, never over the hand, the decision or the header, "Weiter"
at least 44 px on touch and inside the stage), axe; less motion (no
animation); a tab in the background (simulated through `visibilityState` and
`visibilitychange` - headless Chrome keeps every tab visible); the settings
saved, read back after a reload, under `display.*`; the recording replayed
read-only.

Deferred to prompt 52 by the series rule: `npm run check` (complete Vitest,
E2E and PWA suites), the regression runner, the readiness games, the full
engine suite, lock promotion, release, push.

## Limits and notes for 50–52

- The engine holds only before the AI decides (prompt 48). An action of the AI
  right before a question of the player is not held; it shows as the
  interruption line (and the stack/combat as before).
- The last observation before the game ends is not held; the result page
  follows at once.
- With the default Normal tempo a game takes longer: about 1.7 s per held
  step of the AI. The readiness games and the e2e games of prompt 52 play at
  this default; their time limits may need to allow it.
- The stage covers the player's battlefield while it holds; the engine takes
  no tap then anyway (`observing`). Its cards are pictures, not controls (the
  same cards lie on the table to be looked at).
