# OpenMana readiness — Prompt 32

Final functional gate before the UI fine-polish and before retiring Anvil.
Audit date: 2026-10-08. Executed per `/dm openmana 32` with Claude Code,
Claude Opus 5.5 (`claude-opus-5-5`), effort `max` (model gate in `AGENTS.md`,
checked in the session log before the task started).

Audited state: app and engine code of the public deployment `e49741d`
(https://openmana.oryx.quest/), Forge `ed0333fe` (2.0.15), protocol 8, engine
manifest `2b0da7a2…`, card catalogue `0c2afda8…`. Local commits of this audit
change only verification tooling and documentation, no app or engine source.

Read for this audit: [BIBLE.md](BIBLE.md), [ANVIL_PARITY.md](ANVIL_PARITY.md),
[ANVIL_LESSONS.md](ANVIL_LESSONS.md), [QUALITY.md](QUALITY.md),
[DEPLOYMENT.md](DEPLOYMENT.md), [PUBLICATION.md](PUBLICATION.md),
`engine/UPDATING.md`, `docs/research/`, implementation records 26–31 and the
central Dropzone tasks 28–32 (device report of Prompt 31).

## Verdict

**Functionally ready for the UI fine-polish.** No functional or regression
defect was found in the app or the engine. The two defects found were in the
verification tooling and are fixed: the post-deployment live check never cast
a spell, and the complete regression kept Chrome's profiles in a RAM-backed
`/tmp`, where the offline engine download could not be stored. Every criterion
of the Bible's definition of success passes on the web; three carry explicit
limits that must not be read as passes:

- **Android inside ORYX is not proven by a game (criterion 9).** Trust,
  isolation and the engine starting inside the shared ORYX TWA are proven on
  the project owner's Galaxy Z Fold7 (Prompt 31). A game on the device,
  rotation, background, "Zurück zu ORYX" and Android Back were **waived by the
  project owner on 2026-10-08 and are not tested**. Everything else that runs
  there is the same web application proven here in desktop Chrome with
  phone/foldable emulation and touch.
- **German presentation has known gaps (criterion 7).** In a game, card names
  and rules texts are Forge's own German translation. Where Forge has none
  (about 1.3 % of the cards Scryfall names in German — among them the basic
  land Forest), the English text appears beside a German picture.
- **A Forge update needs engine maintenance (criterion 8)** — patches,
  bridge and tests, all inside `engine/` — but no UI change. Shown with a
  trial update to the current upstream Forge (see below).

**Retiring Anvil:** for browser play OpenMana has functional parity
([ANVIL_PARITY.md](ANVIL_PARITY.md)) and now complete real games through the
UI. Anvil is an Android app, though: keep it until one real game has been
played in ORYX on a phone — the only open functional gate, and the project
owner's call.

## Success criteria (Bible §19)

| # | A user can … | Result | Evidence | Limits |
| --- | --- | --- | --- | --- |
| 1 | open OpenMana in a modern browser without Odin/Tailscale | **PASS** | Live game on https://openmana.oryx.quest/ from a fresh Chrome profile; requests went only to the app's origin, the GitHub release (engine/catalogue, at build time on Vercel) and `cards.scryfall.io`; isolation and every required browser capability checked before any download | Chrome-family evidence; other browsers are refused by feature detection, not tested |
| 2 | import an Arena-format deck | **PASS** | 11 lists pasted through the import page: English, German names (`Wald`, `Riesenwuchs`, `Llanowarelfen`), an ambiguous old German name decided by its printing through Scryfall's API, Commander lists; each read back from IndexedDB with the list unchanged, every card counted and the format | — |
| 3 | reopen the same browser and find the deck | **PASS** | Persistent Chrome profile closed and opened again: all imported decks listed | — |
| 4 | choose decks and a Forge AI profile | **PASS** | Both decks through the play page's dialogs; Standard, Vorsichtig, Waghalsig, Experimentell and Zufällig chosen in the dialog; the table names the profile Forge confirmed (random: "… (zufällig)") | Profiles are styles, not difficulty levels (measured in Prompt 12) |
| 5 | play a rules-correct game governed by Forge | **PASS** | Complete games through the real UI (table below) without a single input Forge refused; the full regression (JVM = Node = Chrome traces, 15 fixtures) | Representative games and fixtures, not every Magic card |
| 6 | understand legal actions, targets, attacks and blocks from the UI | **PASS** | The readiness player acts only where the table marks or offers something (playable cards, Forge's action words, marked targets, attackers, blockers, block targets, payment sources); every action it took was accepted by Forge | Functional evidence, not a usability study; the fine-polish follows |
| 7 | see German card presentation where available, English otherwise | **PASS with limit** | German pictures and texts where Scryfall has them; English-only cards (Barbary Apes, Hornet Cobra, Zodiac Tiger) shown in English with "englisch (kein deutscher Text verfügbar)"; a German name with an English picture (Auerochse); the English setting switches everything to English | Forge's translation gaps (Forest) — see findings |
| 8 | update Forge independently from the UI | **PASS** (maintenance needed) | Prompts 26/30/31 ran the complete update pipeline; this audit's trial update to upstream `9fb01517` (+175 commits) needed changes only under `engine/` | See "Forge update trial" |
| 9 | use the same web application as PWA and through ORYX on Android | **PWA: PASS · ORYX: PARTIAL** | Chrome reports no installability error, the service worker is active, the offline/update suite passes; Digital Asset Links `linked: true` for both addresses, ORYX 0.2.5 signed with exactly that certificate, Fold7 start with isolation and engine (Prompt 31) | On-device game and navigation **waived, not tested** |
| 10 | access clear credits and licences | **PASS** | Credits name Forge, ManaBrew, Scryfall, OpenAI ChatGPT and Anthropic Claude; GPL text, all third-party notices and the source offer served locally and live | The GraalVM/GFTC question stays openly disclosed ([PUBLICATION.md](PUBLICATION.md)) — a legal, not a functional item |

## Prompt 32 checks

| Check | Result | Evidence |
| --- | --- | --- |
| All tests and builds | **PASS** | `npm run test:regression` on the locked engine: every phase passed ("Complete regression") |
| Several real matches including a long one | **PASS** | Table "Real games" |
| Arena import → IndexedDB → game → recording → replay | **PASS** | Every game of the table, in one browser profile |
| Forge AI | **PASS** | Every profile (and the random draw) in a game, confirmed by Forge on the table; in every game Forge's log shows the AI's lands, spells and damage with its structured actor, and combat; the AI won 5 of 8 games |
| DE → EN fallback | **PASS with limit** | Criterion 7 |
| PWA installation | **PASS** | Criterion 9 |
| Vercel | **PASS** | Live game and live check on the production address, headers, release artefacts |
| Web app inside the shared ORYX TWA | **PARTIAL** | Criterion 9; no individual APK or wrapper exists |
| Forge updates without UI edits | **PASS** (maintenance needed) | "Forge update trial" |

## Complete regression

`npm run test:regression` on the locked build (`engine/build/publish-31b`:
Forge `ed0333fe`, engine manifest `2b0da7a2…`) — run 4 of 2026-10-08,
53 minutes, `reports/regression-32/full-4/report.json`. **Every phase
passed:**

| Phase | Result |
| --- | --- |
| `engine-lock`, `build-provenance`, `engine-lock-after` | The locked engine verified against `engine/engine.lock.json` before and after the run; the build's original build, JVM, source and report evidence verified |
| `engine-generated`, `engine-typecheck`, `engine-unit` | Generated protocol code current, engine TypeScript clean, 96 of 96 engine unit tests |
| `jvm-sources`, `jvm-unit` | Forge `ed0333fe` prepared with the project's patches; 85 of 85 JVM tests |
| `engine-games` | 15 recorded games replayed against the JVM reference traces, plus AI, card and protocol checks, in 82 runs — 26 on the JVM, 33 as WebAssembly in Node, 23 as WebAssembly in Chrome (with and without COOP/COEP); every run passed, all 45 required trace kinds covered |
| `app-check` (`npm run check`) | Schemas current, `tsc -b`, oxlint, 957 of 957 app tests in 77 files, the end-to-end suite in real Chrome with the real engine on 8 viewports (phones, foldable, tablets, desktop) with 678 axe accessibility checks, the PWA suite (8 scenarios: installed shell, interrupted and corrupt downloads, SHA-verified engine download, offline game, offline credits, updates beside a running game, eviction, failed first install) |

Three earlier attempts on the same day stopped before the end, none on a
failed test of the app or the engine: runs 1 and 2 were ended by the host's
out-of-memory guard (earlyoom stopped the end-to-end runner at about 1.8 GiB
while another session's Android emulator held about 5 GiB and the swap was
full; exit 143); run 3 passed everything up to the PWA suite, whose real
engine download failed because the runner had put Chrome's profile into the
RAM-backed `/tmp` (finding 8; the same suite passed with the profile on disk,
`reports/readiness-32/pwa-rerun-disk.log`). Run 4 is the first with the fixed
runner.

## Real games through the UI

`scripts/readiness/matches.ts` (local, the locked engine served by `vite
preview`) and the same player against the production address. The player
(`scripts/readiness/player.ts`) plays like a person who only uses what the
table offers: lands and spells through the card view's button (Forge's own
action words), Forge's marked targets (the AI's seat and cards first),
payments (Forge's Auto, a land tapped by hand, floating mana, life for
Phyrexian mana), attackers, blockers and another block target, every other
kind of question through its own controls. Each send waits until it is armed.
After every action the table must change: an action without effect, an input
Forge refuses (`input.rejected` in the recording), a question it cannot answer
or ten minutes without a question fail the game. It plays to exercise paths,
not to win.

Final local run (`reports/readiness-32/matches-2`, Chrome 153.0.8010.12, the
locked engine and catalogue, all checks passed):

| Game | Screen | AI profile (as confirmed by Forge) | Card language | Result | Turns | Time | Player inputs | Replay steps | AI lands / spells (Forge's log) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rakdos targets vs Green-White | 1440×900 | Standard | German | lost | 10 | 89 s | 81 | 641 | 5 / 4 |
| Blue-Black control vs Red aggro | 1440×900 | Waghalsig | English | **won** | 19 | 75 s | 94 | 892 | 6 / 20 |
| Commander Krenko vs Fynn (long game) | 1440×900 | Vorsichtig | German | **won** | 47 | 185 s | 187 | 1 893 | 20 / 23 |
| Green German/English vs Red | 412×915 touch | Experimentell | German | lost | 16 | 70 s | 55 | 506 | 6 / 8 |
| Green attackers vs planeswalkers | 1440×900 | Standard | German | lost | 18 | 117 s | 72 | 723 | 6 / 14 |
| Grixis (scry, X, "may") vs Green-White | 1440×900 | Standard | German | lost | 12 | 66 s | 49 | 452 | 4 / 6 |
| Planeswalkers vs Rakdos targets | 829×690 touch | Standard (zufällig) | German | **won** | 15 | 67 s | 49 | 486 | 7 / 5 |

Together: 587 player inputs. Among the player's actions: 51 lands, 61 spells,
3 answers to the AI's spells, 10 casts from the command zone and activated
abilities, 27 targets and selections (12 on the AI's seat), 12 choices
(modes, X), 12 options (adventure and split sides, revealed lists), 12 of
Forge's yes/no buttons, 100 payment actions (62 Forge's Auto, 34 a land tapped
by hand, 4 cancelled), 116 attack actions (70 creatures declared, 6 Alpha
Strikes, 2 defender switches), 81 block actions (21 blockers assigned, 38
block-target switches), 2 London mulligans with cards to the bottom, 2 orders,
2 scry arrangements and 5 distributions. **None was refused by Forge, no
action left the table unchanged, no notice, no page error, never more than
one engine worker, every Scryfall picture loaded** (only the app's origin and
`cards.scryfall.io` were contacted). The decks survived closing and reopening
the browser (11 of 11). The Commander game's portable JSON (7.9 MB, 1 893
steps) replayed to its end in a fresh profile. An earlier run of the same
games with other draws (`matches-1`) reached 13–41 turns, again without any
refused input; one more game exercised the Grixis deck separately
(`trial-grixis`).

Per game, after Forge's result: Forge's history (actors and kinds), the
original recording in IndexedDB (finished, Forge's result equal to the
table's, gap-free order, every message type of a whole game, the manifest
hash), the replay stepped to its last step without sending anything (the
recording unchanged), and — for the Commander game — the portable JSON loaded
into a second, empty browser profile and replayed to its end.

**Memory (desktop Chrome 153, Linux):** in the regression's 21 browser
engine runs (AI games, replays, card probes) Chrome's own measurement put the
engine worker's heap at 525–766 MiB, and the whole headless browser peaked at
1.75–2.13 GiB resident. In the app itself, three further Commander games
through the table (17, 24 and 17 turns, all checks passed,
`reports/readiness-32/memory-commander*`) had the renderer processes of the
app's profile — page, engine worker and service worker — at 1.36–1.41 GiB
resident at their highest sample (every five turns from turn 5); the 24-turn
game was only 0.05 GiB above the shorter ones. The 47-turn game of the table
above has no such figure. The engine plan's estimate for a phone was
1.1–1.3 GB; the Fold7 has 12 GB, but nothing was measured on it.

Decision kinds answered in these real games: priority, mulligan and London
bottom, payment, selection (targets, discards, sacrifices), choices (modes,
X), Forge's yes/no buttons, attack/attack confirmation, blocks, options
(adventure/split sides, revealed lists), order, arrange (scry), distribute.
Forge's yes/no dialog (`confirm`) and free number input (`input`) did not occur
naturally — Forge uses buttons and choice lists there — and remain covered by
the JVM callback tests and the constructed browser scenes of Prompt 30.

## Forge update trial

A real update to upstream Forge `9fb0151711260a5496229d1211cae1feeeb2f89e`
(2026-10-08, 175 commits after the pin) in an isolated worktree, branch
`forge-trial-32`, following `engine/UPDATING.md`:

| Step | Upstream change met | Maintenance (all under `engine/`) |
| --- | --- | --- |
| Patch queue | 7 of 9 patches apply unchanged. 0004 (input pump) and 0006 (no network manager for local games) no longer apply — upstream now provides both: `IGuiGame.awaitInput`, "a GUI whose peer can only answer on this thread (a single-threaded host) overrides this", and `HostingServer` instead of `FServerManager.getInstance()` | Both patches retired; `BridgeGuiGame.awaitInput` pumps the inputs (the former pump), the queue README updated |
| Bridge compile | `IGuiGame` dropped `openZones`' old signature, `restoreOldZones`, `tempShowZones`, `hideZones`; two new game event classes (`GameEventRollDice`, `GameEventFlipOntoBattlefield`) | Overrides removed (the state already carries everything visible); the trace records the new events under the existing kinds `die`/`coin` with their numbers — no protocol change |
| JVM bridge tests | 82 of 85 green at first | `CardProbe`: an announced set without cards (NAU, edition file with an empty card list) no longer counts among "the newest editions"; one test game depends on its seed (below); one guarantee broken by the new Forge (below) |
| Differential games (JVM) | All 15 fixtures play to Forge's result; the coverage holds except one item: `human-11` (seed 11) no longer discards a card — Forge now plays this seed differently | New seed for this fixture and its JVM test twin (search below) |

No file outside `engine/` had to change: no UI source, no protocol schema,
no app test fixture. The trial branch `forge-trial-32` (local, not pushed)
keeps the commits for the next real Forge update.

**Seed.** A search over seeds 11–400 with the scripted player of the
fixture found seed **207** to cover all 17 declared paths of `human-11` again
(adventure choice, two-card discard, scry, both targets, payments, attack,
exile, loss by life) and to cast Faithless Looting, as its JVM test twin
expects. The fixture keeps its name (`human-11` is referenced by recorded UI
scenes outside `engine/`); its seed and description, and the twin tests'
seed, change. With it the JVM bridge tests reach 84 of 85.

**The one remaining failure is a real finding for the next update.**
`AttackersTest.askingAboutTheDeclarationChangesNothing` guards that asking
Forge's running attack input (the read-only answers of patch `0008`: why a
creature cannot attack, the current defender, which players a click would
take) does not change the game. On Forge `9fb0151` it fails deterministically:
a replay of the recorded `attackers` game **with** asking ends in a different
game log than the original, the same replay **without** asking in the
original's (diagnosis: original and unasked replay `698b0d1a…`, asked replays
`987af6fc…`, twice alike). On the pinned Forge `ed0333f` the same test passes
alone and in every regression of this audit. Upstream's direct change to
`CombatUtil` here is harmless (the order of two block checks); the changed
static-ability evaluation (`StaticAbilityContinuous`) is a candidate. Bisect
upstream and keep every query side-effect free before accepting this Forge —
still a change inside `engine/` only.

**Not run in this trial:** the WebAssembly build, the Node/Chrome replays and
the complete app/PWA check against the new engine — the steps that would
promote a new engine lock. The update pipeline stops at its JVM step on the
finding above, by design; besides, during most of the audit the shared host
had its swap full (another session's Android emulator held 5–6 GiB) while the
WebAssembly compiler needs a 6 GiB heap. The complete pipeline on the current
pin (Prompts 26, 30 and 31) and this audit's regression show those steps work
with the unchanged app; for the new Forge they belong to the next real update:
`node engine/scripts/validate-forge-update.mjs --base <base>` on the trial
branch once the finding is resolved.

## Findings

| # | Finding | Kind | Action |
| --- | --- | --- | --- |
| 1 | `scripts/deploy/live-check.ts` never cast a spell: its pattern did not know Forge's German action words ("Einen Zauberspruch sprechen"). Prompt 31's live game was passive by accident, not by intent. | Tooling defect | **Fixed**: the live check plays with the readiness player and requires a spell; corrected in DEPLOYMENT.md and the record of Prompt 31 |
| 2 | In a game, card names and rules texts come from Forge's German translation; Forge lacks it for 75 cards it lists in English (e.g. Forest) and has no entry for 317 more (mostly new sets) of 30 182 cards with a German Scryfall name. | Presentation limit | Documented; candidate for the fine-polish (e.g. the catalogue's German name where Forge's equals the English one) or an upstream translation fix |
| 3 | Forge stops for priority in every step in which the player could cast an instant (its own auto-pass, APINA) — e.g. in the upkeep with Giant Growth in hand. | Behaviour by design | Documented for the fine-polish (Forge's yield options); no change |
| 4 | The engine trace vocabulary (`TraceEventKind`) is part of the versioned UI protocol. A Forge update with a new event class must either reuse a trace kind or raise the protocol version — which would retire every saved replay from the UI although only engine tests read traces. | Maintainability | Trial reused existing kinds; recommendation: version the trace vocabulary separately |
| 5 | Two engine tests depend on what upstream Forge happens to do (a seeded game casting a specific card, the newest editions having cards). | Test maintenance | Fixed in the trial branch (seed 207, editions without cards skipped) |
| 6 | The card view's catalogue face says "Katalogtext: englisch" for a card without any rules text (a vanilla creature such as Hill Giant), although there is nothing to translate. | Presentation inaccuracy | Documented for the fine-polish (show the language only when there is a text) |
| 7 | On upstream Forge `9fb0151` asking the running attack input is no longer side-effect free (`AttackersTest.askingAboutTheDeclarationChangesNothing`). The shipped Forge `ed0333f` is not affected. | Engine finding for the next Forge update | Documented in the trial branch's commit and above; to resolve before that update (bisect upstream) |
| 8 | The complete regression (`scripts/regression/run.ts`) gave every step a scratch directory in the system temp directory as `TMPDIR`, Chrome's profiles included. In a RAM-backed `/tmp` (tmpfs, Debian's default) Chrome could not store the 79 MB engine in CacheStorage ("Cache.put() encountered a network error"), and the PWA suite reported a failed engine download although the app was intact — the same suite passed with the profile on disk. | Tooling defect | **Fixed**: the runner keeps its scratch directory short and disk-backed under `/var/tmp`, like the update pipeline (`169d591`) |

## Open items and blockers

- **Blocker for an "Android ready" claim and for retiring Anvil on Android:**
  one real game inside ORYX on a physical phone (checklist points 4–5 of
  [implementation/28](implementation/28-oryx-web-android.md), waived
  2026-10-08). Not a blocker for the UI fine-polish.
- The GraalVM/GFTC licence question stays open and disclosed
  ([PUBLICATION.md](PUBLICATION.md)).
- Question 5 of the engine plan ([OPENMANA_ENGINE_PLAN.md](research/OPENMANA_ENGINE_PLAN.md)
  §8, condition 3: "before phone support is promised") is only partly
  answered: the engine's start inside ORYX on the Fold7 (4.4 s, Prompt 31) is
  measured; memory, AI time, a long Commander game and tab discard on a phone,
  in Chrome and Samsung Internet, are not. The desktop figure is above.
- The update pipeline's GitHub Actions workflow has never run on a hosted
  runner (Prompt 26); engine builds run on the project owner's machine.
- Running games do not survive a reload or tab discard (Bible §6, post-MVP);
  recordings are not a resume.

## Evidence and reproduction

Local evidence (Git-ignored) under `reports/readiness-32/`:

| Path | Content |
| --- | --- |
| `matches-2/` | Final local run: `report.json` (per game: actions, decision kinds, Forge's history by actor, recording, replay, languages, hosts, workers), screenshots every five turns and of every result and replay end, the portable replay JSON |
| `matches-1/`, `trial-grixis/` | Earlier complete runs with other draws (13–41 turns) |
| `memory-commander/`, `memory-commander-2/`, `memory-commander-3/` | Three Commander games for the renderer's memory (17, 24, 17 turns), with the hard checks for refused inputs and actions without effect |
| `live-1/`, `live-check-1/`, `live-pwa/` | Production address: a game with recording/replay/portable JSON, the post-deployment live check, the PWA and credits check |
| `release-artifacts.log` | The GitHub release `engine-p8-2b0da7a21935` downloaded and verified against `deploy/artifacts.json` and the engine lock |
| `forge-trial-*.log`, `forge-trial-engine-report/`, `forge-trial-surefire/`, `forge-trial-seed-207/` | The Forge update trial: compile and JVM test runs, the engine report of the 15 fixtures on the new Forge, the JVM test XMLs, the seed search and the seed-207 game (the trial's commits stay on the local branch `forge-trial-32`) |
| `../regression-32/full-4/` | The complete regression (`report.json`, every phase's log, JVM XMLs, engine traces, browser reports and screenshots); `full`–`full-3` are the stopped earlier attempts |

```bash
# the app with the locked engine and catalogue, then the games (locally served)
OPENMANA_ENGINE_DIR=engine/build/publish-31b/dist OPENMANA_CARDS_DIR=engine/build/publish-31b/catalog \
  npx vite build --outDir reports/readiness-32/dist
OPENMANA_ENGINE_DIR=engine/build/publish-31b/dist OPENMANA_CARDS_DIR=engine/build/publish-31b/catalog \
  node scripts/readiness/matches.ts --serve reports/readiness-32/dist --out reports/readiness-32/<new> --keep-going
# production
node scripts/readiness/matches.ts --base https://openmana.oryx.quest --out reports/readiness-32/<new> --games live
node scripts/deploy/live-check.ts https://openmana.oryx.quest --out reports/readiness-32/<new>
# complete regression on the locked build
OPENMANA_ENGINE_BUILD_DIR=engine/build/publish-31b \
OPENMANA_TOOLCHAIN_DIR="$PWD/engine/build/publish-31b/toolchain" \
OPENMANA_CARDS_DIR=engine/build/publish-31b/catalog \
NODE_OPTIONS=--max-old-space-size=2048 JDK_JAVA_OPTIONS=-Xmx512m MAVEN_OPTS=-Xmx768m \
npm run test:regression -- --out reports/regression-32/<new>
```

Machine during the audit: the shared Linux host (12 cores, 15.5 GiB RAM,
`/tmp` in RAM) with another session's Android emulator holding about 5 GiB and
the swap file full. The host's earlyoom ended two regression attempts (see
"Complete regression"); heavy runs went one at a time. The WebAssembly compile
of the trial engine (6 GiB compiler heap) was not started under these
conditions.
