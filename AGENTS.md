# OpenMana Agent Instructions

## Current Work Safety
OpenMana may be under active implementation by another agent. Before any change, read `prompts/STATUS.md` and inspect the actual Git/repository state. **Never reset, move, rename, rewrite or reclassify an `IN_PROGRESS` prompt or its work unless explicitly assigned to that task.** Preserve concurrent/later work.

## Agent Startup Contract
Before implementation:
1. Read this file.
2. Read `STATUS.md` for the compact project map.
3. Read `prompts/STATUS.md` for the authoritative queue execution state.
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
- Do not create a second Android UI; later Android packaging wraps the same web application.

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

## Game Table Rules
A running game is the game table (`src/game/game-table.tsx`; prompt 13, `docs/implementation/13-battlefield-foundation.md`):
- The table is a view of one full state (`GameState`, the open questions, Forge's prompt line) and never acts; the page adds the menu (the way around the app, Forge's notices, conceding - confirmed) and the warnings. Later prompts (the replay of 22) can show recorded states with it.
- `src/game/table-model.ts` arranges the state from Forge's structured values only: seats from `me`, the row of a card from whether Forge sends power/toughness, piles of cards whose every value Forge sends is equal - never cards Forge names elsewhere (open questions, stack sources and targets, combat, attachments) -, attachments with their host (`attachedTo`), the stack in Forge's order (first = top). No legality, no computed values (no "remaining toughness"), no card- or name-specific branches.
- Hidden stays hidden: a `HiddenCard` is a back and a count, never told apart or identified; what Forge reveals is shown; `game.started.cardNames` is never shown as anyone's cards.
- Card pictures through `useTableCards` (`src/game/table-cards.ts`): Forge's key resolved once per key against the installed catalog, shown in the player's card language; a key the catalog cannot decide (tokens of one name that fit alike, Forge-only cards, Forge's effect cards) gets Forge's own words, never a guessed picture. Only catalog answers are remembered, never cards of the game.
- Nothing is drawn over a card picture: a card's facts go into `GameCardCaption` below it; tapped is a quarter turn (`GameCard`).
- `GameBoard` keeps eight regions on the screen (portrait: stacked; landscape: side column) and the page never scrolls; card rows scroll sideways, texts inside their region. The table takes the whole screen while the game runs (`useImmersive`, `src/app/immersive.tsx`).
- Forge's own texts (prompt line, questions, stack descriptions, button labels) are shown as Forge sends them; a notice appears as a toast at the top and stays in the menu (`noticeCount`).
- Verify table changes with the unit tests on real recorded scenes (`src/test/table-scenes.ts`, re-recorded with `scripts/record-table-scenes.ts` after `engine/scripts/test-engine.sh`) and the end-to-end test's section 12 (those scenes in the real table at six sizes).

## Preferences Rules
The player's preferences are settings in the local database, read and applied by `src/app/preferences.tsx` (prompt 12, `docs/implementation/12-ai-profiles-settings.md`):
- A preference is chosen once - in Settings; the AI profile also through the play page's dialog - and saved the moment it changes; starting a game never asks for one. A stored value that fails its check is named and its default used, never silently replaced.
- AI profiles are Forge's (`res/ai/*.ai`), described only as verified in `src/game/ai-profile-table.ts` (`docs/research/AI_PROFILES.md`): German names translating Forge's, behaviour from the profile values, no difficulty claims (none was measured). The build stops when the engine's profile files differ from the verified ones (`vite/engine-assets.ts`); re-run `engine/scripts/ai-profile-study.sh`, re-verify, then update the table. "Zufällig" is drawn by the app for every game; the engine refuses a profile it did not load (`engine.error invalid-request`).
- The card language (`src/cards/card-language.ts`) decides how cards are shown - `cardDisplay(card, { language })` and the views built on it, from `usePreferences().cardLanguage` - and the cards in Forge's texts (`--card-language`, `EngineSession.setBootOptions`: a warm engine no game uses is replaced; Forge's own words stay German).
- Less motion: every animation and transition in `src/components/ui` carries `motion-reduce:animate-none!`/`motion-reduce:transition-none!` (checked by `src/app/motion.test.ts`); the variant means the device's `prefers-reduced-motion` or the player's setting. Motion made in code asks `src/app/motion.ts`.

## ORYX Cloud Rules
The optional sync of the player's collection through their ORYX account (dev0gig, 2026-09-25, outside the queue; `src/cloud/`, `src/storage/collection.ts`, `docs/implementation/oryx-cloud-sync.md`):
- `src/cloud/oryx-sdk.js` / `.d.ts` are unchanged copies of `oryx-games/shared` (checksums in `src/cloud/oryx-sdk.test.ts`): never edit them; to update, copy the new master and change the checksums. Only `src/cloud` talks to the cloud, and only through the SDK; the storage layer stays network-free.
- No SDK dialog (`ui: false`): the collection is merged (`mergeCollections`: per deck the newer `updatedAt`, deletion marks, `display.*` never), never chosen; any UI is shadcn in `src/cloud/oryx-cloud-card.tsx`.
- Synced: decks, deletion marks, settings except `display.*`. A new device-specific setting belongs under `display.*`; caches, matches and `meta` are never synced. The slot's version is `SCHEMA_VERSION`: a schema bump also changes the synced collection (older ones are upgraded with the migrations, like backups) and needs the card catalog rebuilt (`npm run cards:build -- --offline`).
- Applying the cloud's collection must never mark a change (no round between devices); only this tab's own writes upload (`subscribeChanges` origin `this-tab`).

## Queue and Execution
OpenMana currently has its own detailed queue ledger at `prompts/STATUS.md`. It remains authoritative while the numbered 00–32 implementation program is running.

- Prompts run strictly sequentially.
- `IN_PROGRESS` must be resumed/finished, never skipped.
- `BLOCKED` stops later work.
- A prompt becomes `COMPLETE` only under the completion rules in `prompts/STATUS.md`.
- Do not migrate the active queue to another lifecycle while an agent is working through it.
- `prompts/naechster-schritt.md` remains the one-prompt-at-a-time direct-run helper.

The generic Dropzone `queue/active/completed` lifecycle may be adopted later, after the current program is safely paused/completed and explicitly migrated. Until then, compatibility means respecting this repository's existing queue model.

## Verification
Use the exact verification required by the current prompt and affected subsystem. Never weaken/remove tests to obtain a green result and never present fake/mock results as real evidence.

For relevant work this may include Forge/JVM/WASM differential tests, browser/Worker tests, TypeScript/build checks, protocol/integration tests and later UI/E2E checks.

## Definition of Done
Before declaring a task complete:
1. Satisfy every prompt requirement.
2. Inspect the complete diff and preserve unrelated work.
3. Run all prompt-required and relevant regression tests.
4. Update required research/implementation/product documentation.
5. Update `STATUS.md` if the broad project implementation state changed.
6. Update `prompts/STATUS.md` with evidence, findings, agent and commit according to its rules.
7. Leave no known critical regression introduced by the task.
8. Commit the work, but never push (see Publishing and Android).

## Documentation Responsibilities
- `docs/BIBLE.md`: canonical product/architecture.
- `docs/research/`: technical research/evidence.
- `docs/implementation/`: implemented milestone records.
- `README.md`: concise current public/developer overview.
- `STATUS.md`: compact implementation map.
- `prompts/STATUS.md`: detailed numbered-program execution ledger.
- `prompts/queue/`: task specifications.

Do not duplicate detailed per-prompt history into root `STATUS.md`.

## Publishing and Android (dev0gig, 2026-09-25)
- **Commit, never push.** Every push to `main` triggers a Vercel deployment and uses up dev0gig's Vercel deployment quota. Commit finished work right away; push only when dev0gig explicitly asks for it. This replaces the former "committed and pushed" completion rule of the numbered program.
- **No APKs.** On Android, OpenMana runs only inside the global ORYX app (Trusted Web Activity `net.tsnet.oryx`, which already lists `openmana.vercel.app` as trusted). Do not build an own TWA, APK or Warehouse package. Prompt 28 must be re-scoped with dev0gig before it starts; what likely remains is `/.well-known/assetlinks.json` for ORYX and proof that the Forge WASM engine runs inside ORYX (`crossOriginIsolated`).
