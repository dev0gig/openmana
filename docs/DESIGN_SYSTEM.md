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
   touch sizes (rule 5), German screen-reader strings, the dark-only toaster
   without `next-themes`, a dialog that scrolls inside the screen instead of
   running off it (`DialogContent`: `max-h` + `overflow-y-auto`, prompt 07).
4. **Honest states.** No sample data, no simulated engine, no pretend
   features. Empty states use `Empty`; an action that is not possible yet
   stays visible but disabled and says why (`aria-describedby`); failures
   show a destructive `Alert` in place and a toast if they happen elsewhere
   (Bible §16: nothing fails silently). "Empty" is only shown when the local
   database says so: while it loads the page shows a `Skeleton`, and if it
   cannot be read the page shows why, never an empty list.
   Irreversible actions (deleting, replacing, resetting data) are confirmed
   in an `AlertDialog` whose destructive button says what happens
   ("Endgültig entfernen", "Lokale Daten ersetzen").
5. **Touch first.** On coarse pointers (`pointer-coarse:`) buttons and
   sidebar entries grow to at least 44 px (default `h-11`, `lg` `h-12`,
   icons `size-11`); the phone's tab bar gives each destination a 64 px
   high, full-width target. Mouse layouts stay compact.
6. **Accessible by default** (Bible §17). Text on every surface reaches WCAG
   2.2 AA 4.5:1 (checked from the tokens by `src/app/design-tokens.test.ts`;
   most pairs are above 7:1). Focus is a gold ring. Links in running text are
   always underlined (`TextLink`), not told apart by colour alone. Every page
   has one `h1`, regions have names, icons are `aria-hidden` next to text.
   The end-to-end test runs axe-core on every surface at three sizes and
   fails on serious or critical findings.
7. **German for the player, English for the system.** Every visible and
   screen-reader text is German (including the few strings inside shadcn
   components); code, identifiers, routes (`/decks`, `/play` …), protocol and
   developer messages are English.
8. **Motion** comes only from the shadcn components' built-in transitions.
   Honouring `prefers-reduced-motion` app-wide is part of prompt 12.

## 4. Layout

| Width | Navigation | Notes |
|---|---|---|
| below 768 px (phones, folded foldables) | top bar (logo, settings gear) + bottom **tab bar** with Start, Decks, Spielen, Partien | settings behind the gear, credits behind settings: rare things stay out of the repeated path (Anvil lesson) |
| from 768 px (tablets, unfolded foldables, desktop) | shadcn **Sidebar**, collapsible to icons (`Ctrl/⌘+B`), all six surfaces | the lower group holds Einstellungen and Credits |

Content sits in one column, `max-w-5xl`, with cards in a one- or two-column
grid. Bars are sticky: the page scrolls, the navigation stays reachable. The
game table (prompt 13 onwards) will have its own full-screen layout and must
not turn into one endless vertical page (Bible §6).

## 5. Inventory

| Component | Source | Used for |
|---|---|---|
| `Button`, `Badge`, `Card`, `Alert`, `Separator`, `Tooltip`, `Sheet`, `Sidebar` (+ `Input`, `Skeleton` it needs), `Sonner`, `Empty`, `Item`, `Spinner` | shadcn/ui registry (`radix-maia`) | everything on screen |
| `Dialog`, `AlertDialog`, `RadioGroup`, `Field` (+ `Label` it needs) | shadcn/ui registry (`radix-maia`, prompt 07) | the backup import (dialog with choice cards: `RadioGroup` items inside `FieldLabel`, named by `aria-labelledby`), confirmations of irreversible actions |
| `AspectRatio`, `Progress` | shadcn/ui registry (`radix-maia`, prompt 08) | card proportions; installing the card catalog |
| `Textarea` | shadcn/ui registry (`radix-maia`, prompt 09) | pasting a deck list (grows with its content up to `max-h-96`, then scrolls) |
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
