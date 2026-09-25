// @vitest-environment node
/*
 * Less motion (prompt 12): every animation and transition of the shadcn
 * components stops when the device or the player asks for less motion, and
 * the motion-reduce variant means exactly that.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { MOTION, reducedMotion, REDUCED_MOTION_ATTRIBUTE } from "./motion"

const root = path.resolve(import.meta.dirname, "..", "..")
const UI = path.join(root, "src", "components", "ui")

/** An animation utility (with any variant), except the spinner's turn: a loading indicator keeps turning so nothing looks frozen. */
const ANIMATION = /(?<![\w-])(?:[\w[\]=\-/:&>.()]*:)?animate-(?!spin\b|none\b)[a-z]/
const TRANSITION = /(?<![\w-])(?:[\w[\]=\-/:&>.()]*:)?transition(?:-(?!none\b)[\w[\],-]+)?(?![\w-])/

describe("less motion", () => {
  it("every animation and transition in src/components/ui stops under motion-reduce", () => {
    const missing: string[] = []
    let checked = 0
    for (const file of fs.readdirSync(UI).filter((name) => name.endsWith(".tsx"))) {
      const source = fs.readFileSync(path.join(UI, file), "utf8")
      for (const [, classes] of source.matchAll(/"([^"\n]*)"/g)) {
        if (ANIMATION.test(classes!)) {
          checked++
          if (!classes!.includes("motion-reduce:animate-none!")) missing.push(`${file}: an animation without motion-reduce:animate-none! (${classes!.slice(0, 60)}…)`)
        }
        if (TRANSITION.test(classes!)) {
          checked++
          if (!classes!.includes("motion-reduce:transition-none!")) missing.push(`${file}: a transition without motion-reduce:transition-none! (${classes!.slice(0, 60)}…)`)
        }
      }
    }
    expect(missing).toEqual([])
    // The dialogs, menus, sheets, tooltips, sidebar, skeleton … all carry some.
    expect(checked).toBeGreaterThan(25)
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
