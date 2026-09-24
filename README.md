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
- No user interface yet. Anvil remains the working reference implementation until OpenMana reaches feature parity.

## Credits

OpenMana will visibly credit Forge, ManaBrew, Scryfall, OpenAI ChatGPT and Anthropic Claude. Exact license and attribution obligations must be verified before distribution.
