/*
 * Real game scenes for the table's tests (prompt 13): what the real Forge
 * engine showed the player at telling moments of the recorded test games
 * (scripts/record-table-scenes.ts, from engine/scripts/test-engine.sh's
 * transcripts) - the latest full state, the open questions, Forge's prompt
 * line and notices, as the engine session holds them. Unedited Forge output;
 * every state is checked against the protocol by the tests.
 */
import type { GameMessage, GameStarted, GameState, InputRejected, Question } from "@openmana/engine-protocol"
import recorded from "./fixtures/table-scenes.json"

export type TableSceneName =
  | "opening"
  | "main-phase"
  | "stack"
  | "blockers"
  | "defend"
  | "block-start"
  | "block-multiple"
  | "commander-late"
  | "command-effects"
  // Forge's decisions (prompt 15)
  | "play-draw"
  | "target"
  | "target-player"
  | "yes-no"
  | "discard"
  | "choose-mode"
  | "scry"
  | "ability"
  | "damage"
  // Priority, stack and phases (prompt 16)
  | "opponent-turn"
  | "respond"
  | "respond-own"
  // Targets and payment (prompt 17)
  | "target-both"
  | "payment"
  | "payment-pool"
  | "payment-life"
  | "cast-x"
  // Declaring attackers (prompt 18)
  | "attack"
  | "attack-declared"
  | "attack-planeswalker"

export interface TableScene {
  readonly name: TableSceneName
  readonly description: string
  /** The fixture game (engine/fixtures/differential) and the message index of the moment. */
  readonly fixture: string
  readonly message: number
  readonly game: GameStarted
  readonly state: GameState
  readonly questions: readonly Question[]
  readonly prompt: string | null
  readonly notices: readonly (GameMessage | InputRejected)[]
}

export const TABLE_SCENES = (recorded as unknown as { readonly scenes: readonly TableScene[] }).scenes

export function tableScene(name: TableSceneName): TableScene {
  const found = TABLE_SCENES.find((scene) => scene.name === name)
  if (!found) throw new Error(`no recorded table scene "${name}"`)
  return found
}
