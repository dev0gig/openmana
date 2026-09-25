/*
 * "Welche Karte ist gemeint?": the player picks among the cards a line's
 * name fits (old German translations of two cards, a playtest card beside
 * the real one, a name that is also another card's German name). Each
 * candidate shows its picture, German and English name, type line and the
 * Forge card it would be, so cards of the same name can be told apart.
 */
import { Check } from "lucide-react"
import { useId, useState } from "react"
import { cardDisplay } from "@/cards/card-display"
import type { CardMatch } from "@/cards/card-lookup"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardPicture } from "@/components/ui/card-picture"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { lineLabel } from "./deck-import-labels"
import type { EntryReport } from "./deck-resolve"

function Candidate({ match, current, onSelect }: { match: CardMatch; current: boolean; onSelect: () => void }) {
  const id = useId()
  const display = cardDisplay(match.card, { match })
  const face = display.faces[display.face]!
  const set = match.card.prints.de?.set ?? match.card.prints.fallback?.set
  const forge = match.card.forgeNames[0]
  return (
    <Item asChild variant="outline" size="sm">
      <button type="button" onClick={onSelect} className="text-left" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-current={current || undefined}>
        <ItemMedia>
          <div className="w-14">
            <CardPicture src={display.picture?.urls.thumb ?? null} alt="" fallback={null} />
          </div>
        </ItemMedia>
        <ItemContent>
          <ItemTitle id={`${id}-title`}>
            {display.name.text}
            {current ? (
              <Badge variant="secondary">
                <Check data-icon="inline-start" aria-hidden />
                gewählt
              </Badge>
            ) : null}
          </ItemTitle>
          <ItemDescription id={`${id}-description`}>
            {[display.name.lang === "de" ? match.card.name : null, face.typeLine?.text, face.manaCost].filter(Boolean).join(" · ")}
            <br />
            {[forge ? `Forge: ${forge}` : "Forge kennt sie nicht", set ? `Set ${set.toUpperCase()}` : null].filter(Boolean).join(" · ")}
          </ItemDescription>
        </ItemContent>
      </button>
    </Item>
  )
}

export function CardChoiceDialog({ entry, onChoose }: { entry: EntryReport; onChoose: (oracleId: string) => void }) {
  const [open, setOpen] = useState(false)
  const label = entry.status === "ambiguous" ? "Karte wählen" : "Andere Karte wählen"
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={entry.status === "ambiguous" ? "default" : "outline"} size="sm" aria-label={`${label}: ${lineLabel(entry.entry.line)}`}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Welche Karte ist gemeint?</DialogTitle>
          <DialogDescription>
            {lineLabel(entry.entry.line)}: „{entry.entry.text}“ – der Name passt zu {entry.candidates.length} Karten.
          </DialogDescription>
        </DialogHeader>
        <ItemGroup role="group" aria-label="Karten zur Auswahl" className="gap-2">
          {entry.candidates.map((match) => (
            <Candidate
              key={match.card.oracleId}
              match={match}
              current={entry.card?.oracleId === match.card.oracleId}
              onSelect={() => {
                onChoose(match.card.oracleId)
                setOpen(false)
              }}
            />
          ))}
        </ItemGroup>
      </DialogContent>
    </Dialog>
  )
}
