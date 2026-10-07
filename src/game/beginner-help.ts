/* Presentation only: Forge's structured questions and static terminology. Never inputs or legality. */
import type { GameState, Phase, Question } from "@openmana/engine-protocol"
import { currentDecision, countRule, orderRule } from "./decision-model"
import { SICK_NOTE } from "./attack-labels"

export const PHASE_HELP: Readonly<Record<Phase, string>> = {
  UNTAP: "Beim Enttappen werden getappte Karten wieder aufgerichtet. Forge führt diesen Schritt aus.",
  UPKEEP: "Das Versorgungssegment liegt nach dem Enttappen und vor dem Ziehen. Hier können Fähigkeiten ausgelöst werden.",
  DRAW: "Im Ziehsegment wird die Karte für den Zug gezogen. Zusätzliche Effekte und Ausnahmen behandelt Forge.",
  MAIN1: "Die erste Hauptphase liegt vor dem Kampf. Welche Länder, Zaubersprüche und Fähigkeiten du jetzt nutzen kannst, zeigt Forge an den Karten.",
  COMBAT_BEGIN: "Der Kampf beginnt. Angreifer sind in diesem Schritt noch nicht deklariert.",
  COMBAT_DECLARE_ATTACKERS: "Der aktive Spieler legt die Angreifer fest. Forge zeigt die verfügbaren Angreifer und Verteidiger; bestätigt wird mit Forges Button.",
  COMBAT_DECLARE_BLOCKERS: "Der verteidigende Spieler legt die Blocks fest. Forge zeigt, welche Zuordnung gerade möglich ist; die Bestätigung schließt die Auswahl ab.",
  COMBAT_FIRST_STRIKE_DAMAGE: "Der erste Kampfschadensschritt betrifft Erstschlag und Doppelschlag. Wer wie viel Schaden zufügt, bestimmt Forge.",
  COMBAT_DAMAGE: "Forge führt den Kampfschaden aus. Falls du etwas verteilen musst, fragt Forge danach.",
  COMBAT_END: "Der Kampf endet. Die zweite Hauptphase folgt danach; Forge bestimmt, ob noch Entscheidungen offen sind.",
  MAIN2: "Die zweite Hauptphase liegt nach dem Kampf. Forge zeigt die Aktionen, die du jetzt noch ausführen kannst.",
  END_OF_TURN: "Das Endsegment liegt am Ende des Zuges. Hier können Fähigkeiten ausgelöst werden.",
  CLEANUP: "Im Aufräumsegment behandelt Forge unter anderem die Handkartengrenze und das Ende vorübergehender Effekte. Eine nötige Auswahl wird angezeigt.",
}

export const TERMS = [
  { title: "Priorität", text: "Du hast Gelegenheit, etwas zu tun oder weiterzugeben. „Weiter“ und „Verrechnen lassen“ geben die Priorität ab; sie spielen keine Karte für dich." },
  { title: "Stapel", text: "Zaubersprüche und Fähigkeiten warten hier auf ihre Verrechnung. Oben liegt der nächste Eintrag. Andere Spieler können vorher noch antworten; Forge bestimmt den Ablauf." },
  { title: "Ziel und Quelle", text: "Die Quelle ist die Karte, von der eine Aktion ausgeht. Ein Ziel wird von dieser Aktion angesprochen. Forge nennt und markiert die Auswahl; ein bereits benanntes Stapelziel ist dadurch nicht automatisch wählbar." },
  { title: "Getappt", text: "Eine getappte Karte liegt quer. Das ist ein Zustand, keine allgemeine Aussage darüber, was du mit ihr tun kannst. Forges Aktionsangebot entscheidet." },
  { title: "Einsatzverzögerung", text: "Die Sanduhr zeigt Forges Einsatzverzögerung an. Forge berücksichtigt Ausnahmen wie Eile. " + SICK_NOTE },
  { title: "Mulligan", text: "Vor dem ersten Zug kannst du deine Starthand behalten oder einen Mulligan nehmen. Forge führt das neue Ziehen und die danach nötige Auswahl aus." },
  { title: "Mana und Kosten", text: "Mana wird zum Bezahlen genutzt. Forge zeigt die noch offenen Kosten und mögliche Quellen. „Automatisch bezahlen“ überlässt nur diese Zahlung Forge; die Entscheidung, eine Karte zu spielen, triffst du selbst." },
] as const

/** Short, visible clarity; only bounds/cancellation explicitly supplied by Forge. No inferred optional effect. */
export function choiceClarity(question: Question): string | null {
  switch (question.kind) {
    case "select":
    case "choose": return question.min === 0 ? "Auswahl optional" : "Auswahl erforderlich"
    case "confirm": return "Ja oder Nein"
    case "options": return question.cancellable === true ? "Abbrechen möglich" : "Antwort erforderlich"
    case "input": return "Eingabe erforderlich"
    case "order": return orderRule(question).pickMin === 0 ? "Auswahl optional" : "Reihenfolge erforderlich"
    case "arrange": return "Anordnung bestätigen"
    case "distribute": return "Verteilung erforderlich"
    case "buttons": return null
  }
}

function questionHelp(question: Question): string {
  switch (question.kind) {
    case "select":
    case "choose": return `Forge verlangt ${countRule(question.min, question.max, 0)} Einträge. ${question.min === 0 ? "Du darfst auch nichts auswählen; die Entscheidung musst du trotzdem abschließen." : "Eine leere Auswahl genügt dieser Frage nicht."} ${question.kind === "select" ? "Forges Grenzen gelten für Karten und Spieler zusammen. Die Markierungen zeigen Forges aktuelle Auswahl." : "Ein Vorschlag ist nur ein Entwurf; erst dein Bestätigen sendet ihn."}`
    case "confirm": return "Diese Frage braucht eine Antwort. Ja und Nein sind zwei Entscheidungen; eine vorgeschlagene Antwort wird niemals von selbst gesendet. Ob ein Effekt optional ist, sagen Forges Frage und die Karte."
    case "options": return question.revealed !== undefined ? "Forge zeigt aufgedeckte Einträge. Lies sie und bestätige mit dem angebotenen Button." : `Wähle eine der Möglichkeiten, die Forge anbietet. ${question.cancellable === true ? "Forge erlaubt hier auch Abbrechen." : "Forge bietet für diese Frage kein Abbrechen an."}`
    case "input": return `Forge verlangt ${question.numeric ? "eine ganze Zahl" : "einen Text"}. Ein vorgefüllter Vorschlag wird erst durch dein Bestätigen gesendet.`
    case "order": { const rule = orderRule(question); return rule.all ? "Bringe alle Einträge in die verlangte Reihenfolge. Die Pfeile ändern nur deinen Entwurf; erst Bestätigen sendet ihn." : `Ordne ${countRule(rule.pickMin, rule.pickMax, question.items.length)} Einträge. Die übrigen bleiben in der anderen Liste. Erst Bestätigen sendet deine Reihenfolge.` }
    case "arrange": return "Verschiebe die gezeigten Karten auf die Seiten, die Forge anbietet, und ordne sie mit den Pfeilen. Du kannst den Entwurf unverändert bestätigen."
    case "distribute": return `Verteile insgesamt ${question.total}, mit mindestens ${question.min} je Eintrag. Diese Zahlen kommen von Forge. Erst Bestätigen sendet die Verteilung.`
    case "buttons": switch (question.purpose) {
      case "priority": return "Du kannst eine von Forge angebotene Aktion ausführen oder Priorität abgeben. „Zug beenden“ gibt weitere Gelegenheiten in diesem Zug ab und fragt deshalb vorher nach."
      case "attack":
      case "attackDeclared": return "Tippe eine von Forge angebotene Kreatur an, um sie für den angezeigten Verteidiger zu wählen. Ein weiterer Tap kann die Wahl ändern. Erst Forges Bestätigung legt den Angriff fest; Gründe für zurückbleibende Kreaturen kommen von Forge."
      case "block": return "Wähle einen von Forge angebotenen Angreifer als Blockziel, dann einen von Forge dafür angebotenen Blocker. Forges Zuordnungen stehen im Kampfbereich. Ein Blocker, der andere Angreifer blocken kann, ist nicht unbedingt für dieses Blockziel verfügbar. Erst Bestätigen legt die Blocks fest."
      case "payment": return "Forge zeigt, was noch zu bezahlen ist. Nutze angebotene Manaquellen, Manavorrat oder Forges Zahlungsbuttons. Es wird nichts von selbst bezahlt."
      case "mulligan": return "Behalte die Starthand oder nimm einen Mulligan mit Forges Buttons. Die Hilfe entscheidet nicht, welche Hand besser ist."
      case "mulliganBottom": return "Wähle in deiner Hand die Karten, die Forge unter die Bibliothek legen soll. Erst der angebotene Button bestätigt die Auswahl."
      default: return "Nutze die Buttons, die Forge in diesem Schritt anbietet. Aus dem Text einer Frage wird keine zusätzliche Aktion abgeleitet."
    }
  }
}

/** Resolve on every render, never hold the previous question/snapshot. */
export function decisionHelp(questions: readonly Question[]): string {
  const decision = currentDecision(questions)
  if (decision.kind === "none") return "Gerade ist keine Frage von Forge offen. Die Hilfe trifft keine Entscheidung für dich."
  if (decision.kind === "blocking") return questionHelp(decision.question)
  return [decision.select, decision.buttons].filter((q) => q !== null).map(questionHelp).join(" ")
}

/** Only exact structured target IDs; never names/prose or hidden card identities. */
export function stackTargetIds(state: GameState, kind: "card" | "player"): ReadonlySet<number> {
  return new Set(state.stack.flatMap((item) => item.targets.filter((target) => target.kind === kind).map((target) => target.id)))
}

export const STACK_TARGET_LABEL = "Ziel auf dem Stapel"
