/*
 * The table's background (project owner, 2026-10-12): the drawn table
 * (TableSurface's desk, board and rune ring - the default), one of two
 * pictures that come with OpenMana, or a picture of the player's own. Two
 * settings under display.* (this device only, never in the ORYX cloud; both
 * travel in backups like every setting):
 *  - display.tableBackground: which one ("table", "colors", "planeswalker",
 *    "grid", "custom");
 *  - display.tableBackgroundImage: the player's own picture as a data: URL
 *    (WebP, at most MAX_SIDE px on its longer side), or null. It stays when
 *    another background is chosen, so choosing it again needs no new upload.
 *
 * A picture replaces the whole drawn table (object-fit: cover, centred); it
 * is decoration only, like the drawing (aria-hidden, no pointer events).
 */
import { defineSetting } from "@/storage/settings"
import colorsHoch from "./backgrounds/farbrad-hoch.webp"
import colorsQuer from "./backgrounds/farbrad-quer.webp"
import planeswalkerHoch from "./backgrounds/planeswalker-hoch.webp"
import planeswalkerQuer from "./backgrounds/planeswalker-quer.webp"
import gridHoch from "./backgrounds/raster-hoch.webp"
import gridQuer from "./backgrounds/raster-quer.webp"

export type TableBackgroundChoice = "table" | "colors" | "planeswalker" | "grid" | "custom"

const CHOICES: readonly TableBackgroundChoice[] = ["table", "colors", "planeswalker", "grid", "custom"]

export const TABLE_BACKGROUND = defineSetting<TableBackgroundChoice>("display.tableBackground", "table", (value): value is TableBackgroundChoice =>
  CHOICES.includes(value as TableBackgroundChoice),
)

/** The longest side of the player's own picture once stored (px): sharp on a 1440p screen, small in a backup. */
export const MAX_SIDE = 2560

/** The stored picture's limit (characters of its data: URL, about 6 MB of picture). */
const MAX_URL = 8_000_000

const IMAGE_URL = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/

export const TABLE_BACKGROUND_IMAGE = defineSetting<string | null>("display.tableBackgroundImage", null, (value): value is string | null =>
  value === null || (typeof value === "string" && value.length <= MAX_URL && IMAGE_URL.test(value)),
)

/** A picture that comes with OpenMana: one for windows wider than tall, one for taller ones. */
export interface BuiltInBackground {
  readonly choice: Exclude<TableBackgroundChoice, "table" | "custom">
  readonly label: string
  readonly wide: string
  readonly tall: string
}

export const BUILT_IN_BACKGROUNDS: readonly BuiltInBackground[] = [
  { choice: "colors", label: "Farbenrad", wide: colorsQuer, tall: colorsHoch },
  { choice: "planeswalker", label: "Planeswalker", wide: planeswalkerQuer, tall: planeswalkerHoch },
  { choice: "grid", label: "Chip-Raster", wide: gridQuer, tall: gridHoch },
]

/** What the table shows: the drawing, or a picture (a built-in one in two orientations, or the player's own). */
export type TableBackground =
  | { readonly kind: "table" }
  | { readonly kind: "picture"; readonly choice: BuiltInBackground["choice"]; readonly wide: string; readonly tall: string }
  | { readonly kind: "custom"; readonly src: string }

/** The background for the stored choice; "custom" without a stored picture is the drawn table. */
export function tableBackground(choice: TableBackgroundChoice, image: string | null): TableBackground {
  if (choice === "custom") return image === null ? { kind: "table" } : { kind: "custom", src: image }
  const builtIn = BUILT_IN_BACKGROUNDS.find((background) => background.choice === choice)
  return builtIn === undefined ? { kind: "table" } : { kind: "picture", choice: builtIn.choice, wide: builtIn.wide, tall: builtIn.tall }
}

/** Why a picture could not be taken (shown to the player). */
export class BackgroundImageError extends Error {}

/** The size a picture of width × height gets: its longer side at most MAX_SIDE, never enlarged. */
export function storedSize(width: number, height: number): { readonly width: number; readonly height: number } {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * The player's picture file as it is stored: decoded by the browser, scaled
 * down to MAX_SIDE, encoded as WebP (JPEG where the browser cannot) and read
 * as a data: URL. Fails with BackgroundImageError for what is no picture or
 * too large even then.
 */
export async function prepareBackgroundImage(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/")) throw new BackgroundImageError("Das ist kein Bild. Wähle eine Bilddatei (zum Beispiel JPG, PNG oder WebP).")
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new BackgroundImageError("Dieses Bild kann der Browser nicht öffnen. Wähle ein anderes (zum Beispiel JPG, PNG oder WebP).")
  }
  const { width, height } = storedSize(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (context === null) throw new BackgroundImageError("Das Bild konnte nicht verkleinert werden.")
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86))
  const blob = encoded ?? (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86)))
  if (blob === null) throw new BackgroundImageError("Das Bild konnte nicht gespeichert werden.")
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new BackgroundImageError("Das Bild konnte nicht gelesen werden."))
    reader.readAsDataURL(blob)
  })
  if (!TABLE_BACKGROUND_IMAGE.check(url)) throw new BackgroundImageError("Das Bild ist auch verkleinert zu groß. Wähle ein kleineres.")
  return url
}
