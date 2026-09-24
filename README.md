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
- No user interface yet. Anvil remains the working reference implementation until OpenMana reaches feature parity.

## Credits

OpenMana will visibly credit Forge, ManaBrew, Scryfall, OpenAI ChatGPT and Anthropic Claude. Exact license and attribution obligations must be verified before distribution.
