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

/*
 * The menu style's tokens (prompt 57) are derived in index.css: aliases (`--gold-light: var(--table-gold-light)`) and
 * mixes with black in oklch (`color-mix(in oklch, var(--panel), black 25%)`: black's hue is powerless, so lightness and
 * chroma shrink by the share and the hue stays).
 */
const aliases = new Map<string, string>()
for (const match of rootBlock.matchAll(/--([a-z-]+):\s*var\(--([a-z-]+)\);/g)) aliases.set(match[1]!, match[2]!)
const blacks = new Map<string, [string, number]>()
for (const match of rootBlock.matchAll(/--([a-z-]+):\s*color-mix\(in oklch, var\(--([a-z-]+)\), black (\d+)%\);/g)) {
  blacks.set(match[1]!, [match[2]!, Number(match[3]) / 100])
}

/** A token's oklch, following aliases and mixes with black; the share of black (0 for a plain token). */
function shade(name: string): [[number, number, number], number] {
  const alias = aliases.get(name)
  if (alias !== undefined) return shade(alias)
  const mix = blacks.get(name)
  if (mix !== undefined) {
    const [[l, c, h]] = shade(mix[0])
    return [[l * (1 - mix[1]), c * (1 - mix[1]), h], mix[1]]
  }
  const value = tokens.get(name)
  if (!value) throw new Error(`token ${name} missing in :root`)
  return [value, 0]
}

const shell = (name: string) => srgb(shade(name)[0])

/** `top` at `alpha` over `under`, in sRGB as the browser composites it. */
const blend = (top: [number, number, number], alpha: number, under: [number, number, number]) =>
  top.map((v, i) => v * alpha + under[i]! * (1 - alpha)) as [number, number, number]

/** The gold shimmer's share of --primary (`--gold-glow: color-mix(in oklch, var(--primary) 16%, transparent)`). */
function glowShare(): number {
  const match = /--gold-glow:\s*color-mix\(in oklch, var\(--primary\) (\d+)%, transparent\);/.exec(rootBlock)
  if (!match) throw new Error("--gold-glow is not a share of --primary")
  return Number(match[1]) / 100
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

  // Prompt 37: regions full of text and the words on the board lie on --table-panel at 90 % (table.css, BOARD_TEXT in game-table.tsx;
  // since 2026-10-14 also the opponent's compact stage and the "Zuletzt" line); below them may lie the board's brightest decoration - brass and rune gold - or the desk.
  it.each(
    ["foreground", "muted-foreground", "primary", "table-gold-light"].flatMap((text) =>
      ["table-gold-light", "table-leather"].map((under) => [text, under] as const),
    ),
  )("table text %s on the panel tone (90 %%) over %s reaches 4.5:1", (text, under) => {
    expect(ratio(token(text), over("table-panel", 0.9, under))).toBeGreaterThanOrEqual(4.5)
  })

  // The summoning-sickness chip (table.css [data-tone="sick"], project owner 2026-10-14: clearer, no frame on the card):
  // its hourglass and word in --table-sick on the chip's panel tone (90 %) over every surface a chip line lies on - text,
  // so 4.5:1 - and on the plain surfaces.
  it.each(["table-gold-light", "table-leather"])("the sick chip's violet on the panel tone (90 %%) over %s reaches 4.5:1", (under) => {
    expect(ratio(token("table-sick"), over("table-panel", 0.9, under))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(["table-panel", "table-leather"])("the sick chip's violet on %s reaches 4.5:1", (surface) => {
    expect(contrast("table-sick", surface)).toBeGreaterThanOrEqual(4.5)
  })

  // Text straight on the desk (the hand's row) and the board's leather.
  it.each([
  ])("table text %s on %s reaches 4.5:1", (text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
  })

  // The table's marks, plaque rims and arrows (WCAG 1.4.11, 3:1): usable/chosen gold, target and danger red, attack
  // amber, loyalty's mana blue, a life gain's green (prompt 44), the sick chip's violet rim - on the board (leather), on the former desk (wood - gone with the arena, prompt 56) frame) and on the panels. The marks differ by
  // more than colour (glow against frame, an arrow, the chips' words), as WCAG 1.4.1 asks.
  it.each(
    ["primary", "foreground", "table-gold-light", "table-danger", "table-attack", "table-mana", "table-heal", "table-sick"].flatMap((mark) =>
      ["table-leather", "table-panel", "table-plaque"].map((surface) => [mark, surface] as const),
    ),
  )("the table mark %s on %s reaches 3:1", (mark, surface) => {
    expect(contrast(mark, surface)).toBeGreaterThanOrEqual(3)
  })

  it("the table's tokens are all there and mapped for Tailwind", () => {
    const names = ["gold-light", "gold-dark", "gold-line", "mana", "danger", "attack", "heal", "sick", "leather", "panel", "plaque"]
    for (const name of names) {
      expect(rootBlock).toMatch(new RegExp(`--table-${name}:\\s*oklch\\(`))
      expect(css).toContain(`--color-table-${name}: var(--table-${name});`)
    }
  })

  // The menu style (series openmana-menuestil, prompt 57): the app's bars in the table's panel tone falling darker, the
  // navigation's gold mark. Text on both ends of each bar's gradient - the words of the tab bar and the sidebar (inactive
  // muted, active --gold-light), the wordmark's gold, the bars' symbols - reaches 4.5:1; the gold line of the active
  // destination and the focus ring 3:1. The mixes are read from index.css, so the check follows the tokens.
  describe("the menu style's bars", () => {
    const BARS = ["bar-top", "bar-bottom", "rail-top", "rail-bottom", "dock-top", "dock-bottom"] as const

    it("its tokens are all there, only derived from existing ones (no new hue), and mapped for Tailwind", () => {
      const names = ["gold-light", "gold-dark", "gold-line", "gold-glow", "panel", "panel-shade", ...BARS]
      for (const name of [...names, "surface-cool"]) {
        expect(rootBlock).toMatch(new RegExp(`--${name}:\\s*(var|color-mix)\\(`))
        expect(tokens.has(name)).toBe(false)
      }
      for (const name of names) expect(css).toContain(`--color-${name}: var(--${name});`)
      for (const name of BARS) expect(shade(name)[1]).toBeGreaterThan(0)
    })

    it.each(
      ["foreground", "muted-foreground", "gold-light", "primary"].flatMap((text) => BARS.map((bar) => [text, bar] as const)),
    )("%s on %s reaches 4.5:1", (text, bar) => {
      expect(ratio(shell(text), shell(bar))).toBeGreaterThanOrEqual(4.5)
    })

    it.each(["rail-top", "rail-bottom"])("the active sidebar entry (--gold-light on the gold shimmer over %s) reaches 4.5:1", (rail) => {
      expect(ratio(shell("gold-light"), blend(shell("primary"), glowShare(), shell(rail)))).toBeGreaterThanOrEqual(4.5)
    })

    it("the bar's round symbol button: --gold-light on --panel-shade reaches 4.5:1", () => {
      expect(ratio(shell("gold-light"), shell("panel-shade"))).toBeGreaterThanOrEqual(4.5)
    })

    it.each(BARS.flatMap((bar) => ["primary", "ring"].map((mark) => [mark, bar] as const)))("the mark %s on %s reaches 3:1", (mark, bar) => {
      expect(ratio(shell(mark), shell(bar))).toBeGreaterThanOrEqual(3)
    })
  })

  // The menu style's components (prompt 58): Card and Dialog as the table's panel (--panel at 94 % over the night blue
  // at the top, --panel-shade at 94 % at the bottom), the golden main button (--gold-light over --primary to
  // --gold-deep), fields and list rows on a panel's darker well (--panel-well), the overlays on --panel. Text 4.5:1 on
  // every tone; the boundary of a form control (--gold-edge), the chosen gold and the focus ring 3:1. The gold
  // hairline --gold-line (cards, outline buttons, badges, overlays) is decoration beside words and not checked here.
  describe("the menu style's components", () => {
    const alpha = (name: string, pattern: RegExp) => {
      const match = pattern.exec(rootBlock)
      if (!match) throw new Error(`--${name} is not what the test expects`)
      return Number(match[1]) / 100
    }
    const edge = alpha("gold-edge", /--gold-edge:\s*color-mix\(in oklch, var\(--primary\) (\d+)%, transparent\);/)
    const deepShare = alpha("gold-deep", /--gold-deep:\s*color-mix\(in oklch, var\(--primary\) (\d+)%, var\(--gold-dark\)\);/)
    const well = alpha("panel-well", /--panel-well:\s*oklch\(0 0 0 \/ (\d+)%\);/)
    const black: [number, number, number] = [0, 0, 0]
    const background = shell("background")
    type Rgb = [number, number, number]
    const PANEL: Record<string, Rgb> = {
      "panel top": blend(shell("panel"), 0.94, background),
      "panel bottom": blend(shell("panel-shade"), 0.94, background),
      "overlay": shell("panel"),
      "overlay bottom": shell("panel-shade"),
    }
    const WELLS: Record<string, Rgb> = {
      "well on the panel top": blend(black, well, PANEL["panel top"]!),
      "well on the panel bottom": blend(black, well, PANEL["panel bottom"]!),
      "well on the page": blend(black, well, background),
    }
    const gold = () => {
      const [l1, c1, h1] = shade("primary")[0]
      const [l2, c2, h2] = shade("gold-dark")[0]
      return srgb([l1 * deepShare + l2 * (1 - deepShare), c1 * deepShare + c2 * (1 - deepShare), h1 * deepShare + h2 * (1 - deepShare)])
    }

    it("its tokens are derived (no new hue) and mapped for Tailwind", () => {
      for (const name of ["gold-edge", "gold-deep", "panel-well"]) {
        expect(tokens.has(name)).toBe(false)
        expect(css).toContain(`--color-${name}: var(--${name});`)
      }
      expect(edge).toBeGreaterThan(0.38)
      expect(css).toMatch(/--shadow-panel:/)
      expect(css).toMatch(/--shadow-gold-button:/)
    })

    it.each([
      ["--gold-light", () => shell("gold-light")],
      ["--primary", () => shell("primary")],
      ["--gold-deep", gold],
    ])("the main button's words (--primary-foreground) on its gold %s reach 4.5:1", (_, tone) => {
      expect(ratio(shell("primary-foreground"), tone())).toBeGreaterThanOrEqual(4.5)
    })

    it.each(
      ["foreground", "muted-foreground", "gold-light", "primary", "destructive"].flatMap((text) => Object.keys(PANEL).map((surface) => [text, surface] as const)),
    )("text %s on the %s reaches 4.5:1", (text, surface) => {
      expect(ratio(shell(text), PANEL[surface]!)).toBeGreaterThanOrEqual(4.5)
    })

    it.each(["foreground", "muted-foreground"].flatMap((text) => Object.keys(WELLS).map((surface) => [text, surface] as const)))(
      "a field's text or placeholder (%s) on the %s reaches 4.5:1",
      (text, surface) => {
        expect(ratio(shell(text), WELLS[surface]!)).toBeGreaterThanOrEqual(4.5)
      },
    )

    it.each(Object.keys(WELLS).flatMap((surface) => [[surface, "the well"], [surface, "the ground around it"]] as const))(
      "a form control's gold boundary (--gold-edge) on the %s reaches 3:1 against %s",
      (surface, against) => {
        const inside = WELLS[surface]!
        const outside = surface.endsWith("page") ? background : PANEL[surface.endsWith("top") ? "panel top" : "panel bottom"]!
        const line = blend(shell("primary"), edge, inside)
        expect(ratio(line, against === "the well" ? inside : outside)).toBeGreaterThanOrEqual(3)
      },
    )

    it.each(Object.keys(PANEL).flatMap((surface) => ["primary", "ring", "gold-light"].map((mark) => [mark, surface] as const)))(
      "the mark %s (chosen, focus) on the %s reaches 3:1",
      (mark, surface) => {
        expect(ratio(shell(mark), PANEL[surface]!)).toBeGreaterThanOrEqual(3)
      },
    )

    it.each(["panel-shade", "panel"])("words on a pill or badge: --foreground on %s reaches 4.5:1", (surface) => {
      expect(ratio(shell("foreground"), shell(surface))).toBeGreaterThanOrEqual(4.5)
    })

    it.each(["panel-shade", "panel"])("a toggle that is on (--gold-light on the gold shimmer over %s) reaches 4.5:1", (surface) => {
      expect(ratio(shell("gold-light"), blend(shell("primary"), glowShare(), shell(surface)))).toBeGreaterThanOrEqual(4.5)
    })

    it.each([...Object.keys(WELLS), ...Object.keys(PANEL)])("a chosen choice card's words (--foreground, --muted-foreground on the gold shimmer over the %s) reach 4.5:1", (surface) => {
      const under = { ...WELLS, ...PANEL }[surface]!
      for (const text of ["foreground", "muted-foreground"]) expect(ratio(shell(text), blend(shell("primary"), glowShare(), under))).toBeGreaterThanOrEqual(4.5)
    })

    // Prompt 59: a notice (Alert) lies on the well - on a panel or on the page -, its words plain or destructive.
    it.each(["foreground", "muted-foreground", "destructive"].flatMap((text) => Object.keys(WELLS).map((surface) => [text, surface] as const)))(
      "a notice's words (%s) on the %s reach 4.5:1",
      (text, surface) => {
        expect(ratio(shell(text), WELLS[surface]!)).toBeGreaterThanOrEqual(4.5)
      },
    )

    // Prompt 59: a deck tile (a Card that is a link) shows the stronger gold line on hover: 3:1 against the page.
    it("a deck tile's hover line (--gold-edge) reaches 3:1 against the page", () => {
      expect(ratio(blend(shell("primary"), edge, background), background)).toBeGreaterThanOrEqual(3)
    })
  })

  it("the manifest's theme colour is the background token", () => {
    expect(hex(srgb(tokens.get("background")!))).toBe("#0d121b")
  })

  it("one dark palette only (no light theme)", () => {
    expect(css).not.toMatch(/\.dark\s*\{/)
    expect(css.match(/:root\s*\{/g)).toHaveLength(1)
  })
})
