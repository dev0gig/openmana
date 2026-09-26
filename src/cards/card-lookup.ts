/*
 * Finding cards in the installed catalog: by any name a card is known by
 * (English, a face, a printed alias, German, the Forge name), by Oracle id,
 * by the key the engine sends (VisibleCard.key: Forge's English name of the
 * face a card shows), and sets by their Scryfall, Arena or Forge code.
 *
 * Lookups read IndexedDB through indexes; nothing is held in memory and
 * nothing goes to the network. What they answer is display data only:
 * whether a card is legal, playable or what it does is Forge's alone.
 */
import type { LocalDatabase } from "@/storage/database"
import type { CardAlias, CardRecord, ForgeOnlyCardRecord, SetRecord } from "@/storage/generated/records"
import { FORGE_TOKEN_SUFFIX, nameKey, TOKEN_LAYOUTS } from "./names"

/** How a name found a card. */
export type MatchKind =
  /** The English Oracle name (or the Forge name). */
  | "name"
  /** The English name of one face (a back face, an adventure …). */
  | "face"
  /** An English name printed on some printings (Universes Beyond, flavour names). */
  | "alias"
  /** A name printed in another language (German). */
  | "printed"

export interface CardMatch {
  readonly card: CardRecord
  readonly kind: MatchKind
  /** The face the name belongs to (face and printed matches of one face), else null: the whole card. */
  readonly face: number | null
  /** The alias the name is, for alias matches. */
  readonly alias: CardAlias | null
}

/**
 * How a name relates to a card that has it among its keys. A face name wins
 * over the Forge name: Forge names a double-faced or adventure card after
 * its front face, and that name means the front face.
 */
export function describeMatch(card: CardRecord, name: string): CardMatch {
  const key = nameKey(name)
  if (nameKey(card.name) === key) return { card, kind: "name", face: null, alias: null }
  const face = card.faces.length > 1 ? card.faces.findIndex((candidate) => nameKey(candidate.name) === key) : -1
  if (face >= 0) return { card, kind: "face", face, alias: null }
  if (card.forgeNames.some((forgeName) => nameKey(forgeName) === key)) return { card, kind: "name", face: null, alias: null }
  const alias = card.aliases?.find((candidate) => nameKey(candidate.name) === key)
  if (alias) {
    const parts = alias.name.split(" // ")
    const part = parts.length > 1 ? parts.findIndex((candidate) => nameKey(candidate) === key) : -1
    return { card, kind: "alias", face: part >= 0 ? part : null, alias }
  }
  const printedFace = card.de?.faces.findIndex((candidate) => candidate.name !== undefined && nameKey(candidate.name) === key) ?? -1
  return { card, kind: "printed", face: printedFace >= 0 && card.faces.length > 1 ? printedFace : null, alias: null }
}

const KIND_ORDER: Readonly<Record<MatchKind, number>> = { name: 0, face: 1, alias: 2, printed: 3 }

function sortMatches(matches: CardMatch[]): CardMatch[] {
  return matches.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.card.name.localeCompare(b.card.name) || a.card.oracleId.localeCompare(b.card.oracleId))
}

/** Every card known by exactly this name (after normalizing it), best match first. */
export async function findCardsByName(db: LocalDatabase, name: string): Promise<CardMatch[]> {
  const key = nameKey(name)
  if (key === "") return []
  const cards = await db.read(["scryfallCards"], (transaction) => transaction.objectStore("scryfallCards").index("nameKeys").getAll(key))
  return sortMatches(cards.map((card) => describeMatch(card, name)))
}

/**
 * Cards with a name that starts with `text` (for a search field), each once,
 * at most `limit`; exact names first. `text` needs at least two letters. A
 * card found by its front face's name is the whole card (a search for
 * "Akki" means Akki Lavarunner // Tok-Tok as it is printed); found by a later
 * face, that face.
 */
export async function searchCardsByName(db: LocalDatabase, text: string, limit = 20): Promise<CardMatch[]> {
  const key = nameKey(text)
  if (key.length < 2) return []
  return db.read(["scryfallCards"], async (transaction) => {
    const index = transaction.objectStore("scryfallCards").index("nameKeys")
    const found = new Map<string, CardMatch>()
    let cursor = await index.openCursor(IDBKeyRange.bound(key, `${key}￿`))
    while (cursor && found.size < limit) {
      const card = cursor.value
      if (!found.has(card.oracleId)) {
        // The key that matched, as a name: describeMatch compares keys, so the key itself will do.
        const match = describeMatch(card, String(cursor.key))
        found.set(card.oracleId, match.face === 0 ? { ...match, face: null } : match)
      }
      cursor = await cursor.continue()
    }
    const matches = [...found.values()]
    const exact = (match: CardMatch) => Number(!match.card.nameKeys.includes(key))
    return matches.sort((a, b) => exact(a) - exact(b) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.card.name.localeCompare(b.card.name))
  })
}

export async function getCard(db: LocalDatabase, oracleId: string): Promise<CardRecord | null> {
  return (await db.read(["scryfallCards"], (transaction) => transaction.objectStore("scryfallCards").get(oracleId))) ?? null
}

/** Several cards in one read; missing ids are left out. */
export async function getCards(db: LocalDatabase, oracleIds: readonly string[]): Promise<Map<string, CardRecord>> {
  return db.read(["scryfallCards"], async (transaction) => {
    const store = transaction.objectStore("scryfallCards")
    const found = new Map<string, CardRecord>()
    for (const id of new Set(oracleIds)) {
      const card = await store.get(id)
      if (card) found.set(id, card)
    }
    return found
  })
}

/** A card the engine knows without Scryfall data, by any of its names. */
export async function findForgeOnly(db: LocalDatabase, name: string): Promise<ForgeOnlyCardRecord | null> {
  const key = nameKey(name)
  if (key === "") return null
  const found = await db.read(["forgeOnlyCards"], (transaction) => transaction.objectStore("forgeOnlyCards").index("nameKeys").get(key))
  return found ?? null
}

/** What the engine's key of a card resolves to. */
export type KeyResolution =
  | { readonly status: "found"; readonly match: CardMatch }
  /** Several cards fit (Un-cards of the same name, tokens with the same name and characteristics). */
  | { readonly status: "ambiguous"; readonly matches: readonly CardMatch[] }
  /** The engine knows it, Scryfall has no data for it. */
  | { readonly status: "forge-only"; readonly card: ForgeOnlyCardRecord }
  | { readonly status: "not-found" }

/** What the engine tells about a card besides its key (VisibleCard), to tell tokens of one name apart. */
export interface KeyHints {
  readonly token?: boolean
  readonly power?: number
  readonly toughness?: number
  /** Current colours as letters (VisibleCard.colors). */
  readonly colors?: string
}

function tokenFits(card: CardRecord, hints: KeyHints): boolean {
  const face = card.faces[0]
  if (hints.power !== undefined && face.power !== String(hints.power)) return false
  if (hints.toughness !== undefined && face.toughness !== String(hints.toughness)) return false
  if (hints.colors !== undefined && card.colors !== hints.colors) return false
  return true
}

/**
 * The catalog card behind an engine key (VisibleCard.key, the English name
 * of the face Forge shows: "Insectile Aberration" for a transformed Delver
 * of Secrets, "Stomp" for an adventure on the stack). Tokens ("Goblin
 * Token") are Scryfall tokens of that name whose power, toughness and
 * colours fit what the engine says; if several fit, the answer is
 * "ambiguous" rather than a guess.
 */
export async function resolveEngineKey(db: LocalDatabase, key: string, hints: KeyHints = {}): Promise<KeyResolution> {
  if (hints.token === true) {
    const name = key.endsWith(FORGE_TOKEN_SUFFIX) ? key.slice(0, -FORGE_TOKEN_SUFFIX.length) : key
    const fitting = (await findCardsByName(db, name)).filter((match) => TOKEN_LAYOUTS.has(match.card.layout) && tokenFits(match.card, hints))
    if (fitting.length === 1) return { status: "found", match: fitting[0]! }
    if (fitting.length > 1) return { status: "ambiguous", matches: fitting }
    return { status: "not-found" }
  }
  const matches = (await findCardsByName(db, key)).filter((match) => !TOKEN_LAYOUTS.has(match.card.layout) && match.kind !== "printed")
  if (matches.length > 1) {
    // Forge's own name for the card decides between cards that share a face name: the card Forge knows by exactly
    // this name ("Rampant Growth" is a card of its own and also the second face of Studious First-Year, which Forge
    // names "Studious First-Year" - prompt 16), else the only one Forge has at all.
    const named = matches.filter((match) => match.card.forgeNames.some((forgeName) => nameKey(forgeName) === nameKey(key)))
    if (named.length === 1) return { status: "found", match: named[0]! }
    const own = matches.filter((match) => match.card.forgeNames.length > 0)
    if (own.length === 1) return { status: "found", match: own[0]! }
    return { status: "ambiguous", matches }
  }
  if (matches.length === 1) return { status: "found", match: matches[0]! }
  const forgeOnly = await findForgeOnly(db, key)
  if (forgeOnly) return { status: "forge-only", card: forgeOnly }
  return { status: "not-found" }
}

export async function getSet(db: LocalDatabase, code: string): Promise<SetRecord | null> {
  return (await db.read(["scryfallSets"], (transaction) => transaction.objectStore("scryfallSets").get(code.toLowerCase()))) ?? null
}

/** The Scryfall set behind a set code as MTG Arena writes it in deck exports (Arena code first, then Scryfall's own code). */
export async function findSetByArenaCode(db: LocalDatabase, code: string): Promise<SetRecord | null> {
  return db.read(["scryfallSets"], async (transaction) => {
    const store = transaction.objectStore("scryfallSets")
    const byArena = await store.index("arenaCode").getAll(code.toLowerCase())
    const upper = byArena.length === 0 ? await store.index("arenaCode").getAll(code.toUpperCase()) : []
    const found = byArena[0] ?? upper[0] ?? (await store.get(code.toLowerCase()))
    return found ?? null
  })
}

/** The Scryfall sets of a Forge edition code (VisibleCard.set). */
export async function findSetsByForgeCode(db: LocalDatabase, code: string): Promise<SetRecord[]> {
  return db.read(["scryfallSets"], (transaction) => transaction.objectStore("scryfallSets").index("forgeCodes").getAll(code))
}
