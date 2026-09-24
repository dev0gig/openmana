/*
 * Bottom navigation bar for phones. shadcn/ui has none, so it is built the
 * shadcn way: data-slot, cn(), asChild via Radix Slot, theme tokens only.
 * Up to five destinations, each a full-height touch target (64 px). Hidden
 * from md upwards, where the sidebar takes over.
 */
import * as React from "react"
import { cn } from "cn"
import { Slot } from "radix-ui"

function BottomNav({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="bottom-nav"
      className={cn(
        "sticky bottom-0 z-20 flex h-16 w-full shrink-0 items-stretch border-t bg-background md:hidden",
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
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset data-[active=true]:text-primary [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

export { BottomNav, BottomNavItem }
