/*
 * Choosing the AI profile (prompt 12): Forge's profiles as verified
 * (ai-profile-table.ts) - German name, how it plays, what it does differently
 * from Forge's default - and "Zufällig". The choice is saved at once as a
 * preference; Settings shows it, and so does the play page's dialog. It is
 * never part of starting a game (Anvil lesson).
 */
import { TriangleAlert } from "lucide-react"
import { useId } from "react"
import { usePreferences } from "@/app/preferences"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSaveSetting } from "@/storage/use-save-setting"
import { AI_PROFILE_TABLE, DEFAULT_AI_PROFILE, type AiProfileInfo } from "./ai-profile-table"
import { AI_PROFILE, resolveAiProfile, type AiProfileChoice } from "./ai-profiles"

/** What the study found (docs/research/AI_PROFILES.md) - said wherever profiles are chosen, instead of a difficulty. */
export const AI_PROFILE_NOTE =
  "Forge kennt keine Schwierigkeitsstufen: Die Profile ändern, wie die KI spielt – nicht, was sie weiß oder darf. " +
  "In 2 400 Testpartien KI gegen KI gewann keines messbar öfter oder seltener als „Standard“."

export const RANDOM_PROFILE_LABEL = "Zufällig"
export const RANDOM_PROFILE_SUMMARY = `Für jede Partie wird eines der ${AI_PROFILE_TABLE.length} Profile neu gezogen; die Partie zeigt, welches.`

const RANDOM_VALUE = "random"
const PROFILE_PREFIX = "profile:"

function valueOf(choice: AiProfileChoice): string {
  return choice.kind === "random" ? RANDOM_VALUE : `${PROFILE_PREFIX}${choice.name}`
}

function choiceOf(value: string): AiProfileChoice | null {
  if (value === RANDOM_VALUE) return { kind: "random" }
  return value.startsWith(PROFILE_PREFIX) ? { kind: "profile", name: value.slice(PROFILE_PREFIX.length) } : null
}

/** The chosen profile in a few words ("Waghalsig – spielt auf Angriff …"), for the play page. */
export function describeAiProfileChoice(choice: AiProfileChoice): string {
  const resolved = resolveAiProfile(choice)
  switch (resolved.status) {
    case "ok":
      return `${resolved.profile.label} – ${resolved.profile.summary}`
    case "random":
      return `${RANDOM_PROFILE_LABEL} – ${RANDOM_PROFILE_SUMMARY}`
    case "missing":
      return `Das gewählte Profil „${resolved.name}“ gibt es in dieser Version nicht mehr.`
  }
}

function Option({ value, title, summary, traits }: { value: string; title: string; summary: string; traits: readonly string[] }) {
  const id = useId()
  return (
    <FieldLabel htmlFor={id}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle id={`${id}-title`}>{title}</FieldTitle>
          <FieldDescription id={`${id}-summary`}>{summary}</FieldDescription>
          {traits.length > 0 ? (
            <ul id={`${id}-traits`} className="ml-4 flex list-disc flex-col gap-1 text-sm text-muted-foreground">
              {traits.map((trait) => (
                <li key={trait}>{trait}</li>
              ))}
            </ul>
          ) : null}
        </FieldContent>
        {/* A radio is a button: named by aria-labelledby (a label element does not name a button for every screen reader). */}
        <RadioGroupItem value={value} id={id} aria-labelledby={`${id}-title`} aria-describedby={traits.length > 0 ? `${id}-summary ${id}-traits` : `${id}-summary`} />
      </Field>
    </FieldLabel>
  )
}

function profileTitle(profile: AiProfileInfo): string {
  return profile.name === DEFAULT_AI_PROFILE ? `${profile.label} (Vorgabe)` : profile.label
}

/** The profiles to choose from; the stored choice is marked, a change is saved at once. */
export function AiProfileOptions() {
  const { aiProfile, status } = usePreferences()
  const save = useSaveSetting()
  const resolved = resolveAiProfile(aiProfile)
  return (
    <div className="flex flex-col gap-4">
      {resolved.status === "missing" ? (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle>Das gewählte KI-Profil gibt es nicht mehr</AlertTitle>
          <AlertDescription>„{resolved.name}“ gehört nicht zu dieser Version von Forge. Wähle ein anderes – bis dahin startet keine Partie.</AlertDescription>
        </Alert>
      ) : null}
      <RadioGroup
        value={resolved.status === "missing" ? "" : valueOf(aiProfile)}
        onValueChange={(value) => {
          const choice = choiceOf(value)
          if (choice !== null) void save(AI_PROFILE, choice)
        }}
        disabled={status === "loading"}
        aria-label="KI-Profil"
      >
        {AI_PROFILE_TABLE.map((profile) => (
          <Option key={profile.name} value={valueOf({ kind: "profile", name: profile.name })} title={profileTitle(profile)} summary={profile.summary} traits={profile.traits} />
        ))}
        <Option value={RANDOM_VALUE} title={RANDOM_PROFILE_LABEL} summary={RANDOM_PROFILE_SUMMARY} traits={[]} />
      </RadioGroup>
      <p className="text-sm text-muted-foreground">{AI_PROFILE_NOTE}</p>
    </div>
  )
}

/** The play page's way to change the profile: the same choice in a dialog, saved at once. */
export function AiProfileDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label="KI-Profil ändern">
          Ändern
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>KI-Profil wählen</DialogTitle>
          <DialogDescription>Wie die Forge-KI spielt. Die Wahl bleibt gespeichert, bis du sie änderst – auch in den Einstellungen.</DialogDescription>
        </DialogHeader>
        <AiProfileOptions />
        <DialogFooter>
          <DialogClose asChild>
            <Button>Fertig</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
