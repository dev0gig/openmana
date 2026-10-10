# Spieltisch — the redesigned game table (specification)

> Binding specification of the table redesign, prompts **36–45** (project
> owner, 2026-10-10). Written in prompt 36 before anything on the table
> changed; every later prompt of the series builds on it and keeps it up to
> date (§13). Rules that follow from it are in [`AGENTS.md`](../../AGENTS.md)
> (Game Table, Card Interaction, Preferences rules) and
> [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) §9.
>
> - **Mockup (the visual target):** [`spieltisch-vorlage/`](spieltisch-vorlage/)
>   (state of commit `f54fd38`, approved in four rounds). View it by serving
>   the folder (`python3 -m http.server` inside it; stop the server
>   afterwards). It has **no game logic**: its cards, values, names and texts
>   are examples. In the game everything comes from Forge's state.
> - **Concept picture and approved screenshots:** Seafile
>   `/repo/openmana/design/spieltisch-vorlage/konzeptbild-2026-10-10.png` and
>   `/repo/openmana/design/spieltisch-vorlage/runde-4-holztisch/`.
> - **Shared rules of the series** (decisions, test anchors, evidence per
>   prompt): Dropzone `reports/2026-10-10-openmana-spieltisch-regeln.md`.
>   Where a prompt and this document disagree, the prompt wins and updates
>   this document.

Words the player reads are German (quoted as they appear); everything else
is English, like the rest of the documentation.

## 1. Target picture

A dark wooden desk fills the whole screen. Set into it is one game board: a
carved wooden frame with brass corner plates, a dark blue leather surface and
a golden circle of runes across both halves, a centre line with diamonds and
the OpenMana emblem. Night blue and gold, headings in Cinzel.

On the board each player has a **strip** with a life **medallion** (gold ring,
the life total in Cinzel, a name band), their zones as small **piles**
(library as OpenMana's own card back, graveyard with its top card, exile), the
opponent's hand as overlapping backs. Between the strips lie the two
**battlefields**: creatures next to the middle, other permanents outside;
cards show their whole picture, Forge's power/toughness or loyalty as a
**plaque** on the card's printed value box, every other fact as a small
**chip** outside the picture. The player's **hand** is a **fan** at the
bottom; the card under the mouse or the thumb rises and grows.

Beside or between the battlefields stand two dark **panels** with gold lines:
the **Zauberchronik** (Forge's stack, top first, and the combat) and the
**Phasen-Tafel** (the turn's five phases with the current step in gold,
Forge's question and the large golden **main button**, "Weiter"). **Arrows**
show what a spell targets (red), whom a creature attacks (amber) and whom a
blocker blocks. The table moves - cards travel, tapped cards turn, the rune
circle turns slowly - but never makes the player wait, and stands still when
less motion is asked for.

The mockup shows exactly this; where this text is more precise (anchors,
data, accessibility, motion), this text applies.

## 2. Scope and principles

- **Where:** the game table only - a running game (`src/game/game-table.tsx`
  in `src/game/game-page.tsx`) and its replay (`src/matches/replay-page.tsx`,
  the same table without input callbacks, read-only after every prompt).
- **Own CSS and SVG are allowed here** (the approved exception to the
  shadcn-only rule, `DESIGN_SYSTEM.md` §9): components in `src/game/table/`
  and **one** stylesheet, `src/game/table/table.css`, whose rules all sit
  under `[data-slot="game-board"]`. `game-table.tsx` may be split into files
  under `src/game/table/`; its private `CardControlsContext` may be exported
  for that.
- **Stays shadcn:** every page outside the table, and inside the game the
  Sheets (card view, zones, history, help, menu), Dialogs and AlertDialogs
  (conceding, ending the turn), toasts and tooltips. They may look like the
  table only through tokens (§5), never through table.css.
- **Forge stays the only authority** for rules, values, actions, targets and
  texts. No invented data, no computed values (no "remaining toughness"),
  nothing card- or name-specific, no narration derived from states. Forge's
  texts and the app's existing words ("Weiter", "Verrechnen lassen", "Nicht
  angreifen" …) stay as they are.
- **Every protection stays:** `ARMING_MS`, `tapBlocked`, the double-tap and
  repeated-key guards, the confirmations of "Zug beenden" and "Aufgeben".
- **The page never scrolls.** Only card rows (sideways) and texts inside
  their region scroll.
- **Anchors stay** (§12): appearance and arrangement change, the names tests
  and tools hold on to do not. A prompt that must move one changes every
  consumer in the same prompt and documents it.
- **Style transfer to the rest of the app** (start, decks, matches, settings)
  is a later, separate series - not part of 36–45.

## 3. Layouts

The table is laid out by the **aspect ratio** of the window (width : height),
never by the device. Exactly one layout applies at any size.

| Layout | Aspect ratio | Typical screens |
|---|---|---|
| `hoch` | narrower than 3:4 | folded foldable (480 × 1040), phones, tablets upright when narrower than 3:4 |
| `quadrat` | 3:4 up to 13:10, both borders included | unfolded foldable either way round (870 × 960, 960 × 870), most tablets |
| `breit` | wider than 13:10 | desktop, laptop, tablets and phones turned |

`short` (at most 32 rem high, the existing variant) is added on top of
`breit` for a phone turned sideways.

**Code** (prompt 36): `src/game/table/table-layout.ts` (`TableLayout`,
`TABLE_LAYOUT_QUERIES`, `tableLayoutOf(width, height)`),
`useTableLayout()` in `src/game/table/use-table-layout.ts`, and the Tailwind
variants `hoch:`, `quadrat:`, `breit:` in `src/index.css` - the same three
media queries (`(aspect-ratio < 3/4)`, `(3/4 <= aspect-ratio <= 13/10)`,
`(aspect-ratio > 13/10)`), kept identical by
`src/game/table/table-layout.test.tsx`. Prompt 36 does not use them on the
table yet; prompt 38 switches `GameBoard` and the Sheets (card view from the
bottom in `hoch`, from the side in `quadrat`/`breit`) from
`portrait:`/`landscape:`/`useLandscape()` to them. Do not change the root
font size per layout as the mockup does (it would resize the shadcn Sheets
and Dialogs too); scale inside the board (container units or a custom
property on `[data-slot="game-board"]`).

**The test sizes** (end-to-end section 12; the real browser checks every one
of them and the borders 299/300 × 400 and 1300/1301 × 1000):

| Size | CSS px | Layout |
|---|---|---|
| small-phone | 360 × 740 | `hoch` |
| phone | 412 × 915 | `hoch` |
| fold-portrait | 690 × 829 | `quadrat` |
| fold-landscape | 829 × 690 | `quadrat` |
| tablet | 884 × 1104 | `quadrat` |
| tablet-landscape | 1104 × 884 | `quadrat` |
| phone-landscape | 915 × 412 | `breit` (and `short`) |
| desktop | 1440 × 900 | `breit` |
| Fold closed / open / open turned | 480 × 1040, 870 × 960, 960 × 870 | `hoch`, `quadrat`, `quadrat` (image comparison; prompt 38 may add them to the checks) |

### 3.1 The eight regions

`GameBoard` keeps its eight regions (`data-slot="game-board-area"`,
`data-area`, their `aria-label`s). The visible titles may change; the
accessible names do not.

| `data-area` | `aria-label` | Becomes | `breit` | `quadrat` | `hoch` |
|---|---|---|---|---|---|
| `header` | "Spielstand" | header bar (§4.2) | top, full width | top, full width | top, compact |
| `opponent` | "Forge-KI" | opponent's strip (§4.3–4.6) | middle column, above their field | left column, top | below the header |
| `opponent-field` | "Spielfeld der Forge-KI" | opponent's battlefield (§4.7) | middle column | left column | full width |
| `center` | "Stapel und Kampf" | **Zauberchronik** (§4.11) | left column, full height | right column, top | a bar between the battlefields |
| `field` | "Dein Spielfeld" | your battlefield | middle column | left column | full width |
| `me` | "Du" | your strip | middle column, below your field | left column | above the hand |
| `decision` | "Entscheidung" | **Phasen-Tafel** with Forge's question and the main button (§4.12–4.14) | right column, full height | right column, bottom | **action bar at the very bottom**, below the hand; grows upwards for questions |
| `hand` | "Deine Hand" (name of its toolbar: "Deine Hand: N Karten") | fanned hand (§4.10) | bottom, between the side columns | left column, bottom | full width, above the action bar |

The centre line between the battlefields is part of the table surface
(§4.1), not a region; the grid may keep a thin row for it (`breit`,
`quadrat`). In `hoch` the Zauberchronik bar takes its place.

### 3.2 Grid plans (from the mockup's `tisch.css`; prompt 38 settles the exact values)

```
breit (> 13:10)                                   quadrat (3:4 … 13:10)            hoch (< 3:4)
┌───────────────────────────────────────────┐     ┌─────────────────────────┐      ┌───────────────┐
│ header                                    │     │ header                  │      │ header        │
├──────────┬─────────────────────┬──────────┤     ├───────────────┬─────────┤      ├───────────────┤
│          │ opponent            │          │     │ opponent      │ center  │      │ opponent      │
│ center   │ opponent-field      │ decision │     │ opponent-field│ (Chron.)│      │ opponent-field│
│ (Zauber- │ ── centre line ──   │ (Phasen- │     │ ─ centre line ├─────────┤      │ center (bar)  │
│ chronik) │ field               │ Tafel)   │     │ field         │decision │      │ field         │
│          │ me                  │          │     │ me            │(Phasen- │      │ me            │
├──────────┴─────────────────────┴──────────┤     │ hand          │ Tafel)  │      │ hand          │
│            hand (between the columns)     │     └───────────────┴─────────┘      │ decision (bar)│
└───────────────────────────────────────────┘                                      └───────────────┘
```

- `breit`: columns `minmax(14rem, 18rem) | minmax(0, 1fr) | minmax(13.5rem,
  16.5rem)`; rows header `auto`, strip ≈ 3.9 rem, field `1fr`, centre line ≈
  1.4 rem, field `1fr`, strip ≈ 3.9 rem, hand `clamp(6.5rem, 18vh, 12.5rem)`.
- `quadrat`: columns `minmax(0, 1fr) | clamp(11.5rem, 25vw, 14rem)`; strips ≈
  4.3 rem, centre line ≈ 1.6 rem, hand `clamp(7rem, 17vh, 11rem)`; the right
  column holds the Zauberchronik next to the opponent's half and the
  Phasen-Tafel next to yours down to the bottom.
- `hoch`: one column; strips ≈ 3.6 rem, chronicle bar `auto`, hand
  `clamp(6.5rem, 15vh, 10rem)`, action bar `auto` with
  `env(safe-area-inset-bottom)`.
- `short` + `breit`: the side columns and the hand keep to their minimum; an
  expanded decision may use the whole right column (today's rule: stack and
  combat step aside in a low window - in `breit` the chronicle is in its own
  column, so it may stay, reduced to its title and count if the height needs
  it).

### 3.3 Room for Forge's questions

The mockup has no room for Forge's questions; the table must. The decision
region keeps its growth (`GameBoard decision`: `compact | tall | expanded`,
measured by `decisionNeedsRoom` in `decision-panel.tsx`):

- `breit`/`quadrat`: the question, its parts and buttons stand in the
  Phasen-Tafel below the phases; a question that needs room folds the phases
  to one line (group and step) and scrolls inside the panel; the answer
  buttons stick to its bottom.
- `hoch`: the action bar shows the compact phases and the main button; for a
  question it grows **upwards** - `tall` up to ≈ 28 %, `expanded` up to ≈
  36 % of the height, as today - and the battlefields keep at least one row
  of cards (end-to-end: 80 px, 64 px while `expanded`).
- Two rows per battlefield stay a measured threshold (`TWO_ROWS_MIN_HEIGHT`,
  176 px today; prompt 38 checks it for the new grid). Creatures lie next to
  the middle.

## 4. Building blocks

Each block names its mockup source, where its data comes from today, the
anchors it keeps and the prompt that builds it.

### 4.1 Table surface (prompt 37)
- Mockup: `arkan.js` - `arkan()` (desk: wood grain, plank joints, vignette),
  `brett()` (board: shadow, carved frame, brass inlay line, leather with fine
  grain, inner gold line, circle light, grooved circles, 16 spokes, 16-point
  star, centre line with diamonds, rune ring with own glyphs - no real
  script -, brass corner plates with rivets), `DEFS` (filters, gradients).
- Component `TableSurface` in `src/game/table/`: behind the regions,
  `aria-hidden`, `pointer-events: none`; one SVG drawn for the measured
  playing area (from the opponent's strip to yours, in the battlefields'
  column; circles stay circles) and the screen, **redrawn only when a size
  changes** (`ResizeObserver`), never per game state. The board stays inside
  the screen (margins as in the mockup).
- Colours: `--table-wood`, `--table-wood-frame`, `--table-leather`,
  `--primary`/`--table-gold-*` (§5). Expensive filters (`feTurbulence`)
  never recomputed per state: a static tile as CSS background or one drawing
  per size.
- Motion: the rune ring turns very slowly (≈ 6 min per turn) and glimmers
  (opacity); both stop under less motion.
- Region backgrounds become transparent or subtle so the board shows; text
  stays readable (panel tokens where needed).
- **Built (prompt 37):** `src/game/table/table-surface.tsx` (`TableSurface`,
  first child of `GameBoard` in `game-table.tsx`, so also in the replay) and
  `src/game/table/surface-drawing.ts` (pure geometry and markup after
  `arkan.js`). The playing area is the battlefields' column; a strip counts
  only where it stands in that column (it overlaps at least half its width) -
  until prompt 38 the strips of the landscape layout stand beside the
  battlefields, so there the board spans the battlefields alone. The board:
  6 px from the screen's sides, 2 px inside the area's ends; frame
  `clamp(10, 2.2 % of the shorter side, 18)` px; circle radius
  `min(46 % of the width, 44 % of the height)`; no circle below a radius of
  48 px. Three layers, each its own compositor layer (`will-change`): the
  desk (`data-surface="desk"`, one SVG 1:1 over the game board: wood grain,
  plank joints, vignette), drawn only when the **screen's** size changes - a
  region that grows with a question never recomputes its full-screen grain;
  the board (`data-surface="board"`, an SVG at the board's corner: frame,
  brass, leather, circle, centre line, emblem, corner plates; its shadow
  reaches out of it), drawn only when the **playing area's** size or place
  changes (layout key `data-board`); and the rune ring
  (`data-surface="ring"`, a square around the circle, drawn with the board)
  that table.css turns (`table-ring-turn`, 360 s) and lets glimmer
  (`table-ring-glimmer`, opacity 0.75-1 as the mockup's `glimmen`, 4 s; 0.85
  still); both stop under less motion. Desk and board have their own ids
  (the frame repeats the desk's grain filter). Each drawing is one User
  Timing measure
  `openmana:table-surface`. Colours from tokens only: grain via `feFlood` with
  a token (the mockup's colour matrices work in linear light, so their grain
  is lighter than its numbers read: wood grain = `--table-wood-frame` mixed
  half with `--table-gold-light`, leather grain = `--foreground` at 14 %),
  depth mixed with black. Regions: header a panel band with a gold hairline,
  strips, stack/combat and the decision on `--table-panel` at 90 %, region
  lines `--table-gold-line`; on the board the caption strips (when not empty)
  and the battlefields' words ("Keine Kreaturen" …) on the same panel tone.
- **Deliberate deviations from the mockup (prompt 37):** the strips cover the
  board's top and bottom frame with their panel tone (they carry text until
  prompt 39 makes them medallions); the centre line's emblem lies under the
  stack bar in `hoch` while the stack has items (as §3.1 intends); the emblem
  does not glimmer (only the ring moves); the row separators of the
  battlefields stay visible across the board until prompt 40.

### 4.2 Header bar (prompt 39)
- Mockup: `.kopf`, `.marke` (emblem + Cinzel wordmark in gold), `.kopf-nav`,
  `.zug-info`.
- In the app: emblem and wordmark (compact in `hoch`); "Zonen ansehen",
  "Spielverlauf ansehen" and the help as symbol buttons (with words in
  `breit`); the turn line "Zug N · Dein Zug" / "Forge-KI am Zug"; the status
  badge (replay, conceding, Forge computes) stays visible; the menu as today
  (a Sheet, conceding confirmed). The mockup's "Einstellungen"/"Friedhof"/
  "Exil" buttons are not taken over as such: zones open through the zone
  piles and "Zonen ansehen".
- Region `header` "Spielstand".

### 4.3 Life medallion (prompt 39)
- Mockup: SVG `#medaillon` (gold ring with ticks, four gems, a dark inner
  disc), `.medaillon`, `.leben` (Cinzel number), `.medaillon-band`
  (name band), `.am-zug` (glow when it is the player's turn).
- Data: the player's `life` from Forge (`GamePlayer`); name band "Du" or
  Forge's name for the AI.
- The medallion **is** the player's control (`GamePlayerButton` semantics,
  `data-slot="game-player"`, `data-player`, `data-mark`), at least 44 px on
  touch screens, named for screen readers. As a target it is usable/chosen by
  `data-mark` and red while a spell targets the player (`data-stack-target`,
  a crosshair as today).
- Anchors: `title="Lebenspunkte"` with the number in `.tabular-nums`.

### 4.4 Zone piles (prompt 39)
- Mockup: `.zone`, `.zone-karte.bibliothek` (own back, stacked shadow),
  `.zone-karte.friedhof` (top card), `.zone-zahl`, `.zone-name`.
- Library: OpenMana's back, Forge's count. Graveyard: its top card where
  Forge shows it, else an empty place; the count. Exile and command zone:
  compact counters. Tapping a pile opens the existing `ZoneSheet` for that
  player and zone - looking only, nothing sent.
- Anchors: the zone titles "Hand", "Bibliothek", "Friedhof", "Exil",
  "Kommandozone".

### 4.5 Card back (prompt 39)
- Mockup: SVG `#rueckseite` - night-blue gradient, gold frame, the emblem.
  OpenMana's own back; never Wizards' back. Used for hidden cards (the AI's
  hand, face-down permanents, the library); a `HiddenCard` stays a back and
  a count, never told apart.

### 4.6 Opponent's hand (prompt 39)
- Mockup: `.rueckseiten` (overlapping backs) with "N Hand". Cards Forge
  reveals stay an operable toolbar as today, in the table's style.

### 4.7 Card on the battlefield: plaque and fact chips (prompt 40)
- Mockup: `.reihe` (row sizing with `--u`/`--c`), `.karte`, `.karte-bild`,
  `.werte`, `.werte.treue`, `.stapel-zahl`, `.karte.getappt`; `vorlage.js`
  `karte()`, `reihe()`.
- The **whole picture** (`CardPicture`, never cropped, blurred, darkened or
  colour-shifted - no CSS or SVG filter on a card picture). The caption strip
  below the picture goes; cards grow by its height.
- **Plaque** (`.werte`): Forge's power/toughness as Forge sends it ("2/2",
  "*/1+*" only if Forge sends that), or loyalty with a shield symbol, on the
  card's **printed value box at the bottom right**: right ≈ 3 % of the card
  width, bottom ≈ 4.3 % of its height, at least ≈ 27 % of its width wide;
  Cinzel, `--foreground` on `--table-plaque` with a gold rim (loyalty: a
  `--table-mana` rim). It **never covers the artist and copyright line**
  below the box; a tapped card keeps the plaque upright at the turned box's
  place, clear of the copyright edge. Readable from a card width of 44 px;
  below that the values live only in the title, the screen-reader name and
  the card view. Without a picture (the card's text stands in) the plaque and
  chips stay readable. Values Forge marks as changed may be highlighted;
  nothing is computed.
- **Fact chips:** damage ("N Schaden"), counters (German names), summoning
  sickness (hourglass, "Einsatzverzögerung"), attacking, blocking, Forge's
  refusal reason, "Quelle", "Ziel", the block target - small chips at the
  card's top edge **outside the picture** (in the row's gap). Only short
  words and numbers from Forge, no computed values. The chip area keeps
  `data-slot="game-card-caption"`. The full facts stay in the card's `title`,
  its screen-reader name and the card view.
- **Tapped:** the quarter turn stays, no darkening (prompt 44 may animate it).
- **Attachments** stay with their host (`GameCardGroup`).
- **Row size:** card width = min(the row's height, the free width / number of
  cards, an upper bound), at least 44 px wide on touch screens (24 px target
  minimum always); only below that the row scrolls sideways. Tapped cards and
  piles count (`--u`: width in card widths, tapped ≈ 1.4, a pile + 0.12 per
  card; `--c`: number of places).

### 4.8 Pile count (prompt 40)
- Mockup: `.stapel-zahl`, `.karte-flaeche --n`. Several equal cards lie
  offset behind each other; "×N" as a badge **above** the pile, never on the
  front card. The pile logic of `table-model.ts` is unchanged; the card view
  steps through the pile as today.

### 4.9 Marks (prompt 40, arrows in 43)
`data-mark` (`usable`, `selected`, `target`) and the combat facts stay the
truth; only their look changes. Marks are frames and glows **around** the
picture, never on it.

| State (source) | Look | Token |
|---|---|---|
| usable - Forge offers something (`data-mark="usable"`) | gold frame with a soft glow (was: dashed) | `--primary` |
| chosen (`data-mark="selected"`) | strong light frame, thicker | `--foreground` or `--table-gold-light` |
| target of something on the stack (`data-mark="target"`, `data-stack-target`) | red frame with a gentle pulse (glow layer whose opacity pulses; still under less motion) | `--table-danger` |
| attacking (combat) | amber frame and glow, moved towards the opponent (`transform`) | `--table-attack` |
| blocking (combat) | its own frame | `--table-mana` (proposal; prompt 40 decides and documents) |

Usable/chosen frames take precedence where several apply; the words
("Ziel", "greift an", "blockt") stay in chips and names, so no state is told
by colour alone (WCAG 1.4.1). Contrast: every mark reaches 3:1 on the board,
the desk and the panels (`design-tokens.test.ts`).

### 4.10 Fanned hand (prompt 42)
- Mockup: `.hand`, `.hand-karte` (`--hw` card width from the hand's height,
  overlap so every card fits, rotation per card `d × min(3.2°, 24°/n)`, an
  arc `d² × min(1.1 %, 8 %/n)`, `transform-origin` at the bottom centre, the
  hand sinks a little below the edge), `.gehoben` (lifted: fully visible,
  upright, scaled ≈ 1.12, above the strips - clipped only at the bottom),
  `vorlage.js` thumb logic.
- Lifting: the mouse on hover; touch and pen by laying a finger on the hand
  and swiping sideways - the card whose **resting position** is nearest to
  the finger rises (the choice does not jump while the lifted card moves).
  Keyboard focus lifts the focused card too.
- Gestures: release without moving = a tap on the lifted card (the primary
  activation as today); release after swiping triggers **nothing**; a long
  press without swiping opens the full card view with its keywords. In the
  hand the swipe replaces sideways scrolling (`touch-action` accordingly);
  battlefield rows keep scrolling sideways. `use-card-press.ts` is extended,
  not duplicated; every guard stays.
- The toolbar "Deine Hand: N Karten" stays (arrows, Home, End, Enter); every
  card at least 24 px visible and reachable, also with 10+ cards at 360 px.
- No drag and drop onto the battlefield; when a tap plays at once does not
  change. Replaces the Anvil lesson "never fanned" (prompt 13) deliberately.

### 4.11 Zauberchronik (prompt 41)
- Mockup: `.tafel` + `.chronik`, `.chronik-eintrag` (`.oben` highlighted),
  `.chronik-name`, `.chronik-text` with a dot, `.chronik-nr`, `.tafel-zahl`.
- Region `center` ("Stapel und Kampf"). Title "Zauberchronik" with the count.
  Entries in Forge's order (top first, highlighted): a small card (whole
  picture), its name, Forge's text or target, a dot for its controller (you:
  `--table-mana`, Forge-KI: `--table-danger`), its position. Tapping or a
  long press opens the card view - never sends.
- In `hoch` a horizontal bar (title stacked, entries side by side, scrolling
  sideways).
- Combat: while there is combat, compact lines "attacker → defender,
  blockers" from `CombatView` below the entries.
- Empty stays honest ("Der Stapel ist leer, niemand kämpft.").
- Anchors: `data-stack-item`, `data-stack-card`, `data-stack-target`,
  `data-combat-attacker`.

### 4.12 Panel (prompt 41)
- Mockup: `.tafel` - `--table-panel` surface (darkening downwards), a gold
  line (`--table-gold-line`), corner ornaments, inner shadow; title in
  Cinzel `--table-gold-light`. Reused by the chronicle and the Phasen-Tafel.

### 4.13 Phasen-Tafel and decision (prompt 41)
- Mockup: `.phasen`, `.phase` (`.vorbei`, `.laufend`), `.schritte`,
  `.schritt.aktiv` (gold pill with a diamond), `vorlage.js` `PHASEN`.
- Region `decision`. Title "Phasen" with "Zug N". The five groups of
  `TURN_PHASES` (`turn-model.ts`, German names `TURN_PHASE_LABELS`) with a
  symbol each; only the current group unfolds its steps (Forge's
  `PhaseType`, full names `PHASE_LABELS`; short step names as in the mockup
  may be added, the full name stays in the title); past steps muted, the
  current step gold. First-strike damage only when Forge reports the step.
- Anchors `data-slot="phase-track*"`, `data-phase`, `data-state`
  (on the new elements where needed). Prompt 41 decides whether the panel
  stays `aria-hidden` (the header says the step in words) and avoids double
  reading.
- Forge's question, its parts and buttons stand below the phases (§3.3).
  `DecisionPanel` is not changed in substance - only room, arrangement and
  look; splitting it into files is allowed.

### 4.14 Main button and action bar (prompt 41)
- Mockup: `.weiter` (large, gold gradient, Cinzel, a gloss sweeping across),
  `.weiter-hinweis` ("Du hast Priorität"), `.aktionsleiste`,
  `.phasen-kompakt`.
- The **one** button that moves the round on is large and golden: `pass`
  ("Weiter" / "Verrechnen lassen") and the confirmations of attack, block
  and the mulligan choice. Text `--primary-foreground` on gold. The other
  buttons in the panel's style, clearly secondary. Labels unchanged from the
  existing labels; `SendButton`, arming, confirmations and `data-meaning`
  unchanged. The gloss stops under less motion. Never an automatic press.
- `hoch`: the action bar at the bottom - left the compact phases (five group
  symbols, the current one gold) and "Gruppe · Schritt", right the main
  button; grows upwards for a question; thumb reach; safe-area inset.

### 4.15 Arrows (prompt 43)
- Mockup: `vorlage.js` `pfeil()`, `.pfeil-glut`, `.pfeil-linie`, markers
  `#pfeilspitze`, `#pfeilspitze-angriff`.
- `TableArrows`: one `aria-hidden` SVG over the board, no pointer events;
  endpoints from element rectangles (`data-stack-item`, `data-card`,
  `data-player`, `data-combat-attacker`), redrawn on state, layout size, row
  scroll and the decision opening or closing - batched per animation frame.
- Target arrows (`--table-danger`): from the chronicle entry to each target,
  muted for all entries, strong for the top one; they end **beside** the
  target card, never on its picture; player targets end at the medallion.
  Targets out of sight (in a zone, a scrolled row) end at the row's or
  zone's edge or get no arrow - documented.
- Attack arrows (`--table-attack`): attacker → defending player, planeswalker
  or battle, from `combat` and, while declaring, from what Forge reports.
  Block arrows: blocker → attacker (`--table-mana`, proposal). Several arrows
  with slightly different arcs.
- Pure presentation of facts that are already in words (chronicle, combat
  lines, chips); no derivations ("who could block"); never in the way of an
  input.

## 5. Tokens

Defined once in `:root` of `src/index.css` (prompt 36), mapped for Tailwind
(`bg-table-panel`, `text-table-gold-light`, `border-table-danger` …).
Surface tokens are their **lightest** tone, the binding case for light text
and marks; the table darkens them towards the edges.

| Token | Value | Use |
|---|---|---|
| `--primary` (existing) | `oklch(0.8 0.12 80)` | gold: usable marks, the main button's middle tone, focus |
| `--primary-foreground` (existing) | `oklch(0.2 0.035 60)` | text on gold (main button, current step) |
| `--table-gold-light` | `oklch(0.92 0.08 88)` | highlights, panel titles, the chosen mark, the gold gradient's top |
| `--table-gold-dark` | `oklch(0.55 0.1 70)` | the gold gradient's bottom (decoration, never text) |
| `--table-gold-line` | `oklch(0.8 0.12 80 / 38%)` | hairlines of panels, strips, header, pile counts (decoration) |
| `--table-mana` | `oklch(0.78 0.13 235)` | mana blue: loyalty rim, your entries, blocking (proposal), the centre rune's glow |
| `--table-danger` | `oklch(0.68 0.2 35)` | danger/target red: target marks and arrows, the opponent's entries |
| `--table-attack` | `oklch(0.75 0.17 50)` | attack amber: attacking cards and attack arrows |
| `--table-wood` | `oklch(0.19 0.022 56)` | the desk |
| `--table-wood-frame` | `oklch(0.33 0.052 58)` | the carved frame (lightest tone) |
| `--table-leather` | `oklch(0.28 0.045 261)` | the board's leather (its lit centre; darker towards the frame) |
| `--table-panel` | `oklch(0.22 0.025 262)` | panels: chronicle, Phasen-Tafel, action bar (top tone; darker downwards) |
| `--table-plaque` | `oklch(0.28 0.027 81)` | the value plaque (top tone) |

Checked by `src/app/design-tokens.test.ts` (WCAG 2.2): text 4.5:1 - e.g.
`--foreground` on `--table-panel` 15.2:1, `--muted-foreground` on
`--table-leather` 6.6:1, `--foreground` on `--table-plaque` 12.8:1,
`--primary-foreground` on `--table-gold-light` 14.4:1; marks 3:1 on leather,
wood frame, panel and plaque - the weakest is `--table-danger` on
`--table-wood-frame` with 3.95:1. Depth (shadows, grain, highlights) uses
black or white with transparency or tones mixed from these tokens; a new
colour **meaning** gets a token and a contrast test. Fonts: Cinzel
(headings, numbers on the table) and Inter, already bundled (Fontsource) -
not the mockup's copies.

## 6. Accessibility

- German texts; regions keep their names; card rows stay toolbars (one Tab
  stop, arrows, Home, End).
- Touch targets ≥ 44 px (medallions, piles, header buttons, main button);
  card targets ≥ 24 px.
- WCAG AA contrast from the tokens (§5); states never by colour alone.
- axe-core without serious or critical findings on every scene and size.
- Decoration (surface, arrows, ornaments, the emblem) is `aria-hidden`.

## 7. Not taken over from the mockup

- Props on the desk (books, candles, potions, scroll, astrolabe), the
  crystals and the vines (`.deko`, `#kerze-symbol`, `#ranke`) - rejected as
  too flat.
- The variants "Astrolabium", "Spielmatte" and "Runenkreis"
  (`tischflaeche.js`) and the stone floor (`.tisch-grund`): only the wooden
  desk (`arkan.js`, "Holztisch") is built. Painted pictures were rejected:
  everything is CSS/SVG.
- All example data: `SZENEN` (cards, life totals, counts, turn 7/14,
  chronicle texts), `karten.js`, the mockup menu (`.vorlage-menue`), the
  name "Gegner" on the band.
- The mockup's own colour literals where a token exists, its root font size
  per layout (§3), its global `* { animation: none }` (replaced by the scoped
  less-motion blocks in table.css), and its fonts folder.
- Its animations of other properties than transform/opacity: the target
  pulse on `box-shadow` (`zielpuls`) and the flowing arrow on
  `stroke-dashoffset` (`fliessen`); see §8 for the allowed equivalents.

## 8. Motion

Arena is the inspiration, the style is OpenMana's own; no Arena assets or
layouts (Bible §13).

1. **The state is usable at once.** Animations run over the new state; a
   further state cancels them or jumps them to their end. No queue that
   holds Forge or the player up; a click during an animation hits the
   control at its final place.
2. **Only `transform` and `opacity`** (also `translate`, `rotate`, `scale`).
   A glow that pulses is a layer (e.g. `::after` with the shadow) whose
   opacity changes; an arrow that "flows" is two dash phases cross-fading in
   opacity, or a highlight moved with `transform`.
3. **Less motion:** the device (`prefers-reduced-motion`) or the player
   (Settings → Barrierefreiheit, `<html data-reduced-motion>`,
   `src/app/motion.ts`) - then nothing moves and states change at once.
   table.css ends with two blocks that switch every animation and transition
   under `[data-slot="game-board"]` off for both; components use the
   `motion-reduce:` variant on Tailwind motion classes; code that animates
   itself (`element.animate`) asks `src/app/motion.ts`. No inline animation
   styles, no SVG (SMIL) animation. `src/app/motion.test.ts` checks all of
   this for `src/game/table/**` and table.css (scope, properties, keyframes,
   both less-motion blocks).
4. **Presentation, not narration:** a card gliding from its old to its new
   place (same `data-card` id, FLIP, prompt 44) makes no text, no history
   entry and no rule; effects that follow Forge's events (`DAMAGE`,
   `STACK_ADD` …) use only event kinds Forge actually sends.
5. Continuous motion is few and slow: the rune ring (≈ 6 min per turn) and
   its glimmer, the main button's gloss, the target pulse, the arrows' flow.
6. Replay: stepping animates, jumping over several steps does not.

## 9. Performance budget

- The table surface is drawn **only when a size changes**; expensive SVG
  filters never per state.
- At most one layout measurement per state for arrows and travelling cards,
  batched per animation frame; no layout animations.
- Chrome with 4× CPU throttling at 412 × 915: no long task over **200 ms**
  caused by the table at a change of turn (and 20 state changes of a
  recorded scene for the surface, prompt 37). Each prompt reports its
  measurement.
- No growing listeners or animation leftovers after ten turns (prompt 45
  measures memory).

## 10. Where the code lives

- `src/game/table/` - the table's components (surface, medallion, piles,
  chronicle, panel, arrows …), `table-layout.ts`, `use-table-layout.ts`,
  and `table.css` (the one stylesheet; imported by the table from prompt 37
  on).
- `src/components/ui/game-*.tsx` - the shadcn-built table primitives
  (`GameBoard`, `GameCard`, `GameDecision`, `GamePlayer`, `PhaseTrack`) keep
  their slots and may be restyled or replaced step by step; the regions'
  and slots' anchors stay.
- Tokens and variants: `src/index.css`.

## 11. Verification per prompt

`npm run check` complete (schemas, typecheck, oxlint, Vitest, end-to-end in
Chrome with the real engine, PWA suite); the replay works read-only; the
image comparison with the mockup at the eight sizes plus the Fold sizes in
Seafile `/repo/openmana/design/spieltisch-umsetzung/<prompt>/` (never
committed), with the deliberate deviations named; the performance
measurement (§9); `scripts/readiness/matches.ts` after changes to the
table's interaction (Verification in `AGENTS.md`).

## 12. Anchors that stay

From the shared rules of the series - end-to-end section 12,
`scripts/readiness/player.ts`, `scripts/deploy/live-check.ts` and
`scripts/regression/evidence.ts` hold on to them:

- the eight regions (`data-slot="game-board-area"`, `data-area`, the
  `aria-label`s "Spielstand", "Forge-KI", "Spielfeld der Forge-KI", "Stapel
  und Kampf", "Dein Spielfeld", "Du", "Entscheidung", "Deine Hand");
- the `data-slot` names `game-board`, `game-card`, `game-card-caption`,
  `game-decision*`, `phase-track*`, `game-player`;
- `data-mark`, `data-tapped`, `data-card`, `data-player`,
  `data-stack-target`, `data-meaning`;
- `title="Lebenspunkte"` and the zone titles;
- the toolbars' names.

The regression evidence stays complete (8 sizes × 38 scenes, at least 600
axe checks).

## 13. The series

| Prompt | Builds | Main sections |
|---|---|---|
| 36 | this specification, the rules, tokens and layout classes - nothing visible | §3, §5, §8 |
| 37 | the table surface: wooden desk and board, rune ring, centre line | §4.1 |
| 38 | the three layouts on `GameBoard`, Sheets by layout, the decision's growth | §3 |
| 39 | header, strips: medallions, zone piles, opponent's hand, card back | §4.2–4.6 |
| 40 | cards on the battlefield: plaque, fact chips, piles, marks, row sizes | §4.7–4.9 |
| 41 | Zauberchronik, panels, Phasen-Tafel with the decision, main button, action bar | §4.11–4.14 |
| 42 | the fanned hand: lifting by mouse and thumb, long press | §4.10 |
| 43 | target, attack and block arrows | §4.15 |
| 44 | animations: travelling cards, tapping, damage, life, stack, phases | §8 |
| 45 | review in every layout, polish, deviations, documentation, handover to the project owner | all |

After the series (not part of it): the project owner checks the table on the
Fold (closed, open upright, open turned) and inside ORYX once he has allowed
a push.

### State

- 2026-10-10, prompt 36: specification written; tokens, layout classes
  (`hoch:`/`quadrat:`/`breit:`, `useTableLayout`) and the table's motion and
  stylesheet checks in place; `table.css` exists but is not imported; the
  table looks as before.
- 2026-10-10, prompt 37: the table surface (§4.1) in game and replay -
  wooden desk, board with frame, brass corners, leather, rune ring (turning,
  glimmering), centre line with diamonds and emblem; regions on panel tones;
  table.css imported. Regions still where they were (prompt 38).
