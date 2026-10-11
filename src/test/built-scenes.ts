/*
 * Moments the recorded scenes (src/test/table-scenes.ts) stop just short of,
 * rebuilt on a recorded scene from Forge's own next messages - for the arrows'
 * unit tests (prompt 43) and the end-to-end test's table harness
 * (`?scene=<name>` of BUILT_TABLE_SCENES). Marked as built wherever they are
 * used as evidence.
 *
 * attack-planeswalker-declared: the recorded scene "attack-planeswalker" is
 * the attackers game (engine/fixtures/differential, fixture "attackers") at
 * the moment Forge offers the AI's planeswalker Garruk (68) as the defender.
 * Forge's next state of that game (the transcript of the engine build
 * publish-35d, messages 585 → 589; its state 585 equals the recorded one but
 * for `seq`) declares the player's Giant Spider (17) as an attacker of the
 * planeswalker: the card attacking and its action "Karte aus dem Kampf
 * entfernen", combat `{attacker: 17, defender: 68, defenderKind: "card"}`;
 * message 590 is Forge's question after it (purpose attackDeclared,
 * "OK" / "Zurückrufen"). Exactly these changes are applied here - nothing
 * else is invented.
 */
import type { Question } from "@openmana/engine-protocol"
import { tableScene, type TableScene } from "./table-scenes"

export const BUILT_TABLE_SCENES = ["attack-planeswalker-declared"] as const

export type BuiltTableSceneName = (typeof BUILT_TABLE_SCENES)[number]

export function isBuiltTableScene(name: string): name is BuiltTableSceneName {
  return (BUILT_TABLE_SCENES as readonly string[]).includes(name)
}

/** Forge's question after the declaration (transcript message 590). */
const DECLARED: Question = {
  type: "question",
  kind: "buttons",
  text: "Wähle angreifende Kreaturen oder Garruk Wildsprecher (68) wähle den anzugreifenden Spieler/Planeswalker",
  purpose: "attackDeclared",
  buttons: [
    { nr: 1, label: "OK", enabled: true, meaning: "declare" },
    { nr: 2, label: "Zurückrufen", enabled: true, meaning: "callBack" },
  ],
  id: 66,
  blocking: false,
}

export function builtTableScene(name: BuiltTableSceneName): TableScene {
  switch (name) {
    case "attack-planeswalker-declared": {
      const recorded = tableScene("attack-planeswalker")
      const state = structuredClone(recorded.state)
      const me = state.players.find((player) => player.me)
      const spider = me?.zones.battlefield.find((card) => !("hidden" in card) && card.id === 17)
      if (spider === undefined || "hidden" in spider) throw new Error("the recorded scene attack-planeswalker has no Giant Spider (17)")
      spider.attacking = true
      spider.action = "Karte aus dem Kampf entfernen"
      state.combat = [{ attacker: 17, defender: 68, defenderKind: "card", blockers: [] }]
      state.seq += 1
      return { ...recorded, name: "attack-planeswalker", description: `${recorded.description} Built: Forge's next state, Giant Spider (17) attacks Garruk (68).`, state, questions: [DECLARED] }
    }
  }
}
