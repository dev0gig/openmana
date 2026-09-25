// @vitest-environment node
/*
 * The start button: enabled whenever the decks allow a game and the engine
 * can run here - whatever the engine is doing - and its note always says
 * what happens next; a running game turns it into the way back to that game.
 */
import { describe, expect, it } from "vitest"
import { resolveSelection, type AiDeckChoice } from "@/decks/deck-selection"
import type { EngineSnapshot, MatchSnapshot } from "@/engine/engine-session"
import { SUPPORTED, testSetup } from "@/test/game-fixtures"
import { deck } from "@/test/storage-fixtures"
import { startState, type StartInput } from "./game-start"

const red = deck({ name: "Rot" })
const green = deck({ name: "Grün" })
const selection = resolveSelection({ value: red.id, stored: true, invalid: false }, { value: { kind: "random" } as AiDeckChoice, stored: false, invalid: false }, { records: [red, green], invalid: [] })
const READY_INPUT: StartInput = { data: "ready", noDecks: false, selection }

const idle: EngineSnapshot = { status: "idle", features: SUPPORTED }
const booting: EngineSnapshot = { status: "booting", features: SUPPORTED, startedAt: 0, steps: [] }
const aborted: EngineSnapshot = {
  status: "aborted",
  features: SUPPORTED,
  startedAt: 0,
  steps: [],
  abort: { type: "engine.abort", reason: "worker-error", origin: "client", message: "died" },
}

describe("startState", () => {
  it("starts from any engine state, and says what happens next", () => {
    expect(startState({ ...READY_INPUT, engine: idle, match: null })).toEqual({ enabled: true, action: "start", note: "Forge startet dafür (einige Sekunden)." })
    expect(startState({ ...READY_INPUT, engine: booting, match: null })).toEqual({
      enabled: true,
      action: "start",
      note: "Forge lädt noch – die Partie beginnt, sobald Forge bereit ist.",
    })
    expect(startState({ ...READY_INPUT, engine: aborted, match: null })).toMatchObject({ enabled: true, note: "Forge wird dafür neu gestartet (einige Sekunden)." })
  })

  it("leads back to a game on its way or running", () => {
    for (const status of ["queued", "starting", "playing"] as const) {
      const match = { status, setup: testSetup(), requestedAt: 0 } as unknown as MatchSnapshot
      expect(startState({ ...READY_INPUT, engine: booting, match })).toEqual({ enabled: true, action: "resume", note: "Eine Partie läuft – sie wartet auf dich." })
    }
  })

  it("a finished, refused or aborted game does not hold the next one back", () => {
    const refused = { status: "refused", setup: testSetup(), requestedAt: 0, error: { type: "engine.error", code: "deck-rejected", message: "x" } } as MatchSnapshot
    expect(startState({ ...READY_INPUT, engine: idle, match: refused })).toMatchObject({ enabled: true, action: "start" })
  })

  it("says why not: the decks first (the order a game is set up in), then no engine in this build or a browser that cannot run it", () => {
    expect(startState({ ...READY_INPUT, engine: { status: "unavailable", reason: "omitted", detail: "" }, match: null })).toEqual({
      enabled: false,
      action: "start",
      note: "Diese App-Version enthält keine Forge-Engine.",
    })
    expect(startState({ ...READY_INPUT, engine: { status: "unsupported", features: SUPPORTED, message: "" }, match: null }).note).toBe(
      "Dieser Browser kann die Forge-Engine nicht ausführen.",
    )
    expect(startState({ data: "loading", noDecks: false, selection: null, engine: idle, match: null })).toMatchObject({ enabled: false, note: "Lese die Decks auf diesem Gerät …" })
    expect(startState({ data: "error", noDecks: false, selection: null, engine: idle, match: null })).toMatchObject({
      enabled: false,
      note: "Die Decks auf diesem Gerät lassen sich gerade nicht lesen.",
    })
    expect(startState({ data: "ready", noDecks: true, selection: null, engine: idle, match: null })).toMatchObject({ enabled: false, note: "Dafür fehlt noch ein Deck." })
    const none = resolveSelection({ value: null, stored: false, invalid: false }, { value: { kind: "random" }, stored: false, invalid: false }, { records: [red], invalid: [] })
    expect(startState({ data: "ready", noDecks: false, selection: none, engine: idle, match: null })).toMatchObject({ enabled: false, note: "Wähle zuerst dein Deck." })
    expect(startState({ data: "ready", noDecks: false, selection: none, engine: { status: "unsupported", features: SUPPORTED, message: "" }, match: null }).note).toBe("Wähle zuerst dein Deck.")
  })
})
