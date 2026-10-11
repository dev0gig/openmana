// @vitest-environment node
/*
 * The table's background (table-background.ts, 2026-10-12): which stored
 * values count, what the table shows for each choice - a "custom" choice
 * without a stored picture is the drawn table - and how large the player's
 * own picture is stored.
 */
import { describe, expect, it } from "vitest"
import { BUILT_IN_BACKGROUNDS, MAX_SIDE, storedSize, TABLE_BACKGROUND, TABLE_BACKGROUND_IMAGE, tableBackground } from "./table-background"

const PICTURE = "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA="

describe("the stored choice", () => {
  it("is one of the drawn table, the two pictures and the player's own; the drawn table by default", () => {
    expect(TABLE_BACKGROUND.key).toBe("display.tableBackground")
    expect(TABLE_BACKGROUND.fallback).toBe("table")
    for (const value of ["table", "colors", "planeswalker", "grid", "custom"]) expect(TABLE_BACKGROUND.check(value)).toBe(true)
    for (const value of ["wood", "", null, 1, { kind: "table" }]) expect(TABLE_BACKGROUND.check(value)).toBe(false)
  })

  it("keeps the player's picture only as a data: URL of a picture, or none", () => {
    expect(TABLE_BACKGROUND_IMAGE.key).toBe("display.tableBackgroundImage")
    expect(TABLE_BACKGROUND_IMAGE.fallback).toBeNull()
    expect(TABLE_BACKGROUND_IMAGE.check(null)).toBe(true)
    expect(TABLE_BACKGROUND_IMAGE.check(PICTURE)).toBe(true)
    expect(TABLE_BACKGROUND_IMAGE.check("data:image/jpeg;base64,/9j/4AAQ")).toBe(true)
    // No other kind of data, no link to anywhere, nothing that is not base64.
    expect(TABLE_BACKGROUND_IMAGE.check("data:text/html;base64,PGgxPg==")).toBe(false)
    expect(TABLE_BACKGROUND_IMAGE.check("https://example.org/table.webp")).toBe(false)
    expect(TABLE_BACKGROUND_IMAGE.check("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false)
    expect(TABLE_BACKGROUND_IMAGE.check("data:image/png;base64,<script>")).toBe(false)
    expect(TABLE_BACKGROUND_IMAGE.check(`data:image/webp;base64,${"A".repeat(8_000_001)}`)).toBe(false)
  })
})

describe("what the table shows", () => {
  it("the drawing for the drawn table; a built-in picture in both orientations; the player's own picture", () => {
    expect(tableBackground("table", PICTURE)).toEqual({ kind: "table" })
    const colors = tableBackground("colors", null)
    expect(colors).toMatchObject({ kind: "picture", choice: "colors" })
    expect(colors.kind === "picture" && colors.wide !== colors.tall).toBe(true)
    expect(tableBackground("planeswalker", null)).toMatchObject({ kind: "picture", choice: "planeswalker" })
    expect(tableBackground("grid", null)).toMatchObject({ kind: "picture", choice: "grid" })
    expect(tableBackground("custom", PICTURE)).toEqual({ kind: "custom", src: PICTURE })
  })

  it("the drawn table when the player's own picture is chosen but none is stored", () => {
    expect(tableBackground("custom", null)).toEqual({ kind: "table" })
  })

  it("names the three pictures that come with OpenMana", () => {
    expect(BUILT_IN_BACKGROUNDS.map((background) => background.label)).toEqual(["Farbenrad", "Planeswalker", "Chip-Raster"])
  })
})

describe("the player's own picture, stored", () => {
  it("keeps its proportions, its longer side at most MAX_SIDE, never enlarged", () => {
    expect(storedSize(4000, 3000)).toEqual({ width: MAX_SIDE, height: 1920 })
    expect(storedSize(1440, 3200)).toEqual({ width: 1152, height: MAX_SIDE })
    expect(storedSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
