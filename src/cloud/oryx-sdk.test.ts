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
  it("is oryx-games/shared/oryx-sdk.js 1.1.1, byte for byte, with its types", () => {
    expect(ORYX_SDK_VERSION).toBe("1.1.1")
    expect(sha256("oryx-sdk.js")).toBe("49d079fddd5e53f7f7380f48c9bbd838fe77da166dc6855dba57de9147130b9a")
    expect(sha256("oryx-sdk.d.ts")).toBe("5f88da06595e3ed9094c6c4e000e54d935ec8b43b5886c71767f1a10fd6ea54e")
  })
})
