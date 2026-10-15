/*
 * The menu style's ornaments (series openmana-menuestil, prompt 58; Design
 * System §10): shadcn has none, so they are built the shadcn way - data-slot,
 * cn(), theme tokens only.
 *
 *   OrnamentCorner   the game table's corner ornament (table.css
 *                    .table-panel::before, the template's .tafel corners):
 *                    two rounded gold strokes, a dot at each end and a small
 *                    point in the corner. corner="start" sits top left,
 *                    corner="end" bottom right (turned half round). Its
 *                    parent must be positioned (relative, fixed …).
 *   OrnamentDivider  the line under a page title (the template's .divider):
 *                    a gold line that grows towards the middle from both
 *                    sides and a small glowing diamond between them.
 *
 * Both are decoration only: aria-hidden, no pointer events, no focus. The
 * corner takes no room (absolutely placed over its parent's padding); the
 * divider is a thin line of its own height. Nothing moves.
 */
import * as React from "react"
import { cn } from "cn"

/** The corner's drawing, in a 28 × 28 box with the corner at its top left (the table's mask, drawn in currentColor). */
function CornerShape() {
  return (
    <>
      <g fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 18V7a5 5 0 0 1 5-5h11" />
        <path d="M6 22V11a5 5 0 0 1 5-5h11" opacity=".45" />
      </g>
      <g fill="currentColor">
        <circle cx="2" cy="21" r="1.5" />
        <circle cx="21" cy="2" r="1.5" />
        <path d="M2 2l3 1.2L2 4.4z" />
      </g>
    </>
  )
}

function OrnamentCorner({
  className,
  corner = "start",
  ...props
}: Omit<React.ComponentProps<"svg">, "children"> & { corner?: "start" | "end" }) {
  return (
    <svg
      data-slot="ornament-corner"
      data-corner={corner}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 28 28"
      className={cn(
        "pointer-events-none absolute size-6.5 text-primary opacity-85 select-none data-[corner=end]:right-1.25 data-[corner=end]:bottom-1.25 data-[corner=end]:rotate-180 data-[corner=start]:top-1.25 data-[corner=start]:left-1.25",
        className
      )}
      {...props}
    >
      <CornerShape />
    </svg>
  )
}

function OrnamentDivider({ className, ...props }: Omit<React.ComponentProps<"div">, "children">) {
  return (
    <div
      data-slot="ornament-divider"
      aria-hidden="true"
      className={cn(
        "pointer-events-none flex w-full max-w-88 items-center gap-2.5 select-none before:h-px before:flex-1 before:bg-linear-to-r before:from-transparent before:to-primary after:h-px after:flex-1 after:bg-linear-to-l after:from-transparent after:to-primary",
        className
      )}
      {...props}
    >
      <span className="size-2.25 shrink-0 rotate-45 bg-primary shadow-gold-glow" />
    </div>
  )
}

export { OrnamentCorner, OrnamentDivider }
