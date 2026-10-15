/*
 * The background behind every page outside the game table (series
 * openmana-menuestil, prompt 57; the template's .surface, version "Reich"):
 * a warm gold light from above, a cool blue from below and two pairs of fine
 * golden swings, one pair near the top and one near the bottom - still, no
 * motion.
 *
 * The one page-level effect of the app (Design System §3 rule 1, the project
 * owner's exception of 2026-10-15): exactly this component, placed once by
 * the app shell (src/app/app-shell.tsx) behind the content and never while a
 * game or a replay takes the screen (the table has its arena). Fixed to the
 * window, so it takes no room and never scrolls or grows a page; decoration
 * only - hidden from screen readers, no pointer events, no focus.
 *
 * Built the shadcn way (data-slot, cn(), theme tokens only); the light is an
 * SVG stretched over the window, so CSS percentages carry over exactly:
 * radial-gradient(120% 55% at 50% -8%) is a unit circle moved to (500, -80)
 * and scaled by (1200, 550) in the 1000 × 1000 box.
 */
import * as React from "react"
import { cn } from "cn"

const light = (offset: number, token: string, opacity: number) => <stop offset={offset} style={{ stopColor: `var(${token})`, stopOpacity: opacity }} />

function AppSurface({ className, ...props }: Omit<React.ComponentProps<"div">, "children">) {
  const id = React.useId().replace(/[^\w-]/g, "")
  return (
    <div data-slot="app-surface" aria-hidden="true" className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)} {...props}>
      <svg focusable="false" viewBox="0 0 1000 1000" preserveAspectRatio="none" className="size-full">
        <defs>
          {/* Warm light from above: --primary at 10 %, gone at 60 % of the ellipse. */}
          <radialGradient id={`${id}-warm`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(500 -80) scale(1200 550)">
            {light(0, "--primary", 0.1)}
            {light(0.6, "--primary", 0)}
          </radialGradient>
          {/* Cool blue from below: --surface-cool at 22 %, gone at 65 %. */}
          <radialGradient id={`${id}-cool`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(500 1150) scale(900 600)">
            {light(0, "--surface-cool", 0.22)}
            {light(0.65, "--surface-cool", 0)}
          </radialGradient>
        </defs>
        <rect width="1000" height="1000" fill={`url(#${id}-cool)`} />
        <rect width="1000" height="1000" fill={`url(#${id}-warm)`} />
        {/* The golden swings: hairlines at any size (non-scaling stroke), the second of each pair fainter. */}
        <g fill="none" strokeWidth="1.2" style={{ stroke: "var(--primary)" }} strokeOpacity="0.22">
          <path vectorEffect="non-scaling-stroke" d="M-20 120 C 220 40 420 260 1020 90" />
          <path vectorEffect="non-scaling-stroke" d="M-20 160 C 260 90 460 300 1020 140" opacity=".5" />
          <path vectorEffect="non-scaling-stroke" d="M-20 900 C 300 980 600 760 1020 880" />
          <path vectorEffect="non-scaling-stroke" d="M-20 860 C 280 940 640 720 1020 840" opacity=".5" />
        </g>
      </svg>
    </div>
  )
}

export { AppSurface }
