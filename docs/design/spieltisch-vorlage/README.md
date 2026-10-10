# Game table mockup (Spieltisch-Vorlage)

A static visual mockup of the redesigned game table, built from Patrick's
concept image (2026-10-10). No game logic: `vorlage.js` only draws two
example scenes ("Konzept" and a crowded "Voller Tisch") on one of three
table variants: `arkan.js` "Holztisch" (the default and Patrick's choice,
2026-10-10: a plain wooden desk with one board set into it - carved frame,
brass corners, leather surface, gold arcane circle) and, for comparison,
`tischflaeche.js` astrolabium, matte, runen. Drawn props on the desk (books,
candles, potions …) were tried and rejected as too flat. The menu
button opens a mockup menu to switch both; or `?szene=voll&tisch=runen`. It exists to agree on the look before the
redesign prompts are written.

- Everything is HTML/CSS/SVG and scales with the window: emblem, life
  medallion, card back, crystals, candles, vines and the table ornament are
  SVG symbols in `index.html`; the stone floor is SVG noise and joints in CSS.
- Three layouts by aspect ratio, not by device: `hoch` (< 3:4, folded
  foldable, phones), `quadrat` (3:4 – 13:10, unfolded foldable either way),
  `breit` (> 13:10, desktop, tablets turned).
- Card pictures are Scryfall's (German printings), never cropped, blurred or
  colour-shifted. Forge's power/toughness and loyalty sit as a plaque on the
  card's own printed box (bottom right, Patrick's decision 2026-10-10), never
  on the artist/copyright line; this changes the rule "nothing drawn over a
  card picture" in AGENTS.md for exactly that box and must be written there
  when the redesign is built. Pile size sits above the pile; marks are frames
  around the card; arrows (target red, attack amber) end beside cards.
- The table surface is one SVG drawn for the actual size of the playing area
  (circles stay circles), so variants can be swapped without touching the
  rest of the table.
- The game table is the approved exception to the shadcn-only rule (own CSS
  allowed); the rest of the app stays shadcn.
- Swiping a thumb over the hand lifts the card under it, like the mouse.
- Fonts: Cinzel and Inter (SIL OFL), copied from `@fontsource-variable`.

View: serve this folder (`python3 -m http.server`) and open it at any size.
Screenshots live in Seafile under `/repo/openmana/design/spieltisch-vorlage/`.
