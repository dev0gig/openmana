/*
 * Choosing a deck for a game: the player's own, or the AI's - for the AI
 * also "Zufällig" (a new draw from the fitting decks for every game,
 * deck-selection.ts). Decks that cannot be chosen (another format than the
 * player's deck) stay visible, disabled, and say why; so does "Zufällig"
 * when no deck could be drawn. With many decks a search narrows the list.
 */
import { Check, Dices, Layers } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { cardDisplay } from "@/cards/card-display"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardPicture } from "@/components/ui/card-picture"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import type { DeckRecord } from "@/storage/generated/records"
import { DECK_FORMAT_LABELS } from "@/storage/storage-labels"
import type { DeckView } from "./deck-view"
import { arrangeDecks, DEFAULT_QUERY } from "./library"
import { describeDeck } from "./library-labels"

/** With more decks than this, a search field narrows the list. */
const SEARCH_FROM = 6

export type PickedDeck = { readonly kind: "deck"; readonly deckId: string } | { readonly kind: "random" }

export interface RandomOption {
  readonly selected: boolean
  /** What a draw can give, in words ("eines von 3 Constructed-Decks …"). */
  readonly description: string
  /** Why no deck could be drawn (null: it can). */
  readonly unavailable: string | null
}

function DeckOption({ view, selected, disabled, onSelect }: { view: DeckView; selected: boolean; disabled: string | null; onSelect: () => void }) {
  const id = useId()
  const cover = view.cover
  const url = cover?.card ? (cardDisplay(cover.card, cover.match ? { match: cover.match } : {}).picture?.urls.thumb ?? null) : null
  return (
    <Item asChild variant="outline" size="sm">
      <button
        type="button"
        className="text-left"
        disabled={disabled !== null}
        aria-current={selected || undefined}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClick={onSelect}
      >
        {url !== null ? (
          <ItemMedia>
            <div className="w-10">
              <CardPicture src={url} alt="" fallback={null} />
            </div>
          </ItemMedia>
        ) : (
          <ItemMedia variant="icon">
            <Layers aria-hidden />
          </ItemMedia>
        )}
        <ItemContent>
          <ItemTitle id={`${id}-title`}>
            {view.deck.name}
            {selected ? (
              <Badge variant="secondary">
                <Check data-icon="inline-start" aria-hidden />
                gewählt
              </Badge>
            ) : null}
          </ItemTitle>
          <ItemDescription id={`${id}-description`}>
            {describeDeck(view, DECK_FORMAT_LABELS)}
            {disabled !== null ? ` – ${disabled}` : ""}
          </ItemDescription>
        </ItemContent>
      </button>
    </Item>
  )
}

export function DeckPickerDialog({
  title,
  description,
  trigger,
  triggerLabel,
  decks,
  selectedId,
  disabledReason = () => null,
  random,
  onPick,
}: {
  title: string
  description: string
  /** The button's text ("Wählen", "Ändern"). */
  trigger: string
  /** Its accessible name ("Dein Deck wählen"). */
  triggerLabel: string
  decks: readonly DeckView[]
  selectedId: string | null
  disabledReason?: (deck: DeckRecord) => string | null
  /** Only for the AI's deck. */
  random?: RandomOption
  onPick: (picked: PickedDeck) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const searchId = useId()
  const randomId = useId()
  const shown = useMemo(() => arrangeDecks(decks, { ...DEFAULT_QUERY, text }), [decks, text])
  const pick = (picked: PickedDeck) => {
    onPick(picked)
    setOpen(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setText("")
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" aria-label={triggerLabel}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {decks.length > SEARCH_FROM ? (
          <Field>
            <FieldLabel htmlFor={searchId}>Suchen</FieldLabel>
            <Input id={searchId} type="search" autoComplete="off" spellCheck={false} placeholder="Deck- oder Kartenname" value={text} onChange={(event) => setText(event.currentTarget.value)} />
          </Field>
        ) : null}
        <ItemGroup role="group" aria-label="Decks zur Auswahl" className="gap-2">
          {random !== undefined ? (
            <Item asChild variant="outline" size="sm">
              <button
                type="button"
                className="text-left"
                disabled={random.unavailable !== null && !random.selected}
                aria-current={random.selected || undefined}
                aria-labelledby={`${randomId}-title`}
                aria-describedby={`${randomId}-description`}
                onClick={() => pick({ kind: "random" })}
              >
                <ItemMedia variant="icon">
                  <Dices aria-hidden />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle id={`${randomId}-title`}>
                    Zufällig
                    {random.selected ? (
                      <Badge variant="secondary">
                        <Check data-icon="inline-start" aria-hidden />
                        gewählt
                      </Badge>
                    ) : null}
                  </ItemTitle>
                  <ItemDescription id={`${randomId}-description`}>{random.unavailable ?? random.description}</ItemDescription>
                </ItemContent>
              </button>
            </Item>
          ) : null}
          {shown.map((view) => (
            <DeckOption
              key={view.deck.id}
              view={view}
              selected={view.deck.id === selectedId}
              disabled={disabledReason(view.deck)}
              onSelect={() => pick({ kind: "deck", deckId: view.deck.id })}
            />
          ))}
          {shown.length === 0 && text.trim() !== "" ? <p className="text-sm text-muted-foreground">Kein Deck passt zu „{text.trim()}“.</p> : null}
        </ItemGroup>
      </DialogContent>
    </Dialog>
  )
}
