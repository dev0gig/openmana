import type { AbortReason, EngineAbort } from "@openmana/engine-protocol"
import { describe, expect, it } from "vitest"
import { abortAdvice, abortTitle } from "./engine-labels"

describe("understandable engine failures", () => {
  const reasons: AbortReason[] = ["unsupported-browser", "protocol-mismatch", "transport-error", "boot-failed", "engine-failure", "worker-error", "protocol-violation", "ready-timeout", "terminated"]
  for (const reason of reasons) it(`explains ${reason} independently of the engine's technical prose`, () => {
    const abort: EngineAbort = { type: "engine.abort", reason, origin: "client", message: "arbitrary technical detail" }
    expect(abortTitle(abort).length).toBeGreaterThan(10)
    expect(abortAdvice(abort).length).toBeGreaterThan(30)
    expect(abortAdvice({ ...abort, message: "misleading browser text" })).toBe(abortAdvice(abort))
    expect(abort.message).toBe("arbitrary technical detail")
  })
  it("warns a reload ends a running game and never promises recovery", () => {
    const abort: EngineAbort = { type: "engine.abort", reason: "protocol-mismatch", origin: "client", message: "versions" }
    expect(abortAdvice(abort)).toContain("Eine laufende Partie endet")
    expect(abortAdvice({ ...abort, reason: "terminated" })).toContain("nicht fortsetzen")
  })
})
