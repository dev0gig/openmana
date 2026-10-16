/*
 * The match report (prompt 62): a pure derivation of a recording, checked on
 * the recorded protocol-9 game of src/test/fixtures/replay.json and on five
 * whole recorded protocol-10 games (src/test/report-games.ts - the fixture
 * games of the engine's differential tests, whose moments the table's tests
 * use too). Moments built from them are marked as built.
 */
import { describe, expect, it } from "vitest"
import type { Card, EngineMessage, GameState, Observation, VisibleCard } from "@openmana/engine-protocol"
import fixture from "@/test/fixtures/replay.json"
import { reportGame, reportGames } from "@/test/report-games"
import type { MatchLogEntry, ReplayDocument } from "@/storage/generated/records"
import { StorageError } from "@/storage/errors"
import { replayFrames } from "./replay"
import { buildMatchReport, exportMatchReport } from "./report"
import { HEADINGS, REPORT_UNREADABLE, reportFileName } from "./report-words"

const recorded = () => structuredClone(fixture.replay) as unknown as ReplayDocument

function report(doc: ReplayDocument): string {
  return buildMatchReport({ match: doc.match, log: doc.log })
}

const engineMessages = (doc: ReplayDocument) =>
  doc.log.filter((entry) => entry.from === "engine").map((entry) => ({ seq: entry.seq, message: entry.message as unknown as EngineMessage }))

function isVisible(card: Card | null | undefined): card is VisibleCard {
  return card !== null && card !== undefined && !("hidden" in card)
}

/** Every card object the recording shows, wherever it stands (a VisibleCard has an id and Forge's tapped flag). */
function visibleCards(doc: ReplayDocument): Map<number, VisibleCard> {
  const cards = new Map<number, VisibleCard>()
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value !== null && typeof value === "object") {
      const record = value as Record<string, unknown>
      if (typeof record["id"] === "number" && typeof record["tapped"] === "boolean" && !cards.has(record["id"])) cards.set(record["id"], record as unknown as VisibleCard)
      Object.values(record).forEach(walk)
    }
  }
  for (const { message } of engineMessages(doc)) walk(message)
  return cards
}

/** "Lightning Bolt (#4" - how the report names a card it shows. */
function labelOf(cards: Map<number, VisibleCard>, id: number): string {
  const card = cards.get(id)
  return `${card?.key ?? card?.name} (#${id}`
}

/** The decision blocks: the refs of their first line and their four lines. */
function decisions(text: string): { readonly label: string; readonly block: string; readonly at: number }[] {
  const lines = text.split("\n")
  const blocks: { label: string; block: string; at: number }[] = []
  lines.forEach((line, at) => {
    const head = /^- \[[^\]]+\] \*\*(E\d+)\*\* · /.exec(line)
    if (head !== null) blocks.push({ label: head[1]!, block: lines.slice(at, at + 4).join("\n"), at })
  })
  return blocks
}

const all = () => [{ name: "replay.json (protocol 9)", replay: recorded() }, ...reportGames()]

describe("the match report", () => {
  it("has the binding outline, in order, for every recording", () => {
    for (const game of all()) {
      const text = report(game.replay)
      const order = [HEADINGS.title, HEADINGS.foreword, HEADINGS.head, HEADINGS.deck, HEADINGS.start, HEADINGS.turns, HEADINGS.end, HEADINGS.cards, HEADINGS.aiDeck, HEADINGS.origin]
      const at = order.map((heading) => text.split("\n").indexOf(heading))
      expect(at.every((index) => index >= 0), game.name).toBe(true)
      expect([...at].sort((a, b) => a - b), game.name).toEqual(at)
      // Every turn: its situation, course, (the player's turns) unused possibilities and its end - in that order.
      const turns = text.split("\n### Zug ").slice(1).map((part) => part.split("\n## ")[0]!)
      expect(turns.length, game.name).toBeGreaterThan(1)
      for (const turn of turns) {
        const parts = [HEADINGS.situation, HEADINGS.course, ...(/Zug des Spielers\)/.test(turn.split("\n")[0]!) ? [HEADINGS.unused] : []), HEADINGS.close]
        const found = parts.map((heading) => turn.indexOf(`\n${heading}\n`))
        expect(found.every((index) => index > 0), `${game.name} Zug ${turn.slice(0, 40)}`).toBe(true)
        expect([...found].sort((a, b) => a - b)).toEqual(found)
        if (!/Zug des Spielers\)/.test(turn.split("\n")[0]!)) expect(turn).not.toContain(HEADINGS.unused)
      }
    }
  })

  it("is plain Markdown: headings, lists, paragraphs, one table; balanced code spans", () => {
    for (const game of all()) {
      for (const line of report(game.replay).split("\n")) {
        expect(line === "" || /^(#{1,4} |- |  - |\| |[A-ZÄÖÜ*])/.test(line), line).toBe(true)
        expect((line.match(/`/g) ?? []).length % 2, line).toBe(0)
      }
    }
  })

  it("is deterministic and leaves the recording unchanged", () => {
    for (const game of all()) {
      const before = JSON.stringify(game.replay)
      const first = report(game.replay)
      expect(report(structuredClone(game.replay))).toBe(first)
      expect(JSON.stringify(game.replay)).toBe(before)
    }
  })

  it("matches the checked-in report of the recorded fixture game", async () => {
    await expect(report(recorded())).toMatchFileSnapshot("__snapshots__/report-fixture.md")
  })

  it("names the file after the recording and saves it as Markdown", async () => {
    const doc = recorded()
    const file = exportMatchReport({ match: doc.match, log: doc.log })
    expect(file.name).toBe(`openmana-partiebericht-${doc.match.id}.md`)
    expect(file.name).toBe(reportFileName(doc.match.id))
    expect(file.blob.type).toBe("text/markdown;charset=utf-8")
    expect(await file.blob.text()).toBe(report(doc))
  })

  it("refuses a recording of a protocol the replay does not read, with the replay's words", () => {
    const doc = recorded()
    doc.match.engine.protocol = 8
    for (const entry of doc.log) if (entry.from === "engine" && (entry.message.type === "game.started" || entry.message.type === "engine.ready")) entry.message["protocol"] = 8
    expect(() => report(doc)).toThrow(StorageError)
    expect(() => report(doc)).toThrow(REPORT_UNREADABLE)
    // The same words as the replay's (the pages show them beside the disabled button).
    expect(() => replayFrames({ match: doc.match, log: doc.log })).toThrow(REPORT_UNREADABLE)
  })
})

describe("the player's decisions", () => {
  it("every question.answered stands with its question, the whole offer and the answer in words", () => {
    for (const game of all()) {
      const text = report(game.replay)
      const blocks = decisions(text)
      const inputs = new Set(game.replay.log.filter((entry) => entry.from === "player").map((entry) => entry.message["seq"]))
      for (const { seq, message } of engineMessages(game.replay)) {
        if (message.type !== "question.answered") continue
        const ref = new RegExp(`\\bL${seq}\\b`)
        const block = blocks.find((each) => ref.test(each.block))
        expect(block, `${game.name}: answered [L${seq}]`).toBeDefined()
        const [, question, offer, answer] = block!.block.split("\n")
        expect(question).toMatch(new RegExp(`\\(Fragen? (\\d+, )*${message.id}(, \\d+)*\\)`))
        expect(offer).toMatch(/^ {2}- Angebot: (?!nichts$)/)
        if (inputs.has(message.seq)) {
          expect(answer).toMatch(/^ {2}- Antwort: (passt|beendet|nimmt|bestätigt|lässt|wählt|antwortet|bricht|gibt|legt|ordnet|verteilt|schiebt)/)
          expect(answer).toContain("Forge nahm")
        } else expect(answer).toContain(`in der Aufzeichnung nicht enthalten (Eingabe ${message.seq} fehlt`)
      }
    }
  })

  it("a button's answer says the button and Forge's label; a tap names its card and Forge's offer", () => {
    const game = reportGame("human-3-de")
    const text = report(game.replay)
    expect(text).toMatch(/Antwort: wählt Knopf 2 „Mulligan“\. Forge nahm die Antwort an \[L\d+\]\./)
    expect(text).toMatch(/Antwort: tippt Mountain \(#28\) an – Forge bot dafür an: „Spiele ein Land“\./)
    expect(text).toMatch(/Antwort: bestätigt den Angriff \(Knopf 1 „OK“\)/)
    // The test player's deliberate probes: refused inputs stay visible with Forge's reason.
    expect(text).toMatch(/Forge lehnte ab \[L\d+\]: .+ Forge: „question 9999999 is not open“/)
  })

  it("the priority's offer lists the cards Forge marked playable, with Forge's words", () => {
    const game = reportGame("human-3-de")
    const text = report(game.replay)
    expect(text).toContain("spielbar markiert: Mountain (#28, Hand, Forge: „Spiele ein Land“), Mountain (#26, Hand, Forge: „Spiele ein Land“), Mountain (#33, Hand, Forge: „Spiele ein Land“)")
  })

  it("the start hand and the London mulligan: the hands shown, Forge's questions and the answers", () => {
    const text = report(reportGame("human-3-de").replay)
    const start = text.slice(text.indexOf(HEADINGS.start), text.indexOf(HEADINGS.turns))
    expect(start).toContain("Hand des Spielers (7): Bonecrusher Giant (#53)")
    expect(start).toContain("Frage: Mulligan (Frage 1)")
    expect(start).toContain("Frage: Karten unter die Bibliothek legen")
    expect(start).toContain("tippt Mountain (#41) an")
    expect(start).toContain("Hand des Spielers (6):")
    expect(start).toContain("„Player hat 6 Karten auf der Hand behalten“")
  })

  it("a concession is the player's decision and the end says so", () => {
    const text = report(reportGame("human-3-concede").replay)
    expect(text).toMatch(/Antwort: gibt die Partie auf\./)
    expect(text).toContain("Aufgegeben: ja.")
    expect(text).toContain("- Status: beendet")
  })
})

/**
 * Built from a real recording (human-3-de): the player's first priority in an own main phase
 * with an empty stack, then three passes to Forge's same priority question, each answered -
 * Forge's further messages cut off (a running recording).
 */
function passes(between?: MatchLogEntry["message"]): { doc: ReplayDocument; inputs: number[] } {
  const doc = reportGame("human-3-de").replay
  const state = (entry: MatchLogEntry) => entry.message as unknown as GameState
  let me = -1
  let current: GameState | null = null
  const at = doc.log.findIndex((entry) => {
    if (entry.from !== "engine") return false
    if (entry.message.type === "state") {
      current = state(entry)
      me = current.players.find((player) => player.me)?.id ?? me
    }
    const message = entry.message as unknown as EngineMessage
    const now = current as GameState | null
    return message.type === "question" && message.kind === "buttons" && message.purpose === "priority" && now !== null && now.activePlayer === me && now.phase === "MAIN1" && now.stack.length === 0
  })
  const question = doc.log[at]!.message as unknown as Extract<EngineMessage, { type: "question"; kind: "buttons" }>
  const pass = question.buttons.find((button) => button.meaning === "pass")!.nr
  const log = doc.log.slice(0, at + 1)
  let seq = Math.max(...log.filter((entry) => entry.from === "player").map((entry) => Number(entry.message["seq"] ?? 0))) + 1
  const add = (from: "engine" | "player", message: MatchLogEntry["message"]) => log.push({ matchId: doc.match.id, seq: log.length, at: log.at(-1)!.at, from, message })
  const inputs: number[] = []
  for (let i = 0; i < 3; i++) {
    const id = question.id + i * 1000
    if (i > 0) add("engine", { ...question, id })
    if (i === 2 && between !== undefined) add("engine", between)
    inputs.push(log.length)
    add("player", { type: "answer", seq, question: id, kind: "buttons", button: pass })
    add("engine", { type: "question.answered", id, seq })
    seq++
  }
  doc.log = log
  doc.match = { ...doc.match, status: "running", endedAt: null, end: null }
  return { doc, inputs }
}

describe("passes in a row (built from a real recording)", () => {
  it("identical priority questions passed in a row without anything between are one line with a count", () => {
    const { doc, inputs } = passes()
    const text = report(doc)
    const block = decisions(text).at(-1)!
    expect(block.block.split("\n")[0]).toContain(`[${inputs.map((seq) => `L${seq}`).join(", ")}]`)
    expect(block.block).toContain("passt (Knopf 1 „OK“) – 3-mal hintereinander, ohne Ereignis dazwischen.")
    expect(block.block).toMatch(/Forge nahm jede Antwort an \[L\d+, L\d+, L\d+\]/)
  })

  it("a log entry between them ends the count: two and one", () => {
    const events = { type: "events", entries: [{ kind: "MULLIGAN", text: "built entry between two passes" }] }
    const { doc } = passes(events)
    const text = report(doc)
    const last = decisions(text).slice(-2)
    expect(last[0]!.block).toContain("2-mal hintereinander")
    expect(last[1]!.block).not.toContain("hintereinander")
    expect(text).toContain("„built entry between two passes“")
  })

  it("the unused possibilities are read from the state at the player's last pass", () => {
    const { doc, inputs } = passes()
    const text = report(doc)
    const unused = text.slice(text.lastIndexOf(HEADINGS.unused), text.lastIndexOf(HEADINGS.close))
    const label = decisions(text).at(-1)!.label
    expect(unused).toContain(`Gelesen beim letzten Passen in einer eigenen Hauptphase bei leerem Stapel: ${label} [L${inputs[2]}]`)
  })
})

describe("what the report says comes from the recording", () => {
  it("turn headings count globally and per side; the end names Forge's number of turns", () => {
    for (const game of reportGames()) {
      const text = report(game.replay)
      const messages = engineMessages(game.replay)
      const me = messages.map(({ message }) => message).find((message): message is GameState => message.type === "state")!.players.find((player) => player.me)!.id
      const headings = [...text.matchAll(/^### Zug (\d+) \((\d+)\. Zug (des Spielers|der Forge-KI)\)$/gm)]
      const counts = { "des Spielers": 0, "der Forge-KI": 0 }
      let previous = 0
      for (const [, turn, ordinal, side] of headings) {
        expect(Number(turn)).toBeGreaterThan(previous)
        previous = Number(turn)
        counts[side as keyof typeof counts]++
        expect(Number(ordinal)).toBe(counts[side as keyof typeof counts])
        const first = messages.map(({ message }) => message).find((message): message is GameState => message.type === "state" && message.turn === Number(turn))!
        expect(first.activePlayer === me ? "des Spielers" : "der Forge-KI").toBe(side)
      }
      const end = messages.map(({ message }) => message).find((message) => message.type === "game.end")
      expect(end?.type === "game.end" && end.turns).toBe(previous)
      expect(text).toContain(`Zugzahl laut Forge: ${previous}.`)
    }
  })

  it("every attack, block and damage names its card and the decision before it; life without damage has no invented source", () => {
    const seen = { attacks: 0, blocks: 0, damage: 0, life: 0, sourceless: 0 }
    for (const game of reportGames()) {
      const text = report(game.replay)
      const cards = visibleCards(game.replay)
      const lines = text.split("\n")
      const defined = (label: string, line: string) => {
        const at = lines.indexOf(line)
        return lines.slice(0, at).some((each) => each.includes(`**${label}**`))
      }
      const after = (line: string) => {
        const match = /\((nach (E\d+)|vor der ersten Entscheidung des Spielers)\)$/.exec(line)
        expect(match, line).not.toBeNull()
        if (match![2] !== undefined) expect(defined(match![2], line), line).toBe(true)
      }
      for (const { message } of engineMessages(game.replay)) {
        if (message.type !== "observation") continue
        for (const action of (message as Observation).actions) {
          if (action.kind === "attack") {
            seen.attacks++
            for (const each of action.attacks) if (isVisible(each.attacker)) expect(text).toContain(`${labelOf(cards, each.attacker.id)}) greift`)
            lines.filter((line) => / greift an \(/.test(line)).forEach((line) => expect(line).toMatch(/\((nach E\d+|vor der ersten Entscheidung des Spielers)\):$/))
          }
          if (action.kind === "block") seen.blocks++
          if (action.kind === "block") for (const each of action.blocks) expect(text).toContain(`${labelOf(cards, each.attacker)})`)
          if (action.kind !== "resolve" && action.kind !== "combatDamage") continue
          for (const damage of action.results.damage) {
            if (damage.source === null) continue
            const line = lines.find((each) => each.includes(`${labelOf(cards, damage.source!)}) fügt`) && each.includes(`${damage.amount === 1 ? "1 Schadenspunkt" : `${damage.amount} Schadenspunkte`} zu`))
            expect(line, `${game.name}: damage of ${damage.source}`).toBeDefined()
            after(line!)
            seen.damage++
          }
          for (const life of action.results.life) {
            const hurt = action.results.damage.filter((each) => each.target.kind === "player" && each.target.id === life.player)
            const sources = hurt.flatMap((each) => (each.source === null ? [] : [labelOf(cards, each.source)]))
            const line = lines.find((each) => each.includes(`: ${life.from} → ${life.to}`) && each.includes("Leben") && sources.every((source) => each.includes(source)))
            expect(line, `${game.name}: life ${life.from} → ${life.to}`).toBeDefined()
            seen.life++
            if (hurt.length > 0) {
              expect(line).toContain("durch Schaden von")
              after(line!)
            } else {
              expect(line).toContain("Quelle von Forge nicht genannt")
              seen.sourceless++
            }
          }
        }
      }
      // A life change Forge only logs (no observation tells it) keeps Forge's words and names no source either.
      const logged = lines.filter((line) => line.includes("Forge-Protokoll (`LIFE`)"))
      for (const line of logged) expect(line).toContain("Quelle von Forge nicht genannt")
      seen.sourceless += logged.length
    }
    expect(seen.attacks).toBeGreaterThan(10)
    expect(seen.blocks).toBeGreaterThan(10)
    expect(seen.damage).toBeGreaterThan(20)
    expect(seen.life).toBeGreaterThan(10)
    expect(seen.sourceless).toBeGreaterThan(0)
  })

  it("a life payment without damage says Forge named no source", () => {
    const text = report(reportGame("targets-payment").replay)
    expect(text).toMatch(/Forge-Protokoll \(`LIFE`\): „Life: Player 10 > 6“ – Quelle von Forge nicht genannt/)
  })

  it("hidden stays hidden: only ids and names of cards the recording shows", () => {
    for (const game of all()) {
      // The foreword's example ("Lightning Bolt (#53)") is no card of the game.
      const full = report(game.replay)
      const text = full.slice(full.indexOf(HEADINGS.head))
      const cards = visibleCards(game.replay)
      for (const [, id] of text.matchAll(/\(#(\d+)[,)]/g)) expect(cards.has(Number(id)), `${game.name}: #${id}`).toBe(true)
      // Every id has its name before it.
      expect(text).not.toMatch(/(^|[,;:(„]) ?\(#\d+/m)
      expect(text).not.toContain("Karte ohne Namen (#")
      // The AI's deck names no card the player never saw - before appendix B.
      const seen = new Set([...cards.values()].flatMap((card) => [card.key, card.name]).filter((name): name is string => typeof name === "string"))
      const mine = new Set(game.replay.match.human.deck.main.map((entry) => entry.card))
      const unseen = game.replay.match.ai.deck.main.map((entry) => entry.card).filter((name) => !seen.has(name) && !mine.has(name))
      expect(unseen.length, game.name).toBeGreaterThan(0)
      const body = text.slice(0, text.indexOf(HEADINGS.aiDeck))
      for (const name of unseen) expect(body.includes(name), `${game.name}: ${name} before appendix B`).toBe(false)
      expect(body).not.toContain(game.replay.match.ai.deck.name)
      const appendix = text.slice(text.indexOf(HEADINGS.aiDeck), text.indexOf(HEADINGS.origin))
      expect(appendix).toContain("**nicht bekannt**")
      for (const name of unseen) expect(appendix).toContain(`× ${name}`)
    }
  })

  it("the AI's hand is a number; the player's hand is named", () => {
    const text = report(reportGame("human-5-defend").replay)
    expect(text).toMatch(/- Forge-KI – Hand: \d+ Karten \(verdeckt\)/)
    expect(text).toMatch(/- Spieler – Hand \(\d+\): [A-Z]/)
  })

  it("unused possibilities agree with Forge's playable marks, land plays and untapped lands of the state named", () => {
    for (const game of reportGames()) {
      const text = report(game.replay)
      const states = new Map(engineMessages(game.replay).filter(({ message }) => message.type === "state").map(({ seq, message }) => [seq, message as GameState]))
      const blocks = text.split(`\n${HEADINGS.unused}\n`).slice(1).map((part) => part.split("\n####")[0]!)
      expect(blocks.length, game.name).toBeGreaterThan(0)
      for (const block of blocks) {
        const ref = /Zustand \[L(\d+)\]/.exec(block)
        if (ref === null) continue
        const state = states.get(Number(ref[1]))!
        const me = state.players.find((player) => player.me)!
        const open = me.landsUnlimited === true || me.landsPlayed < me.landsAllowed
        expect(block).toContain(`Landdrop offen: ${open ? "ja" : "nein"} (Forge: ${me.landsPlayed} von ${me.landsAllowed} `)
        const ids = (line: string) => [...(block.split("\n").find((each) => each.startsWith(line)) ?? "").matchAll(/\(#(\d+)/g)].map(([, id]) => Number(id)).sort((a, b) => a - b)
        const playable = me.zones.hand.filter(isVisible).filter((card) => card.playable).map((card) => card.id).sort((a, b) => a - b)
        expect(ids("- Als spielbar markierte Handkarten:")).toEqual(playable)
        const untapped = me.zones.battlefield.filter(isVisible).filter((card) => !card.tapped && /land\b/i.test((card.typeLine ?? "").split(/[—–]| - /)[0] ?? "")).map((card) => card.id).sort((a, b) => a - b)
        expect(ids("- Ungetappte Länder:")).toEqual(untapped)
      }
    }
  })

  it("the commander game shows the command zone and Forge's 40 life", () => {
    const text = report(reportGame("commander").replay)
    expect(text).toContain("- Modus: Commander")
    expect(text).toMatch(/Leben: Spieler 40 · Forge-KI 40/)
    expect(text).toMatch(/Spieler – Kommandozone: /)
    expect(text).toContain("Der Spieler hat gewonnen.")
  })
})

describe("a recording that did not end with Forge's result (built from a real one)", () => {
  function cut(status: "running" | "aborted"): ReplayDocument {
    const doc = reportGame("human-5-defend").replay
    const end = doc.log.findIndex((entry) => entry.message.type === "game.end")
    doc.log = doc.log.slice(0, Math.floor(end / 2))
    if (status === "aborted")
      doc.log.push({ matchId: doc.match.id, seq: doc.log.length, at: doc.log.at(-1)!.at, from: "engine", message: { type: "engine.abort", reason: "terminated", origin: "client", message: "built: the page was closed" } })
    doc.match = { ...doc.match, status, end: null, endedAt: status === "aborted" ? doc.match.endedAt : null }
    return doc
  }

  it("a running or interrupted recording says it has no result", () => {
    const text = report(cut("running"))
    expect(text).toContain("- Status: laufend oder unterbrochen")
    expect(text).toContain("- Dauer: unbekannt")
    expect(text).toContain("Die Aufzeichnung endet ohne Ergebnis")
    expect(text).not.toContain("Zugzahl laut Forge")
  })

  it("an aborted recording names Forge's abort", () => {
    const text = report(cut("aborted"))
    expect(text).toContain("- Status: abgebrochen")
    expect(text).toContain("Die Engine brach technisch ab (terminated): „built: the page was closed“")
  })
})
