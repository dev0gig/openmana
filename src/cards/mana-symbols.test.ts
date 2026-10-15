/*
 * The notation of mana symbols (2026-10-15): which symbols OpenMana draws,
 * how a text is cut into words and symbols, and the words screen readers hear.
 */
import { describe, expect, it } from "vitest"
import { manaSymbolShape, manaSymbolWord, splitManaText } from "./mana-symbols"

describe("mana symbols", () => {
  it("know the symbols Forge and the catalog write", () => {
    expect(manaSymbolShape("U")).toEqual({ kind: "color", color: "U" })
    expect(manaSymbolShape("C")).toEqual({ kind: "color", color: "C" })
    expect(manaSymbolShape("12")).toEqual({ kind: "number", value: "12" })
    expect(manaSymbolShape("X")).toEqual({ kind: "letter", value: "X" })
    expect(manaSymbolShape("T")).toEqual({ kind: "tap" })
    expect(manaSymbolShape("Q")).toEqual({ kind: "untap" })
    expect(manaSymbolShape("S")).toEqual({ kind: "snow" })
    expect(manaSymbolShape("E")).toEqual({ kind: "energy" })
    expect(manaSymbolShape("G/P")).toEqual({ kind: "phyrexian", color: "G" })
    expect(manaSymbolShape("W/U")).toEqual({ kind: "hybrid", first: "W", second: "U", phyrexian: false })
    expect(manaSymbolShape("2/G")).toEqual({ kind: "hybrid", first: "2", second: "G", phyrexian: false })
    expect(manaSymbolShape("C/W")).toEqual({ kind: "hybrid", first: "C", second: "W", phyrexian: false })
    expect(manaSymbolShape("W/U/P")).toEqual({ kind: "hybrid", first: "W", second: "U", phyrexian: true })
  })

  it("leave unknown symbols as written", () => {
    for (const symbol of ["H", "HW", "CHAOS", "PW", "A", "W/X", "U/2", ""]) expect(manaSymbolShape(symbol)).toBeNull()
    expect(manaSymbolWord("H")).toBe("{H}")
  })

  it("say every symbol in words", () => {
    expect(manaSymbolWord("2")).toBe("2 beliebig")
    expect(manaSymbolWord("U")).toBe("Blau")
    expect(manaSymbolWord("B/P")).toBe("Schwarz oder Leben")
    expect(manaSymbolWord("2/W")).toBe("2 beliebig oder Weiß")
    expect(manaSymbolWord("W/U/P")).toBe("Weiß oder Blau oder Leben")
    expect(manaSymbolWord("T")).toBe("Tappen")
    expect(manaSymbolWord("∞")).toBe("unendlich")
  })

  it("cut a text into words and the symbols OpenMana draws", () => {
    expect(splitManaText("Zahle die Spruchkosten: {2}{U}")).toEqual([
      { kind: "text", text: "Zahle die Spruchkosten: " },
      { kind: "symbol", symbol: "2", shape: { kind: "number", value: "2" } },
      { kind: "symbol", symbol: "U", shape: { kind: "color", color: "U" } },
    ])
    expect(splitManaText("{T}: Erzeuge {R}.").map((part) => (part.kind === "text" ? part.text : `<${part.symbol}>`))).toEqual(["<T>", ": Erzeuge ", "<R>", "."])
    // An unknown symbol stays in the words around it; a text without symbols is one piece.
    expect(splitManaText("Zahle {H} und {G}")).toEqual([{ kind: "text", text: "Zahle {H} und " }, { kind: "symbol", symbol: "G", shape: { kind: "color", color: "G" } }])
    expect(splitManaText("Grizzlybären")).toEqual([{ kind: "text", text: "Grizzlybären" }])
    expect(splitManaText("")).toEqual([])
  })
})
