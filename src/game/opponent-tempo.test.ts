/*
 * The opponent's tempo settings (prompt 49): device settings under display.*,
 * checked values, never part of the ORYX cloud's collection.
 */
import { describe, expect, it } from "vitest"
import { isDeviceSetting } from "@/storage/collection"
import { AUTO_PASS, AUTO_PASS_CHOICES, autoPassNote, OPPONENT_STEPWISE, OPPONENT_TEMPO, OPPONENT_TEMPOS, TEMPO_DESCRIPTIONS, TEMPO_LABELS } from "./opponent-tempo"

describe("the opponent's tempo settings", () => {
  it("are settings of this device (display.*), never synced through the ORYX cloud", () => {
    for (const setting of [OPPONENT_TEMPO, OPPONENT_STEPWISE, AUTO_PASS]) expect(isDeviceSetting(setting.key)).toBe(true)
  })

  it("default: Normal, no waiting, Forge's APINA - a turn of the AI can be followed, nothing runs through unseen", () => {
    expect(OPPONENT_TEMPO.fallback).toBe("normal")
    expect(OPPONENT_STEPWISE.fallback).toBe(false)
    expect(AUTO_PASS.fallback).toBe("noActions")
  })

  it("take only their own values", () => {
    for (const tempo of OPPONENT_TEMPOS) expect(OPPONENT_TEMPO.check(tempo)).toBe(true)
    for (const value of ["turbo", "", null, 3]) expect(OPPONENT_TEMPO.check(value)).toBe(false)
    expect(OPPONENT_STEPWISE.check(true)).toBe(true)
    expect(OPPONENT_STEPWISE.check("ja")).toBe(false)
    for (const choice of AUTO_PASS_CHOICES) expect(AUTO_PASS.check(choice)).toBe(true)
    expect(AUTO_PASS.check("always")).toBe(false)
  })

  it("every choice has German words", () => {
    for (const tempo of OPPONENT_TEMPOS) expect(TEMPO_LABELS[tempo].length * TEMPO_DESCRIPTIONS[tempo].length).toBeGreaterThan(0)
    for (const choice of AUTO_PASS_CHOICES) expect(autoPassNote(choice)).toMatch(/^Forge /)
  })
})
