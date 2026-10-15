/*
 * The OpenMana emblem and wordmark (series openmana-menuestil, prompt 57;
 * Design System §2-§3). shadcn has neither, so they are built the shadcn way:
 * data-slot, cn(), theme tokens only.
 *
 * The emblem is the game table's compass (prompt 39, docs/design/SPIELTISCH.md
 * §4.2): an eight-pointed star in a ring, in the table's gold gradient
 * (--table-gold-light over --primary to --table-gold-dark), its inner star
 * and hub in the night blue. One drawing for the whole app: the app's bars
 * and the start page draw `Emblem`, the table draws the same `Emblem` in its
 * header (`TableEmblem`) and the same shapes inside its card back
 * (`TableArt`, src/game/table/table-art.tsx). The app icon (public/icons,
 * manifest, PWA) is a different picture and stays as it is.
 *
 * Both are decoration (aria-hidden, no focus, no pointer): what they stand
 * for is said in words beside them (the start link's name, a page's heading).
 */
import * as React from "react"
import { cn } from "cn"

const stop = (offset: number, token: string) => <stop offset={offset} style={{ stopColor: `var(${token})` }} />

/**
 * The gold gradient of the emblem (and of the table's drawn pieces): a
 * vertical gradient across each shape's box. Goes inside an SVG's <defs>.
 */
function EmblemGold({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stop(0, "--table-gold-light")}
      {stop(0.45, "--primary")}
      {stop(1, "--table-gold-dark")}
    </linearGradient>
  )
}

/** The emblem's shapes in a 100 × 100 box, painted with `gold` (a paint such as `url(#…)`). */
function EmblemShapes({ gold }: { gold: string }) {
  return (
    <>
      <circle cx="50" cy="50" r="44" fill="none" stroke={gold} strokeWidth="3" />
      <circle cx="50" cy="50" r="38" fill="none" stroke={gold} strokeWidth="1" strokeDasharray="1.5 3.2" />
      <path d="M50 4 57 43 96 50 57 57 50 96 43 57 4 50 43 43Z" fill={gold} />
      <path d="M50 22 54 46 78 50 54 54 50 78 46 54 22 50 46 46Z" style={{ fill: "var(--background)" }} opacity=".55" transform="rotate(45 50 50)" />
      <circle cx="50" cy="50" r="6" style={{ fill: "var(--background)" }} stroke={gold} strokeWidth="2" />
    </>
  )
}

/**
 * The emblem, drawn to fill its box (give it a size: `size-8`). Decoration.
 * `glow` (prompt 59, the start page's hero - the template's .hero svg): a
 * soft gold glow around it (drop-shadow-gold-halo); still, no room taken.
 */
function Emblem({ className, glow = false, ...props }: Omit<React.ComponentProps<"svg">, "children"> & { glow?: boolean }) {
  // useId's characters are not all welcome in url(#…): keep letters, digits, - and _.
  const gold = `emblem-gold-${React.useId().replace(/[^\w-]/g, "")}`
  return (
    <svg
      data-slot="emblem"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      data-glow={glow || undefined}
      className={cn("pointer-events-none shrink-0", glow && "drop-shadow-gold-halo", className)}
      {...props}
    >
      <defs>
        <EmblemGold id={gold} />
      </defs>
      <EmblemShapes gold={`url(#${gold})`} />
    </svg>
  )
}

/**
 * "OpenMana" as a logotype: Cinzel, gold falling from --gold-light to
 * --primary (the template's .wordmark). Decoration - a link or heading
 * around it carries the name.
 */
function Wordmark({ className, ...props }: Omit<React.ComponentProps<"span">, "children">) {
  return (
    <span
      data-slot="wordmark"
      aria-hidden="true"
      className={cn(
        "bg-linear-to-b from-gold-light to-primary to-70% bg-clip-text font-heading font-semibold tracking-wide text-transparent",
        className
      )}
      {...props}
    >
      OpenMana
    </span>
  )
}

export { Emblem, EmblemGold, EmblemShapes, Wordmark }
