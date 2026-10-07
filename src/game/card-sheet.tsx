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
 * is resolved from its source question ID in the latest questions while
 * that question is open; it is answered in the decision region, never tapped here.
 * A card on the stack (prompt 16: a spell's own card, or the source of an
 * ability there) shows what it is there, whose, how far from the top, and
 * Forge's description with its targets; a card on the stack is only looked
 * at - it is not tapped, it is resolved.
 * Forge's texts (name, type line, rules text, the tap's words) are shown as
 * Forge sends them; the picture comes from the card catalog, never covered.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import type { GameState, VisibleCard } from "@openmana/engine-protocol"
import { FactList, type Fact } from "@/components/fact-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardPicture } from "@/components/ui/card-picture"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useLandscape } from "@/hooks/use-landscape"
import { browseIds, questionCard, type CardBrowse } from "./card-view-model"
import { SICK_LABEL, SICK_NOTE } from "./attack-labels"
import { cardUse, type CardUse, type TableMoment } from "./card-use"
import { STACK_KIND_LABELS } from "./priority-labels"
import type { TableCardLookup, TableCardPicture, TableFace, TablePictureData } from "./table-cards"
import { captionFacts, cardName, placeLabel, spokenFacts, stackOwner, stackTargets } from "./table-labels"
import { locateCard, pileOf, stackEntriesOf, visibleCards, type StackEntryView, type TableView } from "./table-model"

/** How long after the view opened (or its button changed) presses on the button - or outside the view - are ignored. */
export const ARMING_MS = 500

/** The card being looked at: its id, whether the view is open, and which opening this is. */
export interface CardLook {
  readonly id: number
  readonly open: boolean
  readonly serial: number
  /** Only the ID of the open question, never its former card object. */
  readonly question?: number
  readonly browse?: CardBrowse
}

export interface CardSheetProps {
  readonly look: CardLook | null
  readonly onOpenChange: (open: boolean) => void
  readonly onBrowse: (id: number) => void
  readonly state: GameState
  readonly view: TableView
  readonly moment: TableMoment
  readonly pictures: TableCardLookup
  /** Taps a card (Forge's card.tap); absent: the table is only looked at - the view names Forge's offer, without a button. */
  readonly onTap?: (id: number) => void
}

export function CardSheet({ look, onOpenChange, onBrowse, state, view, moment, pictures, onTap }: CardSheetProps) {
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
          const back = from?.isConnected && (from.closest('[data-slot="sheet-content"]') !== null || (id !== null && (from.dataset["card"] === String(id) || from.dataset["questionCard"] === String(id)))) ? from : null
          opener.current = null
          const card = id === null ? null : document.querySelector<HTMLElement>(`button[data-card="${id}"]`)
          ;(back ?? card ?? document.querySelector<HTMLElement>('[data-area="decision"]'))?.focus()
        }}
      >
        {look !== null ? (
          <><BrowseCards id={look.id} ids={browseIds(state, look.browse)} onBrowse={onBrowse} /><CardView key={`${look.serial}:${look.id}:${locateCard(state, look.id)?.card.key ?? ""}`} id={look.id} question={look.question} state={state} view={view} moment={moment} pictures={pictures} onTap={onTap} onClose={() => onOpenChange(false)} /></>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function CardView({
  id,
  question,
  state,
  view,
  moment,
  pictures,
  onTap,
  onClose,
}: {
  id: number
  question: number | undefined
  state: GameState
  view: TableView
  moment: TableMoment
  pictures: TableCardLookup
  onTap: ((id: number) => void) | undefined
  onClose: () => void
}) {
  const located = locateCard(state, id)
  const asked = question === undefined ? null : questionCard(moment.questions, id, question)
  if (located === null && asked !== null) return <QuestionCardView card={asked.card} state={state} pictures={pictures} />
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
      <CardPresentation card={card} pictures={pictures}>
        <FactList facts={facts(card, state, pile, pictures)} />
        {onStack.length > 0 ? <StackFacts entries={onStack} view={view} /> : null}
        {zone === "stack" && use.tap === null ? null : <ForgeOffer card={card} use={use} live={onTap !== undefined} />}
      </CardPresentation>
      {/* The buttons stay in view while the card scrolls above them (a phone turned sideways; Bible §6: the action stays easy to reach). */}
      <SheetFooter className="sticky bottom-0 bg-popover landscape:flex-row landscape:flex-wrap">
        {onTap !== undefined && use.tap !== null ? <TapButton identity={id} use={use} onTap={() => onTap(id)} onClose={onClose} /> : null}
        <CloseButton />
      </SheetFooter>
    </>
  )
}

/** Navigation is inspection only. The list is resolved from the current snapshot. */
function BrowseCards({ id, ids, onBrowse }: { id: number; ids: readonly number[]; onBrowse: (id: number) => void }) {
  const index = ids.indexOf(id)
  if (ids.length < 2 && index >= 0) return null
  if (ids.length === 0) return null
  return <div role="group" aria-label="Karten durchsehen" className="flex items-center gap-2 px-6 pt-4">
    <Button variant="outline" size="default" disabled={index <= 0} onClick={() => { const next = ids[index - 1]; if (next !== undefined) onBrowse(next) }}>Vorige Karte</Button>
    <span className="text-sm tabular-nums" aria-live="polite">{index + 1} / {ids.length}</span>
    <Button variant="outline" size="default" disabled={index >= ids.length - 1} onClick={() => { const next = ids[index + 1]; if (next !== undefined) onBrowse(next) }}>Nächste Karte</Button>
  </div>
}

function CatalogFace({ face }: { face: TableFace }) {
  return <section aria-label="Katalogangaben – nur ansehen" className="flex flex-col gap-1 text-sm">
    <p className="font-medium">Katalogangaben – nur ansehen</p>
    <p lang={face.name.lang}>{face.name.text}</p>
    {face.typeLine !== null ? <p lang={face.typeLine.lang}>{face.typeLine.text}</p> : null}
    {face.text !== null ? <p lang={face.text.lang} className="whitespace-pre-line">{face.text.text}</p> : null}
    <p className="text-muted-foreground">Katalogtext: {face.text?.lang === "de" ? "deutsch" : face.textFallback ? "englisch (kein deutscher Text verfügbar)" : "englisch"}. Regeln und Aktionen bestimmt Forge.</p>
  </section>
}

/** A card of Forge's question that lies in no zone the table shows: as the question shows it, answered in the decision region. */
function QuestionCardView({ card, state, pictures }: { card: VisibleCard; state: GameState; pictures: TableCardLookup }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{cardName(card)}</SheetTitle>
        <SheetDescription>Aus Forges Frage – diese Karte liegt nicht sichtbar auf dem Tisch.</SheetDescription>
      </SheetHeader>
      <CardPresentation card={card} pictures={pictures}>
        <FactList facts={facts(card, state, null, pictures)} />
        <p className="text-sm text-muted-foreground">Wählen kannst du sie im Entscheidungsbereich, dort, wo Forge fragt.</p>
      </CardPresentation>
      <SheetFooter className="sticky bottom-0 bg-popover landscape:flex-row landscape:flex-wrap">
        <CloseButton />
      </SheetFooter>
    </>
  )
}

/** The same complete presentation for zone cards and cards only exposed by an open question. */
function CardPresentation({ card, pictures, children }: { card: VisibleCard; pictures: TableCardLookup; children: ReactNode }) {
  const [inspection, setInspection] = useState<{ key: string | null; index: number } | null>(null)
  const picture = pictures(card)
  const faces = picture === "loading" || picture === "none" ? [] : picture.faces ?? []
  const activeFace = picture === "loading" || picture === "none" ? 0 : picture.face ?? 0
  const index = inspection !== null && inspection.key === (card.key ?? null) ? inspection.index : activeFace
  const chosen = faces.find((f) => f.index === index) ?? null
  const alternate = chosen !== null && chosen.index !== activeFace
  return (
    <div className="flex flex-row gap-4 px-6 landscape:flex-col">
      <div className="w-32 shrink-0 sm:w-44 landscape:self-center">
        <LargePicture card={card} picture={chosen === null ? picture : chosen.picture} name={chosen?.name.text} fallbackFace={chosen} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {faces.length > 1 ? (
          <div role="group" aria-label="Kartenseiten" className="flex flex-wrap gap-2">
            {faces.map((f) => (
              <Button key={f.index} variant={f.index === index ? "default" : "outline"} aria-pressed={f.index === index} onClick={() => setInspection({ key: card.key ?? null, index: f.index })}>
                {f.name.text}
              </Button>
            ))}
          </div>
        ) : null}
        {chosen !== null && (alternate || !card.text) ? <CatalogFace face={chosen} /> : null}
        {card.text ? <p className="text-sm whitespace-pre-line">{card.text}</p> : <p className="text-sm text-muted-foreground">Forge sendet hier keinen Regeltext.</p>}
        {alternate ? <p className="text-sm text-muted-foreground">Forges aktueller Zustand und die Aktion gehören weiter zu „{cardName(card)}“. Eine andere Kartenseite anzusehen ändert die Partie nicht.</p> : null}
        {children}
      </div>
    </div>
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
function LargePicture({ card, picture, name: shownName, fallbackFace }: { card: VisibleCard; picture: TableCardPicture | TablePictureData | null; name?: string | undefined; fallbackFace?: TableFace | null }) {
  const name = shownName ?? cardName(card)
  const cost = fallbackFace ? fallbackFace.manaCost : card.cost
  const type = fallbackFace ? fallbackFace.typeLine?.text : card.typeLine
  const text = fallbackFace ? fallbackFace.text?.text : card.text
  if (picture === "loading") {
    return (
      <Skeleton className="aspect-63/88 w-full rounded-xl">
        <span className="sr-only">Kartenbild von {name} wird gesucht</span>
      </Skeleton>
    )
  }
  return (
    <CardPicture
      src={picture === "none" || picture === null ? null : picture.large}
      {...(picture === "none" || picture === null ? {} : { srcSet: picture.largeSrcSet, sizes: "(min-width: 640px) 11rem, 8rem" })}
      alt={`Kartenbild: ${name}`}
      draggable={false}
      fallback={
        <>
          <span className="font-heading text-sm font-semibold">{name}</span>
          {cost ? <span className="text-xs text-muted-foreground tabular-nums">{cost}</span> : null}
          {type ? <span className="text-xs">{type}</span> : null}
          {text ? <span className="line-clamp-6 text-xs whitespace-pre-line text-muted-foreground">{text}</span> : null}
          <span className="mt-auto text-xs font-medium text-muted-foreground">{picture === "none" || picture === null ? "Kein Kartenbild – Forges Angaben." : "Das Bild konnte nicht geladen werden."}</span>
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
    if (live && use.primary === "tap") lines.push("In diesem Schritt wirkt ein Tipp auf die Karte sofort. Forges Worte sagen, was ein weiterer Tipp tut; Forges Knopf bestätigt den Schritt.")
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
function TapButton({ identity, use, onTap, onClose }: { identity: number; use: CardUse; onTap: () => void; onClose: () => void }) {
  const reason = useId()
  const armedAt = useRef(0)
  const label = use.tap?.label ?? ""
  useEffect(() => {
    armedAt.current = performance.now()
  }, [identity, label])
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
