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

  it("the manifest's theme colour is the background token", () => {
    expect(hex(srgb(tokens.get("background")!))).toBe("#0d121b")
  })

  it("one dark palette only (no light theme)", () => {
    expect(css).not.toMatch(/\.dark\s*\{/)
    expect(css.match(/:root\s*\{/g)).toHaveLength(1)
  })
})
