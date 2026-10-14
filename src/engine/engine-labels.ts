/*
 * German wording for what the engine reports. The protocol stays English
 * (system EN); the player reads German (user DE). Technical details (the
 * abort message) are shown verbatim below the German headline.
 */
import type { AbortReason, BootPhase, EngineAbort, EngineLanguage } from "@openmana/engine-protocol"
import type { EngineRelease } from "./engine-release"

export const BOOT_PHASE_LABELS: Readonly<Record<BootPhase, string>> = {
  "worker-features": "Browser prüfen",
  "launcher-load": "Engine-Starter laden",
  "wasm-fetch-compile": "Engine herunterladen und übersetzen",
  "java-main": "Forge starten und Karten laden",
}

const ABORT_TITLES: Readonly<Record<AbortReason, string>> = {
  "unsupported-browser": "Dieser Browser kann die Engine nicht ausführen",
  "protocol-mismatch": "App und Engine passen nicht zusammen – bitte neu laden",
  "transport-error": "Die Verbindung zur Engine ist gestört",
  "boot-failed": "Die Engine konnte nicht starten",
  "engine-failure": "In der Engine ist ein Fehler aufgetreten",
  "worker-error": "Der Engine-Worker ist abgestürzt",
  "protocol-violation": "Die Engine hat eine ungültige Nachricht geschickt",
  "ready-timeout": "Die Engine ist nicht rechtzeitig fertig geworden",
  terminated: "Die Engine wurde beendet",
}

export function abortTitle(abort: EngineAbort): string {
  return ABORT_TITLES[abort.reason]
}

/**
 * Practical next steps keyed only by the structured technical failure, never
 * its prose - and by whether the server still serves this app version's
 * engine (engine-release.ts): an engine gone from the server explains every
 * failure but a browser that cannot run it (a missing worker script aborts as
 * worker-error, a missing WebAssembly file as boot-failed).
 */
export function abortAdvice(abort: EngineAbort, release: EngineRelease = "unknown"): string {
  if (release === "gone" && abort.reason !== "unsupported-browser") {
    return "Diese App-Version ist veraltet: Inzwischen ist eine neue Version erschienen, und die Engine der alten liegt nicht mehr auf dem Server. Schließe alle OpenMana-Tabs und App-Fenster (auf Android die App ganz beenden) und öffne OpenMana erneut – dann startet die neue Version mit ihrer Engine. „Erneut versuchen“ hilft hier nicht."
  }
  switch (abort.reason) {
    case "unsupported-browser": return "Öffne OpenMana in einem aktuellen Browser. Die Browserprüfung zeigt, welche Voraussetzung fehlt."
    case "protocol-mismatch": return "Lade die App neu, damit App und Engine aus derselben Version kommen. Eine laufende Partie endet beim Neuladen."
    case "boot-failed": return "Prüfe die Internetverbindung für den Engine-Download und versuche den Start erneut. Die technische Meldung darunter bleibt für die Fehlersuche erhalten."
    case "ready-timeout": return "Der Start hat zu lange gedauert. Versuche es erneut; falls das wieder passiert, findest du die Versionsangaben in den Einstellungen unter Engine-Diagnose."
    case "terminated": return "Die Engine läuft nicht mehr. Für eine neue Partie wird sie neu gestartet; eine beendete Sitzung lässt sich hier nicht fortsetzen."
    default: return "Diese Engine-Sitzung kann nicht fortgesetzt werden. Starte eine neue Partie. Falls der Fehler wiederkehrt, bewahre die technische Meldung und die Engine-Diagnose aus den Einstellungen auf."
  }
}

/** The language Forge's own texts are in (engine.ready boot.language). */
export const ENGINE_LANGUAGE_LABELS: Readonly<Record<EngineLanguage, string>> = {
  "de-DE": "Deutsch",
  "en-US": "Englisch",
}

const bytesFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const secondsFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** 78977240 → "75,3 MB" (MiB, as the engine documentation measures). */
export function formatMegabytes(bytes: number): string {
  return `${bytesFormat.format(bytes / 1024 / 1024)} MB`
}

/** 3456 → "3,5 s" */
export function formatSeconds(ms: number): string {
  return `${secondsFormat.format(ms / 1000)} s`
}

/** A Git commit in short form (first 10 hex digits, like the engine documentation). */
export function shortCommit(commit: string): string {
  return commit.slice(0, 10)
}
