# Game table mockup (Spieltisch-Vorlage)

A static visual mockup of the redesigned game table, built from Patrick's
concept image (2026-10-10). No game logic: `vorlage.js` only draws two
example scenes ("Konzept" and a crowded "Voller Tisch"; the menu button
switches, or `?szene=voll`). It exists to agree on the look before the
redesign prompts are written.

- Everything is HTML/CSS/SVG and scales with the window: emblem, life
  medallion, card back, crystals, candles, vines and the table ornament are
  SVG symbols in `index.html`; the stone floor is SVG noise and joints in CSS.
- Three layouts by aspect ratio, not by device: `hoch` (< 3:4, folded
  foldable, phones), `quadrat` (3:4 – 13:10, unfolded foldable either way),
  `breit` (> 13:10, desktop, tablets turned).
- Card pictures are Scryfall's (German printings), never cropped or covered:
  power/toughness, loyalty, pile size and attacking sit on a plinth below the
  card; marks are frames around it; the targeting arrow ends beside the card.
- The game table is the approved exception to the shadcn-only rule (own CSS
  allowed); the rest of the app stays shadcn.
- Fonts: Cinzel and Inter (SIL OFL), copied from `@fontsource-variable`.

View: serve this folder (`python3 -m http.server`) and open it at any size.
Screenshots live in Seafile under `/repo/openmana/design/spieltisch-vorlage/`.
