/*
 * Following the opponent's turn (prompt 49, opponent-tempo.ts): the tempo,
 * waiting after every action of the Forge AI, and Forge's own auto-pass -
 * in Settings and in the game table's menu, saved at once. A running game
 * takes the tempo and the waiting at once (they are the app's), and the
 * auto-pass through Forge's settings.change (the game page sends it when the
 * saved choice differs from what Forge confirmed).
 */
import type { AutoPass } from "@openmana/engine-protocol"
import { useId } from "react"
import { usePreferences } from "@/app/preferences"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useSaveSetting } from "@/storage/use-save-setting"
import {
  AUTO_PASS,
  AUTO_PASS_CHOICES,
  AUTO_PASS_DESCRIPTIONS,
  AUTO_PASS_LABELS,
  OPPONENT_STEPWISE,
  OPPONENT_TEMPO,
  OPPONENT_TEMPOS,
  STEPWISE_DESCRIPTION,
  STEPWISE_LABEL,
  TEMPO_DESCRIPTIONS,
  TEMPO_LABELS,
  type OpponentTempo,
} from "./opponent-tempo"

function Choice({ value, title, description }: { value: string; title: string; description: string }) {
  const id = useId()
  return (
    <FieldLabel htmlFor={id}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle id={`${id}-title`}>{title}</FieldTitle>
          <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
        </FieldContent>
        {/* A radio is a button: named by aria-labelledby (a label element does not name a button for every screen reader). */}
        <RadioGroupItem value={value} id={id} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} />
      </Field>
    </FieldLabel>
  )
}

/** Tempo and "Weiter" (the app's part). `game`: in the running game's menu (the words say it applies at once). */
export function OpponentTempoOptions({ game = false }: { game?: boolean }) {
  const { opponentTempo, opponentStepwise, status } = usePreferences()
  const save = useSaveSetting()
  const stepwiseId = useId()
  const legendId = useId()
  return (
    <div className="flex flex-col gap-4">
      <FieldSet>
        <FieldLegend id={legendId} variant="label">
          Tempo des Gegnerzugs
        </FieldLegend>
        <RadioGroup
          value={opponentTempo}
          onValueChange={(value) => {
            if (OPPONENT_TEMPO.check(value)) void save(OPPONENT_TEMPO, value)
          }}
          disabled={status === "loading"}
          aria-labelledby={legendId}
        >
          {OPPONENT_TEMPOS.map((tempo: OpponentTempo) => (
            <Choice key={tempo} value={tempo} title={tempo === OPPONENT_TEMPO.fallback ? `${TEMPO_LABELS[tempo]} (Vorgabe)` : TEMPO_LABELS[tempo]} description={TEMPO_DESCRIPTIONS[tempo]} />
          ))}
        </RadioGroup>
      </FieldSet>
      <FieldLabel htmlFor={stepwiseId}>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle id={`${stepwiseId}-title`}>{STEPWISE_LABEL}</FieldTitle>
            <FieldDescription id={`${stepwiseId}-description`}>{STEPWISE_DESCRIPTION}</FieldDescription>
          </FieldContent>
          <Switch
            id={stepwiseId}
            checked={opponentStepwise}
            onCheckedChange={(checked) => void save(OPPONENT_STEPWISE, checked)}
            disabled={status === "loading"}
            aria-labelledby={`${stepwiseId}-title`}
            aria-describedby={`${stepwiseId}-description`}
          />
        </Field>
      </FieldLabel>
      <p className="text-sm text-muted-foreground">
        {game ? "Gilt sofort, auch für die Aktion, die gerade angezeigt wird." : "Gilt sofort, auch in einer laufenden Partie."} Deine eigenen Züge
        bremst das nicht, und eine echte Frage von Forge an dich erscheint immer sofort.
      </p>
    </div>
  )
}

/** Forge's own auto-pass (MatchSettings.autoPass). */
export function AutoPassOptions({ game = false }: { game?: boolean }) {
  const { autoPass, status } = usePreferences()
  const save = useSaveSetting()
  const legendId = useId()
  return (
    <div className="flex flex-col gap-4">
      <FieldSet>
        <FieldLegend id={legendId} variant="label">
          Automatisch weitergeben
        </FieldLegend>
        <RadioGroup
          value={autoPass}
          onValueChange={(value) => {
            if (AUTO_PASS.check(value)) void save(AUTO_PASS, value)
          }}
          disabled={status === "loading"}
          aria-labelledby={legendId}
        >
          {AUTO_PASS_CHOICES.map((choice: AutoPass) => (
            <Choice key={choice} value={choice} title={choice === AUTO_PASS.fallback ? `${AUTO_PASS_LABELS[choice]} (Vorgabe)` : AUTO_PASS_LABELS[choice]} description={AUTO_PASS_DESCRIPTIONS[choice]} />
          ))}
        </RadioGroup>
      </FieldSet>
      <p className="text-sm text-muted-foreground">
        Das ist Forges eigene Einstellung: Forge gibt weiter, nie OpenMana.{" "}
        {game ? "Forge übernimmt sie sofort und bestätigt sie." : "Gilt ab der nächsten Partie und in einer laufenden, sobald du zum Spieltisch zurückkehrst."}
      </p>
    </div>
  )
}
