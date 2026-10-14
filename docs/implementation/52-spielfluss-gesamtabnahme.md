# 52 — Joint acceptance and publication of the series *openmana-spielfluss*

Prompt 52 of the series *openmana-spielfluss* (48–52), step 5 of 5: the four
changes of prompts 48–51 checked together as one game, the remaining defects
fixed, the engine locked and released, `main` pushed once. No new feature.
The temporary test split of the series (`AGENTS.md`, "Test split of the series
openmana-spielfluss") is fulfilled by this prompt: every check it postponed ran
once on the finished whole.

## What changed here

Only verification tooling and tests; no app, engine or protocol source.

- **Readiness player** (`scripts/readiness/player.ts`) knows the new steps. While
  the engine holds an action of the AI the header says "Gegnerzug" and no
  question is open: the player waits for the stage, or - with "Nach jeder
  Gegneraktion warten" (`stepwise`) - presses only the stage's own "Weiter"
  (`[data-stage-next]` inside `[data-slot="opponent-stage"]`), never a button of
  the decision region (the priority's pass is also called "Weiter"), and never
  while a question is open. The start questions are answered in the
  full-screen start hand that opens by itself (Forge's buttons there, the London
  mulligan's "Nach unten"), or (`startHandView: false`) after closing it at the
  table. A watcher in the page counts the stage's steps, the turn band, the
  start hand's openings and the land chip's words; every game must show the AI's
  turn on the stage with cards, open the start hand by itself and - where a land
  was played - show Forge's land count.
- **Readiness games** (`scripts/readiness/matches.ts`) set the tempo and the
  waiting for every game (the profile keeps settings between games): `control`
  stepwise with "Weiter", `fold` at "Schnell", `grixis` answering the start at
  the table, the others at the default "Normal". The first question is read
  from the page itself (the start hand hides the table from the accessibility
  tree). Failed Scryfall requests are reported with address and status.
- **Live check** (`scripts/deploy/live-check.ts`): a fresh profile must start at
  "Normal" without waiting; the live game then runs stepwise (AI's turn on the
  stage, "Weiter" pressed there), opens a card of the start hand and swipes to
  the next one through Chrome's touch input, answers the start in the start hand
  and reads the land chip. `--expect-commit` compares the commit the notices
  name; the report names the service worker's shell version, its engine and
  the engine's protocol, which tells the new build from an old one. A picture
  Chrome aborts because its card left the screen (`ERR_ABORTED`) is no
  Scryfall failure, as in the readiness games.
- **End-to-end suite** (`scripts/e2e/run.ts`, `pwa.ts`): stale expectations from
  48–51 found by the complete run - a hand card's view has "Vorige/Nächste
  Karte" since prompt 50; Settings have seven more option rows since prompt 49;
  the harness's "Kartendaten eingerichtet" notice (the app's toasts since prompt
  51) lay over the hand on a profile's first scene and is now awaited; the PWA
  suite closes the start hand before it opens the menu and checks that nothing
  was answered. Robustness without weakening a check: the motion check reads a
  step's motion once the layer counted the new state (a busy machine painted
  later than two frames); the live help check compares the whole recording once
  it stands still (it is written in 100 ms batches) and names any new entries;
  the stepwise check of `--opponent-only` tests the held Enter key at the first
  held change of turn, so a game ending right after the next card step still
  gets both checks; the real games of the E2E suite count a card picture Chrome
  aborts because its card left the screen (`ERR_ABORTED` on `cards.scryfall.io`
  - the stage's cards come and go) as the table sections, the readiness games
  and the live check already do; any other failed request still fails.
- **New tests**: a backup of the app before prompt 49 (no opponent's-turn
  settings) restores Normal, no waiting and Forge's APINA; a newer backup brings
  tempo, waiting and auto-pass back (`src/app/preferences.test.tsx`). Conceding
  while the engine holds an action of the AI sends only the concession - no
  release, no answer - and the stage goes with the game
  (`src/game/game-page.test.tsx`).

## A new defect outside the series, fixed

The readiness games' import of the German/English deck failed on
2026-10-14: the line `4 Wucherndes Wachstum (M10) 201` stayed open with
"Scryfall war nicht erreichbar", reproducibly, while Scryfall answered.
Scryfall had added a key `jpeg` to `image_uris` that names the `normal`
picture again; `imageFacts` (`src/cards/scryfall-print.ts`) refused the URL
under a key that is not its version, and `ensurePrints` reported the
format error as an unreachable Scryfall. This hits every import and deck
view that asks Scryfall for a printing - also on the deployed app - and is
no finding of 48–51. Fix: an extra key is accepted when its URL follows the
rule for the same card and side (`isImageVersion` in `src/cards/images.ts`);
a version's own key must still hold that version. Tests:
`src/cards/scryfall-print.test.ts`. After the fix the complete
`npm run check` ran again on the final state (commit `3d49d6c`: 1 399 Vitest
tests in 106 files, the complete Chrome E2E suite, 0 axe violations, and the
production PWA suite; its first attempt stopped on one card picture Chrome
aborted in a real game - see below), and so did the readiness games.

## The engine

The complete update pipeline (`engine/UPDATING.md`) built and accepted the
protocol-10 engine from the unchanged Forge pin and toolchain and promoted
`engine/engine.lock.json`:

```
node engine/scripts/validate-forge-update.mjs --base b3cf8cd9bc7f5850f48d7c6cf6c91ddc66d1af0e \
  --bulk cards/build/cache/all-cards-20260924211809.jsonl.gz --out engine/build/publish-52h \
  --protocol-reason "<the reason in the lock>" --adaptation-path <81 exact files>
```

The 81 adaptation paths are exactly the files outside `engine/` that 48–52
changed, each named (no globs); they are listed in the lock's
`verification.protocol.adaptationPaths`. Pipeline commit `db28462`,
2026-10-14 02:40–04:13 UTC, every phase exit 0:

| Phase | Result |
| --- | --- |
| build (fresh toolchain, Forge + patches 0001–0010, Maven with the JVM bridge tests, Web Image) | 105 JVM tests, 0 failed/skipped; 107 engine unit tests |
| engine-tests | 91 engine results on 17 fixtures (28 JVM, 37 Node, 26 Chrome), 0 failures, no browser skipped |
| catalog | `0c2afda8fc8bd1fd` from the pinned Scryfall bulk of 2026-09-24 (unchanged content) |
| app-check (`npm run check`) | generated files, `tsc -b`, oxlint, 1 396 Vitest tests in 105 files, the complete real-Chrome E2E suite (96 axe checks, 0 violations) and the production PWA suite |

| | |
| --- | --- |
| Forge | `ed0333fecb1fea0671b3e50cadc1da4f71db5798` (2.0.15), patches 0001–0010 (`3b4c51cc…`) |
| Protocol | 10, schema `487d01d25c3ebdf7afae8cbab865264ad0504677bc608cbcb2c6cb3ee901f9d2` |
| Engine sources | `f3af74fe328f94a5a743676de4b69209f9da399e73d9dec0b4385f1683e7be25` (183 files; the same as candidate 48's) |
| Engine manifest | `908fbcabd35ef7acc7c2c978704f0e1b5cb5ca5d90ce17f34e2bb924fe69f483` (6 087 bytes) |
| `openmana-engine.js.wasm` | `21c20f637aa2770d52e79f6344e1d5180bf76c27cd02fa5387f7317cabb128a1` (79 173 028 bytes) |
| `openmana-engine.js` | `edf456327b91601ab3ded0f35c6b1429adca8141a9fdd7d67849065185d72b42` |
| `engine-worker.js` | `bd33dbbd1aa0103a23d4159780e1156c334d94623a3e58d4e4117acad57b538c` |
| `forge-res.inventory.json` | `94b447cec329319b12be9c17e1838da1bdfd681fa45bb871b2d7dafb0ea1afa1` |
| Card catalog | `card-catalog.jsonl.gz` `0c2afda8fc8bd1fd37a04804fcb9268e9836095e12a2ff79ece36100bb5be2ce`, manifest `f23c1f19488f6e112f78a92ed07c646a4258c4278b48265223595b24a4d4fa65` |
| Release | `engine-p10-908fbcabd35e` (`deploy/artifacts.json`) |

The WebAssembly module differs in its bytes from candidate 48's
(`9f59df79…`) built from the same sources - a rebuild is not bit-identical
(`engine/UPDATING.md`); the lock pins exactly the accepted artefacts.

Licence notices: the build's inventory (`report/notices-inventory.json`) has
the same 24 component coordinates and toolchain as the reviewed protocol-9
inventory, 8 267 types instead of 8 259 - the bridge's own new types
(`LandPlays`, `ObservationLog`, `ObservedAiPlayer` and their inner classes),
Forge's `Player$LandPlayRefusal` (patch 0010) and renamed generated proxies;
no forbidden type. It was reviewed and promoted to `notices/engine-inventory.json`
(`notices/policy.json` names its SHA-256), and `THIRD-PARTY-NOTICES.md` was
refreshed from the tested bundle (manifest, type counts, patch 0010).

### Attempts before the passing run

The earlier attempts and their evidence are kept (moved out of `engine/build/`
so the dev server's dependency scan does not read their HTML files; the paths
are in the central completion report): two were stopped by the host's
out-of-memory guard while another series ran an Android emulator (`build`,
`app-check`, exit 143); one found the stale expectations above (5 E2E
failures); one hit a single Vitest timeout in the unchanged deck import test
(176 ms alone, 20 repetitions green); one ran the E2E runner out of its 2 GiB
heap during the dev-server phase (caused by the old build directories' HTML
files in the dependency scan); one found the two remaining harness timing
issues; one the live help check's recording race. Each fix was committed and
the complete pipeline started again; no gate was changed.

## The new game flow, accepted together

On the final build (engine id `35791f9d15d26d99`), Chrome 153:

| Check | Result |
| --- | --- |
| `npm run test:e2e -- --no-build --opponent-only` | OK (second run; the first ended the desktop game right after the first stepwise card step - fixed in the check, see above). Two real games: AI land, cast, resolution, attack, combat damage and change of turn on the stage; Normal 1.70 s, Schnell 0.80–0.81 s, Langsam 3.20–3.21 s per step; stepwise 4 s held without a release, a double tap = exactly one release, a held Enter = exactly one step; interruption by the AI's spell with the decision usable at once, answered with Shock; own land in turns 1, 3, 5, 7, 9; the held stage at the eight sizes and the foldable's three (whole, inside the board, never over hand, decision or header); background tab, less motion, settings stored under `display.*`, read-only replay |
| `npm run test:e2e -- --no-build --starthand-only` | OK: recorded mulligan at eleven sizes, gestures (swipe, edge, long press, two fingers, keys, buttons, CloseWatcher), two real games with two mulligans and Forge's London choices, browsing on the table, replay read only |
| `npm run test:e2e -- --no-build --lands-only` | OK: land chip and the battlefields' room at eleven sizes, Forge's land reasons in the card view and after a refused drop, two real games (first land 0/1 → 1/1, second refused, Exploration 1/2 → 2/2, second main phase, AI's turn, next own turn) |
| complete E2E (in the pipeline) | drag and drop in real games (`dragInRealGame`), table scenes and interactions at the eight sizes and the foldable's three, keyboard tour, axe |

Special cases: an old backup and old settings (new test above), a protocol-9
recording replayed unchanged (`src/matches/replay-protocols.test.ts`, E2E
replay), changing tempo and waiting at a held step (`observation-playback`
tests; `--opponent-only` switches during the game), a double "Weiter" and a held
key (above), stale and wrong releases (`engine-client` tests, `node-observe` in
the engine suite), conceding while held (new page test; `node-observe`), a new
game with one engine worker at a time (E2E and every readiness game), hidden
cards stay hidden (engine fixtures, replay invariants).

## Readiness games

`node scripts/readiness/matches.ts --serve dist --out <new> --keep-going` with
the locked engine, Chrome 153, on the final state (after the Scryfall fix):
Arena import of 11 decks, IndexedDB read back, the browser reopened (all 11
decks), installability and active service worker, credits. Every game reached
Forge's result, its recording replayed to its last step, the Commander export
replayed in a fresh profile; zero refused inputs, zero actions without effect,
at most one engine worker, no failed Scryfall picture.

| Game | Screen | Tempo | Result | Turns | Inputs | Drags | Stage steps (with cards) | "Weiter" | Interruptions | Start hand opened / answered there |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rakdos targets | 1440×900 | Normal | lost | 14 | 79 | 8 | 42 (24) | – | 0 | 4 / 4 (mulligan, London) |
| Blue-black control | 1440×900 | stepwise | lost | 15 | 126 | 2 | 60 (40) | 60 | 6 | 1 / 1 |
| Commander Krenko | 1440×900 | Normal | lost | 27 | 188 | 13 | 68 (40) | – | 8 | 1 / 1 |
| Green German/English | 412×915 touch | Normal | lost | 13 | 86 | 8 | 44 (26) | – | 2 | 1 / 1 |
| Attackers/planeswalkers | 1440×900 | Normal | lost | 14 | 106 | 3 | 58 (38) | – | 4 | 1 / 1 |
| Grixis | 1440×900 | Normal | lost | 11 | 73 | 4 | 40 (25) | – | 1 | 1 / answered at the table |
| Planeswalkers/Rakdos | 829×690 touch | Schnell | won | 20 | 120 | 9 | 62 (30) | – | 1 | 4 / 4 (mulligan, London) |

The foldable game is the separate run `--games fold`: in the run of all
seven it stopped once in turn 12 (the player's tap on a planeswalker of its
own did not open the card view within 10 s - no view, no input, no page
error). Repeated 19 times as a single game: 18 passed; one more stopped the
same way (a tap on a hand card, "Holzmauer, spielbar": what lay at the point
was the card's own picture, no dialog, Forge waiting), one ended with an AI
that cast no spell in that game (the readiness check of Forge's log). The
player now reports what lay under the tap, the lifted card and the last
pointer events and clicks when a view does not open; the 14 runs with that
diagnosis all passed. The touch gesture code (`useFanPress`, prompts 42/46)
is unchanged in this series. **Open finding:** a rare tap that does not open
the card view on a touch screen under load - cause not found; the project
owner's rounds on the Fold are the physical check (a second tap opens it).

Phone with 4× CPU and the table's memory
(`--games phone --cpu-throttle 4 --table-memory`): lost in turn 18, 116
inputs, 60 stage steps; 329 long tasks, none over 200 ms (longest 196 ms),
motion work at most 20.3 ms in 233 states, 107 motions at 50.9 fps; listeners
404/413 in the first turns and 401–411 from turn 10 (bound 474), nodes
882–886 and 797–909 (bound 1 108), heap 9.2–12.2 MiB, one endless animation
(the main button's gloss) - the stage and its tempo build no backlog and no
growth. The sample now waits for the turn band (one step's time at the
turn's first priority) before it counts running animations: in the first
run it counted the band once as a motion left running.

## Known findings, unchanged

- "Kolaghans Befehl" (prompt 38: the bridge swallows a player target Forge's
  unique-target check refuses, the readiness player then waits): did not occur
  in this acceptance's Rakdos games; still open as its own task, no new finding.
- The live check's deck can draw no castable spell (prompt 45): still open; the
  live check of this publication is in the central completion report.
- The engine holds only before the AI's decisions (contract of 48): an AI action
  right before the player's own question shows as "Unterbrechung", the last
  action before the end of a game not as a stage step.
- Physical Fold 7 / ORYX: not tested here (Chrome emulation of the sizes, touch
  and `CloseWatcher`); the project owner's next rounds on the device are the
  physical check.

## Assumptions (changeable)

- Readiness games: one stepwise, one fast, one answering the start at the table,
  the others at the default; the live check plays stepwise.
- Failed build attempts are kept outside the repository's `engine/build/`
  (their reports and logs unchanged).
