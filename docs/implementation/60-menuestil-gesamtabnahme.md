# 60 — Menu style: acceptance of the whole

Prompt 60, step 4 of 4 of the series *openmana-menuestil* (Dropzone
`fixed/serien/openmana-menuestil.md`, plan `workflow/OPENMANA-MENUESTIL-MASTERPLAN.md`,
template `workflow/OPENMANA-MENUESTIL-VORLAGE.html`, version **"Reich"**). Run
`openmana-menuestil-20261015T032816Z`, Claude Opus 5.5 with effort `high` as a
`dmm-worker`. Local commit only; no push, no deployment, no release (Vercel
project) - the project owner releases the push after the series.

The series' commits: `1212588` (57, foundation and app frame), `0142d00` (58,
building blocks), `41ad111` (59, pages) and this prompt's commit.

## Found and fixed

- **The end-to-end test still read the deck library as rows.** Since prompt 59
  a deck is a `Card asChild` tile whose name is its `card-title`; three places
  of `scripts/e2e/run.ts` (the local data check, the deck import, the library's
  `libraryTitles`) looked for `item-title` and found nothing - 10 checks red
  (`local data: decks page lists []`, `deck import: decks listed []`,
  8 × `deck library (…): listed []`). They read `card-title` now; roles, names
  and texts of the page are unchanged. No gate was weakened.

## The complete check

`npm run check` with the locked protocol-10 engine
(`OPENMANA_ENGINE_DIR=engine/build/publish-52h/dist`, verified first with
`engine/scripts/engine-lock.mjs verify`):

- **Run 1** (series state `41ad111`): schema/generation, `tsc -b`, oxlint
  clean; **Vitest 113 files, 1 578 tests green** (at full parallelism, including
  `src/cards/card-data.test.tsx`, which prompt 59 had seen time out once under a
  machine load of about 14 - not here); end-to-end **16 red**: the 10 deck
  library checks above (the series', fixed) and 6 foreign ones (below).
- **Run 2** (with the fix) stopped after Vitest in the end-to-end test's
  first engine boot on the dev server (`Bereit` not within 180 s) - the machine
  was short of memory then (swap full, the comparison's browsers and servers of
  this prompt still open); after closing them **run 3** booted at once.
- **Run 3** (with the fix, final state): schema/generation, `tsc -b`, oxlint
  clean; **Vitest 113 files, 1 578 tests green**; end-to-end **6 red, all
  foreign** (below) - every deck library, local data and import check green,
  every table section at all sizes with axe, the keyboard tour, the gestures,
  the drags in real games, zones, the card view, the replay library, the real
  games (desktop, phone), ORYX and the layout classes passed.
- **PWA suite** (`node scripts/e2e/pwa.ts --no-build`, run by itself because
  `npm run check` stops at the end-to-end failure): **green** - complete
  SHA-verified engine download, offline deep reload with a real Forge game,
  legal documents with the server stopped, failed and verified updates with a
  live match, eviction recheck, incomplete install. Twice before it failed at
  the real download with `Cache.put() encountered a network error` while its
  Chrome profile lay in the RAM-backed `/tmp` of a machine short of memory;
  with `TMPDIR` on the disk it passed (the series touched neither `pwa/`,
  `src/pwa`, `vite/` nor the PWA test).

### Red, but not from the series (named, not hidden)

- 3 × `game table (small-phone | fold-portrait | fold-landscape, target-both):
  the decision's buttons outside the window` - the same coordinates as
  measured in prompts 53 and 56 (745–789 in 740, 790–886 in 829, 722–818 in
  690), since commit `267174a` ("Spieltisch: Karte beim Zielen und Bezahlen groß
  zeigen", 2026-10-14). The series touched neither `game-decision.tsx` nor
  the table, and the table comparison below shows the scene identical before
  and after the series at every size.
- 2 × `game failures: [requestfailed] …/engine-manifest.json net::ERR_ABORTED`
  - since `d980ca3` ("Veraltete App-Version erkennen", 2026-10-14): after the
  section's forced engine abort the app asks for its engine's manifest, and the
  test's next navigation aborts that request (prompt 56 found it). The series
  did not touch `src/engine`, `src/pwa` or the game page.
- 1 × `zones (…): [requestfailed] https://cards.scryfall.io/… net::ERR_ABORTED`
  - a card picture aborted by the next navigation (run 1 at desktop, run 3 at
  small-phone), as in prompts 55 and 56.

## The table unchanged

Every recorded scene of the end-to-end test (the 30 recorded and the 9 built
questions) at the eight sizes (412×915, 915×412, 360×740, 884×1104,
1104×884, 690×829, 829×690, 1440×900) and the foldable's three (480×1040,
870×960, 960×870) - 429 pictures each - in the harness
(`scripts/e2e/table-harness.html`), once from `4c64434` (before the series)
and once from `41ad111`, both served alike (`OPENMANA_ENGINE=omit`, the same
catalog, reduced motion, card pictures from Scryfall blocked on both sides so
pictures cannot differ by loading):

- **Place, size and computed look** (colour, background, border, radius,
  shadow, font, letter spacing, case, opacity, filter, outline) of every element
  of the board, every SVG root included: **429 of 429 equal**. The emblem's
  inner SVG markup changed in prompt 57 (one shared drawing); its root's
  place, size and look are equal. One run once caught `opponent-turn` at
  1104×884 with the decision folded; repeated twice on each side it is equal
  (a timing of the measurement, also seen between two runs of the same state).
- **Pixels:** the differences between before and after are smaller than those
  between two runs of the same state (pixels differing by more than 8 of 255:
  2 954 in all 429 pictures before/after, 143 231 between two runs of `41ad111`;
  the rest is raster noise of the arena's gradients and drop shadows, at most
  8 of 255).
- So the only deviations at the table are the ones prompt 58 documented and
  wanted: the portalled overlays in a game (help, zones and history sheets,
  the start hand dialog, the card view's button and keyword boxes, menus,
  confirmations, toasts, tooltips) take the menu style; the board does not.
  Looked at before/after at five sizes: wrapping descriptions, alerts and the
  golden buttons sit well in them; nothing is cut off.

## Pages

All 13 page states outside a game (start, decks with 9 decks and a very long
name, a deck, updating a deck's list, import, play, `/play/game` without a
game, matches, a replay, settings, credits, 404, a missing deck) at 412×915,
915×412, 884×1104 and 1280×800 as one contact sheet per size - before
(`4c64434`), after, and the template "Reich" for start and decks. The pages
match the template's look (panels with corners, golden main button, ornament
under titles, gold mark in the navigation, the shimmer); content, texts and
flows stay the app's (the template is a picture of the style, not a plan).

Browser checks (Chromium via Playwright, the same 13 states at those four sizes
and 480×1040, 870×960, 960×870, 360×740 - 104 views):

- no sideways overflow, no control or tile off screen, no cut-off text, axe
  serious/critical **0** (axe includes colour contrast), the corner ornaments
  never hit by a click. Before the series the same check found 8 views with a
  step description cut after two lines (fixed by prompt 59).
- **Keyboard tour** (every Tab stop until the focus wraps) on one page of each
  kind - start, a list (decks), a detail (a deck), a form (import), settings,
  an error page - at the four sizes: every stop shows a focus ring and has a
  name.
- **Navigation by keyboard** (each entry focused with Tab and opened with
  Enter): the gold mark and `aria-current="page"` follow at every size (tab
  bar on the phone, sidebar from `md`; the start page is linked twice in the
  sidebar - brand and entry - both marked).
- Contrast of the tokens: `src/app/design-tokens.test.ts` (in the Vitest run).

### Found, not changed (predates the series)

A focused control can lie under a fixed bar after the browser scrolled it into
view: on settings the first AI profile choice under the sticky top bar (every
size), on a phone a deck's card rows under the action bar and tab bar, and a
choice under the tab bar. Measured identically on `4c64434` (the top bar was
already sticky, the bars already fixed); WCAG 2.4.11 "focus not obscured" -
a central `scroll-padding` would solve it, a task of its own.

## Documentation

- `docs/DESIGN_SYSTEM.md` §10: "In short" - the one place that says where the
  look comes from, the two exceptions (the game table, `AppSurface`), the
  boundary `menu:` and what stays unchanged; "Accepted in prompt 60".
- `AGENTS.md` (User Interface Rules), `STATUS.md`, `README.md` (one line).

## Pictures

Seafile `/repo/openmana/design/menue-stil/60/`: `60-seiten-412x915.png`,
`60-seiten-915x412.png`, `60-seiten-884x1104.png`, `60-seiten-1280x800.png`,
`60-overlays-im-spiel.png`, `60-tisch-vorher-nachher.png`. Nothing in Git.

## Limits

- Physical Fold 7 and ORYX not checked (emulated sizes); the project owner's
  look on the device after the push.
- The comparison scripts lived outside the repository (`/tmp/om60/scripts/`);
  the end-to-end test itself checks the table's arrangement at the eleven sizes.
