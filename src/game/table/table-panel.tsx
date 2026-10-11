/*
 * The table's panel (prompt 41, docs/design/SPIELTISCH.md §4.12; the mockup's
 * `.tafel`): a dark panel with a gold line, corner ornaments and an inner
 * shadow, its title in Cinzel - the Zauberchronik and the Phasen-Tafel are
 * built on it. Only the look (table.css, `table-panel*`); what a panel holds
 * comes from its user.
 */
import { cn } from "cn"
import type { ComponentProps } from "react"

/** The panel itself: the panel tone darkening downwards, the gold line, two ornaments in opposite corners (table.css). */
export function TablePanel({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="table-panel" className={cn("table-panel", className)} {...props} />
}

/** The panel's head: its title on the left, a number or a short line on the right. */
export function TablePanelHead({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="table-panel-head" className={cn("table-panel-head", className)} {...props} />
}

/** The title in Cinzel, gold (a heading where the panel is a section of the page, a span where it is decoration). */
export function TablePanelTitle({ className, as: Tag = "h2", ...props }: ComponentProps<"h2"> & { as?: "h2" | "span" }) {
  return <Tag className={cn("table-panel-title", className)} {...props} />
}

/** A number in a gold ring beside the title (how many entries). */
export function TablePanelCount({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("table-panel-count", className)} {...props} />
}

/** A short line beside the title ("Zug 7"). */
export function TablePanelSub({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("table-panel-sub", className)} {...props} />
}
