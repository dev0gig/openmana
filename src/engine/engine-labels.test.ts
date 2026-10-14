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

describe("an app version whose engine left the server", () => {
  const abort: EngineAbort = { type: "engine.abort", reason: "boot-failed", origin: "client", message: "Failed to load data at …: 404" }
  it("names closing every tab as the cure, not the connection", () => {
    expect(abortAdvice(abort, "gone")).toContain("veraltet")
    expect(abortAdvice(abort, "gone")).toContain("alle OpenMana-Tabs")
    expect(abortAdvice(abort, "gone")).not.toContain("Internetverbindung")
  })
  it("keeps the usual advice while the server's answer is open or the engine is there", () => {
    expect(abortAdvice(abort, "unknown")).toBe(abortAdvice(abort))
    expect(abortAdvice(abort, "served")).toBe(abortAdvice(abort))
  })
  it("explains a missing worker script too, but not a browser that cannot run Forge", () => {
    expect(abortAdvice({ ...abort, reason: "worker-error" }, "gone")).toBe(abortAdvice(abort, "gone"))
    expect(abortAdvice({ ...abort, reason: "unsupported-browser" }, "gone")).toBe(abortAdvice({ ...abort, reason: "unsupported-browser" }))
  })
})
