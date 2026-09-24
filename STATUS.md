# OpenMana — Current Status

Last repository review: 2026-09-24

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

## Currently In Progress
Nothing. Prompts 00–02 are `COMPLETE`. The next prompt is **03 — Worker transport and protocol** (`PENDING`, not started: the assignment of 2026-09-24 explicitly ended after prompts 01 and 02).

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
- no versioned UI ↔ engine protocol package (`engine/protocol`) yet — prompt 03,
- no production OpenMana user interface yet,
- no deck library/import UI yet,
- no Scryfall application layer yet,
- no playable OpenMana battlefield UI yet,
- no PWA/Android production artifact yet.

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

Therefore the repository is intentionally **not being migrated while the numbered program is running** (at this review point: 02 complete, 03 next, nothing in progress).

Dropzone Master/Standalone must respect:
- `prompts/STATUS.md` statuses,
- strict numerical order,
- one-prompt-at-a-time behavior where specified,
- existing commit/push completion rules,
- current `IN_PROGRESS` work.

A later explicit migration can simplify the queue after the current program is safely paused or completed.

## Maintenance
Update this file only when the broad implementation state changes. Keep detailed prompt evidence, commit hashes, measurements and blockers in `prompts/STATUS.md` and implementation/research docs.
