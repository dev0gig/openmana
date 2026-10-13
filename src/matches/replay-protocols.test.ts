/* Prompt 48: which recorded engine protocols today's replay reads. Protocol 10
 * only added messages, inputs and optional fields, so a protocol-9 recording
 * (the original Forge messages of src/test/fixtures/replay.json, recorded in
 * prompt 47) is still replayed - unchanged; an older one stays exportable only.
 */
import { PROTOCOL_VERSION } from "@openmana/engine-protocol/generated/constants"
import { describe, expect, it } from "vitest"
import fixture from "@/test/fixtures/replay.json"
import type { ReplayDocument } from "@/storage/generated/records"
import { checkReplay, parseReplay, READABLE_PROTOCOLS, replayFrames } from "./replay"

async function recording(): Promise<ReplayDocument> {
  return parseReplay(new Blob([JSON.stringify(fixture.replay)], { type: "application/json" }))
}

function withProtocol(doc: ReplayDocument, protocol: number): ReplayDocument {
  const copy = structuredClone(doc)
  copy.match.engine.protocol = protocol
  for (const entry of copy.log) {
    if (entry.from === "engine" && (entry.message.type === "game.started" || entry.message.type === "engine.ready")) entry.message["protocol"] = protocol
  }
  return copy
}

describe("replay of recordings of earlier protocols", () => {
  it("reads the protocol of today and protocol 9", () => {
    expect(PROTOCOL_VERSION).toBe(10)
    expect([...READABLE_PROTOCOLS].sort()).toEqual([10, 9].sort())
  })

  it("replays a protocol-9 recording unchanged", async () => {
    const doc = await recording()
    expect(doc.match.engine.protocol).toBe(9)
    const before = JSON.stringify(doc)
    const frames = replayFrames({ match: doc.match, log: doc.log })
    expect(frames.length).toBeGreaterThan(50)
    expect(frames.at(-1)?.type).toBe("game.end")
    expect(JSON.stringify(doc)).toBe(before)
  })

  it("keeps an older protocol exportable but does not interpret it", async () => {
    const old = withProtocol(await recording(), 8)
    expect(() => checkReplay(old)).not.toThrow()
    expect(() => replayFrames({ match: old.match, log: old.log })).toThrow(/anderes Engine-Protokoll/)
  })

  it("replays a protocol-10 recording with observations; observations are no frame of their own", async () => {
    const doc = withProtocol(await recording(), PROTOCOL_VERSION)
    const at = doc.log.findIndex((entry) => entry.from === "engine" && entry.message.type === "state")
    const state = doc.log[at]!.message as unknown as { seq: number }
    const observation = { type: "observation", id: 1, hold: false, state: state.seq, actions: [{ n: 1, kind: "turn", player: 0, turn: 1 }] }
    const settings = { type: "settings.applied", seq: null, observation: "off", autoPass: "noActions" }
    const log = [...doc.log.slice(0, at + 1), { ...doc.log[at]!, message: settings }, { ...doc.log[at]!, message: observation }, ...doc.log.slice(at + 1)].map((entry, seq) => ({ ...entry, seq }))
    const extended = { ...doc, log }
    expect(() => checkReplay(extended)).not.toThrow()
    const frames = replayFrames({ match: extended.match, log: extended.log })
    const plain = replayFrames({ match: doc.match, log: doc.log })
    expect(frames).toHaveLength(plain.length + 2)
    const i = frames.findIndex((frame) => frame.type === "observation")
    expect(frames[i]?.state).toBe(frames[i - 2]?.state)
    expect(frames[i - 2]?.type).toBe("state")
  })
})
