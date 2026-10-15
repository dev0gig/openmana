/*
 * Mana symbols in Forge's and the catalog's notation ("{2}{U}", "{W/U}",
 * "{G/P}", "{T}") - read only as notation: which symbol, never what a card
 * may do with it (Forge decides). The pictures are OpenMana's own
 * (`ManaSymbol`, src/components/ui/mana-symbol.tsx, 2026-10-15): Wizards of
 * the Coast's mana symbols are among the marks its Fan Content Policy keeps
 * out of fan content, so neither they nor Scryfall's copies are used.
 */

/** The five colours and colourless, as the notation writes them. */
export type ManaLetter = "W" | "U" | "B" | "R" | "G" | "C"

export const MANA_COLOR_WORDS: Readonly<Record<ManaLetter, string>> = {
  W: "Weiß",
  U: "Blau",
  B: "Schwarz",
  R: "Rot",
  G: "Grün",
  C: "Farblos",
}

const COLORS = new Set(["W", "U", "B", "R", "G"])

/** What a symbol shows - the drawing `ManaSymbol` makes of it. */
export type ManaSymbolShape =
  | { readonly kind: "color"; readonly color: ManaLetter }
  | { readonly kind: "number"; readonly value: string }
  | { readonly kind: "letter"; readonly value: "X" | "Y" | "Z" | "½" | "∞" }
  | { readonly kind: "tap" | "untap" | "snow" | "energy" }
  | { readonly kind: "phyrexian"; readonly color: ManaLetter }
  | { readonly kind: "hybrid"; readonly first: ManaLetter | string; readonly second: ManaLetter; readonly phyrexian: boolean }

/** The shape of one symbol (without braces), or null for a symbol OpenMana does not draw - it stays as written. */
export function manaSymbolShape(symbol: string): ManaSymbolShape | null {
  if (/^\d+$/.test(symbol)) return { kind: "number", value: symbol }
  if (symbol === "X" || symbol === "Y" || symbol === "Z" || symbol === "½" || symbol === "∞") return { kind: "letter", value: symbol }
  if (symbol === "T") return { kind: "tap" }
  if (symbol === "Q") return { kind: "untap" }
  if (symbol === "S") return { kind: "snow" }
  if (symbol === "E") return { kind: "energy" }
  if (COLORS.has(symbol) || symbol === "C") return { kind: "color", color: symbol as ManaLetter }
  const parts = symbol.split("/")
  if (parts.length === 2 && parts[1] === "P" && (COLORS.has(parts[0]!) || parts[0] === "C")) return { kind: "phyrexian", color: parts[0] as ManaLetter }
  const phyrexian = parts.length === 3 && parts[2] === "P"
  if (parts.length === 2 || phyrexian) {
    const [first, second] = parts as [string, string]
    const firstOk = COLORS.has(first) || first === "C" || /^\d+$/.test(first)
    if (firstOk && COLORS.has(second)) return { kind: "hybrid", first, second: second as ManaLetter, phyrexian }
  }
  return null
}

const LETTER_WORDS: Readonly<Record<string, string>> = { X: "X", Y: "Y", Z: "Z", "½": "ein halbes", "∞": "unendlich" }

function side(part: string): string {
  if (part === "P") return "Leben"
  if (/^\d+$/.test(part)) return `${part} beliebig`
  return part in MANA_COLOR_WORDS ? MANA_COLOR_WORDS[part as ManaLetter] : part
}

/** One symbol in words for screen readers ("1 beliebig", "Rot", "Schwarz oder Leben"); an unknown one as written, in braces. */
export function manaSymbolWord(symbol: string): string {
  const shape = manaSymbolShape(symbol)
  if (shape === null) return `{${symbol}}`
  switch (shape.kind) {
    case "number": return `${shape.value} beliebig`
    case "letter": return LETTER_WORDS[shape.value]!
    case "tap": return "Tappen"
    case "untap": return "Enttappen"
    case "snow": return "Schnee"
    case "energy": return "Energie"
    case "color": return MANA_COLOR_WORDS[shape.color]
    case "phyrexian": return `${MANA_COLOR_WORDS[shape.color]} oder Leben`
    case "hybrid": return [side(shape.first), side(shape.second), ...(shape.phyrexian ? ["Leben"] : [])].join(" oder ")
  }
}

/** A piece of a text with mana symbols: words as they are, or one symbol OpenMana draws. */
export type ManaTextPart = { readonly kind: "text"; readonly text: string } | { readonly kind: "symbol"; readonly symbol: string; readonly shape: ManaSymbolShape }

/** A text cut into words and the symbols OpenMana draws ("Zahle {2}{U}" → "Zahle ", 2, U); a symbol it does not know stays in the words. */
export function splitManaText(text: string): ManaTextPart[] {
  const parts: ManaTextPart[] = []
  let words = ""
  let last = 0
  for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
    const shape = manaSymbolShape(match[1]!)
    words += text.slice(last, match.index)
    last = match.index + match[0].length
    if (shape === null) {
      words += match[0]
      continue
    }
    if (words !== "") parts.push({ kind: "text", text: words })
    words = ""
    parts.push({ kind: "symbol", symbol: match[1]!, shape })
  }
  words += text.slice(last)
  if (words !== "") parts.push({ kind: "text", text: words })
  return parts
}

/** Whether a text holds at least one symbol OpenMana draws. */
export function hasManaSymbols(text: string): boolean {
  return splitManaText(text).some((part) => part.kind === "symbol")
}
