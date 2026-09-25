/*
 * Preferences in the local database. Each setting is defined once (key,
 * fallback, check); the store keeps one record per key. A stored value that
 * fails its check falls back visibly (invalid: true) instead of breaking the
 * app, and keys this app version does not define are kept untouched (a newer
 * version may have written them) and travel in backups.
 *
 * The settings themselves live with what they set: the deck choice in
 * src/decks/deck-selection.ts, the AI profile in src/game/ai-profiles.ts, the
 * card language in src/cards/card-language.ts, less motion in
 * src/app/motion.ts; src/app/preferences.tsx reads and applies them.
 */
import { assertRecord, type LocalDatabase } from "./database"
import { StorageError } from "./errors"

export interface SettingDefinition<T> {
  /** Dotted lower camel case (SettingKey in the schema), e.g. ai.profile. */
  readonly key: string
  readonly fallback: T
  readonly check: (value: unknown) => value is T
}

export interface SettingValue<T> {
  readonly value: T
  /** A value is stored (else the fallback is in use). */
  readonly stored: boolean
  /** A value is stored but fails the check; the fallback is in use. */
  readonly invalid: boolean
}

export function defineSetting<T>(key: string, fallback: T, check: (value: unknown) => value is T): SettingDefinition<T> {
  return { key, fallback, check }
}

export async function readSetting<T>(db: LocalDatabase, setting: SettingDefinition<T>): Promise<SettingValue<T>> {
  const record: unknown = await db.read(["settings"], (transaction) => transaction.objectStore("settings").get(setting.key))
  if (record === undefined) return { value: setting.fallback, stored: false, invalid: false }
  const value = typeof record === "object" && record !== null ? (record as { value?: unknown }).value : undefined
  if (setting.check(value)) return { value, stored: true, invalid: false }
  return { value: setting.fallback, stored: true, invalid: true }
}

/** Only JSON travels through a backup unchanged. */
function isJson(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJson)
  if (typeof value === "object") {
    const prototype: unknown = Object.getPrototypeOf(value)
    return (prototype === Object.prototype || prototype === null) && Object.values(value).every(isJson)
  }
  return false
}

export async function writeSetting<T>(db: LocalDatabase, setting: SettingDefinition<T>, value: T, now: () => Date = () => new Date()): Promise<void> {
  if (!setting.check(value) || !isJson(value)) {
    throw new StorageError("invalid-record", `setting ${setting.key}: the value is not allowed`)
  }
  const record = assertRecord("settings", { key: setting.key, value, updatedAt: now().toISOString() })
  await db.write(["settings"], async (transaction) => {
    await transaction.objectStore("settings").put(record)
  })
}
