/* Browsing in the card view (prompt 50): the place of the card in the list of this state, no wrapping, a card that left. */
import { describe, expect, it } from "vitest"
import { tableScene } from "@/test/table-scenes"
import { browseIds, browsePosition, handBrowse } from "./card-view-model"

describe("browsePosition", () => {
  const ids = [8, 29, 26, 33]
  it("the card's place, the cards before and after it - none past the ends", () => {
    expect(browsePosition(ids, 8, null)).toEqual({ index: 0, total: 4, previous: null, next: 29 })
    expect(browsePosition(ids, 26, null)).toEqual({ index: 2, total: 4, previous: 29, next: 33 })
    expect(browsePosition(ids, 33, 3)).toEqual({ index: 3, total: 4, previous: 26, next: null })
  })
  it("a card that left keeps its former place: before it the card that stood before it, after it the one that moved up", () => {
    expect(browsePosition([8, 29, 33], 26, 2)).toEqual({ index: null, total: 3, previous: 29, next: 33 })
    expect(browsePosition([8, 29, 33], 99, 3)).toEqual({ index: null, total: 3, previous: 33, next: null })
    expect(browsePosition([8, 29, 33], 99, 0)).toEqual({ index: null, total: 3, previous: null, next: 8 })
    expect(browsePosition([8, 29, 33], 99, null)).toEqual({ index: null, total: 3, previous: null, next: 8 })
  })
})

describe("the player's hand as a list", () => {
  it("is the player's own hand of this state, in Forge's order, hidden cards left out", () => {
    const scene = tableScene("respond")
    const source = handBrowse(scene.state)
    expect(source).toEqual({ kind: "zone", player: scene.state.players.find((p) => p.me)!.id, zone: "hand" })
    expect(browseIds(scene.state, source ?? undefined)).toEqual([8, 29, 26, 33])
  })
})
