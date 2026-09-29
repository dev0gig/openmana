/*
 * German wording of the declaration of attackers (prompt 18): why Forge
 * would not declare a creature an attacker now, and the words of Forge's
 * buttons of the declaration. Keyed by Forge's structured values
 * (Attack.unavailable[].reason, Button.meaning) - never by Forge's
 * (localized) texts. Static explanations of Magic's rules for beginners,
 * never a forecast: whether a creature can attack, Forge alone says. Only
 * the game page loads it (the start page's words stay in game-labels.ts).
 */
import type { AttackRefusal } from "@openmana/engine-protocol"

export interface RefusalWords {
  /** A few words, for the card's name and the list of creatures that stay back ("getappt"). */
  readonly short: string
  /** One sentence why, for the card view and the decision region. */
  readonly why: string
}

/** Forge's reasons (CombatUtil.attackRefusal, via the bridge) in the words of Magic's German rules. */
export const ATTACK_REFUSAL_WORDS: Readonly<Record<AttackRefusal, RefusalWords>> = {
  tapped: { short: "getappt", why: "Getappte Kreaturen können nicht angreifen." },
  sick: { short: "Einsatzverzögerung", why: "Sie ist erst seit diesem Zug unter deiner Kontrolle und kann noch nicht angreifen." },
  phasedOut: { short: "ausgephast", why: "Ausgephaste Kreaturen gelten als nicht im Spiel." },
  goaded: { short: "aufgestachelt", why: "Sie ist aufgestachelt und muss einen Spieler angreifen, der sie nicht aufgestachelt hat." },
  restricted: { short: "darf nicht angreifen", why: "Eine Fähigkeit oder ein Effekt verbietet ihr den Angriff – etwa Verteidiger. Die Karte sagt, welche." },
  defender: { short: "nicht dieses Ziel", why: "Dieses Angriffsziel darf sie nicht angreifen, ein anderes schon – wähle erst das andere Ziel." },
  notCreature: { short: "keine Kreatur", why: "Nur Kreaturen können angreifen." },
  tooLate: { short: "zu spät", why: "Die Angreifer sind schon deklariert." },
}

/** The summoning-sickness mark of a creature (VisibleCard.sick: Forge's own, haste already considered). */
export const SICK_LABEL = "Einsatzverzögerung"

/**
 * What a sick creature's mark means (the card view), on any creature at any
 * time (comprehensive rules 302.6; Forge ends it when its player's next turn
 * begins): an AI creature cast in the AI's turn is still sick in the player's.
 */
export const SICK_NOTE =
  "Noch nicht seit Beginn des letzten Zuges ihres Spielers unter dessen Kontrolle. Bis sein nächster Zug beginnt, kann sie nicht angreifen und keine Fähigkeiten mit {T} in den Kosten aktivieren."

/** How many more creatures a tap would declare (the attack model's `ready`: Forge's marker, gold dashed on the table). */
export function readyText(ready: number): string {
  return `${ready === 1 ? "1 weitere Kreatur kann" : `${ready} weitere Kreaturen können`} angreifen (gold gestrichelt).`
}

/**
 * How tapping declares (Forge's InputAttack): a tap declares a creature an
 * attacker of the defender, a second takes it back; with several defenders a
 * tap also moves a creature attacking another one to the defender - so the
 * sentence names the chosen one. What a tap on a card does exactly, Forge's
 * words on the card say (`action`).
 */
export function attackTapNote(defenders: number): string {
  const tap = defenders > 1 ? "Antippen lässt eine Kreatur das gewählte Ziel angreifen" : "Antippen lässt eine Kreatur angreifen"
  return `${tap}, ein zweiter Tipp nimmt sie zurück. Lange drücken oder Rechtsklick zeigt eine Karte groß.`
}

/** Whom a creature tapped now attacks, as the object of a sentence ("die Forge-KI", "„Garruk Wildsprecher“"). */
export function defenderObject(defender: { readonly name: string; readonly player: unknown | null } | null): string {
  if (defender === null) return "den Gegner"
  return defender.player !== null ? `die ${defender.name}` : `„${defender.name}“`
}

/** What the declaration is about now, in one sentence: whom the tapped creatures attack, and who attacks so far. */
export function attackText(view: { readonly attackers: readonly unknown[]; readonly defender: { readonly name: string; readonly player: unknown | null } | null }): string {
  const target = defenderObject(view.defender)
  const count = view.attackers.length
  if (count === 0) return `Tippe die Kreaturen an, die ${target} angreifen sollen.`
  return `${count === 1 ? "1 Kreatur greift" : `${count} Kreaturen greifen`} an. Weitere, die du antippst, greifen ${target} an.`
}

/** Forge's OK of the declaration (Button.meaning "declare"), by how many creatures attack. */
export function declareLabel(attackers: number): string {
  if (attackers === 0) return "Nicht angreifen"
  return attackers === 1 ? "Mit 1 Kreatur angreifen" : `Mit ${attackers} Kreaturen angreifen`
}

/** What Forge's OK does now - a static explanation of the turn (comprehensive rules 508-509), never a forecast. */
export function declareNote(attackers: number): string {
  return attackers === 0
    ? "„Nicht angreifen“ lässt den Angriff in diesem Zug aus."
    : "Mit dem Bestätigen steht der Angriff fest; danach entscheidet die Forge-KI, ob sie blockt."
}

/** Forge's Call Back (Button.meaning "callBack"), in words that say it takes all back. */
export const CALL_BACK_LABEL = "Alle zurücknehmen"
