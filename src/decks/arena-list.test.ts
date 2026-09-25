// @vitest-environment node
/*
 * Reading MTG Arena deck lists: every section, the About block, set and
 * collector numbers, localized names, Arena's rule for blocks without a
 * header, what Arena writes and what deck sites write - and every line that
 * is none of these reported with its number, never dropped.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseArenaDeckList, type ArenaDeckList } from "./arena-list"

const fixture = (name: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8")

/** Entries as [line, section, count, name, set, collector number] for compact expectations. */
const rows = (list: ArenaDeckList) => list.entries.map((e) => [e.line, e.section, e.count, e.name, e.set, e.collectorNumber])

describe("Arena exports", () => {
  it("reads About, Deck and Sideboard with set and collector numbers", () => {
    const list = parseArenaDeckList(fixture("arena-constructed.txt"))
    expect(list.name).toBe("Izzet Delver")
    expect(list.about).toEqual([{ line: 2, key: "Name", value: "Izzet Delver" }])
    expect(list.problems).toEqual([])
    expect(rows(list)).toEqual([
      [5, "main", 4, "Delver of Secrets", "MID", "47"],
      [6, "main", 4, "Lightning Bolt", "M11", "149"],
      [7, "main", 2, "Fire // Ice", "MH2", "290"],
      [8, "main", 3, "Bonecrusher Giant", "ELD", "115"],
      [9, "main", 1, "Valki, God of Lies", "KHM", "114"],
      [10, "main", 1, "Hansk, Slayer Zealot", "SLX", "22"],
      [11, "main", 2, "Lightning Bolt", "2X2", "361"],
      [12, "main", 1, "A-Canopy Tactician", "KHM", "378"],
      [13, "main", 20, "Forest", "NEO", "292"],
      [16, "sideboard", 2, "Akki Lavarunner", "CHK", "153"],
      [17, "sideboard", 1, "Drake Stone", "M11", "213"],
    ])
    expect(list.entries.every((e) => !e.inferred)).toBe(true)
    expect(list.lines).toBe(17)
  })

  it("reads a companion, also where Arena repeats it in the sideboard", () => {
    const list = parseArenaDeckList(fixture("arena-companion.txt"))
    expect(list.name).toBeNull()
    expect(rows(list)).toEqual([
      [2, "companion", 1, "Bruna, the Fading Light", "EMN", "15"],
      [5, "main", 4, "Lightning Bolt", "M11", "149"],
      [6, "main", 1, "Bruna, the Fading Light", "EMN", "15"],
      [7, "main", 20, "Forest", "NEO", "292"],
      [10, "sideboard", 1, "Bruna, the Fading Light", "EMN", "15"],
      [11, "sideboard", 2, "Akki Lavarunner", "CHK", "153"],
    ])
  })

  it("reads a commander (Brawl export)", () => {
    const list = parseArenaDeckList(fixture("arena-brawl.txt"))
    expect(list.name).toBe("Valki Brawl")
    expect(rows(list).map(([, section, count, name]) => [section, count, name])).toEqual([
      ["commander", 1, "Valki, God of Lies"],
      ["main", 1, "Lightning Bolt"],
      ["main", 1, "Fire // Ice"],
      ["main", 28, "Forest"],
    ])
  })

  it("reads a German list: byte order mark, Windows line ends, German names and section names", () => {
    const list = parseArenaDeckList(fixture("arena-german.txt"))
    expect(list.problems).toEqual([])
    expect(rows(list)).toEqual([
      [2, "commander", 1, "Valki, Gott der Lügen", "KHM", "114"],
      [5, "main", 4, "Blitzschlag", "M11", "149"],
      [6, "main", 4, "Geheimnisstöberer", "MID", "47"],
      [7, "main", 20, "Wald", "NEO", "291"],
      [10, "sideboard", 2, "Streitlustiges Tanzpaar", "SNC", "3"],
    ])
    expect(list.lines).toBe(10)
  })
})

describe("blocks without a header (Arena's rule)", () => {
  it("the first block is the main deck, the next one the sideboard", () => {
    const list = parseArenaDeckList(fixture("plain-without-headers.txt"))
    expect(rows(list).map(([line, section, count, name]) => [line, section, count, name])).toEqual([
      [1, "main", 4, "Lightning Bolt"],
      [2, "main", 4, "Delver of Secrets"],
      [3, "main", 20, "Forest"],
      [5, "sideboard", 2, "Akki Lavarunner"],
      [6, "sideboard", 1, "Fire // Ice"],
    ])
    expect(list.entries.every((e) => e.inferred)).toBe(true)
  })

  it("every later block without a header is sideboard too, also after a labelled main deck", () => {
    const list = parseArenaDeckList("Deck\n4 Lightning Bolt\n\n2 Fire // Ice\n\n1 Forest")
    expect(list.entries.map((e) => [e.section, e.inferred])).toEqual([
      ["main", false],
      ["sideboard", true],
      ["sideboard", true],
    ])
  })

  it("a block without a header after the commander is the main deck", () => {
    const list = parseArenaDeckList("Commander\n1 Valki, God of Lies\n\n1 Lightning Bolt\n29 Forest")
    expect(list.entries.map((e) => [e.section, e.name])).toEqual([
      ["commander", "Valki, God of Lies"],
      ["main", "Lightning Bolt"],
      ["main", "Forest"],
    ])
  })

  it("a header in the middle of a block switches the section", () => {
    const list = parseArenaDeckList("4 Lightning Bolt\nSideboard\n2 Fire // Ice")
    expect(list.entries.map((e) => [e.section, e.inferred])).toEqual([
      ["main", true],
      ["sideboard", false],
    ])
  })

  it("a card line right after About starts a block of its own", () => {
    const list = parseArenaDeckList("About\nName Test\n4 Lightning Bolt\n\n2 Forest")
    expect(list.name).toBe("Test")
    expect(list.entries.map((e) => [e.section, e.name])).toEqual([
      ["main", "Lightning Bolt"],
      ["sideboard", "Forest"],
    ])
  })
})

describe("what deck sites write, and what is not a deck line", () => {
  it("tolerates 4x, tabs, extra spaces, a colon after a header, a set without number", () => {
    const list = parseArenaDeckList(fixture("messy.txt"))
    expect(rows(list)).toEqual([
      [2, "main", 4, "Lightning Bolt", null, null],
      [3, "main", 4, "Delver of Secrets", "MID", "47"],
      [6, "main", 1, "B.F.M. (Big Furry Monster)", null, null],
      [7, "main", 2, "Forest", "NEO", null],
      [9, "sideboard", 1, "Joven and Chandler", null, null],
    ])
    expect(list.entries[1]?.text).toBe("4 Delver of Secrets (MID) 47")
  })

  it("reports every line it cannot read, with number and text", () => {
    const list = parseArenaDeckList(fixture("messy.txt"))
    expect(list.problems).toEqual([
      { line: 4, text: "four Forest", code: "unrecognized" },
      { line: 5, text: "0 Fire // Ice", code: "zero-count" },
    ])
  })

  it("unknown section names are problems, not silently a section", () => {
    const list = parseArenaDeckList("Deck\n4 Lightning Bolt\n\nMaybeboard\n1 Fire // Ice")
    expect(list.problems).toEqual([{ line: 4, text: "Maybeboard", code: "unrecognized" }])
    // The block after it has no header: Arena's rule makes it sideboard, and the report says so.
    expect(list.entries.map((e) => [e.section, e.inferred])).toEqual([
      ["main", false],
      ["sideboard", true],
    ])
  })

  it("keeps About lines it does not use, and takes the first name", () => {
    const list = parseArenaDeckList("About\nName Erstes\nFormat Historic\nName Zweites\n\nDeck\n1 Forest")
    expect(list.name).toBe("Erstes")
    expect(list.about.map((a) => [a.key, a.value])).toEqual([
      ["Name", "Erstes"],
      ["Format", "Historic"],
      ["Name", "Zweites"],
    ])
  })

  it("headers in any case", () => {
    const list = parseArenaDeckList("DECK\n1 Forest\nsideboard\n1 Forest\nCOMPANION:\n1 Forest\ngefährte\n1 Forest")
    expect(list.entries.map((e) => e.section)).toEqual(["main", "sideboard", "companion", "companion"])
  })

  it("an empty text is an empty list", () => {
    expect(parseArenaDeckList("")).toEqual({ entries: [], problems: [], name: null, about: [], lines: 1 })
    expect(parseArenaDeckList("\n\n  \n").entries).toEqual([])
  })

  it("very large counts are read as written (whether a deck is legal is Forge's decision)", () => {
    expect(rows(parseArenaDeckList("250 Forest"))).toEqual([[1, "main", 250, "Forest", null, null]])
    expect(parseArenaDeckList("99999999999999999999 Forest").problems).toEqual([{ line: 1, text: "99999999999999999999 Forest", code: "unrecognized" }])
  })
})
