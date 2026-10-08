# Anvil parity — Prompt 30

Audit date: 2026-10-08. Reference: Anvil
`17f744863e806848a29a2ace9d50880bf01d6c72`, including `PROTOKOLL.md`,
`AUDIT.md`, the message/view-model/decision/settings implementation and the
Forge-side reference in `dev0gig/forge` at
`745f26d482c6ab0dde3b9b601b4ddc874da8cf39`.
OpenMana review base: `5f86ff3d8aa8509881d708890405ff4510d1f53f`.
The product authority is [BIBLE.md](BIBLE.md); interaction requirements also
come from [ANVIL_LESSONS.md](ANVIL_LESSONS.md).

The comparison concerns functional play in OpenMana's supported Constructed
and Commander games. It is not a claim that every Magic card, every Forge game
mode or physical Android behavior has been tested. Anvil's historical audit
findings were already fixed there; they are regression lessons, not current
claims against Anvil.

## Findings and remediation

| Finding at the review base | Correction | Direct regression evidence |
| --- | --- | --- |
| Combat damage questions contained only blockers; the defender, assignment prerequisites and `maySkip` were lost. Unblocked trample could produce an empty distribution question. | Forge patch `0009` extracts the desktop assignment policy into `CombatDamageAssignment`, shared with `VAssignCombatDamage`. The bridge sends Forge's defender and numeric prerequisites, returns the defender under Forge's `null` map key, and preserves explicit postponement. The UI reads numbers, never trample/deathtouch rules. | `DecisionParityTest`: blocked/unblocked trample, lethal/marked damage, deathtouch, ordered/unordered targets, free division, refused/allowed postponement. Real `parity-trample` fixture and accepted-answer trace coverage; new browser distribution scene. |
| Generic amount questions discarded Forge's per-target maxima. Their answer sum could overflow Java `int`. | `maximums` cross the protocol boundary; both UI and bridge enforce them, alongside the existing minimum and exact total. Summation uses `long`. | `DecisionParityTest` rejects `[4,1]` for caps `[1,4]` and an overflowing sum; decision model/component and browser checks. |
| `manipulateCardList(toAnywhere=true)` had no usable answer path. | Each movable card can be placed at a distinct, absolute 1-based slot. Only slot numbers and the hidden remainder's count cross the boundary; Forge's hidden cards retain their relative order inside the engine. Top/bottom ordering remains supported. | JVM callback with hidden remainder, duplicates and forbidden slots; UI bounds/arming/withdrawal; browser `arrange-anywhere`. This is callback coverage, not a claim that a natural game in the suite invokes `toAnywhere`. |
| Both entity-choice callbacks dropped `DelayedReveal`. | Show and acknowledge the reveal before asking for the choice, matching Forge's desktop callbacks. `PlayerControllerHuman` owns temporary visibility. | Both callback paths in `DecisionParityTest`; existing reveal controls, hidden-state tests and real-game visibility checks. |
| Input dialogs could not return Forge's cancellation value; an offered values list was treated as unrestricted suggestions. Repeated Enter was only guarded on the button. | Protocol permits explicit `null` only when the question is cancellable. Offered values constrain non-null input in UI and bridge. The input field and confirmation control suppress repeated Enter. Help follows the explicit flags. | Callback cancellation/invalid-option rejection; input component/model/arming tests; real Chrome input and cancel actions. |
| Changed card colors were never displayed; a change to colorless was omitted by the bridge. | Preserve empty WUBRG as colorless and show the current changed colors in card facts and the live viewer. | JVM `StateBuilder` cases, schema validation, German card-fact tests; unchanged cards receive no extra annotation. |

These changes use protocol **8**, regenerated from the canonical JSON Schema.
They do not change the pinned upstream Forge revision or add Magic rules to
TypeScript. Old protocol recordings remain exportable, and are not silently
reinterpreted as current games.

## Functional comparison

The evidence columns distinguish actual games from callback/unit tests and
constructed browser scenes. Current run paths and results are in
[implementation/30-anvil-parity-audit.md](implementation/30-anvil-parity-audit.md).

| Area / Anvil requirement | OpenMana implementation and assessment | Evidence |
| --- | --- | --- |
| Deck list, selecting both sides, start, new game | IndexedDB library, Arena paste/file import, explicit unresolved-line decisions, own/opponent selection and random opponent pool. Exact names/counts/sections go to Forge; unknown cards stop start visibly. Loading/refusal/retry and one game per worker are explicit. | `deck-selection`, import/library, `match-setup`, `game-start`, `engine-session` tests; real Chrome import/start/play and refusal/retry. |
| Formats, commanders, companions | Constructed and Commander, sideboard/commander sections and companion in sideboard preserved. Commander cast count/tax/damage originate in Forge. No Standard-only UI legality. | `HumanMatch`, `engine-deck`; legal 100-card `commander` game with cast, return, tax, damage and terminal result. |
| AI choice | Forge's Default/Cautious/Reckless/Experimental profiles plus random choice, persisted in settings. Names and resource hashes checked against the built engine. Honest play-style labels; cheating disabled. | `AiProfilesTest`, `ai-profiles` and preferences tests, actual AI games. The 2,400-game profile study is historical evidence for unchanged profiles, not newly repeated. |
| All generic decision paths | Blocking return-value callbacks, nonblocking two-button input and card/player selection are separate. Stable IDs, explicit answer/withdraw/reject messages, bounds and source-card views. | `BridgeGuiGame`, `Answers`, `ProtocolContractTest`, `HumanMatchTest`, decision tests and browser interactions; family mapping below. |
| Priority and playing/activation | `card.tap` works outside a question. Current Forge actionable/action/ways markers drive the UI. Stack order, source, targets, opponent-turn responses and phase labels remain current. APINA alone skips empty priorities. | `PriorityStackTest`, `priority-respond`, `stack-response`, real Chrome land play and table priority/stack interactions. |
| Mulligan and London bottom | Forge's buttons plus `setHighlighted`; no dependence on `setSelectables` for bottom cards. No suggested hand accepted automatically. | `HumanMatchTest`, real fixture mulligans, opening-scene browser actions. |
| Costs and nested decisions | Automatic/manual payment, mana sources/pool, life payment, X, kicker/sacrifice and nested decisions use Forge's offered data. Cancellation remains explicit. | `TargetPaymentTest`, `targets-payment`, recorded payment/X scenes and browser player/mana taps. |
| Targets | Cards, players and mixed targets, including cards outside displayed zones. Bounds belong to the whole Forge selection. Hidden choices use item numbers without disclosing identities. | `RunningInput`, `setSelectables`, `targets-payment`, target/card-view/decision tests and browser interactions. |
| Attack declaration | Current defender, player/planeswalker/battle references, Alpha Strike/Call Back and Forge's refusal reasons. Inspection never declares an attacker. | `AttackersTest`, `attackers`, attack-model/gesture tests; real trace includes planeswalker attack and defender switching. |
| Blocks and damage | Selected attacker and complete assignments, multiple/double blocks, generic order controls; repaired defender/threshold/cap/postpone paths above. | `blocks-multi`, `blocks-double`, `parity-trample`; block/decision tests and Chrome scene interactions. |
| Zones and live cards | Own hand, battlefield, graveyard, exile, command; library count only. Stack cards, attachments, tokens, counters, sickness, damage, loyalty, phased-out and changed colors. Viewer stores IDs/source references and resolves current snapshots. Catalog face inspection changes no game state. | `StateBuilder`, table/card-view/catalog/zone tests; live withdrawal/update browser checks and recorded zone scenes. Battle defense is supplied as Forge's Defense counter. |
| Hidden information | Forge decides visibility. Hidden cards carry only `hidden:true`, with neither ID nor name; question items similarly omit identities. Public face-down cards retain Forge's public face. | JVM hidden-hand checks, protocol rejection of hidden IDs/names, table/viewer tests. No claim of exhaustive testing of every conceal/reveal mechanic. |
| History | Forge MEDIUM log, ordered before state; unfiltered source cursor, structured actor/source, complete session history after end/abort. Unknown actor stays unknown. | `HistoryTest`, engine-session/history tests, all-viewport history inspection and original recorded events. |
| Game end and abort | Result is from the human seat, including draw/unknown; concession confirmed, terminal state/history retained. Technical failure is an abort without an invented loss. New game uses a fresh worker. | JVM win/loss/concession fixtures, end-label/session tests, real Chrome finished recordings, max1-worker checks. Draw/unknown presentation has boundary coverage, not a newly forced natural draw. |
| Errors and transport | Visible bad import/unknown card/start refusal/protocol mismatch/stale input/queue-full/worker abort/stall. No timed answer, silent normalization or fallback game. | Client/worker/schema/ring-buffer tests; actual Node protocol/divergence failures and Chrome missing-isolation check. |
| Settings | Card language, AI style and other rare preferences stay outside repeated start flow, persist locally and respect running-engine lifecycle. | Preferences/AI/card-language/session tests, Chrome preferences and reboot flow. |
| Safety UX | Safe inspection, explicit committed action, 500 ms arming, repeated-key/double-tap guards, current-question withdrawal, confirmed concede/end-turn/destructive storage actions, replay without input. | Card interaction, decisions, game page, storage/replay tests; keyboard and touch Chrome actions at phone/landscape/desktop plus all eight layouts. |
| Recording, offline and updates | Device-local original messages/accepted inputs, bounded retention and validated export/import; replay has no worker. Offline caches and waiting updates protect live sessions and user data. | Full app/PWA suite, actual original live/finished recordings and offline Forge; corruption/interruption/eviction/update failure paths. |

### Decision family mapping

| Anvil protocol | OpenMana / Forge callbacks | Coverage level |
| --- | --- | --- |
| `antippen` | `select`, `card.tap`, `player.tap`; `setSelectables` and running inputs | Real games + browser |
| `karten` | `choose`; `getChoices`, single/multiple entity choice | Real choices + callback tests for delayed reveal |
| `knoepfe` | `buttons`; `updateButtons`, priority, mulligan, costs, attack/block | Real games + browser |
| `jaNein` | `confirm`; `confirm`, `showConfirmDialog` | Bridge answer validation + constructed browser control |
| `optionen` | `options`; ability choice, option dialog, acknowledged revealed list | Real ability choice + callback reveal + constructed browser list |
| `zahl` | `input`; `showInputDialog` and inherited integer flow | JVM callback + constructed browser text/number/cancellation |
| `ordnen` | `order`; dual-list remaining bounds, plus `arrange` for top/bottom/free slots | Real scry + JVM answer/callback boundaries + constructed order/free-slot controls |
| `verteilen` | `distribute`; combat and generic amount assignment | Real damage including defender + callback caps/order/deathtouch + browser controls |

## Historical Anvil audit lessons

| Anvil finding | OpenMana counterpart and evidence |
| --- | --- |
| 1: unauthenticated listening game service | Browser-local worker, no game server or Odin connection. Build reachability/class audit excludes Netty/jupnp/Jetty/servlet from WASM. Optional ORYX sync is a separate, explicit account feature. |
| 2: update units missing from installation | Pinned clean-build/update pipeline, artifact hashes and local lock promotion only after complete checks; no systemd installation. PWA failure/update checks cover delivery. |
| 3: racing history cursor | Forge bridge runs on one thread; log cursor and questions share it. JVM thread diagnostics and JVM/WASM trace comparison; app folds messages in reception order. |
| 4: unlimited logs | Default 100 terminal recordings, configurable 1–1000, explicit retention/deletion confirmations and quota errors. Interrupted/damaged prefixes are not silently erased. |
| 5: missing pagination/cards | Generated complete catalog, inventory, all-card/token/layout probes, explicit unmatched-card decisions and visible picture fallback. No Arcaneum paging dependency. |
| 6: silent message-buffer overflow | SAB framing/full-queue checks with visible refusal; `postMessage` engine output validated in sequence; failure paths tested. |
| 7: unchecked input conversion | Schema and sequence checks at worker/client boundary; contextual bridge answer validation retains an invalid question. |
| 8: amount normalization violating minimum | Exact sum/minimum/caps/prerequisites now checked without normalizing; integer overflow regression added. |
| 9: clients endlessly stealing one server session | No shared network game session. One engine worker per app session, lifecycle measured; separate tabs are independent, while local-data/PWA coordination is tested. |
| 10: stale server log paths | Partien/export routes refer to browser recordings, not a server directory. |
| 11: unused hidden-card renderer | Active hidden-card table path is exercised by schema/table/viewer/browser tests. This audit is not a claim that all repository dead code was exhaustively removed. |

## Intentional differences and limits

- **Local execution and recovery:** no websocket reconnect, server-session
  takeover, Odin/Tailscale/Arcaneum dependency or server log browser. Reload,
  tab discard and browser termination can end a live game; the Bible explicitly
  defers authoritative resume until post-MVP. Recorded snapshot replay is not
  match recovery. Leaving a running game is guarded and explained.
- **Formats:** initial Constructed/Commander scope is allowed by Bible §8.
  Anvil's paired Jumpstart deck chooser is not present; combined lists can be
  imported as one Constructed deck. No automatic two-half-deck selection is
  claimed. One game per match means no between-game sideboarding UI; sideboard
  cards themselves are retained for Forge.
- **Engine maintenance:** Anvil's in-app server updater is replaced by the
  maintainer's clean Forge update pipeline and app/PWA distribution. Players
  cannot mutate the embedded engine from a live game.
- **Presentation:** OpenMana's dark web design, catalog/images, safe viewer and
  ORYX navigation replace Android Compose backgrounds/gestures/server paths.
  Anvil's optional background pictures and celebration effects are not gameplay
  requirements or copied assets. No final visual-polish pass was done here.
- **AI/inputs:** profiles are styles, not fabricated difficulty levels;
  malformed answers are rejected, not normalized. No meaningful decision is
  automatically taken merely because Forge suggested it.
- **Devices/publication:** eight CSS/touch viewports are browser emulation.
  dev0gig deferred physical Android/ORYX acceptance to publication Prompt31,
  with verification in Prompt32. That gate remains **not performed/not passed**,
  alongside source/license/icon/publication gates. No push, deployment or APK.

The corrected decision paths and comparison above establish the tested
functional baseline. They do not guarantee arbitrary cards or future Forge
updates. Keep the differential/callback/browser gates and the explicit limits
when maintaining this parity report.
