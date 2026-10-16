# 61 — Jumpstart: two halves of 20, the mode from the deck

Prompt 61 (Dropzone `workflow/tasks/…/openmana-61-jumpstart-und-modus-aus-dem-deck.md`,
the project owner's request of 2026-10-16), a single task through `/dm openmana`,
Claude Opus 5.5 with effort `high`. Local commits only; no push, no deployment
(Vercel project).

## What the player sees

Nobody chooses a mode. OpenMana reads it from the deck:

| Deck | Mode |
|---|---|
| the list names a commander (its `Commander` section) | **Commander** (as before, Brawl too) |
| exactly 20 cards in the main deck, no commander | **Jumpstart**: one half; two halves play together, 40 cards |
| everything else (typically 60) | **Normal** (formerly "Constructed") |

- **Spielen:** the first choice lists every deck with its mode as a badge.
  A half brings the row "Zweite Hälfte" at once; "Partie starten" waits for it
  ("Wähle die zweite Hälfte deines Jumpstart-Decks."). The AI plays two halves
  as well: "Zufällig" draws two different halves for every game, never the
  player's two; or the player chooses its first and then its second half. Once
  the mode is set (the second half, the AI's decks) the pickers leave out decks
  of another mode and say how many ("2 Decks passen nicht zu Jumpstart."); the
  side's first half stays visible, disabled ("schon deine erste Hälfte"). No
  side plays the same half twice. Choosing the AI's halves explicitly may use
  the player's own halves (a mirror match, as before for the other modes), so
  with too few halves for a random draw the page says so in words and the
  explicit choice stays possible.
- Switching from a half to a normal or Commander deck: the second half's row is
  gone (its setting stays stored and counts again with a half), an AI deck of
  the other mode is shown as not fitting - never silently replaced.
- **Game:** Forge gets one deck of 40 named "Jumpstart: A + B" (the halves'
  main decks put together, counts of a card both have added up, no sideboard)
  in a normal `constructed` game. The game page names the mode ("Modus
  Jumpstart") and the decks ("Jumpstart: Goblins + Elfen", the AI's
  "… (zufällig gezogen)"); the match list ("Jumpstart: Goblins + Elfen gegen
  Forge-KI") and the replay's menu ("Dein Deck", "Deck der Forge-KI") name both
  halves through the deck name Forge got. Older recordings show their deck
  names unchanged.
- **Library and import:** the deck page, the library's tiles and the import's
  report and save card name the mode ("Jumpstart-Hälfte · 20 Karten"); the
  library's filter has Normal, Jumpstart and Commander (an old address with
  `?format=constructed` still filters the normal decks). No legality check was
  added - Forge decides.

## Step 1: the proof with the real engine

Before anything was built: `scripts/readiness/jumpstart-engine.ts` starts the
locked protocol-10 engine (`engine/build/publish-52h/dist`, verified with
`engine/scripts/engine-lock.mjs verify`) in Node exactly as the app boots it
(`--card-loading=eager --language=de-DE`), joins four halves of 20 from the
engine tests' card pool with the app's own `jumpstartDeck` and hands them over
with its `engineDeck` as a `constructed` game, 40 against 40. The player's side
is played only through Forge's offers (keep, lands first, spells Forge marks
playable, Forge's Auto payment, Forge's first target, attack with everything,
no blocks, Forge's minimum and maximum for divided damage, otherwise pass).

Result (seed 61): Forge accepted both decks of 40, the game ran 14 turns to
Forge's own end (`AllOpponentsLost`, the AI won 11 to −13); the player drew 13
cards, played 5 lands and put 8 spells and abilities on the stack, the AI 6
lands and 8; no input refused, every card named in `game.started`. 9 s.

The first attempt stopped at Forge's question for divided combat damage (the
proof script had no answer for it yet - fixed in the script, not in the app).
Noticed there and not pursued (outside the task): a `concede` sent while that
blocking `distribute` question was open did not end the game in the Node
engine within the script's 600 s; the app concedes through the same protocol,
so this is worth a look of its own.

No engine change, no protocol change, no new Forge game mode.

## Step 2: derived, not stored

`src/decks/deck-mode.ts` is the one place: `deckMode(deck)` (commander when the
format is `commander`, which `deck-plan.ts` sets from the Commander section;
jumpstart for exactly 20 main deck cards; else normal), `engineFormat`,
`jumpstartDeck`, `jumpstartName`. Every page asks it.

**Decision: derived.** A third stored `format` would need a schema bump with a
migration, a check of old backups and of the ORYX cloud's collection - and,
since the card catalog carries the schema version (`vite/card-assets.ts`), a
new catalog in the GitHub release before the next Vercel build (prompt 56 had
to replace the release's catalog after its push for exactly that). Deriving
changes no stored data: decks of 20 saved earlier are halves at once, backups
and the cloud are untouched, and a deck edited to another size changes its
mode with it. `DeckRecord.format` stays what Forge gets for a single deck.

The same reason kept the match recording's shape unchanged: a Jumpstart side is
recorded as the one deck Forge played, with the name "Jumpstart: A + B" and
`deckId: null`; the halves' ids live only in the running session's
`MatchSetup.human.halves` / `ai.halves`.

## What changed in the code

- `src/decks/deck-mode.ts` (new), `deck-selection.ts`: settings
  `play.humanHalf` and `play.aiHalf` (a deck id or nothing; checked; old
  settings stay valid; synced like the other `play.*` keys), `PlaySelection`
  with `mode`, `humanHalf`, `aiHalf`, new blockers, `randomPool(mode, own,
  decks)`, `drawHalves`, `resolveStored`.
- `src/game/match-setup.ts`: a side is one deck or two halves (`SideDecks`);
  two halves are joined and sent as `constructed`; the AI's random halves are
  drawn anew for every game. `src/engine/engine-session.ts`:
  `MatchSideSetup.deckId` may be null, `halves`.
- `src/routes/play-page.tsx`, `src/decks/deck-picker-dialog.tsx` (mode badge -
  read with the description, so a deck's accessible name stays its name;
  `hiddenNote`), `library.ts` / `library-labels.ts` (mode labels and filter,
  `DECK_FORMAT_LABELS` removed), import page and report, deck page, game page,
  replay page. Only shadcn components and existing patterns; no new CSS.

## Verification

- `tsc -b`, oxlint, schema check: clean.
- Vitest: 114 files, 1 602 tests green, among them new: `deck-mode.test.ts`,
  the Jumpstart cases of `deck-selection.test.ts` (second half at once, never
  the same half, random without the player's halves, too few halves, deleted
  or damaged halves, switching modes, the new settings), `match-setup.test.ts`
  (40 cards, constructed, both halves named, random pairs), `library.test.ts`
  (the mode filter, the old address), `deck-library.test.tsx` (the play page
  end to end in jsdom) and `game-page.test.tsx` (the real client gets one deck
  of 40 on each side).
- End to end in Chrome with the locked engine: `npm run test:e2e -- --no-build
  --jumpstart-only` - the play page at the phone, the foldable's three sizes
  and a desktop (badges, the second half at once, pickers that leave out the
  other modes with their line, no half twice, 44 px targets, axe 0 in all
  states) and a real Jumpstart game on the phone against two random halves
  (one deck of 40 each in the recording; result and match list name both
  halves).
- Readiness games (`node scripts/readiness/matches.ts`, the real UI to Forge's
  result): see "Readiness" below.

## Readiness

`node scripts/readiness/matches.ts --serve dist --games jumpstart,jumpstart-fold,phone,commander --keep-going`
(build and preview with `OPENMANA_ENGINE_DIR=engine/build/publish-52h/dist`): Arena
lists pasted and saved on the import page (the four halves read back from
IndexedDB with 20 cards each), the browser reopened, then every game chosen on
the play page and played through the real table to Forge's own result, with
history, recording and replay checked afterwards. **All checks passed**, no
input Forge refused, no action that left the table unchanged, no page error.

| Game | Size | Decks | Result |
|---|---|---|---|
| `jumpstart` | phone 412 × 915, touch | Goblins + Elfen against two random halves (drawn: Wildnis + Feuer), profile Standard | Forge won, 17 turns; the player played 6 lands and 9 spells (10 of these plays by dragging), attacked, blocked and divided damage |
| `jumpstart-fold` | foldable turned 829 × 690, touch | Feuer + Wildnis against two random halves (drawn: Goblins + Elfen), profile drawn at random (Vorsichtig) | Forge won, 16 turns; 6 lands, 8 spells, attacks and blocks |
| `phone` (normal, counter-check) | phone, touch | Grün Deutsch/Englisch (60) against Rot (60) | Forge won, 19 turns |
| `commander` (counter-check) | desktop | Krenko against Fynn (100 each) | the player won, 30 turns |

In both Jumpstart games the recording is a `constructed` game of 40 against
40, the AI's two halves are different and none of the player's, and Forge's log
shows the AI's lands, spells and damage. Pictures: Seafile
`/repo/openmana/jumpstart/61/` (the play page at five sizes, the result, the
match list) and `/repo/openmana/jumpstart/61/readiness/` (the games' start
hands, turns, results and replays).

## Assumptions (changeable)

- The AI's halves are both random or both chosen - no mix of one chosen and one
  random.
- Choosing the AI's halves explicitly may use the player's own halves (a mirror
  match), as the other modes allow the player's own deck for the AI.
- A deck chosen as the first half that was stored as the side's second half
  empties the second slot (shown as "Noch keine zweite Hälfte gewählt.").
- A half's sideboard is left out of the joined deck (the prompt: sideboards
  empty); a companion in it does not play.
