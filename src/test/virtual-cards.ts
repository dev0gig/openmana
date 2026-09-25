/*
 * Test stand-in for virtual:openmana-cards (vitest.config.ts): the small real
 * catalog built from cards/fixtures (src/test/catalog-fixtures.ts), so
 * component tests can install and look it up (serving its file with a fetch
 * stand-in) without a catalog build. The real catalog is tested end to end
 * (scripts/e2e/run.ts).
 */
import type { CardAssets } from "@/cards/card-assets-types"
import { fixtureCatalogFile } from "../../cards/scripts/fixtures.ts"

export const CARD_ASSETS: CardAssets = fixtureCatalogFile().assets
