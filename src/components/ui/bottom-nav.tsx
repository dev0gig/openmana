/*
 * Bottom navigation bar for phones. shadcn/ui has none, so it is built the
 * shadcn way: data-slot, cn(), asChild via Radix Slot, theme tokens only.
 * Up to five destinations, each a full-height touch target (64 px). Hidden
 * from md upwards, where the sidebar takes over.
 *
 * OpenMana menu style (series openmana-menuestil, prompt 57; the template's
 * nav.bottom, version "Reich"): the bar in the tone of the game table's action
 * bar with a gold hairline towards the content; the current destination in
 * gold with a glowing gold line above its symbol, the others muted.
 * aria-current="page" is the truth and the mark follows it (a NavLink child
 * sets it itself; otherwise isActive does).
 */
import * as React from "react"
import { cn } from "cn"
import { Slot } from "radix-ui"

// OpenMana: motion-reduce: stops the animations and transitions below when the
// device or the player asks for less motion (src/app/motion.ts, prompt 12).

function BottomNav({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="bottom-nav"
      className={cn(
        "sticky bottom-0 z-20 flex h-16 w-full shrink-0 items-stretch border-t border-gold-line bg-linear-to-b from-dock-top to-dock-bottom md:hidden",
        className
      )}
      {...props}
    />
  )
}

function BottomNavItem({
  className,
  isActive = false,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & { isActive?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="bottom-nav-item"
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 motion-reduce:transition-none!",
        // The mark of the current destination: gold words, a gold halo round the symbol, a glowing gold line above it.
        "aria-[current=page]:text-gold-light aria-[current=page]:[&_svg]:drop-shadow-gold-glow aria-[current=page]:before:pointer-events-none aria-[current=page]:before:absolute aria-[current=page]:before:inset-x-[30%] aria-[current=page]:before:top-0 aria-[current=page]:before:h-0.5 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-primary aria-[current=page]:before:shadow-gold-glow",
        className
      )}
      {...props}
    />
  )
}

export { BottomNav, BottomNavItem }
