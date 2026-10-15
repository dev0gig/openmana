# OpenMana Design System

> Canonical rules for OpenMana's user interface, established with prompt 06
> (web/PWA skeleton). Product intent lives in [BIBLE.md](BIBLE.md) §6, §10, §11,
> §13 and §17; this document says how the UI is built. Implementation record:
> [implementation/06-web-pwa-skeleton.md](implementation/06-web-pwa-skeleton.md).

## 1. Foundations

- **Components: shadcn/ui only** - everywhere except the game table, which
  has its own CSS and SVG (§9). Style `radix-maia` (soft, rounded, generous
  spacing – touch-friendly), Radix primitives, Tailwind CSS 4, icons from
  Lucide. Components live in `src/components/ui/` and are added with the
  shadcn CLI (`components.json`). Pages compose them; they do not restyle them.
- **The menu style "Reich"** (the project owner's choice of 2026-10-15, series
  *openmana-menuestil*, prompts 57-60; §10): the whole app outside a running
  game looks like the game table - bars and panels in the table's panel tone
  with gold lines, the table's emblem and a gold wordmark, a glowing gold mark
  for the current page, a still background shimmer. It comes only through
  tokens, building blocks in `src/components/ui/` and deliberate central
  changes of the shadcn components (rule 3); pages stay shadcn-only. Inline
  components carry it under the variant `menu:` (outside the game table's
  board, since prompt 58), so inside a running game they keep the look the
  table's own stylesheet builds on.
- **Tokens: `src/index.css`.** Every colour, radius and font of the app is a
  shadcn token (`--background`, `--card`, `--primary`, `--muted-foreground`,
  `--sidebar-*` …) mapped into Tailwind by `@theme inline`. Pages use the
  token classes (`bg-card`, `text-muted-foreground`, `border-border`,
  `ring-ring` …), never raw colours.
- **Dark only.** One palette, defined once in `:root`; `<html class="dark">`
  switches on the `dark:` variants inside the shadcn components. There is no
  light theme. (A lighter variant, if ever wanted, stays dark – a few shades
  lighter, never white.)

## 2. Identity

OpenMana should feel like a modern, premium digital card game without
copying one (Bible §13): no Arena assets, layouts or typefaces.

| Element | Choice | Why |
|---|---|---|
| Surfaces | night blue (`--background` `oklch(0.18 0.02 262)` = `#0d121b`, cards one step lighter) | calm table-like depth; the temporary icon's night scene |
| Primary / focus | warm gold (`--primary` = `--ring` `oklch(0.8 0.12 80)`) | the icon's engraved gold; one accent for "do this" and focus |
| Text | warm parchment (`--foreground` `oklch(0.955 0.012 85)`) | softer than white on dark blue |
| Headings | **Cinzel** (variable, SIL OFL), as shadcn's `--font-heading` | engraved capitals, card-game character; titles and the wordmark only |
| Body | **Inter** (variable, SIL OFL), `--font-sans` | legible at small sizes, tabular digits for numbers |
| Radius | `--radius` 0.625rem; Maia scales it (cards `rounded-2xl`, buttons pill-shaped) | soft, familiar from Material 3 on Android |
| App icon | the Anvil icon, unchanged and temporary ([provenance](../assets/app-icon/PROVENANCE.md)) - only the icon of the installed app (`public/icons/`, manifest, PWA, ORYX) | prompt 06: no redesign yet; a later decision of its own |
| Mark in the app | the game table's **emblem** (a compass: eight-pointed star in a ring, the table's gold gradient) and the wordmark "OpenMana" in Cinzel with a gold gradient - top bar, sidebar, start page (`Emblem`, `Wordmark`, `Brand`; prompt 57) | one mark with the table, "wie aus einem Guss" (2026-10-15) |
| Menu style | **"Reich"** (2026-10-15): bars in the panel tone falling darker with a gold hairline (`--bar-*`, `--rail-*`, `--dock-*`), the current page in `--gold-light` with a glowing gold line (`--primary`, `shadow-gold-glow`), behind the pages a still shimmer - warm gold light above, cool blue below, two pairs of golden swings (`AppSurface`); since prompt 58 panels with corner ornaments (`Card`), golden main buttons, gold-lined pills and fields, gold choices, panel-toned overlays, the ornament line under page titles (§10) | the project owner's choice from the preview "Heute / Dezent / Reich" (Dropzone `workflow/OPENMANA-MENUESTIL-VORLAGE.html`) |
| Game table | the arena - a quiet stone surface laid under the board as a subgrid of its grid, warm light above, cool blue below, golden swings, runes, tendrils, light dust (series *stoneboard* 53-56, after the binding template; until prompt 56 a drawn wooden desk) -, gold medallions and panels (`--table-*` tokens, §9) | the project owner's concept (2026-10-10), [design/SPIELTISCH.md](design/SPIELTISCH.md) |

Fonts are bundled (Fontsource), never loaded from a font CDN: same-origin
files work under COEP and nothing leaks to third parties (Bible §15).

## 3. Rules

1. **No custom CSS, no ad-hoc Tailwind styling.** Layout utilities (`flex`,
   `grid`, `gap-*`, `p-*`, `max-w-*`, responsive prefixes) compose
   components; colours, shadows, gradients, arbitrary values (`bg-[#…]`,
   `w-[…]`) and page-level visual effects do not appear in pages. The one
   exception is the game table (§9); it does not extend to anything else.
   **One page-level effect is allowed** (the project owner, 2026-10-15, with
   the menu style "Reich", §10): the background shimmer `AppSurface`
   (`src/components/ui/app-surface.tsx`) - exactly one building block, placed
   once by the app shell behind the content (`aria-hidden`, no pointer events,
   fixed to the window: no room, no scrolling, no motion), never inside a page
   and never while a game or a replay takes the screen. Ornaments (emblem,
   gold marks, from prompt 58 corners and dividers) are building blocks in
   `src/components/ui/` or central changes of shadcn components (rule 3);
   their colours and gradients live there and in tokens, never in a page.
2. **A missing component is added as a shadcn component** – from the shadcn
   registry if it exists there, otherwise built the shadcn way in
   `src/components/ui/`: `data-slot`, `cn()`, `asChild` via Radix `Slot`,
   theme tokens only. Example: `bottom-nav.tsx` (shadcn has no bottom tab bar).
3. **Changes to shadcn components are deliberate and few** – and apply
   everywhere, never per page. Current changes (each commented in place):
   touch sizes (rule 5; since prompt 10 also menu entries, select triggers
   and options, toggles), German screen-reader strings, the dark-only toaster
   without `next-themes`, a dialog that scrolls inside the screen instead of
   running off it (`DialogContent`: `max-h` + `overflow-y-auto`, prompt 07),
   `DropdownMenuCheckboxItem` passing `checked` through its props (TypeScript's
   `exactOptionalPropertyTypes`, prompt 10), since prompt 12
   `motion-reduce:animate-none!` / `motion-reduce:transition-none!` on every
   animation and transition (rule 8), and since prompt 13 `CardPicture`'s
   `compact` (little padding in the text box that stands in for a missing
   picture on the small cards of the game table). Since prompt 57 (menu style,
   §10): the sidebar in the bars' tone (`--rail-*`) with a gold hairline, its
   header continuing the top bar (same height, tone and hairline), and
   `SidebarMenuButton` and `BottomNavItem` marking the current page by
   `aria-current="page"` (gold words, a gold shimmer or halo, a glowing gold
   line - set from `isActive` unless a `NavLink` sets it itself), no longer
   by `data-active`. Since prompt 58 (menu style, §10; each commented in
   place): `Card` a panel with two corner ornaments and its variant `plain`,
   `Button` (`default` the golden main button, `outline`/`secondary` pills with
   the gold hairline, `ghost` gold on hover), `Badge` (`secondary`, `outline`),
   `Input`, `Textarea`, `SelectTrigger`, `Checkbox`, `RadioGroupItem`, `Switch`,
   `FieldLabel` choice cards, `Toggle`/`ToggleGroupItem`, `Item` rows and
   `ItemMedia` icons, `Empty` - all under the variant `menu:` (not inside the
   game table's board) -, and the overlays (`DialogContent`,
   `AlertDialogContent`, `SheetContent`, `DropdownMenuContent`, `SelectContent`,
   `TooltipContent`, the toaster's tokens) on the panel tone with the gold
   hairline and gold titles. Since prompt 59 (§10): `Card` `asChild` (a deck
   tile as a link), `ItemMedia` variant `number`, `ItemDescription` and
   `Badge` wrapping instead of cutting words off, `Alert` on the well - under
   `menu:` -, the `ActionBar` in the dock's tone, and the emblem's `glow`.
4. **Honest states.** No sample data, no simulated engine, no pretend
   features. Empty states use `Empty`; an action that is not possible yet
   stays visible but disabled and says why (`aria-describedby`); failures
   show a destructive `Alert` in place and a toast if they happen elsewhere
   (Bible §16: nothing fails silently). "Empty" is only shown when the local
   database says so: while it loads the page shows a `Skeleton`, and if it
   cannot be read the page shows why, never an empty list.
   Irreversible actions (deleting, replacing, resetting data, conceding a
   game, ending one without a result, Forge's "Zug beenden" - since prompt 16)
   are confirmed in an `AlertDialog` whose
   destructive button says what happens ("Endgültig entfernen", "Lokale Daten
   ersetzen", "Aufgeben") and whose cancel button keeps things as they are
   ("Weiterspielen").
5. **Touch first.** On coarse pointers (`pointer-coarse:`) buttons, sidebar
   entries, menu entries, inputs, select triggers and options and toggles grow to at
   least 44 px in both dimensions (`Button` coarse `min-w-11`; all Button sizes
   including `xs`/`sm`: `h-11`, `lg` `h-12`, icons `size-11`, menu entries
   `min-h-11`); the phone's tab bar gives each destination a 64 px high,
   full-width target. Mouse layouts stay compact. A page's primary action
   stays on screen on phones: an `ActionBar` right above the tab bar (Anvil
   lesson, Bible §16), the page header from `md`. An irreversible action
   (conceding) never goes into the `ActionBar`: a bar that is always under the
   thumb invites a tap by mistake.
   Cards on the game table are sized by their rows (§4), not by this rule: on
   a small phone a battlefield card can be smaller than 44 px. Their targets
   keep WCAG 2.2's minimum (2.5.8, 24 × 24 px, measured by the end-to-end
   test), and a mis-tap is harmless by design (prompt 14): outside the steps
   Forge lets the player take back, a card's tap only opens its card view,
   whose own buttons have the full touch size.
6. **Accessible by default** (Bible §17). Text on every surface reaches WCAG
   2.2 AA 4.5:1 (checked from the tokens by `src/app/design-tokens.test.ts`;
   most pairs are above 7:1), and so does destructive text on its own 20 %
   tint (the confirm buttons of dialogs, destructive badges – checked since
   prompt 10, which raised `--destructive` from L 0.71 to 0.74 for it). Focus is a gold ring. Links in running text are
   always underlined (`TextLink`), not told apart by colour alone. Every page
   has one `h1`, regions have names, icons are `aria-hidden` next to text –
   and so is a `Spinner` next to text (its own label "Lädt" would otherwise
   become part of a button's name). A page whose state changes on its own
   (the game) announces the change in a polite live region.
   The end-to-end test runs axe-core on every surface at three sizes and
   fails on serious or critical findings.
7. **German for the player, English for the system.** Every visible and
   screen-reader text is German (including the few strings inside shadcn
   components); code, identifiers, routes (`/decks`, `/play` …), protocol and
   developer messages are English.
8. **Motion** comes only from the shadcn components' built-in transitions –
   and it stops when less motion is asked for (prompt 12): by the device
   (`prefers-reduced-motion`, e.g. Android's "remove animations") or by the
   player (Settings → Barrierefreiheit, `<html data-reduced-motion>`; the
   setting can only add a reduction). `src/index.css` defines the
   `motion-reduce:` variant as exactly that (like shadcn's class-based `dark`
   variant), and every shadcn component carries it on each animation and
   transition, with `!` so it wins over the `data-open:`/`data-closed:`
   animations (`src/app/motion.test.ts` checks every file of
   `src/components/ui`; a component added later must follow). Spinners keep
   turning: a loading indicator that stops looks like a frozen page. The game
   table may move from the redesign on (prompts 37-45, §9 and
   [design/SPIELTISCH.md](design/SPIELTISCH.md) §8) - cards travel, a tapped
   card turns -, but only with `transform` and
   `opacity`, never delaying an input or a state, and not at all under less
   motion: the table's stylesheet switches every animation and transition of
   `[data-slot="game-board"]` off for both causes, its components carry the
   `motion-reduce:` variant, and code that moves things itself asks
   `src/app/motion.ts` (`motionReducedNow()` at the moment it animates,
   `watchReducedMotion()` to stop what runs; `motion.test.ts` checks
   `src/game/table/**` and `table.css` too). Since prompt 44 the table's own
   motion is one component (`src/game/table/table-motion.tsx`, keyframes only
   from `motion-plan.ts`): the new state is usable at once, the motion runs
   over it, a further state stops it (the pictures jump to their places),
   nothing is queued; a click during a motion hits the control at its final
   place; a card gliding to its new place is presentation, never a derived
   event, text or history entry; a replay animates stepping, not jumping. The
   card view moves only as shadcn's `Dialog` (fades and zooms in, nothing
   under less motion).

## 4. Layout

| Width | Navigation | Notes |
|---|---|---|
| below 768 px (phones, folded foldables) | top bar (emblem and wordmark, settings gear) + bottom **tab bar** with Start, Decks, Spielen, Partien | settings behind the gear, credits behind settings: rare things stay out of the repeated path (Anvil lesson) |
| from 768 px (tablets, unfolded foldables, desktop) | shadcn **Sidebar**, collapsible to icons (`Ctrl/⌘+B`), all six surfaces | the lower group holds Einstellungen and Credits |

Content sits in one column, `max-w-5xl`, with cards in a one- or two-column
grid. Bars are sticky: the page scrolls, the navigation stays reachable. A
game's result is one large word in the heading font – gold for a win, the
destructive colour for a loss (Anvil: "verloren oder gewonnen in großen
Buchstaben").

**Edge to edge (2026-10-15).** `index.html` asks for the whole screen
(`viewport-fit=cover`), like the ORYX start page and every other ORYX game.
Without it Chrome in the ORYX app (a Trusted Web Activity in immersive mode,
cutout `ALWAYS`) decided per page and load: it moved the page below the front
camera, a black band on top and the bottom cut off, and a tap near the camera
or the bottom edge shifted it back and forth (Samsung Fold 7). The bars' and
panels' tones reach under the camera; their content keeps the safe-area
insets (`env(safe-area-inset-*)`, 0 without a cutout): `AppHeader`,
`BottomNav`, the sidebar's rail, `SheetContent` and its close button, the
toasts' distances, the content's sides and the full-screen page (game,
replay). New bars or panels at a screen edge do the same in their component.

**The game table** (prompt 13, `/play/game` while a game runs) takes the whole
screen: the page asks for it (`useImmersive`, `src/app/immersive.tsx`) and the
app shell hides sidebar, top bar and tab bar until the game ends or the player
leaves the page; the table's own menu (a `Sheet`) leads around the app, holds
Forge's notices and conceding. `GameBoard` lays out eight fixed regions and
never scrolls itself (Bible §6: no vertically endless table); what does not fit
scrolls inside its region – card rows sideways, texts downwards.

The regions are arranged by the window's **aspect ratio**, not by the device
(prompt 36; plans and the region mapping in
[design/SPIELTISCH.md](design/SPIELTISCH.md) §3) - the variants `hoch:`,
`quadrat:`, `breit:` in `src/index.css` and `useTableLayout()`
(`src/game/table/`), exactly one at any size:

| Layout | Aspect ratio | Regions |
|---|---|---|
| `hoch` (folded foldable, phones) | narrower than 3:4 | one column: header · opponent · opponent's battlefield · stack and combat as a bar · your battlefield · you · hand · decision as an action bar at the very bottom, growing upwards for a question |
| `quadrat` (unfolded foldable either way, most tablets) | 3:4 to 13:10 | header across; left both strips and battlefields (a thin centre line between them) and the hand; right column (15–20 rem): stack and combat (Zauberchronik) next to the opponent's half, the decision (Phasen-Tafel) from the centre line down |
| `breit` (desktop, laptop, tablets turned) | wider than 13:10 | header across; left column the Zauberchronik (12–18 rem), middle the strips, battlefields, centre line and the hand, right column the Phasen-Tafel (15–18 rem) - both side columns from the header to the bottom |
| `breit` and `short:` (a phone turned sideways) | wider than 13:10, at most 32 rem high | the arrangement of prompts 13–24, which leaves the battlefields the most height: battlefields and hand on the left, a side column (15–24 rem) with the opponent next to the header, stack and combat, the decision, you next to the hand |

Since prompt 38 `GameBoard` uses these layouts (exact plans:
[design/SPIELTISCH.md](design/SPIELTISCH.md) §3.2); nothing on the table is
arranged by orientation any more. The regions' order in the page is the order
of `hoch` (the decision last) - the reading and focus order of every layout.

**Cards are controls** (prompt 14): every card the player may see is a
`GameCardButton` in a `GameCardRow` toolbar (one Tab stop per row; arrow keys,
Home and End move between its cards). Its primary activation opens the **card
view** - since prompt 47 a shadcn `Dialog` in full screen (`CardLightbox`):
the shadcn overlay darkens the whole table, the card stands on it as large as
the screen allows - whole, in its proportions, Scryfall's largest picture -,
and small `Card` boxes explain the keywords Forge reports for it (name bold,
the explanation below; none without keywords): beside the card in `quadrat`
and `breit`, below it in `hoch` (by `useTableLayout()`, never by device; the
view scrolls there and the card's buttons stay right under it). A long press,
a right click or the context-menu key opens it too - in the steps whose taps
act at once (paying, attacking, blocking, the London mulligan, a selection)
the only way to look. The card view's one main button carries Forge's words
for the tap, stands under the card or the boxes - never over the card - and is
armed a moment after it appears; "Umdrehen" turns a double-faced card. It
closes by its X, a press on the darkening, Escape and the system's back
gesture. The zones, history and help stay Sheets from the bottom in `hoch` and
from the right in `quadrat` and `breit` (prompt 38, `useTableSheetSide()`).

**Forge's decisions** (prompt 15) are answered in the decision region - the
action bar below the hand in `hoch`, the column beside the battlefields in
`quadrat` and `breit`: what Forge asks (the
asking card's picture, the kind of decision, Forge's words), the controls -
Forge's buttons, choice cards (a `RadioGroup` for one, `Checkbox`es for
several, like the preference choices), rows of cards the table does not show,
lists with arrows (order, top/bottom of a pile), plus/minus for amounts, a
field for a number - and the answer buttons, which stick to the bottom of the
region while a long list scrolls above them. The region grows only as far as
its content needs (per layout: [design/SPIELTISCH.md](design/SPIELTISCH.md)
§3.3): in `hoch` `GameBoard decision="tall"` (more words than fit: up to 28 %
of the screen's height, the rest scrolls) and `"expanded"` (a list or form
Forge waits on alone, cards outside the table: up to 36 %; stack and combat
keep a smaller strip, the battlefields a row of cards); in `quadrat` an
expanded decision takes its column from the opponent's battlefield down and
the Zauberchronik keeps a small strip; in `breit` its column is full height
already; in a low `breit` window (`short:` = at most 32rem high, a custom
variant in `src/index.css`) an expanded decision takes both middle rows of the
side column and stack and combat step aside. Sending buttons are armed a
moment after they appear, like the card view's.

**Priority, stack and phases** (prompt 16; since prompt 41 on the table's
panels, [design/SPIELTISCH.md](design/SPIELTISCH.md) §4.11-4.14): the header
says the turn and Forge's step in words; the turn's five phases are the
Phasen-Tafel's (beside the battlefields: the phases with the current one's
steps unfolded, the current step a gold pill) or the action bar's (`hoch`: five
symbols and "Phase · Schritt") - a picture of the words, hidden from screen
readers, each step's full name a tooltip. The Zauberchronik lists the stack
top first with each item's card (it opens the card view), its name, whose it
is (a dot and the words), its targets and kind, Forge's words and its number,
the top one highlighted; combat in short lines below. The player's priority is
a decision like the others: words instead of Forge's status line, Forge's OK as
"Weiter" or "Verrechnen lassen" - the golden main button -, Forge's End Turn
behind an `AlertDialog` (rule 4: it gives the rest of the turn away).

Both battlefields share the free height equally; a battlefield shows two rows
(creatures next to the middle, other permanents outside) from 176 px, one
below (checked for the new grid in prompt 38 and kept). Cards are sized by
their row's height and width (`rowSize`, prompt 40: at least 44 px wide), so
less room means smaller cards, never a longer page. Rows are centred while
they fit and scroll sideways when not. The players' zones are piles and
counters on their strips (prompt 39) whose names keep the zone's word for
screen readers and tooltips.

The whole table is reachable by keyboard in this focus order, every stop
with a visible focus ring and a name (prompt 45, end-to-end
`tableKeyboardTour`; [design/SPIELTISCH.md](design/SPIELTISCH.md) §6).

## 5. Inventory

| Component | Source | Used for |
|---|---|---|
| `Button`, `Badge`, `Card`, `Alert`, `Separator`, `Tooltip`, `Sheet`, `Sidebar` (+ `Input`, `Skeleton` it needs), `Sonner`, `Empty`, `Item`, `Spinner` | shadcn/ui registry (`radix-maia`) | everything on screen |
| `Dialog`, `AlertDialog`, `RadioGroup`, `Field` (+ `Label` it needs) | shadcn/ui registry (`radix-maia`, prompt 07) | the backup import (dialog with choice cards: `RadioGroup` items inside `FieldLabel`, named by `aria-labelledby`), confirmations of irreversible actions |
| `AspectRatio`, `Progress` | shadcn/ui registry (`radix-maia`, prompt 08) | card proportions; installing the card catalog |
| `Textarea` | shadcn/ui registry (`radix-maia`, prompt 09) | pasting a deck list (grows with its content up to `max-h-96`, then scrolls) |
| `DropdownMenu`, `Select`, `ToggleGroup` (+ `Toggle` it needs) | shadcn/ui registry (`radix-maia`, prompt 10) | a deck's actions (menu „Mehr“, not modal so a dialog opened from it gets the focus), sorting and the format filter of the deck library |
| `Switch` | shadcn/ui registry (`radix-maia`, prompt 12) | an on/off preference („Bewegungen reduzieren“), inside a `FieldLabel` row so the whole row is the touch target; one-of-several preferences (AI profile, card language) are a `RadioGroup` of choice cards like the backup import. Preferences are saved the moment they change (no save button) |
| `GameBoard`, `GameBoardArea` | `src/components/ui/game-board.tsx`, built the shadcn way (prompt 13) | the game table's frame: eight named regions in a grid, arranged by the table layout (§4, prompt 38: `hoch`, `quadrat`, `breit`, `breit` + `short`), never scrolling itself |
| `GameCard`, `GameCardCaption`, `GameCardGroup` | `src/components/ui/game-card.tsx`, built the shadcn way (prompt 13) | a card on the game table, sized by its row (63 × 88; a battlefield row by its height and width since prompt 40): its `CardPicture`, turned a quarter when tapped, its facts as chips in the line above the picture and - on the battlefield - the value plaque on the printed value box (`plaque`, prompt 40, §9 - nothing else on it, Scryfall forbids covering card images), a pile as cards behind it (`pile`); a card with its attachments together (on a plate on the table). Cards Forge hides are the table's `TableCardBack` since prompt 39 (below) |
| `GameCardButton`, `GameCardRow`, `GameCardRowItem`, `GameCardRowButton`; the `mark` of `GameCard`/`GameCardButton` | `src/components/ui/game-card.tsx`, built the shadcn way (prompt 14) on Radix `Toolbar` (from `radix-ui`) | a card as a control: a button with shadcn's focus ring around the whole card, no image menu or text selection on a long press; Forge's state as a frame and glow around the picture in the room every card keeps (`mark`, look since prompt 40: usable a gold frame with a glow, chosen a thicker light frame, target red pulsing - §9); a row of such cards as a toolbar (roving focus), else a focusable list |
| `useTableLayout()`, `tableLayoutOf()`; variants `hoch:`, `quadrat:`, `breit:` | `src/game/table/use-table-layout.ts`, `table-layout.ts`, `src/index.css` (prompt 36) | the game table's layout by aspect ratio (§4, §9): `GameBoard`'s plans, the Sheets' side (prompt 38) and the card view's arrangement (prompt 47) |
| `CardLightboxContent`, `CardLightboxStage`, `CardLightboxPicture`, `CardLightboxAside`, `CardLightboxBoxes`, `CardLightboxActions`; `cardFit()`, `useCloseWatcher()` | `src/components/ui/card-lightbox.tsx`, built the shadcn way on Radix `Dialog` with shadcn's `DialogOverlay` (prompt 47) | the card view in full screen: the darkened table, the card as large as the room allows (`cardFit`: stacked within width and height less its button rows, beside within height and width less the aside of 16–24 rem), the aside with the keyword boxes and the buttons, presses on the darkening falling through to the overlay (they close it), the back gesture (`CloseWatcher`) |
| `src/game/table/table.css`, `--table-*` tokens | prompt 36 (§9) | the game table's own stylesheet (imported by `ArenaSurface`) and colours |
| `TableArt`, `TableCardBack`, `TableEmblem` | `src/game/table/table-art.tsx` (prompt 39, §9) | the table's drawn pieces as SVG symbols defined once per table - the OpenMana emblem (since prompt 57 the app's `Emblem`: `TableEmblem` draws it, the card back's symbol uses its shapes and gold), the life medallion's ring, OpenMana's own card back (never Wizards'); `TableCardBack` (slot `game-card-back`) for every card Forge hides on the table (the opponent's hand, face-down permanents, hidden cards of questions, the library pile), decoration only |
| `MedallionFace`, `ZonePile`, `ZoneCounter`, `ZoneCount`, `StripChip` | `src/game/table/strip-parts.tsx` (prompt 39, §9) | a player's strip: the life medallion's face (inside `GamePlayer`/`GamePlayerButton`), the library and graveyard as piles, exile and command zone as counters (both open the zone view - looking only), counts with the zone's title, facts as chips on the panel tone |
| `ArenaSurface` | `src/game/table/arena-surface.tsx` (prompts 53-56, §9; [design/SPIELTISCH.md](design/SPIELTISCH.md) §4.1b) | the arena under the table's regions: a child of the board's grid with `subgrid` on both axes, every piece in the cell of its region, nothing measured by JavaScript; the only surface since prompt 56 (the drawn wooden table, the pictures and the setting `display.tableBackground` are gone) |
| `Checkbox` | shadcn/ui registry (`radix-maia`, prompt 15; `motion-reduce` added) | several choices of one of Forge's questions, inside a `FieldLabel` choice card (the whole card is the touch target) |
| `GameDecision`, `GameDecisionHeader`, `GameDecisionSource`, `GameDecisionRow`, `GameDecisionNote`, `GameDecisionActions`; `GameBoard`'s `decision` (`compact`/`tall`/`expanded`) | `src/components/ui/game-decision.tsx`, `game-board.tsx`, built the shadcn way (prompt 15) | the decision region's content: what Forge asks (the asking card as a small `GameCardButton`), a row of a question's cards at a hand's height, short lines (how many, why a button is off), the answer buttons sticking to the region's bottom; the region's growth (§4) |
| `GameHelpButton` | built the shadcn way (prompt 23) | header turn/phase area as a 44 px contextual-help trigger; phase and turn owner are its accessible description, no extra wide icon on small phones |
| `GameDecisionBar` | `src/components/ui/game-decision.tsx` (prompt 41) | the bar of Forge's answers at the bottom of the decision region: it sticks there instead of its actions and holds what belongs beside them (the compact phases in the action bar of `hoch`) |
| `TablePanel` (+ `TablePanelHead`, `TablePanelTitle`, `TablePanelCount`, `TablePanelSub`) | `src/game/table/table-panel.tsx` (prompt 41, §9) | the table's panel (the mockup's `.tafel`): panel tone darkening downwards, gold hairline, two gold corner ornaments, inner shadow, Cinzel title - the Zauberchronik and the Phasen-Tafel |
| `Chronicle` | `src/game/table/chronicle.tsx` (prompt 41, §9) | the Zauberchronik in the region "Stapel und Kampf": Forge's stack top first (card that only looks, name, controller's dot and words, targets, Forge's text, number) and combat as short lines; a bar between the battlefields in `hoch` |
| `PhasePanel` | `src/game/table/phase-panel.tsx` (prompt 41, §9; replaces prompt 16's `PhaseTrack` in the header) | the turn's five phases on the Phasen-Tafel (the current one unfolds its steps, the current step gold with a diamond) or as one line - five symbols and "Phase · Schritt" - in the action bar and while a question needs the room; `aria-hidden`, anchors `phase-track*` |
| `FannedHand` | `src/game/game-table.tsx`, geometry `src/game/table/hand-fan.ts`, gestures `useFanPress` (`src/hooks/use-card-press.ts`) (prompt 42, §9) | the player's hand as a fan: turned cards side by side on an arc, never overlapping (2026-10-12); the card under the mouse, a swiping thumb or the keyboard's focus rises whole above the hand |
| `TableArrows` | `src/game/table/table-arrows.tsx`, relations and geometry `arrows.ts` (prompt 43, §9) | target, attack and block arrows over the board from Forge's stack targets and combat; decoration only (`aria-hidden`, no pointer events) |
| `TableMotion` | `src/game/table/table-motion.tsx`, rules and keyframes `motion-plan.ts` (prompt 44, §9) | the table's motion between two of Forge's states: travelling, shifting and turning cards, damage, life, chronicle and phase effects; Web Animations of transform/opacity, nothing under less motion |
| `GamePlayer`, `GamePlayerButton` | `src/components/ui/game-player.tsx`, built the shadcn way (prompt 17) | a player's name and life total on their seat and in the decision region; as a button where Forge's running input takes the player (a target, a choice, life for Phyrexian mana), with the cards' marks drawn as an outline inside the box, so a mark takes no room; shadcn's focus ring, 44 px on touch screens as a button. On the table's strips it is the life medallion (prompt 39, `table-medallion`: a ring with a glow per mark, a stack target red) |
| `ActionBar` | `src/components/ui/action-bar.tsx`, built the shadcn way (prompt 10) | a page's primary action on phones: sticky right above the tab bar (`bottom-16`), at the end of the content column – on a short page too (since prompt 11 the `Page` column fills the screen and the bar is pushed to its end, `mt-auto`); pages render it only below `md` (`useIsMobile`) and put the same actions into the header above |
| `CardPicture` | `src/components/ui/card-picture.tsx`, built the shadcn way (prompt 08) | every picture of a Magic card: `AspectRatio` 63 × 88, `Skeleton` while loading, the card's text in place of a missing or failed picture (`data-state` loading/loaded/failed/missing); loads Scryfall's pictures in CORS mode without referrer and never crops them (`object-contain`: Scryfall forbids cutting off artist or copyright); a lazily sized picture (`sizes="auto"`, the table's) gives up `sizes` before it leaves the page - Chrome kept it and its surroundings alive otherwise (prompt 45) |
| `BottomNav`, `BottomNavItem` | `src/components/ui/bottom-nav.tsx`, built the shadcn way | phone tab bar; since prompt 57 in the dock tone with a gold hairline, the current destination (`aria-current`) gold with a glowing line above its symbol (§10) |
| `Emblem`, `Wordmark` (+ `EmblemShapes`, `EmblemGold`) | `src/components/ui/emblem.tsx`, built the shadcn way (prompt 57, §10) | the OpenMana emblem (the table's compass, one drawing for the app and the table - `TableEmblem` and the card back use it) and the gold Cinzel wordmark; decoration (`aria-hidden`) |
| `AppHeader`, `appHeaderButtonVariants()` | `src/components/ui/app-header.tsx`, built the shadcn way (prompt 57, §10) | the app's top bar (sticky, bar tone, gold hairline); a shadcn `Button` (ghost, icon size) as its round, gold-lined symbol button |
| `AppSurface` | `src/components/ui/app-surface.tsx`, built the shadcn way (prompt 57, rule 1, §10) | the one background shimmer behind every page outside the table, placed once by the app shell |
| `OrnamentCorner`, `OrnamentDivider` | `src/components/ui/ornament.tsx`, built the shadcn way (prompt 58, §10) | the table's corner ornament (`Card`'s two corners; absolutely placed, no room) and the gold line with a glowing diamond under a page title (`PageHeader`); decoration (`aria-hidden`, no pointer) |
| `Brand` | `src/components/brand.tsx` | emblem + gold Cinzel wordmark (since prompt 57; the app icon before) |
| `Page`, `PageHeader` | `src/components/page-header.tsx` | every surface: `<title>`, `h1` (since prompt 58 Cinzel in `--gold-light` with the `OrnamentDivider` under it), description, content column |
| `PageLoading` | `src/routes/page-loading.tsx` | a page that loads on demand (React Router `lazy`, e.g. the deck import) while its code arrives: `Skeleton`s in the content column, the frame stays usable |
| `FactList` | `src/components/fact-list.tsx` | label/value facts (versions, sizes, timings) |
| `TextLink` | `src/components/text-link.tsx` | links inside running text |
| `AppSidebar`, `AppShell` | `src/components/app-sidebar.tsx`, `src/app/app-shell.tsx` | the frame around all surfaces |

## 6. Adding things

- New shadcn component: `npx shadcn@4.21.0 add <name>`, then check it for
  English screen-reader text and whether its controls need the touch sizes
  of rule 5.
- New colour meaning (for example legal targets or tapped permanents on the
  game table): add a token pair (`--x`, `--x-foreground`) in `:root`, map it
  in `@theme inline`, extend `design-tokens.test.ts` with its contrast, and
  describe it here. Never hard-code the colour in a component.
- Card-, mechanic- or name-specific styling is forbidden (Bible §2): what is
  playable, targetable or attacking comes from Forge's structured state, and
  the UI styles those states, not particular cards.
- Nothing is drawn over a card picture (badges, counters, tints, blur,
  filters) except, on the game table, the **value plaque**: Forge's
  power/toughness or loyalty on the card's own printed value box at the bottom
  right, never over the artist and copyright line (§9). Every other fact goes
  outside the picture - since prompt 40 small chips in the chip line above it
  (`GameCardCaption`, before: a caption strip below it) -, a state that
  changes the card itself (tapped) is a quarter turn of the whole card (prompt
  13), and Forge's marks are frames and glows around the picture (prompt 14).
- Card states (prompt 14; their look since prompt 40): "usable now" is the
  one accent for "do this" (`--primary`, a gold frame with a glow), "chosen"
  the strongest contrast there is (`--foreground`, a thicker light frame).
  Targets, attackers and blockers have colours of their own (`--table-danger`
  with a glow that pulses, `--table-attack` and moved towards the opponent,
  `--table-mana`; §9). Glow against a thicker frame, the pulse and the
  movement tell them apart beyond colour; `data-mark` and Forge's combat facts
  stay the truth, every state keeps its words (chips, names), so none is told
  by colour alone (WCAG 1.4.1), and every mark reaches 3:1 on the table's
  surfaces (1.4.11, checked by `design-tokens.test.ts`). The words the app
  uses for usable cards say "gold umrandet".

## 7. Beginner help and target emphasis (prompt 23)

The turn/phase area opens the contextual help Sheet, below in `hoch` and to
the side in `quadrat` and `breit` (prompt 38; before: by orientation). The help scrolls inside; its footer stays reachable and
closing restores the opener's focus. Required/optional selection words join the
existing decision heading instead of adding a tall guidance panel.

Already named stack targets have a `--table-danger` frame with a gentle pulse
(prompt 40, §9; before: a double `--primary` frame), a “Ziel” chip with a
crosshair above the card, an explicit accessible “Ziel” label and a crosshair
on player seats. The card's other chips stay; the viewer/title names the
target. No tint or text covers a picture. Usable / selected frames take
precedence while the target words remain; a target relationship alone never
offers a tap. Player seats use a double inset outline in `--table-danger`
(prompt 39).

## 8. Responsive pass (prompt 24)

User names must wrap inside the content column rather than widening the browser layout viewport. `Page` can shrink, `PageHeader` bounds/wraps its title and `ItemContent`/`ItemTitle` stay within their row. These are deliberate shared shadcn/layout adaptations.

`Dialog`/`Sheet` content wraps long text; `AlertDialog` confirmations scroll within the available screen height. Sheets are bounded by the dynamic viewport. Existing viewer/help/history/decision scroll regions and sticky footers remain reachable. The mobile brand link also has a 44 px target. Fine-pointer component sizes retain their registry dimensions.

The audit checks eight CSS sizes from 360×740 through 1440×900, including fold-like 690×829 and 829×690; the game table also at the project owner's foldable closed, open and turned (480×1040, 870×960, 960×870; since prompt 38). It keeps the eight table regions (their arrangement follows the layouts of §4 from prompt 38 on), card gestures, keyboard navigation and meaningful decisions. Resize preserves viewer identity/focus and live Forge transcripts. Screens are emulated Chrome evidence; no physical hinge behavior is implied. See [implementation/24-responsive-polish.md](implementation/24-responsive-polish.md).

## 9. The game table (redesign, prompts 36–45)

The project owner approved a game table with its own look (2026-10-10),
built in prompts 36-44 and reviewed as a whole in prompt 45:
[design/SPIELTISCH.md](design/SPIELTISCH.md) is its specification (§14 the
deliberate deviations from the mockup), the static mockup
[design/spieltisch-vorlage/](design/spieltisch-vorlage/) - example data only -
the former visual target, superseded by the built table and kept as a
reference.

- **Own CSS and SVG - only here.** The exception covers the game table of a
  running game and of its replay: components in `src/game/table/` and one
  stylesheet, `src/game/table/table.css`, all of whose rules sit under
  `[data-slot="game-board"]`. Pages outside the table stay shadcn-only (§1,
  §3), and inside the game the Sheets, Dialogs, menus, toasts and the card
  view (a full-screen `Dialog` since prompt 47, `card-lightbox.tsx`) stay
  shadcn components; they may take the table's look only through tokens. `src/` holds no other stylesheet than `index.css` and `table.css`
  (`motion.test.ts`).
- **Tokens** (`:root` in `src/index.css`, mapped as `--color-table-*`):
  `--table-gold-light`, `--table-gold-dark`, `--table-gold-line`,
  `--table-mana`, `--table-danger`, `--table-attack`, `--table-heal`,
  `--table-sick` (summoning sickness's chip), `--table-leather`,
  `--table-panel`, `--table-plaque` (`--table-wood` and `--table-wood-frame`
  went with the drawn desk in prompt 56);
  gold itself stays `--primary`, text on gold `--primary-foreground`. Surface
  tokens are their lightest tone. `design-tokens.test.ts` checks text (4.5:1)
  and marks (3:1) on every table surface; values and uses:
  [design/SPIELTISCH.md](design/SPIELTISCH.md) §5. A colour with a new meaning
  gets a token and a test; depth effects use black/white with transparency or
  mixes of these tokens.
- **Layouts by aspect ratio:** `hoch` (< 3:4), `quadrat` (3:4–13:10), `breit`
  (> 13:10), plus `short:` (§4).
- **Card pictures:** whole, never cropped, blurred, darkened, colour-shifted or
  filtered; on them only the value plaque (above). Facts as chips outside the
  picture, Forge's short words and numbers only.
- **Cards on the battlefield** (prompt 40, [design/SPIELTISCH.md](design/SPIELTISCH.md)
  §4.7-4.9): the plaque (Cinzel, `--foreground` on `--table-plaque`, a gold
  rim; loyalty with a shield and a `--table-mana` rim) from a card width of
  44 px, upright on a tapped card; the chips in the line above the picture;
  a pile as up to two cards behind the front one with "×N"; rows that size
  their cards by height and width (at least 44 px wide, then scrolling); no
  line between a battlefield's two rows.
- **Hand as a fan** (prompt 42, [design/SPIELTISCH.md](design/SPIELTISCH.md)
  §4.10): cards sized by the hand's height, side by side and never overlapping
  (2026-10-12; smaller cards where many), turned and on an arc,
  sinking a little below its edge; the card under the mouse or the swiping
  thumb (by the cards' resting places) or with keyboard focus rises whole
  above the hand at a full card's size; a tap is the lifted card's primary
  activation, a swipe does nothing else, a long press opens the card view;
  the toolbar's keyboard stays. Every card keeps 24 px of its own (smaller
  cards first, a sideways row only beyond); the hand's height is the
  mockup's beside the side columns (`quadrat`, `breit`).
- **Drag and drop** (prompt 46, [design/SPIELTISCH.md](design/SPIELTISCH.md)
  §4.10 "Built (prompt 46)"): a hand card dragged up out of the hand (the
  mouse: pressed and moved) shows as a full card, upright, following the
  pointer and always whole on the board, while the card itself stays faint
  in the hand; over both battlefields and the middle the regions glow
  golden at their edges (`--primary`, a layer behind their cards, never on a
  picture) - only for a card Forge would play now. Let go there it is played
  (Forge's tap); otherwise it glides back and nothing is sent - a playable
  card that cannot be played now says why in a toast (the table's own
  reason words), any other card says nothing. Moves only by `transform` and
  `opacity`; jumps under less motion. The gestures keep their roles: a tap
  plays or looks as before, a swipe lifts, a long press looks, only an
  upward move out of the hand drags; the keyboard's way (Enter, the card
  view's button) stays the alternative to dragging.
- **Marks:** frames and glows around the picture after `data-mark` and the
  combat facts - usable gold with a glow, chosen a strong light frame, target
  red with a gentle pulse, attacking amber, blocking its own colour - each
  with its words, each 3:1.
- **Arrows** (prompt 43, [design/SPIELTISCH.md](design/SPIELTISCH.md) §4.15):
  over the board, decoration only (hidden from screen readers, no pointer
  events) - target red (`--table-danger`), attack amber (`--table-attack`),
  block mana blue (`--table-mana`); a glow and a dashed line that flows by
  three phases taking turns in opacity, still under less motion; the head
  beside its end, never on a card picture; lines may cross pictures.
- **Motion:** allowed on the table under rule 8 - `transform`/`opacity` only,
  never delaying input or state, nothing under less motion. Built in prompt 44
  ([design/SPIELTISCH.md](design/SPIELTISCH.md) §8 "Built"): travelling cards
  (by their id), turning, attackers moving forward, damage flash and shake,
  the medallion's red/green ring and pulse (`--table-heal` for a gain, 3:1 on
  the table's surfaces), Zauberchronik entries gliding in and dissolving, the
  phases' gold gliding, the main button's shimmer at a new priority.
- **Panels, Zauberchronik, Phasen-Tafel, main button** (prompt 41,
  [design/SPIELTISCH.md](design/SPIELTISCH.md) §4.11-4.14): the chronicle and
  the decision are `TablePanel`s on the desk or the board (their regions are
  clear); in `hoch` the decision is the action bar at the bottom. The one
  button that moves the round on - Forge's pass and the confirmation of
  attack, block and the mulligan's choice - is the golden main button
  (Cinzel, `--primary-foreground` on gold, a gloss moved by `transform`, still
  under less motion); every other button in the decision region is second
  (the panel's dark tone, a gold hairline). Only its look is new: Forge's
  buttons, labels, arming and confirmations are unchanged.
- **Header and strips** (prompt 39, [design/SPIELTISCH.md](design/SPIELTISCH.md)
  §4.2-4.6): the header shows the emblem and the Cinzel wordmark, the zones
  and the history as symbol buttons (their words in `breit`), the turn line
  "Zug N · Dein Zug" / "Forge-KI am Zug" inside the help button, the status
  badge and the menu; each strip lies on the board itself - the life
  medallion is the player's control, the zones are piles and counters that
  open the zone view, every fact in words is a chip on the panel tone. The
  table's drawn pieces (emblem, medallion ring, card back) are SVG symbols
  defined once (`TableArt`).

## 10. The menu style "Reich" (series openmana-menuestil, prompts 57-60)

The project owner wanted the menus, the navigation and every page outside a
running game to look like the finished game table, "wie aus einem Guss", and
chose the version **"Reich"** of the preview on 2026-10-15. Binding template
(a picture of the style, not a plan of the pages - texts, content and flows
stay the app's): Dropzone `workflow/OPENMANA-MENUESTIL-VORLAGE.html` with its
plan `workflow/OPENMANA-MENUESTIL-MASTERPLAN.md`; pictures in Seafile
`/repo/openmana/design/menue-stil/`. The game table itself does not change.

**In short (accepted in prompt 60) - the one place that says what is allowed:**

- **Where the look comes from:** tokens derived in `src/index.css` (no new
  hue), building blocks in `src/components/ui/` (`Emblem`, `Wordmark`,
  `AppHeader`, `AppSurface`, `OrnamentCorner`, `OrnamentDivider`) and the
  deliberate central changes of the shadcn components listed in the tables
  below (each commented in place). Page code composes them with layout
  utilities only - no colours, gradients, shadows or arbitrary values
  (rule 1, rule 3).
- **The exceptions, all of them:** (1) the game table's own CSS and SVG
  (`table.css`, `src/game/table/`; §9), unchanged by this series; (2) the one
  page-level effect `AppSurface`, placed once by the app shell, still,
  `aria-hidden`, no pointer events, absent while a game or a replay takes the
  screen. Nothing else.
- **The boundary:** inline components carry the look under the variant
  `menu:` (outside `[data-slot="game-board"]`), so inside the board they keep
  the registry's look `table.css` builds on; overlays are portalled and take
  the look in a game too (dialogs, sheets, menus, toasts, tooltips, the card
  view's button and keyword boxes - not its darkening and large card).
  `src/components/ui/ornament.test.tsx` guards that inline components name
  the style's tokens only under `menu:`.
- **Unchanged:** the app icon, texts, flows, roles, names, touch sizes, focus
  rings, the table's look (prompt 60 compared every recorded scene of the
  end-to-end test at eleven sizes with the state before the series).

**Tokens** (`:root` in `src/index.css`, only derived from the existing ones -
no new hue; mapped as `--color-*` where Tailwind needs them):
`--gold-light`, `--gold-dark`, `--gold-line`, `--panel` (aliases of the
`--table-*` tokens), `--panel-shade` (a round control on a panel), the bars'
gradients `--bar-top`/`--bar-bottom` (top bar), `--rail-top`/`--rail-bottom`
(sidebar), `--dock-top`/`--dock-bottom` (tab bar - the tone of the table's
action bar), all `--panel` mixed with black; `--gold-glow` (`--primary` at
16 %, the active sidebar entry's shimmer), `--surface-cool` (the table's mana
blue sunk into the night blue, the shimmer's cool light); `shadow-gold-glow`
and `drop-shadow-gold-glow` in `@theme`. `design-tokens.test.ts` reads the
mixes from the CSS and checks text (4.5:1: the navigation's words inactive and
active, the wordmark's gold, the symbols) on both ends of every bar and the
marks and focus ring (3:1).

**Built in prompt 57 - the frame:**

- `Emblem` and `Wordmark` (`src/components/ui/emblem.tsx`): the table's compass
  as the app's one drawing of the emblem (`TableEmblem` and the card back use
  it; the table looks as before - checked pixel by pixel in its recorded
  scenes) and "OpenMana" in Cinzel with a gold gradient. `Brand` shows both in
  the top bar, the sidebar and on the start page; the app icon stays the
  installed app's icon only.
- `AppHeader`: the top bar in the bar tone with a gold hairline; its symbol
  buttons (settings, the sidebar's trigger) round with a gold hairline
  (`appHeaderButtonVariants()`). From `md` the sidebar's header continues it,
  so the bar runs across the window.
- Tab bar and sidebar: their tones with a gold hairline towards the content;
  the current page - by `aria-current="page"`, the truth for screen readers and
  the mark alike - in `--gold-light`, with a glowing gold line (above the
  symbol in the tab bar, on the left of the entry in the sidebar, there with a
  gold shimmer fading to the right), the others muted. Touch sizes and focus
  rings unchanged.
- `AppSurface`: the background shimmer (rule 1's one exception) - warm gold
  light from above, cool blue from below and two pairs of fine golden swings,
  still; behind the content (the content column is positioned above it), not
  while a game or a replay takes the screen.

**Built in prompt 58 - the building blocks** (centrally in the components,
never per page; the pages take the look without a change):

- **Scope: the variant `menu:`** (`src/index.css`:
  `&:not([data-slot="game-board"] *)`). Inline components carry their new look
  under it, so the same components inside the game table's board (the
  decision's buttons and choice cards, the header's badges, the main button)
  keep the registry's look the table's stylesheet builds on - the table's
  recorded scenes are unchanged (checked pixel by pixel). It outweighs the
  components' `dark:` classes; a component that changes a border under it
  restates its focus and invalid borders under it too. A caller that needs
  another colour outside the board writes it under `menu:` as well (the bar's
  `appHeaderButtonVariants()`). Overlays are portalled out of the board and
  take the look directly - also in a game (Sheets, menus, confirmations,
  toasts, tooltips); the card view in full screen keeps its darkening and its
  large card (its buttons and keyword boxes take the look).
- **Tokens:** `--gold-edge` (`--primary` at 55 %: the boundary of a form
  control, 3:1 - the hairline `--gold-line` at 38 % is decoration beside
  words), `--gold-deep` (`--primary` 55 % with `--gold-dark`: the foot of the
  golden button, the same mix as the table's main button), `--panel-well`
  (black at 24 %: the darker ground of fields and rows on a panel);
  `shadow-panel`, `shadow-panel-flat`, `shadow-gold-button` in `@theme`.
  `design-tokens.test.ts` checks text 4.5:1 on the panel's both ends, the
  overlays, the wells, the button's gold and the toggles' and choice cards'
  shimmer, and boundaries, chosen gold and focus 3:1.
- **Ornaments** (`src/components/ui/ornament.tsx`): `OrnamentCorner` (the
  table's corner, `corner="start"` top left, `"end"` bottom right) and
  `OrnamentDivider` (the template's `.divider`).

| Component | Variant | Look (outside the board) | Where it applies |
|---|---|---|---|
| `Card` | `default` | panel: `--panel` falling to `--panel-shade` (94 %), gold hairline as a ring (no room), `shadow-panel`, two corner ornaments; `CardTitle` Cinzel `--gold-light` | every page's own cards |
| `Card` | `plain` | the same panel without corners and drop shadow (`shadow-panel-flat`) | dense or nested use - a card inside a card (prompt 59), the card view's keyword boxes |
| `Button` | `default` | the golden main button: `--gold-light` over `--primary` to `--gold-deep`, `--gold-light` rim, `shadow-gold-button`, Cinzel bold capitals, text `--primary-foreground` | a page's primary action, a dialog's "Fertig", the card view's offer |
| `Button` | `outline` | pill on `--panel-shade` with the gold hairline, lighter on hover | second actions |
| `Button` | `secondary` | pill on `--panel` with the gold hairline | second actions on a panel |
| `Button` | `ghost` | gold shimmer and `--gold-light` on hover | symbol buttons, dialog close (X) |
| `Button` | `destructive`, `link` | unchanged (the destructive tint and the gold link already fit) | confirmations, links |
| `Badge` | `secondary` / `outline` | gold hairline (`secondary` on `--panel-shade`); `default` stays gold | counts, states |
| `Input`, `Textarea`, `SelectTrigger` | - | `--panel-well` inside `--gold-edge`; focus ring and invalid border unchanged | every field |
| `Checkbox`, `RadioGroupItem`, `Switch` | - | `--panel-well` inside `--gold-edge`, full gold when chosen | choices, preferences |
| `FieldLabel` (choice card) | - | `--panel-well` inside the gold hairline; chosen: `--primary` line on the gold shimmer | backup import, AI profile, card language |
| `Toggle`, `ToggleGroupItem` | `default`, `outline` | on: `--gold-light` on the gold shimmer (`outline`: full gold line) | deck filter, zone view |
| `Item` | `outline`, `muted` | rows on `--panel-well` with the fine line (the template's `.step`) | lists, steps |
| `ItemMedia` | `icon` | the icon in a small gold ring (`--panel-shade`, gold hairline, `--gold-light`) | steps, lists |
| `Empty` | - | dashed gold hairline (where a page draws the border), title Cinzel `--gold-light`, icon in a gold ring | empty states |
| `DialogContent`, `AlertDialogContent` | - | panel falling darker, gold hairline, `shadow-panel`, gold title; no corners (they would scroll) | every dialog, also in a game |
| `SheetContent` | - | flat `--panel`, gold hairline on the open edge, gold title | menus and sheets, also in a game |
| `DropdownMenuContent`, `SelectContent`, `TooltipContent`, toasts | - | `--panel` with the gold hairline (the tooltip no longer inverted) | menus, lists, tooltips, notices |
| `PageHeader` | - | title Cinzel `--gold-light`, `OrnamentDivider` under it | every page's title |

**Built in prompt 59 - the pages** (only from the building blocks; what a page
missed became a variant of a component, never page styling):

| Component | Change | Where it applies |
|---|---|---|
| `Emblem` | `glow`: the hero's gold glow (`drop-shadow-gold-halo`, the template's `.hero svg`); the table's emblem stays without | `Brand size="hero"` on the start page |
| `Card` | `asChild`: the panel is its child (a link) with the corners inside it; a link card shows the focus ring around the whole panel and, outside the board, `--gold-edge` on hover | the deck library's tiles |
| `ItemMedia` | variant `number`: a step's number in the gold ring, Cinzel `--gold-light` (the template's `.step .num`; `aria-hidden`, the list's order says it) | the start page's steps |
| `ItemDescription` | outside the board never cut off after two lines (`menu:line-clamp-none`) | every row - steps, decks, matches, sheets |
| `Badge` | outside the board a badge too long for its place wraps inside its pill (one line keeps 20 px) | a commander's name on a narrow deck tile |
| `Alert` | outside the board on `--panel-well`, the plain one inside the gold hairline; the destructive one keeps its tone | notices on pages and in panels |
| `ActionBar` | the dock's tone falling darker with the gold hairline (it continues the tab bar) | a phone page's primary action |

- **Start:** `Brand size="hero"` (emblem `size-20`, from `md` `size-24`, with its
  glow, the wordmark beside it) and `OrnamentDivider` under it (the start page
  has no `PageHeader`); the main button golden, the steps numbered in gold rings;
  "Dieses Gerät" as a row on the well with its check in a gold ring. The two
  panels keep their own height (`items-start`).
- **Decks:** a grid of panels - two columns on a phone, three from `sm`, four from
  `lg` - each a `Card asChild` around the deck's link: the title card as a whole
  picture (`CardPicture`, Scryfall's `grid` size, never cropped; the deck symbol
  in a gold ring without one), the name as `CardTitle` (Cinzel gold, long names
  wrap), format and counts, the badges, the date. The search is the gold-lined
  pill, import the golden button; empty and "nothing fits" in the gold `Empty`.
- **Nested cards:** no page puts a `Card` inside a `Card`; long lists (matches,
  AI profiles, a deck's cards) are rows (`Item`) on the well inside one panel,
  so `plain` stays for the card view's keyword boxes.
- **Loading:** `PageLoading` keeps a page's shape - the title's place with the
  ornament line, then a panel's place.

**Accepted in prompt 60** (`docs/implementation/60-menuestil-gesamtabnahme.md`):
the complete `npm run check`, every recorded table scene of the end-to-end test
at the eight sizes and the foldable's three against the state before the series
(`4c64434`: place, size and computed look of every element of the board equal),
all pages at four sizes against the template, a keyboard tour and axe. Pictures:
Seafile `/repo/openmana/design/menue-stil/60/`.
