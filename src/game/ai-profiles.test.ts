// @vitest-environment node
/*
 * Forge's AI profiles as the app knows them (prompt 12): the verified table
 * (checked against the engine at build time, vite/engine-assets.ts), the
 * choice as a setting, what a choice means, the random draw.
 */
import { describe, expect, it } from "vitest"
import { AI_PROFILE_TABLE, DEFAULT_AI_PROFILE } from "./ai-profile-table"
import { AI_PROFILE, drawAiProfile, resolveAiProfile, sameAiProfileChoice } from "./ai-profiles"

describe("the verified profiles", () => {
  it("are Forge's four, the default first, each with a file hash and German words", () => {
    expect(AI_PROFILE_TABLE.map((profile) => profile.name)).toEqual(["Default", "Cautious", "Reckless", "Experimental"])
    expect(AI_PROFILE_TABLE[0]!.name).toBe(DEFAULT_AI_PROFILE)
    expect(new Set(AI_PROFILE_TABLE.map((profile) => profile.label)).size).toBe(AI_PROFILE_TABLE.length)
    for (const profile of AI_PROFILE_TABLE) {
      expect(profile.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(profile.summary.length).toBeGreaterThan(20)
      expect(profile.traits.length).toBeGreaterThanOrEqual(3)
    }
  })

  it("never claim a difficulty (Bible §7: none was measured)", () => {
    const words = AI_PROFILE_TABLE.flatMap((profile) => [profile.label, profile.summary, ...profile.traits]).join(" ").toLowerCase()
    for (const claim of [/\bleicht/, /\bschwer\b/, /\bschwierig/, /\bstärker\b/, /\bschwächer\b/, /\beinfach\b/, /\banfänger/, /\bprofis?\b/]) expect(words).not.toMatch(claim)
  })
})

describe("the choice", () => {
  it("is Forge's default until the player chooses; only a profile name or random is stored", () => {
    expect(AI_PROFILE.key).toBe("ai.profile")
    expect(AI_PROFILE.fallback).toEqual({ kind: "profile", name: "Default" })
    expect(AI_PROFILE.check({ kind: "profile", name: "Reckless" })).toBe(true)
    expect(AI_PROFILE.check({ kind: "random" })).toBe(true)
    expect(AI_PROFILE.check({ kind: "random", name: "x" })).toBe(false)
    expect(AI_PROFILE.check({ kind: "profile" })).toBe(false)
    expect(AI_PROFILE.check({ kind: "profile", name: "Random (Every Game)" })).toBe(false)
    expect(AI_PROFILE.check("Reckless")).toBe(false)
  })

  it("means a verified profile, a draw from all of them, or one this version does not have", () => {
    expect(resolveAiProfile({ kind: "profile", name: "Cautious" })).toMatchObject({ status: "ok", profile: { name: "Cautious", label: "Vorsichtig" } })
    expect(resolveAiProfile({ kind: "random" })).toEqual({ status: "random", pool: AI_PROFILE_TABLE })
    expect(resolveAiProfile({ kind: "profile", name: "Aggressive" })).toEqual({ status: "missing", name: "Aggressive" })
    expect(sameAiProfileChoice({ kind: "random" }, { kind: "random" })).toBe(true)
    expect(sameAiProfileChoice({ kind: "profile", name: "Default" }, { kind: "profile", name: "Default" })).toBe(true)
    expect(sameAiProfileChoice({ kind: "profile", name: "Default" }, { kind: "random" })).toBe(false)
  })

  it("random draws each profile equally likely", () => {
    expect(drawAiProfile(AI_PROFILE_TABLE, () => 0).name).toBe("Default")
    expect(drawAiProfile(AI_PROFILE_TABLE, () => 0.26).name).toBe("Cautious")
    expect(drawAiProfile(AI_PROFILE_TABLE, () => 0.999999).name).toBe("Experimental")
    expect(() => drawAiProfile([])).toThrow()
  })
})
