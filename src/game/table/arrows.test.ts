// @vitest-environment node
/*
 * The arrows over the table (prompt 43, arrows.ts): which arrows Forge's state
 * asks for - real recorded scenes (src/test/table-scenes.ts) and the one moment
 * rebuilt from Forge's next messages (src/test/built-scenes.ts, a planeswalker
 * attacked) - and where they go: laid out on the boxes of a table built for the
 * test from those scenes (the cards in their rows, the medallions, the
 * chronicle), every head beside its end, never on a card, inside the board.
 */
import { describe, expect, it } from "vitest"
import type { GameState } from "@openmana/engine-protocol"
import { builtTableScene } from "@/test/built-scenes"
import { tableScene } from "@/test/table-scenes"
import { tableView } from "../table-model"
import { arrowRelations, boundsOf, endKey, HEAD, inside, layoutArrows, linePath, overlapArea, TIP_GAP, type ArrowGeometry, type ArrowObstacles, type ArrowRelation, type MeasuredRelation, type Rect } from "./arrows"

const rect = (left: number, top: number, width: number, height: number): Rect => ({ left, top, right: left + width, bottom: top + height })

/**
 * A table for the test, from a state: the AI's battlefield (creatures next to
 * the middle), the chronicle bar, yours, the two medallions - each card 60 ×
 * 84 px, 8 px apart (the rows' gap), like a phone upright (412 × 915).
 */
function tableOf(state: GameState, size = { width: 412, height: 915 }) {
  const view = tableView(state)
  const boxes = new Map<string, Rect>()
  const row = (ids: readonly number[], top: number) => ids.forEach((id, index) => boxes.set(`card:${id}`, rect(8 + index * 68, top, 60, 84)))
  const ids = (side: NonNullable<typeof view.me>, which: "creatures" | "others") => side.battlefield[which].flatMap((entry) => (entry.kind === "card" ? [entry.card.id] : []))
  const ai = view.opponents[0]!
  row(ids(ai, "others"), 90)
  row(ids(ai, "creatures"), 200)
  row(ids(view.me!, "creatures"), 480)
  row(ids(view.me!, "others"), 590)
  view.stack.forEach((entry, index) => boxes.set(`stack:${entry.id}`, rect(8 + index * 150, 330, 140, 56)))
  boxes.set(`player:${ai.player.id}`, rect(184, 30, 44, 44))
  boxes.set(`player:${view.me!.player.id}`, rect(184, 700, 44, 44))
  const pictures = [...boxes].filter(([key]) => key.startsWith("card:")).map(([, box]) => box)
  const obstacles: ArrowObstacles = { bounds: rect(0, 0, size.width, size.height), pictures, chips: [] }
  return { boxes, obstacles }
}

function measure(relations: readonly ArrowRelation[], boxes: ReadonlyMap<string, Rect>): MeasuredRelation[] {
  return relations.map((relation) => ({ relation, from: boxes.get(endKey(relation.from)) ?? null, to: boxes.get(endKey(relation.to)) ?? null }))
}

/** The side's outward normal. */
const NORMALS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } } as const

/** What every arrow keeps to: its head beside its end and on no card, inside the board, arriving straight at its end. */
function expectWellPlaced(arrows: readonly ArrowGeometry[], boxes: ReadonlyMap<string, Rect>, obstacles: ArrowObstacles) {
  for (const arrow of arrows) {
    const end = boxes.get(endKey(arrow.relation.to))!
    const start = boxes.get(endKey(arrow.relation.from))!
    const head = boundsOf(arrow.head)
    // The tip lies TIP_GAP off the end's side, never inside its box (never on its picture).
    expect(inside(arrow.tip, end)).toBe(false)
    const off = { left: end.left - arrow.tip.x, right: arrow.tip.x - end.right, top: end.top - arrow.tip.y, bottom: arrow.tip.y - end.bottom }[arrow.side]
    expect(off).toBeCloseTo(TIP_GAP, 5)
    // No head covers a card.
    for (const picture of obstacles.pictures) expect(overlapArea(head, picture)).toBe(0)
    // Inside the board.
    expect(head.left).toBeGreaterThanOrEqual(obstacles.bounds.left)
    expect(head.top).toBeGreaterThanOrEqual(obstacles.bounds.top)
    expect(head.right).toBeLessThanOrEqual(obstacles.bounds.right)
    expect(head.bottom).toBeLessThanOrEqual(obstacles.bounds.bottom)
    // The curve arrives at a right angle to the side (its last control point straight out of it), the head's size by its strength.
    const normal = NORMALS[arrow.side]
    const out = { x: arrow.c2.x - arrow.lineEnd.x, y: arrow.c2.y - arrow.lineEnd.y }
    expect(Math.abs(out.x * normal.y - out.y * normal.x)).toBeLessThan(1e-6)
    expect(out.x * normal.x + out.y * normal.y).toBeGreaterThan(0)
    const size = arrow.relation.strong ? HEAD.strong : HEAD.muted
    expect(Math.hypot(arrow.lineEnd.x - arrow.tip.x, arrow.lineEnd.y - arrow.tip.y)).toBeCloseTo(size.length * 0.6, 5)
    // The line leaves its start's box from its edge (2 px out).
    const grown = { left: start.left - 2.01, top: start.top - 2.01, right: start.right + 2.01, bottom: start.bottom + 2.01 }
    expect(inside(arrow.start, grown)).toBe(true)
    expect(inside(arrow.start, start)).toBe(false)
    expect(linePath(arrow)).toMatch(/^M[\d.-]+ [\d.-]+C/)
  }
}

describe("arrowRelations: Forge's facts, nothing derived", () => {
  it("a spell on the stack with a card as its target: one strong target arrow from its chronicle entry (stack)", () => {
    expect(arrowRelations(tableScene("stack").state)).toEqual([{ key: "target:stack:14>card:55", kind: "target", from: { kind: "stack", id: 14 }, to: { kind: "card", id: 55 }, strong: true }])
  })

  it("a player as the target, the entry below without targets (respond-own)", () => {
    expect(arrowRelations(tableScene("respond-own").state).map((relation) => [relation.key, relation.strong])).toEqual([["target:stack:15>player:1", true]])
  })

  it("the targets of the lower entries are muted, the top entry's strong (built: a target added to the lower entry of respond-own)", () => {
    const state = structuredClone(tableScene("respond-own").state)
    state.stack[1]!.targets = [{ kind: "card", id: 29 }]
    expect(arrowRelations(state).map((relation) => [relation.key, relation.strong])).toEqual([
      ["target:stack:15>player:1", true],
      ["target:stack:13>card:29", false],
    ])
  })

  it("combat with blockers: an attack arrow per attacker to whom it attacks, a block arrow per blocker to its attacker (blockers)", () => {
    expect(arrowRelations(tableScene("blockers").state).map((relation) => relation.key)).toEqual([
      "attack:card:16>player:1",
      "attack:card:18>player:1",
      "attack:card:3>player:1",
      "attack:card:29>player:1",
      "block:card:103>card:18",
      "block:card:115>card:18",
      "block:card:94>card:29",
    ])
  })

  it("two blockers on one attacker while blockers are being declared (Forge's planned blockers, block-multiple)", () => {
    expect(arrowRelations(tableScene("block-multiple").state).map((relation) => relation.key)).toEqual(["attack:card:101>player:0", "block:card:11>card:101", "block:card:2>card:101"])
  })

  it("while attackers are declared: the declared attacker from Forge's combat (attack-declared); the declaration's current defender alone is no arrow (attack, attack-planeswalker)", () => {
    expect(arrowRelations(tableScene("attack-declared").state).map((relation) => relation.key)).toEqual(["attack:card:14>player:1"])
    expect(arrowRelations(tableScene("attack").state)).toEqual([])
    expect(arrowRelations(tableScene("attack-planeswalker").state)).toEqual([])
  })

  it("a planeswalker attacked (Forge's next state after attack-planeswalker, built from its messages): the arrow ends at the card", () => {
    expect(arrowRelations(builtTableScene("attack-planeswalker-declared").state)).toEqual([{ key: "attack:card:17>card:68", kind: "attack", from: { kind: "card", id: 17 }, to: { kind: "card", id: 68 }, strong: true }])
  })

  it("a target in a graveyard points at that pile (built: the stack's target moved to its owner's graveyard)", () => {
    const state = structuredClone(tableScene("stack").state)
    const owner = state.players.find((player) => player.zones.battlefield.some((card) => !("hidden" in card) && card.id === 55))!
    const card = owner.zones.battlefield.find((candidate) => !("hidden" in candidate) && candidate.id === 55)!
    owner.zones.battlefield = owner.zones.battlefield.filter((candidate) => candidate !== card)
    owner.zones.graveyard = [...owner.zones.graveyard, card]
    expect(arrowRelations(state)[0]!.pile).toEqual({ seat: owner.me ? "me" : "opponent", zone: "graveyard" })
  })

  it("no stack, no combat, no arrows (main-phase, opening)", () => {
    expect(arrowRelations(tableScene("main-phase").state)).toEqual([])
    expect(arrowRelations(tableScene("opening").state)).toEqual([])
  })
})

describe("layoutArrows: beside the end, never on a card", () => {
  it("a stack with a target (stack): from the chronicle entry to beside the target card", () => {
    const state = tableScene("stack").state
    const { boxes, obstacles } = tableOf(state)
    const arrows = layoutArrows(measure(arrowRelations(state), boxes), obstacles)
    expect(arrows).toHaveLength(1)
    expectWellPlaced(arrows, boxes, obstacles)
  })

  it("a player as the target (respond-own): the arrow ends at the medallion", () => {
    const state = tableScene("respond-own").state
    const { boxes, obstacles } = tableOf(state)
    const [arrow] = layoutArrows(measure(arrowRelations(state), boxes), obstacles)
    expectWellPlaced([arrow!], boxes, obstacles)
    // The AI's medallion lies above the chronicle: the head comes from below.
    expect(arrow!.side).toBe("bottom")
  })

  it("combat with blockers (blockers): every attack and block arrow placed, the attackers' arrows to one player bend differently and their heads do not lie on each other", () => {
    const state = tableScene("blockers").state
    const { boxes, obstacles } = tableOf(state)
    const arrows = layoutArrows(measure(arrowRelations(state), boxes), obstacles)
    expect(arrows.map((arrow) => arrow.relation.key)).toEqual(arrowRelations(state).map((relation) => relation.key))
    expectWellPlaced(arrows, boxes, obstacles)
    const attacks = arrows.filter((arrow) => arrow.relation.kind === "attack")
    const heads = attacks.map((arrow) => boundsOf(arrow.head))
    for (let i = 0; i < heads.length; i++) for (let j = i + 1; j < heads.length; j++) expect(overlapArea(heads[i]!, heads[j]!)).toBeLessThan(20)
    expect(new Set(attacks.map((arrow) => linePath(arrow))).size).toBe(attacks.length)
  })

  it("a planeswalker attacked (built from Forge's next state): the attack arrow ends beside the planeswalker's card", () => {
    const state = builtTableScene("attack-planeswalker-declared").state
    const { boxes, obstacles } = tableOf(state)
    const arrows = layoutArrows(measure(arrowRelations(state), boxes), obstacles)
    expect(arrows).toHaveLength(1)
    expectWellPlaced(arrows, boxes, obstacles)
    // From your battlefield up to the AI's: the head below the planeswalker.
    expect(arrows[0]!.side).toBe("bottom")
  })

  it("on a desktop the same scenes keep to the same rules", () => {
    for (const state of [tableScene("blockers").state, tableScene("stack").state, tableScene("block-multiple").state, builtTableScene("attack-planeswalker-declared").state]) {
      const { boxes, obstacles } = tableOf(state, { width: 1440, height: 900 })
      expectWellPlaced(layoutArrows(measure(arrowRelations(state), boxes), obstacles), boxes, obstacles)
    }
  })

  it("an end or a start out of sight (a card scrolled out of its row, an entry out of the chronicle bar): no arrow", () => {
    const state = tableScene("blockers").state
    const { boxes, obstacles } = tableOf(state)
    const measured = measure(arrowRelations(state), boxes).map((entry) => (entry.relation.key === "block:card:94>card:29" ? { ...entry, to: null } : entry.relation.key === "attack:card:16>player:1" ? { ...entry, from: null } : entry))
    expect(layoutArrows(measured, obstacles).map((arrow) => arrow.relation.key)).toEqual(["attack:card:18>player:1", "attack:card:3>player:1", "attack:card:29>player:1", "block:card:103>card:18", "block:card:115>card:18"])
  })

  it("a card in a tight row: the head goes above or below it rather than onto a neighbour", () => {
    const target = rect(108, 400, 60, 84)
    const pictures = [rect(40, 400, 60, 84), target, rect(176, 400, 60, 84)]
    const relation: ArrowRelation = { key: "t", kind: "target", from: { kind: "stack", id: 1 }, to: { kind: "card", id: 2 }, strong: true }
    const obstacles: ArrowObstacles = { bounds: rect(0, 0, 412, 915), pictures, chips: [] }
    const [arrow] = layoutArrows([{ relation, from: rect(250, 100, 140, 56), to: target }], obstacles)
    expect(["top", "bottom"]).toContain(arrow!.side)
    for (const picture of pictures) expect(overlapArea(boundsOf(arrow!.head), picture)).toBe(0)
  })

  it("an end at the board's edge: the head stays inside the board", () => {
    const end = rect(352, 300, 60, 84)
    const relation: ArrowRelation = { key: "t", kind: "attack", from: { kind: "card", id: 1 }, to: { kind: "card", id: 2 }, strong: true }
    const obstacles: ArrowObstacles = { bounds: rect(0, 0, 412, 915), pictures: [end], chips: [] }
    const [arrow] = layoutArrows([{ relation, from: rect(360, 600, 52, 70), to: end }], obstacles)
    const head = boundsOf(arrow!.head)
    expect(head.right).toBeLessThanOrEqual(412)
    expect(arrow!.side).toBe("bottom")
  })

  it("chips are avoided when another place is as good", () => {
    const end = rect(100, 400, 60, 84)
    const chip = rect(100, 386, 60, 14)
    const relation: ArrowRelation = { key: "t", kind: "target", from: { kind: "stack", id: 1 }, to: { kind: "card", id: 2 }, strong: true }
    const [arrow] = layoutArrows([{ relation, from: rect(80, 100, 100, 56), to: end }], { bounds: rect(0, 0, 412, 915), pictures: [end], chips: [chip] })
    expect(overlapArea(boundsOf(arrow!.head), chip)).toBe(0)
  })
})
