/*
 * What to show for a card: German where Scryfall has it, English where not -
 * field by field, and always saying which is which. Pure: the same record
 * and request give the same display; no network, no database.
 *
 * - Picture: a particular printing if one is asked for (a deck names set
 *   and collector number) and has a picture; an English alias name (a
 *   Universes Beyond card Forge knows by that name) shows the printing that
 *   carries it; otherwise the German default printing, else the English one.
 *   A double-faced printing shows the side of the requested face.
 * - Name, type line and rules text: the German printed text per face where
 *   it exists, else the English Oracle text (marked "en"). German printed
 *   texts are translations of their day and receive no errata; the rules
 *   are Forge's (in a game, Forge's own live text is authoritative).
 * - Mana cost, power, toughness, loyalty, defense: always the Oracle values.
 */
import type { CardRecord, PrintRecord, PrintRef } from "@/storage/generated/records"
import type { CardMatch } from "./card-lookup"
import { IMAGE_SIZES, imageUrl, type ImageSide, type ImageSize } from "./images"

export type TextLanguage = "de" | "en"

export interface LocalizedText {
  readonly text: string
  readonly lang: TextLanguage
}

export interface DisplayFace {
  readonly index: number
  readonly name: LocalizedText
  readonly englishName: string
  readonly typeLine: LocalizedText | null
  readonly text: LocalizedText | null
  readonly manaCost: string | null
  readonly power: string | null
  readonly toughness: string | null
  readonly loyalty: string | null
  readonly defense: string | null
}

/** Which printing a picture comes from and why that one. */
export type PictureSource = "requested-print" | "alias" | "german" | "fallback"

export interface DisplayPicture {
  readonly source: PictureSource
  readonly printId: string
  readonly set: string
  readonly collectorNumber: string
  /** The printing's language (de, en, or the card's only language). */
  readonly lang: string
  readonly side: ImageSide
  readonly urls: Readonly<Record<ImageSize, string>>
  readonly artist: string | null
  /** Scryfall's scan quality: lowres pictures are real but not sharp. */
  readonly lowQuality: boolean
}

export interface CardDisplay {
  readonly oracleId: string
  readonly layout: string
  readonly englishName: string
  /** The card's (or the requested face's) name as shown. */
  readonly name: LocalizedText
  readonly faces: readonly DisplayFace[]
  /** The face asked for (0: the front / the whole card). */
  readonly face: number
  readonly picture: DisplayPicture | null
  readonly language: {
    /** null: no picture at all. */
    readonly picture: "de" | "en" | "other" | null
    /** "mixed": some fields German, some English. */
    readonly text: "de" | "en" | "mixed"
    /** The card has German text at all (false: Scryfall knows no German printing with text). */
    readonly germanTextExists: boolean
    /** A German picture exists (maybe not the one shown, e.g. for a requested English printing). */
    readonly germanPictureExists: boolean
  }
}

export interface DisplayRequest {
  /** Show this face (index into card.faces); default 0, or the face a match names. */
  readonly face?: number
  /** A particular printing (fetched for a deck entry); used if it has a picture. */
  readonly print?: PrintRecord | null
  /** How the card was found: an alias shows its own printing and face. */
  readonly match?: CardMatch
}

function sideFor(print: Pick<PrintRef, "imageSides">, face: number): ImageSide {
  return print.imageSides === 2 && face === 1 ? "back" : "front"
}

function picture(print: PrintRef | PrintRecord, source: PictureSource, face: number): DisplayPicture | null {
  const side = sideFor(print, face)
  const urls = {} as Record<ImageSize, string>
  for (const size of Object.keys(IMAGE_SIZES) as ImageSize[]) {
    const url = imageUrl(print, side, size)
    if (url === null) return null
    urls[size] = url
  }
  return {
    source,
    printId: print.id,
    set: print.set,
    collectorNumber: print.collectorNumber,
    lang: print.lang,
    side,
    urls,
    artist: print.artist ?? null,
    lowQuality: print.imageStatus === "lowres",
  }
}

function localized(german: string | undefined, english: string | undefined): LocalizedText | null {
  if (german !== undefined) return { text: german, lang: "de" }
  if (english !== undefined) return { text: english, lang: "en" }
  return null
}

export function cardDisplay(card: CardRecord, request: DisplayRequest = {}): CardDisplay {
  const match = request.match
  const face = Math.min(Math.max(request.face ?? match?.face ?? 0, 0), card.faces.length - 1)
  const faces: DisplayFace[] = card.faces.map((oracle, index) => {
    const printed = card.de?.faces[index]
    return {
      index,
      name: localized(printed?.name, oracle.name)!,
      englishName: oracle.name,
      typeLine: localized(printed?.typeLine, oracle.typeLine),
      text: localized(printed?.text, oracle.oracleText),
      manaCost: oracle.manaCost ?? null,
      power: oracle.power ?? null,
      toughness: oracle.toughness ?? null,
      loyalty: oracle.loyalty ?? null,
      defense: oracle.defense ?? null,
    }
  })

  const candidates: [PrintRef | PrintRecord | null | undefined, PictureSource][] = [
    [request.print, "requested-print"],
    [match?.kind === "alias" ? match.alias?.print : null, "alias"],
    [card.prints.de, "german"],
    [card.prints.fallback, "fallback"],
  ]
  let shown: DisplayPicture | null = null
  for (const [print, source] of candidates) {
    if (!print) continue
    shown = picture(print, source, face)
    if (shown) break
  }

  const aliasName = match?.kind === "alias" ? match.alias?.name : undefined
  const shownFaces = card.faces.length > 1 && match?.face == null && request.face === undefined ? faces : [faces[face]!]
  const name: LocalizedText =
    aliasName !== undefined
      ? { text: aliasName, lang: "en" }
      : shownFaces.length > 1
        ? { text: shownFaces.map((f) => f.name.text).join(" // "), lang: shownFaces.every((f) => f.name.lang === "de") ? "de" : "en" }
        : shownFaces[0]!.name

  const fields = faces.flatMap((f) => [f.name, f.typeLine, f.text]).filter((text): text is LocalizedText => text !== null)
  const german = fields.filter((text) => text.lang === "de").length
  return {
    oracleId: card.oracleId,
    layout: card.layout,
    englishName: card.name,
    name,
    faces,
    face,
    picture: shown,
    language: {
      picture: shown === null ? null : shown.lang === "de" ? "de" : shown.lang === "en" ? "en" : "other",
      text: german === 0 ? "en" : german === fields.length ? "de" : "mixed",
      germanTextExists: card.de !== null,
      germanPictureExists: card.prints.de !== null,
    },
  }
}
