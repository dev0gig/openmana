/*
 * Card names as lookup keys. The card catalog (cards/scripts) stores every
 * name a card is known by in this normalized form (CardRecord.nameKeys), and
 * the app normalizes what it looks up the same way - one function for both
 * sides, so they cannot drift apart.
 *
 * A key ignores what differs between sources without making names equal
 * that are not: letter case, accents (Ratonhnhaké:ton), ligatures (Æther),
 * typographic apostrophes, dashes, quotes, colons and ellipses (Forge writes
 * "Where We're Going . . .", Scryfall "Where We're Going..."), the spacing
 * around "//" and runs of spaces. German sharp s becomes "ss" and umlauts
 * lose their dots, on both sides alike. Nothing else is folded: a key never
 * turns two different cards into one.
 */

/** Characters that stand for the same thing in different card data sources. */
const EQUIVALENTS: readonly (readonly [RegExp, string])[] = [
  [/[æ]/g, "ae"],
  [/[œ]/g, "oe"],
  [/[ø]/g, "o"],
  [/[ß]/g, "ss"],
  [/[‘’‚‛′ʼ`´]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/[‐‑‒–—―−]/g, "-"],
  [/[꞉ː：]/g, ":"],
  [/…/g, "..."],
]

/** The lookup key of a card name (see above). Never empty for a name that has a letter or digit. */
export function nameKey(name: string): string {
  let key = name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  for (const [pattern, replacement] of EQUIVALENTS) key = key.replace(pattern, replacement)
  return key
    .replace(/\s*\.(?:\s*\.)+/g, (dots) => dots.replace(/\s+/g, "")) // "Going . . ." → "Going..."
    .replace(/\s*\/\/\s*/g, " // ")
    .replace(/\s+/g, " ")
    .trim()
}

/** The distinct keys of several names, in the order first seen (empty names are left out). */
export function nameKeys(names: Iterable<string | null | undefined>): string[] {
  const keys = new Set<string>()
  for (const name of names) {
    if (!name) continue
    const key = nameKey(name)
    if (key !== "") keys.add(key)
  }
  return [...keys]
}

/** Forge names tokens "<name> Token" ("Goblin Token"); Scryfall names them "Goblin". */
export const FORGE_TOKEN_SUFFIX = " Token"

/** Scryfall layouts of tokens and emblems (never in a deck; created during a game). */
export const TOKEN_LAYOUTS: ReadonlySet<string> = new Set(["token", "double_faced_token", "emblem"])
