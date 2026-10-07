/* shadcn-style contextual help trigger: the turn/phase area remains readable on small tables. */
import type { ComponentProps } from "react"
import { CircleHelp } from "lucide-react"
import { cn } from "cn"
import { Button } from "./button"

export function GameHelpButton({ className, children, ...props }: ComponentProps<typeof Button>) {
  return <Button data-slot="game-help-button" variant="ghost" className={cn("h-auto min-h-11 min-w-0 flex-1 items-center justify-start gap-1 px-1 py-0.5 text-left whitespace-normal", className)} {...props}>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
    <CircleHelp aria-hidden className="size-3.5 shrink-0" />
  </Button>
}
