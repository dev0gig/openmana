# Deck list test fixtures

Hand-written deck lists in MTG Arena's export format for the deck import
tests (`src/decks/*.test.ts`); they never reach the app. The cards are those
of the small test card catalog (`cards/fixtures`), so the tests can resolve
them for real.

- `arena-constructed.txt`: an English export with About/Name, Deck and
  Sideboard, set codes and collector numbers - a double-faced, a split, an
  adventure and a modal double-faced card, a Universes Beyond card (Scryfall's
  name, Forge knows the printed one), a rebalanced Arena card (`A-`), a card
  only Forge knows, a card on two lines in two printings.
- `arena-companion.txt`: a companion, listed again in the sideboard as Arena
  does.
- `arena-brawl.txt`: a Commander (Brawl) export.
- `arena-german.txt`: a German list with a byte order mark and Windows line
  ends, German section names, German card names and a card Forge does not
  know.
- `plain-without-headers.txt`: no section names; a blank line starts the
  sideboard (Arena's rule).
- `messy.txt`: what deck sites write (`4x`, tabs, `Deck:`), lines that are no
  card (`four Forest`, `0 Fire // Ice`), a name with words in parentheses, a
  set without collector number.

Card names are © Wizards of the Coast.
