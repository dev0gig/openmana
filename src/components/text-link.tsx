/*
 * A link inside running text: gold and always underlined, so it is not told
 * apart by colour alone (WCAG 1.4.1, axe link-in-text-block).
 */
import { Link, type LinkProps } from "react-router"
import { cn } from "@/lib/utils"

export function TextLink({ className, ...props }: LinkProps) {
  return <Link className={cn("font-medium text-primary underline underline-offset-4 hover:decoration-2", className)} {...props} />
}
