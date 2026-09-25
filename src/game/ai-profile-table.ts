/*
 * Forge's AI profiles in the pinned engine (res/ai/*.ai), as verified for
 * prompt 12 (docs/research/AI_PROFILES.md): what each one changes against
 * Forge's default profile, read from the profile files and the Forge AI code
 * that uses each value, and measured in AI-against-AI games.
 *
 * Pure data, also read by the build (vite/engine-assets.ts): the build stops
 * unless the engine carries exactly these profiles with exactly these files
 * (SHA-256). A Forge update that adds, removes or changes a profile must be
 * verified again before the app describes it - the descriptions below are
 * true for these files only.
 *
 * Honest labels (Bible §7): Forge has no difficulty levels, and none of the
 * profiles won measurably more or less often than the default one in the
 * study; they change how the AI plays, not what it knows or may do (no
 * profile cheats: Forge's shuffle cheat, CHEAT_WITH_MANA_ON_SHUFFLE, only
 * works when AI cheating is enabled, and the engine disables it).
 */

export interface AiProfileInfo {
  /** Forge's name (the file res/ai/<name>.ai); what the engine is sent. */
  readonly name: string
  /** SHA-256 of the file the description below was verified against. */
  readonly sha256: string
  /** German name for the player. */
  readonly label: string
  /** One sentence: how this AI plays. */
  readonly summary: string
  /** What it does differently from the default profile, verified (the most noticeable first). */
  readonly traits: readonly string[]
}

/** Forge's default profile: what the engine plays without a choice. */
export const DEFAULT_AI_PROFILE = "Default"

/** In the order the player sees them: the default first, then the two opposite styles, then Forge's experimental one. */
export const AI_PROFILE_TABLE: readonly AiProfileInfo[] = [
  {
    name: "Default",
    sha256: "b6629e7dcb1c56798ba3864b614a5064cf8e5152eeb4bedc8a2d1070d833086a",
    label: "Standard",
    summary: "Forges Vorgabe – die KI, auf die Forge abgestimmt ist.",
    traits: [
      "Greift an, wenn sie sich im Vorteil sieht, und hält sonst Blocker zurück.",
      "Kontert teure Zaubersprüche in der Regel, billige nur manchmal.",
      "Hält Kampftricks gern zurück, bis du geblockt hast.",
    ],
  },
  {
    name: "Cautious",
    sha256: "52045bb47e26ef2da4248427aa53f0b3122f5988fc4b01b0dbcf356f6daef7a1",
    label: "Vorsichtig",
    summary: "Spielt zurückhaltender: verteidigt sich früher und lässt billige Zaubersprüche öfter durch.",
    traits: [
      "Verteidigt sich schon bei etwas mehr Lebenspunkten entschlossener.",
      "Kontert billige Zaubersprüche seltener als Standard.",
      "Spielt Kampftricks vor dem Angriff, statt dich damit in einen Block zu locken.",
      "Kombiniert zwei Schadenszauber nur selten, außer sie ist in Gefahr.",
    ],
  },
  {
    name: "Reckless",
    sha256: "e1d19dfbab5f69ebf7e167f047ad5d8863ef71959dac5a22521e19f70461001f",
    label: "Waghalsig",
    summary: "Spielt auf Angriff: nimmt den Abtausch in Kauf und lässt weniger Blocker zurück.",
    traits: [
      "Greift auch an, wenn dabei Kreaturen sterben können – sie rechnet mit dem Abtausch.",
      "Lässt weniger Kreaturen zum Blocken zurück.",
      "Kontert auch billige Zaubersprüche meistens.",
      "Behält nach Mulligans auch eine Hand mit nur drei Karten.",
    ],
  },
  {
    name: "Experimental",
    sha256: "f00ebd8f741c82a6a8f69fbee544fb5587a5d2bc50aca45358c98fa171021ede",
    label: "Experimentell",
    summary: "Forges Versuchsprofil: wie Standard, mit einigen zusätzlichen Verhaltensweisen.",
    traits: [
      "Ab wann sie sich entschlossener verteidigt, schwankt von Mal zu Mal – schwerer vorherzusehen.",
      "Setzt Entfernungszauber zuerst gegen Kreaturen ein, die sie nicht blocken kann.",
      "Opfert eher Kreaturen, um ihre Planeswalker zu schützen.",
      "Kontert billige Zaubersprüche seltener als Standard.",
    ],
  },
]
