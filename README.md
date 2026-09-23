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

Architecture/definition phase. Anvil remains the working reference implementation until OpenMana reaches feature parity.

## Credits

OpenMana will visibly credit Forge, ManaBrew, Scryfall, OpenAI ChatGPT and Anthropic Claude. Exact license and attribution obligations must be verified before distribution.
