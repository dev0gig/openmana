# Spieltisch — the redesigned game table (specification)

> Binding specification of the redesigned game table, built in prompts
> **36–45** (project owner, 2026-10-10; the series is complete since prompt
> 45, 2026-10-11). Written in prompt 36 before anything on the table changed,
> filled in by every prompt of the series ("Built" sections) and reviewed as
> a whole in prompt 45 (§14: deviations from the mockup). It describes the
> table as it is built; a later change of the table keeps it up to date.
> Rules that follow from it are in [`AGENTS.md`](../../AGENTS.md) (Game
> Table, Card Interaction, Preferences rules) and
> [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) §9.
>
> - **Mockup (the former visual target, kept as a reference):**
>   [`spieltisch-vorlage/`](spieltisch-vorlage/) (state of commit `f54fd38`,
>   approved in four rounds). Superseded by the built table since prompt 45;
>   view it by serving the folder (`python3 -m http.server` inside it; stop
>   the server afterwards). It has **no game logic**: its cards, values,
>   names and texts are examples. In the game everything comes from Forge's
>   state.
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
blocker blocks. The table moves - cards travel, tapped cards turn - but never makes the player wait, and stands still when
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
  Sheets (zones, history, help, menu), the card view (a full-screen
  `Dialog` since prompt 47, §4.16), Dialogs and AlertDialogs
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
`src/game/table/table-layout.test.tsx`. Since prompt 38 `GameBoard` and
the Sheets use them (§3.4); nothing on the table is arranged by
orientation any more (`portrait:`/`landscape:` and `useLandscape()` are
gone). Do not change the root font size per layout as the mockup does (it
would resize the shadcn Sheets and Dialogs too); scale inside the board
(container units or a custom property on `[data-slot="game-board"]`).

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
| Fold closed / open / open turned | 480 × 1040, 870 × 960, 960 × 870 | `hoch`, `quadrat`, `quadrat` (since prompt 38 checked in every scene too, `tableFoldSizes`, and required by the regression evidence) |

### 3.1 The eight regions

`GameBoard` keeps its eight regions (`data-slot="game-board-area"`,
`data-area`, their `aria-label`s). The visible titles may change; the
accessible names do not. Their order in the page (prompt 38) is the order of
`hoch` - header, opponent, opponent's battlefield, stack and combat, your
battlefield, you, hand, decision -, the reading and focus order of every
layout.

| `data-area` | `aria-label` | Becomes | `breit` | `quadrat` | `hoch` |
|---|---|---|---|---|---|
| `header` | "Spielstand" | header bar (§4.2) | top, full width | top, full width | top, compact |
| `opponent` | "Forge-KI" | opponent's strip (§4.3–4.6) | middle column, above their field | left column, top | below the header |
| `opponent-field` | "Spielfeld der Forge-KI" | opponent's battlefield (§4.7) | middle column | left column | full width |
| `center` | "Stapel und Kampf" | **Zauberchronik** (§4.11) | left column, full height | right column, top | a bar between the battlefields |
| `field` | "Dein Spielfeld" | your battlefield | middle column | left column | full width |
| `me` | "Du" | your strip | middle column, below your field | left column | above the hand |
| `decision` | "Entscheidung" | **Phasen-Tafel** with Forge's question and the main button (§4.12–4.14) | right column, full height | right column, from the centre line to the bottom (from the opponent's battlefield while `expanded`) | **action bar at the very bottom**, below the hand; grows upwards for questions |
| `hand` | "Deine Hand" (name of its toolbar: "Deine Hand: N Karten") | fanned hand (§4.10) | bottom of the middle column, between the side columns | left column, bottom | full width, above the action bar |

The centre line between the battlefields is part of the table surface
(§4.1), not a region; the grid may keep a thin row for it (`breit`,
`quadrat`). In `hoch` the Zauberchronik bar takes its place.

### 3.2 Grid plans (from the mockup's `tisch.css`; settled in prompt 38, see "Built")

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
  it). **Prompt 38 decided otherwise** (its task: "short: wie heute"): see
  "Built".

**Built (prompt 38)** - `GameBoard` (`src/components/ui/game-board.tsx`),
the classes without a variant are `hoch` (also the fallback of a browser
that answers none of the three queries):

| Layout | Columns | Rows | Areas |
|---|---|---|---|
| `hoch` | 1 | `auto auto 1fr auto 1fr auto auto auto` | header · opponent · opponent-field · center · field · me · hand · decision |
| `quadrat` | `minmax(0,1fr) clamp(15rem,30vw,20rem)` | `auto auto 1fr 1.5rem 1fr auto auto` | header across; left opponent, opponent-field, (centre line), field, me, hand; right `center` next to the opponent's half (strip and battlefield), `decision` from the centre line to the bottom |
| `quadrat`, `expanded` | as above | as above | `center` only next to the opponent's strip (capped `clamp(3rem,10dvh,5rem)`, scrolls), `decision` from the opponent's battlefield to the bottom |
| `breit` | `clamp(12rem,20vw,18rem) minmax(0,1fr) clamp(15rem,22vw,18rem)` | `auto auto 1fr 1.5rem 1fr auto auto` | header across; left `center`, right `decision`, both from the header to the bottom; middle opponent, opponent-field, (centre line), field, me, hand |
| `breit` + `short` | `minmax(0,1fr) minmax(15rem,24rem)` | `auto 1fr 1fr auto` | the side column of prompts 13–24: header \| opponent, opponent-field \| center, field \| decision, hand \| me; `expanded`: the decision takes both middle rows, `center` is hidden |

- The centre line row (1.5 rem, an empty grid cell) separates the halves in
  `quadrat` and `breit`. The table surface puts its centre line, the circle
  and the emblem on the **middle of the gap between the battlefields**
  (`playingArea().middle`, prompt 38), not on the board's centre, so they
  stay there when the strips are not equally high (the opponent's strip
  wraps more often). In `hoch` that gap is the stack bar.
- Widths deviate from the mockup on purpose: the decision column keeps
  today's minimum of 15 rem (240 px) in `quadrat` and `breit`, because
  Forge's questions - lists, forms, card rows, amounts - must stay operable
  with 44 px controls (the mockup's 11.5–14 rem have no room for them). The
  chronicle column of `breit` is 12–18 rem. Both side columns run from the
  header to the bottom (the mockup lets its hand row span all three columns
  under them): the decision gets the full height, the hand stands between
  the columns, as the region table says.
- Heights stay today's: strips `auto` (since prompt 39 the medallion's height,
  a second line of chips only for longer facts),
  hand `clamp(6rem, 14dvh, 9rem)` in every layout (prompt 42 took the
  mockup's for `quadrat` and `breit`: §4.10 "Built"). `env(safe-area-inset-bottom)` is not added: the app's viewport
  has no `viewport-fit=cover`, so the inset is always 0.
- `short` + `breit` keeps the arrangement of prompts 13–24 (assumption from
  the task's "wie heute"): in a phone turned sideways (915 × 412) it leaves
  the battlefields about 130 px each, three columns would leave about 100.
  Prompt 41 kept it: the Zauberchronik and the Phasen-Tafel fit its side
  column as slim panels (the phases always folded to one line there).

### 3.3 Room for Forge's questions

The mockup has no room for Forge's questions; the table must. The decision
region keeps its growth (`GameBoard decision`: `compact | tall | expanded`,
measured by `decisionNeedsRoom` in `decision-panel.tsx` and, for words that
do not fit, by `GameTable` once per set of open questions):

- `breit`/`quadrat`: the question, its parts and buttons stand in the
  Phasen-Tafel below the phases (prompt 41); a question that needs room folds
  the phases to one line (group and step) and scrolls inside the panel; the
  answer buttons stick to its bottom.
- `hoch`: the action bar shows the compact phases and the main button; for a
  question it grows **upwards** - `tall` up to ≈ 28 %, `expanded` up to ≈
  36 % of the height, as today - and the battlefields keep at least one row
  of cards (end-to-end: 80 px, 64 px while `expanded`).
- **The spell being cast, large (2026-10-14, "Karte beim Bezahlen groß
  zeigen", variant A):** while its targets are chosen and its cost is paid a
  spell lies in no zone of the state (Forge's stack zone is not sent, the
  stack is still empty), so the step's source card - the question's `card` -
  stands large when `locateCard` does not find it (`GameDecisionSource`
  `data-size`, `GameDecisionSpotlight`, `src/components/ui/game-decision.tsx`):
  in the Phasen-Tafel (`quadrat`, `breit`) the whole card on top
  (`card`: `clamp(11rem,28dvh,15rem)` high, about 8-11 rem wide inside the
  15-20 rem column), Forge's words, "Noch zu zahlen" and the pool below; in
  the action bar (`hoch`) a card of the hand's height (`hand`:
  `clamp(6rem,14dvh,9rem)`) on the left, the words and the cost beside it,
  Forge's buttons in the bar below; in a low window (`short:`, i.e. `breit` +
  `short`) the thumbnail beside the words as before. Sized by its height, the
  card is always whole; a tap opens the card view. It does not fit the compact
  action bar, so the measurement makes the region `tall` (`expanded` while the
  centre is quiet) - the limits above are unchanged. An ability's source the
  table shows keeps its "Quelle" chip there and the thumbnail.
- **The step's choices ride on the answers' bar (2026-10-15):** the players
  Forge would take, the pool's colours and life instead of mana are a row on
  top of Forge's sticky bar (`GameDecisionBarChoices`), not part of the
  scrolling content. Beside the large card Forge's long words (the spell's
  text) had pushed them out of the window (end-to-end `target-both` on
  360×740, 690×829, 829×690 since `267174a`); now they stay in reach with
  OK/Abbrechen in every form.
- Two rows per battlefield stay a measured threshold (`TWO_ROWS_MIN_HEIGHT`,
  176 px; checked in prompt 38 for the new grid and kept). Creatures lie next to
  the middle.

**Built (prompt 38)** - what the three states do in each layout:

| | `compact` | `tall` (words that do not fit) | `expanded` (a list, a form, cards outside the table, or words while stack and combat are empty) |
|---|---|---|---|
| `hoch` | action bar up to `clamp(7rem,18dvh,11rem)`; stack bar up to `clamp(5rem,15dvh,8rem)` | action bar up to `clamp(9rem,28dvh,20rem)`; the stack stays (the player may answer it) | action bar up to `clamp(9rem,36dvh,26rem)`; stack bar down to `clamp(3rem,10dvh,5rem)` |
| `quadrat` | right column from the centre line down | the same (its column is tall already; words scroll inside) | the decision from the opponent's battlefield down, the chronicle a small strip next to the opponent's strip |
| `breit` | right column, full height | the same | the same (nothing to gain) |
| `breit` + `short` | side column next to your battlefield | the same | both middle rows of the side column; stack and combat step aside |

Since prompt 41 the decision region holds the Phasen-Tafel (quadrat, breit) or
the action bar (hoch), §4.13–4.14: whenever the region is `tall` or
`expanded` the panel folds its phases to one line (`data-folded`), in a low
`breit` window always; the action bar always shows the compact phases. The
phases take part in the measurement - a priority whose words do not fit next
to the full list makes the region `tall` (or `expanded` while stack and combat
are empty) and folds them, as the task asks ("bei großen Fragen klappen die
Phasen auf eine Zeile zu").

The measurement is unchanged: a question that would not fit the compact
region once is `tall` (or `expanded` when the centre is quiet) until its set
of questions changes, so the region never flips back and forth - also not
when the window changes size meanwhile.

The battlefields' heights measured at the test sizes (scene `main-phase`,
prompt 38): `hoch` 164 px (small phone, one row each) to 283 px (Fold
closed); `quadrat` 206–404 px; `breit` 311 px (desktop) and 130 px in a low
window (one row). From 176 px two rows (creatures next to the middle) still
leave cards of at least about 80 px - the threshold stays. The end-to-end
test checks for every scene and size that a battlefield above 176 px shows
two rows with the creatures' row next to the middle, below one
(`checkTableArrangement`).

### 3.4 Sheets by layout (prompt 38)

The table's Sheets - zones, history, help, also the history after a game -
come from the **bottom in `hoch`** (thumb reach) and from the **right in
`quadrat` and `breit`** (`tableSheetSide`, `useTableSheetSide()` in
`src/game/table/`), no longer by orientation: the unfolded foldable upright
(870 × 960) gets them from the side. What their content arranges by side (the
history's kind and number) follows the Sheet's own `data-side`
(`in-data-[side=right]:`), so content and side always agree; a size change
while a Sheet is open only moves it. The card view was such a Sheet until
prompt 47; it is a full-screen `Dialog` now, arranged by the same layout
(§4.16).

## 4. Building blocks

Each block names its mockup source, where its data comes from today, the
anchors it keeps and the prompt that builds it.

### 4.1 Table surface (prompt 37) - removed in prompt 56

The drawn wooden table of prompt 37 (desk, board with carved frame, brass
corner plates, leather, the golden rune circle, centre line with diamonds and
emblem, drawn as SVG only when a size changed - `TableSurface`,
`surface-drawing.ts`, the tokens `--table-wood` and `--table-wood-frame`) was
the table's surface from prompt 37 to prompt 56 and is gone: the arena of
§4.1b is the only surface. Its history: `docs/implementation/37-table-surface.md`,
`38-table-layouts.md`; the mockup `docs/design/spieltisch-vorlage/` stays as
a reference for the pieces that remain (medallions, panels, card back).

### 4.1a A picture instead of the drawn table (2026-10-12) - removed in prompt 56

From 2026-10-12 to prompt 56 Settings → "Spieltisch" offered the drawn table,
three built-in pictures (Farbenrad, Planeswalker, Chip-Raster) and a picture
of the player's own (`display.tableBackground`, `display.tableBackgroundImage`).
All of it went with prompt 56; the two settings are retired (deleted by
migration 6, left out of a backup that is read; `RETIRED_SETTINGS` in
`src/storage/settings.ts`).

### 4.1b The arena: the stone surface as a shadow grid (prompt 53, series *stoneboard*)

The project owner wanted the table on a single, quiet surface instead of the
wooden desk with its carved board and rune circle (2026-10-12, replanned on
2026-10-14 after a preview round: Dropzone
`workflow/OPENMANA-STONEBOARD-MASTERPLAN.md`). The **binding template** is
`workflow/OPENMANA-ARENA-VORLAGE.html` in Dropzone (fassung "G+"; its
screenshots in Seafile `/repo/openmana/design/svg-arena/vorlage/`): a dark
blue-grey stone with a soft vignette, warm amber light above the opponent's
strip, cool blue below the hand, a fine grain and a few cracks (prompt 53);
golden swings along the hand and the opponent's strip, a centre line without
circle or emblem, ten small runes, two tendrils, light dust and a slightly
brighter playing area (prompt 54); reduced where room is short and still
(prompt 55). Nothing else: no sprites, no raster pictures, no rune circle, no
frames or corner plates.

**Technique - the shadow grid.** `ArenaSurface` (`src/game/table/arena-surface.tsx`)
was `TableSurface`'s branch for the choice `arena` (the default since prompt
53) and is the table's one surface since prompt 56: a child of the `GameBoard` grid that spans every track
(`grid-column: 1 / -1; grid-row: 1 / -1`) and is itself a grid with
`grid-template-columns: subgrid; grid-template-rows: subgrid` (table.css under
`[data-slot="table-surface"][data-background="arena"]`). Its pieces lie in the
cells of the regions they belong to, placed by the board's own named lines in
every layout and with an expanded decision: `ground` over the whole board,
`opponent` (`grid-area: opponent`), `field`
(`opponent-field-start / field-end` × `field-start / field-end`: both
battlefields with the centre line) and `hand` (`grid-area: hand`). **Nothing
measures anything**: no ResizeObserver, no `getBoundingClientRect`, no frames -
the browser lays the arena out with the board. Contract: no `contain` on the
arena (any containment - paint, layout, strict - makes Chrome 153 drop the
subgrid and lay the cells out in a grid of their own; measured in prompt 53);
every piece `min-width: 0; min-height: 0`, empty, with backgrounds or
absolutely positioned children only, so no `auto` track of the board is ever
widened - the end-to-end test lays the same scene over the arena, over the
drawn table and with the arena hidden and allows 1 CSS px (prompt 53: 0 px at
the five sizes ZH 480×1040, ZQ 1040×480, OH 870×960, OQ 960×870, D 1440×900,
main phase and an expanded decision). Decoration only: first in the board,
`z-index: 0`, `aria-hidden`, `pointer-events: none`, nothing focusable, no
props (memo: twenty new states leave it untouched).

**Built (prompt 53) - the ground:** the template's values as they are:
`linear-gradient(180deg, #1c2330, #161c27 45%, #131a26 55%, #0f1520)`, a
vignette `radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, #05070c)`,
warm light `radial-gradient(ellipse 70% 38% at 50% -4%, #d9913a55, #a86a2a22 35%, transparent 70%)`,
cool blue `radial-gradient(ellipse 80% 45% at 50% 104%, #3f7fd455, #2a579a22 40%, transparent 72%)`;
the grain one 260 px tile of SVG `feTurbulence` (fractal noise, tinted
`.55/.6/.7`) as a data: URL, `mix-blend-mode: soft-light` at 0.4; the cracks
one 900×700 tile (five dark lines, three with a light edge) at 0.35 - both
tiles rendered once by the browser as backgrounds (`--table-arena-grain`,
`--table-arena-cracks` set by the component). The arena keeps the template's
colour literals rather than tokens (`docs/DESIGN_SYSTEM.md` §9 allows the
table its own CSS). The other three cells are placed and empty until prompt
54. Note on the template: its light dust rule overrides its cracks rule
(`.ground::after` twice), so the approved screenshots of "G+" show no cracks
while the first approved preview "G" did; the plan names the cracks as part
of the ground, so they are built as their own layer - at 0.35 over dark stone
they are barely there.

**Built (prompt 54) - the six other parts:** the hand's swing (two curves in a
1000 × 120 box, `preserveAspectRatio='none'`, gold `#e2bd62` at 0.75 and a
twin `#c9a24a` at 0.35) as the hand cell's `::before` over a warm glow from
below (`radial-gradient(ellipse 60% 120% at 50% 110%, #d9913a33, transparent 60%)`);
the opponent's swing bending down (0.65) over the same glow from above; the
centre line as the playing-area cell's `::before` (`left/right 4%`, `top 50%`,
1 px gold fading to the sides, a 6 px glow, opacity 0.55 - on the row between
the battlefields in every layout); the island of light as that cell's
background (`radial-gradient(ellipse 62% 58% at 50% 50%, #ffffff07, transparent 72%)`,
no edge); ten runes (`ARENA_RUNES`, the rune ring's twelve glyphs, 10 px at
the hand, 9 px at the opponent, gold at 0.55 with a 2 px `drop-shadow` - the
arena's only runtime filter, `--table-arena-glow: none` takes it away) - the
hand's six at the template's places (9/14/19 % and 79/84/89 %, climbing
towards the middle), the opponent's four **not** at the template's ends but
at 34/39 % and 61/66 % between its chips, the medallion and its piles (the
real strip is full at both ends; measured at M5) and only on strips of 36 rem
or more (container query on the cell); two tendrils (`svg[data-arena-tendril]`,
the template's stem with two leaves, 0.5, `clamp(70px, 9vw, 120px)`, mirrored
on the right) at the hand's ends; the light dust as a fifth piece `dust` over
the whole board (the template's 70 points in a 1600 × 1000 box, `cover`,
0.9). Budget: 36 elements, 10 filters, no raster, no motion. With a fanned
hand of seven or more the outer cards lie over the hand's runes and tendrils
(as in the template's own picture); prompt 55 decides the reduction.

**Built (prompt 55) - less room, less decoration; nothing moves:** the hand
cell is a size container: narrower than 30 rem or lower than 7 rem (a small
phone upright, a phone turned, the foldable closed and turned - the short
grid) it keeps its swing and glow but shows no runes and no tendrils; a hand
too full to fan (`.table-hand[data-fan="row"]`, through `:has()` on the
board) hides them too. The opponent's strip shows its runes only from 48 rem
(tablets turned, desktops): below that its chips reach them in some states of
the game. Six dust points moved to the edges so that at 480 px (and 360-412)
none lies behind a hand card. Measured at the five sizes of the acceptance
and the twelve more of the matrix with the borders (18 sizes × 5 scenes,
hands of 0/1/7/20, DPR 1 and the devices'): regions and cards 0 px against
the drawn table and no surface, cells on their regions, no scroll, no
animation, no visible decoration on chips, piles or buttons; a fanned hand of
seven or more lies over the hand's runes and tendrils (by design, as in the
template). No breathing of the light: the arena is still by decision, and
the end-to-end test proves 0 animations plain, under the device's less motion
and under the player's.

**Setting and harness (prompts 53-56):** prompt 53 made the arena the default
of `display.tableBackground`; prompt 56 removed the setting with the old
backgrounds. The end-to-end harness (`src/test/table-harness.tsx`) keeps the
app's provider chain (StorageProvider → EngineSessionProvider →
PreferencesProvider; nothing boots); the arena is simply there.

**Removed (prompt 56):** the drawn table, the pictures, the player's own
picture and the setting - the arena is the only surface (`game-table.tsx`
renders `ArenaSurface` first in the board, `data-slot="table-surface"`,
`data-background="arena"` as the tests' marker); the list with paths is in
`docs/implementation/53-arena-grundlage-und-integration.md` ("Inventory"),
what went in `56-altbestand-entfernen-und-gesamtpruefung.md`.

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
- **Built (prompt 39):** emblem (`TableEmblem`, the symbol of `TableArt`;
  since prompt 57 the app's shared `Emblem`, `src/components/ui/emblem.tsx`,
  the same drawing and gold - the app's bars and start page show it too) and
  the gold Cinzel wordmark "OpenMana" (`.table-wordmark`, a logotype:
  `aria-hidden`; the page's `h1` names the game) - the wordmark from
  `quadrat` up (not in a low `breit` window), the emblem everywhere except a
  `hoch` screen narrower than 400 px; "Zonen ansehen" (`Layers`) and
  "Spielverlauf ansehen" (`ScrollText`) as `GameZoneButton`s with the words
  "Zonen" and "Spielverlauf" in `breit` (not low); the help button keeps the
  turn and step (Beginner Help Rules: help opens from the turn/phase area):
  first line the turn line `Zug N · Dein Zug` / `Zug N · Forge-KI am Zug`
  (`turnOwnerLabel`, the number in gold; before the first turn "Die
  Starthände werden gezogen"), second line the `PhaseTrack` and Forge's step
  (`span[id][title]`, the anchor the end-to-end test reads), the word "Hilfe"
  beside its symbol in `breit`; the status badge; the menu at the right end
  (a Sheet from the left as before, conceding confirmed). On a `hoch` screen
  narrower than 400 px the track gives way to the step's words (the track is
  their picture; prompt 41 brings the compact phases to the action bar).
  **Since prompt 41** the header has no track at all: the steps as a picture
  are the Phasen-Tafel's and the action bar's (§4.13–4.14); the help button
  keeps the turn line and Forge's step in words (`span[id][title]`) - the
  header is where screen readers hear the turn and the step.
- **Deviations (prompt 39):** the history keeps its name "Spielverlauf"
  (the mockup's "Protokoll"; the button's name is "Spielverlauf ansehen" and
  its words must be part of it); the turn line stands inside the help button
  in the header's middle, not at the right end next to the menu; the
  mockup's "Einstellungen" is not taken over (the menu leads there).

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
- **Built (prompt 39):** `MedallionFace` (`src/game/table/strip-parts.tsx`)
  inside `GamePlayer`/`GamePlayerButton` with the class `table-medallion`:
  the ring (`TableArt`'s symbol after `#medaillon`, colours from tokens), the
  life total in Cinzel (`--foreground`, 38 % of the medallion), the name band
  ("Du" / "Forge-KI" - the app's word for the AI seat, never Forge's player
  name; `--foreground` on `--table-plaque`). Size `--medallion`: 2.75 rem in
  `hoch` and a low `breit` window (44 px, the touch minimum), 3.5 rem in
  `quadrat`, 3.75 rem in `breit`. Whose turn it is: the ring glows
  (`data-active`, a drop shadow - static) and the medallion says ", am Zug"
  to screen readers. Marks: GamePlayer's inset outline (usable dashed gold,
  chosen solid light, a stack target double `--table-danger`) plus a glow in
  the mark's colour; a crosshair at the ring while a spell targets the
  player.

### 4.4 Zone piles (prompt 39)
- Mockup: `.zone`, `.zone-karte.bibliothek` (own back, stacked shadow),
  `.zone-karte.friedhof` (top card), `.zone-zahl`, `.zone-name`.
- Library: OpenMana's back, Forge's count. Graveyard: its top card where
  Forge shows it, else an empty place; the count. Exile and command zone:
  compact counters. Tapping a pile opens the zone view (`ZoneSheet`, §4.20)
  for that player and zone - looking only, nothing sent.
- Anchors: the zone titles "Hand", "Bibliothek", "Friedhof", "Exil",
  "Kommandozone".
- **Built (prompt 39):** a strip (`PlayerBar` in `game-table.tsx`, class
  `table-strip`) is a grid `1fr | medallion | 1fr` (the right column at
  least as wide as its piles): left the hand's count (`ZoneCount` "Hand", the
  opponent's hidden hand as backs before it), the AI profile, "Priorität" and
  "verloren" as chips; right the library (`ZonePile` "Bibliothek": OpenMana's
  back with a stacked edge and Forge's number - a count to read, not a
  control: Forge never shows the library), the graveyard (`ZonePile`
  "Friedhof": its top card - the last card of Forge's list, Forge's
  `Zone.add` appends - with a stacked edge, or a dashed empty place; a
  button), exile and, when Forge shows one, the command zone (`ZoneCounter`:
  a chip with the number, a button whose touch area is at least 44 px). A
  pile or counter opens `ZoneSheet` for that player and zone (looking only,
  focus back on the pile); its name says the zone, the count and the top
  card. Below, only when Forge reports any, a line of chips: the mana pool,
  the player's counters (poison …), commander tax and damage - the facts of
  the old strip, none left out ("am Zug" is the medallion's glow and the
  header's words). Pile size `--pile`: 1.4 rem (`hoch`, low `breit`),
  1.85 rem (`quadrat`), 2 rem (`breit`); the zone's name under the number
  only from `quadrat` up. Every count is an element with the zone's title
  whose text ends with the number (name first in the page, the number shown
  first by `row-reverse` - the mockup's "7 Hand"). The strips lie on the
  board (no panel tone of their own), their words on chips of the panel tone.
- **Deviations (prompt 39):** exile and the command zone are counters on the
  right next to the piles (the mockup shows "0 Exil" as words on the left of
  the player's strip only); the strips keep the medallion inside them instead
  of letting it reach into the battlefield (a small phone has no height to
  spare); facts the mockup does not show (profile, priority, lost, mana,
  counters, commander values) are chips.
- Mockup: SVG `#rueckseite` - night-blue gradient, gold frame, the emblem.
  OpenMana's own back; never Wizards' back. Used for hidden cards (the AI's
  hand, face-down permanents, the library); a `HiddenCard` stays a back and
  a count, never told apart.
- **Built (prompt 39):** `TableArt` (`src/game/table/table-art.tsx`) defines
  the emblem, the medallion ring and the back once per table as SVG symbols
  (fixed ids `table-art-*`, like the surface's; one table per page) with
  gold and night-blue gradients from the tokens; `TableCardBack` (slot
  `game-card-back`) draws the back with `<use>` for every hidden card on the
  table - the opponent's hand, face-down permanents and hidden commanders,
  hidden stack items, hidden cards of Forge's questions, the library pile.
  It replaces `GameCardBack` (removed). The card view never shows it as a
  card's picture.

### 4.6 Opponent's hand (prompt 39)
- Mockup: `.rueckseiten` (overlapping backs) with "N Hand". Cards Forge
  reveals stay an operable toolbar as today, in the table's style.
- **Built (prompt 39):** one `TableCardBack` per hidden card in the list "Hand
  der Forge-KI: N Karten", overlapping (1 rem each), clipped beyond 9 rem;
  where the strip is narrower than 28 rem (a phone, the low side column) the
  backs give way to the count beside them ("6 Hand"), as before. Revealed
  cards stay a toolbar of card buttons.

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
  card's top edge **outside the picture** (in the row's gap). Summoning
  sickness is the one made to stand out (project owner, 2026-10-14): its own
  violet (`--table-sick`), right after a pile's count, "verzögert" beside the
  hourglass on wide cards - never a frame around the card, never greyed. Only short
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
- **Built (prompt 40):** `FieldCard` (`game-table.tsx`) with the parts in
  `src/game/table/card-parts.tsx` and the rules in `table.css`:
  - **Plaque** (`ValuePlaque`, slot `game-card-plaque`, `aria-hidden` - the
    card's name says the values): `plaqueValue()` (`table-labels.ts`) gives
    Forge's power/toughness as `"${power}/${toughness}"` or, without them, the
    loyalty; a card with both shows its power and its loyalty as a chip. It
    lies in the card's face (`GameCard` `plaque`, outside the turned picture,
    so it stays upright): right `1px + 3 %`, bottom `1px + 4.3 %` of the
    picture's box (CardPicture's 1 px border included), at least 27 % wide,
    Cinzel `clamp(9px, 13 % of the card width, 0.95rem)`, `--foreground` on a
    `--table-plaque` gradient with a gold rim; loyalty with lucide's shield in
    `--table-mana` and a mana-blue rim. Tapped: left 6 %, bottom 10 % of the
    turned box (the mockup's), clear of the copyright edge, which is the left
    4.3 % then. The card's face is a size container (`table-card`); the
    plaque is hidden on a card narrower than 44 px (turned: a face narrower
    than 61.4 px). Forge sends no printed value (`VisibleCard` has none), so
    nothing is compared or highlighted.
  - **Chips** (`CardChip`, class `table-card-chip`, in `GameCardCaption` -
    slot `game-card-caption`, whose `title` keeps every fact as before): the
    chip line is the first part of the card (0.875 rem, `h-3.5`), above the
    picture, chips 13 px high with 10 px words on the panel tone and a gold
    hairline; in this order: the pile ("×N", gold Cinzel), the hourglass
    (`SickChip`, `data-tone="sick"`: rim, bolder icon and word in
    `--table-sick`; the word "verzögert" from a chip line of 6.5 rem - the
    caption is the container `table-chips` -, title "Einsatzverzögerung"),
    "Ziel" (crosshair, danger rim), "Quelle", Forge's refusal (circle-slash
    and the short reason), the block step's words (with the shield when
    blocking) or the blocking shield, the attacking swords (amber), then
    `chipFacts()` - damage (danger rim), counters, a changed colour,
    "verdeckt", "ausgephast". The line never widens the card and is cut at
    its end. The hourglass comes this early (2026-10-14; before: after the
    swords, so the first to be cut on a narrow card) because nothing else on
    the table shows it, while "Ziel" also has the arrows and the
    Zauberchronik, "Quelle" the decision's heading, and combat its frame. Hidden cards say "verdeckt", the command zone's cards
    "Kommandozone" (crown) as chips too.
  - **Rows** (class `table-field-row` on `Field`'s rows, inline `--u` and
    `--c` from `rowSize()`): `--kw = min((row height - chip line - 2 px - the
    4 px frame) × 63/88, max(2.75rem, (row width - 4 px × c - gap × (c - 1)) /
    u), 9.5rem)`, `--kh = --kw × 88/63`; a card's face is `--kw + 4 px` wide
    (the 2 px frame room on each side), a tapped one `--kh + 4 px`. Tapped
    adds 88/63, a pile 0.12 per drawn card behind (at most two), attachments
    count as cards. Cards are centred in the row, gap 0.375 rem; the row's
    padding on the opponent's side holds `--advance` (0.375 rem) for
    attackers. No line between a battlefield's two rows any more (the
    mockup has none; the chips and the gap part them).
  - **Tapped:** the quarter turn, the face as wide as the card is tall
    (landscape, no square place any more), nothing darkened.
  - **Attachments:** `GameCardGroup` keeps host and attachments together, on
    a plate of the panel tone (55 %) instead of a dashed frame that took
    room.
- **Deviations (prompt 40):** chips at the top edge are not in the mockup
  (it shows no facts besides the plaque and the pile's count); the pile's
  cards behind the front one are plates in the panel tone with a gold
  hairline, not further copies of the picture (no extra picture loads, nothing
  laid over a picture); a pile draws at most two cards behind (the mockup
  draws every card - a pile of 20 lands would be three cards wide); the pile's
  count is a chip above the pile, not on its corner; both rows of a
  battlefield are equally high (the mockup gives the creatures 58 %) - the
  measured two-row threshold of prompt 38 builds on it; cards are centred in
  their row (mockup: at its bottom); the picture's corners follow Scryfall's
  picture (3.8 % of its width; the mockup's 4.8 % until 2026-10-12) inside the
  table's rows, and a loaded picture has neither CardPicture's frame line nor
  its grey ground - both showed as a milky veil in the picture's transparent
  corners (project owner, 2026-10-12). The corners are set in percent of the
  picture's own box (`3.8% / 2.72%`) on every card of the table - the first
  rule asked for CardPicture as a direct child of `game-card-picture` (it
  lies in AspectRatio's box) and never matched, so the app's 14 px radius
  stayed and grew with a lifted card. A hand card has no shadow and no glow
  (a lifted card is scaled up to some 4 times on a phone, and the face's frame
  room with its shadow grew into a veil); its face is exactly the picture plus
  the 2 px frame, so a gold frame hugs the card; its picture is chosen for the
  lifted size (`sizes="13rem"`, `HAND_PICTURE_SIZES`), so it stays sharp.

### 4.8 Pile count (prompt 40)
- Mockup: `.stapel-zahl`, `.karte-flaeche --n`. Several equal cards lie
  offset behind each other; "×N" as a badge **above** the pile, never on the
  front card. The pile logic of `table-model.ts` is unchanged; the card view
  steps through the pile as today.
- **Built (prompt 40):** `GameCard` `pile` (the pile's size) draws up to two
  `game-card-layer` plates behind the front card inside `game-card-pile`
  (offset 0.12 card widths each to the left, `--layers`/`--k`); "×N" is the
  first chip. `table-model.ts` and the card view are unchanged.

### 4.9 Marks (prompt 40; arrows: §4.15, prompt 43)
`data-mark` (`usable`, `selected`, `target`) and the combat facts stay the
truth; only their look changes. Marks are frames and glows **around** the
picture, never on it. Since 2026-10-12 a frame is an **outline** (2 px, 3 px
for chosen) that takes no room: a card's face is exactly its picture, with the
picture's corners (`3.8% / 2.72%`), and an unmarked card has nothing around it.
Until then every card kept a 2 px transparent border as the frame's room;
whatever hung on it (CardPicture's line, a shadow) showed as a veil, most of
all on a lifted, scaled-up hand card (project owner: "Der sollte gar nicht
existieren"). Field rows keep 3 px above and below for an outline.

| State (source) | Look | Token |
|---|---|---|
| usable - Forge offers something (`data-mark="usable"`) | gold frame with a slight, tight glow (was: dashed; the wide glow read as a veil, 2026-10-12) | `--primary` |
| chosen (`data-mark="selected"`) | strong light frame, thicker | `--foreground` or `--table-gold-light` |
| target of something on the stack (`data-mark="target"`, `data-stack-target`) | red frame with a gentle pulse (glow layer whose opacity pulses; still under less motion) | `--table-danger` |
| attacking (combat) | amber frame and glow, moved towards the opponent (`transform`) | `--table-attack` |
| blocking (combat) | its own frame | `--table-mana` (proposal; prompt 40 decides and documents) |

Usable/chosen frames take precedence where several apply; the words
("Ziel", "greift an", "blockt") stay in chips and names, so no state is told
by colour alone (WCAG 1.4.1). Contrast: every mark reaches 3:1 on the board,
the desk and the panels (`design-tokens.test.ts`).

**Built (prompt 40)** - `table.css` on `[data-slot="game-card-face"]`
(`GameCard`'s base classes give the frame's colour, table.css the rest):
usable a `--primary` frame with a glow (no longer dashed); chosen a
`--foreground` frame and a second 1 px ring (thicker) with a light glow;
target a `--table-danger` frame and a glow layer (`::after`) whose opacity
pulses (`table-target-pulse`, 1.4 s, 0.45-1; 0.85 and still under less
motion); attacking and blocking by Forge's combat facts on the card
(`data-combat="attacking" | "blocking"`, a new anchor), only where no mark of
Forge's applies: attacking a `--table-attack` frame and glow, blocking
`--table-mana` (the proposal, taken). An attacker moves 0.375 rem towards its
opponent (`translate`: up on your battlefield, down on the AI's) - also while
chosen. The words: "Ziel", the swords, the shield and the block step's words
as chips, everything in the card's name. The decision region's words for
usable cards now say "gold umrandet" (were "gold gestrichelt").

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
- ~~No drag and drop onto the battlefield~~ - lifted by the project owner on
  2026-10-12: dragging a card onto the battlefield to play it is wanted (it
  feels more natural than tap and button) - built in prompt 46 (below).
  Replaces the Anvil lesson "never fanned" (prompt 13) deliberately.

**Built (prompt 42)** - `FannedHand` in `game-table.tsx`, the geometry in
`src/game/table/hand-fan.ts`, the gestures `useFanPress` in
`src/hooks/use-card-press.ts`, the look in `table.css` ("The hand"); details
in `docs/implementation/42-hand-fan.md`:

- Sizes from the hand's measured content box (`useElementSize`): a full card
  1.1 × the hand's height (at most 11.5 rem wide), sinking 9 % of its height
  below the edge; **since 2026-10-12 the cards never overlap** (project owner:
  the overlap looked untidy) - side by side, 3 px apart (`--hand-gap`),
  the outer cards' turn kept inside the width; where they do not fit the
  cards get smaller (down to 24 px wide, `MIN_CARD`: 12 cards on a 360 px
  phone, 14 on 412 px) - a tap lifts one to a full card's size, a long press shows it
  whole; until then they overlapped by at least 14 % with 24 px of each card
  its own; beyond that a row that scrolls sideways (`data-fan="row"`,
  `touch-action: pan-x`, cards rising inside the hand). Turn and arc as the
  mockup's.
- Lifted (`data-lifted` - the mouse, a finger - or `:focus-visible`):
  upright, 1.12 × a **full** card (a larger scale when the fan made the cards
  smaller), its lower edge 0.4 rem above the hand's, above the strips; the
  row clips only downwards; the hand's region lies above the others while a
  card stands out. A `transform` transition of 0.18 s, none under less
  motion.
- The resting place is a card's own strip (from its left edge to the next
  card's, the gap included - since 2026-10-12 the whole card; layout boxes, `offsetLeft`): what the player sees of it at rest and
  what the mouse hits - a finger and the mouse choose alike, the choice
  never jumps while the lifted card moves.
- Touch and pen belong to the row (`touch-action: none`): a finger lifts,
  beyond the 10 px slop it swipes (the card under the finger rises, the long
  press is off); release without a swipe = the lifted card's primary
  activation (the browser's click is taken in the capture phase, so the card
  that rose acts, never a neighbour the click may land on), release after a
  swipe = nothing; a long press (500 ms or Chrome's contextmenu, once) looks
  at the lifted card. The mouse lifts by hovering (only over a card; kept
  while over the lifted card), its clicks and right clicks and the keyboard
  stay each card's own (`useCardPress`).
- Hand heights: `quadrat` `clamp(7rem, 17dvh, 11rem)`, `breit`
  `clamp(6.5rem, 18dvh, 12.5rem)` (the mockup's); `hoch` and a low `breit`
  window `clamp(6rem, 14dvh, 9rem)` as before (the small phone's
  battlefields keep 80 px).
- Deviations from the mockup: lifting in code by the cards' own strips (the
  mockup: CSS `:hover`, touch by the cards' centres); a lower limit of 24 px
  per card, smaller cards and then a row (the mockup has none); the hand's
  height in `hoch` as before; the frames follow Forge's marks as on the
  battlefields.
- The AI's revealed cards stay a toolbar of cards (`table-hand-revealed`:
  the table's corners and shadow).
- `GameBoard` clips (`overflow-clip`) instead of hiding its overflow: it is
  no scroll container, so focusing a card that reaches out of it never
  scrolls the table.

**Built (prompt 46): drag and drop** - the gesture in `useFanPress`'s
`drag` (`src/hooks/use-card-press.ts`), the card's picture `HandDrag` in
`src/game/table/table-motion.tsx`, what a drop does `cardDrop` in
`src/game/card-use.ts`, the look in `table.css` ("Dragging a hand card");
details in `docs/implementation/46-drag-and-drop.md`:

- Starting: a finger that leaves the hand clearly **upwards** - more than
  24 px up (`DRAG_START_PX`) and more up than sideways, measured from the
  lowest point since the lifted card rose (a swipe to a card and then up
  works) - drags the **lifted** card. A sideways swipe still only lifts, a
  long press still only looks (once it looked it never drags), a tap without
  moving is still the primary activation. The mouse drags the card it
  pressed once it moves beyond the slop, in any direction; a click without
  moving stays the card's own.
- Dragging: the card's picture - a copy of its face at a lifted **full
  card's** size (`HandFan.drag`), upright, no ids, slots or names, in the
  motion's layer (`aria-hidden`, no pointer events) - follows the pointer,
  held at 70 % of its height (it stands above a thumb) and always whole
  inside the board; it moves by its `transform` only. The card itself stays
  in the hand, faint (`data-dragging`, opacity). The board carries
  `data-hand-drag` (no text selection, a grabbing cursor).
- The drop surface: both battlefields with the centre line between them and
  the middle (Zauberchronik / stack and combat) - by the card's middle.
  Over it, for a card Forge would play now, the board says
  `data-hand-drop="over"`: those regions glow golden at their edges (an
  inset ring and glow in `--primary`, a layer behind their cards - never on
  a picture - shown by its opacity). Land, creature or instant: Forge
  decides, not the place.
- Letting go over it: `cardDrop` - Forge marks the card `playable` and
  offers its tap, the step is none whose taps choose (selection, payment,
  attack, block, the mulligan's bottom), and a tap can be sent (`tapBlocked`:
  Forge waits, no blocking question, no concession) - then exactly one
  `onTapCard` (the card view's double-tap guard); Forge's further questions
  come in the decision region as after a tap. Otherwise nothing is sent and
  the card glides back to its place in the hand (`travelFrames`, 220 ms);
  since prompt 51 one toast says why (§4.19): the table's reason
  (`tapBlocked`'s words), Forge's land reason, or that Forge does not offer
  this action now - never a reason made up.
- Cancelling: Escape, a second finger, `pointercancel`, or dragging back
  over the hand. A card that leaves the hand while it is dragged (a new
  state) takes its picture with it.
- Motion: a played card's picture waits where it was let go; the travel of
  Forge's next state (§8, prompt 44) starts there - one picture, not a
  second one from the hand - or, without one within 1.5 s (`DROP_WAIT_MS`),
  it fades (`dropFadeFrames`). Under less motion the card jumps: the picture
  is gone at once.
- What stays: tap and click, long press and right click, the keyboard
  (Enter → view → button, the way without dragging: WCAG 2.5.7), the
  battlefield rows' sideways scrolling; battlefield cards are not dragged;
  a replay drags nothing. The words of the player's own priority with an
  empty stack name the gestures: "Zieh eine gold umrandete Karte aufs Feld
  oder tippe sie an – oder gib weiter." (`PLAY_HINT`).

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
- **Built (prompt 41):** `Chronicle` (`src/game/table/chronicle.tsx`) on a
  `TablePanel` (§4.12) in the region `center`. Its heading "Zauberchronik"
  (`h2`; screen readers also hear "· N Einträge") with the count in a gold
  ring (`TablePanelCount`, `aria-hidden`). The stack as an ordered list
  ("Stapel, oben zuerst: N Einträge"), one entry per item in Forge's order
  (`data-stack-item`; the top one `data-top` - gold rim and glow - and said
  "oben, wird als Nächstes verrechnet"; `data-controller` `me` / `opponent`):
  its card as a small card (`GameCardButton` with the whole picture,
  `data-stack-card`, red mark and `data-stack-target` while a spell targets
  it; a hidden one OpenMana's back) that opens the card view on a tap, a long
  press or a right click (`useCardPress`, looking only); the name
  (`chronicle-name`, or what it is); a line with the dot (`--table-mana`
  yours, `--table-danger` the Forge-KI's) and the words - targets first,
  then what it is and whose ("Ziel: X · Zauberspruch · von dir",
  `chronicle-facts`); Forge's own description, two lines (`chronicle-text`);
  its number (the oldest 1, the top the highest - the mockup's; not in
  `quadrat`, `hoch` and a low window). Every fact also in the entry's
  `title`. Combat below the entries under "Kampf" / "Blocks · noch nicht
  bestätigt": one line per attacker `data-combat-attacker`, "Angreifer →
  Ziel · ungeblockt / geblockt von …" (`defenderName`; the arrow is
  `aria-hidden`, screen readers get "greift … an"; "Blockziel" as a chip while
  blockers are declared; alike unblocked attackers share a line "13 × …",
  `combatLines` moved here from `game-table.tsx`). Empty: the panel with
  "0" and the words. `hoch`: a bar between the battlefields - title and count
  side by side on the left, the entries side by side scrolling sideways (each
  at least 6.8 rem, the card 1.55 rem wide), Forge's description and the
  combat heading only for screen readers, one cut line per attacker (the
  whole line in its title) - and an empty chronicle a gold line (its words for
  screen readers), so the battlefields keep their room (small phone,
  `commander-late`: 82 px each). `quadrat` beside an expanded decision: a slim
  panel in its strip. Since 2026-10-14 the empty bar's gold line in `hoch`
  gives way to the "Zuletzt" line (§4.17) once the game had a move - the
  chronicle stays Forge's stack alone, it keeps no resolved entries.

### 4.12 Panel (prompt 41)
- Mockup: `.tafel` - `--table-panel` surface (darkening downwards), a gold
  line (`--table-gold-line`), corner ornaments, inner shadow; title in
  Cinzel `--table-gold-light`. Reused by the chronicle and the Phasen-Tafel.
- **Built (prompt 41):** `TablePanel`, `TablePanelHead`, `TablePanelTitle`,
  `TablePanelCount`, `TablePanelSub` (`src/game/table/table-panel.tsx`,
  class `table-panel`, slot `table-panel`): the panel tone at 94 % darkening
  to the tone mixed with 30 % black, a gold hairline, an inner shadow and a
  drop shadow, 0.85 rem corners, 0.5 rem from its region's edges (the Phasen-Tafel 0.25 rem at the sides in `quadrat`, whose decision column can be 15 rem narrow); the two
  corner ornaments are the mockup's shape as a CSS mask filled with
  `--primary` (the colour stays the token's), top left and - turned - bottom
  right. The regions `center` and `decision` themselves became clear (the
  desk and the board show around the panels); in `hoch` the decision region
  is the action bar (a dark band, the panel tone mixed with 35-60 % black,
  the gold line above).

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
- **Built (prompt 41):** `PhasePanel` (`src/game/table/phase-panel.tsx`,
  slot `phase-panel`) with `phaseGroups()` (`turn-model.ts`: Forge's step
  decides each phase's state; the first-strike damage step is listed only
  while Forge is in it) and the short names `STEP_SHORT_LABELS`
  (`priority-labels.ts`: "Enttappen", "Versorgung", "Ziehen", "Kampfbeginn",
  "Angreifer", "Blocker", "Erstschlag", "Kampfschaden", "Kampfende",
  "Endsegment", "Aufräumen"; a main phase is its own step). The panel form
  (`data-place="panel"`, quadrat and breit): head "Phasen" and "Zug N"; the
  five phases (`TURN_PHASE_LABELS`) with lucide symbols (`RotateCcw`,
  `Sparkles`, `Swords`, `Sparkles`, `Moon` - the mockup's); past ones muted
  with a dim gold symbol, the current one in light with a gold symbol; only
  the current phase unfolds its steps on a gold line - past steps muted, the
  current one a gold pill with a diamond (`--primary-foreground` on the gold
  gradient); a main phase while current is the gold pill itself. The panel
  **is** the decision region's content (`GameDecision` gets `table-panel`
  and `data-form="panel"`): alerts, the phases, Forge's question with its
  parts, then the answers' bar (sticking to its bottom) and the hint below
  it; it stands at the end of its column in `quadrat` and in its middle in
  `breit` (the mockup's), growing - and scrolling inside the region - as far
  as the question needs. Folded (`data-folded`: the region `tall` or
  `expanded`; always in a low `breit` window): one line of the five symbols
  (the current one gold) and "Phase · Schritt" below.
- **Anchors** (moved from the header, consumers changed): `phase-track` (the
  list of phases, `data-phase` = Forge's step, absent before the first turn),
  `phase-track-group` per phase (`title` = its name, `data-state`),
  `phase-track-step` with `data-state` and the full name as `title` - the
  unfolded steps of the current phase, and for a main phase the phase's own
  line. Exactly one track on the page, in the decision region; the
  end-to-end test reads the current step there, the readiness player reads
  `data-phase` page-wide.
- **Screen readers (decided in prompt 41):** the panel stays `aria-hidden`.
  The header's help button reads the turn ("Zug 7 · Dein Zug") and Forge's
  step in words, the decision region announces Forge's questions - the
  phases are their picture; reading them too would repeat both. The full
  step names stay tooltips.

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
- **Built (prompt 41):** `SendButton main` (`data-main`, class
  `table-main-button`) for Forge's pass (`PriorityDecision`: "Weiter" /
  "Verrechnen lassen"), the declaration (`AttackDecision`: "Nicht angreifen" /
  "Mit N Kreaturen angreifen"), the blocks (`BlockDecision`: "Nicht blocken" /
  "Blocks bestätigen") and Forge's first button of the mulligan's steps
  ("Behalten"; the cards for the bottom) - `isMainButton()`, which also gives
  Forge's own OK of an attack (`attackDeclared` without a declaration in
  progress) the main look. At most one per decision. Look (table.css): the
  gold gradient `--table-gold-light` → `--primary` → `--primary` with
  `--table-gold-dark`, a light rim and a dark ring, Cinzel 700, words in
  `--primary-foreground` (4.5:1 on every tone, `design-tokens.test.ts`),
  `height: auto` so long words wrap inside; the gloss is an `::after` layer
  moved by `transform` (`table-gloss`, 4.5 s), still on a button that is off
  and under less motion. Every other button of the region (Forge's second
  buttons, "Zug beenden …", the blocking questions' "Bestätigen", the
  payment's) is second: the panel's dark tone, a gold hairline (Forge's
  first button a stronger gold rim and light gold words; a long label wraps inside its button instead of leaving the panel). Labels, `SendButton`,
  `ARMING_MS`, the confirmation of "Zug beenden" and `data-meaning` are
  unchanged.
- **Built - the answers' bar** (`GameDecisionBar`, slot `game-decision-bar`,
  `src/components/ui/game-decision.tsx`): every group of Forge's answers
  (`AnswerActions` in `decision-panel.tsx`, the group's role and name
  unchanged) stands in a bar that sticks to the region's bottom (its actions
  no longer stick themselves) with `env(safe-area-inset-bottom)` below it.
  The hint that explains the main button (`PASS_NOTES`, `declareNote`,
  `BLOCK_CONFIRM_NOTE`, the button's description as before) comes first in
  the page: on the Phasen-Tafel it is shown below the buttons (`order`,
  centred - the mockup's `.weiter-hinweis`), in the action bar and in a low
  window above them with the question. On the panel the main button takes
  the width and the others share a row below; in a low window they share one
  row.
- **Built - the action bar** (`hoch`, `data-form="bar"`): `useTableLayout()`
  puts the compact phases (`PhasePanel place="bar"`) into the answers' bar -
  left the five symbols (1.375 rem) and "Phase · Schritt", right the answers
  in reverse order, so the main button sits at the right end under the thumb;
  what does not fit beside it wraps below (a small phone: "Zug beenden …"
  under "Weiter"; a phone 412 px wide keeps both in the row). Without an
  answer (Forge computes, a selection without buttons) the bar shows the
  phases alone. Above the bar the question, its parts and the hint, as the
  region grows (§3.3).
- **Deviations (prompt 41):** the phases keep Magic's German phase names
  ("Anfangsphase", "Kampfphase", "Endphase" - the existing labels; the
  mockup shortens them to "Anfang", "Kampf", "Ende"; only short step names
  were added); Forge's question with its parts stands on the Phasen-Tafel
  between the phases and the main button (the mockup has no question), and
  the panel keeps the decision column's width of prompt 38 (≥ 15 rem); the
  header keeps the turn line and the step in words (the screen readers'
  place); a chronicle entry's line names targets, kind and owner ("Ziel: X ·
  Zauberspruch · von dir" - Forge's facts, not the mockup's example "Von dir
  gewirkt") and Forge's description is a third line; the combat lines are
  not in the mockup; an empty chronicle in `hoch` is a gold line; in the
  action bar the main button's words are a little smaller (1 rem) and Forge's
  second button stands left of it; the panels have no `backdrop-filter`
  (cost per frame) - the panel tone is 94 % opaque instead; the gloss also
  stops on a main button that is off.

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
- **Built (prompt 43)** - `src/game/table/arrows.ts` (which arrows and where,
  pure) and `src/game/table/table-arrows.tsx` (`TableArrows`, the last part of
  `GameBoard`, so also in the replay); details in
  `docs/implementation/43-table-arrows.md`:
  - Relations from Forge's state only (`arrowRelations`): each stack item's
    `targets` from its chronicle entry - the top entry's strong, the lower
    entries' muted (thinner, fainter, still) -; each `combat` attacker to its
    defender (Forge lists declared attackers in `combat` while they are
    declared; `attack.defender` alone draws nothing); each blocker to its
    attacker (Forge's planned blockers too). A card target in a graveyard or
    exile points at that pile of its player's strip.
  - Placing (`layoutArrows`): the head's tip 3 px beside one of the end's four
    sides (a card's face, a medallion, a pile), at the place - five per
    side - whose head covers no card face, stays in the board, is free of
    other heads and chips and faces the start best; a cubic curve from the
    start's side facing the tip that arrives at a right angle, so the head
    stays outside the box; arrows of a kind bend alternately, a little more
    each, the first towards the board's middle. Lines may cross pictures,
    heads never.
  - **Out of sight:** only between two things the player sees (each box cut
    by its clipping ancestors; under 8 px is out of sight). A card scrolled
    out of its row, a chronicle entry out of its bar, a chronicle that steps
    aside get no arrow until they are in view (an arrow to a row's edge would
    put its head on the last visible card).
  - Drawing: one wrapper over the board (`data-slot="table-arrows"`,
    `aria-hidden`, `pointer-events: none`, `z-index` 40), six SVG layers sized
    to the arrows - muted (still), the strong arrows' glow (a blurred layer
    pulsing in opacity), their dashed line in three phases a third of a dash
    apart taking turns in opacity (the flow), the heads. Measured and drawn
    once per animation frame for a new state, a resize of the board or a
    region (the decision opening or closing), a scroll inside the board and
    the end of a transition; nothing measured without arrows; User Timing
    `openmana:table-arrows`. Under less motion the first phase stands alone.
  - Colours `--table-danger`, `--table-attack`, `--table-mana` (block, the
    proposal taken); no new token.

### 4.16 Card view in full screen (prompt 47)

The project owner (2026-10-12): the card view in a Sheet was "sehr unschön";
looking at a card should be like taking a real card into the hand - the table
darkened, the card as large as possible, beside it short boxes that explain
only the keywords on this card.

- **Built** (`src/game/card-view.tsx`, `src/components/ui/card-lightbox.tsx`;
  `docs/implementation/47-vollbild-kartenansicht.md`): a shadcn `Dialog` in
  full screen. shadcn's overlay darkens the whole table (black 80 %, a light
  blur); the card stands on it whole, in its proportions, as large as the
  room allows (`cardFit`) - never covered, never cut, Scryfall's largest
  picture (PNG) by `srcset`/`sizes="auto"`; its transparent corners show the
  darkening.
- **Arranged by the table's layout** (`useTableLayout()`, never by device):
  `hoch` (the folded foldable 480 × 1040, phones) - the card on top, below
  it its buttons (they stay on screen with the card: the card leaves them
  room), then the keyword boxes; the view scrolls vertically, the card stays
  whole. `quadrat` and `breit` (the unfolded foldable either way, tablets,
  desktop, a phone turned) - the card left, the aside right (36 % of the
  screen, 16–24 rem): the boxes (scrolling in their column when they are
  many), under them the buttons. The X sits top right, off the card.
- **Keyword boxes:** a shadcn `Card` per keyword Forge reports for the card
  now (`VisibleCard.keywords`, protocol 9 - also one an effect gave it),
  each once, in Forge's order: the German name in bold (with Forge's
  concrete form: "Bonus {4}", "Schutz vor Rot", "Vernichter 2"), the German
  explanation below; where OpenMana cannot say Forge's concrete form in
  German, the German name and general explanation with Forge's form in
  English beside it, marked "englisch"; a keyword without German words shows
  Forge's, marked. No keywords: no boxes, no line saying so
  (`src/game/keyword-texts.ts`, AGENTS.md "Keyword Rules").
- **Buttons:** Forge's offer as one button (its words, its guards: arming,
  `tapBlocked` with the reason, repeated keys), never over the card;
  "Umdrehen" for a double-faced card; browsing a zone, pile or the stack
  where it was opened from one. In a replay no offer.
- **Closing:** the X, a press on the darkening (a press within `ARMING_MS`
  of opening - the double tap's second - does not close), Escape, the
  system's back gesture (`CloseWatcher`). Focus to the view on opening, back
  to the card on closing.
- **Facts:** the former list (place, mark, state, counters, damage, stack
  and targets, attachments, owner, picture language, catalog text, Forge's
  rules text and offer in words) is no longer on screen - the table's chips
  and the Zauberchronik show them - and stays complete in the dialog's
  description for screen readers.
- **Checked** in Chrome at the eight sizes and the foldable's three
  (end-to-end `cardViewer`: the darkening over the whole screen, the card
  whole and at least as large as the Sheet's picture, boxes beside or below
  and never on the card, the button under the card or the boxes, every way
  to close, axe) on the recorded `respond` scene (Geborstener Blitz with
  Forge's Kicker {4}, Schock without keywords) and a built card with several
  of Forge's real keyword forms (`presentation=keywords`).

### 4.17 The opponent's turn: stage, tempo, turn band (prompt 49)

The project owner (2026-10-12): "ich möchte Züge vom Gegner auch sehen, was
er setzt und so" - with a tempo and an optional "Weiter". Built on the
engine's observations (prompt 48, protocol 10;
`docs/implementation/49-gegnerzug-und-spieltempo.md`).

- **Stage** (`OpponentStage`, `src/game/table/opponent-stage.tsx`, slot
  `opponent-stage`): while the engine holds an observation, a **compact
  announcement** - since 2026-10-14 (the project owner: "das Panel, wenn
  der Gegner etwas spielt, muss dezenter werden - zu prominent") no longer a
  panel over the player's half. Only as tall as its content, centred,
  positioned absolutely in grid areas (the rows never change), z-index 44
  (over cards and arrows, under the motion's ghosts): `hoch` at the lower
  edge of the opponent's battlefield, right above the stack bar - the
  player's battlefield, the stack bar, the hand, the header and the decision
  stay free; `quadrat`, `breit` and `breit` + `short` over both
  battlefields, centred on the line between them (the 1.5 rem centre line;
  in a low window the battlefields' border), at most 36 rem wide. Its shell
  is quiet: the panel tone at 90 % (4.5:1 for its words over every
  surface), a hairline in `--border`, only a hint of shadow, no gold frame.
  Left the action's cards as small previews (`TablePicture`, whole, never
  cropped: 2.875 rem in `hoch` - only the first, the lines name all -,
  4.5 rem in `quadrat`, 5 rem in `breit`, 3.25 rem in a low window; at least
  44 px); then the words: "2 von 3" when the observation has several steps
  (no "Aktion" label), the action in one sentence (`h2`, `text-sm`
  `font-medium`, `aria-live`; a change of turn "Zug N · whose turn" in the
  same quiet line, the number in gold), the results in short lines
  (`text-xs`), at the player's turn the summary of the AI's last turn; the
  words scroll inside above 4.75 rem (`hoch`) / 9 rem (then a focus stop).
  Right "Weiter": while the tempo runs a quiet `secondary` button (it only
  goes on sooner), stepwise and in the replay the gold `default` one - at
  least 44 px on touch either way. No line of what happens next (the header
  badge and the decision region say it; `data-stage-mode` = `tempo` /
  `stepwise` / `paused` / `replay` for the checks). A thin gold line runs
  down the step's time. A step without a card takes only its words. With the
  release the stage is gone at once and never comes back; the "Zuletzt"
  line takes over.
- **"Zuletzt" line** (`LastMoveLine`, slot `last-move`, since 2026-10-14; the
  project owner: "immer den zuletzt gespielten Zug permanent anzeigen, damit
  ich mich orientieren kann"): after the release, and whenever no stage
  holds, one quiet line "Zuletzt: Die Forge-KI hat Grizzlybären gewirkt" /
  "Zuletzt: Du hast Gebirge gespielt" - the latest move of either player
  (`EngineSession.lastMove`, words from `lastMoveText`: land, spell,
  ability, attack, block, from the action's kind and Forge's structured
  fields as captured with the observation - never Forge's prose or a state
  difference). One entry only, replaced by the next observation with a move;
  a change of turn, a trigger, a resolution or combat damage keep it;
  nothing before the game's first move. `--muted-foreground` `text-xs` on
  the panel tone (90 %) with a hairline, one line (cut with an ellipsis), no
  picture, no button, no timer, not `aria-live`, every touch passes through,
  on no card. `quadrat`/`breit`: in the centre line between the battlefields,
  always; `hoch`: in the stack bar's row in place of the empty bar's gold
  line, stepping aside (`data-rests`) while the bar shows a spell or combat;
  `breit` + `short` (no centre line): at the foot of the side column's stack
  panel, aside likewise, and hidden while the decision is expanded (the
  stack's area is gone then; placed there the line opened implicit grid
  tracks and shrank the table - fixed 2026-10-15,
  `table-grid-areas.test.ts`). Hidden while the stage holds. Not a second history:
  never recorded or stored; the details stay Forge's log.
- **Tempo** Langsam / Normal / Schnell (3.2 / 1.7 / 0.8 s per step, a bit more
  for several result lines), **stepwise** "Nach jeder Gegneraktion warten":
  Settings → Gegnerzug and the table's menu. "Weiter" moves one step (armed
  `ARMING_MS` after a step appeared, repeated keys dropped); after the last
  step the observation is released - no priority passed, nothing answered.
- **Header and decision while held:** the badge "Gegnerzug" (pause symbol)
  instead of "Du bist dran"; the decision region "Forge hält an – sieh dir die
  Aktion der Forge-KI an." with the mode's note - said there only, the stage
  no longer repeats it (2026-10-14). While Forge plays on by
  itself the decision region names Forge's auto-pass setting.
- **Turn band** (`TurnBand`, slot `turn-band`, `data-seat`): a change of turn
  that came without holding - a pill across the centre line, "Zug 5 · Du bist
  am Zug" and the AI's last turn, for one step's time, `aria-hidden`, every
  touch passes through.
- **Interruption:** a real decision about the AI's spell, ability, trigger or
  attack removes the stage at once; a shadcn `Alert` above the decision says
  "Unterbrechung: …" until the player has answered.
- **Motion:** the stage fades and rises in a little (`table-stage-in`,
  160 ms, opacity and transform; the "Zuletzt" line does not move), the line scales down (`table-stage-timer`), the band fades in
  and out (`table-turn-band`); under less motion nothing moves, the band
  still goes after its time (a timer, not the animation).
- **Replay:** the same stage read-only for recorded observations
  ("Aufgezeichnete Aktion", "1 von 2 · Aufzeichnung", stepped by hand); no
  "Zuletzt" line.
- **Checked** in Chrome with the real engine at the eight sizes and the
  foldable's three while the stage holds (end-to-end `--opponent-only`;
  since 2026-10-14 also: cards 44-96 px, the stage compact - at most 100 px
  high in `hoch`, 200 px otherwise -, in `hoch` never over the player's
  battlefield or the stack bar; the "Zuletzt" line named the AI's and the
  player's moves, never stood beside a held stage, one line inside the board
  without controls - adjusted, not yet run).

### 4.18 The start hand and browsing the hand (prompt 50)

The project owner (2026-10-12): before keeping or taking a mulligan, see the
whole hand large, without cards over each other; open a card and swipe to the
next or previous one (`docs/implementation/50-starthand-und-handkarten-blaettern.md`).

- **Start hand** (`StartHandView`, `src/game/start-hand-view.tsx`, on
  `src/components/ui/hand-spread.tsx`; slot `hand-spread`): a shadcn
  `Dialog` in full screen over the table at Forge's start questions
  (`mulligan`, `mulliganBottom`) - by itself in the running game at each new
  hand, else through "Starthand ansehen" beside the question. At the top
  "Deine Starthand" / "Karten unter die Bibliothek legen", the count and
  Forge's prompt line; in the middle every card whole, side by side and below
  each other, never overlapping, as large as the room allows
  (`handSpreadFit`: the columns that give the widest card, 88 px to 22 rem,
  scrolling inside only below 88 px); at the bottom Forge's buttons (armed,
  Forge's enabled state). Keep or mulligan: a tap on a card opens the card
  view over the panel. During the London mulligan's choice (the project
  owner, 2026-10-14: as on the table) a tap on a card's picture chooses it
  for the bottom or takes it back (Forge's `card.tap`); a long press, a right
  click or the context-menu key opens the card view; under each card the same
  choice as a button ("Nach unten" / "Doch behalten", `aria-pressed`) for the
  keyboard and without the picture. The marked cards in the "chosen" frame
  around the picture (never on it), "N ausgewählt" (Forge's data carry no
  number for the step - never "N von M"); Forge's OK confirms once. Steady
  through Forge's gap after each tap (withdrawn, state, new question): title,
  count, frames, the buttons under the cards and their room, Forge's buttons
  and one status line ("Forge rechnet …", always its own room) stay - the
  controls only wait (`holdBottom`). The choice is armed once per step and
  hand, a second press on the same card before Forge answered counts once, a
  press while Forge computes says why in a toast. Closing (X, Escape, back)
  answers nothing; after an answer it waits ("Forge rechnet …") for Forge's
  next start question and closes when the game begins.
- **Browsing the hand** in the card view: every card opened from the
  player's own hand browses the hand of the current state - a swipe of one
  finger on the card (left = next, right = previous; `touch-action: pan-y
  pinch-zoom`, so scrolling and pinching stay the browser's; not from the
  screen's edge, not after a long press, not with two fingers), the buttons
  "Vorige Karte" / "Nächste Karte", ArrowLeft / ArrowRight, "3 von 7"; no
  wrapping. Forge's offer re-arms for each card; a card that left the hand
  stays in view, "Nicht mehr in deiner Hand · N Karten".
- **Checked** in Chrome with the recorded mulligan at the eight sizes and the
  foldable's three, gestures on a phone, a phone turned and a desktop, and two
  real games (end-to-end `--starthand-only`).

### 4.19 Land plays and refused actions (prompt 51)

The project owner (2026-10-12): see how many lands one played this turn and
understand why an action is not possible
(`docs/implementation/51-laender-und-aktionshinweise.md`).

- **Strip chip** (`LandPlays` in `game-table.tsx`, `data-strip-fact="lands"`):
  on the player's own strip after the hand's count, a `StripChip`: "Länder 0/1"
  / "Länder 1/1" (Forge's `landsPlayed`/`landsAllowed`, the numbers in
  `.tabular-nums`), "Länder 2 · unbegrenzt", in the AI's turn "Kein Land im
  KI-Zug", before the first turn none. Its sentence is the `title` and the
  screen-reader text; `data-lands-turn`, `data-lands-used`.
- **Refusal note** in the card view (`data-slot="card-view-refusal"`): where
  Forge offers no tap, Forge's reason (or "Mit dieser Karte bietet Forge gerade
  nichts an.") where the button would be - under the card (stacked) or the
  boxes, never on it; only in a running game.
- **Drop:** a refused drop's reason as one toast at the top (`hand-drop`).
- **Checked** in Chrome at the eight sizes and the foldable's three on recorded
  scenes and in two real games (end-to-end `--lands-only`).

### 4.20 The zone view (2026-10-14)

The project owner (2026-10-14): a calmer, more compact zone view with the
cards as pictures (`docs/implementation/zone-sheet-redesign.md`). A Sheet
outside the table's CSS exception - shadcn only (`src/game/zone-sheet.tsx`,
`src/components/ui/card-tile.tsx`, the model `src/game/zone-model.ts`).

- **Header:** the place as title ("Dein Friedhof", "Exil der Forge-KI",
  "Karten auf dem Stapel") and the count ("6 Karten", "1 Eintrag") - nothing
  else.
- **Switcher:** two shadcn `ToggleGroup`s (single: radios with
  `aria-checked`). "Wessen Zonen": "Du", "Forge-KI". "Welche Zone":
  "Friedhof", "Exil", "Kommando" with the selected player's counts and
  "Stapel" with Forge's number of entries, each count a `Badge`. Names say
  player, zone and count ("Dein Friedhof: 6 Karten", "Exil der Forge-KI:
  0 Karten", "Stapel, gemeinsam: 1 Eintrag"). An empty zone is muted
  (`data-empty`, outline badge) but stays selectable - its emptiness is
  readable and every zone reachable by keyboard. The stack is both players':
  while it is shown no player is pressed; a player's button then returns to
  that player's zone shown last. Pressing the pressed button again changes
  nothing.
- **Grid:** whole card pictures (`CardTile` with `TablePicture`,
  `sizes="auto"` - the picture the column's width needs; without a picture
  the card's name and type line in card form), the name below (two lines at
  most); columns by the Sheet's width through container queries: 2 below
  24 rem (phones from the bottom), 3 from 24 rem (the foldable's cover screen
  from the bottom, its inner screen from the side), 4 from 36 rem and 5 from
  42 rem (the side Sheet is widened to `max-w-xl`/`2xl`/`3xl` by screen
  width). Every tile is a button of at least 44 px (`data-card`).
- **Groups:** identical cards are one tile with "×N" (a `Badge` beside the
  name, never on the picture; `data-count`; "N Karten" in the name) exactly
  as the table's piles: every value Forge sends equal (`cardSignature`) and
  no card named by an open question, the stack or combat
  (`namedCardIds`). The stack is never grouped: each card once, top first.
- **Order:** graveyard and exile newest first - Forge appends every card it
  moves there (`Zone.add` without a position; cards moving together in the
  order their player chose), the bridge sends Forge's list in that order -,
  the newest tile with a quiet "zuletzt" badge (`data-latest`, "zuletzt
  hinzugekommen" in its name; only with more than one visible card, never
  for a hidden newest card). Only Fossil Find and Search for Survivors
  reorder a graveyard (Forge's `ReorderZone`); the badge then names the
  graveyard's top card. The command zone keeps Forge's order (Forge puts a
  commander first) and the stack Forge's (top first); neither gets the badge.
- **Forge's mark:** `cardUse` decides as on the table: usable is the gold
  frame (`--primary`), chosen the strong light frame (`--foreground`) -
  `GAME_CARD_MARKS` of `game-card.tsx`, an outline around the picture with a
  small offset, never on it (`data-mark`). Forge's offer ("Forge bietet an:
  Rückblende") is in the tile's name and `title`, no line of its own. The
  zone view never taps.
- **Empty and hidden:** an empty zone is the shadcn `Empty` (`Layers` icon,
  "Keine Karten", "Hier liegt gerade nichts." / "Der Stapel ist leer.",
  `data-slot="zone-empty"`); hidden cards stay a note ("2 verdeckte Karten –
  Forge gibt ihre Identität nicht frei."), never a tile; the stack's note
  "Oben zuerst, in Forges Reihenfolge; jede Karte einmal."
- **Card view:** a tile opens the card view with the zone as its source; it
  browses the zone in the grid's order (`browseIds` through
  `zoneBrowseIds`: a group's cards one after another) by "Vorige
  Karte"/"Nächste Karte", ArrowLeft/ArrowRight and a swipe, "N von M", no
  wrapping - as the hand (§4.18), whose order stays Forge's.
- Focus: the Sheet gives the focus back to its opener; the footer's
  "Schließen" sticks to its bottom.
- **Checked** by `src/game/zone-sheet.test.tsx`, `zone-model.test.ts` and
  `card-view.test.tsx`; the end-to-end `--zones-only` uses the switcher's
  radios.

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
| `--table-heal` | `oklch(0.78 0.16 150)` | life gained: the medallion's green ring of light (prompt 44) |
| `--table-sick` | `oklch(0.8 0.12 310)` | Forge's summoning sickness: the hourglass chip's rim, icon and word (2026-10-14; 6.4:1 on the wood frame, 6.9:1 on the chip's panel tone over brass, the weakest cases) |
| `--table-leather` | `oklch(0.28 0.045 261)` | the board's leather (its lit centre; darker towards the frame) |
| `--table-panel` | `oklch(0.22 0.025 262)` | panels: chronicle, Phasen-Tafel, action bar (top tone; darker downwards) |
| `--table-plaque` | `oklch(0.28 0.027 81)` | the value plaque (top tone) |

Checked by `src/app/design-tokens.test.ts` (WCAG 2.2): text 4.5:1 - e.g.
`--foreground` on `--table-panel` 15.2:1, `--muted-foreground` on
`--table-leather` 6.6:1, `--foreground` on `--table-plaque` 12.8:1,
`--primary-foreground` on `--table-gold-light` 14.4:1; marks 3:1 on leather,
wood frame, panel and plaque - the weakest is `--table-danger` on
`--table-wood-frame` with 3.95:1 (that token went with the desk in prompt 56). Depth (shadows, grain, highlights) uses
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
- **The whole table by keyboard** (prompt 45, end-to-end `tableKeyboardTour`
  in the scenes `main-phase`, `stack`, `target-player` and `commander-late`
  at the eight sizes and the foldable's three): Tab from the page's start
  walks every region in the focus order header, opponent, opponent's
  battlefield, Zauberchronik, your battlefield, you, hand, decision (15-21
  stops; a card row is one), every stop shows its focus ring and has a
  name, and Tab leaves the table at its end; nothing is tapped or answered
  on the way.
- **Names for screen readers** (checked there too): a medallion reads its
  life total with "Lebenspunkte" and the seat ("14 Lebenspunkte Forge-KI",
  ", am Zug" / ", wird angegriffen"; as a control "Forge-KI, 20
  Lebenspunkte, wählbar – Antippen: Wählen"); a zone pile what it opens
  and how many cards ("Dein Friedhof ansehen: 2 Karten, oben:
  Blitzschlag"); a card its name and facts ("Riesenspinne,
  Einsatzverzögerung, 2/4"); a Zauberchronik entry "Magmastrahl ansehen";
  the main button its words ("Weiter", "Mit 14 Kreaturen angreifen").

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
  `stroke-dashoffset` (`fliessen`); see §8 for the allowed equivalents
  (built: prompt 40's pulsing glow layer, prompt 43's three dash phases).
- The arrows' gradients and SVG markers: token colours and drawn heads
  (prompt 43).

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

### Built (prompt 44)

One component moves the table in code: `TableMotion`
(`src/game/table/table-motion.tsx`, the last part of `GameBoard`, in game and
replay), with the pure rules and every keyframe in
`src/game/table/motion-plan.ts`. Web Animations of `transform` and `opacity`
only (`MOTION_PROPERTIES`, checked by `motion-plan.test.ts` and
`motion.test.ts`).

- **When:** for every new state Forge sends. Before React changes the page
  (`getSnapshotBeforeUpdate`) the old places are read - first everything that
  still moves is cancelled (the pictures jump to their places); at the next
  frame, before it is painted, the new places are read in one go and the
  animations start. A state that comes before that frame skips the motion of
  the one before. Nothing is queued, nothing waits, nothing is sent. Under
  less motion (`motionReducedNow()`: the device or the player's setting)
  nothing is read and nothing moves; switching it on stops what runs
  (`watchReducedMotion()`). The replay passes `animate={false}` when it jumps
  over several steps.
- **Which card is which:** only the `data-card` id (a Zauberchronik card's
  `data-stack-card`; a pile's cards all stand at its front card's place,
  `data-pile-cards`). Forge keeps the id from the hand over the stack to the
  battlefield and from the battlefield to the graveyard: in the engine's test
  games (publish-35d transcripts) 52 cards went from a battlefield to a
  graveyard with their id, 82 from a hand to a battlefield, 19 from the
  stack to a graveyard, 7 from the stack to a battlefield; only a token
  ceased to exist. While a spell is paid for its card is in no zone - it
  leaves the hand and appears on the stack afterwards, so a card's last place
  is remembered for 15 s and it travels from there.
- **Travel** (another element: another region or row): a **ghost** - a copy
  of the face (its loaded picture; no ids, slots or names; `aria-hidden`, no
  pointer events), in the layer `table-motion` above the arrows - glides in
  340 ms from the old place to the new one, scaled by the cards' long sides
  and turned with the fanned hand. The card itself lies at its new place at
  once - invisible until the ghost arrives, but clickable. A card joining a
  pile does not hide the pile.
- **Shift** (the same element: its row changed - neighbours came or went, the
  region grew, an attacker moved forward): the card's parts move from their
  old place back to rest (260 ms); the card - the control - stays at its new
  place, its moving parts take no pointer (`table-motion-moving`).
- **Turn:** Forge's `tapped` changed - the picture turns a quarter (240 ms).
- **Arrival** without an old place: from the library for the player's hand,
  from the opponent's hand (or medallion) for the opponent's cards; without
  a loaded picture as OpenMana's back; otherwise it grows into its place.
- **Departure:** to the graveyard or exile pile of its player only when Forge
  shows the id there now, fading at the end; otherwise it fades where it was.
- **Effects** (Forge's log entries since the last state - they come before the
  state they explain; only `DAMAGE`, `STACK_ADD`, `STACK_RESOLVE` are
  followed, other kinds are ignored): the source a `DAMAGE` entry names
  flashes red (a glow layer around the picture, `::before`, opacity); a card
  whose Forge damage grew shakes (added to its other motion) and flashes; a
  new Zauberchronik entry glides in after `STACK_ADD` (else it fades in); a
  gone entry dissolves after `STACK_RESOLVE` (else it fades).
- **Life:** Forge's life total changed - the number pulses and the
  medallion's ring of light flashes red for a loss, green for a gain
  (`--table-heal`). The `LIFE` log entry names nobody in structured form, so
  the change of the number is what moves (a value shown, not a told event).
- **Phases:** the gold marker (the current step, or the current phase in the
  compact line) glides from the old place to the new one.
- **Priority:** a new priority question of Forge's makes the main button's
  gloss sweep across once.
- **Arrows** wait while cards travel and are drawn again at the end
  (`openmana:table-motion-end`).
- **Anchors** for the tests: the layer `data-slot="table-motion"` with
  `data-moving` (while something moves), `data-last` (what the last state
  moved, e.g. "travel 1 shift 3 turn 1 phase 1") and `data-states`.
- **Cost:** two readings per state (the old places on a clean layout, the new
  ones on the layout the frame needs anyway), at most 16 ghosts, the motion's
  own work as User Timing `openmana:table-motion`.

## 9. Performance budget

- The table surface is drawn **only when a size changes**; expensive SVG
  filters never per state.
- At most one layout measurement per state for arrows and travelling cards,
  batched per animation frame; no layout animations. (Prompt 44: the motion
  reads the old places before React changes the page - a layout that is
  usually clean - and the new places in the frame, after the one layout the
  frame needs anyway.)
- Chrome with 4× CPU throttling at 412 × 915: no long task over **200 ms**
  caused by the table at a change of turn (and 20 state changes of a
  recorded scene for the surface, prompt 37). Each prompt reports its
  measurement.
- No growing listeners or animation leftovers after ten turns. Prompt 45
  measures it in real games (`scripts/readiness/matches.ts
  --table-memory`: once per turn, after the motion and a full garbage
  collection, Chrome's counts of event listeners and DOM nodes, the heap,
  the running and endless animations and the motion's ghosts). It found
  pictures that stayed alive after they left the page (Chrome keeps an
  `<img loading="lazy" sizes="auto">` and the elements around it; about 20
  nodes and 4 listeners per state, without end); `CardPicture` now takes
  `sizes` away first. Since then listeners (≈ 390-410) and nodes stay level
  over a 22-turn Commander game, no motion is left running and no ghost
  remains; only the endless decoration runs (3 animations at every sample,
  never more).

## 10. Where the code lives

- `src/game/table/arena-surface.tsx` - the arena (prompt 53, §4.1b): the
  stone surface as a subgrid of the board; its rules in `table.css` under
  `[data-background="arena"]`.
- `src/game/table/` - the table's components (medallion, piles,
  chronicle, panel, arrows …), `table-layout.ts`, `use-table-layout.ts`,
  the hand's geometry `hand-fan.ts` (prompt 42), the arrows' relations and
  geometry `arrows.ts` and their layers `table-arrows.tsx` (prompt 43), the
  motion `table-motion.tsx` with its rules and keyframes `motion-plan.ts`
  (prompt 44; since prompt 46 also a dragged hand card's picture,
  `HandDrag`), and `table.css` (the one
  stylesheet; imported by the table from prompt 37 on). The hand's gestures
  extend the card press hook (`src/hooks/use-card-press.ts`, `useFanPress`,
  dragging since prompt 46); what a drop does is `cardDrop` in
  `src/game/card-use.ts`.
- `src/components/ui/game-*.tsx` - the shadcn-built table primitives
  (`GameBoard`, `GameCard`, `GameDecision`, `GamePlayer`) keep their slots
  and may be restyled or replaced step by step; the regions' and slots'
  anchors stay. `PhaseTrack` (`src/components/ui/phase-track.tsx`) was
  replaced by `PhasePanel` in prompt 41, which carries its slots.
- Tokens and variants: `src/index.css`.
- The zone view (2026-10-14, §4.20): `src/game/zone-sheet.tsx` with its
  model `src/game/zone-model.ts` and the tile `src/components/ui/card-tile.tsx`.
- The card view (prompt 47): `src/game/card-view.tsx` on
  `src/components/ui/card-lightbox.tsx`; the German keyword texts
  `src/game/keyword-texts.ts`.
- The start hand and browsing the hand (prompt 50): `src/game/start-hand-view.tsx`
  on `src/components/ui/hand-spread.tsx`, its model `src/game/start-hand.ts`,
  the swipe `src/hooks/use-swipe.ts`, the browse position
  `src/game/card-view-model.ts`.
- The opponent's turn (prompt 49): `src/game/table/opponent-stage.tsx`
  (stage, "Zuletzt" line, band), the steps' and the latest move's words
  `src/game/observation-model.ts` (the move itself: `EngineSession.lastMove`), the
  stepping `src/game/observation-playback.ts`, the page's hook
  `src/game/opponent-turn.tsx`, the settings `src/game/opponent-tempo.ts`.

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
- since prompt 39 `data-strip-fact="profile"` (the AI profile Forge
  confirmed, read by the end-to-end test and the readiness games instead of
  the former badge) and `data-zone-pile` on the strips' piles and counters;
- since prompt 40 `data-combat` on battlefield cards and the card slots
  `game-card-plaque`, `game-card-picture`, `game-card-pile`,
  `game-card-layer`; the chip line keeps `game-card-caption` with every fact
  in its `title` (the end-to-end test's counts read "N Karten" there);
- since prompt 41 the phase anchors in the decision region (`phase-panel`
  with `data-place` and `data-folded`; `phase-track`, `phase-track-group`,
  `phase-track-step` - §4.13), the main button `data-main`, the answers' bar
  `game-decision-bar` (with `data-form`), the decision content's `data-form`
  (`panel` / `bar`), and in the Zauberchronik `data-top`, `data-controller`,
  `chronicle-name`, `chronicle-facts`, `chronicle-text` and
  `data-chronicle="empty"`; the end-to-end test checks them in every scene
  (`panelFacts`);
- since prompt 42 the hand's row `table-hand` with `data-fan` (`fan` /
  `row`), its cards' `data-hand-card` and the lifted card's `data-lifted`
  (end-to-end `handFacts`, `handGestures`);
- since prompt 43 the arrows' wrapper `table-arrows` with `data-arrows` and
  `data-draws`, its layers `data-layer-name`, and per arrow `g[data-arrow]`
  with `data-from`, `data-to`, `data-strong`, `data-side`, `data-end`
  (end-to-end `arrowFacts`, `tableArrows`);
- since prompt 44 the motion's layer `table-motion` with `data-moving`,
  `data-last` and `data-states`, the pile's `data-pile-cards` and the
  medallion's `table-medallion-flash` (end-to-end `tableMotion`; the
  harness' `sequence=first-attack`);
- since prompt 46 the dragged card's picture `.table-hand-drag` in the
  motion's layer, the board's `data-hand-drag` and `data-hand-drop="over"`
  and the dragged hand card's `data-dragging` (end-to-end `handDrag`,
  `dragInRealGame`; `dragCard` in `scripts/readiness/player.ts`);
- since prompt 47 the card view's `data-slot`s `card-view` (with
  `data-card-view`), `card-lightbox-overlay`, `card-lightbox-stage` (with
  `data-arrangement` `stacked`/`beside`), `card-lightbox-picture`,
  `card-lightbox-aside`, `card-lightbox-boxes`, `card-lightbox-close`,
  `keyword-box` and `card-view-offer` (Forge's button; the readiness player's
  `throughView` and `byDragging`), the list "Schlüsselwörter dieser Karte",
  the button "Umdrehen" and the regions "Was Forge anbietet" and "Auf dem
  Stapel" inside the dialog's description (end-to-end `cardViewer`,
  `lookInRealGame`, `tableInteractions`, `zoneInteractions`);
- since prompt 49 the stage `opponent-stage` (with `data-step`, `data-kind`,
  `data-actor`, `data-cards`, since 2026-10-14 `data-stage-mode` instead of
  the status line's `data-stage-status`; `data-stage-card`, `data-stage-next`,
  `data-stage-count`, the timer `.table-stage-timer`), since 2026-10-14 the
  "Zuletzt" line `last-move` (`data-rests`; never inside the stage, never
  with `data-stage-next`), the band `turn-band`
  (`data-seat`), the header badge's `data-observing`, the decision's
  `data-interrupt` and the regions "Gegnerzug ansehen" / "Aufgezeichnete
  Aktion" (end-to-end `opponentTurnInRealGame`);
- since prompt 50 the start hand's slots `hand-spread` (with
  `hand-spread-overlay`, `hand-spread-close`, `hand-spread-header`,
  `hand-spread-grid` with `data-columns` and `data-scroll`,
  `hand-spread-item`, `hand-spread-card`, `hand-spread-footer`), its cards'
  `data-start-hand-card`, the buttons `data-bottom-toggle`,
  `data-start-answer` (Forge's button number) in the group with
  `data-start-question`, the count `data-start-hand-chosen`, the decision's
  `data-start-hand-open` ("Starthand ansehen"), and in the card view
  `card-view-position`, `data-swipe` and the groups "Deine Hand durchsehen" /
  "Karten durchsehen" (end-to-end `startHandHarness`,
  `startHandInRealGame`; `startHandAway` for the other real games);
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
| 46 | after the series: drag and drop of hand cards onto the battlefield | §4.10 |
| 47 | after the series: the card view in full screen with its keywords explained | §3.4, §4.16 |
| 49 | series *openmana-spielfluss*: the opponent's turn on a stage, tempo, "Weiter", turn band | §4.17 |
| 53 | series *stoneboard* 1/4: the arena as a shadow grid (subgrid), its ground, the new default | §4.1b |
| 54 | series *stoneboard* 2/4: swings, centre line, runes, tendrils, light dust, island of light after the template | §4.1b |
| 55 | series *stoneboard* 3/4: the matrix of sizes and scenes, reduction where room is short, nothing moves | §4.1b, §8 |
| 56 | series *stoneboard* 4/4: the drawn table, the pictures and the setting removed; the complete check | §4.1, §4.1a, §4.1b, §5 |

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
- 2026-10-10, prompt 38: the three layouts on `GameBoard` (§3.2 "Built"),
  `breit` in a low window as before; the decision's growth per layout
  (§3.3); the Sheets by layout (§3.4); the regions' page order = `hoch`'s;
  the surface's centre line on the gap between the battlefields; the
  foldable's three sizes checked in every scene. Look of cards, strips, hand
  and chronicle unchanged (prompts 39-42).
- 2026-10-10, prompt 39: the header (§4.2: emblem, wordmark, symbol buttons,
  turn line "Zug N · Dein Zug"), the strips with the life medallion (§4.3),
  zone piles and counters that open the zone view (§4.4), OpenMana's card
  back for every hidden card (§4.5) and the opponent's hand as backs (§4.6);
  the strips lie on the board. Cards, chronicle, panels and hand unchanged
  (prompts 40-42).
- 2026-10-10, prompt 40: the cards on the battlefields (§4.7-4.9) - the
  plaque with Forge's power/toughness or loyalty on the printed value box
  (upright when tapped, from 44 px), the facts as chips above the picture,
  piles as cards behind each other with "×N", marks as glowing frames
  (target pulsing, attacking amber and moved forward, blocking mana blue),
  rows sizing their cards by height and width; no line between the rows.
  Chronicle, panels and hand unchanged (prompts 41-42).
- 2026-10-11, prompt 41: the panels (§4.12), the Zauberchronik with the stack
  as entries and the combat as short lines (§4.11), the Phasen-Tafel with the
  turn's phases and Forge's question beside the battlefields and the action
  bar with the compact phases in `hoch` (§4.13), the main button and the
  answers' bar (§4.14); the phases left the header. Hand unchanged (prompt
  42), arrows in prompt 43.
- 2026-10-11, prompt 42: the hand as a fan (§4.10 "Built") - overlapping,
  turned and on an arc, sinking below the edge; the card under the mouse, a
  swiping thumb (by the cards' own strips) or the keyboard's focus rises
  whole above the hand at a full card's size; a tap is the lifted card's, a
  swipe nothing, a long press looks; 24 px of every card its own, smaller
  cards and then a scrolling row for many; the hand's height in `quadrat`
  and `breit` the mockup's. Arrows in prompt 43, animations in 44.
- 2026-10-11, prompt 43: the arrows (§4.15 "Built") - red from a chronicle
  entry to its targets (the top entry's strong, the others muted), amber from
  an attacker to whom it attacks, mana blue from a blocker to its attacker;
  each head beside its end, never on a card picture, only between things in
  view; glowing and flowing in opacity, still under less motion; drawn again
  for a state, a size, a scroll. Animations in prompt 44.
- 2026-10-11, prompt 44: the motion (§8 "Built") - cards travel by their id
  (library → hand, hand → battlefield or Zauberchronik, stack → graveyard,
  battlefield → graveyard), shift in their rows, turn when tapped, move
  forward to attack; damage flashes and shakes, life totals pulse red or
  green, Zauberchronik entries glide in and dissolve, the phases' gold glides,
  the main button shimmers at a new priority; over the new state, which is
  usable at once; nothing moves under less motion, a replay animates only
  stepping. Review and polish in prompt 45.
- 2026-10-11, prompt 45: the review of the whole table (`docs/implementation/45-table-redesign-review.md`) -
  every layout and size, the recorded and built scenes, real games against
  Forge (also Commander, on a phone and at 4x CPU), the replay, the
  foldable's sizes changed mid-game; the deviations from the mockup below
  (§14); the keyboard through the whole table and the screen-reader names
  (§6); memory over a game (§9) - Chrome kept the table's lazily sized
  pictures alive after they left the page, fixed in `CardPicture`; in a low
  wide window the decision lies above the arrows. The mockup is superseded
  by the built table and stays as a reference. The series is complete; the
  project owner checks the table on the Fold and inside ORYX once he has
  allowed a push.
- 2026-10-12, after the series (prompt 46): drag and drop (§4.10 "Built
  (prompt 46)") - a hand card dragged up out of the hand onto the
  battlefields or the middle is played (Forge's tap, the card view's
  guards); the regions glow golden for a card Forge would play; otherwise the
  card glides back and nothing is sent; Escape, a second finger or
  pointercancel cancel; the travel of the next state starts where the card
  was let go. Tap, long press, mouse and keyboard unchanged.
- 2026-10-12, after the series (prompt 47): the card view in full screen
  (§4.16) - the darkened table, the card as large as the room allows, the
  boxes explaining Forge's keywords for it in German beside or below it,
  Forge's one button under it; protocol 9 carries the keywords; a new engine
  and catalog release; pushed together with prompt 46.
- 2026-10-13, series *openmana-spielfluss* (prompt 49): the opponent's turn
  (§4.17) - every held action of the AI on the stage over the player's half,
  at the chosen tempo or stepwise with "Weiter"; changes of turn as a stage
  step or a band; the interruption line; Forge's auto-pass in the settings;
  the replay's read-only stage. Local only; published with prompt 52.
- 2026-10-14, the project owner's wishes (3) and (4): the stage a compact,
  quiet announcement between the battlefields (small card previews, quiet
  words, "Weiter" gold only stepwise, no repeated status line), and the
  "Zuletzt" line with the latest move of either player (§4.17, §4.11).
  Local only.
- 2026-10-14, the project owner: the zone view redesigned (§4.20) - a
  compact switcher of two toggle groups, the cards as a grid of whole
  pictures grouped "×N" like the table's piles, graveyard and exile newest
  first with a "zuletzt" badge, Forge's usable frame and offer, the shadcn
  `Empty`; the card view browses the zone in that order.
- 2026-10-14, series *stoneboard* (prompt 53, Claude Fable 5.1): the arena
  (§4.1b) as a shadow grid under the board - `ArenaSurface`, a subgrid of
  the `GameBoard` grid, its ground after the binding template (stone,
  vignette, warm light above, cool blue below, grain, cracks), the cells of
  the opponent's strip, the playing area and the hand placed and empty;
  `display.tableBackground` knows `arena` and defaults to it; the drawn
  table, the pictures and the player's own picture stay choosable until
  prompt 56. Measured in Chrome: every region and card at the same place as
  over the drawn table (0 px at M5), no containment allowed on the subgrid.
- 2026-10-14, series *stoneboard* (prompt 54): the arena dressed after the
  template - golden swings at the hand and the opponent's strip, the centre
  line, ten runes, two tendrils, light dust, the island of light; the
  opponent's runes moved between chips, medallion and piles and hidden on
  narrow strips (0 collisions with cards, chips or buttons at M5 in three
  scenes); null-filter version proven; still 0 px against the drawn table.
- 2026-10-14, series *stoneboard* (prompt 55): the arena responsive and
  still - reduction by room (hand cell under 30 rem/7 rem, opponent's strip
  under 48 rem, a scrolling hand) on the decoration pieces only; six dust
  points moved off the hand at 480 px; 18 sizes × 5 scenes and hands of
  0/1/7/20 measured at 0 px; no motion, proven under both less-motion
  settings.
- 2026-10-14, series *stoneboard* (prompt 56): the drawn wooden table
  (§4.1), the three pictures, the player's own picture and the setting
  "Spieltisch-Hintergrund" (§4.1a) removed; the arena is the only surface;
  migration 6 retires `display.tableBackground` and
  `display.tableBackgroundImage` (deleted on upgrade, left out of backups);
  the tokens `--table-wood` and `--table-wood-frame` gone; the complete
  check and the readiness games run on the whole.

## 14. Deviations from the mockup (prompt 45)

The built table compared with the mockup at the eight end-to-end sizes and
the foldable's three, the mockup's "Konzept" scene beside the recorded
scenes and its "Voller Tisch" beside the fullest (`commander-late`,
`blockers`). Pictures: Seafile
`/repo/openmana/design/spieltisch-umsetzung/45/` (never committed). Small
differences were fixed in the prompts 37-44 and 45; what remains is
deliberate:

| Where | Mockup | Built | Why |
|---|---|---|---|
| Data | example cards, life totals, turn 7/14, chronicle texts, "Gegner" | Forge's state; "Forge-KI" on the name band; Forge's own words in its prompt (also English ones and Forge's own slips, e.g. "attack null") | Forge is the only authority; no invented data (§2) |
| Header | "Friedhof", "Exil", "Protokoll", "Einstellungen" as buttons, the turn at the right | "Zonen ansehen", "Spielverlauf ansehen" (words in `breit`), the turn line inside the help button in the middle, the status badge "Du bist dran" / "Forge rechnet", the menu | the menu, the strips' piles and the zone view cover the rest; a button's name contains its words (WCAG 2.5.3); help opens from the turn/phase area. On a phone (`hoch` below 480 px) the turn line wraps and Forge's step is cut with "…" (its full name is the title, the action bar shows it again) |
| Strips | life, hand count, library and graveyard | also profile, priority, "verloren", mana pool, counters, commander tax and damage as chips; exile and command zone as counters | Forge reports them; the mockup shows none |
| Cards | picture with the plaque only | chips above the picture (damage, counters, combat, "Ziel", "Quelle", "×N"); piles as plates behind, at most two; both rows of a battlefield equally high and cards centred; at least 44 px wide on every input device | the facts stay out of the picture (Scryfall); measured two-row threshold of prompt 38 |
| Marks | `.spielbar` outline, `zielpuls` on `box-shadow` | Forge's marks as frames and glows; pulses and flowing arrows only in opacity | §7, §8 rule 2 |
| Hand | CSS `:hover`, touch by the card's centre, no lower bound | lifted by each card's own strip (mouse, thumb, keyboard), at least 24 px per card, then smaller cards, then a scrolling row; the mockup's height only in `quadrat`/`breit` | a choice that never jumps; the small phone keeps 80 px per battlefield |
| Zauberchronik | entries with target words | also kind, controller and Forge's text; combat as short lines; in `hoch` a bar, empty only a gold line | Forge's stack and combat in words |
| Phasen-Tafel | short phase names, the main button only | Magic's German phase names, Forge's question between the phases and the main button, at least 15 rem wide | Forge's questions need the room with 44 px controls |
| `breit` | the hand across all three columns | both side columns full height, the hand between them | the decision column keeps its height |
| `breit` + `short` (phone turned) | - | the side column of prompts 13-24 (opponent, chronicle, decision, you); the decision above the arrows, an arrow passes under it (prompt 45) | about 130 px per battlefield instead of 100; an arrow no longer lies over Forge's question and the main button |
| Arrows | gradients, SVG markers, fixed end beside the card, `stroke-dashoffset` flow | token colours, drawn heads at a free place beside the end (never on a picture), three dash phases in opacity; muted arrows for lower stack entries, block arrows, arrows to planeswalkers and zone piles | §4.15, §8 |
| Motion | none for state changes | travelling, shifting, turning cards, damage, life, chronicle and phase motion (§8 "Built") | the series' prompt 44 |
| Surface | stone floor, props, crystals, vines, variants | the wooden desk only; the emblem does not glimmer | §7 |
