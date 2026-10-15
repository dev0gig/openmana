/*
 * The app's top bar (series openmana-menuestil, prompt 57; the template's
 * header, version "Reich"): the game table's panel tone falling darker, a
 * gold hairline below - like the table's own header. shadcn has no app bar,
 * so it is built the shadcn way: data-slot, cn(), theme tokens only.
 *
 * appHeaderButtonVariants() turns a shadcn Button (ghost, an icon size) into
 * the bar's symbol button: round, a gold hairline, gold symbol on a darker
 * panel tone (the template's .icon-btn). Size, touch size (Design System
 * rule 5) and the focus ring stay the Button's. Since prompt 58 the ghost
 * Button turns gold under menu: on hover; the bar's button keeps its lighter
 * panel tone there (menu:hover:bg-panel wins over the ghost's).
 *
 * The page asks for the whole screen (index.html, viewport-fit=cover, so
 * Chrome in the ORYX app never moves it below the front camera): the bar's
 * tone reaches under the camera, its content keeps the safe-area insets.
 */
import * as React from "react"
import { cn } from "cn"

function AppHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="app-header"
      className={cn(
        "sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-gold-line bg-linear-to-b from-bar-top to-bar-bottom px-4 md:h-12",
        // Edge to edge (viewport-fit=cover, 2026-10-15): the bar reaches under the front camera, its content keeps clear of it
        // (from md on the sidebar lies at the left edge and keeps clear of a camera there itself).
        "h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:h-[calc(3rem+env(safe-area-inset-top))] md:pl-4",
        className
      )}
      {...props}
    />
  )
}

function appHeaderButtonVariants({ className }: { className?: string } = {}) {
  return cn(
    "rounded-full border-gold-line bg-panel-shade text-gold-light hover:bg-panel hover:text-gold-light aria-expanded:bg-panel aria-expanded:text-gold-light dark:hover:bg-panel menu:hover:bg-panel menu:aria-expanded:bg-panel",
    className
  )
}

export { AppHeader, appHeaderButtonVariants }
