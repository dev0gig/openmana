# 48 — Observable engine steps: the observation contract (protocol 10)

## Scope and authority

The project owner's wish of 2026-10-12 ("ich möchte Züge vom Gegner auch
sehen, was er setzt und so"; tempo and an optional "Weiter"; tests per task,
the complete acceptance once at the end), central task
`dev0gig/dropzone/workflow/tasks/…/openmana-48-beobachtbare-engine-schritte.md`
of the series *openmana-spielfluss* (48–52) and its shared brief
`workflow/OPENMANA-SPIELFLUSS-2026-10-12.md` in Dropzone.

Before this prompt Forge ran whole phases and AI turns between two inputs of
the player; `BridgeGuiGame.stateChanged` sent a state at most every 120 ms and
folded the log in between. The video of 2026-10-12 showed no rule error - Forge
refused the second land in a turn - but the AI's turn was hardly visible. A UI
that merely replayed old states slowly over a game that had already moved on
would show stale cards and questions. This contract lets Forge report its
public actions and, at stable points, wait until the player has looked.

**Forge stays the only authority.** Nothing here decides, passes, answers or
chooses for the player; the AI and the rules are unchanged; observations come
from Forge's own game events, never from state differences or Forge's prose;
only what the player may see leaves the engine. Prompt 48 builds the engine
side and the transport; the UI (tempo, "Weiter", turn changes) is prompt 49,
the land and refusal hints prompt 51.

## The contract

### Actions (what happened, `ObservedAction`)

Built by `ObservationLog` (bridge) from Forge's event bus on the game thread.
It only listens - it never waits, sends or decides.

| kind | Forge event | carries |
|---|---|---|
| `turn` | `GameEventTurnBegan` | `turn`, `player` (the turn's player) |
| `turnEnd` | `GameEventTurnEnded` | `turn`, `player` (from Forge's phase handler) |
| `land` | `GameEventLandPlayed` | `card` - a land **play** Forge counts in `landsPlayed` |
| `cast` / `activate` / `trigger` | `GameEventSpellAbilityCast` | `card` (the spell or the ability's source), `targets` the player may see; `cast` = a spell, `trigger` = Forge's stack item is a trigger, otherwise `activate` |
| `attack` | `GameEventAttackersDeclared` | each attacker (by id) and whom it attacks |
| `block` | `GameEventBlockersDeclared` | for every attacker its blockers (empty = unblocked) |
| `resolve` | Forge resolving its stack's top (from the first event while `MagicStack.isResolving()` to `GameEventSpellResolved`) | `card`, `stack` (spell/ability/trigger), `fizzled`, `results` |
| `combatDamage` | damage and life events in Forge's combat damage steps | `results` |

- **Identity and order:** every action has `n` = 1, 2, 3 … without gaps over
  the whole game, in Forge's order; each is reported exactly once. An
  observation has `id` = 1, 2, 3 … strictly increasing.
- **Who:** `player` is who acted (turn's player, land's player, the stack
  item's activating player, attacker/defender, the active player for combat
  damage) as Forge's player id - never from names or prose.
- **Results** of a resolution or combat damage (`ActionResults`): cards that
  changed zones, damage dealt, life totals changed - in Forge's order, up to
  the next action, so the state-based actions Forge checks before the next
  priority (a creature dying of the damage) belong to it. Costs of a spell and
  the land moving when it is played are part of the action itself and not
  repeated. A resolution sent in its middle (Forge asks the player during it)
  goes on as a new action with `continued: true`. A land put onto the
  battlefield by an effect is a move in the results (library → battlefield),
  never a `land` action.
- **Public data only:** a card is a full `VisibleCard` (rules text, keywords,
  no markers of what can be done with it) only if Forge lets the player see it
  at that moment; otherwise `{hidden: true}`. A card moving into a hidden zone
  (a hand, a library, face down) is left out of the results. Damage to a card
  the player cannot see is left out. A card's view is taken at the event, so a
  creature that attacked and died later is shown as it attacked.

### Observations (when, `observation`)

An observation is the actions since the previous one, sent **right after a
fresh state** (`state` = that state's `seq`): the consistent picture after
them. It is sent only at stable points:

1. **Before Forge asks the AI what it plays** - a player gets priority: Forge
   has checked the state-based actions and put the triggers on the stack, and
   none of Forge's operations runs (no event dispatch, no cost payment, no
   stack resolution). The bridge's AI seat `ObservedAiPlayer` (Forge's
   `LobbyPlayerAi` with Forge's `PlayerControllerAi`, as Forge's
   `GamePlayerUtil.createAiPlayer` makes it) calls the bridge first in
   `chooseSpellAbilityToPlay`; the AI then decides exactly as before. Before
   that the bridge withdraws questions of inputs that are finished (no input of
   the player runs while the AI decides), so no question is open there.
2. Before the bridge waits for the player, asks a question (blocking, buttons,
   selection) or ends the game.

Only at (1) can an observation **hold**.

### Holding, release and settings

- **Mode** (`MatchSettings.observation`): `off` (default) - observations are
  sent, the engine never waits for them; `hold` - at an observation that
  contains an action of anyone but the player, a turn begin or end, or combat
  damage, the engine sends it with `hold: true` and waits on its single thread,
  at the stable point (1), until it ends. The player's own lands, spells and
  their resolutions are their own inputs and never hold.
- **Release:** `observation.release {observation: id}` releases exactly that
  observation; the engine confirms with `observation.released {id, seq, by:
  "release"}`. A release of an observation that is not held (old, released
  already, unknown) is refused as `stale`. Releasing passes no priority,
  answers no question and chooses nothing; the next decision of Forge comes as
  a question as before.
- **While held** the engine takes `state.request` (served at once),
  `settings.change` (switching to `off` ends the hold: `by: "settings"`) and
  `concede` (ends the hold first, `by: "concede"`, then the game). An answer,
  a card tap, a player tap or mana are refused with `observing` - looking and
  deciding are different inputs. No question and no other observation comes
  while one is held.
- **Watchdog:** the engine waits in the input queue like for any input, so the
  worker reports `engine.waiting`; the client's stall watchdog (30 s by
  default) never fires for a hold, however long the player looks. Aborting
  (`EngineClient.abort`) terminates the worker as always; a tab in the
  background or a change of mode (prompt 49) goes through `settings.change`
  or a release.
- **Same game:** the engine trace (prompt 05) records neither the waits nor
  the inputs read during them and numbers its traced inputs by game input, so
  the same game played with and without holds has the very same trace
  (`priority-respond-observe` is a variant of `priority-respond` and checked
  for that on the JVM, in Node and in Chrome).
- **Forge's auto-pass** (`MatchSettings.autoPass`, also through
  `settings.change`): Forge's own yield preferences of the player's
  controller, for this game only (never Forge's saved preferences):
  `noActions` = APINA (`YIELD_AUTO_PASS_NO_ACTIONS`, the default since prompt
  16), `noActionsRespectInterrupts` = APINA that stops once when Forge's
  interrupts fire (`YIELD_AUTO_PASS_RESPECTS_INTERRUPTS`; Forge's defaults: an
  opponent's spell, being attacked), `never` = Forge asks at every priority of
  the player. Switching APINA on goes through Forge's own `setYieldPref`, which
  lets Forge pass a priority without actions that waits right now - as Forge's
  own toggle does. `settings.applied {seq, observation, autoPass}` confirms the
  settings at the start (`seq: null`) and after every change; an unknown
  value is refused (`invalid`) and changes nothing.

### Land facts for prompt 51

- `Player.landsAllowed` is Forge's `getMaxLandPlays` (effects included),
  `Player.landsUnlimited` (new, only when true) Forge's
  `getMaxLandPlaysInfinite`; `landsPlayed` stays Forge's count of land plays.
- `VisibleCard.landRefusal` (new): on a land of the player's own hand that
  Forge does not mark playable, Forge's reason why it would not let the player
  play it now: `notYourTurn`, `timing`, `notOwner`, `zone`, `restricted`,
  `limit`. It is Forge's own check: Forge patch 0010 moved the checks of
  `Player.canPlayLand` unchanged, in the same order, into
  `Player.landPlayRefusal`; `canPlayLand` is `landPlayRefusal == null`. The
  bridge (`LandPlays`) asks it without a particular land ability - listing a
  card's abilities may create Forge objects - and Forge's `playable` marker
  wins (it knows permissions such as a land with flash). A land of a card
  whose front face is no land (a modal double-faced card) gets no reason:
  unknown stays unknown. Other refusal reasons are not transferred: Forge has
  no shared check that names them reliably.

## What was built

- **Protocol 10** (`engine/protocol/schema/protocol.schema.json`,
  `Protocol.java`, generated types and validators): `Observation`,
  `ObservationReleased`, `SettingsApplied`; inputs `ObservationReleaseInput`,
  `SettingsChangeInput`; `MatchRequest.settings` (`MatchSettings`,
  `ObservationMode`, `AutoPass`); `RejectReason` `observing`;
  `Player.landsUnlimited`; `VisibleCard.landRefusal` (`LandRefusal`); trace
  kind `observation`, trace snapshot `landsAllowed`/`landsUnlimited` and
  markers `landRefusals`. Details: `engine/protocol/README.md`.
- **Forge patch 0010** (`engine/patches/0010-land-play-answers.patch`): the
  read-only `Player.landPlayRefusal`; no rule, card or AI change.
- **Bridge:** `ObservationLog`, `ObservedAiPlayer`, `LandPlays`;
  `BridgeGuiGame` sends observations at the stable points, holds and handles
  releases, settings and refusals; `HumanMatch` checks `settings`;
  `EngineHost.awaitObservationInput` tells waiting to be looked at from a game
  input (the engine trace and the fingerprint use it); the fingerprint
  (`ProtocolTrace`) leaves out an observation's state number, which follows a
  clock.
- **Client** (`EngineClient`): checks every observation (right after the state
  it names, ids increasing, actions numbered without gaps, no hold while a
  question is open, no question or observation while one is held, the release
  only of the held one), refuses answers and taps while held (`observing`) and
  stale releases, `releaseObservation`, `changeSettings`, `heldObservation`,
  `settings`.
- **App:** `EngineSession` keeps the latest observation, whether it is held and
  the confirmed settings (`observation`, `observationCount`,
  `observationHeld`, `settings` of a playing match), `releaseObservation` and
  `changeSettings` (recorded like every input); the app does not ask for
  holds yet (prompt 49 does). Recording stores the new messages and inputs as
  sent; replay reads protocol-10 recordings and - unchanged - protocol-9 ones
  (`READABLE_PROTOCOLS`: protocol 10 only added messages, inputs and optional
  fields; their `game.started`/`engine.ready` are checked with the version read
  as today's). Older protocols stay exportable only.
- **Tests and tools:** JVM `ObservationTest`, `LandsTest`; fixtures `lands`
  (green lands, Exploration, Rampant Growth against red) and
  `priority-respond-observe` (a variant with holds and the refused inputs);
  coverage categories `observe-*`, `land-limit`, `land-extra`,
  `land-by-effect`; the replay checks observations and land refusals
  (`invariants.ts`) and can look long at a held observation (`--hold-delay-ms`);
  `node-observe.ts` (long look, concession, mode off, abort while held);
  `test-engine.sh` with `OPENMANA_FIXTURES=…` for a focused run, refused as
  acceptance by `engine-lock.mjs` and `scripts/regression/evidence.ts`.

## Candidate

The local development engine candidate for prompts 49–51 (built from commit
`8cf8bfd` with `engine/scripts/build.sh`, toolchain of `publish-47b`; its card
catalog with `npm run cards:build -- --bulk cards/build/cache/all-cards-20260924211809.jsonl.gz`):

| | |
|---|---|
| directory | `engine/build/candidate-48` (`dist/`, `catalog/`, `report/`, `jvm/`) |
| engine manifest SHA-256 | `f25d52a52720f6499eb5b5015006e2aeba59e78e0333c714f34b4e6041e6b2fe` |
| engine sources SHA-256 | `f3af74fe328f94a5a743676de4b69209f9da399e73d9dec0b4385f1683e7be25` |
| Forge | `ed0333fecb1fea0671b3e50cadc1da4f71db5798` + patches 0001–0010 |
| protocol | 10 |
| `openmana-engine.js.wasm` | `9f59df7956861d91edf66766cbe0ac25da7010b06c85a6c1879fc9b4835598a3` |
| `openmana-engine.js` | `edf456327b91601ab3ded0f35c6b1429adca8141a9fdd7d67849065185d72b42` |
| `engine-worker.js` | `bd33dbbd1aa0103a23d4159780e1156c334d94623a3e58d4e4117acad57b538c` |
| `forge-res.inventory.json` | `94b447cec329319b12be9c17e1838da1bdfd681fa45bb871b2d7dafb0ea1afa1` |
| JVM tests of the build | 105 passed, none skipped |
| catalog | id `0c2afda8fc8bd1fd`, `card-catalog.jsonl.gz` SHA-256 `0c2afda8fc8bd1fd37a04804fcb9268e9836095e12a2ff79ece36100bb5be2ce`, manifest SHA-256 `87eff7be2c246e5b7c1cb25deaa43b6f7d1364ebec0e414ef149b35b133cd79e` |

Before using it: `node scripts/engine-candidate.mjs engine/build/candidate-48`
(artefacts against the manifest, the manifest against today's engine sources -
any engine source change makes it stale -, Forge pin, protocol, JVM evidence,
catalog). Build or serve the app with
`OPENMANA_ENGINE_DIR=engine/build/candidate-48/dist OPENMANA_CARDS_DIR=engine/build/candidate-48/catalog`.
It is no lock (`engine/engine.lock.json` still names the protocol-9 engine
`engine-p9-fba5601117ff`, which today's app refuses), no release and never a
publication build; prompt 52 builds, accepts and publishes the final engine.
Earlier builds of this prompt stay for reference: `candidate-48-failed-1`
(the complete JVM suite found a crash at the end of a resolution and the
missing protocol-10 names in the contract test - both fixed),
`candidate-48-superseded-1` (before a state is sent with an observation only
when Forge changed something).

## Verification

Targeted checks of what this prompt changed (series rule of 2026-10-12), all
on the candidate above unless named otherwise:

- **JVM** (the candidate's build): 105 bridge tests, none skipped - among them
  `ObservationTest` (10: same game log and engine trace with and without
  holds, the same observations but for the hold flag, the AI's land, spells,
  attack, resolutions and combat damage observed, a held observation refuses
  answers and taps and other releases and serves a state request and a
  settings change, a real priority question in the AI's turn only after the
  release, concession and mode off while held, start settings, Forge's
  auto-pass `never`, an unknown setting refused) and `LandsTest` (5: Forge's
  reasons only where the state says so, the second land refused and the next
  own turn allowing it, Exploration's two lands, Rampant Growth's land as a
  move and never a land play, asking changes nothing). The first candidate's
  complete JVM run found two problems (a crash when Forge finishes a
  resolution with the stack already empty; the contract test's lists), both
  fixed before this candidate.
- **Engine, focused** (`OPENMANA_FIXTURES=lands,priority-respond,priority-respond-observe
  bash engine/scripts/test-engine.sh`, report `focused`, 0 failures): the
  three fixtures on the JVM (traces checked, coverage of `lands` and of the
  observe categories, message schema with the observation checks), replayed
  in Node (lazy; the observe variant also eager) and in Chrome (lazy) with
  equal engine traces - `priority-respond` and `priority-respond-observe`
  share one trace (SHA-256 `0288241c71ad…`) on JVM, Node and Chrome with 37
  holds, the refused inputs agreeing between client and engine; one AI game
  JVM/Node; `node-observe.ts` (long look 10 s against a 3 s stall timeout,
  concession, mode off, abort - each while held); Chrome's long look (12 s
  against 5 s, no stall).
- **Unit tests:** `engine` 107 (protocol schema with every protocol-10
  example, client lifecycle of observations and settings, fixtures, trace
  coverage), the app's 536 tests of the files that use the re-recorded scenes
  and sequence, the session, recording/replay (protocol-9 recording replayed
  unchanged, protocol 8 exportable only, observations no frame) and the
  regression evidence (a focused run is refused); typecheck (app and engine),
  oxlint, generated files.
- **Chrome with the app built on the candidate:** `--table-only` (all 312
  recorded/built scene and viewport checks and every table interaction on the
  re-recorded scenes), `--replay-only` (the protocol-9 recording imported and
  replayed at three sizes), `--drag-only` (two real games with the candidate
  engine, mouse and touch).

The table scenes and the run of consecutive states were re-recorded with
protocol 10 (`scripts/record-table-scenes.ts`, `scripts/record-table-sequence.ts`,
the sequence now begins at the last state before the draw). Their changes are
real ones: questions of a finished step (a payment that is done, the attack
once declared) are withdrawn before the AI decides, and Forge sends more
states at the start of a turn. The tests keep their intent on the new
recordings (the payment tests use the recorded payment scene, the spell's
damage is a step after it goes on the stack, the double-blocked combat has no
open question). The replay fixture `src/test/fixtures/replay.json` stays the
protocol-9 recording on purpose: it proves that older recordings stay
readable.

Not run here, by the series rule: the complete engine suite (all fixtures, AI
games, card probes), `npm run check` with the whole E2E and PWA suites, the
regression runner and the readiness games - prompt 52 runs them once on the
finished whole before anything is released.

## Limits

- An AI decision is preceded by a stable point; the player's own priority is
  not (it is a question anyway). Observations sent before a question never
  hold: a real decision of the player comes first.
- Results are grouped by Forge's resolution and combat damage steps. Moves
  outside an action (a discard at cleanup, a mana ability's damage) are part of
  the state and Forge's history, not an observed action.
- `landsUnlimited` is supported but no card of the test decks grants it.
- The app shows nothing of this yet; prompts 49–51 build the table's part.
