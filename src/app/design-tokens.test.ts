// @vitest-environment node
/*
 * The design tokens in src/index.css keep text readable: every text colour
 * on the surfaces it is used on reaches WCAG 2.2 AA (4.5:1), recomputed from
 * the OKLCH values (CSS Color 4 conversion to sRGB). Translucent tokens
 * (border, input) are decoration, not text, and not checked here.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const css = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8")
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ""
const tokens = new Map<string, [number, number, number]>()
for (const match of rootBlock.matchAll(/--([a-z-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\);/g)) {
  tokens.set(match[1]!, [Number(match[2]), Number(match[3]), Number(match[4])])
}

function srgb([l, c, h]: [number, number, number]): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return linear.map((x) => {
    const v = Math.min(Math.max(x, 0), 1)
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
  }) as [number, number, number]
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function token(name: string): [number, number, number] {
  const value = tokens.get(name)
  if (!value) throw new Error(`token ${name} missing in :root`)
  return srgb(value)
}

function contrast(foreground: string, background: string): number {
  return ratio(token(foreground), token(background))
}

/** `color` at `alpha` over `under` (Tailwind's bg-x/20), in sRGB as the browser composites it. */
function over(color: string, alpha: number, under: string): [number, number, number] {
  const [top, bottom] = [token(color), token(under)]
  return top.map((v, i) => v * alpha + bottom[i]! * (1 - alpha)) as [number, number, number]
}

const hex = (rgb: [number, number, number]) => `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`

describe("design tokens", () => {
  it.each([
    ["foreground", "background"],
    ["foreground", "card"],
    ["popover-foreground", "popover"],
    ["card-foreground", "card"],
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["muted-foreground", "muted"],
    ["muted-foreground", "popover"],
    ["primary-foreground", "primary"],
    ["primary", "background"],
    ["primary", "card"],
    ["secondary-foreground", "secondary"],
    ["accent-foreground", "accent"],
    ["destructive", "background"],
    ["destructive", "card"],
    ["sidebar-foreground", "sidebar"],
    ["sidebar-accent-foreground", "sidebar-accent"],
    ["sidebar-primary-foreground", "sidebar-primary"],
  ])("%s on %s reaches 4.5:1", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
  })

  // The destructive button and badge: destructive text on a 20 % destructive tint (dark:bg-destructive/20),
  // in dialogs (popover) and on cards - "Endgültig löschen" in a confirmation (prompt 10's end-to-end test found 4.43:1).
  it.each([["popover"], ["card"], ["background"]])("destructive text on its own tint over %s reaches 4.5:1", (surface) => {
    expect(ratio(token("destructive"), over("destructive", 0.2, surface))).toBeGreaterThanOrEqual(4.5)
  })

  // Forge's marks on the game table's cards (prompt 14): frames around the picture - usable (--primary, dashed),
  // chosen (--foreground, solid) - on the table's surfaces and in the card view. Non-text contrast, WCAG 1.4.11: 3:1.
  it.each([
    ["primary", "background"],
    ["primary", "card"],
    ["primary", "popover"],
    ["foreground", "background"],
    ["foreground", "card"],
    ["foreground", "popover"],
  ])("the card mark %s on %s reaches 3:1", (mark, surface) => {
    expect(contrast(mark, surface)).toBeGreaterThanOrEqual(3)
  })

  // The game table (prompt 36, docs/design/SPIELTISCH.md §5): text on its panels, the plaque on a card's value box,
  // the board and the desk - each surface token is its lightest tone, the binding case for light text.
  it.each([
    ["foreground", "table-panel"],
    ["muted-foreground", "table-panel"],
    ["primary", "table-panel"],
    ["table-gold-light", "table-panel"],
    ["table-mana", "table-panel"],
    ["foreground", "table-plaque"],
    ["table-gold-light", "table-plaque"],
    ["foreground", "table-leather"],
    ["muted-foreground", "table-leather"],
    ["table-gold-light", "table-leather"],
    ["foreground", "table-wood"],
    ["foreground", "table-wood-frame"],
    ["table-gold-light", "table-wood-frame"],
    // Text on gold (the main button, the current step): its lightest and its middle tone.
    ["primary-foreground", "table-gold-light"],
    ["primary-foreground", "primary"],
  ])("table text %s on %s reaches 4.5:1", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
  })

  // Prompt 41: the main button's gold gradient (table.css .table-main-button) runs from --table-gold-light over --primary
  // down to --primary mixed with --table-gold-dark (55 : 45, in oklch); its words (--primary-foreground) keep 4.5:1 on
  // every tone of it, also the darkest at its foot. The current step and phase use the upper half of the same gold.
  it.each([0.7, 0.55])("text on the main button's gold reaches 4.5:1 down to --primary %s with --table-gold-dark", (share) => {
    const [l1, c1, h1] = tokens.get("primary")!
    const [l2, c2, h2] = tokens.get("table-gold-dark")!
    const mixed = srgb([l1 * share + l2 * (1 - share), c1 * share + c2 * (1 - share), h1 * share + h2 * (1 - share)])
    expect(ratio(token("primary-foreground"), mixed)).toBeGreaterThanOrEqual(4.5)
  })

  // Prompt 37: regions full of text and the words on the board lie on --table-panel at 90 % (table.css, BOARD_TEXT in
  // game-table.tsx); below them may lie the board's brightest decoration - brass and rune gold - or the desk.
  it.each(
    ["foreground", "muted-foreground", "primary", "table-gold-light"].flatMap((text) =>
      ["table-gold-light", "table-wood-frame", "table-leather", "table-wood"].map((under) => [text, under] as const),
    ),
  )("table text %s on the panel tone (90 %%) over %s reaches 4.5:1", (text, under) => {
    expect(ratio(token(text), over("table-panel", 0.9, under))).toBeGreaterThanOrEqual(4.5)
  })

  // The summoning-sickness chip (table.css [data-tone="sick"], project owner 2026-10-14: clearer, no frame on the card):
  // its hourglass and word in --table-sick on the chip's panel tone (90 %) over every surface a chip line lies on - text,
  // so 4.5:1 - and on the plain surfaces.
  it.each(["table-gold-light", "table-wood-frame", "table-leather", "table-wood"])("the sick chip's violet on the panel tone (90 %%) over %s reaches 4.5:1", (under) => {
    expect(ratio(token("table-sick"), over("table-panel", 0.9, under))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(["table-panel", "table-leather", "table-wood", "table-wood-frame"])("the sick chip's violet on %s reaches 4.5:1", (surface) => {
    expect(contrast("table-sick", surface)).toBeGreaterThanOrEqual(4.5)
  })

  // Text straight on the desk (the hand's row) and the board's leather.
  it.each([
    ["muted-foreground", "table-wood"],
    ["muted-foreground", "table-wood-frame"],
  ])("table text %s on %s reaches 4.5:1", (text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
  })

  // The table's marks, plaque rims and arrows (WCAG 1.4.11, 3:1): usable/chosen gold, target and danger red, attack
  // amber, loyalty's mana blue, a life gain's green (prompt 44), the sick chip's violet rim - on the board (leather), on the desk (wood frame) and on the panels. The marks differ by
  // more than colour (glow against frame, an arrow, the chips' words), as WCAG 1.4.1 asks.
  it.each(
    ["primary", "foreground", "table-gold-light", "table-danger", "table-attack", "table-mana", "table-heal", "table-sick"].flatMap((mark) =>
      ["table-leather", "table-wood-frame", "table-panel", "table-plaque"].map((surface) => [mark, surface] as const),
    ),
  )("the table mark %s on %s reaches 3:1", (mark, surface) => {
    expect(contrast(mark, surface)).toBeGreaterThanOrEqual(3)
  })

  it("the table's tokens are all there and mapped for Tailwind", () => {
    const names = ["gold-light", "gold-dark", "gold-line", "mana", "danger", "attack", "heal", "sick", "wood", "wood-frame", "leather", "panel", "plaque"]
    for (const name of names) {
      expect(rootBlock).toMatch(new RegExp(`--table-${name}:\\s*oklch\\(`))
      expect(css).toContain(`--color-table-${name}: var(--table-${name});`)
    }
  })

  it("the manifest's theme colour is the background token", () => {
    expect(hex(srgb(tokens.get("background")!))).toBe("#0d121b")
  })

  it("one dark palette only (no light theme)", () => {
    expect(css).not.toMatch(/\.dark\s*\{/)
    expect(css.match(/:root\s*\{/g)).toHaveLength(1)
  })
})
