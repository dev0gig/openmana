/*
 * The app's top bar (series openmana-menuestil, prompt 57; the template's
 * header, version "Reich"): the game table's panel tone falling darker, a
 * gold hairline below - like the table's own header. shadcn has no app bar,
 * so it is built the shadcn way: data-slot, cn(), theme tokens only.
 *
 * appHeaderButtonVariants() turns a shadcn Button (ghost, an icon size) into
 * the bar's symbol button: round, a gold hairline, gold symbol on a darker
 * panel tone (the template's .icon-btn). Size, touch size (Design System
 * rule 5) and the focus ring stay the Button's.
 */
import * as React from "react"
import { cn } from "cn"

function AppHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="app-header"
      className={cn(
        "sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-gold-line bg-linear-to-b from-bar-top to-bar-bottom px-4 md:h-12",
        className
      )}
      {...props}
    />
  )
}

function appHeaderButtonVariants({ className }: { className?: string } = {}) {
  return cn(
    "rounded-full border-gold-line bg-panel-shade text-gold-light hover:bg-panel hover:text-gold-light aria-expanded:bg-panel aria-expanded:text-gold-light dark:hover:bg-panel",
    className
  )
}

export { AppHeader, appHeaderButtonVariants }
