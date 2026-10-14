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
 *  - Keep or mulligan: a tap (click, Enter, a long press) on a card opens it
 *    in the card view (card-view.tsx) over this panel, with the hand to browse
 *    (swipes, arrow keys, buttons); closing that view comes back here, the
 *    focus on the card. Looking sends nothing.
 *  - The answers: exactly Forge's two buttons, Forge's words, Forge's
 *    enabled state; armed ARMING_MS after the panel or a new question
 *    appeared and after a card view over it closed (its closing press may
 *    land on a button here), a held key repeats nothing.
 *  - The London mulligan's choice (the project owner, 2026-10-14: "Auswahl
 *    klar, kein Flackern"): a tap on a card's picture chooses it for the
 *    bottom or takes it back - Forge's card.tap, as on the table (Forge marks
 *    the card, `highlighted`, the solid frame around the picture) -; a long
 *    press, a right click or the context-menu key looks at it. Under each
 *    card the same choice as a button ("Nach unten" / "Doch behalten",
 *    `aria-pressed`: the way for the keyboard and without tapping the
 *    picture). How many are marked ("N ausgewählt" - Forge sends no number
 *    in its data, so never "N von M"), and Forge's buttons: its OK confirms -
 *    once, explicitly -, its second button is Forge's own offer as Forge
 *    names it. In a replay a tap only looks.
 *  - The choice is armed once when the step appears for a hand (and after a
 *    card view over the panel closed), not for each of Forge's new questions
 *    after a tap: the next card's press is meant. A second press on the same
 *    card before Forge answered the first counts once (a double tap). A
 *    press while Forge computes is not sent, and a toast says why - never
 *    nothing.
 *  - Forge withdraws its question and asks anew after every tap (each its
 *    own message): in that gap the panel keeps the choice as it was - title,
 *    count, marks, the buttons and their room, one status line - waiting
 *    (`holdBottom`, start-hand.ts); nothing moves between Forge's messages.
 *  - Closing (X, Escape, the system's back) answers nothing: Forge's question
 *    stays in the decision region, with "Starthand ansehen" beside it.
 *    While Forge computes after an answer from here the panel stays and says
 *    so; it closes when the game begins (start-hand.ts).
 * A replay shows the panel only when asked, and answers nothing.
 */
import { useCallback, useId, useRef, useState } from "react"
import type { AnswerBody, GameState, VisibleCard } from "@openmana/engine-protocol"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useCloseWatcher } from "@/components/ui/card-lightbox"
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { GameCardButton, type GameCardMark } from "@/components/ui/game-card"
import { HandSpreadCard, HandSpreadContent, HandSpreadFooter, HandSpreadGrid, HandSpreadHeader, HandSpreadItem, useHandSpreadCard } from "@/components/ui/hand-spread"
import { Spinner } from "@/components/ui/spinner"
import { useCardPress } from "@/hooks/use-card-press"
import { cardUse, type CardUse, type TableMoment } from "./card-use"
import { ARMING_MS } from "./card-view"
import { answerBlocked, useArming } from "./decision-panel"
import { buttonsAnswer, buttonText } from "./decision-model"
import { answeredBottom, holdBottom, playerHand, shownStartQuestion, startHandKey, type HeldBottom, type StartQuestion } from "./start-hand"
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
  /** Forge's card.tap for the choice for the bottom (the panel guards against a double tap itself); absent: nothing is tapped. */
  readonly onTapCard?: ((id: number) => void) | undefined
}

export function StartHandView({ open, onClose, question, state, prompt, moment, pictures, inspecting, onLook, onAnswer, onAnswered, onTapCard }: StartHandViewProps) {
  // Re-armed whenever the panel opens and whenever a card view over it closes.
  const [arming, setArming] = useState({ open, inspecting, serial: 0 })
  if (arming.open !== open || arming.inspecting !== inspecting) {
    setArming({ open, inspecting, serial: arming.serial + ((open && !arming.open) || (arming.inspecting && !inspecting) ? 1 : 0) })
  }
  // Forge's gap after every tap during the choice for the bottom: the last choice stays shown, waiting (start-hand.ts).
  const [held, setHeld] = useState<HeldBottom | null>(null)
  const hold = holdBottom(held, question, state)
  if (hold !== held) setHeld(hold)
  const shown = shownStartQuestion(hold, question)
  // Forge's answers re-arm for every question of Forge's (keep or mulligan; OK and Auto); the choice for the bottom
  // once per step and hand - never for the new question Forge asks after each tap.
  const armKey = `${shown.question?.id ?? 0}:${arming.serial}`
  const chooseKey = `${shown.question === null ? "" : startHandKey(shown.question, state)}:${arming.serial}`
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
        {open ? (
          <StartHand
            question={shown.question}
            pending={shown.pending}
            state={state}
            prompt={prompt}
            moment={moment}
            pictures={pictures}
            armKey={armKey}
            chooseKey={chooseKey}
            onLook={onLook}
            onAnswer={onAnswer}
            onAnswered={() => {
              if (shown.question !== null) setHeld((previous) => answeredBottom(previous, shown.question!.id))
              onAnswered()
            }}
            onTapCard={onTapCard}
          />
        ) : null}
      </HandSpreadContent>
    </Dialog>
  )
}


/** Why nothing can be chosen in the gap between two of Forge's questions (the held choice waits for Forge). */
const PENDING_REASON = "Forge rechnet gerade."

function StartHand({
  question,
  pending,
  state,
  prompt,
  moment,
  pictures,
  armKey,
  chooseKey,
  onLook,
  onAnswer,
  onAnswered,
  onTapCard,
}: Omit<StartHandViewProps, "open" | "onClose" | "inspecting"> & { pending: boolean; armKey: string; chooseKey: string }) {
  const hand = playerHand(state)
  const bottom = question?.purpose === "mulliganBottom"
  // The cards' uses during the gap: those of the held choice (shown, never sent - `pending`).
  const shownMoment = pending && question !== null ? { ...moment, questions: [question] } : moment
  const chosen = bottom ? hand.filter((card): card is VisibleCard => isVisible(card) && card.highlighted === true).length : 0
  const count = hand.length === 1 ? "1 Karte" : `${hand.length} Karten`
  const words = question === null ? null : (prompt ?? (question.text.trim() ? question.text : null))
  // The choice for the bottom is armed once per step and hand (and after a card view over the panel closed), not per
  // question id: Forge asks anew after every tap, and the next card's press is meant (see the module's comment).
  const arming = useArming(chooseKey)
  // The second press of a double tap on the same card counts once - until Forge answered the first (its new question).
  const lastTap = useRef<{ readonly id: number; readonly question: number; readonly at: number } | null>(null)
  const { armed } = arming
  const choose = useCallback((card: VisibleCard, use: CardUse) => {
    if (question === null || onTapCard === undefined || use.tap === null || !armed()) return
    const now = performance.now()
    const last = lastTap.current
    if (last !== null && last.id === card.id && last.question === question.id && now - last.at < ARMING_MS) return
    const reason = pending ? PENDING_REASON : use.blocked
    if (reason !== null) {
      // Never nothing: a press that cannot be sent now says why (one toast, the next press replaces it).
      toast("Die Karte wurde nicht gewählt", { id: "start-hand-choice", description: `${reason} Gleich noch einmal antippen.`, position: "top-center" })
      return
    }
    lastTap.current = { id: card.id, question: question.id, at: now }
    onTapCard(card.id)
  }, [question, pending, onTapCard, armed])
  return (
    <>
      <HandSpreadHeader>
        <DialogTitle className="font-heading text-lg font-semibold">{bottom ? "Karten unter die Bibliothek legen" : "Deine Starthand"}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            <p>
              <span className="tabular-nums">{count}</span>
              {/* Forge sends no number for the choice in its data (only its prompt line says it): never "N von M". */}
              {bottom ? <> · <span data-start-hand-chosen={chosen} className="tabular-nums">{chosen === 1 ? "1 ausgewählt" : `${chosen} ausgewählt`}</span></> : null}
            </p>
            {words !== null ? <p className="font-medium text-foreground">{words}</p> : null}
          </div>
        </DialogDescription>
      </HandSpreadHeader>
      <HandSpreadGrid count={hand.length} extra={bottom ? TOGGLE_ROOM : 0} aria-label={`Deine Hand: ${count}`}>
        {hand.map((card, index) => {
          if (!isVisible(card)) {
            return (
              <HandSpreadItem key={`hidden:${index}`}>
                <HandSpreadCard>
                  <TableCardBack>
                    <span className="sr-only">verdeckte Karte</span>
                  </TableCardBack>
                </HandSpreadCard>
              </HandSpreadItem>
            )
          }
          const use = bottom ? cardUse(card, { zone: "hand", mine: true }, shownMoment) : null
          // Choosing by a tap on the picture only where a tap is sent at all (not in a replay); else the tap looks.
          const choice = use !== null && use.tap !== null && onTapCard !== undefined ? () => choose(card, use) : null
          return (
            <HandSpreadItem key={card.id}>
              <StartHandCard card={card} pictures={pictures} chosen={bottom && card.highlighted === true} onChoose={choice} onLook={() => onLook(card.id)} />
              {use !== null ? <BottomToggle card={card} use={use} pending={pending} live={onTapCard !== undefined} onChoose={() => choose(card, use)} /> : null}
            </HandSpreadItem>
          )
        })}
      </HandSpreadGrid>
      <HandSpreadFooter>
        {question === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Spinner aria-hidden />
            Forge rechnet … gleich geht es weiter.
          </p>
        ) : (
          <StartAnswers question={question} pending={pending} moment={moment} armKey={armKey} bottom={bottom} onAnswer={onAnswer} onAnswered={onAnswered} />
        )}
      </HandSpreadFooter>
    </>
  )
}

/**
 * A card of the hand. Keep or mulligan: a tap, Enter or a long press looks at
 * it - never more. The choice for the bottom (`onChoose`, the project owner
 * 2026-10-14: as on the table): a tap, Enter or Space chooses it or takes it
 * back; a long press, a right click or the context-menu key (Shift+F10) looks.
 */
function StartHandCard({ card, pictures, chosen, onChoose, onLook }: { card: VisibleCard; pictures: TableCardLookup; chosen: boolean; onChoose: (() => void) | null; onLook: () => void }) {
  const press = useCardPress({ onPrimary: onChoose ?? onLook, onLook })
  // The picture's size is the grid's (never "auto": such a picture gives up its size when it leaves the page, and the
  // whole hand leaves at once when the panel closes - Chrome would start and abort a request for each).
  const width = useHandSpreadCard()
  const mark: GameCardMark | null = chosen ? "selected" : null
  const name = cardName(card)
  const label =
    onChoose === null
      ? `${name}${chosen ? ", kommt unter die Bibliothek" : ""} – groß ansehen`
      : `${name} – ${chosen ? "antippen behält sie doch" : "antippen legt sie unter die Bibliothek"}, lange drücken zeigt sie groß`
  return (
    <HandSpreadCard>
      <GameCardButton
        mark={mark}
        data-start-hand-card={card.id}
        aria-label={label}
        title={name}
        {...(onChoose === null ? { "aria-haspopup": "dialog" as const } : { "aria-pressed": chosen })}
        className="size-full"
        {...press}
      >
        <TablePicture card={card} pictures={pictures} sizes={width > 0 ? `${width}px` : HAND_PICTURE_SIZES} />
      </GameCardButton>
    </HandSpreadCard>
  )
}

/**
 * The London mulligan's button under a card: chooses it for the bottom or
 * takes it back - the same choice as a tap on the picture (Forge's card.tap)
 * and its way for the keyboard and for anyone who would not tap the picture.
 * While Forge computes it keeps its look (no flicker after every tap) and is
 * only `aria-disabled`: a press says why. Off for good only in a replay.
 */
function BottomToggle({ card, use, pending, live, onChoose }: { card: VisibleCard; use: CardUse; pending: boolean; live: boolean; onChoose: () => void }) {
  const chosen = card.highlighted === true
  if (use.tap === null) return null
  const waits = pending || use.blocked !== null
  return (
    <Button
      variant={chosen ? "secondary" : "outline"}
      size="sm"
      className="w-full"
      data-bottom-toggle={card.id}
      aria-pressed={chosen}
      aria-label={`${cardName(card)}: ${use.tap.label}`}
      title={(pending ? PENDING_REASON : use.blocked) ?? use.tap.label}
      disabled={!live}
      {...(waits ? { "aria-disabled": true } : {})}
      onKeyDown={(event) => {
        if (event.repeat) event.preventDefault()
      }}
      onClick={onChoose}
    >
      {chosen ? "Doch behalten" : "Nach unten"}
    </Button>
  )
}

/**
 * Forge's buttons of the start question: its words, its enabled state, the
 * decision region's guards. Above them one line for what holds them back -
 * Forge computes, a concession, a replay, a button Forge switched off - that
 * always takes its room: no answer, no tap and no gap between Forge's
 * messages moves the footer.
 */
function StartAnswers({ question, pending, moment, armKey, bottom, onAnswer, onAnswered }: { question: StartQuestion; pending: boolean; moment: TableMoment; armKey: string; bottom: boolean; onAnswer: ((question: number, body: AnswerBody) => void) | undefined; onAnswered: () => void }) {
  const arming = useArming(armKey)
  const statusId = useId()
  const live = onAnswer !== undefined
  const blocked = answerBlocked({ live, conceding: moment.conceding, waiting: moment.waiting && !pending })
  const computing = live && !moment.conceding && (pending || !moment.waiting)
  const off = question.buttons.filter((button) => !button.enabled)
  const offText = off.length === 0 ? null : off.length === 1 ? `„${buttonText(off[0]!)}“ hat Forge gerade abgeschaltet.` : "Forge hat beide Knöpfe gerade abgeschaltet."
  // One line, the most urgent first; while Forge computes its own short words (they fit one line on a small phone).
  const status = computing ? "Forge rechnet … gleich geht es weiter." : (blocked ?? offText)
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {bottom
          ? "Eine Karte antippen legt sie unter die Bibliothek, ein zweiter Tipp nimmt es zurück – ebenso der Knopf darunter. Lange drücken oder Rechtsklick zeigt sie groß. Erst Forges Knopf bestätigt die Wahl."
          : "Eine Karte antippen zeigt sie groß; wischen blättert durch die Hand. Schließen entscheidet nichts – Forges Frage bleibt am Tisch."}
      </p>
      <p id={statusId} role="status" data-start-hand-status={computing ? "computing" : status === null ? "" : "reason"} className="flex min-h-4 items-center gap-2 text-xs text-muted-foreground">
        {computing ? <Spinner aria-hidden className="size-3" /> : null}
        {status}
      </p>
      <div role="group" aria-label="Antworten, die Forge anbietet" data-start-question={question.id} {...(pending ? { "data-start-pending": "" } : {})} className="flex flex-wrap justify-end gap-2">
        {question.buttons.map((button) => {
          const described = status !== null && (blocked !== null || computing || !button.enabled)
          return (
            <Button
              key={button.nr}
              size="lg"
              variant={button.nr === 1 ? "default" : "outline"}
              data-start-answer={button.nr}
              disabled={!button.enabled || blocked !== null}
              {...(described ? { "aria-describedby": statusId } : {})}
              onKeyDown={arming.onKeyDown}
              onClick={() => {
                if (!arming.armed() || onAnswer === undefined || pending) return
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
