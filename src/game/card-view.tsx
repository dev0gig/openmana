/*
 * The card view of the game table (prompt 14; full screen since prompt 47):
 * one card as large as the screen allows, the table darkened behind it -
 * like taking a real card into the hand to read it. Beside it (below it on a
 * narrow screen) small boxes explain the keywords Forge reports for the card
 * now, and under the boxes (stacked: right under the card) its buttons:
 * Forge's offer, turning a double-faced card, browsing. Looking is safe
 * (Bible §6 "Card interaction", §16): opening, reading and closing it sends
 * nothing.
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
 * reads the card from every new state - its place, keywords and Forge's offer
 * change while it is open, and a card Forge no longer shows says so. A card
 * of one of Forge's questions that lies in no zone the table shows (the top
 * of the library while scrying, a card to choose from a pile - prompt 15)
 * is resolved from its source question ID in the latest questions while
 * that question is open; it is answered in the decision region, never tapped here.
 * A card on the stack (prompt 16) is only looked at - it is not tapped, it is resolved.
 *
 * What the player reads is the card itself: the facts the view listed before
 * prompt 47 (place, counters, damage, stack and its targets, attachments …)
 * are chips on the table and lines of the Zauberchronik; here they stay in the
 * dialog's description for screen readers. Forge's texts (name, rules text,
 * the tap's words) are shown as Forge sends them; the picture comes from the
 * card catalog, never covered; without one, Forge's text stands in card form.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import type { GameState, VisibleCard } from "@openmana/engine-protocol"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CardLightboxActions, CardLightboxAside, CardLightboxBoxes, CardLightboxContent, CardLightboxPicture, CardLightboxStage, useCloseWatcher, type CardLightboxArrangement } from "@/components/ui/card-lightbox"
import { CardPicture } from "@/components/ui/card-picture"
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { browseIds, questionCard, type CardBrowse } from "./card-view-model"
import { SICK_LABEL, SICK_NOTE } from "./attack-labels"
import { cardUse, type CardUse, type TableMoment } from "./card-use"
import { keywordBoxes, type KeywordBox } from "./keyword-texts"
import { STACK_KIND_LABELS } from "./priority-labels"
import type { TableCardLookup, TableCardPicture, TableFace, TablePictureData } from "./table-cards"
import { captionFacts, cardName, placeLabel, spokenFacts, stackOwner, stackTargets } from "./table-labels"
import { locateCard, pileOf, stackEntriesOf, visibleCards, type StackEntryView, type TableView } from "./table-model"
import { useTableLayout } from "./table/use-table-layout"

/** How long after the view opened (or its button changed) presses on the button - or outside the view - are ignored. */
export const ARMING_MS = 500

/** The height of one row of buttons under the card (stacked): it stays on screen with the card. */
const BUTTON_ROW_PX = 56

/** The card being looked at: its id, whether the view is open, and which opening this is. */
export interface CardLook {
  readonly id: number
  readonly open: boolean
  readonly serial: number
  /** Only the ID of the open question, never its former card object. */
  readonly question?: number
  readonly browse?: CardBrowse
}

export interface CardViewProps {
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

export function CardView({ look, onOpenChange, onBrowse, state, view, moment, pictures, onTap }: CardViewProps) {
  // Arranged by the screen's room, never by device: the card on top in hoch, the card left in quadrat and breit.
  const arrangement: CardLightboxArrangement = useTableLayout() === "hoch" ? "stacked" : "beside"
  const content = useRef<HTMLDivElement>(null)
  const openedAt = useRef(0)
  // What had the focus when the view opened: the card on the table, or the same card in Forge's question (the decision region).
  const opener = useRef<HTMLElement | null>(null)
  const id = look?.id ?? null
  const open = look?.open ?? false
  // The system's back gesture closes the view (Chrome's CloseWatcher; Escape and the X stay Radix's).
  useCloseWatcher(open, () => onOpenChange(false))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CardLightboxContent
        ref={content}
        data-slot="card-view"
        {...(id !== null ? { "data-card-view": id } : {})}
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
          <CardContents
            key={`${look.serial}:${look.id}:${locateCard(state, look.id)?.card.key ?? ""}`}
            id={look.id}
            question={look.question}
            browse={browsing(look.id, browseIds(state, look.browse), onBrowse)}
            state={state}
            view={view}
            moment={moment}
            pictures={pictures}
            onTap={onTap}
            onClose={() => onOpenChange(false)}
            arrangement={arrangement}
          />
        ) : null}
      </CardLightboxContent>
    </Dialog>
  )
}

function CardContents({
  id,
  question,
  browse,
  state,
  view,
  moment,
  pictures,
  onTap,
  onClose,
  arrangement,
}: {
  id: number
  question: number | undefined
  browse: ReactNode
  state: GameState
  view: TableView
  moment: TableMoment
  pictures: TableCardLookup
  onTap: ((id: number) => void) | undefined
  onClose: () => void
  arrangement: CardLightboxArrangement
}) {
  const located = locateCard(state, id)
  const asked = question === undefined ? null : questionCard(moment.questions, id, question)
  if (located === null && asked !== null) {
    return (
      <CardSpread card={asked.card} pictures={pictures} arrangement={arrangement} browse={browse} offer={null}>
        <p>Aus Forges Frage – diese Karte liegt nicht sichtbar auf dem Tisch.</p>
        <FactsForScreenReaders facts={facts(asked.card, state, null, pictures)} />
        <p>Wählen kannst du sie im Entscheidungsbereich, dort, wo Forge fragt.</p>
      </CardSpread>
    )
  }
  if (located === null) {
    return (
      <div className="pointer-events-none! flex size-full items-center justify-center p-4">
        <Card className="pointer-events-auto w-full max-w-sm">
          <CardHeader>
            <DialogTitle>Karte nicht mehr zu sehen</DialogTitle>
            <DialogDescription>Forge zeigt diese Karte gerade nirgends – sie hat den Tisch verlassen oder liegt verdeckt.</DialogDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }
  const { card, zone, seat } = located
  const use = cardUse(card, { zone, mine: seat === "me" }, moment)
  const pile = zone === "battlefield" ? pileOf(view, id) : null
  const onStack = stackEntriesOf(view, id)
  const offer = onTap !== undefined && use.tap !== null ? <TapButton identity={id} use={use} onTap={() => onTap(id)} onClose={onClose} /> : null
  return (
    <CardSpread card={card} pictures={pictures} arrangement={arrangement} browse={browse} offer={offer}>
      <p>{placeLabel(zone, seat)}{use.markLabel ? ` · ${use.markLabel}` : ""}.</p>
      <FactsForScreenReaders facts={facts(card, state, pile, pictures)} />
      {onStack.length > 0 ? <StackFacts entries={onStack} view={view} /> : null}
      {zone === "stack" && use.tap === null ? null : <ForgeOffer card={card} use={use} live={onTap !== undefined} />}
    </CardSpread>
  )
}

/** Browsing the cards the view was opened from (a zone, a pile, the stack), or null where there is nothing to browse. */
function browsing(id: number, ids: readonly number[], onBrowse: (id: number) => void): ReactNode {
  if (ids.length === 0 || (ids.length < 2 && ids.includes(id))) return null
  return <BrowseCards id={id} ids={ids} onBrowse={onBrowse} />
}

/** Navigation is inspection only. The list is resolved from the current snapshot. */
function BrowseCards({ id, ids, onBrowse }: { id: number; ids: readonly number[]; onBrowse: (id: number) => void }) {
  const index = ids.indexOf(id)
  return <div role="group" aria-label="Karten durchsehen" className="flex items-center gap-2">
    <Button variant="outline" size="default" disabled={index <= 0} onClick={() => { const next = ids[index - 1]; if (next !== undefined) onBrowse(next) }}>Vorige Karte</Button>
    <span className="text-sm tabular-nums" aria-live="polite">{index + 1} / {ids.length}</span>
    <Button variant="outline" size="default" disabled={index >= ids.length - 1} onClick={() => { const next = ids[index + 1]; if (next !== undefined) onBrowse(next) }}>Nächste Karte</Button>
  </div>
}

/**
 * The card in full size with what belongs to it: the keyword boxes, the
 * buttons (Forge's offer, turning a double-faced card, browsing) and - for
 * screen readers only - its facts (`children`, the dialog's description).
 */
function CardSpread({ card, pictures, arrangement, browse, offer, children }: { card: VisibleCard; pictures: TableCardLookup; arrangement: CardLightboxArrangement; browse: ReactNode; offer: ReactNode; children: ReactNode }) {
  const [inspection, setInspection] = useState<{ key: string | null; index: number } | null>(null)
  const picture = pictures(card)
  const faces = picture === "loading" || picture === "none" ? [] : picture.faces ?? []
  const activeFace = picture === "loading" || picture === "none" ? 0 : picture.face ?? 0
  const index = inspection !== null && inspection.key === (card.key ?? null) ? inspection.index : activeFace
  const chosen = faces.find((f) => f.index === index) ?? null
  const alternate = chosen !== null && chosen.index !== activeFace
  const position = faces.findIndex((f) => f.index === index)
  const next = faces.length > 1 ? faces[(position + 1) % faces.length] ?? null : null
  const boxes = keywordBoxes(card.keywords)
  const turn = next !== null ? (
    <Button variant="outline" aria-label={`Umdrehen – zeigt „${next.name.text}“`} onClick={() => setInspection({ key: card.key ?? null, index: next.index })}>
      Umdrehen
    </Button>
  ) : null
  const navigation = browse !== null || turn !== null ? <CardLightboxActions role="group" aria-label="Karte ansehen">{browse}{turn}</CardLightboxActions> : null
  const action = offer !== null ? <CardLightboxActions data-slot="card-view-offer">{offer}</CardLightboxActions> : null
  const rows = (navigation !== null ? 1 : 0) + (action !== null ? 1 : 0)
  const keywords = boxes.length > 0 ? (
    <CardLightboxBoxes role="list" aria-label="Schlüsselwörter dieser Karte">
      {boxes.map((box) => <KeywordCard key={box.key} box={box} />)}
    </CardLightboxBoxes>
  ) : null
  const aside = keywords !== null || rows > 0
  return (
    <>
      <DialogTitle className="sr-only">{cardName(card)}</DialogTitle>
      <DialogDescription asChild>
        <div className="sr-only">
          {children}
          {!card.text && !alternate && chosen?.text ? <p>Katalogtext: {chosen.text.lang === "de" ? "deutsch" : chosen.textFallback ? "englisch (kein deutscher Text verfügbar)" : "englisch"}. Regeln und Aktionen bestimmt Forge.</p> : null}
          {alternate && chosen !== null ? <p>Du siehst die Kartenseite „{chosen.name.text}“ aus dem Katalog ({chosen.text?.lang === "de" ? "deutsch" : chosen.textFallback ? "englisch, kein deutscher Text verfügbar" : "englisch"}). Forges aktueller Zustand und die Aktion gehören weiter zu „{cardName(card)}“. Eine andere Kartenseite anzusehen ändert die Partie nicht.</p> : null}
        </div>
      </DialogDescription>
      <CardLightboxStage arrangement={arrangement} aside={aside} reserve={arrangement === "stacked" ? rows * BUTTON_ROW_PX : 0}>
        <CardLightboxPicture>
          <LargePicture card={card} picture={chosen === null ? picture : chosen.picture} name={chosen?.name.text} fallbackFace={chosen} />
        </CardLightboxPicture>
        {aside ? (
          <CardLightboxAside>
            {/* Stacked, the buttons stay right under the card; beside, they stand under the boxes. */}
            {arrangement === "stacked" ? <>{action}{navigation}{keywords}</> : <>{keywords}{navigation}{action}</>}
          </CardLightboxAside>
        ) : null}
      </CardLightboxStage>
    </>
  )
}

/** One keyword of the card, explained: the name in bold, below it what it does. */
function KeywordCard({ box }: { box: KeywordBox }) {
  return (
    <Card size="sm" role="listitem" data-slot="keyword-box" data-keyword={box.key} lang={box.lang} className="shrink-0">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 font-semibold">
          {box.name}
          {box.lang === "en" ? <Badge variant="outline">englisch</Badge> : null}
        </CardTitle>
        <CardDescription className="text-card-foreground">{box.text}</CardDescription>
      </CardHeader>
      {box.forgeForm !== undefined ? (
        <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Bei dieser Karte, in Forges Worten:</span>
          <span lang="en">{box.forgeForm}</span>
          <Badge variant="outline">englisch</Badge>
        </CardContent>
      ) : null}
    </Card>
  )
}

/** The card's picture in full size: the catalog's in the player's card language, a placeholder while it is looked up, Forge's words in card form without one. */
function LargePicture({ card, picture, name: shownName, fallbackFace }: { card: VisibleCard; picture: TableCardPicture | TablePictureData | null; name?: string | undefined; fallbackFace?: TableFace | null }) {
  const name = shownName ?? cardName(card)
  const cost = fallbackFace ? fallbackFace.manaCost : card.cost
  const type = fallbackFace ? fallbackFace.typeLine?.text : card.typeLine
  const text = fallbackFace ? fallbackFace.text?.text : card.text
  const lang = fallbackFace ? fallbackFace.text?.lang : undefined
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
      // The browser takes the version the card's size on screen needs (sizes="auto": the card's laid-out width).
      {...(picture === "none" || picture === null ? {} : { srcSet: picture.largeSrcSet, sizes: "auto" })}
      alt={`Kartenbild: ${name}`}
      draggable={false}
      className="border-0 bg-transparent"
      fallback={
        <>
          <span className="font-heading text-base font-semibold">{name}</span>
          {cost ? <span className="text-sm text-muted-foreground tabular-nums">{cost}</span> : null}
          {type ? <span className="text-sm">{type}</span> : null}
          {text ? <span lang={lang} className="min-h-0 flex-1 overflow-y-auto text-sm whitespace-pre-line">{text}</span> : null}
          <span className="text-xs font-medium text-muted-foreground">
            {picture === "none" || picture === null ? "Kein Kartenbild – Forges Angaben." : "Das Bild konnte nicht geladen werden."}
            {lang === "en" ? " Katalogtext englisch." : null}
          </span>
        </>
      }
    />
  )
}

interface Fact {
  readonly label: string
  readonly value: string
}

/** Facts in sentences (the dialog's description; screen readers read them when the view opens). */
function FactsForScreenReaders({ facts: list }: { facts: readonly Fact[] }) {
  return <>{list.map((fact) => <p key={fact.label}>{fact.label}: {fact.value}.</p>)}</>
}

/** Forge's facts about the card now, in German (nothing computed). */
function facts(card: VisibleCard, state: GameState, pile: readonly number[] | null, pictures: TableCardLookup): Fact[] {
  const cards = visibleCards(state)
  const list: Fact[] = []
  if (card.typeLine) list.push({ label: "Typ", value: card.typeLine })
  if (card.cost) list.push({ label: "Manakosten", value: card.cost })
  if (card.text) list.push({ label: "Regeltext", value: card.text })
  const shown = [...spokenFacts(card).filter((fact) => fact !== SICK_LABEL), ...captionFacts(card)]
  if (shown.length > 0) list.push({ label: "Zustand", value: shown.join(", ") })
  if (state.stack.some((item) => item.targets.some((target) => target.kind === "card" && target.id === card.id))) list.push({ label: "Ziel auf dem Stapel", value: "Forge nennt diese Karte als Ziel. Das bietet keine zusätzliche Aktion an" })
  // Forge's summoning sickness (prompt 18): what it means, once.
  if (card.sick) list.push({ label: SICK_LABEL, value: SICK_NOTE.replace(/\.$/, "") })
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
    <section aria-label="Auf dem Stapel">
      {entries.map((entry) => {
        const above = view.stack.indexOf(entry)
        const owner = stackOwner(entry.controller)
        const targets = stackTargets(entry)
        return (
          <div key={entry.id}>
            <p>
              Auf dem Stapel: {STACK_KIND_LABELS[entry.kind]}
              {owner !== null ? ` ${owner}` : null}
              {above === 0 ? " – wird als Nächstes verrechnet." : above === 1 ? " – 1 Eintrag liegt darüber." : ` – ${above} Einträge liegen darüber.`}
            </p>
            {entry.text !== null && entry.text.trim() !== "" ? <p>{entry.text}</p> : null}
            {targets !== null ? <p>{targets}</p> : null}
          </div>
        )
      })}
    </section>
  )
}

/** What Forge offers for the card now, in words (for screen readers; the button says it on screen). */
function ForgeOffer({ card, use, live }: { card: VisibleCard; use: CardUse; live: boolean }) {
  const lines: string[] = []
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
  if (ways.length > 1) lines.push(`Forge kennt ${ways.length} Wege, die Karte zu nutzen; welchen, fragt Forge nach dem Antippen: ${ways.join("; ")}.`)
  return (
    <section aria-label="Was Forge anbietet">
      {lines.map((line, index) => <p key={index}>{line}</p>)}
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
        <p id={reason} className="basis-full text-sm text-muted-foreground">
          {use.blocked}
        </p>
      ) : null}
    </>
  )
}
