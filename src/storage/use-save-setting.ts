/*
 * Saving a preference from a page (prompt 12): the setting is written at
 * once (no "save" button - the choice is the action), and a write that fails
 * is shown as a toast with what to do (Bible §16: nothing fails silently).
 * The pages re-read the settings store by themselves (useStorageQuery).
 */
import { toast } from "sonner"
import { toStorageError } from "./errors"
import { writeSetting, type SettingDefinition } from "./settings"
import { useStorage } from "./storage-context"
import { storageErrorAdvice, storageErrorTitle } from "./storage-labels"

export type SaveSetting = <T>(setting: SettingDefinition<T>, value: T) => Promise<boolean>

/** Writes a setting; false (and a toast) if the database is not open or the write failed. */
export function useSaveSetting(): SaveSetting {
  const { snapshot } = useStorage()
  const database = snapshot.status === "ready" ? snapshot.database : null
  return async (setting, value) => {
    if (database === null) {
      toast.error("Die Einstellung ließ sich nicht speichern", { id: `setting-${setting.key}`, description: "Die Daten auf diesem Gerät sind gerade nicht erreichbar." })
      return false
    }
    try {
      await writeSetting(database, setting, value)
      return true
    } catch (error) {
      const storageError = toStorageError(error, `saving the setting ${setting.key}`)
      toast.error(storageErrorTitle(storageError), { id: `setting-${setting.key}`, description: storageErrorAdvice(storageError) })
      return false
    }
  }
}
