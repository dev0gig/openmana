/* The zone view's order and groups on real recorded zones plus labelled built boundaries. */
import type { SelectQuestion, VisibleCard } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { tableScene } from "@/test/table-scenes"
import { browseIds } from "./card-view-model"
import { isVisible } from "./table-model"
import { zoneBrowseIds, zoneContents } from "./zone-model"

const scene = tableScene("main-phase")
const me = scene.state.players.find((p) => p.me)!
const graveyard = { kind: "zone", player: me.id, zone: "graveyard" } as const

function select(cards: readonly number[]): SelectQuestion {
  return { type: "question", kind: "select", id: 77, blocking: false, text: "Wähle eine Karte", min: 1, max: 1, cards: [...cards], items: cards.map((card, index) => ({ nr: index + 1, text: null, card })) }
}

/** The recorded graveyard with copies of its newest card (built: new ids, every other value Forge's). */
function withCopies(ids: readonly number[]) {
  const state = structuredClone(scene.state)
  const zone = state.players.find((p) => p.me)!.zones.graveyard
  const newest = zone.at(-1) as VisibleCard
  zone.push(...ids.map((id) => ({ ...newest, id })))
  return state
}

describe("zone view contents", () => {
  it("shows a real graveyard newest first and marks the newest card", () => {
    const contents = zoneContents(scene.state, graveyard, [])
    const forge = me.zones.graveyard.filter(isVisible).map((c) => c.id)
    expect(contents.order).toBe("newest-first")
    expect(contents.entries.map((e) => e.card.id)).toEqual([...forge].reverse())
    expect(contents.entries.filter((e) => e.latest).map((e) => e.card.id)).toEqual([forge.at(-1)])
    expect(zoneBrowseIds(scene.state, graveyard, [])).toEqual([...forge].reverse())
    expect(browseIds(scene.state, graveyard)).toEqual([...forge].reverse())
  })

  it("keeps the command zone and the stack in Forge's order without a newest mark", () => {
    const command = tableScene("command-effects")
    const own = command.state.players.find((p) => p.me)!
    const contents = zoneContents(command.state, { kind: "zone", player: own.id, zone: "command" }, [])
    expect(contents.order).toBe("forge")
    expect(contents.entries.map((e) => e.card.id)).toEqual(own.zones.command.filter(isVisible).map((c) => c.id))
    expect(contents.entries.some((e) => e.latest)).toBe(false)
    const stack = tableScene("stack")
    const onStack = zoneContents(stack.state, { kind: "stack" }, [])
    expect(onStack.total).toBe(stack.state.stack.length)
    expect(onStack.entries.some((e) => e.latest)).toBe(false)
  })

  it("groups identical cards like the table's piles, never a card a question names (built)", () => {
    const state = withCopies([901, 902])
    const original = (me.zones.graveyard.at(-1) as VisibleCard).id
    const grouped = zoneContents(state, graveyard, [])
    expect(grouped.entries[0]!.ids).toEqual([902, 901, original])
    expect(grouped.entries[0]!.latest).toBe(true)
    expect(grouped.entries).toHaveLength(me.zones.graveyard.length)
    // A copy Forge's question names stays alone.
    const named = zoneContents(state, graveyard, [select([901])])
    expect(named.entries.find((e) => e.ids.includes(901))!.ids).toEqual([901])
    expect(named.entries).toHaveLength(me.zones.graveyard.length + 1)
    // A different value of Forge's (here: playable) keeps a copy apart.
    const playable = structuredClone(state)
    const copy = playable.players.find((p) => p.me)!.zones.graveyard.find((c) => isVisible(c) && c.id === 901) as VisibleCard & { playable?: boolean }
    copy.playable = true
    expect(zoneContents(playable, graveyard, []).entries.find((e) => e.ids.includes(901))!.ids).toEqual([901])
  })

  it("counts hidden cards and gives them no tile; a hidden newest card means no newest mark (built)", () => {
    const state = structuredClone(scene.state)
    state.players.find((p) => p.me)!.zones.graveyard.push({ hidden: true })
    const contents = zoneContents(state, graveyard, [])
    expect(contents.hidden).toBe(1)
    expect(contents.total).toBe(me.zones.graveyard.length + 1)
    expect(contents.entries).toHaveLength(me.zones.graveyard.length)
    expect(contents.entries.some((e) => e.latest)).toBe(false)
  })

  it("browses the hand in Forge's order, never grouped", () => {
    const hand = { kind: "zone", player: me.id, zone: "hand" } as const
    expect(browseIds(scene.state, hand)).toEqual(me.zones.hand.filter(isVisible).map((c) => c.id))
  })
})
