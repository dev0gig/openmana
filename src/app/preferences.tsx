/*
 * The player's preferences (prompt 12), read from the local database and
 * kept current (useStorageQuery on the settings store, also after a change in
 * another tab): the AI profile, the card language, less motion and the
 * table's background (src/game/table/table-background.ts, read by
 * TableSurface). They are
 * chosen once - in Settings, the AI profile also on the play page - and never
 * asked when a game starts (Anvil lesson: one-time preferences stay out of
 * the repeated path).
 *
 * Applied here, app-wide:
 *  - less motion: <html data-reduced-motion> (the motion-reduce variant,
 *    src/index.css and src/app/motion.ts);
 *  - the card language: how the next engine boots (the cards in Forge's
 *    texts, EngineSession.setBootOptions).
 *
 * Until the settings are read, and if they cannot be read, the defaults
 * apply (German cards, the device's motion, Forge's default profile); a
 * stored value that fails its check is named (invalid) and the default used.
 */
import { createContext, use, useEffect, useMemo, type ReactNode } from "react"
import { CARD_LANGUAGE, engineCardLanguage, type CardLanguagePreference } from "@/cards/card-language"
import { useEngineBootOptions } from "@/engine/engine-session-context"
import { AI_PROFILE, type AiProfileChoice } from "@/game/ai-profiles"
import { TABLE_BACKGROUND, TABLE_BACKGROUND_IMAGE, type TableBackgroundChoice } from "@/game/table/table-background"
import type { LocalDatabase } from "@/storage/database"
import { readSetting } from "@/storage/settings"
import { useStorageQuery } from "@/storage/storage-context"
import { MOTION, REDUCED_MOTION_ATTRIBUTE, type MotionPreference } from "./motion"

export interface Preferences {
  /** loading: not read yet (the defaults apply); error: the settings could not be read (the defaults apply). */
  readonly status: "loading" | "ready" | "error"
  readonly aiProfile: AiProfileChoice
  readonly cardLanguage: CardLanguagePreference
  readonly motion: MotionPreference
  readonly tableBackground: TableBackgroundChoice
  /** The player's own table picture (a data: URL), or null. */
  readonly tableBackgroundImage: string | null
  /** Keys of settings whose stored value failed its check (their default is in use). */
  readonly invalid: readonly string[]
}

/** Every preference at its default (outside PreferencesProvider these are simply the preferences). */
export const DEFAULT_PREFERENCES: Preferences = {
  status: "ready",
  aiProfile: AI_PROFILE.fallback,
  cardLanguage: CARD_LANGUAGE.fallback,
  motion: MOTION.fallback,
  tableBackground: TABLE_BACKGROUND.fallback,
  tableBackgroundImage: TABLE_BACKGROUND_IMAGE.fallback,
  invalid: [],
}

export async function readPreferences(db: LocalDatabase): Promise<Omit<Preferences, "status">> {
  const [aiProfile, cardLanguage, motion, tableBackground, tableBackgroundImage] = await Promise.all([
    readSetting(db, AI_PROFILE),
    readSetting(db, CARD_LANGUAGE),
    readSetting(db, MOTION),
    readSetting(db, TABLE_BACKGROUND),
    readSetting(db, TABLE_BACKGROUND_IMAGE),
  ])
  const invalid = [
    ...(aiProfile.invalid ? [AI_PROFILE.key] : []),
    ...(cardLanguage.invalid ? [CARD_LANGUAGE.key] : []),
    ...(motion.invalid ? [MOTION.key] : []),
    ...(tableBackground.invalid ? [TABLE_BACKGROUND.key] : []),
    ...(tableBackgroundImage.invalid ? [TABLE_BACKGROUND_IMAGE.key] : []),
  ]
  return {
    aiProfile: aiProfile.value,
    cardLanguage: cardLanguage.value,
    motion: motion.value,
    tableBackground: tableBackground.value,
    tableBackgroundImage: tableBackgroundImage.value,
    invalid,
  }
}

const PreferencesContext = createContext<Preferences>(DEFAULT_PREFERENCES)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const query = useStorageQuery(["settings"], readPreferences)
  // One object per change, not per render: every page reads it.
  const preferences = useMemo<Preferences>(
    () => (query.status === "ready" ? { status: "ready", ...query.data } : { ...DEFAULT_PREFERENCES, status: query.status }),
    [query],
  )

  useEffect(() => {
    document.documentElement.toggleAttribute(REDUCED_MOTION_ATTRIBUTE, preferences.motion === "reduce")
  }, [preferences.motion])
  // Only once they are read: an engine prewarmed meanwhile is replaced if they differ from the default.
  useEngineBootOptions(preferences.status === "loading" ? null : { cardLanguage: engineCardLanguage(preferences.cardLanguage) })

  return <PreferencesContext value={preferences}>{children}</PreferencesContext>
}

/** The player's preferences (the defaults outside PreferencesProvider, e.g. in component tests). */
export function usePreferences(): Preferences {
  return use(PreferencesContext)
}
