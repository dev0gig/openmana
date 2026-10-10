# 39 — Header and player strips: medallions, zone piles, opponent's hand, card back

## Scope and authority

Fourth prompt of the table redesign series 36–45 (project owner, 2026-10-10;
rules in `docs/design/SPIELTISCH.md` §4.2–4.6, mockup
`docs/design/spieltisch-vorlage/`: `#medaillon`, `#rueckseite`, `#emblem` in
`index.html`, `.medaillon`, `.zone*`, `.rueckseiten`, `.kopf*` in
`tisch.css`). The header and the two players' strips of the game table - in a
running game and in the replay, which uses the same `GameTable` - take the
table's look. Only presentation changes: every value is Forge's (life, zone
sizes, the graveyard's cards, mana, counters, commander values), nothing is
computed or invented, hidden stays hidden. No engine, bridge, protocol,
storage, recording or replay change.

## What was built

- **Drawn pieces** (`src/game/table/table-art.tsx`): `TableArt` defines the
  OpenMana emblem, the life medallion's ring and OpenMana's own card back once
  per table as SVG symbols (`table-art-emblem`, `table-art-medallion`,
  `table-art-back`; gold and night-blue gradients mixed from the tokens) -
  rendered after `TableSurface`, `aria-hidden`, no room, no pointer events.
  `TableEmblem` and `TableCardBack` draw them with `<use>`.
- **Card back:** `TableCardBack` (slot `game-card-back`) replaces
  `GameCardBack` (removed from `game-card.tsx`) for every hidden card on the
  table: the opponent's hand, face-down permanents and hidden commanders,
  hidden stack items, hidden cards of Forge's questions (`decision-panel.tsx`)
  and the library pile. It never stands for a card the player may see; the
  card view shows Forge's words for a card without a picture, never the back.
- **Header** (`game-table.tsx`): emblem and gold Cinzel wordmark "OpenMana"
  (`aria-hidden`, a logotype; the `h1` names the game; the wordmark from
  `quadrat` up, not in a low `breit` window; the emblem everywhere except a
  `hoch` screen narrower than 400 px); "Zonen ansehen" (`Layers`) and
  "Spielverlauf ansehen" (`ScrollText`) as symbol buttons with the words
  "Zonen" and "Spielverlauf" in `breit`; the help button holds the turn line
  "Zug N · Dein Zug" / "Zug N · Forge-KI am Zug" (`turnOwnerLabel`, now
  "Dein Zug"; the number in gold; before the first turn "Die Starthände
  werden gezogen") and below it the `PhaseTrack` with Forge's step (the
  anchor `span[id][title]`), "Hilfe" beside its symbol in `breit`; the status
  badge as before; the menu at the right end (Sheet from the left, conceding
  confirmed - unchanged). On a `hoch` screen narrower than 400 px the track
  gives way to the step's words (prompt 41 brings the compact phases into the
  action bar).
- **Strips** (`PlayerBar`, parts in `src/game/table/strip-parts.tsx`): a grid
  `1fr | medallion | 1fr` lying on the board (the strips lost their panel
  tone; their words are chips of the panel tone):
  - **Life medallion** (`MedallionFace` inside `GamePlayer` /
    `GamePlayerButton`, class `table-medallion`): the drawn ring, Forge's life
    total in Cinzel inside `title="Lebenspunkte"` / `.tabular-nums`, the name
    band "Du" / "Forge-KI". It is the player's control exactly as before
    (`playerUse`, double-tap guard, repeated keys dropped, disabled with
    Forge's reason). Marks: GamePlayer's inset outline (usable dashed gold,
    chosen solid light, a stack target now double `--table-danger`) plus a
    glow in the mark's colour; a crosshair at the ring while a spell targets
    the player. Whose turn it is: the ring glows (`data-active`) and the
    medallion says ", am Zug" to screen readers. Sizes: 2.75 rem (44 px) in
    `hoch` and a low `breit` window, 3.5 rem in `quadrat`, 3.75 rem in
    `breit`.
  - **Left:** the opponent's hidden hand as overlapping backs (one per card,
    from a strip width of 28 rem; revealed cards stay a toolbar), the hand's
    count "Hand N" (shown as "N Hand"), the AI profile, "Priorität" and
    "verloren" as chips.
  - **Right:** the library (`ZonePile` "Bibliothek": OpenMana's back with a
    stacked edge and Forge's number; not a control - Forge never shows the
    library), the graveyard (`ZonePile` "Friedhof": its top card or a dashed
    empty place; a button), exile and, when Forge shows one, the command zone
    (`ZoneCounter`: a chip whose button is at least 44 px on touch, 24 px elsewhere). The
    graveyard's top is the **last** card of Forge's list: Forge's `Zone.add`
    appends a card that comes without a position (`moveToGraveyard`), so the
    last card is the one put there last.
  - A pile or counter opens the existing `ZoneSheet` for that player and zone
    (`CardControls.lookZone`): looking only, nothing sent, focus back on the
    pile; its name says zone, count and top card ("Friedhof der Forge-KI
    ansehen: 2 Karten, oben: …").
  - **Below**, only when Forge reports any: the mana pool, the player's
    counters (poison …), commander tax and damage as chips - the facts of the
    old strip line, none left out. "am Zug" is now the medallion's glow plus
    the header's words.
  - Every count keeps its anchor: an element with the zone's title ("Hand",
    "Bibliothek", "Friedhof", "Exil", "Kommandozone") whose text ends with
    the number (`row-reverse` shows the number first).
- **Styles** (`src/game/table/table.css`, all under
  `[data-slot="game-board"]`): wordmark, chips, zone words, medallion (ring,
  life, band, glows, crosshair), piles (stacked edges by drop shadow on the
  back and box shadow around the graveyard's box - nothing on the picture),
  counters, hand backs; sizes per layout through the same media queries as
  the variants. No animation.
- **Tests:** `src/game/game-table.test.tsx` (new block: medallion, glow,
  library/graveyard/exile piles, the top card, an empty graveyard, a pile
  opening the zone view without a tap and returning the focus, the command
  counter, the backs defined once, chips, the red stack target, the header),
  header expectations in `game-table.test.tsx`, `game-page.test.tsx`,
  `priority.test.tsx`, `turn-model.test.ts`. End-to-end section 12:
  `stripFacts` in every scene at the eight sizes and the foldable's three
  (medallion with ring and life, library pile, each medallion/pile/counter
  inside the window and its strip and at least 44 px on touch, no strip
  spilling sideways, the header's three buttons 44 px on touch, the symbols
  defined once) and `pileInteractions` at the eight sizes (graveyard, exile
  and command zone open the right zone view, axe, nothing sent, focus back).
- **Consumers of anchors:** the readiness player reads whose turn it is from
  "Dein Zug" (was "Du bist am Zug"); the end-to-end test (preferences) and
  the readiness games read the AI profile Forge confirmed from the chip
  `[data-strip-fact="profile"]` (was the strip's first `badge`); every other anchor (`[title="Lebenspunkte"]
  .tabular-nums`, the zone titles, `button[data-slot="game-player"][data-player]`,
  `data-mark`, `game-card-back`, "Hand der Forge-KI: …") is unchanged.

## Deliberate deviations from the mockup

- The history keeps its name "Spielverlauf" (mockup "Protokoll"): the
  button's name is "Spielverlauf ansehen" and its visible words must be part
  of it (WCAG 2.5.3).
- The turn line stands inside the help button in the middle of the header
  (help opens from the turn/phase area, Beginner Help Rules), not at the
  right end; the mockup's "Einstellungen", "Friedhof", "Exil" header buttons
  are not taken over (menu, piles, "Zonen ansehen").
- On a `hoch` screen narrower than 400 px the emblem and the phase track give
  way to the turn's words (a small phone has no room for all of them; the
  battlefields keep their 80 px).
- Exile and the command zone are counters on the right next to the piles;
  the medallion stays inside its strip instead of reaching into the
  battlefield; profile, priority, lost, mana, counters and commander values
  (not in the mockup) are chips.
- The name band says "Forge-KI" (the app's word for the AI seat, never
  Forge's player name; the mockup's "Gegner" is example text).

## Measurements

- **Battlefields** (end-to-end, smallest per size over every scene):
  small phone 75 px (an expanded question; 84 px in the compact `stack`
  scene, 90 px in `commander-late`), phone 116, Fold closed 145, phone
  turned 121, the rest 163-347 px. Prompt 38 had 74 / 85 / 89 px at the
  small phone - the strips' height (44 px medallion and piles) is paid back
  by a header one line shorter and strips without a second line in most
  scenes.
- **Strips:** 46 px in `hoch` (68-92 px with a line of commander chips),
  71-93 px in `quadrat`, 74-96 px in `breit`. Medallions at least 44 px,
  piles and counters at least 44 px on touch screens and 24 px elsewhere,
  no strip spilling sideways in any of the 418 scene checks.
- **Performance** (Chrome, 4x CPU throttling, 412 x 915, 20 state changes of
  the recorded game): longest task with the table 58 ms (without the
  surface none, longest frame 66 ms), longest animation frame 92 ms -
  well below the 200 ms budget; the surface drawn only for the 20 size
  changes (2.5-3.6 ms each), never for the 5 new states of one size.

## Evidence

- `npx tsc -b`, `npx oxlint`: exit 0.
- Vitest: 80 files, 1090 tests passed.
- `node scripts/e2e/run.ts --table-only`: "Table E2E OK", `failures: []`
  (`stripFacts` in every scene at the eight sizes and the foldable's three,
  `pileInteractions` at the eight sizes).
- `OPENMANA_ENGINE_DIR=engine/build/publish-35d/dist
  OPENMANA_CARDS_DIR=engine/build/publish-35d/catalog npm run check`: exit 0
  (schemas, tsc, oxlint, Vitest, "E2E OK" with `failures: []`, PWA suite);
  `browserEvidence` accepts the reports (8 viewports, 791 axe checks, 11
  worker checks). The engine verified (`engine-lock.mjs verify`: Forge
  `ed0333fe…`, manifest `a9b4c26b…`).
- `node scripts/readiness/matches.ts --serve dist`: "all checks passed", 7
  games (rakdos, control, commander, phone, walkers, grixis, fold).
- Image comparison with the mockup: Seafile
  `/repo/openmana/design/spieltisch-umsetzung/39/` (55 screenshots: scenes
  `main-phase`, `commander-late`, `attack-declared`, `target-player`,
  `opening` at the eight sizes and the foldable's three; never committed).
- First run of `npm run check`: two failures in the preferences section -
  the test read the AI profile as the strip's first badge; fixed by the
  anchor `data-strip-fact="profile"` (end-to-end and readiness games). A
  first `--table-only` run stopped once at a screenshot timeout on the first
  foldable scene (cold start); measured again (about 1 s per screenshot) and
  passed in the repeated run.
