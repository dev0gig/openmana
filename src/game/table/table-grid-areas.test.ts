/*
 * A piece of the table placed into a grid area the board's template lacks
 * opens an implicit column and row beside the board - the whole table shrinks
 * (2026-10-15: the "Zuletzt" line in a low `breit` window while the decision
 * was expanded). Every area table.css names in the low window's block must be
 * in the expanded template too, or the piece must step aside while expanded.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(import.meta.dirname, "..", "..", "..")
const css = fs.readFileSync(path.join(root, "src", "game", "table", "table.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const board = fs.readFileSync(path.join(root, "src", "components", "ui", "game-board.tsx"), "utf8")

/** Every block of a media query (the stylesheet repeats one per topic), braces balanced, joined. */
function mediaBlocks(source: string, query: string): string {
  const blocks: string[] = []
  for (let start = source.indexOf(`@media ${query} {`); start >= 0; start = source.indexOf(`@media ${query} {`, start + 1)) {
    let depth = 0
    for (let at = source.indexOf("{", start); at < source.length; at++) {
      if (source[at] === "{") depth++
      if (source[at] === "}" && --depth === 0) {
        blocks.push(source.slice(source.indexOf("{", start) + 1, at))
        break
      }
    }
  }
  expect(blocks.length, `@media ${query}`).toBeGreaterThan(0)
  return blocks.join("\n")
}

/** The areas of a Tailwind template class ("[grid-template-areas:'a_b'_'c_d']"). */
function areas(template: string): Set<string> {
  return new Set([...template.matchAll(/'([^']+)'/g)].flatMap(([, row]) => row!.split("_")).filter((name) => name !== "."))
}

describe("the table's pieces in a low breit window", () => {
  const low = mediaBlocks(css, "(aspect-ratio > 13/10) and (max-height: 32rem)")
  const expanded = areas(board.match(/"breit:short:data-\[decision=expanded\]:\[grid-template-areas:([^\]]+)\]"/)![1]!)

  it("never ask for an area the expanded decision's template lacks without stepping aside", () => {
    const rules = [...low.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector!.trim(), body: body! }))
    const placed = rules.flatMap((rule) => [...rule.body.matchAll(/grid-area:\s*([\w-]+)\s*;/g)].map(([, area]) => ({ selector: rule.selector, area: area! })))
    expect(placed.length).toBeGreaterThan(0)
    for (const { selector, area } of placed) {
      if (expanded.has(area)) continue
      const piece = selector.replace(/^\[data-slot="game-board"\]\s*/, "")
      const steps = rules.some((rule) => rule.selector.includes('[data-decision="expanded"]') && rule.selector.includes(piece) && /display:\s*none/.test(rule.body))
      expect(steps, `${selector} asks for "${area}" in a low window`).toBe(true)
    }
  })

  it("the \"Zuletzt\" line steps aside while the decision is expanded", () => {
    expect(low).toMatch(/\[data-slot="game-board"\]\[data-decision="expanded"\] > \.table-last-move \{\s*display: none;/)
  })
})
