/*
 * The player's card language (prompt 12): in which language cards are shown
 * - their names, type lines, rules texts and pictures in the app (from the
 * card catalog, src/cards/card-display.ts), and the card names, type lines and
 * rules texts inside Forge's texts during a game (the engine's boot argument
 * --card-language; Forge's own words stay German).
 *
 * - "de" (the default): German where Scryfall has a German printing, English
 *   where it has none - field by field and marked (Bible §4).
 * - "en": English (Oracle texts, English pictures) for a player who knows the
 *   cards by their English names; nothing is marked as "not German" then.
 *
 * A setting chosen once, in Settings - never part of starting a game.
 */
import type { EngineLanguage } from "@openmana/engine-protocol"
import { defineSetting } from "@/storage/settings"
import type { TextLanguage } from "./card-display"

/** "de": German preferred, English where there is no German; "en": English. */
export type CardLanguagePreference = TextLanguage

export const CARD_LANGUAGE_PREFERENCES: readonly CardLanguagePreference[] = ["de", "en"]

export const CARD_LANGUAGE = defineSetting<CardLanguagePreference>(
  "display.cardLanguage",
  "de",
  (value): value is CardLanguagePreference => value === "de" || value === "en",
)

/** The engine language of the cards in Forge's texts (--card-language) for this preference. */
export function engineCardLanguage(language: CardLanguagePreference): EngineLanguage {
  return language === "en" ? "en-US" : "de-DE"
}
