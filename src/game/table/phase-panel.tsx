/*
 * The turn's phases on the Phasen-Tafel (prompt 41, docs/design/SPIELTISCH.md
 * §4.13-4.14; the mockup's `.phasen`, `.phasen-kompakt`, `vorlage.js`
 * `PHASEN`): the five phases of the turn with a symbol each - the past ones
 * muted, the current one in light; only the current phase unfolds its steps,
 * the step Forge is in gold with a diamond. Forge's step decides everything
 * (`phaseGroups`, turn-model.ts); the table never moves the game on.
 *
 * Two forms, one markup (table.css): the list at the top of the Phasen-Tafel
 * (`place="panel"`, quadrat and breit), folded to one line - the five symbols
 * and "Phase · Schritt" - while a question needs the room (`folded`) or the
 * window is low; and that line in the action bar beside the main button
 * (`place="bar"`, hoch).
 *
 * A picture of words the page says elsewhere, hidden from screen readers
 * (prompt 41's decision): the header's help button reads the turn ("Zug 7 ·
 * Dein Zug") and Forge's step in words, the decision region says what Forge
 * asks - read twice it would only repeat them. Each step's full name stays its
 * title (a tooltip).
 *
 * Anchors (§12): `phase-track` with Forge's step in `data-phase` (absent before
 * the first turn), `phase-track-group` per phase with its name as title,
 * `phase-track-step` with `data-state` (done, current, upcoming) and the full
 * name as title - for a phase of several steps its unfolded steps (only the
 * current phase's), for a main phase the phase's own line.
 */
import { Moon, RotateCcw, Sparkles, Swords, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import type { Phase } from "@openmana/engine-protocol"
import { PHASE_LABELS, phaseLabel } from "../game-labels"
import { STEP_SHORT_LABELS, TURN_PHASE_LABELS } from "../priority-labels"
import { phaseGroups, type TurnPhaseKey } from "../turn-model"
import { TablePanelHead, TablePanelSub, TablePanelTitle } from "./table-panel"

/** Each phase's symbol (the mockup's): the turn begins, a main phase, combat, the turn ends. */
const PHASE_ICONS: Readonly<Record<TurnPhaseKey, LucideIcon>> = {
  beginning: RotateCcw,
  main1: Sparkles,
  combat: Swords,
  main2: Sparkles,
  ending: Moon,
}

/** "Phase · Schritt" of the compact line ("Kampfphase · Angreifer"); a main phase is its own step; before the first turn the header's words. */
export function phaseLine(phase: Phase | null): string {
  if (phase === null) return phaseLabel(null)
  const group = phaseGroups(phase).find((candidate) => candidate.state === "current")
  if (group === undefined) return phaseLabel(phase)
  return group.steps.length === 1 ? TURN_PHASE_LABELS[group.key] : `${TURN_PHASE_LABELS[group.key]} · ${STEP_SHORT_LABELS[phase]}`
}

export function PhasePanel({ phase, turn, place, folded = false, className }: { phase: Phase | null; turn: number; place: "panel" | "bar"; folded?: boolean; className?: string }) {
  const groups = phaseGroups(phase)
  return (
    <div data-slot="phase-panel" data-place={place} data-folded={folded || undefined} aria-hidden className={cn("table-phases", className)}>
      {place === "panel" ? (
        <TablePanelHead className="table-phases-head">
          <TablePanelTitle as="span">Phasen</TablePanelTitle>
          {turn > 0 ? <TablePanelSub>Zug {turn}</TablePanelSub> : null}
        </TablePanelHead>
      ) : null}
      <ol data-slot="phase-track" data-phase={phase ?? undefined} className="table-phase-groups">
        {groups.map((group) => {
          const Icon = PHASE_ICONS[group.key]
          // A main phase is one step: its own line carries the step's anchor.
          const single = group.steps.length === 1 ? group.steps[0]! : null
          return (
            <li key={group.key} data-slot="phase-track-group" data-group={group.key} data-state={group.state} title={TURN_PHASE_LABELS[group.key]} className="table-phase-group">
              <span className="table-phase" {...(single !== null ? { "data-slot": "phase-track-step", "data-state": single.state, title: PHASE_LABELS[single.step] } : {})}>
                <Icon className="table-phase-icon" />
                <span className="table-phase-name">{TURN_PHASE_LABELS[group.key]}</span>
              </span>
              {group.state === "current" && single === null ? (
                <ol className="table-phase-steps">
                  {group.steps.map((step) => (
                    <li key={step.step} data-slot="phase-track-step" data-state={step.state} title={PHASE_LABELS[step.step]} className="table-phase-step">
                      {STEP_SHORT_LABELS[step.step]}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          )
        })}
      </ol>
      <p className="table-phase-line">{phaseLine(phase)}</p>
    </div>
  )
}
