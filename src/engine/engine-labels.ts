/*
 * German wording for what the engine reports. The protocol stays English
 * (system EN); the player reads German (user DE). Technical details (the
 * abort message) are shown verbatim below the German headline.
 */
import type { AbortReason, BootPhase, EngineAbort, EngineLanguage } from "@openmana/engine-protocol"

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
