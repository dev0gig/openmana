/*
 * Can this browser run the Forge engine? The same check the engine client
 * makes before it downloads anything (engine/protocol/src/features.ts).
 */
import { CircleCheck, CircleMinus, CircleX } from "lucide-react"
import { useState } from "react"
import type { FeatureReport } from "@openmana/engine-protocol"
import { detectEngineFeatures, FEATURE_LABELS } from "@openmana/engine-protocol/features"

export function useDeviceFeatures(): FeatureReport {
  const [features] = useState(() => detectEngineFeatures({ requireIsolation: true }))
  return features
}

type FeatureKey = keyof typeof FEATURE_LABELS

export function FeatureChecklist({ features }: { features: FeatureReport }) {
  const keys = Object.keys(FEATURE_LABELS) as FeatureKey[]
  return (
    <ul className="flex flex-col gap-2 text-sm" aria-label="Voraussetzungen der Engine">
      {keys.map((key) => {
        const value = features[key]
        return (
          <li key={key} className="flex items-center gap-2">
            {value === true ? (
              <CircleCheck aria-hidden className="size-4 shrink-0 text-primary" />
            ) : value === null ? (
              <CircleMinus aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <CircleX aria-hidden className="size-4 shrink-0 text-destructive" />
            )}
            <span>{FEATURE_LABELS[key]}</span>
            <span className="sr-only">{value === true ? "vorhanden" : value === null ? "nicht zutreffend" : "fehlt"}</span>
          </li>
        )
      })}
    </ul>
  )
}
