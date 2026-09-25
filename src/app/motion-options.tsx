/*
 * Less motion in Settings (prompt 12, motion.ts): one switch. It can only
 * add a reduction - when the device already asks for less motion, OpenMana
 * follows the device whatever the switch says, and the page says so.
 */
import { useId } from "react"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useSaveSetting } from "@/storage/use-save-setting"
import { MOTION, useDeviceReducedMotion } from "./motion"
import { usePreferences } from "./preferences"

export function MotionOptions() {
  const id = useId()
  const { motion, status } = usePreferences()
  const device = useDeviceReducedMotion()
  const save = useSaveSetting()
  return (
    <FieldLabel htmlFor={id}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle id={`${id}-title`}>Bewegungen reduzieren</FieldTitle>
          <FieldDescription id={`${id}-description`}>
            {device
              ? "Dein Gerät wünscht weniger Bewegung – OpenMana hält sich schon daran: keine Einblendungen, Übergänge und Animationen."
              : "Keine Einblendungen, Übergänge und Animationen, auch wenn dein Gerät sie erlaubt. Ladeanzeigen drehen sich weiter, damit nichts wie eingefroren wirkt."}
          </FieldDescription>
        </FieldContent>
        <Switch
          id={id}
          checked={motion === "reduce"}
          onCheckedChange={(checked) => void save(MOTION, checked ? "reduce" : "system")}
          disabled={status === "loading"}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
        />
      </Field>
    </FieldLabel>
  )
}
