// @vitest-environment node
/*
 * The German words of a game, keyed by the protocol's structured values: a
 * label for every step, result and refusal the protocol knows, the result
 * from game.end's result (never from names), the reason from Forge's win
 * condition and the concession.
 */
import { BUTTONS_PURPOSES, ENGINE_ERROR_CODES, GAME_RESULTS, PHASES, QUESTION_KINDS, REJECT_REASONS } from "@openmana/engine-protocol"
import type { GameEnd, Question } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import {
  aiProfileLabel,
  endReason,
  formatDuration,
  PHASE_LABELS,
  phaseLabel,
  questionChoices,
  questionLabel,
  REFUSAL_ADVICE,
  REFUSAL_TITLES,
  REJECT_REASON_LABELS,
  RESULT_WORDS,
  resultWord,
  turnsLabel,
} from "./game-labels"

const end = (overrides: Partial<GameEnd>): GameEnd => ({ type: "game.end", winner: null, reason: null, turns: 5, result: null, players: [], conceded: false, ...overrides })

describe("game labels", () => {
  it("name every step, result, refusal and rejection the protocol knows", () => {
    expect(Object.keys(PHASE_LABELS).sort()).toEqual([...PHASES].sort())
    expect(Object.keys(RESULT_WORDS).sort()).toEqual([...GAME_RESULTS].sort())
    expect(Object.keys(REFUSAL_TITLES).sort()).toEqual([...ENGINE_ERROR_CODES].sort())
    expect(Object.keys(REFUSAL_ADVICE).sort()).toEqual([...ENGINE_ERROR_CODES].sort())
    expect(Object.keys(REJECT_REASON_LABELS).sort()).toEqual([...REJECT_REASONS].sort())
    for (const kind of QUESTION_KINDS) expect(questionLabel({ kind } as Question)).toBeTruthy()
    for (const purpose of BUTTONS_PURPOSES) expect(questionLabel({ kind: "buttons", purpose } as Question)).toBeTruthy()
  })

  it("the step, before the first turn too", () => {
    expect(phaseLabel(null)).toBe("Vor dem ersten Zug")
    expect(phaseLabel("MAIN1")).toBe("Erste Hauptphase")
    expect(phaseLabel("COMBAT_DECLARE_BLOCKERS")).toBe("Blocker deklarieren")
  })

  it("the result in one word; no guess when Forge does not say", () => {
    expect(resultWord("win")).toBe("Gewonnen")
    expect(resultWord("loss")).toBe("Verloren")
    expect(resultWord("draw")).toBe("Unentschieden")
    expect(resultWord(null)).toBe("Partie beendet")
  })

  it("why the game ended", () => {
    expect(endReason(end({ result: "loss", reason: "AllOpponentsLost", conceded: true }))).toBe("Du hast aufgegeben.")
    expect(endReason(end({ result: "win", reason: "AllOpponentsLost" }))).toBe("Die Forge-KI hat verloren.")
    expect(endReason(end({ result: "loss", reason: "AllOpponentsLost" }))).toBe("Du hast verloren.")
    expect(endReason(end({ result: "draw", reason: "Draw" }))).toBe("Niemand hat gewonnen.")
    expect(endReason(end({ result: "win", reason: "WinsGameSpellEffect" }))).toBe("Eine Karte hat die Partie entschieden.")
    expect(endReason(end({ reason: "SomethingNew" }))).toBe("Forge hat die Partie beendet.")
  })

  it("the mulligan and Forge's offered answers", () => {
    const mulligan: Question = {
      type: "question",
      kind: "buttons",
      id: 1,
      blocking: false,
      text: "",
      purpose: "mulligan",
      buttons: [
        { nr: 1, label: "Behalten", enabled: true },
        { nr: 2, label: "Mulligan", enabled: true },
      ],
    }
    expect(questionLabel(mulligan)).toBe("Mulligan")
    expect(questionChoices(mulligan)).toEqual(["Behalten", "Mulligan"])
    const oneDisabled: Question = { ...mulligan, buttons: [{ nr: 1, label: "OK", enabled: true }, { nr: 2, label: null, enabled: false }] }
    expect(questionChoices(oneDisabled)).toEqual(["OK"])
    expect(questionChoices({ type: "question", kind: "confirm", id: 2, blocking: true, text: "?", suggested: true })).toEqual(["Ja", "Nein"])
    // The coin toss: Forge's buttons without a purpose (the player won it and plays or draws).
    const coinToss: Question = {
      type: "question",
      kind: "buttons",
      id: 3,
      blocking: false,
      text: "",
      buttons: [
        { nr: 1, label: "Spielen", enabled: true },
        { nr: 2, label: "Ziehen", enabled: true },
      ],
    }
    expect(questionLabel(coinToss)).toBe("Entscheidung")
    expect(questionChoices(coinToss)).toEqual(["Spielen", "Ziehen"])
  })

  it("turns, durations and the AI profile", () => {
    expect(turnsLabel(0)).toBe("0 Züge")
    expect(turnsLabel(1)).toBe("1 Zug")
    expect(turnsLabel(12)).toBe("12 Züge")
    expect(formatDuration(900)).toBe("1 s")
    expect(formatDuration(42_000)).toBe("42 s")
    expect(formatDuration(180_000)).toBe("3 min")
    expect(formatDuration(192_400)).toBe("3 min 12 s")
    expect(aiProfileLabel("Default")).toBe("Standard")
    expect(aiProfileLabel("Reckless")).toBe("Waghalsig")
    expect(aiProfileLabel("Cautious")).toBe("Vorsichtig")
    expect(aiProfileLabel("Experimental")).toBe("Experimentell")
    // A profile the app has not verified keeps Forge's name.
    expect(aiProfileLabel("Aggressive")).toBe("Aggressive")
  })
})
