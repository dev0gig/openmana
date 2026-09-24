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

## Currently In Progress
Nothing. Prompts 00–07 are `COMPLETE`. The next prompt is **08 — Scryfall card data** (`PENDING`, not started: each run of `prompts/naechster-schritt.md` executes exactly one prompt).

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
- no deck library/import UI yet (the local database and backups exist; decks only arrive through a backup),
- no Scryfall application layer yet,
- no game session and no playable OpenMana battlefield UI yet,
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

Therefore the repository is intentionally **not being migrated while the numbered program is running** (at this review point: 07 complete, 08 next, nothing in progress).

Dropzone Master/Standalone must respect:
- `prompts/STATUS.md` statuses,
- strict numerical order,
- one-prompt-at-a-time behavior where specified,
- existing commit/push completion rules,
- current `IN_PROGRESS` work.

A later explicit migration can simplify the queue after the current program is safely paused or completed.

## Maintenance
Update this file only when the broad implementation state changes. Keep detailed prompt evidence, commit hashes, measurements and blockers in `prompts/STATUS.md` and implementation/research docs.
