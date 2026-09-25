/*
 * The card catalog: one record per card (Oracle identity) with what OpenMana
 * shows and looks up - never what the rules do, which Forge alone decides.
 * Built from Scryfall's "all_cards" bulk data (every printing in every
 * language) and matched against Forge's card database, so every record names
 * the Forge cards it is and every Forge card either has a record or a reason
 * why not.
 *
 * Pure and deterministic: the same inputs give the same catalog, line by
 * line (no clock, sorted output). The file around it is written by
 * build-catalog.ts; the format is CatalogHeader/CatalogLine/CatalogEnd in
 * src/storage/schema/local-data.schema.json.
 *
 * Choices, each documented in docs/implementation/08-scryfall-data.md:
 * - Printings shown by default: prints.de is the best German printing with a
 *   real picture (lowres or highres scan; placeholders are Scryfall's
 *   stand-ins and never count as German), prints.fallback the best English
 *   one (or one in the card's only language). "Best": no content warning,
 *   not oversized, regular frame (no borderless/gold border/showcase/
 *   extended/full art, not textless), not a promo, paper, newest - in that
 *   order.
 * - German text: the German printing with the most complete translation
 *   (name, type line, rules text per face; a field only counts where it
 *   differs from the English one); among equals one in a regular frame (a
 *   full-art basic land prints only its mana symbol), the one whose picture
 *   is shown, then the newest.
 * - Name keys: English name and face names, English names printed on some
 *   printings (Universes Beyond, flavour names), every German printed name.
 */
import { nameKey, nameKeys, TOKEN_LAYOUTS } from "../../src/cards/names.ts"
import type { ScryfallCard, ScryfallSet } from "../../src/cards/scryfall/generated/records.ts"
import { facesOf, nonEmpty, printFacts, ScryfallDataError, translatedFaces } from "../../src/cards/scryfall-print.ts"
import type {
  CardAlias,
  CardFace,
  CardRecord,
  ForgeOnlyCardRecord,
  PrintedText,
  PrintRef,
  SetRecord,
} from "../../src/storage/generated/records.ts"
import type { ForgeCard, ForgeCardDatabase } from "./forge-cards.ts"

/** Layouts that are no game objects: Art Series cards and deck-type indicator cards. */
export const SKIPPED_LAYOUTS: ReadonlySet<string> = new Set(["art_series", "front_card"])

/**
 * Reversible cards are one piece of cardboard with two unrelated cards; each
 * face is a printing of another card, which has its own printings anyway.
 */
export const REVERSIBLE_LAYOUT = "reversible_card"

const IMAGE_RANK: Readonly<Record<ScryfallCard["image_status"], number>> = { missing: 0, placeholder: 1, lowres: 2, highres_scan: 3 }

/** Frame effects that make a printing harder to read than the regular frame. */
const IRREGULAR_FRAMES: ReadonlySet<string> = new Set(["showcase", "extendedart", "inverted", "etched", "fullart", "textless", "shatteredglass"])

const COLOR_ORDER = "WUBRG"

export class CatalogError extends Error {
  override name = "CatalogError"
}

/**
 * Sorting by code points, never by locale: the catalog must be the same byte
 * for byte on every machine (localeCompare depends on the build machine's
 * language and ICU version).
 */
export function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function colorLetters(colors: readonly string[] | undefined): string {
  if (!colors) return ""
  return [...new Set(colors)].sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b)).join("")
}

/** A printing as a candidate for display, with what ranks it. */
interface Candidate {
  readonly ref: PrintRef
  readonly imageRank: number
  readonly regular: boolean
  readonly flags: { readonly contentWarning: boolean; readonly oversized: boolean; readonly promo: boolean; readonly paper: boolean }
}

/** Positive if a is the better printing to show. Total and deterministic (the id decides last). */
export function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    a.imageRank - b.imageRank ||
    Number(!a.flags.contentWarning) - Number(!b.flags.contentWarning) ||
    Number(!a.flags.oversized) - Number(!b.flags.oversized) ||
    Number(a.regular) - Number(b.regular) ||
    Number(!a.flags.promo) - Number(!b.flags.promo) ||
    Number(a.flags.paper) - Number(b.flags.paper) ||
    byCodePoint(a.ref.releasedAt, b.ref.releasedAt) ||
    // Deterministic, nothing more: the lower id wins a tie.
    byCodePoint(b.ref.id, a.ref.id)
  )
}

function better(current: Candidate | null, next: Candidate): Candidate {
  return current === null || compareCandidates(next, current) > 0 ? next : current
}

/** The PrintRef of a printing; a picture URL that breaks the rule of src/cards/images.ts stops the build. */
export function printRef(card: ScryfallCard): PrintRef {
  try {
    return printFacts(card)
  } catch (error) {
    if (error instanceof ScryfallDataError) throw new CatalogError(error.message)
    throw error
  }
}

function candidate(card: ScryfallCard): Candidate {
  const ref = printRef(card)
  const frames = card.frame_effects ?? []
  return {
    ref,
    // A printing without any picture ranks lowest whatever Scryfall's status says.
    imageRank: ref.imageSides === 0 ? 0 : IMAGE_RANK[card.image_status],
    regular:
      !card.full_art &&
      !card.textless &&
      card.border_color !== "borderless" &&
      card.border_color !== "gold" &&
      !frames.some((frame) => IRREGULAR_FRAMES.has(frame)),
    flags: { contentWarning: card.content_warning === true, oversized: card.oversized, promo: card.promo, paper: card.games.includes("paper") },
  }
}

/** Oracle data: the same on every printing of a card; taken from an English one where there is one. */
interface OracleData {
  readonly name: string
  readonly layout: string
  readonly faces: readonly CardFace[]
  readonly manaValue: number
  readonly colors: string
  readonly colorIdentity: string
}

function oracleData(card: ScryfallCard): OracleData {
  const multi = card.card_faces !== undefined
  const faces: CardFace[] = facesOf(card).map((face) => {
    const out: {
      name: string
      manaCost?: string
      typeLine?: string
      oracleText?: string
      power?: string
      toughness?: string
      loyalty?: string
      defense?: string
      colors?: string
    } = { name: face.name }
    const manaCost = nonEmpty(face.mana_cost)
    if (manaCost !== undefined) out.manaCost = manaCost
    const typeLine = nonEmpty(face.type_line)
    if (typeLine !== undefined) out.typeLine = typeLine
    const oracleText = nonEmpty(face.oracle_text)
    if (oracleText !== undefined) out.oracleText = oracleText
    for (const key of ["power", "toughness", "loyalty", "defense"] as const) {
      const value = nonEmpty(face[key])
      if (value !== undefined) out[key] = value
    }
    if (multi && face.colors !== undefined && card.colors === undefined) out.colors = colorLetters(face.colors)
    return out as CardFace
  })
  if (faces.length === 0) throw new CatalogError(`card ${card.id} (${card.name}) has no faces`)
  return {
    name: card.name,
    layout: card.layout,
    faces,
    manaValue: card.cmc ?? 0,
    colors: card.colors !== undefined ? colorLetters(card.colors) : colorLetters(card.card_faces?.[0]?.colors),
    colorIdentity: colorLetters(card.color_identity),
  }
}

interface TextCandidate {
  readonly text: PrintedText
  readonly completeness: number
  /** Regular frame: a full-art basic land prints only its mana symbol, not its rules text. */
  readonly regular: boolean
  readonly printId: string
}

interface Draft {
  oracle: OracleData | null
  oracleFromEnglish: boolean
  fallback: Candidate | null
  german: Candidate | null
  germanTexts: TextCandidate[]
  germanNames: Set<string>
  aliases: Map<string, { name: string; best: Candidate }>
  forgeNames: Set<string>
}

export type ForgeMatchMethod = "name" | "face" | "alias" | "edition"

export interface ForgeOnlyEntry extends ForgeOnlyCardRecord {
  readonly file: string
}

export interface CatalogReport {
  readonly matched: Readonly<Record<ForgeMatchMethod, number>>
  /** Forge cards that fit several catalog cards (Un-cards with the same name …); their name is on each. */
  readonly ambiguous: readonly { readonly name: string; readonly file: string; readonly oracleIds: readonly string[] }[]
  readonly forgeOnly: readonly ForgeOnlyEntry[]
  /** Forge cards with German text / a German picture in the catalog. */
  readonly forgeGermanText: number
  readonly forgeGermanImage: number
  readonly skippedPrintings: number
}

export interface Catalog {
  readonly cards: readonly CardRecord[]
  readonly sets: readonly SetRecord[]
  readonly forgeOnly: readonly ForgeOnlyCardRecord[]
  readonly report: CatalogReport
}

/** A Forge card without Scryfall match that is explained in cards/forge-unmatched.json. */
export interface UnmatchedException {
  readonly name: string
  readonly note: string
}

export interface BuildOptions {
  readonly forge: ForgeCardDatabase
  readonly sets: readonly ScryfallSet[]
  readonly unmatched: readonly UnmatchedException[]
}

/** Rebalanced MTG Arena cards (A-…): Forge has them, Scryfall does not list them. */
export function isRebalanced(card: ForgeCard): boolean {
  return card.file.startsWith("rebalanced/") || card.name.startsWith("A-")
}

export class CatalogBuilder {
  readonly #drafts = new Map<string, Draft>()
  /** Every printing (any language): "set|collector number" → Oracle id, for Forge's edition entries. */
  readonly #printings = new Map<string, string>()
  #skipped = 0

  #draft(oracleId: string): Draft {
    let draft = this.#drafts.get(oracleId)
    if (!draft) {
      draft = {
        oracle: null,
        oracleFromEnglish: false,
        fallback: null,
        german: null,
        germanTexts: [],
        germanNames: new Set(),
        aliases: new Map(),
        forgeNames: new Set(),
      }
      this.#drafts.set(oracleId, draft)
    }
    return draft
  }

  /** One card object of the bulk data (already checked against the Scryfall schema). */
  add(card: ScryfallCard): void {
    if (SKIPPED_LAYOUTS.has(card.layout) || card.layout === REVERSIBLE_LAYOUT) {
      this.#skipped++
      return
    }
    const oracleId = card.oracle_id
    if (oracleId === undefined) throw new CatalogError(`card ${card.id} (${card.name}, layout ${card.layout}) has no oracle_id`)
    this.#printings.set(`${card.set}|${card.collector_number}`, oracleId)
    const draft = this.#draft(oracleId)
    const english = card.lang === "en"
    if (draft.oracle === null || (english && !draft.oracleFromEnglish)) {
      draft.oracle = oracleData(card)
      draft.oracleFromEnglish = english
    }
    const option = candidate(card)
    if (card.lang === "de") {
      if (option.imageRank >= IMAGE_RANK.lowres) draft.german = better(draft.german, option)
      const printed = translatedFaces(card)
      if (printed.completeness > 0) {
        draft.germanTexts.push({
          text: { faces: printed.faces as PrintedText["faces"], set: card.set, collectorNumber: card.collector_number, releasedAt: card.released_at },
          completeness: printed.completeness,
          regular: option.regular,
          printId: card.id,
        })
        const names = printed.faces.map((face, i) => face.name ?? facesOf(card)[i]?.name)
        for (const name of names) if (name !== undefined) draft.germanNames.add(name)
        if (names.length > 1 && names.every((name) => name !== undefined)) draft.germanNames.add(names.join(" // "))
      }
    } else if (english || !draft.oracleFromEnglish) {
      // English, or - as long as there is no English printing - the card's other languages.
      if (english && draft.fallback !== null && draft.fallback.ref.lang !== "en") draft.fallback = null
      if (english || draft.fallback === null || draft.fallback.ref.lang !== "en") draft.fallback = better(draft.fallback, option)
    }
    if (english) this.#collectAliases(draft, card, option)
  }

  /** English names printed on this printing that are not the Oracle names (Universes Beyond, flavour names). */
  #collectAliases(draft: Draft, card: ScryfallCard, option: Candidate): void {
    const oracleNames = new Set([card.name, ...facesOf(card).map((face) => face.name)].map(nameKey))
    const printed: string[] = []
    const faceAliases = facesOf(card).map((face) => nonEmpty(face.printed_name) ?? nonEmpty(face.flavor_name))
    if (card.card_faces && faceAliases.every((name) => name !== undefined)) printed.push(faceAliases.join(" // "))
    for (const name of [nonEmpty(card.printed_name), nonEmpty(card.flavor_name), ...faceAliases]) {
      if (name !== undefined) printed.push(name)
    }
    for (const name of printed) {
      const key = nameKey(name)
      if (oracleNames.has(key)) continue
      const known = draft.aliases.get(key)
      draft.aliases.set(key, { name: known?.name ?? name, best: known ? better(known.best, option) : option })
    }
  }

  /** The finished catalog: records, sets, Forge cards without Scryfall data and the report. Throws on unexplained Forge cards. */
  build(options: BuildOptions): Catalog {
    const { forge } = options
    const report = this.#matchForge(forge, options.unmatched)
    const cards: CardRecord[] = []
    let forgeGermanText = 0
    let forgeGermanImage = 0
    for (const oracleId of [...this.#drafts.keys()].sort()) {
      const record = this.#record(oracleId, this.#drafts.get(oracleId)!)
      if (record === null) continue
      if (record.forgeNames.length > 0) {
        if (record.de !== null) forgeGermanText++
        if (record.prints.de !== null) forgeGermanImage++
      }
      cards.push(record)
    }
    const forgeCodes = new Map<string, Set<string>>()
    for (const edition of forge.editions) {
      const codes = forgeCodes.get(edition.scryfallCode) ?? new Set<string>()
      codes.add(edition.code)
      codes.add(edition.code2)
      forgeCodes.set(edition.scryfallCode, codes)
    }
    const sets = [...options.sets].sort((a, b) => byCodePoint(a.code, b.code)).map((set) => setRecord(set, [...(forgeCodes.get(set.code) ?? [])].sort()))
    return {
      cards,
      sets,
      forgeOnly: report.forgeOnly.map(({ file: _file, ...record }) => record),
      report: { ...report, forgeGermanText, forgeGermanImage, skippedPrintings: this.#skipped },
    }
  }

  #record(oracleId: string, draft: Draft): CardRecord | null {
    const oracle = draft.oracle
    if (oracle === null) return null
    const germanText = this.#germanText(draft, oracle)
    const aliases: CardAlias[] = [...draft.aliases.values()]
      .sort((a, b) => byCodePoint(a.name, b.name))
      .map((alias) => ({ name: alias.name, print: alias.best.ref }))
    const keys = nameKeys([
      oracle.name,
      ...oracle.faces.map((face) => face.name),
      ...aliases.map((alias) => alias.name),
      ...aliases.flatMap((alias) => (alias.name.includes(" // ") ? alias.name.split(" // ") : [])),
      ...[...draft.germanNames].sort(),
      ...[...draft.forgeNames].sort(),
    ])
    if (keys.length === 0) throw new CatalogError(`card ${oracleId} (${oracle.name}) has no usable name`)
    return {
      oracleId,
      name: oracle.name,
      layout: oracle.layout,
      faces: oracle.faces as CardRecord["faces"],
      manaValue: oracle.manaValue,
      colors: oracle.colors,
      colorIdentity: oracle.colorIdentity,
      forgeNames: [...draft.forgeNames].sort(),
      nameKeys: keys as CardRecord["nameKeys"],
      de: germanText,
      prints: { de: draft.german?.ref ?? null, fallback: draft.fallback?.ref ?? null },
      ...(aliases.length > 0 ? { aliases } : {}),
    }
  }

  /** The most complete German text; among equals one in a regular frame, the one of the picture shown, then the newest. */
  #germanText(draft: Draft, oracle: OracleData): PrintedText | null {
    const shown = draft.german?.ref.id
    const usable = draft.germanTexts.filter((text) => text.text.faces.length === oracle.faces.length)
    usable.sort(
      (a, b) =>
        b.completeness - a.completeness ||
        Number(b.regular) - Number(a.regular) ||
        Number(b.printId === shown) - Number(a.printId === shown) ||
        byCodePoint(b.text.releasedAt, a.text.releasedAt) ||
        byCodePoint(a.printId, b.printId),
    )
    return usable[0]?.text ?? null
  }

  /**
   * Which catalog card every Forge card is: by its name, a face name, an
   * English alias - or, where the name fits none or several, by the
   * printings Forge's editions list for it (Scryfall set + collector number).
   */
  #matchForge(forge: ForgeCardDatabase, exceptions: readonly UnmatchedException[]): Omit<CatalogReport, "forgeGermanText" | "forgeGermanImage" | "skippedPrintings"> {
    const tiers: Map<string, Set<string>>[] = [new Map(), new Map(), new Map()]
    const add = (tier: Map<string, Set<string>>, name: string, oracleId: string) => {
      const key = nameKey(name)
      const ids = tier.get(key) ?? new Set<string>()
      ids.add(oracleId)
      tier.set(key, ids)
    }
    for (const [oracleId, draft] of this.#drafts) {
      const oracle = draft.oracle
      if (oracle === null || TOKEN_LAYOUTS.has(oracle.layout)) continue
      add(tiers[0]!, oracle.name, oracleId)
      for (const face of oracle.faces) add(tiers[1]!, face.name, oracleId)
      for (const alias of draft.aliases.values()) {
        add(tiers[2]!, alias.name, oracleId)
        for (const part of alias.name.includes(" // ") ? alias.name.split(" // ") : []) add(tiers[2]!, part, oracleId)
      }
    }
    const editionPrintings = new Map<string, Set<string>>()
    for (const edition of forge.editions) {
      for (const entry of edition.entries) {
        const oracleId = this.#printings.get(`${edition.scryfallCode}|${entry.collectorNumber}`)
        if (oracleId === undefined) continue
        const key = nameKey(entry.name)
        const ids = editionPrintings.get(key) ?? new Set<string>()
        ids.add(oracleId)
        editionPrintings.set(key, ids)
      }
    }
    const methods: ForgeMatchMethod[] = ["name", "face", "alias"]
    const matched: Record<ForgeMatchMethod, number> = { name: 0, face: 0, alias: 0, edition: 0 }
    const ambiguous: { name: string; file: string; oracleIds: string[] }[] = []
    const forgeOnly: ForgeOnlyEntry[] = []
    const unexplained: ForgeCard[] = []
    const exceptionNotes = new Map(exceptions.map((entry) => [nameKey(entry.name), entry]))
    const usedExceptions = new Set<string>()
    for (const card of forge.cards) {
      const key = nameKey(card.name)
      let ids: Set<string> | undefined
      let method: ForgeMatchMethod | undefined
      for (const [i, tier] of tiers.entries()) {
        const found = tier.get(key)
        if (found && found.size > 0) {
          ids = found
          method = methods[i]
          break
        }
      }
      if (ids === undefined || ids.size > 1) {
        const byEdition = editionPrintings.get(key)
        if (byEdition && (ids === undefined || byEdition.size < ids.size)) {
          ids = byEdition
          method = "edition"
        }
      }
      if (ids !== undefined && method !== undefined) {
        matched[method]++
        for (const oracleId of ids) this.#drafts.get(oracleId)?.forgeNames.add(card.name)
        if (ids.size > 1) ambiguous.push({ name: card.name, file: card.file, oracleIds: [...ids].sort() })
        continue
      }
      const states = nameKeys([card.name, ...card.states])
      if (isRebalanced(card)) {
        forgeOnly.push({ name: card.name, nameKeys: states as ForgeOnlyCardRecord["nameKeys"], reason: "rebalanced", file: card.file })
        continue
      }
      const exception = exceptionNotes.get(key)
      if (exception) {
        usedExceptions.add(key)
        forgeOnly.push({ name: card.name, nameKeys: states as ForgeOnlyCardRecord["nameKeys"], reason: "listed", note: exception.note, file: card.file })
        continue
      }
      unexplained.push(card)
    }
    const problems: string[] = []
    if (unexplained.length > 0) {
      problems.push(
        `${unexplained.length} Forge card(s) have no Scryfall data and are not explained in cards/forge-unmatched.json: ${unexplained
          .map((card) => `${card.name} (${card.file})`)
          .join("; ")}`,
      )
    }
    const stale = exceptions.filter((entry) => !usedExceptions.has(nameKey(entry.name)))
    if (stale.length > 0) {
      problems.push(`cards/forge-unmatched.json lists cards that are no longer unmatched (remove them): ${stale.map((entry) => entry.name).join("; ")}`)
    }
    if (problems.length > 0) throw new CatalogError(problems.join("\n"))
    // One entry per Forge name (variant scripts share a name).
    const unique = new Map(forgeOnly.map((entry) => [entry.name, entry]))
    return {
      matched,
      ambiguous: ambiguous.sort((a, b) => byCodePoint(a.name, b.name)),
      forgeOnly: [...unique.values()].sort((a, b) => byCodePoint(a.name, b.name)),
    }
  }
}

export function setRecord(set: ScryfallSet, forgeCodes: readonly string[]): SetRecord {
  return {
    code: set.code,
    name: set.name,
    setType: set.set_type,
    ...(set.released_at !== undefined ? { releasedAt: set.released_at } : {}),
    digital: set.digital,
    cardCount: set.card_count,
    ...(set.parent_set_code !== undefined ? { parentCode: set.parent_set_code } : {}),
    ...(set.arena_code !== undefined ? { arenaCode: set.arena_code } : {}),
    ...(set.mtgo_code !== undefined ? { mtgoCode: set.mtgo_code } : {}),
    forgeCodes: [...forgeCodes],
  }
}
