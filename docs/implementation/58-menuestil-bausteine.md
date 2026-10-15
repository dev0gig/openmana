# 58 — Menu style: building blocks as panels

Prompt 58, step 2 of 4 of the series *openmana-menuestil* (Dropzone
`fixed/serien/openmana-menuestil.md`, plan `workflow/OPENMANA-MENUESTIL-MASTERPLAN.md`,
template `workflow/OPENMANA-MENUESTIL-VORLAGE.html`, version **"Reich"**). Run
`openmana-menuestil-20261015T032816Z`, Claude Opus 5.5 with effort `high` as a
`dmm-worker`. Local commit only; no push, no deployment (Vercel project).

## What changed

The shadcn components carry the game table's look themselves - centrally,
never per page (Design System rule 3). The list of variants and where they
apply is the table in `docs/DESIGN_SYSTEM.md` §10 ("Built in prompt 58").

- **Scope `menu:`** (`src/index.css`): `@custom-variant menu
  (&:not([data-slot="game-board"] *))`. Inline components (Card, Button,
  Badge, Input, Textarea, SelectTrigger, Checkbox, RadioGroupItem, Switch,
  FieldLabel, Toggle, Item, ItemMedia, Empty) add their new look under it;
  inside the game table's board they keep the registry's look, which
  `table.css` builds on (the main button, the decision's buttons and choice
  cards, the header's badges). Not `:where()`: the variant must outweigh the
  components' `dark:` classes (the app is always dark); where it changes a
  border, a component restates `focus-visible:border-ring` and
  `aria-invalid:border-destructive` under it. `appHeaderButtonVariants()`
  states its hover under `menu:` so the ghost's new gold hover does not
  replace the bar's panel tone.
- **Overlays** are portalled out of the board and take the look directly:
  `DialogContent`/`AlertDialogContent` (panel falling darker, gold hairline,
  `shadow-panel`, gold titles; no corners - a long dialog scrolls), `SheetContent`
  (flat `--panel`, gold edge, gold title), `DropdownMenuContent`,
  `SelectContent` and its scroll buttons, `TooltipContent` (no longer
  inverted), the toaster (`--panel`, `--gold-line`). The zone view's sticky
  footer follows the sheet's tone (`bg-panel`).
- **Tokens:** `--gold-edge` (form controls' boundary, 3:1), `--gold-deep`
  (the golden button's foot, the table main button's mix), `--panel-well`
  (black 24 %); `shadow-panel`, `shadow-panel-flat`, `shadow-gold-button`.
- **Ornaments** (`src/components/ui/ornament.tsx`): `OrnamentCorner` (the
  table's corner from `table.css`, drawn as SVG in `currentColor`) and
  `OrnamentDivider`. `Card` draws two corners after its children (the
  registry's first-child rules hold); `PageHeader` puts the divider under its
  `h1`.
- **Card variant `plain`:** the same panel without corners and drop shadow,
  chosen for dense or nested use. Used now by the card view's keyword boxes
  (`src/game/card-view.tsx`); nested cards on pages follow in prompt 59.
- Texts, flows, sizes and touch targets unchanged; no new motion (the golden
  button's hover brightness runs on the registry's `transition-all`, which
  stops under less motion).

## Tests

- `src/components/ui/ornament.test.tsx` (new): the ornaments are decoration
  (aria-hidden, no pointer, no room), Card's corners last and only under
  `menu:`, `plain` without corners, Button's golden `default` and the gold
  pills, focus ring kept, `PageHeader`'s gold title and divider, and a guard:
  every inline component names the menu style's tokens only under `menu:`, and
  `menu:` means "not inside the board".
- `src/app/design-tokens.test.ts`: the new tokens derived and mapped; button
  words on all three gold tones; text on both ends of the panel, on the
  overlays and on the wells; the boundary `--gold-edge` 3:1 against the well
  and its ground; chosen gold, focus and `--gold-light` 3:1; toggles' and
  choice cards' words on the gold shimmer.
- `src/app/motion.test.ts`: the ornaments are still; no class under `menu:`
  animates or adds a transition.

## Verification (targeted, series rule; the complete check is prompt 60)

- `npx tsc -b`, `npx oxlint`: clean.
- `npx vitest related --run <changed sources>` (31 files, 478 tests) and the
  named suites of the components, tokens, motion, app shell and the game
  (18 files, 482 tests): green.
- Browser (Chromium via Playwright, `OPENMANA_ENGINE=omit` dev server, a base
  extract of `1212588` for "before"): nine pages (start, decks, a deck, import,
  play, matches, settings, credits, 404) at 412×915, 915×412, 884×1104,
  1280×800, plus an open dialog, a dropdown, a confirmation, the help and zone
  sheets and the card view: no sideways overflow, no control off screen, axe
  serious/critical 0 (as before), visible focus on the first Tab stops, the
  corner ornaments never hit by a click.
- **The table:** seven recorded scenes (main phase, opening, attack on a
  planeswalker, choose mode, payment, built choose-many and input) at the four
  sizes against `1212588`: every difference within the noise of two runs of the
  same build (card pictures); the buttons on the board keep their computed
  look (main button "Weiter" without capitals, the decision's buttons unchanged).
- Contact sheets: Seafile `/repo/openmana/design/menue-stil/58/`.

## Limits

- Physical Fold/ORYX not checked (emulated sizes).
- The pages themselves (start hero, deck tiles, nested cards as `plain`) are
  prompt 59; the complete `npm run check` is prompt 60.
