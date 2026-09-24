// @vitest-environment node
/* The browser's storage figures and the check before large writes. */
import { describe, expect, it } from "vitest"
import { rejectionOf } from "@/test/storage-fixtures"
import { ensureSpace, isLowOnSpace, LOW_SPACE_BYTES, readStorageSpace } from "./quota"

const manager = (usage: number | undefined, quota: number | undefined, persisted: boolean | undefined) => ({
  estimate: async () => ({ ...(usage === undefined ? {} : { usage }), ...(quota === undefined ? {} : { quota }) }),
  persisted: async () => persisted as boolean,
})

describe("storage space", () => {
  it("reads usage, quota, free space and persistence", async () => {
    expect(await readStorageSpace(manager(1_000, 5_000, true))).toEqual({ usage: 1_000, quota: 5_000, available: 4_000, persisted: true })
  })

  it("never reports negative free space (the browser's figures are estimates)", async () => {
    expect((await readStorageSpace(manager(6_000, 5_000, false))).available).toBe(0)
  })

  it("keeps unknown figures unknown", async () => {
    expect(await readStorageSpace(undefined)).toEqual({ usage: null, quota: null, available: null, persisted: null })
    expect(await readStorageSpace(manager(undefined, 5_000, undefined))).toEqual({ usage: null, quota: 5_000, available: null, persisted: null })
    const failing = { estimate: () => Promise.reject(new Error("no")), persisted: () => Promise.reject(new Error("no")) }
    expect(await readStorageSpace(failing)).toEqual({ usage: null, quota: null, available: null, persisted: null })
  })

  it("blocks a write that clearly does not fit, and only that", async () => {
    await expect(ensureSpace(4_000, manager(1_000, 5_000, false))).resolves.toMatchObject({ available: 4_000 })
    const error = await rejectionOf(ensureSpace(4_001, manager(1_000, 5_000, false)))
    expect(error.code).toBe("insufficient-space")
    await expect(ensureSpace(10 ** 12, undefined)).resolves.toMatchObject({ available: null })
  })

  it("warns below the low-space mark", () => {
    expect(isLowOnSpace({ usage: 0, quota: LOW_SPACE_BYTES - 1, available: LOW_SPACE_BYTES - 1, persisted: false })).toBe(true)
    expect(isLowOnSpace({ usage: 0, quota: LOW_SPACE_BYTES, available: LOW_SPACE_BYTES, persisted: false })).toBe(false)
    expect(isLowOnSpace({ usage: null, quota: null, available: null, persisted: null })).toBe(false)
  })
})
