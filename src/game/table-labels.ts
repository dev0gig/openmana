/*
 * German wording of the game table (prompt 13): counters, mana, zones, who
 * is who, what a card on the table shows. Keyed by the protocol's structured
 * values (Forge's counter type names, mana letters, seats) - never by Forge's
 * texts. Forge's own sentences (prompt line, questions, stack descriptions)
 * are shown as Forge sends them.
 */
import type { VisibleCard } from "@openmana/engine-protocol"
import type { CardUse } from "./card-use"
import type { CardRef, CardZone, CombatView, ManaColor, PlayerRef, Seat, StackEntryView } from "./table-model"

export const MANA_LABELS: Readonly<Record<ManaColor, string>> = {
  W: "Weiß",
  U: "Blau",
  B: "Schwarz",
  R: "Rot",
  G: "Grün",
  C: "Farblos",
}

/**
 * Forge's counter types (CounterEnumType.getName(): "+1/+1", "Poison" …; the
 * keyword counters of rule 122.1b by the keyword's title: "Flying", "First
 * Strike" …) with their German names from Magic's German rules texts. Forge itself does not
 * translate counters; a counter missing here is shown with Forge's (English)
 * name, marked as English.
 */
export const COUNTER_LABELS: Readonly<Record<string, string>> = {
  "+1/+1": "+1/+1",
  "-1/-1": "−1/−1",
  "+0/+1": "+0/+1",
  "+0/+2": "+0/+2",
  "+1/+0": "+1/+0",
  "+1/+2": "+1/+2",
  "+2/+0": "+2/+0",
  "+2/+2": "+2/+2",
  "-0/-1": "−0/−1",
  "-0/-2": "−0/−2",
  "-1/-0": "−1/−0",
  "-2/-1": "−2/−1",
  "-2/-2": "−2/−2",
  Loyalty: "Loyalität",
  Defense: "Verteidigung",
  Poison: "Gift",
  Energy: "Energie",
  Experience: "Erfahrung",
  Charge: "Ladung",
  Time: "Zeit",
  Lore: "Kunde",
  Shield: "Schild",
  Stun: "Betäubung",
  Oil: "Öl",
  Finality: "Endgültigkeit",
  Age: "Alter",
  Fade: "Schwund",
  Level: "Stufe",
  Verse: "Vers",
  Blood: "Blut",
  Ice: "Eis",
  Page: "Seite",
  Egg: "Ei",
  Spore: "Spore",
  Luck: "Glück",
  Divinity: "Göttlichkeit",
  Flood: "Flut",
  Slime: "Schleim",
  Ticket: "Ticket",
  Rad: "Strahlung",
  Flying: "Flugfähigkeit",
  "First Strike": "Erstschlag",
  "Double Strike": "Doppelschlag",
  Deathtouch: "Todesberührung",
  Hexproof: "Fluchsicher",
  Indestructible: "Unzerstörbar",
  Lifelink: "Lebensverknüpfung",
  Menace: "Bedrohlich",
  Reach: "Reichweite",
  Trample: "Trampelschaden",
  Vigilance: "Wachsamkeit",
  Haste: "Eile",
  Decayed: "Verfallen",
  Exalted: "Erhaben",
  Shadow: "Schatten",
  Quest: "Quest",
}

/** A counter's name as the player reads it; `english` when only Forge's English name is known. */
export function counterLabel(name: string): { readonly text: string; readonly english: boolean } {
  const german = COUNTER_LABELS[name]
  return german === undefined ? { text: name, english: true } : { text: german, english: false }
}

/** "Du" / "Forge-KI" - who a seat is, as the table says it everywhere. */
export function seatName(seat: Seat | null): string {
  return seat === "me" ? "Du" : seat === "opponent" ? "Forge-KI" : "Unbekannt"
}

/** The name the table uses for a card: Forge's live name (in the player's card language), else its key. */
export function cardName(card: VisibleCard | null | undefined): string {
  if (card === null || card === undefined) return "eine verdeckte Karte"
  return card.name ?? card.key ?? `Karte ${card.id}`
}

/** A player or card someone refers to (a target, a defender). */
export function refName(ref: PlayerRef | CardRef): string {
  return ref.kind === "player" ? (ref.seat === "me" ? "dich" : seatName(ref.seat)) : cardName(ref.card)
}

/**
 * What the caption strip below a card says in words: power/toughness or
 * loyalty, damage, counters, face-down, phased out. Forge's values, nothing
 * computed (never "toughness left").
 */
export function captionFacts(card: VisibleCard): string[] {
  const facts: string[] = []
  if (card.power !== undefined && card.toughness !== undefined) facts.push(`${card.power}/${card.toughness}`)
  if (card.loyalty !== undefined && card.loyalty !== null) facts.push(`Loyalität ${card.loyalty}`)
  if (card.damage > 0) facts.push(`${card.damage} Schaden`)
  for (const [name, amount] of Object.entries(card.counters ?? {})) {
    if (amount === 0 || (name === "Loyalty" && card.loyalty !== undefined && card.loyalty !== null)) continue
    facts.push(`${counterLabel(name).text}: ${amount}`)
  }
  if (card.faceDown) facts.push("verdeckt")
  if (card.phasedOut === true) facts.push("ausgephast")
  return facts
}

/** What the caption shows as signs or not at all, in words for screen readers: tapped, combat, token. */
export function spokenFacts(card: VisibleCard): string[] {
  return [card.tapped ? "getappt" : null, card.attacking === true ? "greift an" : null, card.blocking === true ? "blockt" : null, card.token === true ? "Spielstein" : null].filter(
    (fact): fact is string => fact !== null,
  )
}

/** Everything the table knows about a card on the battlefield, as short German facts (the caption's tooltip): the pile's size first. */
export function cardFacts(card: VisibleCard, count = 1): string[] {
  const spoken = spokenFacts(card)
  const token = spoken.filter((fact) => fact === "Spielstein")
  return [...(count > 1 ? [`${count} Karten`] : []), ...spoken.filter((fact) => fact !== "Spielstein"), ...captionFacts(card), ...token]
}

/** One stack entry in words: who, what (Forge's text), which targets. */
export function stackTargets(entry: StackEntryView): string | null {
  return entry.targets.length === 0 ? null : `Ziel: ${entry.targets.map(refName).join(", ")}`
}

/** Whom an attacker attacks, in words ("greift dich an", "greift Forge-KI an", "greift Jace an"). */
export function attackLine(view: CombatView): string {
  const defender = view.defender === null ? null : refName(view.defender)
  return defender === null ? "greift an" : `greift ${defender} an`
}

/** Who blocks it ("geblockt von Riesenspinne, Grizzlybären" / "ungeblockt"). */
export function blockLine(view: CombatView): string {
  return view.blockers.length === 0 ? "ungeblockt" : `geblockt von ${view.blockers.map((blocker) => cardName(blocker.card)).join(", ")}`
}

/**
 * A card as a control, in words (its button's name, prompt 14): name, how
 * many in the pile, Forge's facts, where it hangs, Forge's mark - and, where
 * the button taps at once, what the tap does.
 */
export function cardButtonLabel(card: VisibleCard, use: CardUse, options: { readonly count?: number; readonly note?: string } = {}): string {
  const parts = [cardName(card), ...cardFacts(card, options.count ?? 1), ...(options.note ? [options.note] : []), ...(use.markLabel ? [use.markLabel] : [])]
  const label = parts.join(", ")
  return use.primary === "tap" && use.tap !== null ? `${label} – Antippen: ${use.tap.label}` : label
}

const ZONE_PLACES: Readonly<Record<CardZone, { readonly me: string; readonly opponent: string }>> = {
  battlefield: { me: "Dein Spielfeld", opponent: "Spielfeld der Forge-KI" },
  hand: { me: "Deine Hand", opponent: "Hand der Forge-KI (aufgedeckt)" },
  graveyard: { me: "Dein Friedhof", opponent: "Friedhof der Forge-KI" },
  exile: { me: "Dein Exil", opponent: "Exil der Forge-KI" },
  command: { me: "Deine Kommandozone", opponent: "Kommandozone der Forge-KI" },
}

/** Where a card lies, for the card view ("Deine Hand", "Spielfeld der Forge-KI" …). */
export function placeLabel(zone: CardZone | null, seat: Seat): string {
  if (zone === null) return seat === "me" ? "Dein Kommandeur, gerade auf keinem sichtbaren Platz" : "Kommandeur der Forge-KI, gerade auf keinem sichtbaren Platz"
  return ZONE_PLACES[zone][seat]
}
