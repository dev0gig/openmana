// @vitest-environment node
/*
 * The diagnostics report (prompt 12): every version that matters, as text -
 * for a running engine too, and without anything that is not known.
 */
import { describe, expect, it } from "vitest"
import type { CardAssets } from "@/cards/card-assets-types"
import type { EngineSnapshot } from "@/engine/engine-session"
import { READY, SUPPORTED, TEST_ASSETS } from "@/test/game-fixtures"
import { browserFacts, diagnosticsReport, type DiagnosticsInput } from "./diagnostics"

const CARDS: CardAssets = {
  available: true,
  id: "c0ffee0123456789",
  url: "/cards/c0ffee0123456789/catalog.jsonl.gz",
  bytes: 10,
  sha256: "a".repeat(64),
  uncompressedBytes: 20,
  uncompressedSha256: "b".repeat(64),
  lines: 3,
  schemaVersion: 3,
  source: { updatedAt: "2026-09-24T09:00:00.000Z", uri: "https://data.scryfall.io/all-cards.jsonl.gz" },
  forge: { commit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798", cards: 3, matched: 3, forgeOnly: 0 },
  counts: { cards: 3, germanText: 2, germanImage: 1, sets: 1, forgeOnly: 0 },
  builtAt: "2026-09-25T06:00:00.000Z",
} as CardAssets

function input(engine: EngineSnapshot, overrides: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return {
    now: new Date("2026-09-25T08:15:00.000Z"),
    app: { version: "0.1.0", commit: "84f1b69cde0000000000000000000000000000ab", commitDate: "2026-09-25T06:57:00.000Z", modified: true },
    engineAssets: TEST_ASSETS,
    engine,
    cards: { assets: CARDS, status: "ready", installedVersion: "c0ffee0123456789" },
    database: { schemaVersion: 3, status: "ready" },
    preferences: { aiProfile: { kind: "profile", name: "Reckless" }, cardLanguage: "en", motion: "reduce", deviceReducedMotion: false },
    browser: { userAgent: "TestBrowser/1.0", crossOriginIsolated: true, cores: 12, memoryGb: 8 },
    ...overrides,
  }
}

describe("diagnosticsReport", () => {
  it("names the app, the engine of the build, the card data, the database, the preferences and the browser", () => {
    const report = diagnosticsReport(input({ status: "idle", features: SUPPORTED }))
    expect(report).toMatch(/^OpenMana – Diagnose\nErstellt: /)
    expect(report).toContain("[App]\nVersion: 0.1.0\nStand: 84f1b69cde0000000000000000000000000000ab (mit lokalen Änderungen)")
    expect(report).toContain("Kennung: 0123456789abcdef")
    expect(report).toContain("Forge: 2.0.15, Stand ed0333fecb1fea0671b3e50cadc1da4f71db5798")
    expect(report).toContain(`Protokoll: Version ${TEST_ASSETS.available ? TEST_ASSETS.build.protocolVersion : 0}`)
    expect(report).toContain("[Forge-Engine jetzt]\nZustand: nicht gestartet")
    expect(report).toContain("Katalog: c0ffee0123456789 (Scryfall-Stand 24.09.2026, Schema 3, Forge ed0333fecb)")
    expect(report).toContain("Auf diesem Gerät: eingerichtet (c0ffee0123456789)")
    expect(report).toContain("Datenbank: Schema 3, geöffnet")
    expect(report).toContain("KI-Profil: Waghalsig (Reckless)")
    expect(report).toContain("Kartensprache: Englisch")
    expect(report).toContain("Bewegungen reduzieren: immer (Gerät wünscht es: nein)")
    expect(report).toContain("User-Agent: TestBrowser/1.0\nIsoliert (COOP/COEP): ja\nProzessorkerne: 12\nArbeitsspeicher: 8 GB (Angabe des Browsers)")
    expect(report.endsWith("\n")).toBe(true)
  })

  it("a running engine says what it booted with", () => {
    if (READY.type !== "engine.ready") throw new Error("READY")
    const ready: EngineSnapshot = { status: "ready", features: SUPPORTED, startedAt: 1000, readyAt: 6400, steps: [], ready: { ...READY, boot: { ...READY.boot, cardLanguage: "en-US" } } }
    const report = diagnosticsReport(input(ready))
    expect(report).toContain("[Forge-Engine jetzt]\nZustand: bereit\nForge: 2.0.15, Stand ed0333fecb1fea0671b3e50cadc1da4f71db5798")
    expect(report).toContain("Sprache von Forge: Deutsch\nKarten in Forges Texten: Englisch\nKartenladen: vollständig beim Start")
    expect(report).toContain("KI-Profile: Cautious, Default, Experimental, Reckless")
    expect(report).toContain("Start: 5,4 s")
  })

  it("an aborted engine, no engine in the build, no catalog, unknown browser facts and a profile the version lacks are said as such", () => {
    const aborted: EngineSnapshot = {
      status: "aborted",
      features: SUPPORTED,
      startedAt: 0,
      steps: [],
      abort: { type: "engine.abort", reason: "boot-failed", origin: "engine", message: "java.lang.OutOfMemoryError" },
    }
    const report = diagnosticsReport(
      input(aborted, {
        engineAssets: { available: false, reason: "omitted", detail: "built with OPENMANA_ENGINE=omit" },
        cards: { assets: { available: false, reason: "omitted", detail: "x" }, status: "unavailable", installedVersion: null },
        preferences: { aiProfile: { kind: "profile", name: "Aggressive" }, cardLanguage: "de", motion: "system", deviceReducedMotion: true },
        browser: { userAgent: "x", crossOriginIsolated: false, cores: null, memoryGb: null },
      }),
    )
    expect(report).toContain("Engine: in dieser Version nicht enthalten")
    expect(report).toContain("Abbruch: Die Engine konnte nicht starten (boot-failed): java.lang.OutOfMemoryError")
    expect(report).toContain("Katalog: in dieser Version nicht enthalten\nAuf diesem Gerät: nicht in dieser Version")
    expect(report).toContain("KI-Profil: Aggressive (in dieser Version unbekannt)")
    expect(report).toContain("Bewegungen reduzieren: wie das Gerät (Gerät wünscht es: ja)")
    expect(report).toContain("Isoliert (COOP/COEP): nein\nProzessorkerne: unbekannt\nArbeitsspeicher: unbekannt")
  })

  it("reads the browser's own facts", () => {
    const facts = browserFacts()
    expect(typeof facts.userAgent).toBe("string")
    expect(typeof facts.crossOriginIsolated).toBe("boolean")
  })
})
