# OpenMana

Modern, browser-first Magic: The Gathering client using Forge as the rules engine.

OpenMana succeeds Anvil, but is a clean web-first implementation rather than a Kotlin/Compose port.

## Goals

- Modern, beginner-friendly battlefield UX with an original OpenMana identity.
- Forge remains the single authority for Magic rules, card behaviour and AI.
- Target: Forge runs locally in the browser through WebAssembly; no Odin or Tailscale runtime dependency.
- Scryfall supplies card metadata and imagery, preferring German with English fallback.
- Arena-format decklists are imported and stored locally in IndexedDB.
- One web codebase for browser/PWA and later an Android wrapper.
- Forge updates are isolated from the UI.

Start with [docs/BIBLE.md](docs/BIBLE.md).

## Status

Implementation has started; progress per queue prompt is tracked in [prompts/STATUS.md](prompts/STATUS.md).

- **Engine spike done (prompt 01):** pinned upstream Forge plus a small GPL patch queue runs as WebAssembly (GraalVM Web Image) in a Dedicated Worker and plays a complete Forge-AI game in Chrome; JVM, Node and Chrome produce the identical Forge game log. See [engine/README.md](engine/README.md) and [docs/implementation/01-engine-spike.md](docs/implementation/01-engine-spike.md).
- **Bridge spike done (prompt 02):** Forge's own human path (`PlayerControllerHuman` and its inputs) runs on a single thread through an Anvil-style bridge: numbered questions with withdrawal, card taps outside questions, mulligan, cost payment, targets, attacking, blocking, conceding. In the browser the worker waits for the player's input with `Atomics.wait` on a SharedArrayBuffer. Recorded human-vs-AI games replay identically on the JVM, in Node and in Chrome. See [docs/implementation/02-anvil-bridge.md](docs/implementation/02-anvil-bridge.md).
- **Protocol and transport done (prompt 03):** `engine/protocol` is the only UI↔engine contract: a versioned JSON Schema, TypeScript types and precompiled validators generated from it, and the SharedArrayBuffer input queue (bounded ring buffer, loud on overflow). The `EngineClient` (main thread) starts the Dedicated Worker, checks every engine message against the schema, tracks questions (stale and withdrawn answers are refused before they are sent), and reports ready/error/technical abort; the worker host checks protocol version and browser features before the engine is even downloaded. See [engine/protocol/README.md](engine/protocol/README.md) and [docs/implementation/03-worker-transport-protocol.md](docs/implementation/03-worker-transport-protocol.md).
- **Forge resources and card scripts done (prompt 04):** the engine embeds a deliberately chosen, inventoried set of Forge data from the pinned commit (every card and token script, editions, formats, lists, AI profiles, English and German messages; every other `res/` entry is left out with a reason, and a new one stops the build). The engine manifest records Forge SHA, patch hash, toolchain, resource inventory, sizes and SHA-256. A card probe turns every card of the database into a game card, checks every layout, every token, the newest sets and the effects that create cards by name — identically on the JVM, in Node and in Chrome. Network play (Netty, jupnp, Jetty) is kept out of the module and the build enforces it. Forge's texts can be German (`--language=de-DE`); cards load eagerly by default. See [docs/implementation/04-forge-resources-card-scripts.md](docs/implementation/04-forge-resources-card-scripts.md).
- **Differential tests done (prompt 05):** the same scripted games with fixed seeds run on the JVM and as WebAssembly in Node and Chrome and are compared by a structured, language-independent engine trace (every checkpoint and Forge event, no prose, no clock), entry by entry; any divergence fails and names its place in the game. Ten small game fixtures (`engine/fixtures`) cover mulligan, land/spell play, priority, cost payment, targeting, stack, combat, blocker assignment, zone movement, game end and a Commander game; German and English give the same trace. See [docs/implementation/05-engine-differential-tests.md](docs/implementation/05-engine-differential-tests.md).
- **Web app skeleton done (prompt 06):** the production web application lives at the repository root (React 19, Vite 8, TypeScript 7 strict, Tailwind 4 with shadcn/ui) with the surfaces Start, Decks, Play, Matches, Settings and Credits in German, a sidebar from tablet width and a tab bar on phones. OpenMana's own design system (dark night blue and gold, Cinzel headings, touch targets from 44 px) is defined in [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). "Play" loads the real Forge engine through the `EngineClient` and shows its boot, readiness or abort; there is no invented game data. The build takes the engine only after checking size and SHA-256 of every file against its manifest and serves it content-addressed under `/engine/<id>/`. Every response carries COOP/COEP (dev server, preview, `vercel.json`); a web app manifest makes it installable; the temporary icon is Anvil's, unchanged. See [docs/implementation/06-web-pwa-skeleton.md](docs/implementation/06-web-pwa-skeleton.md).
- **Local data layer done (prompt 07):** decks, settings, recorded matches, Scryfall card data and cache bookkeeping have a versioned IndexedDB database (`openmana`, schema version 1) — never `localStorage`, no account, no cloud. Record shapes and the backup format are one JSON Schema (`src/storage/schema/`) with generated types and validators; migrations run in one transaction and upgrade older backups too; every write is all or nothing; failures (newer version, damaged structure, full storage, another tab, cleared site data) are shown with what can be done. Backups: a gzip-compressed JSON Lines file out, and back in after a complete check (merge or replace). Settings shows the data on the device, the browser's storage figures and a check of every record. See [docs/implementation/07-indexeddb-storage.md](docs/implementation/07-indexeddb-storage.md).
- **Scryfall card data done (prompt 08):** a card catalog built at build time from Scryfall's `all_cards` bulk data and Forge's card database (`npm run cards:build`, see [cards/README.md](cards/README.md)): one record per card with English faces, the printed German text, default printings (German picture where Scryfall has a real one, else English) and the Forge cards it is - 33 740 of Forge's 33 978 cards matched, the rest named with a reason. Served like the engine (size and SHA-256 checked, content-addressed under `/cards/<id>/`), installed into IndexedDB once per version from Settings (progress, stoppable), then names are found (German or English) and cards shown without asking Scryfall's API; pictures load straight from Scryfall's image server in CORS mode (required by COEP), never cropped. German first, English clearly marked where German is missing; double-faced cards, tokens and particular printings (fetched within Scryfall's rate limits and kept 30 days) handled. Settings show the catalog's Scryfall date and state; "Karte nachschlagen" looks cards up; Credits name Scryfall and Wizards of the Coast. Local database schema version 2. See [docs/implementation/08-scryfall-data.md](docs/implementation/08-scryfall-data.md).
- **Arena deck import done (prompt 09):** Decks → "Arena-Deck importieren" takes an MTG Arena deck list (pasted or as a text file): sections Deck, Sideboard, Commander, Companion and About/Name, counts, set and collector numbers, German or English names. Every line is resolved through the card catalog on the device to the card name Forge knows and Scryfall's Oracle id (faces, split cards, Universes Beyond names, Arena's rebalanced "A-" cards); only lines the catalog cannot decide that name a printing are asked of Scryfall (names in other languages, old German translations shared by two cards). The report shows every open line with its number - ambiguous names are the player's choice, cards Forge does not have are named, nothing is dropped silently - and saving is possible only when every line is clear and the deck has a name; the list is kept unchanged with the deck. No legality checks: Forge decides. The end-to-end test hands the imported decks to the real Forge engine. See [docs/implementation/09-arena-deck-import.md](docs/implementation/09-arena-deck-import.md).
- No playable table yet (the deck library and games follow). Anvil remains the working reference implementation until OpenMana reaches feature parity.

## Develop

```bash
npm ci                               # web app dependencies (repository root)
bash engine/scripts/build.sh         # build the Forge engine once (~6 min, see engine/README.md)
npm run cards:build                  # build the card catalog from Scryfall's bulk data (~45 s, see cards/README.md)
npm run dev                          # http://localhost:5173, cross-origin isolated
npm run check                        # typecheck, lint, unit tests, end-to-end test in Chrome with the real engine
npm run generate                     # after changing a schema (src/storage/schema, src/cards/scryfall): regenerate types and validators
```

`OPENMANA_ENGINE=omit npm run build` builds the UI without an engine, `OPENMANA_CARDS=omit` without card data (the app then says so); a normal build without a checked engine and card catalog fails. The end-to-end test loads real card pictures from Scryfall and needs internet access.

## Credits

OpenMana will visibly credit Forge, ManaBrew, Scryfall, OpenAI ChatGPT and Anthropic Claude. Exact license and attribution obligations must be verified before distribution.
