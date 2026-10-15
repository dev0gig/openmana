# 57 — Menu style: foundation and app frame

Prompt 57, step 1 of 4 of the series *openmana-menuestil* (Dropzone
`fixed/serien/openmana-menuestil.md`, plan `workflow/OPENMANA-MENUESTIL-MASTERPLAN.md`,
template `workflow/OPENMANA-MENUESTIL-VORLAGE.html`, version **"Reich"** - the
project owner's choice of 2026-10-15). Run `openmana-menuestil-20261015T032816Z`,
Claude Opus 5.5 with effort `high` as a `dmm-worker`. Local commit only; no
push, no deployment (Vercel project).

## What changed

- **Tokens** (`src/index.css`): `--gold-light`, `--gold-dark`, `--gold-line`,
  `--panel` (aliases of the `--table-*` tokens), `--panel-shade`, `--bar-top`/
  `--bar-bottom`, `--rail-top`/`--rail-bottom`, `--dock-top`/`--dock-bottom`
  (`--panel` mixed with black: 30 %, 25/45 %, 20/40 %, 35/60 % - the template's
  values), `--gold-glow` (`--primary` 16 %), `--surface-cool`
  (`--table-mana` mixed with `--background`). No new hue. Mapped for Tailwind
  (`--color-*`), plus `--shadow-gold-glow` and `--drop-shadow-gold-glow`.
- **Emblem** (`src/components/ui/emblem.tsx`): `Emblem` (an SVG with its own
  gold gradient per instance, `useId`), `EmblemShapes`, `EmblemGold`,
  `Wordmark`. The table uses them: `TableEmblem` renders `Emblem`; `TableArt`'s
  emblem symbol (inside the card back) draws `EmblemShapes`, and its gold
  gradient `table-art-gold` is `EmblemGold` - one drawing, one gold.
- **Brand** (`src/components/brand.tsx`): emblem + gold wordmark instead of
  `/icons/icon-192.png` (top bar, sidebar, start page). App icon files,
  manifest and PWA untouched (`git diff 4c64434 -- public/` empty).
- **Top bar** (`src/components/ui/app-header.tsx`): `AppHeader` (bar tone, gold
  hairline, sticky as before) and `appHeaderButtonVariants()` for the round,
  gold-lined symbol buttons (settings, sidebar trigger).
- **Navigation**: `BottomNav` in the dock tone with a gold hairline; the
  current `BottomNavItem` in `--gold-light`, a gold halo round the symbol, a
  glowing 2 px gold line above it. Sidebar (`src/components/ui/sidebar.tsx`)
  in the rail tone with a gold hairline; `SidebarHeader` continues the top bar
  (48 px, bar tone, gold hairline); the current `SidebarMenuButton` gold with a
  gold shimmer fading right and a glowing 3 px gold line on its left. Both
  marks are keyed to `aria-current="page"` (set from `isActive` unless the
  `NavLink` child sets it itself) - the former `data-active` colours are gone,
  `data-active` stays as an attribute.
- **Background shimmer** (`src/components/ui/app-surface.tsx`): `AppSurface`,
  an SVG stretched over the window - the template's two radial lights
  (unit circles moved and scaled, so the CSS percentages carry over) and the
  two pairs of golden swings (non-scaling 1.2 px strokes) - `fixed inset-0
  z-0`, `aria-hidden`, `pointer-events-none`, no motion. The app shell places
  it once as the first child of `SidebarInset`, only when not immersive (no
  game, no replay); the content column became `relative`, so it paints above.
- **Docs**: `docs/DESIGN_SYSTEM.md` §1 (menu style), §2 (identity rows "App
  icon", "Mark in the app", "Menu style"), §3 rule 1 (the one page-level
  effect) and rule 3 (the central changes), §4, §5 (inventory), new §10;
  `AGENTS.md` User Interface Rules; `docs/design/SPIELTISCH.md` §4.2 (the shared
  emblem).

## Verification

Targeted checks of this diff (series rule; `npm run check` runs once in
prompt 60):

- `npx tsc -b` exit 0, `npx oxlint` exit 0.
- `npx vitest run` on `design-tokens`, `motion`, `app`, `immersive`,
  `boundary`, `emblem` (new), `game-board`, `game-table`, `arena-surface`:
  9 files, 232 tests green. New: the menu style's tokens are derived only and
  mapped; text on both ends of every bar (foreground, muted, gold-light,
  primary) ≥ 4.5:1, the active sidebar entry on its shimmer ≥ 4.5:1, the round
  button ≥ 4.5:1, mark and focus ring ≥ 3:1 (40 new cases); `Emblem`/`Wordmark`/
  `AppSurface` decorative; aria-current and the mark in both navigations
  (also on a sub-path); emblem instead of the app icon; the shimmer once
  behind a page and never under the table. `game-table.test.tsx` now finds
  the header's emblem as `svg[data-slot="emblem"]` instead of
  `use[href="#table-art-emblem"]` (the symbol stays for the card back; the
  end-to-end count of the three symbols is unchanged).
- Browser (Chromium via Playwright, `OPENMANA_ENGINE=omit` dev server with the
  real card catalog), six pages × 412×915, 915×412, 884×1104, 1280×800 against
  the baseline `4c64434` served from an archive: document heights unchanged
  (only Settings/Credits at 412 px differ by one line - the version line, the
  baseline archive has no Git), no horizontal overflow, no new document
  scroll, `elementFromPoint` never hits the shimmer (0 of 720-1960 points per
  view), axe-core serious/critical 0 before and after, the first four Tab stops
  with the gold focus ring, the active mark's line `oklch(0.8 0.12 80)` with a
  10 px glow.
- The table before/after the emblem's move: three recorded scenes at the four
  sizes against the baseline - the header strip pixel-identical in 12 of 12;
  the rest differs only where two runs of the same commit differ too (card
  pictures, the arena's grain: 194 300 px baseline↔after, 204 251 px
  baseline↔baseline).
- Contact sheets in Seafile `/repo/openmana/design/menue-stil/57/`:
  `57-huelle-handy.png`, `57-huelle-breit.png` (before, after, template),
  `57-tisch-vorher-nachher.png`.

## Decisions and notes for 58

- The template's wide header spans the window with the brand in it; the app
  keeps its structure (brand in the sidebar's head), and the sidebar's head
  takes the bar's height, tone and line, so the bar reads as one.
- The template's sidebar label "Menü" is not taken over (no new texts).
- The start page's hero now shows the emblem (through `Brand`) without the
  template's gold glow - that and the ornament under titles are prompt 59/58.
- Wordmark `text-xl` in the bars (template 1.35 rem), emblem `size-8`.
- For 58: `--panel`, `--panel-shade`, `--gold-*` are ready for `Card` (panel
  gradient, corners), `Button` (gold gradient: `--gold-light` → `--primary` →
  `--gold-dark`), inputs (`--gold-line`) and number rings (`--panel-shade`).
