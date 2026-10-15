import * as React from "react"
import { cn } from "cn"
import { OrnamentCorner } from "@/components/ui/ornament"

/*
 * OpenMana (menu style "Reich", prompt 58; Design System §10): outside the
 * game table's board (menu:) a Card is one of the table's panels - its panel
 * tone falling darker (94 %, the background shimmers through a little), a
 * gold hairline (a ring, so it takes no room), a soft shadow with a light
 * inner edge, and the gold corner ornament top left and bottom right. Titles
 * in Cinzel gold (CardTitle).
 *   variant="default"  the panel with its corners - a page's own cards.
 *   variant="plain"    the same panel without corners and drop shadow, for
 *                      dense or nested use (a card inside a card, a row of
 *                      small boxes such as the card view's keyword boxes).
 * The corners are decoration (OrnamentCorner: aria-hidden, no room, no
 * pointer); they come last, so the registry's first-child rules still hold.
 */
function Card({
  className,
  size = "default",
  variant = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm"; variant?: "default" | "plain" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-2xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        "menu:relative menu:bg-transparent menu:bg-linear-to-b menu:from-panel/94 menu:to-panel-shade/94 menu:shadow-panel menu:ring-gold-line menu:data-[variant=plain]:shadow-panel-flat",
        className
      )}
      {...props}
    >
      {children}
      {variant === "default" ? (
        <>
          <OrnamentCorner corner="start" className="hidden menu:block" />
          <OrnamentCorner corner="end" className="hidden menu:block" />
        </>
      ) : null}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-2 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-base font-medium menu:font-semibold menu:text-gold-light", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
