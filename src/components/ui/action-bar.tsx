/*
 * The phone's bar for a page's primary action. shadcn/ui has none, so it is
 * built the shadcn way: data-slot, cn(), theme tokens only. It sticks to the
 * bottom of the screen right above the tab bar (BottomNav is h-16, hence
 * bottom-16) while the page scrolls, so the action never ends up below a
 * long list (Anvil lesson, Bible §16). It sits at the end of the page's
 * content column and spans it (-mx-4 against the column's px-4). On a short
 * page it is pushed to the column's end as well (mt-auto: the column fills
 * the screen between top bar and tab bar), right above the tab bar (-mb-6
 * against the column's py-6), so the action is always in the same place.
 * Pages show it on phones only; from md their actions sit in the page header.
 */
import * as React from "react"
import { cn } from "cn"

function ActionBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="region"
      data-slot="action-bar"
      className={cn("sticky bottom-16 z-10 -mx-4 mt-auto -mb-6 flex flex-wrap items-center gap-3 border-t bg-background px-4 py-3", className)}
      {...props}
    />
  )
}

export { ActionBar }
