/*
 * Real land plays of the Forge engine (protocol 10) for the tests of the land
 * and refusal hints (prompt 51): src/test/fixtures/land-plays.json, recorded
 * by scripts/record-land-plays.ts from the fixture game `lands` (green lands,
 * Exploration, Rampant Growth against red) - never edited.
 */
import type { GameState, Observation, Question } from "@openmana/engine-protocol"
import fixture from "./fixtures/land-plays.json"

export type LandMomentName = "before-start" | "opponent-turn" | "first-land" | "land-played" | "timing" | "next-turn" | "extra-allowed" | "extra-used" | "land-by-effect"

export interface LandMoment {
  readonly name: LandMomentName
  readonly state: GameState
  readonly questions: readonly Question[]
  /** Forge's state just before (the land put onto the battlefield by an effect). */
  readonly before?: GameState
  /** Forge's observation the state follows (the resolution that moved the land). */
  readonly observation?: Observation
}

const MOMENTS = fixture.moments as unknown as readonly LandMoment[]

/** The engine build the moments come from (its manifest's SHA-256). */
export const LAND_PLAYS_ENGINE: string | null = fixture.engineManifestSha256

export function landMoment(name: LandMomentName): LandMoment {
  const found = MOMENTS.find((each) => each.name === name)
  if (found === undefined) throw new Error(`no recorded land moment ${name}`)
  return found
}
