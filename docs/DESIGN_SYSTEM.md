# OpenMana Design System

> Canonical rules for OpenMana's user interface, established with prompt 06
> (web/PWA skeleton). Product intent lives in [BIBLE.md](BIBLE.md) §6, §10, §11,
> §13 and §17; this document says how the UI is built. Implementation record:
> [implementation/06-web-pwa-skeleton.md](implementation/06-web-pwa-skeleton.md).

## 1. Foundations

- **Components: shadcn/ui only.** Style `radix-maia` (soft, rounded, generous
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

Fonts are bundled (Fontsource), never loaded from a font CDN: same-origin
files work under COEP and nothing leaks to third parties (Bible §15).

## 3. Rules

1. **No custom CSS, no ad-hoc Tailwind styling.** Layout utilities (`flex`,
   `grid`, `gap-*`, `p-*`, `max-w-*`, responsive prefixes) compose
   components; colours, shadows, gradients, arbitrary values (`bg-[#…]`,
   `w-[…]`) and page-level visual effects do not appear in pages.
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
   game, ending one without a result) are confirmed in an `AlertDialog` whose
   destructive button says what happens ("Endgültig entfernen", "Lokale Daten
   ersetzen", "Aufgeben") and whose cancel button keeps things as they are
   ("Weiterspielen").
5. **Touch first.** On coarse pointers (`pointer-coarse:`) buttons, sidebar
   entries, menu entries, select triggers and options and toggles grow to at
   least 44 px (default `h-11`, `lg` `h-12`, icons `size-11`, menu entries
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
   turning: a loading indicator that stops looks like a frozen page. Code that
   moves things itself (the game table's animations, when later prompts add
   them - the table of prompts 13 and 14 has none: a tapped card turns at
   once, a mark appears at once; the card view moves only as shadcn's `Sheet`)
   asks `useDeviceReducedMotion()`/`reducedMotion()` in `src/app/motion.ts`
   together with the preference.

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
scrolls inside its region – card rows sideways, texts downwards:

| Orientation | Regions |
|---|---|
| portrait (phones, folded foldables, tablets upright) | header · opponent (with their hand) · opponent's battlefield · stack and combat · your battlefield · you · decision · hand, top to bottom; stack/combat and decision capped (`max-h-32`, `max-h-44`) |
| landscape (desktop, tablets, foldables and phones turned) | left: header, both battlefields, hand; right, a side column (15–24 rem): the opponent next to the header, stack and combat, the decision, you next to the hand |

**Cards are controls** (prompt 14): every card the player may see is a
`GameCardButton` in a `GameCardRow` toolbar (one Tab stop per row; arrow keys,
Home and End move between its cards). Its primary activation opens the **card
view** - a `Sheet` from the bottom in portrait (thumb reach), from the right in
landscape: the card large, Forge's words and facts, what Forge offers, and a
footer that stays in view while the card scrolls (in landscape its two buttons
side by side). A long press, a right click or the context-menu key opens it
too - in the steps whose taps act at once (paying, attacking, blocking, the
London mulligan, a selection) the only way to look. The card view's main button
carries Forge's words for the tap and is armed a moment after it appears.

**Forge's decisions** (prompt 15) are answered in the decision region, right
above the hand (beside the player's half in landscape): what Forge asks (the
asking card's picture, the kind of decision, Forge's words), the controls -
Forge's buttons, choice cards (a `RadioGroup` for one, `Checkbox`es for
several, like the preference choices), rows of cards the table does not show,
lists with arrows (order, top/bottom of a pile), plus/minus for amounts, a
field for a number - and the answer buttons, which stick to the bottom of the
region while a long list scrolls above them. The region grows only as far as
its content needs: `GameBoard decision="tall"` (more words than fit: up to
28 % of a portrait screen, the rest scrolls) and `"expanded"` (a list or form
Forge waits on alone, cards outside the table: up to 36 %; stack and combat
keep a smaller strip, the battlefields a row of cards); in a low landscape window
(`short:` = at most 32rem high, a custom variant in `src/index.css`) an
expanded decision takes both middle rows of the side column and stack and
combat step aside. Sending buttons are armed a moment after they appear, like
the card view's.

Both battlefields share the free height equally; a battlefield shows two rows
(creatures next to the middle, other permanents outside) from 176 px, one
below. Cards are sized by their row's height (`GameCard`), so less room means
smaller cards, never a longer page. Rows are centred while they fit and scroll
sideways when not. Zone sizes show their word where the bar is wide enough
(container query) and their symbol where not; screen readers and tooltips keep
the word.

## 5. Inventory

| Component | Source | Used for |
|---|---|---|
| `Button`, `Badge`, `Card`, `Alert`, `Separator`, `Tooltip`, `Sheet`, `Sidebar` (+ `Input`, `Skeleton` it needs), `Sonner`, `Empty`, `Item`, `Spinner` | shadcn/ui registry (`radix-maia`) | everything on screen |
| `Dialog`, `AlertDialog`, `RadioGroup`, `Field` (+ `Label` it needs) | shadcn/ui registry (`radix-maia`, prompt 07) | the backup import (dialog with choice cards: `RadioGroup` items inside `FieldLabel`, named by `aria-labelledby`), confirmations of irreversible actions |
| `AspectRatio`, `Progress` | shadcn/ui registry (`radix-maia`, prompt 08) | card proportions; installing the card catalog |
| `Textarea` | shadcn/ui registry (`radix-maia`, prompt 09) | pasting a deck list (grows with its content up to `max-h-96`, then scrolls) |
| `DropdownMenu`, `Select`, `ToggleGroup` (+ `Toggle` it needs) | shadcn/ui registry (`radix-maia`, prompt 10) | a deck's actions (menu „Mehr“, not modal so a dialog opened from it gets the focus), sorting and the format filter of the deck library |
| `Switch` | shadcn/ui registry (`radix-maia`, prompt 12) | an on/off preference („Bewegungen reduzieren“), inside a `FieldLabel` row so the whole row is the touch target; one-of-several preferences (AI profile, card language) are a `RadioGroup` of choice cards like the backup import. Preferences are saved the moment they change (no save button) |
| `GameBoard`, `GameBoardArea` | `src/components/ui/game-board.tsx`, built the shadcn way (prompt 13) | the game table's frame: eight named regions in a grid, portrait and landscape arrangement (§4), never scrolling itself |
| `GameCard`, `GameCardCaption`, `GameCardBack`, `GameCardGroup` | `src/components/ui/game-card.tsx`, built the shadcn way (prompt 13) | a card on the game table, sized by its row's height (63 × 88): its `CardPicture`, turned a quarter when tapped (square place), its facts in the caption strip **below** the picture (never on it: Scryfall forbids covering card images); OpenMana's own back for cards Forge hides (never Wizards' back); a card with its attachments in one dashed frame |
| `GameCardButton`, `GameCardRow`, `GameCardRowItem`, `GameCardRowButton`; the `mark` of `GameCard`/`GameCardButton` | `src/components/ui/game-card.tsx`, built the shadcn way (prompt 14) on Radix `Toolbar` (from `radix-ui`) | a card as a control: a button with shadcn's focus ring around the whole card, no image menu or text selection on a long press; Forge's state as a frame around the picture in the room every card keeps (`mark`: usable = dashed `--primary`, chosen = solid `--foreground`); a row of such cards as a toolbar (roving focus), else a focusable list |
| `Checkbox` | shadcn/ui registry (`radix-maia`, prompt 15; `motion-reduce` added) | several choices of one of Forge's questions, inside a `FieldLabel` choice card (the whole card is the touch target) |
| `GameDecision`, `GameDecisionHeader`, `GameDecisionSource`, `GameDecisionRow`, `GameDecisionNote`, `GameDecisionActions`; `GameBoard`'s `decision` (`compact`/`tall`/`expanded`) | `src/components/ui/game-decision.tsx`, `game-board.tsx`, built the shadcn way (prompt 15) | the decision region's content: what Forge asks (the asking card as a small `GameCardButton`), a row of a question's cards at a hand's height, short lines (how many, why a button is off), the answer buttons sticking to the region's bottom; the region's growth (§4) |
| `ActionBar` | `src/components/ui/action-bar.tsx`, built the shadcn way (prompt 10) | a page's primary action on phones: sticky right above the tab bar (`bottom-16`), at the end of the content column – on a short page too (since prompt 11 the `Page` column fills the screen and the bar is pushed to its end, `mt-auto`); pages render it only below `md` (`useIsMobile`) and put the same actions into the header above |
| `CardPicture` | `src/components/ui/card-picture.tsx`, built the shadcn way (prompt 08) | every picture of a Magic card: `AspectRatio` 63 × 88, `Skeleton` while loading, the card's text in place of a missing or failed picture (`data-state` loading/loaded/failed/missing); loads Scryfall's pictures in CORS mode without referrer and never crops them (`object-contain`: Scryfall forbids cutting off artist or copyright) |
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
- Nothing is drawn over a card picture (badges, counters, tints, blur): a
  card's facts go into the caption strip below it (`GameCardCaption`), a state
  that changes the card itself (tapped) is a quarter turn of the whole card
  (prompt 13), and Forge's marks are a frame around the picture (prompt 14).
- Card states (prompt 14) reuse the palette on purpose instead of new
  colours: "usable now" is the one accent for "do this" (`--primary`, dashed),
  "chosen" the strongest contrast there is (`--foreground`, solid). Dashed
  against solid tells them apart without colour (WCAG 1.4.1); both reach 3:1
  against the table's surfaces (1.4.11, checked by `design-tokens.test.ts`).
  A state that needs a colour of its own later (targets, attackers - prompts
  17-19) follows the token-pair rule above.
