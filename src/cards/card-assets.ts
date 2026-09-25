/*
 * The card catalog this build ships (or why it ships none), from the build
 * (vite/card-assets.ts). The only place the app reads the virtual module.
 */
import { CARD_ASSETS } from "virtual:openmana-cards"
import type { CardAssets } from "./card-assets-types"

export const cardAssets: CardAssets = CARD_ASSETS
