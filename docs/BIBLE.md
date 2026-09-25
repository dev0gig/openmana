# OpenMana Bible

> Canonical product and architecture document. When implementation and this document disagree, resolve the discrepancy deliberately rather than silently changing the product.

## 1. Vision

OpenMana is a modern, browser-first client for playing Magic: The Gathering against Forge AI using decks the user imports.

It combines Forge's mature rules/card scripts/configurable AI with a modern, touch-friendly interface, local ownership of imported decks, Scryfall-backed card presentation, and browser availability without a personal server.

OpenMana is the successor to Anvil. Anvil is a reference implementation and source of lessons, not code to port line-by-line.

**Product principle: The player should play Magic, not operate the rules engine.**

OpenMana should remove mechanical friction where Forge can prove no meaningful choice exists, while making every real decision clear.

## 2. Non-negotiable architecture

### Forge is authoritative

Forge remains the only authority for:
- Magic rules and card behaviour/scripts
- legal actions and selectable cards/targets
- stack, priority, combat and state-based actions
- AI behaviour
- rules/format behaviour supplied by Forge

The OpenMana UI MUST NOT reimplement Magic rules. A UI condition such as `if (card.name === "...")` to implement a card/mechanic is an architectural failure.

### Browser-local Forge

Target:

```
OpenMana Web/PWA
├── UI / UX
├── Deck library (IndexedDB)
├── Scryfall data layer
└── OpenMana ↔ Forge bridge
        └── Forge WebAssembly
            ├── rules
            ├── card scripts
            └── AI
```

No Odin dependency. No Tailscale requirement.

Forge-in-browser should follow the proven direction demonstrated by ManaBrew. The exact current toolchain must be validated before implementation.

### Hard separation

```
OpenMana UI
    ↓
OpenMana protocol
    ↓
Forge bridge
    ↓
Forge WASM
```

The UI must not bind directly to arbitrary Forge internals. This boundary exists so Forge can be upgraded without rewriting the UI.

Anvil's `PROTOKOLL.md` and `forge-anvil` adapter are the starting reference for this contract.

## 3. Forge update policy

Updating Forge must be explicit and isolated.

Recommended layout:

```
openmana/
├── src/                 # OpenMana UI/application
├── engine/
│   ├── forge/           # pinned upstream Forge source/submodule
│   ├── bridge/          # OpenMana adapter
│   └── wasm/            # browser build integration
├── cards/               # Scryfall integration
└── docs/
```

Update flow:
1. Advance pinned Forge revision.
2. Rebuild Forge WASM and bundled Forge data/scripts.
3. Compile the bridge.
4. Run bridge/protocol tests.
5. Run representative game smoke tests.
6. Build OpenMana without changing UI source.
7. Review as a dedicated Forge-update PR.
8. Deploy only after tests pass.

Forge updates may bring card scripts, sets, mechanics, rules fixes and AI improvements. They must not silently mutate OpenMana UI.

If Forge API changes break integration, adapt the bridge rather than leaking Forge-specific changes through the UI.

## 4. Scryfall card data

Scryfall replaces Anvil's runtime dependency on Odin/Toride/Arcaneum for card metadata and imagery.

Responsibilities: names, localized display information, images, Oracle IDs, set/collector metadata and presentation/search metadata.

Language policy:
1. Prefer German data/printing where available.
2. Fall back cleanly to English.
3. Missing German data must never make a card unplayable.

Forge remains responsible for card behaviour. Scryfall never decides legality or resolves effects.

Prefer bulk ingestion/caching over a live request for every card interaction. Follow current Scryfall API, bulk-data, image-use and attribution requirements.

The implemented card catalog (built from Scryfall's bulk data and matched against Forge's card database, installed into IndexedDB), the display rules and how Scryfall's rules are kept are described in [implementation/08-scryfall-data.md](implementation/08-scryfall-data.md) and [cards/README.md](../cards/README.md).

## 5. Decks

### Arena import

Primary workflow: paste/import Magic Arena deck-list format.

Support as applicable:
- `Deck` and `Sideboard`
- quantities
- Arena set/collector annotations
- English names
- localized names when reliably resolvable

Resolve cards to stable identities and convert them to the representation Forge needs. Never silently discard unresolved cards; show an import report.

The implemented import (format, how a line becomes a card, the report and what is saved) is described in [implementation/09-arena-deck-import.md](implementation/09-arena-deck-import.md).

### Library

The implemented deck library (list, search, details, rename, duplicate, delete, import again, export, German/English status) and the choice of the player's and the AI's deck for a game (including a random AI deck) are described in [implementation/10-deck-library.md](implementation/10-deck-library.md).

### IndexedDB

Decks are local-first and stored in IndexedDB, not localStorage.

Persist at minimum: deck ID, name, original import text, normalized entries, sideboard, format, commander data where applicable, timestamps and schema version.

Provide backup/export and restore/import because browser storage can be deleted. No account/cloud sync is required initially.

The implemented database (stores, schema, migrations) and backup format are described in [implementation/07-indexeddb-storage.md](implementation/07-indexeddb-storage.md).

## 6. Game UX

Target modern digital-card-game usability with an original OpenMana identity. MTG Arena is a UX reference, not an asset/UI template to copy.

Forge tells OpenMana what is valid; OpenMana communicates it clearly:
- playable cards are visibly distinct
- valid attackers are obvious
- blocker declaration guides valid blockers/assignments
- valid spell/ability targets are highlighted
- tapped state is unmistakable
- summoning sickness has a clear, unobtrusive indicator
- selected cards have a strong state
- stack/priority is understandable without Forge knowledge
- impossible actions are not presented as plausible
- dangerous irreversible actions receive appropriate confirmation

The implemented game session - starting a game with the chosen decks, its states from loading to the result, prewarming the engine, conceding, failures and what a reload does - is described in [implementation/11-game-session.md](implementation/11-game-session.md).

### Match persistence / resume

A running match does not initially need to survive a tab close, browser reload, browser restart or Android tab discard. This limitation must be communicated honestly until recovery is proven reliable.

**Post-MVP requirement:** OpenMana should eventually persist recoverable running matches in IndexedDB and offer a clear **Continue game** flow after reopening the application.

Match recovery must restore the complete authoritative Forge game state reliably. A partial approximation is not acceptable if it can lose or alter stack contents, pending triggers, continuous effects, choices, priority, combat state, or other rules-relevant state. Do not implement card-specific recovery logic in the UI.

This feature should be implemented only after the core game-session/Forge bridge is stable and the exact serialization/restoration strategy has been validated with representative complex game states. Until then, reload or browser/tab termination may end the current match.

### Reduce meaningless interaction

Preserve Anvil's successful principle: priorities/decisions with no meaningful choice may be skipped only when Forge itself can safely determine that. Never auto-answer a meaningful choice merely for speed.

### Card interaction

Looking at a card must be safe. Committing an irreversible action requires clear intent. Full card view must be quickly accessible. Touch gestures must not cause accidental plays/activations.

### Full card view

- inspect without losing game context
- browse multi-card piles
- action button stays easy to reach
- dismissal is obvious on touch and desktop
- current/live state wins over stale cached UI

### Battlefield

Do not create a vertically endless table. Keep opponent summary/hand, opponent battlefield, combat/stack, player battlefield, decision area and player hand spatially understandable. Responsive layouts may reorganize them.

## 7. Forge AI

Forge AI remains the AI implementation.

Expose understandable difficulty/profile choices based on capabilities actually supplied by the integrated Forge version. Never fake difficulty by changing rules or granting illegal information.

Anvil used Forge concepts such as Cautious, Default, Experimental and Reckless. Before mapping these to Easy/Normal/Hard, test their actual behaviour and label honestly.

What the four profiles of the pinned Forge actually change - measured in 2 400 AI-against-AI games: styles, not difficulty levels, none measurably stronger or weaker than Forge's default - is in [research/AI_PROFILES.md](research/AI_PROFILES.md); how the player chooses one (and the other preferences: card language, less motion) in [implementation/12-ai-profiles-settings.md](implementation/12-ai-profiles-settings.md).

## 8. Formats

Do not hard-code Standard-only assumptions.

Anvil already dealt with standard/60-card play, Jumpstart-style paired half-decks and Commander. Initial OpenMana scope may be narrower, but the model/bridge must not block later Forge-supported formats.

## 9. Protocol lessons from Anvil

Carry forward:
1. Client never calculates validity.
2. Prefer authoritative full snapshots over fragile client reconstruction unless browser-local integration proves a safer model.
3. Playing/activating a card is not necessarily the same as answering a Forge question.
4. Preserve Forge selectable/actionable information.
5. Questions need stable IDs and explicit withdrawal.
6. Local-WASM removes network reconnect concerns, but reload/session recovery must be deliberate.
7. History should come from Forge's game log, not invented UI prose.
8. Do not infer actor/legality from localized text when structured data exists.
9. Cost payment, mulligans, targeting and combat need explicit protocol tests.

Anvil decision families include card/selectable selection, buttons, yes/no, options, numeric input, ordering and distribution. The bridge must cover every Forge path required by supported formats.

## 10. Beginner friendliness

Desired aids:
- clear turn/phase indicator
- contextual action text
- hover/tap explanations
- visible legal targets
- attack/block guidance
- summoning-sickness indicator
- clear stack visualization
- game/event history
- understandable errors
- optional terminology help

Assistance must derive from Forge state and static explanations; it must not invent rules.

## 11. Responsive targets

Web-first and touch-first, not mobile-only.

Support modern Android phones, foldables, tablets, desktop browsers, mouse/keyboard and touch. Use responsive web layout/feature detection rather than recreating Anvil's device-specific Kotlin architecture.

## 12. PWA and Android

Primary artifact: web application/PWA.

Later Android artifact: thin wrapper around the same web app, preferably Capacitor unless research identifies a better fit. There must not be a second Android UI implementation.

## 13. Visual identity

OpenMana should feel contemporary and premium. It may learn from MTG Arena interaction patterns but must have its own visual language, iconography, animations, layout details, branding and assets.

Do not copy proprietary Arena assets or reproduce its UI pixel-for-pixel.

The implemented design system (shadcn/ui components, OpenMana tokens, typography, touch and accessibility rules) is specified in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 14. Credits, attribution and licenses

Credits are a product requirement.

Visibly acknowledge, where applicable:
- **Forge / Card-Forge community** — rules engine, card scripts and AI
- **ManaBrew** — major technical inspiration/reference for browser-hosted Forge
- **Scryfall** — card data/images according to required attribution
- **OpenAI ChatGPT** — development/design assistance
- **Anthropic Claude** — development assistance

Ship all license notices/source obligations required by the exact code/versions used. Do not assume open source means unrestricted reuse.

Credits should distinguish software incorporated, inspiration/reference, data providers and AI assistance.

## 15. Privacy and ownership

Initial target:
- imported decks stay on-device
- no account required
- no Odin
- no Toride/Arcaneum runtime dependency
- no hidden telemetry by default

Future cloud sync must be explicit and must not silently replace local ownership.

## 16. Lessons that must survive Anvil

- Fixed primary actions beat controls hidden at the end of long scrolling screens.
- Failed actions must never disappear silently.
- Looking at a card and committing an action should be distinct where accidental activation is costly.
- Irreversible actions such as conceding need confirmation.
- The hand and current decision area stay easy to reach.
- Horizontal card rows are preferable to making the whole battlefield vertically scroll.
- Do not cache live card objects in long-lived presentation state; retain stable IDs/sources and resolve current state.
- Game history matters for understanding AI turns and sudden board changes.
- Keep one-time preferences out of the repeated start-game path.
- Never silently truncate/paginate card data.
- Never parse localized prose when structured engine data exists.
- Test boundaries that previously broke: protocol conversion, selectable/actionable state, mulligan, cost payment, targets, combat, commander behaviour and card identity mapping.

## 17. Development principles

- TypeScript strict mode.
- Explicit schemas at Forge/Scryfall/storage boundaries.
- Version IndexedDB schemas and migrations.
- No card-name special cases in UI.
- No duplicated Magic rules in frontend.
- Keep Forge updates reviewable as isolated diffs.
- Automated tests before changing engine revision.
- Accessibility: keyboard navigation, focus states, readable contrast, reduced-motion support.
- Card imagery lazy-loaded/cached; prefetch only where it improves play.
- Offline-friendly where practical after required assets/engine are cached.

## 18. Implementation phases

### Phase 0 — research/validation
- Inspect current ManaBrew Forge-WASM implementation.
- Verify Forge/ManaBrew licenses and obligations.
- Prove a minimal Forge WASM build locally.
- Define exact bridge boundary.
- Confirm Vercel can serve required WASM/static assets within practical limits.
- Validate browser memory/startup on desktop and Android.

### Phase 1 — skeleton
- Web/PWA shell and original design system.
- IndexedDB schema.
- Scryfall bulk/cache prototype.
- Arena deck parser.
- Credits/licenses surface.

### Phase 2 — Forge integration
- Forge WASM loads locally.
- Start game with imported decks.
- Authoritative state reaches UI.
- Core decision types round-trip.
- AI profile selection.

### Phase 3 — playable table
- hand/battlefield/zones
- card viewer
- stack/priority
- targeting
- attacking/blocking
- history
- concede/restart
- responsive phone/desktop layouts

### Phase 4 — QoL
- polished legal-action highlights
- summoning-sickness indicator
- attack/block guidance
- animations
- preloading/caching
- beginner assistance
- accessibility pass

### Phase 5 — packaging
- production PWA and Vercel deployment
- Android wrapper
- storage backup/restore
- update/version diagnostics

## 19. Definition of success

A user can:
1. Open OpenMana in a modern browser without Odin/Tailscale.
2. Import an Arena-format deck.
3. Reopen the same browser and find the deck.
4. Choose decks and a Forge AI profile.
5. Play a rules-correct game governed by Forge.
6. Understand legal actions, targets, attacks and blocks from the UI.
7. See German card presentation where available and English fallback otherwise.
8. Update Forge independently from OpenMana UI.
9. Use the same application as PWA and later Android wrapper.
10. Access clear credits/licenses for the projects/tools enabling OpenMana.

## 20. Initially out of scope

- rewriting Magic rules in TypeScript
- replacing Forge AI
- multiplayer/network matchmaking
- accounts/cloud deck sync
- purchasing/owning digital cards
- reproducing MTG Arena assets/UI exactly
- Odin/Toride/Arcaneum runtime requirements
