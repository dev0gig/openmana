/*
 * Choosing the card language (prompt 12, card-language.ts): German where
 * Scryfall has it (the default) or English. Saved at once; the app's card
 * views follow right away, a game from the next one on (the engine names the
 * cards in its texts in the language it was started with).
 */
import { useId } from "react"
import { usePreferences } from "@/app/preferences"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSaveSetting } from "@/storage/use-save-setting"
import { CARD_LANGUAGE, type CardLanguagePreference } from "./card-language"

export const CARD_LANGUAGE_LABELS: Readonly<Record<CardLanguagePreference, string>> = {
  de: "Deutsch",
  en: "Englisch",
}

const DESCRIPTIONS: Readonly<Record<CardLanguagePreference, string>> = {
  de: "Name, Text und Bild auf Deutsch, wo Scryfall eine deutsche Fassung kennt – sonst englisch und so markiert. Forge nennt die Karten in einer Partie deutsch.",
  en: "Alle Karten auf Englisch – für alle, die sie unter ihren englischen Namen kennen. Forge nennt die Karten in einer Partie englisch; seine eigenen Sätze bleiben deutsch.",
}

function Option({ language }: { language: CardLanguagePreference }) {
  const id = useId()
  return (
    <FieldLabel htmlFor={id}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle id={`${id}-title`}>{language === CARD_LANGUAGE.fallback ? `${CARD_LANGUAGE_LABELS[language]} (Vorgabe)` : CARD_LANGUAGE_LABELS[language]}</FieldTitle>
          <FieldDescription id={`${id}-description`}>{DESCRIPTIONS[language]}</FieldDescription>
        </FieldContent>
        {/* A radio is a button: named by aria-labelledby (a label element does not name a button for every screen reader). */}
        <RadioGroupItem value={language} id={id} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} />
      </Field>
    </FieldLabel>
  )
}

export function CardLanguageOptions() {
  const { cardLanguage, status } = usePreferences()
  const save = useSaveSetting()
  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        value={cardLanguage}
        onValueChange={(value) => {
          if (CARD_LANGUAGE.check(value)) void save(CARD_LANGUAGE, value)
        }}
        disabled={status === "loading"}
        aria-label="Kartensprache"
      >
        <Option language="de" />
        <Option language="en" />
      </RadioGroup>
      <p className="text-sm text-muted-foreground">Gilt in der App sofort, in einer Partie ab der nächsten – eine laufende Partie behält ihre Sprache.</p>
    </div>
  )
}
