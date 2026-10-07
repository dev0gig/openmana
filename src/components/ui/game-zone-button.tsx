/* shadcn-style zone inspection control in the table header: keeps all battlefield room. */
import type { ComponentProps } from "react"
import { cn } from "cn"
import { Button } from "./button"

export function GameZoneButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button data-slot="game-zone-button" variant="ghost" size="icon-lg" className={cn(className)} {...props} />
}
