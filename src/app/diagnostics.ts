/*
 * The diagnostics report (prompt 12): every version and state that matters
 * when something goes wrong, as plain text the player can copy into a bug
 * report - the app, the engine this build ships, the engine running now,
 * the card data, the local database, the preferences and the browser.
 * Nothing is sent anywhere (Bible §15); the text stays on the page until the
 * player copies it.
 *
 * Pure: everything comes in as arguments (tests build it from fixed facts).
 */
import type { CardLanguagePreference } from "@/cards/card-language"
import type { CardAssets } from "@/cards/card-assets-types"
import type { CatalogStatus } from "@/cards/card-catalog-context"
import type { EngineAssets } from "@/engine/engine-assets-types"
import { abortTitle, ENGINE_LANGUAGE_LABELS, formatMegabytes, formatSeconds, shortCommit } from "@/engine/engine-labels"
import type { EngineSnapshot } from "@/engine/engine-session"
import { AI_PROFILE_TABLE } from "@/game/ai-profile-table"
import type { AiProfileChoice } from "@/game/ai-profiles"
import type { StorageSnapshot } from "@/storage/storage-session"
import type { AppBuildInfo } from "./build-info-types"
import type { MotionPreference } from "./motion"

export interface BrowserFacts {
  readonly userAgent: string
  readonly crossOriginIsolated: boolean
  /** navigator.hardwareConcurrency (null: unknown). */
  readonly cores: number | null
  /** navigator.deviceMemory in GB, rounded by the browser (Chrome only; null: unknown). */
  readonly memoryGb: number | null
}

export interface DiagnosticsInput {
  readonly now: Date
  readonly app: AppBuildInfo
  readonly engineAssets: EngineAssets
  readonly engine: EngineSnapshot
  readonly cards: { readonly assets: CardAssets; readonly status: CatalogStatus; readonly installedVersion: string | null }
  readonly database: { readonly schemaVersion: number; readonly status: StorageSnapshot["status"] }
  readonly preferences: { readonly aiProfile: AiProfileChoice; readonly cardLanguage: CardLanguagePreference; readonly motion: MotionPreference; readonly deviceReducedMotion: boolean }
  readonly browser: BrowserFacts
}

const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" })
const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })

const yesNo = (value: boolean) => (value ? "ja" : "nein")

const ENGINE_STATUS: Readonly<Record<EngineSnapshot["status"], string>> = {
  unavailable: "nicht in dieser Version",
  unsupported: "läuft in diesem Browser nicht",
  idle: "nicht gestartet",
  booting: "startet",
  ready: "bereit",
  busy: "spielt",
  aborted: "abgebrochen",
}

const CATALOG_STATUS: Readonly<Record<CatalogStatus, string>> = {
  unavailable: "nicht in dieser Version",
  loading: "wird gelesen",
  "storage-error": "lokale Daten nicht lesbar",
  missing: "nicht eingerichtet",
  partial: "unvollständig",
  outdated: "ältere Version eingerichtet",
  ready: "eingerichtet",
  installing: "wird eingerichtet",
}

const DATABASE_STATUS: Readonly<Record<DiagnosticsInput["database"]["status"], string>> = {
  opening: "wird geöffnet",
  blocked: "wartet auf einen anderen Tab",
  ready: "geöffnet",
  failed: "lässt sich nicht öffnen",
  closed: "Verbindung verloren",
}

function profileChoice(choice: AiProfileChoice): string {
  if (choice.kind === "random") return "zufällig (jede Partie neu)"
  const known = AI_PROFILE_TABLE.find((profile) => profile.name === choice.name)
  return known ? `${known.label} (${known.name})` : `${choice.name} (in dieser Version unbekannt)`
}

function section(title: string, facts: readonly (readonly [string, string])[]): string[] {
  return [`[${title}]`, ...facts.map(([label, value]) => `${label}: ${value}`), ""]
}

function appFacts(app: AppBuildInfo): [string, string][] {
  return [
    ["Version", app.version],
    ["Stand", app.commit === null ? "unbekannt" : `${app.commit}${app.modified ? " (mit lokalen Änderungen)" : ""}`],
    ...(app.commitDate !== null ? [["Stand vom", dateTime.format(new Date(app.commitDate))] as [string, string]] : []),
  ]
}

function buildFacts(assets: EngineAssets): [string, string][] {
  if (!assets.available) return [["Engine", assets.reason === "omitted" ? "in dieser Version nicht enthalten" : `nicht gefunden (${assets.detail})`]]
  const build = assets.build
  return [
    ["Kennung", assets.id],
    ["Forge", `${build.forgeVersionCode}, Stand ${build.forgeCommit}`],
    ["Patches für den Browser", String(build.patchCount)],
    ["Protokoll", `Version ${build.protocolVersion}`],
    ["GraalVM", build.graalvm],
    ["Gebaut", dateTime.format(new Date(build.builtAt))],
    ["Download", `${formatMegabytes(build.downloadBytes)} (Brotli ${formatMegabytes(build.downloadBrotliBytes)})`],
  ]
}

function runningFacts(engine: EngineSnapshot): [string, string][] {
  const facts: [string, string][] = [["Zustand", ENGINE_STATUS[engine.status]]]
  if (engine.status === "unsupported") facts.push(["Grund", engine.message])
  if (engine.status === "aborted") facts.push(["Abbruch", `${abortTitle(engine.abort)} (${engine.abort.reason}): ${engine.abort.message}`])
  if (engine.status === "ready" || engine.status === "busy") {
    const { engine: build, boot } = engine.ready
    facts.push(
      ["Forge", `${build.forgeVersionCode}, Stand ${build.forgeCommit}`],
      ["Engine-Stand (OpenMana)", `${shortCommit(build.openmanaCommit)}${build.engineSourcesModified ? " (mit lokalen Änderungen gebaut)" : ""}`],
      ["Sprache von Forge", ENGINE_LANGUAGE_LABELS[boot.language]],
      ["Karten in Forges Texten", ENGINE_LANGUAGE_LABELS[boot.cardLanguage]],
      ["Kartenladen", boot.cardLoading === "eager" ? "vollständig beim Start" : "bei Bedarf"],
      ["KI-Profile", boot.aiProfiles.join(", ")],
      ["Start", formatSeconds(engine.readyAt - engine.startedAt)],
    )
  }
  return facts
}

function cardFacts(cards: DiagnosticsInput["cards"]): [string, string][] {
  const assets = cards.assets
  const catalog: [string, string] = assets.available
    ? ["Katalog", `${assets.id} (Scryfall-Stand ${date.format(new Date(assets.source.updatedAt))}, Schema ${assets.schemaVersion}, Forge ${shortCommit(assets.forge.commit)})`]
    : ["Katalog", assets.reason === "omitted" ? "in dieser Version nicht enthalten" : "nicht gefunden"]
  return [catalog, ["Auf diesem Gerät", `${CATALOG_STATUS[cards.status]}${cards.installedVersion !== null ? ` (${cards.installedVersion})` : ""}`]]
}

export function diagnosticsReport(input: DiagnosticsInput): string {
  const { preferences, browser } = input
  const lines = [
    "OpenMana – Diagnose",
    `Erstellt: ${dateTime.format(input.now)}`,
    "",
    ...section("App", appFacts(input.app)),
    ...section("Forge-Engine dieser Version", buildFacts(input.engineAssets)),
    ...section("Forge-Engine jetzt", runningFacts(input.engine)),
    ...section("Kartendaten", cardFacts(input.cards)),
    ...section("Daten auf diesem Gerät", [["Datenbank", `Schema ${input.database.schemaVersion}, ${DATABASE_STATUS[input.database.status]}`]]),
    ...section("Einstellungen", [
      ["KI-Profil", profileChoice(preferences.aiProfile)],
      ["Kartensprache", preferences.cardLanguage === "en" ? "Englisch" : "Deutsch"],
      ["Bewegungen reduzieren", `${preferences.motion === "reduce" ? "immer" : "wie das Gerät"} (Gerät wünscht es: ${yesNo(preferences.deviceReducedMotion)})`],
    ]),
    ...section("Browser", [
      ["User-Agent", browser.userAgent],
      ["Isoliert (COOP/COEP)", yesNo(browser.crossOriginIsolated)],
      ["Prozessorkerne", browser.cores === null ? "unbekannt" : String(browser.cores)],
      ["Arbeitsspeicher", browser.memoryGb === null ? "unbekannt" : `${browser.memoryGb} GB (Angabe des Browsers)`],
    ]),
  ]
  return lines.join("\n").trimEnd() + "\n"
}

/** What this browser says about itself (only what it offers; nothing is fingerprinted beyond it). */
export function browserFacts(): BrowserFacts {
  const nav = globalThis.navigator as (Navigator & { deviceMemory?: number }) | undefined
  return {
    userAgent: nav?.userAgent ?? "unbekannt",
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    cores: typeof nav?.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
    memoryGb: typeof nav?.deviceMemory === "number" ? nav.deviceMemory : null,
  }
}
