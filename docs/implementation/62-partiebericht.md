# 62 — Match report ("Bericht speichern")

Status: implemented 2026-10-16 (Dropzone task `openmana-62-partiebericht-fuer-analyse`).

## What it is

Beside "JSON speichern" the replay page (`/matches/:matchId`, in its menu and on
the page shown when there is nothing to replay) and the match list (`/matches`,
in each entry's actions) have **"Bericht speichern"**. It saves
`openmana-partiebericht-<matchId>.md`: one Markdown text about the recorded
game that a foreign AI can read without knowing OpenMana, Forge or the game,
to judge how the human played - missed land plays, unused mana, playable cards
not played, attacks and blocks, passing too early or too late.

The report is a **derivation**. The recording - the portable replay JSON
("JSON speichern"), its schema, the engine protocol and the engine - is not
touched: it stays the evidence. `src/matches/replay.ts` only moved
`READABLE_PROTOCOLS`/`readableProtocol` into `src/matches/protocols.ts` (re-exported
unchanged, so the match list can disable the button without loading the replay's
checks) and exports its message check `checkRecordedMessage`.

## Code

- `src/matches/report.ts` - `buildMatchReport(stored: StoredMatch): string`
  (pure: no DOM, no card catalog, no network, no clock) and
  `exportMatchReport` (the Blob `text/markdown;charset=utf-8` and its file
  name). It checks the recording with the replay's own `checkReplay`,
  `readableProtocol` and `checkRecordedMessage`; a recording of another protocol
  is refused with the replay's words (`UNREADABLE_PROTOCOL`).
- `src/matches/report-words.ts` - the fixed texts (headings, the foreword), the
  German words for Forge's structured values (button meanings, mana, zones,
  sides) and the Markdown helpers. Phases, question kinds, refusal reasons, AI
  profile names, attack refusals and durations come from the game's existing
  labels (`game-labels.ts`, `attack-labels.ts`). The table's observation
  sentences (`observationSteps`, `lastMoveText`) speak to the player ("Du");
  the report speaks about him to a third reader ("der Spieler"), so it keeps
  their structure (an action's kind and Forge's fields) but has its own words.
- Pages: `src/matches/replay-page.tsx`, `src/routes/matches-page.tsx` - shadcn
  `Button` (outline, like "JSON speichern"), the module loaded only when asked
  for (like the replay), disabled with `aria-describedby` on the replay's words
  for another protocol (`ItemDescription` in the list, the page's alert on the
  replay page), a failure as the page's error text "Der Bericht konnte nicht
  gespeichert werden." No new CSS.

## The outline (binding)

1. Foreword for the reading AI (fixed German text): what this is, what it is
   for, the terms ("Spieler" = the human, "Forge-KI" = the opponent), what is
   hidden and why, how turns are counted, where every statement comes from and
   the two marked readings, Forge's kinds of questions in player's words.
2. Head: start (UTC), duration, mode (Normal / Commander / Jumpstart - the two
   halves are known only by the deck name Forge got, prompt 61), the player's
   deck, AI profile (Forge's and OpenMana's name), seed, OpenMana and Forge
   versions, protocol, status, result (Forge's result, win condition, turns,
   conceded).
3. The player's deck list (main deck, sideboard, commander).
4. Start hand and mulligan: every hand shown at a start question, Forge's
   questions and the answers, the cards chosen for the bottom, Forge's log
   entries of the mulligans.
5. Turn log, one section per turn, "Zug 26 (13. Zug der Forge-KI)":
   - "Lage zu Beginn": the turn's first state after its untap step - life,
     the player's hand by name, lands untapped/tapped, the rest of the
     battlefield (power/toughness, tapped, damage, counters, sickness,
     attachments), graveyard, exile, library count; the AI's hand as a number
     (revealed cards by name), the same zones; command zone, mana pool and
     player counters where Forge reports any.
   - "Ablauf" in the recording's order: Forge's observations in words (land,
     cast, activate, trigger, attack, block, resolution and combat damage with
     their moves, damage with its source and life from → to), every log entry
     no observation tells, Forge's prompt line when it changes, notices,
     settings, and every decision of the player as question - offer - answer
     (E1, E2 …). Attacks, blocks and damage name the decision before them.
   - "Ungenutzte Möglichkeiten" (the player's turns only).
   - "Stand am Zugende": life, hand sizes, creatures per side.
6. End: Forge's result in words, Forge's life totals, the last state in short.
7. Appendix A: id → name, type line, owner of every card the recording shows.
8. Appendix B: the AI's deck list, marked "während der Partie nicht bekannt".
9. Appendix C: recording id, number of log entries, protocol and manifest hash,
   what is not listed as a decision, and that the JSON is the full recording.

Every line starts with its place in the recording, `[L123]` = the log entry
with `seq` 123 of the JSON.

## Decisions

A decision is every input of the player that Forge plays: an answer, a card
tap, a player tap, mana from the pool, a concession. Its question is the one it
answers (an answer) or the newest open one (a tap). The offer lists Forge's
buttons with label and meaning (enabled or not), the selection's items, the
players Forge would take, and - at a priority - every card Forge marked
playable with its place and Forge's own words; per purpose also the hand
(mulligan), the cost and pool (payment), the defender, defenders, the
creatures that stay back with Forge's reason and the attackers so far (attack),
the blockers assigned so far (block). The answer is in words ("passt (Knopf 1
„OK“)", "tippt Mountain (#28) an – Forge bot dafür an: „Spiele ein Land“",
"wählt die Forge-KI", "gibt die Partie auf"), followed by Forge's
acknowledgement or its refusal with reason and detail.

A running step's buttons and selection carry Forge's prompt line as their words
(their own `text` is the line of the moment the step began - the table shows
the same); a blocking question its own text.

Passes in a row: answers "passen" to priority questions that read alike (same
turn, step, stack, offer) with nothing written between them are one line with
a count ("3-mal hintereinander") and all their references. Releasing a held
observation ("Weiter" on the stage) and the app's state requests are no game
decisions; appendix C counts them.

Recordings without the player's inputs (the protocol-9 fixture of prompt 47 has
none) still list every answered question; the answer says that the input is not
in the recording.

## The two marked readings

Nothing is inferred from two states. Exactly two places read a state:

1. **Ungenutzte Möglichkeiten** - from the state at the player's last pass
   ("passen" or "Zug beenden") in an own main phase with an empty stack: whether
   the land play was open (Forge's `landsPlayed`/`landsAllowed`/`landsUnlimited`),
   the untapped lands, the mana pool, the hand cards Forge marked `playable`
   (with Forge's words). Without such a pass of his own (Forge's auto-pass
   passed for him) the section says so and reads the last state of an own main
   phase with an empty stack, with Forge's `canAct` there. Lands are the cards
   Forge played as a land (`LandAction`), gave a land reason
   (`VisibleCard.landRefusal`) or whose type line, as Forge sends it, names the
   card type Land.
2. **Life without damage** - Forge names a source for every damage
   (`ActionResults.damage`, the log's `DAMAGE` entries) but none for a life
   change without damage (`ActionResults.life`, the log's `LIFE` entries). The
   report then writes "Quelle von Forge nicht genannt" and, inside a resolution,
   "Vermutung: das gerade verrechnete Stapelobjekt …".

## Hidden stays hidden

A hidden card is "eine verdeckte Karte" and carries no id (Forge sends none).
Only ids of cards the recording shows are written, always with a name
(appendix A has them all); `game.started.cardNames` is never used. The AI's hand
is a number, both libraries are numbers. The AI's deck list (from the header)
stands only in appendix B. Card names are Forge's English keys; Forge's texts
(questions, prompt lines, log entries, button labels) are quoted as sent, in
the language Forge spoke.

## Which log entries are written

Forge's game log (`events`) arrives before the state it explains; an
observation follows that state. A log entry is left out only where the next
observation tells the same game event, matched by Forge's structured fields
(a land play, a spell or ability put on the stack, a resolution, a zone change
by card id, damage by its source id, a turn begin, combat declarations, life
changes by count). Every other entry stands with its kind, Forge's text, its
card and actor - in a protocol-9 recording (no observations) all of them.

## Deliberately absent, and why

- No judgement by OpenMana ("Fehler", "schlecht"): the reader judges.
- No card texts or catalog data (the report works without the catalog and
  without network); the reading AI knows cards by their English names.
- No second format: Markdown with a fixed outline is readable by people and
  machines alike.
- No timing per decision: the recording's times are the browser's, not
  thinking times (a held observation, the tempo, the arming of buttons).
- Nothing of the AI's hidden cards, not even where the deck list would allow a
  guess (ids follow the deck list).

## Limits

- The test recordings are built from the engine's fixture games; their
  scripted player sends deliberate probes (a stale question id, an unknown
  card), which stand as refused decisions. Real recordings come from the app.
- A land that came onto the battlefield by an effect and whose type line Forge
  sends without the type Land would not count among the lands (Forge's type
  lines name it in both languages).
- The mode Jumpstart is known only from the deck name Forge got
  ("Jumpstart: A + B"); the recording has no field for it (prompt 61).

## Verification

- `src/matches/report.test.ts` (Vitest, 23 tests) on the protocol-9 fixture
  `src/test/fixtures/replay.json` and five whole recorded games
  `src/test/fixtures/report-games.json.gz` (written by
  `scripts/record-report-games.ts` from `engine/build/publish-52h` - the fixture
  games `human-3-de`, `human-5-defend`, `targets-payment`, `human-3-concede`,
  `commander` of the engine's differential tests; Forge's messages unchanged,
  each input placed after the engine's input checkpoint, the scripted player's
  schema-invalid probes left out, the header built). Checked: the outline and
  its order; Markdown shape; determinism and an unchanged recording; the
  checked-in report of the fixture (`src/matches/__snapshots__/report-fixture.md`);
  every `question.answered` with question, offer and answer; turn headings
  global and per side, the last equal to Forge's `game.end.turns`; every attack,
  block and damage with its card and the decision before it, every life change
  with damage with its source, without damage "Quelle von Forge nicht genannt";
  no id or name of a card the recording never shows (the AI's deck only in
  appendix B); unused possibilities equal to Forge's marks, land plays and
  untapped lands of the state named; passes in a row and their count (built
  from a real recording); mulligan, concession, a running and an aborted
  recording (built), the commander game; another protocol refused with the
  replay's words.
- End to end in Chrome with the locked engine (`OPENMANA_ENGINE_DIR=engine/build/publish-52h/dist`,
  `npm run test:e2e -- --no-build --report-only`, 2026-10-16): **0 failures**.
  - The recorded fixture at small phone, the foldable's three sizes and desktop:
    the list's and the replay menu's report are the same file with the binding
    outline; an imported protocol-8 recording has the button disabled, described
    by the replay's words, in the list and on its replay page; buttons 44 px on
    touch, no overflow, axe 0 violations in list, menu and the older protocol's
    page. (The full suite runs this part too.)
  - A real game on a phone (seed 6200, the readiness player, decks "E2E Bericht"
    red against "E2E Bericht KI" green): 34 turns, won; the recording holds the
    player's land plays, spells, attacks, blocks and a pass with a playable card
    in the hand, and the report says each of them (152 KB, 97 decisions, Forge's
    34 turns = the last heading); list and replay menu give the same file; the
    list at the foldable's three sizes with 44 px buttons, no overflow, axe 0.
  - In this game the player passed in an own main phase only with his own spell
    on the stack (the readiness player plays what Forge marks); every
    "Ungenutzte Möglichkeiten" therefore shows the marked fallback reading.
  - The section concedes and replays with the next seed when the readiness
    player itself gives up (a first run lost game 2 to its "card view did not
    open" check); the run above needed no second game.
  - Test lesson: a full-page screenshot in Chrome ends the touch emulation for
    the page (`pointer: coarse` turns false); the section takes viewport
    screenshots only.
  - Example report, its JSON and screenshots: Seafile `/repo/openmana/partiebericht/62/`.
- **`npm run check`** with the locked engine (`OPENMANA_ENGINE_DIR=engine/build/publish-52h/dist`,
  2026-10-16): **green** - schema check, `tsc -b`, oxlint, Vitest 115 files /
  1 625 tests, the complete end-to-end suite in Chrome with the real engine
  (0 failures, including the recorded report part at five sizes) and the PWA suite.
