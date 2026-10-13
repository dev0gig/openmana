/*
 * The player's land plays and why an action is not possible now (prompt 51):
 * the words of Forge's land facts (protocol 10, prompt 48) - how many lands
 * the player played this turn of how many Forge allows (`Player.landsPlayed`,
 * `landsAllowed`, `landsUnlimited`), and why Forge would not let them play a
 * land of their hand now (`VisibleCard.landRefusal`, Forge's own check
 * `Player.landPlayRefusal`, Forge patch 0010).
 *
 * Nothing here is a rule of the app's own: every number and every reason is
 * Forge's, keyed by its structured values - never counted from the cards on
 * the battlefield (two lands lying there may have come in two turns, or by an
 * effect, which Forge does not count), never derived from a card's type or
 * text. Where Forge gives no reason, the words say so honestly
 * (`UNOFFERED_ACTION`) instead of guessing missing mana, a wrong target or a
 * card's effect. Only the game page loads it (the start page's words stay in
 * game-labels.ts).
 */
import type { GameState, LandRefusal, Player } from "@openmana/engine-protocol"
import type { RefusalWords } from "./attack-labels"

/**
 * Forge's reasons (Player.landPlayRefusal, via the bridge's LandPlays) in
 * words: a few for a short line, one sentence why. The sentences explain the
 * reason Forge named - its check runs in this order: whose turn, when (a main
 * phase with an empty stack, as for a sorcery), whose card, from where, an
 * effect forbidding it, the lands of the turn used up.
 */
export const LAND_REFUSAL_WORDS: Readonly<Record<LandRefusal, RefusalWords>> = {
  notYourTurn: { short: "nicht dein Zug", why: "Länder spielst du nur in deinem eigenen Zug." },
  timing: { short: "nicht jetzt", why: "Ein Land spielst du nur in deiner Hauptphase, wenn der Stapel leer ist." },
  notOwner: { short: "nicht deine Karte", why: "Die Karte gehört nicht dir, und kein Effekt erlaubt dir, sie zu spielen." },
  zone: { short: "nicht von hier", why: "Von hier aus erlaubt Forge dir nicht, dieses Land zu spielen." },
  restricted: { short: "verboten", why: "Ein Effekt verbietet dir gerade, dieses Land zu spielen – die Karten auf dem Tisch sagen, welcher." },
  limit: { short: "Land schon gespielt", why: "Dein Land für diesen Zug ist bereits gespielt." },
}

/** The limit's words when Forge allows more than one land this turn (an effect such as Exploration). */
const LIMIT_MANY: RefusalWords = { short: "Länder schon gespielt", why: "Deine Länder für diesen Zug sind bereits gespielt." }

/** Forge's reason in words; `allowed`: Forge's limit of land plays this turn (the limit's sentence for more than one). */
export function landRefusalWords(reason: LandRefusal, allowed: number): RefusalWords {
  return reason === "limit" && allowed > 1 ? LIMIT_MANY : LAND_REFUSAL_WORDS[reason]
}

/**
 * Where Forge does not offer an action and names no reason (a card it does
 * not mark playable that is no land, a drop in a step whose taps choose):
 * that, and nothing more - never a guessed cause.
 */
export const UNOFFERED_ACTION = "Forge bietet diese Aktion gerade nicht an."

/** The same in the card view, where the player only looks (no action was tried): Forge offers nothing for the card. */
export const UNOFFERED_CARD = "Mit dieser Karte bietet Forge gerade nichts an."

/** The player's land plays this turn as the strip shows them (prompt 51); null where there is nothing to show. */
export interface LandPlayFact {
  /** Whose turn it is: the player's own (Forge's numbers count), or the AI's (Forge offers no land then). */
  readonly turn: "mine" | "opponent"
  /** On the strip: a few words ("Länder") … */
  readonly label: string
  /** … and Forge's numbers ("0/1", "2 · unbegrenzt"); null in the AI's turn. */
  readonly value: string | null
  /** The same in a sentence (title and screen readers). */
  readonly sentence: string
  /** Forge's limit is reached: the player's land plays of this turn are used up. */
  readonly used: boolean
}

/**
 * The player's land plays (Forge's `landsPlayed` of `landsAllowed`, or
 * "unbegrenzt" with Forge's `landsUnlimited`) - in the player's own turn
 * only: in the AI's turn Forge counts the AI's turn and offers the player no
 * land (Forge's own check refuses `notYourTurn` first, CR 305.3), so the
 * strip says that instead of numbers that look available. Before the first
 * turn (the start questions) nothing: there is no turn to count yet.
 */
export function landPlayFact(state: GameState): LandPlayFact | null {
  const me = ownPlayer(state)
  if (me === null || state.turn <= 0 || state.activePlayer === null) return null
  if (state.activePlayer !== me.id) {
    return { turn: "opponent", label: "Kein Land im KI-Zug", value: null, sentence: "Im Zug der Forge-KI bietet Forge dir kein Land zum Spielen an – deine Länder spielst du in deinem eigenen Zug.", used: false }
  }
  const played = me.landsPlayed
  if (me.landsUnlimited === true) {
    return { turn: "mine", label: "Länder", value: `${played} · unbegrenzt`, sentence: `In diesem Zug hast du ${played === 1 ? "1 Land" : `${played} Länder`} gespielt; Forge erlaubt dir gerade beliebig viele.`, used: false }
  }
  const allowed = me.landsAllowed
  const used = played >= allowed
  const sentence = `In diesem Zug hast du ${played} von ${allowed === 1 ? "1 Land" : `${allowed} Ländern`} gespielt, die Forge dir erlaubt.${used ? ` ${landRefusalWords("limit", allowed).why}` : ""}`
  return { turn: "mine", label: "Länder", value: `${played}/${allowed}`, sentence, used }
}

/** The player's own seat (Forge's `me`), never found by name. */
function ownPlayer(state: GameState): Player | null {
  return state.players.find((player) => player.me) ?? null
}
