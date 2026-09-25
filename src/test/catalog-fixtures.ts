/*
 * The card catalog fixtures for the app's tests: the small real catalog of
 * cards/scripts/fixtures.ts, and installing it into a test database.
 */
import { installCatalog } from "@/cards/catalog-install"
import type { LocalDatabase } from "@/storage/database"
import { fixtureCatalogFile, serveFile, type FixtureCatalogFile } from "../../cards/scripts/fixtures.ts"

export * from "../../cards/scripts/fixtures.ts"

/** Installs the fixture catalog into a test database (as the app would). */
export async function installFixtureCatalog(db: LocalDatabase): Promise<FixtureCatalogFile> {
  const file = fixtureCatalogFile()
  await installCatalog(db, file.assets, {
    fetch: serveFile(file.assets.url, file.gzip).fetch,
    storage: { estimate: async () => ({ usage: 0, quota: 10_000_000_000 }) },
    locks: null,
  })
  return file
}
