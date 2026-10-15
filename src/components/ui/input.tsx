import * as React from "react"
import { cn } from "cn"

// OpenMana: motion-reduce: stops the animations and transitions below when the
// device or the player asks for less motion (src/app/motion.ts, prompt 12).

// OpenMana (menu style "Reich", prompt 58; Design System §10): outside the game
// table's board (menu:) text inputs lie on the darker well of a panel
// (--panel-well) inside a gold line strong enough to find them (--gold-edge,
// 3:1); focus and invalid borders as the registry's.

// OpenMana: text inputs keep the same 44 px coarse-pointer minimum as buttons.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 pointer-coarse:h-11 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 motion-reduce:transition-none! menu:border-gold-edge menu:bg-panel-well menu:focus-visible:border-ring menu:aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
