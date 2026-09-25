/*
 * One Scryfall card object (one printing) turned into what OpenMana keeps of
 * it: the picture facts (checked against the URL rule of images.ts) and the
 * translated text. Shared by the catalog build (cards/scripts, Node) and the
 * app (printings fetched from the API), so both read Scryfall the same way.
 * Imports carry their .ts extension: Node runs this file directly.
 */
import type { ScryfallCard, ScryfallCardFace } from "./scryfall/generated/records.ts"
import { MISSING_IMAGE_URL, parseImageUrl } from "./images.ts"

/** Scryfall data that does not fit what OpenMana relies on. */
export class ScryfallDataError extends Error {
  override name = "ScryfallDataError"
}

export function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value
}

/** The faces of a card object whose texts OpenMana reads: card_faces, or the card itself. */
export function facesOf(card: ScryfallCard): readonly (ScryfallCard | ScryfallCardFace)[] {
  return card.card_faces ?? [card]
}

export interface ImageFacts {
  readonly sides: 0 | 1 | 2
  readonly version?: string
}

/**
 * Checks every picture URL of a printing against the rule the app builds
 * them by (images.ts) and says how many sides it has and the image
 * timestamp. Scryfall's "soon" picture is allowed only for printings without
 * a picture.
 */
export function imageFacts(card: ScryfallCard): ImageFacts {
  const sources: { readonly side: "front" | "back"; readonly uris: Readonly<Record<string, string | undefined>> }[] = []
  if (card.image_uris) sources.push({ side: "front", uris: card.image_uris })
  card.card_faces?.forEach((face, i) => {
    if (face.image_uris) sources.push({ side: i === 0 ? "front" : "back", uris: face.image_uris })
  })
  if (sources.length === 0) return { sides: 0 }
  const timestamps = new Set<string>()
  let missing = false
  for (const source of sources) {
    for (const [version, url] of Object.entries(source.uris)) {
      if (url === undefined) continue
      if (url === MISSING_IMAGE_URL) {
        missing = true
        continue
      }
      const parsed = parseImageUrl(url)
      if (parsed === null || parsed.id !== card.id || parsed.side !== source.side || parsed.version !== version) {
        throw new ScryfallDataError(`card ${card.id} (${card.name}, ${card.set} ${card.collector_number}): picture URL ${url} does not follow src/cards/images.ts`)
      }
      timestamps.add(parsed.timestamp)
    }
  }
  if (missing) {
    if (card.image_status !== "missing" || timestamps.size > 0) {
      throw new ScryfallDataError(`card ${card.id} (${card.name}): Scryfall's placeholder URL on a printing with image status ${card.image_status}`)
    }
    return { sides: 0 }
  }
  if (timestamps.size !== 1) throw new ScryfallDataError(`card ${card.id} (${card.name}): its pictures have ${timestamps.size} different timestamps`)
  if (sources.length > 2 || (sources.length === 2 && sources[0]?.side === sources[1]?.side)) {
    throw new ScryfallDataError(`card ${card.id} (${card.name}): unexpected picture layout (${sources.map((s) => s.side).join(", ")})`)
  }
  return { sides: sources.length === 2 ? 2 : 1, version: [...timestamps][0]! }
}

/** The printing facts OpenMana keeps (PrintRef in the local data schema). */
export interface PrintFacts {
  readonly id: string
  readonly set: string
  readonly collectorNumber: string
  readonly lang: string
  readonly releasedAt: string
  readonly imageStatus: ScryfallCard["image_status"]
  readonly imageSides: 0 | 1 | 2
  readonly imageVersion?: string
  readonly artist?: string
}

export function printFacts(card: ScryfallCard): PrintFacts {
  const image = imageFacts(card)
  const artist = nonEmpty(card.artist) ?? nonEmpty(card.card_faces?.[0]?.artist)
  return {
    id: card.id,
    set: card.set,
    collectorNumber: card.collector_number,
    lang: card.lang,
    releasedAt: card.released_at,
    imageStatus: card.image_status,
    imageSides: image.sides,
    ...(image.version !== undefined ? { imageVersion: image.version } : {}),
    ...(artist !== undefined ? { artist } : {}),
  }
}

export interface TranslatedFace {
  readonly name?: string
  readonly typeLine?: string
  readonly text?: string
}

/**
 * The translated text of a printing per face, and how complete it is. Only
 * fields that differ from the English ones count as translated: some
 * printings in other languages carry English "printed" texts in Scryfall's
 * data (a German Forest printed_name "Forest", a German Delver of Secrets
 * with the English name above German rules text). Such a field is left out,
 * and the English one stands in for it, marked as English.
 */
export function translatedFaces(card: ScryfallCard): { readonly faces: TranslatedFace[]; readonly completeness: number } {
  let completeness = 0
  const faces = facesOf(card).map((face) => {
    const out: { name?: string; typeLine?: string; text?: string } = {}
    const translated = (printed: string | undefined, english: string | undefined): string | undefined => {
      const value = nonEmpty(printed)
      if (value === undefined || value === english) return undefined
      completeness++
      return value
    }
    const name = translated(face.printed_name, face.name)
    if (name !== undefined) out.name = name
    const typeLine = translated(face.printed_type_line, face.type_line)
    if (typeLine !== undefined) out.typeLine = typeLine
    const text = translated(face.printed_text, face.oracle_text)
    if (text !== undefined) out.text = text
    return out
  })
  return { faces, completeness }
}
