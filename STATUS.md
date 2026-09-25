# OpenMana — Current Status

Last repository review: 2026-09-25

Compact implementation map. This file deliberately does **not** replace the active queue ledger in `prompts/STATUS.md`.

- Product/architecture canon: `docs/BIBLE.md`
- Agent rules: `AGENTS.md`
- Detailed active program state: `prompts/STATUS.md`
- Numbered tasks: `prompts/queue/`
- Technical research: `docs/research/`
- Milestone implementation records: `docs/implementation/`

Source/tests determine implementation reality.

## Product
OpenMana is a modern browser-first Magic: The Gathering client using Forge as the authoritative rules/card/AI engine. It succeeds Anvil but is a clean web-first implementation rather than a Kotlin/Compose port.

## Implemented / Proven
### Research (Prompt 00)
- ManaBrew/Forge browser-WASM approach researched.
- Current direction: Oracle GraalVM Web Image, pinned Forge upstream plus a small GPL patch queue.
- Toolchain/build/license/feasibility findings documented under `docs/research/`.

### Forge WASM Engine Spike (Prompt 01)
- Pinned Forge engine runs as WebAssembly in a Dedicated Worker.
- Complete Forge-AI vs Forge-AI games run in Chrome.
- JVM, Node and Chrome produced matching deterministic Forge game logs for tested scenarios.
- Reproducible/pinned toolchain, Forge submodule, patch queue, resource packaging and WASM/JVM smoke infrastructure exist.
- Browser feature/failure handling for required isolation exists.
- Detailed measurements/evidence are recorded in `docs/implementation/01-engine-spike.md` and `engine/README.md`.

### Anvil Bridge Single-Thread Spike (Prompt 02)
- Forge's own human path (`PlayerControllerHuman` and its inputs) runs on a single thread through an Anvil-style bridge (`engine/bridge/.../bridge/`), on the JVM and as WebAssembly in Node and Chrome.
- In the browser the worker blocks with `Atomics.wait` inside Forge's stack until the page writes the next input into a SharedArrayBuffer; engine → UI uses `postMessage`.
- Proven paths: mulligan, card taps outside questions (priority), cost payment (auto and by tapping sources), targets on cards and players, attacking, blocking, blocking questions, question IDs and withdrawal, loud rejection of stale/invalid input, state requests, conceding.
- Recorded human-vs-AI games replay identically on JVM, Node and Chrome (Forge game log, decision messages, Forge GUI calls).
- Spike protocol (`0.2-spike`), Anvil name mapping, deviations and known gaps: `docs/implementation/02-anvil-bridge.md`.

### Worker Transport and Protocol (Prompt 03)
- `engine/protocol` is the single UI ↔ engine contract: JSON Schema (protocol version 1) → generated TypeScript types, constants and precompiled validators (Ajv standalone); a check fails the build if they are stale; `ProtocolContractTest` keeps the Java bridge in line with the schema.
- Transport: engine → UI `postMessage`; UI → engine a SharedArrayBuffer ring buffer (length-prefixed UTF-8 JSON, wrap-around, loud `queue-full`, layout/magic check); the worker blocks in `Atomics.wait` only when the queue is empty and says so (`engine.waiting`).
- `engine/client`: `EngineClient` for the main thread — feature detection before any download, protocol version checks, schema + sequencing validation of every engine message (violation = technical abort), question bookkeeping (`question.answered`/`question.withdrawn`, blocking questions, stale/unknown answers refused locally), `seq`-numbered inputs, ready timeout and stall watchdog, `engine.ready` / `engine.error` / `engine.abort`.
- Worker host in TypeScript (browser Dedicated Worker bundle `engine-worker.js`; the same source runs in Node tests).
- Evidence: the recorded human-vs-AI games replay through the client identically on JVM, Node and Chrome (lazy and with a 256-byte queue); client and engine judge every input alike; failure paths tested against the real engine. Details: `docs/implementation/03-worker-transport-protocol.md`.

### Forge Resources and Card Scripts (Prompt 04)
- `engine/resources.json` decides every entry of Forge's `res/`: embedded are the card and token scripts, editions, formats, lists, block data, AI profiles and the English and German language files; Forge's UI assets (`effects/`, `defaults/` …) and other game modes are left out with a reason. A Forge update with a new entry stops the build until someone decides.
- Engine manifest (`engine-manifest.json`, format 2) with Forge SHA, patch hash, toolchain (with checksums), resource inventory (every file with size and SHA-256 in `forge-res.inventory.json`), what is in the module, sizes and SHA-256 of all artefacts.
- Card probe (`CardProbe`, `diagnostics.card-probe`): effects that create cards by name, every card layout, every token script, the three newest sets and every card of the database as game cards; equal fingerprints on JVM, Node and Chrome, lazy and eager, English and German.
- Network play excluded: Netty's own native-image configuration is excluded, and the Wasm build aborts if a Netty/jupnp/Jetty/servlet type becomes reachable or a class of them is in the module.
- Forge's texts in German (`--language=de-DE`), protocol version 2; eager card loading is the default (lazy loading stalls a game for 17–42 s in the Wasm engine when an effect or decision needs all cards).

### JVM/WASM Differential Tests (Prompt 05)
- Engine trace (`diagnostics.trace`, protocol version 3, engine tests only): at every point Forge waits for input, at every step and at the end of the game a complete snapshot from Forge's model (every zone incl. library order and hidden hands, stack with targets, combat, the human seat's markers and open questions), plus every Forge game event and every bridge decision — ids, English card keys, enum names and numbers only, no clock-dependent checkpoints, no prose. The client accepts it only when requested.
- Test fixtures as data (`engine/fixtures`): ten scripted games with fixed seeds (incl. blocker assignment, a double block, a stack response, a legal 100-card Commander game); each names what it must cover, together they cover mulligan, land/spell play, priority, cost payment, targeting, stack, combat, block assignment, zone movement, game end and Commander.
- `engine/scripts/test-engine.sh` plays every fixture on the JVM and replays it in Node and Chrome; the traces must be equal entry by entry (AI games too); any divergence fails with its place in the game. A negative test proves that tampered traces fail at the tampered place. German and lazy-loading variants give the very same trace.
- Found and fixed: Commander games could not end (Forge's achievement dialog threw in the headless GUI). Documented: Forge's `getActivateDescription` sets a missing activating player (side effect; follow-up in prompts 14/16) and Forge's time-budgeted "has the player anything to do" check (the tests fail if it runs out). Details: `docs/implementation/05-engine-differential-tests.md`.

### Web/PWA Skeleton (Prompt 06)
- Production web application at the repository root: React 19, Vite 8, TypeScript 7 strict, Tailwind 4 + shadcn/ui (style `radix-maia`), React Router; npm package `@openmana/app`, independent of `engine/package.json`.
- Surfaces Start, Decks, Play, Matches, Settings, Credits (German UI, English routes); sidebar from 768 px, bottom tab bar on phones; no invented data (empty states, disabled actions with reasons).
- OpenMana design system (`docs/DESIGN_SYSTEM.md`): dark-only night blue/gold tokens, Cinzel headings, Inter text, touch targets ≥ 44 px on coarse pointers, WCAG AA contrast checked from the tokens, shadcn-only UI rule.
- Engine integration: `EngineSession` wraps the `EngineClient` (loaded on demand); "Play" boots the real engine on request and shows its boot phases, `engine.ready` facts or the abort reason. `vite/engine-assets.ts` takes `engine/build/dist` only after checking size and SHA-256 of every runtime file and the protocol version, and serves it content-addressed under `/engine/<id>/`; a build without a checked engine fails (`OPENMANA_ENGINE=omit` builds UI-only on purpose).
- COOP/COEP/CORP on every response of dev server, preview and `vercel.json` (one source); SPA fallback that never swallows engine or asset files; immutable caching only for hashed/content-addressed paths. Nothing deployed.
- PWA basics: web app manifest (installable in Chrome, no installability errors), icons from Anvil's unchanged icon with provenance (`assets/app-icon/`). No service worker yet (prompt 25).
- Evidence: `npm run check` — typecheck, oxlint, 82 Vitest tests (session, surfaces, tokens, PWA, import boundary, engine assets, deployment config), end-to-end test in Chrome 153 with the real engine (every surface at three sizes with axe-core, engine boot via preview and dev server, installability, negative test without isolation); engine unit tests unchanged green. Details: `docs/implementation/06-web-pwa-skeleton.md`.

### Local Data Layer (Prompt 07)
- IndexedDB database `openmana` (schema version 1) through `src/storage`: stores `decks`, `settings`, `matches` + `matchLog` (user data, backed up), `scryfallCards` + `cacheIndex` (caches, never backed up), `meta` (the database's own history). Never `localStorage`/`sessionStorage` (test-enforced); the storage layer sends nothing.
- One JSON Schema (`src/storage/schema/local-data.schema.json`) → generated types and Ajv standalone validators (freshness checked by `npm run check`/`build`); every record is checked before it is written, damaged stored records are shown as damaged.
- Migrations (`src/storage/migrations.ts`): ordered, one version-change transaction (a failure leaves the database unchanged), pure record upgrades shared with older backups; tested with made-up versions 1 → 2 → 3.
- `LocalDatabase.write`: all or nothing, durability strict, changes announced after commit (also to other tabs via BroadcastChannel); typed `StorageError`s for unsupported/newer version/damaged structure/failed upgrade/closed connection/quota/invalid records/backups.
- Backups: gzip JSON Lines (`openmana-backup` format 1: header, records, end line with counts); reading checks everything first; import merge (newer copy wins, recorded matches never overwritten) or replace, in one transaction; space pre-check.
- UI: Settings card "Daten auf diesem Gerät" (counts, storage estimate, persistence, last backup, backup out/in, integrity check and removal, recovery actions); Decks/Matches/Play show what is really stored.
- Evidence: 179 Vitest tests (97 new, fake-indexeddb), end-to-end in Chrome with real IndexedDB (import, reload, real download, round trip into a second profile, refused files, damaged record, another tab upgrading, site data cleared, quota warning/pre-check via DevTools override). Finding: Chrome reports a static quota, and IndexedDB ignores DevTools' quota override. Details: `docs/implementation/07-indexeddb-storage.md`.

### Scryfall Card Data (Prompt 08)
- Card catalog built at build time (`npm run cards:build`, `cards/`) from Scryfall's `all_cards` bulk data and the pinned Forge card database: one record per Oracle identity (English faces, printed German text, default printings - German picture where Scryfall has a real one, else English - aliases, name keys, the Forge names), sets with Arena and Forge codes, Forge cards without Scryfall data with their reason. Every Scryfall object is checked against `src/cards/scryfall/scryfall.schema.json`, every picture URL against the rule the app builds them by, every output line against the local data schema; deterministic output; a new unexplained Forge card or a stale exception stops the build.
- Result (Scryfall 2026-09-24, Forge `ed0333fecb`): 36 156 cards, 30 849 with German text, 24 929 with a German picture; 33 740 of 33 978 Forge scripts matched (name, face, alias, Forge edition entries), 238 Forge-only (230 rebalanced Arena `A-` cards, 8 listed in `cards/forge-unmatched.json`); 10.4 MiB gzip.
- `vite/card-assets.ts` takes the catalog only after checking size, SHA-256, schema version and the engine's Forge commit, and serves it under `/cards/<id>/` (immutable on Vercel); `OPENMANA_CARDS=omit` builds without on purpose.
- Local database schema version 2 (migration 2: `scryfallCards` keyed by Oracle id, new `scryfallPrints`, `scryfallSets`, `forgeOnlyCards`; user data untouched). The catalog is installed from Settings once per version (space check, SHA-256 of what arrives - gzip or already unpacked by the host -, every line checked, batches, stoppable, Web Locks between tabs); an older version stays usable until updated.
- `src/cards/`: name keys, lookups (German/English names, faces, aliases, Forge names, engine keys incl. tokens, sets by Scryfall/Arena/Forge code), display rules (German per field with English marked, picture per side, requested printing, alias printing), Scryfall API client for particular printings (Accept header, 2/s and 10/s lanes, 30 s pause after 429) with a 30-day cache incl. negative answers.
- UI: Settings card "Kartendaten" (Scryfall date, counts, device state, install/update with progress, errors), "Karte nachschlagen" (search, details, turning double-faced cards, clear missing-data notes), `CardPicture` (CORS mode under COEP, no referrer, never cropped, text in place of a missing/failed picture), Credits for Scryfall and Wizards of the Coast.
- Evidence: unit/component tests on a small real catalog (46 Scryfall objects, real Forge scripts), the real catalog build, and end to end in Chrome: install into real IndexedDB in ~4-5 s (66 MB), real Scryfall pictures under COEP (and proof that a picture without CORS mode is blocked), German, double-faced, English-only, Forge-only, offline pictures, phone layout, axe-core, stop/resume, damaged download refused. Details: `docs/implementation/08-scryfall-data.md`.

### Arena Deck Import (Prompt 09)
- Route `/decks/import` (loaded on demand) from the decks page: paste an MTG Arena deck list or open a text file (UTF-8, UTF-16 with BOM).
- `src/decks/arena-list.ts` reads Arena's format purely: sections Deck, Sideboard, Commander, Companion, About/Name; counts; set and collector numbers; blocks without a header by Arena's rule (after the first blank line: sideboard); tolerated `4x`, `Sideboard:`, tabs, CRLF, BOM. Every other line is a problem with its line number, never skipped.
- `src/decks/deck-resolve.ts`: every line through the card catalog on the device (one read transaction) - ranked own/Forge name, front face, later face, alias, printed German name; Forge-only cards (Arena's rebalanced `A-` cards) by their Forge name; Arena's set codes mapped to Scryfall's (`DAR` → `dom`). Scryfall's API (one shared client, `src/cards/scryfall-access.ts`, through `ensurePrints`) only for lines the catalog cannot decide that name a printing: names in other languages, the 32 names several playable cards share (24 old German translations such as "Zwang" = Duress/Coercion). Never a guess: otherwise the player chooses.
- `src/decks/deck-plan.ts`: what is saved - entries of one card and printing added up, the companion in the sideboard (Forge looks there), `commander` when the list names a commander, else `constructed`; blocks saving while any line is open (unreadable, not found, ambiguous, not in Forge) unless corrected, chosen or explicitly left out; `DeckRecord` with Forge's name, Oracle id, Scryfall's set code and collector number, the list unchanged. No legality checks (Forge decides).
- UI: report (state, counts, notes), "Zu klären" (line number, text, reason, choose / leave out / take back), save with a name (prefilled from About/Name), the deck per section with German names and Forge names; the card data can be set up right on the import page.
- Evidence: 352 Vitest tests (54 new: parser, resolution, plan, page), end to end in Chrome with the real catalog and Scryfall's real API (English, German with a choice, a printing deciding and a French name identified through Scryfall, a card Forge lacks left out, a Commander list from a file, reload, IndexedDB records, phone, axe-core) - and every imported deck handed to the real Forge engine starts a game with exactly its cards. Details: `docs/implementation/09-arena-deck-import.md`.

### Deck Library (Prompt 10)
- `/decks`: every deck with cover card (commander, else the main-deck card of the highest mana value), format, counts, commander, companion, how many cards are not entirely German, date; search by deck name or any card name (English, German, faces, Forge's name, through the catalog's name keys), format filter, sort by name/last changed/last created - kept in the address (`?q=…&format=…&sort=…`).
- `/decks/:id` (loaded on demand): parts card by card (commander, companion, main, sideboard) with German name, Forge's name, the named printing and a language badge; overview; language status (distinct cards: German, partly English, English, Forge only, no card data); every card opens its full view. Printings the list named that the catalog lacks are asked of Scryfall once through the shared client (`named-prints.ts`, 30 days kept); picture rule: the named printing in German, else the card's German picture, else the named printing, else the usual one (`deck-view.ts pictureOf`).
- Actions (`deck-actions.tsx`, phones: `ActionBar` above the tab bar): play with this deck, rename, duplicate (same cards and imported list, new id), export (Arena list with Forge's names and Arena's set codes - imports again without an open line or a Scryfall request - or the imported list unchanged; clipboard or text file), import again (`/decks/:id/import`: the saved list and name, earlier choices of ambiguous names kept via the resolver's `previous`, replacing confirmed, id and creation kept), give it to the AI, delete (confirmed).
- Storage: `getDeck`, `renameDeck`, `duplicateDeck`, `replaceDeck`, `deleteDeck` read and write in one transaction (a deck deleted meanwhile is never brought back: new error `not-found`). Schema version 3: `DeckRecord.companion` (optional; migration 3 changes no stored record); the card catalog was rebuilt for it (its header carries the schema version).
- Deck choice for a game (`deck-selection.ts`, `/play`): settings `play.humanDeck` and `play.aiDeck` (`random` by default or one deck); the AI's deck must share the player's format (one `MatchRequest.format`); random = drawn when a game starts from the valid decks of that format other than the player's own (`drawAiDeck`, used from prompt 11); a mirror match only on purpose; deleted/damaged/other-format choices are named, never replaced. Starting the game is prompt 11.
- UI: shadcn `DropdownMenu`, `Select`, `ToggleGroup` (registry, touch sizes), `ActionBar` (built the shadcn way); `--destructive` raised to L 0.74 so the destructive confirm buttons reach 4.5:1 (the end-to-end test found 4.43:1).
- Evidence: 418 Vitest tests (66 new), end to end in Chrome with the real catalog, Scryfall's real API and the real engine (new section 9: list, details, pictures of named printings, rename, export with real downloads and the round trip, duplicate, import again without a Scryfall request, delete, deck choice, phone with touch). Details: `docs/implementation/10-deck-library.md`.

## Currently In Progress
Nothing. Prompts 00–10 are `COMPLETE`. The next prompt is **11 — Game session foundation** (`PENDING`, not started: each run of `prompts/naechster-schritt.md` executes exactly one prompt).

Any agent entering the repository must first reconcile this statement with the latest `prompts/STATUS.md` and Git state.

## Planned Numbered Program
The existing queue covers the path from bridge/Worker/resource/differential engine work through:
- web/PWA skeleton,
- IndexedDB,
- Scryfall data,
- Arena deck import/library,
- game session and Forge AI profiles,
- battlefield/cards/decisions/priority/targeting/combat/zones/history,
- match recording/replay and beginner QoL,
- responsive polish/PWA lifecycle,
- Forge update pipeline,
- credits/licenses,
- Android/Warehouse,
- regression/parity/production/readiness audits.

Exact order/status is authoritative only in `prompts/STATUS.md`.

## Not Yet Implemented
At this review point:
- no game session and no playable OpenMana battlefield UI yet (the decks for a game can be chosen; starting it is prompt 11),
- no service worker/offline mode, no deployment, no Android artifact yet.

Anvil remains the working reference implementation until OpenMana reaches the intended parity.

## Architectural Guardrails
- Forge alone decides Magic rules/legal actions/card behaviour/AI.
- UI communicates Forge state; it does not recreate rules.
- UI ↔ protocol ↔ bridge ↔ Forge WASM remains a hard boundary.
- Browser-local operation must not require Odin/Tailscale.
- Scryfall supplies metadata/images, not legality/rules.
- Local-first deck/user data remains a core product requirement.
- Web/touch/desktop share one application; later Android is a wrapper, not a second UI.

## Workflow Compatibility
OpenMana predates the generic Dropzone `queue → active → completed` lifecycle and is worked through **its own numbered ledger**, one prompt at a time.

Therefore the repository is intentionally **not being migrated while the numbered program is running** (at this review point: 10 complete, 11 next, nothing in progress).

Dropzone Master/Standalone must respect:
- `prompts/STATUS.md` statuses,
- strict numerical order,
- one-prompt-at-a-time behavior where specified,
- existing commit/push completion rules,
- current `IN_PROGRESS` work.

A later explicit migration can simplify the queue after the current program is safely paused or completed.

## Maintenance
Update this file only when the broad implementation state changes. Keep detailed prompt evidence, commit hashes, measurements and blockers in `prompts/STATUS.md` and implementation/research docs.
