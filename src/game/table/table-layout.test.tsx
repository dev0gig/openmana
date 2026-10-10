/*
 * The game table's layouts (prompt 36): the decision by aspect ratio, the
 * eight sizes of the end-to-end test and the foldable's three, the media
 * queries shared with the CSS variants of src/index.css, and
 * useTableLayout() following the screen (a stand-in matchMedia that
 * evaluates exactly these queries; the real browser is checked by the
 * end-to-end test, section 12).
 */
import fs from "node:fs"
import path from "node:path"
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TABLE_LAYOUT_QUERIES, TABLE_LAYOUTS, tableLayoutOf, type TableLayout } from "./table-layout"
import { useTableLayout } from "./use-table-layout"

/** The end-to-end test's eight sizes (scripts/e2e/run.ts) and the foldable's (docs/design/SPIELTISCH.md §3). */
const SIZES: readonly (readonly [string, number, number, TableLayout])[] = [
  ["small-phone", 360, 740, "hoch"],
  ["phone", 412, 915, "hoch"],
  ["fold-portrait", 690, 829, "quadrat"],
  ["fold-landscape", 829, 690, "quadrat"],
  ["tablet", 884, 1104, "quadrat"],
  ["tablet-landscape", 1104, 884, "quadrat"],
  ["phone-landscape", 915, 412, "breit"],
  ["desktop", 1440, 900, "breit"],
  ["fold-closed", 480, 1040, "hoch"],
  ["fold-open", 870, 960, "quadrat"],
  ["fold-open-turned", 960, 870, "quadrat"],
]

/** The borders: 3:4 and 13:10 themselves are quadrat, a pixel beyond is not. */
const BORDERS: readonly (readonly [number, number, TableLayout])[] = [
  [299, 400, "hoch"],
  [300, 400, "quadrat"],
  [1300, 1000, "quadrat"],
  [1301, 1000, "breit"],
  [768, 1024, "quadrat"],
  [767, 1024, "hoch"],
]

/** Evaluates the three range queries the layouts use, for a screen of this size, as the browser does (exact ratios). */
function evaluate(query: string, width: number, height: number): boolean {
  const ratio = (text: string) => {
    const [a, b] = text.split("/").map(Number) as [number, number]
    return [a, b] as const
  }
  // width/height compared with a/b without division: width * b against height * a.
  const compare = (text: string) => {
    const [a, b] = ratio(text)
    return width * b - height * a
  }
  let match = /^\(aspect-ratio < ([\d/]+)\)$/.exec(query)
  if (match) return compare(match[1]!) < 0
  match = /^\(aspect-ratio > ([\d/]+)\)$/.exec(query)
  if (match) return compare(match[1]!) > 0
  match = /^\(([\d/]+) <= aspect-ratio <= ([\d/]+)\)$/.exec(query)
  if (match) return compare(match[1]!) >= 0 && compare(match[2]!) <= 0
  throw new Error(`unexpected query ${query}`)
}

/** A screen whose size the test changes; matchMedia answers and announces changes like a browser. */
function fakeScreen(width: number, height: number) {
  const size = { width, height }
  const lists = new Set<{ query: string; matches: boolean; listeners: Set<() => void> }>()
  const matchMedia = vi.fn((query: string) => {
    const entry = { query, matches: evaluate(query, size.width, size.height), listeners: new Set<() => void>() }
    lists.add(entry)
    return {
      media: query,
      get matches() {
        return evaluate(query, size.width, size.height)
      },
      onchange: null,
      addEventListener: (_: string, listener: () => void) => entry.listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => entry.listeners.delete(listener),
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  })
  window.matchMedia = matchMedia
  return {
    resize(nextWidth: number, nextHeight: number) {
      size.width = nextWidth
      size.height = nextHeight
      for (const entry of lists) {
        const now = evaluate(entry.query, nextWidth, nextHeight)
        if (now !== entry.matches) {
          entry.matches = now
          for (const listener of entry.listeners) listener()
        }
      }
    },
    listening: () => [...lists].reduce((count, entry) => count + entry.listeners.size, 0),
  }
}

const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe("table layout", () => {
  it.each(SIZES)("%s (%i×%i) is %s", (_, width, height, layout) => {
    expect(tableLayoutOf(width, height)).toBe(layout)
    expect(TABLE_LAYOUTS.filter((name) => evaluate(TABLE_LAYOUT_QUERIES[name], width, height))).toEqual([layout])
  })

  it.each(BORDERS)("the border %i×%i is %s, in code and by the media queries", (width, height, layout) => {
    expect(tableLayoutOf(width, height)).toBe(layout)
    expect(TABLE_LAYOUTS.filter((name) => evaluate(TABLE_LAYOUT_QUERIES[name], width, height))).toEqual([layout])
  })

  it("exactly one layout applies at every size from 200 to 2000 px", () => {
    for (let width = 200; width <= 2000; width += 37) {
      for (let height = 200; height <= 2000; height += 41) {
        const matching = TABLE_LAYOUTS.filter((name) => evaluate(TABLE_LAYOUT_QUERIES[name], width, height))
        expect(matching).toEqual([tableLayoutOf(width, height)])
      }
    }
  })

  it("the CSS variants hoch:, quadrat: and breit: in src/index.css use the same media queries", () => {
    const css = fs.readFileSync(path.resolve(import.meta.dirname, "../../index.css"), "utf8")
    for (const layout of TABLE_LAYOUTS) {
      expect(css).toContain(`@custom-variant ${layout} (@media ${TABLE_LAYOUT_QUERIES[layout]});`)
    }
    // short: stays as it was (a phone turned sideways is breit and short).
    expect(css).toContain("@custom-variant short (@media (max-height: 32rem));")
  })
})

describe("useTableLayout", () => {
  it.each(SIZES)("on %s (%i×%i) answers %s", (_, width, height, layout) => {
    fakeScreen(width, height)
    const { result } = renderHook(() => useTableLayout())
    expect(result.current).toBe(layout)
  })

  it("follows the screen when it turns, folds or unfolds, and stops listening when it is gone", () => {
    const screen = fakeScreen(480, 1040)
    const { result, unmount } = renderHook(() => useTableLayout())
    expect(result.current).toBe("hoch")
    act(() => screen.resize(870, 960))
    expect(result.current).toBe("quadrat")
    act(() => screen.resize(960, 870))
    expect(result.current).toBe("quadrat")
    act(() => screen.resize(1440, 900))
    expect(result.current).toBe("breit")
    act(() => screen.resize(412, 915))
    expect(result.current).toBe("hoch")
    expect(screen.listening()).toBeGreaterThan(0)
    unmount()
    expect(screen.listening()).toBe(0)
  })

  it("answers hoch without a screen to ask (jsdom's matchMedia answers no query)", () => {
    const { result } = renderHook(() => useTableLayout())
    expect(result.current).toBe("hoch")
  })
})
