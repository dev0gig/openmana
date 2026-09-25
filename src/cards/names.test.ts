// @vitest-environment node
/*
 * Name keys: the same card found whatever the source writes; different
 * cards never folded together.
 */
import { describe, expect, it } from "vitest"
import { nameKey, nameKeys } from "./names"

describe("name keys", () => {
  it.each([
    ["Lightning Bolt", "lightning bolt"],
    ["  Lightning   Bolt ", "lightning bolt"],
    ["Where We're Going . . .", "where we're going..."],
    ["Where We’re Going…", "where we're going..."],
    ["Ratonhnhaké:ton", "ratonhnhake:ton"],
    ["Ratonhnhaké꞉ton", "ratonhnhake:ton"],
    ["Human—Time Lord Meta-Crisis", "human-time lord meta-crisis"],
    ["Æther Vial", "aether vial"],
    ["Aether Vial", "aether vial"],
    ["Grizzlybären", "grizzlybaren"],
    ["Insekten-Scheußlichkeit", "insekten-scheusslichkeit"],
    ["Fire//Ice", "fire // ice"],
    ["Fire  //  Ice", "fire // ice"],
  ])("%s → %s", (name, key) => {
    expect(nameKey(name)).toBe(key)
  })

  it("is idempotent", () => {
    for (const name of ["Ratonhnhaké꞉ton", "Where We're Going . . .", "Æther Vial", "Fire // Ice"]) expect(nameKey(nameKey(name))).toBe(nameKey(name))
  })

  it("keeps different cards apart", () => {
    expect(nameKey("Fire // Ice")).not.toBe(nameKey("Fire"))
    expect(nameKey("Lightning Bolt")).not.toBe(nameKey("Lightning-Bolt"))
    expect(nameKey("Mountain Goat")).not.toBe(nameKey("Mountain"))
  })

  it("collects distinct keys in order, without empty names", () => {
    expect(nameKeys(["Forest", "forest", null, "", "Wald", undefined])).toEqual(["forest", "wald"])
  })
})
