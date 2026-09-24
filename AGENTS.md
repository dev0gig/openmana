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
- Never `localStorage`/`sessionStorage` as a store (enforced by `src/app/local-first.test.ts`); the storage layer never talks to a network.
- Record shapes and the backup lines are defined only in `src/storage/schema/local-data.schema.json`; after a change run `npm run generate` and commit the generated files (`npm run check`/`build` fail on stale ones).
- Any change to a record shape or to stores/indexes raises `SchemaVersion` in the schema and adds a migration in `src/storage/migrations.ts` (never edit a released one); record upgrades are pure functions, because older backups are upgraded with them too. User data is migrated, caches may be emptied.
- Write through `LocalDatabase.write` (one transaction, all or nothing, only IndexedDB requests awaited inside) and check records before writing (`assertRecord`); show damaged stored records as damaged, never drop them silently.

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
8. Follow the repository's current commit/push completion rule for the numbered program.

## Documentation Responsibilities
- `docs/BIBLE.md`: canonical product/architecture.
- `docs/research/`: technical research/evidence.
- `docs/implementation/`: implemented milestone records.
- `README.md`: concise current public/developer overview.
- `STATUS.md`: compact implementation map.
- `prompts/STATUS.md`: detailed numbered-program execution ledger.
- `prompts/queue/`: task specifications.

Do not duplicate detailed per-prompt history into root `STATUS.md`.
