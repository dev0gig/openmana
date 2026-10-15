import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Toggle as TogglePrimitive } from "radix-ui"

// OpenMana: motion-reduce: stops the animations and transitions below when the
// device or the player asks for less motion (src/app/motion.ts, prompt 12).

// OpenMana: on coarse pointers toggles grow like buttons (default and sm to
// 44/40 px, lg to 48 px; docs/DESIGN_SYSTEM.md rule 5).

// OpenMana (menu style "Reich", prompt 58; Design System §10): outside the game
// table's board (menu:) a toggle that is on is gold - gold words on the gold
// shimmer (--gold-glow), the outline's line turning from the gold hairline to
// full gold; ToggleGroup's items share these variants.

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-4xl text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 motion-reduce:transition-none! menu:data-[state=on]:bg-gold-glow menu:data-[state=on]:text-gold-light",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted menu:border-gold-line menu:data-[state=on]:border-primary menu:focus-visible:border-ring",
      },
      size: {
        default:
          "h-9 min-w-9 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 pointer-coarse:h-11 pointer-coarse:min-w-11",
        sm: "h-8 min-w-8 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 pointer-coarse:h-10 pointer-coarse:min-w-10",
        lg: "h-10 min-w-10 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 pointer-coarse:h-12 pointer-coarse:min-w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
