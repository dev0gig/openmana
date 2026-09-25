/*
 * The pictures of the cards on the game table (prompt 13): Forge's key of a
 * card (VisibleCard.key, the English name of the face it shows) resolved in
 * the card catalog on this device (resolveEngineKey) and shown in the
 * player's card language (cardDisplay). Only for the picture: what the card
 * is and does in this game is Forge's (its live name, type line, power and
 * toughness come with the state).
 *
 * What is remembered is only the catalog's answer for a key - static card
 * data, never a card of the game: the table always shows the current state's
 * cards (Anvil lesson: no stale card snapshots in long-lived presentation
 * state). Each key is looked up once per installed catalog.
 *
 * A key the catalog cannot decide gets no picture instead of a guess: tokens
 * of one name that fit Forge's power, toughness and colours alike
 * ("ambiguous"), cards only Forge knows, an effect card of Forge's command
 * zone. The table then shows Forge's own words for the card.
 */
import { useEffect, useMemo, useState } from "react"
import type { VisibleCard } from "@openmana/engine-protocol"
import { useCardCatalog } from "@/cards/card-catalog-context"
import { cardDisplay, type TextLanguage } from "@/cards/card-display"
import { resolveEngineKey, type CardMatch, type KeyHints } from "@/cards/card-lookup"
import { IMAGE_SIZES } from "@/cards/images"
import type { LocalDatabase } from "@/storage/database"
import { useStorage } from "@/storage/storage-context"

export interface TablePicture {
  readonly src: string
  /** Scryfall's small and large version: the browser takes what the card's size on screen needs. */
  readonly srcSet: string
  /** The card view's picture (prompt 14): Scryfall's large version, and the one between for smaller screens. */
  readonly large: string
  readonly largeSrcSet: string
  /** The picture's language (de, en or another): an English picture in a German game is marked. */
  readonly lang: string
}

/**
 * What the table can show of a card's picture:
 *  - "loading": the catalog is being asked,
 *  - "none": no picture (no catalog on this device, not in it, or not decidable),
 *  - a picture.
 */
export type TableCardPicture = TablePicture | "loading" | "none"

export type TableCardLookup = (card: VisibleCard) => TableCardPicture

/** Nothing resolves: no catalog (and a stand-in for places without one). */
export const NO_PICTURES: TableCardLookup = () => "none"

/** What the catalog answered for a key: a card (and which face), or no card to show. */
type Resolution = { readonly status: "found"; readonly match: CardMatch } | { readonly status: "none" }

/** The lookup key of a card: its engine key, and for tokens what tells tokens of one name apart. null: nothing to look up. */
export function pictureKey(card: VisibleCard): string | null {
  if (card.key === null || card.key === undefined || card.key === "") return null
  return card.token === true ? `token|${card.key}|${card.power ?? ""}|${card.toughness ?? ""}|${card.colors ?? ""}` : `card|${card.key}`
}

function hintsOf(card: VisibleCard): KeyHints {
  if (card.token !== true) return {}
  return {
    token: true,
    ...(card.power !== undefined ? { power: card.power } : {}),
    ...(card.toughness !== undefined ? { toughness: card.toughness } : {}),
    ...(card.colors !== undefined ? { colors: card.colors } : {}),
  }
}

/** Looks the cards up that are not known yet; one answer per key. */
export async function resolvePictures(db: LocalDatabase, cards: Iterable<VisibleCard>, known: ReadonlyMap<string, Resolution>): Promise<Map<string, Resolution>> {
  const wanted = new Map<string, VisibleCard>()
  for (const card of cards) {
    const key = pictureKey(card)
    if (key !== null && !known.has(key) && !wanted.has(key)) wanted.set(key, card)
  }
  const found = new Map<string, Resolution>()
  for (const [key, card] of wanted) {
    const resolution = await resolveEngineKey(db, card.key!, hintsOf(card))
    found.set(key, resolution.status === "found" ? { status: "found", match: resolution.match } : { status: "none" })
  }
  return found
}

/** The picture of a resolved card in the player's card language. */
export function pictureOf(resolution: Resolution, language: TextLanguage): TableCardPicture {
  if (resolution.status === "none") return "none"
  const display = cardDisplay(resolution.match.card, { match: resolution.match, language })
  const picture = display.picture
  if (picture === null) return "none"
  return {
    src: picture.urls.grid,
    srcSet: `${picture.urls.thumb} ${IMAGE_SIZES.thumb.width}w, ${picture.urls.grid} ${IMAGE_SIZES.grid.width}w`,
    large: picture.urls.display,
    largeSrcSet: `${picture.urls.grid} ${IMAGE_SIZES.grid.width}w, ${picture.urls.display} ${IMAGE_SIZES.display.width}w`,
    lang: picture.lang,
  }
}

/**
 * The table's picture lookup for `cards` (a new list with every new state).
 * Resolves each new key once against the installed catalog; without a usable
 * catalog every card is "none" (the table shows Forge's words).
 */
export function useTableCards(cards: readonly VisibleCard[], language: TextLanguage): TableCardLookup {
  const { snapshot } = useStorage()
  const catalog = useCardCatalog()
  const database = snapshot.status === "ready" ? snapshot.database : null
  const version = catalog.usable ? (catalog.installed?.version ?? null) : null
  // The catalog's answers for this catalog version (static data, see above).
  const [store, setStore] = useState<{ readonly version: string | null; readonly resolutions: ReadonlyMap<string, Resolution>; readonly failed: boolean }>({
    version,
    resolutions: new Map(),
    failed: false,
  })
  const current = store.version === version ? store : { version, resolutions: EMPTY, failed: false }
  const { resolutions, failed } = current

  useEffect(() => {
    if (database === null || version === null || failed) return
    let active = true
    resolvePictures(database, cards, resolutions).then(
      (found) => {
        if (!active || found.size === 0) return
        setStore((previous) => {
          const base = previous.version === version ? previous.resolutions : EMPTY
          return { version, resolutions: new Map([...base, ...found]), failed: false }
        })
      },
      () => {
        // The catalog could not be read: no pictures (the settings' card data card says why).
        if (active) setStore({ version, resolutions, failed: true })
      },
    )
    return () => {
      active = false
    }
  }, [database, version, cards, resolutions, failed])

  return useMemo(() => {
    const pictures = new Map<string, TableCardPicture>()
    for (const [key, resolution] of resolutions) pictures.set(key, pictureOf(resolution, language))
    return (card: VisibleCard): TableCardPicture => {
      if (version === null || failed || database === null) return "none"
      const key = pictureKey(card)
      if (key === null) return "none"
      return pictures.get(key) ?? "loading"
    }
  }, [version, failed, resolutions, language, database])
}

const EMPTY: ReadonlyMap<string, Resolution> = new Map()
