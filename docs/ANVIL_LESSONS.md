# Anvil Lessons for OpenMana

OpenMana is new code, but Anvil already paid for many product lessons.

## Rules boundary
The client does not know Magic rules. Forge determines legal/selectable/actionable state. UI code presents it. Card-name/mechanic-specific presentation branches are prohibited.

## Interaction
- Inspecting a card must be safe.
- Playing/activating must communicate commitment.
- Board selection and card inspection may need different gestures.
- Touch long-press and horizontal scrolling can conflict; test web interactions rather than copying Android timings.
- Concede requires confirmation.
- Primary actions should stay fixed/reachable rather than living at the end of long scrolls.

## Game table
Anvil improved when the table stopped being one vertical list. Keep major regions stable, allow horizontal card rows where necessary, and keep the player's hand/action area readily accessible.

## Live state
Do not keep stale card snapshots in long-lived presentation state. Keep stable identity/source and resolve against the current authoritative state.

## Forge protocol
- Full authoritative state is robust.
- A card play/activation can happen outside a question-response flow.
- `spielbar`/actionable state comes from Forge.
- Mulligan and cost payment have special Forge interaction paths.
- Questions can be withdrawn.
- Event history should originate from Forge.
- Structured data beats parsing human-readable/localized strings.

## Failure visibility
Anvil exposed how damaging silent failures are. A failed action, unavailable engine, invalid import or missing card must produce visible feedback.

## Preferences
Settings chosen rarely (AI profile, language/display preferences) should not clutter the repeated game-start path.

## Testing priorities
Regression tests should emphasize the places Anvil historically found difficult: selectable/actionable state, question conversion, cost payment, mulligan, targeting, combat, commander behaviour, identity mapping, card-data completeness and stale-state handling.
