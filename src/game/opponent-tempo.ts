/*
 * How the player follows the Forge AI's turn (prompt 49, series
 * openmana-spielfluss; the engine side is prompt 48,
 * docs/implementation/48-observation-contract.md): three settings of this
 * device - under display.*, so the ORYX cloud never carries them
 * (src/storage/collection.ts) and they travel only in backups - read by the
 * preferences (src/app/preferences.tsx) and saved the moment they change:
 *
 *  - display.opponentTempo: how long each public action of the opponent is
 *    shown before the game goes on by itself - slow, normal (the default:
 *    a turn of the AI can be followed, it never runs through unseen) or fast;
 *  - display.opponentStepwise: wait after every such action until the player
 *    presses "Weiter" (off by default);
 *  - display.autoPass: Forge's own auto-pass of the player's priority
 *    (MatchSettings.autoPass, protocol 10) - noActions (Forge's APINA, the
 *    default since prompt 16), noActionsRespectInterrupts or never. Forge
 *    passes, never the app; a running game gets a change through
 *    settings.change, the next game in its match.start.
 *
 * The tempo only says how long the app shows an action the engine holds for
 * looking (Observation.hold) before it releases it - a release passes no
 * priority and answers nothing (prompt 48). The values were checked for
 * readability on the table in Chrome (docs/implementation/49-gegnerzug-und-spieltempo.md).
 */
import type { AutoPass } from "@openmana/engine-protocol"
import { defineSetting } from "@/storage/settings"

export type OpponentTempo = "slow" | "normal" | "fast"

export const OPPONENT_TEMPOS: readonly OpponentTempo[] = ["slow", "normal", "fast"]

export const OPPONENT_TEMPO = defineSetting<OpponentTempo>("display.opponentTempo", "normal", (value): value is OpponentTempo => OPPONENT_TEMPOS.includes(value as OpponentTempo))

export const OPPONENT_STEPWISE = defineSetting<boolean>("display.opponentStepwise", false, (value): value is boolean => typeof value === "boolean")

export const AUTO_PASS_CHOICES: readonly AutoPass[] = ["noActions", "noActionsRespectInterrupts", "never"]

export const AUTO_PASS = defineSetting<AutoPass>("display.autoPass", "noActions", (value): value is AutoPass => AUTO_PASS_CHOICES.includes(value as AutoPass))

/**
 * How long one step of the opponent's turn stays on the table (ms) before
 * the game goes on by itself: a main action (a land, a spell, an attack, a
 * resolution with its results) or a change of turn. Normal: long enough to
 * read the line and see the card (about 1-2 s per action, the brief's mark);
 * slow for a calm look, fast for players who know the deck.
 */
export const TEMPO_MS: Readonly<Record<OpponentTempo, number>> = {
  slow: 3200,
  normal: 1700,
  fast: 800,
}

/** A step with more to read (several results) stays this much longer per further line, at most MAX_EXTRA_LINES lines. */
export const TEMPO_LINE_MS: Readonly<Record<OpponentTempo, number>> = {
  slow: 700,
  normal: 400,
  fast: 150,
}

const MAX_EXTRA_LINES = 4

/** How long a step with `lines` lines of detail is shown at `tempo` (the first line is part of the step itself). */
export function stepDuration(tempo: OpponentTempo, lines: number): number {
  const extra = Math.min(MAX_EXTRA_LINES, Math.max(0, lines - 1))
  return TEMPO_MS[tempo] + extra * TEMPO_LINE_MS[tempo]
}

export const TEMPO_LABELS: Readonly<Record<OpponentTempo, string>> = {
  slow: "Langsam",
  normal: "Normal",
  fast: "Schnell",
}

export const TEMPO_DESCRIPTIONS: Readonly<Record<OpponentTempo, string>> = {
  slow: "Jede Aktion der Forge-KI bleibt etwa drei Sekunden stehen – Zeit, Karte und Text in Ruhe zu lesen.",
  normal: "Jede Aktion bleibt knapp zwei Sekunden stehen: Du siehst Länder, Zauber, Angriffe und ihre Folgen nacheinander.",
  fast: "Jede Aktion blitzt kurz auf – für Decks, die du kennst. Übersprungen wird trotzdem nichts.",
}

export const STEPWISE_LABEL = "Nach jeder Gegneraktion warten"

export const STEPWISE_DESCRIPTION =
  "Die Partie geht erst weiter, wenn du „Weiter“ tippst. „Weiter“ zeigt nur die nächste Aktion – es spielt, antwortet und passt nichts für dich."

export const AUTO_PASS_LABELS: Readonly<Record<AutoPass, string>> = {
  noActions: "Weitergeben, wenn du nichts tun kannst",
  noActionsRespectInterrupts: "Bei Zauber und Angriff der KI anhalten",
  never: "Immer fragen",
}

export const AUTO_PASS_DESCRIPTIONS: Readonly<Record<AutoPass, string>> = {
  noActions: "Forge gibt deine Priorität von selbst weiter, solange du nichts spielen kannst – der Gegnerzug läuft zügig, du siehst trotzdem jede Aktion.",
  noActionsRespectInterrupts: "Wie oben, aber Forge fragt dich einmal, wenn die Forge-KI einen Zauber wirkt oder dich angreift – auch wenn du nichts tun kannst.",
  never: "Forge fragt dich bei jeder Priorität, auch in Schritten, in denen du nichts tun kannst. Gründlich, aber viele Klicks.",
}

/** A short line for the decision region and the menu: what the game does by itself right now. */
export function autoPassNote(autoPass: AutoPass): string {
  switch (autoPass) {
    case "noActions":
      return "Forge gibt deine Priorität von selbst weiter, solange du nichts tun kannst."
    case "noActionsRespectInterrupts":
      return "Forge gibt von selbst weiter, hält aber bei Zauber und Angriff der Forge-KI an."
    case "never":
      return "Forge fragt dich bei jeder Priorität."
  }
}
