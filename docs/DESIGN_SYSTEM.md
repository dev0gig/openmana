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
| App icon | the Anvil icon, unchanged and temporary ([provenance](../assets/app-icon/PROVENANCE.md)) | prompt 06: no redesign yet |
| Game table | a dark wooden desk with a board set into it - carved frame, brass corners, dark blue leather, a gold rune circle -, gold medallions and panels (`--table-*` tokens, §9) | the project owner's concept (2026-10-10), [design/SPIELTISCH.md](design/SPIELTISCH.md) |

Fonts are bundled (Fontsource), never loaded from a font CDN: same-origin
files work under COEP and nothing leaks to third parties (Bible §15).

## 3. Rules

1. **No custom CSS, no ad-hoc Tailwind styling.** Layout utilities (`flex`,
   `grid`, `gap-*`, `p-*`, `max-w-*`, responsive prefixes) compose
   components; colours, shadows, gradients, arbitrary values (`bg-[#…]`,
   `w-[…]`) and page-level visual effects do not appear in pages. The one
   exception is the game table (§9); it does not extend to anything else.
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
   picture on the small cards of the game table).
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
   card turns, the rune ring turns slowly -, but only with `transform` and
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
   card view still moves only as shadcn's `Sheet`.

## 4. Layout

| Width | Navigation | Notes |
|---|---|---|
| below 768 px (phones, folded foldables) | top bar (logo, settings gear) + bottom **tab bar** with Start, Decks, Spielen, Partien | settings behind the gear, credits behind settings: rare things stay out of the repeated path (Anvil lesson) |
| from 768 px (tablets, unfolded foldables, desktop) | shadcn **Sidebar**, collapsible to icons (`Ctrl/⌘+B`), all six surfaces | the lower group holds Einstellungen and Credits |

Content sits in one column, `max-w-5xl`, with cards in a one- or two-column
grid. Bars are sticky: the page scrolls, the navigation stays reachable. A
game's result is one large word in the heading font – gold for a win, the
destructive colour for a loss (Anvil: "verloren oder gewonnen in großen
Buchstaben").

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
view** - a `Sheet` from the bottom in `hoch` (thumb reach), from the right in
`quadrat` and `breit` (prompt 38, `useTableSheetSide()`; the same for the
zones, history and help Sheets): the card large, Forge's words and facts, what
Forge offers, and a footer that stays in view while the card scrolls (from the
side its two buttons side by side - the content follows the Sheet's
`data-side`). A long press, a right click or the context-menu key opens it
too - in the steps whose taps act at once (paying, attacking, blocking, the
London mulligan, a selection) the only way to look. The card view's main button
carries Forge's words for the tap and is armed a moment after it appears.

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
| `useTableLayout()`, `tableLayoutOf()`; variants `hoch:`, `quadrat:`, `breit:` | `src/game/table/use-table-layout.ts`, `table-layout.ts`, `src/index.css` (prompt 36) | the game table's layout by aspect ratio (§4, §9): `GameBoard`'s plans and the Sheets' side (prompt 38) |
| `src/game/table/table.css`, `--table-*` tokens | prompt 36 (§9) | the game table's own stylesheet (imported by `TableSurface`) and colours |
| `TableArt`, `TableCardBack`, `TableEmblem` | `src/game/table/table-art.tsx` (prompt 39, §9) | the table's drawn pieces as SVG symbols defined once per table - the OpenMana emblem, the life medallion's ring, OpenMana's own card back (never Wizards'); `TableCardBack` (slot `game-card-back`) for every card Forge hides on the table (the opponent's hand, face-down permanents, hidden cards of questions, the library pile), decoration only |
| `MedallionFace`, `ZonePile`, `ZoneCounter`, `ZoneCount`, `StripChip` | `src/game/table/strip-parts.tsx` (prompt 39, §9) | a player's strip: the life medallion's face (inside `GamePlayer`/`GamePlayerButton`), the library and graveyard as piles, exile and command zone as counters (both open the zone view - looking only), counts with the zone's title, facts as chips on the panel tone |
| `TableSurface` | `src/game/table/table-surface.tsx`, `surface-drawing.ts` (prompt 37, §9) | the wooden desk with the board set into it behind the table's regions: SVG drawn only when a size changes, the rune ring turning and glimmering (still under less motion), decoration only (`aria-hidden`, no pointer events); text regions on the panel tone (`--table-panel` 90 %) |
| `Checkbox` | shadcn/ui registry (`radix-maia`, prompt 15; `motion-reduce` added) | several choices of one of Forge's questions, inside a `FieldLabel` choice card (the whole card is the touch target) |
| `GameDecision`, `GameDecisionHeader`, `GameDecisionSource`, `GameDecisionRow`, `GameDecisionNote`, `GameDecisionActions`; `GameBoard`'s `decision` (`compact`/`tall`/`expanded`) | `src/components/ui/game-decision.tsx`, `game-board.tsx`, built the shadcn way (prompt 15) | the decision region's content: what Forge asks (the asking card as a small `GameCardButton`), a row of a question's cards at a hand's height, short lines (how many, why a button is off), the answer buttons sticking to the region's bottom; the region's growth (§4) |
| `GameHelpButton` | built the shadcn way (prompt 23) | header turn/phase area as a 44 px contextual-help trigger; phase and turn owner are its accessible description, no extra wide icon on small phones |
| `GameDecisionBar` | `src/components/ui/game-decision.tsx` (prompt 41) | the bar of Forge's answers at the bottom of the decision region: it sticks there instead of its actions and holds what belongs beside them (the compact phases in the action bar of `hoch`) |
| `TablePanel` (+ `TablePanelHead`, `TablePanelTitle`, `TablePanelCount`, `TablePanelSub`) | `src/game/table/table-panel.tsx` (prompt 41, §9) | the table's panel (the mockup's `.tafel`): panel tone darkening downwards, gold hairline, two gold corner ornaments, inner shadow, Cinzel title - the Zauberchronik and the Phasen-Tafel |
| `Chronicle` | `src/game/table/chronicle.tsx` (prompt 41, §9) | the Zauberchronik in the region "Stapel und Kampf": Forge's stack top first (card that only looks, name, controller's dot and words, targets, Forge's text, number) and combat as short lines; a bar between the battlefields in `hoch` |
| `PhasePanel` | `src/game/table/phase-panel.tsx` (prompt 41, §9; replaces prompt 16's `PhaseTrack` in the header) | the turn's five phases on the Phasen-Tafel (the current one unfolds its steps, the current step gold with a diamond) or as one line - five symbols and "Phase · Schritt" - in the action bar and while a question needs the room; `aria-hidden`, anchors `phase-track*` |
| `FannedHand` | `src/game/game-table.tsx`, geometry `src/game/table/hand-fan.ts`, gestures `useFanPress` (`src/hooks/use-card-press.ts`) (prompt 42, §9) | the player's hand as a fan: overlapping, turned cards on an arc; the card under the mouse, a swiping thumb or the keyboard's focus rises whole above the hand |
| `TableArrows` | `src/game/table/table-arrows.tsx`, relations and geometry `arrows.ts` (prompt 43, §9) | target, attack and block arrows over the board from Forge's stack targets and combat; decoration only (`aria-hidden`, no pointer events) |
| `TableMotion` | `src/game/table/table-motion.tsx`, rules and keyframes `motion-plan.ts` (prompt 44, §9) | the table's motion between two of Forge's states: travelling, shifting and turning cards, damage, life, chronicle and phase effects; Web Animations of transform/opacity, nothing under less motion |
| `GamePlayer`, `GamePlayerButton` | `src/components/ui/game-player.tsx`, built the shadcn way (prompt 17) | a player's name and life total on their seat and in the decision region; as a button where Forge's running input takes the player (a target, a choice, life for Phyrexian mana), with the cards' marks drawn as an outline inside the box, so a mark takes no room; shadcn's focus ring, 44 px on touch screens as a button. On the table's strips it is the life medallion (prompt 39, `table-medallion`: a ring with a glow per mark, a stack target red) |
| `ActionBar` | `src/components/ui/action-bar.tsx`, built the shadcn way (prompt 10) | a page's primary action on phones: sticky right above the tab bar (`bottom-16`), at the end of the content column – on a short page too (since prompt 11 the `Page` column fills the screen and the bar is pushed to its end, `mt-auto`); pages render it only below `md` (`useIsMobile`) and put the same actions into the header above |
| `CardPicture` | `src/components/ui/card-picture.tsx`, built the shadcn way (prompt 08) | every picture of a Magic card: `AspectRatio` 63 × 88, `Skeleton` while loading, the card's text in place of a missing or failed picture (`data-state` loading/loaded/failed/missing); loads Scryfall's pictures in CORS mode without referrer and never crops them (`object-contain`: Scryfall forbids cutting off artist or copyright); a lazily sized picture (`sizes="auto"`, the table's) gives up `sizes` before it leaves the page - Chrome kept it and its surroundings alive otherwise (prompt 45) |
| `BottomNav`, `BottomNavItem` | `src/components/ui/bottom-nav.tsx`, built the shadcn way | phone tab bar |
| `Brand` | `src/components/brand.tsx` | icon + Cinzel wordmark |
| `Page`, `PageHeader` | `src/components/page-header.tsx` | every surface: `<title>`, `h1`, description, content column |
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
  view stay shadcn components; they may take the table's look only through
  tokens. `src/` holds no other stylesheet than `index.css` and `table.css`
  (`motion.test.ts`).
- **Tokens** (`:root` in `src/index.css`, mapped as `--color-table-*`):
  `--table-gold-light`, `--table-gold-dark`, `--table-gold-line`,
  `--table-mana`, `--table-danger`, `--table-attack`, `--table-wood`,
  `--table-wood-frame`, `--table-leather`, `--table-panel`, `--table-plaque`;
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
  §4.10): overlapping cards sized by the hand's height, turned and on an arc,
  sinking a little below its edge; the card under the mouse or the swiping
  thumb (by the cards' resting places) or with keyboard focus rises whole
  above the hand at a full card's size; a tap is the lifted card's primary
  activation, a swipe does nothing else, a long press opens the card view;
  the toolbar's keyboard stays. Every card keeps 24 px of its own (smaller
  cards first, a sideways row only beyond); the hand's height is the
  mockup's beside the side columns (`quadrat`, `breit`).
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
