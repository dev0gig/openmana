/*
 * One card as OpenMana shows it outside a game: picture, name, type line and
 * rules text - German where Scryfall has it, English where not, and saying
 * so. Double-faced cards can be turned. The picture's printing, its artist
 * and the source (Scryfall) are named; German printed text is marked as the
 * text of its printing (no errata: in a game, Forge's live text counts).
 */
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import { usePreferences } from "@/app/preferences"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardPicture } from "@/components/ui/card-picture"
import type { CardRecord, PrintRecord } from "@/storage/generated/records"
import { cardDisplay, type CardDisplay, type DisplayFace } from "./card-display"
import { formatDate, languageNote } from "./card-labels"
import type { CardMatch } from "./card-lookup"

/** What stands in for the picture: the card's own text (and why there is no picture). */
export function CardTextFallback({ display, reason }: { display: CardDisplay; reason: string }) {
  const face = display.faces[display.face]!
  return (
    <>
      <p className="font-heading text-sm font-semibold">{face.name.text}</p>
      {face.typeLine ? <p className="text-xs">{face.typeLine.text}</p> : null}
      {face.text ? <p className="line-clamp-6 text-xs whitespace-pre-line text-muted-foreground">{face.text.text}</p> : null}
      <p className="mt-auto text-xs font-medium text-muted-foreground">{reason}</p>
    </>
  )
}

function FaceText({ face, showName }: { face: DisplayFace; showName: boolean }) {
  const stats = face.power !== null && face.toughness !== null ? `${face.power}/${face.toughness}` : (face.loyalty ?? face.defense)
  return (
    <div className="flex flex-col gap-1">
      {showName ? (
        <p className="font-medium">
          {face.name.text}
          {face.name.lang === "de" ? <span className="ml-2 text-sm font-normal text-muted-foreground">{face.englishName}</span> : null}
        </p>
      ) : null}
      <p className="text-sm">
        {face.typeLine?.text ?? ""}
        {face.manaCost ? <span className="ml-2 text-muted-foreground tabular-nums">{face.manaCost}</span> : null}
      </p>
      {face.text ? <p className="text-sm whitespace-pre-line text-muted-foreground">{face.text.text}</p> : null}
      {stats ? <p className="text-sm font-medium tabular-nums">{stats}</p> : null}
    </div>
  )
}

export function CardDetails({ card, match, print }: { card: CardRecord; match?: CardMatch; print?: PrintRecord | null }) {
  const [face, setFace] = useState<number | null>(null)
  const { cardLanguage } = usePreferences()
  const display = cardDisplay(card, { ...(face !== null ? { face } : {}), ...(match ? { match } : {}), ...(print ? { print } : {}), language: cardLanguage })
  const note = languageNote(display)
  const turnable = card.faces.length === 2 && (card.prints.de?.imageSides === 2 || card.prints.fallback?.imageSides === 2)
  const picture = display.picture
  const shownFaces = card.faces.length > 1 && face === null && match?.face == null ? display.faces : [display.faces[display.face]!]
  const printedGerman = card.de !== null && display.language.text !== "en"
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex w-full max-w-xs flex-col gap-2 sm:w-56 sm:shrink-0">
        <CardPicture
          src={picture?.urls.display ?? null}
          alt={`Kartenbild: ${display.name.text}`}
          fallback={<CardTextFallback display={display} reason={picture ? "Das Bild konnte nicht geladen werden." : "Kein Kartenbild verfügbar."} />}
        />
        {picture?.artist ? <p className="text-xs text-muted-foreground">Illustration: {picture.artist}</p> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-semibold">{display.name.text}</p>
          {display.name.lang === "de" ? <p className="text-sm text-muted-foreground">{shownFaces.length > 1 ? display.englishName : display.faces[display.face]!.englishName}</p> : null}
          <div className="flex flex-wrap gap-2">
            {note ? <Badge variant="outline">{note}</Badge> : <Badge variant="secondary">Deutsch</Badge>}
            {picture?.lowQuality ? <Badge variant="outline">Bild in geringer Auflösung</Badge> : null}
          </div>
        </div>
        {shownFaces.map((shown) => (
          <FaceText key={shown.index} face={shown} showName={shownFaces.length > 1} />
        ))}
        {turnable ? (
          <div>
            <Button variant="outline" onClick={() => setFace(display.face === 0 ? 1 : 0)}>
              <RefreshCw data-icon="inline-start" aria-hidden />
              {display.face === 1 ? "Vorderseite zeigen" : "Rückseite zeigen"}
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {picture ? `Bild: Druck ${picture.set.toUpperCase()} #${picture.collectorNumber} (${picture.lang === "de" ? "deutsch" : picture.lang === "en" ? "englisch" : picture.lang}). ` : ""}
          {printedGerman && card.de ? `Deutscher Text wie gedruckt (${card.de.set.toUpperCase()}, ${formatDate(card.de.releasedAt)}); spätere Regeländerungen fehlen darin. ` : ""}
          Kartendaten und -bilder: Scryfall. Die Regeln kennt allein Forge.
        </p>
      </div>
    </div>
  )
}
