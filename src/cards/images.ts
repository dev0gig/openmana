/*
 * Card pictures come straight from Scryfall's image servers
 * (cards.scryfall.io): no rate limit, CORS for every origin
 * (Access-Control-Allow-Origin: *), cached by the browser for a year. They
 * carry no Cross-Origin-Resource-Policy, so under the app's COEP
 * (require-corp) an <img> must load them in CORS mode (crossOrigin
 * "anonymous"); src/cards/card-image.tsx does.
 *
 * The URLs are not stored: Scryfall builds them from the printing's id, the
 * side, the version and the image timestamp, and so does imageUrl(). The
 * catalog build checks every URL of every catalog printing against this rule
 * (parseImageUrl) and fails if Scryfall ever changes it.
 */

export const IMAGE_ORIGIN = "https://cards.scryfall.io"

/** What Scryfall serves while it has no picture of a printing (image_status missing). */
export const MISSING_IMAGE_URL = "https://errors.scryfall.com/soon.jpg"

export type ImageSide = "front" | "back"

/**
 * The picture versions OpenMana shows: Scryfall's WebP versions, which
 * replace the older JPEGs of the same size. thumb 146×204 (lists), grid
 * 488×680 (cards on screen), display 672×936 (the full card view).
 */
export type ImageSize = "thumb" | "grid" | "display"

export const IMAGE_SIZES: Readonly<Record<ImageSize, { readonly width: number; readonly height: number }>> = {
  thumb: { width: 146, height: 204 },
  grid: { width: 488, height: 680 },
  display: { width: 672, height: 936 },
}

/** Every version Scryfall lists in image_uris, with its file type. */
const VERSION_EXTENSIONS: Readonly<Record<string, string>> = {
  small: "jpg",
  normal: "jpg",
  large: "jpg",
  png: "png",
  art_crop: "jpg",
  border_crop: "jpg",
  thumb: "webp",
  grid: "webp",
  display: "webp",
  art: "webp",
  crop: "webp",
}

/** The part of a printing the URL is made of. */
export interface ImageSource {
  readonly id: string
  readonly imageSides: 0 | 1 | 2
  readonly imageVersion?: string
}

/** The URL of one picture of a printing, as Scryfall builds it. */
export function scryfallImageUrl(id: string, side: ImageSide, version: string, timestamp: string): string {
  const extension = VERSION_EXTENSIONS[version]
  if (extension === undefined) throw new Error(`unknown Scryfall image version ${version}`)
  return `${IMAGE_ORIGIN}/${version}/${side}/${id[0]}/${id[1]}/${id}.${extension}?${timestamp}`
}

/**
 * The picture of `side` in `size`, or null if the printing has none (no
 * picture at all, or no back picture). Side "back" exists only for
 * double-faced printings (imageSides 2).
 */
export function imageUrl(print: ImageSource, side: ImageSide, size: ImageSize): string | null {
  if (print.imageVersion === undefined || print.imageSides === 0) return null
  if (side === "back" && print.imageSides !== 2) return null
  return scryfallImageUrl(print.id, side, size, print.imageVersion)
}

export interface ParsedImageUrl {
  readonly version: string
  readonly side: ImageSide
  readonly id: string
  readonly timestamp: string
}

const IMAGE_URL = /^https:\/\/cards\.scryfall\.io\/([a-z_]+)\/(front|back)\/([0-9a-f])\/([0-9a-f])\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)\?(\d+)$/

/** A Scryfall picture URL taken apart, or null if it does not follow the rule scryfallImageUrl() builds by. */
export function parseImageUrl(url: string): ParsedImageUrl | null {
  const match = IMAGE_URL.exec(url)
  if (!match) return null
  const [, version = "", side = "", first = "", second = "", id = "", extension = "", timestamp = ""] = match
  if (VERSION_EXTENSIONS[version] !== extension || id[0] !== first || id[1] !== second) return null
  const parsed = { version, side: side as ImageSide, id, timestamp }
  return scryfallImageUrl(id, parsed.side, version, timestamp) === url ? parsed : null
}
