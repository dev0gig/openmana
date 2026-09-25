# OpenMana card catalog (Scryfall data)

The card catalog is what OpenMana shows about cards - German and English
names, type lines and rules texts, the printings whose pictures it shows, the
sets with their Arena and Forge codes - and which Forge card each one is. It
is built from Scryfall's bulk data and Forge's card database, shipped with
the app like the engine (checked by size and SHA-256), and installed into the
browser's IndexedDB once per version. **It never decides rules:** which cards
exist, what they do and what is legal is Forge's alone.

Implementation record: [docs/implementation/08-scryfall-data.md](../docs/implementation/08-scryfall-data.md).

## Build

```bash
npm run cards:build                    # current Scryfall data (downloaded once into cards/build/cache)
npm run cards:build -- --offline       # the newest data already in the cache
npm run cards:build -- --bulk cards/build/cache/all-cards-<timestamp>.jsonl.gz
```

About 45 s on odin. Inputs:

- Scryfall's `all_cards` bulk file (every printing in every language, ~390 MB
  gzip JSON Lines; streamed, never unpacked on disk) and the set list
  (`/sets`), both kept in `cards/build/cache/` with Scryfall's facts about the
  bulk file (`*.entry.json`). The build makes two API requests (bulk index,
  sets); the bulk file comes from `data.scryfall.io`, which has no rate limit.
- Forge's card scripts and edition files from the engine's pinned checkout
  (`engine/forge`, must be unmodified), so catalog and engine know the same
  cards. The Vite build refuses a catalog matched against another Forge
  commit than the engine's.
- [`forge-unmatched.json`](forge-unmatched.json): Forge cards that have no
  Scryfall card, each with the reason.

Outputs in `cards/build/dist/` (ignored by Git, like the engine build):

| File | Content |
|---|---|
| `card-catalog.jsonl.gz` | header, sets, cards, Forge-only cards, end line (format in `src/storage/schema/local-data.schema.json`: `CatalogHeader`, `CatalogLine`, `CatalogEnd`) |
| `card-catalog-manifest.json` | id (first 16 hex digits of the file's SHA-256), size and SHA-256 (gzip and unpacked), Scryfall source (bulk file date, URL, SHA-256), Forge commit and counts |
| `card-catalog-report.json` | how every Forge card was matched, the ambiguous ones, the ones without Scryfall data |

The same inputs give the same catalog byte for byte (sorted, no clock in the
file); only the manifest's `builtAt` differs.

Every Scryfall card object is checked against
`src/cards/scryfall/scryfall.schema.json` (only the fields OpenMana reads;
Scryfall's other fields are ignored), every picture URL against the rule
the app builds URLs by (`src/cards/images.ts`), and every output line against
the local data schema. Anything unexpected stops the build with its line or
card id instead of ending up wrong in the catalog.

## What goes into a card

One record per Oracle identity (`CardRecord`), except Art Series cards,
deck-type indicator cards and reversible printings (their faces are printings
of other cards):

- **English faces** as the Oracle has them today (name, mana cost, type line,
  rules text, power/toughness/loyalty/defense, colours of faces that have
  their own).
- **German text** (`de`): the German printing with the most complete
  translation - a field counts only where it differs from the English one,
  because Scryfall's data has English "printed" texts on some German
  printings (a German Forest named "Forest", a German Delver of Secrets with
  the English name). Printed texts are translations of their day and receive
  no errata.
- **Default printings** (`prints`): `de` is the best German printing with a
  real picture (Scryfall's placeholders never count), `fallback` the best
  English one, or one in the card's only language. "Best": no content
  warning, not oversized, regular frame (no borderless/gold border/showcase/
  extended/full art, not textless), not a promo, paper, newest. Pictures are
  not stored as URLs; the app builds them from the printing's id, side and
  image timestamp.
- **Aliases**: English names printed on some printings (Universes Beyond,
  flavour names) with the printing that shows them - Forge knows some cards
  only by such a name (Daryl, Hunter of Walkers = Hansk, Slayer Zealot).
- **Name keys** (`src/cards/names.ts`): every name a card is found by -
  English, faces, aliases, every German printed name, the Forge names.
- **Forge names**: the Forge cards that are this card (by name, face name,
  alias, or - where a name fits several cards - by the printings Forge's
  edition files list for it).

## When Forge or Scryfall change

- **Forge update** (prompt 26): rebuild the engine, then the catalog. A new
  Forge card without Scryfall match stops the build until it is decided: fix
  the matching if it is a naming difference, or list it in
  `forge-unmatched.json` with the reason. A listed card that now matches
  stops the build too (remove it). Rebalanced Arena cards (`A-…`, Scryfall
  does not list them) are recognized on their own.
- **Newer Scryfall data** (new German printings or pictures, new sets): run
  `npm run cards:build` any time; Scryfall asks for gameplay data "once per
  week or after set releases" at most. A new catalog version is installed by
  the app when the player updates the card data in the settings; the old one
  stays usable until then.

## Rules of Scryfall this follows

(https://scryfall.com/docs/api, checked 2026-09-25)

- Bulk data for large lookups; the API only for particular printings a deck
  names (`src/cards/prints.ts`, `src/cards/scryfall-client.ts`: Accept
  header, 2 requests per second for `/cards/collection`, 10 for others, 30 s
  pause after HTTP 429, results kept 30 days).
- No paywall, no Scryfall logo, no implied endorsement; credited in the app
  (Credits) as the source of card data and pictures.
- Pictures are shown whole and unchanged (never cropped, blurred or
  watermarked): `src/components/ui/card-picture.tsx` uses `object-contain`.
