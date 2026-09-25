# Card catalog test fixtures

Small, real inputs for the catalog tests (`cards/scripts/*.test.ts`,
`src/cards/*.test.ts`); they never reach the app.

- `scryfall-all-cards.jsonl`: 46 card objects from Scryfall's `all_cards` bulk
  file of 2026-09-24, cut down to the fields OpenMana reads
  (`src/cards/scryfall/scryfall.schema.json`). Chosen to cover German and
  English printings with every image status, a German printing with English
  "printed" texts (Forest, Delver of Secrets), split, adventure, flip,
  transform, modal and meld cards, tokens of one name, a Universes Beyond
  alias (Hansk / Daryl), two cards of one name (Joven and Chandler), an Art
  Series card, a reversible card, a card only printed in Japanese and a
  printing without picture. Card data © Wizards of the Coast; provided by
  Scryfall (https://scryfall.com), used under its API terms.
- `scryfall-sets.json`: the sets of those cards from Scryfall's set list.
- `forge-res/`: card scripts copied unchanged from Forge (engine/forge,
  GPL-3.0-or-later) and hand-written edition files with only the lines the
  tests need.
- `forge-unmatched.json`: the exceptions list for `forge-res/`.
