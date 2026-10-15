# 59 — Menu style: every page

Prompt 59, step 3 of 4 of the series *openmana-menuestil* (Dropzone
`fixed/serien/openmana-menuestil.md`, plan `workflow/OPENMANA-MENUESTIL-MASTERPLAN.md`,
template `workflow/OPENMANA-MENUESTIL-VORLAGE.html`, version **"Reich"**). Run
`openmana-menuestil-20261015T032816Z`, Claude Opus 5.5 with effort `high` as a
`dmm-worker`. Local commit only; no push, no deployment (Vercel project).

## What changed

The pages take the template's look only from the building blocks of 57/58.
What a page missed became a variant of a component (Design System rule 3,
`docs/DESIGN_SYSTEM.md` §10 "Built in prompt 59"), never page styling.

- **Start** (`src/routes/home-page.tsx`, `src/components/brand.tsx`): the hero
  is the large emblem in its gold glow (`Emblem glow`, token
  `drop-shadow-gold-halo`, the template's `.hero svg`) beside the wordmark, the
  `OrnamentDivider` under it; "Spielen" golden; "So geht es los" a panel with
  the steps numbered in gold rings (`ItemMedia variant="number"`, aria-hidden -
  the list's order says it); "Dieses Gerät" a row on the well with its check in
  a gold ring (the sentence unchanged). Panels keep their own height.
- **Decks** (`src/routes/decks-page.tsx`): the library is a grid of panels
  (2 columns on a phone, 3 from `sm`, 4 from `lg`), each `Card asChild` around
  the deck's link: the title card as a whole picture (`CardPicture`, Scryfall's
  `grid` size, never cropped; the deck symbol in a gold ring without one), the
  name as `CardTitle` (Cinzel gold, long names wrap), format and counts, the
  badges, the date. Search, filters, sorting, import and the empty states were
  already in the style (58) and stay.
- **Other pages** (play, matches, replay frame, settings, credits, deck details,
  import, update, 404, "Deck nicht gefunden", error): they already compose
  `PageHeader`, `Card`, `Item`, `Empty`, `Button` and take the look from 58.
  No page nests a `Card` in a `Card`; long lists (matches, AI profiles, a
  deck's cards) are rows on the well inside one panel. `PageLoading` keeps a
  page's shape (title place with the ornament line, a panel's place).
- **Components** (all commented in place):
  - `Card` `asChild` (Radix `Slot` with `Slottable`, the corners inside the
    child); a link card shows the focus ring around the whole panel and, outside
    the board, `--gold-edge` on hover (`transition-shadow`, stopped under less
    motion).
  - `ItemMedia` variant `number`.
  - `ItemDescription`: outside the board never cut off after two lines
    (`menu:line-clamp-none`) - the step "Gegner wählen" was cut on a phone.
  - `Badge`: outside the board a too long badge wraps in its pill (one line keeps
    20 px) - a commander's name on a narrow tile was cut.
  - `Alert`: outside the board on `--panel-well`, the plain one inside the gold
    hairline.
  - `ActionBar`: the dock's tone falling darker with the gold hairline.
  - `Emblem` `glow`.
- Texts, flows, routes, roles and names unchanged; no new motion; the game
  table untouched.

## Page code without own colours or effects

Searched in every page and page component (`src/routes`, `src/decks`,
`src/matches`, `src/cards`, `src/storage`, `src/app` without the shell, tests
excluded): no raw colour (`#…`, `oklch`, `rgb`), no arbitrary value (`[…]`),
no gradient (`bg-linear`, `from-`, `via-`, `to-`), no shadow, no menu-style
token (`gold-*`, `panel*`). What remains are the text token classes the
Design System allows in pages (§1): `text-muted-foreground` and `text-primary`
(the latter in four places that were there before; the start page's one is gone).

## Tests

- `src/components/ui/ornament.test.tsx`: `Card asChild` (link is the panel,
  corners inside, focus ring and gold hover line), `ItemMedia number`,
  `ItemDescription` and `Badge` wrapping, `Alert` on the well, `Emblem glow`;
  the scope guard covers `Card asChild`, `ItemMedia number` and both alerts.
- `src/app/design-tokens.test.ts`: a notice's words (plain, muted, destructive)
  4.5:1 on every well; the tile's hover line 3:1 against the page.
- `src/decks/deck-library.test.tsx`, `src/storage/local-data.test.tsx`: a deck
  is a tile - the link is the `Card`, its name the card title (roles, names and
  texts unchanged).

## Verification (targeted, series rule; the complete check is prompt 60)

- `npx tsc -b`, `npx oxlint`: clean.
- `npx vitest related --run <changed sources>`: 33 files, 493 tests green (`--maxWorkers=8`; at full parallelism under a machine load of about 14 one 5 s timeout of the catalog install in `card-data.test.tsx`, green alone and at 8 workers); the suites of tokens, motion, app shell, components, decks, routes and the game: 27 files, 589 tests green.
- Browser (Chromium via Playwright, `OPENMANA_ENGINE=omit` dev server): eleven
  pages (start, decks with 9 decks and a very long name, a deck, import, play,
  matches with 6 replays and a long name, replay, settings, credits, 404, a
  missing deck) at 412×915, 915×412, 884×1104, 1280×800 and the zoom-200 %
  equivalents 640×400 and 457×206, with data and without: no sideways overflow,
  no control or tile off screen, no cut-off text (line clamp, ellipsis or hidden
  overflow; screen-reader-only text excluded), axe serious/critical 0, visible
  focus on the first eight Tab stops, the corners never hit by a click.
- **The table:** seven recorded scenes at the four sizes against prompt 58:
  every difference within the noise of two runs (card pictures).
- Contact sheets: Seafile `/repo/openmana/design/menue-stil/59/`.

## Assumptions (changeable)

- The steps' numbers are decoration (`aria-hidden`); the list says the order.
- "Dieses Gerät" keeps its sentence as the row's title instead of the
  template's "Forge-Engine bereit" (no text changes).
- Deck tiles keep every fact of the former rows (badges, date); the template
  shows only name and format.
- Hero emblem `size-20`, from `md` `size-24` (template 4.2 rem; the app's hero
  was larger before and stays generous).
- Descriptions and badges wrap everywhere outside the board, also in sheets and
  dialogs.

## Limits

- Physical Fold/ORYX not checked (emulated sizes); browser zoom emulated by the
  halved CSS viewport.
- The route error page was not provoked in the browser (it composes `Page`,
  `Alert` and `Button` only).
- The complete `npm run check` is prompt 60.
