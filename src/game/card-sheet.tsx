/*
 * The card view of the game table (prompt 14): one card large, with what
 * Forge says about it right now. Looking is safe (Bible §6 "Card
 * interaction", §16): opening, reading and closing it sends nothing.
 *
 * Where Forge offers a tap on the card (card-use.ts), the view's main button
 * does it - labelled with Forge's own words ("Spiele ein Land") - and only
 * there: an action Forge does not offer is never shown as possible. Against
 * taps by mistake:
 *  - the view never puts the focus on that button (it takes the focus
 *    itself), so a held Enter or Space cannot run on into it;
 *  - the button ignores presses for ARMING_MS after the view opened or the
 *    button changed its meaning, and outside presses do not close the view
 *    that early - the second tap of a double tap (the view opens under the
 *    finger) is lost instead of acting. Browsers protect their own
 *    permission prompts the same way (Chromium: InputEventActivationProtector,
 *    double-click interval);
 *  - held keys repeat nothing (a repeated keydown is dropped).
 *
 * Live, never stale (Anvil lesson): the view keeps only the card's id and
 * reads the card from every new state - its place, facts and Forge's offer
 * change while it is open, and a card Forge no longer shows says so. A card
 * of one of Forge's questions that lies in no zone the table shows (the top
 * of the library while scrying, a card to choose from a pile - prompt 15)
 * is shown as the question shows it (`snapshot`), as long as the question
 * is open; it is answered in the decision region, never tapped here.
 * A card on the stack (prompt 16: a spell's own card, or the source of an
 * ability there) shows what it is there, whose, how far from the top, and
 * Forge's description with its targets; a card on the stack is only looked
 * at - it is not tapped, it is resolved.
 * Forge's texts (name, type line, rules text, the tap's words) are shown as
 * Forge sends them; the picture comes from the card catalog, never covered.
 */
import { useEffect, useId, useRef, type ReactNode } from "react"
import type { GameState, VisibleCard } from "@openmana/engine-protocol"
import { FactList, type Fact } from "@/components/fact-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardPicture } from "@/components/ui/card-picture"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useLandscape } from "@/hooks/use-landscape"
import { SICK_LABEL, SICK_NOTE } from "./attack-labels"
import { cardUse, type CardUse, type TableMoment } from "./card-use"
import { STACK_KIND_LABELS } from "./priority-labels"
import type { TableCardLookup } from "./table-cards"
import { captionFacts, cardName, placeLabel, spokenFacts, stackOwner, stackTargets } from "./table-labels"
import { locateCard, pileOf, stackEntriesOf, visibleCards, type StackEntryView, type TableView } from "./table-model"

/** How long after the view opened (or its button changed) presses on the button - or outside the view - are ignored. */
export const ARMING_MS = 500

/** The card being looked at: its id, whether the view is open, and which opening this is. */
export interface CardLook {
  readonly id: number
  readonly open: boolean
  readonly serial: number
  /** The card as a question of Forge shows it, for a card in no zone of the state (prompt 15). */
  readonly snapshot?: VisibleCard
}

export interface CardSheetProps {
  readonly look: CardLook | null
  readonly onOpenChange: (open: boolean) => void
  readonly state: GameState
  readonly view: TableView
  readonly moment: TableMoment
  readonly pictures: TableCardLookup
  /** Taps a card (Forge's card.tap); absent: the table is only looked at - the view names Forge's offer, without a button. */
  readonly onTap?: (id: number) => void
}

export function CardSheet({ look, onOpenChange, state, view, moment, pictures, onTap }: CardSheetProps) {
  const landscape = useLandscape()
  const content = useRef<HTMLDivElement>(null)
  const openedAt = useRef(0)
  // What had the focus when the view opened: the card on the table, or the same card in Forge's question (the decision region).
  const opener = useRef<HTMLElement | null>(null)
  const id = look?.id ?? null
  return (
    <Sheet open={look?.open ?? false} onOpenChange={onOpenChange}>
      <SheetContent
        ref={content}
        side={landscape ? "right" : "bottom"}
        showCloseButton={false}
        className="max-h-dvh overflow-y-auto"
        onOpenAutoFocus={(event) => {
          // The view takes the focus itself (its title is read), never its tap button.
          event.preventDefault()
          openedAt.current = performance.now()
          opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
          content.current?.focus()
        }}
        onPointerDownOutside={(event) => {
          // The second tap of a double tap does not close the view it just opened.
          if (performance.now() - openedAt.current < ARMING_MS) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          // Back to what opened it; else to the card - also where it moved (hand → battlefield); gone: to Forge's decision.
          event.preventDefault()
          const from = opener.current
          const back = from?.isConnected && id !== null && (from.dataset["card"] === String(id) || from.dataset["questionCard"] === String(id)) ? from : null
          opener.current = null
          const card = id === null ? null : document.querySelector<HTMLElement>(`button[data-card="${id}"]`)
          ;(back ?? card ?? document.querySelector<HTMLElement>('[data-area="decision"]'))?.focus()
        }}
      >
        {look !== null ? (
          <CardView key={look.serial} id={look.id} snapshot={look.snapshot} state={state} view={view} moment={moment} pictures={pictures} onTap={onTap} onClose={() => onOpenChange(false)} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function CardView({
  id,
  snapshot,
  state,
  view,
  moment,
  pictures,
  onTap,
  onClose,
}: {
  id: number
  snapshot: VisibleCard | undefined
  state: GameState
  view: TableView
  moment: TableMoment
  pictures: TableCardLookup
  onTap: ((id: number) => void) | undefined
  onClose: () => void
}) {
  const located = locateCard(state, id)
  if (located === null && snapshot !== undefined && questionShows(moment, id)) return <QuestionCardView card={snapshot} state={state} pictures={pictures} />
  if (located === null) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Karte nicht mehr zu sehen</SheetTitle>
          <SheetDescription>Forge zeigt diese Karte gerade nirgends – sie hat den Tisch verlassen oder liegt verdeckt.</SheetDescription>
        </SheetHeader>
        <SheetFooter className="sticky bottom-0 bg-popover">
          <CloseButton />
        </SheetFooter>
      </>
    )
  }
  const { card, zone, seat } = located
  const use = cardUse(card, { zone, mine: seat === "me" }, moment)
  const pile = zone === "battlefield" ? pileOf(view, id) : null
  const onStack = stackEntriesOf(view, id)
  return (
    <>
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle>{cardName(card)}</SheetTitle>
          {use.markLabel ? <Badge variant={use.mark === "selected" ? "secondary" : "default"}>{use.markLabel}</Badge> : null}
        </div>
        <SheetDescription>{placeLabel(zone, seat)}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-row gap-4 px-6 landscape:flex-col">
        <div className="w-32 shrink-0 sm:w-44 landscape:self-center">
          <LargePicture card={card} pictures={pictures} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {card.text ? <p className="text-sm whitespace-pre-line">{card.text}</p> : null}
          <FactList facts={facts(card, state, pile, pictures)} />
          {onStack.length > 0 ? <StackFacts entries={onStack} view={view} /> : null}
          {zone === "stack" && use.tap === null ? null : <ForgeOffer card={card} use={use} live={onTap !== undefined} />}
        </div>
      </div>
      {/* The buttons stay in view while the card scrolls above them (a phone turned sideways; Bible §6: the action stays easy to reach). */}
      <SheetFooter className="sticky bottom-0 bg-popover landscape:flex-row landscape:flex-wrap">
        {onTap !== undefined && use.tap !== null ? <TapButton use={use} onTap={() => onTap(pile?.[0] ?? id)} onClose={onClose} /> : null}
        <CloseButton />
      </SheetFooter>
    </>
  )
}

/** Whether an open question still shows this card (its asking card or one of its items). */
function questionShows(moment: TableMoment, id: number): boolean {
  return moment.questions.some(
    (question) =>
      ("card" in question && question.card === id) ||
      ("items" in question && question.items !== undefined && question.items.some((item) => "card" in item && item.card === id)) ||
      (question.kind === "options" && (question.revealed ?? []).some((item) => "card" in item && item.card === id)),
  )
}

/** A card of Forge's question that lies in no zone the table shows: as the question shows it, answered in the decision region. */
function QuestionCardView({ card, state, pictures }: { card: VisibleCard; state: GameState; pictures: TableCardLookup }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{cardName(card)}</SheetTitle>
        <SheetDescription>Aus Forges Frage – diese Karte liegt nicht sichtbar auf dem Tisch.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-row gap-4 px-6 landscape:flex-col">
        <div className="w-32 shrink-0 sm:w-44 landscape:self-center">
          <LargePicture card={card} pictures={pictures} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {card.text ? <p className="text-sm whitespace-pre-line">{card.text}</p> : null}
          <FactList facts={facts(card, state, null, pictures)} />
          <p className="text-sm text-muted-foreground">Wählen kannst du sie im Entscheidungsbereich, dort, wo Forge fragt.</p>
        </div>
      </div>
      <SheetFooter className="sticky bottom-0 bg-popover landscape:flex-row landscape:flex-wrap">
        <CloseButton />
      </SheetFooter>
    </>
  )
}

function CloseButton() {
  return (
    <SheetClose asChild>
      <Button size="lg" variant="outline" className="landscape:flex-1">
        Schließen
      </Button>
    </SheetClose>
  )
}

/** The card's picture, large: the catalog's in the player's card language, a placeholder while it is looked up, Forge's words without one. */
function LargePicture({ card, pictures }: { card: VisibleCard; pictures: TableCardLookup }) {
  const picture = pictures(card)
  const name = cardName(card)
  if (picture === "loading") {
    return (
      <Skeleton className="aspect-63/88 w-full rounded-xl">
        <span className="sr-only">Kartenbild von {name} wird gesucht</span>
      </Skeleton>
    )
  }
  return (
    <CardPicture
      src={picture === "none" ? null : picture.large}
      {...(picture === "none" ? {} : { srcSet: picture.largeSrcSet, sizes: "(min-width: 640px) 11rem, 8rem" })}
      alt={`Kartenbild: ${name}`}
      draggable={false}
      fallback={
        <>
          <span className="font-heading text-sm font-semibold">{name}</span>
          {card.cost ? <span className="text-xs text-muted-foreground tabular-nums">{card.cost}</span> : null}
          {card.typeLine ? <span className="text-xs">{card.typeLine}</span> : null}
          {card.text ? <span className="line-clamp-6 text-xs whitespace-pre-line text-muted-foreground">{card.text}</span> : null}
          <span className="mt-auto text-xs font-medium text-muted-foreground">{picture === "none" ? "Kein Kartenbild – Forges Angaben." : "Das Bild konnte nicht geladen werden."}</span>
        </>
      }
    />
  )
}

/** Forge's facts about the card now, in German (nothing computed). */
function facts(card: VisibleCard, state: GameState, pile: readonly number[] | null, pictures: TableCardLookup): Fact[] {
  const cards = visibleCards(state)
  const list: Fact[] = []
  if (card.typeLine) list.push({ label: "Typ", value: card.typeLine })
  if (card.cost) list.push({ label: "Manakosten", value: card.cost })
  const shown = [...spokenFacts(card).filter((fact) => fact !== SICK_LABEL), ...captionFacts(card)]
  if (shown.length > 0) list.push({ label: "Zustand", value: shown.join(", ") })
  // Forge's summoning sickness (prompt 18): what it means, once.
  if (card.sick) list.push({ label: SICK_LABEL, value: SICK_NOTE })
  if (pile !== null && pile.length > 1) list.push({ label: "Gleiche Karten", value: `${pile.length} liegen hier als Stapel` })
  if (card.attachedTo !== undefined) list.push({ label: "Hängt an", value: cardName(cards.get(card.attachedTo)) })
  if (card.attached !== undefined) list.push({ label: "Daran hängt", value: card.attached.map((attached) => cardName(cards.get(attached))).join(", ") })
  if (card.owner !== null && card.controller !== null && card.owner !== card.controller) {
    const owner = state.players.find((player) => player.id === card.owner)
    list.push({ label: "Besitz", value: owner?.me ? "gehört dir" : "gehört der Forge-KI" })
  }
  const picture = pictures(card)
  if (picture !== "loading" && picture !== "none") list.push({ label: "Kartenbild", value: picture.lang === "de" ? "deutsch" : picture.lang === "en" ? "englisch" : picture.lang })
  return list
}

/**
 * The card on the stack (prompt 16): a spell there, or abilities of it -
 * what each is, whose, how far from the top (the top resolves next), and
 * Forge's own description with its targets.
 */
function StackFacts({ entries, view }: { entries: readonly StackEntryView[]; view: TableView }) {
  return (
    <section aria-label="Auf dem Stapel" className="flex flex-col gap-2 text-sm">
      {entries.map((entry) => {
        const above = view.stack.indexOf(entry)
        const owner = stackOwner(entry.controller)
        const targets = stackTargets(entry)
        return (
          <div key={entry.id} className="flex flex-col gap-0.5">
            <p className="font-medium">
              Auf dem Stapel: {STACK_KIND_LABELS[entry.kind]}
              {owner !== null ? ` ${owner}` : null}
              {above === 0 ? " – wird als Nächstes verrechnet." : above === 1 ? " – 1 Eintrag liegt darüber." : ` – ${above} Einträge liegen darüber.`}
            </p>
            {entry.text !== null && entry.text.trim() !== "" ? <p className="text-muted-foreground">{entry.text}</p> : null}
            {targets !== null ? <p className="text-muted-foreground">{targets}</p> : null}
          </div>
        )
      })}
    </section>
  )
}

/** What Forge offers for the card now, in words. */
function ForgeOffer({ card, use, live }: { card: VisibleCard; use: CardUse; live: boolean }) {
  const lines: ReactNode[] = []
  if (use.tap !== null) {
    lines.push(live ? `Forge bietet an: ${use.tap.label}.` : `Forge bot an: ${use.tap.label}.`)
    if (live && use.primary === "tap") lines.push("In diesem Schritt wirkt ein Tipp auf die Karte sofort; ein zweiter nimmt ihn zurück, Forges Knopf bestätigt.")
  } else if (use.unavailable !== null) {
    // Forge's reason why it would not declare the creature an attacker now (prompt 18).
    lines.push(`Kann gerade nicht angreifen: ${use.unavailable.short}.`, use.unavailable.why)
  } else if (card.controller !== null) {
    lines.push("Mit dieser Karte bietet Forge gerade nichts an.")
  }
  const ways = card.ways ?? []
  return (
    <section aria-label="Was Forge anbietet" className="flex flex-col gap-1 text-sm">
      {lines.map((line, index) => (
        <p key={index} className={index === 0 ? "font-medium" : "text-muted-foreground"}>
          {line}
        </p>
      ))}
      {ways.length > 1 ? (
        <>
          <p className="text-muted-foreground">Forge kennt {ways.length} Wege, die Karte zu nutzen; welchen, fragt Forge nach dem Antippen:</p>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {ways.map((way, index) => (
              <li key={index}>{way}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

/** The view's main button: Forge's tap, armed a moment after it appears (see above). */
function TapButton({ use, onTap, onClose }: { use: CardUse; onTap: () => void; onClose: () => void }) {
  const reason = useId()
  const armedAt = useRef(0)
  const label = use.tap?.label ?? ""
  useEffect(() => {
    armedAt.current = performance.now()
  }, [label])
  if (use.tap === null) return null
  return (
    <>
      <Button
        size="lg"
        variant={use.tap.marked ? "default" : "outline"}
        className="landscape:flex-1"
        disabled={use.blocked !== null}
        {...(use.blocked !== null ? { "aria-describedby": reason } : {})}
        onKeyDown={(event) => {
          if (event.repeat) event.preventDefault()
        }}
        onClick={() => {
          if (performance.now() - armedAt.current < ARMING_MS) return
          onClose()
          onTap()
        }}
      >
        {use.tap.label}
      </Button>
      {use.blocked !== null ? (
        <p id={reason} className="text-sm text-muted-foreground landscape:order-last landscape:basis-full">
          {use.blocked}
        </p>
      ) : null}
    </>
  )
}
