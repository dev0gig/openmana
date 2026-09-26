/*
 * Forge's questions the recorded test games do not reach (prompt 15), built
 * after the protocol's schema on top of a real recorded state
 * (src/test/table-scenes.ts) - for the end-to-end test's table harness
 * (section 12) and its sizes. They are marked as built wherever they are
 * used as evidence: the kinds themselves (confirm, input, order, a revealed
 * list, several choices, cards outside the table in a selection) are what
 * Forge's GUI methods send (the bridge's getChoices, confirm, showInputDialog,
 * order, reveal, setSelectables); every question passes the protocol's
 * check (src/game/decision-model.test.ts - not here: the harness page stays
 * free of the protocol's validators).
 */
import type { Item, Question, VisibleCard } from "@openmana/engine-protocol"
import { isVisible } from "@/game/table-model"
import type { TableScene } from "./table-scenes"

export const BUILT_QUESTIONS = ["confirm", "input", "order", "reveal", "choose-many", "select-outside"] as const

export type BuiltQuestionName = (typeof BUILT_QUESTIONS)[number]

function items(texts: readonly string[]): [Item, ...Item[]] {
  const list = texts.map((text, index): Item => ({ nr: index + 1, text }))
  return list as [Item, ...Item[]]
}

/** The scene's cards the player may see (its hand first), as questions carry them. */
function sceneCards(scene: TableScene): VisibleCard[] {
  const me = scene.state.players.find((player) => player.me)
  const own = me === undefined ? [] : [...me.zones.hand, ...me.zones.battlefield]
  return own.filter(isVisible)
}

/** The questions (and Forge's prompt line) of a built moment on a recorded scene's state. */
export function builtQuestion(name: BuiltQuestionName, scene: TableScene): { readonly questions: readonly Question[]; readonly prompt: string | null } {
  const [first, second] = sceneCards(scene)
  if (first === undefined || second === undefined) throw new Error(`scene ${scene.name} has too few cards of the player for built questions`)
  const cardItem = (card: VisibleCard, nr: number): Item => ({ nr, text: `${card.name ?? card.key} (${card.id})`, card: card.id, cardView: card })
  let question: Question
  switch (name) {
    case "confirm":
      question = { type: "question", kind: "confirm", id: 900, blocking: true, text: `${first.name ?? first.key} - Möchtest du die Fähigkeit nutzen?`, suggested: true, card: first.id, cardView: first }
      break
    case "input":
      question = { type: "question", kind: "input", id: 901, blocking: true, text: "Wähle einen Wert für X", numeric: true, suggested: "0" }
      break
    case "order":
      question = {
        type: "question",
        kind: "order",
        id: 902,
        blocking: true,
        text: "Ordne Reihenfolge für simultane Fähigkeiten neu",
        top: "Lege zuerst",
        remainingMin: 0,
        remainingMax: 0,
        items: [cardItem(first, 1), cardItem(second, 2), { nr: 3, text: "Ausgelöste Fähigkeit eines Effekts" }],
      }
      break
    case "reveal":
      question = { type: "question", kind: "options", id: 903, blocking: true, text: "Forge-KI deckt Karten auf", items: items(["OK"]), revealed: [cardItem(first, 1), cardItem(second, 2)] }
      break
    case "choose-many":
      question = { type: "question", kind: "choose", id: 904, blocking: true, text: "Wähle bis zu zwei Farben", min: 0, max: 2, items: items(["Weiß", "Blau", "Schwarz", "Rot", "Grün"]) }
      break
    case "select-outside": {
      // A card of the library (in no zone of the state) and a hidden one: the table does not show them, the decision does.
      const { playable: _playable, highlighted: _highlighted, action: _action, ways: _ways, ...plain } = first
      const library: VisibleCard = { ...plain, id: 990, tapped: false }
      question = {
        type: "question",
        kind: "select",
        id: 905,
        blocking: false,
        text: "",
        min: 1,
        max: 1,
        cards: [990],
        items: [cardItem(library, 1), { nr: 2, hidden: true }],
      }
      const buttons: Question = {
        type: "question",
        kind: "buttons",
        id: 906,
        blocking: false,
        text: "",
        buttons: [
          { nr: 1, label: "OK", enabled: false },
          { nr: 2, label: "Abbrechen", enabled: true },
        ],
      }
      return { questions: [question, buttons], prompt: "Wähle eine Karte aus deiner Bibliothek" }
    }
  }
  return { questions: [question], prompt: null }
}
