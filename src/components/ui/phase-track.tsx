/*
 * The steps of a turn as a track (prompt 16), built the shadcn way
 * (data-slot, cn(), theme tokens only): shadcn/ui has none. One short bar per
 * step, grouped by the turn's phases: the current step wide in the accent
 * colour, the steps before it in the muted foreground, the ones to come in
 * the border colour - where in its turn the game is, at a glance.
 *
 * Only a picture of what the text beside it says (the step's name): the
 * track itself is hidden from screen readers; each bar names its step as a
 * tooltip.
 */
import * as React from "react"
import { cn } from "cn"

export type PhaseTrackStepState = "done" | "current" | "upcoming"

function PhaseTrack({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="phase-track" aria-hidden className={cn("flex shrink-0 items-center gap-1", className)} {...props} />
}

/** One phase of the turn: its steps close together. */
function PhaseTrackGroup({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="phase-track-group" className={cn("flex items-center gap-0.5", className)} {...props} />
}

function PhaseTrackStep({ className, state = "upcoming", ...props }: React.ComponentProps<"span"> & { state?: PhaseTrackStepState }) {
  return (
    <span
      data-slot="phase-track-step"
      data-state={state}
      className={cn(
        "block h-1.5 w-1 rounded-full bg-border data-[state=current]:w-3 data-[state=current]:bg-primary data-[state=done]:bg-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { PhaseTrack, PhaseTrackGroup, PhaseTrackStep }
