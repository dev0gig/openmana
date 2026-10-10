# 36 — Table redesign: foundation (specification, rules, tokens, layout classes)

## Scope and authority

First prompt of the table redesign series 36–45 (project owner, 2026-10-10:
concept picture, static mockup `docs/design/spieltisch-vorlage/` approved in
four rounds). It lays the foundation **without any visible change**: no
component, page or region of the table looks or behaves differently. Forge
remains the sole authority; no engine, bridge, protocol, storage, recording
or replay change.

## What was added

- **Specification** [`docs/design/SPIELTISCH.md`](../design/SPIELTISCH.md):
  target picture, scope, the three layouts with grid plans and the mapping of
  the eight regions (`center` = Zauberchronik, `decision` = Phasen-Tafel with
  Forge's question and the main button / action bar at the bottom in `hoch`),
  every building block with its mockup source, data, anchors and prompt,
  tokens with contrasts, accessibility, what the mockup's details are not
  taken over (props, crystals, variants, example values), motion principles,
  performance budget, the anchors that stay, and the follow-up prompts 37–45.
- **Rules** changed in `AGENTS.md` and `docs/DESIGN_SYSTEM.md` (replaced, not
  only added - list below).
- **Layout classes** by aspect ratio: `hoch` (< 3:4), `quadrat` (3:4–13:10,
  both borders included), `breit` (> 13:10).
  - `src/game/table/table-layout.ts`: `TableLayout`, `TABLE_LAYOUTS`,
    `TABLE_LAYOUT_QUERIES` (`(aspect-ratio < 3/4)`,
    `(3/4 <= aspect-ratio <= 13/10)`, `(aspect-ratio > 13/10)`),
    `tableLayoutOf(width, height)` in whole numbers. Free of imports, so the
    end-to-end test imports it in Node.
  - `src/game/table/use-table-layout.ts`: `useTableLayout()` -
    `useSyncExternalStore` over the three media query lists (asked once per
    `matchMedia`), "hoch" without a screen or an answering query (jsdom), like
    `useLandscape()` answers portrait there.
  - `src/index.css`: `@custom-variant hoch|quadrat|breit` with the same
    queries, beside `short`.
  - Not used by the table yet (prompt 38 switches `GameBoard` and the Sheets).
- **Table tokens** in `:root` of `src/index.css`, mapped as
  `--color-table-*`: `--table-gold-light`, `--table-gold-dark`,
  `--table-gold-line` (38 % alpha, decoration), `--table-mana`,
  `--table-danger`, `--table-attack`, `--table-wood`, `--table-wood-frame`,
  `--table-leather`, `--table-panel`, `--table-plaque`. Values from the
  mockup (`tisch.css`, `arkan.js`), surfaces at their lightest tone.
- **`src/game/table/table.css`**: the table's one stylesheet, so far only its
  header (scope and rules) and the two less-motion blocks; **not imported**
  (prompt 37 imports it).
- **Lint:** `.oxlintrc.json` ignores `docs/design/spieltisch-vorlage/**`. The
  mockup's classic scripts share globals across files (`KARTEN`,
  `Tischflaeche`), which oxlint reported as unused - `npm run check` failed at
  oxlint since the mockup was committed. It is reference material, never part
  of the app.
- `game-table.tsx`: only the hand's comment no longer calls "never fanned" a
  rule (prompt 42 fans the hand).

## Tests

- `src/game/table/table-layout.test.tsx` (new): the eight end-to-end sizes and
  the Fold's three (480 × 1040 `hoch`, 870 × 960 and 960 × 870 `quadrat`), the
  borders 299/300 × 400 and 1300/1301 × 1000, exactly one layout over a grid of
  sizes from 200 to 2000 px, the CSS variants in `src/index.css` identical to
  `TABLE_LAYOUT_QUERIES`, and `useTableLayout()` with a stand-in `matchMedia`
  that evaluates exactly those queries: every size, live changes (fold,
  unfold, turn), listeners removed on unmount, "hoch" without answers.
- `src/app/design-tokens.test.ts`: every table token present and mapped;
  text 4.5:1 on the table's surfaces (foreground, muted, gold and gold-light
  on panel, plaque, leather, wood; text on gold) and marks 3:1 (gold,
  foreground, gold-light, danger, attack, mana on leather, wood frame, panel,
  plaque). Weakest pair: `--table-danger` on `--table-wood-frame` 3.95:1.
- `src/app/motion.test.ts` extended to the table:
  - `src/` has exactly two stylesheets, `index.css` and
    `src/game/table/table.css`;
  - table.css: every rule under `[data-slot="game-board"]`, transitions and
    keyframes only of transform/opacity (`translate`, `rotate`, `scale`
    included; `transition: all` or without a property refused), every
    animation has its keyframes in the file, no other `!important` motion,
    and both less-motion blocks (prefers-reduced-motion and
    `:where([data-reduced-motion])`) stop the board, its descendants and
    their `::before`/`::after`;
  - components in `src/game/table/**`: the existing motion-reduce class rule,
    no inline animation/transition styles, no SVG (SMIL) animation,
    `element.animate()` only with `src/app/motion.ts`;
  - the checks themselves are tested on built examples (allowed motion
    passes; unscoped rules, `all`, box-shadow/outline/stroke-dashoffset
    motion, missing keyframes, stray `!important`, a missing block or
    pseudo-element are found), because the table has no motion yet.
- **End-to-end section 12** (`scripts/e2e/run.ts`, `tableLayoutClasses`): a
  probe page (`scripts/e2e/table-layout-probe.html`,
  `src/test/table-layout-probe.tsx`, test-only) in real Chrome, resized
  through the eight sizes, the Fold's three and the four border sizes: the
  hook's answer, the CSS variant the compiled stylesheet applies (`order`
  1/2/3), the browser's media queries (exactly one matches) and
  `tableLayoutOf()` agree with the expected layout; the eight sizes are
  checked against `TABLE_VIEWPORTS` so they cannot drift. Result in
  `report.json` → `gameTable.layouts`.

## Rules changed

`AGENTS.md`:
- User Interface Rules: new exception for the game table (own CSS/SVG in
  `src/game/table/` and `table.css` under `[data-slot="game-board"]`; Sheets,
  Dialogs, menus and card view stay shadcn).
- Card Data Rules: pictures never cropped, blurred, darkened, colour-shifted
  or filtered; nothing over them except the table's value plaque.
- Game Table Rules: reference to the specification; "Nothing is drawn over a
  card picture" replaced by the plaque rule and chips outside the picture;
  "eight regions (portrait: stacked; landscape: side column)" replaced by the
  layouts by aspect ratio (orientation until prompt 38); new rule on the
  table's own CSS (anchors, redraw on resize only, 200 ms budget).
- Card Interaction Rules: marks may glow, have own colours (target, attack,
  block), stay `data-mark`, 3:1, never colour alone; new rule: the hand
  becomes a fan (replacing "never fanned").
- Priority, Stack and Turn Rules: the steps move from the header into the
  Phasen-Tafel (prompt 41).
- Block Rules: "nothing covers a picture" now names the plaque exception.
- Preferences Rules: the motion-reduce rule covers `src/game/table/**`; new
  rule for table motion (transform/opacity, never delaying input or state,
  nothing under less motion, presentation never narration).

`docs/DESIGN_SYSTEM.md`:
- §1 Components and §3 rule 1: shadcn-only except the game table (§9).
- §2 Identity: the game table's look.
- §3 rule 8 Motion: "the table has none" replaced by the table's motion
  rules.
- §4 Layout: the orientation table replaced by the three layouts (the old
  arrangement named as the state until prompt 38); phases move to the
  Phasen-Tafel (prompt 41).
- §5 Inventory: `GameBoard`, `GameCard`, marks updated; new rows for the
  layout hook/variants and table.css/tokens.
- §6 Adding things: "Nothing is drawn over a card picture" and the card
  states rule replaced (plaque, own colours for target/attack/block).
- §7 Targets: the double frame becomes a red pulse in prompt 40.
- §8 Responsive: eight regions, arranged by layout.
- §9 new: the game table exception (scope, tokens, layouts, pictures, fan,
  marks, motion).

## Assumptions (unattended run)

- Variant names are the layout names themselves (`hoch:`, `quadrat:`,
  `breit:`), like `short:`; the borders 3:4 and 13:10 belong to `quadrat`
  (the shared rules: "3:4 bis 13:10").
- Token names: `--table-danger` for "Gefahr/Ziel-Rot" (also the opponent's
  chronicle dot), `--table-wood-frame` and `--table-plaque` added beside the
  listed ones because the frame and the plaque carry text and marks and need
  a contrast test; gold stays `--primary`, text on gold
  `--primary-foreground` (no duplicate token).
- `--table-mana` is proposed for blocking frames and block arrows; prompts 40
  and 43 decide.
- The motion rule "only transform/opacity" is enforced strictly; the mockup's
  `box-shadow` pulse and `stroke-dashoffset` arrow flow get opacity-based
  equivalents (SPIELTISCH.md §8).
- `table.css` is created now (with its less-motion blocks) but not imported,
  so the motion test checks a real file and nothing on screen changes.

## Verification

See the central Dropzone report of prompt 36 for commands and results:
focused Vitest files, typecheck, oxlint, the focused combat end-to-end run
(layout classes in real Chrome at all 15 sizes), the complete `npm run check`
and a pixel comparison of the end-to-end screenshots with the previous run
(no visible change).
