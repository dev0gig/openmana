/* Label/value pairs (versions, sizes, timings) as a description list. */
import type { ReactNode } from "react"

export interface Fact {
  readonly label: string
  readonly value: ReactNode
}

export function FactList({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="flex flex-col divide-y text-sm">
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="min-w-0 text-right font-medium break-words tabular-nums">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}
