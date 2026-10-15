// @vitest-environment node
/*
 * Less motion (prompt 12): every animation and transition of the shadcn
 * components stops when the device or the player asks for less motion, and
 * the motion-reduce variant means exactly that.
 *
 * The game table (prompt 36, docs/design/SPIELTISCH.md §8): its components in
 * src/game/table/** follow the same class rule, and its one stylesheet
 * (src/game/table/table.css) may move things only with transform and opacity,
 * only under [data-slot="game-board"], and switches every animation and
 * transition of the table off for the device's prefers-reduced-motion and the
 * player's <html data-reduced-motion>. Nothing moves the table around these
 * rules: no inline animation styles, no SVG (SMIL) animation, and code that
 * animates itself (element.animate) asks src/app/motion.ts.
 *
 * The table's own motion (prompt 44, docs/design/SPIELTISCH.md §8): one place
 * animates in code - src/game/table/table-motion.tsx -, it asks
 * motionReducedNow() before it measures or moves anything and stops when the
 * wish for less motion changes (watchReducedMotion), and all its keyframes
 * come from src/game/table/motion-plan.ts, which builds only transform and
 * opacity. Prompt 46 adds a hand card dragged onto the battlefield: its
 * picture follows the pointer by its transform, glides back or fades there -
 * in the same file, with the same keyframe builders and the same question.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { KEYFRAME_SAMPLES, MOTION_PROPERTIES } from "@/game/table/motion-plan"
import { MOTION, reducedMotion, REDUCED_MOTION_ATTRIBUTE } from "./motion"

const root = path.resolve(import.meta.dirname, "..", "..")
const UI = path.join(root, "src", "components", "ui")
const TABLE = path.join(root, "src", "game", "table")
const TABLE_STYLESHEET = "table.css"

/** An animation utility (with any variant), except the spinner's turn: a loading indicator keeps turning so nothing looks frozen. */
const ANIMATION = /(?<![\w-])(?:[\w[\]=\-/:&>.()]*:)?animate-(?!spin\b|none\b)[a-z]/
const TRANSITION = /(?<![\w-])(?:[\w[\]=\-/:&>.()]*:)?transition(?:-(?!none\b)[\w[\],-]+)?(?![\w-])/

/** The class strings of a component with an animation or transition that does not stop under motion-reduce; counts what it checked. */
function classProblems(file: string, source: string): { readonly problems: string[]; readonly checked: number } {
  const problems: string[] = []
  let checked = 0
  for (const [, classes] of source.matchAll(/"([^"\n]*)"/g)) {
    if (ANIMATION.test(classes!)) {
      checked++
      if (!classes!.includes("motion-reduce:animate-none!")) problems.push(`${file}: an animation without motion-reduce:animate-none! (${classes!.slice(0, 60)}…)`)
    }
    if (TRANSITION.test(classes!)) {
      checked++
      if (!classes!.includes("motion-reduce:transition-none!")) problems.push(`${file}: a transition without motion-reduce:transition-none! (${classes!.slice(0, 60)}…)`)
    }
  }
  return { problems, checked }
}

/** Code of the table that would move things around table.css and the motion-reduce variant. */
function tableCodeProblems(file: string, source: string): string[] {
  const problems: string[] = []
  if (/\b(?:animation|transition)(?:Name|Duration|Delay|Property|TimingFunction|IterationCount|Direction|FillMode|PlayState)?\s*:/.test(source))
    problems.push(`${file}: an animation or transition in an inline style (motion belongs into ${TABLE_STYLESHEET} or classes with motion-reduce)`)
  if (/<(?:animate|animateTransform|animateMotion|set)\b/.test(source)) problems.push(`${file}: an SVG (SMIL) animation, which less motion cannot stop`)
  if (/\.animate\(/.test(source) && !/from\s+["'](?:@\/app\/motion|(?:\.\.\/)+app\/motion)["']/.test(source))
    problems.push(`${file}: element.animate() without asking src/app/motion.ts`)
  return problems
}

// ── A small CSS reader: enough for the table's stylesheet (blocks, nesting, at-rules, declarations). ──

interface CssBlock {
  readonly prelude: string
  readonly body: string
}

/** Splits at `separator` outside quotes and parentheses. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quote !== null) {
      if (c === quote && text[i - 1] !== "\\") quote = null
    } else if (c === '"' || c === "'") quote = c
    else if (c === "(") depth++
    else if (c === ")") depth--
    else if (c === separator && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((part) => part.trim()).filter((part) => part !== "")
}

/** The blocks of one level and the declarations (or at-statements) between them. */
function readLevel(css: string): { readonly blocks: CssBlock[]; readonly declarations: string[] } {
  const blocks: CssBlock[] = []
  let loose = ""
  let depth = 0
  let quote: string | null = null
  let from = 0
  let prelude = ""
  let bodyStart = 0
  for (let i = 0; i < css.length; i++) {
    const c = css[i]!
    if (quote !== null) {
      if (c === quote && css[i - 1] !== "\\") quote = null
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === "{") {
      if (depth === 0) {
        // What stands before the block up to the last ";" are declarations; the rest is the block's prelude.
        const before = css.slice(from, i)
        const cut = before.lastIndexOf(";")
        loose += before.slice(0, cut + 1)
        prelude = before.slice(cut + 1)
        bodyStart = i + 1
      }
      depth++
    } else if (c === "}") {
      depth--
      if (depth === 0) {
        blocks.push({ prelude: prelude.trim(), body: css.slice(bodyStart, i) })
        from = i + 1
      }
    }
  }
  loose += css.slice(from)
  return { blocks, declarations: splitTop(loose, ";") }
}

const BOARD = '[data-slot="game-board"]'
const REDUCED = `:where([${REDUCED_MOTION_ATTRIBUTE}]) `
/** Transform and opacity: what the compositor moves without layout or paint (docs/design/SPIELTISCH.md §8). */
const MOVING = new Set(["transform", "translate", "rotate", "scale", "opacity"])
const TIMING = /^(?:-?[\d.]+m?s|ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|[\w-]+\(.*\))$/
const ANIMATION_KEYWORDS = new Set(["infinite", "normal", "reverse", "alternate", "alternate-reverse", "forwards", "backwards", "both", "running", "paused"])

/**
 * What is wrong with a stylesheet of the game table: a rule outside the board,
 * a transition or animation of anything but transform and opacity, an
 * animation without its keyframes here, motion set !important outside the two
 * less-motion blocks, or a missing less-motion block.
 */
function tableCssProblems(source: string): string[] {
  const problems: string[] = []
  const keyframes = new Set<string>()
  const used: string[] = []
  const resets = { media: new Set<string>(), attribute: new Set<string>() }
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "")

  function declarations(list: readonly string[], where: string, reset: "media" | "attribute" | null): void {
    const motion = { animation: false, transition: false }
    for (const declaration of list) {
      const colon = declaration.indexOf(":")
      if (colon < 0) {
        problems.push(`${where}: "${declaration}" is not a declaration`)
        continue
      }
      const property = declaration.slice(0, colon).trim().toLowerCase()
      const raw = declaration.slice(colon + 1).trim()
      const important = /!\s*important$/i.test(raw)
      const value = raw.replace(/!\s*important$/i, "").trim()
      const isAnimation = property === "animation" || property === "animation-name"
      const isTransition = property === "transition" || property === "transition-property"
      if (!isAnimation && !isTransition) continue
      if (important) {
        if (reset !== null && value === "none") motion[isAnimation ? "animation" : "transition"] = true
        else problems.push(`${where}: ${property} set !important outside the less-motion blocks`)
        continue
      }
      for (const part of splitTop(value, ",")) {
        const tokens = splitTop(part, " ")
        if (isAnimation) {
          const names = property === "animation-name" ? tokens : tokens.filter((token) => !TIMING.test(token) && !ANIMATION_KEYWORDS.has(token) && !/^[\d.]+$/.test(token))
          for (const name of names) if (name !== "none") used.push(name)
        } else {
          const names = property === "transition-property" ? tokens : tokens.filter((token) => !TIMING.test(token) && token !== "allow-discrete" && token !== "normal")
          if (names.length === 0) problems.push(`${where}: "${property}: ${value}" moves every property (name transform or opacity)`)
          for (const name of names) if (name !== "none" && !MOVING.has(name)) problems.push(`${where}: a transition of ${name} (only transform and opacity)`)
        }
      }
    }
    if (reset !== null && motion.animation && motion.transition) for (const selector of splitTop(where, ",")) resets[reset].add(selector)
  }

  function walk(text: string, scoped: boolean, reduced: boolean): void {
    const level = readLevel(text)
    if (level.declarations.length > 0 && !scoped) problems.push(`a statement outside every rule: ${level.declarations.join("; ").slice(0, 80)}`)
    for (const { prelude, body } of level.blocks) {
      const at = /^@([\w-]+)\s*(.*)$/s.exec(prelude)
      if (at) {
        const [, rule, condition] = at as unknown as [string, string, string]
        if (rule === "keyframes" || rule === "-webkit-keyframes") {
          keyframes.add(condition.trim())
          for (const frame of readLevel(body).blocks) {
            for (const declaration of splitTop(frame.body, ";")) {
              const property = declaration.slice(0, declaration.indexOf(":")).trim().toLowerCase()
              if (!MOVING.has(property) && property !== "animation-timing-function") problems.push(`@keyframes ${condition.trim()}: animates ${property} (only transform and opacity)`)
            }
          }
        } else if (rule === "media" || rule === "supports" || rule === "container" || rule === "layer") {
          walk(body, scoped, reduced || (rule === "media" && /prefers-reduced-motion:\s*reduce/.test(condition)))
        } else problems.push(`an unexpected @${rule} in the table's stylesheet`)
        continue
      }
      const selectors = splitTop(prelude, ",")
      if (!scoped) for (const selector of selectors) if (!selector.includes(BOARD)) problems.push(`"${selector}" reaches outside ${BOARD}`)
      const inner = readLevel(body)
      const reset = reduced ? "media" : selectors.every((selector) => selector.startsWith(REDUCED)) ? "attribute" : null
      declarations(inner.declarations, selectors.join(", "), reset)
      for (const nested of inner.blocks) walk(`${nested.prelude}{${nested.body}}`, true, reduced)
    }
  }

  walk(css, false, false)
  for (const name of used) if (!keyframes.has(name)) problems.push(`animation ${name} has no @keyframes in the table's stylesheet`)
  const covered = [BOARD, `${BOARD} *`, `${BOARD} *::before`, `${BOARD} *::after`]
  for (const selector of covered) {
    if (!resets.media.has(selector)) problems.push(`less motion (prefers-reduced-motion) does not stop ${selector}`)
    if (!resets.attribute.has(`${REDUCED}${selector}`)) problems.push(`less motion (${REDUCED_MOTION_ATTRIBUTE}) does not stop ${selector}`)
  }
  return problems
}

/** The less-motion blocks a table stylesheet must end with (as in src/game/table/table.css). */
const RESETS = `
@media (prefers-reduced-motion: reduce) {
  ${BOARD}, ${BOARD} *, ${BOARD} *::before, ${BOARD} *::after { animation: none !important; transition: none !important; }
}
${REDUCED}${BOARD}, ${REDUCED}${BOARD} *, ${REDUCED}${BOARD} *::before, ${REDUCED}${BOARD} *::after { animation: none !important; transition: none !important; }
`

function filesUnder(directory: string): string[] {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true, recursive: true }).filter((entry) => entry.isFile()).map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
}

describe("less motion", () => {
  it("every animation and transition in src/components/ui stops under motion-reduce", () => {
    const missing: string[] = []
    let checked = 0
    for (const file of fs.readdirSync(UI).filter((name) => name.endsWith(".tsx"))) {
      const result = classProblems(file, fs.readFileSync(path.join(UI, file), "utf8"))
      missing.push(...result.problems)
      checked += result.checked
    }
    expect(missing).toEqual([])
    // The dialogs, menus, sheets, tooltips, sidebar, skeleton … all carry some.
    expect(checked).toBeGreaterThan(25)
  })

  // The menu style (prompt 58) brings no motion: its ornaments move nothing, and no class under menu: animates or
  // adds a transition (the golden button's hover brightness runs on the registry's transition-all, which stops).
  it("the menu style adds no motion: ornaments still, nothing under menu: animates", () => {
    const ornament = fs.readFileSync(path.join(UI, "ornament.tsx"), "utf8")
    expect(ornament).not.toMatch(/\b(?:animate-|transition)/)
    const moving: string[] = []
    for (const file of fs.readdirSync(UI).filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))) {
      const source = fs.readFileSync(path.join(UI, file), "utf8")
      for (const match of source.matchAll(/menu:[^\s"'`]*(?:animate-|transition|duration-)[^\s"'`]*/g)) moving.push(`${file}: ${match[0]}`)
    }
    expect(moving).toEqual([])
  })

  it("motion-reduce means: the device asks for it, or <html data-reduced-motion>", () => {
    const css = fs.readFileSync(path.join(root, "src", "index.css"), "utf8")
    const variant = /@custom-variant motion-reduce \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ""
    expect(variant).toContain("@media (prefers-reduced-motion: reduce)")
    expect(variant).toContain(`&:where([${REDUCED_MOTION_ATTRIBUTE}], [${REDUCED_MOTION_ATTRIBUTE}] *)`)
  })

  it("the setting can only add a reduction", () => {
    expect(reducedMotion("system", false)).toBe(false)
    expect(reducedMotion("system", true)).toBe(true)
    expect(reducedMotion("reduce", false)).toBe(true)
    expect(reducedMotion("reduce", true)).toBe(true)
    expect(MOTION.fallback).toBe("system")
    expect(MOTION.check("reduce") && MOTION.check("system")).toBe(true)
    expect(MOTION.check("never")).toBe(false)
  })
})

describe("less motion on the game table", () => {
  it("the table has one stylesheet, src/game/table/table.css; src has no other CSS than index.css", () => {
    expect(filesUnder(TABLE).filter((file) => file.endsWith(".css"))).toEqual([TABLE_STYLESHEET])
    const css = filesUnder(path.join(root, "src")).filter((file) => file.endsWith(".css")).sort()
    expect(css).toEqual(["game/table/table.css", "index.css"].map((file) => file.split("/").join(path.sep)))
  })

  it("the table's stylesheet stays on the board, moves only transform and opacity and stops under less motion", () => {
    expect(tableCssProblems(fs.readFileSync(path.join(TABLE, TABLE_STYLESHEET), "utf8"))).toEqual([])
  })

  it("the table's components follow the motion-reduce rule and move nothing around it", () => {
    const problems: string[] = []
    const files = filesUnder(TABLE).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    for (const file of files) {
      const source = fs.readFileSync(path.join(TABLE, file), "utf8")
      problems.push(...classProblems(file, source).problems, ...tableCodeProblems(file, source))
    }
    expect(problems).toEqual([])
    expect(files.length).toBeGreaterThan(0)
  })

  it("the table's own motion (prompt 44): one file animates, it asks for less motion first, its keyframes move only transform and opacity", () => {
    const files = filesUnder(TABLE).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    const animating = files.filter((file) => /\.animate\(/.test(fs.readFileSync(path.join(TABLE, file), "utf8")))
    expect(animating).toEqual(["table-motion.tsx"])
    const source = fs.readFileSync(path.join(TABLE, "table-motion.tsx"), "utf8")
    // Less motion is asked before anything is measured or moved, and a change of the wish stops what runs.
    expect(source).toMatch(/import \{[^}]*\bmotionReducedNow\b[^}]*\bwatchReducedMotion\b[^}]*\} from "@\/app\/motion"/)
    expect(source).toMatch(/private allowed\(\): boolean \{\s*return canAnimate\(\) && !motionReducedNow\(\)/)
    expect(source).toContain("watchReducedMotion(")
    // No keyframes written in place: every .animate( takes a builder of motion-plan.ts.
    expect(source).not.toMatch(/\.animate\(\s*[[{]/)
    const calls = [...source.matchAll(/\.animate\(\s*(?:[^(),]*\?\s*)?([A-Za-z]+)\(/g)].map((match) => match[1])
    expect(calls.length).toBe(source.match(/\.animate\(/g)?.length)
    // Prompt 46: a dragged hand card glides back (travelFrames) or fades where it was dropped (dropFadeFrames).
    expect(new Set(calls)).toEqual(new Set(["travelFrames", "hiddenWhileTravelling", "vanishFrames", "entryOutFrames", "shiftFrames", "turnFrames", "appearFrames", "flashFrames", "shakeFrames", "pulseFrames", "entryInFrames", "phaseFrames", "shimmerFrames", "dropFadeFrames"]))
    expect([...MOTION_PROPERTIES]).toEqual(["transform", "opacity"])
    for (const frames of KEYFRAME_SAMPLES) for (const frame of frames) for (const property of Object.keys(frame)) if (property !== "offset") expect(MOVING).toContain(property)
  })

  // The checks above must find what they look for (the table's first motion, the rune ring, came in prompt 37): built examples.
  it("the stylesheet check accepts allowed motion and finds every kind of violation", () => {
    const allowed = `
      ${BOARD} .hand-card { transition: transform 0.22s ease-out, opacity 0.2s; }
      ${BOARD} .glint::after { animation: glint 4.5s ease-in-out infinite; }
      ${BOARD} .rune { animation-name: glint; transition-property: opacity; &:hover { transform: scale(1.1); } }
      @keyframes glint { 0%, 60% { transform: translateX(-120%); opacity: 0; } to { transform: translateX(120%); opacity: 1; animation-timing-function: linear; } }
      @media (min-aspect-ratio: 13/10) { ${BOARD} .panel { transition: opacity 0.3s; } }
      ${RESETS}`
    expect(tableCssProblems(allowed)).toEqual([])

    const violations: readonly [string, string][] = [
      [`.card { transition: transform 0.2s; }`, "reaches outside"],
      [`${BOARD} .card { transition: all 0.2s; }`, "transition of all"],
      [`${BOARD} .card { transition: 0.2s ease; }`, "moves every property"],
      [`${BOARD} .card { transition: box-shadow 0.2s, transform 0.2s; }`, "transition of box-shadow"],
      [`${BOARD} .card { transition-property: outline-color; }`, "transition of outline-color"],
      [`${BOARD} .arrow { animation: flow 0.9s linear infinite; } @keyframes flow { to { stroke-dashoffset: -17; } }`, "animates stroke-dashoffset"],
      [`${BOARD} .target { animation: pulse 1.4s infinite; }`, "animation pulse has no @keyframes"],
      [`${BOARD} .card { animation: none !important; }`, "!important outside the less-motion blocks"],
      [`@font-face { font-family: X; }`, "unexpected @font-face"],
    ]
    for (const [css, expected] of violations) expect(tableCssProblems(`${css}\n${RESETS}`).join("\n")).toContain(expected)

    const withoutMedia = RESETS.replace(/@media[\s\S]*?\}\s*\}/, "")
    expect(tableCssProblems(withoutMedia).join("\n")).toContain("less motion (prefers-reduced-motion) does not stop")
    const withoutAttribute = RESETS.slice(0, RESETS.lastIndexOf(REDUCED + BOARD + ","))
    expect(tableCssProblems(withoutAttribute).join("\n")).toContain(`less motion (${REDUCED_MOTION_ATTRIBUTE}) does not stop`)
    const withoutPseudo = RESETS.replaceAll(`, ${BOARD} *::after`, "")
    expect(tableCssProblems(withoutPseudo).join("\n")).toContain(`does not stop ${BOARD} *::after`)
  })

  it("the component check finds motion around the rules", () => {
    expect(classProblems("x.tsx", `<div className="transition-transform duration-200" />`).problems).toHaveLength(1)
    expect(classProblems("x.tsx", `<div className="transition-transform duration-200 motion-reduce:transition-none!" />`).problems).toEqual([])
    expect(tableCodeProblems("x.tsx", `<div style={{ transition: "transform 0.2s" }} />`)).toHaveLength(1)
    expect(tableCodeProblems("x.tsx", `<div style={{ animationName: "glint" }} />`)).toHaveLength(1)
    expect(tableCodeProblems("x.tsx", `<circle><animate attributeName="r" /></circle>`)).toHaveLength(1)
    expect(tableCodeProblems("x.ts", `card.animate([{ opacity: 0 }], 200)`)).toHaveLength(1)
    expect(tableCodeProblems("x.ts", `import { reducedMotion } from "@/app/motion"\ncard.animate([{ opacity: 0 }], 200)`)).toEqual([])
  })
})
