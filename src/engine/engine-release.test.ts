import { describe, expect, it } from "vitest"
import { checkEngineRelease, getEngineRelease } from "./engine-release"

const answer = (status: number) => (async () => new Response(null, { status })) as unknown as typeof fetch

describe("is this version's engine still on the server", () => {
  it("asks for the engine manifest with HEAD past every cache", async () => {
    const calls: [string, RequestInit | undefined][] = []
    const fetcher = (async (url: string, init?: RequestInit) => { calls.push([url, init]); return new Response(null, { status: 200 }) }) as unknown as typeof fetch
    expect(await checkEngineRelease(fetcher)).toBe("served")
    expect(calls).toEqual([["/engine/0123456789abcdef/engine-manifest.json", { method: "HEAD", cache: "no-store" }]])
  })
  it("calls it gone only on 404 or 410", async () => {
    expect(await checkEngineRelease(answer(404))).toBe("gone")
    expect(getEngineRelease()).toBe("gone")
    expect(await checkEngineRelease(answer(410))).toBe("gone")
    expect(await checkEngineRelease(answer(503))).toBe("unknown")
  })
  it("never calls an offline player's app outdated", async () => {
    const offline = (async () => { throw new TypeError("Failed to fetch") }) as unknown as typeof fetch
    expect(await checkEngineRelease(offline)).toBe("unknown")
  })
})
