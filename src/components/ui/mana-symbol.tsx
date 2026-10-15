/*
 * OpenMana's own mana symbols (2026-10-15, design: Seafile
 * /repo/openmana/design/manasymbole/vorlage-2, blue "A" - two waves, hybrid
 * "B" - split diagonally). Wizards of the Coast's mana symbols are on the list
 * of marks its Fan Content Policy keeps out of fan content; these are drawn
 * anew - the usual mana colours, plain geometric signs: sun, waves, crescent,
 * flame, leaf, hexagon, a tilted card for tapping, a heart for paying with life.
 *
 * Built the shadcn way: a small presentational component with `data-slot`,
 * `className` and the text's own size (1em); the colours are the symbols'
 * own, like an icon's. `ManaText` shows a text with its symbols drawn
 * ("Zahle die Spruchkosten: {2}{U}"); a symbol OpenMana does not know stays as
 * written. Screen readers hear each symbol in words (`manaSymbolWord`).
 */
import * as React from "react"
import { cn } from "cn"
import { manaSymbolShape, manaSymbolWord, splitManaText, type ManaLetter, type ManaSymbolShape } from "@/cards/mana-symbols"

/** The symbols' own colours: the five mana colours, grey for generic and colourless, the dark ink of the signs. */
export const MANA_SYMBOL_COLORS = {
  W: "#F6EFD2",
  U: "#A9D2EC",
  B: "#BDB3AE",
  R: "#F1A285",
  G: "#99CFAA",
  C: "#CFC8C3",
  ink: "#1D1B22",
} as const

const INK = MANA_SYMBOL_COLORS.ink

function fill(color: ManaLetter | string): string {
  return color in MANA_SYMBOL_COLORS ? MANA_SYMBOL_COLORS[color as ManaLetter] : MANA_SYMBOL_COLORS.C
}

const SUN_RAYS = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4 + Math.PI / 8
  return { x1: 50 + 22 * Math.cos(angle), y1: 50 + 22 * Math.sin(angle), x2: 50 + 34 * Math.cos(angle), y2: 50 + 34 * Math.sin(angle) }
})

const TAP = (
  <>
    <rect x="25" y="35" width="30" height="42" rx="5" fill="none" stroke={INK} strokeWidth="7.5" transform="rotate(30 40 56)" />
    <path d="M42 17 A 33 33 0 0 1 83 46" fill="none" stroke={INK} strokeWidth="7.5" strokeLinecap="round" />
    <path d="M72 42 L 93 42 L 83 60 Z" fill={INK} />
  </>
)

const HEART = <path d="M50 80 C 18 59 17 37 29 29 C 39 23 48 28 50 37 C 52 28 61 23 71 29 C 83 37 82 59 50 80 Z" fill={INK} />

/** The sign of a colour (or colourless) on its disc, in the 100 x 100 box. */
function ColorSign({ color }: { color: ManaLetter }) {
  switch (color) {
    case "W":
      return (
        <>
          <circle cx="50" cy="50" r="14.5" fill={INK} />
          {SUN_RAYS.map((ray, index) => (
            <line key={index} {...ray} stroke={INK} strokeWidth="8.5" strokeLinecap="round" />
          ))}
        </>
      )
    case "U":
      return (
        <>
          {[41, 61].map((y) => (
            <path key={y} d={`M17 ${y} q8.25 -11 16.5 0 t16.5 0 t16.5 0 t16.5 0`} fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
          ))}
        </>
      )
    case "B":
      return <path d="M62 18 a33 33 0 1 0 0 64 a25.5 25.5 0 1 1 0 -64z" fill={INK} />
    case "R":
      return <path d="M50 14 C 63 33 76 44 74 61 C 72 78 60 86 50 86 C 40 86 28 78 26 61 C 25 49 33 41 38 32 C 40 43 44 48 49 50 C 49 38 47 27 50 14 Z" fill={INK} />
    case "G":
      return (
        <g transform="rotate(-18 50 50)">
          <path d="M50 12 C 74 30 78 60 50 88 C 22 60 26 30 50 12 Z" fill={INK} />
          <path d="M50 30 V 78" stroke={MANA_SYMBOL_COLORS.G} strokeWidth="4.5" strokeLinecap="round" />
        </g>
      )
    case "C":
      return <polygon points="50,18 78,34 78,66 50,82 22,66 22,34" fill="none" stroke={INK} strokeWidth="8.5" strokeLinejoin="round" />
  }
}

/** A number or letter in the text's own font. */
function Glyph({ value }: { value: string }) {
  const size = value === "∞" ? 70 : value.length > 2 ? 38 : value.length > 1 ? 50 : 64
  return (
    <text x="50" y="53" textAnchor="middle" dominantBaseline="central" fontWeight="800" fontSize={size} fill={INK}>
      {value}
    </text>
  )
}

/** What one half of a hybrid symbol shows: a colour's sign or a number. */
function HalfSign({ part }: { part: string }) {
  return /^\d+$/.test(part) ? <Glyph value={part} /> : <ColorSign color={part as ManaLetter} />
}

function SymbolArt({ shape }: { shape: ManaSymbolShape }) {
  const disc = (color: string) => <circle cx="50" cy="50" r="50" fill={color} />
  switch (shape.kind) {
    case "color":
      return <>{disc(fill(shape.color))}<ColorSign color={shape.color} /></>
    case "number":
    case "letter":
      return <>{disc(MANA_SYMBOL_COLORS.C)}<Glyph value={shape.value} /></>
    case "tap":
      return <>{disc(MANA_SYMBOL_COLORS.C)}{TAP}</>
    case "untap":
      return <>{disc(MANA_SYMBOL_COLORS.C)}<g transform="translate(100 0) scale(-1 1)">{TAP}</g></>
    case "snow":
      return (
        <>
          {disc(MANA_SYMBOL_COLORS.C)}
          {[0, 60, 120, 180, 240, 300].map((turn) => (
            <g key={turn} transform={`rotate(${turn} 50 50)`} stroke={INK} strokeWidth="6.5" strokeLinecap="round" fill="none">
              <line x1="50" y1="50" x2="50" y2="19" />
              <path d="M41 25 L50 33 L59 25" />
            </g>
          ))}
        </>
      )
    case "energy":
      return <>{disc(MANA_SYMBOL_COLORS.C)}<path d="M56 12 L 26 56 L 46 56 L 40 88 L 74 42 L 53 42 Z" fill={INK} /></>
    case "phyrexian":
      return <>{disc(fill(shape.color))}{HEART}</>
    case "hybrid":
      return (
        <>
          {/* Split from the top right to the bottom left: the first part above, the second below. */}
          <path d="M85.36 14.64 A 50 50 0 0 0 14.64 85.36 Z" fill={fill(shape.first)} />
          <path d="M85.36 14.64 A 50 50 0 0 1 14.64 85.36 Z" fill={fill(shape.second)} />
          <g transform="translate(4 4) scale(0.55)"><HalfSign part={shape.first} /></g>
          <g transform="translate(41 41) scale(0.55)"><HalfSign part={shape.second} /></g>
          <line x1="85.4" y1="14.6" x2="14.6" y2="85.4" stroke={INK} strokeWidth="3" />
          {shape.phyrexian ? (
            <g transform="translate(32 32) scale(0.36)">
              <circle cx="50" cy="50" r="50" fill="#FFFFFF" />
              {HEART}
            </g>
          ) : null}
        </>
      )
  }
}

/**
 * One mana symbol (without braces: "U", "2", "W/U", "G/P", "T"), as large as
 * the text around it. Named in words for screen readers and as a tooltip;
 * `decorative` hides it where the words stand beside it already.
 */
function ManaSymbol({ symbol, decorative = false, className, ...props }: Omit<React.ComponentProps<"svg">, "children"> & { symbol: string; decorative?: boolean }) {
  const shape = manaSymbolShape(symbol)
  if (shape === null) return <span data-slot="mana-symbol-text">{`{${symbol}}`}</span>
  const word = manaSymbolWord(symbol)
  return (
    <svg
      data-slot="mana-symbol"
      data-symbol={symbol}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": word })}
      className={cn("inline-block size-[1.1em] shrink-0 align-[-0.2em]", className)}
      {...props}
    >
      {decorative ? null : <title>{word}</title>}
      <SymbolArt shape={shape} />
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="#000000" strokeOpacity="0.28" strokeWidth="3" />
    </svg>
  )
}

/**
 * A text with its mana symbols drawn - Forge's question, a cost, an ability,
 * a rules text. The words stay exactly as written; only the symbols in braces
 * that OpenMana knows become pictures, a run of them kept on one line.
 */
function ManaText({ text, decorative = false }: { text: string; decorative?: boolean }) {
  const parts = splitManaText(text)
  if (!parts.some((part) => part.kind === "symbol")) return <>{text}</>
  const runs: React.ReactNode[] = []
  let symbols: React.ReactNode[] = []
  const close = () => {
    if (symbols.length > 0) runs.push(<span key={`run-${runs.length}`} data-slot="mana-symbols" className="whitespace-nowrap">{symbols}</span>)
    symbols = []
  }
  parts.forEach((part, index) => {
    if (part.kind === "symbol") {
      symbols.push(<ManaSymbol key={index} symbol={part.symbol} decorative={decorative} />)
      return
    }
    close()
    runs.push(<React.Fragment key={index}>{part.text}</React.Fragment>)
  })
  close()
  return <>{runs}</>
}

export { ManaSymbol, ManaText }
