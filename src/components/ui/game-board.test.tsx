/*
 * The game board's grid plans (prompt 38, docs/design/SPIELTISCH.md §3): one
 * plan per table layout - hoch (also the fallback without a variant),
 * quadrat, breit and breit in a low window - each with all eight regions as
 * rectangles where the specification puts them, the growth of the decision
 * and no arrangement by orientation any more. jsdom has no layout: the plans
 * are read from the classes; the real browser checks the same arrangement at
 * every size (end-to-end test, checkTableArrangement).
 */
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { GameBoard, GameBoardArea, type GameBoardAreaName, type GameBoardDecision } from "./game-board"

const AREAS: readonly GameBoardAreaName[] = ["header", "opponent", "opponent-field", "center", "field", "me", "decision", "hand"]

/** The board's classes for a decision. */
function boardClasses(decision: GameBoardDecision = "compact"): string[] {
  const { container } = render(<GameBoard decision={decision} />)
  return (container.firstElementChild as HTMLElement).className.split(/\s+/)
}

/** The value of the one class with exactly this variant prefix, e.g. ("breit:", "grid-cols-"); no variant: "". */
function valueOf(classes: readonly string[], prefix: string, utility: string): string {
  const found = classes.filter((name) => {
    const at = name.indexOf(utility)
    return at >= 0 && name.slice(0, at) === prefix
  })
  expect(found, `${prefix}${utility}`).toHaveLength(1)
  return found[0]!.slice(prefix.length + utility.length)
}

/** The rows of cells of a plan (its grid-template-areas). */
function cellsOf(classes: readonly string[], prefix: string): string[][] {
  return [...valueOf(classes, prefix, "[grid-template-areas:").matchAll(/'([^']*)'/g)].map((match) => match[1]!.split("_"))
}

/** The grid of a plan: its rows of cells, its number of columns and of rows. */
function plan(classes: readonly string[], prefix: string): { cells: string[][]; columns: number; rows: number } {
  const tracks = (value: string) => (value === "1" ? 1 : value.slice(1, -1).replace(/\([^)]*\)/g, "").split("_").length)
  return { cells: cellsOf(classes, prefix), columns: tracks(valueOf(classes, prefix, "grid-cols-")), rows: tracks(valueOf(classes, prefix, "grid-rows-")) }
}

/** Where each area lies: its first and last row and column; checks that it is one rectangle. */
function boxes(cells: string[][]): Record<string, { top: number; bottom: number; left: number; right: number }> {
  const out: Record<string, { top: number; bottom: number; left: number; right: number }> = {}
  cells.forEach((row, y) =>
    row.forEach((name, x) => {
      if (name === ".") return
      const box = out[name] ?? { top: y, bottom: y, left: x, right: x }
      out[name] = { top: Math.min(box.top, y), bottom: Math.max(box.bottom, y), left: Math.min(box.left, x), right: Math.max(box.right, x) }
    }),
  )
  for (const [name, box] of Object.entries(out)) {
    for (let y = box.top; y <= box.bottom; y++) for (let x = box.left; x <= box.right; x++) expect(cells[y]![x], `${name} is a rectangle`).toBe(name)
  }
  return out
}

const PLANS = {
  hoch: "",
  quadrat: "quadrat:",
  breit: "breit:",
  "breit-short": "breit:short:",
} as const

describe("the grid plans by table layout", () => {
  it.each(Object.entries(PLANS))("%s: all eight regions (stack and combat aside only for an expanded decision in a low window), each a rectangle, the template as large as the grid", (_, prefix) => {
    for (const decision of ["compact", "expanded"] as const) {
      const classes = boardClasses(decision)
      const grid = plan(classes, prefix)
      // A layout with a plan of its own for an expanded decision uses it then.
      const own = `${prefix}data-[decision=expanded]:`
      const cells = decision === "expanded" && classes.some((name) => name.startsWith(`${own}[grid-template-areas:`)) ? cellsOf(classes, own) : grid.cells
      expect(cells).toHaveLength(grid.rows)
      for (const row of cells) expect(row).toHaveLength(grid.columns)
      // Only a low window sets stack and combat aside for an expanded decision (its region is hidden then).
      const shown = prefix === PLANS["breit-short"] && decision === "expanded" ? AREAS.filter((name) => name !== "center") : AREAS
      expect(Object.keys(boxes(cells)).sort()).toEqual([...shown].sort())
    }
  })

  it("hoch: one column, top to bottom - the decision as the action bar at the very bottom, below the hand", () => {
    const { cells } = plan(boardClasses(), PLANS.hoch)
    expect(cells.map((row) => row[0])).toEqual(["header", "opponent", "opponent-field", "center", "field", "me", "hand", "decision"])
  })

  it("quadrat: the battlefields' column with the hand; on the right the Zauberchronik next to the opponent, the decision below - from the opponent's battlefield down while expanded", () => {
    const compact = boxes(plan(boardClasses(), PLANS.quadrat).cells)
    expect(compact["header"]).toMatchObject({ top: 0, left: 0, right: 1 })
    for (const area of ["opponent", "opponent-field", "field", "me", "hand"]) expect(compact[area]).toMatchObject({ left: 0, right: 0 })
    expect([compact["opponent"]!.top, compact["opponent-field"]!.top, compact["field"]!.top, compact["me"]!.top, compact["hand"]!.top]).toEqual([1, 2, 4, 5, 6])
    expect(compact["center"]).toEqual({ top: 1, bottom: 2, left: 1, right: 1 })
    // From the centre line (an empty row between the battlefields) down to the bottom.
    expect(compact["decision"]).toEqual({ top: 3, bottom: 6, left: 1, right: 1 })
    const classes = boardClasses("expanded")
    const expanded = boxes(cellsOf(classes, "quadrat:data-[decision=expanded]:"))
    expect(expanded["center"]).toEqual({ top: 1, bottom: 1, left: 1, right: 1 })
    expect(expanded["decision"]).toEqual({ top: 2, bottom: 6, left: 1, right: 1 })
  })

  it("breit: a column on each side of the battlefields from the header to the bottom - Zauberchronik left, decision right, the hand between them", () => {
    const grid = boxes(plan(boardClasses(), PLANS.breit).cells)
    expect(grid["header"]).toEqual({ top: 0, bottom: 0, left: 0, right: 2 })
    expect(grid["center"]).toEqual({ top: 1, bottom: 6, left: 0, right: 0 })
    expect(grid["decision"]).toEqual({ top: 1, bottom: 6, left: 2, right: 2 })
    for (const area of ["opponent", "opponent-field", "field", "me", "hand"]) expect(grid[area]).toMatchObject({ left: 1, right: 1 })
    expect([grid["opponent"]!.top, grid["opponent-field"]!.top, grid["field"]!.top, grid["me"]!.top, grid["hand"]!.top]).toEqual([1, 2, 4, 5, 6])
    // No plan of its own for an expanded decision: its column is already full height.
    expect(boardClasses("expanded").some((name) => name.startsWith("breit:data-"))).toBe(false)
  })

  it("breit in a low window: the side column of prompts 13-24 - an expanded decision takes both middle rows, stack and combat step aside", () => {
    expect(plan(boardClasses(), PLANS["breit-short"]).cells).toEqual([
      ["header", "opponent"],
      ["opponent-field", "center"],
      ["field", "decision"],
      ["hand", "me"],
    ])
    expect(cellsOf(boardClasses("expanded"), "breit:short:data-[decision=expanded]:")).toEqual([
      ["header", "opponent"],
      ["opponent-field", "decision"],
      ["field", "decision"],
      ["hand", "me"],
    ])
    const { container } = render(<GameBoardArea area="center" />)
    expect((container.firstElementChild as HTMLElement).className).toContain("breit:short:group-data-[decision=expanded]/board:hidden")
  })
})

describe("the regions' growth", () => {
  const area = (name: GameBoardAreaName) => {
    const { container } = render(<GameBoardArea area={name} />)
    return (container.firstElementChild as HTMLElement).className.split(/\s+/)
  }

  it("hoch: the action bar grows upwards - tall up to 28 %, expanded up to 36 % of the height; the stack bar shrinks beside an expanded decision", () => {
    const decision = area("decision")
    expect(decision).toContain("max-h-[clamp(7rem,18dvh,11rem)]")
    expect(decision).toContain("hoch:group-data-[decision=tall]/board:max-h-[clamp(9rem,28dvh,20rem)]")
    expect(decision).toContain("hoch:group-data-[decision=expanded]/board:max-h-[clamp(9rem,36dvh,26rem)]")
    expect(area("center")).toContain("hoch:group-data-[decision=expanded]/board:max-h-[clamp(3rem,10dvh,5rem)]")
  })

  it("beside the battlefields the decision and the Zauberchronik take their column's height; in quadrat the chronicle keeps a small strip while the decision is expanded", () => {
    for (const layout of ["quadrat", "breit"]) {
      expect(area("decision")).toContain(`${layout}:max-h-none`)
      expect(area("center")).toContain(`${layout}:max-h-none`)
    }
    expect(area("center")).toContain("quadrat:group-data-[decision=expanded]/board:max-h-[clamp(3rem,10dvh,5rem)]")
  })

  it("nothing is arranged by orientation any more (prompt 38): only the layouts and short", () => {
    for (const classes of [boardClasses(), boardClasses("expanded"), ...AREAS.map(area)]) {
      expect(classes.filter((name) => /(^|:)(portrait|landscape):/.test(name))).toEqual([])
    }
  })
})
