# OpenMana Agent Instructions

## Current Work Safety
OpenMana may be under active implementation by another agent. Before any change, read `STATUS.md`, the central Dropzone task state and inspect the actual Git/repository state. **Never reset, move, rename, rewrite or reclassify an `IN_PROGRESS` prompt or its work unless explicitly assigned to that task.** Preserve concurrent/later work.

## Agent Startup Contract
Before implementation:
1. Read this file.
2. Read `STATUS.md` for the compact project map.
3. Read `dev0gig/dropzone/workflow/tasks/INDEX.md` and the assigned central task for the queue execution state.
4. Read the complete assigned prompt.
5. Read relevant `docs/BIBLE.md`, `docs/ANVIL_LESSONS.md`, research and implementation documentation.
6. Inspect actual code/tests/Git state before planning.
7. If a task references Anvil, use the documented Anvil repository/protocol/audit material as reference where relevant.

## Canonical Product and Architecture
`docs/BIBLE.md` is the canonical product/architecture document. Research and implementation notes may refine feasibility, but architectural discrepancies must be resolved deliberately rather than silently.

### Non-negotiable rule
**Forge is the sole authority for Magic rules, card behaviour, legal actions/targets, stack/priority/combat/state-based actions and AI.**

OpenMana UI must not implement a parallel Magic rules engine or hard-code card/mechanic-specific legality. Scryfall is presentation/metadata, not rules authority.

## Architecture Boundaries
- Browser-first and touch-first; desktop is also first-class.
- Forge runs browser-local through the proven WASM direction; no Odin/Tailscale runtime dependency.
- Preserve the hard UI → OpenMana protocol → Forge bridge → Forge WASM separation.
- Adapt Forge API changes at the bridge boundary rather than leaking internals through UI.
- Forge revisions/toolchain/patches must remain pinned/reproducible and updated deliberately.
- Imported decks/local user data remain local-first; IndexedDB is the planned durable store.
- Android uses the shared ORYX TWA and the same web application. Do not create an individual Android UI, wrapper or APK pipeline.

## Forge Update Rules

Use `engine/UPDATING.md` for a dedicated Forge update:

- Stage the full upstream gitlink, keep the submodule clean and apply changes through the patch queue. Updates stay in `engine/**`; a necessary protocol adaptation needs a raised protocol version, a concrete reason and explicitly authorized exact outside paths. Toolchain changes are separate.
- Run `engine/scripts/validate-forge-update.mjs --base <review-base>` in a fresh output directory. Complete JVM, Node, Chrome, catalog and app/PWA checks are mandatory; never skip browser tests or promote a partial result. Only the successful pipeline writes `engine/engine.lock.json`.
- Before reusing an engine, run `engine/scripts/engine-lock.mjs verify <dist>` and select that build and its catalog through `OPENMANA_ENGINE_DIR` / `OPENMANA_CARDS_DIR`. Keep earlier builds and failed evidence. Input reproducibility and verified artifact hashes do not imply bit-identical compiler output.

## User Interface Rules
The web app (repository root, `src/`) follows `docs/DESIGN_SYSTEM.md`:
- Build UI only from shadcn/ui components and the OpenMana design tokens in `src/index.css`; no custom CSS or ad-hoc Tailwind styling in pages. A missing component is added as a shadcn component (registry, or built the shadcn way in `src/components/ui/`).
- Dark theme only; touch targets of at least 44 px on touch screens; WCAG AA contrast.
- Everything the player reads is German; code, routes, protocol and developer messages are English.
- `src/` imports from `engine/` only via `@openmana/engine-protocol[/<file>]` and `@openmana/engine-client` (enforced by `src/app/boundary.test.ts`).
- Never show invented game data: empty stays empty, unavailable actions stay disabled with a reason, failures are visible.
- Verify UI work with `npm run check` (typecheck, lint, unit tests, end-to-end test in Chrome with the real engine).

## Local Data Rules
The player's data lives in IndexedDB through `src/storage` (prompt 07, `docs/implementation/07-indexeddb-storage.md`):
- Never `localStorage`/`sessionStorage` as a store (enforced by `src/app/local-first.test.ts`; the one exception is the vendored ORYX SDK's own connection data); the storage layer never talks to a network.
- Record shapes and the backup lines are defined only in `src/storage/schema/local-data.schema.json`; after a change run `npm run generate` and commit the generated files (`npm run check`/`build` fail on stale ones).
- Any change to a record shape or to stores/indexes raises `SchemaVersion` in the schema and adds a migration in `src/storage/migrations.ts` (never edit a released one); record upgrades are pure functions, because older backups are upgraded with them too. User data is migrated, caches may be emptied.
- Write through `LocalDatabase.write` (one transaction, all or nothing, only IndexedDB requests awaited inside) and check records before writing (`assertRecord`); show damaged stored records as damaged, never drop them silently.

## Card Data Rules
Card names, texts and pictures come from the card catalog (prompt 08, `cards/README.md`, `docs/implementation/08-scryfall-data.md`):
- Scryfall data is for display, search and import lookups only - never for rules, legality or card behaviour (Forge decides). In a game, Forge's live text is authoritative.
- Built at build time from Scryfall's bulk data and Forge's card database (`npm run cards:build`), checked and served like the engine (`vite/card-assets.ts`), installed into IndexedDB once per version. The app never asks Scryfall's API per card shown; the API is only for particular printings (`src/cards/prints.ts` through `src/cards/scryfall-client.ts`, which alone enforces Scryfall's rate limits, the Accept header and the 30-second pause after HTTP 429). The app has one client for its whole life: use `src/cards/scryfall-access.ts`, never a second `new ScryfallClient()`.
- Look cards up through `src/cards/card-lookup.ts` (names via `src/cards/names.ts` keys; engine keys via `resolveEngineKey`), and derive what to show with `src/cards/card-display.ts` (German where it exists, English marked). Never parse localized names or texts to find a card.
- Card pictures only through `CardPicture` (`src/components/ui/card-picture.tsx`): CORS mode under COEP, no referrer, never cropped, blurred or overlaid (Scryfall's terms); a missing or failing picture shows the card's text, never an empty box.
- A Forge update rebuilds the catalog; a Forge card without Scryfall match is decided in `cards/forge-unmatched.json`, never silently dropped.

## Deck Import Rules
Arena deck lists are imported through `src/decks/` (prompt 09, `docs/implementation/09-arena-deck-import.md`):
- `arena-list.ts` reads MTG Arena's format only and is pure; every line is an entry, a header, an About line, blank, or a problem with its line number - never skipped silently.
- `deck-resolve.ts` resolves a line through the card catalog first (ranked: own/Forge name, front face, later face, alias, printed German name); Scryfall's API only for lines the catalog cannot decide that name a printing. Never guess: several playable cards of one name are the printed line's or the player's decision. A deck entry's `name` is the name Forge knows (`CardRecord.forgeNames` / Forge-only cards); set codes are stored as Scryfall's.
- `deck-plan.ts` decides what is saved: nothing is saved while a line is open (corrected, chosen or explicitly left out), the list is kept unchanged in `source.text`, the companion goes into the sideboard (Forge looks for it there), a commander makes it `commander`. No legality checks (deck size, copies, colour identity, bans): Forge decides.

## Deck Library Rules
The library and the deck choice for a game are `src/decks/` (prompt 10, `docs/implementation/10-deck-library.md`):
- Change decks only through `src/storage/decks.ts` (`renameDeck`, `duplicateDeck`, `replaceDeck`, `deleteDeck`): read and write in one transaction, so a deck deleted meanwhile is never brought back (`not-found`) and a damaged one never overwritten. Renaming and duplicating keep the imported list (`source`); only importing the list again replaces it, confirmed. Every change sets `updatedAt` (the cloud merge goes by it), and deleting leaves a deletion mark (`deckTombstones`) in the same transaction - never delete a deck record any other way.
- `deck-view.ts` is how a saved deck is shown (card per entry, German/English status, cover card, which picture): by Oracle id and Forge name, never by parsing names or texts; without catalog data the name Forge knows, marked, never a guessed card. Scryfall's API only for printings the catalog lacks (`named-prints.ts` through the one client).
- The deck choice is two settings, `play.humanDeck` and `play.aiDeck` (`deck-selection.ts`). Both decks share the player's format (Forge plays one `MatchRequest.format`); a random AI deck is drawn when a game starts (`drawAiDeck`) from the valid decks of that format other than the player's own. A choice that stopped fitting is shown, never silently replaced.
- A phone page's primary action lives in an `ActionBar` above the tab bar; the export keeps the imported list available unchanged.

## Game Session Rules
A game against Forge's AI runs through the app's one `EngineSession` (`src/engine/engine-session.ts`; prompt 11, `docs/implementation/11-game-session.md`):
- One engine at a time and one game per engine: a finished game's worker is released and the next game boots a fresh one. Never start a second engine, never reuse a spent one.
- Start a game only with `startMatch` and a setup from `src/game/match-setup.ts` (the protocol's Deck through `engineDeck`, the player's deck's format, a random AI deck drawn for every game, a seed the app draws). The UI never builds a `MatchRequest` by hand and never sets `trace`.
- Every state has a way on and says why: refused (Forge's `engine.error` with its report; the worker stays usable), aborted (`engine.abort`), silent (the client's watchdog). `prewarm` works only from idle: a failed engine is never retried silently, and no fallback hides an engine failure.
- Who is who comes from Forge's structured state (`me`, `activePlayer`, `result`), never from names; Forge's own texts (German, `ENGINE_ARGS`) are shown as Forge sends them.
- Conceding and ending a game without a result are confirmed first; while a game is on its way or running, leaving the page asks first (a reload ends the game).

## PWA Lifecycle Rules
Production PWA code is `pwa/`, `vite/pwa.ts` and `src/pwa/` (prompt 25, `docs/implementation/25-pwa-cache-offline.md`):
- Registration is gated by the actual Vite build command and current isolation, never `PROD` alone; development has no offline worker.
- Activate shell/cache readiness only after complete byte-length/SHA checks; keep the previous version usable on failure. Engine caching is explicit, independently versioned and never mixes partial versions. Preserve MIME and COOP/COEP/CORP in cached responses; user IndexedDB and third-party/cloud traffic stay outside this cache.
- Never force `skipWaiting`, reload or tab navigation while clients of the old version exist. Explain that all old tabs/windows must close. Download controls protect the current running/starting/queued match; installation and persistent storage requests require user actions.
- A cached engine does not imply a supported browser or a recoverable match. Reload/background discard may end the game. Claim offline play only with real browser evidence after cache clearing and actual server shutdown; preserve original match traffic and data across updates.
- Keep the real browser client release interval before replacement and the existing attempt cancellation guard; `terminate()` has no completion promise. Full original worker traces must still satisfy max1. `npm run check` includes the original app/Forge suite and the additional `test:pwa` suite.

## Game Table Rules
A running game is the game table (`src/game/game-table.tsx`; prompt 13, `docs/implementation/13-battlefield-foundation.md`):
- The table is a view of one full state (`GameState`, the open questions, Forge's prompt line) and never sends anything itself; the page adds the menu (the way around the app, Forge's notices, conceding - confirmed), the warnings, the one way to act on a card (`onTapCard`, prompt 14; see Card Interaction Rules) and the one way to answer Forge (`onAnswer`, prompt 15; see Decision Rules). The replay of prompt 22 shows recorded states with it - without `onTapCard` and `onAnswer`, cards can be looked at and questions read, never tapped or answered.
- `src/game/table-model.ts` arranges the state from Forge's structured values only: seats from `me`, the row of a card from whether Forge sends power/toughness, piles of cards whose every value Forge sends is equal - never cards Forge names elsewhere (open questions, stack sources and targets, combat, attachments) -, attachments with their host (`attachedTo`), the stack in Forge's order (first = top) with each item's card (prompt 16: a spell's own card lies on the stack, `locateCard` finds it there). No legality, no computed values (no "remaining toughness"), no card- or name-specific branches.
- Hidden stays hidden: a `HiddenCard` is a back and a count, never told apart or identified; what Forge reveals is shown; `game.started.cardNames` is never shown as anyone's cards.
- Card pictures through `useTableCards` (`src/game/table-cards.ts`): Forge's key resolved once per key against the installed catalog, shown in the player's card language; a key the catalog cannot decide (tokens of one name that fit alike, Forge-only cards, Forge's effect cards) gets Forge's own words, never a guessed picture. Only catalog answers are remembered, never cards of the game.
- Nothing is drawn over a card picture: a card's facts go into `GameCardCaption` below it; tapped is a quarter turn (`GameCard`); Forge's marks are a frame around it (prompt 14).
- `GameBoard` keeps eight regions on the screen (portrait: stacked; landscape: side column) and the page never scrolls; card rows scroll sideways, texts inside their region. The table takes the whole screen while the game runs (`useImmersive`, `src/app/immersive.tsx`).
- Forge's own texts (prompt line, questions, stack descriptions, button labels) are shown as Forge sends them; a notice appears as a toast at the top and stays in the menu (`noticeCount`).
- Verify table changes with the unit tests on real recorded scenes (`src/test/table-scenes.ts`, re-recorded with `scripts/record-table-scenes.ts` after `engine/scripts/test-engine.sh`) and the end-to-end test's section 12 (those scenes in the real table at eight sizes).

## Card Interaction Rules
Every card the player may see on the game table is a control (prompt 14, `docs/implementation/14-card-hand-interactions.md`):
- Looking is always safe and sends nothing: the card view (`src/game/card-sheet.tsx`, a shadcn `Sheet` - from the bottom in portrait, from the side in landscape) opens on a long press, a right click or the context-menu key (the `contextmenu` event, prevented) and on the primary activation in every step that does not tap at once. It keeps only the card's id and source references and reads the card from every new state (`locateCard`, prompt 20); a card that left says so. Question-only cards resolve the current cardView of the same open question ID, never a stored card object. A card on the stack (prompt 16) is only looked at, never tapped.
- A tap is Forge's `card.tap`, sent only by the page (`GameTable.onTapCard` → `EngineSession.tapCard`, only while Forge waits, never during a concession) and only where Forge offers one. What a card can do comes from `src/game/card-use.ts` alone: the mark from Forge's `highlighted` (chosen) and `playable` or an open selection naming the card (usable); the tap from the selection (its words), Forge's `action` (its words, as sent), the London mulligan's step for the player's hand, or `playable` without words. No tap is offered where a tap would provably do nothing; no rule, no card name, no guessed text.
- The primary activation taps at once only in the steps whose taps Forge lets the player take back and confirms with its own button: a selection naming the card, and the buttons' `purpose` `payment`, `attack`, `attackDeclared`, `block`, `mulliganBottom` (Anvil's lessons). Everywhere else - priority above all - it opens the card view, whose main button taps. A double tap on a direct card counts once.
- Against taps by mistake: the card view never focuses its tap button, the button ignores presses for `ARMING_MS` after it appeared or changed meaning (and outside presses do not close the view that early), a repeated keydown is dropped, and nothing taps while Forge computes, a blocking question waits or a concession is on its way (`tapBlocked`, with the reason shown). Never weaken these guards for speed.
- Marks are frames around the picture, never on it (`GameCardButton`/`GameCard` `mark`): usable = dashed `--primary`, chosen = solid `--foreground`. A card's name for screen readers says its facts, its mark and - where it taps at once - what the tap does (`cardButtonLabel`).
- Rows of cards are toolbars (`GameCardRow controls`: Radix Toolbar - one Tab stop, arrow keys, Home, End); a row without such cards stays a focusable list. A `GameCardRowButton` must sit in a toolbar row.
- Verify with `src/game/card-use.test.ts` (real recorded scenes plus built selections/mulligan), `src/game/card-interaction.test.tsx` (look, arming, keyboard, context menu, long press, swipe, live updates) and the end-to-end test's section 12 (`tableInteractions`: the same in real Chrome at eight sizes, with the harness recording taps).

## Zones and Full Card Viewer Rules
Prompt 20 (`src/game/zone-sheet.tsx`, `card-view-model.ts`, `card-sheet.tsx`, `docs/implementation/20-zones-card-viewer.md`):
- "Zonen ansehen" in the table header opens graveyard, exile and command zones of either player and stack cards. The compact player counters stay facts; do not add tall buttons there or in the stack that squeeze the battlefields (small-phone regression: keep at least 80 px).
- Zone sources hold player ID/zone; pile sources hold IDs only. Resolve visible candidates and the selected card from each current snapshot. Hidden stays a count, an empty zone stays empty, the library stays Forge's number. Question sources hold the exact open question ID; withdrawn cards never survive as snapshots.
- Zone/list/pile navigation always inspects, even during direct-tap steps. The full viewer alone offers the current Forge action, with the selected card ID. Re-arm after changing ID even when the action words are identical; busy, concession, blocking-question, replay and double-tap guards stay intact. Its sticky action/footer remains reachable.
- Card sides are catalog presentation only, through the same `useTableCards`/`cardDisplay` pipeline. Begin with Forge's current key/face, reset inspection when that key changes, never send input for a side switch. Keep Forge facts/actions attached to the actual card. Label supplemental catalog text and DE→EN fallback; an English preference is not a claim that German is unavailable. Never replace a missing back image with the front.
- Verify `card-view.test.tsx`, affected card/decision/catalog tests and `npm run test:e2e -- --no-build --zones-only` (three sizes, recorded zones plus explicitly built catalog boundaries). This focused mode does not replace complete app/engine/device acceptance.

## Game History Rules
Prompt 21 (`src/game/history-sheet.tsx`, `EngineSession.history`, `docs/implementation/21-match-history-events.md`):
- History is Forge's MEDIUM GameLog (`events`), never narration derived from snapshots or input. Append every entry in reception order before folding the next state; retain kind, text (including null), actor and card ID. Repeated texts are distinct; never cap the log at the notice limit.
- Actors come only from structured Forge source controllers at bridge emission. A log entry without a source/controller stays unassigned; never parse names or translated prose. This is a source-controller attribution, not a new authority on the acting player of every effect.
- History sources resolve against the current visible state/open questions. Missing/hidden sources stay unavailable; never infer card identities from text or preserve stale card objects. History inspection uses the existing card viewer read-only and restores focus to the log.
- The header opens a compact portrait / richer landscape Sheet without reducing battlefield height. Full texts scroll inside, new entries never move the reader automatically; "Neueste Einträge" scrolls on request. The just-finished/aborted session keeps its log; persistence/replay is implemented in prompt 22.
- Verify session/history tests, Bridge `HistoryTest`, recorded Chrome history at three sizes (`--history-only`) and full `npm run check` with the real engine after bridge changes.

## Recording and Replay Rules
Prompt 22 (`src/matches/`, `src/storage/matches.ts`, `docs/implementation/22-match-recording-replay.md`):
- Capture the accepted session inputs and original engine messages in reception order, beginning at `game.started`. Store exact deck requests, seed, boot arguments, ready/build facts and manifest SHA-256; never infer events or results from snapshots.
- Header and transcript batch commit together. Failed storage reports a problem while the game continues; deletion must never resurrect a recording. Default retention keeps the latest 100 terminal recordings; running/interrupted prefixes and damaged records require explicit removal.
- Replay folds the recorded protocol envelopes and authoritative full states only. Pass no live input callbacks to the table; card/history inspection sends nothing. Another protocol remains exportable but is not interpreted by today's UI.
- Portable replay JSON format 1 is schema-checked, bounded to 100 MiB and validated completely before an atomic import. Same ID with identical canonical content is a no-op; a conflict never overwrites data. Import and retention use one transaction.
- Verify the framework-free recorder with fake IndexedDB and the real EngineClient/scripted Worker, then the complete `npm run check`: actual browser Forge games plus replay/library/file/retention checks. `--replay-only` uses recorded Forge messages with assembled portable metadata; it is not a new live recording or a deterministic engine re-simulation.

## Beginner Help Rules
Prompt 23 (`src/game/beginner-help.ts`, `src/game/help-sheet.tsx`, `docs/implementation/23-beginner-qol.md`):
- Explain the current structured questions with the existing blocking precedence. Required/optional labels use only explicit min/bounds/cancellable fields; suggestions and localized prose never decide optionality or legality. Zero-item optional choices still require explicit completion.
- Phase/terminology text is static orientation. Forge’s legal-action, attack/block, tapped and sickness markers remain authoritative. Preserve arming, confirmation, withdrawal and every meaningful player choice.
- Target emphasis uses only exact current stack target IDs, separately for cards and players. Hidden/missing identities stay hidden; usable/selected frames take precedence. A target mark never enables an action.
- Help opens from the turn/phase area, updates from current props, restores focus and sends no input. Replay stays read-only. Abort advice uses structured reasons and retains technical details; reload advice must disclose loss of the current game.
- Verify focused help/error tests, `--help-only` recorded/built scenes and the complete app check with fresh real desktop/phone Forge games. Chrome viewport/touch emulation is not physical-device evidence.

## Responsive Rules
Prompt 24 (`docs/implementation/24-responsive-polish.md`):
- Viewport/orientation changes only present state. Never send engine input, restart a Worker or mutate MatchLog on resize. Preserve current viewer ID, focus, reachable footer and inspection guards.
- Bound/wrap user names inside Page/Item/Dialog/Sheet; coarse-pointer Button sizes and Input targets stay at least 44 px. Table-card minimums and safe gestures retain their existing rules.
- Keep all eight CSS viewports in the application/table e2e audit, including both fold-like orientations. Emulation does not prove physical Fold, hinge or ORYX-device behavior.

## Decision Rules
Forge's questions are answered in the table's decision region (prompt 15, `src/game/decision-panel.tsx`, `src/game/decision-model.ts`, `docs/implementation/15-forge-decisions.md`):
- Every kind of question the protocol knows has its controls: Forge's two buttons (`buttons`), a selection (`select`: cards the table shows are tapped on the table, the others - graveyard, exile, library, hidden - come as a row in the region), `choose`, `confirm`, `options` (and Forge's revealed lists with one OK), `input`, `order`, `arrange`, `distribute`. A blocking question is answered alone; otherwise Forge's buttons and its selection side by side (`currentDecision`).
- Nothing is answered for the player: no default taken, no timer, nothing sent on a new state. Forge's suggestion is only the first draft. A draft that does not fit the question's own numbers (min/max, remaining bounds, total and minimum per item, allowed sides, a whole number) is never sent - its button stays off and says why. Only `decision-model.ts` checks, only against what the question says; no rule, no card name.
- Answers go through the page (`GameTable.onAnswer` → `EngineSession.answer`): only while Forge waits, never during a concession. The client's refusal shows as a toast, the engine's (`input.rejected`) as Forge's notice - nothing disappears silently. Without `onAnswer` (a replay) questions are shown, never answered.
- Sending buttons are armed `ARMING_MS` after their question appeared (Forge asks the next question at once, often with a button in the same place) and drop repeated keydowns. Never weaken this for speed.
- Words: the buttons and selection of a running step show Forge's prompt line (their own text is the line of the moment the step began); a blocking question shows its own text. Forge's labels as sent; a button without one is "OK" (1) / "Abbrechen" (2), the protocol's meaning. The one exception is the player's priority (prompt 16, see Priority, Stack and Turn Rules): its words come from Forge's structured state, and Forge's OK says what passing does. Players in items by `me` ("Du", "Forge-KI"), never by name. Players as targets: see Targets and Payment Rules.
- A withdrawn question takes its controls and any draft with it; the next question starts afresh (keyed by question id).
- Protocol 8 (Prompt 30): distribution maxima/prerequisites and `maySkip`, absolute `arrange.positions` when `toAnywhere`, and input cancellation/allowed values come from Forge. The UI validates only these structured bounds. Combat policy lives in Forge patch `0009`, shared with its desktop dialog; never duplicate lethal/trample/deathtouch rules in TypeScript or the bridge. Changed card colors include the empty string for colorless. Keep the actual `parity-trample` trace fixture and callback tests distinct from constructed browser scenes. See `docs/ANVIL_PARITY.md`.
- The region grows only as far as its content needs (`GameBoard decision`: `tall` for words that do not fit - at most 28 % of a portrait screen -, `expanded` for a blocking list/form, cards outside the table, or words while stack and combat are empty - at most 36 %); in a low landscape window an expanded decision takes the stack's place. The answer buttons stick to its bottom.
- Verify with `src/game/decision-model.test.ts`, `src/game/decision-panel.test.tsx` (recorded scenes of every kind the test games reach, questions built after the schema for the others - `src/test/built-questions.ts`), `src/game/game-page.test.tsx` (answers through the real client) and the end-to-end test: section 10 plays the real game (keep, pass, play a land, pass), section 12 checks every kind at eight sizes (`decisionFits`) and answers every kind at small-phone, phone-landscape and desktop (`decisionInteractions`).

## Priority, Stack and Turn Rules
The player's priority, the stack and the turn's steps (prompt 16, `src/game/turn-model.ts`, `PriorityDecision` in `src/game/decision-panel.tsx`, `src/game/game-table.tsx`, `docs/implementation/16-priority-stack-phases.md`):
- Forge's own auto-pass stays in charge: the engine runs with `YIELD_AUTO_PASS_NO_ACTIONS` (APINA), so a priority in which Forge finds nothing the player can do never reaches the table (Forge's finding is the player's `canAct`). The app never passes, answers or skips anything by itself - no timer, no auto-pass of its own, nothing sent on a new state.
- A priority says what it is about in words from Forge's structured state (`priorityText`: whose turn it is, the stack's top by its `card`, `ability`, `trigger` and `player`) instead of Forge's status line (turn, step and stack with the players' names). Never parse Forge's prose to find out.
- Forge's buttons of the priority step go by `Button.meaning` (the bridge reads Forge's own label keys): `pass` is labelled by what passing does now - `Weiter` with an empty stack, `Verrechnen lassen` with something on it, explained by `PASS_NOTES` -; `undo` keeps Forge's words and is sent at once; `endTurn` keeps Forge's words and is sent only after its `AlertDialog` (`endTurnText`), because it gives the rest of the turn away (Forge leaves out an own attack). A button without a meaning keeps Forge's words and behaviour. The arming of sending buttons applies unchanged.
- Cards are played at priority by tapping them (Card Interaction Rules: the card view's button, Forge's `card.tap`), never through a list or a question the app makes up.
- The stack region shows every item top first with its card (`StackItem.card`: a spell's own card, an ability's source; a hidden card is a back), what it is (`STACK_KIND_LABELS`), whose it is, its targets and Forge's description. A card on the stack is looked at - its card view says where it is on the stack (`StackFacts`) - never tapped (`cardUse` zone `stack`).
- The header shows the turn's steps as a `PhaseTrack` (`turnSteps`: the fixed order of Forge's `PhaseType`; a picture of the words beside it, hidden from screen readers) and whose turn it is. Forge moves the game on; the track only shows where it is (a step Forge skips is simply passed over).
- Verify with `src/game/turn-model.test.ts`, `src/game/priority.test.tsx` (recorded scenes `main-phase`, `opponent-turn`, `respond`, `respond-own`, `stack`, `yes-no`), the engine's `PriorityStackTest` (APINA, meanings, End Turn and Undo in real games, stack cards, looking without side effects) and the end-to-end test (section 10: the real game's priority and header; section 12: the priority scenes at eight sizes, priorities answered, End Turn asked first).

## Targets and Payment Rules
Targets, choices of players and cost payment (prompt 17, `src/game/card-use.ts` `playerUse`/`stepSource`, `src/game/decision-model.ts` `selectView`/`paymentView`, `src/components/ui/game-player.tsx`, `docs/implementation/17-targeting-cost-payment.md`):
- A player is tapped (`player.tap`) only where the state marks them `selectable` - the bridge asks Forge's running input with the same checks its click runs (`RunningInput`, Forge patch 0007) - and Forge's `highlighted` is "chosen". The UI never decides which player is a valid target. Players are controls on their seat (name and life, `GamePlayerButton`: the cards' marks as an inset outline that takes no room) and in the decision region; both tap at once, guarded against a double tap like the direct card taps.
- A selection's `min`/`max` are Forge's own bounds for cards and players together; "chosen" counts Forge's highlights on both. Cards Forge names stay the only card targets (`select.cards`); players are never items.
- The payment is `GameState.payment` alone: what is still to pay in Forge's symbols (spoken via `manaSymbolsText`), the pool colours Forge would take (`mana.use`, one button each), life for Phyrexian mana through the player's own seat. Mana sources are tapped on the table (a direct step). The app never pays by itself; Forge's Auto and Cancel stay Forge's buttons.
- Anvil's special paths stay open: during payment and the London mulligan a tap never depends on `action` alone (`playable`, the mulligan's step - `DIRECT_STEPS`); a `player.tap`/`mana.use` Forge would not take comes back as `no-effect` (a notice), never silently.
- The card the running step is about (`card` of the selection or payment question) is its source: shown in the decision heading and as "Quelle" below its picture on the table.
- A Forge patch may add only read-only answers built from Forge's own checks, moved into a shared method, never copied (`engine/patches/README.md`).
- Verify with `src/game/card-use.test.ts`, `decision-model.test.ts`, `decision-panel.test.tsx` (recorded scenes `target`, `target-player`, `target-both`, `payment`, `payment-pool`, `payment-life`, `cast-x`), the engine's `TargetPaymentTest`, the differential game `targets-payment` and the end-to-end test's section 12.

## Attack Rules
Declaring attackers (prompt 18, `src/game/card-use.ts` `declaration`/`attackUse`, `src/game/attack-model.ts`, `AttackDecision` in `src/game/decision-panel.tsx`, `src/game/attack-labels.ts`, `docs/implementation/18-combat-attackers.md`):
- Forge's declaration in progress is `GameState.attack` alone: the defender a creature tapped now attacks, every defender Forge offers, and the player's creatures a tap would not declare with Forge's reason (`AttackRefusal`, from `CombatUtil.attackRefusal` - Forge patch 0008 - asked by the bridge's `RunningInput.attack`). The UI never decides which creature can attack whom, and never derives a reason itself (no "tapped, so it can't attack").
- Marks: a declared attacker of the player is chosen ("greift an"; its tap is Forge's `action` - Forge takes it back from the defender, moves it to the defender from another one, or bands it), the defender is chosen ("wird angegriffen"), another defending card or player is usable ("kann angegriffen werden": card.tap / player.tap make it the defender) - defenders as Forge names them, on either side (a battle the player controls is attacked when an opponent protects it) -, a creature Forge would not declare gets no mark and no tap, its reason in words (`ATTACK_REFUSAL_WORDS`: caption, card name, card view and - before the first attacker - the decision region's "Bleiben zurück"). The region's count of creatures still ready leaves those out: Forge's `playable` also marks creatures that could attack only another defender.
- Summoning sickness is Forge's `VisibleCard.sick` (haste already considered by Forge): an hourglass in the caption and "Einsatzverzögerung" in the card's name and view - on any creature, whenever Forge says so. The card view explains it by the rule (`SICK_NOTE`), never as "this turn": Forge ends it when the creature's player's next turn begins, so an AI creature cast in the AI's turn is still sick in the player's.
- The decision region says whom tapped creatures attack and who attacks so far (`attackText`), lists the defenders as buttons when Forge offers several, and names Forge's buttons by `Button.meaning`: `declare` ("Mit n Kreaturen angreifen" / "Nicht angreifen"), `attackAll` (Forge's words), `callBack` ("Alle zurück" - short enough for one row on a small phone). The arming of sending buttons applies unchanged; nothing is declared or confirmed for the player.
- The hints (how many creatures a tap would declare, how tapping works, who stays back and why) come only before the first attacker, while combat is empty and the region may grow. Once attackers are declared the table shows the combat and the region keeps to a priority's room - the sentence, one note (`declareNote`: a second tap takes a creature back, confirming fixes the attack), the buttons in one row - so the battlefields keep at least a row of cards on a small phone (E2E: 80 px at 360 × 740, also with a commander's seats and fourteen attackers). Never add a note there without checking that.
- New words for the game go into `attack-labels.ts` (never `game-labels.ts`, which the start page loads).
- Verify with `src/game/attack.test.tsx` (recorded scenes `attack`, `attack-declared`, `attack-planeswalker`), `card-use.test.ts`, the engine's `AttackersTest` (incl. asking changes nothing), the differential game `attackers` (coverage `attack-planeswalker`, `attack-defender`, `attack-all`, `attack-call-back`, `attack-unavailable-sick|tapped|restricted`) and the end-to-end test's section 12.

## Block Rules
Declaring blockers (prompt 19, `src/game/block-model.ts`, `block-labels.ts`, `card-use.ts`, `BlockDecision` in `decision-panel.tsx`, `docs/implementation/19-combat-blockers.md`):
- Forge's highlighted attacker is the current block target. `VisibleCard.action` alone permits a tap for that attacker; `playable` means a creature can block some attacker and is never permission for the current one. Without an action, inspect only.
- `GameState.combat` supplies every assignment and its order. Assigned blockers stay chosen even without `playable`; one blocker on several attackers keeps every relationship and counts once. No local legality or damage calculation, no parsing of Forge's words.
- The table marks the block target and assigned blockers, labels available actions, and keeps each attacker separate during declaration. Facts stay accessible in the card's name/view; nothing covers a picture.
- Confirmation uses Forge's buttons and enabled states; label button 1 "Nicht blocken" or "Blocks bestätigen". Re-arm for `ARMING_MS` after assignment changes. Blocking order/distribution questions use the existing generic controls and supersede declaration. Never auto-answer, weaken tap guards, or make inspection send input.
- Verify with `src/game/block.test.tsx`, affected card/decision tests and recorded combat scenes. `npm run test:e2e -- --no-build --combat-only` runs a small sequential combat UI check at three sizes; it does not replace complete app/engine acceptance. Keep recorded and built evidence distinct.

## Preferences Rules
The player's preferences are settings in the local database, read and applied by `src/app/preferences.tsx` (prompt 12, `docs/implementation/12-ai-profiles-settings.md`):
- A preference is chosen once - in Settings; the AI profile also through the play page's dialog - and saved the moment it changes; starting a game never asks for one. A stored value that fails its check is named and its default used, never silently replaced.
- AI profiles are Forge's (`res/ai/*.ai`), described only as verified in `src/game/ai-profile-table.ts` (`docs/research/AI_PROFILES.md`): German names translating Forge's, behaviour from the profile values, no difficulty claims (none was measured). The build stops when the engine's profile files differ from the verified ones (`vite/engine-assets.ts`); re-run `engine/scripts/ai-profile-study.sh`, re-verify, then update the table. "Zufällig" is drawn by the app for every game; the engine refuses a profile it did not load (`engine.error invalid-request`).
- The card language (`src/cards/card-language.ts`) decides how cards are shown - `cardDisplay(card, { language })` and the views built on it, from `usePreferences().cardLanguage` - and the cards in Forge's texts (`--card-language`, `EngineSession.setBootOptions`: a warm engine no game uses is replaced; Forge's own words stay German).
- Less motion: every animation and transition in `src/components/ui` carries `motion-reduce:animate-none!`/`motion-reduce:transition-none!` (checked by `src/app/motion.test.ts`); the variant means the device's `prefers-reduced-motion` or the player's setting. Motion made in code asks `src/app/motion.ts`.

## ORYX Cloud Rules
The optional sync of the player's collection through their ORYX account (project owner, 2026-09-25, outside the queue; `src/cloud/`, `src/storage/collection.ts`, `docs/implementation/oryx-cloud-sync.md`):
- `src/cloud/oryx-sdk.js` / `.d.ts` are unchanged copies of `oryx-games/shared` (checksums in `src/cloud/oryx-sdk.test.ts`): never edit them; to update, copy the new master and change the checksums. Only `src/cloud` talks to the cloud, and only through the SDK; the storage layer stays network-free.
- No SDK dialog (`ui: false`): the collection is merged (`mergeCollections`: per deck the newer `updatedAt`, deletion marks, `display.*` never), never chosen; any UI is shadcn in `src/cloud/oryx-cloud-card.tsx`.
- Synced: decks, deletion marks, settings except `display.*`. A new device-specific setting belongs under `display.*`; caches, matches and `meta` are never synced. The slot's version is `SCHEMA_VERSION`: a schema bump also changes the synced collection (older ones are upgraded with the migrations, like backups) and needs the card catalog rebuilt (`npm run cards:build -- --offline`).
- Applying the cloud's collection must never mark a change (no round between devices); only this tab's own writes upload (`subscribeChanges` origin `this-tab`).

## Queue and Execution
The legacy local prompt workflow was removed upstream on 2026-09-28. Executable tasks and their lifecycle now live in `dev0gig/dropzone/workflow/tasks/`; implementation evidence remains in `docs/implementation/` and Git history.

- Numbered prompts run strictly sequentially; resume `IN_PROGRESS` work and never skip a `BLOCKED` predecessor. Mark a task complete only after its requirements and verification pass.
- Reconcile the central status with code and `STATUS.md` before selecting work. Prompts 00–32 are complete; OpenMana is public since Prompt 31 (2026-10-08) and audited as functionally ready for the UI fine-polish in Prompt 32 (`docs/READINESS.md`). The on-device game/navigation inside ORYX was waived by the project owner on 2026-10-08 and is not tested: never call OpenMana Android-ready without it.
- Run only the task assigned by the user; a single Dropmaster assignment ends after that task.
- Update the central task and `STATUS.md` with verified evidence; do not recreate the removed local queue.

## Model gate for numbered prompts (project owner, 2026-10-07; Prompt 32 changed 2026-10-08)

Before starting/resuming a numbered task, check the actual session model and reasoning effort. The project owner requires:

- **26 — Isolated Forge update pipeline** (done): GPT-6 Astra with `max` reasoning.
- **30 — Anvil parity audit and remediation** (done): GPT-6 Astra with `max` reasoning.
- **32 — Final OpenMana readiness audit** (done): **Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code with effort `max`** (project owner, 2026-10-08, replacing Astra: no Codex quota).

If the session uses another model or effort, or these cannot be reliably established, stop before implementation and before moving the task to active. Tell the project owner the prompt number, required model/effort and why; do not silently continue or switch models. Resume only after the correct model/effort is confirmed, or the project owner explicitly overrides this gate for that task. Read-only task selection and the model check are permitted. The same gate applies to multi-master workers; a Sol worker may not execute these tasks.

For the remaining prompts, Sol with `high` reasoning is the normal recommendation. Prompts 22 (recording/replay) and 25 (PWA updates/cache) merit particular care but do not require Astra Max by default. Model choice does not replace test evidence.

## Verification
Use the exact verification required by the current prompt and affected subsystem. Never weaken/remove tests to obtain a green result and never present fake/mock results as real evidence.

For relevant work this may include Forge/JVM/WASM differential tests, browser/Worker tests, TypeScript/build checks, protocol/integration tests and later UI/E2E checks.

Complete games through the real table (Prompt 32, `docs/READINESS.md`): `node scripts/readiness/matches.ts --serve <built dist> --out <new dir>` plays several games with the readiness player (`scripts/readiness/player.ts`) - Arena import, IndexedDB, reopened browser, recording, replay, portable JSON. Run it after changes to the table, decisions, card interaction or the engine; a player action Forge refuses or that leaves the table unchanged fails. The post-deployment live check (`scripts/deploy/live-check.ts`) uses the same player and must cast a spell.

## Definition of Done
Before declaring a task complete:
1. Satisfy every prompt requirement.
2. Inspect the complete diff and preserve unrelated work.
3. Run all prompt-required and relevant regression tests.
4. Update required research/implementation/product documentation.
5. Update `STATUS.md` if the broad project implementation state changed.
6. Update the assigned central Dropzone task with evidence, findings and commit.
7. Leave no known critical regression introduced by the task.
8. Commit the work, but never push (see Publishing and Android).

## Documentation Responsibilities
- `docs/BIBLE.md`: canonical product/architecture.
- `docs/research/`: technical research/evidence.
- `docs/implementation/`: implemented milestone records.
- `README.md`: concise current public/developer overview.
- `STATUS.md`: compact implementation map.
- `dev0gig/dropzone/workflow/tasks/`: central task specifications and execution ledger.

Do not duplicate detailed per-prompt history into root `STATUS.md`.

## Publishing and Android (project owner, 2026-09-25; published 2026-10-08)
- **Public since Prompt 31 (2026-10-08):** https://openmana.oryx.quest/ (fallback https://openmana.vercel.app/), public repository. Decision and the openly disclosed GraalVM/GFTC question: `docs/PUBLICATION.md`; deployment, releases and rollback: `docs/DEPLOYMENT.md`. Never write the project owner's civil name or private e-mail into files or commits (the history was rewritten for that).
- **Commit, never push without an explicit instruction.** Every push to `main` triggers a Vercel production deployment and uses up the project owner's Vercel deployment quota. Commit finished work right away; push only when the project owner explicitly asks for it for the current task.
- **Engine releases:** a new engine/catalog reaches production only as a new GitHub release named in `deploy/artifacts.json` (after `engine/UPDATING.md`); create the release before pushing `main`, never replace or delete release assets.
- **Physical ORYX/Android acceptance:** trust, isolation and the engine starting inside ORYX are proven on the project owner's Fold7 (Prompt 31); the on-device game, rotation, background and navigation were waived on 2026-10-08 and are **not tested** (Prompt 32, `docs/READINESS.md`; checklist in `docs/implementation/28-oryx-web-android.md`).
- **No APKs.** On Android, OpenMana runs only inside the global ORYX app (Trusted Web Activity `net.tsnet.oryx`, which trusts `openmana.oryx.quest` and `openmana.vercel.app`). Do not build an own TWA, APK or Warehouse package.
