/*
 * Choosing the table's background in Settings (table-background.ts,
 * 2026-10-12): the arena (the default since prompt 53), the drawn wooden
 * table, the three pictures that come with OpenMana, or a picture of the
 * player's own - the pictures with a small preview, saved at once.
 * "Eigenes Bild auswählen" takes a picture file from the device, stores it
 * (scaled down, as WebP) and chooses it; "Eigenes Bild entfernen" deletes it
 * and goes back to the drawn table if it was in use.
 */
import { ImageUp, Trash2 } from "lucide-react"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { usePreferences } from "@/app/preferences"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { ItemMedia } from "@/components/ui/item"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSaveSetting } from "@/storage/use-save-setting"
import { BackgroundImageError, BUILT_IN_BACKGROUNDS, prepareBackgroundImage, TABLE_BACKGROUND, TABLE_BACKGROUND_IMAGE, type TableBackgroundChoice } from "./table-background"

const CHOICES: Readonly<Record<string, TableBackgroundChoice>> = { arena: "arena", table: "table", colors: "colors", planeswalker: "planeswalker", grid: "grid", custom: "custom" }

function Option({ value, title, summary, preview, disabled = false }: { value: TableBackgroundChoice; title: string; summary: string; preview: string | null; disabled?: boolean }) {
  const id = useId()
  return (
    <FieldLabel htmlFor={id}>
      <Field orientation="horizontal" data-disabled={disabled ? "true" : undefined}>
        {preview === null ? null : (
          <ItemMedia variant="image" className="size-16">
            <img src={preview} alt="" />
          </ItemMedia>
        )}
        <FieldContent>
          <FieldTitle id={`${id}-title`}>{title}</FieldTitle>
          <FieldDescription id={`${id}-summary`}>{summary}</FieldDescription>
        </FieldContent>
        {/* A radio is a button: named by aria-labelledby (a label element does not name a button for every screen reader). */}
        <RadioGroupItem value={value} id={id} disabled={disabled} aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`} />
      </Field>
    </FieldLabel>
  )
}

export function TableBackgroundOptions() {
  const { tableBackground, tableBackgroundImage, status } = usePreferences()
  const save = useSaveSetting()
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  // "custom" without a stored picture shows the drawn table (tableBackground()), so the choice says so too.
  const shown: TableBackgroundChoice = tableBackground === "custom" && tableBackgroundImage === null ? "table" : tableBackground

  const choose = async (file: File) => {
    setBusy(true)
    try {
      const image = await prepareBackgroundImage(file)
      if (await save(TABLE_BACKGROUND_IMAGE, image)) await save(TABLE_BACKGROUND, "custom")
    } catch (error) {
      toast.error("Das Bild ließ sich nicht übernehmen", {
        id: "table-background-image",
        description: error instanceof BackgroundImageError ? error.message : "Versuche es mit einer anderen Bilddatei.",
      })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (await save(TABLE_BACKGROUND_IMAGE, null)) {
      if (tableBackground === "custom") await save(TABLE_BACKGROUND, "table")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        value={shown}
        onValueChange={(value) => {
          const choice = CHOICES[value]
          if (choice !== undefined) void save(TABLE_BACKGROUND, choice)
        }}
        disabled={status === "loading" || busy}
        aria-label="Spieltisch-Hintergrund"
      >
        <Option value="arena" title="Arena (Vorgabe)" summary="Die ruhige Steinfläche: warmes Licht oben, kühles Blau unten." preview={null} />
        <Option value="table" title="Holztisch" summary="Der gezeichnete Holztisch mit Spielbrett und Runenkreis." preview={null} />
        {BUILT_IN_BACKGROUNDS.map((background) => (
          <Option key={background.choice} value={background.choice} title={background.label} summary="Ein Bild über das ganze Spielfeld." preview={background.wide} />
        ))}
        <Option
          value="custom"
          title="Eigenes Bild"
          summary={tableBackgroundImage === null ? "Wähle zuerst unten ein Bild von deinem Gerät." : "Dein Bild über das ganze Spielfeld."}
          preview={tableBackgroundImage}
          disabled={tableBackgroundImage === null}
        />
      </RadioGroup>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => picker.current?.click()} disabled={status === "loading" || busy}>
          <ImageUp aria-hidden />
          Eigenes Bild auswählen
        </Button>
        {tableBackgroundImage === null ? null : (
          <Button variant="outline" onClick={() => void remove()} disabled={status === "loading" || busy}>
            <Trash2 aria-hidden />
            Eigenes Bild entfernen
          </Button>
        )}
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          aria-label="Eigenes Bild für den Spieltisch"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            if (file !== undefined) void choose(file)
          }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Das Bild füllt das ganze Spielfeld und wird dafür am Rand beschnitten. Es bleibt nur auf diesem Gerät (auch in der Datensicherung), nicht in der ORYX-Cloud.
      </p>
    </div>
  )
}
