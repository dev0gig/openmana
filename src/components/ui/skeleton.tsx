import { cn } from "cn"

// OpenMana: motion-reduce: stops the animations and transitions below when the
// device or the player asks for less motion (src/app/motion.ts, prompt 12).

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-xl bg-muted motion-reduce:animate-none!", className)}
      {...props}
    />
  )
}

export { Skeleton }
