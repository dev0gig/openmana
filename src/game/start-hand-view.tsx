/*
 * The start hand in full screen (prompt 50; the project owner, 2026-10-12:
 * before keeping or taking a mulligan, see the whole hand large, without
 * cards over each other). A shadcn Dialog over the table
 * (src/components/ui/hand-spread.tsx): every card of the player's hand whole,
 * as large as the screen allows, side by side and below each other; Forge's
 * words at the top, Forge's buttons at the bottom.
 *
 *  - The cards are read from every state: after a mulligan the new hand,
 *    after a tap during the choice for the bottom the card's mark - never a
 *    hand remembered from before.
 *  - A tap (click, Enter, a long press) on a card opens it in the card view
 *    (card-view.tsx) over this panel, with the hand to browse (swipes, arrow
 *    keys, buttons); closing that view comes back here, the focus on the card.
 *    Looking sends nothing.
 *  - Keep or mulligan: exactly Forge's two buttons, Forge's words, Forge's
 *    enabled state; armed ARMING_MS after the panel or a new question
 *    appeared and after a card view over it closed (its closing press may
 *    land on a button here), a held key repeats nothing.
 *  - The London mulligan's choice: under each card a button that marks it for
 *    the bottom or takes it back - Forge's card.tap (the same tap as on the
 *    table: Forge marks the card, `highlighted`, the solid frame) -, how many
 *    are marked, and Forge's buttons: its OK confirms - once, explicitly -, its
 *    second button is Forge's own offer as Forge names it.
 *  - Closing (X, Escape, the system's back) answers nothing: Forge's question
 *    stays in the decision region, with "Starthand ansehen" beside it.
 *    While Forge computes after an answer from here the panel stays and says
 *    so; it closes when the game begins (start-hand.ts).
 * A replay shows the panel only when asked, and answers nothing.
 */
import { useId, useRef, useState } from "react"
import type { AnswerBody, GameState, VisibleCard } from "@openmana/engine-protocol"
import { Button } from "@/components/ui/button"
import { useCloseWatcher } from "@/components/ui/card-lightbox"
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { GameCardButton, type GameCardMark } from "@/components/ui/game-card"
import { HandSpreadCard, HandSpreadContent, HandSpreadFooter, HandSpreadGrid, HandSpreadHeader, HandSpreadItem, useHandSpreadCard } from "@/components/ui/hand-spread"
import { Spinner } from "@/components/ui/spinner"
import { useCardPress } from "@/hooks/use-card-press"
import { cardUse, type TableMoment } from "./card-use"
import { answerBlocked, useArming } from "./decision-panel"
import { buttonsAnswer, buttonText } from "./decision-model"
import { playerHand, type StartQuestion } from "./start-hand"
import type { TableCardLookup } from "./table-cards"
import { cardName } from "./table-labels"
import { isVisible } from "./table-model"
import { HAND_PICTURE_SIZES, TablePicture } from "./table-picture"
import { TableCardBack } from "./table/table-art"

/** The room under a card for its button during the choice for the bottom (a touch-sized button and the gap, px). */
const TOGGLE_ROOM = 48

export interface StartHandViewProps {
  readonly open: boolean
  /** Closed by the player (X, Escape, back) - never an answer. */
  readonly onClose: () => void
  /** Forge's start question; null between two of them (Forge computes after an answer). */
  readonly question: StartQuestion | null
  readonly state: GameState
  /** Forge's prompt line (its words for the step: "Starthand behalten?", how many cards go to the bottom). */
  readonly prompt: string | null
  readonly moment: TableMoment
  readonly pictures: TableCardLookup
  /** A card view lies over the panel: the answers re-arm when it closes. */
  readonly inspecting: boolean
  /** Opens a hand card in the card view (with the hand to browse). */
  readonly onLook: (id: number) => void
  /** Sends an answer (the page does it); absent: a replay - nothing is answered. */
  readonly onAnswer?: ((question: number, body: AnswerBody) => void) | undefined
  /** Called after an answer went from here (the panel then waits for Forge). */
  readonly onAnswered: () => void
  /** Forge's card.tap for the choice for the bottom (the table's guard against a double tap); absent: nothing is tapped. */
  readonly onTapCard?: ((id: number) => void) | undefined
}

export function StartHandView({ open, onClose, question, state, prompt, moment, pictures, inspecting, onLook, onAnswer, onAnswered, onTapCard }: StartHandViewProps) {
  // Re-armed whenever the panel opens and whenever a card view over it closes.
  const [arming, setArming] = useState({ open, inspecting, serial: 0 })
  if (arming.open !== open || arming.inspecting !== inspecting) {
    setArming({ open, inspecting, serial: arming.serial + ((open && !arming.open) || (arming.inspecting && !inspecting) ? 1 : 0) })
  }
  // The system's back gesture: the newest watcher (a card view opened over the panel) closes first.
  useCloseWatcher(open, onClose)
  const content = useRef<HTMLDivElement>(null)
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <HandSpreadContent
        ref={content}
        onOpenAutoFocus={(event) => {
          // The panel takes the focus itself (its title is read), never one of Forge's buttons.
          event.preventDefault()
          content.current?.focus()
        }}
        // Nothing lies outside the full screen panel but what is over it - a card view opened from it, a toast: a press
        // there (also the touch's late click that closes such a card view) never closes the panel.
        onInteractOutside={(event) => event.preventDefault()}
        // Escape belongs to a card view over the panel - also in the moment it opens, before it listens itself.
        onEscapeKeyDown={(event) => {
          if (inspecting) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          // Back to the button that opens it again, else to Forge's decision.
          event.preventDefault()
          ;(document.querySelector<HTMLElement>("[data-start-hand-open]") ?? document.querySelector<HTMLElement>('[data-area="decision"]'))?.focus()
        }}
      >
        {open ? <StartHand question={question} state={state} prompt={prompt} moment={moment} pictures={pictures} armKey={`${question?.id ?? 0}:${arming.serial}`} onLook={onLook} onAnswer={onAnswer} onAnswered={onAnswered} onTapCard={onTapCard} /> : null}
      </HandSpreadContent>
    </Dialog>
  )
}

function StartHand({
  question,
  state,
  prompt,
  moment,
  pictures,
  armKey,
  onLook,
  onAnswer,
  onAnswered,
  onTapCard,
}: Omit<StartHandViewProps, "open" | "onClose" | "inspecting"> & { armKey: string }) {
  const hand = playerHand(state)
  const bottom = question?.purpose === "mulliganBottom"
  const chosen = bottom ? hand.filter((card): card is VisibleCard => isVisible(card) && card.highlighted === true).length : 0
  const count = hand.length === 1 ? "1 Karte" : `${hand.length} Karten`
  const words = question === null ? null : (prompt ?? (question.text.trim() ? question.text : null))
  return (
    <>
      <HandSpreadHeader>
        <DialogTitle className="font-heading text-lg font-semibold">{bottom ? "Karten unter die Bibliothek legen" : "Deine Starthand"}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            <p>
              <span className="tabular-nums">{count}</span>
              {bottom ? <> · <span data-start-hand-chosen={chosen} className="tabular-nums">{chosen === 1 ? "1 ausgewählt" : `${chosen} ausgewählt`}</span></> : null}
            </p>
            {words !== null ? <p className="font-medium text-foreground">{words}</p> : null}
          </div>
        </DialogDescription>
      </HandSpreadHeader>
      <HandSpreadGrid count={hand.length} extra={bottom ? TOGGLE_ROOM : 0} aria-label={`Deine Hand: ${count}`}>
        {hand.map((card, index) =>
          isVisible(card) ? (
            <HandSpreadItem key={card.id}>
              <StartHandCard card={card} pictures={pictures} chosen={bottom && card.highlighted === true} onLook={() => onLook(card.id)} />
              {bottom ? <BottomToggle card={card} moment={moment} armKey={armKey} onTapCard={onTapCard} /> : null}
            </HandSpreadItem>
          ) : (
            <HandSpreadItem key={`hidden:${index}`}>
              <HandSpreadCard>
                <TableCardBack>
                  <span className="sr-only">verdeckte Karte</span>
                </TableCardBack>
              </HandSpreadCard>
            </HandSpreadItem>
          ),
        )}
      </HandSpreadGrid>
      <HandSpreadFooter>
        {question === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Spinner aria-hidden />
            Forge rechnet … gleich geht es weiter.
          </p>
        ) : (
          <StartAnswers question={question} moment={moment} armKey={armKey} bottom={bottom} onAnswer={onAnswer} onAnswered={onAnswered} />
        )}
      </HandSpreadFooter>
    </>
  )
}

/** A card of the hand: a tap, Enter or a long press looks at it - never more. */
function StartHandCard({ card, pictures, chosen, onLook }: { card: VisibleCard; pictures: TableCardLookup; chosen: boolean; onLook: () => void }) {
  const press = useCardPress({ onPrimary: onLook, onLook })
  // The picture's size is the grid's (never "auto": such a picture gives up its size when it leaves the page, and the
  // whole hand leaves at once when the panel closes - Chrome would start and abort a request for each).
  const width = useHandSpreadCard()
  const mark: GameCardMark | null = chosen ? "selected" : null
  const label = `${cardName(card)}${chosen ? ", kommt unter die Bibliothek" : ""} – groß ansehen`
  return (
    <HandSpreadCard>
      <GameCardButton mark={mark} data-start-hand-card={card.id} aria-label={label} title={cardName(card)} aria-haspopup="dialog" className="size-full" {...press}>
        <TablePicture card={card} pictures={pictures} sizes={width > 0 ? `${width}px` : HAND_PICTURE_SIZES} />
      </GameCardButton>
    </HandSpreadCard>
  )
}

/** The London mulligan: marks the card for the bottom or takes it back - Forge's card.tap, as on the table. */
function BottomToggle({ card, moment, armKey, onTapCard }: { card: VisibleCard; moment: TableMoment; armKey: string; onTapCard: ((id: number) => void) | undefined }) {
  const use = cardUse(card, { zone: "hand", mine: true }, moment)
  const arming = useArming(armKey)
  const chosen = card.highlighted === true
  if (use.tap === null) return null
  const off = onTapCard === undefined || use.blocked !== null
  return (
    <Button
      variant={chosen ? "secondary" : "outline"}
      size="sm"
      className="w-full"
      data-bottom-toggle={card.id}
      aria-pressed={chosen}
      aria-label={`${cardName(card)}: ${use.tap.label}`}
      title={use.blocked ?? use.tap.label}
      disabled={off}
      onKeyDown={arming.onKeyDown}
      onClick={() => {
        if (arming.armed()) onTapCard?.(card.id)
      }}
    >
      {chosen ? "Doch behalten" : "Nach unten"}
    </Button>
  )
}

/** Forge's buttons of the start question: its words, its enabled state, the decision region's guards. */
function StartAnswers({ question, moment, armKey, bottom, onAnswer, onAnswered }: { question: StartQuestion; moment: TableMoment; armKey: string; bottom: boolean; onAnswer: ((question: number, body: AnswerBody) => void) | undefined; onAnswered: () => void }) {
  const arming = useArming(armKey)
  const blockedId = useId()
  const offId = useId()
  const blocked = answerBlocked({ live: onAnswer !== undefined, conceding: moment.conceding, waiting: moment.waiting })
  const off = question.buttons.filter((button) => !button.enabled)
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {bottom
          ? "„Nach unten“ wählt eine Karte für unter die Bibliothek, ein zweiter Druck nimmt es zurück. Erst Forges Knopf bestätigt die Wahl. Eine Karte antippen zeigt sie groß."
          : "Eine Karte antippen zeigt sie groß; wischen blättert durch die Hand. Schließen entscheidet nichts – Forges Frage bleibt am Tisch."}
      </p>
      {blocked !== null ? <p id={blockedId} className="text-xs text-muted-foreground">{blocked}</p> : null}
      {off.length > 0 ? <p id={offId} className="text-xs text-muted-foreground">{off.length === 1 ? `„${buttonText(off[0]!)}“ hat Forge gerade abgeschaltet.` : "Forge hat beide Knöpfe gerade abgeschaltet."}</p> : null}
      <div role="group" aria-label="Antworten, die Forge anbietet" data-start-question={question.id} className="flex flex-wrap justify-end gap-2">
        {question.buttons.map((button) => {
          const describedBy = [blocked !== null ? blockedId : null, button.enabled ? null : offId].filter((id) => id !== null).join(" ")
          return (
            <Button
              key={button.nr}
              size="lg"
              variant={button.nr === 1 ? "default" : "outline"}
              data-start-answer={button.nr}
              disabled={!button.enabled || blocked !== null}
              {...(describedBy ? { "aria-describedby": describedBy } : {})}
              onKeyDown={arming.onKeyDown}
              onClick={() => {
                if (!arming.armed() || onAnswer === undefined) return
                onAnswer(question.id, buttonsAnswer(button.nr))
                onAnswered()
              }}
            >
              {buttonText(button)}
            </Button>
          )
        })}
      </div>
    </>
  )
}
