// @vitest-environment node
/*
 * The ORYX SDK is an unchanged copy of the master in oryx-games/shared (every
 * game carries the same file; it is never edited here). An update copies both
 * files anew and changes the checksums below - nothing else.
 */
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { ORYX_SDK_VERSION } from "./oryx-sdk.js"

const sha256 = (file: string) => createHash("sha256").update(readFileSync(path.join(import.meta.dirname, file))).digest("hex")

describe("the vendored ORYX SDK", () => {
  it("is oryx-games/shared/oryx-sdk.js 1.0.0, byte for byte, with its types", () => {
    expect(ORYX_SDK_VERSION).toBe("1.0.0")
    expect(sha256("oryx-sdk.js")).toBe("ebbc3309bd2ff06d05fe4550209e0e25df3ca1c83dd5c0043702fb17b273776c")
    expect(sha256("oryx-sdk.d.ts")).toBe("cfb808f4458902759b3c7592d1456fdd1d41fb4a1fc0c9c36b77a27b0d1b3260")
  })
})
