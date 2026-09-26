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
  it("is oryx-games/shared/oryx-sdk.js 1.1.0, byte for byte, with its types", () => {
    expect(ORYX_SDK_VERSION).toBe("1.1.0")
    expect(sha256("oryx-sdk.js")).toBe("7d93919e191461551e942d74aad02fc6d6108cb1d6b856ceb4e09df576986195")
    expect(sha256("oryx-sdk.d.ts")).toBe("ed722d60159bdd6df82ee95af8ae631fa5367662a99edf4fe91e4736c9ac7781")
  })
})
