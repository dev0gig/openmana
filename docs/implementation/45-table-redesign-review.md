# 45 — Table redesign: review, polish and handover

## Scope and authority

Tenth and last prompt of the table redesign series 36–45 (project owner,
2026-10-10; specification `docs/design/SPIELTISCH.md`, mockup
`docs/design/spieltisch-vorlage/`). The table built in prompts 37–44 is
checked as a whole - every layout, size and scene, real games against Forge,
the replay, the foldable's sizes changed mid-game -, compared with the
mockup, checked for accessibility, performance and memory, and handed over
to the project owner for the physical check on the Fold and inside ORYX. No
new features: only faults, gaps and polish of the series. No engine, bridge,
protocol, storage or recording change. Nothing pushed or deployed.

## What changed

- **Pictures that stayed alive (fault, found by the memory measurement).**
  Chrome keeps an `<img loading="lazy" sizes="auto">` - the table's card
  pictures (`src/game/table-picture.tsx`, since prompt 15) - and every
  element around it alive after it left the page: the image's viewport
  listener holds it (heap snapshot: `MediaQueryMatcher` → viewport listener
  → the detached `<img>` → its card, row item and card row). On the table
  that was about 20 DOM nodes and 4 event listeners more per state, without
  end (a Commander game: 646 listeners at turn 16 where turns 1-5 had at most
  480; 2348 nodes where they had 1516). `CardPicture`
  (`src/components/ui/card-picture.tsx`) now takes `sizes` away in a ref
  cleanup - React runs it while the image is still in the page; taking it
  away after the removal does not help (measured) - and gives it back when
  React's development mode attaches the same element again. Only `sizes`
  goes; `srcset` and `src` stay (pinning `src` to the shown picture made
  Chrome cancel requests, which the end-to-end test counts as failures). In
  the recorded run of 24 states, stepped through four times: nodes and
  listeners level after the first round (956 / 229) instead of +500 / +103
  per round; the same 12 picture requests over the network with the same
  bytes, the rest from the cache, none failed.
- **Arrows over Forge's question in a low wide window.** On a phone turned
  sideways (`breit` + `short`) the decision shares the side column with the
  Zauberchronik and the strips, and an arrow to the other side (an attack on
  the player's medallion, a target on the board) lay over Forge's question
  and the main button (noted in prompt 43). There the decision now lies above
  the arrows (`z-index` 41 over the arrows' 40, `table.css`) - an arrow passes
  under it - and a lifted hand card above the decision (42). In `quadrat`
  and `breit` the decision stands in its own column beside the board; an
  arrow from the Zauberchronik to the board may still cross the edge of its
  panel (lines may cross, §4.15; e.g. `vergleich-konzept-vs-stack` at
  870 × 960 near the title "Phasen").
- **Tests and tools.**
  - End-to-end `tableKeyboardTour` (section 12; scenes `main-phase`,
    `stack`, `target-player`, `commander-late` at the eight sizes and the
    foldable's three): Tab from the page's start walks every region with
    something visible to focus, in the focus order; every stop shows its
    focus ring and has a name; Tab leaves the table at its end; nothing is
    tapped or answered. The names of medallions ("… Lebenspunkte"), zone
    piles ("… ansehen: N Karten"), cards, Zauberchronik entries ("…
    ansehen") and main buttons (their words) are checked there. A region
    that steps aside (an empty Zauberchronik in a low window, 0 × 0 px)
    has nothing to reach.
  - Readiness `--table-memory` (`scripts/readiness/matches.ts`, a hook
    `sampleTurn` in `scripts/readiness/player.ts`): once per turn at the
    player's first priority, after the motion and a full garbage collection,
    Chrome's counts (`Performance.getMetrics`: event listeners, DOM nodes,
    JS heap, documents), the board's own nodes, the running and endless
    animations, the motion's ghosts and the arrows. Fails on a motion
    animation still running or a ghost left at any turn, and on listeners
    above the first five turns' highest plus a tenth and 20, or nodes above
    it plus a quarter, from turn 10 on. The leak above fails it; the fixed
    table passes it.
  - Unit test `src/components/ui/card-picture.test.tsx`: `sizes="auto"`
    stays while shown (also in `StrictMode`), goes while the image is still
    in the page, other `sizes` stay.
- **Documentation on the built state.** `docs/design/SPIELTISCH.md` (the
  table as built; §6 keyboard and names; §9 memory; §13 state; **§14 the
  deliberate deviations from the mockup**), `docs/DESIGN_SYSTEM.md` §4, §5
  (inventory: `FannedHand`, `TableArrows`, `TableMotion`, current marks),
  §8, §9, `AGENTS.md` (table rules, card pictures, verification),
  `docs/BIBLE.md` §6/§13, `docs/READINESS.md` (the memory run),
  `STATUS.md`; the mockup's README says it is superseded and stays as a
  reference.

## Review

| Area | How | Result |
| --- | --- | --- |
| Layouts and sizes | end-to-end section 12: the eight sizes and Fold 480 × 1040, 870 × 960, 960 × 870 in every recorded and built scene (30 recorded/rebuilt + 9 built questions); arrangement, rows, cards, hand, strips, panels, decision, arrows, axe | passed (`npm run check`, run 7) |
| Real game against Forge | end-to-end `playRealGame` (desktop and phone touch: playing, attacking, blocking, targets, stack, result); readiness games through the production probe | passed; see Readiness |
| Commander | readiness `commander` (Krenko vs Fynn) and the end-to-end Commander scenes | passed |
| Replay | end-to-end replay checks (read-only, stepping animates, jumping does not) and every readiness game's replay to its end, the Commander game's portable JSON in a fresh profile | passed |
| Fold sizes changed mid-game | end-to-end `liveResizeCheck`: the live table through the eight sizes and the foldable's three while Forge waits - question, transcript and inputs byte-identical, no new worker | passed |
| Mockup comparison | 22 side-by-side pictures (mockup "Konzept" beside `stack`, "Voller Tisch" beside `blockers`) at all eleven sizes, plus the table alone | deviations listed in SPIELTISCH.md §14; the two small ones fixed or named (below) |
| axe | every scene and size (803 checks in run 7), zero serious or critical | passed |
| Contrast | `src/app/design-tokens.test.ts` (text 4.5:1, marks 3:1 on every table surface, also wood and leather) | passed |
| Touch targets | `stripFacts` (medallions, piles 44 px on touch), `cardTargets` (cards ≥ 24 px), the menu 44 px, `handFacts` (24 px per fan card) | passed |
| Keyboard and names | `tableKeyboardTour`: 44 walks, 14-21 stops each | passed |
| Performance | readiness `phone --cpu-throttle 4` on the production probe | see Measurements |
| Memory | readiness `--table-memory` | see Measurements |
| Readiness, live check | against the local production probe (fresh clone, release artefacts, public build, budgets) | see Readiness |
| Regression | `scripts/regression/run.ts` on `engine/build/publish-35d` | see Regression |

### Polish considered and left

- **Phone header** (`hoch` narrower than 480 px): the turn line wraps
  ("Zug 14 ·" / "Dein Zug", or "Zug 14 · Dein" / "Zug") and Forge's step is
  cut with "…" ("Erste Hauptp…"). Keeping the owner's words together made
  "Forge-KI am Zug" three lines at 360 px, which the two-line clamp cut -
  reverted. The step's full name is the element's title and the action bar
  shows it again; the folded Fold (480 px) fits both on one line each.
  Changing button sizes or the status badge would touch shared shadcn
  sizes and anchors - not done.
- **Read-only medallion's reading order:** "14 Lebenspunkte Forge-KI" (the
  number first); the region around it is named "Forge-KI" and the medallion
  as a control reads "Forge-KI, 20 Lebenspunkte, …". Kept.
- **Card names with Forge's English action words** ("… – Antippen: Remove
  card from combat"): Forge's own words, shown as sent.

## Measurements

- **`npm run check`** (run 7 of this prompt, Chrome 153): schemas, `tsc -b`,
  oxlint, Vitest 87 files / 1188 tests, the end-to-end suite "E2E OK"
  (`failures: []`) and the PWA suite (8 scenarios); the regression evidence
  accepts it: 8 viewports, 803 axe checks, 11 worker checks. 44 keyboard
  walks with 14-21 stops each.
- **A real game at 4× CPU, 412 × 915, production build** (the local
  production probe, readiness `phone --cpu-throttle 4`): 17 turns, 266 long
  tasks, **none over 200 ms (longest 150 ms)**, longest frame 251 ms (the
  test's 5 screenshots left out: 239-258 ms of painting); the motion's own
  work at most 32.5 ms in 139 states; 47 motions at 42.3 fps on average (the
  slowest 15 fps). Prompt 44 measured 152-169 ms.
- The end-to-end suite's own 4× CPU measurement on the **dev server** ran
  while another session's Android emulator and Gradle filled the host
  (swap full): longest task 231 ms with motion and 229 ms without, frames
  395 / 327 ms - the same with and without motion, so the host, not the
  table (prompt 44 on a calmer host: 97 / 90 ms). The budget is measured on
  the production build above.
- **Memory over a game** (readiness `--table-memory`; Chrome's counts after
  a full garbage collection, once per turn):

  | Run | Game | Turns sampled | Event listeners | DOM nodes | JS heap |
  | --- | --- | --- | --- | --- | --- |
  | before the fix (production build of `95524ce`) | Commander | 2-16 | 405 → 646 | 981 → 2348 | 8.5 → 11.1 MiB |
  | before the fix | phone | 2-12 | 396 → 644 | 875 → 2150 | 8.4 → 10.6 MiB |
  | after the fix (production probe) | Commander, 26 turns | 1-25 | 397-408 (turns 1-5: ≤ 401) | 971-1093 | 8.4 → 11.1 MiB |
  | after the fix (production probe) | phone, 12 turns | 1-11 | 389-405 | 848-984 | 8.4 → 10.5 MiB |

  At every sample: no animation of the motion running, no ghost, 3 endless
  animations (the decoration). The heap grows slowly with Forge's history
  and the recording, not with the table. In the harness (the recorded run of
  24 states stepped through four times, dev build): before +103 listeners
  and +500 nodes per round, after level (229 / 956).

## Readiness and live check on the local production probe

A fresh clone of `726336c` without Forge and without `.git`, as Vercel
builds it (`docs/DEPLOYMENT.md`), nothing deployed:

- `npm ci`; `fetch-artifacts.ts --from engine/build/release-35`: release
  `engine-p8-a9b4c26b1244`, engine (Forge `ed0333fecb`) and catalog
  verified; `OPENMANA_PUBLIC_RELEASE=1 npm run build` with the licence gate
  (the notices name `726336c…`); budgets: start JavaScript 260 468 / 300 000,
  start CSS 18 597 / 32 000, engine 78 972 017 / 90 000 000, catalog
  10 948 455 / 13 000 000 bytes (gzip where it applies).
- Served by `vite preview` from the clone (`http://127.0.0.1:5256`):
  COOP/COEP/CORP on `/`, `/.well-known/assetlinks.json` 200
  `application/json`.
- **Live check** (`scripts/deploy/live-check.ts http://127.0.0.1:5256`):
  run 2 passed - isolated, notices with the commit, catalog in 8.0 s, two
  Arena imports, a game to Forge's result (7 turns, two spells cast, the AI
  targeted twice, Forge's Auto payment twice), 38 Scryfall pictures, none
  failed, one engine worker. Run 1 failed only its demand "a spell was
  cast": the Izzet deck drew lands and Valki (black, uncastable) and lost in
  turn 9 to the red deck (follow-up below).
- **Readiness, all seven games** (`matches.ts --base http://127.0.0.1:5256
  --keep-going`): "all checks passed" - 545 player inputs, none refused or
  without effect, no page error, never more than one engine worker, every
  Scryfall picture loaded (63 / 62 / 61 / 38 / 63 / 85 / 57):

  | Game | Screen | AI profile (Forge) | Result | Turns | Inputs | Replay steps |
  | --- | --- | --- | --- | --- | --- | --- |
  | Rakdos targets vs Green-White | 1440 × 900 | Standard | lost | 13 | 81 | 632 |
  | Blue-Black control vs Red aggro | 1440 × 900 | Waghalsig | lost | 10 | 35 | 350 |
  | Commander Krenko vs Fynn | 1440 × 900 | Vorsichtig | lost | 15 | 120 | 949 (and its portable JSON in a fresh profile) |
  | Green German/English vs Red | 412 × 915 touch | Experimentell | lost | 15 | 42 | 459 |
  | Green attackers vs planeswalkers | 1440 × 900 | Standard | lost | 13 | 46 | 495 |
  | Grixis vs Green-White | 1440 × 900 | Standard | lost | 12 | 112 | 862 |
  | Planeswalkers vs Rakdos targets | 829 × 690 touch | Vorsichtig (zufällig) | **won** | 27 | 109 | 1039 |

  The Rakdos game did not meet the known "Kolaghans Befehl" case this time.
- The 4× CPU game and the memory runs above ran against the same probe.

## Regression

`npm run test:regression -- --out reports/regression-45/full-3` on the
locked build `engine/build/publish-35d` (Forge `ed0333fe`, manifest
`a9b4c26b…`), 69 minutes, **every phase passed** (`report.json` status
`passed`): engine lock before and after, build provenance, generated code,
engine typecheck, 96/96 engine unit tests, fresh pinned Forge sources, 85/85
JVM tests, 82 engine runs over 15 fixtures (JVM, WebAssembly in Node and in
Chrome) with all required coverage, and the complete `npm run check` (87
files / 1188 tests, end-to-end and PWA; 8 viewports, 802 axe checks, 11
worker checks).

Two earlier attempts failed on the host, not on the app: `full-1` and
`full-2` passed every engine phase, their end-to-end suites lost requests to
`net::ERR_NETWORK_CHANGED` while parallel sessions restarted Docker networks
(`toride-pbdeploytest_default`, `toride-audit-netz`, `bridge`: 79 network
events in nine minutes); `full-2` was stopped once that had happened. Of the
seven `npm run check` attempts before, four were ended by the host's
out-of-memory guard (another session's Android emulator and Gradle, swap
full), one timed out starting the engine on the dev server, one failed only
the new keyboard check in a low window (a hidden Zauberchronik counted as a
place to reach; corrected) and run 7 passed.

## Open follow-ups (not this prompt)

- **"Kolaghans Befehl"** (found in prompt 38, `docs/implementation/38-table-layouts.md`,
  `STATUS.md`): a player target that Forge's unique-target check refuses
  passes the bridge's pre-check and is swallowed instead of refused, so the
  Rakdos readiness game can hang at the command's targets now and then. An
  engine/bridge task of its own, outside the table series.
- **The live check's Izzet deck** (`scripts/deploy/live-check.ts`) has 46
  lands of 60 and Valki, whose black mana the deck cannot make: with a poor
  draw against the fast red deck the player loses by turn 9 without a
  castable spell, and the check's demand "a spell was cast" fails (run 1 of
  this prompt: keep, four lands, lost in turn 9; run 2 passed with two
  spells). A tooling follow-up: a deck with more castable spells.
- The project owner's physical check on the Fold (closed, open, open
  turned) and inside ORYX - after he allows a push (`docs/READINESS.md`:
  the game inside ORYX on a phone is still not tested).
- Style transfer to start, decks, matches and settings: a later, separate
  series (SPIELTISCH.md §2).
