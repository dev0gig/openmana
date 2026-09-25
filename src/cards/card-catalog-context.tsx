/*
 * The card catalog for the whole app: which catalog this build ships, what
 * this device holds of it, and installing it (with progress, stoppable).
 * One provider in the app shell, so an install keeps running when the
 * player changes pages.
 *
 * The catalog is installed when the player asks (settings, card lookup);
 * later steps (deck import, games) ask for it where they need it. An older
 * installed version stays usable until a new one is installed.
 */
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { useStorage, useStorageQuery, type StorageQuery } from "@/storage/storage-context"
import { cardAssets as buildCardAssets } from "./card-assets"
import type { CardAssets } from "./card-assets-types"
import type { InstallOptions, InstallProgress } from "./catalog-install"
import { readInstalledCatalog, type InstalledCatalog } from "./catalog-state"
import { CardDataError } from "./errors"

export type CatalogStatus =
  /** This build has no catalog. */
  | "unavailable"
  /** The local database is opening or being read. */
  | "loading"
  /** The local database cannot be read (its own card in the settings says why). */
  | "storage-error"
  | "missing"
  /** An install did not finish (or runs in another tab). */
  | "partial"
  /** Another (older) version is installed: usable until the new one is. */
  | "outdated"
  | "ready"
  | "installing"

export interface CardCatalogState {
  readonly assets: CardAssets
  readonly status: CatalogStatus
  readonly installed: Extract<InstalledCatalog, { status: "complete" }> | null
  /** While installing: how far (null until the first bytes arrive). */
  readonly progress: InstallProgress | null
  /** The last install attempt in this tab failed (cleared by the next attempt). */
  readonly error: CardDataError | null
  /** Lookups work: a complete catalog of any version is there. */
  readonly usable: boolean
  install: () => Promise<void>
  cancel: () => void
}

const CardCatalogContext = createContext<CardCatalogState | null>(null)

function statusOf(assets: CardAssets, query: StorageQuery<InstalledCatalog>, installing: boolean): CatalogStatus {
  if (installing) return "installing"
  if (query.status === "loading") return assets.available ? "loading" : "unavailable"
  if (query.status === "error") return "storage-error"
  const installed = query.data
  if (installed.status === "complete") return assets.available && installed.version === assets.id ? "ready" : "outdated"
  if (!assets.available) return "unavailable"
  return installed.status
}

export function CardCatalogProvider({
  children,
  assets = buildCardAssets,
  options,
}: {
  children: ReactNode
  assets?: CardAssets
  /** For tests: fetch, storage estimate, locks. */
  options?: Omit<InstallOptions, "signal" | "onProgress">
}) {
  const { snapshot } = useStorage()
  const query = useStorageQuery(["cacheIndex"], readInstalledCatalog)
  const [job, setJob] = useState<{ readonly progress: InstallProgress | null } | null>(null)
  const [error, setError] = useState<CardDataError | null>(null)
  const controller = useRef<AbortController | null>(null)
  const database = snapshot.status === "ready" ? snapshot.database : null

  const install = useCallback(async () => {
    if (!assets.available) {
      setError(new CardDataError("unavailable", "this build has no card catalog", { detail: assets.detail }))
      return
    }
    if (database === null || controller.current !== null) return
    const abort = new AbortController()
    controller.current = abort
    setJob({ progress: null })
    setError(null)
    try {
      // Loaded on demand: the install code and the catalog's validators are not needed to start the app.
      const { installCatalog } = await import("./catalog-install")
      const result = await installCatalog(database, assets, {
        ...options,
        signal: abort.signal,
        onProgress: (progress) => setJob({ progress }),
      })
      if (result.installed) toast.success("Kartendaten eingerichtet", { description: `${result.records.toLocaleString("de-DE")} Einträge von Scryfall.` })
    } catch (caught) {
      setError(caught instanceof CardDataError ? caught : new CardDataError("storage", "installing the card catalog failed", { cause: caught, detail: String(caught) }))
    } finally {
      controller.current = null
      setJob(null)
    }
  }, [assets, database, options])

  const cancel = useCallback(() => controller.current?.abort(), [])

  const value = useMemo<CardCatalogState>(() => {
    const status = statusOf(assets, query, job !== null)
    const installed = query.status === "ready" && query.data.status === "complete" ? query.data : null
    return {
      assets,
      status,
      installed,
      progress: job?.progress ?? null,
      error,
      usable: installed !== null && job === null,
      install,
      cancel,
    }
  }, [assets, query, job, error, install, cancel])

  return <CardCatalogContext value={value}>{children}</CardCatalogContext>
}

export function useCardCatalog(): CardCatalogState {
  const value = use(CardCatalogContext)
  if (!value) throw new Error("useCardCatalog outside CardCatalogProvider")
  return value
}
